
// backend/routes/tasks.js
import express from 'express';
import { db } from '../db.js';

const router = express.Router();

router.get('/', async (req, res) => {
  const { project_id } = req.query;
  let rows;
  if (project_id) {
    rows = await db.all(
      'SELECT id, project_id, name, active FROM tasks WHERE project_id = ? ORDER BY name',
      [project_id]
    );
  } else {
    rows = await db.all('SELECT id, project_id, name, active FROM tasks ORDER BY name');
  }
  res.json(rows);
});

router.post('/', async (req, res) => {
  const { project_id, name, active = 1 } = req.body || {};
  if (!project_id) return res.status(400).json({ error: 'project_id is required' });
  if (!name) return res.status(400).json({ error: 'name is required' });

  try {
    const info = await db.run(
      'INSERT INTO tasks (project_id, name, active) VALUES (?, ?, ?)',
      [project_id, name, active ? 1 : 0]
    );
    const row = await db.get('SELECT id, project_id, name, active FROM tasks WHERE id=?', [info.lastID]);
    res.status(201).json(row);
  } catch (e) {
    res.status(400).json({ error: String(e) });
  }
});

export default router;
