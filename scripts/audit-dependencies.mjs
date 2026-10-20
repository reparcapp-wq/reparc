import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { hardenTooling } from "./harden-tooling.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
export const mitigationExpiry = "2026-11-20T00:00:00Z";
const advisory = "https://github.com/advisories/GHSA-vfj7-8cjw-p6xm";
const expectedChain = new Set(["braces", "micromatch", "fast-glob", "@next/eslint-plugin-next", "eslint-config-next", "vite-plugin-dynamic-import", "vite-plugin-commonjs", "vinext"]);

export function auditFindings(report, lock, { now = Date.now(), allowMitigation = true } = {}) {
  if (report?.error || report?.auditReportVersion !== 2 || !report.vulnerabilities || !report.metadata?.vulnerabilities) throw new Error("Dependency audit returned an invalid result; release blocked.");
  const findings = report.vulnerabilities;
  function covered(name, seen = new Set()) {
    if (!allowMitigation || now >= Date.parse(mitigationExpiry) || !expectedChain.has(name) || seen.has(name)) return false;
    const item = findings[name];
    if (!item?.nodes?.length || !item.via?.length) return false;
    if (!item.nodes.every((path) => lock.packages[path]?.dev === true)) return false;
    const next = new Set([...seen, name]);
    return item.via.every((cause) => typeof cause === "string"
      ? covered(cause, next)
      : name === "braces" && cause.name === "braces" && cause.url === advisory
        && item.nodes.every((path) => lock.packages[path]?.version === "3.0.3"));
  }
  return {
    blocked: Object.keys(findings).filter((name) => !covered(name)),
    mitigated: Object.keys(findings).filter((name) => covered(name)),
  };
}

function runAudit(args) {
  // npm supplies its own CLI path: no shell interpolation or Windows cmd quoting.
  if (!process.env.npm_execpath) throw new Error("Run this check with npm run security:dependencies.");
  const result = spawnSync(process.execPath, [process.env.npm_execpath, "audit", "--json", ...args], { cwd: root, encoding: "utf8", timeout: 120000, maxBuffer: 8 * 1024 * 1024 });
  if (result.error || ![0, 1].includes(result.status)) throw new Error("Dependency audit could not complete; release blocked.");
  return JSON.parse(result.stdout);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  hardenTooling({ check: true });
  const lock = JSON.parse(readFileSync(resolve(root, "package-lock.json"), "utf8"));
  for (const productionOnly of [true, false]) {
    const report = runAudit(productionOnly ? ["--omit=dev"] : ["--include=dev"]);
    const result = auditFindings(report, lock, { allowMitigation: !productionOnly });
    if (result.blocked.length) throw new Error(`Unmitigated dependency alerts: ${result.blocked.join(", ")}. Release blocked.`);
    console.log(productionOnly ? "Production dependency audit: zero alerts." : "Full dependency audit: no unmitigated alerts.");
    if (result.mitigated.length) console.warn(`KNOWN UPSTREAM ALERT: ${advisory}; local depth protection verified. ${result.mitigated.length} affected dependency nodes, one advisory. Review expires ${mitigationExpiry}.`);
  }
}
