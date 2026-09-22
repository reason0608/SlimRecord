/** Return the latest non-empty value for a metric in chronological records. */
export function latestMetric(records, key) {
  return [...records].reverse().find((record) => record[key] != null)?.[key] ?? null;
}

/** Return the earliest non-empty value for a metric in chronological records. */
export function firstMetric(records, key) {
  return records.find((record) => record[key] != null)?.[key] ?? null;
}

/** Aggregate food nutrients by date. Missing nutrients remain zero in the total. */
export function aggregateFoodByDate(foodLogs) {
  return foodLogs.reduce((totals, item) => {
    const current = totals[item.date] ?? { calories: 0, protein_g: 0, fat_g: 0, carbs_g: 0 };
    for (const key of ["calories", "protein_g", "fat_g", "carbs_g"]) {
      current[key] += Number(item[key] ?? 0);
    }
    totals[item.date] = current;
    return totals;
  }, {});
}

/** Pick the most recent goal that applies on a specific date and day type. */
export function goalForDate(goals, user, dayType, targetDate) {
  return goals
    .filter((goal) => goal.user === user && goal.day_type === dayType && goal.effective_from <= targetDate)
    .sort((a, b) => b.effective_from.localeCompare(a.effective_from))[0] ?? null;
}

/** Clamp a nutrient completion ratio to a display-safe 0–100 percent. */
export function completionPercent(actual, target) {
  if (!target || actual == null) return 0;
  return Math.max(0, Math.min(100, (actual / target) * 100));
}

/** Format a signed metric change without hiding a true zero. */
export function signedChange(current, starting, digits = 1) {
  if (current == null || starting == null) return "—";
  const difference = current - starting;
  return `${difference > 0 ? "+" : ""}${difference.toFixed(digits)}`;
}
