
// backend/validators/entries.js

// Round minutes to nearest 15 up (ceil)
export function roundTo15(minutes) {
    return Math.ceil(minutes / 15) * 15;
  }
  
  // Parse "HH:mm" -> minutes since midnight
  export function parseHm(hm) {
    const [h, m] = (hm || '').split(':').map(Number);
    if (Number.isInteger(h) && Number.isInteger(m) && h >= 0 && h < 24 && m >= 0 && m < 60) {
      return h * 60 + m;
    }
    return null;
  }
  
  export function validateNoOverlap(db, { user_id, date, start_time, end_time, excludeId = null }) {
    // Only check overlaps for start/end style entries
    const start = parseHm(start_time);
    const end = parseHm(end_time);
    if (start == null || end == null || end <= start) return { ok: true };
  
    const sql = `
      SELECT id, start_time, end_time
      FROM time_entries
      WHERE user_id = ? AND date = ? AND start_time IS NOT NULL AND end_time IS NOT NULL
      ${excludeId ? 'AND id <> ?' : ''}
    `;
    const rows = excludeId
      ? db.prepare(sql).all(user_id, date, excludeId)
      : db.prepare(sql).all(user_id, date);
  
    const overlaps = rows.some(r => {
      const s = parseHm(r.start_time);
      const e = parseHm(r.end_time);
      return s != null && e != null && Math.max(s, start) < Math.min(e, end);
    });
  
    return overlaps ? { ok: false, error: 'Overlapping entry on this date' } : { ok: true };
  }
  ``
  