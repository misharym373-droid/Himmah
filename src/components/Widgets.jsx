// بطاقات الصفحة الرئيسية (Dashboard)
import { useEffect, useMemo, useRef, useState } from 'react';
import { DndContext, closestCenter, PointerSensor, TouchSensor, KeyboardSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove, sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Sparkles, Play, Check, Clock, Flame, Star, Target, Trophy, Gift, Repeat, ChartColumn, Bot, Scale, Hourglass, Siren, Mic, ImagePlus, Zap,
  Brain, TrendingUp, ArrowLeft, CalendarDays, Plus, Lightbulb, X, Pause, CircleCheck, Rocket, ChartPie, Swords,
} from 'lucide-react';
import { useStore, goalProgress } from '../store.js';
import { navigate } from '../router.js';
import { Ring, Bar, Num, CardTitle, Empty, asset, CheckBox } from './ui.jsx';
import TaskItem, { DragHandle } from './TaskItem.jsx';
import { Bars, TimeLine, Donut } from './Charts.jsx';
import { formatLong, todayKey, formatDuration, formatHM, nowMin, toMin, fmt, addDays, DAYS_SHORT, fromKey, formatClock } from '../lib/date.js';
import { levelInfo, dayProgress, habitStreak, isOverdue } from '../lib/game.js';
import { suggestNow, studyPlan, postponeInsights, say } from '../lib/assistant.js';
import { weekBars, summary, balance, timeMachine } from '../lib/stats.js';

// ————— Hero —————
export function Hero() {
  const open = useStore((s) => s.openModal);
  const features = [
    [Sparkles, 'مهام ذكية'],
    [Star, 'XP ومستويات'],
    [ChartColumn, 'إحصائيات متقدمة'],
    [Bot, 'ذكاء اصطناعي'],
    [Scale, 'توازن الحياة'],
  ];
  return (
    <section className="hero reveal" aria-label="مرحبًا">
      <div className="hero-stars" />
      <div className="hero-mountains" aria-hidden>
        <svg viewBox="0 0 1200 300" preserveAspectRatio="none">
          <defs>
            <linearGradient id="m1" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#3b2a8f" />
              <stop offset="1" stopColor="#120e38" />
            </linearGradient>
            <linearGradient id="m2" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#1c1655" />
              <stop offset="1" stopColor="#0a0c24" />
            </linearGradient>
            <linearGradient id="lake" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#6d5cff" stopOpacity=".55" />
              <stop offset="1" stopColor="#0a0f24" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="glowLine" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="#3b82f6" stopOpacity="0" />
              <stop offset=".5" stopColor="#a78bfa" />
              <stop offset="1" stopColor="#3b82f6" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d="M0 190 L120 120 L210 160 L330 70 L450 150 L560 100 L680 170 L800 90 L930 150 L1040 80 L1200 160 L1200 215 L0 215Z" fill="url(#m1)" opacity=".9" />
          <path d="M0 200 L150 150 L260 185 L380 130 L520 190 L640 140 L760 195 L900 135 L1020 185 L1200 150 L1200 215 L0 215Z" fill="url(#m2)" />
          <rect x="0" y="213" width="1200" height="90" fill="url(#lake)" />
          <rect x="0" y="212" width="1200" height="2" fill="url(#glowLine)" />
          <path d="M0 215 L150 250 L260 228 L380 262 L520 222 L640 255 L760 220 L900 258 L1020 226 L1200 248 L1200 215Z" fill="#6d5cff" opacity=".12" />
        </svg>
      </div>
      <div className="hero-tile">
        <img src={asset('brand/icon.webp')} alt="" width="170" height="170" />
      </div>
      <div className="hero-content">
        <h1>
          رتّب يومك. <span className="grad-text">أنجز أكثر.</span> عش أفضل.
        </h1>
        <p>هّمة يجمع بين التنظيم والتحفيز والذكاء الاصطناعي لمساعدتك على تحقيق أهدافك مهما كانت كبيرة.</p>
        <div className="hero-cta">
          <button className="btn btn-primary btn-lg" onClick={() => open('interactive')}>
            جرّب التجربة التفاعلية <ArrowLeft />
          </button>
          <button className="btn btn-lg btn-glass" onClick={() => document.getElementById('daily')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>
            <Rocket /> ابدأ يومك
          </button>
        </div>
      </div>
      <div className="hero-features">
        {features.map(([I, l]) => (
          <span className="hero-feature" key={l}>
            <I /> {l}
          </span>
        ))}
      </div>
    </section>
  );
}

// ————— مستوى الطاقة —————
export function EnergyCheck({ compact }) {
  const energy = useStore((s) => s.energy[todayKey()]);
  const setEnergy = useStore((s) => s.setEnergy);
  const [edit, setEdit] = useState(false);
  const opts = [
    ['low', '😴', 'منخفضة'],
    ['mid', '😐', 'متوسطة'],
    ['high', '🔥', 'عالية'],
  ];
  if (energy && !edit) {
    const o = opts.find((x) => x[0] === energy);
    return (
      <button className="chip" onClick={() => setEdit(true)} title="تغيير مستوى الطاقة">
        {o[1]} طاقتك اليوم: {o[2]}
      </button>
    );
  }
  return (
    <div className={compact ? '' : 'card reveal'} style={compact ? {} : { padding: 18 }}>
      <div className="row between wrap" style={{ gap: 14 }}>
        <div>
          <div className="bold">كيف طاقتك اليوم؟</div>
          <div className="tiny muted">إذا كانت منخفضة نقترح مهامًا قصيرة، وإذا كانت عالية نقترح المهام الكبيرة</div>
        </div>
        <div className="row">
          {opts.map(([k, e, l]) => (
            <button key={k} className={`chip ${energy === k ? 'on' : ''}`} onClick={() => (setEnergy(k), setEdit(false))}>
              <span style={{ fontSize: '1.1rem' }}>{e}</span> {l}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ————— Daily progress —————
export function ProgressWidget() {
  const tasks = useStore((s) => s.tasks);
  const user = useStore((s) => s.user);
  const streak = useStore((s) => s.streak);
  const p = dayProgress(tasks.filter((t) => !t.template));
  const lv = levelInfo(user.totalXp);
  return (
    <div className="card span-12 reveal" id="daily">
      <div className="row between wrap mb" style={{ gap: 12 }}>
        <div>
          <div className="muted small bold">{formatLong(todayKey())}</div>
          <h2 style={{ fontSize: '1.5rem' }}>يومك اليوم</h2>
        </div>
        <EnergyCheck compact />
      </div>
      <div className="dash" style={{ marginTop: 0, alignItems: 'center' }}>
        <div className="span-4 r-6" style={{ display: 'flex', alignItems: 'center', gap: 20, justifyContent: 'center' }}>
          <Ring value={p.pct} size={170} stroke={14} id="dayRing">
            <div>
              <div className="xbold" style={{ fontSize: '2.4rem', lineHeight: 1 }}>
                <Num value={p.pct} format={(n) => Math.round(n) + '%'} />
              </div>
              <div className="tiny muted mt-s">من يومك مكتمل</div>
            </div>
          </Ring>
          <div className="col hide-mobile" style={{ gap: 6 }}>
            <div className="small">
              <span className="green xbold num">{p.done}</span> <span className="muted">مكتملة</span>
            </div>
            <div className="small">
              <span className="xbold num">{p.total - p.done}</span> <span className="muted">متبقية</span>
            </div>
          </div>
        </div>
        <div className="span-8 r-6 grid g3">
          <div className="mini-stat" style={{ textAlign: 'start' }}>
            <div className="row">
              <span style={{ fontSize: '1.8rem' }}>🔥</span>
              <div>
                <div className="v">
                  <Num value={streak.count} />
                </div>
                <div className="l">يوم متتالي</div>
              </div>
            </div>
            <StreakDots streak={streak} />
          </div>
          <div className="mini-stat" style={{ textAlign: 'start' }}>
            <div className="row">
              <span style={{ fontSize: '1.8rem' }}>⭐</span>
              <div>
                <div className="v">
                  <Num value={user.xp} /> <span className="small muted">XP</span>
                </div>
                <div className="l">رصيد النقاط</div>
              </div>
            </div>
            <button className="btn btn-xs btn-ghost mt-s" onClick={() => navigate('rewards')}>
              استبدل مكافأة <ArrowLeft />
            </button>
          </div>
          <div className="mini-stat" style={{ textAlign: 'start' }}>
            <div className="row between">
              <div>
                <div className="tiny muted bold" style={{ letterSpacing: 1 }}>LEVEL</div>
                <div className="v">
                  المستوى <Num value={lv.level} />
                </div>
              </div>
              <span className="badge purple num">{lv.pct}%</span>
            </div>
            <Bar value={lv.pct} className="mt-s" />
            <div className="tiny muted mt-s num">
              {fmt(lv.into)} / {fmt(lv.need)} XP
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StreakDots({ streak }) {
  const T = todayKey();
  return (
    <div className="week-dots mt-s">
      {Array.from({ length: 7 }).map((_, i) => {
        const d = addDays(T, i - 6);
        const on = streak.days?.[d];
        return (
          <div className="d" key={d} title={d}>
            <i className={on ? (d === T ? 'fire' : 'on') : d === T ? '' : 'miss'}>{on ? '✓' : d === T ? '•' : ''}</i>
            {DAYS_SHORT[fromKey(d).getDay()].slice(0, 2)}
          </div>
        );
      })}
    </div>
  );
}

// ————— إجراءات سريعة —————
export function QuickActions() {
  const open = useStore((s) => s.openModal);
  return (
    <div className="span-12 reveal d1">
      <div className="dash" style={{ marginTop: 0 }}>
        <div className="span-5">
          <button className="what-now" onClick={() => open('whatNow')}>
            <span className="wn-ico">
              <Brain size={24} />
            </span>
            <span className="grow">
              <span className="xbold" style={{ fontSize: '1.25rem', display: 'block' }}>وش أسوي الآن؟</span>
              <span className="small" style={{ color: '#c7d2fe' }}>تحليل الوقت والأولويات وطاقتك لاقتراح مهمة واحدة</span>
            </span>
            <ArrowLeft />
          </button>
        </div>
        <div className="span-7 quick-actions">
          <button className="qa red" onClick={() => open('rescue')}>
            <span className="qi">
              <Siren size={20} />
            </span>
            🚨 أنقذ يومي
          </button>
          <button className="qa gold" onClick={() => open('oneHour')}>
            <span className="qi">
              <Hourglass size={20} />
            </span>
            عندي ساعة فقط
          </button>
          <button className="qa purple" onClick={() => open('voice')}>
            <span className="qi">
              <Mic size={20} />
            </span>
            إضافة بالصوت
          </button>
          <button className="qa blue" onClick={() => open('image')}>
            <span className="qi">
              <ImagePlus size={20} />
            </span>
            مهمة من صورة
          </button>
        </div>
      </div>
    </div>
  );
}

// ————— تنبيهات ذكية (ذاكرة المهام + المتأخرة) —————
export function Insights() {
  const state = useStore();
  const insights = postponeInsights(state);
  const overdue = state.tasks.filter((t) => isOverdue(t));
  const open = state.openModal;
  if (!insights.length && !overdue.length) return null;
  const ins = insights[0];
  return (
    <div className="span-12 grid g2 reveal d2">
      {overdue.length > 0 && (
        <div className="card tight" style={{ borderColor: 'rgba(248,113,113,.35)' }}>
          <div className="row between wrap">
            <div className="row">
              <span className="card-title">
                <span className="ico red">
                  <Clock size={18} />
                </span>
              </span>
              <div>
                <div className="bold">{overdue.length} مهام تحتاج قرارك</div>
                <div className="tiny muted ellipsis" style={{ maxWidth: 280 }}>{overdue.map((t) => t.title).join('، ')}</div>
              </div>
            </div>
            <button className="btn btn-sm" onClick={() => open('reschedule', { id: overdue[0].id })}>
              أعد التخطيط
            </button>
          </div>
        </div>
      )}
      {ins && (
        <div className="card tight" style={{ borderColor: 'rgba(251,191,36,.35)' }}>
          <div className="row between wrap" style={{ alignItems: 'flex-start' }}>
            <div className="row grow" style={{ alignItems: 'flex-start' }}>
              <span className="card-title">
                <span className="ico gold">
                  <Lightbulb size={18} />
                </span>
              </span>
              <div className="grow">
                <div className="bold small">لاحظنا أنك غالبًا تؤجل مهام "{ins.key}"</div>
                <div className="tiny muted">هل تريد تقسيمها إلى خطوات أصغر؟</div>
              </div>
            </div>
            <div className="row">
              {!ins.sample.done && !ins.sample.deletedAt && (
                <button className="btn btn-xs btn-primary" onClick={() => open('task', { task: ins.sample })}>
                  قسّمها
                </button>
              )}
              <button className="icon-btn sm plain" aria-label="تجاهل" onClick={() => state.dismissInsight(ins.key)}>
                <X />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ————— أهم مهمة الآن —————
export function TopTaskWidget() {
  const state = useStore();
  const { focus, startFocus, completeTask, openModal, minimizeFocus, pauseFocus, resumeFocus } = state;
  const r = suggestNow(state);
  const focusTask = focus ? state.tasks.find((t) => t.id === focus.taskId) : null;
  const task = focusTask || r.task;
  const [, tick] = useState(0);
  useEffect(() => {
    if (!focus?.running) return;
    const t = setInterval(() => tick((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, [focus?.running]);
  if (!task)
    return (
      <div className="card span-5 reveal d2 focus-card">
        <CardTitle icon={<Zap size={18} />}>أهم مهمة الآن</CardTitle>
        <Empty icon={<Sparkles />} title="يومك جاهز لك." text="أضف أول مهمة وابدأ." action={<button className="btn btn-primary" onClick={() => openModal('task')}><Plus /> إضافة مهمة</button>} />
      </div>
    );
  const running = focus && focus.taskId === task.id;
  const remaining = running ? (focus.running ? Math.max(0, (focus.endAt - Date.now()) / 1000) : focus.remainingSec) : 0;
  return (
    <div className={`card span-5 reveal d2 focus-card glow ${running ? 'running' : ''}`}>
      <div className="card-hd">
        <CardTitle icon={<Zap size={18} />}>أهم مهمة الآن</CardTitle>
        {running ? (
          <span className="badge green">
            <span className="pulse-dot" /> قيد التركيز
          </span>
        ) : (
          r.reasons?.[0] && <span className="badge purple">{r.reasons[0]}</span>
        )}
      </div>
      <div className="row" style={{ gap: 16 }}>
        <span style={{ fontSize: '2.6rem', width: 72, height: 72, display: 'grid', placeItems: 'center', borderRadius: 22, background: 'rgba(var(--primary-rgb),.14)', border: '1px solid rgba(var(--primary-rgb),.3)', flexShrink: 0 }}>
          {task.icon}
        </span>
        <div className="grow">
          <h3 style={{ fontSize: '1.35rem' }}>{task.title}</h3>
          <div className="muted small row" style={{ gap: 12 }}>
            <span>
              <Clock size={14} style={{ verticalAlign: -2 }} /> {formatDuration(task.duration)}
            </span>
            {task.time && <span className="num">{task.time}</span>}
          </div>
        </div>
      </div>
      {running ? (
        <>
          <div className="xbold num mt" style={{ fontSize: '2.6rem', textAlign: 'center', textShadow: '0 0 30px rgba(52,211,153,.5)' }}>{formatClock(remaining)}</div>
          <Bar value={100 - (remaining / focus.totalSec) * 100} variant="green" />
          <div className="row mt wrap">
            <button className="btn btn-sm" onClick={() => (focus.running ? pauseFocus() : resumeFocus())}>
              {focus.running ? <Pause /> : <Play />} {focus.running ? 'إيقاف مؤقت' : 'استئناف'}
            </button>
            <button className="btn btn-sm" onClick={() => minimizeFocus(false)}>
              وضع التركيز الكامل
            </button>
            <button className="btn btn-sm btn-green" onClick={() => state.endFocus(true)}>
              <CircleCheck /> تم الإنجاز
            </button>
          </div>
        </>
      ) : (
        <div className="row mt wrap">
          <button className="btn btn-primary grow" onClick={() => startFocus(task.id)}>
            <Play /> ابدأ الآن
          </button>
          <button className="btn" onClick={() => completeTask(task.id)} title="إكمال">
            <Check /> إكمال
          </button>
          <button className="btn btn-ghost" onClick={() => openModal('reschedule', { id: task.id })}>
            تأجيل
          </button>
        </div>
      )}
    </div>
  );
}

// ————— خريطة اليوم (Drag & Drop) —————
function SortableTask({ task, current }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className={isDragging ? 'dragging' : ''}>
      <TaskItem task={task} current={current} compact dragHandle={<DragHandle {...attributes} {...listeners} />} />
    </div>
  );
}

export function DayMap({ span = 'span-7', date = todayKey(), title = 'خريطة اليوم' }) {
  const tasks = useStore((s) => s.tasks);
  const reorder = useStore((s) => s.reorderDay);
  const open = useStore((s) => s.openModal);
  const list = useMemo(
    () =>
      tasks
        .filter((t) => !t.deletedAt && !t.template && t.date === date)
        .sort((a, b) => (toMin(a.time) ?? 9999) - (toMin(b.time) ?? 9999)),
    [tasks, date]
  );
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );
  const scroller = useRef(null);
  useEffect(() => {
    const el = scroller.current?.querySelector('[data-next="1"]');
    if (el && scroller.current) scroller.current.scrollTop = Math.max(0, el.offsetTop - 12);
  }, [date]);
  const now = nowMin();
  const currentId = date === todayKey() ? list.find((t) => !t.done && t.time && toMin(t.time) <= now && toMin(t.time) + t.duration > now)?.id : null;
  function onEnd({ active, over }) {
    if (!over || active.id === over.id) return;
    const ids = list.map((t) => t.id);
    const next = arrayMove(ids, ids.indexOf(active.id), ids.indexOf(over.id));
    reorder(date, next);
    useStore.getState().toast('تمت إعادة ترتيب الجدول تلقائيًا ✨', { icon: 'sparkles' });
  }
  return (
    <div className={`card ${span} reveal d3`} id="day-map">
      <div className="card-hd">
        <CardTitle icon={<CalendarDays size={18} />} color="blue" sub={list.length ? 'اسحب المهام لإعادة ترتيبها — الأوقات تتحدث تلقائيًا' : null}>
          {title}
        </CardTitle>
        <div className="row">
          <button className="btn btn-sm btn-ghost hide-mobile" onClick={() => navigate('schedule')}>
            الجدول الكامل
          </button>
          <button className="icon-btn sm primary" onClick={() => open('task', { preset: { date } })} aria-label="إضافة مهمة">
            <Plus />
          </button>
        </div>
      </div>
      {!list.length ? (
        <Empty icon={<CalendarDays />} title="يومك جاهز لك." text="أضف أول مهمة وابدأ." action={<button className="btn btn-primary" onClick={() => open('task', { preset: { date } })}><Plus /> إضافة مهمة</button>} />
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onEnd}>
          <SortableContext items={list.map((t) => t.id)} strategy={verticalListSortingStrategy}>
            <div className="timeline" ref={scroller} style={{ maxHeight: 560, overflowY: 'auto', paddingInlineEnd: 4 }}>
              {list.map((t) => (
                <div className={`tl-row ${t.id === currentId ? 'now' : ''}`} key={t.id} data-next={t.id === list.find((x) => !x.done)?.id ? '1' : undefined}>
                  <div className="tl-time">{t.time || '—'}</div>
                  <SortableTask task={t} current={t.id === currentId} />
                </div>
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
}

// ————— الأهداف + التحديات + العادات —————
export function TrioWidget() {
  const goals = useStore((s) => s.goals);
  const tasks = useStore((s) => s.tasks);
  const challenges = useStore((s) => s.challenges);
  const habits = useStore((s) => s.habits);
  const logHabit = useStore((s) => s.logHabit);
  const T = todayKey();
  return (
    <>
      <div className="card span-4 r-6 reveal d1">
        <div className="card-hd">
          <CardTitle icon={<Target size={18} />}>أهدافي</CardTitle>
          <button className="btn btn-xs btn-ghost" onClick={() => navigate('goals')}>
            الكل <ArrowLeft />
          </button>
        </div>
        {!goals.length ? (
          <Empty icon={<Target />} title="ما الشيء الذي تريد الوصول إليه؟" action={<button className="btn btn-sm btn-primary" onClick={() => navigate('goals?new=1')}>إنشاء هدف</button>} />
        ) : (
          <div className="col" style={{ gap: 16 }}>
            {goals.slice(0, 3).map((g) => {
              const p = goalProgress(g, tasks);
              return (
                <button key={g.id} className="col" style={{ gap: 6, textAlign: 'start' }} onClick={() => navigate('goals')}>
                  <div className="row between">
                    <span className="bold small ellipsis">
                      {g.icon} {g.title}
                    </span>
                    <span className="purple xbold small num">{p}%</span>
                  </div>
                  <Bar value={p} />
                </button>
              );
            })}
          </div>
        )}
      </div>
      <div className="card span-4 r-6 reveal d2">
        <div className="card-hd">
          <CardTitle icon={<Swords size={18} />} color="gold">التحديات</CardTitle>
          <button className="btn btn-xs btn-ghost" onClick={() => navigate('achievements?tab=challenges')}>
            الكل <ArrowLeft />
          </button>
        </div>
        {!challenges.length ? (
          <Empty icon={<Trophy />} title="ابدأ تحديًا جديدًا" action={<button className="btn btn-sm btn-primary" onClick={() => navigate('achievements?tab=challenges')}>تحدياتي</button>} />
        ) : (
          <div className="col" style={{ gap: 14 }}>
            {challenges.slice(0, 3).map((c) => {
              const d = Object.values(c.log).filter(Boolean).length;
              return (
                <div key={c.id} className="col" style={{ gap: 6 }}>
                  <div className="row between">
                    <span className="bold small ellipsis">
                      {c.icon} {c.title}
                    </span>
                    <span className="tiny muted num">
                      {Math.min(d, c.days)}/{c.days}
                    </span>
                  </div>
                  <Bar value={(d / c.days) * 100} variant="gold" className="thin" />
                </div>
              );
            })}
          </div>
        )}
      </div>
      <div className="card span-4 r-6 reveal d3">
        <div className="card-hd">
          <CardTitle icon={<Repeat size={18} />} color="green">العادات</CardTitle>
          <button className="btn btn-xs btn-ghost" onClick={() => navigate('habits')}>
            الكل <ArrowLeft />
          </button>
        </div>
        {!habits.length ? (
          <Empty icon={<Repeat />} title="ابنِ أول عادة" action={<button className="btn btn-sm btn-primary" onClick={() => navigate('habits')}>عاداتي</button>} />
        ) : (
          <div className="col" style={{ gap: 10 }}>
            {habits.slice(0, 4).map((h) => {
              const v = h.log[T] || 0;
              const done = v >= h.target;
              return (
                <div key={h.id} className="row">
                  <span style={{ fontSize: '1.2rem' }}>{h.icon}</span>
                  <div className="grow">
                    <div className="row between">
                      <span className="small bold">{h.title}</span>
                      <span className="tiny muted num">
                        {h.target > 1 ? `${v}/${h.target}` : ''} 🔥{habitStreak(h)}
                      </span>
                    </div>
                    {h.target > 1 && <Bar value={(v / h.target) * 100} variant="blue" className="thin mt-s" />}
                  </div>
                  <CheckBox round on={done} onChange={() => logHabit(h.id, T, done ? -h.target : 1)} label={h.title} />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}

// ————— الإحصائيات المختصرة —————
export function StatsWidget() {
  const tasks = useStore((s) => s.tasks);
  const focusLog = useStore((s) => s.focusLog);
  const s = summary(tasks, focusLog, 7);
  const bars = weekBars(tasks);
  return (
    <div className="card span-12 reveal">
      <div className="card-hd">
        <CardTitle icon={<ChartColumn size={18} />} color="blue">إحصائياتك — آخر 7 أيام</CardTitle>
        <button className="btn btn-xs btn-ghost" onClick={() => navigate('stats')}>
          التفاصيل <ArrowLeft />
        </button>
      </div>
      <div className="dash" style={{ marginTop: 0, alignItems: 'center' }}>
        <div className="span-3 r-6" style={{ display: 'grid', placeItems: 'center' }}>
          <Ring value={s.rate} size={140} stroke={12} id="rateRing">
            <div>
              <div className="xbold" style={{ fontSize: '1.9rem' }}>
                <Num value={s.rate} format={(n) => Math.round(n) + '%'} />
              </div>
              <div className="tiny muted">نسبة الإنجاز</div>
            </div>
          </Ring>
        </div>
        <div className="span-4 r-6 grid g2" style={{ gap: 10 }}>
          <div className="mini-stat">
            <div className="v purple"><Num value={s.total} /></div>
            <div className="l">إجمالي المهام</div>
          </div>
          <div className="mini-stat">
            <div className="v green"><Num value={s.done} /></div>
            <div className="l">مهام مكتملة</div>
          </div>
          <div className="mini-stat">
            <div className="v num">{formatHM(s.focusToday)}</div>
            <div className="l">ساعات التركيز اليوم</div>
          </div>
          <div className="mini-stat">
            <div className="v num" style={{ fontSize: '1.05rem', paddingTop: 6 }}>{s.bestWindow}</div>
            <div className="l">أفضل وقت</div>
          </div>
        </div>
        <div className="span-5">
          <Bars data={bars} />
        </div>
      </div>
    </div>
  );
}

// ————— XP + Streak + المكافآت —————
export function XpWidget() {
  const user = useStore((s) => s.user);
  const streak = useStore((s) => s.streak);
  const rewards = useStore((s) => s.rewards);
  const tasks = useStore((s) => s.tasks);
  const lv = levelInfo(user.totalXp);
  const T = todayKey();
  const p = dayProgress(tasks.filter((t) => !t.template));
  const atRisk = streak.lastDate !== T && new Date().getHours() >= 17 && p.total > 0;
  return (
    <>
      <div className="card span-4 r-6 reveal">
        <CardTitle icon={<Star size={18} />}>المستوى و XP</CardTitle>
        <div className="row mt" style={{ gap: 18 }}>
          <div className="lvl-ring num" style={{ width: 86, height: 86, fontSize: '1.9rem', margin: 0, flexShrink: 0 }}>{lv.level}</div>
          <div className="grow">
            <div className="tiny muted bold" style={{ letterSpacing: 1 }}>LEVEL {lv.level}</div>
            <div className="xbold" style={{ fontSize: '1.4rem' }}>
              <Num value={user.totalXp} /> <span className="small muted">XP إجمالي</span>
            </div>
            <Bar value={lv.pct} className="mt-s" />
            <div className="tiny muted mt-s">
              باقي <span className="num">{fmt(lv.need - lv.into)}</span> XP للمستوى {lv.level + 1}
            </div>
          </div>
        </div>
        <div className="tiny muted mt">صغيرة +20 · متوسطة +50 · كبيرة +100 XP</div>
      </div>
      <div className="card span-4 r-6 reveal d1" style={atRisk ? { borderColor: 'rgba(251,191,36,.45)' } : {}}>
        <CardTitle icon={<Flame size={18} />} color="gold">الـStreak</CardTitle>
        <div className="row mt" style={{ gap: 14 }}>
          <span style={{ fontSize: '3rem', filter: 'drop-shadow(0 0 16px #f97316)' }}>🔥</span>
          <div>
            <div className="xbold" style={{ fontSize: '2rem', lineHeight: 1 }}>
              <Num value={streak.count} /> <span className="small muted">يوم متتالي</span>
            </div>
            <div className="tiny muted mt-s">أفضل سلسلة: <span className="num">{streak.best || streak.count}</span> يوم</div>
          </div>
        </div>
        <StreakDots streak={streak} />
        {atRisk && <div className="small gold mt bold">⚠️ أكمل مهام اليوم للحفاظ على الـStreak!</div>}
        {streak.lastDate === T && <div className="small green mt bold">✓ حافظت على الـStreak اليوم</div>}
      </div>
      <div className="card span-4 r-6 reveal d2">
        <div className="card-hd">
          <CardTitle icon={<Gift size={18} />} color="green">المكافآت</CardTitle>
          <span className="badge purple num">{fmt(user.xp)} XP</span>
        </div>
        <div className="grid g2" style={{ gap: 10 }}>
          {rewards.slice(0, 4).map((r) => (
            <button key={r.id} className="mini-stat" onClick={() => navigate('rewards')} style={{ opacity: user.xp >= r.cost ? 1 : 0.55 }}>
              <div style={{ fontSize: '1.6rem' }}>{r.icon}</div>
              <div className="small bold ellipsis">{r.title}</div>
              <div className="tiny purple num">{fmt(r.cost)} XP</div>
            </button>
          ))}
        </div>
      </div>
    </>
  );
}

// ————— مساعد هّمة الذكي —————
export function AIWidget() {
  const setDrawer = useStore((s) => s.setDrawer);
  const createStudyPlan = useStore((s) => s.createStudyPlan);
  const persona = useStore((s) => s.settings.persona);
  const [text, setText] = useState('عندي اختبار بعد 5 أيام وأحتاج أذاكر 4 فصول.');
  const [plan, setPlan] = useState(null);
  const [thinking, setThinking] = useState(false);
  const [saved, setSaved] = useState(false);
  function build() {
    if (!text.trim()) return;
    setThinking(true);
    setSaved(false);
    setTimeout(() => {
      setPlan(studyPlan(text));
      setThinking(false);
    }, 800);
  }
  return (
    <div className="card span-12 reveal glow">
      <div className="dash" style={{ marginTop: 0, alignItems: 'center' }}>
        <div className="span-4 col" style={{ alignItems: 'center', textAlign: 'center' }}>
          <div className="ai-orb">
            <Bot />
          </div>
          <h3 style={{ fontSize: '1.3rem' }}>مساعد هّمة الذكي</h3>
          <p className="muted small">{say(persona, 'hi')} اكتب وضعك وأنا أبني لك الخطة.</p>
          <button className="btn btn-sm" onClick={() => setDrawer('assistant')}>
            <Sparkles /> اسأل هّمة
          </button>
        </div>
        <div className="span-8">
          <div className="quick" style={{ maxWidth: 'none' }}>
            <Sparkles size={18} className="spark" />
            <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && build()} aria-label="اكتب وضعك للمساعد" placeholder="عندي اختبار بعد 5 أيام وأحتاج أذاكر 4 فصول" />
            <button className="btn btn-sm btn-primary" onClick={build}>
              إنشاء الخطة
            </button>
          </div>
          {thinking && (
            <div className="row mt">
              <span className="typing">
                <i />
                <i />
                <i />
              </span>
              <span className="small muted">أبني خطتك…</span>
            </div>
          )}
          {plan && !thinking && (
            <div className="mt onb-step">
              <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(150px,1fr))', gap: 10 }}>
                {plan.plan.map((d, i) => (
                  <div key={d.day} className="mini-stat reveal" style={{ textAlign: 'start', animationDelay: `${i * 0.07}s` }}>
                    <div className="tiny purple bold">اليوم {d.day}</div>
                    <div className="small bold">{d.title}</div>
                    <div className="tiny muted">{DAYS_SHORT[fromKey(d.date).getDay()]} · 18:00</div>
                  </div>
                ))}
              </div>
              <div className="row mt">
                <button className="btn btn-primary btn-sm" disabled={saved} onClick={() => (createStudyPlan(plan, plan.subject), setSaved(true))}>
                  {saved ? <><Check /> تمت الإضافة للجدول</> : <><Plus /> أضف الخطة لجدولي</>}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ————— توازن الحياة —————
export function BalanceWidget({ span = 'span-6' }) {
  const tasks = useStore((s) => s.tasks);
  const data = balance(tasks);
  return (
    <div className={`card ${span} reveal`}>
      <CardTitle icon={<ChartPie size={18} />} sub="توزيع وقتك على مجالات حياتك — آخر 30 يوم">
        توازن حياتي
      </CardTitle>
      <div className="row mt wrap" style={{ gap: 24, justifyContent: 'center' }}>
        <Donut data={data} />
        <div className="col grow" style={{ minWidth: 200, gap: 10 }}>
          {data.map((d) => (
            <div className="legend-row" key={d.key}>
              <span className="swatch" style={{ background: d.color, boxShadow: `0 0 8px ${d.color}` }} />
              <span className="small">
                {d.emoji} {d.label}
              </span>
              <span className="small xbold num">{d.pct}%</span>
              <span />
              <div className="bar thin" style={{ gridColumn: '2 / 4' }}>
                <i style={{ width: `${d.pct}%`, background: d.color, boxShadow: `0 0 10px ${d.color}` }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ————— آلة الزمن —————
export function TimeMachineWidget({ span = 'span-6' }) {
  const tasks = useStore((s) => s.tasks);
  const tm = timeMachine(tasks);
  return (
    <div className={`card ${span} reveal d1`}>
      <CardTitle icon={<Hourglass size={18} />} color="blue" sub="مستقبلك يبدأ من اليوم">
        آلة الزمن
      </CardTitle>
      <div className="grid g3 mt" style={{ gap: 10, gridTemplateColumns: 'repeat(3,minmax(0,1fr))' }}>
        <div className="mini-stat">
          <div className="l">قبل 30 يوم</div>
          <div className="v"><Num value={tm.past30} /></div>
          <div className="l">مهمة</div>
        </div>
        <div className="mini-stat" style={{ borderColor: 'rgba(var(--primary-rgb),.5)' }}>
          <div className="l purple bold">اليوم</div>
          <div className="v"><Num value={tm.today} /></div>
          <div className="l">مهام</div>
        </div>
        <div className="mini-stat">
          <div className="l">بعد 30 يوم</div>
          <div className="v blue"><Num value={tm.future} /></div>
          <div className="l">مهمة</div>
        </div>
      </div>
      <div className="mt">
        <TimeLine series={tm.series} proj={tm.proj} />
      </div>
      <p className="tiny muted" style={{ textAlign: 'center' }}>
        إذا استمريت بنفس المعدل (<span className="num">{tm.rate.toFixed(1)}</span> مهمة/يوم) ستصل إلى <b className="num">{tm.future}</b> مهمة مكتملة
      </p>
    </div>
  );
}

