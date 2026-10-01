// نظام XP والمستويات والإنجازات
import { todayKey, addDays, toMin } from './date.js';

// XP المطلوب للانتقال من المستوى n إلى n+1
export const xpForLevel = (n) => 100 + 20 * n;

export function levelInfo(totalXp) {
  let level = 1;
  let floor = 0;
  while (totalXp >= floor + xpForLevel(level)) {
    floor += xpForLevel(level);
    level++;
  }
  const need = xpForLevel(level);
  const into = totalXp - floor;
  return { level, into, need, pct: Math.round((into / need) * 100) };
}

// إجمالي XP اللازم للوصول لمستوى معيّن (للبيانات التجريبية)
export function xpAtLevel(level) {
  let t = 0;
  for (let i = 1; i < level; i++) t += xpForLevel(i);
  return t;
}

// حجم المهمة يحدد XP
export function taskXp(task) {
  const d = task.duration || 30;
  let base = d <= 20 ? 20 : d <= 50 ? 50 : 100;
  if (task.priority === 'urgent') base += 10;
  return base;
}
export function taskSize(task) {
  const d = task.duration || 30;
  return d <= 20 ? 'صغيرة' : d <= 50 ? 'متوسطة' : 'كبيرة';
}

const live = (s) => s.tasks.filter((t) => !t.deletedAt);
const doneTasks = (s) => live(s).filter((t) => t.done);

// الإنجازات — secret: تظهر كـ ؟؟؟ حتى تُفتح
export const ACHIEVEMENTS = [
  { id: 'first', icon: 'seedling', title: 'البداية', desc: 'أكمل أول مهمة', check: (s) => doneTasks(s).length >= 1 },
  { id: 'ten', icon: 'medal', title: 'أول 10 مهام', desc: 'أكمل 10 مهام', check: (s) => doneTasks(s).length >= 10 },
  { id: 'fifty', icon: 'medal', title: 'نصف المئة', desc: 'أكمل 50 مهمة', check: (s) => doneTasks(s).length >= 50 },
  { id: 'hundred', icon: 'award', title: '100 مهمة', desc: 'أكمل 100 مهمة', check: (s) => doneTasks(s).length >= 100 },
  { id: 'streak7', icon: 'flame', title: 'أسبوع مشتعل', desc: '7 أيام متتالية', check: (s) => s.streak.count >= 7 },
  { id: 'streak30', icon: 'flame', title: '30 يوم متتالي', desc: 'حافظ على الـStreak شهرًا كاملًا', check: (s) => s.streak.count >= 30 },
  {
    id: 'morning5', icon: 'zap', title: '5 مهام قبل الظهر', desc: 'أنجز 5 مهام قبل 12:00 في يوم واحد', secret: true,
    check: (s) => {
      const t = todayKey();
      return doneTasks(s).filter((x) => x.doneAt && x.date === t && new Date(x.doneAt).getHours() < 12).length >= 5;
    },
  },
  { id: 'xp1000', icon: 'trophy', title: '1000 XP', desc: 'اجمع 1000 XP', check: (s) => s.user.totalXp >= 1000 },
  { id: 'xp5000', icon: 'crown', title: 'أسطورة XP', desc: 'اجمع 5000 XP', check: (s) => s.user.totalXp >= 5000 },
  { id: 'focus', icon: 'target', title: 'تركيز عميق', desc: 'جلسة تركيز 45 دقيقة أو أكثر', check: (s) => s.focusLog.some((f) => f.minutes >= 45) },
  { id: 'goal', icon: 'rocket', title: 'صاحب رؤية', desc: 'أنشئ أول هدف', check: (s) => s.goals.length >= 1 },
  { id: 'habit7', icon: 'leaf', title: 'عادة راسخة', desc: 'التزم بعادة 7 أيام متتالية', check: (s) => s.habits.some((h) => habitStreak(h) >= 7) },
  { id: 'reward', icon: 'gift', title: 'تستاهل', desc: 'استبدل أول مكافأة', check: (s) => s.rewardHistory.length >= 1 },
  { id: 'rescue', icon: 'siren', title: 'منقذ اليوم', desc: 'استخدم "أنقذ يومي"', secret: true, check: (s) => !!s.flags.rescued },
  { id: 'voice', icon: 'mic', title: 'صوتك مسموع', desc: 'أضف مهمة بالصوت', secret: true, check: (s) => !!s.flags.voice },
  { id: 'night', icon: 'owl', title: 'بومة الليل', desc: 'أكمل مهمة بعد 11 مساءً', secret: true, check: (s) => doneTasks(s).some((x) => x.doneAt && new Date(x.doneAt).getHours() >= 23) },
  { id: 'team', icon: 'handshake', title: 'روح الفريق', desc: 'أنشئ مشروعًا مشتركًا', check: (s) => s.projects.length >= 2 },
  { id: 'perfect', icon: 'gem', title: 'يوم مثالي', desc: 'أكمل 100% من مهام يومك', check: (s) => {
      const t = live(s).filter((x) => x.date === todayKey());
      return t.length >= 3 && t.every((x) => x.done);
    } },
];

export function habitStreak(h) {
  let n = 0;
  let d = todayKey();
  if (!((h.log[d] || 0) >= h.target)) d = addDays(d, -1);
  while ((h.log[d] || 0) >= h.target) {
    n++;
    d = addDays(d, -1);
  }
  return n;
}
export function habitRate(h, days = 30) {
  let ok = 0;
  for (let i = 0; i < days; i++) if ((h.log[addDays(todayKey(), -i)] || 0) >= h.target) ok++;
  return Math.round((ok / days) * 100);
}

// نسبة إنجاز اليوم (بالوزن حسب المدة)
export function dayProgress(tasks, date = todayKey()) {
  const list = tasks.filter((t) => !t.deletedAt && t.date === date);
  if (!list.length) return { pct: 0, done: 0, total: 0, list };
  const total = list.reduce((a, t) => a + (t.duration || 30), 0);
  const done = list.filter((t) => t.done).reduce((a, t) => a + (t.duration || 30), 0);
  return { pct: Math.round((done / total) * 100), done: list.filter((t) => t.done).length, total: list.length, list };
}

export function isOverdue(t, now = new Date()) {
  if (t.done || t.deletedAt || t.archived || t.template) return false;
  const tk = todayKey();
  if (t.date < tk) return true;
  if (t.date === tk && t.time) {
    const end = toMin(t.time) + (t.duration || 30);
    return now.getHours() * 60 + now.getMinutes() > end + 30;
  }
  return false;
}
