// Hooks مشتركة — تحسب البيانات المشتقة مرة واحدة وتقلل إعادة الرسم
import { useEffect, useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useStore } from './store.js';
import { todayKey, toMin, nowMin } from './lib/date.js';
import { dayProgress } from './lib/game.js';

// الحالة التي يحتاجها منطق المساعد فقط (بدل الاشتراك في كل الـStore)
export const useAssistantState = () =>
  useStore(useShallow((s) => ({ tasks: s.tasks, energy: s.energy, settings: s.settings, profile: s.profile })));

// ساعة حية تتحدث كل `ms` (للعد التنازلي والوقت المتبقي)
export function useNow(ms = 30000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}

// مهام اليوم + التقدم + المهمة القادمة + الوقت المتبقي من اليوم
export function useToday() {
  const tasks = useStore((s) => s.tasks);
  const sleep = useStore((s) => s.profile.sleep);
  const now = useNow(30000);
  return useMemo(() => {
    const T = todayKey();
    const list = tasks.filter((t) => !t.deletedAt && !t.template && t.date === T).sort((a, b) => (toMin(a.time) ?? 9999) - (toMin(b.time) ?? 9999));
    const progress = dayProgress(list, T);
    const m = nowMin();
    const current = list.find((t) => !t.done && t.time && toMin(t.time) <= m && toMin(t.time) + t.duration > m) || null;
    const next = list.find((t) => !t.done && t.time && toMin(t.time) > m) || null;
    const end = toMin(sleep || '23:00') ?? 23 * 60;
    const dayLeft = Math.max(0, end - m);
    const openMinutes = list.filter((t) => !t.done).reduce((a, t) => a + (t.duration || 0), 0);
    return { T, list, progress, current, next, dayLeft, openMinutes, minuteNow: m };
  }, [tasks, sleep, now]); // eslint-disable-line react-hooks/exhaustive-deps
}
