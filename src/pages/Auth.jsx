import { useState } from 'react';
import { Mail, KeyRound, Eye, EyeOff, User, Phone, ArrowLeft, Sparkles, Loader2, ShieldCheck } from 'lucide-react';
import { signIn, signUp, validateEmail, passwordStrength } from '../lib/auth.js';
import { asset, Modal } from '../components/ui.jsx';
import { TAGLINE } from '../config.js';

export default function Auth({ onLogin }) {
  const [mode, setMode] = useState('login'); // login | signup
  return (
    <div className="auth">
      <section className="auth-art">
        <img className="logo-big" src={asset('brand/logo.webp')} alt="هّمة" width="564" height="254" />
        <div className="tagline">هّمة .. {TAGLINE}</div>
        <div className="hide-sm col" style={{ maxWidth: 380, marginTop: 20, gap: 12 }}>
          {[
            ['✨', 'مهام ذكية تفهم كلامك وتجدول يومك'],
            ['🎯', 'أهداف تتحول تلقائيًا لخطوات يومية'],
            ['🔥', 'XP ومستويات وStreak تحفزك كل يوم'],
            ['🤖', 'مساعد يقترح عليك وش تسوي الآن'],
          ].map(([e, t], i) => (
            <div key={t} className="row reveal" style={{ animationDelay: `${0.2 + i * 0.1}s`, padding: '10px 14px', borderRadius: 14, background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.08)' }}>
              <span style={{ fontSize: '1.2rem' }}>{e}</span>
              <span className="small" style={{ color: '#c7d2fe' }}>{t}</span>
            </div>
          ))}
        </div>
      </section>
      <section className="auth-form">
        <div className="auth-card card glow" key={mode} style={{ animation: 'modalIn .4s var(--spring) both' }}>
          {mode === 'login' ? <Login onLogin={onLogin} toSignup={() => setMode('signup')} /> : <Signup onLogin={onLogin} toLogin={() => setMode('login')} />}
        </div>
      </section>
    </div>
  );
}

function Password({ value, onChange, placeholder = 'كلمة المرور', autoComplete }) {
  const [show, setShow] = useState(false);
  return (
    <div className="input-icon">
      <KeyRound />
      <input className="input" type={show ? 'text' : 'password'} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} autoComplete={autoComplete} dir="ltr" style={{ textAlign: 'right' }} />
      <button type="button" className="icon-btn sm plain trail" onClick={() => setShow(!show)} aria-label={show ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}>
        {show ? <EyeOff /> : <Eye />}
      </button>
    </div>
  );
}

function Login({ onLogin, toSignup }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [forgot, setForgot] = useState(false);
  async function submit(e) {
    e.preventDefault();
    setErr('');
    if (!validateEmail(email)) return setErr('اكتب بريدًا إلكترونيًا صحيحًا');
    if (!password) return setErr('اكتب كلمة المرور');
    setBusy(true);
    try {
      const u = await signIn({ email, password });
      onLogin(u, remember);
    } catch (x) {
      setErr(x.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit} className="col" style={{ gap: 16 }} noValidate>
      <div>
        <h1>مرحبًا بعودتك 👋</h1>
        <p className="muted mt-s">سجّل دخولك للعودة إلى هّمة</p>
      </div>
      <label className="field">
        <span>البريد الإلكتروني</span>
        <div className="input-icon">
          <Mail />
          <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" autoComplete="email" dir="ltr" style={{ textAlign: 'right' }} autoFocus />
        </div>
      </label>
      <label className="field">
        <span>كلمة المرور</span>
        <Password value={password} onChange={setPassword} autoComplete="current-password" />
      </label>
      <div className="row between">
        <label className="row small" style={{ cursor: 'pointer' }}>
          <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} style={{ width: 17, height: 17, accentColor: 'var(--primary)' }} />
          تذكرني
        </label>
        <button type="button" className="small purple bold" onClick={() => setForgot(true)}>
          نسيت كلمة المرور؟
        </button>
      </div>
      {err && <div className="err" role="alert">{err}</div>}
      <button className="btn btn-primary btn-lg btn-block" disabled={busy}>
        {busy ? <Loader2 style={{ animation: 'spin 1s linear infinite' }} /> : null} تسجيل الدخول
      </button>
      <div className="or">أو</div>
      <button type="button" className="btn btn-block" onClick={() => onLogin({ id: 'demo', name: 'مشاري', email: 'demo@himmah.app', demo: true }, true)}>
        <Sparkles /> جرّب هّمة بالحساب التجريبي
      </button>
      <p className="small muted" style={{ textAlign: 'center' }}>
        ما عندك حساب؟{' '}
        <button type="button" className="purple bold" onClick={toSignup}>
          إنشاء حساب جديد
        </button>
      </p>
      <Privacy />
      {forgot && (
        <Modal title="استعادة كلمة المرور" onClose={() => setForgot(false)} footer={<button className="btn btn-primary" onClick={() => setForgot(false)}>فهمت</button>}>
          <p className="muted">
            حسابك في هذه النسخة محفوظ بشكل آمن <b>على هذا الجهاز فقط</b> (كلمة المرور مشفّرة ولا يمكن لأحد قراءتها)، لذلك لا يمكن إرسال رابط استعادة عبر البريد.
          </p>
          <p className="muted mt">
            إن نسيت كلمة المرور يمكنك إنشاء حساب جديد، أو تجربة الحساب التجريبي. عند ربط هّمة بخادم لاحقًا ستعمل الاستعادة عبر البريد تلقائيًا.
          </p>
        </Modal>
      )}
    </form>
  );
}

function Signup({ onLogin, toLogin }) {
  const [f, setF] = useState({ name: '', email: '', phone: '', password: '', confirm: '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value ?? e });
  const strength = passwordStrength(f.password);
  const colors = ['#F87171', '#F87171', '#FBBF24', '#34D399', '#34D399'];
  async function submit(e) {
    e.preventDefault();
    setErr('');
    if (f.name.trim().length < 2) return setErr('اكتب اسمك');
    if (!validateEmail(f.email)) return setErr('اكتب بريدًا إلكترونيًا صحيحًا');
    if (f.phone && !/^\+?[\d\s-]{8,15}$/.test(f.phone)) return setErr('رقم الجوال غير صحيح');
    if (f.password.length < 8) return setErr('كلمة المرور يجب أن تكون 8 أحرف على الأقل');
    if (f.password !== f.confirm) return setErr('كلمتا المرور غير متطابقتين');
    setBusy(true);
    try {
      const u = await signUp(f);
      onLogin(u, true);
    } catch (x) {
      setErr(x.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit} className="col" style={{ gap: 14 }} noValidate>
      <div>
        <h1>ابدأ رحلتك مع هّمة</h1>
        <p className="muted mt-s">دقيقة واحدة ويصير يومك أوضح ✨</p>
      </div>
      <label className="field">
        <span>الاسم</span>
        <div className="input-icon">
          <User />
          <input className="input" value={f.name} onChange={set('name')} placeholder="اسمك" autoComplete="name" autoFocus />
        </div>
      </label>
      <label className="field">
        <span>البريد الإلكتروني</span>
        <div className="input-icon">
          <Mail />
          <input className="input" type="email" value={f.email} onChange={set('email')} placeholder="name@example.com" autoComplete="email" dir="ltr" style={{ textAlign: 'right' }} />
        </div>
      </label>
      <label className="field">
        <span>رقم الجوال — اختياري</span>
        <div className="input-icon">
          <Phone />
          <input className="input" type="tel" value={f.phone} onChange={set('phone')} placeholder="05xxxxxxxx" autoComplete="tel" dir="ltr" style={{ textAlign: 'right' }} />
        </div>
      </label>
      <label className="field">
        <span>كلمة المرور</span>
        <Password value={f.password} onChange={(v) => setF({ ...f, password: v })} autoComplete="new-password" />
        {f.password && (
          <div className="strength" aria-label={`قوة كلمة المرور ${strength} من 4`}>
            {[0, 1, 2, 3].map((i) => (
              <i key={i} style={{ background: i < strength ? colors[strength] : undefined }} />
            ))}
          </div>
        )}
      </label>
      <label className="field">
        <span>تأكيد كلمة المرور</span>
        <Password value={f.confirm} onChange={(v) => setF({ ...f, confirm: v })} placeholder="أعد كتابة كلمة المرور" autoComplete="new-password" />
      </label>
      {err && <div className="err" role="alert">{err}</div>}
      <button className="btn btn-primary btn-lg btn-block" disabled={busy}>
        {busy ? <Loader2 style={{ animation: 'spin 1s linear infinite' }} /> : <ArrowLeft style={{ order: 2 }} />} إنشاء حساب
      </button>
      <p className="small muted" style={{ textAlign: 'center' }}>
        عندك حساب؟{' '}
        <button type="button" className="purple bold" onClick={toLogin}>
          تسجيل الدخول
        </button>
      </p>
      <Privacy />
    </form>
  );
}

function Privacy() {
  return (
    <p className="tiny dim row" style={{ justifyContent: 'center', textAlign: 'center' }}>
      <ShieldCheck size={14} /> بياناتك محفوظة على جهازك وكلمة المرور مشفّرة (PBKDF2)
    </p>
  );
}
