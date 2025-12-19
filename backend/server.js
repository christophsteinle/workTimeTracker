
// backend/server.js
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { initDb, db } from './db.js';

import projectsRouter from './routes/projects.js';
import tasksRouter from './routes/tasks.js';
import workIntervalsRouter from './routes/work-intervals.js';
import breaksRouter from './routes/breaks.js';
import dailySummaryRouter from './routes/daily-summary.js';
import timerRouter from './routes/timer.js';
import monthRouter from './routes/month.js';
import exportRouter from './routes/export.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || `http://localhost:${PORT}`;

app.use(cors({
  origin: FRONTEND_ORIGIN,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type']
}));
app.use(express.json());

// Health
app.get('/api/health', async (req, res) => {
  try {
    const row = await db.get('PRAGMA user_version;');
    res.json({
      status: 'ok',
      message: 'TimeTracker backend is healthy',
      sqlite_user_version: row?.user_version ?? 0,
      time: new Date().toISOString()
    });
  } catch (err) {
    console.error('Health check failed:', err);
    res.status(500).json({ status: 'error', error: String(err) });
  }
});

// Serve frontend same-origin
app.use(express.static(path.join(__dirname, '..', 'frontend')));
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'frontend', 'index.html'));
});

// Routers
app.use('/api/projects', projectsRouter);
app.use('/api/tasks', tasksRouter);
app.use('/api/work-intervals', workIntervalsRouter);
app.use('/api/breaks', breaksRouter);
app.use('/api/daily-summary', dailySummaryRouter);
app.use('/api/timer', timerRouter);
app.use('/api', monthRouter);
app.use('/api/export', exportRouter);

// Boot after DB init
await initDb();

app.listen(PORT, () => {
  console.log(`✅ TimeTracker backend listening on http://localhost:${PORT}`);
  console.log(`CORS allowed origin: ${FRONTEND_ORIGIN}`);
});
