import assert from "node:assert/strict";
import test from "node:test";

import { fetchSheetData, parseSheetData, sheetDate } from "../lib/sheets-data.js";

const ranges = [
  { values: [
    ["date", "user", "weight_kg", "body_fat_pct", "muscle_pct", "exercised", "note"],
    [46274, "Reason", 82.9, 35.8, "", "Y", ""],
    ["2026/9/10", "Chloe", 57.9, "", 36.7, false, "量測"],
  ] },
  { values: [
    ["id", "date", "user", "meal_type", "food_name", "quantity", "unit", "calories", "protein_g", "fat_g", "carbs_g", "note"],
    ["f1", "2026/9/9", "Reason", "早餐", "雞蛋", 2, "個", 160, 12, 10, 2, ""],
  ] },
  { values: [
    ["date", "user", "exercise_type", "duration_minutes", "intensity", "steps", "note"],
    ["2026-09-09", "Reason", "慢跑", 30, "中", "", ""],
  ] },
  { values: [
    ["user", "day_type", "calories", "protein", "fat", "carbs", "effective_from"],
    ["Reason", "rest", 1850, 140, 60, 188, "2026/9/1"],
  ] },
  { values: [
    ["date", "user", "body_fat_mass_kg", "muscle_mass_kg", "score", "rank", "note"],
    ["2026/9/9", "Reason", 20, 40, 0, 1, "初始量測"],
  ] },
];

test("parseSheetData preserves missing measurements and genuine zeroes", () => {
  const result = parseSheetData(ranges);
  assert.equal(result.dailyLogs[0].weight_kg, 82.9);
  assert.equal(result.dailyLogs[0].muscle_pct, null);
  assert.equal(result.dailyLogs[0].exercised, true);
  assert.equal(result.dailyLogs[1].exercised, false);
  assert.equal(result.foodLogs[0].calories, 160);
  assert.equal(result.exerciseLogs[0].steps, null);
  assert.equal(result.goals[0].effective_from, "2026-09-01");
  assert.equal(result.inBodyLogs[0].body_fat_mass_kg, 20);
  assert.equal(result.inBodyLogs[0].score, 0);
});

test("sheetDate accepts serial and year-first formatted values", () => {
  assert.equal(sheetDate("2026/9/9"), "2026-09-09");
  assert.equal(sheetDate(0), "1899-12-30");
  assert.throws(() => sheetDate("9/9/2026"), /無法辨識/);
});

test("parseSheetData reports missing columns and tabs", () => {
  assert.throws(() => parseSheetData(ranges.slice(0, 4)), /五個必要工作表/);
  const broken = structuredClone(ranges);
  broken[0].values[0][0] = "日期";
  assert.throws(() => parseSheetData(broken), /DailyLogs 缺少欄位：date/);
});

test("fetchSheetData uses read-only batchGet and reports authorization errors", async () => {
  let seen;
  const data = await fetchSheetData("short-token", "sheet-id", async (url, options) => {
    seen = { url, options };
    return { ok: true, json: async () => ({ valueRanges: ranges }) };
  });
  assert.equal(data.foodLogs.length, 1);
  assert.equal(seen.url.searchParams.getAll("ranges").length, 5);
  assert.equal(seen.url.searchParams.get("valueRenderOption"), "UNFORMATTED_VALUE");
  assert.equal(seen.options.headers.Authorization, "Bearer short-token");
  await assert.rejects(
    fetchSheetData("expired", "sheet-id", async () => ({ ok: false, status: 401 })),
    /登入已過期/,
  );
});
