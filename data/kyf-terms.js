/**
 * KYF term tips (`data/kyf-terms.js` → window.KYF_TERMS)
 * Words that get a small "?" next to them. Tapping it shows `tip` (one or two plain lines).
 *
 *   id      stable key; later also the topic page: learn.html?term=<id>
 *   term    display name
 *   exact   spellings matched exactly (acronyms such as "SIP")
 *   words   spellings matched ignoring case ("emergency fund")
 *   tip     plain-language meaning, 170 characters or fewer, no numbers that go out of date
 *
 * Tips are educational wording and should be reviewed by a CFP before wide release.
 */
window.KYF_TERMS = {
  version: 1,
  topicPage: null, // set to "learn.html" when the topic page ships; the tip then shows "Learn more"
  terms: [
    { id: "sip", term: "SIP", exact: ["SIP", "SIPs"],
      tip: "Systematic Investment Plan: a fixed amount invested into a fund on a set date each month." },
    { id: "step_up", term: "Step-up", words: ["step-up", "step up SIP"],
      tip: "Raising your SIP by a set amount or percentage each year as your income grows." },
    { id: "nav", term: "NAV", exact: ["NAV"],
      tip: "Net Asset Value: the price of one unit of a mutual fund today. A low NAV does not mean the fund is cheap." },
    { id: "cagr", term: "CAGR", exact: ["CAGR"],
      tip: "Compound Annual Growth Rate: the steady yearly rate that would turn the starting amount into the ending amount. It smooths out the ups and downs." },
    { id: "xirr", term: "XIRR", exact: ["XIRR"],
      tip: "Your true yearly return when money went in on different dates, such as monthly SIPs." },
    { id: "expense_ratio", term: "Expense ratio", words: ["expense ratio"],
      tip: "The yearly fee a fund charges, as a percentage of your money. It is taken out of the NAV, so you never see a bill." },
    { id: "direct_regular", term: "Direct and Regular plans", words: ["direct plan", "regular plan"],
      tip: "Same fund, same investments. A Regular plan pays the distributor a commission out of your returns; a Direct plan does not, so its NAV grows faster." },
    { id: "folio", term: "Folio", words: ["folio"],
      tip: "The account number a fund company gives you to keep track of your units with that company." },
    { id: "benchmark", term: "Benchmark", words: ["benchmark"],
      tip: "The index a fund or portfolio is measured against, such as the Nifty 50. Beating it is called outperforming." },
    { id: "liquid_fund", term: "Liquid fund", words: ["liquid fund", "liquid funds"],
      tip: "A mutual fund that holds very short-term debt. Often used to park money you may need soon." },
    { id: "inflation", term: "Inflation", words: ["inflation"],
      tip: "How fast prices rise. Each year of inflation makes the same amount of money buy a little less." },
    { id: "cpi", term: "CPI", exact: ["CPI"],
      tip: "Consumer Price Index: the official measure of how much everyday prices have risen. KYF uses it to inflate costs like a car or a home." },
    { id: "real_return", term: "Real return", words: ["real return"],
      tip: "Your return after taking out inflation. Growth of 7% with 5% inflation is only about 2% in real terms." },
    { id: "corpus", term: "Corpus", words: ["corpus"],
      tip: "The lump sum you need to have built by a date so that it can fund a goal, such as retirement." },
    { id: "annuity", term: "Annuity", words: ["annuity"],
      tip: "A series of equal payments over time, like a monthly pension. Retirement planning uses it to work out the corpus you need." },
    { id: "emergency_fund", term: "Emergency fund", words: ["emergency fund", "peace buffer"],
      tip: "Money kept in safe, easy-to-reach places to cover living costs if your income stops, usually several months of expenses." },
    { id: "term_insurance", term: "Term insurance", words: ["term insurance", "term cover", "term life"],
      tip: "Pure life cover: it pays your family a lump sum if you die within the term, and nothing if you outlive it. It has no savings element." },
    { id: "emi", term: "EMI", exact: ["EMI", "EMIs"],
      tip: "Equated Monthly Instalment: the fixed monthly payment on a loan, part interest and part repayment of the amount borrowed." },
    { id: "rebalancing", term: "Rebalancing", words: ["rebalancing", "rebalance"],
      tip: "Selling a little of what has grown and buying what has lagged, to bring your mix back to the plan." },
    { id: "carpet_area", term: "Carpet area", words: ["carpet area", "carpet rate"],
      tip: "The usable floor area inside the walls of a flat. Builders often quote price on the larger super built-up area, which includes shared spaces." },
    { id: "fd", term: "Fixed deposit", exact: ["FD", "FDs"], words: ["fixed deposit"],
      tip: "A bank deposit for a fixed time at a fixed rate. Safe, but the interest is taxable and may not keep up with inflation." },
    { id: "ppf", term: "PPF", exact: ["PPF"],
      tip: "Public Provident Fund: a government-backed long-term savings scheme with a 15-year lock-in and tax-free interest." },
    { id: "epf", term: "EPF", exact: ["EPF"],
      tip: "Employees' Provident Fund: retirement savings that you and your employer add to each month, earning a government-set rate." },
    { id: "sgb", term: "Sovereign Gold Bond", exact: ["SGB", "SGBs"],
      tip: "A government bond priced in grams of gold. You earn the gold price movement plus a small yearly interest." }
  ]
};
