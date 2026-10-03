// المصادقة عبر Supabase Auth (حسابات حقيقية: إنشاء، دخول، خروج، استعادة كلمة المرور، حذف الحساب)
import { supabase, errorKind, setRemember } from './supabase.js';

const redirectTo = () => window.location.origin + window.location.pathname;

// رسائل عربية واضحة بدل رسائل الخادم التقنية
export function authError(err) {
  if (!err) return '';
  if (errorKind(err) === 'network') return 'تعذر الاتصال بالخادم. تحقق من اتصالك بالإنترنت وحاول مرة أخرى.';
  const m = String(err.message || '').toLowerCase();
  const code = err.code || '';
  if (code === 'invalid_credentials' || m.includes('invalid login credentials')) return 'البريد الإلكتروني أو كلمة المرور غير صحيحة.';
  if (code === 'email_not_confirmed' || m.includes('email not confirmed')) return 'لم يتم تأكيد بريدك بعد. افتح رابط التأكيد الذي أرسلناه إلى بريدك.';
  if (code === 'user_already_exists' || m.includes('already registered')) return 'هذا البريد مسجّل مسبقًا. جرّب تسجيل الدخول.';
  if (code === 'weak_password' || m.includes('password should')) return 'كلمة المرور ضعيفة. استخدم 8 أحرف على الأقل مع أرقام وحروف.';
  if (code === 'over_email_send_rate_limit' || code === 'over_request_rate_limit' || err.status === 429 || m.includes('rate limit') || m.includes('for security purposes'))
    return 'محاولات كثيرة خلال وقت قصير. انتظر دقيقة ثم حاول مرة أخرى.';
  if (code === 'signup_disabled' || m.includes('signups not allowed')) return 'إنشاء الحسابات متوقف حاليًا.';
  if (code === 'email_address_invalid' || m.includes('invalid') && m.includes('email')) return 'البريد الإلكتروني غير صالح.';
  if (code === 'same_password') return 'كلمة المرور الجديدة مطابقة للقديمة.';
  if (code === 'session_not_found' || code === 'refresh_token_not_found' || m.includes('session')) return 'انتهت الجلسة. سجّل دخولك مرة أخرى.';
  return 'حدث خطأ، حاول مرة أخرى.';
}

export function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(email).trim());
}

export function passwordStrength(p) {
  let s = 0;
  if (p.length >= 8) s++;
  if (/[A-Z]/.test(p) && /[a-z]/.test(p)) s++;
  if (/\d/.test(p)) s++;
  if (/[^A-Za-z0-9]/.test(p)) s++;
  return s; // 0..4
}

export async function signUp({ name, email, phone, password }) {
  setRemember(true);
  const { data, error } = await supabase.auth.signUp({
    email: email.trim().toLowerCase(),
    password,
    options: { data: { name: name.trim(), phone: (phone || '').trim() }, emailRedirectTo: redirectTo() },
  });
  if (error) throw new Error(authError(error));
  // Supabase لا يرجع خطأ عند تكرار بريد مؤكد (حماية من كشف الحسابات) — نكتشفها من identities الفارغة
  if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) throw new Error('هذا البريد مسجّل مسبقًا. جرّب تسجيل الدخول.');
  return { user: data.user, needsConfirm: !data.session };
}

export async function signIn({ email, password, remember = true }) {
  setRemember(remember);
  const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
  if (error) throw new Error(authError(error));
  return data.user;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut({ scope: 'local' });
  if (error && errorKind(error) !== 'network') throw new Error(authError(error));
}

export async function sendPasswordReset(email) {
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), { redirectTo: redirectTo() });
  if (error) throw new Error(authError(error));
}

export async function updatePassword(password) {
  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw new Error(authError(error));
}

export async function resendConfirmation(email) {
  const { error } = await supabase.auth.resend({ type: 'signup', email: email.trim().toLowerCase(), options: { emailRedirectTo: redirectTo() } });
  if (error) throw new Error(authError(error));
}

// حذف بيانات المستخدم في مسار: كل جدول على حدة، وRLS تضمن أن المستخدم يحذف صفوفه هو فقط.
// لا نحذف حساب الدخول نفسه لأنه مشترك مع تطبيقات أخرى على نفس مشروع Supabase.
const USER_TABLES = ['focus_sessions', 'tasks', 'goals', 'habits', 'challenges', 'rewards', 'projects', 'user_progress', 'user_settings', 'profiles'];
export async function deleteAccount() {
  const { data, error: userError } = await supabase.auth.getUser();
  if (userError || !data.user) throw new Error(authError(userError || { code: 'session_not_found' }));
  for (const table of USER_TABLES) {
    const { error } = await supabase.from(table).delete().eq('user_id', data.user.id);
    if (error) throw new Error(authError(error));
  }
}
