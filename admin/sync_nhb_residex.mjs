import { chromium } from 'playwright-core';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT_DIR, 'data');
const JSON_OUTPUT_PATH = path.join(DATA_DIR, 'nhb_residex_kyf.json');
const JS_OUTPUT_PATH = path.join(DATA_DIR, 'market-realestate.js');

const URL_BY2024 = 'https://residex.nhbonline.org.in/DashboardBY2024/DashboardBY2024';
const URL_BY2018 = 'https://residex.nhbonline.org.in/DashboardBY2018/DashboardBY2018';

const TARGET_CITIES = [
  { city: 'Bengaluru', state: 'Karnataka' },
  { city: 'Mumbai', state: 'Maharashtra' },
  { city: 'Delhi', state: 'NCT of Delhi' },
  { city: 'Chennai', state: 'Tamil Nadu' },
  { city: 'Hyderabad', state: 'Telangana' },
  { city: 'Pune', state: 'Maharashtra' },
  { city: 'Kolkata', state: 'West Bengal' },
  { city: 'Ahmedabad', state: 'Gujarat' },
  { city: 'Gurugram', state: 'Haryana' },
  { city: 'Noida', state: 'Uttar Pradesh' },
  { city: 'Faridabad', state: 'Haryana' }
];

const Q_MONTHS = { Mar: 1, Jun: 2, Sep: 3, Dec: 4 };

function parseQuarterKey(q) {
  if (!q) return 0;
  const parts = q.trim().split(/\s+/);
  if (parts.length < 2) return 0;
  const year = parseInt(parts[1], 10);
  const m = Q_MONTHS[parts[0]] || 0;
  return year * 10 + m;
}

function sortQuarterKeys(keys) {
  return [...keys].sort((a, b) => parseQuarterKey(a) - parseQuarterKey(b));
}

function calculateSeriesMetrics(seriesObj) {
  const sortedQuarters = sortQuarterKeys(Object.keys(seriesObj || {}));
  if (!sortedQuarters.length) {
    return { latest_quarter: null, latest_value: null, qoq_pct: null, yoy_pct: null, cagr_3y: null, cagr_5y: null };
  }

  const latestQ = sortedQuarters[sortedQuarters.length - 1];
  const latestVal = seriesObj[latestQ];

  let qoqPct = null;
  if (sortedQuarters.length >= 2) {
    const prevVal = seriesObj[sortedQuarters[sortedQuarters.length - 2]];
    if (prevVal > 0) {
      qoqPct = Number((((latestVal - prevVal) / prevVal) * 100).toFixed(2));
    }
  }

  let yoyPct = null;
  // 4 quarters back = 1 year ago (e.g. index 4 vs index 0 in 5-quarter series)
  if (sortedQuarters.length >= 5) {
    const yoyVal = seriesObj[sortedQuarters[sortedQuarters.length - 5]];
    if (yoyVal > 0) {
      yoyPct = Number((((latestVal - yoyVal) / yoyVal) * 100).toFixed(2));
    }
  }

  let cagr3y = null;
  // 12 quarters back = 3 years ago
  if (sortedQuarters.length >= 13) {
    const val3y = seriesObj[sortedQuarters[sortedQuarters.length - 13]];
    if (val3y > 0) {
      cagr3y = Number(((Math.pow(latestVal / val3y, 1 / 3) - 1) * 100).toFixed(2));
    }
  }

  let cagr5y = null;
  // 20 quarters back = 5 years ago
  if (sortedQuarters.length >= 21) {
    const val5y = seriesObj[sortedQuarters[sortedQuarters.length - 21]];
    if (val5y > 0) {
      cagr5y = Number(((Math.pow(latestVal / val5y, 1 / 5) - 1) * 100).toFixed(2));
    }
  }

  let totalGrowthPct = null;
  if (sortedQuarters.length >= 2) {
    const baseVal = seriesObj[sortedQuarters[0]];
    if (baseVal > 0) {
      totalGrowthPct = Number((((latestVal - baseVal) / baseVal) * 100).toFixed(2));
    }
  }

  return {
    latest_quarter: latestQ,
    latest_value: latestVal,
    qoq_pct: qoqPct,
    yoy_pct: yoyPct,
    cagr_3y: cagr3y,
    cagr_5y: cagr5y,
    total_growth_pct: totalGrowthPct,
    history_length_quarters: sortedQuarters.length
  };
}

function spliceSeries(series2018, series2024, overlapQuarter = 'Jun 2025') {
  const spliced = {};
  const v2024 = series2024[overlapQuarter];
  const v2018 = series2018[overlapQuarter];

  let multiplier = 1.0;
  if (v2024 && v2018 && v2018 > 0) {
    multiplier = v2024 / v2018;
  }

  const q2018Sorted = sortQuarterKeys(Object.keys(series2018));
  const overlapKey = parseQuarterKey(overlapQuarter);

  for (const q of q2018Sorted) {
    if (parseQuarterKey(q) < overlapKey) {
      spliced[q] = Number((series2018[q] * multiplier).toFixed(2));
    }
  }

  const q2024Sorted = sortQuarterKeys(Object.keys(series2024));
  for (const q of q2024Sorted) {
    spliced[q] = series2024[q];
  }

  return spliced;
}

async function extractQuarterTableFromTableElement(page, tableIndex = 1) {
  return await page.evaluate((tIdx) => {
    const tables = document.querySelectorAll('table');
    if (tables.length <= tIdx) return {};
    const t = tables[tIdx];
    const out = {};
    const rows = Array.from(t.querySelectorAll('tr'));
    for (const r of rows) {
      const cells = Array.from(r.querySelectorAll('th, td')).map(c => c.innerText.trim());
      if (cells.length >= 2 && /^(Jun|Sep|Dec|Mar)\s+\d{4}$/i.test(cells[0])) {
        const cleaned = cells[1].replace(/[^\d.-]/g, '');
        const num = parseFloat(cleaned);
        if (!Number.isNaN(num)) {
          out[cells[0]] = num;
        }
      }
    }
    return out;
  }, tableIndex);
}

async function runSync() {
  const isForce = process.argv.includes('--force-nhb') || process.argv.includes('--force');

  if (!isForce) {
    try {
      const stats = await fs.stat(JSON_OUTPUT_PATH);
      const ageInDays = (Date.now() - stats.mtimeMs) / (1000 * 60 * 60 * 24);
      if (ageInDays < 30) {
        console.log(`[Cache Hit] NHB RESIDEX data exists at ${JSON_OUTPUT_PATH} (synced ${ageInDays.toFixed(1)} days ago < 30 days).`);
        console.log('Skipping headless Edge sync. Use --force-nhb to force refresh.');
        return;
      }
    } catch {
      // File does not exist, proceed
    }
  }

  console.log('================================================================');
  console.log('NHB RESIDEX Real Estate Sync (Playwright + Edge Headless)');
  console.log('================================================================');

  const browser = await chromium.launch({
    channel: 'msedge',
    headless: true
  });

  const context = await browser.newContext();
  const page = await context.newPage();

  // --------------------------------------------------------------------------
  // STEP 1: DASHBOARD BY2018 (Historical Series + Linking Factors)
  // --------------------------------------------------------------------------
  console.log('\n[1/3] Loading DashboardBY2018 (FY 2017-18 = 100)...');
  await page.goto(URL_BY2018, { waitUntil: 'networkidle', timeout: 60000 });

  // 1a. National Composite Historical Series (Table 0)
  const nationalHpi2018 = await extractQuarterTableFromTableElement(page, 0);
  console.log(`  -> National Composite (2018 base): ${Object.keys(nationalHpi2018).length} quarters`);

  // 1b. Linking Factors (Table 2)
  const linkingFactors = await page.evaluate(() => {
    const factors = {};
    const tables = document.querySelectorAll('table');
    if (tables.length < 3) return factors;
    const t = tables[2];
    const rows = Array.from(t.querySelectorAll('tr'));
    for (const r of rows) {
      const cells = Array.from(r.querySelectorAll('td, th')).map(c => c.innerText.trim());
      if (cells.length >= 5 && cells[0] && !cells[0].includes('City Name') && !cells[0].includes('Linking Factor')) {
        factors[cells[0]] = {
          assessment_forward: parseFloat(cells[1]) || null,
          assessment_backward: parseFloat(cells[2]) || null,
          market_uc_forward: parseFloat(cells[3]) || null,
          market_uc_backward: parseFloat(cells[4]) || null
        };
      }
    }
    return factors;
  });
  console.log(`  -> Linking Factors extracted: ${Object.keys(linkingFactors).length} cities`);

  // 1c. City-wise Historical Series (Table 1 after selecting city)
  const cityHistorical2018 = {};
  console.log('  -> Extracting historical HPI for target cities...');
  for (const item of TARGET_CITIES) {
    try {
      await page.selectOption('#ddlState', { label: item.state });
      await page.waitForTimeout(400);
      await page.selectOption('#ddlCity', { label: item.city });
      await page.waitForTimeout(600);
      cityHistorical2018[item.city] = await extractQuarterTableFromTableElement(page, 1);
    } catch (err) {
      console.warn(`     [Warn] BY2018 city error (${item.city}):`, err.message);
      cityHistorical2018[item.city] = {};
    }
  }

  // --------------------------------------------------------------------------
  // STEP 2: DASHBOARD BY2024 (Current Series FY 2024-25 = 100 & Carpet Area Prices)
  // --------------------------------------------------------------------------
  console.log('\n[2/3] Loading DashboardBY2024 (FY 2024-25 = 100)...');
  await page.goto(URL_BY2024, { waitUntil: 'networkidle', timeout: 60000 });

  // 2a. National Composite HPI (Table 0)
  const nationalHpi2024 = await extractQuarterTableFromTableElement(page, 0);
  console.log(`  -> National Composite HPI (2024 base): ${Object.keys(nationalHpi2024).length} quarters`);

  // 2b. National Composite Carpet Area Price
  await page.click('#CarpetAreaPrices');
  await page.waitForTimeout(800);
  await page.click('#CompositePrice');
  await page.waitForTimeout(800);
  const nationalCarpetComposite = await extractQuarterTableFromTableElement(page, 0);
  console.log(`  -> National Composite Carpet Price: ${Object.keys(nationalCarpetComposite).length} quarters`);

  // 2c. City-wise HPI & 4 Carpet Price Tiers
  const citiesPayload = {};
  console.log('  -> Extracting HPI & Carpet Area Price Tiers for target cities...');

  for (const item of TARGET_CITIES) {
    const city = item.city;
    process.stdout.write(`     • ${city}... `);

    citiesPayload[city] = {
      state: item.state,
      linking_factors: linkingFactors[city] || {},
      hpi_historical_by2018: cityHistorical2018[city] || {},
      hpi_assessment_by2024: {},
      carpet_price_sqft_by2024: {
        composite: {},
        compact_lte_646_sqft: {},
        mid_646_to_1184_sqft: {},
        large_gt_1184_sqft: {}
      },
      spliced_continuous_hpi: {},
      summary: {}
    };

    try {
      // Select state and city
      await page.selectOption('#ddlState', { label: item.state });
      await page.waitForTimeout(400);
      await page.selectOption('#ddlCity', { label: item.city });
      await page.waitForTimeout(700);

      // 1. City HPI @ Assessment
      await page.click('#HousingPriceIndex');
      await page.waitForTimeout(700);
      const hpi2024 = await extractQuarterTableFromTableElement(page, 1);
      citiesPayload[city].hpi_assessment_by2024 = hpi2024;

      // 2. City Carpet Area Prices (Rs. / Sq. Ft.)
      await page.click('#CarpetAreaPrices');
      await page.waitForTimeout(800);

      // Tier 1: Composite
      await page.click('#CompositePrice');
      await page.waitForTimeout(700);
      citiesPayload[city].carpet_price_sqft_by2024.composite = await extractQuarterTableFromTableElement(page, 1);

      // Tier 2: <=60 sq.mt. (646 sq.ft.)
      await page.click('input[id="60sqmt"]');
      await page.waitForTimeout(700);
      citiesPayload[city].carpet_price_sqft_by2024.compact_lte_646_sqft = await extractQuarterTableFromTableElement(page, 1);

      // Tier 3: 60-110 sq.mt. (646 - 1184 sq.ft.)
      await page.click('input[id="60and110sqmt"]');
      await page.waitForTimeout(700);
      citiesPayload[city].carpet_price_sqft_by2024.mid_646_to_1184_sqft = await extractQuarterTableFromTableElement(page, 1);

      // Tier 4: >110 sq.mt. (1184 sq.ft.)
      await page.click('input[id="110sqmt"]');
      await page.waitForTimeout(700);
      citiesPayload[city].carpet_price_sqft_by2024.large_gt_1184_sqft = await extractQuarterTableFromTableElement(page, 1);

      // Splice continuous multi-year series (2018 - 2026)
      const spliced = spliceSeries(cityHistorical2018[city] || {}, hpi2024, 'Jun 2025');
      citiesPayload[city].spliced_continuous_hpi = spliced;

      // Summary metrics
      const hpiMetrics = calculateSeriesMetrics(spliced);
      const carpetMetrics = calculateSeriesMetrics(citiesPayload[city].carpet_price_sqft_by2024.composite);

      citiesPayload[city].summary = {
        latest_quarter: hpiMetrics.latest_quarter,
        hpi_index: hpiMetrics.latest_value,
        hpi_qoq_pct: hpiMetrics.qoq_pct,
        hpi_yoy_pct: hpiMetrics.yoy_pct,
        hpi_cagr_3y: hpiMetrics.cagr_3y,
        hpi_cagr_5y: hpiMetrics.cagr_5y,
        hpi_total_growth_8y: hpiMetrics.total_growth_pct,
        carpet_price_sqft: carpetMetrics.latest_value,
        carpet_price_qoq_pct: carpetMetrics.qoq_pct,
        carpet_price_yoy_pct: carpetMetrics.yoy_pct
      };

      console.log(`[OK] (HPI: ${hpiMetrics.latest_value}, YoY: ${hpiMetrics.yoy_pct > 0 ? '+' : ''}${hpiMetrics.yoy_pct}%, ₹${carpetMetrics.latest_value ? carpetMetrics.latest_value.toLocaleString('en-IN') : '-'}/sq.ft.)`);
    } catch (err) {
      console.log(`[ERR] ${err.message}`);
    }
  }

  await browser.close();

  // --------------------------------------------------------------------------
  // STEP 3: ASSEMBLE MASTER DATASET & PERSIST
  // --------------------------------------------------------------------------
  console.log('\n[3/3] Assembling Master Dataset & Generating Spliced Series...');

  const nationalSpliced = spliceSeries(nationalHpi2018, nationalHpi2024, 'Jun 2025');
  const nationalHpiMetrics = calculateSeriesMetrics(nationalSpliced);
  const nationalCarpetMetrics = calculateSeriesMetrics(nationalCarpetComposite);

  const finalPayload = {
    metadata: {
      source: 'National Housing Bank (NHB RESIDEX)',
      portal: 'https://residex.nhbonline.org.in',
      base_year: 'FY 2024-25 = 100 (Rebased)',
      historical_base_year: 'FY 2017-18 = 100',
      overlap_quarter: 'Jun 2025',
      carpet_area_unit: 'INR per Sq. Ft. (RERA Carpet Area)',
      last_synced_utc: new Date().toISOString(),
      coverage: `${TARGET_CITIES.length} Key Metros & Tier-1 Housing Hubs`
    },
    national_composite_50_cities: {
      summary: {
        latest_quarter: nationalHpiMetrics.latest_quarter,
        hpi_index: nationalHpiMetrics.latest_value,
        hpi_qoq_pct: nationalHpiMetrics.qoq_pct,
        hpi_yoy_pct: nationalHpiMetrics.yoy_pct,
        hpi_cagr_3y: nationalHpiMetrics.cagr_3y,
        hpi_cagr_5y: nationalHpiMetrics.cagr_5y,
        hpi_total_growth_8y: nationalHpiMetrics.total_growth_pct,
        carpet_price_sqft: nationalCarpetMetrics.latest_value,
        carpet_price_qoq_pct: nationalCarpetMetrics.qoq_pct,
        carpet_price_yoy_pct: nationalCarpetMetrics.yoy_pct
      },
      spliced_continuous_hpi: nationalSpliced,
      hpi_assessment_by2024: nationalHpi2024,
      hpi_historical_by2018: nationalHpi2018,
      carpet_price_sqft_by2024: nationalCarpetComposite
    },
    cities: citiesPayload
  };

  await fs.mkdir(DATA_DIR, { recursive: true });

  // 1. Write JSON
  const jsonStr = JSON.stringify(finalPayload, null, 2);
  await fs.writeFile(JSON_OUTPUT_PATH, jsonStr, 'utf-8');
  console.log(`\n✓ Successfully wrote JSON to: ${JSON_OUTPUT_PATH} (${(jsonStr.length / 1024).toFixed(1)} KB)`);

  // 2. Write Vanilla Client-Side JS (window.KYF_RESIDEX)
  const jsContent =
    `// Auto-generated by js/sync_nhb_residex.mjs on ${new Date().toISOString()}\n` +
    `// National Housing Bank (NHB RESIDEX) Real Estate Price Index & Rates\n` +
    `window.KYF_RESIDEX = ${JSON.stringify(finalPayload, null, 2)};\n`;

  await fs.writeFile(JS_OUTPUT_PATH, jsContent, 'utf-8');
  console.log(`✓ Successfully wrote JS Bundle to: ${JS_OUTPUT_PATH} (${(jsContent.length / 1024).toFixed(1)} KB)`);

  console.log('\n================================================================');
  console.log('NHB RESIDEX DATA SYNC SUMMARY:');
  console.log('================================================================');
  console.log(`National 50-City HPI : ${nationalHpiMetrics.latest_value} (${nationalHpiMetrics.latest_quarter}) | YoY: ${nationalHpiMetrics.yoy_pct}% | 5Y CAGR: ${nationalHpiMetrics.cagr_5y}%`);
  console.log(`National Avg Price   : ₹${nationalCarpetMetrics.latest_value}/sq.ft. (YoY: ${nationalCarpetMetrics.yoy_pct}%)`);
  console.log('----------------------------------------------------------------');
  console.log('City        | Latest HPI | YoY HPI   | 5Y CAGR | Price/Sq.Ft | YoY Price');
  console.log('------------+------------+-----------+---------+-------------+----------');
  for (const [name, data] of Object.entries(citiesPayload)) {
    const s = data.summary || {};
    const hpiStr = (s.hpi_index || '-').toString().padEnd(10);
    const hpiYoy = (s.hpi_yoy_pct !== null ? `${s.hpi_yoy_pct > 0 ? '+' : ''}${s.hpi_yoy_pct}%` : '-').padEnd(9);
    const cagr5 = (s.hpi_cagr_5y !== null ? `${s.hpi_cagr_5y}%` : '-').padEnd(7);
    const price = (s.carpet_price_sqft ? `₹${s.carpet_price_sqft.toLocaleString('en-IN')}` : '-').padEnd(11);
    const priceYoy = s.carpet_price_yoy_pct !== null ? `${s.carpet_price_yoy_pct > 0 ? '+' : ''}${s.carpet_price_yoy_pct}%` : '-';
    console.log(`${name.padEnd(11)} | ${hpiStr} | ${hpiYoy} | ${cagr5} | ${price} | ${priceYoy}`);
  }
  console.log('================================================================\n');
}

runSync().catch(err => {
  console.error('\n[Fatal Error during NHB RESIDEX sync]:', err);
  process.exit(1);
});

