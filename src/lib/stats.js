// حسابات الإحصائيات — كلها مشتقة من البيانات الحقيقية للمستخدم
import { todayKey, addDays, fromKey, dayName, dayShort, toMin, clock12 } from './date.js';
import { AREAS } from '../config.js';

const real = (tasks) => tasks.filter((t) => !t.deletedAt && !t.template);

export function weekBars(tasks, days = 7) {
  const T = todayKey();
  const list = real(tasks);
  const out = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = addDays(T, -i);
    const day = list.filter((t) => t.date === d);
    out.push({ date: d, label: dayShort(fromKey(d).getDay()), done: day.filter((t) => t.done).length, total: day.length, today: i === 0 });
  }
  return out;
}

export function summary(tasks, focusLog = [], range = 7) {
  const T = todayKey();
  const from = range === Infinity ? '0000' : addDays(T, -(range - 1));
  const list = real(tasks).filter((t) => t.date >= from && t.date <= T);
  const done = list.filter((t) => t.done);
  const rate = list.length ? Math.round((done.length / list.length) * 100) : 0;
  const focus = focusLog.filter((f) => f.date >= from && f.date <= T).reduce((a, f) => a + f.minutes, 0);
  const focusToday = focusLog.filter((f) => f.date === T).reduce((a, f) => a + f.minutes, 0);
  const avgDur = done.length ? Math.round(done.reduce((a, t) => a + (t.duration || 0), 0) / done.length) : 0;

  // أفضل وقت للإنجاز (نافذة ساعتين)
  const hours = Array(24).fill(0);
  for (const t of done) {
    const h = t.doneAt ? new Date(t.doneAt).getHours() : t.time ? Math.floor(toMin(t.time) / 60) : null;
    if (h != null) hours[h]++;
  }
  let best = -1;
  let bestH = 9;
  for (let h = 5; h < 23; h++) {
    const s = hours[h] + hours[h + 1];
    if (s > best) (best = s), (bestH = h);
  }
  // أكثر يوم إنتاجية
  const byDay = Array(7).fill(0);
  for (const t of real(tasks).filter((x) => x.done)) byDay[fromKey(t.date).getDay()]++;
  const topDay = byDay.indexOf(Math.max(...byDay));
  // أكثر نوع مهام يتم تأجيله
  const post = {};
  for (const t of real(tasks)) if (t.postponed) post[t.area] = (post[t.area] || 0) + t.postponed;
  const topPost = Object.entries(post).sort((a, b) => b[1] - a[1])[0];

  // التأجيل ضمن الفترة
  const postponedTasks = list.filter((t) => t.postponed > 0).length;
  return {
    postponedTasks,
    postponeRate: list.length ? Math.round((postponedTasks / list.length) * 100) : 0,
    total: list.length,
    done: done.length,
    pending: list.length - done.length,
    rate,
    focus,
    focusToday,
    avgDur,
    bestWindow: `${clock12(bestH * 60)} - ${clock12((bestH + 2) * 60)}`,
    hours,
    topDay: Math.max(...byDay) > 0 ? dayName(topDay) : '—',
    byDay,
    mostPostponed: topPost ? AREAS[topPost[0]]?.label : '—',
    mostPostponedCount: topPost ? topPost[1] : 0,
  };
}

export function balance(tasks, days = 30) {
  const from = addDays(todayKey(), -days);
  const list = real(tasks).filter((t) => t.date >= from && t.date <= todayKey());
  const mins = {};
  for (const t of list) mins[t.area] = (mins[t.area] || 0) + (t.duration || 30);
  const total = Object.values(mins).reduce((a, b) => a + b, 0) || 1;
  return Object.keys(AREAS)
    .map((k) => ({ key: k, ...AREAS[k], minutes: mins[k] || 0, pct: Math.round(((mins[k] || 0) / total) * 100) }))
    .sort((a, b) => b.pct - a.pct);
}

export function timeMachine(tasks) {
  const T = todayKey();
  const done = real(tasks).filter((t) => t.done);
  const cumBefore = (d) => done.filter((t) => t.date <= d).length;
  const past30 = cumBefore(addDays(T, -30));
  const nowTotal = cumBefore(T);
  const last30 = nowTotal - past30;
  const rate = last30 / 30;
  const future = Math.round(nowTotal + rate * 30);
  const today = done.filter((t) => t.date === T).length;
  const series = [];
  for (let i = -30; i <= 0; i += 2) series.push({ x: i, y: cumBefore(addDays(T, i)) });
  const proj = [];
  for (let i = 0; i <= 30; i += 2) proj.push({ x: i, y: Math.round(nowTotal + rate * i) });
  return { past30, nowTotal, today, future, rate, series, proj, last30 };
}
