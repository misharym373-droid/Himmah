// محرك المزامنة مع Supabase
// - يقارن الحالة السابقة بالجديدة ويرسل الصفوف المتغيرة فقط (لا إعادة تحميل كاملة)
// - طابور عمليات (Outbox) محفوظ على الجهاز: لا تضيع التغييرات عند انقطاع الإنترنت
// - يعيد المحاولة تلقائيًا عند عودة الاتصال
import { supabase, errorKind } from './supabase.js';
import { COLLECTIONS, DOCS, TABLE_ORDER } from './mappers.js';
import { todayKey, addDays } from './date.js';

const LS = 'himmah:';
const HISTORY_DAYS = 180; // نحمّل آخر 6 أشهر من المهام فقط + المهام المتكررة
const PAGE = 1000;

function readLS(k) {
  try {
    const v = localStorage.getItem(LS + k);
    return v ? JSON.parse(v) : null;
  } catch {
    return null;
  }
}
function writeLS(k, v) {
  try {
    localStorage.setItem(LS + k, JSON.stringify(v));
    return true;
  } catch {
    return false; // التخزين ممتلئ أو غير متاح — المزامنة تستمر من الذاكرة
  }
}

// تحميل كل الصفحات (PostgREST يرجع 1000 صف كحد أقصى للطلب)
async function selectAll(build) {
  const out = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await build().range(from, from + PAGE - 1);
    if (error) throw error;
    out.push(...data);
    if (data.length < PAGE) return out;
  }
}

// تحميل بيانات المستخدم من Supabase وتحويلها لشكل الواجهة
export async function fetchRemote() {
  const since = addDays(todayKey(), -HISTORY_DAYS);
  const one = (table) => supabase.from(table).select('*').maybeSingle();
  const [profile, settings, progress, ...lists] = await Promise.all([
    one('profiles'),
    one('user_settings'),
    one('user_progress'),
    ...COLLECTIONS.map((c) => {
      if (c.table === 'tasks') return selectAll(() => supabase.from('tasks').select('*').or(`date.gte.${since},is_template.eq.true`).order('date'));
      if (c.table === 'focus_sessions') return selectAll(() => supabase.from('focus_sessions').select('*').gte('date', since).order('date'));
      if (c.table === 'prayer_log') return selectAll(() => supabase.from('prayer_log').select('*').gte('date', since).order('date'));
      return selectAll(() => supabase.from(c.table).select('*').order('created_at'));
    }),
  ]);
  for (const r of [profile, settings, progress]) if (r.error) throw r.error;
  const data = {};
  COLLECTIONS.forEach((c, i) => (data[c.key] = lists[i].map(c.fromRow)));
  const docRows = { profiles: profile.data, user_settings: settings.data, user_progress: progress.data };
  for (const d of DOCS) if (docRows[d.table]) Object.assign(data, d.fromRow(docRows[d.table]));
  data.__firstRun = !settings.data || !settings.data.settings || !Object.keys(settings.data.settings).length;
  return data;
}

// الفرق بين حالتين → عمليات (upsert / delete)
export function diffState(prev, next, uid) {
  const ops = [];
  for (const c of COLLECTIONS) {
    const a = prev?.[c.key] || [];
    const b = next[c.key] || [];
    if (a === b) continue;
    const before = new Map(a.map((x) => [x.id, x]));
    for (const item of b) {
      if (!item?.id) continue;
      if (before.get(item.id) !== item) ops.push({ table: c.table, type: 'upsert', id: item.id, row: c.toRow(item, uid) });
      before.delete(item.id);
    }
    for (const id of before.keys()) ops.push({ table: c.table, type: 'delete', id });
  }
  for (const d of DOCS) {
    if (prev && d.keys.every((k) => prev[k] === next[k])) continue;
    ops.push({ table: d.table, type: 'upsert', id: uid, doc: true, row: d.toRow(next, uid) });
  }
  return ops;
}

export function createSyncEngine({ uid, onStatus, onDataError, onSessionExpired, onOnline, onOffline }) {
  const outboxKey = 'outbox:' + uid;
  const outbox = new Map((readLS(outboxKey) || []).map((op) => [`${op.table}:${op.id}`, op]));
  let flushing = false;
  let again = false;
  let status = navigator.onLine ? 'synced' : 'offline';
  let stopped = false;
  let retryTimer = null;
  const idleWaiters = new Set();

  const persist = () => writeLS(outboxKey, [...outbox.values()]);
  let wasOffline = status === 'offline';
  const setStatus = (s) => {
    if (s === 'offline' && !wasOffline) {
      wasOffline = true;
      onOffline?.();
    }
    if (s === 'synced' && wasOffline) {
      wasOffline = false;
      onOnline?.();
    }
    status = s;
    onStatus?.({ status: s, pending: outbox.size });
    if (!outbox.size && s === 'synced') idleWaiters.forEach((r) => r(true)), idleWaiters.clear();
  };

  function queue(ops) {
    if (!ops.length) return;
    for (const op of ops) outbox.set(`${op.table}:${op.id}`, op);
    persist();
    onStatus?.({ status, pending: outbox.size });
    flush();
  }

  async function runBatch(table, ops) {
    const ups = ops.filter((o) => o.type === 'upsert');
    const dels = ops.filter((o) => o.type === 'delete');
    if (ups.length) {
      const { error } = await supabase.from(table).upsert(
        ups.map((o) => o.row),
        { onConflict: ups[0].doc ? 'user_id' : 'id', defaultToNull: false }
      );
      if (error) return error;
    }
    if (dels.length) {
      const { error } = await supabase.from(table).delete().in('id', dels.map((o) => o.id));
      if (error) return error;
    }
    return null;
  }

  async function flush() {
    if (stopped) return;
    if (flushing) return void (again = true);
    if (!outbox.size) return setStatus('synced');
    if (!navigator.onLine) return setStatus('offline');
    flushing = true;
    setStatus('saving');
    let halted = null;
    try {
      for (const table of TABLE_ORDER) {
        const ops = [...outbox.values()].filter((o) => o.table === table);
        if (!ops.length) continue;
        let err = await runBatch(table, ops);
        // خطأ بيانات في دفعة: نحاول كل صف وحده لعزل الصف المرفوض فقط
        if (err && errorKind(err) === 'data' && ops.length > 1) {
          err = null;
          for (const op of ops) {
            const e = await runBatch(table, [op]);
            if (!e) outbox.get(`${op.table}:${op.id}`) === op && outbox.delete(`${op.table}:${op.id}`);
            else if (errorKind(e) === 'data') {
              outbox.delete(`${op.table}:${op.id}`);
              onDataError?.(table, e);
            } else {
              err = e;
              break;
            }
          }
          persist();
          if (err) {
            halted = err;
            break;
          }
          continue;
        }
        if (err) {
          if (errorKind(err) === 'data') {
            ops.forEach((op) => outbox.get(`${op.table}:${op.id}`) === op && outbox.delete(`${op.table}:${op.id}`));
            persist();
            onDataError?.(table, err);
            continue;
          }
          halted = err;
          break;
        }
        // نحذف فقط العمليات التي لم تُستبدل بتغيير أحدث أثناء الإرسال
        ops.forEach((op) => outbox.get(`${op.table}:${op.id}`) === op && outbox.delete(`${op.table}:${op.id}`));
        persist();
      }
    } catch (e) {
      halted = e;
    } finally {
      flushing = false;
    }
    if (halted) {
      const kind = errorKind(halted);
      if (kind === 'auth') {
        const { error } = await supabase.auth.refreshSession();
        if (error) {
          setStatus('error');
          return onSessionExpired?.();
        }
        return flush();
      }
      setStatus('offline');
      scheduleRetry();
      return;
    }
    if (again) {
      again = false;
      return flush();
    }
    setStatus(outbox.size ? 'saving' : 'synced');
    if (outbox.size) scheduleRetry();
  }

  function scheduleRetry() {
    clearTimeout(retryTimer);
    retryTimer = setTimeout(flush, 15000);
  }

  const onlineHandler = () => flush();
  const offlineHandler = () => setStatus('offline');
  window.addEventListener('online', onlineHandler);
  window.addEventListener('offline', offlineHandler);

  return {
    queue,
    flush,
    pending: () => outbox.size,
    status: () => status,
    // ينتظر حتى تُرفع كل التغييرات (للاستيراد مثلًا)
    whenIdle(timeout = 20000) {
      if (!outbox.size && status === 'synced') return Promise.resolve(true);
      return new Promise((res) => {
        idleWaiters.add(res);
        setTimeout(() => (idleWaiters.delete(res), res(false)), timeout);
      });
    },
    stop() {
      stopped = true;
      clearTimeout(retryTimer);
      window.removeEventListener('online', onlineHandler);
      window.removeEventListener('offline', offlineHandler);
    },
  };
}

// ————— نسخة محلية مؤقتة (Cache) للفتح السريع والعمل بدون اتصال —————
export const loadCache = (uid) => readLS('cache:' + uid);
export const saveCache = (uid, snapshot) => writeLS('cache:' + uid, snapshot);
export const clearUserCache = (uid) => {
  try {
    localStorage.removeItem(LS + 'cache:' + uid);
    localStorage.removeItem(LS + 'outbox:' + uid);
  } catch (e) {
    // ميزة ثانوية غير متاحة في هذا المتصفح — لا توقف التطبيق
    console.warn('[himmah:cache-clear]', e?.message || e);
  }
};
export const hasPendingOutbox = (uid) => (readLS('outbox:' + uid) || []).length > 0;
