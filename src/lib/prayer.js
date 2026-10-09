// أوقات الصلاة — حساب فلكي على الجهاز (بدون إنترنت) بطريقة أم القرى:
// الفجر 18.5°، العشاء بعد المغرب بـ 90 دقيقة (120 في رمضان)، العصر على المذهب الشافعي (ظل المثل)
import { todayKey, fromKey, clock12 } from './date.js';

export const PRAYERS = [
  { key: 'fajr', label: 'الفجر' },
  { key: 'dhuhr', label: 'الظهر' },
  { key: 'asr', label: 'العصر' },
  { key: 'maghrib', label: 'المغرب' },
  { key: 'isha', label: 'العشاء' },
];

// المدن (خط العرض، خط الطول، فرق التوقيت)
export const CITIES = {
  yanbu: { label: 'ينبع', lat: 24.0889, lng: 38.0637, tz: 3 },
  madinah: { label: 'المدينة المنورة', lat: 24.4672, lng: 39.6111, tz: 3 },
  makkah: { label: 'مكة المكرمة', lat: 21.4225, lng: 39.8262, tz: 3 },
  jeddah: { label: 'جدة', lat: 21.5433, lng: 39.1728, tz: 3 },
  riyadh: { label: 'الرياض', lat: 24.7136, lng: 46.6753, tz: 3 },
  dammam: { label: 'الدمام', lat: 26.4207, lng: 50.0888, tz: 3 },
  taif: { label: 'الطائف', lat: 21.2703, lng: 40.4158, tz: 3 },
  tabuk: { label: 'تبوك', lat: 28.3835, lng: 36.5662, tz: 3 },
  abha: { label: 'أبها', lat: 18.2465, lng: 42.5117, tz: 3 },
  qassim: { label: 'بريدة', lat: 26.326, lng: 43.975, tz: 3 },
};

const rad = (d) => (d * Math.PI) / 180;
const deg = (r) => (r * 180) / Math.PI;
const sin = (d) => Math.sin(rad(d));
const cos = (d) => Math.cos(rad(d));
const tan = (d) => Math.tan(rad(d));
const asin = (x) => deg(Math.asin(x));
const acos = (x) => deg(Math.acos(Math.max(-1, Math.min(1, x))));
const atan2 = (y, x) => deg(Math.atan2(y, x));
const acot = (x) => deg(Math.atan(1 / x));
const fix = (a, b) => ((a % b) + b) % b;

function julian(y, m, d) {
  if (m <= 2) (y -= 1), (m += 12);
  const A = Math.floor(y / 100);
  const B = 2 - A + Math.floor(A / 4);
  return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + d + B - 1524.5;
}
function sunPos(jd) {
  const D = jd - 2451545.0;
  const g = fix(357.529 + 0.98560028 * D, 360);
  const q = fix(280.459 + 0.98564736 * D, 360);
  const L = fix(q + 1.915 * sin(g) + 0.02 * sin(2 * g), 360);
  const e = 23.439 - 0.00000036 * D;
  const RA = atan2(cos(e) * sin(L), cos(L)) / 15;
  return { decl: asin(sin(e) * sin(L)), eqt: q / 15 - fix(RA, 24) };
}

// تقريب هجري لمعرفة رمضان (عشاء رمضان = 120 دقيقة في أم القرى)
function isRamadan(date) {
  try {
    const m = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura', { month: 'numeric' }).format(date);
    return +m === 9;
  } catch (e) {
    console.warn('[himmah:prayer]', e?.message || e);
    return false;
  }
}

/** أوقات يوم معيّن بالدقائق من منتصف الليل (بالتوقيت المحلي للمدينة) */
export function prayerTimes(dateKey = todayKey(), { lat, lng, tz }) {
  const d = fromKey(dateKey);
  const jd = julian(d.getFullYear(), d.getMonth() + 1, d.getDate()) - lng / (15 * 24);
  const midDay = (t) => fix(12 - sunPos(jd + t).eqt, 24);
  const angleTime = (angle, t, ccw) => {
    const { decl } = sunPos(jd + t);
    const noon = midDay(t);
    const a = (1 / 15) * acos((-sin(angle) - sin(decl) * sin(lat)) / (cos(decl) * cos(lat)));
    return noon + (ccw ? -a : a);
  };
  const asr = (t) => {
    const { decl } = sunPos(jd + t);
    return angleTime(-acot(1 + tan(Math.abs(lat - decl))), t);
  };
  // تمريرتان لتحسين الدقة
  let t = { fajr: 5, sunrise: 6, dhuhr: 12, asr: 13, maghrib: 18 };
  for (let i = 0; i < 2; i++) {
    const p = Object.fromEntries(Object.entries(t).map(([k, v]) => [k, v / 24]));
    t = {
      fajr: angleTime(18.5, p.fajr, true),
      sunrise: angleTime(0.833, p.sunrise, true),
      dhuhr: midDay(p.dhuhr),
      asr: asr(p.asr),
      maghrib: angleTime(0.833, p.maghrib),
    };
  }
  const adj = (h) => Math.round((h + tz - lng / 15) * 60);
  const out = { fajr: adj(t.fajr), sunrise: adj(t.sunrise), dhuhr: adj(t.dhuhr) + 1, asr: adj(t.asr), maghrib: adj(t.maghrib) };
  out.isha = out.maghrib + (isRamadan(d) ? 120 : 90);
  return out;
}

export const fmtTime = (min) => clock12(min);

// موقع المستخدم الحالي (يتطلب إذن المتصفح)
export function locate() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('unsupported'));
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: +p.coords.latitude.toFixed(4), lng: +p.coords.longitude.toFixed(4), tz: -new Date().getTimezoneOffset() / 60 }),
      (e) => reject(e),
      { timeout: 10000, maximumAge: 3600000 }
    );
  });
}

export function cityOf(settings) {
  const p = settings?.prayer || {};
  if (p.city === 'custom' && p.lat != null) return { label: 'موقعي', lat: p.lat, lng: p.lng, tz: p.tz ?? 3 };
  return CITIES[p.city] || CITIES.yanbu;
}

// معرّف ثابت لسجل يوم معيّن (يمنع التكرار بين الأجهزة)
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const prayerDayId = (userId, date, fallback) => (UUID_RE.test(userId || '') ? userId.slice(0, 24) + date.replace(/-/g, '') + '0000' : fallback());

export const dayCount = (row) => (row ? PRAYERS.filter((p) => row[p.key]).length : 0);
export const onTimeCount = (row) => (row ? PRAYERS.filter((p) => row[p.key] === 'ontime').length : 0);
