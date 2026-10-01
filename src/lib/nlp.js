// محلل نصوص عربي محلي (بدون AI): يحوّل الكلام الطبيعي إلى مهام
// يستخرج: العنوان، التاريخ، الوقت، المدة، الأولوية، المجال، التكرار
// مثال: "عندي اختبار رياضيات الخميس الساعة 7 وأبغى أذاكر ساعتين"
import { todayKey, addDays, fromKey, fromMin, toMin, nowMin } from './date.js';

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
  return { icon: 'sparkles', area: 'work' };
}

const PRIORITY_WORDS = /\s(ضروري جدا|مهم جدا|ضروري|عاجل|طارئ|لو فضيت|إذا فضيت|اذا فضيت|اختياري|مو ضروري|مش ضروري)(?=\s|$)/g;

// الأولوية تُستنتج من كلمات واضحة فقط
export function inferPriority(text) {
  if (/عاجل|طارئ|ضروري جدا|مهم جدا|ضروووري|الحين الحين/.test(text)) return 'urgent';
  if (/اختبار|امتحان|تسليم|موعد نهائي|ديدلاين|deadline|ضروري|مهم|لازم/.test(text)) return 'high';
  if (/لو فضيت|إذا فضيت|اذا فضيت|اختياري|مو ضروري|مش ضروري|وقت الفراغ/.test(text)) return 'low';
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
    const days = WEEKDAYS.filter(([re]) => re.test(s)).map(([, d]) => d);
    if (days.length) {
      const m = s.match(/كل\s[^0-9]*?(?=\s*(الساعة|لمدة|$))/);
      return { type: 'days', days, raw: m ? m[0] : '' };
    }
  }
  return null;
}

/**
 * يحلل نصًا ويعيد قائمة مهام مقترحة
 * @returns {Array<{title,date,time,duration,area,icon,repeat}>}
 */
export function parseTasks(input, { base = todayKey() } = {}) {
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
      repeat: rep ? { type: rep.type, days: rep.days } : { type: 'none', days: [] },
    });
    cursor = start != null ? start + duration : null;
    lastDate = prep ? lastDate : d;
  }
  return out;
}

export function describeParsed(t) {
  return `${t.time || 'بدون وقت'} — ${t.title} — ${t.duration} دقيقة`;
}

// هل النص يحتوي معلومات جدولة (وقت/مدة)؟
export function looksLikeSchedule(text) {
  const n = normalize(text);
  return !!(parseTime(n) || parseDuration(n) || parseDate(n, todayKey()));
}

export { toMin };
