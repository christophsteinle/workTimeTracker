
// backend/routes/work-intervals.js
import express from 'express';
import { db } from '../db.js';
import { computeRoundedDuration, validateNoOverlapWork } from '../validators/time.js';

const router = express.Router();

async function getSingleUserId() {
  const row = await db.get('SELECT id FROM users LIMIT 1');
  return row?.id || 1;
}

function hydrate(row) {
  return {
    id: row.id,
    date: row.date,
    start_time: row.start_time,
    end_time: row.end_time,
    duration_minutes: row.duration_minutes,
    project_id: row.project_id,
    project_name: row.project_name ?? null,
    task_id: row.task_id,
    task_name: row.task_name ?? null,
    notes: row.notes ?? null
  };
}

router.get('/', async (req, res) => {
  const { date } = req.query;
  const uid = await getSingleUserId();
  let rows;

  if (date) {
    rows = await db.all(
      `SELECT wi.*, p.name AS project_name, t.name AS task_name
       FROM work_intervals wi
       LEFT JOIN projects p ON wi.project_id = p.id
       LEFT JOIN tasks t ON wi.task_id = t.id
       WHERE wi.user_id=? AND wi.date=?
       ORDER BY wi.start_time`, [uid, date]);
  } else {
    rows = await db.all(
      `SELECT wi.*, p.name AS project_name, t.name AS task_name
       FROM work_intervals wi
       LEFT JOIN projects p ON wi.project_id = p.id
       LEFT JOIN tasks t ON wi.task_id = t.id
       WHERE wi.user_id=?
       ORDER BY wi.date DESC, wi.start_time
       LIMIT 200`, [uid]);
  }
  res.json(rows.map(hydrate));
});

router.post('/', async (req, res) => {
  const uid = await getSingleUserId();
  const { date, start_time, end_time, project_id = null, task_id = null, notes = null } = req.body || {};
  if (!date) return res.status(400).json({ error: 'date is required (YYYY-MM-DD)' });
  if (!start_time || !end_time) return res.status(400).json({ error: 'start_time and end_time are required (HH:mm)' });

  const duration = computeRoundedDuration({ start_time, end_time });
  if (!duration) return res.status(400).json({ error: 'Invalid or zero duration' });

  const ov = await validateNoOverlapWork(db, { user_id: uid, date, start_time, end_time });
  if (!ov.ok) return res.status(400).json({ error: ov.error });

  const info = await db.run(
    `INSERT INTO work_intervals (user_id, date, start_time, end_time, duration_minutes, project_id, task_id, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [uid, date, start_time, end_time, duration, project_id, task_id, notes]
  );

  const row = await db.get(
    `SELECT wi.*, p.name AS project_name, t.name AS task_name
     FROM work_intervals wi
     LEFT JOIN projects p ON wi.project_id = p.id
     LEFT JOIN tasks t ON wi.task_id = t.id
     WHERE wi.id=?`, [info.lastID]);

  res.status(201).json(hydrate(row));
});

router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const uid = await getSingleUserId();

  const existing = await db.get('SELECT * FROM work_intervals WHERE id=? AND user_id=?', [id, uid]);
  if (!existing) return res.status(404).json({ error: 'Not found' });

  const {
    date = existing.date,
    start_time = existing.start_time,
    end_time = existing.end_time,
    project_id = existing.project_id,
    task_id = existing.task_id,
    notes = existing.notes
  } = req.body || {};

  const duration = computeRoundedDuration({ start_time, end_time });
  if (!duration) return res.status(400).json({ error: 'Invalid or zero duration' });

  const ov = await validateNoOverlapWork(db, { user_id: uid, date, start_time, end_time, excludeId: Number(id) });
  if (!ov.ok) return res.status(400).json({ error: ov.error });

  await db.run(
    `UPDATE work_intervals
     SET date=?, start_time=?, end_time=?, duration_minutes=?, project_id=?, task_id=?, notes=?
     WHERE id=? AND user_id=?`,
    [date, start_time, end_time, duration, project_id, task_id, notes, id, uid]
  );

  const row = await db.get(
    `SELECT wi.*, p.name AS project_name, t.name AS task_name
     FROM work_intervals wi
     LEFT JOIN projects p ON wi.project_id = p.id
     LEFT JOIN tasks t ON wi.task_id = t.id
     WHERE wi.id=?`, [id]);

  res.json(hydrate(row));
});

router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  const uid = await getSingleUserId();
  const info = await db.run('DELETE FROM work_intervals WHERE id=? AND user_id=?', [id, uid]);
  if (info.changes === 0) return res.status(404).json({ error: 'Not found' });
  res.status(204).end();
});

export default router;
