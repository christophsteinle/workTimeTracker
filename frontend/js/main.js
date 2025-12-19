
// main.js — Orchestrate initialization
import { $ } from "./utils.js";
import { api } from "./api.js";
import { initMonthControls, applyMonthOverview } from "./month.js";
import { loadProjectsTasksToday, refreshToday, initTodayPanel } from "./today.js";
import { initExportButtons } from "./export.js";

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

(async function init() {
  initHealth();
  await initMonthControls();
  await loadProjectsTasksToday();
  await applyMonthOverview();
  await refreshToday();
  initTodayPanel(applyMonthOverview);
  initExportButtons();
})();
