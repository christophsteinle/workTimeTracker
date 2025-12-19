
// backend/routes/breaks.js
import express from 'express';
import { db } from '../db.js';
import { computeRoundedDuration, validateNoOverlapBreak } from '../validators/time.js';

const router = express.Router();

async function getSingleUserId() {
  const row = await db.get('SELECT id FROM users LIMIT 1');
  return row?.id || 1;
}

router.get('/', async (req, res) => {
  const { date } = req.query;
  const uid = await getSingleUserId();
  let rows;

  if (date) {
    rows = await db.all(
      `SELECT id, date, start_time, end_time, duration_minutes, notes
       FROM breaks WHERE user_id=? AND date=?
       ORDER BY start_time IS NULL, start_time, id`, [uid, date]);
  } else {
    rows = await db.all(
      `SELECT id, date, start_time, end_time, duration_minutes, notes
       FROM breaks WHERE user_id=?
       ORDER BY date DESC, start_time IS NULL, start_time, id
       LIMIT 200`, [uid]);
  }
  res.json(rows);
});

router.post('/', async (req, res) => {
  const uid = await getSingleUserId();
  const { date, start_time = null, end_time = null, duration_minutes = null, notes = null } = req.body || {};
  if (!date) return res.status(400).json({ error: 'date is required (YYYY-MM-DD)' });

  const duration = computeRoundedDuration({ start_time, end_time, duration_minutes });
  if (!duration) return res.status(400).json({ error: 'Provide either valid start/end or a positive duration_minutes' });

  const ov = await validateNoOverlapBreak(db, { user_id: uid, date, start_time, end_time, duration_minutes });
  if (!ov.ok) return res.status(400).json({ error: ov.error });

  const info = await db.run(
    `INSERT INTO breaks (user_id, date, start_time, end_time, duration_minutes, notes)
     VALUES (?, ?, ?, ?, ?, ?)`, [uid, date, start_time, end_time, duration, notes]
  );

  const row = await db.get('SELECT id, date, start_time, end_time, duration_minutes, notes FROM breaks WHERE id=?', [info.lastID]);
  res.status(201).json(row);
});

router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const uid = await getSingleUserId();
  const existing = await db.get('SELECT * FROM breaks WHERE id=? AND user_id=?', [id, uid]);
  if (!existing) return res.status(404).json({ error: 'Not found' });

  const {
    date = existing.date,
    start_time = existing.start_time,
    end_time = existing.end_time,
    duration_minutes = existing.duration_minutes,
    notes = existing.notes
  } = req.body || {};

  const duration = computeRoundedDuration({ start_time, end_time, duration_minutes });
  if (!duration) return res.status(400).json({ error: 'Provide either valid start/end or a positive duration_minutes' });

  const ov = await validateNoOverlapBreak(db, { user_id: uid, date, start_time, end_time, duration_minutes, excludeId: Number(id) });
  if (!ov.ok) return res.status(400).json({ error: ov.error });

  await db.run(
    `UPDATE breaks SET date=?, start_time=?, end_time=?, duration_minutes=?, notes=? WHERE id=? AND user_id=?`,
    [date, start_time, end_time, duration, notes, id, uid]
  );

  const row = await db.get('SELECT id, date, start_time, end_time, duration_minutes, notes FROM breaks WHERE id=?', [id]);
  res.json(row);
});

router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  const uid = await getSingleUserId();
  const info = await db.run('DELETE FROM breaks WHERE id=? AND user_id=?', [id, uid]);
  if (info.changes === 0) return res.status(404).json({ error: 'Not found' });
  res.status(204).end();
});

export default router;
