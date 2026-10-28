'use client';
/** Lecture recordings live in IndexedDB: audio is too big for localStorage and never leaves this browser. */
export interface Lecture { id: string; title: string; course: string; at: number; seconds: number; mime: string; blob: Blob; marks: { t: number; label: string }[] }

const DB = 'studytime-media';
const STORE = 'lectures';

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id' });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('Could not open storage for recordings.'));
  });
}

async function run<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const req = fn(tx.objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('Storage error'));
    tx.oncomplete = () => db.close();
  });
}

export const listLectures = async () => (await run<Lecture[]>('readonly', (s) => s.getAll() as IDBRequest<Lecture[]>)).sort((a, b) => b.at - a.at);
export const saveLecture = (l: Lecture) => run('readwrite', (s) => s.put(l));
export const deleteLecture = (id: string) => run('readwrite', (s) => s.delete(id));
