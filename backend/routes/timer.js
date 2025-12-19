
// backend/routes/timer.js
import express from 'express';
import { db } from '../db.js';
import { computeRoundedDuration, parseHm, validateNoOverlapWork } from '../validators/time.js';

const router = express.Router();

async function getSingleUserId() {
  const row = await db.get('SELECT id FROM users LIMIT 1');
  return row?.id || 1;
}
function pad2(n) { return String(n).padStart(2, '0'); }
function nowHm() {
  const d = new Date();
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}
function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

// GET /api/timer/status
router.get('/status', async (req, res) => {
  const uid = await getSingleUserId();
  const date = req.query.date || todayISO();
  const now = new Date();

  const running = await db.get(
    `SELECT id, user_id, date, start_time, end_time, duration_minutes, project_id, task_id, notes
     FROM work_intervals WHERE user_id=? AND date=? AND end_time IS NULL
     ORDER BY start_time DESC LIMIT 1`, [uid, date]
  );

  let live_minutes = 0;
  if (running?.start_time) {
    const start = parseHm(running.start_time);
    if (start != null) {
      live_minutes = (now.getHours() * 60 + now.getMinutes()) - start;
      if (live_minutes < 0) live_minutes = 0;
    }
  }

  res.json({
    date,
    running: Boolean(running),
    interval: running || null,
    live_minutes,
    server_time: now.toISOString()
  });
});

// POST /api/timer/start (accepts project_id, task_id, notes)
router.post('/start', async (req, res) => {
  const uid = await getSingleUserId();
  const date = req.body?.date || todayISO();
  const start_time = req.body?.start_time || nowHm();

  const project_id = req.body?.project_id ?? null;
  const task_id = req.body?.task_id ?? null;
  const notes = req.body?.notes ?? null;

  const existing = await db.get(
    `SELECT id FROM work_intervals WHERE user_id=? AND date=? AND end_time IS NULL LIMIT 1`,
    [uid, date]
  );
  if (existing) return res.status(400).json({ error: 'An interval is already running for this date' });

  const info = await db.run(
    `INSERT INTO work_intervals (user_id, date, start_time, end_time, duration_minutes, project_id, task_id, notes)
     VALUES (?, ?, ?, NULL, NULL, ?, ?, ?)`,
    [uid, date, start_time, project_id, task_id, notes]
  );

  const row = await db.get(
    `SELECT wi.id, wi.user_id, wi.date, wi.start_time, wi.end_time, wi.duration_minutes,
            wi.project_id, p.name AS project_name,
            wi.task_id, t.name AS task_name, wi.notes
     FROM work_intervals wi
     LEFT JOIN projects p ON wi.project_id = p.id
     LEFT JOIN tasks t ON wi.task_id = t.id
     WHERE wi.id=?`,
    [info.lastID]
  );

  res.status(201).json(row);
});

// POST /api/timer/stop
router.post('/stop', async (req, res) => {
  const uid = await getSingleUserId();
  const date = req.body?.date || todayISO();
  const end_time = req.body?.end_time || nowHm();

  const running = await db.get(
    `SELECT * FROM work_intervals WHERE user_id=? AND date=? AND end_time IS NULL
     ORDER BY start_time DESC LIMIT 1`, [uid, date]
  );
  if (!running) return res.status(400).json({ error: 'No running interval to stop for this date' });

  const start_time = running.start_time;
  const duration = computeRoundedDuration({ start_time, end_time });
  if (!duration) return res.status(400).json({ error: 'Invalid duration (check start/end)' });

  const ov = await validateNoOverlapWork(db, {
    user_id: uid,
    date,
    start_time,
    end_time,
    excludeId: running.id
  });
  if (!ov.ok) return res.status(400).json({ error: ov.error });

  await db.run(
    `UPDATE work_intervals SET end_time=?, duration_minutes=? WHERE id=? AND user_id=?`,
    [end_time, duration, running.id, uid]
  );

  const row = await db.get(
    `SELECT id, user_id, date, start_time, end_time, duration_minutes FROM work_intervals WHERE id=?`,
    [running.id]
  );

  res.json(row);
});

export default router;
