/**
 * KYF Family Portfolio Tracker — Lean Broker & Mutual Fund CSV/XLSX Importer (`js/portfolio-importer.js`)
 * Version: v1.9.3
 * Pure Vanilla ES6+ | Zero-Server, Client-Side Only | O(1) ISIN Lookup via KYF_PORTFOLIO_ENGINE
 * Supports: Zerodha (Kite, Console, Coin), Groww (Stocks, MF), HDFC Sec, SBI Sec, ICICI Direct,
 * Angel One, Upstox, Kotak Sec, Kuvera, and CAMS / KFintech / MFCentral Consolidated Statements.
 */

window.KYF_BROKER_IMPORTER = (() => {
  const ISIN_REGEX = /^IN[EF0][0-9A-Z]{9}$/i;

  // Synonyms and column candidates across Indian brokers & CAS statements
  const COL_CANDIDATES = {
    ISIN: ["isin code", "isin no.", "isin no", "security isin", "isin"],
    SYMBOL: ["symbol", "stock symbol", "instrument", "scrip/contract", "scrip code", "scrip", "ticker", "scheme code"],
    NAME: [
      "scheme name", "fund name", "company name", "stock name", "scrip name",
      "name of the fund", "scheme", "fund", "instrument name", "security name",
      "company", "description", "instrument"
    ],
    FOLIO: ["folio number", "folio no.", "folio no", "folio #", "folio id", "folio"],
    QTY: [
      "quantity available", "closing unit balance", "balance units", "closing units",
      "units available", "holdings qty", "net qty", "total qty", "available qty",
      "qty.", "qty", "quantity", "units", "closing balance", "balance"
    ],
    AVG_PRICE: [
      "average buy price", "average cost price", "avg cost price", "avg buy price",
      "avg. cost", "average cost", "average price", "avg. price", "avg price",
      "avg. nav", "buy price", "purchase nav", "cost nav"
    ],
    INVESTED: [
      "invested amount", "invested value", "total cost", "cost value", "buy value",
      "book value", "investment value", "total investment", "purchase cost",
      "invested", "investment", "cost"
    ],
    LTP: [
      "closing price", "current market price", "previous closing price", "market price",
      "current nav", "latest nav", "nav", "ltp", "cmp", "price"
    ],
    CURVAL: [
      "valuation (market value)", "current market value", "current value", "market value",
      "closing value", "present value", "cur. val", "cur val", "valuation", "value"
    ],
    INVESTOR: ["investor name", "holder name", "client name", "investor", "folio holder"]
  };

  const EXCLUSIONS = {
    INVESTED: ["current", "market", "present", "closing", "nav", "valuation", "ltp"],
    LTP: ["average", "avg", "cost", "buy", "purchase", "invested"],
    CURVAL: ["invested", "cost", "buy", "book", "purchase"]
  };

  const BROKER_PROFILES = [
    {
      id: "ZERODHA_COIN",
      label: "Zerodha Coin (MF)",
      custodian: "Zerodha Coin",
      defaultAssetClass: "Mutual Funds",
      matchTokens: ["fund name", "folio number", "quantity available"]
    },
    {
      id: "ZERODHA_CONSOLE",
      label: "Zerodha Console",
      custodian: "Zerodha",
      defaultAssetClass: "Equities",
      matchTokens: ["symbol", "isin", "quantity available", "average price"]
    },
    {
      id: "ZERODHA_KITE",
      label: "Zerodha Kite",
      custodian: "Zerodha",
      defaultAssetClass: "Equities",
      matchTokens: ["instrument", "qty.", "avg. cost", "ltp"]
    },
    {
      id: "GROWW_MF",
      label: "Groww (Mutual Funds)",
      custodian: "Groww",
      defaultAssetClass: "Mutual Funds",
      matchTokens: ["scheme name", "folio", "units", "invested"]
    },
    {
      id: "GROWW_STOCKS",
      label: "Groww (Stocks)",
      custodian: "Groww",
      defaultAssetClass: "Equities",
      matchTokens: ["stock name", "isin", "quantity", "average buy price"]
    },
    {
      id: "ICICI_DIRECT",
      label: "ICICI Direct",
      custodian: "ICICI Direct",
      defaultAssetClass: "Equities",
      matchTokens: ["stock symbol", "isin", "qty", "book value"]
    },
    {
      id: "HDFC_SEC",
      label: "HDFC Securities",
      custodian: "HDFC Securities",
      defaultAssetClass: "Equities",
      matchTokens: ["company name", "isin", "avg cost"]
    },
    {
      id: "SBI_SEC",
      label: "SBI Securities",
      custodian: "SBI Securities",
      defaultAssetClass: "Equities",
      matchTokens: ["scrip name", "holdings qty", "invested value"]
    },
    {
      id: "ANGEL_ONE",
      label: "Angel One",
      custodian: "Angel One",
      defaultAssetClass: "Equities",
      matchTokens: ["scrip", "isin", "total qty"]
    },
    {
      id: "UPSTOX",
      label: "Upstox",
      custodian: "Upstox",
      defaultAssetClass: "Equities",
      matchTokens: ["instrument", "isin", "net qty"]
    },
    {
      id: "CAMS_KFINTECH",
      label: "CAMS / KFintech / MFCentral",
      custodian: "MFCentral / CAMS",
      defaultAssetClass: "Mutual Funds",
      matchTokens: ["scheme", "folio", "closing"]
    },
    {
      id: "KUVERA_MF",
      label: "Kuvera (Mutual Funds)",
      custodian: "Kuvera",
      defaultAssetClass: "Mutual Funds",
      matchTokens: ["folio", "fund", "units"]
    }
  ];

  // ==========================================================================
  // 1. Clean Number & Delimiter-Sniffing RFC-4180 Matrix Parser
  // ==========================================================================
  function cleanNumber(val) {
    if (typeof val === "number") return Number.isFinite(val) ? val : 0;
    if (val == null || val === "") return 0;
    const str = String(val).replace(/[₹$,%\s]/g, "").trim();
    if (!str || str === "-" || str.toLowerCase() === "na" || str.toLowerCase() === "n/a") return 0;
    // Handle (123.45) accounting negative numbers
    if (str.startsWith("(") && str.endsWith(")")) {
      const n = Number(str.slice(1, -1));
      return Number.isFinite(n) ? -n : 0;
    }
    const n = Number(str);
    return Number.isFinite(n) ? n : 0;
  }

  function detectDelimiter(text) {
    const lines = text.split(/\r\n|\n|\r/).filter((l) => l.trim().length > 0).slice(0, 15);
    if (lines.length === 0) return ",";

    const candidates = [",", "\t", ";", "|"];
    let bestDelim = ",";
    let maxScore = -1;

    for (const delim of candidates) {
      let countTotal = 0;
      let consistent = true;
      let prevCount = -1;

      for (const line of lines) {
        let cnt = 0;
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
          const ch = line[i];
          if (ch === '"') inQuotes = !inQuotes;
          else if (ch === delim && !inQuotes) cnt++;
        }
        if (prevCount === -1) prevCount = cnt;
        else if (cnt !== prevCount && cnt > 0) consistent = false;
        countTotal += cnt;
      }

      const score = (countTotal / lines.length) * (consistent ? 2 : 1);
      if (score > maxScore && countTotal > 0) {
        maxScore = score;
        bestDelim = delim;
      }
    }

    return bestDelim;
  }

  function parseCSVToMatrix(text, explicitDelim = null) {
    const cleanText = String(text || "").replace(/^\uFEFF/, "");
    const delim = explicitDelim || detectDelimiter(cleanText);

    const rows = [];
    let row = [];
    let cur = "";
    let inQuotes = false;

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
        } else if (ch === delim) {
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
    if (typeof DOMParser === "undefined") return [];
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

  let sheetJsPromise = null;
  function ensureSheetJS() {
    if (typeof window !== "undefined" && window.XLSX) return Promise.resolve(window.XLSX);
    if (sheetJsPromise) return sheetJsPromise;

    const CDN_URLS = [
      "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js",
      "https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js",
      "https://unpkg.com/xlsx@0.18.5/dist/xlsx.full.min.js",
      "https://cdn.sheetjs.com/xlsx-0.20.2/package/dist/xlsx.full.min.js"
    ];

    function tryLoadCdn(index) {
      if (index >= CDN_URLS.length) {
        return Promise.reject(new Error("Unable to load Excel parser (offline mode or CDN blocked). Please export or save your statement as a CSV file and drop it here."));
      }
      return new Promise((resolve, reject) => {
        if (typeof document === "undefined" || !document.head) {
          return reject(new Error("DOM environment required to load XLSX script."));
        }
        const url = CDN_URLS[index];
        const script = document.createElement("script");
        script.src = url;
        script.async = true;

        let timer = setTimeout(() => {
          script.onerror = null;
          script.onload = null;
          if (script.parentNode) script.parentNode.removeChild(script);
          tryLoadCdn(index + 1).then(resolve, reject);
        }, 4000);

        script.onload = () => {
          clearTimeout(timer);
          if (window.XLSX) resolve(window.XLSX);
          else tryLoadCdn(index + 1).then(resolve, reject);
        };
        script.onerror = () => {
          clearTimeout(timer);
          if (script.parentNode) script.parentNode.removeChild(script);
          tryLoadCdn(index + 1).then(resolve, reject);
        };
        document.head.appendChild(script);
      });
    }

    sheetJsPromise = tryLoadCdn(0);
    return sheetJsPromise;
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
  // 2. Column Finder with Synonym Sets & Exclusions
  // ==========================================================================
  function findColumnIndex(headers, candidateTokens, excludeTokens = []) {
    if (!Array.isArray(headers) || !candidateTokens) return -1;
    const cleanHeaders = headers.map((h) => String(h || "").trim().toLowerCase());

    // 1. Exact match pass
    for (const cand of candidateTokens) {
      const cLower = cand.toLowerCase();
      const idx = cleanHeaders.findIndex((h) => {
        if (!h) return false;
        if (excludeTokens.some((ex) => h.includes(ex.toLowerCase()))) return false;
        return h === cLower;
      });
      if (idx !== -1) return idx;
    }

    // 2. Substring match pass (candidate in header, or header in candidate if >= 3 chars)
    for (const cand of candidateTokens) {
      const cLower = cand.toLowerCase();
      const idx = cleanHeaders.findIndex((h) => {
        if (!h) return false;
        if (excludeTokens.some((ex) => h.includes(ex.toLowerCase()))) return false;
        return h.includes(cLower) || (h.length >= 3 && cLower.includes(h));
      });
      if (idx !== -1) return idx;
    }

    return -1;
  }

  // ==========================================================================
  // 3. Signature-Driven Header Sniffer & Broker Fingerprinter
  // ==========================================================================
  function detectHeaderAndBroker(matrix) {
    if (!Array.isArray(matrix) || matrix.length === 0) return null;
    const maxScan = Math.min(matrix.length, 40);

    for (let r = 0; r < maxScan; r++) {
      const rawRow = matrix[r] || [];
      const row = rawRow.map((c) => String(c || "").trim().toLowerCase());
      if (row.filter(Boolean).length < 2) continue;

      // Check if this row contains key column identifiers
      const iName = findColumnIndex(row, COL_CANDIDATES.NAME);
      const iSym = findColumnIndex(row, COL_CANDIDATES.SYMBOL);
      const iIsin = findColumnIndex(row, COL_CANDIDATES.ISIN);
      const iFolio = findColumnIndex(row, COL_CANDIDATES.FOLIO);
      const iQty = findColumnIndex(row, COL_CANDIDATES.QTY);

      const hasInstrument = iName !== -1 || iSym !== -1 || iIsin !== -1 || iFolio !== -1;
      const hasQty = iQty !== -1;

      if (hasInstrument && hasQty) {
        // We found the header row! Now identify the broker profile
        let matchedProfile = null;
        for (const profile of BROKER_PROFILES) {
          const hits = profile.matchTokens.filter((tok) =>
            row.some((cell) => cell.includes(tok))
          );
          if (hits.length === profile.matchTokens.length) {
            matchedProfile = profile;
            break;
          }
        }

        // If no specific profile matched, determine generic profile
        if (!matchedProfile) {
          const isMf = iFolio !== -1 || row.some((c) => c.includes("scheme") || c.includes("fund") || c.includes("amfi"));
          matchedProfile = {
            id: isMf ? "GENERIC_MF" : "GENERIC_EQUITY",
            label: isMf ? "Mutual Fund Statement" : "Equity Demat Statement",
            custodian: isMf ? "Mutual Fund" : "Demat / Broker",
            defaultAssetClass: isMf ? "Mutual Funds" : "Equities"
          };
        }

        return {
          headerRowIndex: r,
          headers: row,
          profile: matchedProfile
        };
      }
    }

    return null;
  }

  // ==========================================================================
  // 4. Scheme Normalizer & O(1) Instrument Resolution
  // ==========================================================================
  function normalizeSchemeName(str) {
    if (!str) return "";
    return str
      .toLowerCase()
      .replace(/\b(direct|regular|dir|reg|plan|option|opt|growth|gr|idcw|dividend|payout|reinvestment|fund|scheme|mf)\b/gi, "")
      .replace(/[^a-z0-9]/g, "")
      .trim();
  }

  function determineMfPlanType(rawName, isin = null, fileLtp = null, scheme = null) {
    const cleanIsin = (isin || "").trim().toUpperCase();

    // 1. O(1) ISIN lookup against AMFI database (highest fidelity)
    if (cleanIsin && typeof window !== "undefined" && window.KYF_PORTFOLIO_ENGINE) {
      const hit = window.KYF_PORTFOLIO_ENGINE.lookupByIsin(cleanIsin);
      if (hit && hit.kind === "MF" && hit.planType) {
        return hit.planType;
      }
    }

    const nameStr = String(rawName || "").trim();

    // 2. Strict keyword detection on statement scheme name
    // In the Indian mutual fund industry, Direct plans MUST explicitly state "Direct" or "Dir"
    const hasDirect = /\b(direct|dir|dp)\b/i.test(nameStr);
    const hasRegular = /\b(regular|reg|rp)\b/i.test(nameStr);

    if (hasDirect && !hasRegular) return "DIRECT";
    if (hasRegular && !hasDirect) return "REGULAR";

    // 3. Live NAV Proximity Cross-Check (if statement provides NAV / LTP and scheme is matched)
    if (scheme && fileLtp > 0) {
      const directNav = Number(scheme[3] || scheme.directNav) || 0;
      const regularNav = Number(scheme[4] || scheme.regularNav) || 0;
      if (directNav > 0 && regularNav > 0 && Math.abs(directNav - regularNav) > 0.05) {
        const diffDirect = Math.abs(fileLtp - directNav) / directNav;
        const diffRegular = Math.abs(fileLtp - regularNav) / regularNav;
        if (diffRegular < 0.05 && diffRegular < diffDirect * 0.6) {
          return "REGULAR";
        }
        if (diffDirect < 0.05 && diffDirect < diffRegular * 0.6) {
          return "DIRECT";
        }
      }
    }

    // 4. Fundamental SEBI / Indian Mutual Fund Market Rule:
    // Every plan is REGULAR unless it explicitly carries the "Direct" designation!
    return hasDirect ? "DIRECT" : "REGULAR";
  }

  function resolveMarketInstrument({ isin, symbol, rawName, defaultAssetClass, fileLtp = 0 }) {
    const engine = typeof window !== "undefined" ? window.KYF_PORTFOLIO_ENGINE : null;
    if (engine && typeof engine.ensureIndexed === "function") {
      engine.ensureIndexed();
    }

    const cleanIsin = (isin || "").trim().toUpperCase();
    const cleanSym = (symbol || "").replace(/-(EQ|BE|GB|BZ)$/i, "").trim().toUpperCase();
    const isMf = cleanIsin.startsWith("INF") ||
                 defaultAssetClass === "Mutual Funds" ||
                 /\b(fund|scheme|growth|direct|regular|elss|index|arbitrage|hybrid|bluechip|cap)\b/i.test(rawName || "");

    // 1. Sovereign Gold Bond Detection via ISIN prefix (IN0020...) or Symbol prefix (SGB...)
    if (cleanIsin.startsWith("IN00") || /^SGB/i.test(cleanSym) || /sovereign gold bond/i.test(rawName || "")) {
      return {
        assetClass: "Commodities & Gold",
        subCategory: "Sovereign Gold Bond (SGB)",
        pricingMode: "LIVE_GOLD",
        name: rawName || cleanSym || "Sovereign Gold Bond",
        livePrice: null,
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
        const planType = hit.planType || determineMfPlanType(rawName, cleanIsin, fileLtp, sc);
        const isReg = planType === "REGULAR";
        return {
          assetClass: "Mutual Funds",
          subCategory: sc.category || "Mutual Funds",
          pricingMode: "LIVE_MF",
          name: sc.fundName || rawName,
          livePrice: isReg ? (sc.regularNav || sc.directNav) : (sc.directNav || sc.regularNav),
          instrumentMeta: { amfiCode: sc.directCode, planType, isin: cleanIsin }
        };
      }
    }

    // 3. Exact NSE Symbol Lookup (e.g. Zerodha Kite CSV without ISIN column)
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

    // 4. Mutual Fund Scheme Name Match (against KYF_MARKET_MF)
    if (isMf && rawName && typeof window !== "undefined" && window.KYF_MARKET_MF && Array.isArray(window.KYF_MARKET_MF.schemes)) {
      const targetNorm = normalizeSchemeName(rawName);
      if (targetNorm) {
        let bestScheme = null;
        let bestLen = 0;

        for (const row of window.KYF_MARKET_MF.schemes) {
          const scName = String(row[1] || "");
          const scNorm = normalizeSchemeName(scName);
          if (!scNorm) continue;

          if (scNorm === targetNorm) {
            bestScheme = row;
            break;
          }
          if (targetNorm.includes(scNorm) && scNorm.length > bestLen) {
            bestScheme = row;
            bestLen = scNorm.length;
          } else if (scNorm.includes(targetNorm) && targetNorm.length > bestLen) {
            bestScheme = row;
            bestLen = targetNorm.length;
          }
        }

        if (bestScheme) {
          const planType = determineMfPlanType(rawName, cleanIsin, fileLtp, bestScheme);
          const isReg = planType === "REGULAR";
          const directNav = Number(bestScheme[3]) || 0;
          const regularNav = Number(bestScheme[4]) || directNav;
          const nav = isReg ? (regularNav || directNav) : (directNav || regularNav);
          const directIsin = bestScheme[9] || null;
          const regularIsin = bestScheme[10] || null;

          return {
            assetClass: "Mutual Funds",
            subCategory: bestScheme[2] || "Mutual Funds",
            pricingMode: "LIVE_MF",
            name: bestScheme[1] || rawName,
            livePrice: nav,
            instrumentMeta: {
              amfiCode: Number(bestScheme[0]),
              planType,
              isin: cleanIsin || (isReg ? regularIsin : directIsin) || null
            }
          };
        }
      }
    }

    // 5. Fallback Resolution
    // If it's a mutual fund not indexed in AMFI, retain LIVE_MF pricing mode with file NAV!
    if (isMf) {
      const planType = determineMfPlanType(rawName, cleanIsin, fileLtp, null);
      return {
        assetClass: "Mutual Funds",
        subCategory: "Mutual Funds",
        pricingMode: "LIVE_MF",
        name: rawName || cleanSym || cleanIsin || "Mutual Fund Holding",
        livePrice: fileLtp || null,
        instrumentMeta: {
          amfiCode: null,
          planType,
          isin: cleanIsin || null,
          symbol: cleanSym || null,
          price: fileLtp || null
        }
      };
    }

    return {
      assetClass: defaultAssetClass || "Equities",
      subCategory: "Listed Equities",
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
  // 5. Row Extractor & Normalizer
  // ==========================================================================
  function extractHoldingsFromMatrix(matrix, defaultMember = "Self") {
    const detection = detectHeaderAndBroker(matrix);
    if (!detection) return [];

    const { headerRowIndex, headers, profile } = detection;

    const iIsin = findColumnIndex(headers, COL_CANDIDATES.ISIN);
    const iSym = findColumnIndex(headers, COL_CANDIDATES.SYMBOL);
    const iName = findColumnIndex(headers, COL_CANDIDATES.NAME);
    const iFolio = findColumnIndex(headers, COL_CANDIDATES.FOLIO);
    const iQty = findColumnIndex(headers, COL_CANDIDATES.QTY);
    const iAvgPrice = findColumnIndex(headers, COL_CANDIDATES.AVG_PRICE, EXCLUSIONS.LTP);
    const iInvested = findColumnIndex(headers, COL_CANDIDATES.INVESTED, EXCLUSIONS.INVESTED);
    const iLtp = findColumnIndex(headers, COL_CANDIDATES.LTP, EXCLUSIONS.LTP);
    const iCurVal = findColumnIndex(headers, COL_CANDIDATES.CURVAL, EXCLUSIONS.CURVAL);

    const parsedHoldings = [];

    for (let r = headerRowIndex + 1; r < matrix.length; r++) {
      const row = matrix[r];
      if (!row || row.length === 0) continue;

      // Skip completely empty rows
      const hasAnyContent = row.some((c) => String(c || "").trim().length > 0);
      if (!hasAnyContent) continue;

      // Skip rows matching summary keywords in any cell
      const isSummaryRow = row.some((c) => /^(total|grand total|disclaimer|sub-total|subtotal|note:)/i.test(String(c || "").trim()));
      if (isSummaryRow) continue;

      const qty = iQty !== -1 ? cleanNumber(row[iQty]) : 0;
      if (qty <= 0) continue;

      const rawIsin = iIsin !== -1 ? String(row[iIsin] || "").trim().toUpperCase() : "";
      const isin = ISIN_REGEX.test(rawIsin) ? rawIsin : "";
      const rawSym = iSym !== -1 ? String(row[iSym] || "").trim() : "";
      const rawName = iName !== -1 ? String(row[iName] || "").trim() : rawSym;
      const folio = iFolio !== -1 ? String(row[iFolio] || "").trim() : "";

      // Must have at least a Name, Symbol, ISIN, or Folio
      if (!isin && !rawSym && !rawName && !folio) continue;

      let avgPrice = iAvgPrice !== -1 ? cleanNumber(row[iAvgPrice]) : 0;
      let investedValue = iInvested !== -1 ? cleanNumber(row[iInvested]) : 0;
      const fileLtp = iLtp !== -1 ? cleanNumber(row[iLtp]) : 0;
      let fileCurVal = iCurVal !== -1 ? cleanNumber(row[iCurVal]) : 0;

      // Infer missing invested value or average price
      if (investedValue <= 0 && avgPrice > 0) {
        investedValue = Math.round(qty * avgPrice);
      } else if (avgPrice <= 0 && investedValue > 0 && qty > 0) {
        avgPrice = Number((investedValue / qty).toFixed(2));
      }

      // Infer missing current value from file LTP
      if (fileCurVal <= 0 && fileLtp > 0) {
        fileCurVal = Math.round(qty * fileLtp);
      }

      const resolved = resolveMarketInstrument({
        isin,
        symbol: rawSym,
        rawName,
        defaultAssetClass: profile.defaultAssetClass,
        fileLtp: fileLtp || avgPrice || 0
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

      const memberName = (defaultMember || "Self").trim();

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
  // 6. Smart Upsert Engine (Deduplicates by Member + Custodian + ISIN/Symbol/Folio)
  // Strictly preserves existing Goal Allocations (`allocations`)!
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
          // Strictly preserve user's existing mental-accounting goal envelopes!
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
    detectDelimiter,
    detectHeaderAndBroker,
    findColumnIndex,
    normalizeSchemeName,
    determineMfPlanType,
    resolveMarketInstrument,
    extractHoldingsFromMatrix
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }

  return api;
})();
