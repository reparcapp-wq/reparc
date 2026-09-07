"use client";

import {
  commitOfflineSync,
  deleteOfflineAccount,
  readOfflineDrafts,
  readOfflineProfile,
  requestPersistentStorage,
  seedOfflineProfile,
  storeMergedOfflineProfile,
  resolveMergedOfflineRecord,
  resolveOfflineSyncCommit,
  type MergedRecordOptions,
  writeOfflineDrafts,
  writePendingOfflineProfile,
  type OfflineProfileRecord,
} from "@/lib/offline-store";
import { normalizeTrainingData, slugify, type TrainingData } from "@/lib/training";
import { reconcileTrainingData } from "@/lib/sync-merge";
import { joinArchive, splitArchive, validArchive } from "@/lib/cloud-archive";

const CURRENT_KEY = "training-app-v5";
const LEGACY_KEY = "training-app-v4";
const OLDER_KEY = "training-app-v3";
const OLDEST_KEY = "training-app-v2";
const WHOAMI_KEY = "training-app-whoami";
const LEGACY_MIGRATED_KEY = "training-app-legacy-migrated";
const ACCOUNT_MIGRATION_KEY = "training-app-account-owner-v1";
const DRAFT_KEY = "training-drafts-v1";
const FALLBACK_SYNC_KEY = "training-sync-meta-v1";

type SyncMode = "merge" | "replace";
const localKey = (identity: string, version = CURRENT_KEY) => `${version}:${slugify(identity)}`;
const profileKey = (identity: string) => slugify(identity);
const nameKey = (identity: string) => `${WHOAMI_KEY}:${profileKey(identity)}`;
const ownerKey = (legacyName: string) => `${ACCOUNT_MIGRATION_KEY}:${slugify(legacyName)}`;

export type TrainingSyncResult = {
  data: TrainingData;
  saved: boolean;
  synced: boolean;
  pending: boolean;
  lastSyncedAt?: string;
};

type RemoteResult =
  | { available: true; data: TrainingData | null; revision: number }
  | { available: false; data: null; revision: number };

const activeSyncs = new Map<string, Promise<TrainingSyncResult>>();

export const savedName = (identity: string) => {
  try {
    const scoped = window.localStorage.getItem(nameKey(identity));
    if (scoped) return scoped;
    const legacy = window.localStorage.getItem(WHOAMI_KEY) ?? "";
    if (legacy) window.localStorage.setItem(nameKey(identity), legacy);
    return legacy;
  } catch {
    return "";
  }
};

export const rememberName = (identity: string, name: string) => {
  try {
    window.localStorage.setItem(nameKey(identity), name);
  } catch {
    // The display name remains in memory for this visit.
  }
};

export const forgetName = (identity: string) => {
  try {
    window.localStorage.removeItem(nameKey(identity));
  } catch {
    // Nothing else to clear.
  }
};

export async function clearAccountDeviceData(identity: string) {
  const key = profileKey(identity);
  try {
    await deleteOfflineAccount(key);
  } catch {
    // localStorage cleanup below still removes the fallback copies.
  }
  activeSyncs.delete(identity);
  try {
    [CURRENT_KEY, LEGACY_KEY, OLDER_KEY, OLDEST_KEY, DRAFT_KEY, FALLBACK_SYNC_KEY]
      .forEach((version) => window.localStorage.removeItem(localKey(identity, version)));
    window.localStorage.removeItem(nameKey(identity));
    window.localStorage.removeItem(`my-progress-onboarding-v2:${key}`);
    window.localStorage.removeItem(`reparc-overview-v1:${identity}`);
  } catch {
    // The server-side account deletion remains authoritative.
  }
}

const legacyAvailableToAccount = (identity: string, legacyName?: string) => {
  if (!legacyName) return false;
  try {
    const owner = window.localStorage.getItem(ownerKey(legacyName));
    return !owner || owner === profileKey(identity);
  } catch {
    return true;
  }
};

const markLegacyOwner = (identity: string, legacyName?: string) => {
  if (!legacyName) return;
  try {
    window.localStorage.setItem(ownerKey(legacyName), profileKey(identity));
  } catch {
    // The account-scoped IndexedDB key remains the primary boundary.
  }
};

function readVersions(identity: string) {
  const current = window.localStorage.getItem(localKey(identity));
  if (current) return normalizeTrainingData(JSON.parse(current));
  const legacy = window.localStorage.getItem(localKey(identity, LEGACY_KEY));
  if (legacy) return normalizeTrainingData(JSON.parse(legacy));
  const older = window.localStorage.getItem(localKey(identity, OLDER_KEY));
  if (older) return normalizeTrainingData(JSON.parse(older));
  const oldest = window.localStorage.getItem(localKey(identity, OLDEST_KEY));
  return oldest ? normalizeTrainingData(JSON.parse(oldest)) : null;
}

function readLegacyLocal(identity: string, legacyName?: string) {
  try {
    const scoped = readVersions(identity);
    if (scoped) return scoped;
    if (!legacyAvailableToAccount(identity, legacyName)) return null;
    const named = legacyName ? readVersions(legacyName) : null;
    if (named) return named;
    const migrated = window.localStorage.getItem(LEGACY_MIGRATED_KEY);
    const unscopedLegacy = !migrated
      ? window.localStorage.getItem(LEGACY_KEY) ?? window.localStorage.getItem(OLDER_KEY) ?? window.localStorage.getItem(OLDEST_KEY)
      : null;
    if (unscopedLegacy) {
      window.localStorage.setItem(LEGACY_MIGRATED_KEY, "1");
      return normalizeTrainingData(JSON.parse(unscopedLegacy));
    }
  } catch {
    return null;
  }
  return null;
}

function writeLegacyLocal(identity: string, data: TrainingData) {
  try {
    window.localStorage.setItem(localKey(identity), JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

function readFallbackRecord(identity: string): OfflineProfileRecord | null {
  try {
    const raw = window.localStorage.getItem(localKey(identity, FALLBACK_SYNC_KEY));
    if (!raw) return null;
    const record = JSON.parse(raw) as OfflineProfileRecord;
    return record?.data ? { ...record, data: normalizeTrainingData(record.data) } : null;
  } catch {
    return null;
  }
}

function writeFallbackRecord(identity: string, record: OfflineProfileRecord) {
  try {
    window.localStorage.setItem(localKey(identity, FALLBACK_SYNC_KEY), JSON.stringify(record));
    return true;
  } catch {
    return false;
  }
}

async function readLocalRecord(identity: string, legacyName?: string) {
  const key = profileKey(identity);
  try {
    const record = await readOfflineProfile(key);
    if (record) return { ...record, data: normalizeTrainingData(record.data) };
    if (legacyName && legacyAvailableToAccount(identity, legacyName)) {
      const legacyRecord = await readOfflineProfile(profileKey(legacyName));
      if (legacyRecord) {
        const seeded = await seedOfflineProfile(key, normalizeTrainingData(legacyRecord.data), { dirty: true });
        writeLegacyLocal(identity, seeded.data);
        markLegacyOwner(identity, legacyName);
        return seeded;
      }
    }
    const legacy = readLegacyLocal(identity, legacyName);
    if (!legacy) return null;
    const seeded = await seedOfflineProfile(key, legacy, { dirty: true });
    writeLegacyLocal(identity, seeded.data);
    markLegacyOwner(identity, legacyName);
    return seeded;
  } catch {
    const fallback = readFallbackRecord(identity);
    if (fallback) return fallback;
    const legacy = readLegacyLocal(identity, legacyName);
    if (!legacy) return null;
    const now = new Date().toISOString();
    const record: OfflineProfileRecord = { key, data: legacy, revision: 1, dirty: true, syncMode: "merge", pendingSince: now, updatedAt: now };
    writeFallbackRecord(identity, record);
    writeLegacyLocal(identity, legacy);
    markLegacyOwner(identity, legacyName);
    return record;
  }
}

async function writePendingRecord(identity: string, data: TrainingData, mode: SyncMode = "merge") {
  const key = profileKey(identity);
  const legacySaved = writeLegacyLocal(identity, data);
  try {
    return { record: await writePendingOfflineProfile(key, data, mode), saved: true };
  } catch {
    const current = readFallbackRecord(identity);
    const now = new Date().toISOString();
    const record: OfflineProfileRecord = {
      key,
      data,
      revision: (current?.revision ?? 0) + 1,
      serverRevision: current?.serverRevision,
      baseData: current?.baseData ?? (current && !current.dirty ? current.data : undefined),
      conflictBackup: current?.conflictBackup,
      dirty: true,
      syncMode: current?.dirty && current.syncMode === "replace" ? "replace" : mode,
      pendingSince: current?.pendingSince ?? now,
      lastSyncedAt: current?.lastSyncedAt,
      updatedAt: now,
    };
    return { record, saved: writeFallbackRecord(identity, record) || legacySaved };
  }
}

async function storeMergedRecord(identity: string, data: TrainingData, options: MergedRecordOptions) {
  const key = profileKey(identity);
  try {
    const record = await storeMergedOfflineProfile(key, data, options);
    writeLegacyLocal(identity, record.data);
    return record;
  } catch {
    const current = readFallbackRecord(identity);
    const now = new Date().toISOString();
    const record = resolveMergedOfflineRecord(key, current ?? undefined, data, options, now);
    writeFallbackRecord(identity, record);
    writeLegacyLocal(identity, record.data);
    return record;
  }
}

async function commitSyncRecord(identity: string, uploadedRevision: number, remoteData: TrainingData, remoteRevision?: number, uploadedData?: TrainingData) {
  const key = profileKey(identity);
  try {
    const record = await commitOfflineSync(key, uploadedRevision, remoteData, remoteRevision, uploadedData);
    writeLegacyLocal(identity, record.data);
    return record;
  } catch {
    const current = await readLocalRecord(identity);
    const now = new Date().toISOString();
    const record = resolveOfflineSyncCommit(key, current ?? undefined, uploadedRevision, remoteData, now, remoteRevision, uploadedData);
    writeFallbackRecord(identity, record);
    writeLegacyLocal(identity, record.data);
    return record;
  }
}

const pruneDrafts = (drafts: Record<string, unknown>) => {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 14);
  const cutoffDate = cutoff.toISOString().slice(0, 10);
  return Object.fromEntries(Object.entries(drafts).filter(([key, value]) => {
    const date = key.match(/\d{4}-\d{2}-\d{2}/)?.[0];
    return (!date || date >= cutoffDate) && value && typeof value === "object";
  }));
};

export async function loadDrafts(identity: string, legacyName?: string) {
  const key = profileKey(identity);
  try {
    const stored = await readOfflineDrafts(key);
    if (stored) return pruneDrafts(stored);
    if (legacyName && legacyAvailableToAccount(identity, legacyName)) {
      const legacyStored = await readOfflineDrafts(profileKey(legacyName));
      if (legacyStored) {
        const drafts = pruneDrafts(legacyStored);
        await writeOfflineDrafts(key, drafts);
        markLegacyOwner(identity, legacyName);
        return drafts;
      }
    }
  } catch {
    // Fall through to a localStorage copy.
  }
  try {
    const accountRaw = window.localStorage.getItem(localKey(identity, DRAFT_KEY));
    const legacyRaw = !accountRaw && legacyAvailableToAccount(identity, legacyName) && legacyName
      ? window.localStorage.getItem(localKey(legacyName, DRAFT_KEY))
      : null;
    const raw = accountRaw ?? legacyRaw;
    if (!raw) return {};
    const drafts = pruneDrafts(JSON.parse(raw) as Record<string, unknown>);
    window.localStorage.setItem(localKey(identity, DRAFT_KEY), JSON.stringify(drafts));
    void writeOfflineDrafts(key, drafts).catch(() => undefined);
    return drafts;
  } catch {
    return {};
  }
}

export async function saveDrafts(identity: string, drafts: Record<string, unknown>) {
  const key = profileKey(identity);
  try {
    window.localStorage.setItem(localKey(identity, DRAFT_KEY), JSON.stringify(drafts));
  } catch {
    // IndexedDB remains the primary draft store.
  }
  try {
    await writeOfflineDrafts(key, drafts);
  } catch {
    // Completed sessions still use the main save path.
  }
}

async function timedFetch(input: RequestInfo | URL, init?: RequestInit, timeoutMs = 8_000) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    window.clearTimeout(timeout);
  }
}

async function hydrateCloudPayload(payload: { data?: unknown; archive?: unknown; updatedAt?: string }) {
  if (payload.archive !== undefined) {
    if (!validArchive(payload.archive)) throw new Error("Invalid cloud archive");
    const data = await joinArchive(payload.archive, async (id) => {
      const response = await timedFetch(`/api/training/chunks?id=${encodeURIComponent(id)}`, { cache: "no-store" });
      if (!response.ok) throw new Error("Incomplete cloud history");
      return (await response.json() as { text: string }).text;
    });
    return normalizeTrainingData(data, payload.updatedAt);
  }
  return payload.data ? normalizeTrainingData(payload.data, payload.updatedAt) : null;
}

async function readRemote(): Promise<RemoteResult> {
  if (!navigator.onLine) return { available: false, data: null, revision: 0 };
  try {
    const response = await timedFetch("/api/training", { cache: "no-store", headers: { "x-reparc-history": "11" } });
    if (response.status === 401) window.dispatchEvent(new Event("my-progress-auth-required"));
    if (response.status === 404) return { available: true, data: null, revision: 0 };
    if (!response.ok) return { available: false, data: null, revision: 0 };
    const payload = await response.json();
    return { available: true, data: await hydrateCloudPayload(payload), revision: Math.max(0, Math.trunc(Number(payload.revision) || 0)) };
  } catch {
    return { available: false, data: null, revision: 0 };
  }
}

async function uploadProfile(data: TrainingData, mode: SyncMode, baseRevision = 0) {
  if (!navigator.onLine) throw new Error("Offline");
  const useArchive = new TextEncoder().encode(JSON.stringify(data)).byteLength > 600_000;
  const prepared = useArchive ? await splitArchive(data) : null;
  if (prepared) {
    for (const chunk of prepared.chunks) {
      const staged = await timedFetch("/api/training/chunks", { method: "PUT", headers: { "Content-Type": "application/json", "x-reparc-request": "1" }, body: JSON.stringify(chunk) });
      if (!staged.ok) throw new Error("Archive upload incomplete");
    }
  }
  const response = await timedFetch("/api/training", {
    method: "PUT",
    headers: { "Content-Type": "application/json", "X-RepArc-Request": "1", "x-reparc-history": "11" },
    body: JSON.stringify(prepared ? { archive: prepared.manifest, mode, baseRevision } : { data, mode, baseRevision }),
  }, prepared ? 60_000 : 15_000);
  if (response.status === 401) window.dispatchEvent(new Event("my-progress-auth-required"));
  if (response.status === 409) {
    const payload = await response.json();
    return {
      conflict: true as const,
      data: await hydrateCloudPayload(payload) ?? data,
      revision: Math.max(0, Math.trunc(Number(payload.revision) || 0)),
    };
  }
  if (!response.ok) throw new Error("Cloud save unavailable");
  const payload = await response.json();
  return {
    conflict: false as const,
    data: prepared && validArchive(payload.archive) && JSON.stringify(payload.archive) === JSON.stringify(prepared.manifest) ? normalizeTrainingData(data, payload.updatedAt) : await hydrateCloudPayload(payload) ?? data,
    revision: Math.max(0, Math.trunc(Number(payload.revision) || baseRevision + 1)),
  };
}

async function runSync(identity: string): Promise<TrainingSyncResult> {
  let latest = await readLocalRecord(identity);
  if (!latest) throw new Error("No local profile to sync");
  for (let attempt = 0; attempt < 8; attempt += 1) {
    if (!latest.dirty) return { data: latest.data, saved: true, synced: true, pending: false, lastSyncedAt: latest.lastSyncedAt };
    try {
      const remote = await uploadProfile(latest.data, latest.syncMode ?? "merge", latest.serverRevision ?? 0);
      if (remote.conflict) {
        const merged = reconcileTrainingData(latest.data, remote.data, latest.baseData);
        latest = await storeMergedRecord(identity, merged.data, { dirty: true, lastSyncedAt: latest.lastSyncedAt, serverRevision: remote.revision, baseData: remote.data, conflictBackup: merged.conflicts.length ? latest.data : undefined, expectedRevision: latest.revision, observedData: latest.data });
        continue;
      }
      latest = await commitSyncRecord(identity, latest.revision, remote.data, remote.revision, latest.data);
    } catch {
      latest = await readLocalRecord(identity) ?? latest;
      return { data: latest.data, saved: true, synced: false, pending: true, lastSyncedAt: latest.lastSyncedAt };
    }
  }
  return { data: latest.data, saved: true, synced: false, pending: latest.dirty, lastSyncedAt: latest.lastSyncedAt };
}

export async function syncTrainingData(identity: string): Promise<TrainingSyncResult> {
  const key = profileKey(identity);
  const active = activeSyncs.get(key);
  if (active) {
    const completed = await active;
    const latest = await readLocalRecord(identity);
    if (latest?.dirty) return syncTrainingData(identity);
    return completed;
  }
  const sync = runSync(identity).finally(() => activeSyncs.delete(key));
  activeSyncs.set(key, sync);
  return sync;
}

export async function loadTrainingData(identity: string, legacyName?: string) {
  void requestPersistentStorage();
  const local = await readLocalRecord(identity, legacyName);
  const remote = await readRemote();
  if (!remote.available) return { data: local?.data ?? null, cloudAvailable: false, pending: local?.dirty ?? false, lastSyncedAt: local?.lastSyncedAt };
  if (!local && !remote.data) return { data: null, cloudAvailable: true, pending: false, lastSyncedAt: undefined };
  if (!local && remote.data) {
    const record = await storeMergedRecord(identity, remote.data, { dirty: false, lastSyncedAt: new Date().toISOString(), serverRevision: remote.revision, expectedRevision: 0 });
    return { data: record.data, cloudAvailable: true, pending: record.dirty, lastSyncedAt: record.lastSyncedAt };
  }
  const reconciliation = remote.data && local!.dirty ? reconcileTrainingData(local!.data, remote.data, local!.baseData) : null;
  const merged = reconciliation?.data ?? remote.data ?? local!.data;
  const remoteSnapshot = remote.data ? JSON.stringify(remote.data) : "";
  const needsUpload = Boolean(local!.dirty || !remote.data || JSON.stringify(merged) !== remoteSnapshot);
  const record = await storeMergedRecord(identity, merged, { dirty: needsUpload, lastSyncedAt: local!.lastSyncedAt, serverRevision: remote.revision, baseData: remote.data ?? undefined, conflictBackup: reconciliation?.conflicts.length ? local!.data : undefined, expectedRevision: local!.revision, observedData: local!.data });
  if (!record.dirty) return { data: record.data, cloudAvailable: true, pending: false, lastSyncedAt: record.lastSyncedAt };
  const result = await syncTrainingData(identity);
  return { data: result.data, cloudAvailable: result.synced, pending: result.pending, lastSyncedAt: result.lastSyncedAt };
}

async function saveWithMode(identity: string, data: TrainingData, mode: SyncMode): Promise<TrainingSyncResult> {
  const local = await writePendingRecord(identity, data, mode);
  if (!local.saved) return { data, saved: false, synced: false, pending: false };
  const result = await syncTrainingData(identity);
  return { ...result, saved: true };
}

export const saveTrainingData = (identity: string, data: TrainingData) => saveWithMode(identity, data, "merge");
export const replaceTrainingData = (identity: string, data: TrainingData) => saveWithMode(identity, data, "replace");

export async function readSyncConflictBackup(identity: string) {
  return (await readLocalRecord(identity))?.conflictBackup ?? null;
}
