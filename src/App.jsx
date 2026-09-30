import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { useStore } from './store.js';
import { useRoute, navigate } from './router.js';
import { session } from './lib/storage.js';
import { findById } from './lib/auth.js';
import { todayKey, toMin, nowMin } from './lib/date.js';
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
const PAGES = { tasks: Tasks, schedule: Schedule, goals: Goals, habits: Habits, stats: Stats, achievements: Achievements, rewards: Rewards, shared: Shared, profile: Profile, settings: Settings };

export default function App() {
  const [user, setUser] = useState(() => {
    const id = session.get();
    return id ? findById(id) : null;
  });
  const ready = useStore((s) => s.ready);
  const onboarded = useStore((s) => s.onboarded);
  const settings = useStore((s) => s.settings);

  useEffect(() => {
    document.getElementById('boot')?.remove();
  }, []);

  useEffect(() => {
    if (user) useStore.getState().init(user);
    else useStore.getState().reset();
  }, [user]);

  useApplySettings(settings);

  function login(u, remember) {
    session.set(u.id, remember);
    setUser(u);
    navigate('home');
  }
  function logout() {
    session.clear();
    setUser(null);
  }
  // يُستدعى من صفحة الملف الشخصي والإعدادات
  useEffect(() => {
    window.__himmahLogout = logout;
  });

  if (!user)
    return (
      <>
        <Scene />
        <Auth onLogin={login} />
      </>
    );
  if (!ready) return null;
  if (!onboarded)
    return (
      <>
        <Scene />
        <Onboarding />
        <Toasts />
      </>
    );
  return <Shell />;
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
            <QuickInput className="quick mobile-quick" />
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
      document.querySelector('meta[name=theme-color]')?.setAttribute('content', dark ? '#080B12' : '#EEF1F8');
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
        (document.getElementById('quick-input')?.offsetParent ? document.getElementById('quick-input') : document.querySelector('.mobile-quick input'))?.focus();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}

// تذكير بالمهام القادمة + تنبيه الـStreak
function useReminders() {
  useEffect(() => {
    function check() {
      const st = useStore.getState();
      const T = todayKey();
      const now = nowMin();
      const notified = st.flags.notified || {};
      const upd = { ...notified };
      let changed = false;
      for (const t of st.tasks) {
        if (t.deletedAt || t.done || t.template || t.date !== T || !t.time) continue;
        const diff = toMin(t.time) - now;
        if (diff > 0 && diff <= 15 && !notified[t.id]) {
          st.notify('upcoming', '🔔', 'مهمتك القادمة', `باقي ${diff} دقيقة على مهمتك القادمة: ${t.title}`);
          upd[t.id] = 1;
          changed = true;
        }
      }
      const hour = new Date().getHours();
      if (hour >= 19 && st.streak.count > 0 && st.streak.lastDate !== T && notified.streakWarn !== T) {
        st.notify('streak', '🔥', 'حافظ على الـStreak', `بقي يوم واحد لتحافظ على الـStreak (${st.streak.count} يوم). أكمل مهام اليوم!`);
        upd.streakWarn = T;
        changed = true;
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
