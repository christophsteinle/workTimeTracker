
// backend/routes/projects.js
import express from 'express';
import { db } from '../db.js';

const router = express.Router();

router.get('/', async (req, res) => {
  const rows = await db.all('SELECT id, name, code, active FROM projects ORDER BY name');
  res.json(rows);
});

router.post('/', async (req, res) => {
  const { name, code, active = 1 } = req.body || {};
  if (!name) return res.status(400).json({ error: 'name is required' });
  try {
    const info = await db.run(
      'INSERT INTO projects (name, code, active) VALUES (?, ?, ?)',
      [name, code || null, active ? 1 : 0]
    );
    const row = await db.get('SELECT id, name, code, active FROM projects WHERE id=?', [info.lastID]);
    res.status(201).json(row);
  } catch (e) {
    res.status(400).json({ error: String(e) });
  }
});

export default router;
