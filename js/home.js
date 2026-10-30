/**
 * Know Your Finance (KYF) — Lean Launchpad Controller (`js/home.js`)
 */
window.addEventListener("DOMContentLoaded", async () => {
  const cur = window.KYF_CURRICULUM;
  const dict = window.KYF_DICTIONARY;
  const pulse = window.KYF_MARKET_PULSE;
  let state = await window.KYF_DB.loadState();

  function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    const btn = document.getElementById("btnThemeToggle");
    if (btn) btn.textContent = theme === "night-ink" ? "☀️" : "🌙";
  }

  function render() {
    applyTheme(state.theme);

    // Card 1: Milestone & Savings
    const goalObj = cur.goalTemplates.find(g => g.id === state.goalId) || cur.goalTemplates[1];
    const futureCost = cur.math.inflateGoalCost(state.goalCostToday, state.goalYears, goalObj.fallbackInflation);
    document.getElementById("pillMilestone").textContent = `${state.selectedAssets.length} savings types selected`;
    document.getElementById("savedMilestone").textContent =
      `Saved: ${cur.math.formatINRCompact(state.goalCostToday)} ${goalObj.title} → ${cur.math.formatINRCompact(futureCost)} in ${state.goalYears} yrs`;

    // Card 2: Vocabulary
    const count = state.masteredWords.length;
    document.getElementById("pillWords").textContent = `${count} of 50 learned`;
    const activeTerm = dict.terms[state.activeWordId] || dict.terms.purchasing_power;
    document.getElementById("savedWord").textContent = `Up next: ${activeTerm.term}`;

    // Card 3: Chapters & Market Data
    document.getElementById("pillChapters").textContent = `On Chapter ${state.activeChapter} of 10`;
    if (pulse && pulse.preciousMetals) {
      const g24 = pulse.preciousMetals.gold24kPerGram.toLocaleString("en-IN");
      const n50pe = pulse.indices.NIFTY50.pe;
      document.getElementById("savedMarket").textContent =
        `24K Gold: ₹${g24}/g • Nifty 50 P/E: ${n50pe}`;
    }
  }

  document.getElementById("btnThemeToggle").addEventListener("click", async () => {
    const next = state.theme === "night-ink" ? "warm-paper" : "night-ink";
    state = await window.KYF_DB.saveState({ theme: next });
    applyTheme(next);
  });

  document.getElementById("btnWipeVault").addEventListener("click", async () => {
    if (confirm("Start fresh and reset your saved milestone and word progress?")) {
      state = await window.KYF_DB.wipeVault();
      render();
    }
  });

  const modal = document.getElementById("privacyModal");
  document.getElementById("btnPrivacyModal").addEventListener("click", () => { modal.hidden = false; });
  document.getElementById("btnClosePrivacyModal").addEventListener("click", () => { modal.hidden = true; });
  modal.addEventListener("click", (e) => { if (e.target === modal) modal.hidden = true; });

  render();
});