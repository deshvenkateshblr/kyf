/**
 * Cadence: "Your money path".
 * The catalogue and the order live in data/kyf-path.js, the rules in js/kyf-path.js.
 * This file draws it, and saves what the person ticks (same storage and .kyf section as before).
 */
(function () {
  const STORAGE_KEY = "kyf_cadence_v3";
  const P = window.KYF_PATH;
  const DATA = window.KYF_PATH_DATA;

  let activities = [];                 // everything stored: path tasks, goal steps, the person's own
  let ctx = { holdings: [], goals: [] }; // what the app can see, so some tasks tick themselves
  let goalsList = [];
  const goalFilterId = new URLSearchParams(window.location.search).get("goal") || "";
  const catalogueIds = new Set(DATA.tasks.map((t) => t.id));

  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[c]));
  const fmtDate = (ms) => new Date(ms).toLocaleDateString("en-IN", { day: "numeric", month: "short" });

  // ---- storage ------------------------------------------------------------------------------
  function loadActivities() {
    let stored = [];
    try {
      const raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem("kyf_cadence_v2") || localStorage.getItem("kyf_cadence_v1");
      if (raw) stored = JSON.parse(raw);
      if (window.KYF_GOALS) stored = window.KYF_GOALS.migrateCadence(stored);
    } catch (e) { stored = []; }
    activities = P.merge(stored, DATA);
    saveActivities();
  }

  function saveActivities() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(activities)); }
    catch (e) { console.error("Storage error:", e); }
  }

  // A change the person made: save, redraw, and quietly flag that a file copy is out of date
  function commit() {
    saveActivities();
    if (window.KYF_VAULT) window.KYF_VAULT.markDirty();
    render();
  }

  async function readSection(name) {
    const h = window.KYF_VAULT && window.KYF_VAULT.sections.get(name);
    if (!h) return [];
    try { return await h.read(); } catch (e) { return []; }
  }

  async function syncContext() {
    const K = window.KYF_GOALS;
    if (!K) return;
    goalsList = K.mergeGoalLists(await readSection("goals"));
    ctx = { goals: goalsList, holdings: await readSection("portfolio") };
    const ids = new Set(goalsList.map((g) => g.id));
    // Steps of deleted goals go away; every goal gets its checklist exactly once
    activities = activities.filter((a) => !a.goalId || ids.has(a.goalId));
    goalsList.forEach((g) => { activities = K.withChecklist(activities, g); });
    saveActivities();
  }

  async function refresh() {
    loadActivities();
    await syncContext();
    render();
  }

  // ---- drawing ------------------------------------------------------------------------------
  function render() {
    const path = P.build(DATA, activities, ctx);
    const focus = !!goalFilterId;
    ["pathHero", "upNextWrap", "stagesWrap"].forEach((id) => { const el = $(id); if (el) el.hidden = focus; });
    if (!focus) { renderHero(path); renderUpNext(path); renderStages(path); }
    renderSchedule(path);
    renderGoalGroups();
    renderOwn();
    const note = $("goalFilterNote");
    if (note) {
      const g = goalsList.find((x) => x.id === goalFilterId);
      note.hidden = !focus;
      if (focus) note.innerHTML = `Showing steps for <strong>${esc(g ? g.name : "this goal")}</strong> &middot; <a href="cadence.html">Show my whole path</a>`;
    }
    $("goalsSection").hidden = !focus;
    window.dispatchEvent(new CustomEvent("kyf:path-rendered", { detail: { pct: path.pct } }));
  }

  function setWidths(root) {
    root.querySelectorAll("i[data-w]").forEach((i) => { i.style.width = i.getAttribute("data-w") + "%"; });
  }

  function renderHero(path) {
    const stage = path.stages.find((s) => s.id === path.current);
    const none = path.done === 0;
    $("pathHeadline").textContent = path.pct >= 100
      ? "Your money path is built. Now keep it going."
      : none ? "Let’s build your money path."
      : `You’re on stage ${stage.id} of ${path.stages.length}: ${stage.name}.`;
    $("pathSub").textContent = path.pct >= 100
      ? "Every step is done. A few calm check-ins a year keep it that way."
      : none ? "Three short groups, one small step at a time. You confirm each one, and set the date for the next look."
      : stage.line;
    const bar = $("pathBar");
    bar.setAttribute("aria-valuenow", String(path.pct));
    $("pathTrack").style.setProperty("--n", String(path.stages.length));
    $("pathTrack").innerHTML = path.stages.map((s) => {
      const cls = "seg" + (s.pct >= 100 ? " is-done" : "") + (s.id === path.current && path.pct < 100 ? " is-current" : "");
      return `<li class="${cls}" title="${esc(s.name)}: ${s.done} of ${s.total}">
        <span class="seg-bar"><i data-w="${s.pct}"></i></span>
        <span class="seg-dot" aria-hidden="true">${s.pct >= 100 ? "✓" : s.icon}</span>
        <span class="seg-label">${esc(s.name)}</span></li>`;
    }).join("");
    setWidths($("pathTrack"));
    const due = path.schedule.overdue.length;
    $("pathFoot").innerHTML = `<strong>${path.done}</strong> of ${path.total} steps done` +
      (due ? ` &middot; <button type="button" class="link-btn" data-act="show-due" data-id="${esc(path.schedule.overdue[0].item.task.id)}">${due} overdue</button>` : "");
  }

  const dateVal = (ms) => (ms ? new Date(ms).toISOString().slice(0, 10) : "");
  const tomorrow = () => dateVal(Date.now() + 86400000);

  // The one question, the buttons that answer it, and the "I'll do it by" date. Used by Up next and task rows.
  function answerButtons(t, v, id, small) {
    const sz = small ? " small" : "";
    const out = [];
    if (t.href && v.state !== "na") out.push(`<a class="btn-action primary${sz}" href="${esc(t.href)}">${esc(t.cta || "Open")} &rarr;</a>`);
    if (v.state === "open" || v.state === "later") {
      // "That's all of them" makes no sense while nothing has been added; "I don't have any" is the honest answer then
      const nothingYet = t.hint && t.naLabel && !v.hint;
      if (!nothingYet) out.push(`<button type="button" class="btn-action${sz}${t.href ? "" : " primary"}" data-act="done" data-id="${esc(id)}">${esc(t.doneLabel || "I’ve done this")} ✓</button>`);
      if (t.naLabel) out.push(`<button type="button" class="btn-action quiet${sz}" data-act="na" data-id="${esc(id)}">${esc(t.naLabel)}</button>`);
    }
    return out.join("");
  }

  function planBox(t, v, id) {
    if (v.state !== "open" && v.state !== "later") return "";
    return `<label class="plan-by">I’ll do this by <input type="date" data-field="plan" data-id="${esc(id)}" min="${tomorrow()}" value="${v.state === "later" ? dateVal(v.until) : ""}"></label>`;
  }

  function renderUpNext(path) {
    const el = $("upNext");
    const n = path.next;
    el.hidden = false;
    if (!n) {
      el.className = "up-next is-clear";
      el.innerHTML = `<p class="up-label">All clear</p><h2>Nothing to do right now 🎉</h2><p class="up-why">Everything is confirmed or planned. Come back when something is due.</p>`;
      return;
    }
    const t = n.task;
    const stage = path.stages.find((s) => s.id === (t.stage || (n.rec && n.rec.stage) || 2)) || path.stages[0];
    const again = n.v.renew;
    const label = again ? "Overdue" : n.v.overdue ? "You planned this" : "Up next";
    const buttons = again
      ? `<button type="button" class="btn-action primary" data-act="done" data-id="${esc(t.id)}">Done again ✓</button>`
      : answerButtons(t, n.v, t.id, false);
    const sub = t.goalId ? `Goal: ${esc((goalsList.find((g) => g.id === t.goalId) || {}).name || "")}` : `${esc(stage.name)}`;
    el.className = "up-next";
    el.innerHTML = `
      <p class="up-label">${label} &middot; ${sub}</p>
      <div class="up-body">
        <div class="up-icon" aria-hidden="true">${esc(t.icon || "📌")}</div>
        <div class="up-main">
          <h2>${esc(t.title)}</h2>
          ${t.ask ? `<p class="up-ask">${esc(t.ask)}</p>` : ""}
          <p class="up-why">${esc(t.why || "")}</p>
          ${n.v.hint ? `<p class="up-hint">${n.v.hint} ${esc(t.hintUnit || "added so far")}</p>` : ""}
          <div class="up-actions">${buttons}</div>
          ${again ? "" : planBox(t, n.v, t.id)}
        </div>
      </div>`;
  }

  function taskList(items) {
    let last = null;
    return items.map((i) => {
      const g = i.task.group;
      const head = g && g !== last ? `<li class="task-group">${esc(g)}</li>` : "";
      last = g || last;
      return head + taskRow(i.task, i.rec, i.v);
    }).join("");
  }

  function goalGroupHtml(g, items) {
    const live = items.filter((i) => i.v.state !== "na");
    const done = live.filter((i) => i.v.state === "done").length;
    const pct = live.length ? Math.round((done / live.length) * 100) : 0;
    return `<section class="goal-group" data-goal="${esc(g.id)}">
      <div class="goal-group-head"><h3>${esc(g.icon || "🎯")} ${esc(g.name)}</h3><span class="goal-group-progress">${done} of ${live.length}</span><a href="goals.html">Open goal &rarr;</a></div>
      <span class="mini-bar wide"><i data-w="${pct}"></i></span>
      <ul class="task-list">${items.map((i) => taskRow(i.task, i.rec, i.v)).join("")}</ul>
    </section>`;
  }

  // Redrawing must not fold away what the person has open: remember which groups and tasks were open
  let openTasks = new Set(), lastCurrent = null;

  function renderStages(path) {
    const host = $("stages");
    const had = host.children.length > 0;
    const openStages = new Set([...host.querySelectorAll("details.stage[open]")].map((d) => Number(d.dataset.stage)));
    openTasks = new Set([...document.querySelectorAll(".task > details[open]")].map((d) => d.closest(".task").dataset.id));
    const moved = lastCurrent !== null && lastCurrent !== path.current;
    lastCurrent = path.current;
    host.innerHTML = path.stages.map((s) => {
      const state = s.pct >= 100 ? "is-done" : s.id === path.current ? "is-current" : "is-later";
      const open = !had || moved ? s.id === path.current && path.pct < 100 : openStages.has(s.id);
      const tag = s.pct >= 100 ? "Done ✓" : s.id === path.current ? "You are here" : "";
      const goals = s.goalSteps
        ? (s.goalGroups.length
          ? `<div class="goal-groups"><p class="task-group-note">Goal by goal</p>${s.goalGroups.map((g) => goalGroupHtml(g.goal, g.items)).join("")}</div>`
          : `<p class="empty-note stage-note">Once you add a goal, its steps appear here.</p>`)
        : "";
      return `<details class="stage ${state}" data-stage="${s.id}"${open ? " open" : ""}>
        <summary>
          <span class="stage-icon" aria-hidden="true">${s.pct >= 100 ? "✓" : s.icon}</span>
          <span class="stage-title"><strong>${s.id}. ${esc(s.name)}</strong><small>${esc(s.line)}</small></span>
          <span class="stage-meta">${tag ? `<em>${tag}</em>` : ""}<span class="stage-count">${s.done} of ${s.total}</span><span class="mini-bar"><i data-w="${s.pct}"></i></span></span>
        </summary>
        <ul class="task-list">${taskList(s.items)}</ul>
        ${goals}
      </details>`;
    }).join("");
    setWidths($("stages"));
  }

  // One task, from the catalogue, a goal's checklist, or the person's own
  function taskRow(t, rec, v) {
    const id = t.id;
    const custom = !catalogueIds.has(id) && !(rec && rec.goalId);
    let badge = "";
    if (v.state === "done" && v.renew) badge = `<span class="badge due">Overdue &middot; was ${fmtDate(v.dueAt)}</span>`;
    else if (v.state === "done") badge = `<span class="badge ok">Done${v.doneAt ? " " + fmtDate(v.doneAt) : ""}${v.dueAt ? ` &middot; ${esc((t.dateLabel || "again").toLowerCase())} ${fmtDate(v.dueAt)}` : ""}</span>`;
    else if (v.state === "later") badge = `<span class="badge soft">By ${fmtDate(v.until)}</span>`;
    else if (v.state === "na") badge = `<span class="badge soft">${esc(t.naLabel || "Not for me")}</span>`;
    else if (v.overdue) badge = `<span class="badge due">Planned for ${fmtDate(v.plan)}</span>`;
    else if (v.hint) badge = `<span class="badge soft">${v.hint} ${esc(t.hintUnit || "added so far")}</span>`;
    else if (t.frequency) badge = `<span class="badge soft">${esc(t.frequency)}</span>`;

    const tickLabel = v.state === "done" ? "Mark as not done" : "Mark as done";
    const tick = `<button type="button" class="tick${v.state === "done" ? " on" : ""}" data-act="tick" data-id="${esc(id)}" aria-label="${tickLabel}: ${esc(t.title)}"${v.state === "na" ? " disabled" : ""}>✓</button>`;

    const acts = [];
    if (v.state !== "done") acts.push(answerButtons(t, v, id, true));
    if (v.state === "done" && t.href) acts.push(`<a class="btn-action small" href="${esc(t.href)}">${esc(t.cta || "Open")} &rarr;</a>`);
    if (v.state === "done") acts.push(`<button type="button" class="btn-action small quiet" data-act="reopen" data-id="${esc(id)}">Not done after all</button>`);
    if (v.state === "later") acts.push(`<button type="button" class="btn-action small quiet" data-act="reopen" data-id="${esc(id)}">Clear date</button>`);
    if (v.state === "na") acts.push(`<button type="button" class="btn-action small" data-act="reopen" data-id="${esc(id)}">Put it back</button>`);
    if (v.state === "open" && !t.naLabel && !custom && !(rec && rec.goalId)) acts.push(`<button type="button" class="btn-action small quiet" data-act="na" data-id="${esc(id)}">Not for me</button>`);
    if (custom) acts.push(`<button type="button" class="btn-action small quiet" data-act="remove" data-id="${esc(id)}">Remove</button>`);

    const recurring = !!(t.recurDays && v.state === "done");
    const sched = recurring ? `<div class="sched">
        <label>Check <select data-field="every" data-id="${esc(id)}">${EVERY.map(([d, l]) => `<option value="${d}"${d === v.every ? " selected" : ""}>${l}</option>`).join("")}</select></label>
        <label>${esc(t.dateLabel || "Next on")} <input type="date" data-field="nextOn" data-id="${esc(id)}" value="${dateVal(v.dueAt)}"></label>
      </div>` : "";
    // Insurance and nominee tasks: entering the renewal date is how you say "I have it"
    const early = t.recurDays && t.dateLabel && (v.state === "open" || v.state === "later")
      ? `<label class="plan-by">${esc(t.dateLabel)} <input type="date" data-field="renewal" data-id="${esc(id)}" value=""></label>` : "";
    const why = t.why || (rec && rec.description) || "";
    const how = t.how && t.how.length ? `<ul class="how">${t.how.map((h) => `<li>${esc(h)}</li>`).join("")}</ul>` : "";
    return `<li class="task is-${v.state}${v.renew ? " is-renew" : ""}" id="task-${esc(id)}" data-id="${esc(id)}">
      ${tick}
      <details${openTasks.has(id) ? " open" : ""}>
        <summary><span class="task-icon" aria-hidden="true">${esc(t.icon || (rec && rec.icon) || "📌")}</span><span class="task-title">${esc(t.title)}</span>${t.tag ? `<span class="badge soft">${esc(t.tag)}</span>` : ""}${badge}</summary>
        <div class="task-body">${t.ask ? `<p class="ask">${esc(t.ask)}</p>` : ""}${why ? `<p>${esc(why)}</p>` : ""}${how}${sched}${early}${acts.length ? `<div class="task-actions">${acts.join("")}</div>` : ""}${planBox(t, v, id)}</div>
      </details>
    </li>`;
  }

  function recordEntry(rec) {
    const base = rec.goalId ? P.taskOfRecord(rec)
      : { id: rec.id, title: rec.title, why: rec.description, icon: rec.icon, href: rec.pageUrl || rec.href, cta: "Open" };
    return taskRow(base, rec, P.view(base, rec, ctx));
  }

  // Coming up: overdue first, then the next 30 days, then later
  function renderSchedule(path) {
    const s = path.schedule, host = $("scheduleWrap");
    const any = s.overdue.length + s.soon.length + s.later.length;
    host.hidden = !any || !!goalFilterId;
    if (host.hidden) return;
    const row = (r) => {
      const t = r.item.task;
      const what = r.kind === "planned" ? "planned" : t.dateLabel ? t.dateLabel.toLowerCase() : "due";
      return `<li class="sch-row ${r.kind}"><span class="sch-date">${fmtDate(r.at)}</span><button type="button" class="sch-title" data-act="goto" data-id="${esc(t.id)}">${esc(t.icon || "📌")} ${esc(t.title)}</button><span class="sch-what">${esc(what)}</span></li>`;
    };
    const block = (title, cls, list) => list.length ? `<div class="sch-col ${cls}"><h3>${title} <span>${list.length}</span></h3><ul>${list.map(row).join("")}</ul></div>` : "";
    $("schedule").innerHTML = block("Overdue", "is-overdue", s.overdue) + block("Next 30 days", "is-soon", s.soon) + block("Later", "is-later", s.later);
  }

  function renderGoalGroups() {
    const host = $("goalsGrid");
    const goals = goalsList.filter((g) => goalFilterId && g.id === goalFilterId);
    host.innerHTML = goals.map((g) => goalGroupHtml(g, activities.filter((a) => a.goalId === g.id).map((rec) => {
      const task = P.taskOfRecord(rec);
      return { task, rec, v: P.view(task, rec, ctx) };
    }))).join("");
    setWidths(host);
  }

  function renderOwn() {
    const own = activities.filter((a) => !catalogueIds.has(a.id) && !a.goalId);
    $("ownSection").hidden = own.length === 0 || !!goalFilterId;
    $("ownList").innerHTML = own.map(recordEntry).join("");
  }

  // ---- actions ------------------------------------------------------------------------------
  function update(id, fn) {
    const i = activities.findIndex((a) => a.id === id);
    if (i < 0) return;
    activities[i] = fn(activities[i]);
    commit();
  }

  const EVERY = [[30, "every month"], [90, "every quarter"], [182, "twice a year"], [365, "every year"]];

  const isoDay = (v) => new Date(v + "T00:00:00").toISOString();

  function onChange(e) {
    const f = e.target.closest("[data-field]");
    if (!f) return;
    const id = f.dataset.id, field = f.dataset.field;
    if (field === "every") update(id, (r) => P.setEvery(r, f.value));
    else if (field === "nextOn" && f.value) update(id, (r) => P.setNextOn(r, isoDay(f.value)));
    else if (field === "plan") update(id, (r) => (f.value ? P.planFor(r, isoDay(f.value)) : P.reopen(r)));
    else if (field === "renewal" && f.value) update(id, (r) => P.setNextOn(P.markDone(r), isoDay(f.value)));
  }

  function onClick(e) {
    const b = e.target.closest("[data-act]");
    if (!b) return;
    const act = b.dataset.act, id = b.dataset.id;
    if (act === "tick") {
      e.preventDefault();
      const rec = activities.find((a) => a.id === id);
      if (!rec) return;
      const task = DATA.tasks.find((t) => t.id === id) || { id };
      const v = P.view(task, rec, ctx);
      update(id, (r) => (v.state === "done" && !v.renew ? P.reopen(r) : P.markDone(r)));
    } else if (act === "done") update(id, P.markDone);
    else if (act === "reopen") update(id, P.reopen);
    else if (act === "na") update(id, P.notForMe);
    else if (act === "remove") { activities = activities.filter((a) => a.id !== id); commit(); }
    else if (act === "show-due" || act === "goto") {
      const row = document.getElementById("task-" + id);
      if (row) {
        const stage = row.closest("details.stage");
        if (stage) stage.open = true;
        const d = row.querySelector("details"); if (d) d.open = true;
        row.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }
  }

  function bindEvents() {
    document.addEventListener("click", onClick);
    document.addEventListener("change", onChange);

    const modal = $("addModalOverlay"), form = $("addActivityForm");
    $("openAddModalBtn").addEventListener("click", () => { modal.classList.add("open"); $("actTitle").focus(); });
    ["closeAddModalBtn", "cancelAddBtn"].forEach((id) => $(id).addEventListener("click", () => modal.classList.remove("open")));
    modal.addEventListener("click", (e) => { if (e.target === modal) modal.classList.remove("open"); });
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const title = $("actTitle").value.trim();
      if (!title) return;
      activities.unshift({ id: "custom-" + Date.now(), section: "custom", icon: "📝", title, description: "", status: "active", dueDate: $("actDueDate").value || "" });
      modal.classList.remove("open");
      form.reset();
      commit();
    });

    // Start over: a second tap confirms, no browser pop-up
    const reset = $("resetCadenceBtn");
    let armed = false, timer = null;
    reset.addEventListener("click", () => {
      if (!armed) {
        armed = true; reset.textContent = "Tap again to start over";
        timer = setTimeout(() => { armed = false; reset.textContent = "Start over"; }, 4000);
        return;
      }
      clearTimeout(timer); armed = false; reset.textContent = "Start over";
      localStorage.removeItem(STORAGE_KEY);
      refresh();
    });

    if (window.KYF_VAULT) {
      window.KYF_VAULT.registerPageHook({
        pageName: "cadence",
        getLocalData: () => { saveActivities(); return { cadence: activities }; },
        onAfterOpen: () => refresh()
      });
      window.KYF_VAULT.bindPageUI({
        fileInputId: "kyfFileInput", openBtnId: "navOpenFileBtn",
        openBtnSecondaryId: "openFileHeroBtn", saveBtnId: "navSaveDataBtn", saveBtnSecondaryId: "exportCadenceBtn"
      });
    }
  }

  loadActivities();
  bindEvents();
  render();
  syncContext().then(render);
})();
