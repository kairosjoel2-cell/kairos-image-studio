/**
 * Offline-first persistence: projects (metadata + document) and assets
 * (image blobs) in IndexedDB. Works fully offline; no server needed.
 */
import type { DocumentState, ProjectRecord, ProjectMeta } from '../types';

const DB_NAME = 'kairos-image-studio';
const DB_VERSION = 1;
const PROJECTS_STORE = 'projects';
const ASSETS_STORE = 'assets';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(PROJECTS_STORE)) {
        db.createObjectStore(PROJECTS_STORE, { keyPath: 'meta.id' });
      }
      if (!db.objectStoreNames.contains(ASSETS_STORE)) {
        db.createObjectStore(ASSETS_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('IndexedDB open failed'));
  });
}

async function withStore<T>(
  storeName: string,
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T> | void,
): Promise<T | undefined> {
  const db = await openDb();
  return new Promise<T | undefined>((resolve, reject) => {
    const tx = db.transaction(storeName, mode);
    const store = tx.objectStore(storeName);
    let request: IDBRequest<T> | undefined;
    const result = fn(store);
    if (result !== undefined) request = result;
    tx.oncomplete = () => {
      db.close();
      resolve(request ? request.result : undefined);
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error ?? new Error('IndexedDB transaction failed'));
    };
  });
}

/* ------------------------------- projects ------------------------------- */

export async function listProjects(): Promise<ProjectMeta[]> {
  const rows = (await withStore<ProjectRecord[]>(PROJECTS_STORE, 'readonly', (s) => s.getAll())) ?? [];
  return rows
    .map((r) => r.meta)
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function getProject(id: string): Promise<ProjectRecord | undefined> {
  return withStore<ProjectRecord>(PROJECTS_STORE, 'readonly', (s) => s.get(id));
}

export async function putProject(doc: DocumentState, thumb: Blob | null): Promise<void> {
  const record: ProjectRecord = {
    meta: {
      id: doc.id,
      name: doc.name,
      width: doc.width,
      height: doc.height,
      layerCount: doc.layers.length,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    },
    doc,
    thumb,
  };
  await withStore(PROJECTS_STORE, 'readwrite', (s) => {
    s.put(record);
  });
}

export async function deleteProject(id: string): Promise<void> {
  await withStore(PROJECTS_STORE, 'readwrite', (s) => {
    s.delete(id);
  });
}

/** Idempotent schema check at startup. */
export async function migrateProjects(): Promise<void> {
  const db = await openDb();
  db.close();
}

/* -------------------------------- assets -------------------------------- */

export async function putAsset(id: string, blob: Blob): Promise<void> {
  await withStore(ASSETS_STORE, 'readwrite', (s) => {
    s.put(blob, id);
  });
}

export async function getAsset(id: string): Promise<Blob | undefined> {
  return withStore<Blob>(ASSETS_STORE, 'readonly', (s) => s.get(id) as IDBRequest<Blob>);
}

export async function deleteAsset(id: string): Promise<void> {
  await withStore(ASSETS_STORE, 'readwrite', (s) => {
    s.delete(id);
  });
}
