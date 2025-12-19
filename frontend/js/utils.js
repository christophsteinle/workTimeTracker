
// utils.js — common helpers

export function $(id) {
    return document.getElementById(id);
  }
  
  export function pad2(n) {
    return String(n).padStart(2, "0");
  }
  
  export function todayISO() {
    const d = new Date();
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  }
  
  export function toHmFromMinutes(mins) {
    const v = Number(mins || 0);
    const h = Math.floor(v / 60);
    const m = v % 60;
    return `${pad2(h)}:${pad2(m)}`;
  }
  
  export function weekdayName(idx) {
    return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][idx] || "";
  }
  
  export function monthName(m) {
    return [
      "January", "February", "March", "April", "May", "June", "July",
      "August", "September", "October", "November", "December"
    ][m - 1];
  }
  
  export function openURL(url) {
    window.location.href = url;
  }
  