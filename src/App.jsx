import { Fragment, lazy, Suspense, useEffect, useRef, useState } from 'react';
import { useLang, changeLang, getLang, tr, trf } from './i18n/index.js';
import { useStore } from './store.js';
import { useRoute, navigate } from './router.js';
import { session } from './lib/storage.js';
import { supabase } from './lib/supabase.js';
import { signOut, updatePassword, forgetLocalSession } from './lib/auth.js';
import { onLogoutRequest } from './lib/appSession.js';
import { clearUserCache } from './lib/sync.js';
import { Modal } from './components/ui.jsx';
import { MigrationBanner } from './components/Migration.jsx';
import { todayKey, toMin, nowMin } from './lib/date.js';
import { isOverdue } from './lib/game.js';
import { prayerTimes, cityOf, PRAYERS, fmtTime } from './lib/prayer.js';
import { Scene, Rail, Header, BottomNav, Footer, QuickInput } from './components/Layout.jsx';
import { Toasts, FxLayer, FocusMode, ModalRoot } from './components/Overlays.jsx';
import Auth from './pages/Auth.jsx';
import Onboarding from './pages/Onboarding.jsx';
import Home from './pages/Home.jsx';

// الصفحات الأخرى تُحمّل عند الحاجة (Lazy Loading) لسرعة الفتح
const Tasks = lazy(() => import('./pages/Tasks.jsx'));
const Schedule = lazy(() => import('./pages/Schedule.jsx'));
const Goals = lazy(() => import('./pages/Goals.jsx'));
const Habits = lazy(() => import('./pages/Habits.jsx'));
const Stats = lazy(() => import('./pages/Stats.jsx'));
const Achievements = lazy(() => import('./pages/Achievements.jsx'));
const Rewards = lazy(() => import('./pages/Rewards.jsx'));
const Shared = lazy(() => import('./pages/Shared.jsx'));
const Profile = lazy(() => import('./pages/Profile.jsx'));
const Settings = lazy(() => import('./pages/Settings.jsx'));
const Prayer = lazy(() => import('./pages/Prayer.jsx'));
const PAGES = { tasks: Tasks, schedule: Schedule, goals: Goals, habits: Habits, stats: Stats, achievements: Achievements, rewards: Rewards, shared: Shared, profile: Profile, settings: Settings, prayer: Prayer };

const DEMO_USER = { id: 'demo', name: 'مشاري', email: 'demo@himmah.app', demo: true };
const toUser = (u) => ({ id: u.id, email: u.email, name: u.user_metadata?.name || '', phone: u.user_metadata?.phone || '' });

export default function App() {
  // boot → auth | loading → ready | error
  const [phase, setPhase] = useState('boot');
  const [notice, setNotice] = useState('');
  const [recovery, setRecovery] = useState(false);
  const userRef = useRef(null);
  const manualLogout = useRef(false);
  const loggingOut = useRef(false);
  const onboarded = useStore((s) => s.onboarded);
  const settings = useStore((s) => s.settings);
  const sessionExpired = useStore((s) => s.sessionExpired);

  async function start(u) {
    userRef.current = u;
    setPhase('loading');
    try {
      await useStore.getState().openSession(u);
      if (userRef.current?.id === u.id) setPhase('ready');
    } catch {
      if (userRef.current?.id === u.id) setPhase('error');
    }
  }
  function endSession(message = '') {
    useStore.getState().reset();
    userRef.current = null;
    setNotice(message);
    setPhase('auth');
    navigate('home');
  }
  async function logout() {
    const u = userRef.current;
    if (!u) return;
    if (u.demo) {
      session.clear();
      return endSession();
    }
    if (loggingOut.current) return;
    loggingOut.current = true;
    manualLogout.current = true;
    const within = (promise, ms, fallback) => Promise.race([promise, new Promise((r) => setTimeout(() => r(fallback), ms))]);
    // نحاول رفع التغييرات المعلقة لثوانٍ قليلة فقط — وما لم يُرفع يبقى محفوظًا لهذا الحساب على الجهاز
    const synced = await within(useStore.getState().waitForSync(), 3000, false);
    useStore.getState().closeSession();
    if (synced) clearUserCache(u.id);
    try {
      await within(signOut(), 4000, null);
    } catch (e) {
      console.warn('[himmah:logout]', e?.message || e);
    }
    // نضمن إزالة الجلسة محليًا حتى لو تعذر الوصول للخادم
    forgetLocalSession();
    loggingOut.current = false;
    endSession();
  }

  useEffect(() => {
    document.getElementById('boot')?.remove();
    let alive = true;
    (async () => {
      if (session.get() === 'demo') return start(DEMO_USER);
      const { data, error } = await supabase.auth.getSession();
      if (!alive) return;
      if (data?.session?.user) start(toUser(data.session.user));
      else {
        if (error) setNotice(tr('تعذر استعادة جلستك. سجّل دخولك مرة أخرى.'));
        setPhase('auth');
      }
    })();
    const { data: sub } = supabase.auth.onAuthStateChange((event, sess) => {
      // لا نستدعي Supabase مباشرة داخل هذا المستمع (توصية Supabase) — نؤجل التنفيذ
      setTimeout(() => {
        if (!alive) return;
        if (event === 'PASSWORD_RECOVERY') setRecovery(true);
        if (event === 'SIGNED_IN' && sess?.user && userRef.current?.id !== sess.user.id) start(toUser(sess.user));
        if (event === 'SIGNED_OUT' && userRef.current && !userRef.current.demo) {
          const expired = !manualLogout.current;
          manualLogout.current = false;
          endSession(expired ? tr('انتهت جلستك. سجّل دخولك مرة أخرى للمتابعة.') : '');
        }
      }, 0);
    });
    const off = onLogoutRequest(logout);
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
      off();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // انتهاء الجلسة أثناء الحفظ (فشل تجديد التوكن)
  useEffect(() => {
    if (!sessionExpired) return;
    useStore.getState().closeSession();
    supabase.auth.signOut({ scope: 'local' }).finally(() => endSession(tr('انتهت جلستك. سجّل دخولك مرة أخرى — تغييراتك غير المرفوعة محفوظة على هذا الجهاز.')));
  }, [sessionExpired]);

  useApplySettings(settings);
  const lang = useLang();
  const ready = useStore((s) => s.ready);
  // اللغة: إذا اختارها المستخدم من شاشة الدخول نحفظها في حسابه، وإلا نطبّق لغة حسابه
  useEffect(() => {
    if (!ready) return;
    let picked = false;
    try {
      picked = sessionStorage.getItem('himmah:lang-picked') === '1';
      sessionStorage.removeItem('himmah:lang-picked');
    } catch (e) {
      console.warn('[himmah:lang]', e?.message || e);
    }
    if (picked && settings.language !== getLang()) useStore.getState().setSetting('language', getLang());
    else if (settings.language) changeLang(settings.language);
  }, [ready, settings.language]);

  const recoveryModal = recovery && <RecoveryModal onClose={() => setRecovery(false)} />;
  if (phase === 'boot' || phase === 'loading')
    return (
      <Fragment key={lang}>
        <Scene />
        <FullLoader text={phase === 'loading' ? tr('جاري تحميل بياناتك…') : ''} />
      </Fragment>
    );
  if (phase === 'auth')
    return (
      <Fragment key={lang}>
        <Scene />
        <Auth notice={notice} onLoggedIn={(u) => start(toUser(u))} onDemo={() => (session.set('demo', true), start(DEMO_USER))} />
        {recoveryModal}
      </Fragment>
    );
  if (phase === 'error')
    return (
      <Fragment key={lang}>
        <Scene />
        <div className="onb">
          <div className="card onb-card" style={{ textAlign: 'center' }}>
            <h2>{tr('تعذر تحميل بياناتك')}</h2>
            <p className="muted mt-s">{tr('تحقق من اتصالك بالإنترنت ثم حاول مرة أخرى. بياناتك محفوظة في حسابك ولن تضيع.')}</p>
            <div className="row mt" style={{ justifyContent: 'center' }}>
              <button className="btn btn-primary" onClick={() => start(userRef.current)}>
                {tr('حاول مرة أخرى')}
              </button>
              <button className="btn btn-ghost" onClick={logout}>
                {tr('تسجيل الخروج')}
              </button>
            </div>
          </div>
        </div>
      </Fragment>
    );
  if (!onboarded)
    return (
      <Fragment key={lang}>
        <Scene />
        <Onboarding />
        <Toasts />
        {recoveryModal}
      </Fragment>
    );
  return (
    <Fragment key={lang}>
      <Shell />
      {recoveryModal}
    </Fragment>
  );
}

function FullLoader({ text }) {
  return (
    <div className="build-anim" style={{ minHeight: '100dvh', justifyContent: 'center', position: 'relative', zIndex: 1 }} role="status" aria-live="polite">
      <div className="spinner" />
      {text && <p className="muted">{text}</p>}
    </div>
  );
}

// تعيين كلمة مرور جديدة بعد فتح رابط الاستعادة من البريد
function RecoveryModal({ onClose }) {
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  async function save() {
    if (pw.length < 8) return setErr(tr('كلمة المرور يجب أن تكون 8 أحرف على الأقل'));
    setBusy(true);
    setErr('');
    try {
      await updatePassword(pw);
      useStore.getState().toast(tr('تم تغيير كلمة المرور بنجاح'), { icon: 'check' });
      onClose();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title={tr('تعيين كلمة مرور جديدة')} onClose={onClose} footer={<button className="btn btn-primary" onClick={save} disabled={busy}>{busy ? tr('جاري الحفظ…') : tr('حفظ كلمة المرور')}</button>}>
      <label className="field">
        <span>{tr('كلمة المرور الجديدة')}</span>
        <input className="input" type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" dir="ltr" />
      </label>
      {err && <div className="err mt-s" role="alert">{err}</div>}
    </Modal>
  );
}

function Shell() {
  const { name } = useRoute();
  const Page = PAGES[name];
  useShortcuts();
  useReminders();
  return (
    <>
      <Scene />
      <div className="app">
        <Rail />
        <div className="main">
          <Header />
          <main className="content" id="main">
            <MigrationBanner />
            {name !== 'home' && <QuickInput className="mobile-quick" id="mobile-input" />}
            <div className="page" key={name}>
              {Page ? (
                <Suspense fallback={<PageLoader />}>
                  <Page />
                </Suspense>
              ) : (
                <Home />
              )}
            </div>
          </main>
          <Footer />
        </div>
      </div>
      <BottomNav />
      <ModalRoot />
      <FocusMode />
      <FxLayer />
      <Toasts />
    </>
  );
}

function PageLoader() {
  return (
    <div className="build-anim" style={{ minHeight: '50vh', justifyContent: 'center' }}>
      <div className="spinner" />
    </div>
  );
}

function useApplySettings(s) {
  useEffect(() => {
    const html = document.documentElement;
    const apply = () => {
      const dark = s.theme === 'auto' ? window.matchMedia('(prefers-color-scheme: dark)').matches : s.theme !== 'light';
      html.dataset.theme = dark ? 'dark' : 'light';
      document.querySelector('meta[name=theme-color]')?.setAttribute('content', dark ? '#0B0D0C' : '#F4F2ED');
    };
    apply();
    html.dataset.accent = s.accent;
    html.dataset.scale = s.scale;
    html.dataset.motion = s.motion;
    html.dataset.bg = s.background;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener?.('change', apply);
    return () => mq.removeEventListener?.('change', apply);
  }, [s.theme, s.accent, s.scale, s.motion, s.background]);
}

// اختصارات لوحة المفاتيح (Desktop)
function useShortcuts() {
  const g = useRef(0);
  useEffect(() => {
    function onKey(e) {
      const st = useStore.getState();
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        st.setDrawer(st.drawer === 'command' ? null : 'command');
        return;
      }
      const tag = document.activeElement?.tagName;
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(tag) || document.activeElement?.isContentEditable) return;
      if (e.ctrlKey || e.metaKey || e.altKey || st.modal || st.drawer || st.focus?.minimized === false) return;
      const k = e.key.toLowerCase();
      if (Date.now() - g.current < 900) {
        g.current = 0;
        const map = { h: 'home', t: 'tasks', s: 'schedule', g: 'goals', a: 'achievements', p: 'profile', r: 'rewards' };
        if (map[k]) return navigate(map[k]);
      }
      if (k === 'g') return (g.current = Date.now());
      if (k === 'n' || k === 'ى') (e.preventDefault(), st.openModal('task'));
      else if (k === 'v' || k === 'ر') st.openModal('voice');
      else if (k === 'w' || k === 'ص') st.openModal('whatNow');
      else if (k === 'a' || k === 'ش') st.setDrawer('assistant');
      else if (e.key === '?') st.openModal('shortcuts');
      else if (e.key === '/') {
        e.preventDefault();
        ['home-input', 'quick-input', 'mobile-input'].map((id) => document.getElementById(id)).find((el) => el?.offsetParent)?.focus();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}

// التذكيرات: مفيدة وقليلة — المهمة القادمة، تجميعة المتأخرة (مرة يوميًا)، الـStreak، ونهاية اليوم
function useReminders() {
  useEffect(() => {
    function check() {
      const st = useStore.getState();
      const T = todayKey();
      const now = nowMin();
      const hour = Math.floor(now / 60);
      const notified = st.flags.notified || {};
      const upd = { ...notified };
      let changed = false;
      const mark = (k) => ((upd[k] = T), (changed = true));
      const open = st.tasks.filter((t) => !t.deletedAt && !t.done && !t.template && t.date === T);
      // 1) المهمة القادمة خلال 15 دقيقة (مرة واحدة لكل مهمة)
      for (const t of open) {
        if (!t.time) continue;
        const diff = toMin(t.time) - now;
        if (diff > 0 && diff <= 15 && !notified[t.id]) {
          st.notify('upcoming', 'bell', tr('مهمتك القادمة'), trf('بعد {n} دقيقة: {title}', { n: diff, title: t.title }));
          mark(t.id);
        }
      }
      // 2) المهام المتأخرة — تنبيه واحد مجمّع يوميًا بدل تنبيه لكل مهمة
      const overdue = st.tasks.filter((t) => isOverdue(t));
      if (overdue.length && notified.overdue !== T && hour >= 9) {
        st.notify('overdue', 'alarm', overdue.length > 1 ? trf('{n} مهام متأخرة', { n: overdue.length }) : tr('مهمة متأخرة'), trf('{titles} — أعد جدولتها أو انقلها لوقت آخر', { titles: overdue.slice(0, 2).map((t) => t.title).join(tr('، ')) }));
        mark('overdue');
      }
      // 3) تذكير الـStreak مساءً
      if (hour >= 19 && st.streak.count > 0 && st.streak.lastDate !== T && open.length && notified.streakWarn !== T) {
        st.notify('streak', 'flame', tr('حافظ على الـStreak'), trf('أكمل مهام اليوم لتحافظ على سلسلة {n} يوم', { n: st.streak.count }));
        mark('streakWarn');
      }
      // 4) نهاية اليوم: قبل موعد النوم بساعة إذا بقيت مهام
      const sleep = toMin(st.profile.sleep || '23:00') ?? 23 * 60;
      if (open.length && now >= sleep - 60 && now < sleep && notified.endOfDay !== T) {
        st.notify('endOfDay', 'sunset', tr('قارب يومك على الانتهاء'), trf('باقي {n} مهام — انقل غير الضروري لبكرة وارتح', { n: open.length }));
        mark('endOfDay');
      }
      // 5) تذكير الصلاة قبل الأذان (مرة لكل صلاة في اليوم)
      if (st.settings.prayer?.remind !== false && st.settings.notif?.prayer !== false) {
        const before = st.settings.prayer?.before ?? 10;
        const times = prayerTimes(T, cityOf(st.settings));
        const row = st.prayers.find((p) => p.date === T);
        for (const p of PRAYERS) {
          const diff = times[p.key] - now;
          const k = 'prayer-' + p.key;
          if (!row?.[p.key] && diff > 0 && diff <= before && notified[k] !== T) {
            st.notify('prayer', 'bell', trf('اقترب أذان {name}', { name: tr(p.label) }), trf('بعد {n} دقيقة — {time}', { n: diff, time: fmtTime(times[p.key]) }), { force: true });
            mark(k);
          }
        }
      }
      // تنظيف المعرفات القديمة
      if (Object.keys(upd).length > 200) for (const k of Object.keys(upd).slice(0, 100)) delete upd[k];
      if (changed) st.setFlag('notified', upd);
      // يوم جديد؟
      if (st.flags.lastMaint !== T) {
        st.maintenance();
        st.setFlag('lastMaint', T);
      }
    }
    check();
    const t = setInterval(check, 30000);
    return () => clearInterval(t);
  }, []);
}
