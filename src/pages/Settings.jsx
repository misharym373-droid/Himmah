import { useRef, useState } from 'react';
import { DndContext, closestCenter, PointerSensor, TouchSensor, KeyboardSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove, sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Settings as SettingsIcon, User, Palette, Bell, Sparkles, Languages, Shield, LayoutDashboard, Database, LogOut, Check, Download, Upload, RotateCcw, Trash2, Moon, Sun, SunMoon, Keyboard } from 'lucide-react';
import { useStore } from '../store.js';
import { useRoute } from '../router.js';
import { Switch, CardTitle, useConfirm } from '../components/ui.jsx';
import { DragHandle } from '../components/TaskItem.jsx';
import { ACCENTS, PERSONAS, SURRA_URL } from '../config.js';
import { WIDGETS } from '../lib/seed.js';
import { say } from '../lib/assistant.js';
import { deleteAccount } from '../lib/auth.js';
import { requestLogout } from '../lib/appSession.js';
import { todayKey } from '../lib/date.js';
import { Glyph } from '../components/Glyph.jsx';

// مجموعات واضحة — والروابط القديمة (sound/language/privacy/data) تُوجَّه لمجموعتها الجديدة
const TABS = [
  ['appearance', 'المظهر', Palette],
  ['notifications', 'الإشعارات والتذكيرات', Bell],
  ['assistant', 'المساعد', Sparkles],
  ['dashboard', 'الصفحة الرئيسية', LayoutDashboard],
  ['account', 'الحساب والبيانات', User],
];
const ALIASES = { sound: 'appearance', language: 'account', privacy: 'account', data: 'account' };

export default function Settings() {
  const { params } = useRoute();
  const initial = ALIASES[params.tab] || params.tab;
  const [tab, setTab] = useState(TABS.some((t) => t[0] === initial) ? initial : 'appearance');
  const confirm = useConfirm();
  return (
    <>
      <div className="page-head">
        <div>
          <h1>
            <span className="ico">
              <SettingsIcon />
            </span>
            الإعدادات
          </h1>
          <p>خصّص مسار ليناسبك — كل تغيير يُطبّق ويُحفظ فورًا</p>
        </div>
      </div>
      <div className="settings">
        <nav className="card settings-nav" aria-label="أقسام الإعدادات">
          {TABS.map(([k, l, I]) => (
            <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)} aria-current={tab === k ? 'true' : undefined}>
              <I /> {l}
            </button>
          ))}
          <button onClick={() => useStore.getState().openModal('shortcuts')} className="hide-mobile">
            <Keyboard /> الاختصارات
          </button>
          <button
            className="red"
            onClick={() => confirm({ title: 'تسجيل الخروج', body: 'هل تريد تسجيل الخروج؟', danger: true, confirmLabel: 'تسجيل الخروج', onConfirm: () => requestLogout() })}
          >
            <LogOut /> تسجيل الخروج
          </button>
        </nav>
        <div className="card reveal" key={tab}>
          {tab === 'appearance' && <Appearance />}
          {tab === 'notifications' && <Notifications />}
          {tab === 'assistant' && <Assistant />}
          {tab === 'dashboard' && <Dashboard />}
          {tab === 'account' && (
            <div className="col" style={{ gap: 28 }}>
              <Account />
              <Data />
              <Privacy />
              <Language />
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function Row({ t, d, children }) {
  return (
    <div className="set-row">
      <div className="grow" style={{ minWidth: 180 }}>
        <div className="t">{t}</div>
        {d && <div className="d">{d}</div>}
      </div>
      <div className="row wrap">{children}</div>
    </div>
  );
}
const useSet = () => useStore((s) => s.setSetting);

function Account() {
  const profile = useStore((s) => s.profile);
  const surra = useStore((s) => s.settings.surraUrl);
  const set = useSet();
  const [url, setUrl] = useState(surra || SURRA_URL);
  const confirm = useConfirm();
  const isDemo = useStore((s) => s.sync.mode) === 'local';
  const [deleting, setDeleting] = useState(false);
  const removeAccount = async () => {
    setDeleting(true);
    try {
      await deleteAccount();
      // الحساب حُذف: نوقف المزامنة بدون رفع أي شيء، ثم نخرج (الخروج يمسح النسخة المحلية)
      useStore.getState().abandonSession();
      requestLogout();
    } catch (e) {
      useStore.getState().toast(e.message || 'تعذر حذف البيانات، حاول مرة أخرى.', { icon: 'clock' });
      setDeleting(false);
    }
  };
  return (
    <>
      <CardTitle icon={<User size={18} />}>الحساب</CardTitle>
      <Row t="الاسم" d={profile.name} />
      <Row t="البريد الإلكتروني" d={profile.email || '—'} />
      <Row t="نوع الحساب" d={isDemo ? 'تجربة بدون حساب — البيانات محفوظة على هذا الجهاز فقط' : 'حساب مسار — بياناتك محفوظة بأمان في السحابة ومتزامنة بين أجهزتك'} />
      <Row t="تسجيل الخروج" d={isDemo ? 'بيانات التجربة تبقى على هذا الجهاز' : 'بياناتك تبقى محفوظة في حسابك'}>
        <button className="btn btn-sm btn-danger" onClick={() => confirm({ title: 'تسجيل الخروج', body: 'هل تريد تسجيل الخروج؟', danger: true, confirmLabel: 'تسجيل الخروج', onConfirm: () => requestLogout() })}>
          <LogOut /> تسجيل الخروج
        </button>
      </Row>
      <Row t="رابط صُرّة لإدارة الأموال" d="يُستخدم لزر «فتح صُرّة» في الملف الشخصي والفوتر">
        <input className="input" style={{ width: 260, maxWidth: '100%' }} dir="ltr" placeholder="https://…" value={url} onChange={(e) => setUrl(e.target.value)} />
        <button
          className="btn btn-sm btn-primary"
          onClick={() => {
            const v = url.trim();
            if (v && !/^https?:\/\//.test(v)) return useStore.getState().toast('الرابط يجب أن يبدأ بـ https://');
            set('surraUrl', v);
            useStore.getState().toast('تم حفظ الرابط', { icon: 'check' });
          }}
        >
          حفظ
        </button>
      </Row>
      {!isDemo && (
        <Row t="حذف بياناتي" d="حذف كل مهامك وأهدافك وعاداتك في مسار نهائيًا">
          <button
            className="btn btn-sm btn-danger"
            disabled={deleting}
            onClick={() =>
              confirm({
                title: 'حذف بياناتك نهائيًا',
                body: 'سيتم حذف كل بياناتك في مسار وتسجيل خروجك. لا يمكن التراجع.',
                danger: true,
                confirmLabel: 'حذف نهائي',
                onConfirm: removeAccount,
              })
            }
          >
            <Trash2 /> حذف بياناتي
          </button>
        </Row>
      )}
    </>
  );
}

function Appearance() {
  const s = useStore((x) => x.settings);
  const set = useSet();
  return (
    <>
      <CardTitle icon={<Palette size={18} />} sub="كل تغيير يُطبّق فورًا">المظهر</CardTitle>
      <Row t="المظهر" d="الافتراضي: تلقائي حسب إعداد جهازك">
        {[
          ['auto', 'تلقائي', SunMoon],
          ['light', 'فاتح', Sun],
          ['dark', 'داكن', Moon],
        ].map(([k, l, I]) => (
          <button key={k} className={`chip ${s.theme === k ? 'on' : ''}`} onClick={() => set('theme', k)}>
            <I /> {l}
          </button>
        ))}
      </Row>
      <Row t="لون التمييز (Accent)" d="يتغير لون الأزرار والتقدم والعناصر النشطة">
        <div className="swatches">
          {Object.entries(ACCENTS).map(([k, a]) => (
            <button key={k} className={`swatch-btn ${s.accent === k ? 'on' : ''}`} style={{ background: a.color, color: a.color }} onClick={() => set('accent', k)} aria-label={a.label} title={a.label}>
              {s.accent === k && <Check size={18} color="#fff" />}
            </button>
          ))}
        </div>
      </Row>
      <Row t="حجم الواجهة">
        {[
          ['sm', 'صغير'],
          ['md', 'متوسط'],
          ['lg', 'كبير'],
        ].map(([k, l]) => (
          <button key={k} className={`chip ${s.scale === k ? 'on' : ''}`} onClick={() => set('scale', k)}>
            {l}
          </button>
        ))}
      </Row>
      <Row t="الخلفية">
        {[
          ['neon', 'هادئة'],
          ['gradient', 'دافئة'],
          ['minimal', 'سادة'],
        ].map(([k, l]) => (
          <button key={k} className={`chip ${s.background === k ? 'on' : ''}`} onClick={() => set('background', k)}>
            {l}
          </button>
        ))}
      </Row>
      <Row t="الحركة" d="الوضع الخفيف أو الإيقاف مناسب لتقليل التشتت — ويُحترم إعداد تقليل الحركة في جهازك">
        {[
          ['full', 'كاملة'],
          ['lite', 'خفيفة'],
          ['off', 'إيقاف'],
        ].map(([k, l]) => (
          <button key={k} className={`chip ${s.motion === k ? 'on' : ''}`} onClick={() => set('motion', k)}>
            {l}
          </button>
        ))}
      </Row>
    </>
  );
}

function Notifications() {
  const s = useStore((x) => x.settings);
  const setN = useStore((x) => x.setNotifSetting);
  const set = useSet();
  const [perm, setPerm] = useState(typeof Notification !== 'undefined' ? Notification.permission : 'unsupported');
  const types = [
    ['upcoming', 'المهمة القادمة', 'تذكير قبل بدء المهمة بـ 15 دقيقة'],
    ['overdue', 'المهام المتأخرة', 'تنبيه واحد يوميًا يجمع المهام المتأخرة'],
    ['streak', 'تذكير الـStreak', 'مساءً، إذا كان يومك غير مكتمل'],
    ['endOfDay', 'نهاية اليوم', 'قبل موعد نومك بساعة إذا بقيت مهام'],
    ['focus', 'نهاية جلسة التركيز', 'عند انتهاء مؤقت التركيز'],
    ['goals', 'الأهداف', 'عند الاقتراب من تحقيق هدف'],
    ['achievements', 'الإنجازات', 'عند فتح إنجاز جديد أو الوصول لمستوى جديد'],
  ];
  return (
    <>
      <CardTitle icon={<Bell size={18} />} sub="تنبيهات قليلة ومفيدة — فعّل ما تحتاجه فقط">الإشعارات والتذكيرات</CardTitle>
      {types.map(([k, t, d]) => (
        <Row key={k} t={t} d={d}>
          <Switch on={s.notif[k] !== false} onChange={(v) => setN(k, v)} label={t} />
        </Row>
      ))}
      <Row t="إشعارات المتصفح" d={perm === 'denied' ? 'محظورة من إعدادات المتصفح' : perm === 'unsupported' ? 'غير مدعومة في هذا المتصفح' : 'تظهر حتى لو كان التبويب في الخلفية'}>
        <Switch
          on={s.browserNotifications && perm === 'granted'}
          label="إشعارات المتصفح"
          onChange={async (v) => {
            if (!v) return set('browserNotifications', false);
            if (perm === 'unsupported') return;
            const p = await Notification.requestPermission();
            setPerm(p);
            set('browserNotifications', p === 'granted');
          }}
        />
      </Row>
      <Row t="أصوات الإنجاز" d="صوت خفيف عند إكمال مهمة أو انتهاء جلسة التركيز">
        <Switch on={s.sounds} onChange={(v) => set('sounds', v)} label="أصوات الإنجاز" />
      </Row>
      <Row t="الاهتزاز" d="على الجوال عند الإنجاز">
        <Switch on={s.vibration} onChange={(v) => set('vibration', v)} label="الاهتزاز" />
      </Row>
    </>
  );
}

function Assistant() {
  const persona = useStore((x) => x.settings.persona);
  const set = useSet();
  return (
    <>
      <CardTitle icon={<Sparkles size={18} />} sub="تتغير طريقة صياغة رسائل المساعد حسب الشخصية">
        شخصية مساعد مسار
      </CardTitle>
      <div className="grid g2 mt">
        {Object.entries(PERSONAS).map(([k, p]) => (
          <button key={k} className={`seg-btn ${persona === k ? 'on' : ''}`} onClick={() => set('persona', k)} style={{ padding: 18 }}>
            <Glyph name={p.icon} size={22} className="purple" />
            {p.label}
            <span className="tiny dim">{p.desc}</span>
          </button>
        ))}
      </div>
      <div className="msg ai mt" style={{ maxWidth: '100%' }}>
        <b>مثال:</b> {say(persona, 'hi')} {say(persona, 'push')}
      </div>
    </>
  );
}

function Language() {
  return (
    <>
      <CardTitle icon={<Languages size={18} />}>اللغة</CardTitle>
      <Row t="لغة الواجهة" d="الأرقام تظهر بالإنجليزية (123) لوضوح أكبر">
        <button className="chip on">العربية</button>
        <button className="chip" disabled title="قريبًا">
          English — قريبًا
        </button>
      </Row>
    </>
  );
}

function Privacy() {
  const s = useStore((x) => x.settings);
  const set = useSet();
  return (
    <>
      <CardTitle icon={<Shield size={18} />}>الخصوصية</CardTitle>
      <Row t="أين تُحفظ بياناتي؟" d="كل بياناتك محفوظة على هذا الجهاز فقط (LocalStorage). لا يتم إرسال أي بيانات لأي خادم." />
      <Row t="إخفاء الإحصائيات من الرئيسية" d="مفيد عند مشاركة الشاشة">
        <Switch on={s.privacy?.hideStatsOnHome} onChange={(v) => set('privacy', { ...s.privacy, hideStatsOnHome: v })} label="إخفاء الإحصائيات" />
      </Row>
      <Row t="قراءة الصور" d="الصور التي ترفعها تُعالج داخل متصفحك ولا تُرفع لأي مكان" />
    </>
  );
}

function SortableRow({ w, hidden, onToggle }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: w.id });
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className={`sortable-item ${isDragging ? 'dragging' : ''}`}>
      <DragHandle {...attributes} {...listeners} />
      <span className="grow bold small" style={{ opacity: hidden ? 0.5 : 1 }}>{w.label}</span>
      <Switch on={!hidden} onChange={onToggle} label={`إظهار ${w.label}`} />
    </div>
  );
}

function Dashboard() {
  const dash = useStore((s) => s.dashboard);
  const setDash = useStore((s) => s.setDashboard);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }), useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const items = dash.order.map((id) => WIDGETS.find((w) => w.id === id)).filter(Boolean);
  return (
    <>
      <CardTitle icon={<LayoutDashboard size={18} />} sub="اختر البطاقات التي تظهر في الرئيسية واسحبها لتغيير ترتيبها — يُحفظ تلقائيًا">
        تخصيص الصفحة الرئيسية
      </CardTitle>
      <div className="mt">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={({ active, over }) => {
            if (!over || active.id === over.id) return;
            setDash({ order: arrayMove(dash.order, dash.order.indexOf(active.id), dash.order.indexOf(over.id)) });
          }}
        >
          <SortableContext items={dash.order} strategy={verticalListSortingStrategy}>
            {items.map((w) => (
              <SortableRow key={w.id} w={w} hidden={dash.hidden.includes(w.id)} onToggle={(v) => setDash({ hidden: v ? dash.hidden.filter((x) => x !== w.id) : [...dash.hidden, w.id] })} />
            ))}
          </SortableContext>
        </DndContext>
      </div>
      <button className="btn btn-sm btn-ghost mt" onClick={() => setDash({ order: WIDGETS.map((w) => w.id), hidden: [] })}>
        <RotateCcw /> استعادة الافتراضي
      </button>
    </>
  );
}

function Data() {
  const confirm = useConfirm();
  const fileRef = useRef(null);
  const st = useStore.getState;
  function exportData() {
    const blob = new Blob([JSON.stringify({ app: 'himmah', exportedAt: new Date().toISOString(), data: st().exportData() }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `himmah-backup-${todayKey()}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  function importData(file) {
    if (!file) return;
    const r = new FileReader();
    r.onload = () => {
      try {
        const j = JSON.parse(r.result);
        if (j.app !== 'himmah' || !j.data?.tasks) throw new Error();
        confirm({ title: 'استيراد البيانات', body: 'سيتم استبدال بياناتك الحالية بالنسخة المستوردة.', confirmLabel: 'استيراد', onConfirm: () => (st().importData(j.data), st().toast('تم استيراد البيانات', { icon: 'check' })) });
      } catch {
        st().toast('الملف غير صالح');
      }
    };
    r.readAsText(file);
  }
  return (
    <>
      <CardTitle icon={<Database size={18} />}>إدارة البيانات</CardTitle>
      <Row t="تصدير نسخة احتياطية" d="ملف JSON يحتوي كل بياناتك">
        <button className="btn btn-sm" onClick={exportData}>
          <Download /> تصدير
        </button>
      </Row>
      <Row t="استيراد نسخة احتياطية">
        <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => importData(e.target.files[0])} />
        <button className="btn btn-sm" onClick={() => fileRef.current.click()}>
          <Upload /> استيراد
        </button>
      </Row>
      <Row t="تحميل البيانات التجريبية" d="مهام وأهداف وعادات تجريبية لاستكشاف مسار">
        <button className="btn btn-sm" onClick={() => confirm({ title: 'البيانات التجريبية', body: 'سيتم استبدال بياناتك الحالية ببيانات تجريبية.', confirmLabel: 'تحميل', onConfirm: () => st().resetData(true) })}>
          <Sparkles /> تحميل
        </button>
      </Row>
      <Row t="مسح كل البيانات" d="البدء من جديد بصفحة فارغة (الإعدادات تبقى)">
        <button className="btn btn-sm btn-danger" onClick={() => confirm({ title: 'مسح كل البيانات', body: 'سيتم حذف كل المهام والأهداف والعادات والإنجازات. لا يمكن التراجع.', danger: true, confirmLabel: 'مسح الكل', onConfirm: () => (st().resetData(false), st().toast('تم مسح البيانات')) })}>
          <Trash2 /> مسح
        </button>
      </Row>
    </>
  );
}
