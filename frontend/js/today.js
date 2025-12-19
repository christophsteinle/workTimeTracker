
// today.js — Today panel: timer, project/task selection, breaks
import { $, todayISO, toHmFromMinutes } from "./utils.js";
import { api, timerApi, projectsApi } from "./api.js";

export async function loadProjectsTasksToday() {
  const projects = await projectsApi.listProjects();
  const projSel = $("today-project");
  projSel.innerHTML = `<option value="">— Unassigned —</option>`;

  for (const p of projects) {
    const o = document.createElement("option");
    o.value = p.id;
    o.textContent = p.name;
    projSel.appendChild(o);
  }

  projSel.addEventListener("change", loadTasksToday);
  await loadTasksToday();
}

export async function loadTasksToday() {
  const pid = $("today-project").value || null;
  const tasks = await projectsApi.listTasks(pid);
  const taskSel = $("today-task");
  taskSel.innerHTML = `<option value="">— Unassigned —</option>`;

  for (const t of tasks) {
    const o = document.createElement("option");
    o.value = t.id;
    o.textContent = t.name;
    taskSel.appendChild(o);
  }
}

export async function refreshToday() {
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

export function initTodayPanel(applyMonthOverview) {
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
