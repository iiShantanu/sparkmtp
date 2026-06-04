// Tiny IndexedDB wrapper for offline music library.
// Stores audio files as Blobs on the device. No network involved.

const DB_NAME = "spark_music";
const STORE = "tracks";
const VERSION = 1;

export type Track = {
  id: string;
  name: string;
  size: number;
  type: string;
  addedAt: number;
  blob: Blob;
};

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx(mode: IDBTransactionMode) {
  return open().then((db) => db.transaction(STORE, mode).objectStore(STORE));
}

export const musicStore = {
  async list(): Promise<Track[]> {
    const store = await tx("readonly");
    return new Promise((res, rej) => {
      const req = store.getAll();
      req.onsuccess = () => res((req.result as Track[]).sort((a, b) => b.addedAt - a.addedAt));
      req.onerror = () => rej(req.error);
    });
  },
  async add(file: File): Promise<Track> {
    const track: Track = {
      id: crypto.randomUUID(),
      name: file.name,
      size: file.size,
      type: file.type || "audio/mpeg",
      addedAt: Date.now(),
      blob: file,
    };
    const store = await tx("readwrite");
    await new Promise<void>((res, rej) => {
      const req = store.add(track);
      req.onsuccess = () => res();
      req.onerror = () => rej(req.error);
    });
    return track;
  },
  async remove(id: string) {
    const store = await tx("readwrite");
    return new Promise<void>((res, rej) => {
      const req = store.delete(id);
      req.onsuccess = () => res();
      req.onerror = () => rej(req.error);
    });
  },
};
