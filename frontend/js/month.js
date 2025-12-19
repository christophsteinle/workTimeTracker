
// month.js — Month overview + expand day + inline edit
import { $, toHmFromMinutes, weekdayName, monthName } from "./utils.js";
import { api } from "./api.js";

/** Render top stats row for the selected month */
export function renderMonthStats(totals, year, month) {
  $("month-stats").innerHTML = `
    <div class="stat">
      <div class="label">Month</div>
      <div class="value">${monthName(month)} ${year}</div>
    </div>
    <div class="stat">
      <div class="label">Working Days (Mon–Fri)</div>
      <div class="value">${totals.working_days}</div>
    </div>
    <div class="stat">
      <div class="label">Must Hours</div>
      <div class="value">${toHmFromMinutes(totals.must_minutes)}</div>
    </div>
    <div class="stat">
      <div class="label">Recorded</div>
      <div class="value">${toHmFromMinutes(totals.recorded_minutes)}</div>
    </div>
    <div class="stat">
      <div class="label">Work</div>
      <div class="value">${toHmFromMinutes(totals.work_minutes)}</div>
    </div>
    <div class="stat">
      <div class="label">Breaks</div>
      <div class="value">${toHmFromMinutes(totals.break_minutes)}</div>
    </div>
  `;
}

/** Render the month table and wire expandable day rows */
function renderMonthTable(overview) {
  const tbody = $("month-table").querySelector("tbody");
  tbody.innerHTML = "";

  for (const day of overview.days) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><strong>${day.date}</strong></td>
      <td>${weekdayName(day.weekday)}${day.working_day ? "" : ' <span class="badge">Non-working</span>'}</td>
      <td class="time">${toHmFromMinutes(day.work_minutes)}</td>
      <td class="time">${toHmFromMinutes(day.break_minutes)}</td>
      <td class="time">${toHmFromMinutes(day.recorded_minutes)}</td>
      <td class="time">${day.first_start ?? ""}</td>
      <td class="time">${day.last_end ?? ""}</td>
      <td>
        ${
          day.warnings?.length
            ? day.warnings.map(w => `<span class="badge warn">${w}</span>`).join(" ")
            : '<span class="badge ok">OK</span>'
        }
      </td>
      <td>
        expandExpand</button>
      </td>
    `;
    tbody.appendChild(tr);

    // Detail row (hidden initially)
    const trDetail = document.createElement("tr");
    trDetail.style.display = "none";
    trDetail.dataset.detailFor = day.date;

    const tdDetail = document.createElement("td");
    tdDetail.colSpan = 9;
    tdDetail.innerHTML = `
      <div class="day-detail">
        <div class="detail-columns">
          <!-- Intervals list -->
          <div class="list" data-kind="intervals">
            <h4>Work intervals</h4>
            <div data-list="intervals"></div>
            <div class="row" style="margin-top:.5rem;">
              <input type="time" data-field="start_time" placeholder="Start">
              <input type="time" data-field="end_time" placeholder="End">
              <input type="text" data-field="notes" placeholder="Notes">
              <div class="actions">
                add-intervalAdd interval</button>
              </div>
            </div>
            <div class="error" data-error="interval"></div>
          </div>

          <!-- Breaks list -->
          <div class="list" data-kind="breaks">
            <h4>Breaks</h4>
            <div data-list="breaks"></div>
            <div class="row" style="margin-top:.5rem;">
              <input type="time" data-field="break_start" placeholder="Start">
              <input type="time" data-field="break_end" placeholder="End">
              <input type="number" min="1" data-field="break_duration" placeholder="Or duration (min)">
              <input type="text" data-field="break_notes" placeholder="Notes">
              <div class="actions">
                add-breakAdd break</button>
              </div>
            </div>
            <div class="error" data-error="break"></div>
          </div>
        </div>
      </div>
    `;
    trDetail.appendChild(tdDetail);
    tbody.appendChild(trDetail);
  }

  // Delegate button handling for expand/add interval/add break
  tbody.onclick = async (ev) => {
    const btn = ev.target.closest("button");
    if (!btn) return;

    const action = btn.dataset.action;
    const date = btn.dataset.date;
    const trDetail = [...tbody.querySelectorAll("tr")].find(tr => tr.dataset.detailFor === date);
    if (!action || !trDetail) return;

    // Expand/collapse & load details on demand
    if (action === "expand") {
      const isHidden = trDetail.style.display === "none";
      trDetail.style.display = isHidden ? "" : "none";
      if (isHidden) {
        await loadDayDetails(trDetail, date);
      }
      return;
    }

    // Add interval
    if (action === "add-interval") {
      const wrap = trDetail.querySelector('[data-kind="intervals"]');
      const start_time = wrap.querySelector('[data-field="start_time"]').value || null;
      const end_time = wrap.querySelector('[data-field="end_time"]').value || null;
      const notes = wrap.querySelector('[data-field="notes"]').value || null;
      const errEl = wrap.querySelector('[data-error="interval"]');
      errEl.textContent = "";

      try {
        await api.addInterval({ date, start_time, end_time, notes });
        wrap.querySelector('[data-field="start_time"]').value = "";
        wrap.querySelector('[data-field="end_time"]').value = "";
        wrap.querySelector('[data-field="notes"]').value = "";
        await loadDayDetails(trDetail, date);
        await loadMonthTotalsOnly();
      } catch (e) {
        errEl.textContent = e.message;
      }
      return;
    }

    // Add break
    if (action === "add-break") {
      const wrap = trDetail.querySelector('[data-kind="breaks"]');
      const start_time = wrap.querySelector('[data-field="break_start"]').value || null;
      const end_time = wrap.querySelector('[data-field="break_end"]').value || null;
      const durationRaw = wrap.querySelector('[data-field="break_duration"]').value || null;
      const duration_minutes = durationRaw ? Number(durationRaw) : undefined;
      const notes = wrap.querySelector('[data-field="break_notes"]').value || null;
      const errEl = wrap.querySelector('[data-error="break"]');
      errEl.textContent = "";

      try {
        await api.addBreak({ date, start_time, end_time, duration_minutes, notes });
        wrap.querySelector('[data-field="break_start"]').value = "";
        wrap.querySelector('[data-field="break_end"]').value = "";
        wrap.querySelector('[data-field="break_duration"]').value = "";
        wrap.querySelector('[data-field="break_notes"]').value = "";
        await loadDayDetails(trDetail, date);
        await loadMonthTotalsOnly();
      } catch (e) {
        errEl.textContent = e.message;
      }
    }
  };
}

/** Refresh only totals quickly (used after mutations) */
export async function loadMonthTotalsOnly() {
  const y = Number($("year").value);
  const m = Number($("month").value);
  const overview = await api.monthOverview(y, m);
  renderMonthStats(overview.totals, y, m);
}

/** Load month overview and render table */
export async function applyMonthOverview() {
  const y = Number($("year").value);
  const m = Number($("month").value);
  const overview = await api.monthOverview(y, m);
  renderMonthStats(overview.totals, y, m);
  renderMonthTable(overview);
}

/** Load expanded day details (intervals + breaks) and wire inline edit/delete */
export async function loadDayDetails(trDetail, date) {
  const intervals = await api.dayIntervals(date);
  const breaks = await api.dayBreaks(date);

  // Intervals list
  const intervalsList = trDetail.querySelector('[data-list="intervals"]');
  intervalsList.innerHTML = "";
  for (const it of intervals) {
    const row = document.createElement("div");
    row.className = "row";
    row.innerHTML = `
      <input class="time" type="time" value="${it.start_time ?? ""}" data-field="start" />
      <input class="time" type="time" value="${it.end_time ?? ""}" data-field="end" />
      <span class="time">${toHmFromMinutes(it.duration_minutes || 0)}</span>
      <input type="text" value="${it.notes ?? ""}" data-field="notes" />
      <div class="actions">
        save-intervalSave</button>
        del-intervalDelete</button>
      </div>
    `;
    intervalsList.appendChild(row);
  }

  // Breaks list
  const breaksList = trDetail.querySelector('[data-list="breaks"]');
  breaksList.innerHTML = "";
  for (const br of breaks) {
    const row = document.createElement("div");
    row.className = "row";
    row.innerHTML = `
      <input class="time" type="time" value="${br.start_time ?? ""}" data-field="start" />
      <input class="time" type="time" value="${br.end_time ?? ""}" data-field="end" />
      <span class="time">${br.duration_minutes ? toHmFromMinutes(br.duration_minutes) : ""}</span>
      <input type="text" value="${br.notes ?? ""}" data-field="notes" />
      <div class="actions">
        save-breakSave</button>
        del-breakDelete</button>
      </div>
    `;
    breaksList.appendChild(row);
  }

  // Inline actions inside this detail panel
  trDetail.onclick = async (ev) => {
    const btn = ev.target.closest("button");
    if (!btn) return;

    const action = btn.dataset.action;
    const id = btn.dataset.id;
    const d = btn.dataset.date;
    const rowEl = btn.closest(".row");
    if (!action || !rowEl) return;

    if (action === "save-interval") {
      const start_time = rowEl.querySelector('[data-field="start"]').value || null;
      const end_time = rowEl.querySelector('[data-field="end"]').value || null;
      const notes = rowEl.querySelector('[data-field="notes"]').value || null;
      try {
        await api.updateInterval(id, { date: d, start_time, end_time, notes });
        await loadDayDetails(trDetail, d);
        await loadMonthTotalsOnly();
      } catch (e) {
        alert(e.message);
      }
      return;
    }

    if (action === "del-interval") {
      if (!confirm("Delete this interval?")) return;
      await api.deleteInterval(id);
      await loadDayDetails(trDetail, d);
      await loadMonthTotalsOnly();
      return;
    }

    if (action === "save-break") {
      const start_time = rowEl.querySelector('[data-field="start"]').value || null;
      const end_time = rowEl.querySelector('[data-field="end"]').value || null;
      const notes = rowEl.querySelector('[data-field="notes"]').value || null;
      try {
        await api.updateBreak(id, { date: d, start_time, end_time, notes });
        await loadDayDetails(trDetail, d);
        await loadMonthTotalsOnly();
      } catch (e) {
        alert(e.message);
      }
      return;
    }

    if (action === "del-break") {
      if (!confirm("Delete this break?")) return;
      await api.deleteBreak(id);
      await loadDayDetails(trDetail, d);
      await loadMonthTotalsOnly();
    }
  };
}

/** Bind month controls: prev/next & load */
export async function initMonthControls() {
  const now = new Date();
  $("year").value = now.getFullYear();
  $("month").value = now.getMonth() + 1;

  $("prev-month").addEventListener("click", async () => {
    let y = Number($("year").value);
    let m = Number($("month").value);
    m -= 1;
    if (m < 1) {
      m = 12;
      y -= 1;
    }
    $("year").value = y;
    $("month").value = m;
    await applyMonthOverview();
  });

  $("next-month").addEventListener("click", async () => {
    let y = Number($("year").value);
    let m = Number($("month").value);
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
    $("year").value = y;
    $("month").value = m;
    await applyMonthOverview();
  });

  $("load-month").addEventListener("click", applyMonthOverview);
}
