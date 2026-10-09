// حفظ ملفات الأجواء الخاصة بالمستخدم (فيديو/صورة/صوت) على هذا الجهاز فقط — IndexedDB
const DB = 'himmah-media';
const STORE = 'files';

function open() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function run(mode, fn) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const req = fn(tx.objectStore(STORE));
    tx.oncomplete = () => resolve(req?.result);
    tx.onerror = () => reject(tx.error);
  });
}

export async function saveMedia(key, file) {
  await run('readwrite', (s) => s.put({ blob: file, type: file.type, name: file.name }, key));
}
export async function loadMedia(key) {
  try {
    const rec = await run('readonly', (s) => s.get(key));
    return rec ? { url: URL.createObjectURL(rec.blob), type: rec.type, name: rec.name } : null;
  } catch (e) {
    console.warn('[himmah:media]', e?.message || e);
    return null;
  }
}
export async function removeMedia(key) {
  try {
    await run('readwrite', (s) => s.delete(key));
  } catch (e) {
    console.warn('[himmah:media]', e?.message || e);
  }
}
