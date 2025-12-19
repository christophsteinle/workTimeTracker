
// backend/routes/entries.js
import express from 'express';
import { db } from '../db.js';
import { parseHm, roundTo15, validateNoOverlap } from '../validators/entries.js';

const router = express.Router();

function getSingleUserId() {
  const row = db.prepare('SELECT id FROM users LIMIT 1').get();
  return row?.id || 1;
}

router.get('/', (req, res) => {
  const { date } = req.query; // optional filter
  let rows;
  if (date) {
    rows = db.prepare(
      `SELECT te.id, te.date, te.start_time, te.end_time, te.duration_minutes, te.notes,
              te.project_id, p.name as project_name,
              te.task_id, t.name as task_name
       FROM time_entries te
       LEFT JOIN projects p ON te.project_id = p.id
       LEFT JOIN tasks t ON te.task_id = t.id
       WHERE te.user_id = ? AND te.date = ?
       ORDER BY te.start_time IS NULL, te.start_time, te.id`
    ).all(getSingleUserId(), date);
  } else {
    rows = db.prepare(
      `SELECT te.id, te.date, te.start_time, te.end_time, te.duration_minutes, te.notes,
              te.project_id, p.name as project_name,
              te.task_id, t.name as task_name
       FROM time_entries te
       LEFT JOIN projects p ON te.project_id = p.id
       LEFT JOIN tasks t ON te.task_id = t.id
       WHERE te.user_id = ?
       ORDER BY te.date DESC, te.start_time IS NULL, te.start_time, te.id
       LIMIT 100`
    ).all(getSingleUserId());
  }
  res.json(rows);
});

router.post('/', (req, res) => {
  const {
    date, start_time, end_time, duration_minutes, notes,
    project_id = null, task_id = null
  } = req.body || {};

  if (!date) return res.status(400).json({ error: 'date is required (YYYY-MM-DD)' });

  let duration = Number(duration_minutes) || 0;
  const start = parseHm(start_time);
  const end = parseHm(end_time);

  if (start != null && end != null && end > start) {
    duration = end - start;
  }
  if (!duration || duration <= 0) {
    return res.status(400).json({ error: 'Provide either valid start/end or a positive duration_minutes' });
  }
  duration = roundTo15(duration);

  // Basic overlap check (only if start/end provided)
  if (start != null && end != null) {
    const ov = validateNoOverlap(db, { user_id: getSingleUserId(), date, start_time, end_time });
    if (!ov.ok) return res.status(400).json({ error: ov.error });
  }

  const info = db.prepare(
    `INSERT INTO time_entries
     (user_id, project_id, task_id, date, start_time, end_time, duration_minutes, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(getSingleUserId(), project_id, task_id, date, start_time || null, end_time || null, duration, notes || null);

  const row = db.prepare(
    `SELECT te.id, te.date, te.start_time, te.end_time, te.duration_minutes, te.notes,
            te.project_id, p.name as project_name,
            te.task_id, t.name as task_name
     FROM time_entries te
     LEFT JOIN projects p ON te.project_id = p.id
     LEFT JOIN tasks t ON te.task_id = t.id
     WHERE te.id = ?`
  ).get(info.lastInsertRowid);

  res.status(201).json(row);
});

router.delete('/:id', (req, res) => {
  const { id } = req.params;
  const info = db.prepare('DELETE FROM time_entries WHERE id = ?').run(id);
  if (info.changes === 0) return res.status(404).json({ error: 'Not found' });
  res.status(204).end();
});

export default router;
