/**
 * KYF feature catalog (`js/kyf-features.js` → window.KYF_FEATURES)
 * One list of what KYF offers. The home page ("What you can do here") and the top menu both read it,
 * so a new tool is added in exactly one place.
 *
 *   group:    plan | track | research   (how the home page groups tools)
 *   topBar:   true → shown as a link in the desktop top bar (all tools are in the phone menu)
 *   can[]:    what a person can actually do there, in plain words
 */
(function (global) {
  "use strict";

  var GROUPS = [
    { id: "plan", label: "Plan", hint: "Decide what the money is for" },
    { id: "track", label: "Track", hint: "See what you own and owe" },
    { id: "research", label: "Research", hint: "Check the numbers before you act" }
  ];

  var FEATURES = [
    {
      id: "goals", topOrder: 2, group: "plan", icon: "🎯", name: "Goals", href: "goals.html", topBar: true,
      tagline: "What are you saving for?",
      can: [
        "Start from an idea (home, college, retirement, insurance) or type your own",
        "See each goal in future rupees and the monthly SIP it needs",
        "Size retirement and term cover from your own figures",
        "Check whether all your goals fit your monthly surplus"
      ],
      cta: "Add a goal"
    },
    {
      id: "cadence", topOrder: 4, group: "plan", icon: "🗓️", name: "Cadence", href: "cadence.html", topBar: true,
      tagline: "Money habits and goal steps",
      can: [
        "A checklist for every goal you add",
        "Yearly money chores: emergency fund, insurance, tax, rebalancing",
        "Tick steps off and set dates"
      ],
      cta: "Open the checklist"
    },
    {
      id: "portfolio", topOrder: 3, group: "track", icon: "💼", name: "Portfolio", href: "portfolio.html", topBar: true,
      tagline: "Everything you own and owe, in one place",
      can: [
        "Add stocks, mutual funds, gold, property, FDs and loans by searching their name",
        "Import holdings from a broker CSV or Excel file",
        "View by asset class, goal or institution, for the whole family or one member",
        "Spot Regular-plan funds that cost more than their Direct twin"
      ],
      cta: "Open Portfolio",
      secondary: { label: "Try it with demo data", href: "portfolio.html?demo=1" }
    },
    {
      id: "market", topOrder: 1, group: "research", icon: "📊", name: "Market Benchmarks", short: "Markets", href: "market-performance.html", topBar: true,
      tagline: "Where markets, funds, gold and property stand",
      can: [
        "Inflation, interest rates and government bond yields",
        "Index valuations and returns over 1 month to 1 year",
        "Top mutual funds and stocks by return, gold and silver rates"
      ],
      cta: "See the benchmarks"
    },
    {
      id: "realestate", group: "research", icon: "🏙️", name: "Real Estate Calculator", href: "real-estate-calculator.html", topBar: false,
      tagline: "Rent vs buy, price per sq ft",
      can: [
        "Convert a builder's super built-up price to the real carpet-area price",
        "Compare with city rates from the National Housing Bank (RESIDEX)",
        "Add stamp duty and registration to see the true cost"
      ],
      cta: "Check a property price"
    },
    {
      id: "learn", group: "research", icon: "📖", name: "Learn", href: "learn.html", topBar: false,
      tagline: "Money words in plain language",
      can: [
        "Look up a finance word and what it means in plain words",
        "See it worked out with your own goal and today's rates",
        "Check what you learned with a one-question quiz"
      ],
      cta: "Learn a word"
    }
  ];

  // Not tools, but places people look for
  var EXTRAS = [
    { id: "home", name: "Home", href: "index.html", icon: "🏠", tagline: "" },
    { id: "framework", name: "Framework", href: "index.html#framework", icon: "🧭", tagline: "How KYF thinks about money", topBar: false }
  ];

  global.KYF_FEATURES = {
    groups: GROUPS,
    features: FEATURES,
    extras: EXTRAS,
    byGroup: function (id) { return FEATURES.filter(function (f) { return f.group === id; }); },
    /** Menu order: Home, every tool, then Framework. */
    menu: function () { return [EXTRAS[0]].concat(FEATURES, [EXTRAS[1]]); },
    topBar: function () { return FEATURES.concat([EXTRAS[1]]).filter(function (f) { return f.topBar; }); }
  };
})(typeof window !== "undefined" ? window : globalThis);
