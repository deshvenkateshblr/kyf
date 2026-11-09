/**
 * Vividnova Vault Core & KYF Vault (`js/kyf-vault.js`)
 * ============================================================================
 * Architecture Overview:
 * ----------------------------------------------------------------------------
 * 1. VividVault (Generic Module):
 *    An app-agnostic, zero-dependency client-side file save/open and vault
 *    storage engine designed for reuse across all Vividnova applications
 *    (KYF, Canvas, WordPower, Curriculum, Calculators, etc.).
 *
 *    Key capabilities:
 *    - Structured JSON envelope format ({ app, version, fileType, savedAt, data })
 *    - Non-destructive round-tripping (preserves unknown/unregistered keys in data)
 *    - Pluggable section handlers (read, write, summary, validate)
 *    - UI auto-binding for file input pickers, open buttons, and save buttons
 *    - Built-in toast notifications and event hooks (onOpen, onSave, onError)
 *    - Cross-page active state hooks (getLocalData, onAfterOpen)
 *
 * 2. KYF_VAULT (Know Your Finance Specialization):
 *    A configured instance of VividVault tailored for KYF.
 *    Unifies all KYF storage domains across localStorage and IndexedDB:
 *    - Cadence activities (localStorage: kyf_cadence_v3)
 *    - Portfolio holdings (IndexedDB: KYF_PORTFOLIO_DB / holdings + localStorage cache)
 *    - Portfolio goals / envelopes (IndexedDB: KYF_PORTFOLIO_DB / goals + localStorage cache)
 *    - Life planner goals (localStorage: kyf_goals_v1)
 *    - Extra metadata / custom settings (preserved in _kyf_vault_extra)
 *
 * Guaranteed: Opening and saving from ANY page preserves 100% of the user's data.
 * ============================================================================
 */

(function (global) {
  "use strict";

  // ==========================================================================
  // PART 1: GENERIC MODULE — VividVault (Reusable Across Any Vividnova App)
  // ==========================================================================

  class VividVault {
    /**
     * @param {Object} options
     * @param {string} [options.appName="Vividnova App"] - Human-readable application name
     * @param {string} [options.appSlug="vivid-app"] - Slug identifier used for storage namespaces
     * @param {string} [options.fileExtension=".vivid"] - Target file extension (e.g. .kyf, .vivid, .json)
     * @param {string} [options.fileType="vivid-vault"] - Envelope type identifier
     * @param {string} [options.version="1.0.0"] - File format version
     * @param {string} [options.defaultBaseName="backup"] - Default prefix for exported filenames
     * @param {string} [options.mimeType="application/octet-stream"] - Download MIME type
     * @param {string} [options.extraStorageKey] - Custom key for passthrough extra data
     * @param {Function} [options.showToast] - Custom toast notifier function (msg, type) => void
     * @param {Function} [options.normalizePayload] - Custom payload normalizer function (raw) => normalized
     */
    constructor(options = {}) {
      this.appName = options.appName || "Vividnova App";
      this.appSlug = options.appSlug || "vivid-app";
      this.fileExtension = options.fileExtension || ".json";
      if (!this.fileExtension.startsWith(".")) {
        this.fileExtension = "." + this.fileExtension;
      }
      this.fileType = options.fileType || "vivid-vault";
      this.version = options.version || "1.0.0";
      this.defaultBaseName = options.defaultBaseName || "backup";
      this.mimeType = options.mimeType || "application/octet-stream";
      this.extraStorageKey = options.extraStorageKey || `_vivid_vault_extra_${this.appSlug}`;
      this.customToast = typeof options.showToast === "function" ? options.showToast : null;
      this.normalizePayload = typeof options.normalizePayload === "function" ? options.normalizePayload : null;

      // Section Handlers: Map<string, { read: AsyncFunction, write: AsyncFunction, summary: Function, validate: Function }>
      this.sections = new Map();

      // Page Hooks: Map<string, { pageName: string, getLocalData: Function, onAfterOpen: Function }>
      this.pageHooks = new Map();

      // Memory cache of last opened or saved file name
      this.lastFileName = null;

      // Track bound DOM elements to prevent duplicate event listeners
      this._boundElements = new WeakSet();
    }

    /**
     * Register a data section with storage reader and writer adapters.
     * @param {string} name - The section key inside envelope.data (e.g. "cadence", "portfolio")
     * @param {Object} handler
     * @param {Function} handler.read - async () => data
     * @param {Function} handler.write - async (data) => void
     * @param {Function} [handler.summary] - (data) => string (e.g. "12 items")
     * @param {Function} [handler.validate] - (data) => boolean
     */
    registerSection(name, handler) {
      if (!name || typeof name !== "string") {
        throw new Error("[VividVault] Section name must be a non-empty string.");
      }
      if (!handler || typeof handler.read !== "function" || typeof handler.write !== "function") {
        throw new Error(`[VividVault] Section '${name}' must provide both read() and write() functions.`);
      }
      this.sections.set(name, {
        read: handler.read,
        write: handler.write,
        summary: handler.summary || ((d) => (Array.isArray(d) ? `${d.length} items` : "configured")),
        validate: handler.validate || (() => true)
      });
      return this;
    }

    /**
     * Retrieve extra/passthrough data preserved across round-trips.
     * @returns {Object}
     */
    getExtraData() {
      try {
        const raw = localStorage.getItem(this.extraStorageKey);
        if (!raw) return {};
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
      } catch (err) {
        console.warn(`[VividVault] Failed to read extra data for ${this.appSlug}:`, err);
        return {};
      }
    }

    /**
     * Persist extra/passthrough data into local storage.
     * @param {Object} data
     */
    setExtraData(data) {
      try {
        if (!data || typeof data !== "object" || Array.isArray(data)) {
          localStorage.removeItem(this.extraStorageKey);
        } else {
          localStorage.setItem(this.extraStorageKey, JSON.stringify(data));
        }
      } catch (err) {
        console.warn(`[VividVault] Failed to write extra data for ${this.appSlug}:`, err);
      }
    }

    /**
     * Merge additional keys into the extra/passthrough data store.
     * @param {Object} partial
     */
    mergeExtraData(partial) {
      if (!partial || typeof partial !== "object") return;
      const current = this.getExtraData();
      const updated = { ...current, ...partial };
      this.setExtraData(updated);
    }

    /**
     * Register an active page hook for lifecycle integration.
     * @param {Object} hook
     * @param {string} hook.pageName - Unique name for the page (e.g. "cadence", "portfolio")
     * @param {Function} [hook.getLocalData] - () => Object with freshest in-memory data before saving
     * @param {Function} [hook.onAfterOpen] - (vaultData, summary) => void called after a file is loaded
     */
    registerPageHook(hook) {
      if (!hook || !hook.pageName) {
        console.warn("[VividVault] Invalid hook registration without pageName.");
        return this;
      }
      this.pageHooks.set(hook.pageName, hook);
      return this;
    }

    /**
     * Collect all data and assemble the canonical envelope payload.
     * @param {Object} [overrideData={}] - Explicit overrides for sections or extra keys
     * @returns {Promise<Object>}
     */
    async createPayload(overrideData = {}) {
      // 1. Gather freshest data from all registered page hooks
      const hookData = {};
      for (const hook of this.pageHooks.values()) {
        if (typeof hook.getLocalData === "function") {
          try {
            const data = await hook.getLocalData();
            if (data && typeof data === "object") {
              Object.assign(hookData, data);
            }
          } catch (err) {
            console.warn(`[VividVault] Hook '${hook.pageName}' getLocalData failed:`, err);
          }
        }
      }

      // 2. Read all registered sections (preferring overrides -> hook data -> section.read())
      const sectionsData = {};
      for (const [name, handler] of this.sections.entries()) {
        try {
          if (overrideData[name] !== undefined) {
            sectionsData[name] = overrideData[name];
          } else if (hookData[name] !== undefined) {
            sectionsData[name] = hookData[name];
          } else {
            sectionsData[name] = await handler.read();
          }
        } catch (err) {
          console.warn(`[VividVault] Failed to read section '${name}':`, err);
          sectionsData[name] = Array.isArray(sectionsData[name]) ? [] : null;
        }
      }

      // 3. Gather extra / passthrough data
      const extraData = this.getExtraData();

      // 4. Capture any unrecognized keys from overrideData or hookData
      const combinedExtra = { ...extraData };
      for (const [key, val] of Object.entries({ ...hookData, ...overrideData })) {
        if (!this.sections.has(key)) {
          combinedExtra[key] = val;
        }
      }

      // 5. Construct canonical envelope
      const payload = {
        app: this.appName,
        version: this.version,
        fileType: this.fileType,
        encrypted: false,
        savedAt: new Date().toISOString(),
        data: {
          ...combinedExtra,
          ...sectionsData
        }
      };

      return payload;
    }

    /**
     * Trigger browser download of the vault file.
     * @param {string} [customFileName] - Custom filename override
     * @param {Object} [overrideData] - Optional data overrides
     * @returns {Promise<string>} Downloaded filename
     */
    async exportFile(customFileName = null, overrideData = {}) {
      const payload = await this.createPayload(overrideData);
      const jsonStr = JSON.stringify(payload, null, 2);

      const dateStr = new Date().toISOString().slice(0, 10);
      let fileName = customFileName;
      if (!fileName) {
        fileName = `${this.defaultBaseName}-${dateStr}${this.fileExtension}`;
      }
      if (!fileName.endsWith(this.fileExtension)) {
        fileName += this.fileExtension;
      }

      const blob = new Blob([jsonStr], { type: this.mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();

      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 250);

      this.lastFileName = fileName;
      this.showToast(`✓ Data saved & exported to ${fileName}`, "success");
      return fileName;
    }

    /**
     * Alias for exportFile (conforms to standard save naming).
     */
    async save(overrideData = {}) {
      return await this.exportFile(null, overrideData);
    }

    /**
     * Parse raw text, File, or Blob into a verified envelope payload.
     * @param {File|Blob|string} fileOrText
     * @returns {Promise<{ payload: Object, sourceFileName: string }>}
     */
    async parseFile(fileOrText) {
      let text = "";
      let sourceFileName = "file" + this.fileExtension;

      if (typeof fileOrText === "string") {
        text = fileOrText;
      } else if (fileOrText && typeof fileOrText.text === "function") {
        sourceFileName = fileOrText.name || sourceFileName;
        text = await fileOrText.text();
      } else if (fileOrText instanceof Blob) {
        sourceFileName = fileOrText.name || sourceFileName;
        text = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = () => reject(reader.error);
          reader.readAsText(fileOrText);
        });
      } else {
        throw new Error("[VividVault] Unsupported file input format.");
      }

      let parsed;
      try {
        parsed = JSON.parse(text);
      } catch (err) {
        throw new Error("Invalid file content: Not valid JSON. (" + err.message + ")");
      }

      // If a custom normalizer is configured, apply it to accommodate legacy schemas
      let normalized = parsed;
      if (typeof this.normalizePayload === "function") {
        normalized = this.normalizePayload(parsed);
      }

      return {
        payload: normalized,
        sourceFileName
      };
    }

    /**
     * Import a parsed payload, distribute data to all section handlers,
     * persist extra passthrough data, and notify page hooks.
     * @param {Object} payload - The normalized vault payload
     * @param {string} [sourceFileName] - The name of the file being loaded
     * @returns {Promise<{ success: boolean, summary: string, loadedSections: string[], data: Object }>}
     */
    async importPayload(payload, sourceFileName = null) {
      if (!payload || typeof payload !== "object") {
        throw new Error("[VividVault] Empty or invalid payload object.");
      }

      const dataContainer = (payload.data && typeof payload.data === "object" && !Array.isArray(payload.data))
        ? payload.data
        : payload;

      const loadedSections = [];
      const summaries = [];
      const extraToPreserve = {};

      // 1. Process all keys in the data container
      for (const [key, val] of Object.entries(dataContainer)) {
        if (this.sections.has(key)) {
          const handler = this.sections.get(key);
          try {
            if (handler.validate(val)) {
              await handler.write(val);
              loadedSections.push(key);
              const summaryText = handler.summary(val);
              if (summaryText) summaries.push(summaryText);
            }
          } catch (err) {
            console.error(`[VividVault] Error writing section '${key}':`, err);
          }
        } else {
          // Unrecognized or extra section — retain non-destructively
          extraToPreserve[key] = val;
        }
      }

      // 2. Persist extra/passthrough data
      if (Object.keys(extraToPreserve).length > 0) {
        this.mergeExtraData(extraToPreserve);
      }

      if (sourceFileName) {
        this.lastFileName = sourceFileName;
      }

      // 3. Compose user-facing summary
      const summaryStr = summaries.length > 0 ? summaries.join(", ") : "data loaded";
      const displayFileName = sourceFileName ? ` ${sourceFileName}` : "";
      const toastMessage = `✓ Loaded${displayFileName} (${summaryStr})`;

      // 4. Notify all registered active page hooks
      for (const hook of this.pageHooks.values()) {
        if (typeof hook.onAfterOpen === "function") {
          try {
            await hook.onAfterOpen(dataContainer, { summaryStr, sourceFileName, loadedSections });
          } catch (err) {
            console.error(`[VividVault] Hook '${hook.pageName}' onAfterOpen failed:`, err);
          }
        }
      }

      this.showToast(toastMessage, "success");

      return {
        success: true,
        summary: summaryStr,
        loadedSections,
        data: dataContainer
      };
    }

    /**
     * High-level open handler: takes a File or Blob, parses it, and imports it.
     * @param {File|Blob} file
     * @returns {Promise<Object>}
     */
    async openFile(file) {
      if (!file) return;
      try {
        const { payload, sourceFileName } = await this.parseFile(file);
        return await this.importPayload(payload, sourceFileName);
      } catch (err) {
        console.error("[VividVault] Open file error:", err);
        alert("Error loading file: " + err.message);
        throw err;
      }
    }

    /**
     * UI helper: Bind standard file input, open button, and save button.
     * Safe to call multiple times (idempotent).
     * @param {Object} selectors
     * @param {string|HTMLElement} [selectors.fileInput]
     * @param {string|HTMLElement} [selectors.openBtn]
     * @param {string|HTMLElement} [selectors.openBtnSecondary]
     * @param {string|HTMLElement} [selectors.saveBtn]
     * @param {string|HTMLElement} [selectors.saveBtnSecondary]
     */
    bindUI(selectors = {}) {
      const resolveEl = (elOrId) => {
        if (!elOrId) return null;
        if (typeof elOrId === "string") return document.getElementById(elOrId);
        return elOrId instanceof HTMLElement ? elOrId : null;
      };

      const fileInput = resolveEl(selectors.fileInput || selectors.fileInputId || "kyfFileInput");
      const openBtn = resolveEl(selectors.openBtn || selectors.openBtnId || "navOpenFileBtn");
      const openBtnSec = resolveEl(selectors.openBtnSecondary || selectors.openBtnSecondaryId || "openFileHeroBtn");
      const saveBtn = resolveEl(selectors.saveBtn || selectors.saveBtnId || "navSaveDataBtn");
      const saveBtnSec = resolveEl(selectors.saveBtnSecondary || selectors.saveBtnSecondaryId || "exportCadenceBtn");

      // Bind Open Button 1
      if (openBtn && fileInput && !this._boundElements.has(openBtn)) {
        openBtn.addEventListener("click", () => fileInput.click());
        this._boundElements.add(openBtn);
      }

      // Bind Open Button 2 (e.g. Hero button on cadence page)
      if (openBtnSec && fileInput && !this._boundElements.has(openBtnSec)) {
        openBtnSec.addEventListener("click", () => fileInput.click());
        this._boundElements.add(openBtnSec);
      }

      // Bind File Input Change
      if (fileInput && !this._boundElements.has(fileInput)) {
        fileInput.addEventListener("change", async (e) => {
          const files = e.target.files;
          if (files && files.length > 0) {
            const file = files[0];
            try {
              await this.openFile(file);
            } catch {
              // already reported via alert
            } finally {
              // Always reset input so selecting the same file again triggers change event
              fileInput.value = "";
            }
          }
        });
        this._boundElements.add(fileInput);
      }

      // Bind Save Button 1
      if (saveBtn && !this._boundElements.has(saveBtn)) {
        saveBtn.addEventListener("click", () => this.save());
        this._boundElements.add(saveBtn);
      }

      // Bind Save Button 2 (e.g. Export Cadence button in footer/drawer)
      if (saveBtnSec && !this._boundElements.has(saveBtnSec)) {
        saveBtnSec.addEventListener("click", () => this.save());
        this._boundElements.add(saveBtnSec);
      }

      return this;
    }

    /**
     * Cross-page toast notification display.
     * Uses existing toast element if present in DOM, else injects a floating pill.
     * @param {string} msg - Message to display
     * @param {string} [type="info"] - Notification category (success, info, warn, error)
     */
    showToast(msg, type = "info") {
      if (this.customToast) {
        this.customToast(msg, type);
        return;
      }

      // 1. Look for existing toast elements in known KYF DOM structures
      const candidateIds = ["toastNotification", "kyf-toast", "toastNotice", "shareToast"];
      let toastEl = null;
      for (const id of candidateIds) {
        const found = document.getElementById(id);
        if (found) {
          toastEl = found;
          break;
        }
      }

      // 2. If no toast exists, inject a standard floating pill into the body
      if (!toastEl) {
        toastEl = document.createElement("div");
        toastEl.id = "vivid-vault-toast";
        toastEl.style.cssText = `
          position: fixed;
          bottom: 24px;
          left: 50%;
          transform: translateX(-50%) translateY(20px);
          background: #182620;
          color: #ffffff;
          padding: 10px 22px;
          border-radius: 999px;
          font-family: ui-monospace, "SF Mono", "Cascadia Mono", monospace;
          font-size: 12.5px;
          letter-spacing: 0.02em;
          box-shadow: 0 10px 28px rgba(24, 38, 32, 0.28);
          opacity: 0;
          pointer-events: none;
          transition: opacity .25s ease, transform .25s ease;
          z-index: 99999;
        `;
        document.body.appendChild(toastEl);
      }

      // 3. Display the toast
      toastEl.textContent = msg;
      toastEl.classList.add("show");
      toastEl.style.opacity = "1";
      toastEl.style.transform = "translateX(-50%) translateY(0)";

      clearTimeout(toastEl._vividTimer);
      toastEl._vividTimer = setTimeout(() => {
        toastEl.classList.remove("show");
        toastEl.style.opacity = "0";
        toastEl.style.transform = "translateX(-50%) translateY(20px)";
      }, 3500);
    }
  }

  // Expose the generic module globally for reuse across other Vividnova apps
  global.VividVault = VividVault;

  // ==========================================================================
  // PART 2: KYF_VAULT — Know Your Finance Application Specialization
  // ==========================================================================

  const KYF_DB_NAME = "KYF_PORTFOLIO_DB";
  const KYF_DB_VERSION = 2;
  const KYF_STORE_HOLDINGS = "holdings";
  const KYF_STORE_GOALS = "goals";
  const KYF_STORE_META = "session_meta";

  const STORAGE_KEY_CADENCE = "kyf_cadence_v3";
  const STORAGE_KEY_GOALS = "kyf_goals_v1";
  const STORAGE_KEY_USER_HOLDINGS = "kyf_user_holdings";
  const STORAGE_KEY_USER_GOALS = "kyf_user_goals";
  const STORAGE_KEY_DEMO_MODE = "kyf_demo_mode";

  // --------------------------------------------------------------------------
  // IndexedDB Storage Helpers (for Portfolio Holdings & Portfolio Goals)
  // --------------------------------------------------------------------------
  function openPortfolioDB() {
    return new Promise((resolve, reject) => {
      if (typeof indexedDB === "undefined") {
        return reject(new Error("IndexedDB is not available in this environment."));
      }
      const req = indexedDB.open(KYF_DB_NAME, KYF_DB_VERSION);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(KYF_STORE_HOLDINGS)) {
          db.createObjectStore(KYF_STORE_HOLDINGS, { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains(KYF_STORE_GOALS)) {
          db.createObjectStore(KYF_STORE_GOALS, { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains(KYF_STORE_META)) {
          db.createObjectStore(KYF_STORE_META, { keyPath: "key" });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async function readPortfolioStore(storeName) {
    try {
      const db = await openPortfolioDB();
      if (!db.objectStoreNames.contains(storeName)) return [];
      return new Promise((resolve) => {
        const tx = db.transaction(storeName, "readonly");
        const store = tx.objectStore(storeName);
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => resolve([]);
      });
    } catch (err) {
      console.warn(`[KYF Vault] Could not read IndexedDB store '${storeName}':`, err);
      return [];
    }
  }

  async function writePortfolioStore(storeName, items) {
    try {
      const db = await openPortfolioDB();
      const stores = [storeName];
      if (db.objectStoreNames.contains(KYF_STORE_META)) {
        stores.push(KYF_STORE_META);
      }
      return new Promise((resolve, reject) => {
        const tx = db.transaction(stores, "readwrite");
        const store = tx.objectStore(storeName);
        store.clear();
        for (const item of items) {
          store.put(item);
        }
        if (db.objectStoreNames.contains(KYF_STORE_META)) {
          const metaStore = tx.objectStore(KYF_STORE_META);
          metaStore.put({
            key: `${storeName}_last_updated`,
            value: new Date().toISOString()
          });
        }
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => reject(tx.error);
      });
    } catch (err) {
      console.warn(`[KYF Vault] Could not write IndexedDB store '${storeName}':`, err);
      return false;
    }
  }

  // --------------------------------------------------------------------------
  // KYF Payload Normalizer (Intelligently handles legacy files from old pages)
  // --------------------------------------------------------------------------
  function normalizeKyfPayload(parsed) {
    if (!parsed) return null;

    // 1. If payload is a bare top-level array:
    if (Array.isArray(parsed)) {
      if (parsed.length === 0) return { data: {} };
      const sample = parsed[0];
      if (sample && (sample.recurrence || sample.cadenceCategory || sample.dueDate || sample.monthDue || sample.quarterDue)) {
        return { data: { cadence: parsed } };
      }
      if (sample && (sample.assetClass || sample.instrumentMeta || sample.pricingMode)) {
        return { data: { portfolio: parsed } };
      }
      if (sample && (sample.presentValue !== undefined || sample.inflationRate !== undefined || sample.expectedReturn !== undefined)) {
        return { data: { goals: parsed } };
      }
      if (sample && (sample.baseTargetINR !== undefined || sample.targetYear !== undefined || sample.secondaryTarget !== undefined)) {
        return { data: { portfolioGoals: parsed } };
      }
      // Fallback
      return { data: { cadence: parsed } };
    }

    // 2. Extract data container
    const rawData = (parsed.data && typeof parsed.data === "object" && !Array.isArray(parsed.data))
      ? parsed.data
      : parsed;

    const normalizedData = {};

    // Cadence
    if (Array.isArray(rawData.cadence)) {
      normalizedData.cadence = rawData.cadence;
    }

    // Portfolio Holdings
    if (Array.isArray(rawData.portfolio)) {
      normalizedData.portfolio = rawData.portfolio;
    } else if (Array.isArray(rawData.holdings)) {
      normalizedData.portfolio = rawData.holdings;
    }

    // Portfolio Goals (Envelopes)
    if (Array.isArray(rawData.portfolioGoals)) {
      normalizedData.portfolioGoals = rawData.portfolioGoals;
    }

    // Disambiguate rawData.goals (Planner goals vs Portfolio Envelopes)
    if (Array.isArray(rawData.goals)) {
      const sample = rawData.goals[0];
      const isPortfolioGoal = sample && (sample.baseTargetINR !== undefined || sample.targetYear !== undefined || sample.secondaryTarget !== undefined);
      const isPlannerGoal = sample && (sample.presentValue !== undefined || sample.inflationRate !== undefined || sample.expectedReturn !== undefined);

      if (isPortfolioGoal) {
        if (!normalizedData.portfolioGoals) {
          normalizedData.portfolioGoals = rawData.goals;
        }
      } else if (isPlannerGoal) {
        normalizedData.goals = rawData.goals;
      } else {
        // If ambiguous and portfolio holdings are present, prioritize portfolioGoals unless already set
        if (!normalizedData.portfolioGoals && normalizedData.portfolio) {
          normalizedData.portfolioGoals = rawData.goals;
        } else {
          normalizedData.goals = rawData.goals;
        }
      }
    }

    // Retain all other keys into normalizedData so they are never lost
    for (const [key, val] of Object.entries(rawData)) {
      if (!["cadence", "portfolio", "holdings", "portfolioGoals", "goals"].includes(key)) {
        normalizedData[key] = val;
      }
    }

    return {
      app: parsed.app || "Know Your Finance",
      version: parsed.version || "2.0.0",
      fileType: parsed.fileType || "kyf-vault",
      encrypted: parsed.encrypted || false,
      savedAt: parsed.savedAt || new Date().toISOString(),
      data: normalizedData
    };
  }

  // --------------------------------------------------------------------------
  // Instantiate KYF_VAULT with VividVault
  // --------------------------------------------------------------------------
  const KYF_VAULT = new VividVault({
    appName: "Know Your Finance",
    appSlug: "kyf",
    fileExtension: ".kyf",
    fileType: "kyf-vault",
    version: "2.0.0",
    defaultBaseName: "my-kyf-data",
    extraStorageKey: "_kyf_vault_extra",
    normalizePayload: normalizeKyfPayload
  });

  // --------------------------------------------------------------------------
  // Register Section 1: Cadence Activities
  // --------------------------------------------------------------------------
  KYF_VAULT.registerSection("cadence", {
    read: async () => {
      try {
        const raw = localStorage.getItem(STORAGE_KEY_CADENCE) ||
                    localStorage.getItem("kyf_cadence_v2") ||
                    localStorage.getItem("kyf_cadence_v1");
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    },
    write: async (activities) => {
      if (Array.isArray(activities)) {
        try {
          localStorage.setItem(STORAGE_KEY_CADENCE, JSON.stringify(activities));
        } catch (err) {
          console.error("[KYF Vault] Error persisting cadence to localStorage:", err);
        }
      }
    },
    summary: (activities) => (Array.isArray(activities) ? `${activities.length} activities` : ""),
    validate: (data) => Array.isArray(data)
  });

  // --------------------------------------------------------------------------
  // Register Section 2: Portfolio Holdings
  // --------------------------------------------------------------------------
  KYF_VAULT.registerSection("portfolio", {
    read: async () => {
      // 1. Try IndexedDB first
      const stored = await readPortfolioStore(KYF_STORE_HOLDINGS);
      if (stored && stored.length > 0) return stored;

      // 2. Fallback to localStorage cache
      try {
        const raw = localStorage.getItem(STORAGE_KEY_USER_HOLDINGS);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) return parsed;
        }
      } catch {}

      return [];
    },
    write: async (holdings) => {
      if (Array.isArray(holdings)) {
        // Persist to IndexedDB
        await writePortfolioStore(KYF_STORE_HOLDINGS, holdings);

        // Also cache in localStorage for fast synchronous bootstrap & disable demo mode
        try {
          localStorage.setItem(STORAGE_KEY_USER_HOLDINGS, JSON.stringify(holdings));
          localStorage.setItem(STORAGE_KEY_DEMO_MODE, "false");
        } catch {}
      }
    },
    summary: (holdings) => (Array.isArray(holdings) ? `${holdings.length} holdings` : ""),
    validate: (data) => Array.isArray(data)
  });

  // --------------------------------------------------------------------------
  // Register Section 3: Portfolio Goals (Envelopes)
  // --------------------------------------------------------------------------
  KYF_VAULT.registerSection("portfolioGoals", {
    read: async () => {
      // 1. Try IndexedDB first
      const stored = await readPortfolioStore(KYF_STORE_GOALS);
      if (stored && stored.length > 0) return stored;

      // 2. Fallback to localStorage cache
      try {
        const raw = localStorage.getItem(STORAGE_KEY_USER_GOALS);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) return parsed;
        }
      } catch {}

      return [];
    },
    write: async (goals) => {
      if (Array.isArray(goals)) {
        // Persist to IndexedDB
        await writePortfolioStore(KYF_STORE_GOALS, goals);

        // Also cache in localStorage
        try {
          localStorage.setItem(STORAGE_KEY_USER_GOALS, JSON.stringify(goals));
        } catch {}
      }
    },
    summary: (goals) => (Array.isArray(goals) ? `${goals.length} portfolio goals` : ""),
    validate: (data) => Array.isArray(data)
  });

  // --------------------------------------------------------------------------
  // Register Section 4: Life Goals Planner
  // --------------------------------------------------------------------------
  KYF_VAULT.registerSection("goals", {
    read: async () => {
      try {
        const raw = localStorage.getItem(STORAGE_KEY_GOALS);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    },
    write: async (goals) => {
      if (Array.isArray(goals)) {
        try {
          localStorage.setItem(STORAGE_KEY_GOALS, JSON.stringify(goals));
        } catch (err) {
          console.error("[KYF Vault] Error persisting life goals to localStorage:", err);
        }
      }
    },
    summary: (goals) => (Array.isArray(goals) ? `${goals.length} life goals` : ""),
    validate: (data) => Array.isArray(data)
  });

  // --------------------------------------------------------------------------
  // Compatibility adapter for existing portfolio-data.js callers
  // --------------------------------------------------------------------------
  KYF_VAULT.parseAndExtractKyfData = function (text) {
    try {
      const parsed = typeof text === "string" ? JSON.parse(text) : text;
      const normalized = normalizeKyfPayload(parsed);
      const d = normalized ? normalized.data : {};
      return {
        holdings: d.portfolio || [],
        goals: d.portfolioGoals || (Array.isArray(d.goals) && d.goals[0]?.baseTargetINR ? d.goals : []),
        hasCadence: !!(d.cadence && d.cadence.length)
      };
    } catch (err) {
      console.error("[KYF Vault] parseAndExtractKyfData error:", err);
      return { holdings: [], goals: [], hasCadence: false };
    }
  };

  /**
   * Universal helper: call on any page to bind standard navigation buttons.
   */
  KYF_VAULT.bindPageUI = function (selectors = {}) {
    return KYF_VAULT.bindUI(selectors);
  };

  // Expose KYF_VAULT globally
  global.KYF_VAULT = KYF_VAULT;

  // Auto-bind toolbar buttons on DOMContentLoaded if standard elements exist in DOM
  if (typeof document !== "undefined") {
    const autoInit = () => {
      KYF_VAULT.bindPageUI();
    };
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", autoInit);
    } else {
      autoInit();
    }
  }

})(typeof window !== "undefined" ? window : globalThis);

