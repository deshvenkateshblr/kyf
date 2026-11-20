/**
 * KYF Family Portfolio Tracker — Data & Vault Lifecycle (`js/portfolio-data.js`)
 * Version: v1.32.0
 * Unified with KYF App-Level .kyf Vault Format (cadence + portfolio + goals)
 */

window.KYF_PORTFOLIO_DATA = (() => {
  const DB_NAME = "KYF_PORTFOLIO_DB";
  const DB_VERSION = 3;
  const STORE_HOLDINGS = "holdings";
  const STORE_GOALS = "goals";
  const STORE_MEMBERS = "members";
  const STORE_META = "session_meta";
  const CADENCE_STORAGE_KEY = "kyf_cadence_v3";

  // ==========================================================================
  // IndexedDB Storage Layer (Holdings + Goals + Meta)
  // ==========================================================================
  function openDatabase() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(STORE_HOLDINGS)) {
          db.createObjectStore(STORE_HOLDINGS, { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains(STORE_GOALS)) {
          db.createObjectStore(STORE_GOALS, { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains(STORE_MEMBERS)) {
          db.createObjectStore(STORE_MEMBERS, { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains(STORE_META)) {
          db.createObjectStore(STORE_META, { keyPath: "key" });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async function loadHoldingsFromDB() {
    try {
      const db = await openDatabase();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_HOLDINGS, "readonly");
        const store = tx.objectStore(STORE_HOLDINGS);
        const req = store.getAll();

        req.onsuccess = () => {
          resolve(req.result || []);
        };
        req.onerror = () => reject(req.error);
      });
    } catch (err) {
      console.warn("[KYF Portfolio] Error reading holdings from IndexedDB:", err);
      return [];
    }
  }

  async function saveHoldingsToDB(holdings) {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORE_HOLDINGS, STORE_META], "readwrite");
      const store = tx.objectStore(STORE_HOLDINGS);
      const metaStore = tx.objectStore(STORE_META);

      store.clear();
      for (const item of holdings) {
        store.put(item);
      }

      metaStore.put({
        key: "last_updated",
        value: new Date().toISOString()
      });

      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
    });
  }

  async function loadGoalsFromDB() {
    try {
      const db = await openDatabase();
      if (!db.objectStoreNames.contains(STORE_GOALS)) return [];
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_GOALS, "readonly");
        const store = tx.objectStore(STORE_GOALS);
        const req = store.getAll();

        req.onsuccess = () => resolve(window.KYF_GOALS ? window.KYF_GOALS.mergeGoalLists(req.result || []) : (req.result || []));
        req.onerror = () => reject(req.error);
      });
    } catch (err) {
      console.warn("[KYF Portfolio] Error reading goals from IndexedDB:", err);
      return [];
    }
  }

  async function saveGoalsToDB(goals) {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORE_GOALS, STORE_META], "readwrite");
      const store = tx.objectStore(STORE_GOALS);
      const metaStore = tx.objectStore(STORE_META);

      store.clear();
      for (const g of goals) {
        store.put(g);
      }

      metaStore.put({
        key: "goals_last_updated",
        value: new Date().toISOString()
      });

      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
    });
  }

  async function loadMembersFromDB() {
    try {
      const db = await openDatabase();
      if (!db.objectStoreNames.contains(STORE_MEMBERS)) return [];
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_MEMBERS, "readonly");
        const store = tx.objectStore(STORE_MEMBERS);
        const req = store.getAll();

        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
      });
    } catch (err) {
      console.warn("[KYF Portfolio] Error reading members from IndexedDB:", err);
      return [];
    }
  }

  async function saveMembersToDB(members) {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORE_MEMBERS, STORE_META], "readwrite");
      const store = tx.objectStore(STORE_MEMBERS);
      const metaStore = tx.objectStore(STORE_META);

      store.clear();
      for (const m of members) {
        store.put(m);
      }

      metaStore.put({
        key: "members_last_updated",
        value: new Date().toISOString()
      });

      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
    });
  }

  async function clearDatabase() {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const stores = [STORE_HOLDINGS, STORE_META];
      if (db.objectStoreNames.contains(STORE_GOALS)) {
        stores.push(STORE_GOALS);
      }
      if (db.objectStoreNames.contains(STORE_MEMBERS)) {
        stores.push(STORE_MEMBERS);
      }
      const tx = db.transaction(stores, "readwrite");
      for (const s of stores) {
        tx.objectStore(s).clear();
      }

      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
    });
  }

  // ==========================================================================
  // App-Level Unified .kyf Vault Import / Export (Cadence + Portfolio + Goals + Members)
  // Routed through shared js/kyf-vault.js
  // ==========================================================================
  function exportAppData(holdings, goals, members) {
    if (window.KYF_VAULT) {
      return window.KYF_VAULT.save({
        portfolio: holdings,
        goals: goals,
        members: members
      });
    }

    let cadenceData = null;
    try {
      const rawCadence = localStorage.getItem(CADENCE_STORAGE_KEY);
      if (rawCadence) cadenceData = JSON.parse(rawCadence);
    } catch {}

    const payload = {
      app: "Know Your Finance",
      version: "2.0.0",
      fileType: "kyf-vault",
      encrypted: false,
      savedAt: new Date().toISOString(),
      data: {
        cadence: cadenceData || [],
        portfolio: holdings,
        goals: goals || [],
        members: members || []
      }
    };
    const jsonStr = JSON.stringify(payload, null, 2);
    const blob = new Blob([jsonStr], { type: "application/octet-stream" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const dateStr = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `my-kyf-data-${dateStr}.kyf`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 200);
    return a.download;
  }

  function parseAndExtractKyfData(text) {
    if (window.KYF_VAULT && typeof window.KYF_VAULT.parseAndExtractKyfData === "function") {
      return window.KYF_VAULT.parseAndExtractKyfData(text);
    }

    const parsed = typeof text === "string" ? JSON.parse(text) : text;
    let importedHoldings = null;
    let importedGoals = null;
    let importedCadence = null;
    let importedMembers = null;

    if (parsed && parsed.data) {
      if (Array.isArray(parsed.data.portfolio)) importedHoldings = parsed.data.portfolio;
      else if (Array.isArray(parsed.data.holdings)) importedHoldings = parsed.data.holdings;

      if (Array.isArray(parsed.data.portfolioGoals)) importedGoals = parsed.data.portfolioGoals;
      else if (Array.isArray(parsed.data.goals)) importedGoals = parsed.data.goals;

      if (Array.isArray(parsed.data.members)) importedMembers = parsed.data.members;

      if (Array.isArray(parsed.data.cadence)) importedCadence = parsed.data.cadence;
    } else if (parsed && Array.isArray(parsed.holdings)) {
      importedHoldings = parsed.holdings;
      if (Array.isArray(parsed.goals)) importedGoals = parsed.goals;
      if (Array.isArray(parsed.members)) importedMembers = parsed.members;
    } else if (Array.isArray(parsed)) {
      importedHoldings = parsed;
    }

    if (importedCadence && importedCadence.length) {
      try {
        localStorage.setItem(CADENCE_STORAGE_KEY, JSON.stringify(importedCadence));
      } catch {}
    }

    return {
      holdings: importedHoldings || [],
      goals: importedGoals || null,
      members: importedMembers || null,
      hasCadence: !!(importedCadence && importedCadence.length)
    };
  }

  return {
    loadHoldingsFromDB,
    saveHoldingsToDB,
    loadGoalsFromDB,
    saveGoalsToDB,
    loadMembersFromDB,
    saveMembersToDB,
    clearDatabase,
    exportAppData,
    parseAndExtractKyfData
  };
})();

