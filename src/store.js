// الحالة المركزية للتطبيق (Zustand) — كل الميزات مترابطة من هنا
import { create } from 'zustand';
import { storage } from './lib/storage.js';
import { todayKey, addDays, fromKey, toMin, fromMin, nowMin, roundUp5, uid } from './lib/date.js';
import { levelInfo, taskXp, ACHIEVEMENTS, dayProgress } from './lib/game.js';
import { emptyData, demoData, makeTask, WIDGETS, DEFAULT_SETTINGS } from './lib/seed.js';
import { playSound, vibrate } from './lib/fx.js';

const PERSIST_KEYS = [
  'version', 'onboarded', 'user', 'profile', 'settings', 'dashboard', 'tasks', 'goals', 'habits', 'challenges', 'rewards',
  'rewardHistory', 'achievements', 'notifications', 'projects', 'focusLog', 'energy', 'streak', 'flags', 'dismissedInsights',
];

let saveTimer;
let currentUserId = null;

export const useStore = create((set, get) => ({
  ready: false,
  ...emptyData(),
  // حالة مؤقتة (لا تُحفظ)
  fx: [],
  toasts: [],
  focus: null,
  modal: null, // { name, payload }
  drawer: null, // 'notifications' | 'assistant' | 'command'

  // ————— التهيئة —————
  init(user) {
    currentUserId = user.id;
    let data = storage.load('data:' + user.id);
    const fresh = !data;
    if (!data) data = user.demo ? demoData() : emptyData(user);
    data.settings = { ...DEFAULT_SETTINGS, ...data.settings, notif: { ...DEFAULT_SETTINGS.notif, ...(data.settings?.notif || {}) } };
    // تأكد من وجود كل الويدجت (عند إضافة بطاقات جديدة مستقبلاً)
    const ids = WIDGETS.map((w) => w.id);
    data.dashboard = data.dashboard || { order: ids, hidden: [] };
    data.dashboard.order = [...data.dashboard.order.filter((i) => ids.includes(i)), ...ids.filter((i) => !data.dashboard.order.includes(i))];
    set({ ...emptyData(user), ...data, ready: true, fx: [], toasts: [], focus: null, modal: null, drawer: null });
    get().maintenance();
    // البيانات التجريبية: الإنجازات المستحقة تُفتح بصمت بدون احتفالات
    if (fresh && user.demo) {
      const st = get();
      const ach = { ...st.achievements };
      ACHIEVEMENTS.forEach((a) => !ach[a.id] && safe(() => a.check(st)) && (ach[a.id] = Date.now() - 86400000));
      set({ achievements: ach });
    }
  },
  reset() {
    currentUserId = null;
    set({ ...emptyData(), ready: false, fx: [], toasts: [], focus: null, modal: null, drawer: null });
  },
  // صيانة يومية: توليد المهام المتكررة + فحص الـStreak
  maintenance() {
    const s = get();
    const T = todayKey();
    const tasks = [...s.tasks];
    const templates = tasks.filter((t) => t.template && !t.deletedAt);
    for (const tpl of templates) {
      for (let i = 0; i < 14; i++) {
        const date = addDays(T, i);
        if (date < tpl.date) continue;
        if (!repeatMatches(tpl, date)) continue;
        if (tasks.some((t) => t.seriesId === tpl.id && t.date === date)) continue;
        tasks.push(makeTask({ ...tpl, id: uid(), template: false, seriesId: tpl.id, date, done: false, doneAt: null, xpAwarded: 0, subtasks: tpl.subtasks.map((x) => ({ ...x, done: false })), createdAt: Date.now() }));
      }
    }
    const streak = { ...s.streak };
    const notifications = [...s.notifications];
    if (streak.count > 0 && streak.lastDate && streak.lastDate < addDays(T, -1)) {
      notifications.unshift(notif('streak', '💔', 'انقطع الـStreak', `كانت سلسلتك ${streak.count} يوم. ابدأ من جديد اليوم!`));
      streak.count = 0;
    }
    set({ tasks, streak, notifications });
  },

  // ————— واجهة —————
  openModal: (name, payload = null) => set({ modal: { name, payload } }),
  closeModal: () => set({ modal: null }),
  setDrawer: (drawer) => set({ drawer }),
  toast(text, opts = {}) {
    const id = uid();
    set((s) => ({ toasts: [...s.toasts, { id, text, ...opts }].slice(-4) }));
    setTimeout(() => get().dismissToast(id), opts.duration || (opts.action ? 6000 : 3200));
    return id;
  },
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  pushFx: (fx) => set((s) => ({ fx: [...s.fx, { id: uid(), ...fx }] })),
  shiftFx: (id) => set((s) => ({ fx: s.fx.filter((f) => f.id !== id) })),

  // ————— المهام —————
  addTask(p) {
    const repeat = p.repeat || { type: 'none', days: [] };
    const t = makeTask({ ...p, repeat });
    if (repeat.type !== 'none') {
      t.template = true;
      set((s) => ({ tasks: [...s.tasks, t] }));
      get().maintenance();
    } else set((s) => ({ tasks: [...s.tasks, t] }));
    get().checkAchievements();
    return t;
  },
  addTasks(list) {
    const created = list.map((p) => get().addTask(p));
    return created;
  },
  updateTask(id, patch) {
    set((s) => ({ tasks: s.tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)) }));
    // تعديل قالب متكرر ينعكس على المهام القادمة غير المكتملة
    const t = get().tasks.find((x) => x.id === id);
    if (t?.template) {
      const T = todayKey();
      const { title, time, duration, priority, area, icon, desc, notes, goalId } = t;
      set((s) => ({
        tasks: s.tasks
          .filter((x) => !(x.seriesId === id && !x.done && x.date >= T && patch.repeat))
          .map((x) => (x.seriesId === id && !x.done && x.date >= T ? { ...x, title, time, duration, priority, area, icon, desc, notes, goalId } : x)),
      }));
      if (patch.repeat) get().maintenance();
    }
  },
  toggleTask(id) {
    const t = get().tasks.find((x) => x.id === id);
    if (!t) return;
    if (!t.done) get().completeTask(id);
    else {
      const back = t.xpAwarded || 0;
      set((s) => ({
        tasks: s.tasks.map((x) => (x.id === id ? { ...x, done: false, doneAt: null, xpAwarded: 0 } : x)),
        user: { totalXp: Math.max(0, s.user.totalXp - back), xp: Math.max(0, s.user.xp - back) },
      }));
    }
  },
  completeTask(id, { silent = false } = {}) {
    const s = get();
    const t = s.tasks.find((x) => x.id === id);
    if (!t || t.done) return;
    const xp = taskXp(t);
    const before = levelInfo(s.user.totalXp).level;
    set((st) => ({
      tasks: st.tasks.map((x) => (x.id === id ? { ...x, done: true, doneAt: Date.now(), xpAwarded: xp, subtasks: x.subtasks.map((y) => ({ ...y, done: true })) } : x)),
      user: { totalXp: st.user.totalXp + xp, xp: st.user.xp + xp },
      goals: t.goalId ? st.goals.map((g) => (g.id === t.goalId ? { ...g, lastActivity: Date.now() } : g)) : st.goals,
    }));
    if (s.settings.sounds) playSound('done');
    if (s.settings.vibration) vibrate([20, 40, 20]);
    if (!silent) get().pushFx({ type: 'xp', amount: xp });
    const after = levelInfo(get().user.totalXp).level;
    if (after > before) {
      get().pushFx({ type: 'level', level: after });
      if (s.settings.sounds) setTimeout(() => playSound('level'), 300);
      get().notify('achievements', '✨', 'Level Up!', `وصلت إلى المستوى ${after}`);
    }
    get().updateStreak();
    get().checkAchievements();
  },
  deleteTask(id) {
    const t = get().tasks.find((x) => x.id === id);
    if (!t) return;
    set((s) => ({ tasks: s.tasks.map((x) => (x.id === id ? { ...x, deletedAt: Date.now() } : x)) }));
    get().toast(`تم نقل "${t.title}" إلى المحذوفات`, { action: { label: 'تراجع', run: () => get().restoreTask(id) }, icon: 'trash' });
  },
  deleteTasks(ids) {
    const now = Date.now();
    set((s) => ({ tasks: s.tasks.map((x) => (ids.includes(x.id) ? { ...x, deletedAt: now } : x)) }));
    get().toast(`تم حذف ${ids.length} مهام`, { action: { label: 'تراجع', run: () => ids.forEach((i) => get().restoreTask(i)) }, icon: 'trash' });
  },
  restoreTask(id) {
    set((s) => ({ tasks: s.tasks.map((x) => (x.id === id ? { ...x, deletedAt: null } : x)) }));
  },
  purgeTask(id) {
    set((s) => ({ tasks: s.tasks.filter((x) => x.id !== id && x.seriesId !== id) }));
  },
  emptyTrash() {
    set((s) => ({ tasks: s.tasks.filter((x) => !x.deletedAt) }));
  },
  // إعادة التخطيط: now | later | tomorrow | week
  postponeTask(id, when) {
    const T = todayKey();
    const n = roundUp5(nowMin() + 5);
    const map = {
      now: { date: T, time: fromMin(n) },
      later: { date: T, time: fromMin(Math.min(n + 120, 23 * 60)) },
      tomorrow: { date: addDays(T, 1) },
      week: { date: addDays(T, weekendOffset()) },
    };
    const patch = map[when];
    if (!patch) return;
    set((s) => ({
      tasks: s.tasks.map((x) =>
        x.id === id ? { ...x, ...patch, postponed: when === 'now' ? x.postponed : (x.postponed || 0) + 1, archived: false } : x
      ),
    }));
    const labels = { now: 'الآن', later: 'لاحقًا اليوم', tomorrow: 'غدًا', week: 'هذا الأسبوع' };
    get().toast(`تم نقل المهمة إلى ${labels[when]}`, { icon: 'clock' });
  },
  moveTaskToDate(id, date, time) {
    set((s) => ({ tasks: s.tasks.map((x) => (x.id === id ? { ...x, date, ...(time !== undefined ? { time } : {}) } : x)) }));
  },
  // إعادة ترتيب اليوم بعد السحب والإفلات: الأوقات تُحسب تلقائيًا بالتتابع
  reorderDay(date, orderedIds) {
    const s = get();
    const list = orderedIds.map((id) => s.tasks.find((t) => t.id === id)).filter(Boolean);
    // نحتفظ بـ"فتحات" الأوقات الحالية ونوزعها على الترتيب الجديد، مع منع التداخل
    const slots = list.map((t) => toMin(t.time)).filter((x) => x != null).sort((a, b) => a - b);
    let cursor = slots.length ? slots[0] : toMin(s.profile.wake || '08:00');
    const newTimes = {};
    list.forEach((t, i) => {
      const start = Math.max(slots[i] ?? cursor, cursor);
      newTimes[t.id] = fromMin(start);
      cursor = start + (t.duration || 30);
    });
    set((st) => ({ tasks: st.tasks.map((t) => (newTimes[t.id] ? { ...t, time: newTimes[t.id], date } : t)) }));
  },
  applyTimes(list) {
    const map = Object.fromEntries(list.map((x) => [x.id, x.time]));
    set((s) => ({ tasks: s.tasks.map((t) => (map[t.id] ? { ...t, time: map[t.id], date: todayKey(), archived: false } : t)) }));
  },
  applyRescue(plan) {
    const keep = Object.fromEntries(plan.keep.map((k) => [k.id, k.newTime]));
    const move = new Set(plan.move.map((m) => m.id));
    const tomorrow = addDays(todayKey(), 1);
    set((s) => ({
      tasks: s.tasks.map((t) =>
        keep[t.id] ? { ...t, time: keep[t.id], date: todayKey(), archived: false } : move.has(t.id) ? { ...t, date: tomorrow, postponed: (t.postponed || 0) + 1, archived: false } : t
      ),
      flags: { ...s.flags, rescued: true },
    }));
    get().toast('تم تحديث جدولك ✨', { icon: 'sparkles' });
    get().checkAchievements();
  },
  setSubtasks(id, titles) {
    set((s) => ({ tasks: s.tasks.map((t) => (t.id === id ? { ...t, subtasks: titles.map((title) => ({ id: uid(), title, done: false })) } : t)) }));
  },
  toggleSubtask(id, subId) {
    set((s) => ({
      tasks: s.tasks.map((t) => (t.id === id ? { ...t, subtasks: t.subtasks.map((x) => (x.id === subId ? { ...x, done: !x.done } : x)) } : t)),
    }));
    const t = get().tasks.find((x) => x.id === id);
    if (t && t.subtasks.length && t.subtasks.every((x) => x.done) && !t.done) get().completeTask(id);
  },
  createStudyPlan(p, subject = '') {
    const tasks = p.plan.map((d, i) =>
      makeTask({
        title: `${subject ? subject + ' — ' : ''}${d.title}`,
        date: d.date,
        time: '18:00',
        duration: i === p.plan.length - 1 ? 120 : 90,
        icon: i === p.plan.length - 1 ? '📝' : '📚',
        area: 'study',
        priority: i === p.plan.length - 1 ? 'urgent' : 'high',
      })
    );
    set((s) => ({ tasks: [...s.tasks, ...tasks] }));
    get().toast(`تم إنشاء خطة من ${tasks.length} أيام في جدولك`, { icon: 'sparkles' });
  },

  // ————— التركيز —————
  startFocus(taskId, minutes) {
    const t = get().tasks.find((x) => x.id === taskId);
    const total = Math.round((minutes || t?.duration || 25) * 60);
    set({ focus: { taskId, totalSec: total, remainingSec: total, endAt: Date.now() + total * 1000, running: true, minimized: false, startedAt: Date.now() } });
  },
  pauseFocus() {
    const f = get().focus;
    if (!f?.running) return;
    set({ focus: { ...f, running: false, remainingSec: Math.max(0, (f.endAt - Date.now()) / 1000) } });
  },
  resumeFocus() {
    const f = get().focus;
    if (!f || f.running) return;
    set({ focus: { ...f, running: true, endAt: Date.now() + f.remainingSec * 1000 } });
  },
  minimizeFocus: (v = true) => set((s) => (s.focus ? { focus: { ...s.focus, minimized: v } } : {})),
  endFocus(complete) {
    const f = get().focus;
    if (!f) return;
    const remaining = f.running ? Math.max(0, (f.endAt - Date.now()) / 1000) : f.remainingSec;
    const minutes = Math.round((f.totalSec - remaining) / 60);
    set((s) => ({ focus: null, focusLog: minutes > 0 ? [...s.focusLog, { date: todayKey(), minutes, taskId: f.taskId }] : s.focusLog }));
    if (complete && f.taskId) get().completeTask(f.taskId);
    get().checkAchievements();
    return minutes;
  },

  // ————— الـStreak —————
  updateStreak() {
    const s = get();
    const T = todayKey();
    const p = dayProgress(s.tasks.filter((t) => !t.template), T);
    if (p.total && p.pct >= 100 && s.streak.lastDate !== T) {
      const count = s.streak.lastDate === addDays(T, -1) ? s.streak.count + 1 : 1;
      set({ streak: { ...s.streak, count, best: Math.max(s.streak.best || 0, count), lastDate: T, days: { ...s.streak.days, [T]: true } } });
      get().pushFx({ type: 'streak', count });
      get().notify('streak', '🔥', 'أكملت يومك!', `الـStreak الآن ${count} يوم متتالي`);
    }
  },

  // ————— الإنجازات —————
  checkAchievements() {
    const s = get();
    const newly = ACHIEVEMENTS.filter((a) => !s.achievements[a.id] && safe(() => a.check(s)));
    if (!newly.length) return;
    const ach = { ...s.achievements };
    newly.forEach((a) => (ach[a.id] = Date.now()));
    set({ achievements: ach });
    newly.forEach((a, i) => {
      setTimeout(() => {
        get().pushFx({ type: 'achievement', ach: a });
        if (get().settings.sounds) playSound('achievement');
      }, 600 + i * 1800);
      get().notify('achievements', '🏆', 'إنجاز جديد', `فتحت إنجاز "${a.title}"`);
    });
  },

  // ————— الإشعارات —————
  notify(type, icon, title, body) {
    const s = get();
    if (s.settings.notif[type] === false) return;
    set({ notifications: [notif(type, icon, title, body), ...s.notifications].slice(0, 60) });
    if (s.settings.browserNotifications && typeof Notification !== 'undefined' && Notification.permission === 'granted' && document.hidden) {
      try {
        new Notification(title, { body, icon: './brand/icon-192.png', lang: 'ar', dir: 'rtl' });
      } catch {
        /* ignore */
      }
    }
  },
  markAllRead: () => set((s) => ({ notifications: s.notifications.map((n) => ({ ...n, read: true })) })),
  clearNotifications: () => set({ notifications: [] }),
  removeNotification: (id) => set((s) => ({ notifications: s.notifications.filter((n) => n.id !== id) })),
  setFlag: (k, v = true) => set((s) => ({ flags: { ...s.flags, [k]: v } })),

  // ————— الطاقة —————
  setEnergy(level) {
    set((s) => ({ energy: { ...s.energy, [todayKey()]: level } }));
  },

  // ————— الأهداف —————
  addGoal({ title, deadline, area = 'study', icon = '🎯', months = 6, breakdown, addDaily = true }) {
    const milestones = breakdown
      ? breakdown.months.map((m) => ({ id: uid(), title: m.title.replace(/^الشهر \d+: /, ''), level: 'month', total: m.weeks.length, done: 0, weeks: m.weeks }))
      : [];
    const g = { id: uid(), title, area, icon, deadline: deadline || addDays(todayKey(), months * 30), months, milestones, daily: breakdown?.daily || [], createdAt: Date.now(), lastActivity: Date.now() };
    set((s) => ({ goals: [...s.goals, g] }));
    if (addDaily && breakdown?.daily?.length) {
      const base = roundUp5(Math.max(nowMin() + 30, toMin(get().profile.wake || '08:00') + 60));
      let c = Math.min(base, 21 * 60);
      breakdown.daily.slice(0, 3).forEach((d) => {
        get().addTask({ title: d, goalId: g.id, area, icon, duration: 20, time: fromMin(c), priority: 'med' });
        c += 30;
      });
    }
    get().checkAchievements();
    return g;
  },
  updateGoal: (id, patch) => set((s) => ({ goals: s.goals.map((g) => (g.id === id ? { ...g, ...patch, lastActivity: Date.now() } : g)) })),
  deleteGoal(id) {
    const g = get().goals.find((x) => x.id === id);
    set((s) => ({ goals: s.goals.filter((x) => x.id !== id), tasks: s.tasks.map((t) => (t.goalId === id ? { ...t, goalId: null } : t)) }));
    if (g) get().toast(`تم حذف الهدف "${g.title}"`, { action: { label: 'تراجع', run: () => set((s) => ({ goals: [...s.goals, g] })) } });
  },
  stepMilestone(goalId, msId, delta) {
    set((s) => ({
      goals: s.goals.map((g) =>
        g.id === goalId
          ? { ...g, lastActivity: Date.now(), milestones: g.milestones.map((m) => (m.id === msId ? { ...m, done: Math.max(0, Math.min(m.total, m.done + delta)) } : m)) }
          : g
      ),
    }));
    if (delta > 0) {
      const xp = 15;
      set((s) => ({ user: { totalXp: s.user.totalXp + xp, xp: s.user.xp + xp } }));
      get().pushFx({ type: 'xp', amount: xp });
      const g = get().goals.find((x) => x.id === goalId);
      const pct = goalProgress(g, get().tasks);
      if (pct >= 75 && pct < 100) get().notify('goals', '🎯', 'اقتربت من تحقيق هدفك', `"${g.title}" وصل ${pct}%`);
      if (pct === 100) get().notify('goals', '🏁', 'حققت هدفك!', `مبروك! أنجزت "${g.title}"`);
    }
  },
  addMilestone(goalId, title, total = 1) {
    set((s) => ({ goals: s.goals.map((g) => (g.id === goalId ? { ...g, milestones: [...g.milestones, { id: uid(), title, level: 'week', total, done: 0 }] } : g)) }));
  },
  removeMilestone(goalId, msId) {
    set((s) => ({ goals: s.goals.map((g) => (g.id === goalId ? { ...g, milestones: g.milestones.filter((m) => m.id !== msId) } : g)) }));
  },

  // ————— العادات —————
  addHabit: (h) => set((s) => ({ habits: [...s.habits, { id: uid(), log: {}, target: 1, unit: 'مرة', color: '#7C5CFF', createdAt: Date.now(), ...h }] })),
  updateHabit: (id, patch) => set((s) => ({ habits: s.habits.map((h) => (h.id === id ? { ...h, ...patch } : h)) })),
  deleteHabit(id) {
    const h = get().habits.find((x) => x.id === id);
    set((s) => ({ habits: s.habits.filter((x) => x.id !== id) }));
    if (h) get().toast(`تم حذف عادة "${h.title}"`, { action: { label: 'تراجع', run: () => set((s) => ({ habits: [...s.habits, h] })) } });
  },
  logHabit(id, date = todayKey(), delta = 1) {
    const h = get().habits.find((x) => x.id === id);
    if (!h) return;
    const cur = h.log[date] || 0;
    const next = Math.max(0, Math.min(h.target, cur + delta));
    set((s) => ({ habits: s.habits.map((x) => (x.id === id ? { ...x, log: { ...x.log, [date]: next } } : x)) }));
    if (cur < h.target && next >= h.target) {
      set((s) => ({ user: { totalXp: s.user.totalXp + 10, xp: s.user.xp + 10 } }));
      get().pushFx({ type: 'xp', amount: 10 });
      if (get().settings.sounds) playSound('done');
      if (get().settings.vibration) vibrate(20);
    } else if (cur >= h.target && next < h.target) {
      set((s) => ({ user: { totalXp: Math.max(0, s.user.totalXp - 10), xp: Math.max(0, s.user.xp - 10) } }));
    }
    get().checkAchievements();
  },

  // ————— التحديات —————
  addChallenge: (c) => set((s) => ({ challenges: [...s.challenges, { id: uid(), log: {}, start: todayKey(), days: 7, icon: '🔥', desc: '', ...c }] })),
  deleteChallenge: (id) => set((s) => ({ challenges: s.challenges.filter((c) => c.id !== id) })),
  checkChallenge(id, date = todayKey()) {
    const c = get().challenges.find((x) => x.id === id);
    if (!c) return;
    const on = !c.log[date];
    set((s) => ({ challenges: s.challenges.map((x) => (x.id === id ? { ...x, log: { ...x.log, [date]: on } } : x)) }));
    if (on) {
      set((s) => ({ user: { totalXp: s.user.totalXp + 20, xp: s.user.xp + 20 } }));
      get().pushFx({ type: 'xp', amount: 20 });
      const done = Object.values({ ...c.log, [date]: true }).filter(Boolean).length;
      if (done >= c.days) {
        set((s) => ({ user: { totalXp: s.user.totalXp + 100, xp: s.user.xp + 100 } }));
        get().notify('achievements', '🏅', 'أكملت التحدي!', `"${c.title}" — +100 XP`);
        get().pushFx({ type: 'achievement', ach: { icon: c.icon, title: 'تحدي مكتمل', desc: c.title } });
      }
    } else {
      set((s) => ({ user: { totalXp: Math.max(0, s.user.totalXp - 20), xp: Math.max(0, s.user.xp - 20) } }));
    }
  },

  // ————— المكافآت —————
  addReward: (r) => set((s) => ({ rewards: [...s.rewards, { id: uid(), icon: '🎁', ...r }] })),
  deleteReward: (id) => set((s) => ({ rewards: s.rewards.filter((r) => r.id !== id) })),
  redeemReward(id) {
    const s = get();
    const r = s.rewards.find((x) => x.id === id);
    if (!r || s.user.xp < r.cost) return false;
    set({ user: { ...s.user, xp: s.user.xp - r.cost }, rewardHistory: [{ id: uid(), title: r.title, icon: r.icon, cost: r.cost, time: Date.now() }, ...s.rewardHistory] });
    get().pushFx({ type: 'reward', reward: r });
    if (s.settings.sounds) playSound('achievement');
    get().checkAchievements();
    return true;
  },

  // ————— المشاريع المشتركة —————
  addProject(name, icon = '📁') {
    const me = { id: 'me', name: get().profile.name || 'أنا', color: '#7C5CFF' };
    set((s) => ({ projects: [...s.projects, { id: uid(), name, icon, members: [me], tasks: [], createdAt: Date.now() }] }));
    get().checkAchievements();
  },
  deleteProject: (id) => set((s) => ({ projects: s.projects.filter((p) => p.id !== id) })),
  addMember(pid, name) {
    const colors = ['#3B82F6', '#34D399', '#FBBF24', '#F472B6', '#F87171', '#22D3EE'];
    set((s) => ({
      projects: s.projects.map((p) => (p.id === pid ? { ...p, members: [...p.members, { id: uid(), name, color: colors[p.members.length % colors.length] }] } : p)),
    }));
  },
  removeMember: (pid, mid) =>
    set((s) => ({
      projects: s.projects.map((p) => (p.id === pid ? { ...p, members: p.members.filter((m) => m.id !== mid), tasks: p.tasks.map((t) => (t.assignee === mid ? { ...t, assignee: 'me' } : t)) } : p)),
    })),
  addProjectTask: (pid, title, assignee = 'me') =>
    set((s) => ({ projects: s.projects.map((p) => (p.id === pid ? { ...p, tasks: [...p.tasks, { id: uid(), title, assignee, status: 'todo' }] } : p)) })),
  updateProjectTask: (pid, tid, patch) =>
    set((s) => ({ projects: s.projects.map((p) => (p.id === pid ? { ...p, tasks: p.tasks.map((t) => (t.id === tid ? { ...t, ...patch } : t)) } : p)) })),
  deleteProjectTask: (pid, tid) => set((s) => ({ projects: s.projects.map((p) => (p.id === pid ? { ...p, tasks: p.tasks.filter((t) => t.id !== tid) } : p)) })),

  // ————— الإعدادات والملف —————
  setSetting: (k, v) => set((s) => ({ settings: { ...s.settings, [k]: v } })),
  setNotifSetting: (k, v) => set((s) => ({ settings: { ...s.settings, notif: { ...s.settings.notif, [k]: v } } })),
  setProfile: (patch) => set((s) => ({ profile: { ...s.profile, ...patch } })),
  setDashboard: (d) => set((s) => ({ dashboard: { ...s.dashboard, ...d } })),
  dismissInsight: (key) => set((s) => ({ dismissedInsights: [...s.dismissedInsights, key] })),
  completeOnboarding(answers) {
    const { goal, energy, time, firstTask, areas, wake } = answers;
    set((s) => ({
      onboarded: true,
      profile: { ...s.profile, mainGoal: goal || s.profile.mainGoal, wake: wake || s.profile.wake, interests: areas?.length ? areas : s.profile.interests },
      energy: energy ? { ...s.energy, [todayKey()]: energy } : s.energy,
      flags: { ...s.flags, availableMinutes: time },
    }));
    if (firstTask) get().addTasks(firstTask);
  },
  importData(data) {
    set({ ...data, ready: true });
    get().maintenance();
  },
  exportData() {
    const s = get();
    return Object.fromEntries(PERSIST_KEYS.map((k) => [k, s[k]]));
  },
  resetData(demo = false) {
    const s = get();
    const fresh = demo ? demoData() : emptyData({ name: s.profile.name, email: s.profile.email, phone: s.profile.phone });
    if (!demo) fresh.onboarded = true;
    set({ ...fresh, settings: s.settings });
    get().maintenance();
  },
}));

// ————— أدوات مساعدة —————
function safe(fn) {
  try {
    return fn();
  } catch {
    return false;
  }
}
function notif(type, icon, title, body) {
  return { id: uid(), type, icon, title, body, time: Date.now(), read: false };
}
function weekendOffset() {
  const d = new Date().getDay();
  const toThu = (4 - d + 7) % 7;
  return toThu === 0 ? 7 : Math.max(2, toThu);
}
export function repeatMatches(tpl, date) {
  const r = tpl.repeat || {};
  const d = fromKey(date);
  const base = fromKey(tpl.date);
  if (r.type === 'daily') return true;
  if (r.type === 'weekly') return d.getDay() === base.getDay();
  if (r.type === 'monthly') return d.getDate() === base.getDate();
  if (r.type === 'days') return (r.days || []).includes(d.getDay());
  return false;
}
export function goalProgress(g, tasks = []) {
  const total = g.milestones.reduce((a, m) => a + m.total, 0);
  const done = g.milestones.reduce((a, m) => a + m.done, 0);
  const gt = tasks.filter((t) => t.goalId === g.id && !t.deletedAt && !t.template);
  const tTotal = gt.length;
  const tDone = gt.filter((t) => t.done).length;
  if (!total && !tTotal) return 0;
  // المراحل لها الوزن الأكبر، والمهام اليومية تضيف تقدمًا بسيطًا
  if (!total) return Math.round((tDone / tTotal) * 100);
  const msPct = done / total;
  if (!tTotal) return Math.round(msPct * 100);
  return Math.round((msPct * 0.85 + (tDone / tTotal) * 0.15) * 100);
}

// حفظ تلقائي (Debounced) لكل تغيير
useStore.subscribe((s) => {
  if (!s.ready || !currentUserId) return;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    const data = Object.fromEntries(PERSIST_KEYS.map((k) => [k, s[k]]));
    storage.save('data:' + currentUserId, data);
  }, 250);
});
window.addEventListener('beforeunload', () => {
  const s = useStore.getState();
  if (s.ready && currentUserId) storage.save('data:' + currentUserId, Object.fromEntries(PERSIST_KEYS.map((k) => [k, s[k]])));
});
