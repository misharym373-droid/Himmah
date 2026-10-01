// أدوات التاريخ والوقت — كل الأرقام بأرقام إنجليزية
export const DAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
export const DAYS_SHORT = ['أحد', 'اثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'];
export const MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];

const pad = (n) => String(n).padStart(2, '0');

export function toKey(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
export function fromKey(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}
export const todayKey = () => toKey(new Date());
export function addDays(key, n) {
  const d = fromKey(key);
  d.setDate(d.getDate() + n);
  return toKey(d);
}
export function diffDays(a, b) {
  return Math.round((fromKey(a) - fromKey(b)) / 86400000);
}
export function formatLong(key) {
  const d = fromKey(key);
  return `${DAYS[d.getDay()]}، ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}
export function formatShort(key) {
  const d = fromKey(key);
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}
export function relativeDay(key) {
  const t = todayKey();
  const diff = diffDays(key, t);
  if (diff === 0) return 'اليوم';
  if (diff === 1) return 'غدًا';
  if (diff === -1) return 'أمس';
  if (diff > 1 && diff < 7) return DAYS[fromKey(key).getDay()];
  return formatShort(key);
}
export function toMin(hhmm) {
  if (!hhmm) return null;
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}
export function fromMin(min) {
  min = Math.max(0, Math.min(23 * 60 + 59, Math.round(min)));
  return `${pad(Math.floor(min / 60))}:${pad(min % 60)}`;
}
export function nowMin() {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
}
export function roundUp5(min) {
  return Math.ceil(min / 5) * 5;
}
export function formatDuration(min) {
  if (!min) return '—';
  if (min < 60) return `${min} دقيقة`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  const hs = h === 1 ? 'ساعة' : h === 2 ? 'ساعتان' : h <= 10 ? `${h} ساعات` : `${h} ساعة`;
  return m ? `${hs} و ${m} د` : hs;
}
export function formatClock(sec) {
  sec = Math.max(0, Math.round(sec));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return h ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}
export function formatHM(min) {
  const h = Math.floor(min / 60);
  return `${h}:${pad(Math.round(min % 60))}`;
}
export function timeAgo(ts) {
  const s = Math.round((Date.now() - ts) / 1000);
  if (s < 60) return 'الآن';
  const m = Math.round(s / 60);
  if (m < 60) return `قبل ${m} د`;
  const h = Math.round(m / 60);
  if (h < 24) return `قبل ${h} س`;
  const d = Math.round(h / 24);
  return `قبل ${d} يوم`;
}
export const fmt = (n) => Number(n || 0).toLocaleString('en-US');
// معرف UUID (متوافق مع أعمدة uuid في قاعدة البيانات)
export const uid = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
      });
