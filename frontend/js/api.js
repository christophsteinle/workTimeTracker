
// api.js — backend API clients (same-origin)

export const api = {
    health: () => fetch("/api/health").then(r => r.json()),
  
    monthOverview: (year, month) =>
      fetch(`/api/month/${year}/${month}/overview`).then(r => r.json()),
  
    dailySummary: (date) =>
      fetch(`/api/daily-summary?date=${encodeURIComponent(date)}`).then(r => r.json()),
  
    dayIntervals: (date) =>
      fetch(`/api/work-intervals?date=${encodeURIComponent(date)}`).then(r => r.json()),
  
    dayBreaks: (date) =>
      fetch(`/api/breaks?date=${encodeURIComponent(date)}`).then(r => r.json()),
  
    addInterval: (payload) =>
      fetch("/api/work-intervals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      }).then(async (r) => {
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
        return j;
      }),
  
    updateInterval: (id, payload) =>
      fetch(`/api/work-intervals/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      }).then(async (r) => {
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
        return j;
      }),
  
    deleteInterval: (id) =>
      fetch(`/api/work-intervals/${id}`, { method: "DELETE" })
        .then((r) => {
          if (!r.ok && r.status !== 204) throw new Error(`HTTP ${r.status}`);
          return true;
        }),
  
    addBreak: (payload) =>
      fetch("/api/breaks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      }).then(async (r) => {
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
        return j;
      }),
  
    updateBreak: (id, payload) =>
      fetch(`/api/breaks/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      }).then(async (r) => {
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
        return j;
      }),
  
    deleteBreak: (id) =>
      fetch(`/api/breaks/${id}`, { method: "DELETE" })
        .then((r) => {
          if (!r.ok && r.status !== 204) throw new Error(`HTTP ${r.status}`);
          return true;
        })
  };
  
  export const timerApi = {
    status: (date) =>
      fetch(`/api/timer/status?date=${encodeURIComponent(date)}`).then(r => r.json()),
  
    start: (date, project_id, task_id, notes) =>
      fetch("/api/timer/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, project_id, task_id, notes })
      }).then(async (r) => {
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
        return j;
      }),
  
    stop: (date) =>
      fetch("/api/timer/stop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date })
      }).then(async (r) => {
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
        return j;
      })
  };
  
  export const projectsApi = {
    listProjects: () => fetch("/api/projects").then(r => r.json()),
    listTasks: (project_id) => {
      const url = project_id
        ? `/api/tasks?project_id=${encodeURIComponent(project_id)}`
        : "/api/tasks";
      return fetch(url).then(r => r.json());
    }
  };
  