"use client";

import type { TrainingData } from "@/lib/training";
import { reconcileTrainingData } from "@/lib/sync-merge";

const DATABASE_NAME = "my-progress-offline";
const DATABASE_VERSION = 1;
const PROFILE_STORE = "profiles";
const DRAFT_STORE = "drafts";

export type OfflineProfileRecord = {
  key: string;
  data: TrainingData;
  revision: number;
  serverRevision?: number;
  baseData?: TrainingData;
  conflictBackup?: TrainingData;
  dirty: boolean;
  syncMode?: "merge" | "replace";
  pendingSince?: string;
  lastSyncedAt?: string;
  updatedAt: string;
};

export function nextPendingOfflineRecord(
  key: string,
  current: OfflineProfileRecord | undefined,
  data: TrainingData,
  mode: "merge" | "replace" = "merge",
  now = new Date().toISOString(),
): OfflineProfileRecord {
  return {
    key,
    data,
    revision: (current?.revision ?? 0) + 1,
    serverRevision: current?.serverRevision,
    baseData: current?.baseData ?? (current && !current.dirty ? current.data : undefined),
    conflictBackup: current?.conflictBackup,
    dirty: true,
    syncMode: current?.dirty && current.syncMode === "replace" ? "replace" : mode,
    pendingSince: current?.dirty ? current.pendingSince ?? now : now,
    lastSyncedAt: current?.lastSyncedAt,
    updatedAt: now,
  };
}

export function resolveOfflineSyncCommit(
  key: string,
  current: OfflineProfileRecord | undefined,
  uploadedRevision: number,
  remoteData: TrainingData,
  now = new Date().toISOString(),
  remoteRevision?: number,
  uploadedData?: TrainingData,
): OfflineProfileRecord {
  const hasNewerLocalWrite = Boolean(current && current.revision !== uploadedRevision);
  const reconciliation = current && hasNewerLocalWrite ? reconcileTrainingData(current.data, remoteData, uploadedData ?? current.baseData) : null;
  const latestData = reconciliation?.data ?? remoteData;
  return {
    key,
    data: latestData,
    revision: current?.revision ?? uploadedRevision,
    serverRevision: remoteRevision ?? current?.serverRevision,
    baseData: remoteData,
    conflictBackup: reconciliation?.conflicts.length ? current?.data : current?.conflictBackup,
    dirty: hasNewerLocalWrite,
    syncMode: hasNewerLocalWrite ? current?.syncMode ?? "merge" : undefined,
    pendingSince: hasNewerLocalWrite ? current?.pendingSince ?? now : undefined,
    lastSyncedAt: now,
    updatedAt: now,
  };
}

type DraftRecord = {
  key: string;
  drafts: Record<string, unknown>;
  updatedAt: string;
};

export type MergedRecordOptions = { dirty: boolean; lastSyncedAt?: string; serverRevision?: number; baseData?: TrainingData; conflictBackup?: TrainingData; expectedRevision?: number; observedData?: TrainingData };

// Run inside the same serialized write as the IndexedDB read. A cloud response
// must never overwrite a workout edit made while that response was in flight.
export function resolveMergedOfflineRecord(key: string, current: OfflineProfileRecord | undefined, data: TrainingData, options: MergedRecordOptions, now = new Date().toISOString()): OfflineProfileRecord {
  const newer = Boolean(current && options.expectedRevision !== undefined && current.revision !== options.expectedRevision);
  const rebased = newer && current ? reconcileTrainingData(current.data, data, options.observedData) : null;
  const dirty = options.dirty || newer;
  return {
    key, data: rebased?.data ?? data,
    revision: (current?.revision ?? 0) + 1,
    serverRevision: options.serverRevision ?? current?.serverRevision,
    baseData: options.baseData ?? (options.dirty ? current?.baseData : data),
    conflictBackup: rebased?.conflicts.length ? current?.data : options.conflictBackup ?? current?.conflictBackup,
    dirty, syncMode: dirty ? current?.syncMode ?? "merge" : undefined,
    pendingSince: dirty ? current?.pendingSince ?? now : undefined,
    lastSyncedAt: options.lastSyncedAt ?? current?.lastSyncedAt, updatedAt: now,
  };
}

let databasePromise: Promise<IDBDatabase> | null = null;
let writeQueue: Promise<unknown> = Promise.resolve();

const requestResult = <T>(request: IDBRequest<T>) => new Promise<T>((resolve, reject) => {
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error ?? new Error("IndexedDB request failed"));
});

const transactionDone = (transaction: IDBTransaction) => new Promise<void>((resolve, reject) => {
  transaction.oncomplete = () => resolve();
  transaction.onerror = () => reject(transaction.error ?? new Error("IndexedDB transaction failed"));
  transaction.onabort = () => reject(transaction.error ?? new Error("IndexedDB transaction aborted"));
});

const openDatabase = () => {
  if (typeof indexedDB === "undefined") return Promise.reject(new Error("IndexedDB is unavailable"));
  if (databasePromise) return databasePromise;
  databasePromise = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(PROFILE_STORE)) database.createObjectStore(PROFILE_STORE, { keyPath: "key" });
      if (!database.objectStoreNames.contains(DRAFT_STORE)) database.createObjectStore(DRAFT_STORE, { keyPath: "key" });
    };
    request.onsuccess = () => {
      const database = request.result;
      database.onversionchange = () => {
        database.close();
        databasePromise = null;
      };
      resolve(database);
    };
    request.onerror = () => {
      databasePromise = null;
      reject(request.error ?? new Error("Could not open offline database"));
    };
    request.onblocked = () => reject(new Error("Offline database upgrade is blocked"));
  });
  return databasePromise;
};

const queueWrite = <T>(operation: () => Promise<T>) => {
  const result = writeQueue.then(operation, operation);
  writeQueue = result.then(() => undefined, () => undefined);
  return result;
};

export async function readOfflineProfile(key: string) {
  const database = await openDatabase();
  const transaction = database.transaction(PROFILE_STORE, "readonly");
  return requestResult(transaction.objectStore(PROFILE_STORE).get(key)) as Promise<OfflineProfileRecord | undefined>;
}

export function writePendingOfflineProfile(key: string, data: TrainingData, mode: "merge" | "replace" = "merge") {
  return queueWrite(async () => {
    const database = await openDatabase();
    const transaction = database.transaction(PROFILE_STORE, "readwrite");
    const store = transaction.objectStore(PROFILE_STORE);
    const current = await requestResult(store.get(key)) as OfflineProfileRecord | undefined;
    const now = new Date().toISOString();
    const record = nextPendingOfflineRecord(key, current, data, mode, now);
    store.put(record);
    await transactionDone(transaction);
    return record;
  });
}

export function seedOfflineProfile(key: string, data: TrainingData, options: { dirty: boolean; lastSyncedAt?: string; serverRevision?: number }) {
  return queueWrite(async () => {
    const database = await openDatabase();
    const transaction = database.transaction(PROFILE_STORE, "readwrite");
    const store = transaction.objectStore(PROFILE_STORE);
    const current = await requestResult(store.get(key)) as OfflineProfileRecord | undefined;
    if (current) {
      await transactionDone(transaction);
      return current;
    }
    const now = new Date().toISOString();
    const record: OfflineProfileRecord = {
      key,
      data,
      revision: 1,
      serverRevision: options.serverRevision,
      baseData: options.dirty ? undefined : data,
      dirty: options.dirty,
      syncMode: options.dirty ? "merge" : undefined,
      pendingSince: options.dirty ? now : undefined,
      lastSyncedAt: options.lastSyncedAt,
      updatedAt: now,
    };
    store.put(record);
    await transactionDone(transaction);
    return record;
  });
}

export function storeMergedOfflineProfile(
  key: string,
  data: TrainingData,
  options: MergedRecordOptions,
) {
  return queueWrite(async () => {
    const database = await openDatabase();
    const transaction = database.transaction(PROFILE_STORE, "readwrite");
    const store = transaction.objectStore(PROFILE_STORE);
    const current = await requestResult(store.get(key)) as OfflineProfileRecord | undefined;
    const now = new Date().toISOString();
    const record = resolveMergedOfflineRecord(key, current, data, options, now);
    store.put(record);
    await transactionDone(transaction);
    return record;
  });
}

export function commitOfflineSync(key: string, uploadedRevision: number, remoteData: TrainingData, remoteRevision?: number, uploadedData?: TrainingData) {
  return queueWrite(async () => {
    const database = await openDatabase();
    const transaction = database.transaction(PROFILE_STORE, "readwrite");
    const store = transaction.objectStore(PROFILE_STORE);
    const current = await requestResult(store.get(key)) as OfflineProfileRecord | undefined;
    const now = new Date().toISOString();
    const record = resolveOfflineSyncCommit(key, current, uploadedRevision, remoteData, now, remoteRevision, uploadedData);
    store.put(record);
    await transactionDone(transaction);
    return record;
  });
}

export async function readOfflineDrafts(key: string) {
  const database = await openDatabase();
  const transaction = database.transaction(DRAFT_STORE, "readonly");
  const result = await requestResult(transaction.objectStore(DRAFT_STORE).get(key)) as DraftRecord | undefined;
  return result?.drafts ?? null;
}

export function writeOfflineDrafts(key: string, drafts: Record<string, unknown>) {
  return queueWrite(async () => {
    const database = await openDatabase();
    const transaction = database.transaction(DRAFT_STORE, "readwrite");
    transaction.objectStore(DRAFT_STORE).put({ key, drafts, updatedAt: new Date().toISOString() } satisfies DraftRecord);
    await transactionDone(transaction);
  });
}

export function deleteOfflineAccount(key: string) {
  return queueWrite(async () => {
    const database = await openDatabase();
    const transaction = database.transaction([PROFILE_STORE, DRAFT_STORE], "readwrite");
    transaction.objectStore(PROFILE_STORE).delete(key);
    transaction.objectStore(DRAFT_STORE).delete(key);
    await transactionDone(transaction);
  });
}

export async function requestPersistentStorage() {
  if (typeof navigator === "undefined" || !navigator.storage?.persist) return false;
  try {
    if (await navigator.storage.persisted?.()) return true;
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}
