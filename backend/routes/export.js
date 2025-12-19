
// backend/routes/export.js
import express from 'express';
import * as XLSX from 'xlsx';
import { db } from '../db.js';

const router = express.Router();

async function getSingleUserId() {
  const row = await db.get('SELECT id FROM users LIMIT 1');
  return row?.id || 1;
}
function pad2(n) { return String(n).padStart(2, '0'); }
function iso(y, m, d) { return `${y}-${pad2(m)}-${pad2(d)}`; }
function daysInMonth(year, month) { return new Date(year, month, 0).getDate(); }
function monthRange(year, month) { return { start: iso(year, month, 1), end: iso(year, month, daysInMonth(year, month)) }; }
function weekdayIndex(isoDate) { return new Date(isoDate + 'T00:00:00').getDay(); }
function isWorkingDay(isoDate) { const w = weekdayIndex(isoDate); return w >= 1 && w <= 5; }

function csvEscape(v) {
  if (v === null || v === undefined) return '';
  const s = String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}
function toCSV(columns, rows) {
  const header = columns.map(c => csvEscape(c.header)).join(',') + '\n';
  const body = rows.map(r => columns.map(c => csvEscape(r[c.key])).join(',')).join('\n');
  return '\uFEFF' + header + body + '\n';
}

async function fetchMonthDaysOverview(userId, year, month) {
  const { start, end } = monthRange(year, month);
  const dates = Array.from({ length: daysInMonth(year, month) }, (_, i) => iso(year, month, i + 1));

  const workRows = await db.all(
    `SELECT date, SUM(duration_minutes) AS work_minutes, MIN(start_time) AS first_start, MAX(end_time) AS last_end
     FROM work_intervals WHERE user_id=? AND date >= ? AND date <= ? GROUP BY date`,
    [userId, start, end]
  );
  const breakRows = await db.all(
    `SELECT date, SUM(duration_minutes) AS break_minutes
     FROM breaks WHERE user_id=? AND date >= ? AND date <= ? GROUP BY date`,
    [userId, start, end]
  );

  const workByDate = new Map(workRows.map(r => [r.date, {
    work_minutes: Number(r.work_minutes || 0),
    first_start: r.first_start || '',
    last_end: r.last_end || ''
  }]));
  const breaksByDate = new Map(breakRows.map(r => [r.date, Number(r.break_minutes || 0)]));

  return dates.map(d => {
    const work = workByDate.get(d)?.work_minutes || 0;
    const brk = breaksByDate.get(d) || 0;
    return {
      date: d,
      weekday: weekdayIndex(d),
      working_day: isWorkingDay(d) ? 1 : 0,
      work_minutes: work,
      break_minutes: brk,
      recorded_minutes: Math.max(work - brk, 0),
      first_start: workByDate.get(d)?.first_start || '',
      last_end: workByDate.get(d)?.last_end || ''
    };
  });
}

async function fetchMonthIntervals(userId, year, month) {
  const { start, end } = monthRange(year, month);
  const rows = await db.all(
    `SELECT wi.id, wi.date, wi.start_time, wi.end_time, wi.duration_minutes,
            wi.project_id, p.name AS project_name,
            wi.task_id, t.name AS task_name, wi.notes
     FROM work_intervals wi
     LEFT JOIN projects p ON wi.project_id = p.id
     LEFT JOIN tasks t ON wi.task_id = t.id
     WHERE wi.user_id=? AND wi.date >= ? AND wi.date <= ?
     ORDER BY wi.date, wi.start_time IS NULL, wi.start_time, wi.id`,
    [userId, start, end]
  );
  return rows.map(r => ({
    id: r.id,
    date: r.date,
    start_time: r.start_time ?? '',
    end_time: r.end_time ?? '',
    duration_minutes: Number(r.duration_minutes || 0),
    project_id: r.project_id ?? '',
    project_name: r.project_name ?? 'Unassigned',
    task_id: r.task_id ?? '',
    task_name: r.task_name ?? '',
    notes: r.notes ?? ''
  }));
}

async function fetchMonthBreaks(userId, year, month) {
  const { start, end } = monthRange(year, month);
  const rows = await db.all(
    `SELECT id, date, start_time, end_time, duration_minutes, notes
     FROM breaks WHERE user_id=? AND date >= ? AND date <= ?
     ORDER BY date, start_time IS NULL, start_time, id`,
    [userId, start, end]
  );
  return rows.map(r => ({
    id: r.id,
    date: r.date,
    start_time: r.start_time ?? '',
    end_time: r.end_time ?? '',
    duration_minutes: Number(r.duration_minutes || 0),
    notes: r.notes ?? ''
  }));
}

async function fetchMonthProjects(userId, year, month) {
  const { start, end } = monthRange(year, month);
  const rows = await db.all(
    `SELECT wi.project_id, COALESCE(p.name, 'Unassigned') AS project_name, SUM(wi.duration_minutes) AS minutes
     FROM work_intervals wi LEFT JOIN projects p ON wi.project_id = p.id
     WHERE wi.user_id=? AND wi.date >= ? AND wi.date <= ?
     GROUP BY wi.project_id, p.name ORDER BY minutes DESC, project_name ASC`,
    [userId, start, end]
  );
  return rows.map(r => ({
    project_id: r.project_id ?? '',
    project_name: r.project_name,
    minutes: Number(r.minutes || 0),
    hours: Number((Number(r.minutes || 0) / 60).toFixed(2))
  }));
}

async function fetchYearSummary(userId, year) {
  const months = [];
  const settings = await db.get('SELECT target_hours_per_day AS h FROM settings WHERE id=1');
  const targetPerDay = (settings?.h ?? 8) * 60;

  for (let m = 1; m <= 12; m++) {
    const days = await fetchMonthDaysOverview(userId, year, m);
    const workingDays = days.filter(d => d.working_day).length;
    const must = workingDays * targetPerDay;
    const recorded = days.reduce((acc, d) => acc + d.recorded_minutes, 0);
    months.push({ month: m, working_days: workingDays, must_minutes: must, recorded_minutes: recorded });
  }
  return months;
}

async function fetchYearProjects(userId, year) {
  const start = iso(year, 1, 1);
  const end = iso(year, 12, 31);
  const rows = await db.all(
    `SELECT wi.project_id, COALESCE(p.name, 'Unassigned') AS project_name, SUM(wi.duration_minutes) AS minutes
     FROM work_intervals wi LEFT JOIN projects p ON wi.project_id = p.id
     WHERE wi.user_id=? AND wi.date >= ? AND wi.date <= ?
     GROUP BY wi.project_id, p.name ORDER BY minutes DESC, project_name ASC`,
    [userId, start, end]
  );
  return rows.map(r => ({
    project_id: r.project_id ?? '',
    project_name: r.project_name,
    minutes: Number(r.minutes || 0),
    hours: Number((Number(r.minutes || 0) / 60).toFixed(2))
  }));
}

// CSV endpoints
router.get('/month/days.csv', async (req, res) => {
  const year = Number(req.query.year), month = Number(req.query.month);
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) return res.status(400).json({ error: 'Invalid year or month' });

  const uid = await getSingleUserId();
  const rows = await fetchMonthDaysOverview(uid, year, month);
  const columns = [
    { key: 'date', header: 'Date' },
    { key: 'weekday', header: 'Weekday(0=Sun..6=Sat)' },
    { key: 'working_day', header: 'WorkingDay(1/0)' },
    { key: 'work_minutes', header: 'WorkMinutes' },
    { key: 'break_minutes', header: 'BreakMinutes' },
    { key: 'recorded_minutes', header: 'RecordedMinutes' },
    { key: 'first_start', header: 'FirstStart' },
    { key: 'last_end', header: 'LastEnd' }
  ];
  const csv = toCSV(columns, rows);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="timetracker_${year}-${pad2(month)}_days.csv"`);
  res.send(csv);
});

router.get('/month/intervals.csv', async (req, res) => {
  const year = Number(req.query.year), month = Number(req.query.month);
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) return res.status(400).json({ error: 'Invalid year or month' });

  const uid = await getSingleUserId();
  const rows = await fetchMonthIntervals(uid, year, month);
  const columns = [
    { key: 'id', header: 'Id' }, { key: 'date', header: 'Date' },
    { key: 'start_time', header: 'Start' }, { key: 'end_time', header: 'End' },
    { key: 'duration_minutes', header: 'DurationMinutes' },
    { key: 'project_id', header: 'ProjectId' }, { key: 'project_name', header: 'Project' },
    { key: 'task_id', header: 'TaskId' }, { key: 'task_name', header: 'Task' }, { key: 'notes', header: 'Notes' }
  ];
  const csv = toCSV(columns, rows);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="timetracker_${year}-${pad2(month)}_intervals.csv"`);
  res.send(csv);
});

router.get('/month/breaks.csv', async (req, res) => {
  const year = Number(req.query.year), month = Number(req.query.month);
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) return res.status(400).json({ error: 'Invalid year or month' });

  const uid = await getSingleUserId();
  const rows = await fetchMonthBreaks(uid, year, month);
  const columns = [
    { key: 'id', header: 'Id' }, { key: 'date', header: 'Date' },
    { key: 'start_time', header: 'Start' }, { key: 'end_time', header: 'End' },
    { key: 'duration_minutes', header: 'DurationMinutes' }, { key: 'notes', header: 'Notes' }
  ];
  const csv = toCSV(columns, rows);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="timetracker_${year}-${pad2(month)}_breaks.csv"`);
  res.send(csv);
});

router.get('/month/projects.csv', async (req, res) => {
  const year = Number(req.query.year), month = Number(req.query.month);
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) return res.status(400).json({ error: 'Invalid year or month' });

  const uid = await getSingleUserId();
  const rows = await fetchMonthProjects(uid, year, month);
  const columns = [
    { key: 'project_id', header: 'ProjectId' },
    { key: 'project_name', header: 'Project' },
    { key: 'minutes', header: 'Minutes' },
    { key: 'hours', header: 'Hours' }
  ];
  const csv = toCSV(columns, rows);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="timetracker_${year}-${pad2(month)}_projects.csv"`);
  res.send(csv);
});

// XLSX endpoints
router.get('/month.xlsx', async (req, res) => {
  const year = Number(req.query.year), month = Number(req.query.month);
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) return res.status(400).json({ error: 'Invalid year or month' });

  const uid = await getSingleUserId();
  const days = await fetchMonthDaysOverview(uid, year, month);
  const intervals = await fetchMonthIntervals(uid, year, month);
  const breaks = await fetchMonthBreaks(uid, year, month);
  const projects = await fetchMonthProjects(uid, year, month);

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(days), 'Days');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(intervals), 'Intervals');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(breaks), 'Breaks');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(projects), 'Projects');

  const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' });
  res.setHeader('Content-Disposition', `attachment; filename="timetracker_${year}-${pad2(month)}.xlsx"`);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.send(buf);
});

router.get('/year.xlsx', async (req, res) => {
  const year = Number(req.query.year);
  if (!Number.isInteger(year) || year < 1970 || year > 9999) return res.status(400).json({ error: 'Invalid year' });

  const uid = await getSingleUserId();
  const months = await fetchYearSummary(uid, year);
  const projectsYear = await fetchYearProjects(uid, year);

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(months), 'Months');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(projectsYear), 'Projects');

  const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' });
  res.setHeader('Content-Disposition', `attachment; filename="timetracker_${year}.xlsx"`);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.send(buf);
});

export default router;
