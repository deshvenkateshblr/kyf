# Money Power: sessions 1 and 2 (draft for review)

Status: **content draft, nothing built yet.** Facts marked ⚠ need checking by a CFP or a good dictionary before shipping.
All rupee figures use the live SBI FD rate in `market-pulse.js` (6.8%) on ₹1,00,000, so the learner sees numbers they will meet in real life. In the app these come from the learner's own goals and the Market Pulse data.

## How a session plays (like a Lewis chapter)

| Step | What the learner sees | Scored? |
|---|---|---|
| Teasers | 3 scenario questions, "I'm not sure" always allowed | No. Three right offers "skip ahead"; any miss goes into the lesson |
| Idea cards | A chain of "Did you know…" cards, each opening to the words behind it | No |
| Try it | 3-question quiz, mixed types (recognise, apply, spot the misuse) | Yes: progress only, never a lock |
| Come back | Missed words reappear inside later sessions | No |

**Card chain.** Every card has a *grade* (1 = everyday, 2 = needs one earlier idea, 3 = needs two or more). A card's "next" link only ever goes sideways or up one grade, so a path climbs steadily. The learner can leave and return anywhere: the app stores the last card seen and the cards finished, and offers "Pick up where you left off" on Learn and on Home.

**Card shape (for the build):** `id, session, idea, grade, hook (the "Did you know…" line), reveal (plain meaning + the learner's numbers), words[], origin, next[]`.

---

## Session 1: How to talk about interest
*Helps to know: nothing.*

### Teasers (not scored)
1. You lend a friend ₹1,00,000 for a year and he returns ₹1,06,800. Which is the best description of the ₹6,800?
   a) A gift b) The price he paid for using your money for a year ✔ c) A tax d) Profit from his business
2. A bank says "6.8% per annum". What does *per annum* tell you?
   a) Paid monthly b) The rate is quoted for one year ✔ c) The rate can change daily d) It is tax free
3. Same ₹1,00,000, same 6.8%. Bank A pays you; Bank B charges you. What is different?
   a) The rate b) Only which side of the counter you stand on ✔ c) The arithmetic d) The year

### Idea 1: Money has a rent
**Did you know** the ₹6,800 isn't a bonus? It is rent. Whoever holds your money for a year pays you for the use of it.

| Word | Plain meaning | Origin |
|---|---|---|
| **Principal** | The original amount that earns or owes interest | Latin *principalis*, "first, chief": the main sum ⚠ |
| **Interest** | The rent paid for using money | Latin *interest*, "it matters" (*inter* + *esse*, "to be between") ⚠ |
| **Rate** | The rent, as a percentage of the principal for a period | Latin *rata*, "reckoned, fixed" ⚠ |
| **Per annum** | "For each year" | Latin, "by the year" |
| **Tenure** | How long the money is held | Latin *tenere*, "to hold" ⚠ |

Next card: *If rent is charged on the principal only, how much is it?*

### Idea 2: Simple interest and the ticking clock
**Did you know** your FD earns about **₹18.63 every day** on ₹1,00,000 at 6.8%, even if the bank pays you only once a quarter?

- **Simple interest** is worked out on the principal only: `principal × rate × years`. ₹1,00,000 × 6.8% × 3 years = **₹20,400**.
- **Accrue** means interest has been *earned* but not yet *paid out*. Daily accrual: 100,000 × 0.068 ÷ 365 = ₹18.63. Origin: Latin *accrescere*, "to grow to" ⚠.

Next card: *What if the interest also earns interest?* (leads to Session 2)

### Idea 3: Both sides of the counter
**Did you know** the word *credit* means "he believes"? The lender trusts you will repay.

| Word | Plain meaning | Origin |
|---|---|---|
| **Deposit** | Money you place with a bank; you are the lender | Latin *depositum*, "put down" ⚠ |
| **Loan** | Money you borrow; you pay interest | Old Norse *lán* ⚠ |
| **Creditor / Debtor** | The one owed / the one who owes | Latin *credere*, "to believe"; *debere*, "to owe" |

Same 6.8% on ₹1,00,000: a deposit earns you ₹6,800 in a year, a loan costs you ₹6,800.

### Try it (3 questions)
1. *Apply.* Your ₹2,00,000 in a 3-year deposit at 5% simple interest earns what in total?
   a) ₹10,000 b) ₹30,000 ✔ c) ₹31,525 d) ₹6,000
   *Why:* 2,00,000 × 5% × 3. (c is the compound answer, which comes next.)
2. *Recognise.* "Accrued interest" is interest that…
   a) is paid in cash today b) has been earned but not yet paid ✔ c) will be charged next year d) the bank can cancel
3. *Spot the misuse.* A friend says "I earned ₹6,800 profit from the FD, so the bank gave me a bonus." What is wrong?
   a) Nothing b) It is rent for lending your money, not a bonus ✔ c) FDs don't pay interest d) It should be 6%

---

## Session 2: How to talk about compounding
*Helps to know: How to talk about interest.*

### Teasers (not scored)
1. ₹1,00,000 at 6.8% for 3 years. Simple interest gives ₹20,400. Interest on interest would give…
   a) exactly ₹20,400 b) a little more ✔ c) a little less d) double
2. Two FDs both say 6.8%, one pays interest yearly and one quarterly. Which earns more over a year?
   a) The same b) Quarterly ✔ c) Yearly d) Depends on the bank's size
3. Roughly how long does money take to double at 7% a year?
   a) 5 years b) 10 years ✔ c) 14 years d) 20 years

### Idea 1: Interest on interest
**Did you know** after 3 years the same 6.8% gives **₹1,21,819** with compounding, but ₹1,20,400 without? The extra **₹1,419** is interest earning its own interest.

| Word | Plain meaning | Origin |
|---|---|---|
| **Compound** | Add the interest to the principal so the next round earns on both | Latin *componere*, "to put together" ⚠ |
| **Compounding** | The repeating process of earning on earnings | same |
| **Exponential** | Growth by repeated multiplication, not repeated addition | Latin *ex* + *ponere*, "to put out" ⚠ |

Formula for the curious: `principal × (1 + rate)^years`. Next card: *Does it matter how often the bank adds it?*

### Idea 2: What is written vs what you earn
**Did you know** an FD "at 6.8%" paid every quarter actually earns **6.975%** in a year? ₹1,00,000 becomes ₹1,06,975, not ₹1,06,800.

| Compounded | Effective rate | ₹1,00,000 after a year |
|---|---|---|
| Yearly | 6.800% | ₹1,06,800 |
| Half-yearly | 6.916% | ₹1,06,916 |
| Quarterly | 6.975% | ₹1,06,975 |
| Monthly | 7.016% | ₹1,07,016 |
| Daily | 7.036% | ₹1,07,036 |

| Word | Plain meaning | Origin |
|---|---|---|
| **Nominal rate** | The rate in the headline | Latin *nomen*, "name": the rate "in name only" ⚠ |
| **Effective rate** | What you really earn in a year after compounding | Latin *efficere*, "to accomplish" ⚠ |
| **Compounding frequency** | How often interest is added to the principal | |

Real-life note ⚠: many Indian banks compound FD interest quarterly; check the bank's FD terms.
Next card: *So how long until it doubles?*

### Idea 3: The doubling shortcut
**Did you know** dividing 72 by the rate gives the doubling time? 72 ÷ 6.8 ≈ **10.6 years** (the exact answer is 10.5). It is described in Luca Pacioli's 1494 book *Summa de arithmetica* ⚠.

- ₹1,00,000 at 6.8% becomes ~₹1.93 lakh in 10 years and ~₹3.73 lakh in 20.
- The second ten years add far more than the first ten. That is compounding.

| Word | Plain meaning |
|---|---|
| **Rule of 72** | 72 ÷ rate = years to double |
| **Doubling time** | How long the money takes to become twice its size |

### Try it (3 questions)
1. *Recognise.* "Compounding" means…
   a) interest paid only on the original amount b) interest added to the principal so it also earns interest ✔ c) a higher rate after a year d) paying a loan early
2. *Apply.* An FD advertises 8% compounded quarterly. Its effective yearly rate is…
   a) exactly 8% b) a little more than 8% ✔ c) a little less than 8% d) 4%
3. *Spot the misuse.* "At 12% my ₹1 lakh will double in 12 years, because 12 × 12 = 144." What is wrong?
   a) Nothing b) The rule is 72 ÷ 12 = 6 years ✔ c) It takes 24 years d) 12% is impossible

---

## Open questions for review
1. Pass mark for "Try it": 2 of 3, with a retry that shows different questions?
2. Are the teaser questions gentle enough for a first-time learner?
3. Is the origin material a help or a distraction? Keep it to one line per word?
4. Anything in ⚠ that you or a CFP would reword?
