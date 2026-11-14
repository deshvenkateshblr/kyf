/**
 * KYF vocabulary (`data/kyf-terms.js` → window.KYF_TERMS): the one list of finance words.
 * Used by the "?" tips on Goals and Portfolio, the Money Word card on Home, and the Learn page.
 *
 * Every term has:
 *   id        stable key; the topic page is learn.html?term=<id>
 *   term      display name
 *   chapter   1-10, the curriculum chapter it belongs to (data/kyf-curriculum.js)
 *   tip       plain-language meaning (the "?" bubble and the Money Word card). Terms that get a "?"
 *             bubble keep it to 170 characters or fewer and free of numbers that go out of date.
 * Terms that get a "?" bubble in page text also have:
 *   exact     spellings matched exactly (acronyms such as "SIP")
 *   words     spellings matched ignoring case ("emergency fund")
 * Terms with a full lesson also have:
 *   pronunciation, partOfSpeech, rootFamily
 *   humanFriction    the everyday habit or blind spot the word explains
 *   plainMeaning     the meaning in one sentence
 *   contextTemplate  an example filled with the person's own numbers by renderContext()
 *   relatedWords     ids of related terms
 *   quickCheck       { question, options: [{ text, correct }], explanation }
 *
 * Educational wording; to be reviewed by a CFP before wide release.
 */
window.KYF_TERMS = {
  version: 2,
  topicPage: "learn.html", // the tip and the Money Word card link to learn.html?term=<id>
  terms: [
    {
      "id": "sip",
      "term": "SIP",
      "chapter": 6,
      "exact": [
        "SIP",
        "SIPs"
      ],
      "tip": "Systematic Investment Plan: a fixed amount invested into a fund on a set date each month."
    },
    {
      "id": "step_up",
      "term": "Step-up",
      "chapter": 6,
      "words": [
        "step-up",
        "step up SIP"
      ],
      "tip": "Raising your SIP by a set amount or percentage each year as your income grows."
    },
    {
      "id": "nav",
      "term": "NAV",
      "chapter": 7,
      "exact": [
        "NAV"
      ],
      "tip": "Net Asset Value: the price of one unit of a mutual fund today. A low NAV does not mean the fund is cheap."
    },
    {
      "id": "cagr",
      "term": "CAGR",
      "chapter": 7,
      "exact": [
        "CAGR"
      ],
      "tip": "Compound Annual Growth Rate: the steady yearly rate that would turn the starting amount into the ending amount. It smooths out the ups and downs."
    },
    {
      "id": "xirr",
      "term": "XIRR",
      "chapter": 7,
      "exact": [
        "XIRR"
      ],
      "tip": "Your true yearly return when money went in on different dates, such as monthly SIPs."
    },
    {
      "id": "expense_ratio",
      "term": "Expense ratio",
      "chapter": 7,
      "words": [
        "expense ratio"
      ],
      "tip": "The yearly fee a fund charges, as a percentage of your money. It is taken out of the NAV, so you never see a bill."
    },
    {
      "id": "direct_regular",
      "term": "Direct and Regular plans",
      "chapter": 7,
      "words": [
        "direct plan",
        "regular plan"
      ],
      "tip": "Same fund, same investments. A Regular plan pays the distributor a commission out of your returns; a Direct plan does not, so its NAV grows faster."
    },
    {
      "id": "folio",
      "term": "Folio",
      "chapter": 3,
      "words": [
        "folio"
      ],
      "tip": "The account number a fund company gives you to keep track of your units with that company."
    },
    {
      "id": "benchmark",
      "term": "Benchmark",
      "chapter": 7,
      "words": [
        "benchmark"
      ],
      "tip": "The index a fund or portfolio is measured against, such as the Nifty 50. Beating it is called outperforming."
    },
    {
      "id": "liquid_fund",
      "term": "Liquid fund",
      "chapter": 3,
      "words": [
        "liquid fund",
        "liquid funds"
      ],
      "tip": "A mutual fund that holds very short-term debt. Often used to park money you may need soon."
    },
    {
      "id": "inflation",
      "term": "Inflation",
      "chapter": 4,
      "words": [
        "inflation"
      ],
      "tip": "How fast prices rise. Each year of inflation makes the same amount of money buy a little less.",
      "pronunciation": "/ɪnˈfleɪ.ʃən/",
      "partOfSpeech": "noun",
      "rootFamily": "Time & Value",
      "humanFriction": "Planning for a child's college or your retirement using today's fee structure, forgetting that prices compound upward every single year.",
      "plainMeaning": "The steady, year-over-year percentage rise in the cost of goods and services—which acts as an invisible gravity pulling down the value of idle cash.",
      "contextTemplate": "At {inflation}% general Inflation (and 9%–11% education/medical inflation), a ₹{goalCost} milestone today swells to ₹{goalFutureCost} in just {goalYears} years.",
      "relatedWords": [
        "purchasing_power",
        "nominal_vs_real",
        "purchasing_power_erosion"
      ],
      "quickCheck": {
        "question": "Why is your personal inflation rate often higher than the headline government CPI number?",
        "options": [
          {
            "text": "Healthcare, school/college fees, and urban services inflate at 8%–12%, much faster than basic food grains.",
            "correct": true
          },
          {
            "text": "Headline CPI only measures gold prices.",
            "correct": false
          }
        ],
        "explanation": "Urban family goals like education and healthcare experience much steeper price compounding than general CPI."
      }
    },
    {
      "id": "cpi",
      "term": "CPI",
      "chapter": 4,
      "exact": [
        "CPI"
      ],
      "tip": "Consumer Price Index: the official measure of how much everyday prices have risen. KYF uses it to inflate costs like a car or a home."
    },
    {
      "id": "real_return",
      "term": "Real return",
      "chapter": 4,
      "words": [
        "real return"
      ],
      "tip": "Your return after taking out inflation. Growth of 7% with 5% inflation is only about 2% in real terms."
    },
    {
      "id": "corpus",
      "term": "Corpus",
      "chapter": 10,
      "words": [
        "corpus"
      ],
      "tip": "The lump sum you need to have built by a date so that it can fund a goal, such as retirement."
    },
    {
      "id": "annuity",
      "term": "Annuity",
      "chapter": 10,
      "words": [
        "annuity"
      ],
      "tip": "A series of equal payments over time, like a monthly pension. Retirement planning uses it to work out the corpus you need."
    },
    {
      "id": "emergency_fund",
      "term": "Emergency fund",
      "chapter": 2,
      "words": [
        "emergency fund",
        "peace buffer"
      ],
      "tip": "Money kept in safe, easy-to-reach places to cover living costs if your income stops, usually several months of expenses."
    },
    {
      "id": "term_insurance",
      "term": "Term insurance",
      "chapter": 6,
      "words": [
        "term insurance",
        "term cover",
        "term life"
      ],
      "tip": "Pure life cover: it pays your family a lump sum if you die within the term, and nothing if you outlive it. It has no savings element."
    },
    {
      "id": "emi",
      "term": "EMI",
      "chapter": 6,
      "exact": [
        "EMI",
        "EMIs"
      ],
      "tip": "Equated Monthly Instalment: the fixed monthly payment on a loan, part interest and part repayment of the amount borrowed."
    },
    {
      "id": "rebalancing",
      "term": "Rebalancing",
      "chapter": 8,
      "words": [
        "rebalancing",
        "rebalance"
      ],
      "tip": "Selling a little of what has grown and buying what has lagged, to bring your mix back to the plan.",
      "pronunciation": "/ˌriːˈbæl.ən.sɪŋ/",
      "partOfSpeech": "verb / noun",
      "rootFamily": "Goal Architecture",
      "humanFriction": "Buying high out of greed during bull markets and selling low out of fear during crashes—when a simple annual rule forces you to do the exact opposite.",
      "plainMeaning": "Resetting your portfolio back to its original target percentages (e.g., once a year)—which automatically forces you to book profits from expensive winners and buy beaten-down assets cheap.",
      "contextTemplate": "Annual Rebalancing turns 'Buy Low, Sell High' from an emotional guessing game into a calm, mechanical habit.",
      "relatedWords": [
        "portfolio_drift",
        "asset_allocation",
        "tax_harvesting"
      ],
      "quickCheck": {
        "question": "Your target is 60% Equity / 40% Debt. After a stock market crash, your mix is now 48% Equity / 52% Debt. What does Rebalancing tell you to do?",
        "options": [
          {
            "text": "Move 12% from Debt (or route new SIPs) into Equity while stocks are cheap to restore 60/40.",
            "correct": true
          },
          {
            "text": "Sell all remaining Equity in panic.",
            "correct": false
          }
        ],
        "explanation": "Rebalancing removes emotion—it systematically trims euphoria at market highs and buys bargains at market lows."
      }
    },
    {
      "id": "carpet_area",
      "term": "Carpet area",
      "chapter": 3,
      "words": [
        "carpet area",
        "carpet rate"
      ],
      "tip": "The usable floor area inside the walls of a flat. Builders often quote price on the larger super built-up area, which includes shared spaces."
    },
    {
      "id": "fd",
      "term": "Fixed deposit",
      "chapter": 3,
      "exact": [
        "FD",
        "FDs"
      ],
      "words": [
        "fixed deposit"
      ],
      "tip": "A bank deposit for a fixed time at a fixed rate. Safe, but the interest is taxable and may not keep up with inflation."
    },
    {
      "id": "ppf",
      "term": "PPF",
      "chapter": 3,
      "exact": [
        "PPF"
      ],
      "tip": "Public Provident Fund: a government-backed long-term savings scheme with a 15-year lock-in and tax-free interest."
    },
    {
      "id": "epf",
      "term": "EPF",
      "chapter": 3,
      "exact": [
        "EPF"
      ],
      "tip": "Employees' Provident Fund: retirement savings that you and your employer add to each month, earning a government-set rate."
    },
    {
      "id": "sgb",
      "term": "Sovereign Gold Bond",
      "chapter": 3,
      "exact": [
        "SGB",
        "SGBs"
      ],
      "tip": "A government bond priced in grams of gold. You earn the gold price movement plus a small yearly interest."
    },
    {
      "id": "purchasing_power",
      "term": "Purchasing Power",
      "chapter": 1,
      "tip": "The real quantity of goods, services, or freedom a unit of money can buy at a given point in time.",
      "pronunciation": "/ˈpɜː.tʃɪ.sɪŋ ˌpaʊ.ər/",
      "partOfSpeech": "noun",
      "rootFamily": "Value & Reality",
      "humanFriction": "Counting how many rupees you have in the bank instead of how much life those rupees can actually buy.",
      "plainMeaning": "The real quantity of goods, services, or freedom a unit of money can buy at a given point in time.",
      "contextTemplate": "Your ₹{goalCost} {goalName} goal today will require ₹{goalFutureCost} in {goalYears} years just to maintain the exact same Purchasing Power at {inflation}% inflation.",
      "relatedWords": [
        "inflation",
        "money_illusion",
        "nominal_vs_real"
      ],
      "quickCheck": {
        "question": "If your savings double in 10 years, but the price of groceries and housing also doubles in 10 years, how much did your Purchasing Power grow?",
        "options": [
          {
            "text": "0% — I can buy the exact same basket of goods.",
            "correct": true
          },
          {
            "text": "100% — Because I have twice as many rupees.",
            "correct": false
          }
        ],
        "explanation": "Twice the rupees chasing twice the price tag equals zero gain in actual buying power."
      }
    },
    {
      "id": "compounding",
      "term": "Compounding",
      "chapter": 1,
      "tip": "The snowball process where the returns your money earns begin earning their own returns in future years.",
      "pronunciation": "/kəmˈpaʊn.dɪŋ/",
      "partOfSpeech": "noun / verb",
      "rootFamily": "Growth Mechanics",
      "humanFriction": "Assuming wealth grows in a straight line by adding monthly savings, rather than realizing that time does the heavy lifting.",
      "plainMeaning": "The snowball process where the returns your money earns begin earning their own returns in future years.",
      "contextTemplate": "At {niftyCagr}% annual growth, ₹{principal} doesn't just add the same profit each year—Compounding makes the growth curve bend sharply upward after year 7.",
      "relatedWords": [
        "rule_of_72",
        "time_value_of_money",
        "negative_compounding"
      ],
      "quickCheck": {
        "question": "What is the single most powerful fuel in the Compounding formula?",
        "options": [
          {
            "text": "Uninterrupted time (number of doubling cycles).",
            "correct": true
          },
          {
            "text": "Jumping in and out of the market every few months.",
            "correct": false
          }
        ],
        "explanation": "In compounding, the biggest rupee jumps happen in the final third of the timeline."
      }
    },
    {
      "id": "effective_apr",
      "term": "Effective APR",
      "chapter": 1,
      "tip": "The true annual interest rate you pay on a loan once all upfront fees, lost discounts, and monthly reducing principal balances are factored in.",
      "pronunciation": "/ɪˈfɛk.tɪv eɪ.piː.ɑːr/",
      "partOfSpeech": "noun",
      "rootFamily": "Debt & Fine Print",
      "humanFriction": "Falling for 'Zero-Cost EMI' or 'Flat 7% Loan' pitches without counting forfeited cash discounts, processing fees, and shrinking loan balances.",
      "plainMeaning": "The true annual interest rate you pay on a loan once all upfront fees, lost discounts, and monthly reducing principal balances are factored in.",
      "contextTemplate": "Giving up a ₹3,000 upfront cash discount plus a ₹500 fee on a 6-month ₹60,000 EMI turns a 'No-Cost EMI' into an Effective APR of over 20% per year.",
      "relatedWords": [
        "teaser_pricing",
        "amortizing",
        "negative_compounding"
      ],
      "quickCheck": {
        "question": "Why is a '10% Flat Rate' loan almost twice as expensive as a '10% Reducing Balance' loan?",
        "options": [
          {
            "text": "Flat rate charges interest on the full original loan even when you've paid most of it back.",
            "correct": true
          },
          {
            "text": "Flat rate loans have longer tenures.",
            "correct": false
          }
        ],
        "explanation": "By month 11 of a 12-month loan, you only owe 1/12th of the money, yet a flat rate still charges interest on 100% of the initial loan."
      }
    },
    {
      "id": "volatility_drag",
      "term": "Volatility Drag",
      "chapter": 1,
      "tip": "The mathematical penalty caused by large ups and downs: a percentage loss requires a much larger percentage gain just to break even.",
      "pronunciation": "/ˌvɒl.əˈtɪl.ə.ti dræɡ/",
      "partOfSpeech": "noun",
      "rootFamily": "Risk & Math",
      "humanFriction": "Thinking that a -25% drop followed by a +25% recovery puts your money back where it started.",
      "plainMeaning": "The mathematical penalty caused by large ups and downs: a percentage loss requires a much larger percentage gain just to break even.",
      "contextTemplate": "If ₹{principal} drops by 50% to ₹50,000, a +50% rebound only brings you back to ₹75,000—you need a +100% gain to overcome Volatility Drag.",
      "relatedWords": [
        "drawdown",
        "cagr_vs_xirr",
        "asset_allocation"
      ],
      "quickCheck": {
        "question": "Your portfolio drops 20% in a market correction. What percentage gain do you need on the remaining money just to get back to your starting value?",
        "options": [
          {
            "text": "+25%",
            "correct": true
          },
          {
            "text": "+20%",
            "correct": false
          }
        ],
        "explanation": "₹100 minus 20% is ₹80. To turn ₹80 back into ₹100, you need ₹20—which is 25% of ₹80."
      }
    },
    {
      "id": "time_horizon",
      "term": "Time Horizon",
      "chapter": 1,
      "tip": "The exact length of time (in months or years) before you need to turn an investment back into spendable cash for a life goal.",
      "pronunciation": "/taɪm həˈraɪ.zən/",
      "partOfSpeech": "noun",
      "rootFamily": "Goal Architecture",
      "humanFriction": "Picking investments based on what performed well last year instead of when you actually need to write the cheque.",
      "plainMeaning": "The exact length of time (in months or years) before you need to turn an investment back into spendable cash for a life goal.",
      "contextTemplate": "Because your {goalName} goal is {goalYears} years away, its Time Horizon dictates how much bumpy equity vs. steady fixed income you can safely hold.",
      "relatedWords": [
        "horizon_matching",
        "asset_allocation"
      ],
      "quickCheck": {
        "question": "You need ₹8 Lakhs for a home down payment in 14 months. Which factor matters most for this short Time Horizon?",
        "options": [
          {
            "text": "Principal safety and certainty that ₹8 Lakhs will be there in Month 14.",
            "correct": true
          },
          {
            "text": "Chasing a 20% small-cap stock return.",
            "correct": false
          }
        ],
        "explanation": "Money needed under 3 years cannot afford the time required to recover from a stock market dip."
      }
    },
    {
      "id": "net_cash_flow",
      "term": "Net Cash Flow",
      "chapter": 2,
      "tip": "The actual rupee surplus left over each month after subtracting all living expenses and EMIs from your take-home income.",
      "pronunciation": "/nɛt kæʃ floʊ/",
      "partOfSpeech": "noun",
      "rootFamily": "Cash Flow & Habits",
      "humanFriction": "Confusing a high monthly salary with building wealth, when almost 100% of that salary exits by the 28th of the month.",
      "plainMeaning": "The actual rupee surplus left over each month after subtracting all living expenses and EMIs from your take-home income.",
      "contextTemplate": "A ₹2 Lakh salary with ₹1.95 Lakh spending has a weaker Net Cash Flow (₹5,000) than a ₹80,000 salary that consistently saves ₹25,000.",
      "relatedWords": [
        "pay_yourself_first",
        "lifestyle_creep",
        "opportunity_cost"
      ],
      "quickCheck": {
        "question": "Which number actually funds your future goals and investments?",
        "options": [
          {
            "text": "Your monthly Net Cash Flow (Income minus Outflow).",
            "correct": true
          },
          {
            "text": "Your gross CTC on your offer letter.",
            "correct": false
          }
        ],
        "explanation": "Wealth is built strictly from the gap between what you earn and what you spend."
      }
    },
    {
      "id": "opportunity_cost",
      "term": "Opportunity Cost",
      "chapter": 2,
      "tip": "The hidden sacrifice of the next-best future goal or compounding growth a rupee gives up when you spend or lock it elsewhere.",
      "pronunciation": "/ˌɒp.əˈtjuː.nə.ti kɒst/",
      "partOfSpeech": "noun",
      "rootFamily": "Cash Flow & Habits",
      "humanFriction": "Seeing a ₹1,00,000 impulse purchase as costing only ₹1,00,000, while ignoring the ₹4,00,000 it would have grown into over 12 years.",
      "plainMeaning": "The hidden sacrifice of the next-best future goal or compounding growth a rupee gives up when you spend or lock it elsewhere.",
      "contextTemplate": "Leaving idle money in a 3% savings account instead of a {fdRate}% liquid/FD instrument carries an immediate Opportunity Cost every single year.",
      "relatedWords": [
        "time_value_of_money",
        "sunk_cost",
        "compounding"
      ],
      "quickCheck": {
        "question": "If money doubles every 6 years at 12%, what is the true 12-year Opportunity Cost of spending ₹50,000 today on something you don't need?",
        "options": [
          {
            "text": "₹2,00,000 of future wealth.",
            "correct": true
          },
          {
            "text": "₹50,000.",
            "correct": false
          }
        ],
        "explanation": "₹50,000 doubles to ₹1,00,000 in year 6, and doubles again to ₹2,00,000 in year 12."
      }
    },
    {
      "id": "lifestyle_creep",
      "term": "Lifestyle Creep",
      "chapter": 2,
      "tip": "The silent habit of upgrading baseline luxuries into 'necessities' at the exact same speed as your salary increases.",
      "pronunciation": "/ˈlaɪf.staɪl kriːp/",
      "partOfSpeech": "noun",
      "rootFamily": "Cash Flow & Habits",
      "humanFriction": "Wondering why you still feel broke after three promotions and doubling your income over five years.",
      "plainMeaning": "The silent habit of upgrading baseline luxuries into 'necessities' at the exact same speed as your salary increases.",
      "contextTemplate": "Defeating Lifestyle Creep means routing at least 50% of every new salary increment automatically toward your ₹{goalFutureCost} {goalName} goal before upgrading fixed bills.",
      "relatedWords": [
        "net_cash_flow",
        "pay_yourself_first",
        "fi_corpus"
      ],
      "quickCheck": {
        "question": "Why does Lifestyle Creep hurt you twice when planning for Financial Independence?",
        "options": [
          {
            "text": "It reduces how much you save today AND permanently raises the corpus you need to maintain that lifestyle later.",
            "correct": true
          },
          {
            "text": "It increases your income tax bracket.",
            "correct": false
          }
        ],
        "explanation": "Higher monthly spending simultaneously shrinks your monthly investment fuel and inflates your target retirement number."
      }
    },
    {
      "id": "pay_yourself_first",
      "term": "Pay-Yourself-First",
      "chapter": 2,
      "tip": "Automating your goal SIPs and savings transfers on Day 1 or Day 2 of payday, and living freely on the remaining balance.",
      "pronunciation": "/peɪ jɔːˈsɛlf fɜːst/",
      "partOfSpeech": "verb phrase",
      "rootFamily": "Cash Flow & Habits",
      "humanFriction": "Trying to invest 'whatever is left over at the end of the month'—and discovering nothing is ever left on Day 30.",
      "plainMeaning": "Automating your goal SIPs and savings transfers on Day 1 or Day 2 of payday, and living freely on the remaining balance.",
      "contextTemplate": "Moving ₹{sipMonthly} on the 2nd of every month toward your {goalName} removes willpower from the equation—that is Pay-Yourself-First in action.",
      "relatedWords": [
        "rupee_cost_averaging",
        "net_cash_flow",
        "lifestyle_creep"
      ],
      "quickCheck": {
        "question": "What is the best date of the month to schedule an automated SIP if your salary credits on the last day of the month?",
        "options": [
          {
            "text": "Between the 1st and 5th of the month, right after payday.",
            "correct": true
          },
          {
            "text": "On the 28th of the month, after all shopping is done.",
            "correct": false
          }
        ],
        "explanation": "Automating investments right after salary credit treats your future self as your most important bill."
      }
    },
    {
      "id": "sunk_cost",
      "term": "Sunk Cost",
      "chapter": 2,
      "tip": "Money already spent in the past that cannot be recovered—and which should never trap your future rupees in a bad decision.",
      "pronunciation": "/sʌŋk kɒst/",
      "partOfSpeech": "noun",
      "rootFamily": "Cash Flow & Habits",
      "humanFriction": "Continuing to pour ₹50,000 a year into a terrible 4%-return insurance-cum-investment policy just because you already paid 3 years of premiums.",
      "plainMeaning": "Money already spent in the past that cannot be recovered—and which should never trap your future rupees in a bad decision.",
      "contextTemplate": "Past mistakes are a Sunk Cost; always ask where your next ₹{principal} will grow best over the next {goalYears} years, not where past money was lost.",
      "relatedWords": [
        "opportunity_cost",
        "endowment_trap",
        "liquidating"
      ],
      "quickCheck": {
        "question": "You paid 2 years into a 15-year policy that yields only 4.5% per year. Should the 2 years already paid force you to keep paying for 13 more years?",
        "options": [
          {
            "text": "No—compare the future 13 years of returns separately from the Sunk Cost.",
            "correct": true
          },
          {
            "text": "Yes—never stop anything once started, regardless of the math.",
            "correct": false
          }
        ],
        "explanation": "Rational financial planning only looks forward at future cash flows, never backward at unrecoverable sunk costs."
      }
    },
    {
      "id": "cash_equivalents",
      "term": "Cash & Equivalents",
      "chapter": 3,
      "tip": "Ultra-safe, instantly accessible money containers (Savings Accounts, Overnight/Liquid Funds, Sweep FDs) built for immediate certainty, not wealth creation.",
      "pronunciation": "/kæʃ ænd ɪˈkwɪv.ə.lənts/",
      "partOfSpeech": "noun",
      "rootFamily": "The 5 Asset Containers",
      "humanFriction": "Expecting your savings bank account or emergency liquid fund to make you rich, or conversely keeping zero cash for emergencies.",
      "plainMeaning": "Ultra-safe, instantly accessible money containers (Savings Accounts, Overnight/Liquid Funds, Sweep FDs) built for immediate certainty, not wealth creation.",
      "contextTemplate": "Cash & Equivalents protect your 6-month emergency runway and short-term bills, earning up to ~{fdRate}% before tax with zero market drama.",
      "relatedWords": [
        "fixed_income_debt",
        "purchasing_power_erosion"
      ],
      "quickCheck": {
        "question": "What is the primary job of Cash & Equivalents in your financial life?",
        "options": [
          {
            "text": "Instant availability and principal certainty for emergencies and near-term bills.",
            "correct": true
          },
          {
            "text": "Beating inflation over a 20-year horizon.",
            "correct": false
          }
        ],
        "explanation": "Cash is seatbelt insurance for life's bumps, not an engine for long-term wealth."
      }
    },
    {
      "id": "fixed_income_debt",
      "term": "Fixed Income (Debt)",
      "chapter": 3,
      "tip": "Assets where you lend money to a bank, government, or company (FDs, EPF, PPF, Bonds, Debt Funds) in exchange for predictable interest.",
      "pronunciation": "/fɪkst ˈɪŋ.kʌm/",
      "partOfSpeech": "noun",
      "rootFamily": "The 5 Asset Containers",
      "humanFriction": "Thinking 'Debt' only means loans you owe, when in investing 'Debt' means YOU are acting as the lender collecting steady interest.",
      "plainMeaning": "Assets where you lend money to a bank, government, or company (FDs, EPF, PPF, Bonds, Debt Funds) in exchange for predictable interest.",
      "contextTemplate": "Fixed Income containers like Bank FDs ({fdRate}%) or EPF (8.25%) act as the shock absorber of your portfolio for goals {goalYears} years away.",
      "relatedWords": [
        "cash_equivalents",
        "tax_drag",
        "asset_allocation"
      ],
      "quickCheck": {
        "question": "When you invest in a Fixed Deposit, PPF, or Government Bond, what is your legal role?",
        "options": [
          {
            "text": "You are a lender collecting contractual interest.",
            "correct": true
          },
          {
            "text": "You are a part-owner sharing in company profits.",
            "correct": false
          }
        ],
        "explanation": "Fixed income is a lending contract with capped upside and steady, predictable returns."
      }
    },
    {
      "id": "equities_stocks",
      "term": "Equities (Stocks)",
      "chapter": 3,
      "tip": "Partial ownership in productive companies (via Direct Stocks or Equity Mutual Funds) where your wealth grows as corporate revenues and profits compound.",
      "pronunciation": "/ˈɛk.wɪ.tiz/",
      "partOfSpeech": "noun",
      "rootFamily": "The 5 Asset Containers",
      "humanFriction": "Treating the stock market like a casino ticker instead of realizing that buying an index or stock means owning slices of real businesses.",
      "plainMeaning": "Partial ownership in productive companies (via Direct Stocks or Equity Mutual Funds) where your wealth grows as corporate revenues and profits compound.",
      "contextTemplate": "Over 10-year horizons, Indian Equities (Nifty 50 CAGR ~{niftyCagr}%) have historically outpaced {inflation}% inflation by a wide margin despite short-term bumps.",
      "relatedWords": [
        "compounding",
        "drawdown",
        "benchmark_alpha"
      ],
      "quickCheck": {
        "question": "Why do Equities historically beat inflation over 10+ year periods?",
        "options": [
          {
            "text": "Because businesses raise prices with inflation, innovate, and reinvest profits to grow earnings.",
            "correct": true
          },
          {
            "text": "Because the government guarantees a fixed 12% stock return.",
            "correct": false
          }
        ],
        "explanation": "When you own equities, human enterprise and corporate profit growth work for you."
      }
    },
    {
      "id": "commodities_gold",
      "term": "Commodities (Gold)",
      "chapter": 3,
      "tip": "Precious real assets (like 24K Gold ETFs, Sovereign Gold Bonds, or Bullion) that produce no earnings of their own but preserve value when paper currencies weaken.",
      "pronunciation": "/kəˈmɒd.ə.tiz/",
      "partOfSpeech": "noun",
      "rootFamily": "The 5 Asset Containers",
      "humanFriction": "Either putting 60% of family wealth into heavy locker jewellery (losing making charges) or ignoring gold's role as a currency & crisis hedge.",
      "plainMeaning": "Precious real assets (like 24K Gold ETFs, Sovereign Gold Bonds, or Bullion) that produce no earnings of their own but preserve value when paper currencies weaken.",
      "contextTemplate": "With 24K Gold at ₹{gold24k}/gram today, holding a 5%–10% Gold slice acts as crisis insurance that often shines when stocks stumble.",
      "relatedWords": [
        "correlation",
        "purchasing_power",
        "asset_allocation"
      ],
      "quickCheck": {
        "question": "For pure investment toward a future financial goal, why do Gold ETFs/Bonds beat physical jewellery?",
        "options": [
          {
            "text": "Zero 10%–18% making-charge loss, pure 24K pricing, and instant digital liquidity.",
            "correct": true
          },
          {
            "text": "Physical jewellery pays a monthly interest dividend.",
            "correct": false
          }
        ],
        "explanation": "Jewellery is great for adornment, but making charges and purity spreads eat a huge chunk of investment returns."
      }
    },
    {
      "id": "real_estate_hard_assets",
      "term": "Real Estate (Hard Assets)",
      "chapter": 3,
      "tip": "Physical land, residential flats, or commercial property—tangible and inflation-linked, but high-ticket, heavily taxed on transaction, and slow to convert to cash.",
      "pronunciation": "/ˈrɪəl ɪˌsteɪt/",
      "partOfSpeech": "noun",
      "rootFamily": "The 5 Asset Containers",
      "humanFriction": "Believing property is the only 'real' wealth while ignoring that you cannot sell one bedroom of a flat in 48 hours to pay a hospital or college bill.",
      "plainMeaning": "Physical land, residential flats, or commercial property—tangible and inflation-linked, but high-ticket, heavily taxed on transaction, and slow to convert to cash.",
      "contextTemplate": "Real Estate builds long-term anchor wealth, but typical Indian residential rental yields (~2.5%–3.5%) are far lower than home loan interest rates (~8.65%).",
      "relatedWords": [
        "liquidating",
        "amortizing",
        "fixed_income_debt"
      ],
      "quickCheck": {
        "question": "What is the biggest practical limitation of Real Estate when funding medium-term life milestones?",
        "options": [
          {
            "text": "High illiquidity and inability to sell in small, partial chunks quickly.",
            "correct": true
          },
          {
            "text": "Property prices never change.",
            "correct": false
          }
        ],
        "explanation": "Unlike mutual fund units where you can redeem ₹50,000 in 2 days, property is an all-or-nothing transaction."
      }
    },
    {
      "id": "nominal_vs_real",
      "term": "Nominal vs. Real Value",
      "chapter": 4,
      "tip": "Nominal is the raw rupee sticker number printed on screen; Real is the truth left over after stripping away inflation.",
      "pronunciation": "/ˈnɒm.ɪ.nəl vɜː.səs rɪəl/",
      "partOfSpeech": "adjective pair",
      "rootFamily": "Time & Value",
      "humanFriction": "Getting excited by a '₹1 Crore' projection 25 years from now without asking what ₹1 Crore will actually buy in 2051.",
      "plainMeaning": "Nominal is the raw rupee sticker number printed on screen; Real is the truth left over after stripping away inflation.",
      "contextTemplate": "A Nominal FD return of {fdRate}% minus {inflation}% inflation leaves a Real pre-tax return of barely ~1.4%.",
      "relatedWords": [
        "money_illusion",
        "inflation",
        "tax_drag"
      ],
      "quickCheck": {
        "question": "An investment grows at 11% Nominal return during a period of 6% inflation. What is your approximate Real return?",
        "options": [
          {
            "text": "~5% per year.",
            "correct": true
          },
          {
            "text": "17% per year.",
            "correct": false
          }
        ],
        "explanation": "Real Return ≈ Nominal Return minus Inflation Rate."
      }
    },
    {
      "id": "time_value_of_money",
      "term": "Time Value of Money",
      "chapter": 4,
      "tip": "The foundational law of finance: a rupee today is worth significantly more than a rupee tomorrow because today's rupee can be invested to earn returns immediately.",
      "pronunciation": "/taɪm ˈvæl.juː ɒv ˈmʌn.i/",
      "partOfSpeech": "noun",
      "rootFamily": "Time & Value",
      "humanFriction": "Treating a promise of ₹1,00,000 paid to you 10 years from now as equal to ₹1,00,000 in your hand today.",
      "plainMeaning": "The foundational law of finance: a rupee today is worth significantly more than a rupee tomorrow because today's rupee can be invested to earn returns immediately.",
      "contextTemplate": "Because of the Time Value of Money, starting your {goalName} SIP 3 years earlier reduces the monthly rupee effort required by nearly a third.",
      "relatedWords": [
        "compounding",
        "opportunity_cost",
        "endowment_trap"
      ],
      "quickCheck": {
        "question": "If someone offers you ₹1,00,000 today OR ₹1,00,000 guaranteed in 3 years, why is taking it today mathematically superior?",
        "options": [
          {
            "text": "Today's ₹1,00,000 can earn 3 years of risk-free interest to become ~₹1,22,000.",
            "correct": true
          },
          {
            "text": "Because currency notes expire after 3 years.",
            "correct": false
          }
        ],
        "explanation": "Present money has immediate earning capacity; future money has waited on the sidelines."
      }
    },
    {
      "id": "rule_of_72",
      "term": "Rule of 72",
      "chapter": 4,
      "tip": "A 3-second mental math shortcut: divide 72 by the annual percentage rate to find how many years it takes for money (or prices) to double.",
      "pronunciation": "/ruːl ɒv ˈsɛv.ən.ti tuː/",
      "partOfSpeech": "noun",
      "rootFamily": "Time & Value",
      "humanFriction": "Needing a spreadsheet just to figure out how fast an investment will double—or how fast inflation will cut your money in half.",
      "plainMeaning": "A 3-second mental math shortcut: divide 72 by the annual percentage rate to find how many years it takes for money (or prices) to double.",
      "contextTemplate": "Using the Rule of 72: at 12% equity growth, your money doubles every 6 years (72 ÷ 12); at 6% inflation, prices double every 12 years (72 ÷ 6).",
      "relatedWords": [
        "compounding",
        "inflation",
        "cagr_vs_xirr"
      ],
      "quickCheck": {
        "question": "Using the Rule of 72, if a bank deposit pays 8% per year, roughly how many years will it take for ₹5 Lakhs to double to ₹10 Lakhs?",
        "options": [
          {
            "text": "9 years (72 ÷ 8).",
            "correct": true
          },
          {
            "text": "12.5 years.",
            "correct": false
          }
        ],
        "explanation": "72 divided by 8 equals 9 years."
      }
    },
    {
      "id": "purchasing_power_erosion",
      "term": "Purchasing Power Erosion",
      "chapter": 4,
      "tip": "The guaranteed loss of real wealth when your post-tax return is lower than the rate of inflation.",
      "pronunciation": "/ɪˈroʊ.ʒən/",
      "partOfSpeech": "noun",
      "rootFamily": "Time & Value",
      "humanFriction": "Thinking 'I never lose money in my savings account' while inflation quietly eats 5%–6% of its real value every year.",
      "plainMeaning": "The guaranteed loss of real wealth when your post-tax return is lower than the rate of inflation.",
      "contextTemplate": "Keeping long-term wealth in a {fdRate}% deposit (which nets ~{postTaxFdRate}% after tax) while medical costs rise at 11.5% guarantees severe Purchasing Power Erosion.",
      "relatedWords": [
        "money_illusion",
        "tax_drag",
        "nominal_vs_real"
      ],
      "quickCheck": {
        "question": "Can an asset with zero market volatility (like cash in a locker) still be risky over 15 years?",
        "options": [
          {
            "text": "Yes—it suffers 100% certainty of Purchasing Power Erosion from inflation.",
            "correct": true
          },
          {
            "text": "No—if the rupee count doesn't drop, there is zero risk.",
            "correct": false
          }
        ],
        "explanation": "Avoiding short-term volatility by hoarding cash guarantees long-term loss of buying power."
      }
    },
    {
      "id": "money_illusion",
      "term": "Money Illusion",
      "chapter": 5,
      "tip": "The cognitive bias of judging wealth by the face value of rupees rather than what those rupees can buy after inflation and taxes.",
      "pronunciation": "/ˈmʌn.i ɪˈluː.ʒən/",
      "partOfSpeech": "noun",
      "rootFamily": "Traps & Illusions",
      "humanFriction": "Feeling proud that your ₹10 Lakh FD paid ₹68,000 interest this year, without noticing that tax took ₹14,000 and inflation ate ₹54,000.",
      "plainMeaning": "The cognitive bias of judging wealth by the face value of rupees rather than what those rupees can buy after inflation and taxes.",
      "contextTemplate": "Once you subtract tax and {inflation}% inflation from a {fdRate}% FD, Money Illusion disappears and reveals near-zero real growth.",
      "relatedWords": [
        "nominal_vs_real",
        "purchasing_power_erosion",
        "tax_drag"
      ],
      "quickCheck": {
        "question": "Which investor has conquered Money Illusion?",
        "options": [
          {
            "text": "The one who measures every portfolio by its Post-Tax Real Return above inflation.",
            "correct": true
          },
          {
            "text": "The one who only looks at the gross interest rate advertised on a billboard.",
            "correct": false
          }
        ],
        "explanation": "You can only spend post-tax, post-inflation rupees."
      }
    },
    {
      "id": "apr_annual_percentage_rate",
      "term": "APR (Annual Percentage Rate)",
      "chapter": 5,
      "tip": "The standardized yearly cost of borrowing money, including monthly interest rates, processing fees, and compounding charges.",
      "pronunciation": "/eɪ.piː.ɑːr/",
      "partOfSpeech": "noun",
      "rootFamily": "Traps & Illusions",
      "humanFriction": "Seeing 'Only 3.25% interest per month!' on a credit card statement and not realizing that equals ~39% to 45% per year.",
      "plainMeaning": "The standardized yearly cost of borrowing money, including monthly interest rates, processing fees, and compounding charges.",
      "contextTemplate": "Never invest for {niftyCagr}% while carrying credit card debt at a 39% APR—paying off a 39% loan is a guaranteed 39% tax-free return!",
      "relatedWords": [
        "effective_apr",
        "negative_compounding",
        "teaser_pricing"
      ],
      "quickCheck": {
        "question": "If you have ₹50,000 in cash and also owe ₹50,000 on a credit card charging 36% APR, what is the smartest move?",
        "options": [
          {
            "text": "Pay off the 36% APR card immediately before starting any investment.",
            "correct": true
          },
          {
            "text": "Invest the ₹50,000 in an 8% FD and keep rolling over the card bill.",
            "correct": false
          }
        ],
        "explanation": "No legal investment on earth can reliably outrun a 36%–42% credit card APR."
      }
    },
    {
      "id": "negative_compounding",
      "term": "Negative Compounding",
      "chapter": 5,
      "tip": "When compounding works in reverse against the borrower: unpaid interest is added to your loan balance and begins generating its own interest.",
      "pronunciation": "/ˈnɛɡ.ə.tɪv kəmˈpaʊn.dɪŋ/",
      "partOfSpeech": "noun",
      "rootFamily": "Traps & Illusions",
      "humanFriction": "Paying only the '5% Minimum Amount Due' on a credit card, unaware that interest is now being charged on last month's unpaid interest—plus 18% GST on that interest.",
      "plainMeaning": "When compounding works in reverse against the borrower: unpaid interest is added to your loan balance and begins generating its own interest.",
      "contextTemplate": "Paying only the 'Minimum Due' triggers Negative Compounding and forfeits your interest-free grace period on every new swipe.",
      "relatedWords": [
        "apr_annual_percentage_rate",
        "compounding",
        "amortizing"
      ],
      "quickCheck": {
        "question": "What happens the moment you pay only the 'Minimum Amount Due' instead of the 'Total Amount Due' on a credit card?",
        "options": [
          {
            "text": "You lose the interest-free period on all new purchases and pay ~36%–42% APR from day one.",
            "correct": true
          },
          {
            "text": "The bank waives interest for being a loyal customer.",
            "correct": false
          }
        ],
        "explanation": "Minimum Due only prevents a late-fee default mark; it triggers full revolving interest immediately."
      }
    },
    {
      "id": "endowment_trap",
      "term": "Endowment / Bundled Trap",
      "chapter": 5,
      "tip": "Financial products that mix life insurance with investment—giving you neither enough life cover for your family nor enough return to beat inflation.",
      "pronunciation": "/ɪnˈdaʊ.mənt træp/",
      "partOfSpeech": "noun",
      "rootFamily": "Traps & Illusions",
      "humanFriction": "Buying an 'Insurance + Tax-Saving + Guaranteed Return' policy that charges ₹1 Lakh/year for a tiny ₹10 Lakh life cover and delivers a 4.8% XIRR over 20 years.",
      "plainMeaning": "Financial products that mix life insurance with investment—giving you neither enough life cover for your family nor enough return to beat inflation.",
      "contextTemplate": "Instead of an Endowment Trap, separating protection (a pure Term Plan) from growth (Mutual Funds / PPF) frees up cash flow for your {goalName}.",
      "relatedWords": [
        "hedging_risk_transfer",
        "cagr_vs_xirr",
        "sunk_cost"
      ],
      "quickCheck": {
        "question": "What is the golden rule of insurance and investing?",
        "options": [
          {
            "text": "Never mix insurance and investment—buy pure Term/Health cover for risk, and pure investments for growth.",
            "correct": true
          },
          {
            "text": "Always buy policies that promise 'money-back' bonuses.",
            "correct": false
          }
        ],
        "explanation": "Unbundling term insurance + index/PPF investing gives 10x the life cover and more than double the long-term corpus."
      }
    },
    {
      "id": "teaser_pricing",
      "term": "Teaser / Anchor Pricing",
      "chapter": 5,
      "tip": "Framing a loan, subscription, or financial product around a tiny daily/monthly number or temporary introductory rate to hide the total lifetime cost.",
      "pronunciation": "/ˈtiː.zər ˈpraɪ.sɪŋ/",
      "partOfSpeech": "noun",
      "rootFamily": "Traps & Illusions",
      "humanFriction": "Focusing on 'Only ₹2,999/month!' instead of checking the total amount paid over 48 months compared to the cash price.",
      "plainMeaning": "Framing a loan, subscription, or financial product around a tiny daily/monthly number or temporary introductory rate to hide the total lifetime cost.",
      "contextTemplate": "Whenever you see Teaser Pricing on an EMI or loan, multiply the monthly instalment by the number of months and compare it to the upfront cash price.",
      "relatedWords": [
        "effective_apr",
        "opportunity_cost",
        "sunk_cost"
      ],
      "quickCheck": {
        "question": "How do you instantly X-ray any EMI or 'Pay Later' offer?",
        "options": [
          {
            "text": "Compare (Monthly EMI × Months + Processing Fees + GST) against the discounted upfront cash price.",
            "correct": true
          },
          {
            "text": "Check only if the monthly EMI fits into this month's salary.",
            "correct": false
          }
        ],
        "explanation": "Looking at total cash outflow vs. upfront discounted price strips away all marketing framing."
      }
    },
    {
      "id": "amortizing",
      "term": "Amortizing",
      "chapter": 6,
      "tip": "The schedule by which a fixed loan EMI is split each month: heavily front-loaded with bank interest in the early years, and mostly principal only in the final years.",
      "pronunciation": "/əˈmɔː.taɪ.zɪŋ/",
      "partOfSpeech": "verb",
      "rootFamily": "Action Mechanics",
      "humanFriction": "Paying a ₹50,000 Home Loan EMI for 5 years (₹30 Lakhs paid!) and being shocked that your loan principal barely shrank by ₹6 Lakhs.",
      "plainMeaning": "The schedule by which a fixed loan EMI is split each month: heavily front-loaded with bank interest in the early years, and mostly principal only in the final years.",
      "contextTemplate": "In a 20-year Amortizing home loan at 8.65%, nearly 75%–80% of your early EMIs go strictly toward interest—which is why early prepayments save massive interest.",
      "relatedWords": [
        "effective_apr",
        "compounding",
        "real_estate_hard_assets"
      ],
      "quickCheck": {
        "question": "When does prepaying ₹1 Lakh toward a 20-year home loan save you the maximum interest?",
        "options": [
          {
            "text": "In Years 1 to 5 of the loan, when the outstanding principal is highest.",
            "correct": true
          },
          {
            "text": "In Year 19 of the loan, when the loan is almost over.",
            "correct": false
          }
        ],
        "explanation": "Every ₹1 of principal killed in Year 2 saves you 18 years of compounding interest on that rupee."
      }
    },
    {
      "id": "liquidating",
      "term": "Liquidating",
      "chapter": 6,
      "tip": "The act of converting an asset back into spendable rupees in your bank account—measured by both speed (settlement days) and friction (exit penalty/tax).",
      "pronunciation": "/ˈlɪk.wɪ.deɪ.tɪŋ/",
      "partOfSpeech": "verb",
      "rootFamily": "Action Mechanics",
      "humanFriction": "Assuming 'Net Worth on Paper' equals 'Spendable Cash,' until you try to sell an asset during an emergency and face lock-ins, exit loads, or 6-month buyer delays.",
      "plainMeaning": "The act of converting an asset back into spendable rupees in your bank account—measured by both speed (settlement days) and friction (exit penalty/tax).",
      "contextTemplate": "Liquidating an Overnight/Liquid Fund takes T+1 working day with zero penalty; liquidating property can take 6+ months.",
      "relatedWords": [
        "cash_equivalents",
        "real_estate_hard_assets",
        "time_horizon"
      ],
      "quickCheck": {
        "question": "What makes an asset 'Highly Liquid'?",
        "options": [
          {
            "text": "It can be converted to cash within 1–2 days at its fair market value without heavy penalties.",
            "correct": true
          },
          {
            "text": "You can sell it quickly only if you offer a 30% distress discount.",
            "correct": false
          }
        ],
        "explanation": "True liquidity requires both speed AND zero forced price discount."
      }
    },
    {
      "id": "rupee_cost_averaging",
      "term": "Rupee-Cost Averaging (SIP)",
      "chapter": 6,
      "tip": "Investing a fixed rupee amount at regular intervals so that your money automatically buys fewer units when prices are high and more units when prices drop.",
      "pronunciation": "/ruːˈpiː kɒst ˈæv.ər.ɪ.dʒɪŋ/",
      "partOfSpeech": "noun / verb",
      "rootFamily": "Action Mechanics",
      "humanFriction": "Panicking and pausing your monthly SIP when the stock market falls 15%—which is the exact moment your SIP is buying the most units on sale!",
      "plainMeaning": "Investing a fixed rupee amount at regular intervals so that your money automatically buys fewer units when prices are high and more units when prices drop.",
      "contextTemplate": "A ₹{sipMonthly}/month SIP toward your {goalName} uses Rupee-Cost Averaging to turn market corrections into automatic bargain-hunting.",
      "relatedWords": [
        "pay_yourself_first",
        "cagr_vs_xirr",
        "drawdown"
      ],
      "quickCheck": {
        "question": "If your monthly SIP is ₹10,000 and the fund's NAV drops from ₹100 to ₹80 during a market dip, what happens?",
        "options": [
          {
            "text": "Your ₹10,000 automatically buys 125 units instead of 100 units, lowering your average cost.",
            "correct": true
          },
          {
            "text": "You get fewer units because the market is down.",
            "correct": false
          }
        ],
        "explanation": "Fixed rupee SIPs buy 25% more units during a 20% market dip, supercharging your recovery when the market rebounds."
      }
    },
    {
      "id": "hedging_risk_transfer",
      "term": "Hedging / Risk Transfer",
      "chapter": 6,
      "tip": "Paying a small, known annual cost (an insurance premium) to transfer a catastrophic, unpredictable financial risk (hospital bill or loss of breadwinner) onto an insurer.",
      "pronunciation": "/ˈhɛdʒ.ɪŋ/",
      "partOfSpeech": "verb",
      "rootFamily": "Action Mechanics",
      "humanFriction": "Feeling like your Health or Term Insurance premium was 'wasted' because nobody was hospitalized this year.",
      "plainMeaning": "Paying a small, known annual cost (an insurance premium) to transfer a catastrophic, unpredictable financial risk (hospital bill or loss of breadwinner) onto an insurer.",
      "contextTemplate": "Without Hedging medical risk via Health Insurance, a single ₹10 Lakh surgery can force you to liquidate your {goalName} fund overnight.",
      "relatedWords": [
        "endowment_trap",
        "commodities_gold",
        "correlation"
      ],
      "quickCheck": {
        "question": "Why should you never expect an 'investment return' from your Health or Term Life insurance?",
        "options": [
          {
            "text": "Because insurance is a risk-transfer shield to protect your savings from catastrophe, not a wealth engine.",
            "correct": true
          },
          {
            "text": "Because insurance companies are not allowed to pay claims.",
            "correct": false
          }
        ],
        "explanation": "Just like a car seatbelt doesn't make your car drive faster, pure insurance exists solely to prevent financial ruin."
      }
    },
    {
      "id": "compounding_velocity",
      "term": "Step-Up Compounding",
      "chapter": 6,
      "tip": "Increasing your monthly investment contribution by 5%–10% each year in line with your income growth, cutting years off your goal timeline.",
      "pronunciation": "/stɛp ʌp kəmˈpaʊn.dɪŋ/",
      "partOfSpeech": "noun",
      "rootFamily": "Action Mechanics",
      "humanFriction": "Keeping your monthly SIP frozen at ₹5,000 for 10 straight years even though your salary grew 10% every year.",
      "plainMeaning": "Increasing your monthly investment contribution by 5%–10% each year in line with your income growth, cutting years off your goal timeline.",
      "contextTemplate": "Adding a 10% annual Step-Up to a ₹{sipMonthly} SIP nearly doubles your final corpus compared to a flat SIP over 15 years.",
      "relatedWords": [
        "compounding",
        "lifestyle_creep",
        "pay_yourself_first"
      ],
      "quickCheck": {
        "question": "What is the easiest way to reach a 15-year financial goal 4 years early without feeling pinched today?",
        "options": [
          {
            "text": "Enable an automatic 10% annual Step-Up on your SIP every April after your appraisal.",
            "correct": true
          },
          {
            "text": "Take extreme risk in penny stocks.",
            "correct": false
          }
        ],
        "explanation": "Stepping up your SIP with your salary hikes channels Lifestyle Creep directly into wealth creation."
      }
    },
    {
      "id": "cagr_vs_xirr",
      "term": "CAGR vs. XIRR",
      "chapter": 7,
      "tip": "CAGR measures the annualized speed of a single lump-sum investment; XIRR measures the true annualized speed across multiple cash flows (like monthly SIPs or withdrawals) on different dates.",
      "pronunciation": "/ˈkæɡ.ər vɜː.səs ɛks.aɪ.ɑːr.ɑːr/",
      "partOfSpeech": "noun pair",
      "rootFamily": "Product Signals",
      "humanFriction": "Trying to calculate the return on a 3-year monthly SIP using a simple point-to-point percentage, forgetting that your last SIP instalment was invested for only 1 month!",
      "plainMeaning": "CAGR measures the annualized speed of a single lump-sum investment; XIRR measures the true annualized speed across multiple cash flows (like monthly SIPs or withdrawals) on different dates.",
      "contextTemplate": "Use CAGR when comparing a single ₹{principal} lump sum; always check XIRR to measure your monthly ₹{sipMonthly} SIP toward your {goalName}.",
      "relatedWords": [
        "rolling_returns",
        "rupee_cost_averaging",
        "compounding"
      ],
      "quickCheck": {
        "question": "You invested ₹10,000 every month for 4 years and made two partial withdrawals. Which metric calculates your true annualized return?",
        "options": [
          {
            "text": "XIRR (Extended Internal Rate of Return).",
            "correct": true
          },
          {
            "text": "Simple absolute percentage gain divided by 4.",
            "correct": false
          }
        ],
        "explanation": "XIRR weights every single cash inflow and outflow by the exact number of days that specific rupee stayed invested."
      }
    },
    {
      "id": "rolling_returns",
      "term": "Rolling Returns",
      "chapter": 7,
      "tip": "Measuring a fund's 5-year (or 3-year) return across EVERY possible start date in history (Jan 1, Jan 2, Jan 3...), revealing how consistent it truly is.",
      "pronunciation": "/ˈroʊ.lɪŋ rɪˈtɜːnz/",
      "partOfSpeech": "noun",
      "rootFamily": "Product Signals",
      "humanFriction": "Being seduced by an ad showing '28% 5-Year Return!'—which only happened because the start date was cherry-picked at the exact bottom of the 2020 crash.",
      "plainMeaning": "Measuring a fund's 5-year (or 3-year) return across EVERY possible start date in history (Jan 1, Jan 2, Jan 3...), revealing how consistent it truly is.",
      "contextTemplate": "Instead of one lucky point-to-point return, Rolling Returns show the probability of achieving ~{niftyCagr}% over any random {goalYears}-year window.",
      "relatedWords": [
        "cagr_vs_xirr",
        "benchmark_alpha",
        "drawdown"
      ],
      "quickCheck": {
        "question": "Why do professional planners trust Rolling Returns far more than Trailing Point-to-Point Returns?",
        "options": [
          {
            "text": "Rolling returns eliminate start-date and end-date luck, showing average consistency across hundreds of periods.",
            "correct": true
          },
          {
            "text": "Rolling returns always look higher in advertisements.",
            "correct": false
          }
        ],
        "explanation": "Point-to-point returns are a single photograph; Rolling Returns are the entire movie."
      }
    },
    {
      "id": "expense_ratio_drag",
      "term": "Expense Ratio (Direct vs. Regular)",
      "chapter": 7,
      "tip": "The annual percentage fee deducted daily from a mutual fund's NAV to cover management—and in 'Regular Plans,' ongoing distributor commissions every year.",
      "pronunciation": "/ɪkˈspɛns ˈreɪ.ʃi.oʊ/",
      "partOfSpeech": "noun",
      "rootFamily": "Product Signals",
      "humanFriction": "Ignoring a 'tiny 1% commission difference' between a Regular Plan and a Direct Plan mutual fund, not realizing 1% per year eats 18%–25% of your final 20-year wealth!",
      "plainMeaning": "The annual percentage fee deducted daily from a mutual fund's NAV to cover management—and in 'Regular Plans,' ongoing distributor commissions every year.",
      "contextTemplate": "In our AMFI database, every fund's Direct Plan NAV is higher than its Regular Plan NAV because Direct Plans strip out middleman Expense Ratio Drag.",
      "relatedWords": [
        "benchmark_alpha",
        "compounding",
        "tax_drag"
      ],
      "quickCheck": {
        "question": "What is the only difference between 'Fund X - Regular Plan Growth' and 'Fund X - Direct Plan Growth'?",
        "options": [
          {
            "text": "Same portfolio and same fund manager—Direct Plan simply removes the annual distributor commission, leaving you a higher NAV.",
            "correct": true
          },
          {
            "text": "Direct Plan buys different stocks.",
            "correct": false
          }
        ],
        "explanation": "Direct and Regular plans hold the exact same underlying portfolio; Direct simply lets you keep the 0.5%–1.2% annual commission compounding for yourself."
      }
    },
    {
      "id": "benchmark_alpha",
      "term": "Benchmark & Alpha",
      "chapter": 7,
      "tip": "A Benchmark (like Nifty 50 or Nifty Midcap 150) is the market yardstick; Alpha is the extra return a fund delivers ABOVE that benchmark after fees.",
      "pronunciation": "/ˈbɛntʃ.mɑːrk ænd ˈæl.fə/",
      "partOfSpeech": "noun pair",
      "rootFamily": "Product Signals",
      "humanFriction": "Praising an active fund manager for making 15% in a year when the basic Nifty 50 Index went up 18% on autopilot.",
      "plainMeaning": "A Benchmark (like Nifty 50 or Nifty Midcap 150) is the market yardstick; Alpha is the extra return a fund delivers ABOVE that benchmark after fees.",
      "contextTemplate": "If an active large-cap fund charges 1.5% fees but fails to generate positive Alpha over Nifty 50 (~{niftyCagr}%), a low-cost Nifty 50 Index Fund wins.",
      "relatedWords": [
        "expense_ratio_drag",
        "rolling_returns",
        "equities_stocks"
      ],
      "quickCheck": {
        "question": "Your mutual fund returned +14% this year, while its Benchmark Index returned +16%. What was the fund's Alpha?",
        "options": [
          {
            "text": "-2% (It underperformed a simple index fund).",
            "correct": true
          },
          {
            "text": "+14%.",
            "correct": false
          }
        ],
        "explanation": "Alpha is measured strictly relative to the benchmark index you could have owned effortlessly."
      }
    },
    {
      "id": "drawdown",
      "term": "Maximum Drawdown",
      "chapter": 7,
      "tip": "The steepest peak-to-trough percentage drop an investment experienced during a market downturn before climbing back to a new high.",
      "pronunciation": "/ˈdrɔː.daʊn/",
      "partOfSpeech": "noun",
      "rootFamily": "Product Signals",
      "humanFriction": "Picking a Smallcap fund for its 24% 5-year CAGR without asking: 'Did it drop 45% in the middle, and would I have panicked and sold at the bottom?'",
      "plainMeaning": "The steepest peak-to-trough percentage drop an investment experienced during a market downturn before climbing back to a new high.",
      "contextTemplate": "Before choosing an asset for your {goalName}, check its historical Maximum Drawdown to ensure your stomach and timeline can handle the dip.",
      "relatedWords": [
        "volatility_drag",
        "sequence_of_returns_risk",
        "asset_allocation"
      ],
      "quickCheck": {
        "question": "An index peaks at 25,000, falls to 17,500 during a crisis, and later recovers to 28,000. What was its Maximum Drawdown?",
        "options": [
          {
            "text": "-30% (the drop from 25,000 down to 17,500).",
            "correct": true
          },
          {
            "text": "+12%.",
            "correct": false
          }
        ],
        "explanation": "Drawdown measures the deepest temporary valley from a previous peak—the ultimate test of an investor's nerves."
      }
    },
    {
      "id": "asset_allocation",
      "term": "Asset Allocation",
      "chapter": 8,
      "tip": "The deliberate recipe of dividing your money across growth engines (Equity), stability anchors (Fixed Income/Debt), and crisis shields (Gold).",
      "pronunciation": "/ˈæs.ɛt ˌæl.əˈkeɪ.ʃən/",
      "partOfSpeech": "noun",
      "rootFamily": "Goal Architecture",
      "humanFriction": "Spending 99% of your energy hunting for the '#1 best mutual fund' when 90% of your portfolio's behaviour comes from your split between Equity, Debt, and Gold.",
      "plainMeaning": "The deliberate recipe of dividing your money across growth engines (Equity), stability anchors (Fixed Income/Debt), and crisis shields (Gold).",
      "contextTemplate": "For your {goalYears}-year {goalName} goal, your Asset Allocation mix between Equity, Debt, and Gold matters far more than picking individual stocks.",
      "relatedWords": [
        "horizon_matching",
        "correlation",
        "rebalancing"
      ],
      "quickCheck": {
        "question": "What is the main purpose of Asset Allocation?",
        "options": [
          {
            "text": "To balance growth speed and downside safety so your portfolio matches your goal's timeline.",
            "correct": true
          },
          {
            "text": "To own 40 different mutual funds of the same category.",
            "correct": false
          }
        ],
        "explanation": "Owning 10 equity funds is not asset allocation—mixing distinct asset classes (Equity + Debt + Gold) is."
      }
    },
    {
      "id": "horizon_matching",
      "term": "Horizon Matching (Glidepath)",
      "chapter": 8,
      "tip": "Aligning risky assets only with long timelines, and systematically shifting money from Equity into safe Debt/Liquid buckets 2–3 years before a goal arrives.",
      "pronunciation": "/həˈraɪ.zən ˈmætʃ.ɪŋ/",
      "partOfSpeech": "noun",
      "rootFamily": "Goal Architecture",
      "humanFriction": "Leaving 100% of your child's college corpus inside equities right up until the month college starts—risking a 25% market crash the week fees are due.",
      "plainMeaning": "Aligning risky assets only with long timelines, and systematically shifting money from Equity into safe Debt/Liquid buckets 2–3 years before a goal arrives.",
      "contextTemplate": "Even if you use Equities to build your {goalName} fund, Horizon Matching means shifting that money into safe Debt 18–24 months before year {goalYears}.",
      "relatedWords": [
        "time_horizon",
        "asset_allocation",
        "sequence_of_returns_risk"
      ],
      "quickCheck": {
        "question": "Your 10-year goal is now only 18 months away, and you have already reached 95% of your target corpus. What should you do?",
        "options": [
          {
            "text": "Lock in the victory: gradually shift the corpus from Equity to a safe Liquid/Arbitrage/FD bucket.",
            "correct": true
          },
          {
            "text": "Keep 100% in stocks to squeeze out one last rally.",
            "correct": false
          }
        ],
        "explanation": "Once you've won the game and the goal date is near, take your chips off the volatile table."
      }
    },
    {
      "id": "correlation",
      "term": "Asset Correlation",
      "chapter": 8,
      "tip": "How closely two assets move in the same direction at the same time. True diversification combines assets with low or negative correlation (like Equities, Debt, and Gold).",
      "pronunciation": "/ˌkɒr.əˈleɪ.ʃən/",
      "partOfSpeech": "noun",
      "rootFamily": "Goal Architecture",
      "humanFriction": "Buying 5 different Large-Cap Funds thinking you are 'diversified,' only to watch all 5 fall 20% together on the exact same day.",
      "plainMeaning": "How closely two assets move in the same direction at the same time. True diversification combines assets with low or negative correlation (like Equities, Debt, and Gold).",
      "contextTemplate": "Because Gold (₹{gold24k}/g) and Fixed Income ({fdRate}%) have low Correlation with Equities, combining them cushions your portfolio during stock market storms.",
      "relatedWords": [
        "asset_allocation",
        "commodities_gold",
        "rebalancing"
      ],
      "quickCheck": {
        "question": "Which portfolio has genuine low-correlation diversification?",
        "options": [
          {
            "text": "60% Nifty Index Fund + 30% Short-Term Debt/EPF + 10% Gold.",
            "correct": true
          },
          {
            "text": "5 different Equity Flexi-Cap Funds from 5 different fund houses.",
            "correct": false
          }
        ],
        "explanation": "Five equity funds hold nearly the same underlying stocks (correlation ~0.95); Equity, Debt, and Gold respond differently to economic shocks."
      }
    },
    {
      "id": "portfolio_drift",
      "term": "Portfolio Drift",
      "chapter": 8,
      "tip": "The natural distortion of your target asset allocation over time as faster-growing assets (like stocks in a bull market) swell to become an oversized slice of your pie.",
      "pronunciation": "/pɔːtˈfoʊ.li.oʊ drɪft/",
      "partOfSpeech": "noun",
      "rootFamily": "Goal Architecture",
      "humanFriction": "Setting a comfortable 60% Equity / 40% Debt mix, ignoring it during a 3-year bull run, and accidentally ending up at 82% Equity right before a market peak.",
      "plainMeaning": "The natural distortion of your target asset allocation over time as faster-growing assets (like stocks in a bull market) swell to become an oversized slice of your pie.",
      "contextTemplate": "When equities surge, Portfolio Drift quietly increases your downside risk unless you periodically trim it back to your target mix.",
      "relatedWords": [
        "rebalancing",
        "asset_allocation",
        "drawdown"
      ],
      "quickCheck": {
        "question": "What is the hidden danger of ignoring Portfolio Drift after a massive 3-year stock market rally?",
        "options": [
          {
            "text": "Your portfolio now carries far more equity crash risk than you originally planned for.",
            "correct": true
          },
          {
            "text": "Your bank closes your account.",
            "correct": false
          }
        ],
        "explanation": "Unchecked drift makes your portfolio heaviest in equities at the exact top of a bull market."
      }
    },
    {
      "id": "marginal_vs_effective_tax",
      "term": "Marginal vs. Effective Tax Rate",
      "chapter": 9,
      "tip": "Marginal Tax Rate is the slab percentage applied only to your NEXT extra rupee earned (like FD interest); Effective Tax Rate is the much lower average percentage paid across your total income.",
      "pronunciation": "/ˈmɑː.dʒɪ.nəl vɜː.səs ɪˈfɛk.tɪv/",
      "partOfSpeech": "noun pair",
      "rootFamily": "Taxes & Net Keep",
      "humanFriction": "Believing that entering the '30% tax bracket' means the government takes 30% of your entire salary—when lower slabs are still taxed at 0%, 5%, 10%, 15%, and 20%!",
      "plainMeaning": "Marginal Tax Rate is the slab percentage applied only to your NEXT extra rupee earned (like FD interest); Effective Tax Rate is the much lower average percentage paid across your total income.",
      "contextTemplate": "If you are in the 30% Marginal Tax slab, every new rupee of {fdRate}% Bank FD interest is taxed at 30%—even if your overall Effective Tax Rate is only 14%.",
      "relatedWords": [
        "tax_drag",
        "stcg_vs_ltcg",
        "realized_vs_unrealized"
      ],
      "quickCheck": {
        "question": "If India's 30% slab starts above ₹15 Lakhs (New Regime) and you earn ₹16 Lakhs, is your entire ₹16 Lakhs taxed at 30%?",
        "options": [
          {
            "text": "No—only the ₹1 Lakh above ₹15 Lakhs is taxed at 30%; the earlier slabs pay much lower rates.",
            "correct": true
          },
          {
            "text": "Yes—all ₹16 Lakhs is taxed at 30%.",
            "correct": false
          }
        ],
        "explanation": "Progressive tax slabs work like buckets: only the overflow above each threshold pays the higher marginal rate."
      }
    },
    {
      "id": "realized_vs_unrealized",
      "term": "Realized vs. Unrealized Gains",
      "chapter": 9,
      "tip": "Unrealized Gain is paper growth while you still hold an asset (untaxed in stocks/mutual funds); Realized Gain happens the day you actually sell/redeem, triggering Capital Gains Tax.",
      "pronunciation": "/ˈrɪə.laɪzd vɜː.səs ʌnˈrɪə.laɪzd/",
      "partOfSpeech": "adjective pair",
      "rootFamily": "Taxes & Net Keep",
      "humanFriction": "Wondering why your Bank FD gets taxed every single March 31st even if you don't touch it, while your Mutual Fund or Stock grows for 15 years without a single rupee of tax until you sell.",
      "plainMeaning": "Unrealized Gain is paper growth while you still hold an asset (untaxed in stocks/mutual funds); Realized Gain happens the day you actually sell/redeem, triggering Capital Gains Tax.",
      "contextTemplate": "Because mutual funds and equities aren't taxed on Unrealized Gains, your full pre-tax money stays invested and compounds uninterrupted for all {goalYears} years.",
      "relatedWords": [
        "tax_drag",
        "stcg_vs_ltcg",
        "tax_harvesting"
      ],
      "quickCheck": {
        "question": "Your Equity Mutual Fund grew from ₹5 Lakhs to ₹8 Lakhs this year, and you did NOT sell any units. How much Capital Gains Tax do you owe this year?",
        "options": [
          {
            "text": "₹0 — Unrealized gains in mutual funds and stocks are not taxed until you redeem.",
            "correct": true
          },
          {
            "text": "Tax on ₹3 Lakhs immediately.",
            "correct": false
          }
        ],
        "explanation": "Tax deferral on unrealized gains is one of the biggest structural advantages of market funds over bank FDs."
      }
    },
    {
      "id": "stcg_vs_ltcg",
      "term": "STCG vs. LTCG",
      "chapter": 9,
      "tip": "Short-Term Capital Gains (STCG) tax applies when you sell quickly; Long-Term Capital Gains (LTCG) tax applies after holding past the statutory threshold (12 months for listed Equity), rewarding patience with lower rates.",
      "pronunciation": "/ɛs.tiː.siː.dʒiː vɜː.səs ɛl.tiː.siː.dʒiː/",
      "partOfSpeech": "noun pair",
      "rootFamily": "Taxes & Net Keep",
      "humanFriction": "Selling a profitable stock or equity fund at 11 months and 25 days—and paying 20% Short-Term tax instead of waiting 6 more days to qualify for 12.5% Long-Term tax (with ₹1.25 Lakh annual exemption!).",
      "plainMeaning": "Short-Term Capital Gains (STCG) tax applies when you sell quickly; Long-Term Capital Gains (LTCG) tax applies after holding past the statutory threshold (12 months for listed Equity), rewarding patience with lower rates.",
      "contextTemplate": "Holding Equity funds beyond 12 months unlocks LTCG treatment: the first ₹1.25 Lakh of equity profit each financial year is 100% tax-free, and gains above that pay 12.5%.",
      "relatedWords": [
        "tax_harvesting",
        "realized_vs_unrealized",
        "marginal_vs_effective_tax"
      ],
      "quickCheck": {
        "question": "In Indian listed equities and equity mutual funds, what holding period flips a gain from Short-Term (20% tax) to Long-Term (12.5% tax above ₹1.25L)?",
        "options": [
          {
            "text": "More than 12 months (1 year).",
            "correct": true
          },
          {
            "text": "More than 5 years.",
            "correct": false
          }
        ],
        "explanation": "Just 366 days turns listed equity gains into Long-Term Capital Gains."
      }
    },
    {
      "id": "tax_drag",
      "term": "Tax Drag",
      "chapter": 9,
      "tip": "The reduction in long-term compounded wealth caused by paying taxes annually along the way instead of letting taxes stay deferred until the end.",
      "pronunciation": "/tæks dræɡ/",
      "partOfSpeech": "noun",
      "rootFamily": "Taxes & Net Keep",
      "humanFriction": "Comparing a 7% FD with a 7% Arbitrage Fund as 'identical,' forgetting that annual slab tax on the FD slices off 20%–30% of the compounding engine every single year.",
      "plainMeaning": "The reduction in long-term compounded wealth caused by paying taxes annually along the way instead of letting taxes stay deferred until the end.",
      "contextTemplate": "At the 30% slab, Tax Drag cuts a {fdRate}% FD down to ~4.76% net, whereas an Arbitrage Fund (~7.2%) taxed at 12.5% LTCG only upon redemption keeps compounding much faster.",
      "relatedWords": [
        "realized_vs_unrealized",
        "marginal_vs_effective_tax",
        "purchasing_power_erosion"
      ],
      "quickCheck": {
        "question": "Why does 'Tax Deferral' (paying tax only at the end of 10 years instead of every year) create a larger final corpus even at the same tax rate?",
        "options": [
          {
            "text": "Because the unpaid tax money stays inside your account earning compounding returns for all 10 years.",
            "correct": true
          },
          {
            "text": "Because inflation stops when tax is deferred.",
            "correct": false
          }
        ],
        "explanation": "Every rupee not lost to annual TDS/slab tax continues compounding for you."
      }
    },
    {
      "id": "tax_harvesting",
      "term": "Tax Harvesting",
      "chapter": 9,
      "tip": "Legally realizing up to ₹1.25 Lakh of Long-Term Equity Capital Gains each financial year (and immediately reinvesting) to reset your buy price higher at ₹0 tax—or using capital losses to offset taxable gains.",
      "pronunciation": "/tæks ˈhɑː.vɪs.tɪŋ/",
      "partOfSpeech": "noun / verb",
      "rootFamily": "Taxes & Net Keep",
      "humanFriction": "Letting 10 years of equity gains pile up into a single ₹12 Lakh taxable redemption in Year 10, instead of booking the free ₹1.25 Lakh LTCG allowance every March!",
      "plainMeaning": "Legally realizing up to ₹1.25 Lakh of Long-Term Equity Capital Gains each financial year (and immediately reinvesting) to reset your buy price higher at ₹0 tax—or using capital losses to offset taxable gains.",
      "contextTemplate": "Annual Tax Harvesting of your ₹1.25 Lakh tax-free LTCG quota can save up to ₹15,625 in future taxes every single year.",
      "relatedWords": [
        "stcg_vs_ltcg",
        "realized_vs_unrealized",
        "rebalancing"
      ],
      "quickCheck": {
        "question": "Does the ₹1.25 Lakh annual tax-free Equity LTCG limit carry forward to next year if you don't use it by March 31?",
        "options": [
          {
            "text": "No—it is a use-it-or-lose-it annual exemption for each financial year.",
            "correct": true
          },
          {
            "text": "Yes—it accumulates for 10 years.",
            "correct": false
          }
        ],
        "explanation": "Each financial year's ₹1.25L LTCG exemption expires on March 31 if unharvested."
      }
    },
    {
      "id": "fi_corpus",
      "term": "Financial Independence (FI Corpus)",
      "chapter": 10,
      "tip": "The invested portfolio size (typically 25x to 35x of your annual expenses) where the returns generated by your assets permanently cover your living costs, making work optional.",
      "pronunciation": "/faɪˈnæn.ʃəl ˌɪn.dɪˈpɛn.dəns/",
      "partOfSpeech": "noun",
      "rootFamily": "Freedom & Decumulation",
      "humanFriction": "Picking an arbitrary round number like '₹2 Crore' for retirement without linking it to your actual annual household expenses and inflation.",
      "plainMeaning": "The invested portfolio size (typically 25x to 35x of your annual expenses) where the returns generated by your assets permanently cover your living costs, making work optional.",
      "contextTemplate": "If your household spends ₹12 Lakhs/year, a 30x FI Corpus means building ₹3.6 Crore (in today's purchasing power) so work becomes a choice, not a necessity.",
      "relatedWords": [
        "safe_withdrawal_rate",
        "lifestyle_creep",
        "bucket_strategy"
      ],
      "quickCheck": {
        "question": "Why is your FI Corpus measured as a multiple of your ANNUAL EXPENSES (e.g., 30x expenses) rather than a multiple of your salary?",
        "options": [
          {
            "text": "Because in retirement your portfolio needs to replace what you SPEND, not what you used to earn.",
            "correct": true
          },
          {
            "text": "Because salaries are secret.",
            "correct": false
          }
        ],
        "explanation": "Someone earning ₹30L who spends ₹10L only needs to fund ₹10L/year of lifestyle; someone spending ₹28L needs nearly 3x the corpus."
      }
    },
    {
      "id": "safe_withdrawal_rate",
      "term": "Safe Withdrawal Rate (SWR)",
      "chapter": 10,
      "tip": "The conservative percentage of your retirement portfolio (typically ~3% to 3.5% in India's higher-inflation environment) you can withdraw in Year 1 and adjust upward for inflation each year without running out of money over 30+ years.",
      "pronunciation": "/seɪf wɪðˈdrɔː.əl reɪt/",
      "partOfSpeech": "noun",
      "rootFamily": "Freedom & Decumulation",
      "humanFriction": "Thinking 'If my mutual fund makes 10% a year, I can safely spend 10% of my corpus every year!'—forgetting both inflation and bad market years.",
      "plainMeaning": "The conservative percentage of your retirement portfolio (typically ~3% to 3.5% in India's higher-inflation environment) you can withdraw in Year 1 and adjust upward for inflation each year without running out of money over 30+ years.",
      "contextTemplate": "At a 3.3% Safe Withdrawal Rate (30x corpus), ₹3 Crore can sustainably fund ₹10 Lakhs of annual living expenses adjusted for {inflation}% inflation.",
      "relatedWords": [
        "fi_corpus",
        "sequence_of_returns_risk",
        "swp_systematic_withdrawal"
      ],
      "quickCheck": {
        "question": "Why can't you withdraw 8% per year from a portfolio that averages 10% return?",
        "options": [
          {
            "text": "Because inflation requires your rupee withdrawals to grow every year, and early market dips would deplete the principal.",
            "correct": true
          },
          {
            "text": "Because banks limit withdrawals to 2%.",
            "correct": false
          }
        ],
        "explanation": "Your portfolio must simultaneously fund your living expenses AND grow the remaining principal by at least the inflation rate."
      }
    },
    {
      "id": "sequence_of_returns_risk",
      "term": "Sequence of Returns Risk",
      "chapter": 10,
      "tip": "The danger that poor market returns hit in the first 3–5 years of retirement (or right before a major goal), forcing you to sell beaten-down equity units to pay monthly bills.",
      "pronunciation": "/ˈsiː.kwəns ɒv rɪˈtɜːnz rɪsk/",
      "partOfSpeech": "noun",
      "rootFamily": "Freedom & Decumulation",
      "humanFriction": "Assuming 'Average 12% return' means smooth sailing in retirement, without realizing that a -30% stock crash in Year 1 of retirement while you are withdrawing money can permanently break the portfolio.",
      "plainMeaning": "The danger that poor market returns hit in the first 3–5 years of retirement (or right before a major goal), forcing you to sell beaten-down equity units to pay monthly bills.",
      "contextTemplate": "To defeat Sequence of Returns Risk, never withdraw monthly living expenses directly from an all-equity portfolio during a market downturn.",
      "relatedWords": [
        "bucket_strategy",
        "safe_withdrawal_rate",
        "horizon_matching"
      ],
      "quickCheck": {
        "question": "When does a 25% stock market crash do the most permanent damage to a retiree?",
        "options": [
          {
            "text": "In the first 1–3 years of retirement, if they are forced to sell fallen stocks for monthly groceries.",
            "correct": true
          },
          {
            "text": "When they are 28 years old and investing via monthly SIPs.",
            "correct": false
          }
        ],
        "explanation": "Selling fallen equity units locks in permanent losses; young SIP investors benefit from crashes, while retirees withdrawing from equities get hurt."
      }
    },
    {
      "id": "bucket_strategy",
      "term": "The 3-Bucket Strategy",
      "chapter": 10,
      "tip": "Dividing your freedom corpus into 3 time buckets: Bucket 1 (Years 1–3 of expenses in Cash/FD/Liquid), Bucket 2 (Years 4–8 in Debt/Hybrid), and Bucket 3 (Years 9+ in Equities/Gold to beat inflation).",
      "pronunciation": "/ˈbʌk.ɪt ˈstræt.ə.dʒi/",
      "partOfSpeech": "noun",
      "rootFamily": "Freedom & Decumulation",
      "humanFriction": "Being torn between keeping retirement money 100% in FDs (where inflation eats it) or 100% in stocks (where a crash ruins your sleep).",
      "plainMeaning": "Dividing your freedom corpus into 3 time buckets: Bucket 1 (Years 1–3 of expenses in Cash/FD/Liquid), Bucket 2 (Years 4–8 in Debt/Hybrid), and Bucket 3 (Years 9+ in Equities/Gold to beat inflation).",
      "contextTemplate": "With a 3-Bucket Strategy, your next 36 months of bills sit safely in Bucket 1 (~{fdRate}%), giving your Equity Bucket 3 nearly a decade to ride out any market crash.",
      "relatedWords": [
        "sequence_of_returns_risk",
        "cash_equivalents",
        "asset_allocation"
      ],
      "quickCheck": {
        "question": "If the stock market crashes 30% in Year 2 of your retirement, where do your monthly living expenses come from in a 3-Bucket Strategy?",
        "options": [
          {
            "text": "Strictly from Bucket 1 (Cash/Liquid/FD)—leaving Bucket 3 (Equities) completely untouched until it recovers.",
            "correct": true
          },
          {
            "text": "By selling Bucket 3 stocks at a 30% loss.",
            "correct": false
          }
        ],
        "explanation": "Bucket 1 buys you time and peace of mind so you never have to sell equities during a bear market."
      }
    },
    {
      "id": "swp_systematic_withdrawal",
      "term": "SWP (Systematic Withdrawal Plan)",
      "chapter": 10,
      "tip": "The exact opposite of an SIP: instructing a mutual fund to automatically redeem a fixed rupee amount into your bank account every month—where tax applies ONLY to the tiny capital gain portion of each withdrawal, not the principal.",
      "pronunciation": "/ɛs.dʌb.əl.juː.piː/",
      "partOfSpeech": "noun",
      "rootFamily": "Freedom & Decumulation",
      "humanFriction": "Putting retirement money into a 'Monthly Dividend / IDCW' option (where payouts aren't guaranteed and the whole dividend is taxed at your slab rate) instead of setting up a tax-efficient SWP.",
      "plainMeaning": "The exact opposite of an SIP: instructing a mutual fund to automatically redeem a fixed rupee amount into your bank account every month—where tax applies ONLY to the tiny capital gain portion of each withdrawal, not the principal.",
      "contextTemplate": "An SWP from your Bucket 1 / Bucket 2 funds creates a custom, tax-efficient monthly paycheck on the 1st of every month.",
      "relatedWords": [
        "bucket_strategy",
        "realized_vs_unrealized",
        "stcg_vs_ltcg"
      ],
      "quickCheck": {
        "question": "Why is a ₹50,000/month SWP from a Growth Mutual Fund far more tax-efficient than ₹50,000/month of FD interest?",
        "options": [
          {
            "text": "In an SWP, most of each ₹50,000 withdrawal is your own tax-free principal returning; only the gain portion is taxed.",
            "correct": true
          },
          {
            "text": "SWPs are exempt from all Indian laws.",
            "correct": false
          }
        ],
        "explanation": "FD interest is 100% taxable income; an SWP unit redemption consists mostly of your own already-taxed principal plus a small capital gain component."
      }
    }
  ],

  find(id) {
    for (let i = 0; i < this.terms.length; i++) if (this.terms[i].id === id) return this.terms[i];
    return null;
  },

  // Fill a term's example with the person's own numbers (anything missing falls back to a sample value)
  renderContext(id, vars = {}) {
    const entry = this.find(id);
    if (!entry || !entry.contextTemplate) return "";
    const defaults = {
      goalName: "Car Upgrade",
      goalCost: "15.0L",
      goalFutureCost: "18.9L",
      goalYears: 4,
      principal: "1,00,000",
      fdRate: 6.8,
      postTaxFdRate: 5.4,
      inflation: 5.4,
      gold24k: "13,800",
      niftyCagr: 13.4,
      sipMonthly: "10,000"
    };
    const merged = { ...defaults, ...vars };
    return entry.contextTemplate.replace(/\{(\w+)\}/g, (_, k) =>
      merged[k] !== undefined ? merged[k] : `{${k}}`
    );
  }
};
