import { mergeTrainingData, normalizeTrainingData, type TrainingData } from "@/lib/training";

export type RestoreMode = "merge" | "replace";
export type BackupPreview = {
  data: TrainingData;
  sessions: number;
  weighIns: number;
  firstDate?: string;
  lastDate?: string;
  exportedAt?: string;
  sourceVersion: number;
};

type BackupEnvelope = {
  format: "my-progress-backup";
  formatVersion: 1;
  exportedAt: string;
  data: TrainingData;
};

export function createTrainingBackup(data: TrainingData, exportedAt = new Date().toISOString()): BackupEnvelope {
  return { format: "my-progress-backup", formatVersion: 1, exportedAt, data };
}

export function parseTrainingBackup(text: string): BackupPreview {
  if (text.length > 1_200_000) throw new Error("This backup is larger than the app can safely restore.");
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("This file is not valid JSON.");
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("This is not a RepArc backup.");
  const record = parsed as Record<string, unknown>;
  const envelope = record.format === "my-progress-backup";
  if (envelope && record.formatVersion !== 1) throw new Error("This backup format is newer than this app supports.");
  const raw = (envelope ? record.data : record) as Record<string, unknown>;
  const sourceVersion = Number(raw?.version);
  if (!Number.isInteger(sourceVersion) || sourceVersion < 2 || sourceVersion > 5) throw new Error("This backup version is not supported.");
  if (!Array.isArray(raw.sessions) || !raw.program || typeof raw.program !== "object") throw new Error("The backup is missing required training data.");
  if (raw.sessions.length > 5_000) throw new Error("This backup contains too many sessions to restore safely.");
  if (raw.weighIns !== undefined && !Array.isArray(raw.weighIns)) throw new Error("The backup contains an invalid weigh-in history.");
  const data = normalizeTrainingData(raw);
  const dates = data.sessions.map((session) => session.date).filter(Boolean).sort();
  return {
    data,
    sessions: data.sessions.length,
    weighIns: data.weighIns.length,
    firstDate: dates[0],
    lastDate: dates.at(-1),
    exportedAt: envelope && typeof record.exportedAt === "string" ? record.exportedAt : undefined,
    sourceVersion,
  };
}

export function restoredTrainingData(current: TrainingData, imported: TrainingData, mode: RestoreMode, now = new Date().toISOString()) {
  const data = mode === "merge" ? mergeTrainingData(current, imported) : normalizeTrainingData(imported);
  return { ...data, updatedAt: now };
}

export function downloadTrainingBackup(data: TrainingData, filename = "training-backup.json") {
  const blob = new Blob([JSON.stringify(createTrainingBackup(data), null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}
