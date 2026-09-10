import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const app = await readFile(new URL("../components/training-app.tsx", import.meta.url), "utf8");
const guide = await readFile(new URL("../components/training-guide.tsx", import.meta.url), "utf8");
const equipment = await readFile(new URL("../components/training-tools.tsx", import.meta.url), "utf8");
const auth = await readFile(new URL("../components/account-gate.tsx", import.meta.url), "utf8");

test("onboarding asks plain questions instead of presenting product jargon", () => {
  assert.match(app, /Which program should RepArc start\?/);
  assert.match(app, /How many days will you train\?/);
  assert.match(app, /How long have you lifted regularly\?/);
  assert.doesNotMatch(app, />Weekly cadence</);
  assert.doesNotMatch(app, />Automatic program assignment</);
});

test("Train distinguishes the before, during and after workout inputs", () => {
  assert.match(app, /Before training · optional/);
  assert.match(app, /How hard was today’s workout\? · optional/);
  assert.match(app, /Used in reports only\. It does not change your weights, sets, or recovery guidance\./);
  assert.match(app, />Reps left</);
  assert.match(app, /2 means you stopped with about two good reps remaining/);
});

test("reports and equipment settings explain their meaning", () => {
  assert.match(app, /Planned workouts completed/);
  assert.match(app, /Weight × reps total/);
  assert.match(app, /rough workload total/);
  assert.match(equipment, /which weights you can actually choose/);
  assert.match(equipment, /does not decide your starting weight/);
});

test("technical terms are defined where they remain necessary", () => {
  assert.match(app, /A training max is a conservative planning number—not the weight you must lift today/);
  assert.match(guide, /Reps left \(RIR\).*For example, 2 means/s);
  assert.match(guide, /Final effort set \(AMRAP\)/);
  assert.doesNotMatch(auth, /Authentication tokens/);
});
