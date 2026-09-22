import assert from "node:assert/strict";
import test from "node:test";

import { aggregateFoodByDate, completionPercent, goalForDate, signedChange } from "../lib/metrics.js";

test("aggregateFoodByDate sums nutrients and tolerates missing values", () => {
  const result = aggregateFoodByDate([
    { date: "2026-09-09", calories: 100, protein_g: 10 },
    { date: "2026-09-09", calories: 50, protein_g: null },
  ]);
  assert.equal(result["2026-09-09"].calories, 150);
  assert.equal(result["2026-09-09"].protein_g, 10);
});

test("goalForDate selects the latest effective goal", () => {
  const goals = [
    { user: "Reason", day_type: "rest", effective_from: "2026-01-01", calories: 1900 },
    { user: "Reason", day_type: "rest", effective_from: "2026-09-01", calories: 1800 },
  ];
  assert.equal(goalForDate(goals, "Reason", "rest", "2026-09-21").calories, 1800);
});

test("completionPercent clamps values and signedChange preserves direction", () => {
  assert.equal(completionPercent(150, 100), 100);
  assert.equal(completionPercent(50, 100), 50);
  assert.equal(signedChange(80.2, 85.5), "-5.3");
});
