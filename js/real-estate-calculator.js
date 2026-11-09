(function () {
      "use strict";

      const residexData = window.KYF_RESIDEX || {};
      let activeCity = "Bengaluru";

      function formatNumber(num, decimals = 1) {
        if (num === null || num === undefined || isNaN(num)) return "—";
        return Number(num).toLocaleString("en-IN", {
          minimumFractionDigits: decimals,
          maximumFractionDigits: decimals
        });
      }

      function formatInrLakhCrore(amount) {
        if (amount === null || amount === undefined || isNaN(amount)) return "—";
        const val = Math.abs(amount);
        const sign = amount < 0 ? "-" : "";
        if (val >= 10000000) {
          return `${sign}₹${(val / 10000000).toFixed(2)} Cr`;
        } else if (val >= 100000) {
          return `${sign}₹${(val / 100000).toFixed(2)} L`;
        }
        return `${sign}₹${formatNumber(Math.round(val), 0)}`;
      }

      function updateCalculator() {
        const citySelect = document.getElementById("reCalcCity");
        const tierSelect = document.getElementById("reCalcTier");
        const carpetSlider = document.getElementById("reCalcCarpetSlider");
        const loadingSlider = document.getElementById("reCalcLoadingSlider");

        if (!citySelect || !tierSelect || !carpetSlider || !loadingSlider) return;

        const cityName = citySelect.value || activeCity || "Bengaluru";
        const tierKey = tierSelect.value || "composite";
        const carpetArea = Number(carpetSlider.value) || 1000;
        const loadingPct = Number(loadingSlider.value) || 35;

        const carpetBadge = document.getElementById("reCalcCarpetVal");
        if (carpetBadge) carpetBadge.textContent = `${formatNumber(carpetArea, 0)} sq.ft.`;
        const loadingBadge = document.getElementById("reCalcLoadingVal");
        if (loadingBadge) loadingBadge.textContent = `${loadingPct}%`;

        const cityObj = residexData.cities?.[cityName] || {};
        const qtr = cityObj.summary?.latest_quarter || "Jun 2026";
        let carpetRate = 0;

        if (tierKey === "composite") {
          carpetRate = cityObj.summary?.carpet_price_sqft || 0;
        } else {
          carpetRate = cityObj.carpet_price_sqft_by2024?.[tierKey]?.[qtr] || cityObj.summary?.carpet_price_sqft || 0;
        }

        if (!carpetRate) carpetRate = 10000;

        const L = loadingPct / 100;
        const sbuaArea = Math.round(carpetArea * (1 + L));
        const brokerRate = Math.round(carpetRate / (1 + L));
        const commonArea = sbuaArea - carpetArea;
        const baseCost = carpetArea * carpetRate;
        const commonCost = Math.round(baseCost * (L / (1 + L)));
        const frictionCost = Math.round(baseCost * 0.07);
        const totalCost = baseCost + frictionCost;
        const effectiveCarpetRate = Math.round(totalCost / carpetArea);
        const realityGapPct = (((effectiveCarpetRate - brokerRate) / brokerRate) * 100).toFixed(1);

        const brokerRateEl = document.getElementById("reCalcBrokerRate");
        if (brokerRateEl) brokerRateEl.textContent = `₹${formatNumber(brokerRate, 0)} / sq.ft.`;
        const brokerSubEl = document.getElementById("reCalcBrokerSub");
        if (brokerSubEl) brokerSubEl.textContent = `Quoted on ${formatNumber(sbuaArea, 0)} sq.ft. gross area`;

        const carpetRateEl = document.getElementById("reCalcCarpetRate");
        if (carpetRateEl) carpetRateEl.textContent = `₹${formatNumber(carpetRate, 0)} / sq.ft.`;
        const carpetSubEl = document.getElementById("reCalcCarpetSub");
        if (carpetSubEl) carpetSubEl.textContent = `Paid for ${formatNumber(carpetArea, 0)} sq.ft. usable space`;

        const livingAreaEl = document.getElementById("reCalcLivingAreaText");
        if (livingAreaEl) livingAreaEl.textContent = `${formatNumber(carpetArea, 0)} sq.ft. (${formatInrLakhCrore(baseCost - commonCost)})`;

        const commonAreaEl = document.getElementById("reCalcCommonAreaText");
        if (commonAreaEl) commonAreaEl.textContent = `+${formatNumber(commonArea, 0)} sq.ft. (${formatInrLakhCrore(commonCost)})`;

        const baseCostEl = document.getElementById("reCalcBaseCostText");
        if (baseCostEl) baseCostEl.textContent = formatInrLakhCrore(baseCost);

        const frictionEl = document.getElementById("reCalcFrictionText");
        if (frictionEl) frictionEl.textContent = `+${formatInrLakhCrore(frictionCost)}`;

        const totalCostEl = document.getElementById("reCalcTotalCostText");
        if (totalCostEl) totalCostEl.textContent = formatInrLakhCrore(totalCost);

        const insightEl = document.getElementById("reCalcInsightText");
        if (insightEl) {
          insightEl.innerHTML = `
            💡 <strong>KYF Reality Check:</strong> The builder brochure quotes <strong>₹${formatNumber(brokerRate, 0)}/sq.ft.</strong> on paper. But after absorbing <strong>${loadingPct}% common area loading</strong> (${formatNumber(commonArea, 0)} sq.ft. of corridors/lifts) and <strong>7% statutory registration friction</strong>, your true all-in cost per livable square foot is <strong>₹${formatNumber(effectiveCarpetRate, 0)}/sq.ft.</strong> &mdash; an effective <strong>+${realityGapPct}% premium</strong> over the headline advertisement!
          `;
        }
      }

      function init() {
        const citySelect = document.getElementById("reCalcCity");
        const cities = residexData.cities || {};
        const cityNames = Object.keys(cities);

        // Check URL params for preselected city or carpet
        const params = new URLSearchParams(window.location.search);
        const paramCity = params.get("city");
        const paramCarpet = params.get("carpet");
        const paramLoading = params.get("loading");
        const paramTier = params.get("tier");

        if (paramCity && cities[paramCity]) {
          activeCity = paramCity;
        }

        if (citySelect) {
          citySelect.innerHTML = cityNames.map(c => `<option value="${c}" ${c === activeCity ? 'selected' : ''}>${c} (${cities[c].state || ''})</option>`).join("");
          citySelect.addEventListener("change", function () {
            activeCity = this.value;
            updateCalculator();
          });
        }

        const tierSelect = document.getElementById("reCalcTier");
        if (tierSelect) {
          if (paramTier) tierSelect.value = paramTier;
          tierSelect.addEventListener("change", updateCalculator);
        }

        const carpetSlider = document.getElementById("reCalcCarpetSlider");
        if (carpetSlider) {
          if (paramCarpet) carpetSlider.value = paramCarpet;
          carpetSlider.addEventListener("input", updateCalculator);
        }

        const loadingSlider = document.getElementById("reCalcLoadingSlider");
        if (loadingSlider) {
          if (paramLoading) loadingSlider.value = paramLoading;
          loadingSlider.addEventListener("input", updateCalculator);
        }

        // Preset chips
        document.querySelectorAll(".preset-chip").forEach(btn => {
          btn.addEventListener("click", function () {
            const c = this.dataset.carpet;
            const l = this.dataset.loading;
            const t = this.dataset.tier;
            if (c && carpetSlider) carpetSlider.value = c;
            if (l && loadingSlider) loadingSlider.value = l;
            if (t && tierSelect) tierSelect.value = t;
            updateCalculator();
          });
        });

        updateCalculator();

        if (window.KYF_VAULT) {
          window.KYF_VAULT.bindPageUI({
            fileInputId: "kyfFileInput",
            openBtnId: "navOpenFileBtn",
            saveBtnId: "navSaveDataBtn"
          });
        }
      }

      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
      } else {
        init();
      }
    })();