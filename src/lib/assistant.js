// مساعد مسار — "Smart Demo Logic"
// منطق محلي ذكي يحاكي تجربة المساعد بدون أي API خارجي.
// لربط نموذج ذكاء اصطناعي حقيقي لاحقًا: استبدل دالة chat() باستدعاء API
// (مثلاً عبر خادم وسيط) وأرجِع نفس الشكل: { text, cards?, actions? }.
import { todayKey, addDays, toMin, fromMin, nowMin, roundUp5, formatDuration } from './date.js';
import { PRIORITIES } from '../config.js';
import { isOverdue } from './game.js';
import { parseTasks, normalize } from './nlp.js';

// ————— شخصية المساعد —————
const VOICE = {
  friend: {
    hi: ['هلا والله!', 'يا هلا!', 'أهلين!'],
    now: 'رأيي تبدأ الآن بـ',
    push: 'أنت قدها.',
    rescue: 'ولا يهمك، نرتبها سوا.',
    empty: 'يومك فاضي حاليًا، وش رأيك نضيف أول مهمة؟',
    done: 'كفو عليك!',
  },
  coach: {
    hi: ['جاهز؟ لنبدأ.', 'تمام، خلنا نركز.', 'لنرتب الأولويات.'],
    now: 'الخطوة الأنسب الآن:',
    push: 'التزم بالخطة وستصل.',
    rescue: 'الوضع قابل للإدارة. هذه خطة واضحة:',
    empty: 'لا توجد مهام. حدد أول مهمة الآن.',
    done: 'إنجاز ممتاز. استمر.',
  },
  hype: {
    hi: ['يلا يا بطل!', 'وقت الإنجاز!', 'جاهز تكسرها؟'],
    now: 'انطلق الآن في',
    push: 'ولا شيء يوقفك!',
    rescue: 'نقدر نقلب اليوم لصالحك!',
    empty: 'الساحة فاضية! أضف مهمة ونبدأ.',
    done: 'وحش!',
  },
  calm: {
    hi: ['مرحبًا، خذ نفسًا عميقًا.', 'أهلًا بك بهدوء.', 'لا بأس، خطوة بخطوة.'],
    now: 'ربما من الجميل أن تبدأ بـ',
    push: 'خطوة صغيرة تكفي الآن.',
    rescue: 'لا تقلق، ما زال هناك وقت. لنخفف الحمل:',
    empty: 'يومك هادئ. أضف ما يهمك حين تكون جاهزًا.',
    done: 'أحسنت، خذ لحظة لتستمتع بإنجازك.',
  },
};
const pick = (a) => (Array.isArray(a) ? a[Math.floor(Math.random() * a.length)] : a);
export const say = (persona, key) => pick((VOICE[persona] || VOICE.friend)[key]);

const live = (s) => s.tasks.filter((t) => !t.deletedAt && !t.template);
const todayOpen = (s) => live(s).filter((t) => !t.done && (t.date === todayKey() || isOverdue(t)));

// ————— وش أسوي الآن؟ —————
export function scoreTask(t, s, now = nowMin()) {
  const energy = s.energy?.[todayKey()] || 'mid';
  let score = (PRIORITIES[t.priority]?.weight || 2) * 20;
  const reasons = [];
  if (isOverdue(t)) {
    score += 35;
    reasons.push('متأخرة');
  }
  if (t.time) {
    const diff = toMin(t.time) - now;
    if (diff <= 15 && diff >= -t.duration) {
      score += 40;
      reasons.push('وقتها الآن');
    } else if (diff > 15 && diff < 90) score += 15;
    else if (diff > 180) score -= 15;
  }
  if (energy === 'low') {
    if (t.duration <= 25) (score += 25), reasons.push('قصيرة وتناسب طاقتك');
    if (t.duration >= 60) score -= 25;
  } else if (energy === 'high') {
    if (t.duration >= 45) (score += 20), reasons.push('تحتاج طاقة عالية وطاقتك ممتازة');
  }
  if (t.priority === 'urgent') reasons.push('عاجلة');
  else if (t.priority === 'high') reasons.push('أولوية عالية');
  return { score, reasons };
}

export function suggestNow(s) {
  const list = todayOpen(s);
  const persona = s.settings.persona;
  if (!list.length) return { task: null, text: say(persona, 'empty') };
  const ranked = list.map((t) => ({ t, ...scoreTask(t, s) })).sort((a, b) => b.score - a.score);
  const best = ranked[0];
  return {
    task: best.t,
    reasons: best.reasons,
    alternatives: ranked.slice(1, 3).map((r) => r.t),
    text: `${say(persona, 'now')} ${best.t.title} لمدة ${formatDuration(best.t.duration)}.`,
  };
}

// ————— أنقذ يومي —————
export function rescuePlan(s) {
  const end = toMin(s.profile.sleep || '23:00') || 23 * 60;
  const start = roundUp5(Math.max(nowMin() + 5, toMin(s.profile.wake || '07:00')));
  const remaining = Math.max(0, end - start);
  const list = todayOpen(s)
    .map((t) => ({ t, ...scoreTask(t, s) }))
    .sort((a, b) => b.score - a.score);
  const keep = [];
  const move = [];
  let used = 0;
  for (const r of list) {
    if (keep.length < 3 && used + r.t.duration <= remaining) {
      keep.push({ ...r.t, newTime: fromMin(start + used) });
      used += r.t.duration + 10; // 10 دقائق فاصل
    } else move.push(r.t);
  }
  return {
    keep,
    move,
    remaining,
    total: list.length,
    text: say(s.settings.persona, 'rescue'),
  };
}

// ————— عندي ساعة فقط —————
export function fitInTime(s, minutes) {
  const list = todayOpen(s)
    .map((t) => ({ t, ...scoreTask(t, s) }))
    .sort((a, b) => b.score / Math.max(b.t.duration, 10) - a.score / Math.max(a.t.duration, 10));
  const chosen = [];
  let used = 0;
  for (const r of list) {
    if (used + r.t.duration <= minutes) {
      chosen.push(r.t);
      used += r.t.duration;
    }
  }
  // إذا لا توجد مهمة كاملة تناسب الوقت، اقترح جزءًا من أهم مهمة
  const partial = !chosen.length && list.length ? list[0].t : null;
  return { tasks: chosen, used, partial };
}

// ————— تقسيم مهمة كبيرة —————
const BREAKDOWNS = [
  [/مذاكر|ذاكر|اختبار|امتحان|فصل|مادة|تفاضل|رياضيات|فيزياء/, ['مراجعة القاعدة', 'مشاهدة الشرح', 'حل 5 مسائل', 'مراجعة الأخطاء', 'اختبار نفسك']],
  [/واجب|تسليم|تقرير|بحث/, ['قراءة المطلوب بدقة', 'جمع المصادر', 'كتابة المسودة', 'المراجعة والتدقيق', 'التسليم']],
  [/مشروع|تطوير|موقع|برنامج|تطبيق/, ['تحديد المتطلبات', 'تقسيم العمل لمراحل', 'تنفيذ المرحلة الأولى', 'اختبار ومراجعة', 'التسليم والتوثيق']],
  [/عرض|برزنتيشن|تقديم/, ['تحديد الفكرة الرئيسية', 'كتابة النقاط', 'تصميم الشرائح', 'التدرب على الإلقاء']],
  [/تمرين|نادي|رياض/, ['إحماء 10 دقائق', 'التمرين الأساسي', 'تمارين إضافية', 'تبريد وإطالات']],
  [/تنظيف|ترتيب|غرفة|بيت/, ['جمع الأغراض المتناثرة', 'ترتيب الأسطح', 'التنظيف', 'رمي ما لا يلزم']],
  [/قراء|كتاب/, ['تحديد عدد الصفحات', 'القراءة بتركيز', 'تدوين أهم فكرة']],
];
export function breakdownTask(title) {
  const n = normalize(title);
  for (const [re, steps] of BREAKDOWNS) if (re.test(n)) return steps;
  return ['تحديد المطلوب بدقة', 'البدء بأصغر خطوة', 'إنجاز الجزء الأساسي', 'المراجعة والإنهاء'];
}
export const isBigTask = (t) => (t.duration || 0) >= 60 || /مذاكر|ذاكر|مشروع|واجب|تقرير|بحث|اختبار/.test(normalize(t.title || ''));

// ————— خطة مذاكرة/اختبار —————
const NUM_WORDS = { واحد: 1, فصلين: 2, يومين: 2, ثلاث: 3, ثلاثة: 3, أربع: 4, اربع: 4, أربعة: 4, خمس: 5, خمسة: 5, ست: 6, ستة: 6, سبع: 7, سبعة: 7, ثمان: 8, تسع: 9, عشر: 10, عشرة: 10 };
const ORD = ['الأول', 'الثاني', 'الثالث', 'الرابع', 'الخامس', 'السادس', 'السابع', 'الثامن', 'التاسع', 'العاشر', 'الحادي عشر', 'الثاني عشر'];
function numNear(text, unitRe) {
  const m = text.match(new RegExp(`(\\d+)\\s*(?:${unitRe})`));
  if (m) return +m[1];
  for (const [w, n] of Object.entries(NUM_WORDS)) if (new RegExp(`(^|\\s)${w}\\s*(?:${unitRe})`).test(text)) return n;
  return null;
}
export function studyPlan(text) {
  const t = normalize(text);
  let days = numNear(t, 'أيام|ايام|يوم') || (/يومين/.test(t) ? 2 : /أسبوع|اسبوع/.test(t) ? 7 : 5);
  let chapters = numNear(t, 'فصول|فصل|دروس|وحدات|وحدة|أجزاء|اجزاء|محاضرات') || (/فصلين/.test(t) ? 2 : Math.max(1, days - 1));
  days = Math.min(Math.max(days, 1), 30);
  chapters = Math.min(Math.max(chapters, 1), 30);
  const subjM = t.match(/(اختبار|امتحان)\s+(\S+)/);
  const subject = subjM && !/بعد|في/.test(subjM[2]) ? subjM[2] : '';
  const studyDays = days > 1 ? days - 1 : 1;
  const plan = [];
  for (let d = 0; d < studyDays; d++) {
    const from = Math.floor((d * chapters) / studyDays);
    const to = Math.floor(((d + 1) * chapters) / studyDays);
    const chs = [];
    for (let c = from; c < to; c++) chs.push(`الفصل ${ORD[c] || c + 1}`);
    plan.push({ day: d + 1, date: addDays(todayKey(), d), title: chs.length ? chs.join(' + ') : 'مراجعة خفيفة' });
  }
  if (days > 1) plan.push({ day: days, date: addDays(todayKey(), days - 1), title: 'مراجعة شاملة واختبار نفسك' });
  return { days, chapters, subject, plan };
}

// ————— تقسيم هدف طويل —————
const GOAL_TEMPLATES = [
  [/انجليزي|إنجليزي|لغة|لغه|انقلش/, ['تأسيس القواعد', 'المفردات الأساسية', 'الاستماع اليومي', 'المحادثة', 'القراءة والكتابة', 'اختبار المستوى'], ['تعلم 10 كلمات جديدة', 'استماع 15 دقيقة', 'مراجعة قاعدة واحدة']],
  [/لياق|وزن|رياض|جري|عضل|صح/, ['بناء الروتين', 'زيادة التحمل', 'تقوية العضلات', 'تحسين التغذية', 'رفع الشدة', 'قياس النتائج'], ['تمرين 30 دقيقة', 'شرب 8 أكواب ماء', 'مشي 6000 خطوة']],
  [/قراء|كتب|كتاب/, ['اختيار الكتب', 'بناء عادة القراءة', 'رفع عدد الصفحات', 'التلخيص', 'تنويع المجالات', 'المراجعة'], ['قراءة 20 صفحة', 'تدوين فكرة', 'مراجعة ملخص']],
  [/برمج|كود|تطوير|تصميم|مهار/, ['الأساسيات', 'مشروع صغير', 'مفاهيم متقدمة', 'مشروع متوسط', 'التحسين والمراجعة', 'مشروع نهائي'], ['درس 30 دقيقة', 'تطبيق عملي', 'مراجعة ما تعلمته']],
  [/مال|ادخار|توفير|فلوس/, ['تتبع المصاريف', 'وضع ميزانية', 'تقليل غير الضروري', 'بناء صندوق طوارئ', 'الادخار المنتظم', 'المراجعة'], ['تسجيل المصاريف', 'مراجعة الميزانية', 'تحويل مبلغ للادخار']],
];
export function goalBreakdown(title, months = 6) {
  const n = normalize(title);
  let tpl = GOAL_TEMPLATES.find(([re]) => re.test(n));
  const monthly = tpl ? tpl[1] : ['التخطيط والبداية', 'بناء الأساس', 'التقدم المنتظم', 'التحدي الأكبر', 'التحسين', 'الإنجاز والمراجعة'];
  const daily = tpl ? tpl[2] : ['خطوة يومية صغيرة', 'مراجعة التقدم', 'تعلم شيء جديد'];
  months = Math.max(1, Math.min(12, months));
  const out = [];
  for (let i = 0; i < months; i++) {
    const mTitle = monthly[Math.min(i, monthly.length - 1)] + (i >= monthly.length ? ` (${i + 1})` : '');
    out.push({
      title: `الشهر ${i + 1}: ${mTitle}`,
      weeks: [1, 2, 3, 4].map((w) => `الأسبوع ${w}: ${w === 4 ? 'مراجعة وتقييم' : mTitle}`),
    });
  }
  return { months: out, daily };
}
export function monthsFromText(text) {
  const t = normalize(text);
  const m = t.match(/(\d+)\s*(أشهر|اشهر|شهور|شهر)/);
  if (m) return +m[1];
  if (/سنة|سنه|عام/.test(t)) return 12;
  if (/شهرين/.test(t)) return 2;
  if (/ثلاث(ة)?\s*(أشهر|شهور)/.test(t)) return 3;
  if (/ست(ة)?\s*(أشهر|شهور)/.test(t)) return 6;
  return 6;
}

// ————— ذاكرة المهام: ما الذي يُؤجل كثيرًا؟ —————
export function postponeInsights(s) {
  const map = {};
  for (const t of s.tasks) {
    if (!t.postponed) continue;
    const key = normalize(t.title).split(' ')[0];
    if (!map[key]) map[key] = { key, count: 0, sample: t };
    map[key].count += t.postponed;
    if (!t.done && !t.deletedAt) map[key].sample = t;
  }
  return Object.values(map)
    .filter((x) => x.count >= 2 && !s.dismissedInsights?.includes(x.key))
    .sort((a, b) => b.count - a.count);
}

// ————— المحادثة —————
export function chat(s, message) {
  const persona = s.settings.persona;
  const m = normalize(message);
  const hi = say(persona, 'hi');

  if (/وش اسوي|وش أسوي|ماذا افعل|ماذا أفعل|ايش اسوي|اقترح/.test(m)) {
    const r = suggestNow(s);
    if (!r.task) return { text: r.text, actions: [{ type: 'addTask', label: 'إضافة مهمة' }] };
    return {
      text: `${r.text}${r.reasons?.length ? `\nالسبب: ${r.reasons.join('، ')}.` : ''}`,
      tasks: [r.task],
      actions: [{ type: 'focus', label: 'ابدأ المهمة', payload: r.task.id }],
    };
  }
  if (/متاخر|متأخر|انقذ|أنقذ|ساعدني|ضايع|ضغط/.test(m)) {
    const p = rescuePlan(s);
    if (!p.total) return { text: `${hi} ما عندك مهام متبقية اليوم، أنت بالسليم.` };
    return {
      text: `${p.text}\nباقي لك تقريبًا ${formatDuration(p.remaining)}. أهم ${p.keep.length} مهام الآن، و${p.move.length} أقترح نقلها لبكرة.`,
      tasks: p.keep,
      actions: [{ type: 'rescue', label: 'طبّق الخطة الجديدة' }],
    };
  }
  const hourM = m.match(/(\d+)\s*(دقيقة|دقايق|دقائق)|ساعة|ساعتين|نص ساعة/);
  if (hourM && /(اقدر|أقدر|انجز|أنجز|عندي|خلال|فقط|بس)/.test(m) && !/اختبار|امتحان/.test(m) && !parseTasks(message).some((t) => t.time)) {
    const minutes = hourM[1] ? +hourM[1] : /ساعتين/.test(m) ? 120 : /نص ساعة/.test(m) ? 30 : 60;
    const r = fitInTime(s, minutes);
    if (!r.tasks.length && !r.partial) return { text: 'ما عندك مهام مفتوحة اليوم. استغل الوقت لشيء تحبه.' };
    if (!r.tasks.length) return { text: `ما فيه مهمة كاملة تناسب ${minutes} دقيقة، لكن تقدر تبدأ جزء من "${r.partial.title}".`, tasks: [r.partial], actions: [{ type: 'focus', label: 'ابدأ جزءًا منها', payload: r.partial.id }] };
    return { text: `خلال ${formatDuration(minutes)} تقدر تنجز ${r.tasks.length} مهام (${formatDuration(r.used)}):`, tasks: r.tasks, actions: [{ type: 'focus', label: 'ابدأ بالأولى', payload: r.tasks[0].id }] };
  }
  if (/اختبار|امتحان|فصول|فصل/.test(m) && /بعد|خلال|عندي|احتاج|أحتاج/.test(m)) {
    const p = studyPlan(message);
    return {
      text: `${hi} هذي خطتك: ${p.chapters} فصول خلال ${p.days} أيام، مع يوم أخير للمراجعة.`,
      plan: p.plan,
      actions: [{ type: 'createPlan', label: 'إنشاء الخطة', payload: p }],
    };
  }
  if (/قسم|قسّم|قسملي|هدف/.test(m)) {
    const goalText = message.replace(/قسم لي|قسّم لي|قسملي|قسم|هذا الهدف|هدفي|هدف/g, '').trim();
    if (goalText.length < 3) return { text: 'اكتب لي الهدف، مثلًا: "قسم لي هدف تعلم الإنجليزية خلال 6 أشهر".' };
    const months = monthsFromText(message);
    const g = goalBreakdown(goalText, months);
    return {
      text: `قسّمت الهدف إلى ${g.months.length} مراحل شهرية، كل مرحلة 4 أسابيع، ومهام يومية بسيطة:`,
      goal: { title: goalText.replace(/خلال.*$/, '').trim() || goalText, months, breakdown: g },
      actions: [{ type: 'createGoal', label: 'إنشاء الهدف', payload: { title: goalText.replace(/خلال.*$/, '').trim(), months, breakdown: g } }],
    };
  }
  if (/رتب|رتّب|نظم|نظّم/.test(m)) {
    const open = todayOpen(s);
    if (!open.length) return { text: say(persona, 'empty'), actions: [{ type: 'addTask', label: 'إضافة مهمة' }] };
    const ranked = open.map((t) => ({ t, ...scoreTask(t, s) })).sort((a, b) => b.score - a.score);
    let start = roundUp5(Math.max(nowMin() + 5, toMin(s.profile.wake || '07:00')));
    const tasks = ranked.map((r) => {
      const x = { ...r.t, newTime: fromMin(start) };
      start += r.t.duration + 10;
      return x;
    });
    return { text: `${hi} رتبت ${tasks.length} مهام حسب الأولوية والطاقة والوقت:`, tasks, actions: [{ type: 'reorder', label: 'اعتمد هذا الترتيب', payload: tasks.map((t) => ({ id: t.id, time: t.newTime })) }] };
  }
  const parsed = parseTasks(message);
  if (parsed.length && parsed.some((p) => p.time)) {
    return { text: `فهمت ${parsed.length > 1 ? `${parsed.length} مهام` : 'المهمة'}:`, parsed, actions: [{ type: 'addParsed', label: 'أضفها لجدولي', payload: parsed }] };
  }
  if (/شكرا|شكرًا|يعطيك|تسلم/.test(m)) return { text: 'العفو! أنا هنا متى ما احتجتني.' };
  return {
    text: `${hi} أقدر أساعدك في:\n• "رتب يومي"\n• "وش أسوي الآن؟"\n• "وش أقدر أنجز خلال ساعة؟"\n• "أنا متأخر اليوم، ساعدني"\n• "عندي اختبار بعد 5 أيام وأحتاج أذاكر 4 فصول"\n• "قسم لي هدف تعلم الإنجليزية خلال 6 أشهر"\n• أو اكتب مهامك مع أوقاتها وأجدولها لك.`,
  };
}
