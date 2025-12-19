
// backend/db.js
import { open } from 'sqlite';
import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_PATH = path.join(DATA_DIR, 'timetracker.sqlite');

export let db;

export async function initDb() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  db = await open({
    filename: DB_PATH,
    driver: sqlite3.Database
  });

  await db.exec('PRAGMA foreign_keys = ON;');

  const verRow = await db.get('PRAGMA user_version;');
  const currentVer = verRow?.user_version ?? 0;

  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT,
      timezone TEXT DEFAULT 'Europe/Berlin'
    );

    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      code TEXT UNIQUE,
      active INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 1,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS cost_centers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE,
      name TEXT
    );

    CREATE TABLE IF NOT EXISTS tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE
    );

    CREATE TABLE IF NOT EXISTS time_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      project_id INTEGER,
      task_id INTEGER,
      cost_center_id INTEGER,
      date TEXT NOT NULL,
      start_time TEXT,
      end_time TEXT,
      duration_minutes INTEGER NOT NULL,
      billable INTEGER NOT NULL DEFAULT 0,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL,
      FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE SET NULL,
      FOREIGN KEY (cost_center_id) REFERENCES cost_centers(id) ON DELETE SET NULL
    );

    CREATE TRIGGER IF NOT EXISTS time_entries_update_ts
    AFTER UPDATE ON time_entries
    BEGIN
      UPDATE time_entries SET updated_at = datetime('now') WHERE id = NEW.id;
    END;

    CREATE TABLE IF NOT EXISTS timeentry_tags (
      timeentry_id INTEGER NOT NULL,
      tag_id INTEGER NOT NULL,
      PRIMARY KEY (timeentry_id, tag_id),
      FOREIGN KEY (timeentry_id) REFERENCES time_entries(id) ON DELETE CASCADE,
      FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      max_hours_per_day INTEGER DEFAULT 10,
      max_hours_per_week INTEGER DEFAULT 48,
      work_window_start TEXT DEFAULT '06:00',
      work_window_end TEXT DEFAULT '22:00',
      target_hours_per_day INTEGER DEFAULT 8,
      missing_hours_reminder_time TEXT DEFAULT '18:00'
    );

    CREATE TABLE IF NOT EXISTS work_intervals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT,
      duration_minutes INTEGER,
      project_id INTEGER,
      task_id INTEGER,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL,
      FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE SET NULL
    );

    CREATE TRIGGER IF NOT EXISTS work_intervals_update_ts
    AFTER UPDATE ON work_intervals
    BEGIN
      UPDATE work_intervals SET updated_at = datetime('now') WHERE id = NEW.id;
    END;

    CREATE TABLE IF NOT EXISTS breaks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      start_time TEXT,
      end_time TEXT,
      duration_minutes INTEGER,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TRIGGER IF NOT EXISTS breaks_update_ts
    AFTER UPDATE ON breaks
    BEGIN
      UPDATE breaks SET updated_at = datetime('now') WHERE id = NEW.id;
    END;
  `);

  await db.exec(`
    CREATE INDEX IF NOT EXISTS idx_time_entries_user_date ON time_entries (user_id, date);
    CREATE INDEX IF NOT EXISTS idx_time_entries_project_task_date ON time_entries (project_id, task_id, date);
    CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks (project_id);
    CREATE INDEX IF NOT EXISTS idx_work_intervals_user_date ON work_intervals (user_id, date);
    CREATE INDEX IF NOT EXISTS idx_breaks_user_date ON breaks (user_id, date);
  `);

  if (currentVer < 3) {
    await db.exec('PRAGMA user_version = 3;');
    console.log('🔧 Schema version set to 3 (async sqlite)');
  }

  const userCount = (await db.get('SELECT COUNT(*) AS c FROM users')).c;
  if (userCount === 0) {
    await db.run('INSERT INTO users (name, email) VALUES (?, ?)', ['Local User', null]);
  }
  const settingsCount = (await db.get('SELECT COUNT(*) AS c FROM settings')).c;
  if (settingsCount === 0) {
    await db.run('INSERT INTO settings (id) VALUES (1)');
  }

  console.log(`✅ SQLite initialized at ${DB_PATH}`);
}
