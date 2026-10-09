import { useState } from 'react';
import { Mail, KeyRound, Eye, EyeOff, User, Phone, ArrowLeft, Sparkles, Loader2, ShieldCheck, MailCheck, Info } from 'lucide-react';
import { signIn, signUp, validateEmail, passwordStrength, sendPasswordReset, resendConfirmation } from '../lib/auth.js';
import { Modal } from '../components/ui.jsx';
import { TAGLINE } from '../config.js';
import { Glyph } from '../components/Glyph.jsx';

export default function Auth({ notice, onLoggedIn, onDemo }) {
  const [mode, setMode] = useState('login'); // login | signup | confirm
  const [pendingEmail, setPendingEmail] = useState('');
  return (
    <div className="auth">
      <section className="auth-art">
        <span className="brand-full logo-big" role="img" aria-label={`مسار — ${TAGLINE}`} />
        <div className="hide-sm auth-points">
          {[
            ['sparkles', 'مهام ذكية تفهم كلامك وتجدول يومك'],
            ['target', 'أهداف تتحول تلقائيًا لخطوات يومية'],
            ['flame', 'XP ومستويات وStreak تحفزك كل يوم'],
            ['brain', 'مساعد يقترح عليك وش تسوي الآن'],
          ].map(([e, t], i) => (
            <div key={t} className="auth-point reveal" style={{ animationDelay: `${0.15 + i * 0.06}s` }}>
              <span className="auth-point-ico"><Glyph name={e} size={17} /></span>
              <span>{t}</span>
            </div>
          ))}
        </div>
      </section>
      <section className="auth-form">
        <div className="auth-card" key={mode}>
          {mode === 'login' && <Login notice={notice} onLoggedIn={onLoggedIn} onDemo={onDemo} toSignup={() => setMode('signup')} />}
          {mode === 'signup' && <Signup onLoggedIn={onLoggedIn} onNeedsConfirm={(email) => (setPendingEmail(email), setMode('confirm'))} toLogin={() => setMode('login')} />}
          {mode === 'confirm' && <ConfirmEmail email={pendingEmail} toLogin={() => setMode('login')} />}
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
      <input className="input" type={show ? 'text' : 'password'} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} autoComplete={autoComplete} dir="ltr" />
      <button type="button" className="icon-btn sm plain trail" onClick={() => setShow(!show)} aria-label={show ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}>
        {show ? <EyeOff /> : <Eye />}
      </button>
    </div>
  );
}

function Login({ notice, onLoggedIn, onDemo, toSignup }) {
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
      const u = await signIn({ email, password, remember });
      onLoggedIn(u);
    } catch (x) {
      setErr(x.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit} className="col" style={{ gap: 16 }} noValidate>
      <div>
        <h1>مرحبًا بعودتك</h1>
        <p className="muted mt-s">سجّل دخولك للعودة إلى مسار</p>
      </div>
      {notice && (
        <div className="notice warn small" role="status">
          <Info size={16} aria-hidden /> <span className="grow">{notice}</span>
        </div>
      )}
      <label className="field">
        <span>البريد الإلكتروني</span>
        <div className="input-icon">
          <Mail />
          <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" autoComplete="email" dir="ltr" autoFocus />
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
      <button type="button" className="btn btn-block" onClick={onDemo}>
        <Sparkles /> جرّب مسار بدون حساب
      </button>
      <p className="tiny dim" style={{ textAlign: 'center', marginTop: -8 }}>التجربة بدون حساب تحفظ البيانات على هذا الجهاز فقط</p>
      <p className="small muted" style={{ textAlign: 'center' }}>
        ما عندك حساب؟{' '}
        <button type="button" className="purple bold" onClick={toSignup}>
          إنشاء حساب جديد
        </button>
      </p>
      <Privacy />
      {forgot && <ForgotModal initial={email} onClose={() => setForgot(false)} />}
    </form>
  );
}

function Signup({ onLoggedIn, onNeedsConfirm, toLogin }) {
  const [f, setF] = useState({ name: '', email: '', phone: '', password: '', confirm: '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value ?? e });
  const strength = passwordStrength(f.password);
  const colors = ['#E5484D', '#E5484D', '#E8940C', '#30A46C', '#30A46C'];
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
      const { user, needsConfirm } = await signUp(f);
      if (needsConfirm) onNeedsConfirm(f.email.trim().toLowerCase());
      else onLoggedIn(user);
    } catch (x) {
      setErr(x.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit} className="col" style={{ gap: 14 }} noValidate>
      <div>
        <h1>ابدأ رحلتك مع مسار</h1>
        <p className="muted mt-s">دقيقة واحدة ويصير يومك أوضح</p>
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
          <input className="input" type="email" value={f.email} onChange={set('email')} placeholder="name@example.com" autoComplete="email" dir="ltr" />
        </div>
      </label>
      <label className="field">
        <span>رقم الجوال — اختياري</span>
        <div className="input-icon">
          <Phone />
          <input className="input" type="tel" value={f.phone} onChange={set('phone')} placeholder="05xxxxxxxx" autoComplete="tel" dir="ltr" />
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
      <ShieldCheck size={14} /> حسابك وبياناتك محمية في قاعدة بيانات آمنة — لا أحد غيرك يستطيع رؤيتها
    </p>
  );
}

// بعد إنشاء الحساب: إذا كان تأكيد البريد مفعّلًا في Supabase
function ConfirmEmail({ email, toLogin }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  async function resend() {
    setBusy(true);
    setMsg('');
    try {
      await resendConfirmation(email);
      setMsg('أرسلنا رابط التأكيد مرة أخرى.');
    } catch (e) {
      setMsg(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="col" style={{ gap: 16, textAlign: 'center', alignItems: 'center' }}>
      <span className="e-ico" style={{ width: 70, height: 70, borderRadius: 22, display: 'grid', placeItems: 'center', background: 'rgba(var(--primary-rgb),.14)', color: 'var(--primary-soft)' }}>
        <MailCheck size={32} />
      </span>
      <h1 style={{ fontSize: '1.5rem' }}>تحقق من بريدك</h1>
      <p className="muted">
        أنشأنا حسابك وأرسلنا رابط تأكيد إلى <b dir="ltr">{email}</b>. افتح الرابط ثم سجّل دخولك.
      </p>
      {msg && <p className="small purple" role="status">{msg}</p>}
      <button className="btn btn-primary btn-block" onClick={toLogin}>
        تسجيل الدخول
      </button>
      <button className="btn btn-ghost btn-sm" onClick={resend} disabled={busy}>
        {busy ? 'جاري الإرسال…' : 'إعادة إرسال رابط التأكيد'}
      </button>
    </div>
  );
}

function ForgotModal({ initial, onClose }) {
  const [email, setEmail] = useState(initial || '');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState('');
  async function send() {
    setErr('');
    if (!validateEmail(email)) return setErr('اكتب بريدًا إلكترونيًا صحيحًا');
    setBusy(true);
    try {
      await sendPasswordReset(email);
      setSent(true);
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title="استعادة كلمة المرور"
      onClose={onClose}
      footer={
        sent ? (
          <button className="btn btn-primary" onClick={onClose}>
            تمام
          </button>
        ) : (
          <button className="btn btn-primary" onClick={send} disabled={busy}>
            {busy ? 'جاري الإرسال…' : 'إرسال رابط الاستعادة'}
          </button>
        )
      }
    >
      {sent ? (
        <p className="muted">إذا كان البريد مسجّلًا لدينا، ستصلك رسالة فيها رابط لتعيين كلمة مرور جديدة.</p>
      ) : (
        <>
          <label className="field">
            <span>البريد الإلكتروني</span>
            <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} dir="ltr" autoComplete="email" />
          </label>
          {err && <div className="err mt-s" role="alert">{err}</div>}
        </>
      )}
    </Modal>
  );
}
