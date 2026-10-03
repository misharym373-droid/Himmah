// البيانات الافتراضية + بيانات المستخدم التجريبي (مشاري)
import { todayKey, addDays, fromMin, nowMin, roundUp5, uid, fromKey } from './date.js';
import { xpAtLevel } from './game.js';

export const DEFAULT_SETTINGS = {
  theme: 'auto', // auto | light | dark
  accent: 'pine',
  scale: 'md', // sm | md | lg
  motion: 'full', // full | lite | off
  background: 'neon', // neon = هادئة | gradient = دافئة | minimal = سادة
  vibration: true,
  sounds: true,
  persona: 'friend',
  language: 'ar',
  browserNotifications: false,
  notif: { upcoming: true, overdue: true, streak: true, endOfDay: true, focus: true, goals: true, achievements: true, assistant: true },
  privacy: { hideStatsOnHome: false, analytics: false },
  surraUrl: '',
};

// بطاقات الرئيسية: core = الأساسية (أعلى الصفحة بترتيب ثابت)، more = أقسام قابلة للطي أسفل الصفحة
export const WIDGETS = [
  { id: 'summary', label: 'ملخص اليوم', section: 'core' },
  { id: 'top3', label: 'أهم 3 مهام اليوم', section: 'core' },
  { id: 'next', label: 'المهمة القادمة', section: 'core' },
  { id: 'goals', label: 'اختصار الأهداف', section: 'core' },
  { id: 'focus', label: 'التركيز', section: 'core' },
  { id: 'dayMap', label: 'خريطة اليوم', section: 'more' },
  { id: 'habits', label: 'العادات والتحديات', section: 'more' },
  { id: 'xp', label: 'المستوى والـStreak والمكافآت', section: 'more' },
  { id: 'stats', label: 'إحصائيات الأسبوع', section: 'more' },
  { id: 'ai', label: 'مساعد التخطيط', section: 'more' },
  { id: 'balance', label: 'توازن الحياة', section: 'more' },
  { id: 'timeMachine', label: 'آلة الزمن', section: 'more' },
];

export const DEFAULT_PROFILE = {
  name: '', email: '', phone: '', age: '', weight: '', height: '', field: '', interests: [],
  wake: '07:00', sleep: '23:00', city: '', avatar: '', personalGoals: [], mainGoal: '',
};

export function makeTask(p = {}) {
  return {
    id: uid(),
    title: '',
    desc: '',
    notes: '',
    date: todayKey(),
    time: null,
    duration: 30,
    priority: 'med',
    area: 'work',
    icon: 'sparkles',
    repeat: { type: 'none', days: [] },
    goalId: null,
    subtasks: [],
    done: false,
    doneAt: null,
    postponed: 0,
    createdAt: Date.now(),
    deletedAt: null,
    xpAwarded: 0,
    ...p,
  };
}

export function emptyData(user) {
  return {
    version: 1,
    onboarded: false,
    user: { totalXp: 0, xp: 0 },
    profile: { ...DEFAULT_PROFILE, name: user?.name || '', email: user?.email || '', phone: user?.phone || '' },
    settings: { ...DEFAULT_SETTINGS },
    dashboard: { order: WIDGETS.map((w) => w.id), hidden: [] },
    tasks: [],
    goals: [],
    habits: defaultHabits(false),
    challenges: [],
    rewards: defaultRewards(),
    rewardHistory: [],
    achievements: {},
    notifications: [
      { id: uid(), type: 'info', icon: 'sparkles', title: 'مرحبًا بك في مسار', body: 'ابدأ بإضافة أول مهمة ليومك.', time: Date.now(), read: false },
    ],
    projects: [],
    focusLog: [],
    energy: {},
    streak: { count: 0, best: 0, lastDate: null, days: {} },
    flags: {},
    dismissedInsights: [],
  };
}

function defaultRewards() {
  return [
    { id: uid(), icon: 'fun', title: 'ساعة ألعاب', cost: 100 },
    { id: uid(), icon: 'meal', title: 'وجبة', cost: 300 },
    { id: uid(), icon: 'film', title: 'فيلم', cost: 500 },
    { id: uid(), icon: 'cart', title: 'شراء شيء', cost: 1000 },
  ];
}

function defaultHabits(withLogs) {
  const H = [
    { icon: 'water', title: 'شرب الماء', target: 8, unit: 'أكواب', color: '#2F7CF6', rate: 0.8 },
    { icon: 'read', title: 'القراءة', target: 1, unit: 'مرة', color: '#2E6B57', rate: 0.75 },
    { icon: 'walk', title: 'المشي', target: 1, unit: 'مرة', color: '#30A46C', rate: 0.7 },
    { icon: 'sleep', title: 'النوم مبكرًا', target: 1, unit: 'مرة', color: '#E8940C', rate: 0.55 },
    { icon: 'meditation', title: 'التأمل', target: 1, unit: 'مرة', color: '#D7264F', rate: 0.5 },
  ];
  return H.map((h, i) => {
    const log = {};
    if (withLogs) {
      for (let d = 1; d <= 40; d++) {
        const r = pseudo(i * 97 + d);
        if (r < h.rate || d <= (i === 0 ? 9 : i === 1 ? 6 : 2)) log[addDays(todayKey(), -d)] = h.target;
        else if (h.target > 1) log[addDays(todayKey(), -d)] = Math.floor(h.target * 0.5);
      }
      if (i === 0) log[todayKey()] = 5;
      if (i === 1) log[todayKey()] = 1;
    }
    return { id: uid(), icon: h.icon, title: h.title, target: h.target, unit: h.unit, color: h.color, log, createdAt: Date.now() };
  });
}

// مولد شبه عشوائي ثابت (حتى تكون البيانات التجريبية متسقة)
function pseudo(n) {
  const x = Math.sin(n * 9301 + 49297) * 233280;
  return x - Math.floor(x);
}

export function demoData() {
  const user = { name: 'مشاري', email: 'demo@himmah.app' };
  const d = emptyData(user);
  const T = todayKey();
  d.onboarded = true;
  d.profile = {
    ...d.profile,
    name: 'مشاري', field: 'طالب هندسة', age: '21', city: 'الرياض', wake: '06:30', sleep: '23:30',
    interests: ['التقنية', 'الرياضة', 'القراءة'], personalGoals: ['تحسين الدراسة', 'زيادة اللياقة', 'تنظيم الوقت'],
    mainGoal: 'التفوق في الجامعة',
  };
  d.user = { totalXp: xpAtLevel(14) + 285, xp: 2840 };

  // مهام اليوم — 82% مكتملة (بالوزن حسب المدة)
  const done = [
    ['06:30', 15, 'pray', 'الأذكار والاستيقاظ', 'family', 'low'],
    ['06:50', 20, 'read', 'قراءة 20 صفحة', 'study', 'low'],
    ['07:15', 45, 'dumbbell', 'تمرين صباحي', 'health', 'med'],
    ['08:05', 20, 'food', 'فطور صحي', 'health', 'low'],
    ['08:30', 60, 'study', 'محاضرة الجامعة', 'study', 'high'],
    ['09:40', 30, 'pen', 'حل مسائل', 'study', 'med'],
    ['10:15', 45, 'work', 'اجتماع المشروع', 'work', 'med'],
    ['11:05', 45, 'pen', 'تسليم الواجب', 'study', 'high'],
    ['12:00', 60, 'coffee', 'غداء وراحة', 'health', 'low'],
  ];
  const now = nowMin();
  const pendStart = Math.min(Math.max(roundUp5(now + 20), 13 * 60 + 15), 21 * 60 + 30);
  const pending = [
    [fromMin(pendStart), 45, 'book', 'مذاكرة التفاضل', 'study', 'high'],
    [fromMin(pendStart + 55), 30, 'study', 'مراجعة المحاضرة', 'study', 'med'],
  ];
  for (const [time, duration, icon, title, area, priority] of done) {
    const [h, m] = time.split(':').map(Number);
    const doneAt = fromKey(T).setHours(h, m + duration);
    d.tasks.push(makeTask({ title, time, duration, icon, area, priority, date: T, done: true, doneAt, xpAwarded: 0 }));
  }
  for (const [time, duration, icon, title, area, priority] of pending) {
    d.tasks.push(makeTask({ title, time, duration, icon, area, priority, date: T, postponed: title === 'مذاكرة التفاضل' ? 1 : 0 }));
  }

  // الغد والأيام القادمة
  const upcoming = [
    [1, '08:00', 60, 'book', 'مذاكرة الفيزياء', 'study', 'high'],
    [1, '11:00', 90, 'study', 'محاضرة الرياضيات', 'study', 'med'],
    [1, '19:00', 60, 'family', 'زيارة الأهل', 'family', 'med'],
    [2, '10:00', 45, 'money', 'مراجعة الميزانية الشهرية', 'money', 'med'],
    [2, '16:00', 120, 'laptop', 'العمل على مشروع التخرج', 'work', 'high'],
    [3, '09:00', 60, 'pen', 'تحضير العرض التقديمي', 'study', 'urgent'],
    [4, '20:00', 120, 'fun', 'سهرة ألعاب مع الأصدقاء', 'fun', 'low'],
  ];
  for (const [off, time, duration, icon, title, area, priority] of upcoming) {
    d.tasks.push(makeTask({ title, time, duration, icon, area, priority, date: addDays(T, off) }));
  }
  // مهمة متأخرة من أمس (لعرض إعادة التخطيط)
  d.tasks.push(makeTask({ title: 'قراءة ملخص الفصل الثالث', time: '21:00', duration: 30, icon: 'read', area: 'study', priority: 'low', date: addDays(T, -1), postponed: 1 }));

  // مهمة متكررة: النادي (الأحد، الثلاثاء، الخميس)
  d.tasks.push(makeTask({ title: 'النادي', time: '18:00', duration: 60, icon: 'dumbbell', area: 'health', priority: 'med', date: T, template: true, repeat: { type: 'days', days: [0, 2, 4] } }));

  // تاريخ الإنجاز لآخر 45 يوم (للإحصائيات وآلة الزمن وتوازن الحياة)
  const pool = [
    ['book', 'مذاكرة', 'study', 60], ['pen', 'حل واجب', 'study', 45], ['study', 'محاضرة', 'study', 60], ['read', 'قراءة', 'study', 30],
    ['dumbbell', 'تمرين', 'health', 45], ['walk', 'مشي', 'health', 30], ['work', 'اجتماع', 'work', 45], ['laptop', 'مشروع التخرج', 'work', 90],
    ['money', 'مراجعة المصاريف', 'money', 20], ['family', 'وقت مع العائلة', 'family', 60], ['fun', 'استراحة ألعاب', 'fun', 45],
  ];
  const weights = [16, 9, 8, 6, 12, 5, 12, 6, 6, 5, 5];
  const wsum = weights.reduce((a, b) => a + b, 0);
  for (let day = 1; day <= 45; day++) {
    const date = addDays(T, -day);
    const dow = fromKey(date).getDay();
    const count = 2 + Math.floor(pseudo(day * 3) * 3) + (dow === 5 ? -1 : 0);
    let clock = 8 * 60 + Math.floor(pseudo(day) * 4) * 30;
    for (let k = 0; k < count; k++) {
      let r = pseudo(day * 11 + k * 7) * wsum;
      let idx = 0;
      while (r > weights[idx]) r -= weights[idx++];
      const [icon, title, area, duration] = pool[Math.min(idx, pool.length - 1)];
      const isDone = pseudo(day * 5 + k) > 0.14;
      const postponed = title === 'مذاكرة' && pseudo(day + k) > 0.55 ? 1 : 0;
      const doneAt = fromKey(date).setHours(0, clock + duration);
      d.tasks.push(makeTask({ title, icon, area, duration, date, time: fromMin(clock), done: isDone, doneAt: isDone ? doneAt : null, postponed, archived: true, priority: 'med' }));
      clock += duration + 30 + Math.floor(pseudo(day * k + 2) * 60);
    }
    if (day <= 30 && pseudo(day * 13) > 0.3) d.focusLog.push({ date, minutes: 25 + Math.floor(pseudo(day * 17) * 70), taskId: null });
  }
  // المهام القديمة غير المكتملة تُعتبر مؤرشفة (لا تزعج المستخدم)
  d.focusLog.push({ date: T, minutes: 45, taskId: null });
  d.focusLog.push({ date: T, minutes: 60, taskId: null });
  d.focusLog.push({ date: T, minutes: 120, taskId: null });

  d.goals = [
    {
      id: uid(), title: 'تعلم الإنجليزية خلال 6 أشهر', area: 'study', icon: 'globe', deadline: addDays(T, 120), createdAt: Date.now() - 60 * 86400000,
      lastActivity: Date.now() - 86400000, months: 6,
      milestones: [
        { id: uid(), title: 'تأسيس القواعد', level: 'month', total: 2, done: 2 },
        { id: uid(), title: 'المفردات الأساسية', level: 'month', total: 4, done: 2 },
        { id: uid(), title: 'المحادثة', level: 'month', total: 3, done: 0 },
        { id: uid(), title: 'الاستماع', level: 'month', total: 1, done: 0 },
      ],
      daily: ['تعلم 10 كلمات جديدة', 'استماع 15 دقيقة', 'مراجعة قاعدة واحدة'],
    },
    {
      id: uid(), title: 'رفع اللياقة البدنية', area: 'health', icon: 'dumbbell', deadline: addDays(T, 75), createdAt: Date.now() - 20 * 86400000,
      lastActivity: Date.now() - 3 * 3600000, months: 3,
      milestones: [
        { id: uid(), title: 'بناء الروتين', level: 'month', total: 4, done: 3 },
        { id: uid(), title: 'زيادة التحمل', level: 'month', total: 4, done: 0 },
        { id: uid(), title: 'قياس النتائج', level: 'month', total: 2, done: 0 },
      ],
      daily: ['تمرين 30 دقيقة', 'شرب 8 أكواب ماء'],
    },
  ];
  d.habits = defaultHabits(true);
  d.challenges = [
    { id: uid(), icon: 'flame', title: 'تحدي 7 أيام بدون تأجيل', desc: 'أنجز كل مهامك في وقتها', days: 7, start: addDays(T, -4), log: Object.fromEntries([1, 2, 3, 4].map((i) => [addDays(T, -i), true])) },
    { id: uid(), icon: 'read', title: 'قراءة 30 دقيقة يوميًا', desc: '30 دقيقة قراءة كل يوم', days: 14, start: addDays(T, -9), log: Object.fromEntries([0, 1, 2, 3, 5, 6, 7, 9].map((i) => [addDays(T, -i), true])) },
    { id: uid(), icon: 'sunrise', title: 'الاستيقاظ مبكرًا', desc: 'الاستيقاظ قبل 6:30', days: 7, start: addDays(T, -1), log: { [addDays(T, -1)]: true, [T]: true } },
    { id: uid(), icon: 'dumbbell', title: 'التمرين 5 أيام', desc: '5 تمارين هذا الأسبوع', days: 5, start: addDays(T, -3), log: { [addDays(T, -3)]: true, [addDays(T, -2)]: true, [T]: true } },
  ];
  d.rewardHistory = [{ id: uid(), title: 'ساعة ألعاب', icon: 'fun', cost: 100, time: Date.now() - 5 * 86400000 }];
  d.projects = [
    {
      id: uid(), name: 'مشروع الجامعة', icon: 'study', createdAt: Date.now(),
      members: [
        { id: 'me', name: 'مشاري', color: '#2E6B57' },
        { id: 'm2', name: 'أحمد', color: '#2F7CF6' },
        { id: 'm3', name: 'محمد', color: '#30A46C' },
      ],
      tasks: [
        { id: uid(), title: 'تحضير العرض التقديمي', assignee: 'm2', status: 'doing' },
        { id: uid(), title: 'كتابة التقرير', assignee: 'me', status: 'todo' },
        { id: uid(), title: 'مراجعة المراجع', assignee: 'm3', status: 'done' },
        { id: uid(), title: 'تصميم الغلاف', assignee: 'me', status: 'done' },
      ],
    },
  ];
  // Streak: 12 يوم متتالي حتى أمس
  const days = {};
  for (let i = 1; i <= 12; i++) days[addDays(T, -i)] = true;
  for (let i = 15; i <= 22; i++) days[addDays(T, -i)] = true;
  d.streak = { count: 12, best: 12, lastDate: addDays(T, -1), days };
  d.achievements = { first: Date.now() - 40 * 86400000, ten: Date.now() - 35 * 86400000, fifty: Date.now() - 12 * 86400000, streak7: Date.now() - 5 * 86400000, xp1000: Date.now() - 20 * 86400000, goal: Date.now() - 60 * 86400000, reward: Date.now() - 5 * 86400000, focus: Date.now() - 10 * 86400000, team: Date.now() - 3 * 86400000 };
  d.energy = {};
  d.notifications = [
    { id: uid(), type: 'upcoming', icon: 'bell', title: 'مهمتك القادمة', body: 'باقي 15 دقيقة على مهمتك القادمة: مذاكرة التفاضل', time: Date.now() - 10 * 60000, read: false },
    { id: uid(), type: 'streak', icon: 'flame', title: 'حافظ على الـStreak', body: 'أكمل مهامك اليوم لتصل إلى 13 يوم متتالي', time: Date.now() - 60 * 60000, read: false },
    { id: uid(), type: 'goals', icon: 'target', title: 'اقتربت من هدفك', body: 'هدف "رفع اللياقة البدنية" وصل 30%', time: Date.now() - 5 * 3600000, read: true },
    { id: uid(), type: 'achievements', icon: 'trophy', title: 'إنجاز جديد', body: 'فتحت إنجاز "روح الفريق"', time: Date.now() - 3 * 86400000, read: true },
  ];
  return d;
}
