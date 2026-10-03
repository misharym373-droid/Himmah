// بطاقات الصفحة الرئيسية — الأساسية في الأعلى، والتفاصيل في أقسام قابلة للطي
import { useEffect, useMemo, useRef, useState } from 'react';
import { DndContext, closestCenter, PointerSensor, TouchSensor, KeyboardSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove, sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Sparkles, Play, Check, Clock, Flame, Target, Repeat, ChartColumn, Bot, Hourglass, Siren, ImagePlus, Brain, ArrowLeft, CalendarDays,
  Plus, Lightbulb, X, Pause, CircleCheck, ChartPie, Swords, ChevronDown, Timer, ListTodo, Sunset, BatteryLow, BatteryMedium, BatteryFull,
  Maximize2, TriangleAlert,
} from 'lucide-react';
import { useStore, goalProgress } from '../store.js';
import { useAssistantState, useToday } from '../hooks.js';
import { navigate } from '../router.js';
import { Ring, Bar, Num, CardTitle, Empty, CheckBox } from './ui.jsx';
import { Glyph, IconTile } from './Glyph.jsx';
import TaskItem, { DragHandle, PostponeMenu } from './TaskItem.jsx';
import { Bars, TimeLine, Donut } from './Charts.jsx';
import { formatLong, todayKey, formatDuration, formatHM, nowMin, toMin, fmt, addDays, DAYS_SHORT, fromKey, formatClock } from '../lib/date.js';
import { levelInfo, habitStreak, isOverdue } from '../lib/game.js';
import { scoreTask, studyPlan, postponeInsights, say } from '../lib/assistant.js';
import { weekBars, summary, balance, timeMachine } from '../lib/stats.js';
import { ENERGY, AREAS } from '../config.js';

const ENERGY_ICONS = { low: BatteryLow, mid: BatteryMedium, high: BatteryFull };

// ————— قسم قابل للطي (يتذكر حالته على هذا الجهاز) —————
export function Collapsible({ id, title, icon, hint, defaultOpen = false, children }) {
  const key = `himmah:ui:open:${id}`;
  const [open, setOpen] = useState(() => {
    try {
      const v = localStorage.getItem(key);
      return v == null ? defaultOpen : v === '1';
    } catch {
      return defaultOpen;
    }
  });
  const toggle = () => {
    setOpen(!open);
    try {
      localStorage.setItem(key, open ? '0' : '1');
    } catch (e) {
      // ميزة ثانوية غير متاحة في هذا المتصفح — لا توقف التطبيق
      console.warn('[himmah:widget-state]', e?.message || e);
    }
  };
  return (
    <section className={`collapsible span-12 ${open ? 'open' : ''}`} aria-labelledby={`col-${id}`}>
      <button className="col-head" onClick={toggle} aria-expanded={open} aria-controls={`col-body-${id}`} id={`col-${id}`}>
        <span className="col-ico" aria-hidden>{icon}</span>
        <span className="grow" style={{ textAlign: 'start' }}>
          <span className="bold">{title}</span>
          {hint && <span className="tiny muted col-hint">{hint}</span>}
        </span>
        <ChevronDown size={18} className="col-chev" aria-hidden />
      </button>
      {open && (
        <div className="dash col-body" id={`col-body-${id}`}>
          {children}
        </div>
      )}
    </section>
  );
}

// ————— مستوى الطاقة —————
export function EnergyCheck() {
  const energy = useStore((s) => s.energy[todayKey()]);
  const setEnergy = useStore((s) => s.setEnergy);
  const [edit, setEdit] = useState(false);
  if (energy && !edit) {
    const I = ENERGY_ICONS[energy];
    return (
      <button className="chip" onClick={() => setEdit(true)} title="تغيير مستوى الطاقة" aria-label={`طاقتك اليوم ${ENERGY[energy].label} — تغيير`}>
        <I size={16} /> طاقتك: {ENERGY[energy].label}
      </button>
    );
  }
  return (
    <div className="energy-pick" role="radiogroup" aria-label="كيف طاقتك اليوم؟">
      <span className="small muted bold">كيف طاقتك اليوم؟</span>
      {Object.entries(ENERGY).map(([k, e]) => {
        const I = ENERGY_ICONS[k];
        return (
          <button key={k} role="radio" aria-checked={energy === k} className={`chip ${energy === k ? 'on' : ''}`} onClick={() => (setEnergy(k), setEdit(false))} title={e.hint}>
            <I size={16} /> {e.label}
          </button>
        );
      })}
    </div>
  );
}

// ————— 1) الترحيب + الإدخال الذكي + الإجراءات السريعة —————
export function Greeting({ input }) {
  const name = useStore((s) => s.profile.name);
  const open = useStore((s) => s.openModal);
  const { progress, dayLeft } = useToday();
  const h = new Date().getHours();
  const hello = h < 12 ? 'صباح الخير' : h < 18 ? 'مساء الخير' : 'مساء النور';
  const actions = [
    [Siren, 'أنقذ يومي', () => open('rescue'), 'red'],
    [Hourglass, 'عندي ساعة فقط', () => open('oneHour'), 'gold'],
    [ImagePlus, 'مهمة من صورة', () => open('image'), 'blue'],
  ];
  return (
    <section className="greeting span-12 reveal" aria-label="الترحيب">
      <div className="greet-top">
        <div>
          <p className="small muted bold">{formatLong(todayKey())}</p>
          <h1 className="greet-title">
            {hello}
            {name ? `، ${name}` : ''}
          </h1>
          <p className="greet-sub">
            {progress.total ? (
              <>
                أنجزت <b className="num">{progress.done}</b> من <b className="num">{progress.total}</b> مهام
                {dayLeft > 0 && (
                  <>
                    {' '}· باقي <b>{formatDuration(dayLeft)}</b> من يومك
                  </>
                )}
              </>
            ) : (
              'يومك فاضي — اكتب ما عندك ومسار يرتبه لك.'
            )}
          </p>
        </div>
        <EnergyCheck />
      </div>
      {input}
      <div className="greet-actions">
        <button className="btn btn-primary btn-sm" onClick={() => open('whatNow')}>
          <Brain /> وش أسوي الآن؟
        </button>
        {actions.map(([I, l, run, c]) => (
          <button key={l} className={`btn btn-sm btn-ghost tone-${c}`} onClick={run}>
            <I /> {l}
          </button>
        ))}
        <button className="btn btn-sm btn-ghost" onClick={() => open('interactive')}>
          <Sparkles /> التجربة التفاعلية
        </button>
      </div>
    </section>
  );
}

// ————— 2) ملخص اليوم + 5) نسبة الإنجاز —————
export function SummaryStrip() {
  const { progress, dayLeft, openMinutes } = useToday();
  const streak = useStore((s) => s.streak);
  const focusLog = useStore((s) => s.focusLog);
  const T = todayKey();
  const focusToday = useMemo(() => focusLog.filter((f) => f.date === T).reduce((a, f) => a + f.minutes, 0), [focusLog, T]);
  const tight = openMinutes > dayLeft && dayLeft > 0;
  return (
    <section className="summary span-12 reveal d1" aria-label="ملخص اليوم">
      <div className="sum-tile sum-ring">
        <Ring value={progress.pct} size={76} stroke={8} id="dayRing">
          <span className="xbold num" style={{ fontSize: '1.1rem' }}>{progress.pct}%</span>
        </Ring>
        <div>
          <div className="sum-l">إنجاز اليوم</div>
          <div className="sum-v">
            <Num value={progress.done} /> <span className="muted small">/ {progress.total} مهام</span>
          </div>
        </div>
      </div>
      <div className={`sum-tile ${tight ? 'warn' : ''}`}>
        <IconTile name="sunrise" color={tight ? 'var(--gold)' : 'var(--blue)'} size={40} />
        <div>
          <div className="sum-l">باقي من يومك</div>
          <div className="sum-v">{dayLeft ? formatDuration(dayLeft) : 'انتهى اليوم'}</div>
          <div className="tiny muted">{openMinutes ? `مهامك المتبقية تحتاج ${formatDuration(openMinutes)}` : 'لا مهام متبقية'}</div>
        </div>
      </div>
      <div className="sum-tile">
        <IconTile name="zap" color="var(--green)" size={40} />
        <div>
          <div className="sum-l">تركيز اليوم</div>
          <div className="sum-v num">{formatHM(focusToday)}</div>
          <div className="tiny muted">ساعة:دقيقة</div>
        </div>
      </div>
      <div className="sum-tile">
        <IconTile name="flame" color="var(--gold)" size={40} />
        <div>
          <div className="sum-l">الـStreak</div>
          <div className="sum-v">
            <Num value={streak.count} /> <span className="muted small">يوم</span>
          </div>
          <div className="tiny muted">{streak.lastDate === T ? 'حافظت عليه اليوم' : 'أكمل يومك للحفاظ عليه'}</div>
        </div>
      </div>
    </section>
  );
}

// تنبيهات صغيرة: مهام متأخرة + ذاكرة التأجيل
export function Insights() {
  const tasks = useStore((s) => s.tasks);
  const dismissed = useStore((s) => s.dismissedInsights);
  const open = useStore((s) => s.openModal);
  const dismissInsight = useStore((s) => s.dismissInsight);
  const overdue = useMemo(() => tasks.filter((t) => isOverdue(t)), [tasks]);
  const ins = useMemo(() => postponeInsights({ tasks, dismissedInsights: dismissed })[0], [tasks, dismissed]);
  if (!ins && !overdue.length) return null;
  return (
    <div className="span-12 notices reveal d2">
      {overdue.length > 0 && (
        <div className="notice danger">
          <TriangleAlert size={18} aria-hidden />
          <span className="grow small">
            <b className="num">{overdue.length}</b> مهام متأخرة تحتاج قرارك: <span className="muted">{overdue.slice(0, 2).map((t) => t.title).join('، ')}</span>
          </span>
          <button className="btn btn-xs" onClick={() => open('reschedule', { id: overdue[0].id })}>
            أعد التخطيط
          </button>
        </div>
      )}
      {ins && (
        <div className="notice warn">
          <Lightbulb size={18} aria-hidden />
          <span className="grow small">لاحظنا أنك غالبًا تؤجل مهام "{ins.key}" — تقسيمها لخطوات أصغر يساعد.</span>
          {!ins.sample.done && !ins.sample.deletedAt && (
            <button className="btn btn-xs" onClick={() => open('task', { task: ins.sample })}>
              قسّمها
            </button>
          )}
          <button className="icon-btn sm plain" aria-label="تجاهل الاقتراح" onClick={() => dismissInsight(ins.key)}>
            <X />
          </button>
        </div>
      )}
    </div>
  );
}

// ترتيب مهام اليوم المفتوحة حسب الأهمية (أولوية + وقت + طاقة)
function useRankedOpen() {
  const state = useAssistantState();
  return useMemo(() => {
    const T = todayKey();
    return state.tasks
      .filter((t) => !t.deletedAt && !t.template && !t.done && (t.date === T || isOverdue(t)))
      .map((t) => ({ t, ...scoreTask(t, state) }))
      .sort((a, b) => b.score - a.score);
  }, [state]);
}

// ————— 3) أهم 3 مهام اليوم —————
export function TopThree({ span = 'span-7' }) {
  const ranked = useRankedOpen();
  const open = useStore((s) => s.openModal);
  const { progress } = useToday();
  const top = ranked.slice(0, 3);
  return (
    <div className={`card ${span} reveal d2`}>
      <div className="card-hd">
        <CardTitle icon={<ListTodo size={18} />} sub={top.length ? 'مرتبة حسب الأولوية والوقت وطاقتك' : null}>
          أهم 3 مهام اليوم
        </CardTitle>
        <button className="icon-btn sm primary" onClick={() => open('task')} aria-label="إضافة مهمة">
          <Plus />
        </button>
      </div>
      {!top.length ? (
        progress.total ? (
          <Empty icon={<CircleCheck />} title="أنجزت كل مهام اليوم" text="يوم ممتاز. خذ راحتك أو خطط لبكرة." />
        ) : (
          <Empty icon={<CalendarDays />} title="يومك جاهز لك." text="أضف أول مهمة وابدأ." action={<button className="btn btn-primary" onClick={() => open('task')}><Plus /> إضافة مهمة</button>} />
        )
      ) : (
        <div className="col" style={{ gap: 8 }}>
          {top.map(({ t, reasons }, i) => (
            <div key={t.id} className="rank-row">
              <span className="rank num" aria-hidden>{i + 1}</span>
              <div className="grow" style={{ minWidth: 0 }}>
                <TaskItem task={t} showDate={t.date !== todayKey()} />
                {reasons?.[0] && <div className="tiny muted rank-why">{reasons.join(' · ')}</div>}
              </div>
            </div>
          ))}
        </div>
      )}
      <button className="btn btn-ghost btn-sm mt" onClick={() => navigate('tasks')}>
        كل مهام اليوم ({progress.total}) <ArrowLeft />
      </button>
    </div>
  );
}

// ————— 4) المهمة القادمة / الجارية مع الوقت المتبقي —————
export function NextTask({ span = 'span-5' }) {
  const { current, next, minuteNow } = useToday();
  const pickFocus = useStore((s) => s.pickFocus);
  const complete = useStore((s) => s.completeTask);
  const open = useStore((s) => s.openModal);
  const task = current || next;
  if (!task)
    return (
      <div className={`card ${span} reveal d3`}>
        <CardTitle icon={<Clock size={18} />} color="blue">المهمة القادمة</CardTitle>
        <Empty icon={<Sunset />} title="لا توجد مهام مجدولة لاحقًا اليوم" text="أضف وقتًا لمهامك لتظهر هنا." action={<button className="btn btn-sm" onClick={() => open('task')}><Plus /> مهمة بوقت</button>} />
      </div>
    );
  const start = toMin(task.time);
  const isNow = task === current;
  const mins = isNow ? start + task.duration - minuteNow : start - minuteNow;
  const area = AREAS[task.area] || AREAS.work;
  return (
    <div className={`card ${span} reveal d3 next-card ${isNow ? 'is-now' : ''}`}>
      <div className="card-hd">
        <CardTitle icon={<Clock size={18} />} color="blue">{isNow ? 'جارية الآن' : 'المهمة القادمة'}</CardTitle>
        <span className={`badge ${isNow ? 'green' : 'blue'}`}>{isNow ? <><span className="pulse-dot" /> الآن</> : <span className="num">{task.time}</span>}</span>
      </div>
      <div className="row" style={{ gap: 14 }}>
        <IconTile name={task.icon} color={area.color} size={56} />
        <div className="grow" style={{ minWidth: 0 }}>
          <h3 className="ellipsis" style={{ fontSize: '1.25rem' }}>{task.title}</h3>
          <div className="small muted">
            <span className="num">{task.time}</span> · {formatDuration(task.duration)} · {area.label}
          </div>
        </div>
      </div>
      <div className="countdown">
        <span className="tiny muted bold">{isNow ? 'باقي على انتهائها' : 'تبدأ بعد'}</span>
        <span className="cd-v">{formatDuration(Math.max(1, mins))}</span>
      </div>
      <div className="row wrap">
        <button className="btn btn-primary grow" onClick={() => pickFocus(task.id)}>
          <Play /> ابدأ جلسة تركيز
        </button>
        <button className="btn" onClick={() => complete(task.id)}>
          <Check /> إكمال
        </button>
        <PostponeMenu taskId={task.id} />
      </div>
    </div>
  );
}

// ————— 6) اختصار الأهداف —————
export function GoalsShortcut({ span = 'span-7' }) {
  const goals = useStore((s) => s.goals);
  const tasks = useStore((s) => s.tasks);
  return (
    <div className={`card ${span} reveal`}>
      <div className="card-hd">
        <CardTitle icon={<Target size={18} />}>أهدافي</CardTitle>
        <button className="btn btn-xs btn-ghost" onClick={() => navigate('goals')}>
          كل الأهداف <ArrowLeft />
        </button>
      </div>
      {!goals.length ? (
        <Empty icon={<Target />} title="ما الشيء الذي تريد الوصول إليه؟" action={<button className="btn btn-sm btn-primary" onClick={() => navigate('goals?new=1')}>إنشاء هدف</button>} />
      ) : (
        <div className="col" style={{ gap: 14 }}>
          {goals.slice(0, 3).map((g) => {
            const p = goalProgress(g, tasks);
            const stage = g.milestones.find((m) => m.done < m.total);
            return (
              <button key={g.id} className="goal-row" onClick={() => navigate('goals')}>
                <IconTile name={g.icon} color={AREAS[g.area]?.color || 'var(--primary)'} size={40} />
                <span className="grow" style={{ minWidth: 0 }}>
                  <span className="row between">
                    <span className="bold small ellipsis">{g.title}</span>
                    <span className="purple xbold small num">{p}%</span>
                  </span>
                  <Bar value={p} className="thin" />
                  <span className="tiny muted ellipsis" style={{ display: 'block', marginTop: 4 }}>{stage ? `المرحلة الحالية: ${stage.title}` : 'كل المراحل مكتملة'}</span>
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ————— 7) التركيز —————
const FOCUS_TARGET = 120;
export function FocusCard({ span = 'span-5' }) {
  const ranked = useRankedOpen();
  const focus = useStore((s) => s.focus);
  const focusLog = useStore((s) => s.focusLog);
  const focusTask = useStore((s) => (s.focus ? s.tasks.find((t) => t.id === s.focus.taskId) : null));
  const { pickFocus, startFocus, pauseFocus, resumeFocus, minimizeFocus } = useStore.getState();
  const T = todayKey();
  const today = useMemo(() => focusLog.filter((f) => f.date === T), [focusLog, T]);
  const minutes = today.reduce((a, f) => a + f.minutes, 0);
  const [, tick] = useState(0);
  useEffect(() => {
    if (!focus?.running) return;
    const t = setInterval(() => tick((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, [focus?.running]);
  const suggested = ranked[0]?.t;
  const remaining = focus ? (focus.finished ? 0 : focus.running ? Math.max(0, (focus.endAt - Date.now()) / 1000) : focus.remainingSec) : 0;
  return (
    <div className={`card ${span} reveal ${focus ? 'focus-live' : ''}`}>
      <div className="card-hd">
        <CardTitle icon={<Timer size={18} />} color="green">التركيز</CardTitle>
        <span className="tiny muted">
          <span className="num">{today.length}</span> جلسات اليوم
        </span>
      </div>
      {focus ? (
        <>
          <div className="small muted ellipsis">{focusTask?.title || 'جلسة تركيز'}</div>
          <div className="focus-clock num">{formatClock(remaining)}</div>
          <Bar value={100 - (remaining / focus.totalSec) * 100} variant="green" />
          <div className="row mt wrap">
            {!focus.finished && (
              <button className="btn btn-sm" onClick={() => (focus.running ? pauseFocus() : resumeFocus())}>
                {focus.running ? <Pause /> : <Play />} {focus.running ? 'إيقاف مؤقت' : 'استئناف'}
              </button>
            )}
            <button className="btn btn-sm btn-primary" onClick={() => minimizeFocus(false)}>
              <Maximize2 /> وضع التركيز
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="row between">
            <div>
              <div className="sum-v num">{formatHM(minutes)}</div>
              <div className="tiny muted">
                من هدف <span className="num">{FOCUS_TARGET / 60}</span> ساعات تركيز يوميًا
              </div>
            </div>
            <Ring value={(minutes / FOCUS_TARGET) * 100} size={58} stroke={6} id="focusRing" color="var(--green)">
              <span className="tiny bold num">{Math.min(100, Math.round((minutes / FOCUS_TARGET) * 100))}%</span>
            </Ring>
          </div>
          {suggested ? (
            <>
              <div className="small mt">
                ابدأ على: <b>{suggested.title}</b>
              </div>
              <div className="row mt-s wrap">
                {[15, 25, 45].map((m) => (
                  <button key={m} className="btn btn-sm" onClick={() => startFocus(suggested.id, m)} aria-label={`جلسة ${m} دقيقة على ${suggested.title}`}>
                    <span className="num">{m}</span> د
                  </button>
                ))}
                <button className="btn btn-sm btn-ghost" onClick={() => pickFocus(suggested.id)}>
                  تخصيص
                </button>
              </div>
            </>
          ) : (
            <p className="small muted mt">لا توجد مهام مفتوحة للتركيز عليها الآن.</p>
          )}
        </>
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
  const list = useMemo(() => tasks.filter((t) => !t.deletedAt && !t.template && t.date === date).sort((a, b) => (toMin(a.time) ?? 9999) - (toMin(b.time) ?? 9999)), [tasks, date]);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );
  const scroller = useRef(null);
  useEffect(() => {
    const el = scroller.current?.querySelector('[data-next="1"]');
    if (el && scroller.current) scroller.current.scrollTop = Math.max(0, el.offsetTop - 12);
  }, [date]);
  const now = nowMin();
  const currentId = date === todayKey() ? list.find((t) => !t.done && t.time && toMin(t.time) <= now && toMin(t.time) + t.duration > now)?.id : null;
  const firstOpenId = list.find((x) => !x.done)?.id;
  function onEnd({ active, over }) {
    if (!over || active.id === over.id) return;
    const ids = list.map((t) => t.id);
    reorder(date, arrayMove(ids, ids.indexOf(active.id), ids.indexOf(over.id)));
    useStore.getState().toast('تمت إعادة ترتيب الجدول وتحديث الأوقات', { icon: 'sparkles' });
  }
  return (
    <div className={`card ${span} reveal`} id="day-map">
      <div className="card-hd">
        {title ? (
          <CardTitle icon={<CalendarDays size={18} />} color="blue" sub={list.length ? 'اسحب المهام لإعادة ترتيبها — الأوقات تتحدث تلقائيًا' : null}>
            {title}
          </CardTitle>
        ) : (
          <span className="small muted">{list.length ? 'اسحب المهام لإعادة ترتيبها — الأوقات تتحدث تلقائيًا' : ''}</span>
        )}
        <div className="row">
          <button className="btn btn-sm btn-ghost hide-mobile" onClick={() => navigate('schedule')}>
            الجدول الكامل
          </button>
          <button className="icon-btn sm primary" onClick={() => open('task', { preset: { date } })} aria-label="إضافة مهمة لهذا اليوم">
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
                <div className={`tl-row ${t.id === currentId ? 'now' : ''}`} key={t.id} data-next={t.id === firstOpenId ? '1' : undefined}>
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

// ————— العادات + التحديات —————
export function HabitsWidget() {
  const challenges = useStore((s) => s.challenges);
  const habits = useStore((s) => s.habits);
  const logHabit = useStore((s) => s.logHabit);
  const T = todayKey();
  return (
    <>
      <div className="card span-6 reveal">
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
            {habits.slice(0, 5).map((h) => {
              const v = h.log[T] || 0;
              const done = v >= h.target;
              return (
                <div key={h.id} className="row">
                  <IconTile name={h.icon} color={h.color} size={34} />
                  <div className="grow">
                    <div className="row between">
                      <span className="small bold">{h.title}</span>
                      <span className="tiny muted num">
                        {h.target > 1 ? `${v}/${h.target} · ` : ''}
                        <Flame size={11} className="gold" style={{ verticalAlign: -1 }} /> {habitStreak(h)}
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
      <div className="card span-6 reveal d1">
        <div className="card-hd">
          <CardTitle icon={<Swords size={18} />} color="gold">التحديات</CardTitle>
          <button className="btn btn-xs btn-ghost" onClick={() => navigate('achievements?tab=challenges')}>
            الكل <ArrowLeft />
          </button>
        </div>
        {!challenges.length ? (
          <Empty icon={<Swords />} title="ابدأ تحديًا جديدًا" action={<button className="btn btn-sm btn-primary" onClick={() => navigate('achievements?tab=challenges')}>تحدياتي</button>} />
        ) : (
          <div className="col" style={{ gap: 14 }}>
            {challenges.slice(0, 4).map((c) => {
              const d = Object.values(c.log).filter(Boolean).length;
              return (
                <div key={c.id} className="col" style={{ gap: 6 }}>
                  <div className="row between">
                    <span className="bold small ellipsis row" style={{ gap: 6 }}>
                      <Glyph name={c.icon} size={15} className="gold" /> {c.title}
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
    </>
  );
}

// ————— الإحصائيات المختصرة —————
export function StatsWidget() {
  const tasks = useStore((s) => s.tasks);
  const focusLog = useStore((s) => s.focusLog);
  const s = useMemo(() => summary(tasks, focusLog, 7), [tasks, focusLog]);
  const bars = useMemo(() => weekBars(tasks), [tasks]);
  return (
    <div className="card span-12 reveal">
      <div className="card-hd">
        <CardTitle icon={<ChartColumn size={18} />} color="blue">آخر 7 أيام</CardTitle>
        <button className="btn btn-xs btn-ghost" onClick={() => navigate('stats')}>
          التفاصيل <ArrowLeft />
        </button>
      </div>
      <div className="dash" style={{ marginTop: 0, alignItems: 'center' }}>
        <div className="span-4 grid g2" style={{ gap: 10 }}>
          <div className="mini-stat">
            <div className="v green"><Num value={s.done} /></div>
            <div className="l">مهمة أنجزتها</div>
          </div>
          <div className="mini-stat">
            <div className="v purple num">{s.rate}%</div>
            <div className="l">نسبة الالتزام</div>
          </div>
          <div className="mini-stat">
            <div className="v num">{formatHM(s.focus)}</div>
            <div className="l">ساعات تركيز</div>
          </div>
          <div className="mini-stat">
            <div className="v num" style={{ fontSize: '1rem', paddingTop: 6 }}>{s.bestWindow}</div>
            <div className="l">أفضل وقت لك</div>
          </div>
        </div>
        <div className="span-8">
          <Bars data={bars} />
        </div>
      </div>
    </div>
  );
}

// ————— المستوى + Streak + المكافآت (مختصر) —————
export function XpWidget() {
  const user = useStore((s) => s.user);
  const streak = useStore((s) => s.streak);
  const rewards = useStore((s) => s.rewards);
  const lv = levelInfo(user.totalXp);
  const T = todayKey();
  const nextReward = useMemo(() => [...rewards].sort((a, b) => a.cost - b.cost).find((r) => r.cost > user.xp) || rewards[0], [rewards, user.xp]);
  return (
    <div className="card span-12 reveal">
      <div className="xp-strip">
        <div className="xp-cell">
          <span className="lvl-ring sm num">{lv.level}</span>
          <div className="grow">
            <div className="tiny muted bold">المستوى {lv.level}</div>
            <Bar value={lv.pct} className="mt-s" />
            <div className="tiny muted mt-s">
              باقي <span className="num">{fmt(lv.need - lv.into)}</span> XP للمستوى {lv.level + 1}
            </div>
          </div>
        </div>
        <div className="xp-cell">
          <IconTile name="flame" color="var(--gold)" size={44} />
          <div className="grow">
            <div className="tiny muted bold">الـStreak</div>
            <div className="bold">
              <span className="num">{streak.count}</span> يوم · الأفضل <span className="num">{streak.best || streak.count}</span>
            </div>
            <div className="week-dots mt-s">
              {Array.from({ length: 7 }).map((_, i) => {
                const d = addDays(T, i - 6);
                const on = streak.days?.[d];
                return (
                  <div className="d" key={d}>
                    <i className={on ? 'on' : ''} aria-label={`${d} ${on ? 'مكتمل' : ''}`}>{on ? <Check size={12} /> : ''}</i>
                    {DAYS_SHORT[fromKey(d).getDay()].slice(0, 2)}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        <button className="xp-cell" onClick={() => navigate('rewards')} aria-label="المكافآت">
          <IconTile name="gift" color="var(--green)" size={44} />
          <div className="grow" style={{ textAlign: 'start' }}>
            <div className="tiny muted bold">رصيدك</div>
            <div className="bold num">{fmt(user.xp)} XP</div>
            {nextReward && (
              <div className="tiny muted ellipsis">
                {user.xp >= nextReward.cost ? `تقدر تستبدل: ${nextReward.title}` : `باقي ${fmt(nextReward.cost - user.xp)} لـ ${nextReward.title}`}
              </div>
            )}
          </div>
        </button>
      </div>
    </div>
  );
}

// ————— مساعد التخطيط —————
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
    }, 500);
  }
  return (
    <div className="card span-12 reveal">
      <div className="card-hd">
        <CardTitle icon={<Bot size={18} />} sub={`${say(persona, 'hi')} اكتب وضعك وأبني لك خطة.`}>
          مساعد التخطيط
        </CardTitle>
        <button className="btn btn-sm btn-ghost" onClick={() => setDrawer('assistant')}>
          <Sparkles /> اسأل مسار
        </button>
      </div>
      <form className="quick" style={{ maxWidth: 'none' }} onSubmit={(e) => (e.preventDefault(), build())}>
        <Sparkles size={18} className="spark" aria-hidden />
        <input value={text} onChange={(e) => setText(e.target.value)} aria-label="اكتب وضعك للمساعد" placeholder="عندي اختبار بعد 5 أيام وأحتاج أذاكر 4 فصول" />
        <button className="btn btn-sm btn-primary">إنشاء الخطة</button>
      </form>
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
        <div className="mt">
          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(150px,1fr))', gap: 10 }}>
            {plan.plan.map((d, i) => (
              <div key={d.day} className="mini-stat reveal" style={{ textAlign: 'start', animationDelay: `${i * 0.05}s` }}>
                <div className="tiny purple bold">اليوم {d.day}</div>
                <div className="small bold">{d.title}</div>
                <div className="tiny muted">{DAYS_SHORT[fromKey(d.date).getDay()]} · 18:00</div>
              </div>
            ))}
          </div>
          <button className="btn btn-primary btn-sm mt" disabled={saved} onClick={() => (createStudyPlan(plan, plan.subject), setSaved(true))}>
            {saved ? (
              <>
                <Check /> تمت الإضافة للجدول
              </>
            ) : (
              <>
                <Plus /> أضف الخطة لجدولي
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}

// ————— توازن الحياة —————
export function BalanceWidget({ span = 'span-6' }) {
  const tasks = useStore((s) => s.tasks);
  const data = useMemo(() => balance(tasks), [tasks]);
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
              <span className="swatch" style={{ background: d.color }} />
              <span className="small row" style={{ gap: 6 }}>
                <Glyph name={d.icon} size={14} /> {d.label}
              </span>
              <span className="small xbold num">{d.pct}%</span>
              <span />
              <div className="bar thin" style={{ gridColumn: '2 / 4' }}>
                <i style={{ width: `${d.pct}%`, background: d.color, boxShadow: 'none' }} />
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
  const tm = useMemo(() => timeMachine(tasks), [tasks]);
  return (
    <div className={`card ${span} reveal d1`}>
      <CardTitle icon={<Hourglass size={18} />} color="blue" sub="مستقبلك يبدأ من اليوم">
        آلة الزمن
      </CardTitle>
      <div className="grid mt" style={{ gap: 10, gridTemplateColumns: 'repeat(3,minmax(0,1fr))' }}>
        <div className="mini-stat">
          <div className="l">قبل 30 يوم</div>
          <div className="v"><Num value={tm.past30} /></div>
          <div className="l">مهمة</div>
        </div>
        <div className="mini-stat" style={{ borderColor: 'rgba(var(--primary-rgb),.45)' }}>
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
        بنفس معدلك (<span className="num">{tm.rate.toFixed(1)}</span> مهمة/يوم) ستصل إلى <b className="num">{tm.future}</b> مهمة مكتملة
      </p>
    </div>
  );
}
