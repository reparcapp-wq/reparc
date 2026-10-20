// Temporary local mitigation for GHSA-vfj7-8cjw-p6xm. No upstream patch exists.
// Keep the npm package identity intact so registry warnings remain visible.
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const hash = (source) => createHash("sha256").update(source).digest("hex");
const guard = "    if (depth > 100) throw new SyntaxError('RepArc tooling: pattern nesting exceeds 100');\n";
export const patchSpecs = [
  { file: "lib/parse.js", hash: "e572166565f15fa6ad9865ae49d678218e32aabfd1b3720f6d0d43d39800d310", edits: [
    ["      stack.push(block);", "      if (stack.length > 100) throw new SyntaxError('RepArc tooling: pattern nesting exceeds 100');\n      stack.push(block);"],
  ] },
  { file: "lib/compile.js", hash: "dc98f22eee3d511785d92a00758d5f0d48efed5f5813bdecc2de430c529b5c9f", edits: [
    ["  const walk = (node, parent = {}) => {\n", "  const walk = (node, parent = {}, depth = 0) => {\n" + guard],
    ["walk(child, node)", "walk(child, node, depth + 1)"],
  ] },
  { file: "lib/expand.js", hash: "41ccc196ebfa7b7781a634e721eb744e4e7bcb54cba427a7e3d6806a1b9e58f7", edits: [
    ["  const walk = (node, parent = {}) => {\n", "  const walk = (node, parent = {}, depth = 0) => {\n" + guard],
    ["walk(child, node)", "walk(child, node, depth + 1)"],
  ] },
  { file: "lib/stringify.js", hash: "379f22d77bfa1478341ccd49c5e4267464aabcbba03558bab332aac23fc6f23a", edits: [
    ["  const stringify = (node, parent = {}) => {\n", "  const stringify = (node, parent = {}, depth = 0) => {\n" + guard],
    ["stringify(child)", "stringify(child, {}, depth + 1)"],
  ] },
];

export function hardenedSource(spec, source) {
  source = source.replace(/\r\n/g, "\n");
  let original = source;
  for (const [before, after] of [...spec.edits].reverse()) original = original.replaceAll(after, before);
  if (hash(original) !== spec.hash) throw new Error(`Unexpected braces source: ${spec.file}. Review upstream changes before building.`);
  let patched = original;
  for (const [before, after] of spec.edits) {
    if (!patched.includes(before)) throw new Error(`Patch no longer matches ${spec.file}`);
    patched = patched.replaceAll(before, after);
  }
  if (source !== original && source !== patched) throw new Error(`Partial tooling patch: ${spec.file}`);
  return patched;
}

export function hardenTooling({ check = false, projectRoot = root } = {}) {
  const lock = JSON.parse(readFileSync(resolve(projectRoot, "package-lock.json"), "utf8"));
  const locations = Object.entries(lock.packages).filter(([path]) => /(?:^|\/)node_modules\/braces$/.test(path));
  if (!locations.length) throw new Error("Review and remove the braces mitigation: dependency graph changed.");
  for (const [location, metadata] of locations) {
    if (!metadata.dev || metadata.version !== "3.0.3") throw new Error("Review braces mitigation: unexpected version or production dependency.");
    const directory = resolve(projectRoot, location);
    const installed = JSON.parse(readFileSync(resolve(directory, "package.json"), "utf8"));
    if (installed.name !== "braces" || installed.version !== "3.0.3") throw new Error("Unexpected installed braces package.");
    for (const spec of patchSpecs) {
      const path = resolve(directory, spec.file);
      const source = readFileSync(path, "utf8").replace(/\r\n/g, "\n");
      const patched = hardenedSource(spec, source);
      if (check && source !== patched) throw new Error(`Missing security patch: ${location}/${spec.file}. Run npm ci with lifecycle scripts enabled.`);
      if (!check && source !== patched) writeFileSync(path, patched);
    }
  }
  return locations.length;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const count = hardenTooling({ check: process.argv.includes("--check") });
  console.log(`Verified depth protection for ${count} braces installation(s). Upstream advisory remains tracked.`);
}
