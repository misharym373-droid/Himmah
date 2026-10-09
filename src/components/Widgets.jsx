// بطاقات الصفحة الرئيسية — الأساسية في الأعلى، والتفاصيل في أقسام قابلة للطي
import { useEffect, useMemo, useRef, useState } from 'react';
import HabitTasks from './HabitTasks.jsx';
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
import { formatLong, todayKey, formatDuration, formatHM, nowMin, toMin, fmt, addDays, dayShort, fromKey, formatClock, clock12 } from '../lib/date.js';
import { levelInfo, habitStreak, isOverdue } from '../lib/game.js';
import { scoreTask, studyPlan, postponeInsights, say } from '../lib/assistant.js';
import { weekBars, summary, balance, timeMachine } from '../lib/stats.js';
import { ENERGY, AREAS } from '../config.js';
import { tr, trf, isEn } from '../i18n/index.js';

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
      <button className="chip" onClick={() => setEdit(true)} title={tr('تغيير مستوى الطاقة')} aria-label={trf('طاقتك اليوم {level} — تغيير', { level: tr(ENERGY[energy].label) })}>
        <I size={16} /> {trf('طاقتك: {level}', { level: tr(ENERGY[energy].label) })}
      </button>
    );
  }
  return (
    <div className="energy-pick" role="radiogroup" aria-label={tr('كيف طاقتك اليوم؟')}>
      <span className="small muted bold">{tr('كيف طاقتك اليوم؟')}</span>
      {Object.entries(ENERGY).map(([k, e]) => {
        const I = ENERGY_ICONS[k];
        return (
          <button key={k} role="radio" aria-checked={energy === k} className={`chip ${energy === k ? 'on' : ''}`} onClick={() => (setEnergy(k), setEdit(false))} title={tr(e.hint)}>
            <I size={16} /> {tr(e.label)}
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
  const hello = h < 12 ? tr('صباح الخير') : h < 18 ? tr('مساء الخير') : tr('مساء النور');
  const actions = [
    [Siren, tr('أنقذ يومي'), () => open('rescue'), 'red'],
    [Hourglass, tr('عندي ساعة فقط'), () => open('oneHour'), 'gold'],
    [ImagePlus, tr('مهمة من صورة'), () => open('image'), 'blue'],
  ];
  return (
    <section className="greeting span-12 reveal" aria-label={tr('الترحيب')}>
      <div className="greet-top">
        <div>
          <p className="small muted bold">{formatLong(todayKey())}</p>
          <h1 className="greet-title">
            {hello}
            {name ? `${tr('، ')}${name}` : ''}
          </h1>
          <p className="greet-sub">
            {progress.total ? (
              <>
                {isEn() ? (
                  <>
                    You've done <b className="num">{progress.done}</b> of <b className="num">{progress.total}</b> tasks
                  </>
                ) : (
                  <>
                    أنجزت <b className="num">{progress.done}</b> من <b className="num">{progress.total}</b> مهام
                  </>
                )}
                {dayLeft > 0 && (
                  <>
                    {' '}· {isEn() ? null : 'باقي '}<b>{formatDuration(dayLeft)}</b> {tr('من يومك')}
                  </>
                )}
              </>
            ) : (
              tr('يومك فاضي — اكتب ما عندك ومسار يرتبه لك.')
            )}
          </p>
        </div>
        <EnergyCheck />
      </div>
      {input}
      <div className="greet-actions">
        <button className="btn btn-primary btn-sm" onClick={() => open('whatNow')}>
          <Brain /> {tr('وش أسوي الآن؟')}
        </button>
        {actions.map(([I, l, run, c]) => (
          <button key={l} className={`btn btn-sm btn-ghost tone-${c}`} onClick={run}>
            <I /> {l}
          </button>
        ))}
        <button className="btn btn-sm btn-ghost" onClick={() => open('interactive')}>
          <Sparkles /> {tr('التجربة التفاعلية')}
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
    <section className="summary span-12 reveal d1" aria-label={tr('ملخص اليوم')}>
      <div className="sum-tile sum-ring">
        <Ring value={progress.pct} size={76} stroke={8} id="dayRing">
          <span className="xbold num" style={{ fontSize: '1.1rem' }}>{progress.pct}%</span>
        </Ring>
        <div>
          <div className="sum-l">{tr('إنجاز اليوم')}</div>
          <div className="sum-v">
            <Num value={progress.done} /> <span className="muted small">{trf('/ {n} مهام', { n: progress.total })}</span>
          </div>
        </div>
      </div>
      <div className={`sum-tile ${tight ? 'warn' : ''}`}>
        <IconTile name="sunrise" color={tight ? 'var(--gold)' : 'var(--blue)'} size={40} />
        <div>
          <div className="sum-l">{tr('باقي من يومك')}</div>
          <div className="sum-v">{dayLeft ? formatDuration(dayLeft) : tr('انتهى اليوم')}</div>
          <div className="tiny muted">{openMinutes ? trf('مهامك المتبقية تحتاج {d}', { d: formatDuration(openMinutes) }) : tr('لا مهام متبقية')}</div>
        </div>
      </div>
      <div className="sum-tile">
        <IconTile name="zap" color="var(--green)" size={40} />
        <div>
          <div className="sum-l">{tr('تركيز اليوم')}</div>
          <div className="sum-v num">{formatHM(focusToday)}</div>
          <div className="tiny muted">{tr('ساعة:دقيقة')}</div>
        </div>
      </div>
      <div className="sum-tile">
        <IconTile name="flame" color="var(--gold)" size={40} />
        <div>
          <div className="sum-l">{tr('الـStreak')}</div>
          <div className="sum-v">
            <Num value={streak.count} /> <span className="muted small">{tr('يوم')}</span>
          </div>
          <div className="tiny muted">{streak.lastDate === T ? tr('حافظت عليه اليوم') : tr('أكمل يومك للحفاظ عليه')}</div>
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
            <b className="num">{overdue.length}</b> {tr('مهام متأخرة تحتاج قرارك:')} <span className="muted">{overdue.slice(0, 2).map((t) => t.title).join(tr('، '))}</span>
          </span>
          <button className="btn btn-xs" onClick={() => open('reschedule', { id: overdue[0].id })}>
            {tr('أعد التخطيط')}
          </button>
        </div>
      )}
      {ins && (
        <div className="notice warn">
          <Lightbulb size={18} aria-hidden />
          <span className="grow small">{trf('لاحظنا أنك غالبًا تؤجل مهام "{key}" — تقسيمها لخطوات أصغر يساعد.', { key: ins.key })}</span>
          {!ins.sample.done && !ins.sample.deletedAt && (
            <button className="btn btn-xs" onClick={() => open('task', { task: ins.sample })}>
              {tr('قسّمها')}
            </button>
          )}
          <button className="icon-btn sm plain" aria-label={tr('تجاهل الاقتراح')} onClick={() => dismissInsight(ins.key)}>
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
        <CardTitle icon={<ListTodo size={18} />} sub={top.length ? tr('مرتبة حسب الأولوية والوقت وطاقتك') : null}>
          {tr('أهم 3 مهام اليوم')}
        </CardTitle>
        <button className="icon-btn sm primary" onClick={() => open('task')} aria-label={tr('إضافة مهمة')}>
          <Plus />
        </button>
      </div>
      {!top.length ? (
        progress.total ? (
          <Empty icon={<CircleCheck />} title={tr('أنجزت كل مهام اليوم')} text={tr('يوم ممتاز. خذ راحتك أو خطط لبكرة.')} />
        ) : (
          <Empty icon={<CalendarDays />} title={tr('يومك جاهز لك.')} text={tr('أضف أول مهمة وابدأ.')} action={<button className="btn btn-primary" onClick={() => open('task')}><Plus /> {tr('إضافة مهمة')}</button>} />
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
      <HabitTasks className="mt" />
      <button className="btn btn-ghost btn-sm mt" onClick={() => navigate('tasks')}>
        {trf('كل مهام اليوم ({n})', { n: progress.total })} <ArrowLeft />
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
        <CardTitle icon={<Clock size={18} />} color="blue">{tr('المهمة القادمة')}</CardTitle>
        <Empty icon={<Sunset />} title={tr('لا توجد مهام مجدولة لاحقًا اليوم')} text={tr('أضف وقتًا لمهامك لتظهر هنا.')} action={<button className="btn btn-sm" onClick={() => open('task')}><Plus /> {tr('مهمة بوقت')}</button>} />
      </div>
    );
  const start = toMin(task.time);
  const isNow = task === current;
  const mins = isNow ? start + task.duration - minuteNow : start - minuteNow;
  const area = AREAS[task.area] || AREAS.work;
  return (
    <div className={`card ${span} reveal d3 next-card ${isNow ? 'is-now' : ''}`}>
      <div className="card-hd">
        <CardTitle icon={<Clock size={18} />} color="blue">{isNow ? tr('جارية الآن') : tr('المهمة القادمة')}</CardTitle>
        <span className={`badge ${isNow ? 'green' : 'blue'}`}>{isNow ? <><span className="pulse-dot" /> {tr('الآن')}</> : <span className="num">{clock12(task.time)}</span>}</span>
      </div>
      <div className="row" style={{ gap: 14 }}>
        <IconTile name={task.icon} color={area.color} size={56} />
        <div className="grow" style={{ minWidth: 0 }}>
          <h3 className="ellipsis" style={{ fontSize: '1.25rem' }}>{task.title}</h3>
          <div className="small muted">
            <span className="num">{clock12(task.time)}</span> · {formatDuration(task.duration)} · {tr(area.label)}
          </div>
        </div>
      </div>
      <div className="countdown">
        <span className="tiny muted bold">{isNow ? tr('باقي على انتهائها') : tr('تبدأ بعد')}</span>
        <span className="cd-v">{formatDuration(Math.max(1, mins))}</span>
      </div>
      <div className="row wrap">
        <button className="btn btn-primary grow" onClick={() => pickFocus(task.id)}>
          <Play /> {tr('ابدأ جلسة تركيز')}
        </button>
        <button className="btn" onClick={() => complete(task.id)}>
          <Check /> {tr('إكمال')}
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
        <CardTitle icon={<Target size={18} />}>{tr('أهدافي')}</CardTitle>
        <button className="btn btn-xs btn-ghost" onClick={() => navigate('goals')}>
          {tr('كل الأهداف')} <ArrowLeft />
        </button>
      </div>
      {!goals.length ? (
        <Empty icon={<Target />} title={tr('ما الشيء الذي تريد الوصول إليه؟')} action={<button className="btn btn-sm btn-primary" onClick={() => navigate('goals?new=1')}>{tr('إنشاء هدف')}</button>} />
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
                  <span className="tiny muted ellipsis" style={{ display: 'block', marginTop: 4 }}>{stage ? trf('المرحلة الحالية: {title}', { title: stage.title }) : tr('كل المراحل مكتملة')}</span>
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
        <CardTitle icon={<Timer size={18} />} color="green">{tr('التركيز')}</CardTitle>
        <span className="tiny muted">
          <span className="num">{today.length}</span> {tr('جلسات اليوم')}
        </span>
      </div>
      {focus ? (
        <>
          <div className="small muted ellipsis">{focusTask?.title || tr('جلسة تركيز')}</div>
          <div className="focus-clock num">{formatClock(remaining)}</div>
          <Bar value={100 - (remaining / focus.totalSec) * 100} variant="green" />
          <div className="row mt wrap">
            {!focus.finished && (
              <button className="btn btn-sm" onClick={() => (focus.running ? pauseFocus() : resumeFocus())}>
                {focus.running ? <Pause /> : <Play />} {focus.running ? tr('إيقاف مؤقت') : tr('استئناف')}
              </button>
            )}
            <button className="btn btn-sm btn-primary" onClick={() => minimizeFocus(false)}>
              <Maximize2 /> {tr('وضع التركيز')}
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="row between">
            <div>
              <div className="sum-v num">{formatHM(minutes)}</div>
              <div className="tiny muted">
                {tr('من هدف')} <span className="num">{FOCUS_TARGET / 60}</span> {tr('ساعات تركيز يوميًا')}
              </div>
            </div>
            <Ring value={(minutes / FOCUS_TARGET) * 100} size={58} stroke={6} id="focusRing" color="var(--green)">
              <span className="tiny bold num">{Math.min(100, Math.round((minutes / FOCUS_TARGET) * 100))}%</span>
            </Ring>
          </div>
          {suggested ? (
            <>
              <div className="small mt">
                {tr('ابدأ على:')} <b>{suggested.title}</b>
              </div>
              <div className="row mt-s wrap">
                {[15, 25, 45].map((m) => (
                  <button key={m} className="btn btn-sm" onClick={() => startFocus(suggested.id, m)} aria-label={trf('جلسة {m} دقيقة على {title}', { m, title: suggested.title })}>
                    <span className="num">{m}</span> {tr('د')}
                  </button>
                ))}
                <button className="btn btn-sm btn-ghost" onClick={() => pickFocus(suggested.id)}>
                  {tr('تخصيص')}
                </button>
              </div>
              <button className="btn btn-sm btn-ghost mt-s" onClick={() => pickFocus(null)}>
                {tr('تركيز حر بدون مهمة')}
              </button>
            </>
          ) : (
            <>
              <p className="small muted mt">{tr('لا توجد مهام مفتوحة للتركيز عليها الآن.')}</p>
              <button className="btn btn-sm btn-primary mt-s" onClick={() => pickFocus(null)}>
                {tr('تركيز حر بدون مهمة')}
              </button>
            </>
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
    useStore.getState().toast(tr('تمت إعادة ترتيب الجدول وتحديث الأوقات'), { icon: 'sparkles' });
  }
  return (
    <div className={`card ${span} reveal`} id="day-map">
      <div className="card-hd">
        {title ? (
          <CardTitle icon={<CalendarDays size={18} />} color="blue" sub={list.length ? tr('اسحب المهام لإعادة ترتيبها — الأوقات تتحدث تلقائيًا') : null}>
            {tr(title)}
          </CardTitle>
        ) : (
          <span className="small muted">{list.length ? tr('اسحب المهام لإعادة ترتيبها — الأوقات تتحدث تلقائيًا') : ''}</span>
        )}
        <div className="row">
          <button className="btn btn-sm btn-ghost hide-mobile" onClick={() => navigate('schedule')}>
            {tr('الجدول الكامل')}
          </button>
          <button className="icon-btn sm primary" onClick={() => open('task', { preset: { date } })} aria-label={tr('إضافة مهمة لهذا اليوم')}>
            <Plus />
          </button>
        </div>
      </div>
      {!list.length ? (
        <Empty icon={<CalendarDays />} title={tr('يومك جاهز لك.')} text={tr('أضف أول مهمة وابدأ.')} action={<button className="btn btn-primary" onClick={() => open('task', { preset: { date } })}><Plus /> {tr('إضافة مهمة')}</button>} />
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onEnd}>
          <SortableContext items={list.map((t) => t.id)} strategy={verticalListSortingStrategy}>
            <div className="timeline" ref={scroller} style={{ maxHeight: 560, overflowY: 'auto', paddingInlineEnd: 4 }}>
              {list.map((t) => (
                <div className={`tl-row ${t.id === currentId ? 'now' : ''}`} key={t.id} data-next={t.id === firstOpenId ? '1' : undefined}>
                  <div className="tl-time">{(t.time && clock12(t.time)) || <span className="tl-allday">{tr('طوال اليوم')}</span>}</div>
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
          <CardTitle icon={<Repeat size={18} />} color="green">{tr('العادات')}</CardTitle>
          <button className="btn btn-xs btn-ghost" onClick={() => navigate('habits')}>
            {tr('الكل')} <ArrowLeft />
          </button>
        </div>
        {!habits.length ? (
          <Empty icon={<Repeat />} title={tr('ابنِ أول عادة')} action={<button className="btn btn-sm btn-primary" onClick={() => navigate('habits')}>{tr('عاداتي')}</button>} />
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
          <CardTitle icon={<Swords size={18} />} color="gold">{tr('التحديات')}</CardTitle>
          <button className="btn btn-xs btn-ghost" onClick={() => navigate('achievements?tab=challenges')}>
            {tr('الكل')} <ArrowLeft />
          </button>
        </div>
        {!challenges.length ? (
          <Empty icon={<Swords />} title={tr('ابدأ تحديًا جديدًا')} action={<button className="btn btn-sm btn-primary" onClick={() => navigate('achievements?tab=challenges')}>{tr('تحدياتي')}</button>} />
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
        <CardTitle icon={<ChartColumn size={18} />} color="blue">{tr('آخر 7 أيام')}</CardTitle>
        <button className="btn btn-xs btn-ghost" onClick={() => navigate('stats')}>
          {tr('التفاصيل')} <ArrowLeft />
        </button>
      </div>
      <div className="dash" style={{ marginTop: 0, alignItems: 'center' }}>
        <div className="span-4 grid g2" style={{ gap: 10 }}>
          <div className="mini-stat">
            <div className="v green"><Num value={s.done} /></div>
            <div className="l">{tr('مهمة أنجزتها')}</div>
          </div>
          <div className="mini-stat">
            <div className="v purple num">{s.rate}%</div>
            <div className="l">{tr('نسبة الالتزام')}</div>
          </div>
          <div className="mini-stat">
            <div className="v num">{formatHM(s.focus)}</div>
            <div className="l">{tr('ساعات تركيز')}</div>
          </div>
          <div className="mini-stat">
            <div className="v num" style={{ fontSize: '1rem', paddingTop: 6 }}>{s.bestWindow}</div>
            <div className="l">{tr('أفضل وقت لك')}</div>
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
            <div className="tiny muted bold">{trf('المستوى {n}', { n: lv.level })}</div>
            <Bar value={lv.pct} className="mt-s" />
            <div className="tiny muted mt-s">
              {isEn() ? (
                <>
                  <span className="num">{fmt(lv.need - lv.into)}</span> XP to level {lv.level + 1}
                </>
              ) : (
                <>
                  باقي <span className="num">{fmt(lv.need - lv.into)}</span> XP للمستوى {lv.level + 1}
                </>
              )}
            </div>
          </div>
        </div>
        <div className="xp-cell">
          <IconTile name="flame" color="var(--gold)" size={44} />
          <div className="grow">
            <div className="tiny muted bold">{tr('الـStreak')}</div>
            <div className="bold">
              <span className="num">{streak.count}</span> {tr('يوم')} · {tr('الأفضل')} <span className="num">{streak.best || streak.count}</span>
            </div>
            <div className="week-dots mt-s">
              {Array.from({ length: 7 }).map((_, i) => {
                const d = addDays(T, i - 6);
                const on = streak.days?.[d];
                return (
                  <div className="d" key={d}>
                    <i className={on ? 'on' : ''} aria-label={`${d} ${on ? tr('مكتمل') : ''}`}>{on ? <Check size={12} /> : ''}</i>
                    {dayShort(fromKey(d).getDay()).slice(0, 2)}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        <button className="xp-cell" onClick={() => navigate('rewards')} aria-label={tr('المكافآت')}>
          <IconTile name="gift" color="var(--green)" size={44} />
          <div className="grow" style={{ textAlign: 'start' }}>
            <div className="tiny muted bold">{tr('رصيدك')}</div>
            <div className="bold num">{fmt(user.xp)} XP</div>
            {nextReward && (
              <div className="tiny muted ellipsis">
                {user.xp >= nextReward.cost ? trf('تقدر تستبدل: {title}', { title: tr(nextReward.title) }) : trf('باقي {n} لـ {title}', { n: fmt(nextReward.cost - user.xp), title: tr(nextReward.title) })}
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
  const [text, setText] = useState(() => tr('عندي اختبار بعد 5 أيام وأحتاج أذاكر 4 فصول.'));
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
        <CardTitle icon={<Bot size={18} />} sub={`${say(persona, 'hi')} ${tr('اكتب وضعك وأبني لك خطة.')}`}>
          {tr('مساعد التخطيط')}
        </CardTitle>
        <button className="btn btn-sm btn-ghost" onClick={() => setDrawer('assistant')}>
          <Sparkles /> {tr('اسأل مسار')}
        </button>
      </div>
      <form className="quick" style={{ maxWidth: 'none' }} onSubmit={(e) => (e.preventDefault(), build())}>
        <Sparkles size={18} className="spark" aria-hidden />
        <input value={text} onChange={(e) => setText(e.target.value)} aria-label={tr('اكتب وضعك للمساعد')} placeholder={tr('عندي اختبار بعد 5 أيام وأحتاج أذاكر 4 فصول')} />
        <button className="btn btn-sm btn-primary">{tr('إنشاء الخطة')}</button>
      </form>
      {thinking && (
        <div className="row mt">
          <span className="typing">
            <i />
            <i />
            <i />
          </span>
          <span className="small muted">{tr('أبني خطتك…')}</span>
        </div>
      )}
      {plan && !thinking && (
        <div className="mt">
          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(150px,1fr))', gap: 10 }}>
            {plan.plan.map((d, i) => (
              <div key={d.day} className="mini-stat reveal" style={{ textAlign: 'start', animationDelay: `${i * 0.05}s` }}>
                <div className="tiny purple bold">{trf('اليوم {n}', { n: d.day })}</div>
                <div className="small bold">{d.title}</div>
                <div className="tiny muted">{dayShort(fromKey(d.date).getDay())} · 18:00</div>
              </div>
            ))}
          </div>
          <button className="btn btn-primary btn-sm mt" disabled={saved} onClick={() => (createStudyPlan(plan, plan.subject), setSaved(true))}>
            {saved ? (
              <>
                <Check /> {tr('تمت الإضافة للجدول')}
              </>
            ) : (
              <>
                <Plus /> {tr('أضف الخطة لجدولي')}
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
      <CardTitle icon={<ChartPie size={18} />} sub={tr('توزيع وقتك على مجالات حياتك — آخر 30 يوم')}>
        {tr('توازن حياتي')}
      </CardTitle>
      <div className="row mt wrap" style={{ gap: 24, justifyContent: 'center' }}>
        <Donut data={data} />
        <div className="col grow" style={{ minWidth: 200, gap: 10 }}>
          {data.map((d) => (
            <div className="legend-row" key={d.key}>
              <span className="swatch" style={{ background: d.color }} />
              <span className="small row" style={{ gap: 6 }}>
                <Glyph name={d.icon} size={14} /> {tr(d.label)}
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
      <CardTitle icon={<Hourglass size={18} />} color="blue" sub={tr('مستقبلك يبدأ من اليوم')}>
        {tr('آلة الزمن')}
      </CardTitle>
      <div className="grid mt" style={{ gap: 10, gridTemplateColumns: 'repeat(3,minmax(0,1fr))' }}>
        <div className="mini-stat">
          <div className="l">{tr('قبل 30 يوم')}</div>
          <div className="v"><Num value={tm.past30} /></div>
          <div className="l">{tr('مهمة')}</div>
        </div>
        <div className="mini-stat" style={{ borderColor: 'rgba(var(--primary-rgb),.45)' }}>
          <div className="l purple bold">{tr('اليوم')}</div>
          <div className="v"><Num value={tm.today} /></div>
          <div className="l">{tr('مهام')}</div>
        </div>
        <div className="mini-stat">
          <div className="l">{tr('بعد 30 يوم')}</div>
          <div className="v blue"><Num value={tm.future} /></div>
          <div className="l">{tr('مهمة')}</div>
        </div>
      </div>
      <div className="mt">
        <TimeLine series={tm.series} proj={tm.proj} />
      </div>
      <p className="tiny muted" style={{ textAlign: 'center' }}>
        {isEn() ? (
          <>
            At your current pace (<span className="num">{tm.rate.toFixed(1)}</span> tasks/day) you'll reach <b className="num">{tm.future}</b> completed tasks
          </>
        ) : (
          <>
            بنفس معدلك (<span className="num">{tm.rate.toFixed(1)}</span> مهمة/يوم) ستصل إلى <b className="num">{tm.future}</b> مهمة مكتملة
          </>
        )}
      </p>
    </div>
  );
}
