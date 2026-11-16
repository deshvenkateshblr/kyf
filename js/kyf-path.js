/**
 * KYF_PATH -- turns the task catalogue (data/kyf-path.js) plus what the person has ticked into
 * a path: stages, progress, the one task to do next, and what has come due again.
 *
 * Pure functions, no DOM. Saved state lives on the Cadence activities (status, doneAt,
 * snoozedUntil), so it travels in the same .kyf file as before.
 *
 * A task is, for display:
 *   done   ticked, or seen by the app (auto)
 *   open   still to do
 *   later  hidden from "up next" until snoozedUntil
 *   na     "not for me": leaves the maths
 * A recurring task that is done but older than its interval is `renew`: it still counts as done for
 * the path (so the bar never slides backwards) and shows up as "due again".
 */
(function (root) {
  "use strict";

  const DAY = 86400000;
  const LATER_DAYS = 7;

  const allocsOf = (h) => (Array.isArray(h.allocations) ? h.allocations.filter((a) => a && a.goalId) : []);

  /** What the app can see for itself. ctx = { holdings, goals } */
  function autoDone(key, ctx) {
    const hs = (ctx && ctx.holdings) || [];
    const gs = ((ctx && ctx.goals) || []).filter((g) => g && g.kind !== "COVER" && g.status !== "ACHIEVED");
    const own = hs.filter((h) => h && !h.isLiability);
    switch (key) {
      case "holdings": return own.length > 0;
      case "liabilities": return hs.some((h) => h && h.isLiability);
      case "goal": return gs.length > 0;
      case "goalsComplete": return gs.length > 0 && gs.every((g) => (Number(g.baseTargetINR) || 0) > 0 && Number(g.targetYear) > 0);
      case "emergencyGoal": return gs.some((g) => /emergency|buffer|safety/i.test(String(g.name || g.title || "")));
      case "assigned": return own.length > 0 && own.every((h) => allocsOf(h).length > 0);
      default: return false;
    }
  }

  /** Tasks that only apply to some people. ctx = { holdings, goals } */
  function applies(task, ctx) {
    if (!task.when) return true;
    const hs = (ctx && ctx.holdings) || [];
    if (task.when === "hasDebt") return hs.some((h) => h && h.isLiability);
    return true;
  }

  function view(task, rec, ctx, now) {
    const t = now || Date.now();
    if (task.auto && autoDone(task.auto, ctx)) return { state: "done", auto: true, renew: false };
    const st = rec && rec.status;
    if (st === "not_applicable") return { state: "na", auto: false, renew: false };
    if (st === "done") {
      const doneAt = rec.doneAt ? Date.parse(rec.doneAt) : NaN;
      const renew = !!task.recurDays && !isNaN(doneAt) && t - doneAt > task.recurDays * DAY;
      return { state: "done", auto: false, renew, doneAt: isNaN(doneAt) ? null : doneAt, dueAt: !isNaN(doneAt) && task.recurDays ? doneAt + task.recurDays * DAY : null };
    }
    const until = rec && rec.snoozedUntil ? Date.parse(rec.snoozedUntil) : NaN;
    if (!isNaN(until) && until > t) return { state: "later", auto: false, renew: false, until };
    return { state: "open", auto: false, renew: false };
  }

  /**
   * build(data, records, ctx, now)
   *   records: array of stored activities (matched by id)
   * returns { stages:[{...stage, items:[{task, rec, v}], done, total, pct}], done, total, pct,
   *           current, next, renewals }
   */
  function build(data, records, ctx, now) {
    const byId = new Map((records || []).map((r) => [r.id, r]));
    const stages = data.stages.map((s) => {
      const items = data.tasks.filter((t) => t.stage === s.id && applies(t, ctx)).map((task) => {
        const rec = byId.get(task.id) || null;
        return { task, rec, v: view(task, rec, ctx, now) };
      });
      const counted = items.filter((i) => i.v.state !== "na");
      const done = counted.filter((i) => i.v.state === "done").length;
      const total = counted.length;
      return Object.assign({}, s, { items, done, total, pct: total ? Math.round((done / total) * 100) : 100 });
    });
    const done = stages.reduce((n, s) => n + s.done, 0);
    const total = stages.reduce((n, s) => n + s.total, 0);
    // Each stage counts equally, so a stage with two tasks moves the bar as much as one with four
    const pct = Math.round(stages.reduce((n, s) => n + s.pct, 0) / stages.length);
    const current = (stages.find((s) => s.pct < 100) || stages[stages.length - 1]).id;
    const flat = stages.reduce((a, s) => a.concat(s.items), []);
    const renewals = flat.filter((i) => i.v.renew);
    const next = flat.find((i) => i.v.state === "open") || renewals[0] || null;
    return { stages, done, total, pct, current, next, renewals };
  }

  // ---- changes a person can make (return the updated record) ---------------------------------
  const nowIso = (now) => new Date(now || Date.now()).toISOString();
  const markDone = (rec, now) => Object.assign({}, rec, { status: "done", doneAt: nowIso(now), snoozedUntil: "" });
  const reopen = (rec) => Object.assign({}, rec, { status: "active", doneAt: "", snoozedUntil: "" });
  const snooze = (rec, now) => Object.assign({}, rec, { status: "active", snoozedUntil: nowIso((now || Date.now()) + LATER_DAYS * DAY) });
  const notForMe = (rec) => Object.assign({}, rec, { status: "not_applicable", snoozedUntil: "" });

  /** Keep every catalogue task present on the stored list, carrying over saved state by id. */
  function merge(stored, data) {
    const gone = new Set(data.retired || []);
    stored = (stored || []).filter((a) => !gone.has(a.id));
    const have = new Map((stored || []).map((a) => [a.id, a]));
    const out = (stored || []).map((a) => {
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

  root.KYF_PATH = { build, view, autoDone, applies, merge, markDone, reopen, snooze, notForMe, LATER_DAYS };
})(typeof window !== "undefined" ? window : globalThis);
