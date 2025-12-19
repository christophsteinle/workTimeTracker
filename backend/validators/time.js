
// backend/validators/time.js

export function parseHm(hm) {
    const [hStr, mStr] = String(hm || '').split(':');
    const h = Number(hStr);
    const m = Number(mStr);
    if (Number.isInteger(h) && Number.isInteger(m) && h >= 0 && h < 24 && m >= 0 && m < 60) {
      return h * 60 + m;
    }
    return null;
  }
  
  export function toHm(mins) {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }
  
  export function roundTo15(minutes) {
    return Math.ceil(minutes / 15) * 15;
  }
  
  export function computeRoundedDuration({ start_time, end_time, duration_minutes }) {
    if (duration_minutes && duration_minutes > 0) {
      return roundTo15(Number(duration_minutes));
    }
    const start = parseHm(start_time);
    const end = parseHm(end_time);
    if (start == null || end == null || end <= start) return null;
    return roundTo15(end - start);
  }
  
  export function intervalsOverlap(aStart, aEnd, bStart, bEnd) {
    return Math.max(aStart, bStart) < Math.min(aEnd, bEnd);
  }
  
  export async function validateNoOverlapWork(db, { user_id, date, start_time, end_time, excludeId = null }) {
    const s = parseHm(start_time);
    const e = parseHm(end_time);
    if (s == null || e == null || e <= s) {
      return { ok: false, error: 'Invalid start/end times' };
    }
  
    const rows = excludeId
      ? await db.all(
          `SELECT id, start_time, end_time FROM work_intervals
           WHERE user_id=? AND date=? AND id <> ?`, [user_id, date, excludeId])
      : await db.all(
          `SELECT id, start_time, end_time FROM work_intervals
           WHERE user_id=? AND date=?`, [user_id, date]);
  
    const conflict = rows.find(r => {
      const rs = parseHm(r.start_time);
      const re = parseHm(r.end_time);
      return rs != null && re != null && intervalsOverlap(s, e, rs, re);
    });
  
    if (conflict) return { ok: false, error: `Overlaps with interval #${conflict.id}` };
    return { ok: true };
  }
  
  export async function validateNoOverlapBreak(db, { user_id, date, start_time, end_time, duration_minutes, excludeId = null }) {
    const s = parseHm(start_time);
    const e = parseHm(end_time);
    if (s == null || e == null || e <= s) return { ok: true };
  
    const rows = excludeId
      ? await db.all(
          `SELECT id, start_time, end_time FROM breaks
           WHERE user_id=? AND date=? AND id <> ?`, [user_id, date, excludeId])
      : await db.all(
          `SELECT id, start_time, end_time FROM breaks
           WHERE user_id=? AND date=?`, [user_id, date]);
  
    const conflict = rows.find(r => {
      const rs = parseHm(r.start_time);
      const re = parseHm(r.end_time);
      if (rs == null || re == null) return false;
      return intervalsOverlap(s, e, rs, re);
    });
  
    if (conflict) return { ok: false, error: `Break overlaps with break #${conflict.id}` };
    return { ok: true };
  }
  