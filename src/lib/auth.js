// حسابات محلية آمنة نسبيًا: كلمة المرور لا تُحفظ أبدًا كنص،
// بل تُشتق بـ PBKDF2-SHA256 (150,000 تكرار) مع Salt عشوائي عبر WebCrypto.
// ملاحظة: هذه الحسابات محفوظة على هذا الجهاز فقط لأن الموقع يعمل بدون خادم.
// عند إضافة Backend استبدل هذه الدوال باستدعاءات API لنظام Auth حقيقي.
import { storage, session } from './storage.js';
import { uid } from './date.js';

const enc = new TextEncoder();
const toHex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');

async function derive(password, saltHex) {
  const salt = new Uint8Array(saltHex.match(/.{2}/g).map((h) => parseInt(h, 16)));
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: 150000, hash: 'SHA-256' }, key, 256);
  return toHex(bits);
}

const accounts = () => storage.load('accounts') || {};
const normEmail = (e) => e.trim().toLowerCase();

export function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());
}

export async function signUp({ name, email, phone, password }) {
  const all = accounts();
  const key = normEmail(email);
  if (all[key]) throw new Error('هذا البريد مسجّل مسبقًا. جرّب تسجيل الدخول.');
  const salt = toHex(crypto.getRandomValues(new Uint8Array(16)));
  const hash = await derive(password, salt);
  const id = 'u_' + uid();
  all[key] = { id, name: name.trim(), email: key, phone: phone?.trim() || '', salt, hash, createdAt: Date.now() };
  storage.save('accounts', all);
  return { id, name: all[key].name, email: key, phone: all[key].phone };
}

export async function signIn({ email, password }) {
  const acc = accounts()[normEmail(email)];
  if (!acc) throw new Error('البريد الإلكتروني أو كلمة المرور غير صحيحة.');
  const hash = await derive(password, acc.salt);
  if (hash !== acc.hash) throw new Error('البريد الإلكتروني أو كلمة المرور غير صحيحة.');
  return { id: acc.id, name: acc.name, email: acc.email, phone: acc.phone };
}

export function findById(id) {
  if (id === 'demo') return { id: 'demo', name: 'مشاري', email: 'demo@himmah.app', demo: true };
  const acc = Object.values(accounts()).find((a) => a.id === id);
  return acc ? { id: acc.id, name: acc.name, email: acc.email, phone: acc.phone } : null;
}

export function deleteAccount(id) {
  const all = accounts();
  for (const k of Object.keys(all)) if (all[k].id === id) delete all[k];
  storage.save('accounts', all);
  storage.remove('data:' + id);
  session.clear();
}

export function passwordStrength(p) {
  let s = 0;
  if (p.length >= 8) s++;
  if (/[A-Z]/.test(p) && /[a-z]/.test(p)) s++;
  if (/\d/.test(p)) s++;
  if (/[^A-Za-z0-9]/.test(p)) s++;
  return s; // 0..4
}
