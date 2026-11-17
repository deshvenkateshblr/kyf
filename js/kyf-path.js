/**
 * KYF_PATH -- turns the task catalogue (data/kyf-path.js) plus what the person has confirmed into
 * a path: groups, progress, the one task to do next, and a small schedule of what is overdue or coming up.
 *
 * Pure functions, no DOM. Nothing ticks itself: the app only counts matching holdings as a hint.
 * Saved state lives on the Cadence activities, so it travels in the same .kyf file as before.
 *
 * A task is, for display:
 *   done   confirmed by the person
 *   open   still to do (overdue = the date they promised themselves has passed)
 *   later  the person said "I'll do this by <date>"; hidden from "up next" until then
 *   na     "I don't have any / not for me": leaves the maths
 * A recurring task that is done but past its next date is `renew`: it still counts as done (so the
 * bar never slides backwards) and appears as overdue in the schedule.
 */
(function (root) {
  "use strict";

  const DAY = 86400000;
  const LATER_DAYS = 7;
  const SOON_DAYS = 30;

  const text = (h) => `${h.assetClass || ""} ${h.subCategory || ""} ${h.name || ""}`.toLowerCase();
  const isGoal = (g) => g && g.kind !== "COVER" && g.status !== "ACHIEVED";

  /** How many things the app can see for this task. Only a hint; the person still confirms. */
  function hintCount(key, ctx) {
    const hs = (ctx && ctx.holdings) || [];
    const own = hs.filter((h) => h && !h.isLiability);
    const cls = (re) => own.filter((h) => re.test(h.assetClass || "")).length;
    switch (key) {
      case "savings": return cls(/cash/i);
      case "fd": return own.filter((h) => /fixed income/i.test(h.assetClass || "") && /fixed deposit|\bfd\b|deposit/i.test(text(h)) && !/epf|ppf|provident/i.test(text(h))).length;
      case "mf": return cls(/mutual/i);
      case "equity": return cls(/equit|stock|share/i);
      case "epf": return own.filter((h) => /fixed income/i.test(h.assetClass || "") && /\bepf\b|employees.? provident/i.test(text(h))).length;
      case "ppf": return own.filter((h) => /fixed income/i.test(h.assetClass || "") && /\bppf\b|public provident/i.test(text(h))).length;
      case "gold": return cls(/gold|commodit|real estate|property/i);
      case "liabilities": return hs.filter((h) => h && h.isLiability).length;
      case "goals": return ((ctx && ctx.goals) || []).filter(isGoal).length;
      default: return 0;
    }
  }

  const planOf = (rec) => {
    const v = rec && (rec.planOn || rec.snoozedUntil);
    const t = v ? Date.parse(v) : NaN;
    return isNaN(t) ? null : t;
  };

  function view(task, rec, ctx, now) {
    const t = now || Date.now();
    const hint = task.hint ? hintCount(task.hint, ctx) : 0;
    const st = rec && rec.status;
    if (st === "not_applicable") return { state: "na", renew: false, hint };
    if (st === "done") {
      const doneAt = rec.doneAt ? Date.parse(rec.doneAt) : NaN;
      const every = Number(rec.everyDays) || task.recurDays || 0;
      const picked = rec.nextOn ? Date.parse(rec.nextOn) : NaN;
      const dueAt = !isNaN(picked) ? picked : every && !isNaN(doneAt) ? doneAt + every * DAY : null;
      const renew = dueAt != null && t > dueAt;
      return { state: "done", renew, doneAt: isNaN(doneAt) ? null : doneAt, dueAt, every, hint };
    }
    const plan = planOf(rec);
    if (plan != null && plan > t) return { state: "later", renew: false, until: plan, hint };
    return { state: "open", renew: false, overdue: plan != null, plan, hint };
  }

  const taskOfRecord = (rec) => {
    const review = /review progress|track/i.test(rec.title || "");
    return {
      id: rec.id, title: rec.title, icon: rec.icon, why: rec.description, goalId: rec.goalId,
      href: rec.pageUrl || rec.href || "goals.html", cta: "Open goals",
      recurDays: review ? 182 : 0, frequency: review ? "Every 6 months" : "", dateLabel: review ? "Next review on" : ""
    };
  };

  /**
   * build(data, records, ctx, now)
   *   records: stored activities (matched by id); ctx = { holdings, goals }
   * returns { stages:[{...stage, items:[{task, rec, v}], goalGroups:[{goal, items}], done,total,pct}],
   *           done,total,pct,current,next,renewals, schedule }
   */
  function build(data, records, ctx, now) {
    const byId = new Map((records || []).map((r) => [r.id, r]));
    const goals = ((ctx && ctx.goals) || []).filter(isGoal);
    const stages = data.stages.map((s) => {
      const items = data.tasks.filter((t) => t.stage === s.id).map((task) => {
        const rec = byId.get(task.id) || null;
        return { task, rec, v: view(task, rec, ctx, now) };
      });
      // Goal-by-goal steps sit under the goals stage
      const goalGroups = s.goalSteps ? goals.map((goal) => ({
        goal,
        items: (records || []).filter((r) => r.goalId === goal.id).map((rec) => {
          const task = taskOfRecord(rec);
          return { task, rec, v: view(task, rec, ctx, now) };
        })
      })) : [];
      const all = items.concat(goalGroups.reduce((a, g) => a.concat(g.items), []));
      const counted = all.filter((i) => i.v.state !== "na");
      const done = counted.filter((i) => i.v.state === "done").length;
      const total = counted.length;
      return Object.assign({}, s, { items, goalGroups, done, total, pct: total ? Math.round((done / total) * 100) : 100 });
    });
    const done = stages.reduce((n, s) => n + s.done, 0);
    const total = stages.reduce((n, s) => n + s.total, 0);
    // Each group counts equally
    const pct = Math.round(stages.reduce((n, s) => n + s.pct, 0) / stages.length);
    const current = (stages.find((s) => s.pct < 100) || stages[stages.length - 1]).id;
    const flat = stages.reduce((a, s) => a.concat(s.items, s.goalGroups.reduce((x, g) => x.concat(g.items), [])), []);
    const renewals = flat.filter((i) => i.v.renew);
    const next = flat.find((i) => i.v.state === "open" && !i.v.overdue) || flat.find((i) => i.v.state === "open") || renewals[0] || null;
    return { stages, done, total, pct, current, next, renewals, schedule: schedule(flat, now) };
  }

  /** What has a date on it: overdue, due in the next 30 days, and later. Sorted by date. */
  function schedule(entries, now) {
    const t = now || Date.now();
    const rows = [];
    entries.forEach((i) => {
      const v = i.v;
      if (v.state === "later") rows.push({ item: i, at: v.until, kind: "planned" });
      else if (v.state === "open" && v.overdue) rows.push({ item: i, at: v.plan, kind: "overdue" });
      else if (v.state === "done" && v.dueAt != null) rows.push({ item: i, at: v.dueAt, kind: v.renew ? "overdue" : "upcoming" });
    });
    rows.sort((a, b) => a.at - b.at);
    return {
      overdue: rows.filter((r) => r.kind === "overdue"),
      soon: rows.filter((r) => r.kind !== "overdue" && r.at - t <= SOON_DAYS * DAY),
      later: rows.filter((r) => r.kind !== "overdue" && r.at - t > SOON_DAYS * DAY)
    };
  }

  /**
   * What is overdue, from the stored records alone (no holdings or goals needed), for the home page.
   * Returns [{ id, title, at, kind }] oldest first: a recurring task past its next date, or a task whose
   * "I'll do this by" date has passed.
   */
  function overdue(data, records, now) {
    const t = now || Date.now();
    const byId = new Map((records || []).map((r) => [r.id, r]));
    const out = [];
    const consider = (task, rec) => {
      if (!rec) return;
      const v = view(task, rec, null, t);
      if (v.state === "done" && v.renew) out.push({ id: task.id, title: task.title, at: v.dueAt, kind: "renew" });
      else if (v.state === "open" && v.overdue) out.push({ id: task.id, title: task.title, at: v.plan, kind: "plan" });
    };
    data.tasks.forEach((task) => consider(task, byId.get(task.id)));
    (records || []).filter((r) => r.goalId).forEach((rec) => consider(taskOfRecord(rec), rec));
    return out.sort((a, b) => a.at - b.at);
  }

  // ---- changes a person can make (return the updated record) ---------------------------------
  const nowIso = (now) => new Date(now || Date.now()).toISOString();
  const markDone = (rec, now) => Object.assign({}, rec, { status: "done", doneAt: nowIso(now), snoozedUntil: "", planOn: "", nextOn: "" });
  const reopen = (rec) => Object.assign({}, rec, { status: "active", doneAt: "", snoozedUntil: "", planOn: "", nextOn: "" });
  const planFor = (rec, iso) => Object.assign({}, rec, { status: "active", snoozedUntil: "", planOn: iso || "" });
  const snooze = (rec, now) => planFor(rec, nowIso((now || Date.now()) + LATER_DAYS * DAY));
  const notForMe = (rec) => Object.assign({}, rec, { status: "not_applicable", snoozedUntil: "", planOn: "" });
  const setEvery = (rec, days) => Object.assign({}, rec, { everyDays: Number(days) || 0, nextOn: "" });
  const setNextOn = (rec, iso) => Object.assign({}, rec, { nextOn: iso || "" });

  /** Keep every catalogue task present on the stored list, carrying over saved state by id. */
  function merge(stored, data) {
    const gone = new Set(data.retired || []);
    stored = (stored || []).filter((a) => !gone.has(a.id));
    const have = new Map(stored.map((a) => [a.id, a]));
    const out = stored.map((a) => {
      const t = data.tasks.find((x) => x.id === a.id);
      return t ? Object.assign({}, a, display(t)) : a;
    });
    data.tasks.forEach((t) => {
      if (!have.has(t.id)) out.push(Object.assign({ id: t.id, status: "active", dueDate: "" }, display(t)));
    });
    return out;
  }

  function display(t) {
    return {
      section: "path", stage: t.stage, icon: t.icon, title: t.title, description: t.why,
      frequency: t.frequency || "", href: t.href || "", pageUrl: t.href || ""
    };
  }

  root.KYF_PATH = { build, view, overdue, hintCount, schedule, taskOfRecord, merge, markDone, reopen, planFor, snooze, notForMe, setEvery, setNextOn, LATER_DAYS, SOON_DAYS };
})(typeof window !== "undefined" ? window : globalThis);
