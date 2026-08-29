export const APP_RELEASE = process.env.NEXT_PUBLIC_APP_RELEASE ?? "unknown";

const allowedContextKeys = new Set([
  "online",
  "installed",
  "route",
  "syncState",
  "view",
  "release",
  "browser",
]);

export function sanitizeDiagnosticMessage(value: unknown, maximum = 400) {
  return String(value ?? "Unexpected application error")
    .replace(/[\r\n\t]+/g, " ")
    .replace(/https?:\/\/\S+/gi, "[url]")
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[email]")
    .replace(/\b(?:eyJ|sb_[a-z]+_)[A-Za-z0-9._-]{20,}\b/g, "[token]")
    .replace(/\b[0-9a-f]{8}-[0-9a-f-]{27,}\b/gi, "[id]")
    .replace(/\s{2,}/g, " ")
    .trim()
    .slice(0, maximum);
}

export function sanitizeAppContext(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value as Record<string, unknown>)
    .filter(([key, entry]) => allowedContextKeys.has(key) && ["string", "number", "boolean"].includes(typeof entry))
    .map(([key, entry]) => [key, typeof entry === "string" ? sanitizeDiagnosticMessage(entry, 80) : entry]));
}
