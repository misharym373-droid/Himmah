// نقل بيانات الحسابات المحلية القديمة (قبل Supabase) إلى الحساب الحالي
// - لا يحذف البيانات المحلية أبدًا؛ فقط يضع علامة "تم النقل" بعد نجاح الرفع
// - يمنع التكرار ويحوّل المعرفات القديمة إلى UUID مع الحفاظ على الروابط بين العناصر
import { storage } from './storage.js';
import { uid } from './date.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// الحسابات المحلية القديمة التي تحتوي بيانات ولم تُنقل بعد (الحساب التجريبي مستثنى)
export function findLegacyAccounts() {
  const accounts = storage.load('accounts') || {};
  return Object.values(accounts)
    .filter((a) => a?.id && !storage.load('migrated:' + a.id))
    .map((a) => ({ id: a.id, name: a.name, email: a.email, data: storage.load('data:' + a.id) }))
    .filter((a) => a.data && Array.isArray(a.data.tasks));
}

export const markMigrated = (legacyId) => storage.save('migrated:' + legacyId, Date.now());

const valid = (x) => x && typeof x === 'object' && typeof x.id !== 'undefined';
const norm = (s) => String(s || '').trim();

// يدمج البيانات القديمة مع الحالة الحالية ويرجع { patch, counts }
export function mergeLegacy(legacy, current) {
  const ids = new Map();
  const newId = (old) => {
    if (old == null) return null;
    if (UUID.test(old)) return old;
    if (!ids.has(old)) ids.set(old, uid());
    return ids.get(old);
  };
  const counts = { tasks: 0, goals: 0, habits: 0, challenges: 0, rewards: 0, projects: 0, focus: 0 };

  const addList = (key, items, sameAs, remap = (x) => x) => {
    const existing = current[key] || [];
    const out = [];
    for (const it of (items || []).filter(valid)) {
      if (existing.some((e) => sameAs(e, it)) || out.some((e) => sameAs(e, it))) continue;
      out.push(remap({ ...it, id: newId(it.id) }));
    }
    counts[key === 'focusLog' ? 'focus' : key] = out.length;
    return [...existing, ...out];
  };

  const goals = addList('goals', legacy.goals, (a, b) => norm(a.title) === norm(b.title));
  // نعيد ربط المهام بالأهداف المنقولة أو الموجودة بنفس الاسم
  const goalByOld = new Map((legacy.goals || []).map((g) => [g.id, goals.find((x) => norm(x.title) === norm(g.title))?.id || newId(g.id)]));
  const tasks = addList(
    'tasks',
    (legacy.tasks || []).filter((t) => t.title && t.date),
    (a, b) => norm(a.title) === norm(b.title) && a.date === b.date && (a.time || null) === (b.time || null) && !!a.template === !!b.template,
    (t) => ({ ...t, goalId: t.goalId ? goalByOld.get(t.goalId) || null : null, seriesId: t.seriesId ? newId(t.seriesId) : undefined, subtasks: t.subtasks || [] })
  );
  const taskIds = new Set(tasks.map((t) => t.id));
  const habits = addList('habits', legacy.habits, (a, b) => norm(a.title) === norm(b.title));
  const challenges = addList('challenges', legacy.challenges, (a, b) => norm(a.title) === norm(b.title));
  const rewards = addList('rewards', legacy.rewards, (a, b) => norm(a.title) === norm(b.title));
  const projects = addList('projects', legacy.projects, (a, b) => norm(a.name) === norm(b.name));
  const focusLog = addList(
    'focusLog',
    (legacy.focusLog || []).map((f) => ({ ...f, id: f.id || uid() })),
    () => false,
    (f) => ({ ...f, taskId: f.taskId && taskIds.has(newId(f.taskId)) ? newId(f.taskId) : null })
  );

  // التقدم: نأخذ الأعلى ولا ننقص شيئًا موجودًا
  const lu = legacy.user || {};
  const user = { totalXp: Math.max(current.user.totalXp, lu.totalXp | 0), xp: Math.max(current.user.xp, lu.xp | 0) };
  const ls = legacy.streak || {};
  const streak = (ls.count | 0) > current.streak.count ? { ...current.streak, ...ls, days: { ...current.streak.days, ...(ls.days || {}) } } : current.streak;
  const achievements = { ...(legacy.achievements || {}), ...current.achievements };
  // الملف الشخصي: نملأ الحقول الفارغة فقط
  const profile = { ...current.profile };
  for (const [k, v] of Object.entries(legacy.profile || {})) if ((profile[k] === '' || profile[k] == null || (Array.isArray(profile[k]) && !profile[k].length)) && v) profile[k] = v;

  return {
    patch: { goals, tasks, habits, challenges, rewards, projects, focusLog, user, streak, achievements, profile },
    counts,
    total: Object.values(counts).reduce((a, b) => a + b, 0),
  };
}

// تحويل كل المعرفات غير الصالحة إلى UUID مع الحفاظ على الروابط (لاستيراد نسخة احتياطية قديمة)
export function remapIds(data) {
  const map = new Map();
  const id = (old) => {
    if (old == null || old === '') return null;
    if (UUID.test(old)) return old;
    if (!map.has(old)) map.set(old, uid());
    return map.get(old);
  };
  const list = (k, fn = (x) => x) => (Array.isArray(data[k]) ? data[k].filter(valid).map((x) => fn({ ...x, id: id(x.id) })) : []);
  const goals = list('goals');
  return {
    ...data,
    goals,
    tasks: list('tasks', (t) => ({ ...t, goalId: t.goalId ? id(t.goalId) : null, ...(t.seriesId ? { seriesId: id(t.seriesId) } : {}) })),
    habits: list('habits'),
    challenges: list('challenges'),
    rewards: list('rewards'),
    projects: list('projects'),
    focusLog: (data.focusLog || []).map((f) => ({ ...f, id: f.id && UUID.test(f.id) ? f.id : uid(), taskId: f.taskId ? id(f.taskId) : null })),
  };
}
