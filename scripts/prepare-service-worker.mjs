import { createHash } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const serviceWorkerPath = path.join(root, "public", "sw.js");
const sourceRoots = ["app", "components", "hooks", "lib", "public", "scripts"];
const sourceFiles = ["next.config.ts", "package.json", "package-lock.json"];
const ignoredDirectories = new Set([".next", ".netlify", "dist", "node_modules"]);

async function walk(relativeDirectory) {
  const directory = path.join(root, relativeDirectory);
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const relativePath = path.join(relativeDirectory, entry.name);
    if (entry.isDirectory()) {
      if (!ignoredDirectories.has(entry.name)) files.push(...await walk(relativePath));
    } else if (relativePath !== path.join("public", "sw.js")) {
      files.push(relativePath);
    }
  }

  return files;
}

const hash = createHash("sha256");
for (const relativePath of [...sourceFiles, ...(await Promise.all(sourceRoots.map(walk))).flat()].sort()) {
  hash.update(relativePath.replaceAll("\\", "/"));
  hash.update(await readFile(path.join(root, relativePath)));
}

const currentWorker = await readFile(serviceWorkerPath, "utf8");
const normalizedWorker = currentWorker.replace(/const BUILD_ID = "[^"]+";/, 'const BUILD_ID = "pending";');
hash.update("public/sw.js");
hash.update(normalizedWorker);

const buildId = hash.digest("hex").slice(0, 12);
const nextWorker = normalizedWorker.replace('const BUILD_ID = "pending";', `const BUILD_ID = "${buildId}";`);

if (nextWorker !== currentWorker) await writeFile(serviceWorkerPath, nextWorker);
console.log(`Prepared service worker ${buildId}`);
