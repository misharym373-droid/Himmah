import { useDeferredValue, useEffect, useRef, useState } from 'react';
import { Loader2, CloudOff, House, ListChecks, CalendarDays, Target, Repeat, ChartColumn, Trophy, Gift, Users, User, Settings, Mic, Bell, Search, Sparkles, Plus, Ellipsis, ArrowLeft, Wallet, ExternalLink, X, Calendar, Clock, Timer, ImagePlus } from 'lucide-react';
import { useStore } from '../store.js';
import { navigate, useRoute } from '../router.js';
import { Logo, Avatar } from './ui.jsx';
import { Glyph } from './Glyph.jsx';
import { guessMeta } from '../lib/nlp.js';
import { previewTasks, analyzeInput } from '../lib/smartInput.js';
import { relativeDay, formatDuration } from '../lib/date.js';
import { TAGLINE, SURRA_URL, AREAS, PRIORITIES } from '../config.js';

// الصفحات الأساسية تظهر دائمًا، والباقي داخل "المزيد"
export const NAV = [
  { id: 'home', label: 'الرئيسية', icon: House, primary: true },
  { id: 'tasks', label: 'المهام', icon: ListChecks, primary: true },
  { id: 'schedule', label: 'الجدول', icon: CalendarDays, primary: true },
  { id: 'goals', label: 'الأهداف', icon: Target, primary: true },
  { id: 'profile', label: 'ملفي', icon: User, primary: true },
  { id: 'habits', label: 'العادات', icon: Repeat, desc: 'تابع عاداتك اليومية' },
  { id: 'stats', label: 'الإحصائيات', icon: ChartColumn, desc: 'إنتاجيتك بالأرقام' },
  { id: 'achievements', label: 'الإنجازات', icon: Trophy, desc: 'الإنجازات والتحديات' },
  { id: 'rewards', label: 'المكافآت', icon: Gift, desc: 'استبدل نقاطك' },
  { id: 'shared', label: 'المشاركة', icon: Users, desc: 'مشاريع الفريق' },
  { id: 'settings', label: 'الإعدادات', icon: Settings, desc: 'المظهر والتنبيهات والحساب' },
];
const PRIMARY = NAV.filter((n) => n.primary);
const SECONDARY = NAV.filter((n) => !n.primary);

export function Scene() {
  return (
    <div className="scene" aria-hidden />
  );
}

// إغلاق عند النقر خارج العنصر أو Escape
function useDismiss(open, setOpen, ref) {
  useEffect(() => {
    if (!open) return;
    const out = (e) => !ref.current?.contains(e.target) && setOpen(false);
    const esc = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('pointerdown', out);
    document.addEventListener('keydown', esc);
    return () => (document.removeEventListener('pointerdown', out), document.removeEventListener('keydown', esc));
  }, [open, setOpen, ref]);
}

export function Rail() {
  const { name } = useRoute();
  const profile = useStore((s) => s.profile);
  const [more, setMore] = useState(false);
  const ref = useRef(null);
  useDismiss(more, setMore, ref);
  const inMore = SECONDARY.some((n) => n.id === name);
  return (
    <aside className="rail" aria-label="القائمة الرئيسية">
      <button onClick={() => navigate('home')} aria-label="مسار — الرئيسية" className="rail-logo-btn">
        <span className="brand-mark rail-logo" aria-hidden />
        <span className="brand-name rail-name" aria-hidden />
      </button>
      <nav aria-label="الصفحات الأساسية">
        {PRIMARY.map(({ id, label, icon: Icon }) => (
          <button key={id} className={`rail-item ${name === id ? 'active' : ''}`} onClick={() => navigate(id)} aria-current={name === id ? 'page' : undefined}>
            <Icon />
            <span>{label}</span>
          </button>
        ))}
        <div className="rail-more" ref={ref}>
          <button className={`rail-item ${inMore || more ? 'active-soft' : ''}`} onClick={() => setMore(!more)} aria-haspopup="menu" aria-expanded={more}>
            <Ellipsis />
            <span>{inMore ? SECONDARY.find((n) => n.id === name).label : 'المزيد'}</span>
          </button>
          {more && (
            <div className="rail-pop" role="menu" aria-label="المزيد من الصفحات">
              {SECONDARY.map(({ id, label, desc, icon: Icon }) => (
                <button key={id} role="menuitem" className={name === id ? 'on' : ''} onClick={() => (navigate(id), setMore(false))}>
                  <Icon size={18} />
                  <span className="grow">
                    <span className="bold" style={{ display: 'block' }}>{label}</span>
                    <span className="tiny muted">{desc}</span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </nav>
      <div className="rail-foot">
        <button className="rail-me" onClick={() => navigate('profile')} aria-label="الملف الشخصي">
          <Avatar name={profile.name} src={profile.avatar} size="sm" />
          <span className="rail-me-name ellipsis">{profile.name || 'ملفي'}</span>
        </button>
      </div>
    </aside>
  );
}

// الإدخال الذكي: معاينة فورية لما فهمه النظام + إنشاء المهام عند Enter
export function QuickInput({ className = 'quick', id, big }) {
  const [v, setV] = useState('');
  const [focused, setFocused] = useState(false);
  const open = useStore((s) => s.openModal);
  const deferred = useDeferredValue(v);
  const preview = deferred.trim().length > 2 ? previewTasks(deferred) : [];
  async function submit() {
    const text = v.trim();
    if (!text) return;
    setV('');
    const parsed = await analyzeInput(text);
    const st = useStore.getState();
    if (parsed.length) {
      const created = st.addTasks(parsed);
      open('created', { ids: created.map((t) => t.id) });
    } else {
      const t = st.addTask({ title: text, ...guessMeta(text) });
      st.toast(`تمت إضافة "${t.title}"`, { icon: 'check' });
    }
  }
  return (
    <div className={`quick-wrap ${big ? 'big' : ''} ${className.includes('mobile-quick') ? 'mobile-quick' : ''}`} onFocus={() => setFocused(true)} onBlur={(e) => !e.currentTarget.contains(e.relatedTarget) && setFocused(false)}>
      <form
        className="quick"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        role="search"
        aria-label="الإدخال الذكي"
      >
        <Sparkles size={18} className="spark" aria-hidden />
        <input id={id} value={v} onChange={(e) => setV(e.target.value)} placeholder="اكتب ماذا لديك ومتى… مثال: النادي اليوم الساعة 8" aria-label="اكتب مهامك وأوقاتها بطريقتك" autoComplete="off" />
        <button type="button" className="mic-btn" onClick={() => open('voice')} aria-label="إضافة بالصوت" title="إضافة بالصوت (V)">
          <Mic />
        </button>
        <button type="submit" className="icon-btn sm primary" aria-label="إضافة المهام" disabled={!v.trim()}>
          <ArrowLeft />
        </button>
      </form>
      {focused && preview.length > 0 && (
        <div className="quick-preview" role="status" aria-live="polite">
          <div className="tiny muted bold">سيتم إنشاء {preview.length > 1 ? `${preview.length} مهام` : 'مهمة'} — اضغط Enter</div>
          {preview.slice(0, 4).map((t, i) => (
            <div className="qp-item" key={i}>
              <Glyph name={t.icon} size={16} className="purple" />
              <span className="bold grow ellipsis">{t.title}</span>
              <span className="qp-chip"><Calendar size={12} /> {relativeDay(t.date)}</span>
              {t.time && <span className="qp-chip num"><Clock size={12} /> {t.time}</span>}
              <span className="qp-chip"><Timer size={12} /> {formatDuration(t.duration)}</span>
              {t.priority !== 'med' && <span className="prio-tag" style={{ '--c': PRIORITIES[t.priority].color }}>{PRIORITIES[t.priority].label}</span>}
              <span className="qp-chip hide-mobile" style={{ color: AREAS[t.area]?.color }}>{AREAS[t.area]?.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function Header() {
  const { name } = useRoute();
  const setDrawer = useStore((s) => s.setDrawer);
  const unread = useStore((s) => s.notifications.filter((n) => !n.read).length);
  const profile = useStore((s) => s.profile);
  return (
    <header className="header">
      <Logo onClick={() => navigate('home')} />
      {name !== 'home' ? <QuickInput id="quick-input" /> : <div className="grow" />}
      <div className="header-actions">
        <SyncBadge />
        <button className="icon-btn hide-m" onClick={() => setDrawer('command')} aria-label="بحث وأوامر" title="بحث (Ctrl+K)">
          <Search />
        </button>
        <button className="icon-btn" onClick={() => setDrawer('assistant')} aria-label="اسأل مسار" title="اسأل مسار (A)">
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

const BOTTOM = ['home', 'tasks', 'schedule'];

// حالة الاتصال والمزامنة مع Supabase (تظهر فقط عندما تهم المستخدم)
function SyncBadge() {
  const { mode, status, pending } = useStore((s) => s.sync);
  if (mode !== 'remote' || (status === 'synced' && !pending)) return null;
  const map = {
    saving: [Loader2, 'جاري الحفظ…', 'sync-saving'],
    offline: [CloudOff, pending ? `غير متصل · ${pending} تغييرات بانتظار الرفع` : 'غير متصل', 'sync-offline'],
    error: [CloudOff, 'تعذر الحفظ', 'sync-offline'],
    synced: [Loader2, 'جاري الحفظ…', 'sync-saving'],
  };
  const [I, label, cls] = map[status] || map.saving;
  return (
    <span className={`sync-badge ${cls}`} role="status" aria-live="polite" title={label}>
      <I size={14} aria-hidden />
      <span className="sync-label">{label}</span>
    </span>
  );
}

export function BottomNav() {
  const { name } = useRoute();
  const open = useStore((s) => s.openModal);
  const [more, setMore] = useState(false);
  const items = [NAV[0], NAV[1], null, NAV[2]];
  const inMore = !BOTTOM.includes(name);
  return (
    <>
      <nav className="bottom-nav" aria-label="التنقل">
        {items.map((it) =>
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
        <button className={`bn-item ${inMore ? 'active' : ''}`} onClick={() => setMore(true)} aria-haspopup="dialog" aria-expanded={more}>
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
  const pages = NAV.filter((n) => !BOTTOM.includes(n.id));
  const actions = [
    [Mic, 'بالصوت', () => open('voice')],
    [ImagePlus, 'من صورة', () => open('image')],
    [Sparkles, 'اسأل مسار', () => setDrawer('assistant')],
    [Search, 'بحث', () => setDrawer('command')],
  ];
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal sheet" role="dialog" aria-modal="true" aria-label="المزيد">
        <div className="sheet-grip" aria-hidden />
        <div className="modal-hd">
          <h3>المزيد</h3>
          <button className="icon-btn sm" onClick={onClose} aria-label="إغلاق">
            <X />
          </button>
        </div>
        <div className="sheet-actions">
          {actions.map(([I, l, run]) => (
            <button key={l} onClick={() => (onClose(), run())}>
              <span className="sa-ico"><I size={20} /></span>
              {l}
            </button>
          ))}
        </div>
        <div className="sheet-list">
          {pages.map(({ id, label, desc, icon: Icon }) => (
            <button key={id} className={name === id ? 'on' : ''} onClick={() => go(id)} aria-current={name === id ? 'page' : undefined}>
              <span className="sa-ico"><Icon size={19} /></span>
              <span className="grow" style={{ textAlign: 'start' }}>
                <span className="bold" style={{ display: 'block' }}>{label === 'ملفي' ? 'الملف الشخصي' : label}</span>
                {desc && <span className="tiny muted">{desc}</span>}
              </span>
              <ArrowLeft size={16} className="dim" />
            </button>
          ))}
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
      <div className="tag">مسار — {TAGLINE}</div>
      <nav className="flinks" aria-label="روابط الموقع">
        {links.map(([id, l]) => (
          <button key={id} onClick={() => navigate(id)}>
            {l}
          </button>
        ))}
        <SurraLink url={surra} className="gold" />
      </nav>
      <p className="tiny dim">© {new Date().getFullYear()} مسار · صُنع بشغف لحياة أكثر تنظيمًا</p>
    </footer>
  );
}

export function SurraLink({ url: custom, className = '', children }) {
  const toast = useStore((s) => s.toast);
  const url = custom || SURRA_URL;
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

