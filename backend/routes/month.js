
// backend/routes/month.js
import express from 'express';
import { db } from '../db.js';
import { parseHm } from '../validators/time.js';

const router = express.Router();

async function getSingleUserId() {
  const row = await db.get('SELECT id FROM users LIMIT 1');
  return row?.id || 1;
}
function pad2(n) { return String(n).padStart(2, '0'); }
function iso(y, m, d) { return `${y}-${pad2(m)}-${pad2(d)}`; }
function daysInMonth(year, month) { return new Date(year, month, 0).getDate(); }
function listMonthDates(year, month) { return Array.from({ length: daysInMonth(year, month) }, (_, i) => iso(year, month, i + 1)); }
function weekdayIndex(isoDate) { return new Date(isoDate + 'T00:00:00').getDay(); }
function isWorkingDay(isoDate) { const w = weekdayIndex(isoDate); return w >= 1 && w <= 5; }
function prevDate(isoDate) { const d = new Date(isoDate + 'T00:00:00'); d.setDate(d.getDate() - 1); return d.toISOString().slice(0, 10); }

async function fetchAggregatesByDate(userId, startDate, endDate) {
  const workRows = await db.all(
    `SELECT date, SUM(duration_minutes) AS work_minutes, MIN(start_time) AS first_start, MAX(end_time) AS last_end
     FROM work_intervals WHERE user_id=? AND date >= ? AND date <= ? GROUP BY date`,
    [userId, startDate, endDate]
  );
  const breakRows = await db.all(
    `SELECT date, SUM(duration_minutes) AS break_minutes
     FROM breaks WHERE user_id=? AND date >= ? AND date <= ? GROUP BY date`,
    [userId, startDate, endDate]
  );

  const workByDate = new Map(workRows.map(r => [r.date, {
    work_minutes: Number(r.work_minutes || 0),
    first_start: r.first_start || null,
    last_end: r.last_end || null
  }]));
  const breaksByDate = new Map(breakRows.map(r => [r.date, Number(r.break_minutes || 0)]));

  return { workByDate, breaksByDate };
}

async function computeMonthOverview(userId, year, month) {
  const dates = listMonthDates(year, month);
  if (dates.length === 0) {
    return { year, month, days: [], totals: { working_days: 0, must_minutes: 0, work_minutes: 0, break_minutes: 0, recorded_minutes: 0 } };
  }
  const monthStart = dates[0];
  const monthEnd = dates[dates.length - 1];
  const prevOfStart = prevDate(monthStart);

  const settings = await db.get('SELECT target_hours_per_day AS h FROM settings WHERE id=1');
  const targetPerDay = (settings?.h ?? 8) * 60;

  const { workByDate, breaksByDate } = await fetchAggregatesByDate(userId, prevOfStart, monthEnd);

  const days = [];
  let workingDaysCount = 0, totalWork = 0, totalBreaks = 0, totalRecorded = 0;

  for (let i = 0; i < dates.length; i++) {
    const d = dates[i];
    const wd = isWorkingDay(d);
    if (wd) workingDaysCount++;

    const work = workByDate.get(d)?.work_minutes || 0;
    const brk = breaksByDate.get(d) || 0;
    const recorded = Math.max(work - brk, 0);

    const warnings = [];
    const prev = i === 0 ? prevOfStart : dates[i - 1];
    const prevLastEnd = workByDate.get(prev)?.last_end || null;
    const todayFirstStart = workByDate.get(d)?.first_start || null;
    if (prevLastEnd && todayFirstStart) {
      const pe = parseHm(prevLastEnd);
      const ts = parseHm(todayFirstStart);
      if (pe != null && ts != null) {
        const restMinutes = ts + (24 * 60 - pe);
        if (restMinutes < 11 * 60) {
          const h = Math.floor(restMinutes / 60);
          const m = restMinutes % 60;
          warnings.push(`11-hour rest rule not met: only ${h}h ${m}m`);
        }
      }
    }

    days.push({
      date: d,
      weekday: weekdayIndex(d),
      working_day: wd,
      work_minutes: work,
      break_minutes: brk,
      recorded_minutes: recorded,
      first_start: workByDate.get(d)?.first_start || null,
      last_end: workByDate.get(d)?.last_end || null,
      warnings
    });

    totalWork += work; totalBreaks += brk; totalRecorded += recorded;
  }

  return {
    year, month, days,
    totals: {
      working_days: workingDaysCount,
      must_minutes: workingDaysCount * targetPerDay,
      work_minutes: totalWork,
      break_minutes: totalBreaks,
      recorded_minutes: totalRecorded
    }
  };
}

async function computeMonthProjects(userId, year, month) {
  const start = iso(year, month, 1);
  const end = iso(year, month, daysInMonth(year, month));
  const rows = await db.all(
    `SELECT wi.project_id, COALESCE(p.name, 'Unassigned') AS project_name, SUM(wi.duration_minutes) AS minutes
     FROM work_intervals wi LEFT JOIN projects p ON wi.project_id = p.id
     WHERE wi.user_id=? AND wi.date >= ? AND wi.date <= ?
     GROUP BY wi.project_id, p.name ORDER BY minutes DESC, project_name ASC`,
    [userId, start, end]
  );
  return rows.map(r => ({
    project_id: r.project_id ?? null,
    project_name: r.project_name,
    minutes: Number(r.minutes || 0)
  }));
}

router.get('/month/:year/:month/overview', async (req, res) => {
  const year = Number(req.params.year);
  const month = Number(req.params.month);
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    return res.status(400).json({ error: 'Invalid year or month' });
  }
  const uid = await getSingleUserId();
  const overview = await computeMonthOverview(uid, year, month);
  res.json(overview);
});

router.get('/month/:year/:month/projects', async (req, res) => {
  const year = Number(req.params.year);
  const month = Number(req.params.month);
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    return res.status(400).json({ error: 'Invalid year or month' });
  }
  const uid = await getSingleUserId();
  const data = await computeMonthProjects(uid, year, month);
  res.json({ year, month, projects: data });
});

router.get('/year/:year/summary', async (req, res) => {
  const year = Number(req.params.year);
  if (!Number.isInteger(year) || year < 1970 || year > 9999) {
    return res.status(400).json({ error: 'Invalid year' });
  }
  const uid = await getSingleUserId();

  const months = [];
  const settings = await db.get('SELECT target_hours_per_day AS h FROM settings WHERE id=1');
  const targetPerDay = (settings?.h ?? 8) * 60;

  for (let m = 1; m <= 12; m++) {
    const overview = await computeMonthOverview(uid, year, m);
    const perProject = await computeMonthProjects(uid, year, m);
    months.push({
      month: m,
      working_days: overview.totals.working_days,
      must_minutes: overview.totals.must_minutes,
      recorded_minutes: overview.totals.recorded_minutes,
      projects: perProject
    });
  }
  res.json({ year, months });
});

export default router;
