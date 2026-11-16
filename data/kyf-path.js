/**
 * KYF_PATH_DATA -- "Your money path": the tasks of a financial life, in the order to do them.
 *
 * Four stages, each a group of small tasks. Order inside a stage is the order to do them.
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
    { id: 1, icon: "🧭", name: "Know what you have", line: "You can only plan with numbers you can see." },
    { id: 2, icon: "🎯", name: "Set your goals", line: "Give your money something to work towards." },
    { id: 3, icon: "🛡️", name: "Protect your family", line: "So one bad day never undoes years of saving." },
    { id: 4, icon: "🔁", name: "Keep it going", line: "A few calm check-ins a year keep the plan alive." }
  ],

  // Older task ids that no longer exist. Anything saved against them is dropped quietly.
  retired: ["house-insurance-audit", "house-credit-card-debt", "house-savings-audit", "house-mf-xray", "house-equity-check", "house-epf-ppf-nps", "house-market-performance", "p-review"],

  tasks: [
    // ---- 1. Know what you have ----------------------------------------------------------------
    {
      id: "p-holdings", stage: 1, icon: "🏛️", auto: "holdings",
      title: "Add what you own",
      why: "Everything else builds on this. Bank balances, FDs, EPF, PPF, funds, stocks, gold and property all count.",
      how: ["Add each holding, or import a broker statement in one go", "Rough values are fine to begin with"],
      href: "portfolio.html", cta: "Add holdings"
    },
    {
      id: "p-debts", stage: 1, icon: "🧾", auto: "liabilities",
      title: "Add what you owe",
      why: "Loans and card balances are the other half of your net worth.",
      how: ["Add home, car and personal loans and any card dues", "No loans or dues? Tap \"I owe nothing\""],
      href: "portfolio.html?add=loan", cta: "Add a loan", doneLabel: "I owe nothing"
    },
    {
      id: "p-highinterest", stage: 1, icon: "🔥", when: "hasDebt",
      title: "Pay off expensive debt first",
      why: "A card or personal loan at 18% or more beats almost any investment, so clear it before investing more.",
      how: ["Pay card dues in full every month, never the minimum", "Put any extra towards the loan with the highest rate"]
    },

    // ---- 2. Set your goals --------------------------------------------------------------------
    {
      id: "p-emergency", stage: 2, icon: "🧯", auto: "emergencyGoal",
      title: "Start with a 6-month emergency fund",
      why: "A job loss or a hospital bill should never force you to sell investments at a bad time.",
      how: ["Add the 6-month buffer as a goal", "Keep it in a savings account or a liquid fund, not in shares"],
      href: "goals.html", cta: "Set the goal"
    },
    {
      id: "p-goal", stage: 2, icon: "✨", auto: "goal",
      title: "Name a goal you care about",
      why: "Money with a purpose is far easier to save. A home, college, a break from work, anything.",
      how: ["Pick an idea or type your own", "Add roughly what it costs today and the year you want it"],
      href: "goals.html", cta: "Add a goal"
    },
    {
      id: "p-goals-complete", stage: 2, icon: "🗓️", auto: "goalsComplete",
      title: "Give every goal a cost and a year",
      why: "Those two numbers are enough for us to work out the monthly amount, inflation included.",
      how: ["Open each goal and fill in what is missing"],
      href: "goals.html", cta: "Open goals"
    },
    {
      id: "p-assign", stage: 2, icon: "🔗", auto: "assigned",
      title: "Give each holding a goal",
      why: "This is what makes the progress bars real: which money is for which goal.",
      how: ["Use Suggest to match by when you need the money", "Change anything that does not feel right"],
      href: "portfolio.html?assign=1", cta: "Give money a job"
    },
    {
      id: "p-sip", stage: 2, icon: "⚙️",
      title: "Automate the monthly amount",
      why: "Money that moves on salary day is money that actually gets invested.",
      how: ["Open a goal to see its monthly amount", "Set up the auto-debit: a SIP or a recurring deposit"],
      href: "goals.html", cta: "See the amounts"
    },

    // ---- 3. Protect your family ---------------------------------------------------------------
    {
      id: "p-term", stage: 3, icon: "🛡️", recurDays: 365, frequency: "Every year",
      title: "Have a term life plan",
      why: "If you earn for others, term cover is what keeps their plans going if something happens to you.",
      how: ["Pure term insurance, with no investment mixed in", "Look at it again whenever income or family changes"]
    },
    {
      id: "p-health", stage: 3, icon: "🏥", recurDays: 365, frequency: "Every year",
      title: "Have your own health cover",
      why: "Cover from an employer can end the day you leave the job. A policy of your own does not.",
      how: ["A family health policy in your name", "Check that it still suits you each year"]
    },
    {
      id: "house-nominees-will", stage: 3, icon: "🔐", recurDays: 365, frequency: "Every year",
      title: "Update nominees everywhere",
      why: "Without a nominee, even your own money can get stuck with the people you love.",
      how: ["Check nominees on every bank account, demat account, EPF and policy"]
    },

    // ---- 4. Keep it going ---------------------------------------------------------------------
    {
      id: "house-networth", stage: 4, icon: "📊", recurDays: 90, frequency: "Every quarter",
      title: "Quarterly check-in",
      why: "One look at your net worth and your goal bars tells you whether you are on track.",
      how: ["Read your net worth on Portfolio", "Open Goals and see each bar; adjust a monthly amount if life has changed"],
      href: "portfolio.html", cta: "Open Portfolio"
    },
    {
      id: "house-rebalance", stage: 4, icon: "⚖️", recurDays: 365, frequency: "Every year",
      title: "Review your portfolio once a year",
      why: "Markets drift your mix away from what you planned. A yearly look quietly fixes that.",
      how: ["Trim what has grown too big and top up what has fallen behind", "Switch any Regular fund to its Direct plan", "No single stock above about 10% of your wealth"],
      href: "portfolio.html", cta: "Open Portfolio"
    },
    {
      id: "house-tax-harvesting", stage: 4, icon: "🧾", recurDays: 365, frequency: "Every year, before March",
      title: "Plan your tax",
      why: "A little planning before the year ends can save real money.",
      how: ["Compare the old and new tax regimes for your income", "Book up to ₹1.25 lakh of long-term equity gains tax-free each year"]
    }
  ]
};
