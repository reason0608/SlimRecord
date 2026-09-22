import assert from "node:assert/strict";
import test from "node:test";

import {
  bodyComposition,
  inclusiveRangeStart,
  latestMassReading,
  summarizeFoodRange,
} from "../lib/dashboard-data.js";

test("bodyComposition calculates fat and fat-free mass from the same day's readings", () => {
  assert.deepEqual(
    bodyComposition({ weight_kg: 80, body_fat_pct: 25, muscle_pct: 35 }),
    { fatMassKg: 20, fatFreeMassKg: 60, muscleMassKg: 28 },
  );
  assert.deepEqual(
    bodyComposition({ weight_kg: null, body_fat_pct: 25, muscle_pct: 35 }),
    { fatMassKg: null, fatFreeMassKg: null, muscleMassKg: null },
  );
  assert.equal(bodyComposition({ weight_kg: 80, body_fat_pct: 105 }).fatMassKg, null);
});

test("latestMassReading never joins a newer percentage to an older weight", () => {
  const records = [
    { date: "2026-09-09", weight_kg: 80, body_fat_pct: 25 },
    { date: "2026-09-10", weight_kg: null, body_fat_pct: 24 },
  ];
  assert.deepEqual(latestMassReading(records, "body_fat_pct", "fatMassKg"), {
    date: "2026-09-09", percentage: 25, massKg: 20,
  });
});

test("summarizeFoodRange groups by date and sums day and interval nutrients", () => {
  const logs = [
    { date: "2026-09-10", calories: 200, protein_g: 10, fat_g: null, carbs_g: 20 },
    { date: "2026-09-09", calories: 100, protein_g: 5, fat_g: 3, carbs_g: 8 },
    { date: "2026-09-10", calories: 300, protein_g: 20, fat_g: 7, carbs_g: 30 },
  ];
  const result = summarizeFoodRange(logs, "2026-09-10", "2026-09-10");
  assert.equal(result.count, 2);
  assert.deepEqual(result.groups.map((group) => group.date), ["2026-09-10"]);
  assert.deepEqual(result.groups[0].totals, { calories: 500, protein_g: 30, fat_g: 7, carbs_g: 50 });
  assert.deepEqual(result.totals, result.groups[0].totals);
  assert.deepEqual(summarizeFoodRange(logs, "2026-09-11", "2026-09-10").groups, []);
  assert.deepEqual(summarizeFoodRange(logs).groups.map((group) => group.date), ["2026-09-10", "2026-09-09"]);
});

test("inclusiveRangeStart handles month boundaries and invalid inputs", () => {
  assert.equal(inclusiveRangeStart("2026-10-02", 7), "2026-09-26");
  assert.equal(inclusiveRangeStart("", 7), "");
  assert.equal(inclusiveRangeStart("2026-10-02", 0), "");
});
