(function () {
      "use strict";

      const STORAGE_KEY = "kyf_cadence_v3";

      // State
      let selectedHorizon = "1y"; // '1m', '3m', '6m', '1y'
      let expandAllNse = false;
      let equityIsGainers = true;
      let equitySearchTerm = "";
      let mfCategory = "all";
      let flaggedOutliers = [];

      const pulseData = window.KYF_MARKET_PULSE || {};
      const equitiesData = window.KYF_MARKET_EQUITIES || {};
      const mfData = window.KYF_MARKET_MF || {};
      const caData = window.KYF_CORPORATE_ACTIONS || {};
      const residexData = window.KYF_RESIDEX || {};
      const caMap = new Map((caData.actions || []).map(a => [a[0], a]));

      // Real Estate State
      let activeReCity = "Bengaluru";
      let activeReViewMode = "hpi"; // 'hpi' or 'tiers'
      let reSortCol = "hpi_yoy_pct"; // 'hpi_index', 'hpi_yoy_pct', 'hpi_cagr_3y', 'hpi_cagr_5y', 'hpi_total_growth_8y', 'carpet_price_sqft'
      let reSortAsc = false;

      // Initialize As-Of Date
      if (pulseData.asOf) {
        const d = new Date(pulseData.asOf);
        const formatted = d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
        const asOfEl = document.getElementById("asOfDateText");
        if (asOfEl) asOfEl.textContent = formatted;
      }

      // Formatters
      function formatNumber(num, decimals = 1) {
        if (num === null || num === undefined || isNaN(num)) return "—";
        return Number(num).toLocaleString("en-IN", {
          minimumFractionDigits: decimals,
          maximumFractionDigits: decimals
        });
      }

      function formatReturnBadge(val) {
        if (val === null || val === undefined || isNaN(val)) {
          return `<span class="ret-badge neutral">—</span>`;
        }
        const num = Number(val);
        const sign = num > 0 ? "+" : "";
        const cls = num > 0 ? "pos" : (num < 0 ? "neg" : "neutral");
        return `<span class="ret-badge ${cls}">${sign}${num.toFixed(2)}%</span>`;
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

      function getHorizonMeta(h) {
        switch (h) {
          case "1m":
            return { idxKey: "ret1m", eqCol: 3, mfCol: 5, label: "1-Month Return", short: "1M Return" };
          case "3m":
            return { idxKey: "ret3m", eqCol: 4, mfCol: 6, label: "3-Month Return", short: "3M Return" };
          case "6m":
            return { idxKey: "ret6m", eqCol: 5, mfCol: 7, label: "6-Month Return", short: "6M Return" };
          case "1y":
          default:
            return { idxKey: "cagr1y", eqCol: 6, mfCol: 8, label: "1-Year Trailing Return", short: "1Y Return" };
        }
      }

      function getValuationTag(pe) {
        if (!pe || isNaN(pe)) return { label: "N/A", color: "var(--muted)" };
        const num = Number(pe);
        if (num < 20) return { label: "Comfort Zone", color: "var(--green)" };
        if (num <= 25) return { label: "Fairly Valued", color: "var(--amber)" };
        return { label: "Heated / Pricey", color: "var(--rose)" };
      }

      // ==========================================
      // SECTION 1: RENDER INDICES & MACRO
      // ==========================================
      function renderIndices() {
        const grid = document.getElementById("indicesGrid");
        if (!grid || !pulseData.indices) return;

        const meta = getHorizonMeta(selectedHorizon);
        const badgeEl = document.getElementById("indicesHorizonBadge");
        if (badgeEl) badgeEl.textContent = `Showing ${meta.label}`;

        let html = "";
        for (const [key, idx] of Object.entries(pulseData.indices)) {
          let retVal = idx[meta.idxKey];
          if (retVal === null || retVal === undefined) {
            if (selectedHorizon === "1m") retVal = idx.ret1m;
            else if (selectedHorizon === "3m") retVal = idx.ret3m;
            else if (selectedHorizon === "6m") retVal = idx.ret6m;
            else if (selectedHorizon === "1y") retVal = idx.ret1y != null ? idx.ret1y : idx.cagr1y;
          }
          if ((retVal === null || retVal === undefined) && (key === "NIFTY50" || idx.name === "Nifty 50") && equitiesData && equitiesData.stocks) {
            const bees = equitiesData.stocks.find(s => s[0] === "NIFTYBEES");
            if (bees && bees[meta.eqCol] !== undefined) {
              retVal = bees[meta.eqCol];
            }
          }
          const pe = idx.pe ? idx.pe.toFixed(1) : "—";
          const tag = getValuationTag(idx.pe);

          html += `
            <div class="index-card">
              <div>
                <div class="index-card-head">
                  <span class="index-category">P/E ${pe} &bull; <span style="color:${tag.color}; font-weight:700;">${tag.label}</span></span>
                  ${formatReturnBadge(retVal)}
                </div>
                <h3>${escapeHtml(idx.name)}</h3>
                <p class="index-role">${escapeHtml(idx.role || "")}</p>
                <div class="index-level-row" style="margin: 16px 0 0;">
                  <span class="index-level">${formatNumber(idx.level, 1)}</span>
                </div>
              </div>
            </div>
          `;
        }
        grid.innerHTML = html;
      }

      // Render Precious Metals
      function renderPreciousMetals() {
        const container = document.getElementById("metalsList");
        if (!container || !pulseData.preciousMetals) return;

        const pm = pulseData.preciousMetals;
        const meta = getHorizonMeta(selectedHorizon);
        const eqCol = meta.eqCol;

        const badge = document.getElementById("metalsHorizonBadge");
        if (badge) {
          badge.textContent = `Showing ${meta.label} (via ETFs)`;
        }

        // Resolve Gold return for active selectedHorizon (with fallback to GOLDBEES in equities)
        let goldRet = pm["goldRet" + selectedHorizon];
        if (goldRet === undefined && equitiesData.stocks) {
          const goldSym = pm.goldBenchmarkSymbol || "GOLDBEES";
          const goldStock = equitiesData.stocks.find(s => s[0] === goldSym || s[0] === "GOLDBEES");
          if (goldStock && goldStock[eqCol] !== undefined) {
            goldRet = goldStock[eqCol];
          }
        }

        // Resolve Silver return for active selectedHorizon (with fallback to SILVERBEES in equities)
        let silverRet = pm["silverRet" + selectedHorizon];
        if (silverRet === undefined && equitiesData.stocks) {
          const silverSym = pm.silverBenchmarkSymbol || "SILVERBEES";
          const silverStock = equitiesData.stocks.find(s => s[0] === silverSym || s[0] === "SILVERBEES");
          if (silverStock && silverStock[eqCol] !== undefined) {
            silverRet = silverStock[eqCol];
          }
        }

        container.innerHTML = `
          <div class="metal-item">
            <div>
              <div class="m-title">Gold — 24K Pure (99.9%)</div>
              <div class="m-sub">22K Jewellery Standard: ₹${formatNumber(pm.gold22kPerGram, 0)}/g • via ${escapeHtml(pm.goldBenchmarkSymbol || 'GOLDBEES')}</div>
            </div>
            <div style="text-align:right; display:flex; flex-direction:column; align-items:flex-end; gap:4px;">
              <div class="m-price">₹${formatNumber(pm.gold24kPerGram, 0)} / g</div>
              <div>${formatReturnBadge(goldRet)}</div>
            </div>
          </div>

          <div class="metal-item">
            <div>
              <div class="m-title">Silver — 999 Bullion Bar</div>
              <div class="m-sub">Retail Spot: ₹${formatNumber(pm.silverPerGram, 0)}/g • via ${escapeHtml(pm.silverBenchmarkSymbol || 'SILVERBEES')}</div>
            </div>
            <div style="text-align:right; display:flex; flex-direction:column; align-items:flex-end; gap:4px;">
              <div class="m-price">₹${formatNumber(pm.silverPerKg, 0)} / kg</div>
              <div>${formatReturnBadge(silverRet)}</div>
            </div>
          </div>
        `;
      }

      // Render Macro Rates
      function renderMacroRates() {
        const container = document.getElementById("ratesList");
        if (!container || !pulseData.macro) return;

        const m = pulseData.macro;
        container.innerHTML = `
          <div class="rate-box benchmark">
            <div class="r-lbl">CPI Inflation (Target Baseline)</div>
            <div class="r-val">${m.cpiInflation}%</div>
          </div>
          <div class="rate-box benchmark">
            <div class="r-lbl">Education / Medical Inflation</div>
            <div class="r-val">${m.educationInflation}% &ndash; ${m.medicalInflation}%</div>
          </div>
          <div class="rate-box">
            <div class="r-lbl">EPF (Tax-Free Sovereign)</div>
            <div class="r-val">${m.epfRate}%</div>
          </div>
          <div class="rate-box">
            <div class="r-lbl">PPF / SSY (Tax-Free)</div>
            <div class="r-val">${m.ppfRate}% / ${m.ssyRate}%</div>
          </div>
          <div class="rate-box">
            <div class="r-lbl">SBI 1Y Fixed Deposit</div>
            <div class="r-val">${m.sbiFd1Yr}%</div>
          </div>
          <div class="rate-box">
            <div class="r-lbl">Arbitrage / Liquid Avg</div>
            <div class="r-val">${m.arbitrageFundAvg}%</div>
          </div>
        `;

        const realSpreadEl = document.getElementById("realSpreadVal");
        if (realSpreadEl && m.epfRate && m.cpiInflation) {
          const spread = (m.epfRate - m.cpiInflation).toFixed(2);
          const sign = Number(spread) > 0 ? "+" : "";
          realSpreadEl.textContent = `${sign}${spread}% tax-free real yield over CPI`;
          if (realSpreadEl.previousElementSibling) {
            realSpreadEl.previousElementSibling.textContent = "Real EPF Spread over CPI:";
          }
        }
      }

      // ==========================================
      // REAL ESTATE (NHB RESIDEX) BENCHMARK MODULE
      // ==========================================
      function renderRealEstateAnchor() {
        const grid = document.getElementById("reAnchorGrid");
        if (!grid) return;
        const nat = residexData.national_composite_50_cities?.summary || {};
        const qtr = nat.latest_quarter || "Jun 2026";

        grid.innerHTML = `
          <div class="re-stat-box amber-highlight">
            <div class="re-lbl">
              <span>National HPI Benchmark</span>
              <span>${escapeHtml(qtr)}</span>
            </div>
            <div class="re-val">${formatNumber(nat.hpi_index, 2)}</div>
            <div class="re-subtext">
              ${formatReturnBadge(nat.hpi_yoy_pct)}
              <span>YoY (FY25=100 Rebased)</span>
            </div>
          </div>

          <div class="re-stat-box">
            <div class="re-lbl">
              <span>Composite Carpet Price</span>
              <span>50-City National</span>
            </div>
            <div class="re-val">₹${formatNumber(nat.carpet_price_sqft, 0)} <span style="font-size:12px; font-weight:400; color:var(--muted);">/sq.ft.</span></div>
            <div class="re-subtext">
              ${formatReturnBadge(nat.carpet_price_yoy_pct)}
              <span>YoY Composite Floor Rate</span>
            </div>
          </div>

          <div class="re-stat-box highlight">
            <div class="re-lbl">
              <span>5-Year Annualized CAGR</span>
              <span>2021–2026</span>
            </div>
            <div class="re-val" style="color:var(--teal-deep);">${nat.hpi_cagr_5y !== undefined ? nat.hpi_cagr_5y.toFixed(2) : '4.83'}% <span style="font-size:12px; font-weight:400; color:var(--muted);">p.a.</span></div>
            <div class="re-subtext">
              <span style="color:var(--ink-soft); font-weight:600;">Hedged against CPI Inflation (~4.5–5%)</span>
            </div>
          </div>

          <div class="re-stat-box">
            <div class="re-lbl">
              <span>8-Year Total Appreciation</span>
              <span>33 Quarters</span>
            </div>
            <div class="re-val">${nat.hpi_total_growth_8y !== undefined ? (nat.hpi_total_growth_8y > 0 ? '+' : '') + nat.hpi_total_growth_8y.toFixed(2) + '%' : '+10.02%'}</div>
            <div class="re-subtext">
              <span>Continuous Spliced Curve (2018–2026)</span>
            </div>
          </div>
        `;
      }

      function renderRealEstateHero(cityName) {
        const strip = document.getElementById("reHeroStrip");
        if (!strip) return;
        const cities = residexData.cities || {};
        const city = cities[cityName];
        if (!city) return;

        const s = city.summary || {};
        const tiers = city.carpet_price_sqft_by2024 || {};
        const qtr = s.latest_quarter || "Jun 2026";
        const latestTierCompact = tiers.compact_lte_646_sqft ? tiers.compact_lte_646_sqft[qtr] : null;
        const latestTierMid = tiers.mid_646_to_1184_sqft ? tiers.mid_646_to_1184_sqft[qtr] : null;
        const latestTierLarge = tiers.large_gt_1184_sqft ? tiers.large_gt_1184_sqft[qtr] : null;

        strip.innerHTML = `
          <div class="re-hero-top">
            <div class="re-hero-city-name">
              <span>${escapeHtml(cityName)}</span>
              <span class="re-hero-state-pill">${escapeHtml(city.state || '')}</span>
              <span style="font-family:var(--mono); font-size:11px; color:var(--teal); font-weight:600; margin-left:6px;">NHB Overlap: ${escapeHtml(residexData.metadata?.overlap_quarter || 'Jun 2025')}</span>
            </div>
            <div style="font-family:var(--mono); font-size:11.5px; color:var(--muted);">
              Splicing Linking Factor: <b>${city.linking_factors?.assessment_forward || 1.36}x</b> (Assessment)
            </div>
          </div>

          <div class="re-hero-stats-row">
            <div class="re-hero-stat-card">
              <div class="re-hero-stat-lbl">Latest HPI Index</div>
              <div class="re-hero-stat-val">
                <span>${formatNumber(s.hpi_index, 2)}</span>
                ${formatReturnBadge(s.hpi_yoy_pct)}
              </div>
            </div>

            <div class="re-hero-stat-card">
              <div class="re-hero-stat-lbl">Composite Carpet Price</div>
              <div class="re-hero-stat-val">
                <span>₹${formatNumber(s.carpet_price_sqft, 0)}</span>
                <span style="font-size:11px; color:var(--muted); font-weight:400;">/sq.ft.</span>
              </div>
            </div>

            <div class="re-hero-stat-card">
              <div class="re-hero-stat-lbl">3Y / 5Y CAGR</div>
              <div class="re-hero-stat-val" style="color:var(--teal-deep);">
                <span>${s.hpi_cagr_3y != null ? s.hpi_cagr_3y.toFixed(1) + '%' : '—'}</span>
                <span style="font-size:11.5px; color:var(--muted); font-weight:400;">/</span>
                <span>${s.hpi_cagr_5y != null ? s.hpi_cagr_5y.toFixed(1) + '%' : '—'}</span>
              </div>
            </div>

            <div class="re-hero-stat-card">
              <div class="re-hero-stat-lbl">8-Year Total Gain (2018–26)</div>
              <div class="re-hero-stat-val" style="color:${(s.hpi_total_growth_8y || 0) >= 50 ? 'var(--green)' : 'var(--ink)'};">
                <span>${s.hpi_total_growth_8y != null ? (s.hpi_total_growth_8y > 0 ? '+' : '') + s.hpi_total_growth_8y.toFixed(1) + '%' : '—'}</span>
              </div>
            </div>
          </div>

          <div class="re-tier-pills-row">
            <span class="re-tier-label">Carpet Area Rates by Unit Size:</span>
            <span class="re-tier-pill">Compact (&le;646 sq.ft.): <b>${latestTierCompact != null ? '₹' + formatNumber(latestTierCompact, 0) : '—'} /sq.ft.</b></span>
            <span class="re-tier-pill">Mid-Size (646–1,184 sq.ft.): <b>${latestTierMid != null ? '₹' + formatNumber(latestTierMid, 0) : '—'} /sq.ft.</b></span>
            <span class="re-tier-pill">Large (&gt;1,184 sq.ft.): <b>${latestTierLarge != null ? '₹' + formatNumber(latestTierLarge, 0) : '—'} /sq.ft.</b></span>
          </div>
        `;
      }

      function renderRealEstateChart(cityName, mode) {
        const container = document.getElementById("reSvgContainer");
        const titleEl = document.getElementById("reChartTitle");
        const legendEl = document.getElementById("reChartLegend");
        const tooltip = document.getElementById("reChartTooltip");
        if (!container) return;

        const cityObj = residexData.cities?.[cityName];
        const natObj = residexData.national_composite_50_cities;
        if (!cityObj || !natObj) {
          container.innerHTML = `<div style="padding:40px; text-align:center; color:var(--muted); font-family:var(--mono);">Real estate chart data unavailable for ${escapeHtml(cityName)}</div>`;
          return;
        }

        const width = 860;
        const height = 310;
        const padLeft = 60;
        const padRight = 30;
        const padTop = 25;
        const padBottom = 42;
        const plotW = width - padLeft - padRight;
        const plotH = height - padTop - padBottom;

        if (mode === "hpi") {
          if (titleEl) titleEl.textContent = `33-Quarter Historical HPI Trend: ${cityName} vs 50-City National (FY 2024-25 = 100)`;
          if (legendEl) {
            legendEl.innerHTML = `
              <span class="re-legend-item"><span class="re-legend-line city"></span> <b>${escapeHtml(cityName)} Spliced HPI</b></span>
              <span class="re-legend-item"><span class="re-legend-line national"></span> <b>50-City National Composite</b></span>
              <span class="re-legend-item"><span class="re-legend-line overlap"></span> <span>Jun 2025 Rebase Overlap</span></span>
            `;
          }

          const splicedCity = cityObj.spliced_continuous_hpi || {};
          const splicedNat = natObj.spliced_continuous_hpi || {};
          const quarters = Object.keys(splicedCity);
          if (quarters.length === 0) return;

          const cityVals = quarters.map(q => Number(splicedCity[q] || 0));
          const natVals = quarters.map(q => Number(splicedNat[q] || 0));

          const allVals = cityVals.concat(natVals);
          let rawMin = Math.min(...allVals);
          let rawMax = Math.max(...allVals);
          let yMin = Math.floor(rawMin / 10) * 10 - 10;
          if (yMin < 0) yMin = 0;
          let yMax = Math.ceil(rawMax / 10) * 10 + 10;
          if (yMax - yMin < 40) yMax = yMin + 50;

          function getX(idx) {
            return padLeft + (idx / (quarters.length - 1)) * plotW;
          }
          function getY(val) {
            return padTop + plotH - ((val - yMin) / (yMax - yMin)) * plotH;
          }

          let gridSvg = "";
          const yStep = (yMax - yMin) > 80 ? 20 : 10;
          for (let yv = yMin; yv <= yMax; yv += yStep) {
            const yPos = getY(yv);
            const isBase100 = yv === 100;
            const strokeColor = isBase100 ? "#1f7a6c" : "#e2e7df";
            const strokeDash = isBase100 ? "4 3" : "2 2";
            const strokeWidth = isBase100 ? "1.5" : "1";
            gridSvg += `
              <line x1="${padLeft}" y1="${yPos.toFixed(1)}" x2="${width - padRight}" y2="${yPos.toFixed(1)}" stroke="${strokeColor}" stroke-dasharray="${strokeDash}" stroke-width="${strokeWidth}" />
              <text x="${padLeft - 8}" y="${(yPos + 4).toFixed(1)}" text-anchor="end" font-family="var(--mono)" font-size="10.5" fill="${isBase100 ? '#1f7a6c' : '#8ea89d'}" font-weight="${isBase100 ? '700' : '500'}">${yv}</text>
            `;
          }

          const base100Y = getY(100);
          gridSvg += `
            <text x="${width - padRight - 6}" y="${(base100Y - 5).toFixed(1)}" text-anchor="end" font-family="var(--mono)" font-size="9.5" fill="#1f7a6c" font-weight="700">BASE 100</text>
          `;

          const overlapIdx = quarters.indexOf("Jun 2025");
          let overlapSvg = "";
          if (overlapIdx !== -1) {
            const ovX = getX(overlapIdx);
            overlapSvg = `
              <line x1="${ovX.toFixed(1)}" y1="${padTop}" x2="${ovX.toFixed(1)}" y2="${padTop + plotH}" stroke="#8ea89d" stroke-dasharray="3 3" stroke-width="1.2" />
              <rect x="${(ovX - 42).toFixed(1)}" y="${(padTop + 6).toFixed(1)}" width="84" height="18" rx="4" fill="rgba(24,38,32,.75)" />
              <text x="${ovX.toFixed(1)}" y="${(padTop + 18).toFixed(1)}" text-anchor="middle" font-family="var(--mono)" font-size="9" fill="#8fe0cd" font-weight="700">Jun '25 Rebase</text>
            `;
          }

          let xTicksSvg = "";
          quarters.forEach((q, idx) => {
            if (q.startsWith("Jun") || idx === quarters.length - 1) {
              const xPos = getX(idx);
              const shortYear = q.replace("Jun ", "'");
              xTicksSvg += `
                <line x1="${xPos.toFixed(1)}" y1="${(padTop + plotH).toFixed(1)}" x2="${xPos.toFixed(1)}" y2="${(padTop + plotH + 5).toFixed(1)}" stroke="#6d786f" stroke-width="1" />
                <text x="${xPos.toFixed(1)}" y="${(padTop + plotH + 18).toFixed(1)}" text-anchor="middle" font-family="var(--mono)" font-size="10" fill="#6d786f" font-weight="600">${shortYear}</text>
              `;
            }
          });

          const natPoints = natVals.map((v, i) => `${getX(i).toFixed(1)},${getY(v).toFixed(1)}`).join(" ");
          const natPathSvg = `<polyline points="${natPoints}" fill="none" stroke="#c97a2b" stroke-width="2.2" stroke-dasharray="5 4" stroke-linecap="round" stroke-linejoin="round" />`;

          const cityCoords = cityVals.map((v, i) => ({ x: getX(i), y: getY(v) }));
          const cityPoints = cityCoords.map(c => `${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(" ");
          const areaPath = `M ${cityCoords[0].x.toFixed(1)} ${cityCoords[0].y.toFixed(1)} ` +
            cityCoords.slice(1).map(c => `L ${c.x.toFixed(1)} ${c.y.toFixed(1)}`).join(" ") +
            ` L ${cityCoords[cityCoords.length - 1].x.toFixed(1)} ${(padTop + plotH).toFixed(1)} L ${cityCoords[0].x.toFixed(1)} ${(padTop + plotH).toFixed(1)} Z`;

          const cityAreaSvg = `
            <defs>
              <linearGradient id="reCityGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="#1f7a6c" stop-opacity="0.22" />
                <stop offset="100%" stop-color="#1f7a6c" stop-opacity="0.01" />
              </linearGradient>
            </defs>
            <path d="${areaPath}" fill="url(#reCityGrad)" />
            <polyline points="${cityPoints}" fill="none" stroke="#1f7a6c" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />
          `;

          const dotsSvg = cityCoords.map((c, idx) =>
            `<circle cx="${c.x.toFixed(1)}" cy="${c.y.toFixed(1)}" r="3" fill="#ffffff" stroke="#1f7a6c" stroke-width="2" class="re-point" data-idx="${idx}" style="cursor:pointer;" />`
          ).join("");

          container.innerHTML = `
            <svg class="re-svg-box" viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet" id="reInteractiveSvg">
              ${gridSvg}
              ${overlapSvg}
              ${xTicksSvg}
              ${natPathSvg}
              ${cityAreaSvg}
              <line id="reCrosshairLine" x1="0" y1="${padTop}" x2="0" y2="${padTop + plotH}" stroke="#1f7a6c" stroke-width="1.2" stroke-dasharray="2 2" style="display:none;" />
              <circle id="reCityHoverCircle" cx="0" cy="0" r="5.5" fill="#1f7a6c" stroke="#ffffff" stroke-width="2" style="display:none;" />
              <circle id="reNatHoverCircle" cx="0" cy="0" r="4.5" fill="#c97a2b" stroke="#ffffff" stroke-width="1.5" style="display:none;" />
              ${dotsSvg}
            </svg>
          `;

          const svgEl = document.getElementById("reInteractiveSvg");
          const crosshair = document.getElementById("reCrosshairLine");
          const cityHoverDot = document.getElementById("reCityHoverCircle");
          const natHoverDot = document.getElementById("reNatHoverCircle");

          if (svgEl) {
            function handlePointer(clientX, clientY) {
              const rect = svgEl.getBoundingClientRect();
              const scaleX = width / rect.width;
              const mouseSvgX = (clientX - rect.left) * scaleX;

              let closestIdx = 0;
              let minDist = Infinity;
              cityCoords.forEach((c, i) => {
                const dist = Math.abs(c.x - mouseSvgX);
                if (dist < minDist) {
                  minDist = dist;
                  closestIdx = i;
                }
              });

              const qName = quarters[closestIdx];
              const cVal = cityVals[closestIdx];
              const nVal = natVals[closestIdx];
              const spread = (cVal - nVal).toFixed(2);
              const spreadSign = Number(spread) > 0 ? "+" : "";

              const cx = cityCoords[closestIdx].x;
              const cy = cityCoords[closestIdx].y;
              const ny = getY(nVal);

              if (crosshair) {
                crosshair.setAttribute("x1", cx.toFixed(1));
                crosshair.setAttribute("x2", cx.toFixed(1));
                crosshair.style.display = "block";
              }
              if (cityHoverDot) {
                cityHoverDot.setAttribute("cx", cx.toFixed(1));
                cityHoverDot.setAttribute("cy", cy.toFixed(1));
                cityHoverDot.style.display = "block";
              }
              if (natHoverDot) {
                natHoverDot.setAttribute("cx", cx.toFixed(1));
                natHoverDot.setAttribute("cy", ny.toFixed(1));
                natHoverDot.style.display = "block";
              }

              if (tooltip) {
                tooltip.innerHTML = `
                  <strong>🗓️ ${escapeHtml(qName)}</strong>
                  <div>${escapeHtml(cityName)}: <b style="color:#8fe0cd;">${formatNumber(cVal, 2)}</b></div>
                  <div>National 50-City: <b style="color:#f3bc85;">${formatNumber(nVal, 2)}</b></div>
                  <div style="margin-top:3px; border-top:1px dashed rgba(255,255,255,.2); padding-top:3px; font-size:10.5px;">
                    Spread: <b style="color:${Number(spread) >= 0 ? '#34d399' : '#f87171'}">${spreadSign}${spread} pts</b> vs National
                  </div>
                `;

                const containerRect = container.getBoundingClientRect();
                let tipX = clientX - containerRect.left + 15;
                let tipY = clientY - containerRect.top - 20;
                if (tipX + 200 > containerRect.width) tipX -= 220;
                if (tipY < 10) tipY = 10;

                tooltip.style.left = `${tipX}px`;
                tooltip.style.top = `${tipY}px`;
                tooltip.style.display = "block";
              }
            }

            function hidePointer() {
              if (crosshair) crosshair.style.display = "none";
              if (cityHoverDot) cityHoverDot.style.display = "none";
              if (natHoverDot) natHoverDot.style.display = "none";
              if (tooltip) tooltip.style.display = "none";
            }

            svgEl.addEventListener("mousemove", function (e) {
              handlePointer(e.clientX, e.clientY);
            });
            svgEl.addEventListener("mouseleave", hidePointer);

            svgEl.addEventListener("touchstart", function (e) {
              if (e.touches && e.touches.length > 0) {
                handlePointer(e.touches[0].clientX, e.touches[0].clientY);
              }
            }, { passive: true });

            svgEl.addEventListener("touchmove", function (e) {
              if (e.touches && e.touches.length > 0) {
                handlePointer(e.touches[0].clientX, e.touches[0].clientY);
              }
            }, { passive: true });
          }
        }

        else if (mode === "tiers") {
          if (titleEl) titleEl.textContent = `Carpet Area Rates (₹/sq.ft.) by Unit Size: ${cityName} (FY 2024-25 = 100)`;
          if (legendEl) {
            legendEl.innerHTML = `
              <span class="re-legend-item"><span class="re-legend-line" style="background:#1f7a6c;"></span> <b>Overall Composite</b></span>
              <span class="re-legend-item"><span class="re-legend-line" style="background:#2e7d32;"></span> <b>Compact (&le;646 sq.ft.)</b></span>
              <span class="re-legend-item"><span class="re-legend-line" style="background:#c97a2b;"></span> <b>Mid-Size (646–1,184 sq.ft.)</b></span>
              <span class="re-legend-item"><span class="re-legend-line" style="background:#4f46e5;"></span> <b>Large (&gt;1,184 sq.ft.)</b></span>
            `;
          }

          const tierData = cityObj.carpet_price_sqft_by2024 || {};
          const tierKeys = [
            { key: "composite", label: "Composite", color: "#1f7a6c" },
            { key: "compact_lte_646_sqft", label: "Compact (≤646 sq.ft.)", color: "#2e7d32" },
            { key: "mid_646_to_1184_sqft", label: "Mid-Size (646–1184 sq.ft.)", color: "#c97a2b" },
            { key: "large_gt_1184_sqft", label: "Large (>1184 sq.ft.)", color: "#4f46e5" }
          ];

          const quarters = Object.keys(tierData.composite || {});
          if (quarters.length === 0) return;

          let allPrices = [];
          tierKeys.forEach(t => {
            const series = tierData[t.key] || {};
            quarters.forEach(q => {
              if (series[q]) allPrices.push(Number(series[q]));
            });
          });

          if (allPrices.length === 0) return;

          let rawMin = Math.min(...allPrices);
          let rawMax = Math.max(...allPrices);
          let yMin = Math.floor(rawMin / 1000) * 1000 - 500;
          if (yMin < 0) yMin = 0;
          let yMax = Math.ceil(rawMax / 1000) * 1000 + 1000;
          if (yMax - yMin < 2000) yMax = yMin + 3000;

          function getX(idx) {
            return padLeft + (idx / (quarters.length - 1)) * plotW;
          }
          function getY(val) {
            return padTop + plotH - ((val - yMin) / (yMax - yMin)) * plotH;
          }

          let gridSvg = "";
          const yRange = yMax - yMin;
          const yStep = yRange > 10000 ? 5000 : (yRange > 5000 ? 2000 : 1000);
          for (let yv = yMin; yv <= yMax; yv += yStep) {
            const yPos = getY(yv);
            gridSvg += `
              <line x1="${padLeft}" y1="${yPos.toFixed(1)}" x2="${width - padRight}" y2="${yPos.toFixed(1)}" stroke="#e2e7df" stroke-dasharray="2 2" stroke-width="1" />
              <text x="${padLeft - 8}" y="${(yPos + 4).toFixed(1)}" text-anchor="end" font-family="var(--mono)" font-size="10" fill="#8ea89d">₹${formatNumber(yv, 0)}</text>
            `;
          }

          let xTicksSvg = "";
          quarters.forEach((q, idx) => {
            const xPos = getX(idx);
            xTicksSvg += `
              <line x1="${xPos.toFixed(1)}" y1="${(padTop + plotH).toFixed(1)}" x2="${xPos.toFixed(1)}" y2="${(padTop + plotH + 5).toFixed(1)}" stroke="#6d786f" stroke-width="1" />
              <text x="${xPos.toFixed(1)}" y="${(padTop + plotH + 18).toFixed(1)}" text-anchor="middle" font-family="var(--mono)" font-size="10" fill="#6d786f" font-weight="600">${escapeHtml(q)}</text>
            `;
          });

          let linesSvg = "";
          let dotsSvg = "";
          tierKeys.forEach(t => {
            const series = tierData[t.key] || {};
            const coords = quarters.map((q, idx) => ({
              q: q,
              val: Number(series[q] || 0),
              x: getX(idx),
              y: getY(Number(series[q] || 0))
            }));

            const pointsStr = coords.map(c => `${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(" ");
            linesSvg += `<polyline points="${pointsStr}" fill="none" stroke="${t.color}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" />`;

            coords.forEach(c => {
              dotsSvg += `<circle cx="${c.x.toFixed(1)}" cy="${c.y.toFixed(1)}" r="3.5" fill="#ffffff" stroke="${t.color}" stroke-width="2" />`;
            });
          });

          container.innerHTML = `
            <svg class="re-svg-box" viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet" id="reInteractiveTiersSvg">
              ${gridSvg}
              ${xTicksSvg}
              ${linesSvg}
              ${dotsSvg}
              <line id="reTierCrosshair" x1="0" y1="${padTop}" x2="0" y2="${padTop + plotH}" stroke="#1f7a6c" stroke-width="1.2" stroke-dasharray="2 2" style="display:none;" />
            </svg>
          `;

          const svgEl = document.getElementById("reInteractiveTiersSvg");
          const crosshair = document.getElementById("reTierCrosshair");
          if (svgEl) {
            function handleTiersPointer(clientX, clientY) {
              const rect = svgEl.getBoundingClientRect();
              const scaleX = width / rect.width;
              const mouseSvgX = (clientX - rect.left) * scaleX;

              let closestIdx = 0;
              let minDist = Infinity;
              quarters.forEach((q, i) => {
                const dist = Math.abs(getX(i) - mouseSvgX);
                if (dist < minDist) {
                  minDist = dist;
                  closestIdx = i;
                }
              });

              const qName = quarters[closestIdx];
              const cx = getX(closestIdx);

              if (crosshair) {
                crosshair.setAttribute("x1", cx.toFixed(1));
                crosshair.setAttribute("x2", cx.toFixed(1));
                crosshair.style.display = "block";
              }

              if (tooltip) {
                let tierLines = "";
                tierKeys.forEach(t => {
                  const p = tierData[t.key]?.[qName];
                  tierLines += `<div><span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:${t.color}; margin-right:4px;"></span> ${t.label}: <b>₹${formatNumber(p, 0)}/sq.ft.</b></div>`;
                });

                tooltip.innerHTML = `
                  <strong>🗓️ ${escapeHtml(qName)} Rates (${escapeHtml(cityName)})</strong>
                  <div style="margin-top:4px; font-size:11px; line-height:1.5;">${tierLines}</div>
                `;

                const containerRect = container.getBoundingClientRect();
                let tipX = clientX - containerRect.left + 15;
                let tipY = clientY - containerRect.top - 20;
                if (tipX + 220 > containerRect.width) tipX -= 240;
                if (tipY < 10) tipY = 10;

                tooltip.style.left = `${tipX}px`;
                tooltip.style.top = `${tipY}px`;
                tooltip.style.display = "block";
              }
            }

            function hideTiersPointer() {
              if (crosshair) crosshair.style.display = "none";
              if (tooltip) tooltip.style.display = "none";
            }

            svgEl.addEventListener("mousemove", function (e) {
              handleTiersPointer(e.clientX, e.clientY);
            });
            svgEl.addEventListener("mouseleave", hideTiersPointer);

            svgEl.addEventListener("touchstart", function (e) {
              if (e.touches && e.touches.length > 0) {
                handleTiersPointer(e.touches[0].clientX, e.touches[0].clientY);
              }
            }, { passive: true });

            svgEl.addEventListener("touchmove", function (e) {
              if (e.touches && e.touches.length > 0) {
                handleTiersPointer(e.touches[0].clientX, e.touches[0].clientY);
              }
            }, { passive: true });
          }
        }
      }

      function renderRealEstateLeaderboard() {
        const tbody = document.getElementById("reLeaderboardBody");
        if (!tbody) return;
        const cities = residexData.cities || {};
        const nat = residexData.national_composite_50_cities?.summary || {};

        // Update active sort indicator on table header
        const ths = document.querySelectorAll("#reLeaderboardTable th.re-sortable-th");
        ths.forEach(th => {
          const arrow = th.querySelector(".re-sort-arrow");
          if (th.dataset.sort === reSortCol) {
            th.classList.add("active-sort");
            if (arrow) arrow.textContent = reSortAsc ? " ▴" : " ▾";
          } else {
            th.classList.remove("active-sort");
            if (arrow) arrow.textContent = "";
          }
        });

        const cityEntries = Object.entries(cities).map(([name, data]) => {
          return {
            name: name,
            state: data.state || '',
            summary: data.summary || {}
          };
        });

        // Dynamic sort by active column & direction
        cityEntries.sort((a, b) => {
          const valA = a.summary[reSortCol];
          const valB = b.summary[reSortCol];
          const numA = (valA != null && !isNaN(valA)) ? Number(valA) : (reSortAsc ? Infinity : -Infinity);
          const numB = (valB != null && !isNaN(valB)) ? Number(valB) : (reSortAsc ? Infinity : -Infinity);
          return reSortAsc ? numA - numB : numB - numA;
        });

        let html = "";
        cityEntries.forEach((c, idx) => {
          const s = c.summary;
          const isActive = c.name === activeReCity;
          const activeClass = isActive ? "active-city" : "";
          const rankClass = idx < 3 ? "rank-cell top-3" : "rank-cell";

          html += `
            <tr class="${activeClass}" data-city="${escapeHtml(c.name)}" title="Click to view ${escapeHtml(c.name)} historical chart">
              <td class="${rankClass}">#${idx + 1}</td>
              <td class="name-col">
                <div class="stock-symbol" style="display:flex; align-items:center; gap:6px;">
                  <span>${escapeHtml(c.name)}</span>
                  ${isActive ? '<span style="font-size:10px; background:var(--teal); color:#fff; padding:1px 6px; border-radius:4px;">ACTIVE</span>' : ''}
                </div>
                <div class="stock-name">${escapeHtml(c.state)}</div>
              </td>
              <td class="price-cell" style="font-size:13.5px;">${formatNumber(s.hpi_index, 2)}</td>
              <td class="ret-cell">${formatReturnBadge(s.hpi_yoy_pct)}</td>
              <td class="ret-cell">${formatReturnBadge(s.hpi_cagr_3y)}</td>
              <td class="ret-cell">${formatReturnBadge(s.hpi_cagr_5y)}</td>
              <td class="ret-cell">${formatReturnBadge(s.hpi_total_growth_8y)}</td>
              <td class="price-cell" style="color:var(--ink); font-weight:700;">₹${formatNumber(s.carpet_price_sqft, 0)}</td>
            </tr>
          `;
        });

        // National Benchmark Anchor Row (Pinned at bottom)
        html += `
          <tr class="national-row" data-city="NATIONAL" title="50-City National Composite Benchmark">
            <td class="rank-cell" style="color:#82470e;">🇮🇳</td>
            <td class="name-col">
              <div class="stock-symbol" style="color:#82470e;">50-City National Composite</div>
              <div class="stock-name" style="color:#82470e;">National Baseline (NHB Residex)</div>
            </td>
            <td class="price-cell" style="color:#82470e; font-weight:700;">${formatNumber(nat.hpi_index, 2)}</td>
            <td class="ret-cell">${formatReturnBadge(nat.hpi_yoy_pct)}</td>
            <td class="ret-cell">${formatReturnBadge(nat.hpi_cagr_3y)}</td>
            <td class="ret-cell">${formatReturnBadge(nat.hpi_cagr_5y)}</td>
            <td class="ret-cell">${formatReturnBadge(nat.hpi_total_growth_8y)}</td>
            <td class="price-cell" style="color:#82470e; font-weight:700;">₹${formatNumber(nat.carpet_price_sqft, 0)}</td>
          </tr>
        `;

        tbody.innerHTML = html;

        tbody.querySelectorAll("tr[data-city]").forEach(tr => {
          tr.addEventListener("click", function () {
            const cName = this.dataset.city;
            if (cName && cName !== "NATIONAL" && residexData.cities?.[cName]) {
              expandChartIfCollapsed();
              setActiveReCity(cName);
              const hero = document.getElementById("reHeroStrip");
              if (hero) hero.scrollIntoView({ behavior: "smooth", block: "nearest" });
            }
          });
        });
      }

      function setActiveReCity(cityName) {
        if (!residexData.cities?.[cityName]) return;
        activeReCity = cityName;

        const citySelect = document.getElementById("reCitySelect");
        if (citySelect && citySelect.value !== cityName) citySelect.value = cityName;

        const reCalcLink = document.getElementById("reCalcLink");
        if (reCalcLink) {
          reCalcLink.href = `real-estate-calculator.html?city=${encodeURIComponent(cityName)}`;
        }

        renderRealEstateHero(cityName);
        renderRealEstateChart(cityName, activeReViewMode);
        renderRealEstateLeaderboard();
      }

      function renderRealEstate() {
        if (!residexData.cities) return;

        renderRealEstateAnchor();

        const citySelect = document.getElementById("reCitySelect");
        const cityNames = Object.keys(residexData.cities);

        if (citySelect) {
          citySelect.innerHTML = cityNames.map(c => `<option value="${escapeHtml(c)}" ${c === activeReCity ? 'selected' : ''}>${escapeHtml(c)} (${escapeHtml(residexData.cities[c].state || '')})</option>`).join("");
        }

        const reCalcLink = document.getElementById("reCalcLink");
        if (reCalcLink) {
          reCalcLink.href = `real-estate-calculator.html?city=${encodeURIComponent(activeReCity)}`;
        }

        renderRealEstateHero(activeReCity);
        renderRealEstateChart(activeReCity, activeReViewMode);
        renderRealEstateLeaderboard();
      }

      // Outlier detection for corporate action anomalies & illiquid penny spikes
      function getAbnormalReason(stock, colIdx) {
        const price = Number(stock[2]);
        if (price < 10) {
          return `Microcap penny stock (< ₹10: trading at ₹${price.toFixed(2)})`;
        }
        const ret = Number(stock[colIdx]);
        if (ret === null || isNaN(ret)) return null;

        // Horizon-specific unadjusted corporate action / split thresholds
        if (colIdx === 3 && (ret > 60.0 || ret < -45.0)) {
          return `Abnormal 1M ${ret > 0 ? '+' : ''}${ret.toFixed(1)}% (unadjusted share consolidation / split)`;
        }
        if (colIdx === 4 && (ret > 100.0 || ret < -55.0)) {
          return `Abnormal 3M ${ret > 0 ? '+' : ''}${ret.toFixed(1)}% (unadjusted corporate action)`;
        }
        if (colIdx === 5 && (ret > 180.0 || ret < -65.0)) {
          return `Abnormal 6M ${ret > 0 ? '+' : ''}${ret.toFixed(1)}% (unadjusted corporate action)`;
        }
        if (colIdx === 6 && (ret > 280.0 || ret < -75.0)) {
          return `Abnormal 1Y ${ret > 0 ? '+' : ''}${ret.toFixed(1)}% (unadjusted corporate action)`;
        }

        return null;
      }

      // ==========================================
      // SECTION 2: RENDER TOP 10 EQUITIES
      // ==========================================
      function renderEquities() {
        const tbody = document.getElementById("equityTableBody");
        if (!tbody || !equitiesData.stocks) return;

        const meta = getHorizonMeta(selectedHorizon);
        const sortColIdx = meta.eqCol;

        // Update table header text
        const thEl = document.getElementById("equityThReturn");
        if (thEl) {
          thEl.textContent = meta.short;
        }

        // Update section badge counter
        const countBadge = document.getElementById("equityCountBadge");
        if (countBadge) {
          if (expandAllNse) {
            countBadge.innerHTML = `${(equitiesData.stocks || []).length} Stocks Screened`;
          } else {
            countBadge.innerHTML = `⭐ ${equitiesData.nifty500Count || 501} Nifty 500 Leaders`;
          }
        }

        flaggedOutliers = [];
        let validStocks = [];

        for (const s of equitiesData.stocks) {
          const val = s[sortColIdx];
          if (val === null || val === undefined || isNaN(val)) continue;

          const isN500 = s[7] === 1;

          // Filter for Nifty 500 by default unless expandAllNse is true or equitySearchTerm is non-empty
          if (!expandAllNse && !equitySearchTerm && !isN500) {
            continue;
          }

          // Always filter out penny stocks and corporate action outliers
          const reason = getAbnormalReason(s, sortColIdx);
          if (reason) {
            flaggedOutliers.push({
              symbol: s[0],
              name: s[1],
              price: s[2],
              rawRet: val,
              reason: reason,
              isN500: isN500
            });
            continue;
          }

          if (equitySearchTerm) {
            const sym = (s[0] || "").toLowerCase();
            const nm = (s[1] || "").toLowerCase();
            if (!sym.includes(equitySearchTerm) && !nm.includes(equitySearchTerm)) {
              continue;
            }
          }

          validStocks.push(s);
        }

        // Update counts
        const countSpan = document.getElementById("outlierCountSpan");
        if (countSpan) countSpan.textContent = flaggedOutliers.length;

        // Populate Outliers Modal
        const modalBody = document.getElementById("outliersModalBody");
        if (modalBody) {
          if (!flaggedOutliers.length) {
            modalBody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding:20px; color:var(--muted)">No anomalies detected for current selection.</td></tr>`;
          } else {
            modalBody.innerHTML = flaggedOutliers.slice(0, 80).map(o => `
              <tr>
                <td><strong>${escapeHtml(o.symbol)}</strong><br><span style="font-size:11px; color:var(--muted)">${escapeHtml(o.name)}</span></td>
                <td style="text-align:right; font-family:var(--mono);">₹${formatNumber(o.price, 2)}</td>
                <td style="text-align:right;">${formatReturnBadge(o.rawRet)}</td>
                <td style="font-size:11.5px; color:#a8503f;">${escapeHtml(o.reason)}</td>
              </tr>
            `).join("");
          }
        }

        // Sort gainers vs decliners
        validStocks.sort((a, b) => {
          const valA = Number(a[sortColIdx]);
          const valB = Number(b[sortColIdx]);
          return equityIsGainers ? valB - valA : valA - valB;
        });

        // Slice top 10
        const top10 = validStocks.slice(0, 10);

        if (!top10.length) {
          tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding:32px; color:var(--muted)">No stocks found matching "${escapeHtml(equitySearchTerm)}"</td></tr>`;
          return;
        }

        let html = "";
        top10.forEach((s, idx) => {
          const rank = idx + 1;
          const symbol = s[0];
          const name = s[1];
          const price = s[2];
          const targetRet = s[sortColIdx];

          const ca = caMap.get(symbol);
          const caBadge = ca ? `<span style="display:inline-block; font-family:var(--mono); font-size:10px; font-weight:700; color:var(--teal); background:var(--teal-soft); padding:1px 5px; border-radius:3px; margin-left:6px;" title="${escapeHtml(ca[3])}">⚡ ${ca[5]}</span>` : '';

          const isN500 = s[7] === 1;
          const n500Badge = isN500 
            ? `<span style="display:inline-block; font-family:var(--mono); font-size:9.5px; font-weight:700; color:var(--teal); background:var(--teal-soft); border:1px solid rgba(31,122,108,.3); padding:1px 5px; border-radius:3px; margin-left:6px;" title="Nifty 500 Constituent">NIFTY 500</span>`
            : `<span style="display:inline-block; font-family:var(--mono); font-size:9.5px; font-weight:600; color:var(--muted); background:var(--panel); border:1px solid var(--line); padding:1px 5px; border-radius:3px; margin-left:6px;">ALL TRADED</span>`;

          let disambigNote = '';
          if (symbol === 'DCMSRIND') {
            disambigNote = `<div style="font-size:11px; color:#c97a2b; font-weight:600; margin-top:2px;">⚠️ Note: DCM Shriram Industries Ltd is a separate smallcap entity from DCM Shriram Ltd (DCMSHRIRAM).</div>`;
          } else if (symbol === 'DCMSHRIRAM') {
            disambigNote = `<div style="font-size:11px; color:var(--teal); font-weight:600; margin-top:2px;">🏛️ DCM Shriram Ltd (Chemicals, Chloro-Vinyl, Sugar Conglomerate &bull; Current: ₹${price.toFixed(2)})</div>`;
          }

          html += `
            <tr>
              <td class="rank-cell ${rank <= 3 ? 'top-3' : ''}">#${rank}</td>
              <td class="name-col">
                <div class="stock-symbol">${escapeHtml(symbol)}${n500Badge}${caBadge}</div>
                <div class="stock-name">${escapeHtml(name)}</div>
                ${disambigNote}
              </td>
              <td class="price-cell">₹${formatNumber(price, 2)}</td>
              <td class="ret-cell">${formatReturnBadge(targetRet)}</td>
            </tr>
          `;
        });

        tbody.innerHTML = html;
      }

      // ==========================================
      // SECTION 3: RENDER TOP 10 MUTUAL FUNDS
      // ==========================================
      function renderMutualFunds() {
        const tbody = document.getElementById("mfTableBody");
        if (!tbody || !mfData.schemes) return;

        const meta = getHorizonMeta(selectedHorizon);
        const sortColIdx = meta.mfCol;

        // Update table header text
        const thEl = document.getElementById("mfThReturn");
        if (thEl) {
          thEl.textContent = meta.short;
        }

        let list = mfData.schemes.filter(s => {
          const val = s[sortColIdx];
          if (val === null || val === undefined || isNaN(val)) return false;
          if (mfCategory !== "all") {
            const cat = (s[2] || "").toLowerCase();
            return cat.includes(mfCategory.toLowerCase());
          }
          return true;
        });

        // Sort highest return first
        list.sort((a, b) => Number(b[sortColIdx]) - Number(a[sortColIdx]));

        // Update count badge dynamically
        const countBadge = document.getElementById("mfCountBadge");
        if (countBadge && mfData.schemes) {
          if (mfCategory === "all") {
            countBadge.innerHTML = `⭐ ${mfData.schemes.length} Direct Schemes Screened`;
          } else {
            countBadge.innerHTML = `⭐ ${list.length} Schemes in ${escapeHtml(mfCategory)}`;
          }
        }

        const top10 = list.slice(0, 10);

        if (!top10.length) {
          tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding:32px; color:var(--muted)">No schemes found in this category</td></tr>`;
          return;
        }

        let html = "";
        top10.forEach((s, idx) => {
          const rank = idx + 1;
          const name = s[1];
          const category = s[2];
          const nav = s[3];
          const targetRet = s[sortColIdx];

          html += `
            <tr>
              <td class="rank-cell ${rank <= 3 ? 'top-3' : ''}">#${rank}</td>
              <td class="name-col">
                <div class="fund-title">${escapeHtml(name)}</div>
                <div class="fund-cat">${escapeHtml(category)}</div>
              </td>
              <td class="price-cell">₹${formatNumber(nav, 2)}</td>
              <td class="ret-cell">${formatReturnBadge(targetRet)}</td>
            </tr>
          `;
        });

        tbody.innerHTML = html;
      }

      function escapeHtml(str) {
        if (!str) return "";
        return String(str)
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;")
          .replace(/'/g, "&#039;");
      }

      // ==========================================
      // SECTION SHARING & CANVAS CARD GENERATOR
      // ==========================================
      let currentShareBlob = null;
      let currentShareText = "";
      let currentShareSection = "";
      let currentShareFileName = "KYF-Market-Snapshot.png";
      let shareToastTimer = null;

      function getFormattedAsOf() {
        if (pulseData.asOf) {
          const d = new Date(pulseData.asOf);
          return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
        }
        return "3 Nov 2026";
      }

      function getActiveGoldRet() {
        const pm = pulseData.preciousMetals || {};
        let r = pm["goldRet" + selectedHorizon];
        if (r === undefined && equitiesData.stocks) {
          const s = equitiesData.stocks.find(st => st[0] === (pm.goldBenchmarkSymbol || "GOLDBEES"));
          if (s) r = s[getHorizonMeta(selectedHorizon).eqCol];
        }
        return Number(r || 0);
      }

      function getActiveSilverRet() {
        const pm = pulseData.preciousMetals || {};
        let r = pm["silverRet" + selectedHorizon];
        if (r === undefined && equitiesData.stocks) {
          const s = equitiesData.stocks.find(st => st[0] === (pm.silverBenchmarkSymbol || "SILVERBEES"));
          if (s) r = s[getHorizonMeta(selectedHorizon).eqCol];
        }
        return Number(r || 0);
      }

      function getSectionDisplayName(sectionKey) {
        switch (sectionKey) {
          case "macro": return "🏛️ Sovereign Yields & Economic Baseline";
          case "realestate": return "🏡 Real Estate & Housing Price Index";
          case "metals": return "🪙 Precious Metals";
          case "indices": return "📊 Market Indices & Valuations";
          case "mf": return "🌱 Top 10 Mutual Funds";
          case "equities": return "📈 Top 10 Equities";
          default: return "Market Performance";
        }
      }

      function getSectionShareText(sectionKey) {
        const meta = getHorizonMeta(selectedHorizon);
        const asOf = getFormattedAsOf();

        if (sectionKey === "realestate") {
          const nat = residexData.national_composite_50_cities?.summary || {};
          const cityKey = activeReCity || "Bengaluru";
          const cityObj = (residexData.cities || {})[cityKey] || {};
          const citySummary = cityObj.summary || {};
          const cYoy = citySummary.hpi_yoy_pct != null ? (citySummary.hpi_yoy_pct > 0 ? "+" : "") + citySummary.hpi_yoy_pct.toFixed(2) + "%" : "—";
          const cPrice = citySummary.carpet_price_sqft != null ? "₹" + formatNumber(citySummary.carpet_price_sqft, 0) + "/sq.ft." : "—";
          const cCagr5 = citySummary.hpi_cagr_5y != null ? citySummary.hpi_cagr_5y.toFixed(2) + "% p.a." : "—";
          const natYoySign = (nat.hpi_yoy_pct || 0) > 0 ? "+" : "";
          const natYoy = nat.hpi_yoy_pct != null ? nat.hpi_yoy_pct.toFixed(2) : "1.56";
          const c8ySign = (citySummary.hpi_total_growth_8y || 0) > 0 ? "+" : "";
          const c8yStr = citySummary.hpi_total_growth_8y != null ? `${c8ySign}${citySummary.hpi_total_growth_8y.toFixed(1)}%` : "—";

          return `🏡 Real Estate & Housing Price Index (${nat.latest_quarter || "NHB RESIDEX"}):\n` +
            `• 50-City National Composite: ${nat.hpi_index || 101.96} HPI (${natYoySign}${natYoy}% YoY) | ₹${formatNumber(nat.carpet_price_sqft || 5495, 0)}/sq.ft.\n` +
            `• ${cityKey}: ${citySummary.hpi_index || "—"} HPI (${cYoy} YoY) | Carpet: ${cPrice}\n` +
            `• 5Y Annualized CAGR: ${cCagr5} (vs National: ${nat.hpi_cagr_5y != null ? nat.hpi_cagr_5y.toFixed(2) : "4.83"}%)\n` +
            `• 8Y Total Appreciation: ${c8yStr} (2018–2026 spliced)\n\n` +
            `More at vividnova.com/kyf/market-performance.html`;
        }

        if (sectionKey === "macro") {
          const m = pulseData.macro || {};
          const spread = (m.epfRate - m.cpiInflation).toFixed(2);
          return `🏛️ India Macro & Sovereign Yields (${asOf}):\n` +
            `• CPI Inflation: ${m.cpiInflation}% YoY\n` +
            `• EPF (Tax-Free): ${m.epfRate}% (+${spread}% real spread)\n` +
            `• PPF / SSY: ${m.ppfRate}% / ${m.ssyRate}%\n` +
            `• SBI 1Y FD / Arbitrage: ${m.sbiFd1Yr}% / ${m.arbitrageFundAvg}%\n\n` +
            `More at vividnova.com/kyf/market-performance.html`;
        }

        if (sectionKey === "metals") {
          const pm = pulseData.preciousMetals || {};
          const gRet = getActiveGoldRet();
          const sRet = getActiveSilverRet();
          const gSign = gRet > 0 ? "+" : "";
          const sSign = sRet > 0 ? "+" : "";
          return `🪙 Precious Metals Benchmark (${meta.short} • ${asOf}):\n` +
            `• Gold 24K: ₹${formatNumber(pm.gold24kPerGram, 0)}/g (${gSign}${gRet.toFixed(2)}% via GOLDBEES)\n` +
            `• Gold 22K: ₹${formatNumber(pm.gold22kPerGram, 0)}/g\n` +
            `• Silver 999: ₹${formatNumber(pm.silverPerKg, 0)}/kg (${sSign}${sRet.toFixed(2)}% via SILVERBEES)\n\n` +
            `More at vividnova.com/kyf/market-performance.html`;
        }

        if (sectionKey === "indices") {
          const lines = Object.values(pulseData.indices || {}).map(idx => {
            let ret = idx[meta.idxKey];
            if (ret === null || ret === undefined) {
              if (selectedHorizon === "1m") ret = idx.ret1m;
              else if (selectedHorizon === "3m") ret = idx.ret3m;
              else if (selectedHorizon === "6m") ret = idx.ret6m;
              else if (selectedHorizon === "1y") ret = idx.ret1y != null ? idx.ret1y : idx.cagr1y;
            }
            const r = Number(ret || 0);
            const sign = r > 0 ? "+" : "";
            const pe = idx.pe ? ` | P/E ${idx.pe.toFixed(1)}` : "";
            const shortName = idx.name.replace("Nifty Midcap 150", "Midcap 150").replace("Nifty Smallcap 250", "Smallcap 250");
            return `• ${shortName}: ${formatNumber(idx.level, 0)} (${sign}${r.toFixed(2)}%${pe})`;
          });
          return `📊 Market Indices & Valuations (${meta.short} • ${asOf}):\n` +
            lines.join("\n") + "\n\n" +
            `More at vividnova.com/kyf/market-performance.html`;
        }

        if (sectionKey === "mf") {
          const sortColIdx = meta.mfCol;
          let list = (mfData.schemes || []).filter(s => {
            const val = s[sortColIdx];
            if (val === null || val === undefined || isNaN(val)) return false;
            if (mfCategory !== "all") {
              const cat = (s[2] || "").toLowerCase();
              return cat.includes(mfCategory.toLowerCase());
            }
            return true;
          });
          list.sort((a, b) => Number(b[sortColIdx]) - Number(a[sortColIdx]));
          const top3 = list.slice(0, 3);
          const lines = top3.map((s, i) => {
            const r = Number(s[sortColIdx]);
            const sign = r > 0 ? "+" : "";
            const cleanName = (s[1] || "").replace(/ - Direct Plan.*$/i, "").replace(/ Direct Plan.*$/i, "").replace(/ - Growth.*$/i, "").trim();
            return `${i + 1}. ${cleanName}: ${sign}${r.toFixed(2)}%`;
          });
          const catStr = mfCategory === "all" ? "All" : mfCategory;
          return `🌱 Top Mutual Funds [${catStr}] (${meta.short} • ${asOf}):\n` +
            lines.join("\n") + "\n\n" +
            `More at vividnova.com/kyf/market-performance.html`;
        }

        if (sectionKey === "equities") {
          const sortColIdx = meta.eqCol;
          let list = (equitiesData.stocks || []).filter(s => {
            if (!expandAllNse && s[7] !== 1) return false;
            const val = s[sortColIdx];
            if (val === null || isNaN(val)) return false;
            if (equitySearchTerm && !(s[0] + " " + s[1]).toLowerCase().includes(equitySearchTerm)) return false;
            return true;
          });
          list.sort((a, b) => equityIsGainers ? Number(b[sortColIdx]) - Number(a[sortColIdx]) : Number(a[sortColIdx]) - Number(b[sortColIdx]));
          const top3 = list.slice(0, 3);
          const lines = top3.map((s, i) => {
            const r = Number(s[sortColIdx]);
            const sign = r > 0 ? "+" : "";
            return `${i + 1}. ${s[0]}: ₹${formatNumber(s[2], 2)} (${sign}${r.toFixed(2)}%)`;
          });
          const typeStr = equityIsGainers ? "Top Gainers" : "Top Decliners";
          return `📈 Top NSE Equities — ${typeStr} (${meta.short} • ${asOf}):\n` +
            lines.join("\n") + "\n\n" +
            `More at vividnova.com/kyf/market-performance.html`;
        }

        return "Empirical market review on vividnova.com/kyf/market-performance.html";
      }

      function drawCanvasRoundedRect(ctx, x, y, width, height, radius) {
        if (ctx.roundRect) {
          ctx.beginPath();
          ctx.roundRect(x, y, width, height, radius);
        } else {
          ctx.beginPath();
          ctx.moveTo(x + radius, y);
          ctx.lineTo(x + width - radius, y);
          ctx.arcTo(x + width, y, x + width, y + radius, radius);
          ctx.lineTo(x + width, y + height - radius);
          ctx.arcTo(x + width, y + height, x + width - radius, y + height, radius);
          ctx.lineTo(x + radius, y + height);
          ctx.arcTo(x, y + height, x, y + height - radius, radius);
          ctx.lineTo(x, y + radius);
          ctx.arcTo(x, y, x + radius, y, radius);
          ctx.closePath();
        }
      }

      function truncateCanvasText(ctx, text, maxWidth) {
        if (!text) return "";
        if (ctx.measureText(text).width <= maxWidth) return text;
        let t = text;
        while (t.length > 0 && ctx.measureText(t + "...").width > maxWidth) {
          t = t.slice(0, -1);
        }
        return t + "...";
      }

      function drawCanvasReturnBadge(ctx, val, x, y, w, h) {
        const num = Number(val);
        const isPos = num > 0;
        const isNeg = num < 0;
        const sign = isPos ? "+" : "";
        const text = isNaN(num) ? "—" : `${sign}${num.toFixed(2)}%`;

        let bgColor = "rgba(255, 255, 255, 0.08)";
        let borderColor = "rgba(255, 255, 255, 0.16)";
        let textColor = "#9ca3af";

        if (isPos) {
          bgColor = "rgba(16, 185, 129, 0.22)";
          borderColor = "rgba(16, 185, 129, 0.45)";
          textColor = "#34d399";
        } else if (isNeg) {
          bgColor = "rgba(239, 68, 68, 0.22)";
          borderColor = "rgba(239, 68, 68, 0.45)";
          textColor = "#f87171";
        }

        ctx.fillStyle = bgColor;
        drawCanvasRoundedRect(ctx, x, y, w, h, 6);
        ctx.fill();
        ctx.strokeStyle = borderColor;
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.fillStyle = textColor;
        ctx.font = "bold 13px 'SF Mono', Cascadia Code, Consolas, monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(text, x + w / 2, y + h / 2 + 1);
        ctx.textAlign = "left";
        ctx.textBaseline = "alphabetic";
      }

      function generateSectionCard(sectionKey, callback) {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        const width = 1200;
        let height = 720;

        if (sectionKey === "metals") height = 500;
        else if (sectionKey === "macro") height = 650;
        else if (sectionKey === "realestate") height = 740;
        else if (sectionKey === "indices") height = 640;
        else if (sectionKey === "mf" || sectionKey === "equities") height = 820;

        canvas.width = width;
        canvas.height = height;

        const meta = getHorizonMeta(selectedHorizon);
        const asOfDate = getFormattedAsOf();

        // Canvas Background Gradient
        const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
        bgGrad.addColorStop(0, "#162720");
        bgGrad.addColorStop(1, "#0d1712");
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, width, height);

        // Frame Border
        ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
        ctx.lineWidth = 2;
        drawCanvasRoundedRect(ctx, 16, 16, width - 32, height - 32, 20);
        ctx.stroke();

        // Brand Banner Header
        ctx.fillStyle = "#c97a2b";
        drawCanvasRoundedRect(ctx, 48, 44, 48, 24, 6);
        ctx.fill();
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 12px 'SF Mono', Cascadia Code, Consolas, monospace";
        ctx.fillText("KYF", 59, 60);

        ctx.fillStyle = "#eef1ea";
        ctx.font = "bold 16px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
        ctx.fillText("KNOW YOUR FINANCE", 108, 62);

        ctx.fillStyle = "#8ea89d";
        ctx.font = "14px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
        ctx.fillText("• Calm Cadence Market Review", 295, 62);

        // Right side pills: Date & Horizon
        ctx.font = "bold 12.5px 'SF Mono', Cascadia Code, monospace";
        const dateStr = `📅 ${asOfDate}`;
        const dateW = ctx.measureText(dateStr).width + 24;
        ctx.fillStyle = "rgba(255, 255, 255, 0.08)";
        drawCanvasRoundedRect(ctx, width - 48 - dateW, 42, dateW, 26, 13);
        ctx.fill();
        ctx.fillStyle = "#8fe0cd";
        ctx.fillText(dateStr, width - 48 - dateW + 12, 59);

        if (sectionKey !== "macro" && sectionKey !== "realestate") {
          const horizonStr = `⏱️ ${meta.short}`;
          const horizW = ctx.measureText(horizonStr).width + 24;
          ctx.fillStyle = "#1f7a6c";
          drawCanvasRoundedRect(ctx, width - 48 - dateW - horizW - 10, 42, horizW, 26, 13);
          ctx.fill();
          ctx.fillStyle = "#ffffff";
          ctx.fillText(horizonStr, width - 48 - dateW - horizW - 10 + 12, 59);
        } else if (sectionKey === "realestate") {
          const nat = residexData.national_composite_50_cities?.summary || {};
          const qtrStr = `🏡 ${nat.latest_quarter || 'Jun 2026'}`;
          const qtrW = ctx.measureText(qtrStr).width + 24;
          ctx.fillStyle = "#1f7a6c";
          drawCanvasRoundedRect(ctx, width - 48 - dateW - qtrW - 10, 42, qtrW, 26, 13);
          ctx.fill();
          ctx.fillStyle = "#ffffff";
          ctx.fillText(qtrStr, width - 48 - dateW - qtrW - 10 + 12, 59);
        }

        // Section Title & Subtitle
        let secTitle = "";
        let secSubtitle = "";
        if (sectionKey === "macro") {
          secTitle = "🏛️ Sovereign Yields & Economic Baseline";
          secSubtitle = "Spot inflation benchmarks, tax-free sovereign yields, and liquid hurdle rates (% p.a. • horizon agnostic)";
        } else if (sectionKey === "realestate") {
          secTitle = "🏡 Real Estate Benchmark & Housing Price Index";
          secSubtitle = "National Housing Bank (NHB RESIDEX) 50-city benchmark, spliced 33-quarter growth & RERA carpet rates";
        } else if (sectionKey === "metals") {
          secTitle = "🪙 Precious Metals Benchmark";
          secSubtitle = `Retail spot bullion prices and ${meta.label} returns (via ETFs)`;
        } else if (sectionKey === "indices") {
          secTitle = "📊 Market Indices & Valuations";
          secSubtitle = `Benchmark equities with live P/E multiples and ${meta.label}`;
        } else if (sectionKey === "mf") {
          const catStr = mfCategory === "all" ? "All Categories" : mfCategory;
          secTitle = `🌱 Top 10 Mutual Funds • ${catStr}`;
          secSubtitle = `Leading direct plan benchmark schemes sorted by ${meta.label}`;
        } else if (sectionKey === "equities") {
          const sortStr = equityIsGainers ? "Top Gainers" : "Top Decliners";
          secTitle = `📈 Top 10 Equities • ${sortStr}`;
          secSubtitle = `Leading NSE momentum performers for ${meta.label}`;
        }

        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 25px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
        ctx.fillText(secTitle, 48, 116);

        ctx.fillStyle = "#8ea89d";
        ctx.font = "14px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
        ctx.fillText(secSubtitle, 48, 140);

        // Divider Line
        ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
        ctx.beginPath();
        ctx.moveTo(48, 158);
        ctx.lineTo(width - 48, 158);
        ctx.stroke();

        // ------------------------------------------
        // BODY RENDERING
        // ------------------------------------------
        if (sectionKey === "macro") {
          const m = pulseData.macro || {};
          const boxes = [
            { lbl: "CPI INFLATION (BASELINE)", val: `${m.cpiInflation}%`, isBench: true },
            { lbl: "EDUCATION / MEDICAL", val: `${m.educationInflation}% – ${m.medicalInflation}%`, isBench: true },
            { lbl: "EPF (TAX-FREE SOVEREIGN)", val: `${m.epfRate}%`, isBench: false },
            { lbl: "PPF / SSY (TAX-FREE)", val: `${m.ppfRate}% / ${m.ssyRate}%`, isBench: false },
            { lbl: "SBI 1Y FIXED DEPOSIT", val: `${m.sbiFd1Yr}%`, isBench: false },
            { lbl: "ARBITRAGE / LIQUID AVG", val: `${m.arbitrageFundAvg}%`, isBench: false }
          ];

          const colW = 346;
          const rowH = 125;
          const gapX = 33;
          const startY = 185;

          boxes.forEach((b, idx) => {
            const r = Math.floor(idx / 3);
            const c = idx % 3;
            const bx = 48 + c * (colW + gapX);
            const by = startY + r * (rowH + 20);

            ctx.fillStyle = b.isBench ? "rgba(201, 122, 43, 0.12)" : "rgba(255, 255, 255, 0.04)";
            drawCanvasRoundedRect(ctx, bx, by, colW, rowH, 12);
            ctx.fill();
            ctx.strokeStyle = b.isBench ? "rgba(201, 122, 43, 0.4)" : "rgba(255, 255, 255, 0.1)";
            ctx.stroke();

            ctx.fillStyle = b.isBench ? "#dca368" : "#8ea89d";
            ctx.font = "bold 11.5px 'SF Mono', Cascadia Code, monospace";
            ctx.fillText(b.lbl, bx + 18, by + 34);

            ctx.fillStyle = b.isBench ? "#f3bc85" : "#ffffff";
            ctx.font = "bold 26px 'SF Mono', Cascadia Code, monospace";
            ctx.fillText(b.val, bx + 18, by + 86);
          });

          // Spread banner
          const spread = (m.epfRate - m.cpiInflation).toFixed(2);
          const bannerY = 490;
          ctx.fillStyle = "rgba(31, 122, 108, 0.22)";
          drawCanvasRoundedRect(ctx, 48, bannerY, width - 96, 52, 10);
          ctx.fill();
          ctx.strokeStyle = "rgba(31, 122, 108, 0.45)";
          ctx.stroke();

          ctx.fillStyle = "#8fe0cd";
          ctx.font = "14px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
          ctx.fillText("Real EPF Spread over CPI:", 68, bannerY + 32);

          ctx.fillStyle = "#34d399";
          ctx.font = "bold 16px 'SF Mono', Cascadia Code, monospace";
          ctx.fillText(`+${spread}% tax-free real yield over CPI`, 270, bannerY + 32);
        }

        else if (sectionKey === "realestate") {
          const nat = residexData.national_composite_50_cities?.summary || {};
          const cityKey = activeReCity || "Bengaluru";
          const cityObj = (residexData.cities || {})[cityKey] || {};
          const citySummary = cityObj.summary || {};

          const natYoySign = (nat.hpi_yoy_pct || 0) > 0 ? "+" : "";
          const nat8ySign = (nat.hpi_total_growth_8y || 0) > 0 ? "+" : "";
          const boxes = [
            { lbl: "50-CITY NATIONAL HPI", val: `${nat.hpi_index || 101.96}`, sub: `YoY: ${natYoySign}${nat.hpi_yoy_pct != null ? nat.hpi_yoy_pct : 1.56}%`, isBench: true },
            { lbl: "COMPOSITE CARPET RATE", val: `₹${formatNumber(nat.carpet_price_sqft || 5495, 0)}`, sub: "50-City National Average /sq.ft.", isBench: false },
            { lbl: "5Y ANNUALIZED CAGR", val: `${nat.hpi_cagr_5y != null ? nat.hpi_cagr_5y.toFixed(2) : '4.83'}%`, sub: "National Housing Return (2021–26)", isBench: false },
            { lbl: "8Y SPLICED APPRECIATION", val: `${nat8ySign}${nat.hpi_total_growth_8y != null ? nat.hpi_total_growth_8y : '10.02'}%`, sub: "33-Quarter Continuous Curve", isBench: false }
          ];

          const colW = 260;
          const rowH = 120;
          const gapX = 20;
          const startY = 185;

          boxes.forEach((b, idx) => {
            const bx = 48 + idx * (colW + gapX);
            const by = startY;

            ctx.fillStyle = b.isBench ? "rgba(201, 122, 43, 0.12)" : "rgba(255, 255, 255, 0.04)";
            drawCanvasRoundedRect(ctx, bx, by, colW, rowH, 12);
            ctx.fill();
            ctx.strokeStyle = b.isBench ? "rgba(201, 122, 43, 0.4)" : "rgba(255, 255, 255, 0.1)";
            ctx.stroke();

            ctx.fillStyle = b.isBench ? "#dca368" : "#8ea89d";
            ctx.font = "bold 11px 'SF Mono', Cascadia Code, monospace";
            ctx.fillText(b.lbl, bx + 16, by + 30);

            ctx.fillStyle = b.isBench ? "#f3bc85" : "#ffffff";
            ctx.font = "bold 24px 'SF Mono', Cascadia Code, monospace";
            ctx.fillText(b.val, bx + 16, by + 74);

            ctx.fillStyle = "#8ea89d";
            ctx.font = "11px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
            ctx.fillText(b.sub, bx + 16, by + 102);
          });

          // Focus Metro Panel
          const cityCardY = 330;
          ctx.fillStyle = "rgba(31, 122, 108, 0.14)";
          drawCanvasRoundedRect(ctx, 48, cityCardY, width - 96, 175, 14);
          ctx.fill();
          ctx.strokeStyle = "rgba(31, 122, 108, 0.45)";
          ctx.stroke();

          ctx.fillStyle = "#8fe0cd";
          ctx.font = "bold 18px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
          ctx.fillText(`📍 City Focus: ${cityKey} (${cityObj.state || ''})`, 72, cityCardY + 36);

          ctx.font = "bold 13px 'SF Mono', Cascadia Code, monospace";
          ctx.fillStyle = "#ffffff";
          const cYoySign = (citySummary.hpi_yoy_pct || 0) > 0 ? "+" : "";
          const cCarpetYoySign = (citySummary.carpet_price_yoy_pct || 0) > 0 ? "+" : "";
          const c8ySign = (citySummary.hpi_total_growth_8y || 0) > 0 ? "+" : "";
          ctx.fillText(`• Latest HPI: ${citySummary.hpi_index || '—'} (${cYoySign}${citySummary.hpi_yoy_pct != null ? citySummary.hpi_yoy_pct : 0}% YoY)`, 72, cityCardY + 76);
          ctx.fillText(`• Usable Carpet Price: ₹${formatNumber(citySummary.carpet_price_sqft || 0, 0)}/sq.ft. (${cCarpetYoySign}${citySummary.carpet_price_yoy_pct != null ? citySummary.carpet_price_yoy_pct : 0}% YoY)`, 72, cityCardY + 106);
          ctx.fillText(`• 3Y / 5Y CAGR: ${citySummary.hpi_cagr_3y != null ? citySummary.hpi_cagr_3y : 0}% / ${citySummary.hpi_cagr_5y != null ? citySummary.hpi_cagr_5y : 0}% p.a.  |  8-Year Total Gain: ${c8ySign}${citySummary.hpi_total_growth_8y != null ? citySummary.hpi_total_growth_8y : 0}%`, 72, cityCardY + 136);

          // Reality Check Banner
          const bannerY = 530;
          ctx.fillStyle = "rgba(201, 122, 43, 0.16)";
          drawCanvasRoundedRect(ctx, 48, bannerY, width - 96, 70, 10);
          ctx.fill();
          ctx.strokeStyle = "rgba(201, 122, 43, 0.4)";
          ctx.stroke();

          ctx.fillStyle = "#f3bc85";
          ctx.font = "bold 13.5px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
          ctx.fillText("💡 Carpet vs. Super Built-Up Reality Check:", 70, bannerY + 28);

          ctx.fillStyle = "#eef1ea";
          ctx.font = "12px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
          ctx.fillText("Brokers market gross Super Built-Up area. Factoring 35% common area loading + 7% stamp duty friction expands actual livable space cost by +44.5%.", 70, bannerY + 50);
        }

        else if (sectionKey === "metals") {
          const pm = pulseData.preciousMetals || {};
          const gRet = getActiveGoldRet();
          const sRet = getActiveSilverRet();

          const cardW = 535;
          const cardH = 200;
          const cardY = 190;

          // Gold Card
          const gx = 48;
          ctx.fillStyle = "rgba(255, 255, 255, 0.04)";
          drawCanvasRoundedRect(ctx, gx, cardY, cardW, cardH, 14);
          ctx.fill();
          ctx.strokeStyle = "rgba(201, 122, 43, 0.35)";
          ctx.stroke();

          ctx.fillStyle = "#ffffff";
          ctx.font = "bold 20px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
          ctx.fillText("Gold — 24K Pure (99.9%)", gx + 22, cardY + 42);

          ctx.fillStyle = "#8ea89d";
          ctx.font = "13px 'SF Mono', Cascadia Code, monospace";
          ctx.fillText(`22K Jewellery Standard: ₹${formatNumber(pm.gold22kPerGram, 0)}/g • via GOLDBEES`, gx + 22, cardY + 70);

          ctx.fillStyle = "#ffffff";
          ctx.font = "bold 28px 'SF Mono', Cascadia Code, monospace";
          ctx.fillText(`₹${formatNumber(pm.gold24kPerGram, 0)} / g`, gx + 22, cardY + 146);

          drawCanvasReturnBadge(ctx, gRet, gx + cardW - 120, cardY + 122, 98, 34);

          // Silver Card
          const sx = 48 + cardW + 34;
          ctx.fillStyle = "rgba(255, 255, 255, 0.04)";
          drawCanvasRoundedRect(ctx, sx, cardY, cardW, cardH, 14);
          ctx.fill();
          ctx.strokeStyle = "rgba(142, 224, 205, 0.35)";
          ctx.stroke();

          ctx.fillStyle = "#ffffff";
          ctx.font = "bold 20px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
          ctx.fillText("Silver — 999 Bullion Bar", sx + 22, cardY + 42);

          ctx.fillStyle = "#8ea89d";
          ctx.font = "13px 'SF Mono', Cascadia Code, monospace";
          ctx.fillText(`Retail Spot: ₹${formatNumber(pm.silverPerGram, 0)}/g • via SILVERBEES`, sx + 22, cardY + 70);

          ctx.fillStyle = "#ffffff";
          ctx.font = "bold 28px 'SF Mono', Cascadia Code, monospace";
          ctx.fillText(`₹${formatNumber(pm.silverPerKg, 0)} / kg`, sx + 22, cardY + 146);

          drawCanvasReturnBadge(ctx, sRet, sx + cardW - 120, cardY + 122, 98, 34);
        }

        else if (sectionKey === "indices") {
          // Table header
          ctx.fillStyle = "rgba(255, 255, 255, 0.06)";
          drawCanvasRoundedRect(ctx, 48, 185, width - 96, 36, 8);
          ctx.fill();

          ctx.fillStyle = "#8ea89d";
          ctx.font = "bold 11.5px 'SF Mono', Cascadia Code, monospace";
          ctx.fillText("BENCHMARK INDEX", 68, 208);
          ctx.fillText("ROLE / FOCUS", 340, 208);
          ctx.fillText("CURRENT LEVEL", 680, 208);
          ctx.fillText("P/E VALUATION", 860, 208);
          ctx.fillText(`${meta.short} RETURN`, 1030, 208);

          const indices = Object.values(pulseData.indices || {});
          indices.forEach((idx, i) => {
            const ry = 236 + i * 84;
            ctx.fillStyle = i % 2 === 0 ? "rgba(255, 255, 255, 0.03)" : "rgba(255, 255, 255, 0.015)";
            drawCanvasRoundedRect(ctx, 48, ry, width - 96, 72, 10);
            ctx.fill();
            ctx.strokeStyle = "rgba(255, 255, 255, 0.06)";
            ctx.stroke();

            // Name
            ctx.fillStyle = "#ffffff";
            ctx.font = "bold 18px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
            ctx.fillText(idx.name, 68, ry + 42);

            // Role
            ctx.fillStyle = "#8ea89d";
            ctx.font = "13px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
            ctx.fillText(truncateCanvasText(ctx, idx.role || "", 300), 340, ry + 42);

            // Level
            ctx.fillStyle = "#ffffff";
            ctx.font = "bold 18px 'SF Mono', Cascadia Code, monospace";
            ctx.fillText(formatNumber(idx.level, 1), 680, ry + 42);

            // P/E Badge
            const tag = getValuationTag(idx.pe);
            const peText = `P/E ${idx.pe ? idx.pe.toFixed(1) : '—'} • ${tag.label}`;
            ctx.font = "bold 12px 'SF Mono', monospace";
            const peW = ctx.measureText(peText).width + 16;
            ctx.fillStyle = "rgba(31, 122, 108, 0.25)";
            drawCanvasRoundedRect(ctx, 860, ry + 24, peW, 26, 6);
            ctx.fill();
            ctx.fillStyle = tag.color;
            ctx.fillText(peText, 868, ry + 41);

            // Return badge
            let canvasRet = idx[meta.idxKey];
            if (canvasRet === null || canvasRet === undefined) {
              if (selectedHorizon === "1m") canvasRet = idx.ret1m;
              else if (selectedHorizon === "3m") canvasRet = idx.ret3m;
              else if (selectedHorizon === "6m") canvasRet = idx.ret6m;
              else if (selectedHorizon === "1y") canvasRet = idx.ret1y != null ? idx.ret1y : idx.cagr1y;
            }
            drawCanvasReturnBadge(ctx, canvasRet, 1020, ry + 22, 88, 30);
          });
        }

        else if (sectionKey === "mf") {
          // Table Header
          ctx.fillStyle = "rgba(255, 255, 255, 0.06)";
          drawCanvasRoundedRect(ctx, 48, 180, width - 96, 36, 8);
          ctx.fill();

          ctx.fillStyle = "#8ea89d";
          ctx.font = "bold 11.5px 'SF Mono', Cascadia Code, monospace";
          ctx.fillText("#", 66, 203);
          ctx.fillText("FUND NAME & CATEGORY", 120, 203);
          ctx.fillText("CURRENT NAV", 880, 203);
          ctx.fillText(meta.short.toUpperCase(), 1040, 203);

          const sortColIdx = meta.mfCol;
          let list = (mfData.schemes || []).filter(s => {
            const val = s[sortColIdx];
            if (val === null || val === undefined || isNaN(val)) return false;
            if (mfCategory !== "all") {
              const cat = (s[2] || "").toLowerCase();
              return cat.includes(mfCategory.toLowerCase());
            }
            return true;
          });
          list.sort((a, b) => Number(b[sortColIdx]) - Number(a[sortColIdx]));
          const top10 = list.slice(0, 10);

          top10.forEach((s, i) => {
            const ry = 226 + i * 50;
            ctx.fillStyle = i % 2 === 0 ? "rgba(255, 255, 255, 0.03)" : "rgba(255, 255, 255, 0.015)";
            drawCanvasRoundedRect(ctx, 48, ry, width - 96, 44, 8);
            ctx.fill();

            // Rank
            ctx.fillStyle = i < 3 ? "#c97a2b" : "#8ea89d";
            ctx.font = "bold 14px 'SF Mono', monospace";
            ctx.fillText(`#${i + 1}`, 64, ry + 27);

            // Name
            ctx.fillStyle = "#ffffff";
            ctx.font = "bold 14px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
            const cleanName = s[1].replace(/ - Direct Plan/gi, "");
            ctx.fillText(truncateCanvasText(ctx, cleanName, 500), 120, ry + 27);

            // Category
            ctx.fillStyle = "#8fe0cd";
            ctx.font = "12px 'SF Mono', monospace";
            ctx.fillText(truncateCanvasText(ctx, s[2] || "", 180), 660, ry + 27);

            // NAV
            ctx.fillStyle = "#ffffff";
            ctx.font = "bold 14.5px 'SF Mono', monospace";
            ctx.fillText(`₹${formatNumber(s[3], 2)}`, 880, ry + 27);

            // Return badge
            drawCanvasReturnBadge(ctx, s[sortColIdx], 1030, ry + 9, 86, 26);
          });
        }

        else if (sectionKey === "equities") {
          // Table Header
          ctx.fillStyle = "rgba(255, 255, 255, 0.06)";
          drawCanvasRoundedRect(ctx, 48, 180, width - 96, 36, 8);
          ctx.fill();

          ctx.fillStyle = "#8ea89d";
          ctx.font = "bold 11.5px 'SF Mono', Cascadia Code, monospace";
          ctx.fillText("#", 66, 203);
          ctx.fillText("SYMBOL & COMPANY", 120, 203);
          ctx.fillText("PRICE (₹)", 880, 203);
          ctx.fillText(meta.short.toUpperCase(), 1040, 203);

          const sortColIdx = meta.eqCol;
          let list = (equitiesData.stocks || []).filter(s => {
            if (!expandAllNse && s[7] !== 1) return false;
            const val = s[sortColIdx];
            if (val === null || isNaN(val)) return false;
            if (equitySearchTerm && !(s[0] + " " + s[1]).toLowerCase().includes(equitySearchTerm)) return false;
            return true;
          });
          list.sort((a, b) => equityIsGainers ? Number(b[sortColIdx]) - Number(a[sortColIdx]) : Number(a[sortColIdx]) - Number(b[sortColIdx]));
          const top10 = list.slice(0, 10);

          top10.forEach((s, i) => {
            const ry = 226 + i * 50;
            ctx.fillStyle = i % 2 === 0 ? "rgba(255, 255, 255, 0.03)" : "rgba(255, 255, 255, 0.015)";
            drawCanvasRoundedRect(ctx, 48, ry, width - 96, 44, 8);
            ctx.fill();

            // Rank
            ctx.fillStyle = i < 3 ? "#c97a2b" : "#8ea89d";
            ctx.font = "bold 14px 'SF Mono', monospace";
            ctx.fillText(`#${i + 1}`, 64, ry + 27);

            // Symbol
            ctx.fillStyle = "#ffffff";
            ctx.font = "bold 14.5px 'SF Mono', monospace";
            ctx.fillText(s[0], 120, ry + 27);

            // Name
            ctx.fillStyle = "#8ea89d";
            ctx.font = "13px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
            ctx.fillText(truncateCanvasText(ctx, s[1], 420), 260, ry + 27);

            // Price
            ctx.fillStyle = "#ffffff";
            ctx.font = "bold 14.5px 'SF Mono', monospace";
            ctx.fillText(`₹${formatNumber(s[2], 2)}`, 880, ry + 27);

            // Return badge
            drawCanvasReturnBadge(ctx, s[sortColIdx], 1030, ry + 9, 86, 26);
          });
        }

        // Card Footer
        ctx.fillStyle = "#8ea89d";
        ctx.font = "12px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
        ctx.fillText("🛡️ Verified empirical data • Filtered unadjusted split distortions • vividnova.com/kyf", 48, height - 36);

        ctx.fillStyle = "#8fe0cd";
        ctx.font = "bold 13px 'SF Mono', Cascadia Code, monospace";
        ctx.fillText("@KnowYourFinance", width - 48 - 140, height - 36);

        // Convert canvas to blob & data URL
        canvas.toBlob(function (blob) {
          const dataUrl = canvas.toDataURL("image/png");
          callback({ canvas, blob, dataUrl });
        }, "image/png");
      }

      function showShareToast(msg) {
        const toast = document.getElementById("shareToast");
        if (!toast) return;
        toast.textContent = msg;
        toast.classList.add("show");
        if (shareToastTimer) clearTimeout(shareToastTimer);
        shareToastTimer = setTimeout(() => {
          toast.classList.remove("show");
        }, 4000);
      }

      function openShareModal(sectionKey) {
        currentShareSection = sectionKey;
        const meta = getHorizonMeta(selectedHorizon);
        const asOf = getFormattedAsOf();

        currentShareFileName = `KYF-${sectionKey}-${selectedHorizon}.png`;
        currentShareText = getSectionShareText(sectionKey);

        const modal = document.getElementById("shareModal");
        const titleEl = document.getElementById("shareModalTitle");
        const subEl = document.getElementById("shareModalSubtitle");
        const textPreview = document.getElementById("shareTextPreview");
        const imgPreview = document.getElementById("shareImgPreview");
        const nativeBtn = document.getElementById("nativeShareBtn");

        if (titleEl) {
          titleEl.innerHTML = `<span>📤 Share: ${getSectionDisplayName(sectionKey)}</span>`;
        }
        if (subEl) {
          const horizLabel = sectionKey === "macro" ? "Spot Administered Benchmark" : meta.label;
          subEl.textContent = `Horizon: ${horizLabel} • Benchmark Date: ${asOf}`;
        }
        if (textPreview) {
          textPreview.value = currentShareText;
        }
        if (imgPreview) {
          imgPreview.alt = "Generating high-resolution card...";
          imgPreview.src = "";
        }

        // Render card
        generateSectionCard(sectionKey, function (res) {
          currentShareBlob = res.blob;
          if (imgPreview) {
            imgPreview.src = res.dataUrl;
            imgPreview.alt = `${getSectionDisplayName(sectionKey)} Snapshot`;
          }

          // Check Web Share API with files
          if (nativeBtn && navigator.canShare && res.blob) {
            const testFile = new File([res.blob], currentShareFileName, { type: "image/png" });
            if (navigator.canShare({ files: [testFile] })) {
              nativeBtn.style.display = "inline-flex";
            } else {
              nativeBtn.style.display = "none";
            }
          }
        });

        if (modal) modal.classList.add("open");
      }

      // ==========================================
      // EVENT BINDINGS
      // ==========================================
      function bindEvents() {
        // Horizon pill clicks (drives Indices, Precious Metals, Equities, and Mutual Funds)
        const horizonPills = document.querySelectorAll(".horizon-pill");
        horizonPills.forEach(pill => {
          pill.addEventListener("click", function () {
            horizonPills.forEach(p => {
              p.classList.remove("active");
              p.setAttribute("aria-selected", "false");
            });
            this.classList.add("active");
            this.setAttribute("aria-selected", "true");
            selectedHorizon = this.dataset.horizon;

            const horizonWindowDesc = document.getElementById("horizonWindowDesc");
            const horizonDescMap = {
              "1m": "1-Month Trailing Return (Short-term momentum & sentiment)",
              "3m": "3-Month Trailing Return (Quarterly trend review)",
              "6m": "6-Month Trailing Return (Mid-term trend & recovery)",
              "1y": "1-Year Trailing Cumulative Return (Annual benchmark)"
            };
            if (horizonWindowDesc) {
              horizonWindowDesc.textContent = horizonDescMap[selectedHorizon] || "";
            }

            renderPreciousMetals();
            renderIndices();
            renderMutualFunds();
            renderEquities();
          });
        });

        // Equities Sort Toggle (Gainers vs Decliners)
        const sortToggle = document.getElementById("equitySortToggle");
        if (sortToggle) {
          sortToggle.addEventListener("click", function () {
            equityIsGainers = !equityIsGainers;
            if (equityIsGainers) {
              this.className = "toggle-sort-btn gainers";
              this.innerHTML = "<span>🟢 Top Gainers</span>";
            } else {
              this.className = "toggle-sort-btn decliners";
              this.innerHTML = "<span>🔴 Top Decliners</span>";
            }
            renderEquities();
          });
        }

        // Expand to all NSE stocks checkbox toggle
        const includeAllNseToggle = document.getElementById("includeAllNseToggle");
        if (includeAllNseToggle) {
          includeAllNseToggle.addEventListener("change", function () {
            expandAllNse = this.checked;
            const countBadge = document.getElementById("equityCountBadge");
            if (countBadge) {
              if (expandAllNse) {
                countBadge.innerHTML = `${(equitiesData.stocks || []).length} Stocks Screened`;
              } else {
                countBadge.innerHTML = `⭐ ${equitiesData.nifty500Count || 501} Nifty 500 Leaders`;
              }
            }
            renderEquities();
          });
        }

        // Outlier Modal open / close
        const outliersModal = document.getElementById("outliersModal");
        const openModalBtn = document.getElementById("openOutliersModalBtn");
        const closeModalBtn = document.getElementById("closeOutliersModalBtn");

        if (openModalBtn && outliersModal) {
          openModalBtn.addEventListener("click", () => outliersModal.classList.add("open"));
        }
        if (closeModalBtn && outliersModal) {
          closeModalBtn.addEventListener("click", () => outliersModal.classList.remove("open"));
        }
        if (outliersModal) {
          outliersModal.addEventListener("click", function (e) {
            if (e.target === outliersModal) outliersModal.classList.remove("open");
          });
        }

        // Equities Search Input
        const searchInput = document.getElementById("equitySearchInput");
        if (searchInput) {
          searchInput.addEventListener("input", function (e) {
            equitySearchTerm = e.target.value.trim().toLowerCase();
            renderEquities();
          });
        }

        // Mutual Funds category filter pills
        const catPills = document.querySelectorAll("#mfCatFilters .cat-pill");
        catPills.forEach(pill => {
          pill.addEventListener("click", function () {
            catPills.forEach(p => p.classList.remove("active"));
            this.classList.add("active");
            mfCategory = this.dataset.cat;
            renderMutualFunds();
          });
        });

        // Unified KYF Vault Integration (Cadence + Portfolio + Goals)
        if (window.KYF_VAULT) {
          window.KYF_VAULT.registerPageHook({
            pageName: "market-performance",
            getLocalData: () => ({ marketReviewDate: new Date().toISOString() })
          });
          window.KYF_VAULT.bindPageUI({
            fileInputId: "kyfFileInput",
            openBtnId: "navOpenFileBtn",
            saveBtnId: "navSaveDataBtn"
          });
        }

        // ------------------------------------------
        // Section Share Buttons & Modal Handlers
        // ------------------------------------------
        document.querySelectorAll(".section-share-btn").forEach(btn => {
          btn.addEventListener("click", function (e) {
            e.preventDefault();
            e.stopPropagation();
            openShareModal(this.dataset.section);
          });
        });

        const shareModal = document.getElementById("shareModal");
        const closeShareModalBtn = document.getElementById("closeShareModalBtn");
        if (closeShareModalBtn && shareModal) {
          closeShareModalBtn.addEventListener("click", () => shareModal.classList.remove("open"));
        }
        if (shareModal) {
          shareModal.addEventListener("click", function (e) {
            if (e.target === shareModal) shareModal.classList.remove("open");
          });
        }

        // Close on Escape key
        document.addEventListener("keydown", function (e) {
          if (e.key === "Escape" && shareModal && shareModal.classList.contains("open")) {
            shareModal.classList.remove("open");
          }
        });

        // Share on X (Twitter)
        const shareToXBtn = document.getElementById("shareToXBtn");
        if (shareToXBtn) {
          shareToXBtn.addEventListener("click", async function () {
            const textPreview = document.getElementById("shareTextPreview");
            const tweetText = textPreview ? textPreview.value : currentShareText;
            const tweetUrl = "https://twitter.com/intent/tweet?text=" + encodeURIComponent(tweetText);

            // Attempt to copy image to clipboard so user can directly paste (Ctrl+V) in their X post
            if (currentShareBlob && navigator.clipboard && window.ClipboardItem) {
              try {
                await navigator.clipboard.write([new ClipboardItem({ "image/png": currentShareBlob })]);
                showShareToast("✓ Image copied to clipboard! Paste (Ctrl+V) directly in your X post.");
              } catch (err) {
                console.warn("Clipboard image write failed:", err);
                showShareToast("Opening X composer... Use 'Download PNG' to attach the visual card.");
              }
            } else {
              showShareToast("Opening X composer...");
            }

            window.open(tweetUrl, "_blank", "noopener,noreferrer");
          });
        }

        // Copy Text
        const copyShareTextBtn = document.getElementById("copyShareTextBtn");
        if (copyShareTextBtn) {
          copyShareTextBtn.addEventListener("click", function () {
            const textPreview = document.getElementById("shareTextPreview");
            const text = textPreview ? textPreview.value : currentShareText;
            if (navigator.clipboard && navigator.clipboard.writeText) {
              navigator.clipboard.writeText(text).then(() => {
                showShareToast("✓ Post text copied to clipboard!");
              }).catch(err => {
                showShareToast("Could not copy text: " + err.message);
              });
            } else {
              if (textPreview) {
                textPreview.select();
                document.execCommand("copy");
                showShareToast("✓ Post text copied to clipboard!");
              }
            }
          });
        }

        // Copy Image
        const copyShareImgBtn = document.getElementById("copyShareImgBtn");
        if (copyShareImgBtn) {
          copyShareImgBtn.addEventListener("click", async function () {
            if (!currentShareBlob) {
              showShareToast("Please wait for card image to generate...");
              return;
            }
            if (navigator.clipboard && window.ClipboardItem) {
              try {
                await navigator.clipboard.write([new ClipboardItem({ "image/png": currentShareBlob })]);
                showShareToast("✓ Visual card copied to clipboard! Paste with Ctrl+V.");
              } catch (err) {
                console.warn("Clipboard write failed:", err);
                showShareToast("Clipboard image access denied. Please click 'Download PNG'.");
              }
            } else {
              showShareToast("Clipboard image copy not supported in this browser. Use 'Download PNG'.");
            }
          });
        }

        // Download PNG Image
        const downloadShareImgBtn = document.getElementById("downloadShareImgBtn");
        if (downloadShareImgBtn) {
          downloadShareImgBtn.addEventListener("click", function () {
            if (!currentShareBlob) {
              showShareToast("Please wait for card image to generate...");
              return;
            }
            const url = URL.createObjectURL(currentShareBlob);
            const a = document.createElement("a");
            a.href = url;
            a.download = currentShareFileName || "KYF-Market-Snapshot.png";
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            showShareToast(`✓ Downloaded ${a.download}`);
          });
        }

        // Native Web Share API (Mobile / Tablet / Supporting OS)
        const nativeShareBtn = document.getElementById("nativeShareBtn");
        if (nativeShareBtn) {
          nativeShareBtn.addEventListener("click", async function () {
            if (!navigator.share) return;
            const textPreview = document.getElementById("shareTextPreview");
            const text = textPreview ? textPreview.value : currentShareText;
            const shareData = {
              title: getSectionDisplayName(currentShareSection),
              text: text
            };
            if (currentShareBlob && navigator.canShare) {
              try {
                const file = new File([currentShareBlob], currentShareFileName, { type: "image/png" });
                if (navigator.canShare({ files: [file] })) {
                  shareData.files = [file];
                }
              } catch (e) {
                console.warn("File share prep error:", e);
              }
            }
            try {
              await navigator.share(shareData);
              showShareToast("✓ Shared successfully!");
            } catch (err) {
              if (err.name !== "AbortError") {
                showShareToast("Share failed: " + err.message);
              }
            }
          });
        }

        // Real Estate Bindings
        const reCitySelect = document.getElementById("reCitySelect");
        if (reCitySelect) {
          reCitySelect.addEventListener("change", function () {
            setActiveReCity(this.value);
          });
        }

        const reHpiBtn = document.getElementById("reViewModeHpi");
        const reTiersBtn = document.getElementById("reViewModeTiers");
        if (reHpiBtn && reTiersBtn) {
          reHpiBtn.addEventListener("click", function () {
            activeReViewMode = "hpi";
            this.classList.add("active");
            this.setAttribute("aria-selected", "true");
            reTiersBtn.classList.remove("active");
            reTiersBtn.setAttribute("aria-selected", "false");
            renderRealEstateChart(activeReCity, "hpi");
          });
          reTiersBtn.addEventListener("click", function () {
            activeReViewMode = "tiers";
            this.classList.add("active");
            this.setAttribute("aria-selected", "true");
            reHpiBtn.classList.remove("active");
            reHpiBtn.setAttribute("aria-selected", "false");
            renderRealEstateChart(activeReCity, "tiers");
          });
        }

        // Leaderboard Column Sorting
        const reThs = document.querySelectorAll("#reLeaderboardTable th.re-sortable-th");
        reThs.forEach(th => {
          th.addEventListener("click", function () {
            const col = this.dataset.sort;
            if (!col) return;
            if (reSortCol === col) {
              reSortAsc = !reSortAsc;
            } else {
              reSortCol = col;
              reSortAsc = false; // default descending on new column
            }
            renderRealEstateLeaderboard();
          });
        });
      }

      // ==========================================
      // SCROLLSPY FOR SECTION NAVIGATION TOOLBAR
      // ==========================================
      
      // ==========================================
      // COLLAPSIBLE REAL ESTATE CHART & TABLE
      // ==========================================
      function initCollapsibles() {
        const chartBtn = document.getElementById("reChartCollapseBtn");
        const chartBody = document.getElementById("reChartBody");
        const tableBtn = document.getElementById("reTableCollapseBtn");
        const tableBody = document.getElementById("reTableBody");

        function setCollapsed(btn, body, isCollapsed, labelOpen, labelClosed) {
          if (!btn || !body) return;
          if (isCollapsed) {
            body.classList.add("is-collapsed");
            btn.classList.add("is-collapsed");
            btn.setAttribute("aria-expanded", "false");
            const textEl = btn.querySelector(".re-collapse-text");
            if (textEl) textEl.textContent = labelClosed;
          } else {
            body.classList.remove("is-collapsed");
            btn.classList.remove("is-collapsed");
            btn.setAttribute("aria-expanded", "true");
            const textEl = btn.querySelector(".re-collapse-text");
            if (textEl) textEl.textContent = labelOpen;
          }
        }

        let chartIsCollapsed = false;
        let tableIsCollapsed = false;
        try {
          chartIsCollapsed = localStorage.getItem("kyf_re_chart_collapsed") === "1";
          tableIsCollapsed = localStorage.getItem("kyf_re_table_collapsed") === "1";
        } catch (e) {}

        setCollapsed(chartBtn, chartBody, chartIsCollapsed, "Collapse Chart", "Expand Chart");
        setCollapsed(tableBtn, tableBody, tableIsCollapsed, "Collapse Table", "Expand Table");

        if (chartBtn && chartBody) {
          chartBtn.addEventListener("click", function () {
            const isNowCollapsed = !chartBody.classList.contains("is-collapsed");
            setCollapsed(chartBtn, chartBody, isNowCollapsed, "Collapse Chart", "Expand Chart");
            try {
              localStorage.setItem("kyf_re_chart_collapsed", isNowCollapsed ? "1" : "0");
            } catch (e) {}
          });
        }

        if (tableBtn && tableBody) {
          tableBtn.addEventListener("click", function () {
            const isNowCollapsed = !tableBody.classList.contains("is-collapsed");
            setCollapsed(tableBtn, tableBody, isNowCollapsed, "Collapse Table", "Expand Table");
            try {
              localStorage.setItem("kyf_re_table_collapsed", isNowCollapsed ? "1" : "0");
            } catch (e) {}
          });
        }
      }

      function expandChartIfCollapsed() {
        const chartBody = document.getElementById("reChartBody");
        const chartBtn = document.getElementById("reChartCollapseBtn");
        if (chartBody && chartBody.classList.contains("is-collapsed")) {
          chartBody.classList.remove("is-collapsed");
          if (chartBtn) {
            chartBtn.classList.remove("is-collapsed");
            chartBtn.setAttribute("aria-expanded", "true");
            const textEl = chartBtn.querySelector(".re-collapse-text");
            if (textEl) textEl.textContent = "Collapse Chart";
          }
          try {
            localStorage.setItem("kyf_re_chart_collapsed", "0");
          } catch (e) {}
        }
      }

      function initScrollSpy() {
        const sections = [
          { id: "section-macro", key: "macro" },
          { id: "section-realestate", key: "realestate" },
          { id: "section-metals", key: "metals" },
          { id: "section-indices", key: "indices" },
          { id: "section-mf", key: "mf" },
          { id: "section-equities", key: "equities" }
        ];

        const links = document.querySelectorAll(".sec-nav-link");
        const jumpLinksContainer = document.getElementById("sectionJumpLinks");
        if (links.length === 0) return;

        function onScroll() {
          const isCompact = window.innerHeight <= 700 || window.innerWidth <= 768;
          const scrollPos = window.scrollY + (isCompact ? 90 : 170);
          let currentSec = "macro";

          for (let i = 0; i < sections.length; i++) {
            const el = document.getElementById(sections[i].id);
            if (el && el.offsetTop <= scrollPos) {
              currentSec = sections[i].key;
            }
          }

          links.forEach(link => {
            if (link.dataset.sec === currentSec) {
              const wasActive = link.classList.contains("active");
              link.classList.add("active");
              if (!wasActive && window.innerWidth <= 768 && jumpLinksContainer) {
                link.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
              }
            } else {
              link.classList.remove("active");
            }
          });
        }

        window.addEventListener("scroll", onScroll, { passive: true });
        onScroll();

        // Smooth scroll link into view on click in horizontal scroller
        links.forEach(link => {
          link.addEventListener("click", () => {
            if (window.innerWidth <= 768 && jumpLinksContainer) {
              setTimeout(() => {
                link.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
              }, 60);
            }
          });
        });
      }

      // Initial Render
      renderMacroRates();
      renderRealEstate();
      renderPreciousMetals();
      renderIndices();
      renderMutualFunds();
      renderEquities();
      bindEvents();
      initScrollSpy();
      initCollapsibles();
    })();