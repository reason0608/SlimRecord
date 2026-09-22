import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");
const composition = source.match(/<LineChart syncId="body-composition"[\s\S]*?<\/LineChart>/g) ?? [];

test("body-composition charts share date coordinates and separate mass trends", () => {
  assert.equal(composition.length, 3);
  for (const chart of composition) {
    assert.match(chart, /data=\{trendData\}/);
    assert.match(chart, /margin=\{\{ top: 10, right: 4, left: 0, bottom: 0 \}\}/);
    assert.match(chart, /<XAxis dataKey="date"/);
    assert.match(chart, /width=\{44\}/);
    assert.match(chart, /formatter=\{\(value\) => typeof value === "number" \? value\.toFixed\(1\)/);
  }
  assert.match(composition[0], /dataKey="weight_kg"/);
  assert.match(composition[0], /dataKey="fatFreeMassKg"/);
  assert.match(composition[1], /dataKey="fatMassKg"/);
  assert.doesNotMatch(composition[1], /dataKey="muscleMassKg"/);
  assert.match(composition[2], /dataKey="muscleMassKg"/);
  assert.doesNotMatch(composition[2], /dataKey="fatMassKg"/);
});
