import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { hardenTooling, hardenedSource, patchSpecs } from "../scripts/harden-tooling.mjs";
import { auditFindings, mitigationExpiry } from "../scripts/audit-dependencies.mjs";

const require = createRequire(import.meta.url);
const braces = require("braces");

test("tooling mitigation is installed, byte-verified and idempotent", () => {
  assert.ok(hardenTooling({ check: true }) > 0);
  for (const spec of patchSpecs) {
    const source = readFileSync(require.resolve(`braces/${spec.file}`), "utf8").replace(/\r\n/g, "\n");
    assert.equal(hardenedSource(spec, source), source);
    assert.throws(() => hardenedSource(spec, source + "\n// changed"), /Unexpected braces source/);
  }
});

test("deep brace and parentheses patterns are rejected before stack exhaustion", () => {
  for (const [open, close] of [["{", "}"], ["(", ")"], ["({", "})"]]) {
    const pattern = open.repeat(4000 / open.length) + "a" + close.repeat(4000 / close.length);
    for (const action of [braces, braces.parse, braces.compile, braces.expand, braces.stringify]) {
      assert.throws(() => action(pattern), (error) => error instanceof SyntaxError && /nesting exceeds 100/.test(error.message));
    }
  }
  assert.throws(() => braces.compile("{".repeat(4000) + "a"), /nesting exceeds 100/);
});

test("direct AST walkers also reject excessive depth", () => {
  for (const method of ["compile", "expand", "stringify"]) {
    let ast = { type: "text", value: "a" };
    for (let i = 0; i < 200; i++) ast = { type: "root", nodes: [ast] };
    assert.throws(() => braces[method](ast), /nesting exceeds 100/);
  }
});

test("normal glob behavior remains compatible with build and lint consumers", () => {
  assert.deepEqual(braces.expand("src/{app,lib}/file.{js,ts}"), ["src/app/file.js", "src/app/file.ts", "src/lib/file.js", "src/lib/file.ts"]);
  assert.deepEqual(braces.expand("{1..3}"), ["1", "2", "3"]);
  assert.equal(braces.compile("{a,{b,c}}"), "(a|(b|c))");
  assert.equal(braces.stringify(braces.parse("a/{b,c}")), "a/{b,c}");
  const micromatch = require("micromatch");
  assert.deepEqual(micromatch(["app/x.ts", "lib/y.js", "other/z.ts"], "{app,lib}/**/*.{ts,js}"), ["app/x.ts", "lib/y.js"]);
  assert.ok(require("fast-glob").sync("{lib,components}/**/*.{ts,tsx}").length > 50);
});

function fixture() {
  return {
    report: { auditReportVersion: 2, metadata: { vulnerabilities: { high: 2, total: 2 } }, vulnerabilities: {
      braces: { nodes: ["node_modules/braces"], via: [{ name: "braces", url: "https://github.com/advisories/GHSA-vfj7-8cjw-p6xm" }] },
      micromatch: { nodes: ["node_modules/micromatch"], via: ["braces"] },
    } },
    lock: { packages: { "node_modules/braces": { version: "3.0.3", dev: true }, "node_modules/micromatch": { version: "4.0.8", dev: true } } },
  };
}
const now = Date.parse("2026-10-21T00:00:00Z");

test("audit exception is limited to the verified development-only advisory and expires", () => {
  const { report, lock } = fixture();
  assert.deepEqual(auditFindings(report, lock, { now }).blocked, []);
  assert.equal(auditFindings(report, lock, { now: Date.parse(mitigationExpiry) }).blocked.length, 2);
  assert.equal(auditFindings(report, lock, { now, allowMitigation: false }).blocked.length, 2);
  lock.packages["node_modules/braces"].dev = false;
  assert.equal(auditFindings(report, lock, { now }).blocked.length, 2);
});

test("new advisories, versions, dependency chains and invalid audits cannot be silently waived", () => {
  for (const change of [
    ({ report }) => { report.vulnerabilities.braces.via.push({ name: "braces", url: "https://example.invalid/new-advisory" }); },
    ({ lock }) => { lock.packages["node_modules/braces"].version = "3.0.4"; },
    ({ report }) => { report.vulnerabilities.micromatch.via.push("new-package"); },
    ({ report }) => { report.vulnerabilities.micromatch.via = ["micromatch"]; },
  ]) {
    const item = fixture();
    change(item);
    assert.ok(auditFindings(item.report, item.lock, { now }).blocked.length > 0);
  }
  assert.throws(() => auditFindings({ error: { code: "ENETUNREACH" } }, {}, { now }), /invalid result/);
});
