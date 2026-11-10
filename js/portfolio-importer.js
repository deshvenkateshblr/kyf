/**
 * KYF Family Portfolio Tracker — Lean Broker & Mutual Fund CSV/XLSX Importer (`js/portfolio-importer.js`)
 * Version: v1.6.0
 * Pure Vanilla ES6+ | Zero-Server, Client-Side Only | O(1) ISIN Lookup via KYF_PORTFOLIO_ENGINE
 * Supports: Zerodha (Kite, Console, Coin), Groww (Stocks, MF), HDFC Sec, SBI Sec, ICICI Direct,
 * Angel One, Upstox, Kotak Sec, Kuvera, and CAMS / KFintech / MFCentral Consolidated Statements.
 */

window.KYF_BROKER_IMPORTER = (() => {
  const ISIN_REGEX = /^IN[EF0][0-9A-Z]{9}$/i;

  const BROKER_PROFILES = [
    {
      id: "ZERODHA_COIN",
      label: "Zerodha Coin (MF)",
      custodian: "Zerodha Coin",
      defaultAssetClass: "Mutual Funds",
      requiredTokens: ["fund name", "folio number", "quantity available"],
      optionalTokens: ["isin", "average price", "invested amount", "current value"]
    },
    {
      id: "ZERODHA_CONSOLE",
      label: "Zerodha Console",
      custodian: "Zerodha",
      defaultAssetClass: "Equities",
      requiredTokens: ["symbol", "isin", "quantity available", "average price"],
      optionalTokens: ["sector", "previous closing price", "unrealized p&l"]
    },
    {
      id: "ZERODHA_KITE",
      label: "Zerodha Kite",
      custodian: "Zerodha",
      defaultAssetClass: "Equities",
      requiredTokens: ["instrument", "qty.", "avg. cost", "ltp"],
      optionalTokens: ["cur. val", "p&l", "net chg."]
    },
    {
      id: "GROWW_MF",
      label: "Groww (Mutual Funds)",
      custodian: "Groww",
      defaultAssetClass: "Mutual Funds",
      requiredTokens: ["scheme name", "folio no.", "units", "invested value"],
      optionalTokens: ["amc", "category", "current value", "isin"]
    },
    {
      id: "GROWW_STOCKS",
      label: "Groww (Stocks)",
      custodian: "Groww",
      defaultAssetClass: "Equities",
      requiredTokens: ["stock name", "isin", "quantity", "average buy price"],
      optionalTokens: ["buy value", "closing price", "closing value"]
    },
    {
      id: "ICICI_DIRECT",
      label: "ICICI Direct",
      custodian: "ICICI Direct",
      defaultAssetClass: "Equities",
      requiredTokens: ["stock symbol", "isin code", "qty", "book value"],
      optionalTokens: ["company name", "average cost price", "current market value"]
    },
    {
      id: "HDFC_SEC",
      label: "HDFC Securities",
      custodian: "HDFC Securities",
      defaultAssetClass: "Equities",
      requiredTokens: ["company name", "isin code", "avg cost price"],
      optionalTokens: ["symbol", "qty", "cost value", "current market value"]
    },
    {
      id: "SBI_SEC",
      label: "SBI Securities",
      custodian: "SBI Securities",
      defaultAssetClass: "Equities",
      requiredTokens: ["scrip name", "holdings qty", "invested value"],
      optionalTokens: ["scrip code", "isin", "avg buy price", "market value"]
    },
    {
      id: "ANGEL_ONE",
      label: "Angel One",
      custodian: "Angel One",
      defaultAssetClass: "Equities",
      requiredTokens: ["scrip/contract", "isin", "total qty"],
      optionalTokens: ["company name", "avg price", "invested value", "market value"]
    },
    {
      id: "UPSTOX",
      label: "Upstox",
      custodian: "Upstox",
      defaultAssetClass: "Equities",
      requiredTokens: ["instrument", "isin", "net qty", "invested amount"],
      optionalTokens: ["company name", "avg. price", "current value"]
    },
    {
      id: "CAMS_KFINTECH",
      label: "CAMS / KFintech / MFCentral",
      custodian: "MFCentral / CAMS",
      defaultAssetClass: "Mutual Funds",
      requiredTokens: ["scheme name", "folio no", "closing unit balance", "cost value"],
      optionalTokens: ["isin", "investor name", "pan", "nav", "valuation (market value)"]
    },
    {
      id: "KUVERA_MF",
      label: "Kuvera (Mutual Funds)",
      custodian: "Kuvera",
      defaultAssetClass: "Mutual Funds",
      requiredTokens: ["folio number", "name of the fund", "units", "invested amount"],
      optionalTokens: ["isin", "avg. nav", "current nav", "current value"]
    }
  ];

  // ==========================================================================
  // 1. Clean Number & RFC-4180 CSV / HTML-Table / SheetJS Matrix Parser
  // ==========================================================================
  function cleanNumber(val) {
    if (typeof val === "number") return Number.isFinite(val) ? val : 0;
    if (val == null || val === "") return 0;
    const str = String(val).replace(/[₹$,%\s]/g, "").trim();
    if (!str || str === "-" || str.toLowerCase() === "na" || str.toLowerCase() === "n/a") return 0;
    const n = Number(str);
    return Number.isFinite(n) ? n : 0;
  }

  function parseCSVToMatrix(text) {
    const rows = [];
    let row = [];
    let cur = "";
    let inQuotes = false;
    const cleanText = String(text || "").replace(/^\uFEFF/, "");

    for (let i = 0; i < cleanText.length; i++) {
      const ch = cleanText[i];
      const next = cleanText[i + 1];

      if (inQuotes) {
        if (ch === '"' && next === '"') {
          cur += '"';
          i++;
        } else if (ch === '"') {
          inQuotes = false;
        } else {
          cur += ch;
        }
      } else {
        if (ch === '"') {
          inQuotes = true;
        } else if (ch === ",") {
          row.push(cur.trim());
          cur = "";
        } else if (ch === "\r" && next === "\n") {
          row.push(cur.trim());
          rows.push(row);
          row = [];
          cur = "";
          i++;
        } else if (ch === "\n" || ch === "\r") {
          row.push(cur.trim());
          rows.push(row);
          row = [];
          cur = "";
        } else {
          cur += ch;
        }
      }
    }
    if (cur.length > 0 || row.length > 0) {
      row.push(cur.trim());
      rows.push(row);
    }
    return rows;
  }

  function parseHTMLTableToMatrix(htmlText) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlText, "text/html");
    const trs = doc.querySelectorAll("tr");
    const matrix = [];
    trs.forEach((tr) => {
      const cells = [];
      tr.querySelectorAll("th, td").forEach((cell) => {
        cells.push((cell.textContent || "").trim());
      });
      if (cells.length > 0) matrix.push(cells);
    });
    return matrix;
  }

  let sheetJsLoading = null;
  function ensureSheetJS() {
    if (window.XLSX) return Promise.resolve(window.XLSX);
    if (sheetJsLoading) return sheetJsLoading;
    sheetJsLoading = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://cdn.sheetjs.com/xlsx-0.20.2/package/dist/xlsx.full.min.js";
      script.onload = () => resolve(window.XLSX);
      script.onerror = () => reject(new Error("Could not load XLSX parser. Please save the file as .csv and try again."));
      document.head.appendChild(script);
    });
    return sheetJsLoading;
  }

  async function fileToMatrices(file) {
    const ext = (file.name.split(".").pop() || "").toLowerCase();
    if (ext === "xlsx" || ext === "xls") {
      const buf = await file.arrayBuffer();
      const firstBytes = new TextDecoder("utf-8").decode(buf.slice(0, 512)).trim();
      // Legacy bank brokers (HDFC Sec / ICICI / SBI) often export HTML tables saved with an .xls extension
      if (firstBytes.startsWith("<html") || firstBytes.startsWith("<!DOCTYPE") || firstBytes.includes("<table")) {
        const fullText = new TextDecoder("utf-8").decode(buf);
        return [{ sheetName: "Sheet1", matrix: parseHTMLTableToMatrix(fullText) }];
      }
      const XLSX = await ensureSheetJS();
      const wb = XLSX.read(buf, { type: "array" });
      return wb.SheetNames.map((name) => ({
        sheetName: name,
        matrix: XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: "" })
      }));
    }
    const text = await file.text();
    if (text.trim().startsWith("<html") || text.includes("<table")) {
      return [{ sheetName: "Sheet1", matrix: parseHTMLTableToMatrix(text) }];
    }
    return [{ sheetName: "Sheet1", matrix: parseCSVToMatrix(text) }];
  }

  // ==========================================================================
  // 2. Signature-Driven Header Sniffer & Broker Fingerprinter
  // ==========================================================================
  function detectHeaderAndBroker(matrix) {
    const maxScan = Math.min(matrix.length, 35);
    let bestMatch = null;

    for (let r = 0; r < maxScan; r++) {
      const row = (matrix[r] || []).map((c) => String(c || "").trim().toLowerCase());
      if (row.filter(Boolean).length < 3) continue;

      for (const profile of BROKER_PROFILES) {
        const reqHits = profile.requiredTokens.filter((tok) =>
          row.some((cell) => cell === tok || cell.includes(tok))
        );
        if (reqHits.length === profile.requiredTokens.length) {
          const optHits = profile.optionalTokens.filter((tok) =>
            row.some((cell) => cell === tok || cell.includes(tok))
          );
          const score = reqHits.length * 10 + optHits.length;
          if (!bestMatch || score > bestMatch.score) {
            bestMatch = { headerRowIndex: r, headers: row, profile, score };
          }
        }
      }
    }

    // Generic fallback if a broker changes a minor column label
    if (!bestMatch) {
      const genericTokens = ["isin", "symbol", "instrument", "scrip", "scheme", "qty", "quantity", "units", "invested", "value"];
      for (let r = 0; r < maxScan; r++) {
        const row = (matrix[r] || []).map((c) => String(c || "").trim().toLowerCase());
        const hits = genericTokens.filter((t) => row.some((cell) => cell.includes(t)));
        if (hits.length >= 3) {
          bestMatch = {
            headerRowIndex: r,
            headers: row,
            profile: {
              id: "GENERIC_PORTFOLIO",
              label: "Generic Portfolio CSV",
              custodian: "Demat / Broker",
              defaultAssetClass: row.some((c) => c.includes("folio") || c.includes("scheme")) ? "Mutual Funds" : "Equities"
            },
            score: hits.length
          };
          break;
        }
      }
    }

    return bestMatch;
  }

  // ==========================================================================
  // 3. O(1) Market Resolution (ISIN -> Symbol/Code -> Fuzzy Name Fallback)
  // ==========================================================================
  function resolveMarketInstrument({ isin, symbol, rawName, defaultAssetClass }) {
    const engine = window.KYF_PORTFOLIO_ENGINE;
    if (engine && typeof engine.ensureIndexed === "function") {
      engine.ensureIndexed();
    }

    const cleanIsin = (isin || "").trim().toUpperCase();
    const cleanSym = (symbol || "").replace(/-(EQ|BE|GB|BZ)$/i, "").trim().toUpperCase();

    // 1. Sovereign Gold Bond Detection via ISIN prefix (IN0020...) or Symbol prefix (SGB...)
    if (cleanIsin.startsWith("IN00") || /^SGB/i.test(cleanSym) || /sovereign gold bond/i.test(rawName || "")) {
      return {
        assetClass: "Commodities & Gold",
        subCategory: "Sovereign Gold Bond (SGB)",
        pricingMode: "LIVE_GOLD",
        name: rawName || cleanSym || "Sovereign Gold Bond",
        instrumentMeta: { purity: "24K", isin: cleanIsin || null, symbol: cleanSym || null }
      };
    }

    // 2. O(1) Exact ISIN Lookup against KYF_MARKET_EQUITIES and KYF_MARKET_MF
    if (cleanIsin && engine && typeof engine.lookupByIsin === "function") {
      const hit = engine.lookupByIsin(cleanIsin);
      if (hit && hit.kind === "EQUITY") {
        const st = hit.stock;
        const isGoldEtf = st.symbol === "GOLDBEES" || /GOLD/i.test(st.companyName);
        return {
          assetClass: isGoldEtf ? "Commodities & Gold" : "Equities",
          subCategory: isGoldEtf ? "Gold ETF" : (st.isN500 ? "Nifty 500 Equities" : "NSE Equities"),
          pricingMode: isGoldEtf ? "LIVE_GOLD" : "LIVE_EQUITY",
          name: st.companyName || rawName || st.symbol,
          livePrice: st.closePrice,
          instrumentMeta: { symbol: st.symbol, isin: cleanIsin }
        };
      }
      if (hit && hit.kind === "MF") {
        const sc = hit.scheme;
        const planType = hit.planType || (/regular/i.test(rawName || "") ? "REGULAR" : "DIRECT");
        return {
          assetClass: "Mutual Funds",
          subCategory: sc.category || "Mutual Funds",
          pricingMode: "LIVE_MF",
          name: sc.fundName || rawName,
          livePrice: planType === "REGULAR" ? (sc.regularNav || sc.directNav) : (sc.directNav || sc.regularNav),
          instrumentMeta: { amfiCode: sc.directCode, planType, isin: cleanIsin }
        };
      }
    }

    // 3. Exact NSE Symbol Lookup (e.g. Zerodha Kite CSV which has no ISIN column)
    if (cleanSym && engine && typeof engine.lookupEquityBySymbol === "function") {
      const st = engine.lookupEquityBySymbol(cleanSym);
      if (st) {
        const isGoldEtf = st.symbol === "GOLDBEES" || /GOLD/i.test(st.companyName);
        return {
          assetClass: isGoldEtf ? "Commodities & Gold" : "Equities",
          subCategory: isGoldEtf ? "Gold ETF" : (st.isN500 ? "Nifty 500 Equities" : "NSE Equities"),
          pricingMode: isGoldEtf ? "LIVE_GOLD" : "LIVE_EQUITY",
          name: st.companyName || rawName || st.symbol,
          livePrice: st.closePrice,
          instrumentMeta: { symbol: st.symbol, isin: st.isin || cleanIsin || null }
        };
      }
    }

    // 4. Fuzzy Scheme / Company Name Fallback (when ISIN is missing in older Groww MF exports)
    const isMf = cleanIsin.startsWith("INF") || defaultAssetClass === "Mutual Funds";
    if (isMf && rawName && window.KYF_MARKET_MF && Array.isArray(window.KYF_MARKET_MF.schemes)) {
      const normTarget = rawName.toLowerCase().replace(/(direct|regular|plan|growth|option|fund)/g, "").replace(/[^a-z0-9]/g, "");
      for (const row of window.KYF_MARKET_MF.schemes) {
        const scName = String(row[1] || "");
        const normSc = scName.toLowerCase().replace(/(fund)/g, "").replace(/[^a-z0-9]/g, "");
        if (normSc && (normTarget.includes(normSc) || normSc.includes(normTarget))) {
          const planType = /regular/i.test(rawName) ? "REGULAR" : "DIRECT";
          const nav = planType === "REGULAR" ? (Number(row[4]) || Number(row[3])) : (Number(row[3]) || Number(row[4]));
          return {
            assetClass: "Mutual Funds",
            subCategory: row[2] || "Mutual Funds",
            pricingMode: "LIVE_MF",
            name: scName,
            livePrice: nav,
            instrumentMeta: { amfiCode: Number(row[0]), planType, isin: cleanIsin || row[9] || null }
          };
        }
      }
    }

    // 5. Fallback Manual Valuation (unlisted / SME / bond / unknown)
    return {
      assetClass: isMf ? "Mutual Funds" : (defaultAssetClass || "Equities"),
      subCategory: isMf ? "Mutual Funds" : "Listed Equities",
      pricingMode: "MANUAL",
      name: rawName || cleanSym || cleanIsin || "Imported Holding",
      livePrice: null,
      instrumentMeta: {
        symbol: cleanSym || null,
        isin: cleanIsin || null
      }
    };
  }

  // ==========================================================================
  // 4. Row Extractor & Normalizer
  // ==========================================================================
  function extractHoldingsFromMatrix(matrix, defaultMember = "Self") {
    const detection = detectHeaderAndBroker(matrix);
    if (!detection) return [];

    const { headerRowIndex, headers, profile } = detection;

    const findCol = (candidates) => {
      for (const cand of candidates) {
        const idx = headers.findIndex((h) => h === cand || h.includes(cand));
        if (idx !== -1) return idx;
      }
      return -1;
    };

    const iIsin = findCol(["isin code", "isin"]);
    const iSym = findCol(["instrument", "symbol", "stock symbol", "scrip/contract", "scrip code", "scheme code"]);
    const iName = findCol(["company name", "stock name", "scrip name", "scheme name", "fund name", "name of the fund", "instrument"]);
    const iFolio = findCol(["folio number", "folio no.", "folio no"]);
    const iQty = findCol(["quantity available", "holdings qty", "net qty", "total qty", "closing unit balance", "qty.", "qty", "quantity", "units"]);
    const iAvgPrice = findCol(["average buy price", "avg. cost", "average cost price", "avg cost price", "avg buy price", "average price", "avg. price", "avg price", "avg. nav"]);
    const iInvested = findCol(["invested amount", "invested value", "buy value", "book value", "cost value"]);
    const iLtp = findCol(["closing price", "current market price", "previous closing price", "market price", "current nav", "ltp", "nav"]);
    const iCurVal = findCol(["current market value", "valuation (market value)", "closing value", "market value", "cur. val", "current value"]);
    const iInvestor = findCol(["investor name"]);

    const parsedHoldings = [];

    for (let r = headerRowIndex + 1; r < matrix.length; r++) {
      const row = matrix[r];
      if (!row || row.length === 0) continue;

      const firstCell = String(row[0] || "").trim();
      if (!firstCell || /^(total|grand total|disclaimer|note|summary)/i.test(firstCell)) continue;

      const qty = iQty !== -1 ? cleanNumber(row[iQty]) : 0;
      if (qty <= 0) continue;

      const rawIsin = iIsin !== -1 ? String(row[iIsin] || "").trim().toUpperCase() : "";
      const isin = ISIN_REGEX.test(rawIsin) ? rawIsin : "";
      const rawSym = iSym !== -1 ? String(row[iSym] || "").trim() : "";
      const rawName = iName !== -1 ? String(row[iName] || "").trim() : rawSym;
      const folio = iFolio !== -1 ? String(row[iFolio] || "").trim() : "";

      if (!isin && !rawSym && !rawName) continue;

      let avgPrice = iAvgPrice !== -1 ? cleanNumber(row[iAvgPrice]) : 0;
      let investedValue = iInvested !== -1 ? cleanNumber(row[iInvested]) : 0;
      const fileLtp = iLtp !== -1 ? cleanNumber(row[iLtp]) : 0;
      let fileCurVal = iCurVal !== -1 ? cleanNumber(row[iCurVal]) : 0;

      if (investedValue <= 0 && avgPrice > 0) {
        investedValue = Math.round(qty * avgPrice);
      } else if (avgPrice <= 0 && investedValue > 0 && qty > 0) {
        avgPrice = Number((investedValue / qty).toFixed(2));
      }

      if (fileCurVal <= 0 && fileLtp > 0) {
        fileCurVal = Math.round(qty * fileLtp);
      }

      const resolved = resolveMarketInstrument({
        isin,
        symbol: rawSym,
        rawName,
        defaultAssetClass: profile.defaultAssetClass
      });

      const effectivePrice = resolved.livePrice || fileLtp || avgPrice || 0;
      const currentValue = effectivePrice > 0 ? Math.round(qty * effectivePrice) : Math.round(fileCurVal || investedValue);

      const meta = {
        ...resolved.instrumentMeta,
        isin: resolved.instrumentMeta.isin || isin || null,
        folio: folio || null,
        avgBuyPrice: avgPrice > 0 ? avgPrice : null,
        price: effectivePrice > 0 ? effectivePrice : null
      };

      if (resolved.pricingMode === "LIVE_MF") {
        meta.units = Number(qty.toFixed(4));
      } else if (resolved.pricingMode === "LIVE_GOLD") {
        if (meta.symbol === "GOLDBEES") meta.units = qty;
        else meta.grams = qty;
      } else {
        meta.quantity = qty;
      }

      const rowInvestor = iInvestor !== -1 ? String(row[iInvestor] || "").trim() : "";
      const memberName = defaultMember || (rowInvestor ? rowInvestor.split(" ")[0] : "Self");

      parsedHoldings.push({
        id: `hold_imp_${Date.now()}_${r}`,
        name: resolved.name,
        member: memberName,
        custodian: profile.custodian,
         brokerLabel: profile.label,
        assetClass: resolved.assetClass,
        subCategory: resolved.subCategory,
        pricingMode: resolved.pricingMode,
        units: qty,
        investedValue: investedValue > 0 ? Math.round(investedValue) : null,
        currentValue,
        manualCurrentValue: currentValue,
        allocations: [],
        instrumentMeta: meta,
        notes: folio ? `Folio: ${folio}` : ""
      });
    }

    return parsedHoldings;
  }

  // ==========================================================================
  // 5. Smart Upsert Engine (Deduplicates by Member + Custodian + ISIN/Symbol/Folio)
  // Preserves existing Goal Allocations (`allocations`) when updating quantities!
  // ==========================================================================
  function normalizeCustodian(c) {
    const s = (c || "").toLowerCase().trim();
    if (s.includes("zerodha")) return "zerodha";
    if (s.includes("groww")) return "groww";
    if (s.includes("icici")) return "icici";
    if (s.includes("hdfc")) return "hdfc";
    if (s.includes("sbi")) return "sbi";
    if (s.includes("angel")) return "angel";
    if (s.includes("upstox")) return "upstox";
    if (s.includes("kuvera")) return "kuvera";
    if (s.includes("cams") || s.includes("kfintech") || s.includes("mfcentral")) return "mfcentral";
    return s;
  }

  function upsertHoldings(existingHoldings, incomingHoldings) {
    const updated = [...(existingHoldings || [])];
    let addedCount = 0;
    let updatedCount = 0;

    const findExistingIndex = (inc) => {
      const incMember = (inc.member || "Self").toLowerCase().trim();
      const incCust = normalizeCustodian(inc.custodian);
      const incMeta = inc.instrumentMeta || {};
      const incIsin = (incMeta.isin || "").toUpperCase().trim();
      const incSym = (incMeta.symbol || "").toUpperCase().trim();
      const incCode = incMeta.amfiCode ? String(incMeta.amfiCode).trim() : "";
      const incFolio = (incMeta.folio || "").toLowerCase().trim();
      const incName = (inc.name || "").toLowerCase().trim();

      for (let i = 0; i < updated.length; i++) {
        const prev = updated[i];
        const prevMember = (prev.member || "Self").toLowerCase().trim();
        if (prevMember !== incMember) continue;

        const prevCust = normalizeCustodian(prev.custodian);
        const custMatches = !prevCust || !incCust || prevCust === incCust;
        if (!custMatches) continue;

        const prevMeta = prev.instrumentMeta || {};
        const prevIsin = (prevMeta.isin || "").toUpperCase().trim();
        const prevSym = (prevMeta.symbol || "").toUpperCase().trim();
        const prevCode = prevMeta.amfiCode ? String(prevMeta.amfiCode).trim() : "";
        const prevFolio = (prevMeta.folio || "").toLowerCase().trim();
        const prevName = (prev.name || "").toLowerCase().trim();

        // If folios exist on both and don't match, they are different folios
        if (incFolio && prevFolio && incFolio !== prevFolio) continue;

        // 1. ISIN match (highest fidelity)
        if (incIsin && prevIsin && incIsin === prevIsin) return i;

        // 2. AMFI code match
        if (incCode && prevCode && incCode === prevCode) return i;

        // 3. Stock Symbol match
        if (incSym && prevSym && incSym === prevSym) return i;

        // 4. Name match (if same folio or both lack folio)
        if (incName && prevName && incName === prevName) return i;
      }
      return -1;
    };

    for (const inc of incomingHoldings) {
      const idx = findExistingIndex(inc);
      if (idx !== -1) {
        const prev = updated[idx];
        updated[idx] = {
          ...prev,
          name: inc.name || prev.name,
          assetClass: inc.assetClass || prev.assetClass,
          subCategory: inc.subCategory || prev.subCategory,
          pricingMode: inc.pricingMode || prev.pricingMode,
          units: inc.units,
          investedValue: inc.investedValue != null ? inc.investedValue : prev.investedValue,
          currentValue: inc.currentValue,
          manualCurrentValue: inc.manualCurrentValue,
          // Preserve user's existing mental-accounting goal envelopes!
          allocations: Array.isArray(prev.allocations) && prev.allocations.length > 0 ? prev.allocations : [],
          instrumentMeta: {
            ...(prev.instrumentMeta || {}),
            ...(inc.instrumentMeta || {})
          }
        };
        updatedCount++;
      } else {
        updated.push(inc);
        addedCount++;
      }
    }

    return { holdings: updated, addedCount, updatedCount };
  }

  async function parseFiles(fileList, defaultMember = "Self") {
    const allHoldings = [];
    const brokersDetected = new Set();
    const membersDetected = new Set();

    for (const file of Array.from(fileList || [])) {
      const sheets = await fileToMatrices(file);
      for (const { matrix } of sheets) {
        const extracted = extractHoldingsFromMatrix(matrix, defaultMember);
        extracted.forEach((h) => {
          if (h.brokerLabel) brokersDetected.add(h.brokerLabel);
          if (h.member) membersDetected.add(h.member);
          allHoldings.push(h);
        });
      }
    }

    const brokerList = Array.from(brokersDetected);
    return {
      holdings: allHoldings,
      brokers: brokerList,
      broker: brokerList[0] || "Unknown Broker",
      detectedMembers: Array.from(membersDetected)
    };
  }

  async function parseFile(file, defaultMember = "Self") {
    return parseFiles([file], defaultMember);
  }

  const api = {
    parseFile,
    parseFiles,
    upsertHoldings,
    parseCSVToMatrix,
    parseHTMLTableToMatrix,
    detectHeaderAndBroker,
    resolveMarketInstrument,
    extractHoldingsFromMatrix
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }

  return api;
})();
