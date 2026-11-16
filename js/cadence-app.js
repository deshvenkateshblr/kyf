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
    renderGoalGroups();
    renderOwn();
    const note = $("goalFilterNote");
    if (note) {
      const g = goalsList.find((x) => x.id === goalFilterId);
      note.hidden = !focus;
      if (focus) note.innerHTML = `Showing steps for <strong>${esc(g ? g.name : "this goal")}</strong> &middot; <a href="cadence.html">Show my whole path</a>`;
    }
    $("goalsSection").hidden = !goalsList.length && !focus;
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
      : none ? "Six stages, one small step at a time. We tick off what we can see for you."
      : stage.line;
    const bar = $("pathBar");
    bar.setAttribute("aria-valuenow", String(path.pct));
    $("pathTrack").innerHTML = path.stages.map((s) => {
      const cls = "seg" + (s.pct >= 100 ? " is-done" : "") + (s.id === path.current && path.pct < 100 ? " is-current" : "");
      return `<li class="${cls}" title="${esc(s.name)}: ${s.done} of ${s.total}">
        <span class="seg-bar"><i data-w="${s.pct}"></i></span>
        <span class="seg-dot" aria-hidden="true">${s.pct >= 100 ? "✓" : s.icon}</span>
        <span class="seg-label">${esc(s.name)}</span></li>`;
    }).join("");
    setWidths($("pathTrack"));
    const due = path.renewals.length;
    $("pathFoot").innerHTML = `<strong>${path.done}</strong> of ${path.total} steps done` +
      (due ? ` &middot; <button type="button" class="link-btn" data-act="show-due">${due} due again</button>` : "");
  }

  function renderUpNext(path) {
    const el = $("upNext");
    const n = path.next;
    el.hidden = false;
    if (!n) {
      el.className = "up-next is-clear";
      el.innerHTML = `<p class="up-label">All clear</p><h2>Nothing to do right now 🎉</h2><p class="up-why">Everything on your path is done or put off for later. Come back when something is due again.</p>`;
      return;
    }
    const t = n.task;
    const stage = path.stages.find((s) => s.id === t.stage);
    const again = n.v.renew;
    const primary = t.href
      ? `<a class="btn-action primary" href="${esc(t.href)}">${esc(t.cta || "Do it")} &rarr;</a>`
      : "";
    const done = n.v.auto ? "" : `<button type="button" class="btn-action${t.href ? "" : " primary"}" data-act="done" data-id="${esc(t.id)}">${again ? "Done again" : "I’ve done this"} ✓</button>`;
    el.className = "up-next";
    el.innerHTML = `
      <p class="up-label">${again ? "Due again" : "Up next"} &middot; Stage ${stage.id}: ${esc(stage.name)}</p>
      <div class="up-body">
        <div class="up-icon" aria-hidden="true">${t.icon}</div>
        <div class="up-main">
          <h2>${esc(t.title)}</h2>
          <p class="up-why">${esc(t.why)}</p>
          ${t.how && t.how.length ? `<ul class="how">${t.how.map((h) => `<li>${esc(h)}</li>`).join("")}</ul>` : ""}
          <div class="up-actions">${primary}${done}<button type="button" class="btn-action quiet" data-act="later" data-id="${esc(t.id)}">Later</button></div>
        </div>
      </div>`;
  }

  function renderStages(path) {
    $("stages").innerHTML = path.stages.map((s) => {
      const state = s.pct >= 100 ? "is-done" : s.id === path.current ? "is-current" : "is-later";
      const open = s.id === path.current && path.pct < 100;
      const tag = s.pct >= 100 ? "Done ✓" : s.id === path.current ? "You are here" : "";
      return `<details class="stage ${state}" data-stage="${s.id}"${open ? " open" : ""}>
        <summary>
          <span class="stage-icon" aria-hidden="true">${s.pct >= 100 ? "✓" : s.icon}</span>
          <span class="stage-title"><strong>${s.id}. ${esc(s.name)}</strong><small>${esc(s.line)}</small></span>
          <span class="stage-meta">${tag ? `<em>${tag}</em>` : ""}<span class="stage-count">${s.done} of ${s.total}</span><span class="mini-bar"><i data-w="${s.pct}"></i></span></span>
        </summary>
        <ul class="task-list">${s.items.map((i) => taskRow(i.task, i.rec, i.v)).join("")}</ul>
      </details>`;
    }).join("");
    setWidths($("stages"));
  }

  // One task, from the catalogue or from a stored record (goal steps, the person's own)
  function taskRow(t, rec, v) {
    const id = t.id;
    const custom = !catalogueIds.has(id) && !(rec && rec.goalId);
    let badge = "";
    if (v.state === "done" && v.auto) badge = `<span class="badge ok">Done for you</span>`;
    else if (v.state === "done" && v.renew) badge = `<span class="badge due">Due again</span>`;
    else if (v.state === "done") badge = `<span class="badge ok">Done${v.doneAt ? " " + fmtDate(v.doneAt) : ""}${v.dueAt ? ` &middot; again ${fmtDate(v.dueAt)}` : ""}</span>`;
    else if (v.state === "later") badge = `<span class="badge soft">Back ${fmtDate(v.until)}</span>`;
    else if (v.state === "na") badge = `<span class="badge soft">Not for me</span>`;
    else if (t.frequency) badge = `<span class="badge soft">${esc(t.frequency)}</span>`;

    const tickLabel = v.state === "done" ? "Mark as not done" : "Mark as done";
    const tick = `<button type="button" class="tick${v.state === "done" ? " on" : ""}" data-act="tick" data-id="${esc(id)}" aria-label="${tickLabel}: ${esc(t.title)}"${v.auto || v.state === "na" ? " disabled" : ""}>✓</button>`;

    const acts = [];
    if (t.href && v.state !== "na") acts.push(`<a class="btn-action primary small" href="${esc(t.href)}">${esc(t.cta || "Open")} &rarr;</a>`);
    if (v.state === "later") acts.push(`<button type="button" class="btn-action small" data-act="reopen" data-id="${esc(id)}">Bring back</button>`);
    if (v.state === "open") acts.push(`<button type="button" class="btn-action small" data-act="later" data-id="${esc(id)}">Later</button>`);
    if (v.state === "open" && !custom && !(rec && rec.goalId)) acts.push(`<button type="button" class="btn-action small quiet" data-act="na" data-id="${esc(id)}">Not for me</button>`);
    if (v.state === "na") acts.push(`<button type="button" class="btn-action small" data-act="reopen" data-id="${esc(id)}">Put it back</button>`);
    if (custom) acts.push(`<button type="button" class="btn-action small quiet" data-act="remove" data-id="${esc(id)}">Remove</button>`);

    const why = t.why || (rec && rec.description) || "";
    const how = t.how && t.how.length ? `<ul class="how">${t.how.map((h) => `<li>${esc(h)}</li>`).join("")}</ul>` : "";
    return `<li class="task is-${v.state}${v.renew ? " is-renew" : ""}" id="task-${esc(id)}" data-id="${esc(id)}">
      ${tick}
      <details>
        <summary><span class="task-icon" aria-hidden="true">${esc(t.icon || (rec && rec.icon) || "📌")}</span><span class="task-title">${esc(t.title)}</span>${badge}</summary>
        <div class="task-body">${why ? `<p>${esc(why)}</p>` : ""}${how}${acts.length ? `<div class="task-actions">${acts.join("")}</div>` : ""}</div>
      </details>
    </li>`;
  }

  function recordEntry(rec) {
    const t = { id: rec.id, title: rec.title, why: rec.description, icon: rec.icon, href: rec.pageUrl || rec.href, cta: "Open", frequency: "" };
    const v = P.view({ id: rec.id }, rec, ctx);
    return taskRow(t, rec, v);
  }

  function renderGoalGroups() {
    const host = $("goalsGrid");
    const goals = goalsList.filter((g) => !goalFilterId || g.id === goalFilterId);
    if (!goals.length) { host.innerHTML = `<p class="empty-note">No goals yet. <a href="goals.html">Add a goal</a> and its steps appear here.</p>`; return; }
    host.innerHTML = goals.map((g) => {
      const list = activities.filter((a) => a.goalId === g.id);
      const live = list.filter((a) => a.status !== "not_applicable");
      const done = live.filter((a) => a.status === "done").length;
      const pct = live.length ? Math.round((done / live.length) * 100) : 0;
      return `<section class="goal-group">
        <div class="goal-group-head"><h3>${esc(g.icon || "🎯")} ${esc(g.name)}</h3><span class="goal-group-progress">${done}/${live.length} done</span><a href="goals.html">Open goal &rarr;</a></div>
        <span class="mini-bar wide"><i data-w="${pct}"></i></span>
        <ul class="task-list">${list.map(recordEntry).join("")}</ul>
      </section>`;
    }).join("");
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
    else if (act === "later") update(id, P.snooze);
    else if (act === "reopen") update(id, P.reopen);
    else if (act === "na") update(id, P.notForMe);
    else if (act === "remove") { activities = activities.filter((a) => a.id !== id); commit(); }
    else if (act === "show-due") {
      const first = document.querySelector(".task.is-renew");
      if (first) {
        const stage = first.closest("details.stage");
        if (stage) stage.open = true;
        first.scrollIntoView({ behavior: "smooth", block: "center" });
        const d = first.querySelector("details"); if (d) d.open = true;
      }
    }
  }

  function bindEvents() {
    document.addEventListener("click", onClick);

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
