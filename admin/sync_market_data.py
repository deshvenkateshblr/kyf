#!/usr/bin/env python3
"""
Know Your Finance (KYF) — Unified EOD Market Data Build Script (Modules 3, 4, 5 & 5B)
Run via VS Code Build Task (Ctrl+Shift+B) or `python admin/sync_market_data.py`
Outputs:
  - ../data/market-pulse.js    (Module 3: Macro, Gold & Live NSE Index Multiples/Returns)
  - ../data/market-equities.js (Module 4: NSE Stocks with Latest, 1M, 3M, 6M, 1Y Growth %)
  - ../data/market-mf.js       (Module 5: AMFI Direct/Regular NAVs with 1M, 3M, 6M, 1Y Growth %)
  - ../data/market-us.js       (Module 5B: US Stocks & Mutual Funds with USD/INR)
"""

import csv
import datetime
import gzip
import http.cookiejar
import io
import json
import os
import re
import subprocess
import sys
import urllib.error
import urllib.request
import zipfile

# ============================================================================
# 1. PATHS & TRADING CALENDAR SETUP
# ============================================================================
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.abspath(os.path.join(BASE_DIR, "..", "data"))
CACHE_DIR = os.path.join(BASE_DIR, ".cache")
PULSE_CONFIG_PATH = os.path.join(BASE_DIR, "pulse_config.json")

os.makedirs(DATA_DIR, exist_ok=True)
os.makedirs(CACHE_DIR, exist_ok=True)

MONTHS_SHORT = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"]
MONTHS_TITLE = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

NSE_HOLIDAYS = {
    "2025-10-02": "Gandhi Jayanti / Dussehra",
    "2025-10-21": "Diwali Laxmi Pujan",
    "2025-10-22": "Diwali-Balipratipada",
    "2025-11-05": "Guru Nanak Jayanti",
    "2025-12-25": "Christmas",
    "2026-01-26": "Republic Day",
    "2026-03-03": "Holi",
    "2026-03-26": "Shri Ram Navami",
    "2026-03-31": "Shri Mahavir Jayanti",
    "2026-04-03": "Good Friday",
    "2026-04-14": "Ambedkar Jayanti",
    "2026-05-01": "Maharashtra Day",
    "2026-05-28": "Bakri Id",
    "2026-06-26": "Muharram",
    "2026-09-14": "Ganesh Chaturthi",
    "2026-10-02": "Mahatma Gandhi Jayanti",
    "2026-10-20": "Dussehra",
    "2026-11-10": "Diwali-Balipratipada",
    "2026-11-24": "Guru Nanak Jayanti",
    "2026-12-25": "Christmas",
}

SPECIAL_SESSIONS = {"2026-11-08"}  # Sunday Diwali Muhurat Trading


def is_trading_day(dt: datetime.date) -> bool:
    iso = dt.strftime("%Y-%m-%d")
    if iso in SPECIAL_SESSIONS:
        return True
    if iso in NSE_HOLIDAYS:
        return False
    return dt.weekday() < 5


def resolve_trading_date_on_or_before(dt: datetime.date) -> datetime.date:
    cursor = dt
    for _ in range(12):
        if is_trading_day(cursor):
            return cursor
        cursor -= datetime.timedelta(days=1)
    return dt


def subtract_months(dt: datetime.date, months_back: int) -> datetime.date:
    if months_back == 0:
        return resolve_trading_date_on_or_before(dt)
    year = dt.year
    month = dt.month - months_back
    while month <= 0:
        month += 12
        year -= 1
    next_month = datetime.date(year + (month // 12), (month % 12) + 1, 1)
    max_day = (next_month - datetime.timedelta(days=1)).day
    clamped_dt = datetime.date(year, month, min(dt.day, max_day))
    return resolve_trading_date_on_or_before(clamped_dt)


def get_horizons(reference_date: datetime.date = None):
    if reference_date is None:
        ist_now = datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(hours=5, minutes=30)
        base_dt = ist_now.date()
        # AMFI NAVs and Bhavcopies are finalized late evening (typically 20:30+ IST).
        # Before 20:30, use previous trading day.
        if (ist_now.hour < 20 or (ist_now.hour == 20 and ist_now.minute < 30)) and is_trading_day(base_dt):
            base_dt -= datetime.timedelta(days=1)
    else:
        base_dt = reference_date

    latest_dt = resolve_trading_date_on_or_before(base_dt)
    return {
        "latest": latest_dt,
        "m1": subtract_months(latest_dt, 1),
        "m3": subtract_months(latest_dt, 3),
        "m6": subtract_months(latest_dt, 6),
        "y1": subtract_months(latest_dt, 12),
    }


def calc_pct(curr, past, isin_curr="", isin_past="", max_pct=None):
    if not curr or not past or past <= 0:
        return None
    if isin_curr and isin_past and isin_curr != isin_past:
        return None
    pct = round(((curr - past) / past) * 100.0, 2)
    if max_pct is not None and abs(pct) > max_pct:
        return None
    return pct


# ============================================================================
# 2. HTTP SESSION & CACHED DOWNLOADERS
# ============================================================================
def create_http_opener():
    cj = http.cookiejar.CookieJar()
    opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj))
    opener.addheaders = [
        ("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36"),
        ("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"),
        ("Accept-Language", "en-US,en;q=0.5"),
        ("Referer", "https://www.nseindia.com/all-reports"),
    ]
    try:
        opener.open("https://www.nseindia.com", timeout=10).read()
    except Exception:
        pass
    return opener


def fetch_nse_index_csv(opener, dt: datetime.date) -> str:
    """Fetches NSE Daily Index snapshot: ind_close_all_DDMMYYYY.csv"""
    ddmmyyyy = dt.strftime("%d%m%Y")
    cache_file = os.path.join(CACHE_DIR, f"nse_idx_{dt.strftime('%Y%m%d')}.csv")
    if os.path.exists(cache_file):
        with open(cache_file, "r", encoding="utf-8") as f:
            return f.read()

    urls = [
        f"https://nsearchives.nseindia.com/content/indices/ind_close_all_{ddmmyyyy}.csv",
        f"https://archives.nseindia.com/content/indices/ind_close_all_{ddmmyyyy}.csv",
    ]
    for url in urls:
        try:
            print(f"  [Downloading Index CSV] {url} ...")
            resp = opener.open(url, timeout=15)
            csv_text = resp.read().decode("utf-8", errors="replace")
            if "Index Name" in csv_text:
                with open(cache_file, "w", encoding="utf-8") as f:
                    f.write(csv_text)
                return csv_text
        except Exception as e:
            print(f"  [Info] NSE Index CSV mirror unavailable ({e})")
    print(f"  [Warn] NSE Index CSV unavailable for {dt.isoformat()} across all mirrors")
    return ""


def fetch_nse_bhavcopy_csv(opener, dt: datetime.date) -> str:
    compact = dt.strftime("%Y%m%d")
    cache_file = os.path.join(CACHE_DIR, f"nse_{compact}.csv")
    if os.path.exists(cache_file):
        print(f"  [Cache Hit] NSE Bhavcopy for {dt.isoformat()}")
        with open(cache_file, "r", encoding="utf-8") as f:
            return f.read()

    mmm = MONTHS_SHORT[dt.month - 1]
    urls = [
        f"https://nsearchives.nseindia.com/content/cm/BhavCopy_NSE_CM_0_0_0_{compact}_F_0000.csv.zip",
        f"https://nsearchives.nseindia.com/content/historical/EQUITIES/{dt.year}/{mmm}/cm{dt.strftime('%d')}{mmm}{dt.year}bhav.csv.zip",
    ]

    for url in urls:
        try:
            print(f"  [Downloading] {url} ...")
            resp = opener.open(url, timeout=20)
            raw_bytes = resp.read()
            with zipfile.ZipFile(io.BytesIO(raw_bytes)) as zf:
                csv_name = zf.namelist()[0]
                csv_text = zf.read(csv_name).decode("utf-8", errors="replace")
                with open(cache_file, "w", encoding="utf-8") as f:
                    f.write(csv_text)
                return csv_text
        except Exception as e:
            print(f"  [Warn] Failed {url}: {e}")
    return ""



def fetch_nse_corporate_actions(opener) -> str:
    """Fetches NSE Corporate Actions master file: https://nsearchives.nseindia.com/content/equities/actions.csv"""
    cache_file = os.path.join(CACHE_DIR, "nse_corporate_actions.csv")
    if os.path.exists(cache_file):
        try:
            mtime = datetime.datetime.fromtimestamp(os.path.getmtime(cache_file))
            if datetime.datetime.now() - mtime < datetime.timedelta(hours=24):
                print("  [Cache Hit] NSE Corporate Actions CSV (fresh within 24h)")
                with open(cache_file, "r", encoding="utf-8") as f:
                    return f.read()
        except Exception:
            pass

    urls = [
        "https://nsearchives.nseindia.com/content/equities/actions.csv",
        "https://www.nseindia.com/api/corporates-corporateActions?index=equities",
    ]
    for url in urls:
        try:
            print(f"  [Downloading Corporate Actions] {url} ...")
            resp = opener.open(url, timeout=20)
            raw = resp.read().decode("utf-8", errors="replace")
            if "SYMBOL" in raw or "symbol" in raw or "Series" in raw:
                with open(cache_file, "w", encoding="utf-8") as f:
                    f.write(raw)
                print(f"  [Saved] Updated {cache_file} ({len(raw)/1024:.1f} KB)")
                return raw
        except Exception as e:
            print(f"  [Warn] Failed {url}: {e}")

    if os.path.exists(cache_file):
        with open(cache_file, "r", encoding="utf-8") as f:
            return f.read()
    return ""


def parse_corporate_actions_csv(csv_text: str) -> dict:
    if not csv_text:
        return {"by_symbol": {}, "list": []}

    reader = csv.reader(io.StringIO(csv_text))
    headers = [h.strip().upper() for h in next(reader, [])]

    def col(names):
        for n in names:
            if n in headers:
                return headers.index(n)
        return -1

    i_sym = col(["SYMBOL", "SECURITY CODE", "TCKRSYMB"])
    i_srs = col(["SERIES", "SCTYSRS"])
    i_name = col(["SECURITY", "COMPANY NAME", "NAME", "FININSTRMNM"])
    i_purpose = col(["PURPOSE", "SUBJECT"])
    i_ex = col(["EX_DATE", "EX-DATE", "EXDATE"])
    i_rec = col(["RECORD_DATE", "RECORD-DATE", "RECORDDATE"])

    by_symbol = {}
    action_list = []

    for row in reader:
        if len(row) <= max(i_sym, i_purpose):
            continue
        if i_srs != -1 and i_srs < len(row) and row[i_srs].strip() and row[i_srs].strip() != "EQ":
            continue

        sym = row[i_sym].strip()
        purpose = row[i_purpose].strip()
        name = row[i_name].strip() if i_name != -1 and i_name < len(row) else sym
        ex_str = row[i_ex].strip() if i_ex != -1 and i_ex < len(row) else ""
        rec_str = row[i_rec].strip() if i_rec != -1 and i_rec < len(row) else ""

        ex_date = None
        for fmt in ("%d-%b-%Y", "%d-%m-%Y", "%Y-%m-%d", "%d/%m/%Y", "%d-%B-%Y"):
            try:
                ex_date = datetime.datetime.strptime(ex_str, fmt).date()
                break
            except ValueError:
                pass

        action_type = "OTHER"
        multiplier = 1.0
        factor = 1.0

        split_m = re.search(r'(?:Split|Sub-?Division|Sub\s+Division).*?(?:From|Rs\.?|Re\.?)\s*(\d+(?:\.\d+)?).*?(?:To|Rs\.?|Re\.?)\s*(\d+(?:\.\d+)?)', purpose, re.I)
        if split_m:
            from_v = float(split_m.group(1))
            to_v = float(split_m.group(2))
            if from_v > to_v and to_v > 0:
                action_type = "SPLIT"
                multiplier = to_v / from_v
                factor = from_v / to_v

        if action_type == "OTHER":
            bonus_m = re.search(r'Bonus.*?(\d+)\s*:\s*(\d+)', purpose, re.I)
            if bonus_m:
                b_for = float(bonus_m.group(1))
                b_held = float(bonus_m.group(2))
                if b_held > 0 and b_for > 0:
                    action_type = "BONUS"
                    multiplier = b_held / (b_held + b_for)
                    factor = (b_held + b_for) / b_held

        if action_type == "OTHER":
            consol_m = re.search(r'Consolidation.*?(?:From|Rs\.?|Re\.?)\s*(\d+(?:\.\d+)?).*?(?:To|Rs\.?|Re\.?)\s*(\d+(?:\.\d+)?)', purpose, re.I)
            if consol_m:
                from_v = float(consol_m.group(1))
                to_v = float(consol_m.group(2))
                if to_v > from_v and from_v > 0:
                    action_type = "CONSOLIDATION"
                    multiplier = to_v / from_v
                    factor = from_v / to_v

        if action_type == "OTHER" and re.search(r'Demerger|Spin-?off|Scheme of Arrangement', purpose, re.I):
            action_type = "DEMERGER"

        if action_type == "OTHER" and re.search(r'Dividend', purpose, re.I):
            action_type = "DIVIDEND"

        record = {
            "symbol": sym,
            "name": name,
            "purpose": purpose,
            "exDate": ex_date.isoformat() if ex_date else ex_str,
            "recordDate": rec_str,
            "type": action_type,
            "multiplier": round(multiplier, 6),
            "factor": round(factor, 4)
        }

        action_list.append(record)
        if sym not in by_symbol:
            by_symbol[sym] = []
        by_symbol[sym].append(record)

    return {"by_symbol": by_symbol, "list": action_list}


def build_corporate_actions_js(opener) -> dict:
    print("\n--- Building Module: data/market-corporate-actions.js ---")
    raw_csv = fetch_nse_corporate_actions(opener)
    ca_data = parse_corporate_actions_csv(raw_csv)
    
    tuples = []
    for item in ca_data["list"]:
        tuples.append([
            item["symbol"],
            item["name"],
            "EQ",
            item["purpose"],
            item["exDate"],
            item["type"],
            item["multiplier"],
            item["factor"]
        ])

    as_of = datetime.date.today().isoformat()
    body_lines = ",\n".join(f"    {json.dumps(t)}" for t in tuples)
    js_content = (
        f"// Auto-generated by admin/sync_market_data.py on {datetime.datetime.now().isoformat()}\n"
        f"window.KYF_CORPORATE_ACTIONS = {{\n"
        f'  asOf: "{as_of}",\n'
        f'  source: "NSE actions.csv",\n'
        f'  columns: ["symbol", "companyName", "series", "purpose", "exDate", "type", "multiplier", "factor"],\n'
        f"  actions: [\n{body_lines}\n  ]\n"
        f"}};\n"
    )

    out_path = os.path.join(DATA_DIR, "market-corporate-actions.js")
    with open(out_path, "w", encoding="utf-8") as f:
        f.write(js_content)
    print(f"  [Success] Wrote {len(tuples)} corporate actions to {out_path} ({len(js_content)/1024:.1f} KB)")
    return ca_data

def fetch_amfi_nav_txt(opener, dt: datetime.date, is_latest: bool) -> str:
    compact = dt.strftime("%Y%m%d")
    cache_file = os.path.join(CACHE_DIR, f"amfi_{compact}.txt")
    if os.path.exists(cache_file):
        print(f"  [Cache Hit] AMFI NAV for {dt.isoformat()}")
        with open(cache_file, "r", encoding="utf-8") as f:
            return f.read()

    mmm = MONTHS_TITLE[dt.month - 1]
    amfi_date = f"{dt.strftime('%d')}-{mmm}-{dt.year}"
    url = (
        "https://www.amfiindia.com/spages/NAVAll.txt"
        if is_latest
        else f"https://portal.amfiindia.com/DownloadNAVHistoryReport_Po.aspx?frmdt={amfi_date}"
    )

    try:
        print(f"  [Downloading] {url} ...")
        resp = opener.open(url, timeout=25)
        txt = resp.read().decode("utf-8", errors="replace")
        if ";" in txt:
            with open(cache_file, "w", encoding="utf-8") as f:
                f.write(txt)
            return txt
    except Exception as e:
        print(f"  [Warn] Failed AMFI fetch for {amfi_date}: {e}")
    return ""


# ============================================================================
# 3. BUILD MODULE 3 (`data/market-pulse.js`)
# ============================================================================
DEFAULT_PULSE_CONFIG = {
    "macro": {
        "cpiInflation": 5.40,
        "medicalInflation": 11.50,
        "educationInflation": 9.00,
        "rbiRepo": 6.25,
        "epfRate": 8.25,
        "ppfRate": 7.10,
        "ssyRate": 8.20,
        "scssRate": 8.20,
        "sbiFd1Yr": 6.80,
        "sbiFd5Yr": 6.50,
        "liquidFundAvg": 6.95,
        "arbitrageFundAvg": 7.20,
        "homeLoanAvg": 8.65,
        "personalLoanAvg": 14.50,
        "creditCardApr": 39.00,
        "usdInrRate": 87.50,
    },
    "preciousMetals": {
        "gold24kPerGram": 13800,
        "gold22kPerGram": 12650,
        "gold18kPerGram": 10350,
        "goldEtfTo24kFactor": 122.5,
        "silverPerGram": 192.5,
        "silverPerKg": 192500,
        "silverEtfToKgFactor": 1153.8,
    },
    "indicesBaseline": {
        "NIFTY50": {
            "nseCsvName": "Nifty 50",
            "name": "Nifty 50",
            "role": "Large-Cap Core Engine (Top 50 Indian Companies)",
            "level": 25030.35,
            "pe": 20.66,
            "pb": 3.07,
            "divYield": 1.39,
            "cagr1y": -2.22,
            "cagr5y": 14.90,
            "cagr10y": 13.40,
        },
        "NIFTYNEXT50": {
            "nseCsvName": "Nifty Next 50",
            "name": "Nifty Next 50",
            "role": "Future Large-Cap Incubator (Rank 51–100)",
            "level": 69850.00,
            "pe": 24.80,
            "pb": 4.10,
            "divYield": 1.05,
            "cagr1y": 19.40,
            "cagr5y": 17.80,
            "cagr10y": 15.10,
        },
        "NIFTYMID150": {
            "nseCsvName": "Nifty Midcap 150",
            "name": "Nifty Midcap 150",
            "role": "High-Growth Mid-Sized Businesses (Rank 101–250)",
            "level": 20890.00,
            "pe": 33.40,
            "pb": 4.85,
            "divYield": 0.75,
            "cagr1y": 22.10,
            "cagr5y": 23.40,
            "cagr10y": 18.20,
        },
        "NIFTYSMALL250": {
            "nseCsvName": "Nifty Smallcap 250",
            "name": "Nifty Smallcap 250",
            "role": "Aggressive Emerging Companies (High Volatility)",
            "level": 17420.00,
            "pe": 29.80,
            "pb": 3.90,
            "divYield": 0.65,
            "cagr1y": 24.50,
            "cagr5y": 25.10,
            "cagr10y": 16.80,
        },
    },
}


def parse_nse_index_csv(csv_text: str) -> dict:
    """Parses ind_close_all_DDMMYYYY.csv into a map keyed by lowercase Index Name."""
    if not csv_text:
        return {}
    reader = csv.reader(io.StringIO(csv_text))
    headers = [h.strip() for h in next(reader, [])]

    def col_idx(name):
        for i, h in enumerate(headers):
            if h.lower() == name.lower():
                return i
        return -1

    i_name = col_idx("Index Name")
    i_close = col_idx("Closing Index Value")
    i_pe = col_idx("P/E")
    i_pb = col_idx("P/B")
    i_div = col_idx("Div Yield")

    if i_name == -1 or i_close == -1:
        return {}

    def safe_float(val):
        try:
            return round(float(val.strip()), 2)
        except Exception:
            return None

    out = {}
    for row in reader:
        if len(row) <= max(i_name, i_close):
            continue
        name_key = row[i_name].strip().lower()
        close_val = safe_float(row[i_close])
        if name_key and close_val:
            out[name_key] = {
                "level": close_val,
                "pe": safe_float(row[i_pe]) if i_pe != -1 and i_pe < len(row) else None,
                "pb": safe_float(row[i_pb]) if i_pb != -1 and i_pb < len(row) else None,
                "divYield": safe_float(row[i_div]) if i_div != -1 and i_div < len(row) else None,
            }
    return out


def compute_live_precious_metals(opener, horizons: dict, base_pm: dict) -> dict:
    """
    Computes daily Gold & Silver spot prices and 1M/3M/6M/1Y trailing returns
    directly from NSE Bhavcopy ETFs (GOLDBEES & SILVERBEES) so it never breaks.
    """
    snapshots = {}
    for key, dt in horizons.items():
        csv_text = fetch_nse_bhavcopy_csv(opener, dt)
        snapshots[key] = parse_nse_csv(csv_text)

    def pick_etf_series(candidates):
        for sym in candidates:
            latest_obj = snapshots.get("latest", {}).get(sym)
            if latest_obj and latest_obj.get("close", 0) > 0:
                return sym, {
                    k: snapshots.get(k, {}).get(sym, {}).get("close")
                    for k in horizons.keys()
                }
        return None, {}

    gold_sym, g_prices = pick_etf_series(["GOLDBEES", "HDFCGOLD", "GOLDIETF"])
    silver_sym, s_prices = pick_etf_series(["SILVERBEES", "SILVERIETF", "HDFCSILVER"])

    out = dict(base_pm)

    if g_prices.get("latest"):
        g_curr = g_prices["latest"]
        # Anchor factor: converts GOLDBEES close to 1g 24K retail bullion price
        # (Can be overridden in pulse_config.json via "goldEtfTo24kFactor")
        g_factor = float(base_pm.get("goldEtfTo24kFactor", base_pm.get("goldEtfTo24kGramFactor", 122.5)))
        g24k = int(round(g_curr * g_factor, -1))
        out["gold24kPerGram"] = g24k
        out["gold22kPerGram"] = int(round(g24k * (22.0 / 24.0), -1))
        out["gold18kPerGram"] = int(round(g24k * (18.0 / 24.0), -1))
        out["goldBenchmarkSymbol"] = gold_sym
        out["goldRet1m"] = calc_pct(g_curr, g_prices.get("m1"))
        out["goldRet3m"] = calc_pct(g_curr, g_prices.get("m3"))
        out["goldRet6m"] = calc_pct(g_curr, g_prices.get("m6"))
        out["goldRet1y"] = calc_pct(g_curr, g_prices.get("y1"))
        try:
            print(f"  [Live Gold via {gold_sym}] 24K: ₹{g24k}/g | 1Y: {out['goldRet1y']}%")
        except UnicodeEncodeError:
            print(f"  [Live Gold via {gold_sym}] 24K: Rs {g24k}/g | 1Y: {out['goldRet1y']}%")

    if s_prices.get("latest"):
        s_curr = s_prices["latest"]
        s_factor = float(base_pm.get("silverEtfToKgFactor", 1153.80))
        s_kg = int(round(s_curr * s_factor, -2))
        out["silverPerKg"] = s_kg
        out["silverPerGram"] = round(s_kg / 1000.0, 1)
        out["silverBenchmarkSymbol"] = silver_sym
        out["silverRet1m"] = calc_pct(s_curr, s_prices.get("m1"))
        out["silverRet3m"] = calc_pct(s_curr, s_prices.get("m3"))
        out["silverRet6m"] = calc_pct(s_curr, s_prices.get("m6"))
        out["silverRet1y"] = calc_pct(s_curr, s_prices.get("y1"))
        try:
            print(f"  [Live Silver via {silver_sym}] 1Kg: ₹{s_kg} | 1Y: {out['silverRet1y']}%")
        except UnicodeEncodeError:
            print(f"  [Live Silver via {silver_sym}] 1Kg: Rs {s_kg} | 1Y: {out['silverRet1y']}%")

    return out


def fetch_live_usdinr_rate(fallback_rate: float = 87.50) -> float:
    """
    Fetches the live USD/INR exchange rate on-demand from free, public forex feeds with multi-source fallback.
    1. open.er-api.com (Open Exchange Rates public free tier)
    2. api.frankfurter.app (European Central Bank official reference feed)
    3. Yahoo Finance USDINR=X
    4. Local cache (.cache/usdinr_latest.json)
    5. fallback_rate / pulse_config.json
    """
    cache_file = os.path.join(CACHE_DIR, "usdinr_latest.json")

    sources = [
        ("open.er-api.com", "https://open.er-api.com/v6/latest/USD", lambda d: d.get("rates", {}).get("INR")),
        ("Frankfurter (ECB)", "https://api.frankfurter.app/latest?from=USD&to=INR", lambda d: d.get("rates", {}).get("INR")),
        ("Yahoo Finance", "https://query1.finance.yahoo.com/v8/finance/chart/USDINR=X", lambda d: d["chart"]["result"][0]["meta"].get("regularMarketPrice")),
    ]

    for name, url, extractor in sources:
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"})
            with urllib.request.urlopen(req, timeout=6) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                val = extractor(data)
                if val and float(val) > 0:
                    rate = round(float(val), 2)
                    print(f"  [Live USD/INR Rate] Fetched {rate} from {name}")
                    try:
                        with open(cache_file, "w", encoding="utf-8") as f:
                            json.dump({"rate": rate, "source": name, "timestamp": datetime.datetime.now().isoformat()}, f)
                    except Exception:
                        pass
                    return rate
        except Exception:
            continue

    if os.path.exists(cache_file):
        try:
            with open(cache_file, "r", encoding="utf-8") as f:
                cdata = json.load(f)
                rate = float(cdata.get("rate", fallback_rate))
                print(f"  [Cache USD/INR Rate] Using cached {rate} from {cdata.get('source', 'cache')}")
                return rate
        except Exception:
            pass

    print(f"  [Fallback USD/INR Rate] Using default {fallback_rate}")
    return fallback_rate


def build_pulse_js(opener, horizons: dict):
    print("\n--- Building Module 3: data/market-pulse.js ---")
    if not os.path.exists(PULSE_CONFIG_PATH):
        with open(PULSE_CONFIG_PATH, "w", encoding="utf-8") as f:
            json.dump(DEFAULT_PULSE_CONFIG, f, indent=2)
        print(f"  [Created Default Config] {PULSE_CONFIG_PATH}")

    with open(PULSE_CONFIG_PATH, "r", encoding="utf-8") as f:
        cfg = json.load(f)

    # Load existing pulse payload if available to prevent wiping out verified returns on transient download drops
    existing_pulse = {}
    out_path = os.path.join(DATA_DIR, "market-pulse.js")
    if os.path.exists(out_path):
        try:
            with open(out_path, "r", encoding="utf-8") as f:
                content = f.read()
                m = re.search(r"window\.KYF_MARKET_PULSE\s*=\s*(\{.*\});", content, re.DOTALL)
                if m:
                    existing_pulse = json.loads(m.group(1))
        except Exception:
            existing_pulse = {}

    # Fetch NSE Index CSV across all 5 horizons to compute live index 1M, 3M, 6M, 1Y returns
    idx_snapshots = {}
    for key, dt in horizons.items():
        csv_txt = fetch_nse_index_csv(opener, dt)
        idx_snapshots[key] = parse_nse_index_csv(csv_txt)

    has_live_latest = bool(idx_snapshots.get("latest"))

    indices_out = {}
    for key, base_obj in cfg["indicesBaseline"].items():
        lookup_name = base_obj.get("nseCsvName", base_obj["name"]).lower()
        latest_live = idx_snapshots.get("latest", {}).get(lookup_name, {})
        existing_idx = existing_pulse.get("indices", {}).get(key, {})

        level = latest_live.get("level") or existing_idx.get("level") or base_obj["level"]
        pe = latest_live.get("pe") or existing_idx.get("pe") or base_obj["pe"]
        pb = latest_live.get("pb") or existing_idx.get("pb") or base_obj["pb"]
        div_yield = latest_live.get("divYield") or existing_idx.get("divYield") or base_obj["divYield"]

        m1_lvl = idx_snapshots.get("m1", {}).get(lookup_name, {}).get("level")
        m3_lvl = idx_snapshots.get("m3", {}).get(lookup_name, {}).get("level")
        m6_lvl = idx_snapshots.get("m6", {}).get(lookup_name, {}).get("level")
        y1_lvl = idx_snapshots.get("y1", {}).get(lookup_name, {}).get("level")

        r1m = calc_pct(level, m1_lvl) if has_live_latest else existing_idx.get("ret1m")
        r3m = calc_pct(level, m3_lvl) if has_live_latest else existing_idx.get("ret3m")
        r6m = calc_pct(level, m6_lvl) if has_live_latest else existing_idx.get("ret6m")
        r1y = calc_pct(level, y1_lvl) if has_live_latest else (existing_idx.get("ret1y") or existing_idx.get("cagr1y"))

        indices_out[key] = {
            "name": base_obj["name"],
            "role": base_obj["role"],
            "level": level,
            "pe": pe,
            "pb": pb,
            "divYield": div_yield,
            "ret1m": r1m if r1m is not None else existing_idx.get("ret1m"),
            "ret3m": r3m if r3m is not None else existing_idx.get("ret3m"),
            "ret6m": r6m if r6m is not None else existing_idx.get("ret6m"),
            "ret1y": r1y if r1y is not None else existing_idx.get("ret1y"),
            "cagr1y": r1y if r1y is not None else (existing_idx.get("cagr1y") or base_obj.get("cagr1y")),
            "cagr5y": base_obj["cagr5y"],
            "cagr10y": base_obj["cagr10y"],
        }

    live_pm = compute_live_precious_metals(opener, horizons, cfg.get("preciousMetals", {}))

    effective_as_of = horizons["latest"].isoformat() if has_live_latest else existing_pulse.get("asOf", horizons["latest"].isoformat())

    cfg_fx = float(cfg.get("macro", {}).get("usdInrRate", 87.50))
    live_fx = fetch_live_usdinr_rate(fallback_rate=cfg_fx)
    macro_payload = dict(cfg["macro"])
    macro_payload["usdInrRate"] = live_fx

    pulse_payload = {
        "asOf": effective_as_of,
        "lastTradingDay": effective_as_of,
        "horizons": {k: v.isoformat() for k, v in horizons.items()},
        "macro": macro_payload,
        "preciousMetals": live_pm,
        "indices": indices_out,
    }

    js_content = (
        f"// Auto-generated by admin/sync_market_data.py on {datetime.datetime.now().isoformat()}\n"
        f"window.KYF_MARKET_PULSE = {json.dumps(pulse_payload, indent=2)};\n"
    )

    out_path = os.path.join(DATA_DIR, "market-pulse.js")
    with open(out_path, "w", encoding="utf-8") as f:
        f.write(js_content)
    print(f"  [Success] Wrote Module 3 to {out_path} ({len(js_content)/1024:.1f} KB)")


# ============================================================================
# 4. BUILD MODULE 4 (`data/market-equities.js`)
# ============================================================================
def parse_nse_csv(csv_text: str) -> dict:
    if not csv_text:
        return {}
    reader = csv.reader(io.StringIO(csv_text))
    headers = [h.strip() for h in next(reader, [])]

    def idx(cols):
        for c in cols:
            if c in headers:
                return headers.index(c)
        return -1

    i_sym = idx(["TckrSymb", "SYMBOL"])
    i_srs = idx(["SctySrs", "SERIES"])
    i_name = idx(["FinInstrmNm"])
    i_close = idx(["ClsPric", "CLOSE"])
    i_isin = idx(["ISIN", "ISIN_CODE", "FinInstrmId"])

    result = {}
    for row in reader:
        if len(row) <= max(i_sym, i_srs, i_close):
            continue
        if row[i_srs].strip() != "EQ":
            continue
        sym = row[i_sym].strip()
        name = row[i_name].strip() if (i_name != -1 and i_name < len(row) and row[i_name].strip()) else sym
        try:
            close_val = float(row[i_close].strip())
            raw_isin = row[i_isin].strip().upper() if (i_isin != -1 and i_isin < len(row)) else ""
            isin = raw_isin if re.match(r"^IN[EF0][0-9A-Z]{9}$", raw_isin) else ""
            if sym and close_val > 0:
                result[sym] = {"name": name, "close": close_val, "isin": isin}
        except ValueError:
            continue
    return result


def load_nifty500_symbols(opener) -> set:
    n500_path = os.path.join(CACHE_DIR, "ind_nifty500list.csv")
    if not os.path.exists(n500_path):
        url = "https://nsearchives.nseindia.com/content/indices/ind_nifty500list.csv"
        try:
            resp = opener.open(url, timeout=15)
            content = resp.read()
            with open(n500_path, "wb") as f:
                f.write(content)
        except Exception as e:
            print(f"  [Info] Unable to download Nifty 500 list ({e})")
    syms = set()
    if os.path.exists(n500_path):
        with open(n500_path, "r", encoding="utf-8", errors="replace") as f:
            reader = csv.reader(f)
            header = next(reader, None)
            sym_idx = 2
            if header:
                for i, h in enumerate(header):
                    if "SYMBOL" in h.upper():
                        sym_idx = i
                        break
            for row in reader:
                if len(row) > sym_idx and row[sym_idx].strip():
                    syms.add(row[sym_idx].strip().upper())
    print(f"  [Loaded Nifty 500 Symbols] {len(syms)} constituents.")
    return syms


def build_equities_js(opener, horizons: dict, ca_data: dict = None):
    print("\n--- Building Module 4: data/market-equities.js ---")
    n500_symbols = load_nifty500_symbols(opener)
    snapshots = {}
    for key, dt in horizons.items():
        csv_text = fetch_nse_bhavcopy_csv(opener, dt)
        snapshots[key] = parse_nse_csv(csv_text)

    latest_map = snapshots.get("latest", {})
    if not latest_map:
        print("  [Skip] No Latest NSE data available.")
        return

    ca_by_symbol = ca_data.get("by_symbol", {}) if ca_data else {}
    latest_dt = horizons["latest"]

    def adjust_for_ca(sym, past_c, horizon_key):
        if not past_c or past_c <= 0:
            return past_c, False
        actions = ca_by_symbol.get(sym, [])
        if not actions:
            return past_c, False
        h_dt = horizons[horizon_key]
        adj_p = past_c
        adjusted = False
        for act in actions:
            ex_str = act.get("exDate")
            if not ex_str:
                continue
            try:
                ex_dt = datetime.date.fromisoformat(ex_str)
            except ValueError:
                continue
            if h_dt < ex_dt <= latest_dt:
                mult = act.get("multiplier", 1.0)
                if act.get("type") in ("SPLIT", "BONUS", "CONSOLIDATION") and mult > 0:
                    adj_p = adj_p * mult
                    adjusted = True
                elif act.get("type") == "DEMERGER":
                    return None, True
        return adj_p, adjusted

    tuples = []
    for sym in sorted(latest_map.keys()):
        c = latest_map[sym]["close"]
        name = latest_map[sym]["name"]
        cur_isin = latest_map[sym].get("isin", "")

        def calc_h(key, max_limit):
            past = snapshots.get(key, {}).get(sym, {})
            raw_past_c = past.get("close")
            adj_past_c, was_adj = adjust_for_ca(sym, raw_past_c, key)
            if adj_past_c is None:
                return None
            return calc_pct(c, adj_past_c, cur_isin, past.get("isin", ""), max_limit)

        tuples.append([
            sym,
            name,
            c,
            calc_h("m1", 70.0),
            calc_h("m3", 130.0),
            calc_h("m6", 220.0),
            calc_h("y1", 320.0),
            1 if sym in n500_symbols else 0,
            cur_isin or None,
        ])

    horizon_iso = {k: v.isoformat() for k, v in horizons.items()}
    body_lines = ",\n".join(f"  {json.dumps(t)}" for t in tuples)
    js_content = (
        f"// Auto-generated by admin/sync_market_data.py\n"
        f"window.KYF_MARKET_EQUITIES = {{\n"
        f'  asOf: "{horizons["latest"].isoformat()}",\n'
        f"  horizons: {json.dumps(horizon_iso)},\n"
        f'  columns: ["symbol", "companyName", "closePrice", "ret1m", "ret3m", "ret6m", "ret1y", "isN500", "isin"],\n'
        f"  nifty500Count: {len(n500_symbols)},\n"
        f"  stocks: [\n{body_lines}\n  ]\n"
        f"}};\n"
    )

    out_path = os.path.join(DATA_DIR, "market-equities.js")
    with open(out_path, "w", encoding="utf-8") as f:
        f.write(js_content)
    print(f"  [Success] Wrote {len(tuples)} stocks to {out_path} ({len(js_content)/1024:.1f} KB)")


# ============================================================================
# 5. BUILD MODULE 5 (`data/market-mf.js`)
# ============================================================================
# 5. BUILD MODULE 5 (`data/market-mf.js`)
# ============================================================================
def normalize_mf_category(raw_cat: str) -> str:
    r = (raw_cat or "").lower()
    if "small cap" in r:
        return "Small Cap"
    if "mid cap" in r:
        return "Mid Cap"
    if "large & mid" in r:
        return "Large & Mid Cap"
    if "large cap" in r or "index" in r:
        return "Large Cap & Index"
    if "flexi cap" in r or "multi cap" in r:
        return "Flexi Cap"
    if "elss" in r or "tax saver" in r:
        return "ELSS Tax Saver"
    if "hybrid" in r or "balanced advantage" in r or "dynamic asset" in r or "arbitrage" in r:
        return "Hybrid / BAF"
    if any(k in r for k in ["debt", "liquid", "money market", "gilt", "overnight", "corporate bond"]):
        return "Debt & Fixed Income"
    return raw_cat.strip() if raw_cat else "Open Ended"


def parse_amfi_txt(raw_text: str, is_latest: bool, code_names: dict = None):
    grouped = {}
    by_code = {}
    if not raw_text:
        return grouped if is_latest else by_code

    if code_names is None:
        code_names = {}

    current_cat = "Open Ended"
    is_open_ended = True

    for raw_line in raw_text.splitlines():
        line = raw_line.strip()
        if not line:
            continue
        if ";" not in line:
            if line.startswith("Open Ended Schemes"):
                is_open_ended = True
                m = re.search(r"\(([^)]+)\)", line)
                current_cat = re.sub(r"(?i)scheme\s*-\s*", "", m.group(1)).strip() if m else "Open Ended"
            elif line.startswith("Close Ended") or line.startswith("Interval Fund"):
                is_open_ended = False
            continue

        if not is_open_ended:
            continue
        parts = line.split(";")
        if len(parts) < 5:
            continue
        try:
            code = int(parts[0].strip())
            nav_str = parts[-2].strip()
            if nav_str in ("-", "N.A.", ""):
                continue
            nav = float(nav_str)
        except ValueError:
            continue

        if nav <= 0:
            continue
        by_code[code] = nav

        if is_latest:
            # Extract Growth ISIN from AMFI semicolon-delimited columns (typically parts[1] or parts[2])
            scheme_isin = None
            for p_cand in parts[1:3]:
                cand = p_cand.strip().upper()
                if re.match(r"^INF[0-9A-Z]{9}$", cand):
                    scheme_isin = cand
                    break

            # Scheme name can be in parts[3] (8-column format) or parts[1] (6-column format)
            raw_name = parts[3].strip() if len(parts) > 3 and parts[3].strip() else parts[1].strip()
            plan = parts[4].strip() if len(parts) > 4 else ""
            option = parts[5].strip() if len(parts) > 5 else ""

            # Check if name is found in code_names fallback (e.g. Motilal Oswal Midcap with blank plan/option in AMFI)
            fallback_nm = code_names.get(code, "")
            full_desc = f"{raw_name} {plan} {option} {fallback_nm}".strip()
            full_lower = full_desc.lower()

            # Ignore IDCW / dividend / bonus / payout / reinvestment / periodic frequency / segregated portfolios
            if re.search(r"(?i)idcw|dividend|bonus|payout|reinvestment|weekly|daily|monthly|quarterly|segregated", full_lower):
                continue
            # Must be Growth
            if not re.search(r"(?i)growth", full_lower):
                continue

            is_direct = bool(re.search(r"(?i)\bdirect\b", full_lower))
            is_regular = bool(re.search(r"(?i)\bregular\b", full_lower)) or (not is_direct and "growth" in full_lower)

            base_key = re.sub(r"(?i)\b(direct|regular|plan|option|growth)\b", "", raw_name)
            base_key = re.sub(r"[^a-zA-Z0-9]", "", base_key).lower()
            if not base_key:
                continue

            if base_key not in grouped:
                clean_display = re.sub(r"(?i)\s*-\s*(direct|regular)\s*(plan)?", "", raw_name)
                clean_display = re.sub(r"(?i)\s*-\s*growth\s*(option)?", "", clean_display)
                clean_display = re.sub(r"(?i)\s+direct\s+plan\b", "", clean_display)
                clean_display = re.sub(r"(?i)\s+direct\s+growth\b", "", clean_display)
                clean_display = re.sub(r"(?i)\s+growth\s*(option)?\b", "", clean_display)
                clean_display = re.sub(r"\s*-\s*$", "", clean_display).strip()
                if not clean_display:
                    clean_display = raw_name

                grouped[base_key] = {
                    "directCode": None,
                    "cleanName": clean_display,
                    "category": normalize_mf_category(current_cat),
                    "directNav": None,
                    "regularNav": None,
                    "directIsin": None,
                    "regularIsin": None,
                }

            if is_direct:
                grouped[base_key]["directCode"] = code
                grouped[base_key]["directNav"] = nav
                if scheme_isin:
                    grouped[base_key]["directIsin"] = scheme_isin
            elif is_regular:
                grouped[base_key]["regularNav"] = nav
                if scheme_isin:
                    grouped[base_key]["regularIsin"] = scheme_isin

    return grouped if is_latest else by_code


def build_mf_js(opener, horizons: dict):
    print("\n--- Building Module 5: data/market-mf.js ---")
    snapshots = {}
    code_names = {}

    for idx, (key, dt) in enumerate(horizons.items()):
        txt = fetch_amfi_nav_txt(opener, dt, is_latest=(idx == 0))
        if idx > 0 and txt:
            # Populate code_names from historical AMFI files
            for line in txt.splitlines():
                if ";" in line and not line.strip().startswith("Scheme"):
                    parts = line.strip().split(";")
                    if len(parts) >= 5:
                        try:
                            c = int(parts[0].strip())
                            nm = parts[1].strip() if len(parts) > 1 and parts[1].strip() else parts[3].strip()
                            if nm and c not in code_names:
                                code_names[c] = nm
                        except Exception:
                            pass
        snapshots[key] = parse_amfi_txt(txt, is_latest=(idx == 0), code_names=code_names)

    # Re-parse latest if code_names had extra lookups
    if code_names:
        latest_txt = fetch_amfi_nav_txt(opener, horizons["latest"], is_latest=True)
        snapshots["latest"] = parse_amfi_txt(latest_txt, is_latest=True, code_names=code_names)

    latest_grouped = snapshots.get("latest", {})
    if not latest_grouped:
        print("  [Skip] No Latest AMFI NAV data available.")
        return

    tuples = []
    for item in latest_grouped.values():
        code = item["directCode"]
        nav = item["directNav"]
        if not code or nav is None:
            continue
        tuples.append([
            code,
            item["cleanName"],
            item["category"],
            nav,
            item["regularNav"],
            calc_pct(nav, snapshots["m1"].get(code)),
            calc_pct(nav, snapshots["m3"].get(code)),
            calc_pct(nav, snapshots["m6"].get(code)),
            calc_pct(nav, snapshots["y1"].get(code)),
            item.get("directIsin"),
            item.get("regularIsin"),
        ])

    tuples.sort(key=lambda x: x[0])
    horizon_iso = {k: v.isoformat() for k, v in horizons.items()}
    body_lines = ",\n".join(f"  {json.dumps(t)}" for t in tuples)
    js_content = (
        f"// Auto-generated by admin/sync_market_data.py\n"
        f"window.KYF_MARKET_MF = {{\n"
        f'  asOf: "{horizons["latest"].isoformat()}",\n'
        f"  horizons: {json.dumps(horizon_iso)},\n"
        f'  columns: ["directCode", "fundName", "category", "directNav", "regularNav", "ret1m", "ret3m", "ret6m", "ret1y", "directIsin", "regularIsin"],\n'
        f"  schemes: [\n{body_lines}\n  ]\n"
        f"}};\n"
    )

    out_path = os.path.join(DATA_DIR, "market-mf.js")
    with open(out_path, "w", encoding="utf-8") as f:
        f.write(js_content)
    print(f"  [Success] Wrote {len(tuples)} MF schemes to {out_path} ({len(js_content)/1024:.1f} KB)")


# ============================================================================
# MODULE 5B: US EQUITIES, ETFS & MUTUAL FUNDS (NASDAQ-100 & TOP US FUNDS)
# ============================================================================

NASDAQ_100_TICKERS = [
    "AAPL", "ABNB", "ADBE", "ADI", "ADP", "ADSK", "AEP", "AMAT", "AMD", "AMGN",
    "AMZN", "APP", "ARM", "ASML", "AVGO", "AXON", "AZN", "BIIB", "BKNG", "BKR",
    "CCEP", "CDNS", "CDW", "CEG", "CHTR", "CMCSA", "COST", "CPRT", "CRWD", "CSCO",
    "CSGP", "CSX", "CTAS", "CTSH", "DASH", "DDOG", "DLTR", "DXCM", "EA", "EXC",
    "FANG", "FAST", "FTNT", "GEHC", "GFS", "GILD", "GOOG", "GOOGL", "HON", "IDXX",
    "ILMN", "INTC", "INTU", "ISRG", "KDP", "KHC", "KLAC", "LIN", "LRCX", "LULU",
    "MAR", "MCHP", "MDB", "MDLZ", "MELI", "META", "MNST", "MRNA", "MRVL", "MSFT",
    "MU", "NFLX", "NVDA", "NXPI", "ODFL", "ON", "ORLY", "PANW", "PAYX", "PCAR",
    "PDD", "PEP", "PLTR", "PYPL", "QCOM", "REGN", "ROP", "ROST", "SBUX", "SNPS",
    "TEAM", "TMUS", "TSLA", "TTD", "TTWO", "TXN", "VRSK", "VRTX", "WBD", "WDAY",
    "XEL", "ZS",
]

TOP_US_FUNDS_AND_ETFS = [
    # Major US Broad Market & Factor ETFs
    "SPY", "VOO", "IVV", "VTI", "QQQ", "QQQM", "DIA", "IWM", "IWF", "IWD",
    "VOOG", "VOOV", "VUG", "VTV", "SCHD", "VYM", "VIG", "DGRO", "RSP", "VT",
    # Sector, Thematic & Clean Energy ETFs
    "TAN", "ICLN", "QCLN", "URA", "LIT", "BOTZ", "ARKK", "ARKG", "SMH", "SOXX",
    "SOXL", "TQQQ", "SQQQ", "XLK", "XLF", "XLV", "XLE", "XLI", "XLC", "XLY",
    "XLP", "XLU", "XLRE", "XLB", "VNQ",
    # Biotechnology, Cyber & Software ETFs
    "IBB", "XBI", "CIBR", "IGV", "IBIT", "FBTC",
    # International & Emerging Market ETFs
    "VXUS", "VEA", "VWO", "IEMG", "EEM", "INDA", "EPI", "INDY", "FLIN", "MCHI",
    "KWEB", "FXI", "EWJ", "VGK", "EFA",
    # Commodity & Fixed Income / Treasury ETFs
    "GLD", "IAU", "SLV", "GDX", "USO", "UNG", "BND", "AGG", "TLT", "IEF",
    "SHY", "SGOV", "BIL", "VCIT", "VCSH", "LQD", "HYG", "TIP",
    # Income & Dividend Premium ETFs
    "JEPI", "JEPQ", "DIVO", "GPIX",
    # Top US Mutual Funds (Vanguard, Fidelity, Schwab, American Funds, T. Rowe Price, Dodge & Cox)
    "FXAIX", "VFIAX", "VTSAX", "VTIAX", "VBTLX", "FSKAX", "FTIHX", "FXNAX", "SWPPX", "SWTSX",
    "SWISX", "SWAGX", "FCNTX", "VWENX", "FZROX", "FNILX", "VIGAX", "VVIAX", "VWUSX", "VGSLX",
    "VSMAX", "VIMAX", "VWINX", "AGTHX", "AIVSX", "ANCFX", "CWGIX", "PRGFX", "TRBCX", "DODGX",
    "DODFX", "DODIX", "FBGRX", "FLPSX", "FDGRX",
]

ALL_US_TICKERS = sorted(list(set(NASDAQ_100_TICKERS + TOP_US_FUNDS_AND_ETFS)))

KNOWN_US_METADATA = {
    # NASDAQ-100 & Mega-Cap US Equities
    "AAPL": ("Apple Inc.", "EQUITY"),
    "ABNB": ("Airbnb Inc.", "EQUITY"),
    "ADBE": ("Adobe Inc.", "EQUITY"),
    "ADI": ("Analog Devices Inc.", "EQUITY"),
    "ADP": ("Automatic Data Processing", "EQUITY"),
    "ADSK": ("Autodesk Inc.", "EQUITY"),
    "AEP": ("American Electric Power", "EQUITY"),
    "AMAT": ("Applied Materials Inc.", "EQUITY"),
    "AMD": ("Advanced Micro Devices Inc.", "EQUITY"),
    "AMGN": ("Amgen Inc.", "EQUITY"),
    "AMZN": ("Amazon.com Inc.", "EQUITY"),
    "APP": ("AppLovin Corporation", "EQUITY"),
    "ARM": ("Arm Holdings plc", "EQUITY"),
    "ASML": ("ASML Holding N.V.", "EQUITY"),
    "AVGO": ("Broadcom Inc.", "EQUITY"),
    "AXON": ("Axon Enterprise Inc.", "EQUITY"),
    "AZN": ("AstraZeneca PLC", "EQUITY"),
    "BAC": ("Bank of America Corporation", "EQUITY"),
    "BIIB": ("Biogen Inc.", "EQUITY"),
    "BKNG": ("Booking Holdings Inc.", "EQUITY"),
    "BKR": ("Baker Hughes Company", "EQUITY"),
    "BRK.A": ("Berkshire Hathaway Inc. (Class A)", "EQUITY"),
    "BRK.B": ("Berkshire Hathaway Inc. (Class B)", "EQUITY"),
    "CCEP": ("Coca-Cola Europacific Partners", "EQUITY"),
    "CDNS": ("Cadence Design Systems", "EQUITY"),
    "CDW": ("CDW Corporation", "EQUITY"),
    "CEG": ("Constellation Energy Corporation", "EQUITY"),
    "CHTR": ("Charter Communications", "EQUITY"),
    "CMCSA": ("Comcast Corporation", "EQUITY"),
    "COIN": ("Coinbase Global Inc.", "EQUITY"),
    "COST": ("Costco Wholesale Corporation", "EQUITY"),
    "CPRT": ("Copart Inc.", "EQUITY"),
    "CRM": ("Salesforce Inc.", "EQUITY"),
    "CRWD": ("CrowdStrike Holdings Inc.", "EQUITY"),
    "CSCO": ("Cisco Systems Inc.", "EQUITY"),
    "CSGP": ("CoStar Group Inc.", "EQUITY"),
    "CSX": ("CSX Corporation", "EQUITY"),
    "CTAS": ("Cintas Corporation", "EQUITY"),
    "CTSH": ("Cognizant Technology Solutions", "EQUITY"),
    "DASH": ("DoorDash Inc.", "EQUITY"),
    "DDOG": ("Datadog Inc.", "EQUITY"),
    "DLTR": ("Dollar Tree Inc.", "EQUITY"),
    "DXCM": ("DexCom Inc.", "EQUITY"),
    "EA": ("Electronic Arts Inc.", "EQUITY"),
    "EXC": ("Exelon Corporation", "EQUITY"),
    "FANG": ("Diamondback Energy Inc.", "EQUITY"),
    "FAST": ("Fastenal Company", "EQUITY"),
    "FTNT": ("Fortinet Inc.", "EQUITY"),
    "GEHC": ("GE HealthCare Technologies", "EQUITY"),
    "GFS": ("GlobalFoundries Inc.", "EQUITY"),
    "GILD": ("Gilead Sciences Inc.", "EQUITY"),
    "GOOG": ("Alphabet Inc. (Class C)", "EQUITY"),
    "GOOGL": ("Alphabet Inc. (Class A)", "EQUITY"),
    "HD": ("The Home Depot Inc.", "EQUITY"),
    "HON": ("Honeywell International Inc.", "EQUITY"),
    "IDXX": ("IDEXX Laboratories Inc.", "EQUITY"),
    "ILMN": ("Illumina Inc.", "EQUITY"),
    "INTC": ("Intel Corporation", "EQUITY"),
    "INTU": ("Intuit Inc.", "EQUITY"),
    "ISRG": ("Intuitive Surgical Inc.", "EQUITY"),
    "JNJ": ("Johnson & Johnson", "EQUITY"),
    "JPM": ("JPMorgan Chase & Co.", "EQUITY"),
    "KDP": ("Keurig Dr Pepper Inc.", "EQUITY"),
    "KHC": ("The Kraft Heinz Company", "EQUITY"),
    "KLAC": ("KLA Corporation", "EQUITY"),
    "LIN": ("Linde plc", "EQUITY"),
    "LLY": ("Eli Lilly and Company", "EQUITY"),
    "LRCX": ("Lam Research Corporation", "EQUITY"),
    "LULU": ("Lululemon Athletica Inc.", "EQUITY"),
    "MA": ("Mastercard Incorporated", "EQUITY"),
    "MAR": ("Marriott International Inc.", "EQUITY"),
    "MCHP": ("Microchip Technology Inc.", "EQUITY"),
    "MDB": ("MongoDB Inc.", "EQUITY"),
    "MDLZ": ("Mondelez International Inc.", "EQUITY"),
    "MELI": ("MercadoLibre Inc.", "EQUITY"),
    "META": ("Meta Platforms Inc.", "EQUITY"),
    "MNST": ("Monster Beverage Corporation", "EQUITY"),
    "MRNA": ("Moderna Inc.", "EQUITY"),
    "MRVL": ("Marvell Technology Inc.", "EQUITY"),
    "MSFT": ("Microsoft Corporation", "EQUITY"),
    "MSTR": ("MicroStrategy Inc.", "EQUITY"),
    "MU": ("Micron Technology Inc.", "EQUITY"),
    "NFLX": ("Netflix Inc.", "EQUITY"),
    "NVDA": ("NVIDIA Corporation", "EQUITY"),
    "NXPI": ("NXP Semiconductors N.V.", "EQUITY"),
    "ODFL": ("Old Dominion Freight Line", "EQUITY"),
    "ON": ("ON Semiconductor Corporation", "EQUITY"),
    "ORCL": ("Oracle Corporation", "EQUITY"),
    "ORLY": ("O'Reilly Automotive Inc.", "EQUITY"),
    "PANW": ("Palo Alto Networks Inc.", "EQUITY"),
    "PAYX": ("Paychex Inc.", "EQUITY"),
    "PCAR": ("PACCAR Inc.", "EQUITY"),
    "PDD": ("PDD Holdings Inc.", "EQUITY"),
    "PEP": ("PepsiCo Inc.", "EQUITY"),
    "PG": ("Procter & Gamble Co.", "EQUITY"),
    "PLTR": ("Palantir Technologies Inc.", "EQUITY"),
    "PYPL": ("PayPal Holdings Inc.", "EQUITY"),
    "QCOM": ("Qualcomm Incorporated", "EQUITY"),
    "REGN": ("Regeneron Pharmaceuticals Inc.", "EQUITY"),
    "ROP": ("Roper Technologies Inc.", "EQUITY"),
    "ROST": ("Ross Stores Inc.", "EQUITY"),
    "SBUX": ("Starbucks Corporation", "EQUITY"),
    "SNPS": ("Synopsys Inc.", "EQUITY"),
    "TEAM": ("Atlassian Corporation", "EQUITY"),
    "TMUS": ("T-Mobile US Inc.", "EQUITY"),
    "TSLA": ("Tesla Inc.", "EQUITY"),
    "TTD": ("The Trade Desk Inc.", "EQUITY"),
    "TTWO": ("Take-Two Interactive Software", "EQUITY"),
    "TXN": ("Texas Instruments Incorporated", "EQUITY"),
    "UBER": ("Uber Technologies Inc.", "EQUITY"),
    "UNH": ("UnitedHealth Group Inc.", "EQUITY"),
    "V": ("Visa Inc.", "EQUITY"),
    "VRSK": ("Verisk Analytics Inc.", "EQUITY"),
    "VRTX": ("Vertex Pharmaceuticals Inc.", "EQUITY"),
    "WBD": ("Warner Bros. Discovery Inc.", "EQUITY"),
    "WDAY": ("Workday Inc.", "EQUITY"),
    "WMT": ("Walmart Inc.", "EQUITY"),
    "XEL": ("Xcel Energy Inc.", "EQUITY"),
    "XOM": ("Exxon Mobil Corporation", "EQUITY"),
    "ZS": ("Zscaler Inc.", "EQUITY"),

    # Major Broad Market, Index & Factor ETFs
    "VOO": ("Vanguard S&P 500 ETF", "ETF"),
    "VOOG": ("Vanguard S&P 500 Growth ETF", "ETF"),
    "VOOV": ("Vanguard S&P 500 Value ETF", "ETF"),
    "VUG": ("Vanguard Growth ETF", "ETF"),
    "VTV": ("Vanguard Value ETF", "ETF"),
    "VTI": ("Vanguard Total Stock Market ETF", "ETF"),
    "QQQ": ("Invesco QQQ Trust (Nasdaq-100)", "ETF"),
    "QQQM": ("Invesco NASDAQ 100 ETF", "ETF"),
    "SPY": ("SPDR S&P 500 ETF Trust", "ETF"),
    "IVV": ("iShares Core S&P 500 ETF", "ETF"),
    "DIA": ("SPDR Dow Jones Industrial Average ETF", "ETF"),
    "IWM": ("iShares Russell 2000 ETF", "ETF"),
    "IWF": ("iShares Russell 1000 Growth ETF", "ETF"),
    "IWD": ("iShares Russell 1000 Value ETF", "ETF"),
    "SCHD": ("Schwab U.S. Dividend Equity ETF", "ETF"),
    "VYM": ("Vanguard High Dividend Yield ETF", "ETF"),
    "VIG": ("Vanguard Dividend Appreciation ETF", "ETF"),
    "DGRO": ("iShares Core Dividend Growth ETF", "ETF"),
    "RSP": ("Invesco S&P 500 Equal Weight ETF", "ETF"),
    "VT": ("Vanguard Total World Stock ETF", "ETF"),

    # Sector, Thematic & Innovation ETFs
    "TAN": ("Invesco Solar ETF", "ETF"),
    "ICLN": ("iShares Global Clean Energy ETF", "ETF"),
    "QCLN": ("First Trust NASDAQ Clean Edge Green Energy ETF", "ETF"),
    "URA": ("Global X Uranium ETF", "ETF"),
    "LIT": ("Global X Lithium & Battery Tech ETF", "ETF"),
    "BOTZ": ("Global X Robotics & AI ETF", "ETF"),
    "ARKK": ("ARK Innovation ETF", "ETF"),
    "ARKG": ("ARK Genomic Revolution ETF", "ETF"),
    "SMH": ("VanEck Semiconductor ETF", "ETF"),
    "SOXX": ("iShares Semiconductor ETF", "ETF"),
    "SOXL": ("Direxion Daily Semiconductor Bull 3X", "ETF"),
    "TQQQ": ("ProShares UltraPro QQQ 3X", "ETF"),
    "SQQQ": ("ProShares UltraPro Short QQQ -3X", "ETF"),
    "XLK": ("Technology Select Sector SPDR Fund", "ETF"),
    "XLF": ("Financial Select Sector SPDR Fund", "ETF"),
    "XLE": ("Energy Select Sector SPDR Fund", "ETF"),
    "XLV": ("Health Care Select Sector SPDR Fund", "ETF"),
    "XLI": ("Industrial Select Sector SPDR Fund", "ETF"),
    "XLC": ("Communication Services Select Sector SPDR", "ETF"),
    "XLY": ("Consumer Discretionary Select Sector SPDR Fund", "ETF"),
    "XLP": ("Consumer Staples Select Sector SPDR Fund", "ETF"),
    "XLU": ("Utilities Select Sector SPDR Fund", "ETF"),
    "XLRE": ("Real Estate Select Sector SPDR Fund", "ETF"),
    "XLB": ("Materials Select Sector SPDR Fund", "ETF"),
    "VNQ": ("Vanguard Real Estate ETF", "ETF"),
    "IBB": ("iShares Biotechnology ETF", "ETF"),
    "XBI": ("SPDR S&P Biotech ETF", "ETF"),
    "CIBR": ("First Trust NASDAQ Cybersecurity ETF", "ETF"),
    "IGV": ("iShares Expanded Tech-Software Sector ETF", "ETF"),
    "IBIT": ("iShares Bitcoin Trust ETF", "ETF"),
    "FBTC": ("Fidelity Wise Origin Bitcoin Fund", "ETF"),

    # International & Emerging Market ETFs
    "VXUS": ("Vanguard Total International Stock ETF", "ETF"),
    "VEA": ("Vanguard FTSE Developed Markets ETF", "ETF"),
    "VWO": ("Vanguard FTSE Emerging Markets ETF", "ETF"),
    "IEMG": ("iShares Core MSCI Emerging Markets ETF", "ETF"),
    "EEM": ("iShares MSCI Emerging Markets ETF", "ETF"),
    "INDA": ("iShares MSCI India ETF", "ETF"),
    "EPI": ("WisdomTree India Earnings Fund", "ETF"),
    "INDY": ("iShares India 50 ETF", "ETF"),
    "FLIN": ("Franklin FTSE India ETF", "ETF"),
    "MCHI": ("iShares MSCI China ETF", "ETF"),
    "KWEB": ("KraneShares CSI China Internet ETF", "ETF"),
    "FXI": ("iShares China Large-Cap ETF", "ETF"),
    "EWJ": ("iShares MSCI Japan ETF", "ETF"),
    "VGK": ("Vanguard FTSE Europe ETF", "ETF"),
    "EFA": ("iShares MSCI EAFE ETF", "ETF"),

    # Commodity & Fixed Income / Treasury ETFs
    "GLD": ("SPDR Gold Shares", "ETF"),
    "IAU": ("iShares Gold Trust", "ETF"),
    "SLV": ("iShares Silver Trust", "ETF"),
    "GDX": ("VanEck Gold Miners ETF", "ETF"),
    "USO": ("United States Oil Fund", "ETF"),
    "UNG": ("United States Natural Gas Fund", "ETF"),
    "BND": ("Vanguard Total Bond Market ETF", "ETF"),
    "AGG": ("iShares Core U.S. Aggregate Bond ETF", "ETF"),
    "TLT": ("iShares 20+ Year Treasury Bond ETF", "ETF"),
    "IEF": ("iShares 7-10 Year Treasury Bond ETF", "ETF"),
    "SHY": ("iShares 1-3 Year Treasury Bond ETF", "ETF"),
    "SGOV": ("iShares 0-3 Month Treasury Bond ETF", "ETF"),
    "BIL": ("SPDR Bloomberg 1-3 Month T-Bill ETF", "ETF"),
    "VCIT": ("Vanguard Intermediate-Term Corporate Bond ETF", "ETF"),
    "VCSH": ("Vanguard Short-Term Corporate Bond ETF", "ETF"),
    "LQD": ("iShares iBoxx $ Investment Grade Corporate Bond ETF", "ETF"),
    "HYG": ("iShares iBoxx $ High Yield Corporate Bond ETF", "ETF"),
    "TIP": ("iShares TIPS Bond ETF", "ETF"),
    "JEPI": ("JPMorgan Equity Premium Income ETF", "ETF"),
    "JEPQ": ("JPMorgan Nasdaq Equity Premium Income ETF", "ETF"),
    "DIVO": ("Amplify CWP Enhanced Dividend Income ETF", "ETF"),
    "GPIX": ("Goldman Sachs S&P 500 Core Premium Income ETF", "ETF"),

    # Top US Mutual Funds (Vanguard, Fidelity, Schwab, American Funds, T. Rowe Price, Dodge & Cox)
    "FXAIX": ("Fidelity 500 Index Fund", "MUTUAL_FUND"),
    "VFIAX": ("Vanguard 500 Index Fund Admiral", "MUTUAL_FUND"),
    "VTSAX": ("Vanguard Total Stock Market Index Admiral", "MUTUAL_FUND"),
    "VTIAX": ("Vanguard Total International Stock Index Admiral", "MUTUAL_FUND"),
    "VBTLX": ("Vanguard Total Bond Market Index Admiral", "MUTUAL_FUND"),
    "FSKAX": ("Fidelity Total Market Index Fund", "MUTUAL_FUND"),
    "FTIHX": ("Fidelity Total International Index Fund", "MUTUAL_FUND"),
    "FXNAX": ("Fidelity U.S. Bond Index Fund", "MUTUAL_FUND"),
    "SWPPX": ("Schwab S&P 500 Index Fund", "MUTUAL_FUND"),
    "SWTSX": ("Schwab Total Stock Market Index Fund", "MUTUAL_FUND"),
    "SWISX": ("Schwab International Index Fund", "MUTUAL_FUND"),
    "SWAGX": ("Schwab U.S. Aggregate Bond Index Fund", "MUTUAL_FUND"),
    "FCNTX": ("Fidelity Contrafund", "MUTUAL_FUND"),
    "VWENX": ("Vanguard Wellington Fund Admiral", "MUTUAL_FUND"),
    "FZROX": ("Fidelity ZERO Total Market Index", "MUTUAL_FUND"),
    "FNILX": ("Fidelity ZERO Large Cap Index", "MUTUAL_FUND"),
    "VIGAX": ("Vanguard Growth Index Fund Admiral", "MUTUAL_FUND"),
    "VVIAX": ("Vanguard Value Index Fund Admiral", "MUTUAL_FUND"),
    "VWUSX": ("Vanguard U.S. Growth Fund", "MUTUAL_FUND"),
    "VGSLX": ("Vanguard Real Estate Index Fund Admiral", "MUTUAL_FUND"),
    "VSMAX": ("Vanguard Small-Cap Index Fund Admiral", "MUTUAL_FUND"),
    "VIMAX": ("Vanguard Mid-Cap Index Fund Admiral", "MUTUAL_FUND"),
    "VWINX": ("Vanguard Wellesley Income Fund", "MUTUAL_FUND"),
    "AGTHX": ("American Funds The Growth Fund of America", "MUTUAL_FUND"),
    "AIVSX": ("American Funds Investment Company of America", "MUTUAL_FUND"),
    "ANCFX": ("American Funds Fundamental Investors", "MUTUAL_FUND"),
    "CWGIX": ("American Funds Capital World Growth and Income", "MUTUAL_FUND"),
    "PRGFX": ("T. Rowe Price Growth Stock Fund", "MUTUAL_FUND"),
    "TRBCX": ("T. Rowe Price Blue Chip Growth Fund", "MUTUAL_FUND"),
    "DODGX": ("Dodge & Cox Stock Fund", "MUTUAL_FUND"),
    "DODFX": ("Dodge & Cox International Stock Fund", "MUTUAL_FUND"),
    "DODIX": ("Dodge & Cox Income Fund", "MUTUAL_FUND"),
    "FBGRX": ("Fidelity Blue Chip Growth Fund", "MUTUAL_FUND"),
    "FLPSX": ("Fidelity Low-Priced Stock Fund", "MUTUAL_FUND"),
    "FDGRX": ("Fidelity Growth Company Fund", "MUTUAL_FUND"),
}


def clean_sec_title(title: str) -> str:
    """Converts ALL-CAPS SEC company names to clean Title Case while preserving standard acronyms."""
    if not title:
        return ""
    if title.isupper():
        words = title.split()
        preserved = {"LLC", "LP", "PLC", "ETF", "USA", "UK", "US", "INC", "CORP", "CO", "LTD", "S&P"}
        cleaned = []
        for w in words:
            up = w.upper()
            if up in ("INC", "CORP", "CO", "LTD"):
                cleaned.append(w.capitalize() + ("." if not w.endswith(".") else ""))
            elif up in preserved:
                cleaned.append("S&P" if up == "S&P" else up)
            else:
                cleaned.append(w.capitalize())
        return " ".join(cleaned)
    return title


def fetch_sec_company_tickers(cache_dir: str = CACHE_DIR, max_age_days: int = 30) -> dict:
    """
    Loads 10,000+ US public company / ETF ticker symbols from local cache or official SEC feed.
    Feed: https://www.sec.gov/files/company_tickers.json
    Cache: admin/.cache/sec_company_tickers.json (TTL: 30 days)
    """
    cache_file = os.path.join(cache_dir, "sec_company_tickers.json")

    # 1. Return fresh cache if available (< 30 days old)
    if os.path.exists(cache_file) and os.path.getsize(cache_file) > 1000:
        age_days = (datetime.datetime.now().timestamp() - os.path.getmtime(cache_file)) / 86400
        if age_days < max_age_days:
            try:
                with open(cache_file, "r", encoding="utf-8") as f:
                    return json.load(f)
            except Exception:
                pass

    # 2. Attempt download from SEC EDGAR
    url = "https://www.sec.gov/files/company_tickers.json"
    headers = {
        "User-Agent": "KYF_Portfolio_Tracker/1.9 admin@kyf.local",
        "Accept-Encoding": "gzip, deflate",
    }
    try:
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req, timeout=15) as resp:
            content = resp.read()
            if resp.info().get("Content-Encoding") == "gzip":
                content = gzip.decompress(content)
            raw = json.loads(content.decode("utf-8"))

        ticker_map = {}
        for entry in raw.values():
            t = (entry.get("ticker") or "").strip().upper()
            title = (entry.get("title") or "").strip()
            if t and title:
                ticker_map[t] = title

        with open(cache_file, "w", encoding="utf-8") as f:
            json.dump(ticker_map, f)
        print(f"  [SEC Cache Updated] Cached {len(ticker_map)} company tickers to {cache_file}")
        return ticker_map
    except Exception as e:
        # Fall back to existing cache if available (even if expired)
        if os.path.exists(cache_file):
            try:
                with open(cache_file, "r", encoding="utf-8") as f:
                    return json.load(f)
            except Exception:
                pass
        print(f"  [Info] SEC ticker feed unavailable ({e}); using built-in metadata.")
        return {}


def fetch_us_bhavcopy_yfinance(tickers: list = None) -> bool:
    """
    Downloads daily US market quotes using yfinance (NASDAQ-100 + Top US Funds/ETFs).
    Saves:
      - data/us_bhavcopy_{date_str}.csv (dated archive)
      - data/us_bhavcopy_latest.csv (master latest dataset)
      - data/us_bhavcopy.csv (mirror for backward compatibility)
    Returns True on success, or False if yfinance is not available/fails.
    """
    all_tickers = sorted(list(set(tickers or ALL_US_TICKERS)))
    print(f"\n--- Fetching US Bhavcopy for {len(all_tickers)} Tickers (NASDAQ-100 & Top US Funds/ETFs) ---")

    try:
        import yfinance as yf
        import requests
        import pandas as pd
    except ImportError:
        print("  [US Bhavcopy Info] yfinance, requests, or pandas not installed in this environment.")
        return False

    # Load existing prices so no ticker loses its price on temporary rate-limits
    existing_prices = {}
    latest_file = os.path.join(DATA_DIR, "us_bhavcopy_latest.csv")
    if os.path.exists(latest_file):
        try:
            with open(latest_file, "r", encoding="utf-8") as f:
                for row in csv.DictReader(f):
                    t = (row.get("Ticker") or "").strip().upper()
                    c = (row.get("Close") or "").strip()
                    if t and c:
                        existing_prices[t] = c
        except Exception:
            pass

    session = requests.Session()
    session.headers.update({
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    })

    try:
        print(f"  [US Bhavcopy] Downloading batch data from Yahoo Finance for {len(all_tickers)} tickers...")
        data = yf.download(all_tickers, period="1d", session=session, progress=False)
        if data is None or getattr(data, "empty", True):
            print("  [US Bhavcopy Warning] Yahoo Finance returned empty dataset; falling back.")
            return False
        print("  [US Bhavcopy] Data successfully downloaded from Yahoo Finance.")
    except Exception as e:
        print(f"  [US Bhavcopy Warning] yfinance download encountered an error ({e}); using fallback.")
        return False

    now = datetime.datetime.utcnow()
    date_str = now.strftime("%Y-%m-%d")
    update_time = now.strftime("%Y-%m-%d %H:%M:%S")

    archive_file = os.path.join(DATA_DIR, f"us_bhavcopy_{date_str}.csv")
    backup_file = os.path.join(DATA_DIR, "us_bhavcopy.csv")

    rows_to_write = [["Ticker", "Close", "Last_Updated_UTC"]]
    active_count = 0

    for ticker in all_tickers:
        close_price = None
        try:
            if isinstance(data.columns, pd.MultiIndex):
                if ('Close', ticker) in data.columns:
                    s = data[('Close', ticker)].dropna()
                    if not s.empty:
                        close_price = s.iloc[-1]
                elif (ticker, 'Close') in data.columns:
                    s = data[(ticker, 'Close')].dropna()
                    if not s.empty:
                        close_price = s.iloc[-1]
                elif 'Close' in data and ticker in data['Close']:
                    s = data['Close'][ticker].dropna()
                    if not s.empty:
                        close_price = s.iloc[-1]
            elif 'Close' in data:
                if ticker in data['Close']:
                    s = data['Close'][ticker].dropna()
                    if not s.empty:
                        close_price = s.iloc[-1]
                elif len(all_tickers) == 1:
                    s = data['Close'].dropna()
                    if not s.empty:
                        close_price = s.iloc[-1]
        except Exception:
            pass

        if close_price is not None and not pd.isna(close_price):
            val_str = str(round(float(close_price), 4))
            rows_to_write.append([ticker, val_str, update_time])
            active_count += 1
        elif ticker in existing_prices:
            rows_to_write.append([ticker, existing_prices[ticker], update_time])
            active_count += 1
        else:
            rows_to_write.append([ticker, "", update_time])

    # Save to all target files
    for filepath in [archive_file, latest_file, backup_file]:
        with open(filepath, mode="w", newline="", encoding="utf-8") as f:
            writer = csv.writer(f)
            writer.writerows(rows_to_write)

    print(f"  [US Bhavcopy Success] Saved {archive_file} and {latest_file} ({active_count}/{len(all_tickers)} active quotes)")
    return True


def fetch_remote_us_bhavcopy_from_repo() -> bool:
    """
    Module 5B Step 0: Fetches the latest us_bhavcopy_latest.csv from the GitHub repository
    prior to building data/market-us.js. Ensures cloud updates are synced down to local.
    """
    target_path = os.path.join(DATA_DIR, "us_bhavcopy_latest.csv")
    backup_path = os.path.join(DATA_DIR, "us_bhavcopy.csv")

    candidate_urls = [
        "https://raw.githubusercontent.com/deshvenkateshblr/kyf/master/data/us_bhavcopy_latest.csv",
        "https://raw.githubusercontent.com/deshvenkateshblr/kyf/master/data/us_bhavcopy.csv",
    ]

    headers = {"User-Agent": "KYF_Sync/1.9 (admin@kyf.local)"}

    for url in candidate_urls:
        try:
            req = urllib.request.Request(url, headers=headers)
            with urllib.request.urlopen(req, timeout=8) as resp:
                content = resp.read().decode("utf-8")
                lines = [l for l in content.splitlines() if l.strip()]
                if len(lines) > 2 and "Ticker" in lines[0]:
                    with open(target_path, "w", encoding="utf-8") as f:
                        f.write(content)
                    with open(backup_path, "w", encoding="utf-8") as f:
                        f.write(content)
                    print(f"  [Remote Repo Fetch] Successfully fetched latest us_bhavcopy from GitHub ({len(lines) - 1} tickers)")
                    return True
        except Exception:
            continue

    print("  [Remote Repo Fetch] GitHub repo unreachable or offline; using local us_bhavcopy files.")
    return False


def build_us_market_js(horizons: dict = None):
    """Module 5B: Build data/market-us.js from data/us_bhavcopy_latest.csv (or us_bhavcopy.csv)."""
    print("\n--- Building Module 5B: data/market-us.js (US Stocks & Funds) ---")

    # 1. First attempt to fetch live bhavcopy using yfinance (batch)
    yf_success = fetch_us_bhavcopy_yfinance()

    # 2. If yfinance is unavailable or offline, pull latest us_bhavcopy from GitHub repo
    if not yf_success:
        fetch_remote_us_bhavcopy_from_repo()

    candidate_files = [
        os.path.join(DATA_DIR, "us_bhavcopy_latest.csv"),
        os.path.join(DATA_DIR, "us_bhavcopy.csv"),
    ]
    csv_file = None
    for cf in candidate_files:
        if os.path.exists(cf) and os.path.getsize(cf) > 0:
            csv_file = cf
            break

    if not csv_file:
        import glob
        pattern = os.path.join(DATA_DIR, "us_bhavcopy_*.csv")
        matches = sorted(glob.glob(pattern), reverse=True)
        if matches:
            csv_file = matches[0]

    if not csv_file:
        print("  [Skip] No us_bhavcopy CSV found in data/ directory.")
        return

    # Load SEC Master Tickers (~10,000+ US symbols)
    sec_tickers = fetch_sec_company_tickers(cache_dir=CACHE_DIR)
    if sec_tickers:
        print(f"  [Loaded SEC Reference] {len(sec_tickers)} US symbols ready for enrichment.")

    # Fetch live USD/INR exchange rate on demand (with multi-source fallback and local cache)
    cfg_fx = 87.50
    if os.path.exists(PULSE_CONFIG_PATH):
        try:
            with open(PULSE_CONFIG_PATH, "r", encoding="utf-8") as f:
                pcfg = json.load(f)
                cfg_fx = float(pcfg.get("macro", {}).get("usdInrRate", 87.50))
        except Exception:
            pass
    fx_rate = fetch_live_usdinr_rate(fallback_rate=cfg_fx)

    records = []
    as_of = horizons["latest"].isoformat() if (horizons and "latest" in horizons) else datetime.date.today().isoformat()

    try:
        with open(csv_file, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                ticker = (row.get("Ticker") or row.get("symbol") or "").strip().upper()
                if not ticker:
                    continue
                try:
                    close_price = float(row.get("Close") or row.get("close") or 0.0)
                except ValueError:
                    continue

                last_updated = (row.get("Last_Updated_UTC") or "").strip()
                if last_updated:
                    date_part = last_updated.split(" ")[0].strip()
                    if re.match(r"^\d{4}-\d{2}-\d{2}$", date_part):
                        as_of = date_part

                # 3-Tier enrichment:
                # 1. Curated metadata
                # 2. Official SEC EDGAR company tickers (~10,000+ US equities/ETFs)
                # 3. NASDAQ/FINRA 5-letter 'X' mutual fund heuristic
                if ticker in KNOWN_US_METADATA:
                    name, inst_type = KNOWN_US_METADATA[ticker]
                elif ticker in sec_tickers:
                    name = clean_sec_title(sec_tickers[ticker])
                    inst_type = "ETF" if ("ETF" in name.upper() or "TRUST" in name.upper()) else "EQUITY"
                elif len(ticker) == 5 and ticker.endswith("X"):
                    name = f"{ticker} Mutual Fund"
                    inst_type = "MUTUAL_FUND"
                else:
                    name = ticker
                    inst_type = "EQUITY"

                records.append({
                    "ticker": ticker,
                    "name": name,
                    "closePrice": close_price,
                    "type": inst_type,
                    "currency": "USD",
                    "lastUpdated": last_updated,
                })
    except Exception as e:
        print(f"  [Error] Failed to read {csv_file}: {e}")
        return
        return

    records.sort(key=lambda x: x["ticker"])

    instruments_array = [
        [r["ticker"], r["name"], r["closePrice"], r["type"], r["currency"], r["lastUpdated"]]
        for r in records
    ]

    by_ticker = {
        r["ticker"]: {
            "ticker": r["ticker"],
            "name": r["name"],
            "closePrice": r["closePrice"],
            "type": r["type"],
            "currency": r["currency"],
            "lastUpdated": r["lastUpdated"],
        }
        for r in records
    }

    out_payload = {
        "asOf": as_of,
        "fxRateUsdInr": fx_rate,
        "columns": ["ticker", "name", "closePrice", "type", "currency", "lastUpdated"],
        "instruments": instruments_array,
        "byTicker": by_ticker,
    }

    js_content = (
        f"// Auto-generated by admin/sync_market_data.py on {datetime.datetime.now().isoformat()}\n"
        f"window.KYF_MARKET_US = {json.dumps(out_payload, indent=2)};\n"
    )

    out_path = os.path.join(DATA_DIR, "market-us.js")
    with open(out_path, "w", encoding="utf-8") as f:
        f.write(js_content)
    print(f"  [Success] Wrote {len(records)} US instruments to {out_path} ({len(js_content)/1024:.1f} KB)")


def sync_nhb_residex():
    """Module 6: NHB RESIDEX Real Estate Sync via admin/sync_nhb_residex.mjs"""
    print("\n--- Building Module 6: Real Estate (NHB RESIDEX) ---")
    script_path = os.path.abspath(os.path.join(BASE_DIR, "sync_nhb_residex.mjs"))
    if not os.path.exists(script_path):
        print(f"  [Skip] Scraper script not found: {script_path}")
        return

    cmd = ["node", script_path]
    if "--force-nhb" in sys.argv:
        cmd.append("--force-nhb")

    try:
        proc = subprocess.run(cmd, check=False)
        if proc.returncode != 0:
            print(f"  [Warn] NHB RESIDEX sync process returned code {proc.returncode}")
    except Exception as e:
        print(f"  [Warn] Failed to invoke node for NHB RESIDEX sync: {e}")


def build_market_status_js(horizons: dict):
    """
    Module 6B: Synthesizes health, asOf dates, record counts, and errors across all data feeds
    into data/market-status.js (window.KYF_MARKET_STATUS) and data/market-status.json.
    """
    print("\n--- Building Module 6B: data/market-status.js (Feeds Health & As-Of Monitor) ---")
    now_utc = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
    now_ist = (datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(hours=5, minutes=30)).strftime("%d %b %Y, %I:%M %p IST")

    feeds = {}
    overall_status = "HEALTHY"

    # 1. NSE Equities
    eq_path = os.path.join(DATA_DIR, "market-equities.js")
    if os.path.exists(eq_path):
        try:
            with open(eq_path, "r", encoding="utf-8") as f:
                eq_txt = f.read()
            m_asof = re.search(r'asOf:\s*"([^"]+)"', eq_txt)
            m_n500 = re.search(r'nifty500Count:\s*(\d+)', eq_txt)
            stocks_cnt = len(re.findall(r'\["[A-Z0-9&\.-]+"', eq_txt))
            eq_asof = m_asof.group(1) if m_asof else horizons["latest"].isoformat()
            feeds["equities"] = {
                "name": "NSE Indian Equities",
                "tag": "Equities",
                "status": "HEALTHY",
                "asOf": eq_asof,
                "count": stocks_cnt,
                "details": f"{stocks_cnt:,} stocks ({m_n500.group(1) if m_n500 else 500} Nifty 500)",
                "source": "NSE India EOD Bhavcopy (CM)",
                "horizons": ["1M", "3M", "6M", "1Y"],
                "error": None
            }
        except Exception as e:
            overall_status = "WARNING"
            feeds["equities"] = {
                "name": "NSE Indian Equities",
                "tag": "Equities",
                "status": "ERROR",
                "asOf": horizons["latest"].isoformat(),
                "details": "Failed to parse equities dataset",
                "source": "NSE India",
                "error": str(e)
            }
    else:
        overall_status = "WARNING"
        feeds["equities"] = {
            "name": "NSE Indian Equities",
            "tag": "Equities",
            "status": "MISSING",
            "asOf": "N/A",
            "details": "Dataset file missing",
            "source": "NSE India",
            "error": "data/market-equities.js not found"
        }

    # 2. AMFI Mutual Funds
    mf_path = os.path.join(DATA_DIR, "market-mf.js")
    if os.path.exists(mf_path):
        try:
            with open(mf_path, "r", encoding="utf-8") as f:
                mf_txt = f.read()
            m_asof = re.search(r'asOf:\s*"([^"]+)"', mf_txt)
            schemes_cnt = len(re.findall(r'\[\s*\d+\s*,', mf_txt))
            mf_asof = m_asof.group(1) if m_asof else horizons["latest"].isoformat()
            feeds["mutualFunds"] = {
                "name": "AMFI Mutual Funds",
                "tag": "Mutual Funds",
                "status": "HEALTHY",
                "asOf": mf_asof,
                "count": schemes_cnt,
                "details": f"{schemes_cnt:,} schemes (Direct & Regular plans)",
                "source": "Association of Mutual Funds in India (portal.amfiindia.com)",
                "horizons": ["1M", "3M", "6M", "1Y"],
                "error": None
            }
        except Exception as e:
            overall_status = "WARNING"
            feeds["mutualFunds"] = {
                "name": "AMFI Mutual Funds",
                "tag": "Mutual Funds",
                "status": "ERROR",
                "asOf": horizons["latest"].isoformat(),
                "details": "Failed to parse MF dataset",
                "source": "AMFI India",
                "error": str(e)
            }
    else:
        overall_status = "WARNING"
        feeds["mutualFunds"] = {
            "name": "AMFI Mutual Funds",
            "tag": "Mutual Funds",
            "status": "MISSING",
            "asOf": "N/A",
            "details": "Dataset file missing",
            "source": "AMFI India",
            "error": "data/market-mf.js not found"
        }

    # 3. US Equities, ETFs & Funds
    us_path = os.path.join(DATA_DIR, "market-us.js")
    if os.path.exists(us_path):
        try:
            with open(us_path, "r", encoding="utf-8") as f:
                us_txt = f.read()
            m_asof = re.search(r'"asOf":\s*"([^"]+)"', us_txt)
            m_fx = re.search(r'"fxRateUsdInr":\s*([0-9\.]+)', us_txt)
            us_cnt = len(re.findall(r'\[\s*"[A-Z0-9\.-]+"', us_txt))
            us_asof = m_asof.group(1) if m_asof else datetime.date.today().isoformat()
            fx_rate = float(m_fx.group(1)) if m_fx else 93.85
            feeds["usMarket"] = {
                "name": "US Stocks, ETFs & Funds",
                "tag": "US Equities",
                "status": "HEALTHY",
                "asOf": us_asof,
                "count": us_cnt,
                "fxRateUsdInr": fx_rate,
                "details": f"{us_cnt} instruments (VOOG, QQQM, TAN, AAPL, etc.) • USD/INR: ₹{fx_rate:.2f}",
                "source": "GitHub us_bhavcopy & Yahoo Finance",
                "error": None
            }
        except Exception as e:
            overall_status = "WARNING"
            feeds["usMarket"] = {
                "name": "US Stocks, ETFs & Funds",
                "tag": "US Equities",
                "status": "ERROR",
                "asOf": datetime.date.today().isoformat(),
                "details": "Failed to parse US market dataset",
                "source": "US Bhavcopy",
                "error": str(e)
            }

    # 4. Commodities & Bullion (from pulse)
    pulse_path = os.path.join(DATA_DIR, "market-pulse.js")
    if os.path.exists(pulse_path):
        try:
            with open(pulse_path, "r", encoding="utf-8") as f:
                p_txt = f.read()
            m_gold = re.search(r'"gold24kPerGram":\s*([0-9\.]+)', p_txt)
            m_silver = re.search(r'"silverPerKg":\s*([0-9\.]+)', p_txt)
            m_pasof = re.search(r'"asOf":\s*"([^"]+)"', p_txt)
            p_asof = m_pasof.group(1) if m_pasof else horizons["latest"].isoformat()
            g_rate = float(m_gold.group(1)) if m_gold else 14130
            s_rate = float(m_silver.group(1)) if m_silver else 204000
            feeds["bullion"] = {
                "name": "Gold & Silver Bullion",
                "tag": "Commodities",
                "status": "HEALTHY",
                "asOf": p_asof,
                "gold24kPerGram": g_rate,
                "silverPerKg": s_rate,
                "details": f"Gold 24K: ₹{g_rate:,.0f}/g • Silver: ₹{s_rate:,.0f}/kg",
                "source": "NSE GOLDBEES & SILVERBEES Mark-to-Market",
                "error": None
            }

            # 5. Macro & Sovereign Benchmarks
            m_cpi = re.search(r'"cpiInflation":\s*([0-9\.]+)', p_txt)
            m_epf = re.search(r'"epfRate":\s*([0-9\.]+)', p_txt)
            m_nifty = re.search(r'"level":\s*([0-9\.]+)', p_txt)
            feeds["macro"] = {
                "name": "Macro & Sovereign Baseline",
                "tag": "Macro",
                "status": "HEALTHY",
                "asOf": p_asof,
                "details": f"CPI Inflation: {m_cpi.group(1) if m_cpi else '5.4'}% • EPF Rate: {m_epf.group(1) if m_epf else '8.25'}% • Nifty 50: {m_nifty.group(1) if m_nifty else '25,030'}",
                "source": "RBI, MoSPI & NSE Index Benchmarks",
                "error": None
            }
        except Exception as e:
            feeds["bullion"] = {"name": "Gold & Silver", "status": "ERROR", "error": str(e), "asOf": "N/A"}
            feeds["macro"] = {"name": "Macro Baseline", "status": "ERROR", "error": str(e), "asOf": "N/A"}

    # 6. Real Estate (NHB RESIDEX)
    nhb_path = os.path.join(DATA_DIR, "nhb_residex_kyf.json")
    if os.path.exists(nhb_path):
        try:
            with open(nhb_path, "r", encoding="utf-8") as f:
                nhb = json.load(f)
            cities_cnt = len(nhb.get("cities", {}))
            feeds["realEstate"] = {
                "name": "NHB RESIDEX Real Estate",
                "tag": "Real Estate",
                "status": "HEALTHY",
                "asOf": nhb.get("as_of_quarter", "2024-2026"),
                "count": cities_cnt,
                "frequency": "Quarterly",
                "details": f"{cities_cnt} Tier 1 & 2 Indian Cities • Official RBI Housing Index",
                "source": "National Housing Bank (NHB RESIDEX)",
                "error": None
            }
        except Exception as e:
            feeds["realEstate"] = {"name": "NHB RESIDEX", "status": "ERROR", "error": str(e), "asOf": "N/A"}

    payload = {
        "generatedAtUTC": now_utc,
        "lastSyncedIST": now_ist,
        "overallStatus": overall_status,
        "totalFeeds": len(feeds),
        "healthyFeeds": sum(1 for f in feeds.values() if f.get("status") == "HEALTHY"),
        "feeds": feeds
    }

    # Write JS bundle (for direct script tag in HTML)
    out_js = os.path.join(DATA_DIR, "market-status.js")
    with open(out_js, "w", encoding="utf-8") as f:
        f.write(f"// Auto-generated by admin/sync_market_data.py\nwindow.KYF_MARKET_STATUS = {json.dumps(payload, indent=2)};\n")

    # Write JSON bundle (for APIs / CI)
    out_json = os.path.join(DATA_DIR, "market-status.json")
    with open(out_json, "w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2)

    print(f"  [Success] Wrote Market Status ({payload['healthyFeeds']}/{payload['totalFeeds']} Healthy) to {out_js} and {out_json}")


def git_commit_and_push(horizons: dict):
    """Module 7: Automatically stages data/ files, commits with asOf date, and pushes to origin/master."""
    if "--commit-push" not in sys.argv and "--git-push" not in sys.argv:
        return

    print("\n--- Module 7: Git Automated Commit & Push ---")
    repo_root = os.path.abspath(os.path.join(BASE_DIR, ".."))
    as_of = horizons["latest"].isoformat()

    try:
        # Stage data directory
        subprocess.run(["git", "add", "data/"], cwd=repo_root, check=True)

        # Check if there are staged differences
        diff_res = subprocess.run(["git", "diff", "--cached", "--quiet"], cwd=repo_root)
        if diff_res.returncode == 0:
            print("  [Info] No changes detected in data/ to commit.")
            return

        commit_msg = f"chore(data): auto-sync market data as of {as_of}"
        subprocess.run(["git", "commit", "-m", commit_msg], cwd=repo_root, check=True)
        print(f"  [Success] Committed: '{commit_msg}'")

        print("  [Pushing] git push origin master ...")
        subprocess.run(["git", "push", "origin", "master"], cwd=repo_root, check=True)
        print("  [Success] Successfully pushed to GitHub (origin/master)!")
    except subprocess.CalledProcessError as e:
        print(f"  [Error] Git automated command failed: {e}")
    except Exception as e:
        print(f"  [Error] Failed to complete git commit/push: {e}")


if __name__ == "__main__":
    print("=== KYF Unified EOD Market Sync (Modules 3, 4, 5 & 6) ===")
    target_horizons = get_horizons()
    for k, d in target_horizons.items():
        print(f"  Horizon [{k.upper():6s}] -> {d.isoformat()} ({d.strftime('%a')})")

    http_opener = create_http_opener()
    build_pulse_js(http_opener, target_horizons)
    ca_data = build_corporate_actions_js(http_opener)
    build_equities_js(http_opener, target_horizons, ca_data)
    build_mf_js(http_opener, target_horizons)
    build_us_market_js(target_horizons)
    sync_nhb_residex()
    build_market_status_js(target_horizons)
    git_commit_and_push(target_horizons)
    print("\n=== All Market Bundles (pulse, corporate-actions, equities, mf, us, realestate) Updated in /data/ ===")
