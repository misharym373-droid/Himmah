// تحويل البيانات بين شكل الواجهة (Store) وصفوف قاعدة البيانات (Supabase)
// الواجهة تبقى كما هي، وهذا الملف وحده يعرف أسماء الأعمدة.
import { fromMin, toMin } from './date.js';

const ms = (iso) => (iso ? new Date(iso).getTime() : null);
const iso = (n) => (n ? new Date(n).toISOString() : null);
const hhmm = (t) => (t ? String(t).slice(0, 5) : null);
const clamp = (n, a, b, d) => {
  const x = Number(n);
  return Number.isFinite(x) ? Math.min(b, Math.max(a, Math.round(x))) : d;
};
const numOrNull = (v, a, b) => {
  if (v === '' || v == null) return null;
  const x = Number(v);
  return Number.isFinite(x) && x >= a && x <= b ? x : null;
};
const PRIORITIES = ['low', 'med', 'high', 'urgent'];
const AREAS = ['study', 'health', 'work', 'money', 'family', 'fun'];
const REPEATS = ['none', 'daily', 'weekly', 'monthly', 'days'];

// ————— المهام —————
export function taskToRow(t, user_id) {
  const duration = clamp(t.duration, 1, 1440, 30);
  const start = toMin(t.time);
  const repeatType = REPEATS.includes(t.repeat?.type) ? t.repeat.type : 'none';
  return {
    id: t.id,
    user_id,
    title: String(t.title || '').trim().slice(0, 300) || 'مهمة',
    description: t.desc || '',
    notes: t.notes || '',
    date: t.date,
    start_time: t.time || null,
    end_time: start != null ? fromMin(Math.min(start + duration, 23 * 60 + 59)) : null,
    duration,
    priority: PRIORITIES.includes(t.priority) ? t.priority : 'med',
    category: AREAS.includes(t.area) ? t.area : 'work',
    icon: t.icon || 'sparkles',
    completed: !!t.done,
    completed_at: t.done ? iso(t.doneAt || Date.now()) : null,
    recurring: repeatType !== 'none',
    recurrence_type: repeatType,
    recurrence_days: (t.repeat?.days || []).filter((d) => d >= 0 && d <= 6),
    is_template: !!t.template,
    series_id: t.seriesId || null,
    goal_id: t.goalId || null,
    subtasks: t.subtasks || [],
    postponed: Math.max(0, t.postponed | 0),
    xp_awarded: Math.max(0, t.xpAwarded | 0),
    reminder: t.reminder !== false,
    archived: !!t.archived,
    deleted_at: iso(t.deletedAt),
    source: t.source || '',
    created_at: iso(t.createdAt) || undefined,
  };
}
export function rowToTask(r) {
  return {
    id: r.id,
    title: r.title,
    desc: r.description || '',
    notes: r.notes || '',
    date: r.date,
    time: hhmm(r.start_time),
    duration: r.duration,
    priority: r.priority,
    area: r.category,
    icon: r.icon,
    repeat: { type: r.recurrence_type || 'none', days: r.recurrence_days || [] },
    goalId: r.goal_id,
    subtasks: r.subtasks || [],
    done: r.completed,
    doneAt: ms(r.completed_at),
    postponed: r.postponed || 0,
    createdAt: ms(r.created_at),
    deletedAt: ms(r.deleted_at),
    xpAwarded: r.xp_awarded || 0,
    reminder: r.reminder,
    archived: r.archived || undefined,
    ...(r.is_template ? { template: true } : {}),
    ...(r.series_id ? { seriesId: r.series_id } : {}),
    ...(r.source ? { source: r.source } : {}),
  };
}

// ————— الجداول البسيطة —————
export const goalToRow = (g, user_id) => ({
  id: g.id,
  user_id,
  title: String(g.title || '').slice(0, 200) || 'هدف',
  area: g.area || 'study',
  icon: g.icon || 'target',
  deadline: g.deadline || null,
  months: clamp(g.months, 1, 24, 6),
  milestones: g.milestones || [],
  daily: g.daily || [],
  last_activity: iso(g.lastActivity) || iso(Date.now()),
  plan: g.plan || {},
  created_at: iso(g.createdAt) || undefined,
});
export const rowToGoal = (r) => ({
  id: r.id, title: r.title, area: r.area, icon: r.icon, deadline: r.deadline, months: r.months,
  milestones: r.milestones || [], daily: r.daily || [], createdAt: ms(r.created_at), lastActivity: ms(r.last_activity),
  ...(r.plan && r.plan.startDate ? { plan: r.plan } : {}),
});

export const habitToRow = (h, user_id) => ({
  id: h.id, user_id, title: String(h.title || '').slice(0, 120) || 'عادة', icon: h.icon || 'sparkles', color: h.color || '#2E6B57',
  target: clamp(h.target, 1, 100, 1), unit: h.unit || 'مرة', log: h.log || {}, created_at: iso(h.createdAt) || undefined,
});
export const rowToHabit = (r) => ({ id: r.id, title: r.title, icon: r.icon, color: r.color, target: r.target, unit: r.unit, log: r.log || {}, createdAt: ms(r.created_at) });

export const challengeToRow = (c, user_id) => ({
  id: c.id, user_id, title: String(c.title || '').slice(0, 160) || 'تحدي', icon: c.icon || 'flame', description: c.desc || '',
  days: clamp(c.days, 1, 365, 7), start_date: c.start, log: c.log || {},
});
export const rowToChallenge = (r) => ({ id: r.id, title: r.title, icon: r.icon, desc: r.description, days: r.days, start: r.start_date, log: r.log || {} });

export const rewardToRow = (r, user_id) => ({ id: r.id, user_id, title: String(r.title || '').slice(0, 120) || 'مكافأة', icon: r.icon || 'gift', cost: clamp(r.cost, 1, 1000000, 100) });
export const rowToReward = (r) => ({ id: r.id, title: r.title, icon: r.icon, cost: r.cost });

export const projectToRow = (p, user_id) => ({
  id: p.id, user_id, name: String(p.name || '').slice(0, 120) || 'مشروع', icon: p.icon || 'folder', members: p.members || [], tasks: p.tasks || [],
  created_at: iso(p.createdAt) || undefined,
});
export const rowToProject = (r) => ({ id: r.id, name: r.name, icon: r.icon, members: r.members || [], tasks: r.tasks || [], createdAt: ms(r.created_at) });

export const focusToRow = (f, user_id) => ({ id: f.id, user_id, date: f.date, minutes: clamp(f.minutes, 0, 1440, 0), task_id: f.taskId || null });
export const rowToFocus = (r) => ({ id: r.id, date: r.date, minutes: r.minutes, taskId: r.task_id });

// ————— سجل الصلاة (صف لكل يوم) —————
const PSTATUS = ['ontime', 'late'];
export const prayerToRow = (p, user_id) => ({
  id: p.id, user_id, date: p.date,
  fajr: PSTATUS.includes(p.fajr) ? p.fajr : null, dhuhr: PSTATUS.includes(p.dhuhr) ? p.dhuhr : null, asr: PSTATUS.includes(p.asr) ? p.asr : null,
  maghrib: PSTATUS.includes(p.maghrib) ? p.maghrib : null, isha: PSTATUS.includes(p.isha) ? p.isha : null,
});
export const rowToPrayer = (r) => ({ id: r.id, date: r.date, fajr: r.fajr, dhuhr: r.dhuhr, asr: r.asr, maghrib: r.maghrib, isha: r.isha });

// ————— المستندات الفردية (صف واحد لكل مستخدم) —————
export const profileToRow = (p, user_id) => ({
  user_id,
  name: String(p.name || '').trim().slice(0, 80),
  email: p.email || null,
  phone: String(p.phone || '').slice(0, 20),
  age: numOrNull(p.age, 5, 120),
  weight: numOrNull(p.weight, 20, 400),
  height: numOrNull(p.height, 50, 260),
  field: String(p.field || '').slice(0, 120),
  city: String(p.city || '').slice(0, 80),
  interests: p.interests || [],
  personal_goals: p.personalGoals || [],
  main_goal: String(p.mainGoal || '').slice(0, 200),
  wake_time: p.wake || '07:00',
  sleep_time: p.sleep || '23:00',
  avatar_url: p.avatar || null,
});
export const rowToProfile = (r) => ({
  name: r.name || '', email: r.email || '', phone: r.phone || '', age: r.age ?? '', weight: r.weight ?? '', height: r.height ?? '',
  field: r.field || '', city: r.city || '', interests: r.interests || [], personalGoals: r.personal_goals || [], mainGoal: r.main_goal || '',
  wake: hhmm(r.wake_time) || '07:00', sleep: hhmm(r.sleep_time) || '23:00', avatar: r.avatar_url || '',
});

export const settingsToRow = (s, user_id) => ({
  user_id,
  settings: s.settings,
  dashboard: s.dashboard,
  onboarded: !!s.onboarded,
  energy: s.energy,
  flags: s.flags,
  notifications: (s.notifications || []).slice(0, 60),
  dismissed_insights: s.dismissedInsights || [],
});
export const rowToSettings = (r) => ({
  settings: r.settings || {}, dashboard: r.dashboard || {}, onboarded: r.onboarded, energy: r.energy || {}, flags: r.flags || {},
  notifications: r.notifications || [], dismissedInsights: r.dismissed_insights || [],
});

export const progressToRow = (s, user_id) => ({
  user_id,
  total_xp: Math.max(0, s.user.totalXp | 0),
  xp: Math.max(0, s.user.xp | 0),
  streak: s.streak,
  achievements: s.achievements,
  reward_history: (s.rewardHistory || []).slice(0, 200),
});
export const rowToProgress = (r) => ({
  user: { totalXp: r.total_xp, xp: r.xp },
  streak: r.streak || { count: 0, best: 0, lastDate: null, days: {} },
  achievements: r.achievements || {},
  rewardHistory: r.reward_history || [],
});

// ترتيب الجداول عند الحفظ: الأهداف قبل المهام (مرجع goal_id)، والمهام قبل جلسات التركيز
export const COLLECTIONS = [
  { key: 'goals', table: 'goals', toRow: goalToRow, fromRow: rowToGoal },
  { key: 'tasks', table: 'tasks', toRow: taskToRow, fromRow: rowToTask },
  { key: 'habits', table: 'habits', toRow: habitToRow, fromRow: rowToHabit },
  { key: 'challenges', table: 'challenges', toRow: challengeToRow, fromRow: rowToChallenge },
  { key: 'rewards', table: 'rewards', toRow: rewardToRow, fromRow: rowToReward },
  { key: 'projects', table: 'projects', toRow: projectToRow, fromRow: rowToProject },
  { key: 'focusLog', table: 'focus_sessions', toRow: focusToRow, fromRow: rowToFocus },
  { key: 'prayers', table: 'prayer_log', toRow: prayerToRow, fromRow: rowToPrayer },
];
// المستندات الفردية: أي تغيير في أحد مفاتيحها يرفع الصف كاملًا
export const DOCS = [
  { table: 'profiles', keys: ['profile'], toRow: (s, u) => profileToRow(s.profile, u), fromRow: (r) => ({ profile: rowToProfile(r) }) },
  { table: 'user_settings', keys: ['settings', 'dashboard', 'onboarded', 'energy', 'flags', 'notifications', 'dismissedInsights'], toRow: settingsToRow, fromRow: rowToSettings },
  { table: 'user_progress', keys: ['user', 'streak', 'achievements', 'rewardHistory'], toRow: progressToRow, fromRow: rowToProgress },
];
export const TABLE_ORDER = ['profiles', 'user_settings', 'user_progress', 'goals', 'tasks', 'habits', 'challenges', 'rewards', 'projects', 'focus_sessions', 'prayer_log'];
