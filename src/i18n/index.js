// الترجمة: النص العربي نفسه هو المفتاح — tr('مهامي') ← "My tasks" عند اختيار الإنجليزية
// سمّيناها tr (وليس t) لأن t مستخدمة كاسم متغير للمهام في أماكن كثيرة.
const dicts = import.meta.glob('./en/*.js', { eager: true });
const EN = Object.assign({}, ...Object.values(dicts).map((m) => m.default));

const KEY = 'himmah:lang';
const readLang = () => {
  try {
    return localStorage.getItem(KEY) === 'en' ? 'en' : 'ar';
  } catch (e) {
    console.warn('[himmah:lang]', e?.message || e);
    return 'ar';
  }
};
let lang = readLang();

export const getLang = () => lang;
export const isEn = () => lang === 'en';

// تطبيق اللغة: اتجاه الصفحة + حفظ الاختيار على الجهاز (يُستخدم قبل تسجيل الدخول أيضًا)
export function setLang(next) {
  lang = next === 'en' ? 'en' : 'ar';
  try {
    localStorage.setItem(KEY, lang);
  } catch (e) {
    console.warn('[himmah:lang]', e?.message || e);
  }
  const html = document.documentElement;
  html.lang = lang;
  html.dir = lang === 'en' ? 'ltr' : 'rtl';
  document.title = lang === 'en' ? 'Masar — Plan, organize, achieve' : 'مسار — خطّط، نظّم، أنجز';
}

const missing = new Set();
export function tr(s) {
  if (lang === 'ar' || s == null || s === '') return s;
  const v = EN[s];
  if (v === undefined) {
    if (import.meta.env.DEV && !missing.has(s)) (missing.add(s), console.warn('[i18n] missing:', s));
    return s;
  }
  return v;
}
// ترجمة مع متغيرات: trf('باقي {n} يوم', { n: 5 })
export function trf(s, vars = {}) {
  return String(tr(s)).replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? ''));
}

// اشتراك React بتغيير اللغة (لإعادة رسم الواجهة كاملة)
import { useSyncExternalStore } from 'react';
const listeners = new Set();
export function changeLang(next) {
  if ((next === 'en' ? 'en' : 'ar') === lang) return;
  setLang(next);
  listeners.forEach((fn) => fn());
}
export const useLang = () =>
  useSyncExternalStore(
    (fn) => (listeners.add(fn), () => listeners.delete(fn)),
    () => lang
  );
