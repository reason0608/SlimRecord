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

/** Build score points against the first complete body-composition measurement.
 * Fat loss is positive; muscle loss never subtracts points.
 */
export function bodyScoreTrend(records) {
  const complete = records
    .map((record) => ({ ...record, ...bodyComposition(record) }))
    .filter((record) => record.fatMassKg != null && record.muscleMassKg != null)
    .sort((a, b) => a.date.localeCompare(b.date));
  const baseline = complete[0];
  if (!baseline || baseline.fatMassKg <= 0 || baseline.muscleMassKg <= 0) return [];

  return complete.map((record) => {
    const fatChangePercent =
      ((baseline.fatMassKg - record.fatMassKg) / baseline.fatMassKg) * 100;
    const muscleChangePercent =
      ((record.muscleMassKg - baseline.muscleMassKg) / baseline.muscleMassKg) * 100;
    return {
      date: record.date,
      fatChangePercent,
      muscleChangePercent,
      score: fatChangePercent + 3 * Math.max(muscleChangePercent, 0),
    };
  });
}

/** Build a competition leaderboard from direct InBody mass readings. */
export function competitionLeaderboard(records) {
  const grouped = new Map();
  for (const record of records) {
    const fatMassKg = Number(record.body_fat_mass_kg);
    const muscleMassKg = Number(record.muscle_mass_kg);
    if (!record.user || !record.date || !Number.isFinite(fatMassKg) || fatMassKg <= 0 ||
        !Number.isFinite(muscleMassKg) || muscleMassKg <= 0) continue;
    const entries = grouped.get(record.user) ?? [];
    entries.push({ ...record, fatMassKg, muscleMassKg });
    grouped.set(record.user, entries);
  }
  const leaderboard = [];
  for (const [user, entries] of grouped) {
    entries.sort((a, b) => a.date.localeCompare(b.date));
    const baseline = entries[0];
    const latest = entries.at(-1);
    const fatChangePercent = ((baseline.fatMassKg - latest.fatMassKg) / baseline.fatMassKg) * 100;
    const muscleChangePercent = ((latest.muscleMassKg - baseline.muscleMassKg) / baseline.muscleMassKg) * 100;
    leaderboard.push({
      user, latestDate: latest.date, fatMassKg: latest.fatMassKg, muscleMassKg: latest.muscleMassKg,
      fatChangePercent, muscleChangePercent,
      score: fatChangePercent + 3 * Math.max(muscleChangePercent, 0),
    });
  }
  leaderboard.sort((a, b) => b.score - a.score || a.user.localeCompare(b.user));
  return leaderboard.map((entry, index) => ({
    ...entry,
    rank: index > 0 && entry.score === leaderboard[index - 1].score ? leaderboard[index - 1].rank : index + 1,
  }));
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
