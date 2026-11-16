/**
 * KYF_PATH_DATA -- "Your money path": the tasks of a financial life, in the order to do them.
 *
 * Six stages, each a group of small tasks. Order inside a stage is the order to do them.
 *   auto      the app can see this one itself (holdings added, goals named...) so it ticks itself
 *   recurDays comes back as "due again" after this many days once done (leave out for one-off tasks)
 *   doneLabel text for the manual done button when "I've done this" does not fit
 *   href/cta  where the work happens (a page in this app)
 *
 * Ids that start with "house-" are the older Cadence housekeeping items; they keep their ids so a
 * person's saved ticks and dates carry over.
 */
window.KYF_PATH_DATA = {
  stages: [
    { id: 1, icon: "🧭", name: "See where you stand", line: "You can only plan with numbers you can see." },
    { id: 2, icon: "🛡️", name: "Build your safety net", line: "So one bad month never becomes a bad decade." },
    { id: 3, icon: "🧹", name: "Clear the drag", line: "Stop money leaking before you ask it to grow." },
    { id: 4, icon: "🎯", name: "Give money a job", line: "Every rupee set aside for something that matters." },
    { id: 5, icon: "🌱", name: "Grow it wisely", line: "Keep costs low, spread risk, let time work." },
    { id: 6, icon: "🔁", name: "Keep it going", line: "A few calm check-ins a year keep the plan alive." }
  ],

  tasks: [
    // ---- 1. See where you stand ---------------------------------------------------------------
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
      id: "house-networth", stage: 1, icon: "📊", recurDays: 90, frequency: "Quarterly",
      title: "Check your net worth",
      why: "One number that tells you whether you are getting richer. Look at it every quarter.",
      how: ["Open Portfolio and read your net worth", "Note it down so next quarter has something to compare with"],
      href: "portfolio.html", cta: "Open Portfolio"
    },

    // ---- 2. Build your safety net -------------------------------------------------------------
    {
      id: "p-emergency", stage: 2, icon: "🧯",
      title: "Build a 6-month emergency fund",
      why: "A job loss or a hospital bill should never force you to sell investments at a bad time.",
      how: ["Add the 6-month buffer as a goal", "Keep it in a savings account or a liquid fund, not in shares"],
      href: "goals.html", cta: "Set the goal"
    },
    {
      id: "house-insurance-audit", stage: 2, icon: "🛡️", recurDays: 365, frequency: "Every year",
      title: "Review your term and health insurance",
      why: "Insurance is what protects your family's plan if something happens to you.",
      how: ["Term cover of about 10 to 15 times your yearly income, pure term with no investment mixed in", "Health cover with a family floater and a super top-up"]
    },
    {
      id: "house-nominees-will", stage: 2, icon: "🔐", recurDays: 365, frequency: "Every year",
      title: "Update nominees and keep a family vault",
      why: "Without a nominee, even your own money can get stuck with the people you love.",
      how: ["Check nominees on every bank account, demat account, EPF and policy", "Keep a list of accounts and where the papers are, and tell one trusted person"]
    },

    // ---- 3. Clear the drag --------------------------------------------------------------------
    {
      id: "p-highinterest", stage: 3, icon: "🔥",
      title: "Pay off expensive debt first",
      why: "A card or personal loan at 18% or more beats almost any investment, so clear it before investing more.",
      how: ["List each debt with its interest rate", "Pay extra on the highest rate, the minimum on the rest", "No such debt? Mark this as not for you"]
    },
    {
      id: "house-credit-card-debt", stage: 3, icon: "💳", recurDays: 30, frequency: "Every month",
      title: "Pay cards in full and check your CIBIL score",
      why: "Interest on unpaid cards is the most expensive money you will ever touch.",
      how: ["Set auto-pay to the total amount due, never the minimum", "Cancel subscriptions you no longer use", "Download your CIBIL report every quarter"]
    },
    {
      id: "house-savings-audit", stage: 3, icon: "🏦", recurDays: 30, frequency: "Every month",
      title: "Put idle bank money to work",
      why: "Savings accounts pay little. Cash you will not need this month can earn more.",
      how: ["Look for balances sitting above what you need for the month", "Move the extra to a sweep-in FD or a liquid fund"]
    },

    // ---- 4. Give money a job ------------------------------------------------------------------
    {
      id: "p-goal", stage: 4, icon: "✨", auto: "goal",
      title: "Name your first goal",
      why: "Money with a purpose is far easier to save. A home, college, a break from work, anything you care about.",
      how: ["Pick an idea or type your own", "Add roughly what it costs today and the year you want it"],
      href: "goals.html", cta: "Add a goal"
    },
    {
      id: "p-goals-complete", stage: 4, icon: "🗓️", auto: "goalsComplete",
      title: "Give every goal a cost and a year",
      why: "Those two numbers are enough for us to work out the monthly amount, inflation included.",
      how: ["Open each goal and fill in what is missing"],
      href: "goals.html", cta: "Open goals"
    },
    {
      id: "p-assign", stage: 4, icon: "🔗", auto: "assigned",
      title: "Give each holding a goal",
      why: "This is what makes the progress bars real: which money is for which goal.",
      how: ["Use Suggest to match by when you need the money", "Change anything that does not feel right"],
      href: "portfolio.html?assign=1", cta: "Give money a job"
    },
    {
      id: "p-sip", stage: 4, icon: "⚙️",
      title: "Automate the monthly amount for each goal",
      why: "Money that moves on salary day is money that actually gets invested.",
      how: ["Open a goal to see its monthly amount", "Set up the auto-debit: a SIP or a recurring deposit"],
      href: "goals.html", cta: "See the amounts"
    },

    // ---- 5. Grow it wisely --------------------------------------------------------------------
    {
      id: "house-mf-xray", stage: 5, icon: "🔍", recurDays: 182, frequency: "Twice a year",
      title: "Check your funds for hidden costs",
      why: "Regular plans pay a distributor 0.5% to 1.2% a year out of your returns. Direct plans do not.",
      how: ["Find funds held as Regular plans and switch to the Direct plan", "Drop funds that overlap with each other"],
      href: "portfolio.html", cta: "Open Portfolio"
    },
    {
      id: "house-equity-check", stage: 5, icon: "📈", recurDays: 90, frequency: "Every quarter",
      title: "Review your shares and demat accounts",
      why: "One company going wrong should not hurt your whole plan.",
      how: ["No single stock above about 10% of your total wealth", "Read each company's quarterly results and note dividends received"],
      href: "portfolio.html", cta: "Open Portfolio"
    },
    {
      id: "house-epf-ppf-nps", stage: 5, icon: "📜", recurDays: 365, frequency: "Every year",
      title: "Check EPF, PPF and NPS passbooks",
      why: "These are your steady, tax-friendly retirement building blocks.",
      how: ["Download the EPFO passbook and check your employer's credits", "Deposit your PPF amount early in the year (up to ₹1.5 lakh), by the 5th of the month to earn that month's interest", "Check your NPS balance and contributions"]
    },
    {
      id: "house-rebalance", stage: 5, icon: "⚖️", recurDays: 365, frequency: "Every year",
      title: "Rebalance once a year",
      why: "Markets drift your mix away from what you planned. Rebalancing quietly sells high and buys low.",
      how: ["Compare equity, debt and gold weights with your target", "Trim what has grown too big and top up what has fallen behind"],
      href: "portfolio.html", cta: "Open Portfolio"
    },

    // ---- 6. Keep it going ---------------------------------------------------------------------
    {
      id: "p-review", stage: 6, icon: "🌤️", recurDays: 90, frequency: "Every quarter",
      title: "Check in on your goals",
      why: "A quick look every quarter keeps you honest and lets you celebrate how far you have come.",
      how: ["Open Goals and see each bar", "Adjust a monthly amount if life has changed"],
      href: "goals.html", cta: "Open goals"
    },
    {
      id: "house-market-performance", stage: 6, icon: "🌍", recurDays: 90, frequency: "Every quarter",
      title: "Look at how markets have done",
      why: "Know what is normal, so a bad month does not scare you into a bad decision.",
      how: ["Skim Nifty, gold and FD returns over 1, 3 and 5 years"],
      href: "market-performance.html", cta: "Open Markets"
    },
    {
      id: "house-tax-harvesting", stage: 6, icon: "🧾", recurDays: 365, frequency: "Every year, before March",
      title: "Plan tax and harvest gains",
      why: "A little planning before the year ends can save real money.",
      how: ["Compare the old and new tax regimes for your income", "Book up to ₹1.25 lakh of long-term equity gains tax-free each year", "Check advance tax if you owe any"]
    }
  ]
};
