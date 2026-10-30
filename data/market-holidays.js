/**
 * Know Your Finance (KYF) — Module 0: Indian Market Calendar & Holidays (2026)
 * Source: Official NSE Circular Ref No: NSE/CMTR/71775 (Capital Market & F&O Segments)
 */
window.KYF_MARKET_CALENDAR = {
  year: 2026,
  timezone: "Asia/Kolkata",
  regularHours: { open: "09:15", close: "15:30", eodNavReady: "23:00" },

// Inside data/market-holidays.js -> weekdayHolidays object, include 2025 Q4 + 2026:
  weekdayHolidays: {
    // 2025 Q4 NSE Holidays (For accurate 1Y lookback in Oct–Dec 2026)
    "2025-10-02": "Mahatma Gandhi Jayanti / Dussehra (2025)",
    "2025-10-21": "Diwali Laxmi Pujan (2025)",
    "2025-10-22": "Diwali-Balipratipada (2025)",
    "2025-11-05": "Prakash Gurpurb Sri Guru Nanak Dev (2025)",
    "2025-12-25": "Christmas (2025)",

    // 2026 Official NSE Weekday Holidays
    "2026-01-26": "Republic Day",
    "2026-03-03": "Holi",
    "2026-03-26": "Shri Ram Navami",
    "2026-03-31": "Shri Mahavir Jayanti",
    "2026-04-03": "Good Friday",
    "2026-04-14": "Dr. Baba Saheb Ambedkar Jayanti",
    "2026-05-01": "Maharashtra Day",
    "2026-05-28": "Bakri Id",
    "2026-06-26": "Muharram",
    "2026-09-14": "Ganesh Chaturthi",
    "2026-10-02": "Mahatma Gandhi Jayanti",
    "2026-10-20": "Dussehra",
    "2026-11-10": "Diwali-Balipratipada",
    "2026-11-24": "Prakash Gurpurb Sri Guru Nanak Dev",
    "2026-12-25": "Christmas"
  },

  // Holidays falling on Saturday/Sunday (For reference & UI badges)
  weekendHolidays: {
    "2026-02-15": "Mahashivratri (Sunday)",
    "2026-03-21": "Id-Ul-Fitr / Ramadan Eid (Saturday)",
    "2026-08-15": "Independence Day (Saturday)",
    "2026-11-08": "Diwali Laxmi Pujan (Sunday — Special Muhurat Session)"
  },

  // Special Weekend Sessions where EOD Bhavcopy IS generated
  specialTradingSessions: {
    "2026-11-08": {
      event: "Diwali Laxmi Pujan — Muhurat Trading",
      open: "14:20",
      close: "15:30"
    }
  },

  // Helper: Format any Date object to 'YYYY-MM-DD' in IST
  toISODate(dateObj = new Date()) {
    const istString = dateObj.toLocaleString("en-CA", { timeZone: "Asia/Kolkata" });
    return istString.split(",")[0].trim(); // Returns YYYY-MM-DD
  },

  // Helper: Check if a given 'YYYY-MM-DD' is an active trading day
  isTradingDay(isoDate) {
    if (this.specialTradingSessions[isoDate]) return true;
    if (this.weekdayHolidays[isoDate]) return false;
    const [y, m, d] = isoDate.split("-").map(Number);
    const dayOfWeek = new Date(y, m - 1, d).getDay();
    return dayOfWeek !== 0 && dayOfWeek !== 6; // False on Sunday (0) & Saturday (6)
  },

  // Helper: Get the most recent completed trading day (for EOD Bhavcopy & staleness checks)
  getLastCompletedTradingDay(now = new Date()) {
    const istNow = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
    const todayISO = this.toISODate(now);
    const currentMinutes = istNow.getHours() * 60 + istNow.getMinutes();
    const closeMinutes = 15 * 60 + 45; // 3:45 PM IST buffer for EOD close

    let cursor = new Date(istNow);
    // If today is a trading day and it's past 3:45 PM IST, today is the latest EOD date
    if (this.isTradingDay(todayISO) && currentMinutes >= closeMinutes) {
      return {
        isoDate: todayISO,
        compactDate: todayISO.replace(/-/g, ""),
        reason: "Today's market session completed"
      };
    }

    // Otherwise, step backward day-by-day until we hit a valid trading day
    for (let i = 1; i <= 10; i++) {
      cursor.setDate(cursor.getDate() - 1);
      const y = cursor.getFullYear();
      const m = String(cursor.getMonth() + 1).padStart(2, "0");
      const d = String(cursor.getDate()).padStart(2, "0");
      const candidateISO = `${y}-${m}-${d}`;
      if (this.isTradingDay(candidateISO)) {
        return {
          isoDate: candidateISO,
          compactDate: `${y}${m}${d}`,
          holidayNote: this.weekdayHolidays[todayISO] || null
        };
      }
    }
  }
};