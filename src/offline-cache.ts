const DB_NAME = 'animdb-offline';
const STORE = 'items';
const META = 'meta';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' });
      if (!db.objectStoreNames.contains(META)) db.createObjectStore(META);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function cacheItems(items: unknown[]): Promise<void> {
  try {
    const db = await openDb();
    const tx = db.transaction([STORE, META], 'readwrite');
    const store = tx.objectStore(STORE);
    store.clear();
    for (const item of items) store.put(item);
    tx.objectStore(META).put(new Date().toISOString(), 'cachedAt');
  } catch {
    /* offline cache optional */
  }
}

export async function getCachedItems<T>(): Promise<T[]> {
  try {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const req = db.transaction(STORE).objectStore(STORE).getAll();
      req.onsuccess = () => resolve((req.result as T[]) || []);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return [];
  }
}

export async function registerServiceWorker(): Promise<void> {
  if (!('serviceWorker' in navigator)) return;
  try {
    await navigator.serviceWorker.register('/sw.js');
  } catch {
    /* ignore */
  }
}
