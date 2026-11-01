// Curated benchmark mutual fund dataset matching admin/sync_market_data.py schema
window.KYF_MARKET_MF = {
  asOf: "2026-10-30",
  horizons: {
    "latest": "2026-10-30",
    "m1": "2026-09-30",
    "m3": "2026-07-30",
    "m6": "2026-04-30",
    "y1": "2025-10-30"
  },
  columns: ["directCode", "fundName", "category", "directNav", "regularNav", "ret1m", "ret3m", "ret6m", "ret1y"],
  schemes: [
    // Large Cap & Index
    ["120716", "UTI Nifty 50 Index Fund - Direct Plan", "Index / Large Cap", 192.45, 186.20, 1.88, -5.12, -3.85, -10.82],
    ["120684", "HDFC Nifty 50 Index Fund - Direct Plan", "Index / Large Cap", 244.30, 235.10, 1.86, -5.15, -3.88, -10.85],
    ["120465", "ICICI Prudential Bluechip Fund - Direct Plan", "Large Cap", 118.92, 109.45, 1.65, -4.85, -3.20, -8.75],
    ["120152", "Nippon India Large Cap Fund - Direct Plan", "Large Cap", 98.64, 89.20, 2.10, -3.95, -2.15, -6.40],
    ["118989", "Mirae Asset Large Cap Fund - Direct Plan", "Large Cap", 124.50, 112.80, 1.45, -5.40, -4.10, -9.80],
    ["119598", "HDFC Top 100 Fund - Direct Plan", "Large Cap", 1210.40, 1115.60, 2.30, -3.60, -1.80, -5.20],
    
    // Flexi Cap & Multi Cap
    ["122639", "Parag Parikh Flexi Cap Fund - Direct Plan", "Flexi Cap", 84.62, 79.15, 0.95, -2.40, 1.85, 8.45],
    ["141987", "Quant Flexi Cap Fund - Direct Plan", "Flexi Cap", 102.35, 93.10, -1.80, -6.10, -0.90, 12.60],
    ["120322", "HDFC Flexi Cap Fund - Direct Plan", "Flexi Cap", 1945.80, 1780.20, 1.90, -4.20, 2.10, 14.20],
    ["148810", "JM Flexicap Fund - Direct Plan", "Flexi Cap", 128.45, 116.80, 2.45, -2.80, 5.60, 22.40],
    ["141445", "Kotak Flexicap Fund - Direct Plan", "Flexi Cap", 88.90, 81.25, 0.85, -4.60, -1.20, 6.10],

    // Mid Cap
    ["127042", "Motilal Oswal Midcap Fund - Direct Plan", "Mid Cap", 112.80, 101.40, -2.10, -4.80, 3.20, 18.90],
    ["120505", "HDFC Mid-Cap Opportunities Fund - Direct Plan", "Mid Cap", 188.60, 171.20, -1.85, -5.60, -0.40, 12.80],
    ["120166", "Nippon India Growth Fund - Direct Plan", "Mid Cap", 4210.50, 3820.00, -2.40, -6.10, -1.80, 14.50],
    ["120352", "Kotak Emerging Equity Fund - Direct Plan", "Mid Cap", 132.40, 120.10, -3.10, -6.90, -2.40, 9.80],
    ["120828", "Edelweiss Mid Cap Fund - Direct Plan", "Mid Cap", 94.20, 85.60, -1.90, -5.20, 1.10, 15.20],

    // Small Cap
    ["120178", "Nippon India Small Cap Fund - Direct Plan", "Small Cap", 195.40, 176.50, -4.20, -5.80, 2.40, 16.80],
    ["120847", "Quant Small Cap Fund - Direct Plan", "Small Cap", 282.10, 252.40, -5.10, -7.20, -1.40, 11.20],
    ["145881", "Tata Small Cap Fund - Direct Plan", "Small Cap", 48.90, 44.10, -3.40, -4.90, 4.80, 21.40],
    ["147944", "Bandhan Small Cap Fund - Direct Plan", "Small Cap", 42.60, 38.80, -2.80, -3.90, 6.20, 24.10],
    ["125354", "Axis Small Cap Fund - Direct Plan", "Small Cap", 108.50, 98.20, -3.90, -6.40, -0.80, 8.90],

    // Hybrid & Balanced Advantage
    ["120468", "ICICI Prudential Balanced Advantage Fund - Direct Plan", "Hybrid / BAF", 82.40, 75.80, 1.20, -1.80, 2.90, 11.40],
    ["119582", "HDFC Balanced Advantage Fund - Direct Plan", "Hybrid / BAF", 532.10, 485.40, 1.65, -1.40, 4.20, 15.80],
    ["131652", "Kotak Equity Hybrid Fund - Direct Plan", "Hybrid / Aggressive", 68.90, 62.40, 0.80, -2.90, 1.40, 9.60],
    ["120843", "Edelweiss Balanced Advantage Fund - Direct Plan", "Hybrid / BAF", 54.30, 49.80, 0.95, -1.60, 2.40, 10.20],

    // Debt & Liquid
    ["119565", "HDFC Liquid Fund - Direct Plan", "Debt / Liquid", 5120.40, 5012.80, 0.58, 1.74, 3.51, 7.15],
    ["120448", "ICICI Prudential Savings Fund - Direct Plan", "Debt / Low Duration", 584.20, 568.10, 0.62, 1.86, 3.75, 7.55],
    ["120371", "Kotak Corporate Bond Fund - Direct Plan", "Debt / Corp Bond", 3840.10, 3710.40, 0.65, 1.95, 3.92, 7.82],
    ["120288", "Aditya Birla Sun Life Banking & PSU Debt - Direct Plan", "Debt / Banking & PSU", 395.40, 382.10, 0.64, 1.90, 3.84, 7.68],

    // ELSS Tax Saver
    ["120475", "Mirae Asset ELSS Tax Saver Fund - Direct Plan", "ELSS / Tax Saver", 52.80, 47.60, 1.40, -5.20, -3.40, -8.10],
    ["120849", "Quant ELSS Tax Saver Fund - Direct Plan", "ELSS / Tax Saver", 412.50, 372.00, -2.10, -6.80, -1.20, 13.40],
    ["149812", "Parag Parikh ELSS Tax Saver Fund - Direct Plan", "ELSS / Tax Saver", 32.40, 30.10, 1.10, -2.10, 2.80, 10.60]
  ]
};

