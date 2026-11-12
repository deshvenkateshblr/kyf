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


KNOWN_US_METADATA = {
    # Top US Equities
    "AAPL": ("Apple Inc.", "EQUITY"),
    "MSFT": ("Microsoft Corporation", "EQUITY"),
    "GOOGL": ("Alphabet Inc. (Class A)", "EQUITY"),
    "GOOG": ("Alphabet Inc. (Class C)", "EQUITY"),
    "AMZN": ("Amazon.com Inc.", "EQUITY"),
    "NVDA": ("NVIDIA Corporation", "EQUITY"),
    "TSLA": ("Tesla Inc.", "EQUITY"),
    "META": ("Meta Platforms Inc.", "EQUITY"),
    "BRK.B": ("Berkshire Hathaway Inc. (Class B)", "EQUITY"),
    "BRK.A": ("Berkshire Hathaway Inc. (Class A)", "EQUITY"),
    "AVGO": ("Broadcom Inc.", "EQUITY"),
    "JPM": ("JPMorgan Chase & Co.", "EQUITY"),
    "V": ("Visa Inc.", "EQUITY"),
    "MA": ("Mastercard Incorporated", "EQUITY"),
    "WMT": ("Walmart Inc.", "EQUITY"),
    "COST": ("Costco Wholesale Corporation", "EQUITY"),
    "HD": ("The Home Depot Inc.", "EQUITY"),
    "BAC": ("Bank of America Corporation", "EQUITY"),
    "XOM": ("Exxon Mobil Corporation", "EQUITY"),
    "LLY": ("Eli Lilly and Company", "EQUITY"),
    "UNH": ("UnitedHealth Group Inc.", "EQUITY"),
    "JNJ": ("Johnson & Johnson", "EQUITY"),
    "PG": ("Procter & Gamble Co.", "EQUITY"),
    "NFLX": ("Netflix Inc.", "EQUITY"),
    "AMD": ("Advanced Micro Devices Inc.", "EQUITY"),
    "INTC": ("Intel Corporation", "EQUITY"),
    "PLTR": ("Palantir Technologies Inc.", "EQUITY"),
    "CRM": ("Salesforce Inc.", "EQUITY"),
    "ORCL": ("Oracle Corporation", "EQUITY"),
    "UBER": ("Uber Technologies Inc.", "EQUITY"),
    "COIN": ("Coinbase Global Inc.", "EQUITY"),
    "MSTR": ("MicroStrategy Inc.", "EQUITY"),
    "CRWD": ("CrowdStrike Holdings Inc.", "EQUITY"),
    # Major US Broad & Factor ETFs
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
    "SCHD": ("Schwab U.S. Dividend Equity ETF", "ETF"),
    "VYM": ("Vanguard High Dividend Yield ETF", "ETF"),
    "VIG": ("Vanguard Dividend Appreciation ETF", "ETF"),
    "IWM": ("iShares Russell 2000 ETF", "ETF"),
    "DIA": ("SPDR Dow Jones Industrial Average ETF", "ETF"),
    "VT": ("Vanguard Total World Stock ETF", "ETF"),
    "VXUS": ("Vanguard Total International Stock ETF", "ETF"),
    "VEA": ("Vanguard FTSE Developed Markets ETF", "ETF"),
    "VWO": ("Vanguard FTSE Emerging Markets ETF", "ETF"),
    "INDA": ("iShares MSCI India ETF", "ETF"),
    # Sector & Thematic ETFs (Clean Energy, Tech, Healthcare, etc.)
    "TAN": ("Invesco Solar ETF", "ETF"),
    "ICLN": ("iShares Global Clean Energy ETF", "ETF"),
    "QCLN": ("First Trust NASDAQ Clean Edge Green Energy ETF", "ETF"),
    "URA": ("Global X Uranium ETF", "ETF"),
    "SMH": ("VanEck Semiconductor ETF", "ETF"),
    "SOXX": ("iShares Semiconductor ETF", "ETF"),
    "XLK": ("Technology Select Sector SPDR Fund", "ETF"),
    "XLF": ("Financial Select Sector SPDR Fund", "ETF"),
    "XLE": ("Energy Select Sector SPDR Fund", "ETF"),
    "XLV": ("Health Care Select Sector SPDR Fund", "ETF"),
    "XLI": ("Industrial Select Sector SPDR Fund", "ETF"),
    "XLY": ("Consumer Discretionary Select Sector SPDR Fund", "ETF"),
    "XLP": ("Consumer Staples Select Sector SPDR Fund", "ETF"),
    "VNQ": ("Vanguard Real Estate ETF", "ETF"),
    "ARKK": ("ARK Innovation ETF", "ETF"),
    "CIBR": ("First Trust NASDAQ Cybersecurity ETF", "ETF"),
    "BOTZ": ("Global X Robotics & Artificial Intelligence ETF", "ETF"),
    "IGV": ("iShares Expanded Tech-Software Sector ETF", "ETF"),
    "IBIT": ("iShares Bitcoin Trust ETF", "ETF"),
    # Fixed Income & Income ETFs
    "JEPI": ("JPMorgan Equity Premium Income ETF", "ETF"),
    "JEPQ": ("JPMorgan Nasdaq Equity Premium Income ETF", "ETF"),
    "BND": ("Vanguard Total Bond Market ETF", "ETF"),
    "AGG": ("iShares Core U.S. Aggregate Bond ETF", "ETF"),
    "TLT": ("iShares 20+ Year Treasury Bond ETF", "ETF"),
    "HYG": ("iShares iBoxx $ High Yield Corporate Bond ETF", "ETF"),
    # Commodity ETFs
    "GLD": ("SPDR Gold Shares", "ETF"),
    "IAU": ("iShares Gold Trust", "ETF"),
    "SLV": ("iShares Silver Trust", "ETF"),
    "GDX": ("VanEck Gold Miners ETF", "ETF"),
    # US Mutual Funds / 401(k) / Index Funds
    "FXAIX": ("Fidelity 500 Index Fund", "MUTUAL_FUND"),
    "VFIAX": ("Vanguard 500 Index Fund Admiral", "MUTUAL_FUND"),
    "VTSAX": ("Vanguard Total Stock Market Index Admiral", "MUTUAL_FUND"),
    "FCNTX": ("Fidelity Contrafund", "MUTUAL_FUND"),
    "VWENX": ("Vanguard Wellington Fund Admiral", "MUTUAL_FUND"),
    "FZROX": ("Fidelity ZERO Total Market Index", "MUTUAL_FUND"),
    "FNILX": ("Fidelity ZERO Large Cap Index", "MUTUAL_FUND"),
    "VBTLX": ("Vanguard Total Bond Market Index Admiral", "MUTUAL_FUND"),
    "VTIAX": ("Vanguard Total International Stock Index Admiral", "MUTUAL_FUND"),
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


def build_us_market_js(horizons: dict = None):
    """Module 5B: Build data/market-us.js from data/us_bhavcopy_latest.csv (or us_bhavcopy.csv)."""
    print("\n--- Building Module 5B: data/market-us.js (US Stocks & Funds) ---")

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
    git_commit_and_push(target_horizons)
    print("\n=== All Market Bundles (pulse, corporate-actions, equities, mf, us, realestate) Updated in /data/ ===")
