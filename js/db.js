/**
 * Know Your Finance (KYF) — Shared On-Device Vault (`js/db.js`)
 * Stores user progress across index.html, canvas.html, wordpower.html & chapters.html
 */
window.KYF_DB = (() => {
  const DB_NAME = "KYF_USER_VAULT";
  const STORE_NAME = "workspace";
  const STATE_KEY = "active_profile";

  const DEFAULT_STATE = {
    theme: "warm-paper",
    lifeStage: "30s",
    familyContext: ["partner"],
    liabilities: ["debt_free", "health_term_shield"],
    goalId: "car_upgrade",
    goalCostToday: 1500000,
    goalYears: 4,
    selectedAssets: ["bank_fd", "gold", "mutual_funds"],
    assetValues: { bank_fd: 300000, gold: 150000, mutual_funds: 400000 },
    activeChapter: 1,
    activeWordId: "purchasing_power",
    masteredWords: [],
    reflexAnswers: {}
  };

  function openDB() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async function loadState() {
    try {
      const db = await openDB();
      return new Promise((resolve) => {
        const tx = db.transaction(STORE_NAME, "readonly");
        const req = tx.objectStore(STORE_NAME).get(STATE_KEY);
        req.onsuccess = () => resolve({ ...DEFAULT_STATE, ...(req.result || {}) });
        req.onerror = () => resolve({ ...DEFAULT_STATE });
      });
    } catch {
      return { ...DEFAULT_STATE };
    }
  }

  async function saveState(partialState) {
    const current = await loadState();
    const updated = { ...current, ...partialState, updatedAt: new Date().toISOString() };
    try {
      const db = await openDB();
      return new Promise((resolve) => {
        const tx = db.transaction(STORE_NAME, "readwrite");
        tx.objectStore(STORE_NAME).put(updated, STATE_KEY);
        tx.oncomplete = () => resolve(updated);
      });
    } catch {
      return updated;
    }
  }

  async function wipeVault() {
    try {
      const db = await openDB();
      return new Promise((resolve) => {
        const tx = db.transaction(STORE_NAME, "readwrite");
        tx.objectStore(STORE_NAME).clear();
        tx.oncomplete = () => resolve({ ...DEFAULT_STATE });
      });
    } catch {
      return { ...DEFAULT_STATE };
    }
  }

  return { loadState, saveState, wipeVault, DEFAULT_STATE };
})();