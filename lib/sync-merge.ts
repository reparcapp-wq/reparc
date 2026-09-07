import { recalculatePhase2Progression, type TrainingData } from "@/lib/training";

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
type ObjectValue = Record<string, unknown>;
const object = (value: unknown): value is ObjectValue => Boolean(value && typeof value === "object" && !Array.isArray(value));

// Compare each edit to the last confirmed cloud snapshot, never to a device clock.
// Concurrent edits to the same scalar retain the confirmed cloud value; the full
// pending local copy is retained in offline storage for an explicit recovery export.
export function reconcileTrainingData(local: TrainingData, remote: TrainingData, base?: TrainingData): { data: TrainingData; conflicts: string[] } {
  const conflicts: string[] = [];
  function resolve(left: unknown, right: unknown, before: unknown, path: string): unknown {
    if (same(left, right)) return right;
    if (same(right, before)) return left;
    if (same(left, before) || left === undefined) return right;
    if (right === undefined) return left;
    if (object(left) && object(right)) {
      const previous = object(before) ? before : {};
      return Object.fromEntries([...new Set([...Object.keys(left), ...Object.keys(right)])].map((key) => [key, resolve(left[key], right[key], previous[key], path ? `${path}.${key}` : key)]));
    }
    if (Array.isArray(left) && Array.isArray(right) && ["sessions", "sessionRevisions", "weighIns", "planHistory", "absences", "exerciseRecovery", "program.weekRecords"].includes(path)) {
      const key = (item: ObjectValue) => String(path === "sessions" ? item.logicalKey ?? item.id : item.id ?? `${item.programId}:${item.week}:${item.frequency}:${item.status}:${item.at}`);
      const a = new Map(left.map((item) => [key(item), item]));
      const b = new Map(right.map((item) => [key(item), item]));
      const c = new Map((Array.isArray(before) ? before : []).map((item) => [key(item), item]));
      return [...new Set([...a.keys(), ...b.keys()])].map((id) => {
        const l = a.get(id), r = b.get(id), old = c.get(id);
        if (!r) return l;
        if (!l || same(l, old) || same(l, r)) return r;
        if (same(r, old)) return l;
        // Whole snapshots remain atomic, including entries and progression metadata.
        conflicts.push(`${path}.${id}`); return r;
      });
    }
    if (path !== "updatedAt") conflicts.push(path);
    return right;
  }
  const result = structuredClone(resolve(local, remote, base, "")) as TrainingData;
  result.updatedAt = remote.updatedAt;
  result.sessions = [...result.sessions].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
  result.weighIns = [...result.weighIns].sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  result.planHistory = [...result.planHistory].sort((a, b) => a.effectiveAt.localeCompare(b.effectiveAt));
  return { data: recalculatePhase2Progression(result), conflicts };
}
