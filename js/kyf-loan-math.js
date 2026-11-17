/**
 * KYF_LOAN -- the sums behind the loan tools (loans.html). Pure functions, no DOM.
 *
 * emi(principal, annualRatePct, months)      the fixed monthly payment
 * schedule(opts)                             month-by-month table, with an optional extra payment
 * compare(opts)                              pay cash, or borrow and keep the cash invested?
 *
 * All money is in rupees. Interest compounds monthly (rate / 12), the way Indian lenders quote it.
 */
(function (root) {
  "use strict";

  const round2 = (n) => Math.round(n * 100) / 100;

  function emi(principal, annualRatePct, months) {
    const p = Number(principal), n = Math.round(Number(months));
    if (!(p > 0) || !(n > 0)) return 0;
    const r = Number(annualRatePct) / 1200;
    if (!(r > 0)) return p / n;
    const f = Math.pow(1 + r, n);
    return (p * r * f) / (f - 1);
  }

  /**
   * schedule({ principal, ratePct, months, extraMonthly, start })
   *   extraMonthly: an extra amount paid with every EMI (goes entirely to principal)
   *   start: Date of the first payment (default: next month)
   * returns { emi, rows:[{n, date, payment, principal, interest, extra, balance}], totalInterest,
   *           totalPaid, months, payoff, years:[{year, payment, principal, interest, balance}] }
   */
  function schedule(o) {
    const principal = Number(o.principal) || 0;
    const ratePct = Number(o.ratePct) || 0;
    const planned = Math.round(Number(o.months) || 0);
    const extra = Math.max(0, Number(o.extraMonthly) || 0);
    const pay = emi(principal, ratePct, planned);
    const r = ratePct / 1200;
    const first = o.start instanceof Date ? o.start : (() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth() + 1, 1); })();
    const rows = [];
    let bal = principal, totalInterest = 0, totalPaid = 0;
    for (let n = 1; bal > 0.005 && n <= planned + 1; n++) {
      const interest = bal * r;
      let principalPart = Math.min(bal, pay - interest + extra);
      if (n === planned) principalPart = bal;               // the last EMI clears whatever rounding left
      const payment = interest + principalPart;
      bal = Math.max(0, bal - principalPart);
      totalInterest += interest; totalPaid += payment;
      rows.push({ n, date: new Date(first.getFullYear(), first.getMonth() + n - 1, 1), payment: round2(payment), principal: round2(principalPart), interest: round2(interest), extra: round2(Math.min(extra, principalPart)), balance: round2(bal) });
    }
    const byYear = new Map();
    rows.forEach((row) => {
      const y = row.date.getFullYear();
      const e = byYear.get(y) || { year: y, payment: 0, principal: 0, interest: 0, balance: 0 };
      e.payment += row.payment; e.principal += row.principal; e.interest += row.interest; e.balance = row.balance;
      byYear.set(y, e);
    });
    return {
      emi: round2(pay), rows, months: rows.length, totalInterest: round2(totalInterest), totalPaid: round2(totalPaid),
      payoff: rows.length ? rows[rows.length - 1].date : null,
      years: [...byYear.values()].map((e) => ({ year: e.year, payment: round2(e.payment), principal: round2(e.principal), interest: round2(e.interest), balance: round2(e.balance) }))
    };
  }

  /**
   * compare({ price, down, ratePct, years, earnPct, takeHome })
   * Two ways to buy:
   *   cash: pay the full price now
   *   loan: pay `down` now, borrow the rest, and keep the cash you did not spend invested at earnPct,
   *         paying each EMI out of it.
   * edge = what is left in that invested pot when the loan ends. Positive: the loan route finishes
   * ahead by that much. Negative: paying cash would have saved you that much. Before tax, not guaranteed.
   */
  function compare(o) {
    const price = Math.max(0, Number(o.price) || 0);
    const down = Math.min(price, Math.max(0, Number(o.down) || 0));
    const loan = price - down;
    const months = Math.round((Number(o.years) || 0) * 12);
    const ratePct = Number(o.ratePct) || 0;
    const earnPct = Number(o.earnPct) || 0;
    const pay = emi(loan, ratePct, months);
    const totalInterest = loan > 0 && months > 0 ? pay * months - loan : 0;
    const s = earnPct / 1200;
    let pot = loan;
    for (let i = 0; i < months; i++) pot = pot * (1 + s) - pay;
    const takeHome = Number(o.takeHome) || 0;
    return {
      price, down, loan, months, emi: round2(pay), totalInterest: round2(totalInterest),
      totalCost: round2(down + pay * months),
      edge: round2(loan > 0 ? pot : 0),
      winner: loan <= 0 ? "cash" : pot > 0 ? "loan" : "cash",
      emiShare: takeHome > 0 ? pay / takeHome : null
    };
  }

  root.KYF_LOAN = { emi, schedule, compare };
})(typeof window !== "undefined" ? window : globalThis);
