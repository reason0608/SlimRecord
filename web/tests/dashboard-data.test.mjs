import assert from "node:assert/strict";
import test from "node:test";

import {
  bodyComposition,
  bodyScoreTrend,
  competitionLeaderboard,
  inclusiveRangeStart,
  latestMassReading,
  mergeCompetitionRecords,
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

test("competitionLeaderboard ranks every participant from direct InBody mass readings", () => {
  const result = competitionLeaderboard([
    { date: "2026-09-01", user: "Reason", body_fat_mass_kg: 20, muscle_mass_kg: 40 },
    { date: "2026-09-10", user: "Reason", body_fat_mass_kg: 18, muscle_mass_kg: 42 },
    { date: "2026-09-01", user: "Chloe", body_fat_mass_kg: 10, muscle_mass_kg: 20 },
    { date: "2026-09-10", user: "Chloe", body_fat_mass_kg: 9, muscle_mass_kg: 20 },
    { date: "2026-09-10", user: "Incomplete", body_fat_mass_kg: null, muscle_mass_kg: 30 },
  ]);
  assert.deepEqual(result.map(({ user, rank }) => ({ user, rank })), [
    { user: "Reason", rank: 1 }, { user: "Chloe", rank: 2 },
  ]);
  assert.equal(result[0].score, 25);
  assert.equal(result[1].score, 10);
});

test("mergeCompetitionRecords fills missing InBody dates from DailyLogs and prefers direct measurements", () => {
  const result = mergeCompetitionRecords([
    { date: "2026-09-24", user: "Reason", weight_kg: 80, body_fat_pct: 25, muscle_pct: 40 },
    { date: "2026-09-24", user: "Chloe", weight_kg: null, body_fat_pct: 25, muscle_pct: 40 },
  ], [
    { date: "2026-09-24", user: "Reason", body_fat_mass_kg: 19, muscle_mass_kg: 33 },
  ]);
  assert.deepEqual(result, [
    { date: "2026-09-24", user: "Reason", body_fat_mass_kg: 19, muscle_mass_kg: 33 },
  ]);
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

test("bodyScoreTrend rewards fat loss and only positive muscle change", () => {
  const records = [
    { date: "2026-09-01", weight_kg: 100, body_fat_pct: 20, muscle_pct: 40 },
    { date: "2026-09-02", weight_kg: 95, body_fat_pct: 20, muscle_pct: 40 },
    { date: "2026-09-03", weight_kg: 100, body_fat_pct: 18, muscle_pct: 42 },
  ];
  const result = bodyScoreTrend(records);
  assert.equal(result[0].score, 0);
  // Day 2: 5% fat loss, muscle fell 5% so no muscle penalty.
  assert.equal(result[1].score, 5);
  // Day 3: 10% fat loss plus 3 × 5% muscle gain.
  assert.equal(result[2].score, 25);
});

test("bodyScoreTrend uses the first complete record and skips incomplete days", () => {
  const result = bodyScoreTrend([
    { date: "2026-09-01", weight_kg: 100, body_fat_pct: null, muscle_pct: 40 },
    { date: "2026-09-02", weight_kg: 100, body_fat_pct: 20, muscle_pct: 40 },
    { date: "2026-09-03", weight_kg: null, body_fat_pct: 19, muscle_pct: 41 },
  ]);
  assert.deepEqual(result.map((point) => point.date), ["2026-09-02"]);
  assert.equal(bodyScoreTrend([]).length, 0);
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
