
// ------------------------------------------------------------
// TimeTracker Frontend — Clean, validated version
// ------------------------------------------------------------

// === Helpers =================================================

function $(id) {
    return document.getElementById(id);
  }
  
  function pad2(n) {
    return String(n).padStart(2, "0");
  }
  
  function todayISO() {
    const d = new Date();
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  }
  
  function toHmFromMinutes(mins) {
    const v = Number(mins || 0);
    const h = Math.floor(v / 60);
    const m = v % 60;
    return `${pad2(h)}:${pad2(m)}`;
  }
  
  function weekdayName(idx) {
    return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][idx] || "";
  }
  
  function monthName(m) {
    return [
      "January", "February", "March", "April", "May", "June", "July",
      "August", "September", "October", "November", "December"
    ][m - 1];
  }


  function openURL(url) {
    window.location.href = url;
  }
  
  
  // === API Clients ============================================
  
  const api = {
    health: () => fetch("/api/health").then(r => r.json()),
  
    monthOverview: (year, month) =>
      fetch(`/api/month/${year}/${month}/overview`).then(r => r.json()),
  
    dailySummary: (date) =>
      fetch(`/api/daily-summary?date=${encodeURIComponent(date)}`).then(r => r.json()),
  
    dayIntervals: (date) =>
      fetch(`/api/work-intervals?date=${encodeURIComponent(date)}`).then(r => r.json()),
  
   Breaks: (date) =>
      fetch(`/api/breaks?date=${encodeURIComponent(date)}`).then(r => r.json()),
  
    addInterval: (payload) =>
      fetch("/api/work-intervals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      }).then(async (r) => {
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
        return j;
      }),
  
    updateInterval: (id, payload) =>
      fetch(`/api/work-intervals/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      }).then(async (r) => {
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
        return j;
      }),
  
    deleteInterval: (id) =>
      fetch(`/api/work-intervals/${id}`, { method: "DELETE" })
        .then((r) => {
          if (!r.ok && r.status !== 204) throw new Error(`HTTP ${r.status}`);
          return true;
        }),
  
    addBreak: (payload) =>
      fetch("/api/breaks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      }).then(async (r) => {
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
        return j;
      }),
  
    updateBreak: (id, payload) =>
      fetch(`/api/breaks/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      }).then(async (r) => {
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
        return j;
      }),
  
    deleteBreak: (id) =>
      fetch(`/api/breaks/${id}`, { method: "DELETE" })
        .then((r) => {
          if (!r.ok && r.status !== 204) throw new Error(`HTTP ${r.status}`);
          return true;
        })
  };
  
  // Timer
  const timerApi = {
    status: (date) =>
      fetch(`/api/timer/status?date=${encodeURIComponent(date)}`).then(r => r.json()),
  
    start: (date, project_id, task_id, notes) =>
      fetch("/api/timer/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, project_id, task_id, notes })
      }).then(async (r) => {
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
        return j;
      }),
  
    stop: (date) =>
      fetch("/api/timer/stop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date })
      }).then(async (r) => {
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
        return j;
      })
  };
  
  // Project/task
  const projectsApi = {
    listProjects: () => fetch("/api/projects").then(r => r.json()),
    listTasks: (project_id) => {
      const url = project_id
        ? `/api/tasks?project_id=${encodeURIComponent(project_id)}`
        : "/api/tasks";
      return fetch(url).then(r => r.json());
    }
  };
  
  // === Health Panel ===========================================
  
  function initHealth() {
    $("check-btn").addEventListener("click", async () => {
      const out = $("health-output");
      out.textContent = "Checking...";
      try {
        const j = await api.health();
        out.textContent = JSON.stringify(j, null, 2);
      } catch (e) {
        out.textContent = e.message;
      }
    });
  }
  
  // === Month Overview ==========================================
  
  function renderMonthStats(totals, year, month) {
    $("month-stats").innerHTML = `
      <div class="stat"><div class="label">Month</div><div class="value">${monthName(month)} ${year}</div></div>
      <div class="stat"><div class="label">Working Days</div><div class="value">${totals.working_days}</div></div>
      <div class="stat"><div class="label">Must Hours</div><div class="value">${toHmFromMinutes(totals.must_minutes)}</div></div>
      <div class="stat"><div class="label">Recorded</div><div class="value">${toHmFromMinutes(totals.recorded_minutes)}</div></div>
      <div class="stat"><div class="label">Work</div><div class="value">${toHmFromMinutes(totals.work_minutes)}</div></div>
      <div class="stat"><div class="label">Breaks</div><div class="value">${toHmFromMinutes(totals.break_minutes)}</div></div>
    `;
  }
  
  async function applyMonthOverview() {
    const y = Number($("year").value);
    const m = Number($("month").value);
    const overview = await api.monthOverview(y, m);
  
    renderMonthStats(overview.totals, y, m);
    renderMonthTable(overview);
  }
  
  function renderMonthTable(overview) {
    const tbody = $("month-table").querySelector("tbody");
    tbody.innerHTML = "";
  
    for (const day of overview.days) {
      const tr = document.createElement("tr");
  
      tr.innerHTML = `
        <td>${day.date}</td>
        <td>${weekdayName(day.weekday)}</td>
        <td>${toHmFromMinutes(day.work_minutes)}</td>
        <td>${toHmFromMinutes(day.break_minutes)}</td>
        <td>${toHmFromMinutes(day.recorded_minutes)}</td>
        <td>${day.first_start || ""}</td>
        <td>${day.last_end || ""}</td>
        <td>${day.warnings.length ? day.warnings.join("<br>") : "OK"}</td>
        <td><button data-date="${day.date}" class="expand-btn">Expand</button></td>
      `;
  
      tbody.appendChild(tr);
    }
  }
  
  // === Today Panel =============================================
  
  async function loadProjectsTasksToday() {
    const projects = await projectsApi.listProjects();
    const projSel = $("today-project");
    projSel.innerHTML = `<option value="">(unassigned)</option>`;
  
    for (const p of projects) {
      const o = document.createElement("option");
      o.value = p.id;
      o.textContent = p.name;
      projSel.appendChild(o);
    }
  
    projSel.addEventListener("change", loadTasksToday);
    await loadTasksToday();
  }
  
  async function loadTasksToday() {
    const pid = $("today-project").value || null;
    const tasks = await projectsApi.listTasks(pid);
    const taskSel = $("today-task");
    taskSel.innerHTML = `<option value="">(unassigned)</option>`;
  
    for (const t of tasks) {
      const o = document.createElement("option");
      o.value = t.id;
      o.textContent = t.name;
      taskSel.appendChild(o);
    }
  }
  
  async function refreshToday() {
    const date = todayISO();
    $("today-date").textContent = date;
  
    const summary = await api.dailySummary(date);
    $("today-recorded").textContent = toHmFromMinutes(summary.recorded_minutes);
    $("today-running").textContent = toHmFromMinutes(summary.running_minutes);
    $("today-effective").textContent = toHmFromMinutes(summary.effective_minutes);
  
    const status = await timerApi.status(date);
    const running = !!status.running;
    $("start-btn").style.display = running ? "none" : "";
    $("stop-btn").style.display = running ? "" : "none";
  
    const intervals = await api.dayIntervals(date);
    const tBody = $("today-intervals-tbody");
    tBody.innerHTML = "";
  
    for (const it of intervals) {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${it.start_time || ""}</td>
        <td>${it.end_time || ""}</td>
        <td>${toHmFromMinutes(it.duration_minutes || 0)}</td>
        <td>${it.project_name || ""}</td>
        <td>${it.task_name || ""}</td>
        <td>${it.notes || ""}</td>
      `;
      tBody.appendChild(tr);
    }
  
    const breaks = await api.dayBreaks(date);
    const bBody = $("today-breaks-tbody");
    bBody.innerHTML = "";
  
    for (const br of breaks) {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${br.start_time || ""}</td>
        <td>${br.end_time || ""}</td>
        <td>${toHmFromMinutes(br.duration_minutes || 0)}</td>
        <td>${br.notes || ""}</td>
      `;
      bBody.appendChild(tr);
    }
  }
  
  function initTodayPanel() {
    $("start-btn").addEventListener("click", async () => {
      const date = todayISO();
      const projectVal = $("today-project").value;
      const taskVal = $("today-task").value;
      const notes = $("today-notes").value || null;
  
      await timerApi.start(
        date,
        projectVal ? Number(projectVal) : null,
        taskVal ? Number(taskVal) : null,
        notes
      );
  
      await refreshToday();
      await applyMonthOverview();
    });
  
    $("stop-btn").addEventListener("click", async () => {
      const date = todayISO();
      await timerApi.stop(date);
      await refreshToday();
      await applyMonthOverview();
    });
  
    $("add-break-btn").addEventListener("click", async () => {
      const date = todayISO();
      const s = $("break-start").value || null;
      const e = $("break-end").value || null;
      const d = $("break-duration").value ? Number($("break-duration").value) : null;
  
      try {
        await api.addBreak({ date, start_time: s, end_time: e, duration_minutes: d });
        $("break-start").value = "";
        $("break-end").value = "";
        $("break-duration").value = "";
  
        await refreshToday();
        await applyMonthOverview();
      } catch (err) {
        $("break-error").textContent = err.message;
      }
    });
  
    // Auto-refresh running time
    setInterval(refreshToday, 30000);
  }
  
  // === Export Buttons ==========================================
  
  function initExportButtons() {
    const getYM = () => {
      const y = Number($("year").value);
      const m = Number($("month").value);
      return { y, m };
    };
  
    $("btn-month-xlsx").addEventListener("click", () => {
      const { y, m } = getYM();
      openURL(`/api/export/month.xlsx?year=${y}&month=${m}`);
    });
  
    $("btn-month-days-csv").addEventListener("click", () => {
      const { y, m } = getYM();
      openURL(`/api/export/month/days.csv?year=${y}&month=${m}`);
    });
  
    $("btn-month-intervals-csv").addEventListener("click", () => {
      const { y, m } = getYM();
      openURL(`/api/export/month/intervals.csv?year=${y}&month=${m}`);
    });
  
    $("btn-month-breaks-csv").addEventListener("click", () => {
      const { y, m } = getYM();
      openURL(`/api/export/month/breaks.csv?year=${y}&month=${m}`);
    });
  
    $("btn-month-projects-csv").addEventListener("click", () => {
      const { y, m } = getYM();
      openURL(`/api/export/month/projects.csv?year=${y}&month=${m}`);
    });
  
    const expYear = $("export-year");
    if (!expYear.value) expYear.value = new Date().getFullYear();
  
    $("btn-year-xlsx").addEventListener("click", () => {
      const y = Number(expYear.value) || new Date().getFullYear();
      openURL(`/api/export/year.xlsx?year=${y}`);
    });
  }
  
  // === Initialization ==========================================
  
  async function initMonthControls() {
    const now = new Date();
    $("year").value = now.getFullYear();
    $("month").value = now.getMonth() + 1;
  
    $("prev-month").addEventListener("click", () => {
      let y = Number($("year").value);
      let m = Number($("month").value);
      m--;
      if (m < 1) {
        m = 12;
        y--;
      }
      $("year").value = y;
      $("month").value = m;
      applyMonthOverview();
    });
  
    $("next-month").addEventListener("click", () => {
      let y = Number($("year").value);
      let m = Number($("month").value);
      m++;
      if (m > 12) {
        m = 1;
        y++;
      }
      $("year").value = y;
      $("month").value = m;
      applyMonthOverview();
    });
  
    $("load-month").addEventListener("click", applyMonthOverview);
  }
  
  // Main init
  (async function init() {
    initHealth();
    await initMonthControls();
    await loadProjectsTasksToday();
    await applyMonthOverview();
    await refreshToday();
    initTodayPanel();
    initExportButtons();
  })();
  