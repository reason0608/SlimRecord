import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("public site bundles demonstration data only", async () => {
  const source = await readFile(new URL("../data/fitness-data.json", import.meta.url), "utf8");
  const data = JSON.parse(source);

  assert.equal(data.dataset_mode, "demo", "Public data must be explicitly marked as demo");
  assert.ok(data.dailyLogs.length > 0, "Demo should still render useful charts");
  assert.ok(data.foodLogs.length > 0, "Demo should still render the meal list");
  assert.ok(data.foodLogs.every((item) => item.id.startsWith("demo-")));
  assert.ok(data.foodLogs.every((item) => item.food_name?.startsWith("示範")));
});
