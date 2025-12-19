
// export.js — Bind export buttons
import { $, openURL } from "./utils.js";

export function initExportButtons() {
  const getYM = () => {
    const y = Number($("year").value);
    const m = Number($("month").value);
    return { y, m };
  };

  $("btn-month-xlsx").addEventListener("click", () => {
    const { y, m } = getYM();
    openURL(`/api/export/month.xlsx?year=${y}&month=${m}`);
  });
  $("btn-month-days-csv").addEventListener("click", () => {
    const { y, m } = getYM();
    openURL(`/api/export/month/days.csv?year=${y}&month=${m}`);
  });
  $("btn-month-intervals-csv").addEventListener("click", () => {
    const { y, m } = getYM();
    openURL(`/api/export/month/intervals.csv?year=${y}&month=${m}`);
  });
  $("btn-month-breaks-csv").addEventListener("click", () => {
    const { y, m } = getYM();
    openURL(`/api/export/month/breaks.csv?year=${y}&month=${m}`);
  });
  $("btn-month-projects-csv").addEventListener("click", () => {
    const { y, m } = getYM();
    openURL(`/api/export/month/projects.csv?year=${y}&month=${m}`);
  });

  const expYearInput = $("export-year");
  if (!expYearInput.value) expYearInput.value = new Date().getFullYear();
  $("btn-year-xlsx").addEventListener("click", () => {
    const y = Number(expYearInput.value) || new Date().getFullYear();
    openURL(`/api/export/year.xlsx?year=${y}`);
  });
}
