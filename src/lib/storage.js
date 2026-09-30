// طبقة التخزين — حاليًا LocalStorage.
// لربط Backend حقيقي لاحقًا: أنشئ adapter بنفس الواجهة (load/save/remove)
// يتعامل مع API، ثم مرّره إلى setAdapter() — بدون أي تعديل على بقية التطبيق.

const PREFIX = 'himmah:';

const localAdapter = {
  load(key) {
    try {
      const raw = localStorage.getItem(PREFIX + key);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  },
  save(key, value) {
    try {
      localStorage.setItem(PREFIX + key, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  },
  remove(key) {
    try {
      localStorage.removeItem(PREFIX + key);
    } catch {
      /* ignore */
    }
  },
};

let adapter = localAdapter;
export const setAdapter = (a) => (adapter = a);
export const storage = {
  load: (k) => adapter.load(k),
  save: (k, v) => adapter.save(k, v),
  remove: (k) => adapter.remove(k),
};

// جلسة الدخول: "تذكرني" = localStorage، وإلا sessionStorage
export const session = {
  get() {
    try {
      return sessionStorage.getItem(PREFIX + 'session') || localStorage.getItem(PREFIX + 'session');
    } catch {
      return null;
    }
  },
  set(userId, remember) {
    try {
      (remember ? localStorage : sessionStorage).setItem(PREFIX + 'session', userId);
    } catch {
      /* ignore */
    }
  },
  clear() {
    try {
      sessionStorage.removeItem(PREFIX + 'session');
      localStorage.removeItem(PREFIX + 'session');
    } catch {
      /* ignore */
    }
  },
};
