// مكتبتي: حسابات التقدم والسرعة والهدف اليومي وموعد الانتهاء — كلها على الجهاز
import { todayKey, addDays, diffDays } from './date.js';

export const BOOK_COLORS = ['#2e6b57', '#7a4fd6', '#c2410c', '#0e7490', '#b45309', '#be185d', '#1d4ed8', '#4d7c0f'];
const read = (l) => Math.max(0, (l.to || 0) - (l.from || 0));

export const pagesOn = (book, date) => (book.log || []).filter((l) => l.date === date).reduce((a, l) => a + read(l), 0);
export const minutesOn = (book, date) => (book.log || []).filter((l) => l.date === date).reduce((a, l) => a + (l.min || 0), 0);

/** تقدم الكتاب + السرعة + الهدف اليومي + الموعد المتوقع */
export function bookStats(book, T = todayKey()) {
  const pages = Math.max(1, book.pages || 1);
  const current = Math.min(pages, Math.max(0, book.currentPage || 0));
  const remaining = pages - current;
  const pct = Math.round((current / pages) * 100);
  // السرعة: صفحات آخر 14 يومًا ÷ الأيام منذ أول قراءة فيها
  const recent = (book.log || []).filter((l) => l.date >= addDays(T, -13) && l.date <= T);
  const first = recent.reduce((m, l) => (l.date < m ? l.date : m), T);
  const span = recent.length ? diffDays(T, first) + 1 : 0;
  const pace = span ? recent.reduce((a, l) => a + read(l), 0) / span : 0;
  const eta = book.status !== 'done' && remaining > 0 && pace > 0 ? addDays(T, Math.ceil(remaining / pace)) : null;
  const readToday = pagesOn(book, T);
  // الهدف اليومي: من الموعد إذا محدد (يُعاد حسابه كل يوم)، وإلا الهدف الثابت
  let target = book.daily || 20;
  let daysLeft = null;
  let late = false;
  let overdue = false;
  if (book.targetDate && book.status !== 'done') {
    daysLeft = diffDays(book.targetDate, T) + 1;
    overdue = daysLeft <= 0 && remaining > 0;
    target = Math.ceil((remaining + readToday) / Math.max(1, daysLeft));
    late = !!eta && eta > book.targetDate;
  }
  target = Math.min(target, remaining + readToday) || 0;
  return { pages, current, remaining, pct, pace: Math.round(pace * 10) / 10, eta, readToday, target, todayLeft: Math.max(0, target - readToday), daysLeft, late, overdue };
}

/** أيام القراءة المتتالية (من كل الكتب) */
export function readingStreak(books, T = todayKey()) {
  const days = new Set();
  for (const b of books) for (const l of b.log || []) if (read(l) > 0 || l.min > 0) days.add(l.date);
  let d = days.has(T) ? T : addDays(T, -1);
  let n = 0;
  while (days.has(d)) (n++, (d = addDays(d, -1)));
  return n;
}

/** صفحات ودقائق آخر 7 أيام */
export function weekStats(books, T = todayKey()) {
  const from = addDays(T, -6);
  let pages = 0;
  let minutes = 0;
  for (const b of books)
    for (const l of b.log || [])
      if (l.date >= from && l.date <= T) {
        pages += read(l);
        minutes += l.min || 0;
      }
  return { pages, minutes };
}

export const doneInYear = (books, year) => books.filter((b) => b.status === 'done' && String(b.finishedAt || '').startsWith(String(year))).length;
export const readingGoal = (settings) => ({ goal: 12, ...(settings?.reading || {}) });

// ضغط صورة (غلاف/صفحة) إلى JPEG صغير لتخزينه مع الكتاب
export function compressImage(file, max = 360, quality = 0.75) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const r = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * r);
      c.height = Math.round(img.height * r);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(img.src);
      resolve(c.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => reject(new Error('image'));
    img.src = URL.createObjectURL(file);
  });
}
