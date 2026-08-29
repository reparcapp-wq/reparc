"use client";

import { mergeTrainingData, type TrainingData } from "@/lib/training";

const DATABASE_NAME = "my-progress-offline";
const DATABASE_VERSION = 1;
const PROFILE_STORE = "profiles";
const DRAFT_STORE = "drafts";

export type OfflineProfileRecord = {
  key: string;
  data: TrainingData;
  revision: number;
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
): OfflineProfileRecord {
  const latestData = current ? mergeTrainingData(current.data, remoteData) : remoteData;
  const hasNewerLocalWrite = Boolean(current && current.revision !== uploadedRevision);
  return {
    key,
    data: latestData,
    revision: current?.revision ?? uploadedRevision,
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

export function seedOfflineProfile(key: string, data: TrainingData, options: { dirty: boolean; lastSyncedAt?: string }) {
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
  options: { dirty: boolean; lastSyncedAt?: string },
) {
  return queueWrite(async () => {
    const database = await openDatabase();
    const transaction = database.transaction(PROFILE_STORE, "readwrite");
    const store = transaction.objectStore(PROFILE_STORE);
    const current = await requestResult(store.get(key)) as OfflineProfileRecord | undefined;
    const now = new Date().toISOString();
    const record: OfflineProfileRecord = {
      key,
      data,
      revision: (current?.revision ?? 0) + 1,
      dirty: options.dirty,
      syncMode: options.dirty ? current?.syncMode ?? "merge" : undefined,
      pendingSince: options.dirty ? current?.pendingSince ?? now : undefined,
      lastSyncedAt: options.lastSyncedAt ?? current?.lastSyncedAt,
      updatedAt: now,
    };
    store.put(record);
    await transactionDone(transaction);
    return record;
  });
}

export function commitOfflineSync(key: string, uploadedRevision: number, remoteData: TrainingData) {
  return queueWrite(async () => {
    const database = await openDatabase();
    const transaction = database.transaction(PROFILE_STORE, "readwrite");
    const store = transaction.objectStore(PROFILE_STORE);
    const current = await requestResult(store.get(key)) as OfflineProfileRecord | undefined;
    const now = new Date().toISOString();
    const record = resolveOfflineSyncCommit(key, current, uploadedRevision, remoteData, now);
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
