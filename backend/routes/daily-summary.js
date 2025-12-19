
// backend/routes/daily-summary.js
import express from 'express';
import { db } from '../db.js';
import { parseHm } from '../validators/time.js';

const router = express.Router();

async function getSingleUserId() {
  const row = await db.get('SELECT id FROM users LIMIT 1');
  return row?.id || 1;
}
function addDays(iso, delta) {
  const d = new Date(iso + 'T00:00:00');
  d.setDate(d.getDate() + delta);
  return d.toISOString().slice(0, 10);
}

router.get('/', async (req, res) => {
  const { date } = req.query;
  if (!date) return res.status(400).json({ error: 'date is required (YYYY-MM-DD)' });

  const uid = await getSingleUserId();
  const now = new Date();

  const work = await db.all(
    `SELECT duration_minutes, start_time, end_time FROM work_intervals WHERE user_id=? AND date=?`,
    [uid, date]
  );
  const brks = await db.all(
    `SELECT duration_minutes, start_time, end_time FROM breaks WHERE user_id=? AND date=?`,
    [uid, date]
  );

  const work_minutes = work.reduce((sum, r) => sum + (r.duration_minutes || 0), 0);
  const break_minutes = brks.reduce((sum, r) => sum + (r.duration_minutes || 0), 0);
  const recorded_minutes = Math.max(work_minutes - break_minutes, 0);

  const running = await db.get(
    `SELECT start_time FROM work_intervals WHERE user_id=? AND date=? AND end_time IS NULL
     ORDER BY start_time DESC LIMIT 1`, [uid, date]
  );
  let running_minutes = 0;
  if (running?.start_time) {
    const s = parseHm(running.start_time);
    if (s != null) {
      running_minutes = (now.getHours() * 60 + now.getMinutes()) - s;
      if (running_minutes < 0) running_minutes = 0;
    }
  }

  const prevDate = addDays(date, -1);
  const prevDayLastEndRow = await db.get(
    `SELECT end_time FROM work_intervals WHERE user_id=? AND date=? ORDER BY end_time DESC LIMIT 1`,
    [uid, prevDate]
  );
  const currDayFirstStartRow = await db.get(
    `SELECT start_time FROM work_intervals WHERE user_id=? AND date=? ORDER BY start_time ASC LIMIT 1`,
    [uid, date]
  );

  const warnings = [];
  if (prevDayLastEndRow?.end_time && currDayFirstStartRow?.start_time) {
    const prevEnd = parseHm(prevDayLastEndRow.end_time);
    const currStart = parseHm(currDayFirstStartRow.start_time);
    if (prevEnd != null && currStart != null) {
      const restMinutes = currStart + (24 * 60 - prevEnd);
      if (restMinutes < 11 * 60) {
        const h = Math.floor(restMinutes / 60);
        const m = restMinutes % 60;
        warnings.push(`11-hour rest rule not met: only ${h}h ${m}m`);
      }
    }
  }

  res.json({
    date,
    work_minutes,
    break_minutes,
    recorded_minutes,
    running_minutes,
    effective_minutes: recorded_minutes + running_minutes,
    warnings,
    server_time: now.toISOString()
  });
});

export default router;
