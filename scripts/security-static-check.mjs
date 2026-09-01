import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";

const trackedFiles = execFileSync("git", ["ls-files", "-z"], { encoding: "utf8" })
  .split("\0")
  .filter(Boolean)
  .filter((path) => !path.startsWith(".next/") && !path.startsWith("dist/") && path !== "scripts/security-static-check.mjs")
  .filter((path) => /\.(?:[cm]?[jt]sx?|json|ya?ml|md|sql)$/i.test(path));

const checks = [
  { label: "private key", pattern: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/ },
  { label: "GitHub token", pattern: /\b(?:ghp|github_pat)_[A-Za-z0-9_]{20,}\b/ },
  { label: "payment or OpenAI secret", pattern: /\b(?:sk_live_|sk-proj-)[A-Za-z0-9_-]{16,}\b/ },
  { label: "assigned service-role secret", pattern: /SUPABASE_SERVICE_ROLE_KEY\s*[:=]\s*["'][^$<][^"']{15,}["']/ },
  { label: "dynamic code execution", pattern: /\b(?:eval\s*\(|new\s+Function\s*\()/ },
];

const findings = [];
for (const path of trackedFiles) {
  const source = await readFile(path, "utf8").catch((error) => {
    if (error?.code === "ENOENT") return null;
    throw error;
  });
  if (source === null) continue;
  for (const check of checks) {
    if (check.pattern.test(source)) findings.push(`${path}: ${check.label}`);
  }
}

if (findings.length) {
  console.error("Security scan failed:\n" + findings.map((finding) => `- ${finding}`).join("\n"));
  process.exit(1);
}

console.log(`Security scan passed across ${trackedFiles.length} tracked text files.`);
