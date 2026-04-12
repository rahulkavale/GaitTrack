// On-device video storage for gait recordings.
// Videos are never uploaded — they live in the browser's IndexedDB and are
// evicted oldest-first once a per-patient cap is reached, bounding disk use.

const DB_NAME = "gait-videos";
const DB_VERSION = 1;
const STORE = "videos";
const MAX_PER_PATIENT = 5;

interface VideoRecord {
  recordingId: string;
  patientId: string;
  sessionId: string;
  mimeType: string;
  blob: Blob;
  createdAt: number;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB not available"));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: "recordingId" });
        store.createIndex("patientId", "patientId", { unique: false });
        store.createIndex("createdAt", "createdAt", { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx(db: IDBDatabase, mode: IDBTransactionMode): IDBObjectStore {
  return db.transaction(STORE, mode).objectStore(STORE);
}

export async function putVideo(record: VideoRecord): Promise<void> {
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const req = tx(db, "readwrite").put(record);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
    await evictOldest(db, record.patientId);
  } finally {
    db.close();
  }
}

export async function getVideo(recordingId: string): Promise<VideoRecord | null> {
  const db = await openDb();
  try {
    return await new Promise<VideoRecord | null>((resolve, reject) => {
      const req = tx(db, "readonly").get(recordingId);
      req.onsuccess = () => resolve((req.result as VideoRecord | undefined) ?? null);
      req.onerror = () => reject(req.error);
    });
  } finally {
    db.close();
  }
}

export async function deleteVideo(recordingId: string): Promise<void> {
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const req = tx(db, "readwrite").delete(recordingId);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } finally {
    db.close();
  }
}

async function evictOldest(db: IDBDatabase, patientId: string): Promise<void> {
  const store = tx(db, "readwrite");
  const index = store.index("patientId");
  const records: VideoRecord[] = await new Promise((resolve, reject) => {
    const req = index.getAll(patientId);
    req.onsuccess = () => resolve((req.result as VideoRecord[]) ?? []);
    req.onerror = () => reject(req.error);
  });
  if (records.length <= MAX_PER_PATIENT) return;
  records.sort((a, b) => a.createdAt - b.createdAt);
  const toRemove = records.slice(0, records.length - MAX_PER_PATIENT);
  for (const r of toRemove) {
    store.delete(r.recordingId);
  }
}

export type { VideoRecord };
