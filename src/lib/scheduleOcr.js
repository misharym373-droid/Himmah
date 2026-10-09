// تحويل نص الصورة (OCR) إلى مهام مفهومة: اليوم، الوقت (من–إلى)، العنوان، والمكان
// + تصفية الضجيج: النص الصغير (إشعارات، شريط الحالة) والأسطر منخفضة الثقة
import { todayKey, addDays, fromKey, fromMin } from './date.js';

const AR_DIGITS = /[٠-٩]/g;
const toLatin = (s) => s.replace(AR_DIGITS, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)));
// تطبيع حرف بحرف (نفس الطول) حتى تبقى مواضع المطابقة صالحة على النص الأصلي
const norm = (s) => toLatin(String(s || '')).replace(/[أإآ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/ـ/g, ' ');

// أيام الأسبوع: 0 = الأحد
const DAY_WORDS = [
  [0, /(?:^|\s)(ال)?احد(?=\s|$|[:،,])|\bsun(day)?\b/i],
  [1, /(?:^|\s)(ال)?اثنين(?=\s|$|[:،,])|(?:^|\s)(ال)?اثنان(?=\s|$)|\bmon(day)?\b/i],
  [2, /(?:^|\s)(ال)?ثلاثاء?(?=\s|$|[:،,])|\btue(s|sday)?\b/i],
  [3, /(?:^|\s)(ال)?اربعاء?(?=\s|$|[:،,])|\bwed(nesday)?\b/i],
  [4, /(?:^|\s)(ال)?خميس(?=\s|$|[:،,])|\bthu(rs|rsday)?\b/i],
  [5, /(?:^|\s)(ال)?جمعه(?=\s|$|[:،,])|\bfri(day)?\b/i],
  [6, /(?:^|\s)(ال)?سبت(?=\s|$|[:،,])|\bsat(urday)?\b/i],
];

// كلمات المكان
const PLACE_RE = /((?:قاعه|القاعه|مبني|المبني|معمل|المعمل|مختبر|المختبر|فصل|الفصل|مكتب|المكتب|غرفه|الغرفه|صاله|الصاله|مسجد|مستشفي|عياده|room|hall|bldg|building|lab|class(?:room)?|office)\s*[:#\-]?\s*[\w؀-ۿ\-./]{0,14}(?:\s*\d{1,4}[A-Za-z]?)?)/i;
const AT_PLACE_RE = /(?:@|في|بـ?|at)\s+((?:قاعه|مبني|معمل|مختبر|فصل|مكتب|غرفه|room|hall|building|lab)[^،,|]*)/i;

// ص/م كلمة مستقلة فقط (حتى لا تُلتقط «م» من بداية «محاضرة»)
const MER = '(ص|م|صباحا|صباحًا|مساء|مساءً|am|pm|a\\.m\\.|p\\.m\\.)(?=[\\s,،.\\-–—]|$)';
const T = `(\\d{1,2})(?:[:.](\\d{2}))?\\s*(?:${MER})?`;
const RANGE_RE = new RegExp(`(?:من\\s*)?${T}\\s*(?:-|–|—|ـ|إلى|الى|الي|لين|حتى|to|till|until|~)\\s*${T}`, 'i');
const SINGLE_RE = new RegExp(`(?:الساعه\\s*|at\\s+)?(?<![\\d:])${T}(?![\\d])`, 'i');

const isPm = (m) => /^(م|مساء|مساءً|pm|p\.m\.)$/i.test(m || '');
const isAm = (m) => /^(ص|صباحا|صباحًا|am|a\.m\.)$/i.test(m || '');
// بدون ص/م: 7–11 صباحًا، 12 ظهرًا، 1–6 مساءً (الشائع في جداول الدراسة والعمل)
function toMin(h, m, mer, refPm) {
  h = +h;
  m = +(m || 0);
  if (h > 23 || m > 59) return null;
  if (isPm(mer) && h < 12) h += 12;
  else if (isAm(mer) && h === 12) h = 0;
  else if (!mer && !isAm(mer) && h >= 1 && h <= 6) h += 12;
  else if (!mer && refPm && h < 12) h += 12;
  return h * 60 + m;
}

export function parseTimeRange(line) {
  const s = norm(line);
  const r = s.match(RANGE_RE);
  if (r) {
    const [, h1, m1, mer1, h2, m2, mer2] = r;
    let a = toMin(h1, m1, mer1 || (mer2 && !isPm(mer2) ? mer2 : null));
    let b = toMin(h2, m2, mer2);
    if (a == null || b == null) return null;
    if (!mer1 && isPm(mer2) && a + 12 * 60 < b) a += 12 * 60;
    if (b <= a) b += 12 * 60;
    if (b - a > 14 * 60 || b > 24 * 60) return null;
    return { start: a, end: b, at: r.index, len: r[0].length };
  }
  const one = s.match(SINGLE_RE);
  if (one && (one[2] || one[3] || /الساعه|at /i.test(one[0]))) {
    const a = toMin(one[1], one[2], one[3]);
    if (a != null) return { start: a, end: null, at: one.index, len: one[0].length };
  }
  return null;
}

export function parseDay(line) {
  const s = norm(line);
  for (const [dow, re] of DAY_WORDS) {
    const m = s.match(re);
    if (m) return { dow, at: m.index, len: m[0].length };
  }
  return null;
}

export function parsePlace(line) {
  const s = norm(line);
  const m = s.match(AT_PLACE_RE) || s.match(PLACE_RE);
  if (!m) return null;
  const start = m.index + m[0].indexOf(m[1]);
  return { place: String(line).slice(start, start + m[1].length).trim().replace(/[،,.:;-]+$/, ''), at: m.index, len: m[0].length };
}

const HEADER_RE = /^(اليوم|اليوم والوقت|الوقت|الماده|المقرر|القاعه|المكان|الساعه|day|time|subject|course|room|location|from|to|من|الي|إلى)(\s+|$)/i;
const NOISE_RE = /(^\d{1,2}:\d{2}$)|(\d{1,3}\s*%)|\b(LTE|5G|4G|wi-?fi|battery|notification|missed call|new message|now)\b|(البطاريه|اشعار|إشعار|اتصال فائت|مكالمه فائته|رساله جديده|رسائل جديده|واتساب|سناب|تويتر|الان$)/i;

// أسطر Tesseract → أسطر مفيدة (نحذف النص الصغير وشريط الحالة والأسطر منخفضة الثقة)
export function filterOcrLines(data) {
  const lines = (data?.lines || []).map((l) => ({ text: (l.text || '').trim(), conf: l.confidence ?? 100, h: l.bbox ? l.bbox.y1 - l.bbox.y0 : 0, y: l.bbox?.y0 ?? 0 })).filter((l) => l.text);
  if (!lines.length) return { keep: (data?.text || '').split(/\n+/).map((t) => t.trim()).filter(Boolean), dropped: [] };
  // حجم النص الأساسي: المئين 70 من ارتفاعات الأسطر (لا يتأثر كثيرًا بالنصوص الصغيرة الكثيرة)
  const heights = lines.map((l) => l.h).filter(Boolean).sort((a, b) => a - b);
  const median = heights[Math.min(heights.length - 1, Math.floor(heights.length * 0.7))] || 0;
  const pageH = Math.max(...lines.map((l) => l.y + l.h), 1);
  const keep = [];
  const dropped = [];
  for (const l of lines) {
    const small = median && l.h < median * 0.62;
    const lowConf = l.conf < 45;
    const statusBar = l.y < pageH * 0.05 && (NOISE_RE.test(l.text) || l.text.length < 12);
    const noise = NOISE_RE.test(norm(l.text)) && !parseTimeRange(l.text)?.end;
    const tooShort = l.text.replace(/[^\p{L}\p{N}]/gu, '').length < 3;
    (small || lowConf || statusBar || noise || tooShort ? dropped : keep).push(l.text);
  }
  return { keep, dropped };
}

// التاريخ القادم لهذا اليوم من الأسبوع (اليوم نفسه إن كان مطابقًا)
export function nextDateFor(dow, base = todayKey()) {
  const cur = fromKey(base).getDay();
  return addDays(base, (dow - cur + 7) % 7);
}

const clean = (s) =>
  s
    .replace(/\s{2,}/g, ' ')
    .trim()
    .replace(/^[\s\-•*·▪◦○●☐☑✓✔|:،,.)(]+/, '')
    .replace(/[\s|:،,.\-–—]+$/, '')
    .trim();
// حذف أجزاء من السطر حسب مواضعها
const cut = (line, spans) => {
  const chars = [...line];
  for (const sp of spans) if (sp) for (let i = sp.at; i < sp.at + sp.len && i < chars.length; i++) chars[i] = ' ';
  return chars.join('');
};

/**
 * يحوّل الأسطر إلى عناصر جدول
 * يدعم: "الأحد 8-12 محاضرة الرياضيات قاعة 3" أو سطر يوم ثم أسطر تحته، أو "Mon 10:00-11:30 Physics, Room B12"
 */
export function linesToItems(lines, { base = todayKey() } = {}) {
  const out = [];
  let currentDay = null;
  for (const raw of lines) {
    let line = toLatin(raw).replace(/\s+/g, ' ').trim();
    if (!line || HEADER_RE.test(norm(line)) && !parseTimeRange(line)) continue;
    const day = parseDay(line);
    const time = parseTimeRange(line);
    const place = parsePlace(line);
    let title = cut(line, [day, time, place]);
    // إزالة كلمات الربط المتبقية
    title = clean(title.replace(/(^|\s)(يوم|من|الى|إلى|الساعه|الساعة|في|from|to|at|on)(?=\s|$)/gi, ' '));
    // إذا كان السطر مكانًا فقط (مثل «معمل الكيمياء») نجعله العنوان
    if (place && title.replace(/[^\p{L}]/gu, '').length < 2) title = place.place;
    // سطر يحتوي يومًا فقط = عنوان قسم لليوم
    if (day && !time && title.replace(/[^\p{L}]/gu, '').length < 2) {
      currentDay = day.dow;
      continue;
    }
    if (title.replace(/[^\p{L}]/gu, '').length < 2) continue;
    const dow = day ? day.dow : currentDay;
    if (day) currentDay = day.dow;
    out.push({
      title: title.slice(0, 120),
      dow: dow ?? null,
      date: dow != null ? nextDateFor(dow, base) : base,
      time: time ? fromMin(time.start) : null,
      end: time?.end != null ? fromMin(Math.min(time.end, 23 * 60 + 59)) : null,
      duration: time?.end != null ? time.end - time.start : 60,
      place: place?.place && place.place !== title ? place.place : '',
      on: true,
    });
  }
  // في الجداول: الأسطر بدون يوم ولا وقت غالبًا عناوين — نتركها غير محددة (يقدر المستخدم يفعّلها)
  const timedCount = out.filter((x) => x.time || x.dow != null).length;
  if (timedCount >= 2) for (const x of out) if (!x.time && x.dow == null) x.on = false;
  return out.slice(0, 40);
}
