/**
 * KYF Family Portfolio Tracker — Lean Broker & Mutual Fund CSV/XLSX Importer (`js/portfolio-importer.js`)
 * Version: v1.11.2
 * Pure Vanilla ES6+ | Zero-Server, Client-Side Only | O(1) ISIN Lookup via KYF_PORTFOLIO_ENGINE
 * Supports: Zerodha (Kite, Console, Coin), Groww (Stocks, MF), HDFC Sec, SBI Sec, ICICI Direct,
 * Angel One, Upstox, Kotak Sec, Kuvera, and CAMS / KFintech / MFCentral Consolidated Statements.
 */

window.KYF_BROKER_IMPORTER = (() => {
  const ISIN_REGEX = /^IN[EF0][0-9A-Z]{9}$/i;

  function extractUsTicker(name) {
    if (!name) return null;
    const str = String(name).trim();
    const parenMatch = str.match(/\(([A-Za-z0-9.]+)\)/);
    if (parenMatch) return parenMatch[1].toUpperCase();
    if (/^[A-Za-z0-9.]{1,6}$/.test(str)) return str.toUpperCase();
    return null;
  }

  // Synonyms and column candidates across Indian and US brokers & CAS statements
  const COL_CANDIDATES = {
    ISIN: ["isin code", "isin no.", "isin no", "security isin", "isin", "cusip"],
    SYMBOL: [
      "symbol", "stock symbol", "instrument", "scrip/contract", "scrip code", "scrip",
      "ticker", "scheme code", "security symbol", "asset", "code"
    ],
    NAME: [
      "scheme name", "fund name", "company name", "stock name", "scrip name",
      "name of the fund", "scheme", "fund", "instrument name", "security name",
      "company", "description", "security description", "asset name", "instrument"
    ],
    FOLIO: ["folio number", "folio no.", "folio no", "folio #", "folio id", "folio", "account number", "account #"],
    QTY: [
      "quantity available", "closing unit balance", "balance units", "closing units",
      "units available", "holdings qty", "net qty", "total qty", "available qty",
      "qty.", "qty", "quantity", "units", "closing balance", "balance",
      "shares", "total shares", "share quantity", "number of shares", "position quantity", "share balance"
    ],
    AVG_PRICE: [
      "average buy price", "average cost price", "avg cost price", "avg buy price",
      "avg. cost", "average cost", "average price", "avg. price", "avg price",
      "avg. nav", "buy price", "purchase nav", "cost nav",
      "cost basis per share", "cost per share", "average cost per share", "avg cost/share", "average cost / share"
    ],
    INVESTED: [
      "invested amount", "invested value", "total cost", "cost value", "buy value",
      "book value", "investment value", "total investment", "purchase cost",
      "invested", "investment", "cost",
      "cost basis", "total cost basis", "cost basis ($)", "total cost ($)"
    ],
    LTP: [
      "closing price", "current market price", "previous closing price", "market price",
      "current nav", "latest nav", "nav", "ltp", "cmp", "price",
      "last price", "current price", "price ($)", "share price", "market price ($)"
    ],
    CURVAL: [
      "valuation (market value)", "current market value", "current value", "market value",
      "closing value", "present value", "cur. val", "cur val", "valuation", "value",
      "total value", "market value ($)", "current value ($)", "value ($)", "ending value"
    ],
    PLEDGED: ["quantity pledged (margin)", "quantity pledged (loan)", "qty pledged (margin)", "qty pledged (loan)", "pledged qty", "quantity pledged", "pledged quantity"],
    INVESTOR: ["investor name", "holder name", "client name", "investor", "folio holder", "account name"],
    TYPE: [
      "type", "security type", "investment type", "asset class", "asset category",
      "instrument type", "holding type", "class", "asset type"
    ]
  };

  const EXCLUSIONS = {
    INVESTED: ["current", "market", "present", "closing", "nav", "valuation", "ltp", "average", "avg", "price", "p&l", "pnl", "profit", "gain", "unrealized", "unrealised", "return", "xirr"],
    AVG_PRICE: ["closing", "current", "market", "ltp", "value", "p&l", "pnl", "profit", "unrealized", "unrealised", "change", "chg", "day", "return"],
    LTP: ["average", "avg", "cost", "buy", "purchase", "invested"],
    CURVAL: ["invested", "cost", "buy", "book", "purchase"]
  };

  // Import sources: includes both Indian and US brokerage statements.
  const IMPORT_SOURCES = [
    { id: "fidelity", label: "Fidelity Investments (US)", custodian: "Fidelity", defaultAssetClass: "Equities", currency: "USD" },
    { id: "chase", label: "Chase / J.P. Morgan (US)", custodian: "Chase", defaultAssetClass: "Equities", currency: "USD" },
    { id: "vanguard", label: "Vanguard (US)", custodian: "Vanguard", defaultAssetClass: "Equities", currency: "USD" },
    { id: "schwab", label: "Charles Schwab (US)", custodian: "Schwab", defaultAssetClass: "Equities", currency: "USD" },
    { id: "us_broker", label: "Other US Broker (Vested, INDmoney, DriveWealth)", custodian: "US Broker", defaultAssetClass: "Equities", currency: "USD" },
    { id: "zerodha_stocks", label: "Zerodha (Stocks)", custodian: "Zerodha", defaultAssetClass: "Equities", currency: "INR" },
    { id: "zerodha_coin", label: "Zerodha Coin (Mutual Funds)", custodian: "Zerodha Coin", defaultAssetClass: "Mutual Funds", currency: "INR" },
    { id: "groww_stocks", label: "Groww (Stocks)", custodian: "Groww", defaultAssetClass: "Equities", currency: "INR" },
    { id: "groww_mf", label: "Groww (Mutual Funds)", custodian: "Groww", defaultAssetClass: "Mutual Funds", currency: "INR" },
    { id: "upstox", label: "Upstox", custodian: "Upstox", defaultAssetClass: "Equities", currency: "INR" },
    { id: "angel_one", label: "Angel One", custodian: "Angel One", defaultAssetClass: "Equities", currency: "INR" },
    { id: "icici_direct", label: "ICICI Direct", custodian: "ICICI Direct", defaultAssetClass: "Equities", currency: "INR" },
    { id: "hdfc_sec", label: "HDFC Securities", custodian: "HDFC Securities", defaultAssetClass: "Equities", currency: "INR" },
    { id: "sbi_sec", label: "SBI Securities", custodian: "SBI Securities", defaultAssetClass: "Equities", currency: "INR" },
    { id: "kuvera", label: "Kuvera (Mutual Funds)", custodian: "Kuvera", defaultAssetClass: "Mutual Funds", currency: "INR" },
    { id: "mfcentral", label: "CAMS / KFintech / MFCentral", custodian: "MFCentral / CAMS", defaultAssetClass: "Mutual Funds", currency: "INR" },
    { id: "other_stocks", label: "Other broker (Stocks)", custodian: "Other broker", defaultAssetClass: "Equities", currency: "INR" },
    { id: "other_mf", label: "Other (Mutual Funds)", custodian: "Other", defaultAssetClass: "Mutual Funds", currency: "INR" }
  ];

  function getSource(id) {
    if (id && typeof id === "object" && id.id) return id;
    return IMPORT_SOURCES.find((x) => x.id === id) || null;
  }

  // Shown while a file is being previewed and the person has not yet said where it came from.
  // It is never saved: importing requires a real source.
  const PREVIEW_SOURCE = { id: "", label: "Broker not chosen yet", custodian: "Not chosen", defaultAssetClass: "Equities", currency: "INR" };

  // A broker or statement type that is not in the list. The id comes from the name, so adding the same
  // name again (even on another device) lands in the same bucket.
  function registerCustomSource({ label, kind = "stocks", currency = "INR" } = {}) {
    const name = String(label || "").replace(/\s+/g, " ").trim().slice(0, 40);
    if (!name) throw new Error("Give the broker a name.");
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
    if (!slug) throw new Error("Give the broker a name using letters or numbers.");
    const id = "custom_" + slug;
    const existing = IMPORT_SOURCES.find((x) => x.id === id);
    if (existing) return existing;
    const isMf = kind === "mf";
    const src = {
      id,
      label: name + (isMf ? " (Mutual Funds)" : ""),
      custodian: name,
      defaultAssetClass: isMf ? "Mutual Funds" : "Equities",
      currency: currency === "USD" ? "USD" : "INR",
      custom: true,
      kind: isMf ? "mf" : "stocks"
    };
    IMPORT_SOURCES.push(src);
    return src;
  }

  function customSources() {
    return IMPORT_SOURCES.filter((x) => x.custom).map((x) => ({ label: x.custodian, kind: x.kind, currency: x.currency }));
  }

  // ==========================================================================
  // 1. Clean Number & Delimiter-Sniffing RFC-4180 Matrix Parser
  // ==========================================================================
  function cleanNumber(val) {
    if (typeof val === "number") return Number.isFinite(val) ? val : 0;
    if (val == null || val === "") return 0;
    const str = String(val).replace(/^\s*(rs\.?|inr)\s*/i, "").replace(/[₹$,%\s]/g, "").trim();
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
  /** Lower-case, with any run of spaces (including non-breaking ones from Excel) collapsed to one. */
  function normalizeHeader(h) {
    return String(h == null ? "" : h).replace(/[\s\u00a0]+/g, " ").trim().toLowerCase();
  }

  function findColumnIndex(headers, candidateTokens, excludeTokens = []) {
    if (!Array.isArray(headers) || !candidateTokens) return -1;
    const cleanHeaders = headers.map(normalizeHeader);

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
  // 3. Header-row sniffer (columns only; the source is chosen by the user)
  // ==========================================================================
  function detectHeader(matrix) {
    if (!Array.isArray(matrix) || matrix.length === 0) return null;
    const maxScan = Math.min(matrix.length, 40);

    for (let r = 0; r < maxScan; r++) {
      const rawRow = matrix[r] || [];
      const row = rawRow.map(normalizeHeader);
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
        return { headerRowIndex: r, headers: row };
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

  // One definition lives in the engine; the importer just asks it.
  function isUsMutualFund(args) {
    const engine = typeof window !== "undefined" ? window.KYF_PORTFOLIO_ENGINE : null;
    return !!(engine && engine.isUsMutualFund && engine.isUsMutualFund(args));
  }

  function resolveMarketInstrument({ isin, symbol, rawName, defaultAssetClass, fileLtp = 0, source = null, rawType = "" }) {
    const engine = typeof window !== "undefined" ? window.KYF_PORTFOLIO_ENGINE : null;
    if (engine && typeof engine.ensureIndexed === "function") {
      engine.ensureIndexed();
    }

    const cleanIsin = (isin || "").trim().toUpperCase();
    const cleanSym = (symbol || "").replace(/-(EQ|BE|GB|BZ)$/i, "").trim().toUpperCase();
    const isUsSource = source && (source.currency === "USD" || source.id === "chase" || source.id === "fidelity" || source.id === "vanguard" || source.id === "schwab" || source.id === "us_broker");

    // 0. US Asset / US Broker resolution (when importing US statements or matching a US ticker)
    const candidateUsTicker = cleanSym || (rawName ? extractUsTicker(rawName) : null);
    const isIndianStock = cleanSym && engine && typeof engine.lookupEquityBySymbol === "function" && !!engine.lookupEquityBySymbol(cleanSym);
    const usItem = isUsSource && candidateUsTicker && engine && typeof engine.lookupUsByTicker === "function"
      ? engine.lookupUsByTicker(candidateUsTicker)
      : null;

    if (isUsSource || usItem) {
      const isCash = cleanSym === "CASH" || /^(spaxx|fdrxx|vmfxx|fcash)$/i.test(cleanSym) ||
        /deposit sweep|cash balance|bank sweep|money market|cash reserves|settlement fund/i.test(rawName || "") ||
        /cash|money market/i.test(rawType || "");
      if (isCash) {
        return {
          assetClass: "Cash & Liquid",
          subCategory: "Bank Deposits",
          pricingMode: "MANUAL",
          currency: "USD",
          name: rawName || cleanSym || "Cash Sweep",
          livePrice: 1,
          instrumentMeta: {
            symbol: cleanSym || "CASH",
            currency: "USD"
          }
        };
      }

      const isFund = isUsMutualFund({
        symbol: candidateUsTicker,
        name: rawName,
        rawType,
        usItem,
        defaultAssetClass
      });
      const isEtf = (usItem && usItem.type === "ETF") || /\b(etf|etfs|exchange traded fund)\b/i.test(rawName || "") || /etf/i.test(rawType || "");
      const finalName = usItem ? usItem.name : (rawName || cleanSym || "US Holding");
      const ticker = usItem ? usItem.ticker : (cleanSym || candidateUsTicker || "");
      const livePrice = (usItem && usItem.closePrice > 0) ? usItem.closePrice : fileLtp;

      let subCategory = "US Equities";
      if (isFund) {
        if (/balanced|allocation|hybrid|lifestyle/i.test(rawName || "")) {
          subCategory = "US Balanced Fund";
        } else if (/bond|treasury|income|fixed income/i.test(rawName || "")) {
          subCategory = "US Bond Fund";
        } else if (/index|500 index|total market|total stock/i.test(rawName || "")) {
          subCategory = "US Index Fund";
        } else {
          subCategory = "US Index / Mutual Fund";
        }
      } else if (isEtf) {
        subCategory = "US Index ETF";
      }

      return {
        assetClass: isFund ? "Mutual Funds" : "Equities",
        subCategory: subCategory,
        pricingMode: "LIVE_US",
        currency: "USD",
        name: finalName,
        livePrice: livePrice || null,
        instrumentMeta: {
          ticker: ticker || null,
          symbol: ticker || null,
          priceUSD: livePrice || null,
          currency: "USD"
        }
      };
    }

    const isMf = cleanIsin.startsWith("INF") ||
                 defaultAssetClass === "Mutual Funds" ||
                 /\b(fund|scheme|growth|direct|regular|elss|index|arbitrage|hybrid|bluechip|cap)\b/i.test(rawName || "");

    // 1. Sovereign Gold Bond: by symbol (SGB...) or name. The IN00... ISIN prefix is shared by ALL
    //    government securities (G-Secs, T-Bills, state loans), so it is not proof of gold on its own.
    const nameSaysSgb = /sovereign gold|gold ?bond|\bsgb/i.test(rawName || "");
    if (/^SGB/i.test(cleanSym) || nameSaysSgb) {
      return {
        assetClass: "Commodities & Gold",
        subCategory: "Sovereign Gold Bond (SGB)",
        pricingMode: "LIVE_GOLD",
        name: rawName || cleanSym || "Sovereign Gold Bond",
        livePrice: null,
        instrumentMeta: { purity: "24K", isin: cleanIsin || null, symbol: cleanSym || null }
      };
    }

    // 1b. Other government securities held in demat: valued from the statement, never from the gold price
    if (cleanIsin.startsWith("IN00") && !nameSaysSgb) {
      return {
        assetClass: "Fixed Income",
        subCategory: "Government Securities",
        pricingMode: "MANUAL",
        name: rawName || cleanSym || "Government Security",
        livePrice: null,
        instrumentMeta: { isin: cleanIsin, symbol: cleanSym || null }
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
      const distinctInstrument = /segregated|side ?pocket|\bseries\b|\bfmp\b|fixed (maturity|term)|interval/i.test(rawName);
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
          // Partial matches only when the names are close in length, and never for side-pocketed
          // or numbered series, which are different instruments from the main fund.
          if (distinctInstrument) continue;
          if (targetNorm.includes(scNorm) && scNorm.length >= 0.6 * targetNorm.length && scNorm.length > bestLen) {
            bestScheme = row;
            bestLen = scNorm.length;
          } else if (scNorm.includes(targetNorm) && targetNorm.length >= 0.6 * scNorm.length && targetNorm.length > bestLen) {
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
  let idSeq = 0;

  /** A row that repeats column titles (a second table in the same sheet), not a holding. */
  function looksLikeHeaderRow(row) {
    const cells = (row || []).map((c) => (c == null ? "" : c));
    if (cells.filter((c) => String(c).trim()).length < 2) return false;
    if (cells.some((c) => cleanNumber(c) !== 0 || /^\s*0+(\.0+)?\s*$/.test(String(c)))) return false;
    const h = cells.map(normalizeHeader);
    const hasInstrument = [COL_CANDIDATES.NAME, COL_CANDIDATES.SYMBOL, COL_CANDIDATES.ISIN, COL_CANDIDATES.FOLIO]
      .some((list) => findColumnIndex(h, list) !== -1);
    return hasInstrument && findColumnIndex(h, COL_CANDIDATES.QTY) !== -1;
  }

  /** Several lots / accounts of the same instrument in one file become one holding. */
  function mergeSameInstrument(list) {
    const out = [];
    const seen = new Map();
    for (const h of list) {
      const m = h.instrumentMeta || {};
      const key = [
        (h.member || "").toLowerCase(), normalizeCustodian(h.custodian),
        (m.isin || m.ticker || m.symbol || h.name || "").toUpperCase(), (m.folio || "").toLowerCase()
      ].join("|");
      const first = seen.get(key);
      if (!first) { seen.set(key, h); out.push(h); continue; }
      first.units = Number((first.units + h.units).toFixed(4));
      first.investedValue = (first.investedValue == null && h.investedValue == null)
        ? null : (first.investedValue || 0) + (h.investedValue || 0);
      if (first.investedValueUSD != null || h.investedValueUSD != null) {
        first.investedValueUSD = Number(((first.investedValueUSD || 0) + (h.investedValueUSD || 0)).toFixed(2));
      }
      first.currentValue += h.currentValue;
      if (first.currentValueUSD != null || h.currentValueUSD != null) {
        first.currentValueUSD = Number(((first.currentValueUSD || 0) + (h.currentValueUSD || 0)).toFixed(2));
      }
      first.manualCurrentValue = first.currentValue;
      const fm = first.instrumentMeta;
      if (fm.units != null) fm.units = Number(first.units.toFixed(4));
      if (fm.grams != null) fm.grams = first.units;
      if (fm.quantity != null) fm.quantity = first.units;
      fm.avgBuyPrice = first.investedValue > 0 ? Number((first.investedValue / first.units).toFixed(2)) : null;
    }
    return out;
  }

  function extractHoldingsFromMatrix(matrix, defaultMember = "Self", sourceArg) {
    const source = getSource(sourceArg) || IMPORT_SOURCES.find((x) => x.id === "other_stocks");
    const detection = detectHeader(matrix);
    if (!detection) return [];

    const { headerRowIndex, headers } = detection;

    const iIsin = findColumnIndex(headers, COL_CANDIDATES.ISIN);
    const iSym = findColumnIndex(headers, COL_CANDIDATES.SYMBOL);
    const iName = findColumnIndex(headers, COL_CANDIDATES.NAME);
    const iFolio = findColumnIndex(headers, COL_CANDIDATES.FOLIO);
    const iQty = findColumnIndex(headers, COL_CANDIDATES.QTY);
    const iType = findColumnIndex(headers, COL_CANDIDATES.TYPE);
    let iAvgPrice = findColumnIndex(headers, COL_CANDIDATES.AVG_PRICE, EXCLUSIONS.AVG_PRICE);
    let iInvested = findColumnIndex(headers, COL_CANDIDATES.INVESTED, EXCLUSIONS.INVESTED);
    let iLtp = findColumnIndex(headers, COL_CANDIDATES.LTP, EXCLUSIONS.LTP);
    let iCurVal = findColumnIndex(headers, COL_CANDIDATES.CURVAL, EXCLUSIONS.CURVAL);
    // One column can only play one part: the more specific reading wins
    if (iInvested !== -1 && (iInvested === iAvgPrice || iInvested === iQty)) iInvested = -1;
    if (iCurVal !== -1 && (iCurVal === iLtp || iCurVal === iInvested || iCurVal === iQty)) iCurVal = -1;
    if (iLtp !== -1 && (iLtp === iAvgPrice || iLtp === iQty)) iLtp = -1;

    // Pledged shares are still the user's until the next import, so they count as held
    const iPledged = [];
    headers.forEach((h, i) => {
      if (i !== iQty && COL_CANDIDATES.PLEDGED.some((c) => h === c || h.includes(c))) iPledged.push(i);
    });

    const parsedHoldings = [];

    for (let r = headerRowIndex + 1; r < matrix.length; r++) {
      const row = matrix[r];
      if (!row || row.length === 0) continue;

      // A new table starts here (e.g. "Mutual Funds" below the equities): read it with its own columns
      if (looksLikeHeaderRow(row)) {
        return mergeSameInstrument(parsedHoldings.concat(extractHoldingsFromMatrix(matrix.slice(r), defaultMember, source)));
      }

      // Skip completely empty rows
      const hasAnyContent = row.some((c) => String(c || "").trim().length > 0);
      if (!hasAnyContent) continue;

      // Skip rows matching summary keywords in any cell
      // (a row holding a real ISIN is a holding even if a name starts with "Total")
      const hasIsin = row.some((c) => ISIN_REGEX.test(String(c || "").trim().toUpperCase()));
      const isSummaryRow = !hasIsin && row.some((c) => /^(total|grand total|disclaimer|sub-total|subtotal|note:)/i.test(String(c || "").trim()));
      if (isSummaryRow) continue;

      const qty = (iQty !== -1 ? cleanNumber(row[iQty]) : 0)
        + iPledged.reduce((sum, i) => sum + Math.max(0, cleanNumber(row[i])), 0);
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

      const rawType = iType !== -1 ? String(row[iType] || "").trim() : "";
      const resolved = resolveMarketInstrument({
        isin,
        symbol: rawSym,
        rawName,
        defaultAssetClass: source.defaultAssetClass,
        // The price the statement itself implies (never the purchase price, which is not a market price)
        fileLtp: fileLtp || (fileCurVal > 0 ? fileCurVal / qty : 0),
        source,
        rawType
      });

      const isUs = resolved.currency === "USD" || resolved.pricingMode === "LIVE_US";
      const engine = typeof window !== "undefined" ? window.KYF_PORTFOLIO_ENGINE : null;
      const fxRate = (engine && typeof engine.getUsdInr === "function") ? engine.getUsdInr().rate : 0;

      let currentValue = 0;
      let investedValueINR = null;
      let curValUSD = null;
      let invValUSD = null;

      if (isUs) {
        if (resolved.livePrice > 0) curValUSD = Number((qty * resolved.livePrice).toFixed(2));
        else if (fileCurVal > 0) curValUSD = Number(fileCurVal.toFixed(2));
        else if (fileLtp > 0) curValUSD = Number((qty * fileLtp).toFixed(2));
        else curValUSD = investedValue > 0 ? Number(investedValue.toFixed(2)) : Number((qty * avgPrice).toFixed(2));

        invValUSD = investedValue > 0 ? Number(investedValue.toFixed(2)) : (avgPrice > 0 ? Number((qty * avgPrice).toFixed(2)) : null);
        currentValue = Math.round(curValUSD * fxRate);
        investedValueINR = invValUSD != null ? Math.round(invValUSD * fxRate) : null;
      } else {
        if (resolved.livePrice > 0) currentValue = Math.round(qty * resolved.livePrice);
        else if (fileCurVal > 0) currentValue = Math.round(fileCurVal);
        else if (fileLtp > 0) currentValue = Math.round(qty * fileLtp);
        else currentValue = Math.round(investedValue > 0 ? investedValue : qty * avgPrice);
        investedValueINR = investedValue > 0 ? Math.round(investedValue) : null;
      }

      const effectivePrice = qty > 0 && currentValue > 0 ? currentValue / qty : 0;

      const meta = {
        ...resolved.instrumentMeta,
        isin: resolved.instrumentMeta.isin || isin || null,
        ticker: resolved.instrumentMeta?.ticker || (isUs ? (rawSym || rawName) : null),
        type: rawType || null,
        folio: folio || null,
        avgBuyPrice: avgPrice > 0 ? avgPrice : null,
        price: isUs ? (resolved.livePrice || fileLtp || (curValUSD && qty > 0 ? Number((curValUSD / qty).toFixed(2)) : null)) : (effectivePrice > 0 ? Number(effectivePrice.toFixed(4)) : null),
        priceUSD: isUs ? (resolved.livePrice || fileLtp || (curValUSD && qty > 0 ? Number((curValUSD / qty).toFixed(2)) : null)) : null,
        currency: isUs ? "USD" : "INR"
      };

      if (resolved.pricingMode === "LIVE_MF" || (isUs && resolved.assetClass === "Mutual Funds")) {
        meta.units = Number(qty.toFixed(4));
      } else if (resolved.pricingMode === "LIVE_GOLD") {
        if (meta.symbol === "GOLDBEES") meta.units = qty;
        else meta.grams = qty;
      } else {
        meta.quantity = qty;
      }

      const memberName = (defaultMember || "Self").trim();

      parsedHoldings.push({
        id: `hold_imp_${Date.now()}_${++idSeq}`,
        name: resolved.name,
        member: memberName,
        custodian: source.custodian,
        importSource: source.id,
        brokerLabel: source.label,
        assetClass: resolved.assetClass,
        subCategory: resolved.subCategory,
        pricingMode: resolved.pricingMode,
        currency: isUs ? "USD" : "INR",
        units: qty,
        investedValue: investedValueINR,
        investedValueUSD: invValUSD,
        currentValue,
        currentValueUSD: curValUSD,
        manualCurrentValue: currentValue,
        allocations: [],
        instrumentMeta: meta,
        notes: folio ? `Folio: ${folio}` : ""
      });
    }

    return mergeSameInstrument(parsedHoldings);
  }

  // ==========================================================================
  // 6. Smart Upsert Engine (Deduplicates by Member + Custodian + ISIN/Symbol/Folio)
  // Strictly preserves existing Goal Allocations (`allocations`)!
  // ==========================================================================
  function normalizeCustodian(c) {
    const s = (c || "").toLowerCase().trim();
    if (s.includes("zerodha")) return "zerodha";
    if (s.includes("groww")) return "groww";
    if (s.includes("chase") || s.includes("jpmorgan")) return "chase";
    if (s.includes("schwab")) return "schwab";
    if (s.includes("fidelity")) return "fidelity";
    if (s.includes("vanguard")) return "vanguard";
    if (s.includes("vested") || s.includes("drivewealth")) return "vested";
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

  function sameInstrument(a, b) {
    const am = a.instrumentMeta || {}, bm = b.instrumentMeta || {};
    const aFolio = (am.folio || "").toLowerCase().trim();
    const bFolio = (bm.folio || "").toLowerCase().trim();
    if (aFolio && bFolio && aFolio !== bFolio) return false;
    const aIsin = (am.isin || "").toUpperCase().trim(), bIsin = (bm.isin || "").toUpperCase().trim();
    if (aIsin && bIsin) return aIsin === bIsin;
    const aCode = am.amfiCode ? String(am.amfiCode).trim() : "", bCode = bm.amfiCode ? String(bm.amfiCode).trim() : "";
    if (aCode && bCode) return aCode === bCode;
    const aSym = (am.symbol || "").toUpperCase().trim(), bSym = (bm.symbol || "").toUpperCase().trim();
    if (aSym && bSym) return aSym === bSym;
    const aName = (a.name || "").toLowerCase().trim(), bName = (b.name || "").toLowerCase().trim();
    return !!aName && aName === bName;
  }

  function holdingKind(h) {
    return (h && (h.assetClass === "Mutual Funds" || h.pricingMode === "LIVE_MF")) ? "mf" : "listed";
  }

  // A bucket = one family member + one import source. It is always overwritten by the latest import:
  // what the file lists is what is held now; anything the bucket had that the file no longer lists was sold.
  // Matched holdings keep their id and goal allocations. Manual holdings are never touched.
  // A file only replaces the kinds it contains (stocks vs mutual funds), see holdingKind.
  function replaceBucket(existingHoldings, incomingHoldings, memberArg, sourceArg) {
    const source = getSource(sourceArg);
    if (!source) throw new Error("Choose where this file came from.");
    const memberKey = (memberArg || "Self").trim().toLowerCase();
    const now = new Date().toISOString();
    const existing = existingHoldings || [];
    // Keep the spelling the portfolio already uses for this person ("priya" and "Priya" are one person)
    const knownMember = existing.find((h) => (h.member || "Self").trim().toLowerCase() === memberKey);
    const member = knownMember ? (knownMember.member || "Self") : (memberArg || "Self").trim();
    const inMember = (h) => (h.member || "Self").toLowerCase().trim() === memberKey;
    const inBucket = (h) => inMember(h) && h.importSource === source.id;
    // Older imports carry no source: adopt them rather than duplicate (never remove them)
    const legacy = (h) => inMember(h) && !h.importSource && String(h.id || "").startsWith("hold_imp_") && !!h.custodian
      && normalizeCustodian(h.custodian) === normalizeCustodian(source.custodian);

    // Brokers often send stocks and mutual funds as separate files: a file only replaces
    // the kind of holding it contains, so the other kind in the same account is kept.
    const incomingKinds = new Set((incomingHoldings || []).map(holdingKind));
    const inScope = (h) => incomingKinds.has(holdingKind(h));
    const bucket = existing.filter((h) => inBucket(h) && inScope(h));
    const legacyPool = existing.filter((h) => legacy(h) && inScope(h));
    const claimed = new Set();
    const added = [], updated = [], removed = [];
    const incoming = incomingHoldings || [];

    const next = new Map();
    for (const inc of incoming) {
      let prev = bucket.find((b) => !claimed.has(b) && sameInstrument(b, inc));
      if (!prev) prev = legacyPool.find((b) => !claimed.has(b) && sameInstrument(b, inc));
      const fresh = { ...inc, member, importSource: source.id, custodian: source.custodian, importedAt: now };
      if (prev) {
        claimed.add(prev);
        next.set(prev, {
          ...fresh,
          id: prev.id,
          notes: prev.notes || fresh.notes,
          allocations: Array.isArray(prev.allocations) ? prev.allocations : [],
          instrumentMeta: { ...(prev.instrumentMeta || {}), ...(inc.instrumentMeta || {}) }
        });
        updated.push(next.get(prev));
      } else {
        added.push(fresh);
      }
    }
    bucket.forEach((b) => { if (!claimed.has(b)) removed.push(b); });

    const kept = existing
      .filter((h) => !removed.includes(h))
      .map((h) => next.get(h) || h);
    return { holdings: kept.concat(added), added, updated, removed, addedCount: added.length, updatedCount: updated.length, removedCount: removed.length };
  }

  // What would importing do? Used for the preview before anything is saved.
  function previewBucket(existingHoldings, incomingHoldings, memberArg, sourceArg) {
    const r = replaceBucket(existingHoldings, incomingHoldings, memberArg, sourceArg);
    const sid = getSource(sourceArg).id;
    const mk = (memberArg || "Self").toLowerCase().trim();
    const account = (existingHoldings || []).filter((h) =>
      (h.member || "Self").toLowerCase().trim() === mk && h.importSource === sid);
    const kinds = new Set((incomingHoldings || []).map(holdingKind));
    const inScope = account.filter((h) => kinds.has(holdingKind(h)));
    const keptOther = account.filter((h) => !kinds.has(holdingKind(h)));
    const bucketSize = inScope.length;
    const onlyKind = kinds.size === 1 ? [...kinds][0] : "";
    return {
      ...r,
      bucketSize,
      accountSize: account.length,
      firstImport: account.length === 0,
      keptOtherCount: keptOther.length,
      replacedKind: onlyKind, // "mf", "listed" or "" when the file has both
      removedWithGoals: r.removed.filter((h) => Array.isArray(h.allocations) && h.allocations.length > 0),
      muchSmaller: bucketSize >= 4 && (r.updatedCount + r.addedCount) < bucketSize / 2
    };
  }

  async function parseFiles(fileList, defaultMember = "Self", sourceArg) {
    const allHoldings = [];
    const brokersDetected = new Set();
    const membersDetected = new Set();

    for (const file of Array.from(fileList || [])) {
      const source = getSource(sourceArg) || PREVIEW_SOURCE;
      const sheets = await fileToMatrices(file);
      for (const { matrix } of sheets) {
        const extracted = extractHoldingsFromMatrix(matrix, defaultMember, source);
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

  async function parseFile(file, defaultMember = "Self", source) {
    return parseFiles([file], defaultMember, source);
  }

  const api = {
    parseFile,
    parseFiles,
    replaceBucket,
    previewBucket,
    IMPORT_SOURCES,
    getSource,
    PREVIEW_SOURCE,
    registerCustomSource,
    customSources,
    parseCSVToMatrix,
    parseHTMLTableToMatrix,
    detectDelimiter,
    detectHeader,
    findColumnIndex,
    normalizeSchemeName,
    determineMfPlanType,
    isUsMutualFund,
    resolveMarketInstrument,
    extractHoldingsFromMatrix
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }

  return api;
})();
