// محلل نصوص عربي محلي (بدون AI): يحوّل الكلام الطبيعي إلى مهام
// يستخرج: العنوان، التاريخ، الوقت، المدة، الأولوية، المجال، التكرار
// مثال: "عندي اختبار رياضيات الخميس الساعة 7 وأبغى أذاكر ساعتين"
import { todayKey, addDays, fromKey, fromMin, toMin, nowMin, clock12, addMonths } from './date.js';
import { tr, trf } from '../i18n/index.js';

const AR_DIGITS = { '٠': 0, '١': 1, '٢': 2, '٣': 3, '٤': 4, '٥': 5, '٦': 6, '٧': 7, '٨': 8, '٩': 9 };
const WORD_NUM = {
  واحدة: 1, واحد: 1, وحدة: 1, ثنتين: 2, اثنين: 2, اثنتين: 2, ثلاث: 3, ثلاثة: 3, أربع: 4, اربع: 4, أربعة: 4, اربعة: 4,
  خمس: 5, خمسة: 5, ست: 6, ستة: 6, سبع: 7, سبعة: 7, ثمان: 8, ثمانية: 8, ثمانيه: 8, تسع: 9, تسعة: 9, عشر: 10, عشرة: 10,
  'احدعش': 11, 'إحدى عشر': 11, 'حدعش': 11, 'اثنعش': 12, 'اثنا عشر': 12, 'طنعش': 12,
};

export function normalize(text) {
  let t = String(text || '').replace(/[٠-٩]/g, (d) => AR_DIGITS[d]);
  t = t.replace(/[\u064B-\u0652\u0640]/g, '');
  // أرقام مكتوبة بالحروف بعد "الساعة"
  for (const [w, n] of Object.entries(WORD_NUM)) {
    t = t.replace(new RegExp(`(الساعة|الساعه|ساعة|الساعة)\\s+${w}(?=\\s|$|[،,.])`, 'g'), `$1 ${n}`);
  }
  return t.replace(/\s+/g, ' ').trim();
}

// [نمط, مفتاح الأيقونة, المجال] — المفاتيح معرّفة في components/Glyph.jsx
const ICONS = [
  [/اختبار|امتحان|كويز/, 'pen', 'study'],
  [/مذاكر|ذاكر|دراس|فصل|تفاضل|رياضيات|فيزياء|كيمياء|أحياء/, 'book', 'study'],
  [/محاضر|جامع|كلاس|درس/, 'study', 'study'],
  [/واجب|حل|مسائل|تمارين الكتاب|تسليم/, 'pen', 'study'],
  [/قراء|اقرأ|أقرأ|كتاب/, 'read', 'study'],
  [/نادي|تمرين|تمرن|جيم|رياض|جري|كارديو/, 'dumbbell', 'health'],
  [/مشي|امشي|أمشي/, 'walk', 'health'],
  [/استراح|راحة|قهوة|بريك/, 'coffee', 'health'],
  [/نوم|أنام|انام|قيلول/, 'sleep', 'health'],
  [/ماء|موية|مويه/, 'water', 'health'],
  [/أكل|غداء|عشاء|فطور|وجبة/, 'food', 'health'],
  [/طبيب|دكتور|موعد مستشفى|صيدلي|مستشفى/, 'doctor', 'health'],
  [/برمج|كود|تطوير|موقع/, 'laptop', 'work'],
  [/اجتماع|ميتنج|عمل|دوام|مشروع|عميل|تقرير|إيميل|ايميل/, 'work', 'work'],
  [/فلوس|فاتورة|فواتير|ميزاني|مصروف|بنك|تحويل|سداد|ادخار/, 'money', 'money'],
  [/تسوق|مشتريات|سوبرماركت|بقالة/, 'cart', 'money'],
  [/صلاة|قرآن|أذكار|اذكار/, 'pray', 'family'],
  [/أهل|اهل|عائل|أمي|أبوي|ابوي|الوالد|زيارة|أخوي|اخوي/, 'family', 'family'],
  [/فيلم|مسلسل|سينما/, 'film', 'fun'],
  [/لعب|ألعاب|العاب|طلعة|بلايستيشن/, 'fun', 'fun'],
  [/سفر|رحلة|مطار/, 'travel', 'fun'],
];

export function guessMeta(title) {
  for (const [re, icon, area] of ICONS) if (re.test(title)) return { icon, area };
  for (const [re, icon, area] of ICONS_EN) if (re.test(title)) return { icon, area };
  return { icon: 'sparkles', area: 'work' };
}

const PRIORITY_WORDS = /\s(ضروري جدا|مهم جدا|ضروري|عاجل|طارئ|لو فضيت|إذا فضيت|اذا فضيت|اختياري|مو ضروري|مش ضروري)(?=\s|$)/g;

// الأولوية تُستنتج من كلمات واضحة فقط
export function inferPriority(text) {
  if (/عاجل|طارئ|ضروري جدا|مهم جدا|ضروووري|الحين الحين/.test(text)) return 'urgent';
  if (/اختبار|امتحان|تسليم|موعد نهائي|ديدلاين|deadline|ضروري|مهم|لازم/.test(text)) return 'high';
  if (/لو فضيت|إذا فضيت|اذا فضيت|اختياري|مو ضروري|مش ضروري|وقت الفراغ/.test(text)) return 'low';
  if (/[A-Za-z]/.test(text)) return inferPriorityEn(text) || 'med';
  return 'med';
}

const VERB_TO_NOUN = [
  [/^(أذاكر|اذاكر|ذاكر|بذاكر|راح اذاكر)\s*/, 'مذاكرة '],
  [/^(أراجع|اراجع|راجع|براجع)\s*/, 'مراجعة '],
  [/^(أحل|احل|حل|بحل)\s*/, 'حل '],
  [/^(أقرأ|اقرأ|اقرا|أقرا|بقرأ)\s*/, 'قراءة '],
  [/^(أتمرن|اتمرن|بتمرن)\s*/, 'تمرين '],
  [/^(أروح|اروح|بروح|رايح)\s*(لل(?=\S))?/, 'ال'],
  [/^(أشوف|اشوف|بشوف)\s*/, 'مشاهدة '],
  [/^(أطبخ|اطبخ)\s*/, 'طبخ '],
  [/^(أنظف|انظف|أرتب|ارتب)\s*/, 'ترتيب '],
  [/^(أسلم|اسلم|أسلّم)\s*/, 'تسليم '],
  [/^(أكتب|اكتب)\s*/, 'كتابة '],
  [/^(أتصل|اتصل)\s*(على|ب)?\s*/, 'اتصال بـ'],
  [/^(أزور|ازور)\s*/, 'زيارة '],
  [/^(أنام|انام)\s*/, 'النوم '],
];

const FILLERS = /^(عندي|عندنا|لازم|ذكرني|ذكّرني|نبهني|أبي|ابي|أبغى|ابغى|ابغا|أبغا|أريد|اريد|ودي|حاب|خلني|راح|بعدين|و|ثم|بعدها|وبعدها|اليوم|بكرة|بكره|غدا|غدًا)\s+/;

function cleanTitle(s) {
  let t = s;
  for (let i = 0; i < 4; i++) t = t.replace(FILLERS, '');
  for (const [re, rep] of VERB_TO_NOUN) {
    if (re.test(t)) {
      t = t.replace(re, rep);
      break;
    }
  }
  t = t.replace(/^الال/, 'ال').replace(/^ال(?=\s|$)/, '');
  t = t.replace(/\s+(في|على|الى|إلى|من)$/, '').replace(/[،,.؛\s]+$/, '').replace(/^[،,.؛\s]+/, '');
  t = t.replace(/\s+/g, ' ').trim();
  // "مذاكرة تفاضل" -> "مذاكرة التفاضل"
  t = t.replace(/^(مذاكرة|مراجعة|قراءة|اختبار|امتحان) (?!ال)(\S+)$/, '$1 ال$2');
  return t;
}

function parseDuration(s) {
  let m;
  if ((m = s.match(/(\d+(?:\.\d+)?)\s*(ساعات|ساعة|ساعه|س)(?!\S*\d)/)) && /لمدة|مدة|لـ|ل\s|تقريبا|تقريبًا/.test(s))
    return { min: Math.round(parseFloat(m[1]) * 60), raw: m[0] };
  if ((m = s.match(/(لمدة|مدة|لـ?)?\s*(\d+)\s*(دقيقة|دقايق|دقائق|دقيقه|د)(?=\s|$|[،,.])/))) return { min: +m[2], raw: m[0] };
  if ((m = s.match(/(لمدة|مدة)?\s*ساعة\s*(و\s*نص|ونص|ونصف|و\s*نصف)/))) return { min: 90, raw: m[0] };
  if ((m = s.match(/(لمدة|مدة)?\s*ساعة\s*(و\s*ربع|وربع)/))) return { min: 75, raw: m[0] };
  if ((m = s.match(/(لمدة|مدة)?\s*(نص|نصف)\s*ساعة/))) return { min: 30, raw: m[0] };
  if ((m = s.match(/(لمدة|مدة)?\s*ربع\s*ساعة/))) return { min: 15, raw: m[0] };
  if ((m = s.match(/(لمدة|مدة)?\s*ساعتين|ساعتان/))) return { min: 120, raw: m[0] };
  if ((m = s.match(/(لمدة|مدة)\s*(\d+)\s*(ساعات|ساعة)/))) return { min: +m[2] * 60, raw: m[0] };
  if ((m = s.match(/(لمدة|مدة)\s*ساعة/))) return { min: 60, raw: m[0] };
  return null;
}

function parseTime(s) {
  const m = s.match(
    /(?:الساعة|الساعه|ساعة|على|بـ?)\s*(\d{1,2})(?:[:.](\d{2}))?\s*(و\s*نص|ونص|ونصف|و\s*ربع|وربع|الا\s*ربع|إلا\s*ربع)?\s*(الصبح|الصباح|صباحا|صباحًا|الفجر|الظهر|العصر|المغرب|العشاء|الليل|بالليل|المساء|مساء|مساءً|pm|am|ص|م)?(?=\s|$|[،,.])/i
  );
  if (!m) {
    const m2 = s.match(/\b(\d{1,2}):(\d{2})\b/);
    if (!m2) return null;
    return { min: +m2[1] * 60 + +m2[2], raw: m2[0], explicit: true, hasMer: +m2[1] >= 12 };
  }
  let h = +m[1];
  let min = m[2] ? +m[2] : 0;
  const frac = (m[3] || '').replace(/\s/g, '');
  if (/نص/.test(frac)) min = 30;
  else if (/وربع/.test(frac)) min = 15;
  else if (/ربع/.test(frac)) {
    h -= 1;
    min = 45;
  }
  const mer = (m[4] || '').toLowerCase();
  if (/الظهر/.test(mer)) h = h < 11 ? h + 12 : h;
  else if (/(العصر|المغرب|العشاء|الليل|بالليل|مساء|المساء|^م$|pm)/.test(mer)) h = h < 12 ? h + 12 : h;
  else if (!mer && h >= 1 && h <= 6) h += 12; // "الساعة 4" غالبًا العصر
  if (h > 23) return null;
  return { min: h * 60 + min, raw: m[0], hasMer: !!mer || h >= 12 };
}

const WEEKDAYS = [
  [/الأحد|الاحد/, 0], [/الاثنين|الإثنين|الاثنين/, 1], [/الثلاثاء|الثلاثا/, 2], [/الأربعاء|الاربعاء|الاربعا/, 3],
  [/الخميس/, 4], [/الجمعة|الجمعه/, 5], [/السبت/, 6],
];
// داخل "كل ..." نقبل الصيغ العامية بدون "ال": كل احد وثلوث
const W = (alt) => new RegExp(`(^|[^\\u0600-\\u06FF])و?(ال)?(${alt})(?![\\u0600-\\u06FF])`);
const WEEKDAYS_LOOSE = [
  [new RegExp('(^|[^\\u0600-\\u06FF])(و?ال)?(أحد|احد)(?![\\u0600-\\u06FF])'), 0], [W('اثنين|إثنين|اثنينه|ثنين'), 1], [W('ثلاثاء|ثلاثا|ثلوث|ثلاثه'), 2],
  [W('أربعاء|اربعاء|اربعا|ربوع'), 3], [W('خميس'), 4], [W('جمعة|جمعه'), 5], [W('سبت'), 6],
];

function parseDate(s, base) {
  if (/بعد\s*(بكرة|بكره|غد)/.test(s)) return { date: addDays(base, 2), raw: s.match(/بعد\s*(بكرة|بكره|غدٍ?)/)[0] };
  const m = s.match(/بكرة|بكره|غدا|غدًا|غداً|باكر/);
  if (m) return { date: addDays(base, 1), raw: m[0] };
  const mi = s.match(/بعد\s*(\d+)\s*(أيام|ايام|يوم)/);
  if (mi) return { date: addDays(base, +mi[1]), raw: mi[0] };
  for (const [re, day] of WEEKDAYS) {
    const w = s.match(re);
    if (w && !/كل/.test(s)) {
      const cur = fromKey(base).getDay();
      let d = (day - cur + 7) % 7;
      if (d === 0 && !(base === todayKey() && (parseTime(s)?.min ?? 0) > nowMin())) d = 7;
      return { date: addDays(base, d), raw: (s.match(new RegExp('(يوم\\s*)?' + w[0])) || w)[0] };
    }
  }
  const t = s.match(/اليوم|الليلة/);
  if (t) return { date: base, raw: t[0] };
  return null;
}

function parseRepeat(s) {
  if (/كل\s*يوم|يوميا|يوميًا|يومياً/.test(s)) return { type: 'daily', days: [], raw: s.match(/كل\s*يوم|يوميا|يوميًا|يومياً/)[0] };
  if (/كل\s*(أسبوع|اسبوع)|أسبوعيا|اسبوعيا|أسبوعيًا/.test(s)) return { type: 'weekly', days: [], raw: s.match(/كل\s*(أسبوع|اسبوع)|أسبوعيا|اسبوعيا|أسبوعيًا/)[0] };
  if (/كل\s*شهر|شهريا|شهريًا/.test(s)) return { type: 'monthly', days: [], raw: s.match(/كل\s*شهر|شهريا|شهريًا/)[0] };
  if (/كل\s/.test(s)) {
    const days = WEEKDAYS_LOOSE.filter(([re]) => re.test(s)).map(([, d]) => d);
    if (days.length) {
      const m = s.match(/كل\s[^0-9]*?(?=\s*(الساعة|لمدة|$))/);
      return { type: 'days', days, raw: m ? m[0] : '' };
    }
  }
  return null;
}

// "لمدة 3 شهور" / "لمدة سنة" / "لمدة أسبوعين" => مدة التكرار
const NUM_WORDS = { واحد: 1, شهر: 1, اثنين: 2, ثنين: 2, ثلاث: 3, ثلاثة: 3, أربع: 4, اربع: 4, أربعة: 4, اربعة: 4, خمس: 5, خمسة: 5, ست: 6, ستة: 6, سبع: 7, ثمان: 8, ثمانية: 8, تسع: 9, عشر: 10, عشرة: 10 };
function parseSpan(s) {
  const m = s.match(/(?:لمدة|لمده|مدة|مده|طوال)\s*(\d+|[\u0600-\u06FF]+)?\s*(شهرين|شهور|أشهر|اشهر|شهر|سنتين|سنة|سنه|أسبوعين|اسبوعين|أسابيع|اسابيع|أسبوع|اسبوع)/);
  if (!m) return null;
  let n = /^\d+$/.test(m[1] || '') ? +m[1] : NUM_WORDS[m[1]] || 1;
  const u = m[2];
  if (/ين$/.test(u)) n = 2;
  const months = /سن/.test(u) ? n * 12 : /شه/.test(u) ? n : 0;
  const weeks = months ? 0 : n;
  return { months, weeks, raw: m[0] };
}
export const spanUntil = (start, sp) => (sp.months ? addMonths(start, sp.months) : addDays(start, sp.weeks * 7 - 1));

/**
 * يحلل نصًا ويعيد قائمة مهام مقترحة
 * @returns {Array<{title,date,time,duration,area,icon,repeat}>}
 */
export function parseTasks(input, { base = todayKey() } = {}) {
  if (isEnglishText(String(input || ''))) return parseTasksEn(input, base);
  const text = normalize(input);
  if (!text) return [];
  const parts = text
    .split(/\s*(?:،|,|\.|؛|\n|\sثم\s|\sوبعدها\s|\sو\s*بعدها\s|\sوبعد\sكذا\s|\sوبعد\sذلك\s|\sبعدها\s|\sوبعده\s|\sو(?=(?:أبغى|ابغى|أبغا|ابغا|أبي|ابي|أبى|لازم|أريد|اريد|عندي|بعدين|ودي|كمان)\s))\s*/)
    .map((p) => p.trim())
    .filter((p) => p.length > 1);

  const out = [];
  let cursor = null; // وقت انتهاء المهمة السابقة
  let lastDate = null;
  for (let p of parts) {
    let seg = ' ' + p + ' ';
    const rep = parseRepeat(seg);
    if (rep?.raw) seg = seg.replace(rep.raw, ' ');
    const span = rep ? parseSpan(seg) : null;
    if (span) seg = seg.replace(span.raw, ' ');
    const date = parseDate(seg, base);
    if (date) seg = seg.replace(date.raw, ' ');
    const dur = parseDuration(seg);
    if (dur) seg = seg.replace(dur.raw, ' ');
    const time = parseTime(seg);
    if (time) seg = seg.replace(time.raw, ' ');
    seg = seg.replace(PRIORITY_WORDS, ' ').replace(/\s(يوم|في|الساعة|الساعه)\s*$/g, ' ');
    let title = cleanTitle(seg.trim());
    if (!title || title.length < 2) continue;
    const prev = out[out.length - 1];
    const prevExam = prev && /^(اختبار|امتحان)/.test(prev.title);
    // "وأبغى أذاكر" بعد "اختبار رياضيات" => "مذاكرة الرياضيات" اليوم (استعدادًا للاختبار)
    const prep = prevExam && /^(مذاكرة|مراجعة|حل)$/.test(title);
    if (prep) title = `${title} ${prev.title.replace(/^(اختبار|امتحان)\s*/, '')}`.trim();
    const meta = guessMeta(title);
    const duration = dur?.min || (meta.icon === 'coffee' ? 15 : ['book', 'dumbbell', 'study'].includes(meta.icon) || /اختبار|امتحان/.test(title) ? 60 : 45);
    let d = date?.date || (prep ? base : lastDate || base);
    let start = time ? time.min : prep ? null : cursor;
    // "النادي اليوم الساعة 8" والوقت الصباحي مضى => غالبًا المساء
    if (time && !time.hasMer && d === todayKey() && start < nowMin() && start + 720 < 1440) start += 720;
    out.push({
      title,
      date: d,
      time: start != null ? fromMin(start) : null,
      duration,
      priority: prep ? 'high' : inferPriority(p),
      area: meta.area,
      icon: meta.icon,
      repeat: rep ? { type: rep.type, days: rep.days, until: span ? spanUntil(d, span) : null } : { type: 'none', days: [] },
    });
    cursor = start != null ? start + duration : null;
    lastDate = prep ? lastDate : d;
  }
  return out;
}

export function describeParsed(t) {
  return trf('{time} — {title} — {n} دقيقة', { time: t.time ? clock12(t.time) : tr('بدون وقت'), title: t.title, n: t.duration });
}

// هل النص يحتوي معلومات جدولة (وقت/مدة)؟
export function looksLikeSchedule(text) {
  const n = normalize(text);
  if (isEnglishText(n)) {
    const e = normalizeEn(n);
    return !!(parseTimeEn(e) || parseDurationEn(e) || parseDateEn(e, todayKey()));
  }
  return !!(parseTime(n) || parseDuration(n) || parseDate(n, todayKey()));
}

// ————— دعم الإدخال الإنجليزي (مثال: "gym tomorrow at 7pm for 2 hours") —————
// يُستخدم فقط عندما يكون النص بلا حروف عربية — المسار العربي أعلاه لا يتغير
const hasArabic = (s) => /[؀-ۿ]/.test(s);
const isEnglishText = (s) => /[A-Za-z]/.test(s) && !hasArabic(s);

const EN_NUM = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, fifteen: 15, twenty: 20, thirty: 30, forty: 40, 'forty-five': 45, 'forty five': 45, ninety: 90 };
function normalizeEn(t) {
  let s = t.replace(/\b([ap])\.m\.?(?=\s|$|[,!?])/gi, '$1m');
  const words = Object.keys(EN_NUM).sort((a, b) => b.length - a.length).join('|');
  s = s.replace(new RegExp(`\\b(${words})(?=\\s*(?:hours?|hrs?|minutes?|mins?|am|pm|o'?clock)\\b)`, 'gi'), (w) => EN_NUM[w.toLowerCase()]);
  s = s.replace(new RegExp(`\\b(at|around)\\s+(${words})\\b`, 'gi'), (_, p, w) => `${p} ${EN_NUM[w.toLowerCase()]}`);
  return s;
}

const ICONS_EN = [
  [/\b(exams?|tests?|quiz(zes)?|midterms?|finals?)\b/i, 'pen', 'study'],
  [/\b(study|studying|revise|revision|review|math|maths|physics|chemistry|biology|calculus|chapter)\b/i, 'book', 'study'],
  [/\b(lectures?|class(es)?|course|lessons?|university|college|school|tutorial)\b/i, 'study', 'study'],
  [/\b(homework|assignments?|solve)\b/i, 'pen', 'study'],
  [/\b(read|reading|book|books|pages?|novel)\b/i, 'read', 'study'],
  [/\b(gym|work ?out|exercises?|training|train|run|running|jog|jogging|cardio|football|soccer|swim|swimming|yoga)\b/i, 'dumbbell', 'health'],
  [/\b(walk|walking)\b/i, 'walk', 'health'],
  [/\b(break|rest|coffee)\b/i, 'coffee', 'health'],
  [/\b(sleep|nap|bed)\b/i, 'sleep', 'health'],
  [/\b(water|drink)\b/i, 'water', 'health'],
  [/\b(eat|lunch|dinner|breakfast|meal|cook|cooking)\b/i, 'food', 'health'],
  [/\b(doctor|dentist|hospital|clinic|pharmacy|appointment)\b/i, 'doctor', 'health'],
  [/\b(code|coding|program|programming|develop|website|app|bug)\b/i, 'laptop', 'work'],
  [/\b(work|meeting|meet|client|report|emails?|project|office|presentation|deadline)\b/i, 'work', 'work'],
  [/\b(pay|bills?|money|budget|bank|transfer|rent|savings?|expenses?|invoice)\b/i, 'money', 'money'],
  [/\b(shop|shopping|groceries|grocery|supermarket|buy)\b/i, 'cart', 'money'],
  [/\b(pray|prayer|quran)\b/i, 'pray', 'family'],
  [/\b(family|mom|mum|mother|dad|father|parents|brother|sister|grandma|grandpa|visit)\b/i, 'family', 'family'],
  [/\b(movie|movies|film|series|netflix|cinema)\b/i, 'film', 'fun'],
  [/\b(games?|gaming|play|playstation|hang ?out|friends|party)\b/i, 'fun', 'fun'],
  [/\b(travel|trip|flight|airport|vacation)\b/i, 'travel', 'fun'],
];

function inferPriorityEn(text) {
  if (/\b(urgent|asap|emergency|very important|super important|right now|critical)\b/i.test(text)) return 'urgent';
  if (/\b(exams?|tests?|quiz|midterms?|finals?|deadline|due|submit|important|must)\b/i.test(text)) return 'high';
  if (/\b(optional|if i have time|if i get time|if i'm free|if free|maybe|someday|no rush)\b/i.test(text)) return 'low';
  return null;
}
const PRIORITY_WORDS_EN = /\s(very important|super important|important|urgent|asap|optional|if i have time|if i get time|if i'm free|if free|maybe|no rush)(?=\s|$|[!,.])/gi;

const EN_FILLERS = /^(?:and|then|also|so|ok|okay|please|plus|after that|afterwards|i\s+(?:need|have|want|should|must|will|plan|would like|am going|gotta|got)|i'll|i'd like|i'm going|i've got|i've|need|have|want|gotta|got|should|must|remind me|don't forget|dont forget|let's|lets)\s+(?:to\s+)?/i;
function cleanTitleEn(s) {
  let t = s;
  for (let i = 0; i < 4; i++) t = t.replace(EN_FILLERS, '');
  t = t.replace(/^(?:go|going|head|heading)\s+to\s+(?:the\s+)?/i, '').replace(/^go\s+for\s+(?:a\s+)?/i, '').replace(/^(?:a|an)\s+/i, '');
  t = t.replace(/[,.;:!?\s]+$/, '').replace(/^[,.;:!?\s]+/, '');
  for (let i = 0; i < 3; i++) t = t.replace(/\s+(?:at|on|in|for|by|from|to|the|and|with|of|around)$/i, '');
  t = t.replace(/\s+/g, ' ').trim();
  return t ? t[0].toUpperCase() + t.slice(1) : t;
}

function parseDurationEn(s) {
  let m;
  if ((m = s.match(/(?:\bfor\s+)?\b(\d+(?:\.\d+)?)\s*(?:hours?|hrs?|h)\s*(?:and\s*)?(\d+)\s*(?:minutes?|mins?|m)(?=\s|$|[,.!?])/i)))
    return { min: Math.round(parseFloat(m[1]) * 60) + +m[2], raw: m[0] };
  if ((m = s.match(/(?:\bfor\s+)?\b(?:an?|one|1)\s+hour\s+and\s+a\s+half\b/i))) return { min: 90, raw: m[0] };
  if ((m = s.match(/(?:\bfor\s+)?\b(?:half\s+an\s+hour|a\s+half\s+hour|half\s+hour)\b/i))) return { min: 30, raw: m[0] };
  if ((m = s.match(/(?:\bfor\s+)?\b(?:a\s+)?quarter\s+(?:of\s+)?an?\s+hour\b/i))) return { min: 15, raw: m[0] };
  if ((m = s.match(/(?:\bfor\s+)?(?<!\bin\s)\b(\d+(?:\.\d+)?)\s*(?:hours?|hrs?|h)(?=\s|$|[,.!?])/i))) return { min: Math.round(parseFloat(m[1]) * 60), raw: m[0] };
  if ((m = s.match(/(?:\bfor\s+)?(?<!\bin\s)\b(\d+)\s*(?:minutes?|mins?|m)(?=\s|$|[,.!?])/i))) return { min: +m[1], raw: m[0] };
  if ((m = s.match(/\bfor\s+(?:an?|one)\s+hour\b/i))) return { min: 60, raw: m[0] };
  return null;
}

function parseTimeEn(s) {
  let m = s.match(/(?:\b(?:at|by|around)\s+|@\s*)?\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)(?=\s|$|[,.!?])/i);
  if (m) {
    let h = +m[1];
    const min = m[2] ? +m[2] : 0;
    const pm = m[3].toLowerCase() === 'pm';
    if (h > 12 || min > 59) return null;
    if (h === 12) h = pm ? 12 : 0;
    else if (pm) h += 12;
    return { min: h * 60 + min, raw: m[0], hasMer: true };
  }
  m = s.match(/(?:\b(?:at|around)\s+)?\b(noon|midday|midnight)\b/i);
  if (m) return { min: /midnight/i.test(m[1]) ? 0 : 12 * 60, raw: m[0], hasMer: true };
  m = s.match(/(?:\b(?:at|around)\s+|@\s*)(\d{1,2})(?::(\d{2}))?(?:\s*o'?clock)?(?:\s+(in the morning|in the afternoon|in the evening|at night|tonight))?(?=\s|$|[,.!?])/i);
  if (m) {
    let h = +m[1];
    const min = m[2] ? +m[2] : 0;
    const part = (m[3] || '').toLowerCase();
    if (/afternoon|evening|night/.test(part)) h = h < 12 ? h + 12 : h;
    else if (!part && h >= 1 && h <= 6) h += 12; // "at 4" غالبًا العصر
    if (h > 23 || min > 59) return null;
    return { min: h * 60 + min, raw: m[0], hasMer: !!part || h >= 12 };
  }
  const m2 = s.match(/\b(\d{1,2}):(\d{2})\b/);
  if (!m2) return null;
  return { min: +m2[1] * 60 + +m2[2], raw: m2[0], explicit: true, hasMer: +m2[1] >= 12 };
}

const EN_DAY = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };
const EN_DAY_FULL = '(sunday|monday|tuesday|wednesday|thursday|friday|saturday)';
const EN_DAY_ANY = '(?:sun|mon|tue|tues|wed|wednes|thu|thur|thurs|fri|sat|satur)(?:day)?s?';
const enDayIndex = (w) => EN_DAY[w.toLowerCase().slice(0, 3)];

function parseDateEn(s, base) {
  let m;
  if ((m = s.match(/\b(?:the\s+)?day\s+after\s+(?:tomorrow|tmrw|tmr)\b/i))) return { date: addDays(base, 2), raw: m[0] };
  if ((m = s.match(/\b(?:tomorrow|tmrw|tmr)\b/i))) return { date: addDays(base, 1), raw: m[0] };
  if ((m = s.match(/\bin\s+(\d+)\s+days?\b/i))) return { date: addDays(base, +m[1]), raw: m[0] };
  if ((m = s.match(/\bnext\s+week\b/i))) return { date: addDays(base, 7), raw: m[0] };
  if (!/\bevery\b/i.test(s)) {
    const w = s.match(new RegExp(`\\b(?:on\\s+|next\\s+|this\\s+)?${EN_DAY_FULL}\\b`, 'i')) || s.match(/\b(?:on|next|this)\s+(sun|mon|tue|tues|wed|thu|thur|thurs|fri|sat)\b\.?/i);
    if (w) {
      const day = enDayIndex(w[1]);
      const cur = fromKey(base).getDay();
      let d = (day - cur + 7) % 7;
      if (d === 0 && !(base === todayKey() && (parseTimeEn(s)?.min ?? 0) > nowMin())) d = 7;
      return { date: addDays(base, d), raw: w[0] };
    }
  }
  if ((m = s.match(/\b(?:today|tonight|this\s+(?:morning|afternoon|evening))\b/i))) return { date: base, raw: m[0] };
  return null;
}

function parseRepeatEn(s) {
  let m;
  if ((m = s.match(/\b(?:every\s*day|everyday|each\s+day|daily)\b/i))) return { type: 'daily', days: [], raw: m[0] };
  if ((m = s.match(/\b(?:every\s+week|each\s+week|weekly)\b/i))) return { type: 'weekly', days: [], raw: m[0] };
  if ((m = s.match(/\b(?:every\s+month|each\s+month|monthly)\b/i))) return { type: 'monthly', days: [], raw: m[0] };
  const list = `${EN_DAY_ANY}(?:\\s*(?:,|and|&|/)\\s*${EN_DAY_ANY})*`;
  m = s.match(new RegExp(`\\b(?:every|each)\\s+(${list})\\b`, 'i')) || s.match(new RegExp(`\\b(?:on\\s+)?((?:sun|mon|tues|wednes|thurs|fri|satur)days(?:\\s*(?:,|and|&|/)\\s*${EN_DAY_ANY})*)\\b`, 'i'));
  if (m) {
    const days = [...new Set((m[1].match(new RegExp(EN_DAY_ANY, 'gi')) || []).map(enDayIndex))].filter((d) => d != null).sort();
    if (days.length) return { type: 'days', days, raw: m[0] };
  }
  return null;
}

function parseSpanEn(s) {
  const m = s.match(/\b(?:for|during)\s+(?:the\s+next\s+)?(\d+|a|an|one|two|three|four|five|six|twelve)?\s*(months?|years?|weeks?)\b/i);
  if (!m) return null;
  const n = /^\d+$/.test(m[1] || '') ? +m[1] : { two: 2, three: 3, four: 4, five: 5, six: 6, twelve: 12 }[(m[1] || '').toLowerCase()] || 1;
  const u = m[2].toLowerCase();
  return u.startsWith('year') ? { months: n * 12, weeks: 0, raw: m[0] } : u.startsWith('month') ? { months: n, weeks: 0, raw: m[0] } : { months: 0, weeks: n, raw: m[0] };
}

function parseTasksEn(input, base) {
  const text = normalizeEn(String(input || '').replace(/\s*\n+\s*/g, '\n').replace(/[ \t]+/g, ' ').trim());
  const parts = text
    .split(new RegExp(`\\s*(?:\\n|;|,\\s*(?:and\\s+)?then\\s+|\\s(?:and\\s+)?then\\s+|\\safter\\s+that\\s+|,(?!\\s*(?:and\\s+)?${EN_DAY_ANY}\\b)|\\.(?!\\d))\\s*`, 'i'))
    .map((p) => p.trim())
    .filter((p) => p.length > 1);
  const out = [];
  let cursor = null;
  let lastDate = null;
  for (const p of parts) {
    let seg = ' ' + p + ' ';
    const rep = parseRepeatEn(seg);
    if (rep?.raw) seg = seg.replace(rep.raw, ' ');
    const span = rep ? parseSpanEn(seg) : null;
    if (span) seg = seg.replace(span.raw, ' ');
    const date = parseDateEn(seg, base);
    if (date) seg = seg.replace(date.raw, ' ');
    const dur = parseDurationEn(seg);
    if (dur) seg = seg.replace(dur.raw, ' ');
    const time = parseTimeEn(seg);
    if (time) seg = seg.replace(time.raw, ' ');
    seg = seg.replace(PRIORITY_WORDS_EN, ' ');
    const title = cleanTitleEn(seg.trim());
    if (!title || title.length < 2) continue;
    const meta = guessMeta(title);
    const duration = dur?.min || (meta.icon === 'coffee' ? 15 : ['book', 'dumbbell', 'study'].includes(meta.icon) || /\b(exams?|tests?|quiz|midterms?|finals?)\b/i.test(title) ? 60 : 45);
    const d = date?.date || lastDate || base;
    let start = time ? time.min : cursor;
    if (time && !time.hasMer && d === todayKey() && start < nowMin() && start + 720 < 1440) start += 720;
    out.push({
      title,
      date: d,
      time: start != null ? fromMin(start) : null,
      duration,
      priority: inferPriority(p),
      area: meta.area,
      icon: meta.icon,
      repeat: rep ? { type: rep.type, days: rep.days, until: span ? spanUntil(d, span) : null } : { type: 'none', days: [] },
    });
    cursor = start != null ? start + duration : null;
    lastDate = d;
  }
  return out;
}

export { toMin };
