/**
 * KYF_PATH_DATA -- "Your money path": the tasks of a financial life, in the order to do them.
 *
 * Three stages, each a group of small tasks. Order inside a stage is the order to do them.
 *   auto      the app can see this one itself (holdings added, goals named...) so it ticks itself
 *   recurDays comes back as "due again" after this many days once done (leave out for one-off tasks)
 *   doneLabel text for the manual done button when "I've done this" does not fit
 *   when      only shown when this is true of the person's data (e.g. "hasDebt"), so nobody sees chores that do not apply
 *   href/cta  where the work happens (a page in this app)
 *
 * Ids that start with "house-" are the older Cadence housekeeping items; they keep their ids so a
 * person's saved ticks and dates carry over.
 */
window.KYF_PATH_DATA = {
  stages: [
    { id: 1, icon: "🧭", name: "Know what you have", line: "A complete picture of your money, and a regular look at it." },
    { id: 2, icon: "🎯", name: "Set your goals", line: "Give your money something to work towards, and check in on it." },
    { id: 3, icon: "🛡️", name: "Protect your family", line: "Cover the big risks so one bad day never undoes years of saving." }
  ],

  // Older task ids that no longer exist. Anything saved against them is dropped quietly.
  retired: ["house-insurance-audit", "house-credit-card-debt", "house-savings-audit", "house-mf-xray", "house-equity-check", "house-epf-ppf-nps", "house-market-performance", "p-review", "p-emergency", "p-sip", "p-highinterest", "house-rebalance", "house-tax-harvesting"],

  tasks: [
    // ---- 1. Know what you have: is the portfolio complete? -------------------------------------
    { id: "p-savings", stage: 1, icon: "🏦", auto: "savings", title: "Add your savings accounts",
      why: "Money in the bank is part of your picture, even if it is not earning much.",
      how: ["Add each account with today's balance"], href: "portfolio.html?add=cash", cta: "Add savings" },
    { id: "p-fd", stage: 1, icon: "🔒", auto: "fd", title: "Add your fixed deposits",
      why: "FDs are your safe, predictable money.",
      how: ["Add each FD with its current value and rate"], href: "portfolio.html?add=fd", cta: "Add an FD" },
    { id: "p-mf", stage: 1, icon: "📦", auto: "mf", title: "Add your mutual funds",
      why: "Funds are where most long-term growth money sits.",
      how: ["Search the fund by name, or import a statement from your broker or AMC"], href: "portfolio.html?add=mf", cta: "Add a fund" },
    { id: "p-equity", stage: 1, icon: "📈", auto: "equity", title: "Add your shares",
      why: "Direct shares carry the most risk, so it helps to see them next to everything else.",
      how: ["Add each stock, or import your demat statement"], href: "portfolio.html?add=equity", cta: "Add shares" },
    { id: "p-epf", stage: 1, icon: "👷", auto: "epf", tag: "Retirement", title: "Add your EPF",
      why: "For many people, EPF is the biggest retirement asset they already have.",
      how: ["Use the balance on your EPFO passbook"], href: "portfolio.html?add=epf", cta: "Add EPF" },
    { id: "p-ppf", stage: 1, icon: "📜", auto: "ppf", tag: "Retirement", title: "Add your PPF",
      why: "A tax-free, government-backed building block for the long term.",
      how: ["Use the balance in your PPF passbook"], href: "portfolio.html?add=ppf", cta: "Add PPF" },
    { id: "p-gold", stage: 1, icon: "🪙", auto: "gold", title: "Add gold or property",
      why: "Gold and property are real wealth too, and often the largest part of it.",
      how: ["Add gold you hold as jewellery, coins, bars or bonds", "Add property at today's rough value"], href: "portfolio.html?add=gold", cta: "Add gold" },
    { id: "p-debts", stage: 1, icon: "🧾", auto: "liabilities", title: "Add what you owe",
      why: "Loans and card balances are the other half of your net worth.",
      how: ["Add home, car and personal loans and any card dues"], href: "portfolio.html?add=loan", cta: "Add a loan", doneLabel: "I owe nothing" },
    { id: "house-networth", stage: 1, icon: "📊", recurDays: 90, frequency: "Every quarter", title: "Check your net worth",
      why: "Once your picture is complete, one number tells you whether you are getting richer.",
      how: ["Open Portfolio and read your net worth", "Do this again each quarter"], href: "portfolio.html", cta: "Open Portfolio" },

    // ---- 2. Set your goals ---------------------------------------------------------------------
    { id: "p-goal", stage: 2, icon: "✨", auto: "goal", title: "Set a goal",
      why: "Money with a purpose is far easier to save. A home, college, a break from work, anything.",
      how: ["Pick an idea or type your own", "Add roughly what it costs today and the year you want it"],
      href: "goals.html", cta: "Add a goal", doneLabel: "No goals right now" },
    { id: "p-goals-complete", stage: 2, icon: "🗓️", auto: "goalsComplete", when: "hasGoal", title: "Give every goal a cost and a year",
      why: "Those two numbers are enough for us to work out the monthly amount, inflation included.",
      how: ["Open each goal and fill in what is missing"], href: "goals.html", cta: "Open goals" },
    { id: "p-assign", stage: 2, icon: "🔗", auto: "assigned", when: "hasGoal", title: "Give each holding a goal",
      why: "This is what makes the progress bars real: which money is for which goal.",
      how: ["Use Suggest to match by when you need the money"], href: "portfolio.html?assign=1", cta: "Give money a job" },
    { id: "house-goal-review", stage: 2, icon: "🌤️", recurDays: 90, frequency: "Every quarter", when: "hasGoal", title: "Track your goals",
      why: "A regular look keeps you honest and lets you celebrate how far you have come.",
      how: ["Open Goals and see each bar", "Adjust a monthly amount if life has changed"], href: "goals.html", cta: "Open goals" },

    // ---- 3. Protect your family ----------------------------------------------------------------
    { id: "p-term", stage: 3, icon: "🛡️", recurDays: 365, frequency: "Every year", title: "Term life insurance",
      why: "If others depend on your income, term cover keeps their plans going if something happens to you.",
      how: ["Pure term insurance, with no investment mixed in"], doneLabel: "I have it", },
    { id: "p-health", stage: 3, icon: "🏥", recurDays: 365, frequency: "Every year", title: "Health insurance",
      why: "Cover from an employer can end the day you leave the job. A policy of your own does not.",
      how: ["A family health policy in your name"], doneLabel: "I have it" },
    { id: "p-motor", stage: 3, icon: "🚗", recurDays: 365, frequency: "Every year", title: "Car and two-wheeler insurance",
      why: "Third-party cover is the law, and a comprehensive policy protects your own vehicle too.",
      how: ["Keep the renewal date handy so cover never lapses"], doneLabel: "I have it" },
    { id: "house-nominees-will", stage: 3, icon: "🔐", recurDays: 365, frequency: "Every year", title: "Nominees on every account",
      why: "Without a nominee, even your own money can get stuck with the people you love.",
      how: ["Check nominees on bank accounts, demat, EPF and policies"], doneLabel: "All updated" }
  ]
};
