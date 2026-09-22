/** Calculate masses only when weight and percentage were recorded on the same date. */
export function bodyComposition(log) {
  const weight = log.weight_kg;
  const fatPercent = log.body_fat_pct;
  const musclePercent = log.muscle_pct;
  const validWeight = Number.isFinite(weight) && weight > 0;
  const validPercent = (value) => Number.isFinite(value) && value >= 0 && value <= 100;
  const fatMassKg = validWeight && validPercent(fatPercent) ? weight * fatPercent / 100 : null;
  return {
    fatMassKg,
    fatFreeMassKg: fatMassKg == null ? null : weight - fatMassKg,
    muscleMassKg: validWeight && validPercent(musclePercent) ? weight * musclePercent / 100 : null,
  };
}

/** Find the newest same-day weight/percentage pair for a headline mass reading. */
export function latestMassReading(records, percentageKey, massKey) {
  for (const record of [...records].reverse()) {
    const massKg = bodyComposition(record)[massKey];
    if (massKg != null) {
      return { date: record.date, percentage: record[percentageKey], massKg };
    }
  }
  return null;
}

/** Group food entries by ISO date (newest first), with per-day and whole-range totals. */
export function summarizeFoodRange(logs, startDate = "", endDate = "") {
  const emptyTotals = () => ({ calories: 0, protein_g: 0, fat_g: 0, carbs_g: 0 });
  const totals = emptyTotals();
  const groupsByDate = new Map();
  if (startDate && endDate && startDate > endDate) return { groups: [], totals, count: 0 };

  for (const item of logs) {
    if ((startDate && item.date < startDate) || (endDate && item.date > endDate)) continue;
    if (!groupsByDate.has(item.date)) {
      groupsByDate.set(item.date, { date: item.date, items: [], totals: emptyTotals() });
    }
    const group = groupsByDate.get(item.date);
    group.items.push(item);
    for (const key of Object.keys(totals)) {
      const value = Number(item[key]);
      const amount = Number.isFinite(value) ? value : 0;
      group.totals[key] += amount;
      totals[key] += amount;
    }
  }

  const groups = [...groupsByDate.values()].sort((a, b) => b.date.localeCompare(a.date));
  return { groups, totals, count: groups.reduce((count, group) => count + group.items.length, 0) };
}

/** Return an inclusive range start using UTC calendar dates, independent of local time zone. */
export function inclusiveRangeStart(endDate, days) {
  if (!endDate || !Number.isInteger(days) || days < 1) return "";
  const date = new Date(`${endDate}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return "";
  date.setUTCDate(date.getUTCDate() - days + 1);
  return date.toISOString().slice(0, 10);
}
