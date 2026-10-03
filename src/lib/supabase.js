// عميل Supabase المركزي — يُستورد من هنا فقط (لا تنشئ عميلًا آخر في أي ملف)
// المفتاح المستخدم هو Publishable/Anon key العام فقط — آمن للواجهة الأمامية لأن الحماية في RLS.
// لا تضع Service Role Key هنا أبدًا.
import { createClient } from '@supabase/supabase-js';

export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://bcpxsrgfjvkkrynyjxkq.supabase.co';
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_am-VqL0mY-5AG0SOIBcCLw_62llvpGb';

// "تذكرني": الجلسة في localStorage، وإلا في sessionStorage (تنتهي بإغلاق المتصفح)
const REMEMBER_KEY = 'himmah:remember';
export function setRemember(v) {
  try {
    localStorage.setItem(REMEMBER_KEY, v ? '1' : '0');
  } catch (e) {
    // التخزين غير متاح — الجلسة تبقى في الذاكرة فقط
    console.warn('[himmah:remember]', e?.message || e);
  }
}
function pickStore() {
  try {
    return localStorage.getItem(REMEMBER_KEY) === '0' ? sessionStorage : localStorage;
  } catch {
    return null;
  }
}
const authStorage = {
  getItem: (k) => pickStore()?.getItem(k) ?? sessionStorage.getItem(k) ?? null,
  setItem: (k, v) => pickStore()?.setItem(k, v),
  removeItem: (k) => {
    try {
      localStorage.removeItem(k);
      sessionStorage.removeItem(k);
    } catch (e) {
      // ميزة ثانوية غير متاحة في هذا المتصفح — لا توقف التطبيق
      console.warn('[himmah:auth-storage]', e?.message || e);
    }
  },
};

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: authStorage,
    storageKey: 'himmah-auth',
  },
});

// تصنيف الأخطاء: شبكة (يُعاد المحاولة لاحقًا) أو جلسة منتهية أو خطأ بيانات
export function errorKind(err) {
  if (!err) return null;
  const msg = String(err.message || err.error_description || err || '').toLowerCase();
  const status = err.status ?? err.code;
  if (!navigator.onLine || msg.includes('failed to fetch') || msg.includes('networkerror') || msg.includes('network request failed') || msg.includes('load failed') || status === 0) return 'network';
  if (status === 401 || status === '401' || msg.includes('jwt') || err.code === 'PGRST301' || err.code === 'PGRST303') return 'auth';
  return 'data';
}
