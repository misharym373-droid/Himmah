import { useState } from 'react';
import { House, ListChecks, CalendarDays, Target, Repeat, ChartColumn, Trophy, Gift, Users, User, Settings, Mic, Bell, Search, Sparkles, Plus, Ellipsis, ArrowLeft, Wallet, ExternalLink, LogOut, Keyboard, X } from 'lucide-react';
import { useStore } from '../store.js';
import { navigate, useRoute } from '../router.js';
import { Logo, Avatar, asset } from './ui.jsx';
import { parseTasks } from '../lib/nlp.js';
import { guessMeta } from '../lib/nlp.js';
import { TAGLINE } from '../config.js';

export const NAV = [
  { id: 'home', label: 'الرئيسية', icon: House },
  { id: 'tasks', label: 'المهام', icon: ListChecks },
  { id: 'schedule', label: 'الجدول', icon: CalendarDays },
  { id: 'goals', label: 'الأهداف', icon: Target },
  { id: 'habits', label: 'العادات', icon: Repeat },
  { id: 'stats', label: 'الإحصائيات', icon: ChartColumn },
  { id: 'achievements', label: 'الإنجازات', icon: Trophy },
  { id: 'rewards', label: 'المكافآت', icon: Gift },
  { id: 'shared', label: 'المشاركة', icon: Users },
  { id: 'profile', label: 'الملف الشخصي', icon: User },
  { id: 'settings', label: 'الإعدادات', icon: Settings },
];

export function Scene() {
  return (
    <div className="scene" aria-hidden>
      <div className="grid-lines" />
      <div className="stars" />
      <div className="blob b1" />
      <div className="blob b2" />
      <div className="blob b3" />
    </div>
  );
}

export function Rail() {
  const { name } = useRoute();
  const profile = useStore((s) => s.profile);
  return (
    <aside className="rail" aria-label="القائمة الرئيسية">
      <button onClick={() => navigate('home')} aria-label="هّمة — الرئيسية">
        <img className="rail-logo" src={asset('brand/icon.webp')} alt="هّمة" width="52" height="52" />
      </button>
      <nav>
        {NAV.slice(0, 10).map(({ id, label, icon: Icon }) => (
          <button key={id} className={`rail-item ${name === id ? 'active' : ''}`} onClick={() => navigate(id)} aria-current={name === id ? 'page' : undefined} title={label}>
            <Icon />
            <span>{label === 'الملف الشخصي' ? 'ملفي' : label}</span>
          </button>
        ))}
      </nav>
      <div className="rail-foot">
        <button className={`rail-item ${name === 'settings' ? 'active' : ''}`} onClick={() => navigate('settings')} title="الإعدادات" aria-current={name === 'settings' ? 'page' : undefined}>
          <Settings />
          <span>الإعدادات</span>
        </button>
        <button onClick={() => navigate('profile')} aria-label="الملف الشخصي">
          <Avatar name={profile.name} src={profile.avatar} size="sm" />
        </button>
      </div>
    </aside>
  );
}

// الإدخال السريع: يحلل النص ويحوله إلى مهام مباشرة
export function QuickInput({ className = 'quick', id }) {
  const [v, setV] = useState('');
  const open = useStore((s) => s.openModal);
  function submit() {
    const text = v.trim();
    if (!text) return;
    const parsed = parseTasks(text);
    const st = useStore.getState();
    if (parsed.length) {
      const created = st.addTasks(parsed);
      open('created', { ids: created.map((t) => t.id) });
    } else {
      const t = st.addTask({ title: text, ...guessMeta(text) });
      st.toast(`تمت إضافة "${t.title}"`, { icon: 'check' });
    }
    setV('');
  }
  return (
    <form
      className={className}
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      role="search"
    >
      <Sparkles size={18} className="spark" aria-hidden />
      <input id={id} value={v} onChange={(e) => setV(e.target.value)} placeholder="اكتب ماذا لديك اليوم ومتى…" aria-label="إضافة سريعة: اكتب مهامك وأوقاتها" />
      <button type="button" className="icon-btn sm mic-btn" onClick={() => open('voice')} aria-label="إضافة بالصوت" title="إضافة بالصوت (V)">
        <Mic />
      </button>
      <button type="submit" className="icon-btn sm primary" aria-label="إضافة" disabled={!v.trim()}>
        <ArrowLeft />
      </button>
    </form>
  );
}

export function Header() {
  const setDrawer = useStore((s) => s.setDrawer);
  const unread = useStore((s) => s.notifications.filter((n) => !n.read).length);
  const profile = useStore((s) => s.profile);
  return (
    <header className="header">
      <Logo onClick={() => navigate('home')} />
      <QuickInput id="quick-input" />
      <div className="header-actions">
        <button className="icon-btn hide-m" onClick={() => setDrawer('command')} aria-label="بحث وأوامر" title="بحث (Ctrl+K)">
          <Search />
        </button>
        <button className="icon-btn" onClick={() => setDrawer('assistant')} aria-label="اسأل هّمة" title="اسأل هّمة (A)">
          <Sparkles />
        </button>
        <button className="icon-btn" onClick={() => setDrawer('notifications')} aria-label={`الإشعارات${unread ? ` (${unread} جديدة)` : ''}`}>
          <Bell />
          {unread > 0 && <span className="badge-dot num">{unread > 9 ? '9+' : unread}</span>}
        </button>
        <button className="hide-m" onClick={() => navigate('profile')} aria-label="الملف الشخصي">
          <Avatar name={profile.name} src={profile.avatar} />
        </button>
      </div>
    </header>
  );
}

export function BottomNav() {
  const { name } = useRoute();
  const open = useStore((s) => s.openModal);
  const [more, setMore] = useState(false);
  const items = [NAV[0], NAV[1], null, NAV[2]];
  const inMore = !['home', 'tasks', 'schedule'].includes(name);
  return (
    <>
      <nav className="bottom-nav" aria-label="التنقل">
        {items.map((it, i) =>
          it ? (
            <button key={it.id} className={`bn-item ${name === it.id ? 'active' : ''}`} onClick={() => navigate(it.id)} aria-current={name === it.id ? 'page' : undefined}>
              <it.icon />
              {it.label}
            </button>
          ) : (
            <button key="add" className="bn-add" onClick={() => open('task')} aria-label="مهمة جديدة">
              <Plus />
            </button>
          )
        )}
        <button className={`bn-item ${inMore ? 'active' : ''}`} onClick={() => setMore(true)} aria-label="المزيد">
          <Ellipsis />
          المزيد
        </button>
      </nav>
      {more && <MoreSheet onClose={() => setMore(false)} />}
    </>
  );
}

function MoreSheet({ onClose }) {
  const { name } = useRoute();
  const open = useStore((s) => s.openModal);
  const setDrawer = useStore((s) => s.setDrawer);
  const go = (id) => (navigate(id), onClose());
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-label="المزيد">
        <div className="modal-hd">
          <h3>المزيد</h3>
          <button className="icon-btn sm" onClick={onClose} aria-label="إغلاق">
            <X />
          </button>
        </div>
        <div className="grid g3" style={{ gridTemplateColumns: 'repeat(3,minmax(0,1fr))' }}>
          {NAV.slice(3).map(({ id, label, icon: Icon }) => (
            <button key={id} className={`seg-btn ${name === id ? 'on' : ''}`} onClick={() => go(id)}>
              <Icon size={22} />
              <span className="small">{label}</span>
            </button>
          ))}
          <button className="seg-btn" onClick={() => (onClose(), setDrawer('command'))}>
            <Search size={22} />
            <span className="small">بحث</span>
          </button>
        </div>
        <div className="grid g2 mt">
          <button className="btn" onClick={() => (onClose(), open('voice'))}>
            <Mic /> إضافة بالصوت
          </button>
          <button className="btn" onClick={() => (onClose(), open('image'))}>
            📷 من صورة
          </button>
        </div>
      </div>
    </div>
  );
}

export function Footer() {
  const surra = useStore((s) => s.settings.surraUrl);
  const links = [
    ['home', 'الرئيسية'],
    ['tasks', 'المهام'],
    ['goals', 'الأهداف'],
    ['stats', 'الإحصائيات'],
    ['profile', 'الملف الشخصي'],
    ['settings', 'الإعدادات'],
  ];
  return (
    <footer className="footer">
      <Logo className="header-logo" onClick={() => navigate('home')} />
      <div className="tag">هّمة — {TAGLINE}</div>
      <nav className="flinks" aria-label="روابط الموقع">
        {links.map(([id, l]) => (
          <button key={id} onClick={() => navigate(id)}>
            {l}
          </button>
        ))}
        <SurraLink url={surra} className="gold" />
      </nav>
      <p className="tiny dim">© {new Date().getFullYear()} هّمة · صُنع بشغف لحياة أكثر تنظيمًا</p>
    </footer>
  );
}

export function SurraLink({ url, className = '', children }) {
  const toast = useStore((s) => s.toast);
  if (url)
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" className={className}>
        {children || (
          <>
            <Wallet size={14} style={{ verticalAlign: -2 }} /> صُرّة لإدارة الأموال <ExternalLink size={12} style={{ verticalAlign: -1 }} />
          </>
        )}
      </a>
    );
  return (
    <button className={className} onClick={() => (navigate('settings?tab=account'), toast('أضف رابط صُرّة من الإعدادات ← الحساب'))}>
      {children || (
        <>
          <Wallet size={14} style={{ verticalAlign: -2 }} /> صُرّة لإدارة الأموال
        </>
      )}
    </button>
  );
}

export { LogOut, Keyboard };
