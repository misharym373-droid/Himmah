// واجهة الأهداف ذات الخطة: إنشاء الخطة، الجدول الأسبوعي، المراحل والأسابيع بالتفصيل
import { useMemo, useState } from 'react';
import { Check, Wand2, CalendarDays, ListChecks, ChevronDown, Pencil, Trash2, Coffee, Clock, Sparkles, Target } from 'lucide-react';
import { useStore, goalProgress } from '../store.js';
import { Modal, Bar, Ring, Switch, useConfirm } from './ui.jsx';
import { IconTile, Glyph } from './Glyph.jsx';
import { AREAS, GOAL_ICONS } from '../config.js';
import { DAYS, todayKey, addDays, formatShort, diffDays, fromKey } from '../lib/date.js';
import { buildGoalPlan, planSessions, detectKind, defaultRestDays, weekOf } from '../lib/goalPlan.js';
import { monthsFromText } from '../lib/assistant.js';

const DURATIONS = [1, 2, 3, 6, 12];
const monthsLabel = (m) => (m === 12 ? 'سنة' : m === 1 ? 'شهر' : m === 2 ? 'شهرين' : `${m} أشهر`);

// ————— إنشاء هدف بخطة كاملة —————
export function GoalPlanModal({ onClose }) {
  const addGoal = useStore((s) => s.addGoal);
  const [title, setTitle] = useState('');
  const [months, setMonths] = useState(3);
  const kind = useMemo(() => detectKind(title), [title]);
  const [rest, setRest] = useState(null); // null = افتراضي حسب نوع الهدف
  const restDays = rest ?? defaultRestDays(kind);
  const [fixedTime, setFixedTime] = useState(false);
  const [time, setTime] = useState('18:00');
  const [icon, setIcon] = useState(null);
  const plan = useMemo(() => (title.trim().length > 2 ? buildGoalPlan({ title, months, restDays, time: fixedTime ? time : null }) : null), [title, months, restDays, fixedTime, time]);
  const sessions = useMemo(() => (plan ? planSessions(plan, title) : []), [plan, title]);

  function onTitle(v) {
    setTitle(v);
    if (/شهر|اشهر|أشهر|شهور|سنة|سنه|عام/.test(v)) setMonths(Math.max(1, Math.min(12, monthsFromText(v))));
  }
  function toggleRest(d) {
    const cur = restDays.includes(d) ? restDays.filter((x) => x !== d) : [...restDays, d];
    if (cur.length >= 7) return;
    setRest(cur);
  }
  function save() {
    if (!plan) return;
    const g = addGoal({ title: title.trim().replace(/\s*(خلال|لمدة)\s.*$/, '') || title.trim(), months, area: plan.area, icon: icon || plan.icon, plan });
    useStore.getState().toast(`تم إنشاء الهدف وخطته: ${sessions.length} جلسة حتى ${formatShort(plan.endDate)}`, { icon: 'sparkles' });
    onClose(g);
  }

  return (
    <Modal
      title="هدف جديد"
      sub="اكتب هدفك، واختر المدة وأيام الإجازة — ومسار يبني لك جدولًا يوميًا مفصلًا لكل المدة"
      onClose={() => onClose()}
      size="xl"
      footer={
        <>
          <button className="btn btn-ghost" onClick={() => onClose()}>
            إلغاء
          </button>
          <button className="btn btn-primary" onClick={save} disabled={!plan}>
            <Check /> إنشاء الهدف و{sessions.length ? <span className="num">{sessions.length}</span> : ''} مهمة
          </button>
        </>
      }
    >
      <div className="col" style={{ gap: 18 }}>
        <label className="field">
          <span>الهدف</span>
          <input className="input" value={title} onChange={(e) => onTitle(e.target.value)} placeholder="مثال: النادي — إنقاص الوزن وبناء العضل" autoFocus />
          {plan && (
            <span className="tiny muted">
              <Sparkles size={12} style={{ verticalAlign: -2 }} /> نوع الخطة: <b>{plan.label}</b>
            </span>
          )}
        </label>
        <div className="grid g2">
          <div className="field">
            <span>المدة</span>
            <div className="chips">
              {DURATIONS.map((m) => (
                <button key={m} className={`chip ${months === m ? 'on' : ''}`} onClick={() => setMonths(m)}>
                  {monthsLabel(m)}
                </button>
              ))}
            </div>
          </div>
          <div className="field">
            <span>أيام الإجازة (بدون مهام)</span>
            <div className="chips">
              {DAYS.map((d, i) => (
                <button key={d} className={`chip ${restDays.includes(i) ? 'on' : ''}`} onClick={() => toggleRest(i)} aria-pressed={restDays.includes(i)}>
                  {restDays.includes(i) && <Coffee size={13} />} {d}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="set-row" style={{ padding: '2px 0', borderBottom: 0 }}>
          <div className="grow">
            <div className="t">وقت ثابت للجلسة</div>
            <div className="d">بدونه تكون مهام الخطة «طوال اليوم» وتنجزها متى ما ناسبك</div>
          </div>
          {fixedTime && <input className="input" type="time" style={{ width: 130 }} value={time} onChange={(e) => setTime(e.target.value)} aria-label="وقت الجلسة" />}
          <Switch on={fixedTime} onChange={setFixedTime} label="وقت ثابت للجلسة" />
        </div>
        <div className="field">
          <span>الأيقونة</span>
          <div className="chips">
            {GOAL_ICONS.map((i) => (
              <button key={i} className={`chip icon-chip ${(icon || plan?.icon) === i ? 'on' : ''}`} onClick={() => setIcon(i)} aria-label={i}>
                <Glyph name={i} size={17} />
              </button>
            ))}
          </div>
        </div>
        {plan ? <PlanPreview plan={plan} sessions={sessions} /> : <p className="small muted">اكتب هدفك لتظهر الخطة المقترحة هنا مباشرة.</p>}
      </div>
    </Modal>
  );
}

function PlanPreview({ plan, sessions }) {
  const firstWeek = sessions.filter((s) => s.date < addDays(plan.startDate, 7));
  return (
    <div className="plan-preview">
      <div className="row wrap" style={{ gap: 8 }}>
        <span className="badge purple">
          <CalendarDays size={12} /> {formatShort(plan.startDate)} ← {formatShort(plan.endDate)}
        </span>
        <span className="badge">
          <span className="num">{plan.totalWeeks}</span> أسبوع
        </span>
        <span className="badge green">
          <ListChecks size={12} /> <span className="num">{sessions.length}</span> جلسة
        </span>
        <span className="badge gold">
          <Coffee size={12} /> إجازة: {plan.restDays.length ? plan.restDays.map((d) => DAYS[d]).join('، ') : 'لا يوجد'}
        </span>
      </div>
      <div className="dash" style={{ marginTop: 14 }}>
        <div className="span-5">
          <div className="bold small mb">الجدول الأسبوعي</div>
          <WeeklyTable weekly={plan.weekly} />
        </div>
        <div className="span-7">
          <div className="bold small mb">المراحل</div>
          <div className="stage-list">
            {plan.phases.map((p, i) => (
              <div className="stage" key={i}>
                <span className="stage-dot num">{i + 1}</span>
                <div className="stage-body">
                  <div className="bold small">{p.title}</div>
                  <div className="tiny muted">
                    الأسابيع <span className="num">{p.fromWeek}–{p.toWeek}</span> · {formatShort(p.from)} ← {formatShort(p.to)}
                  </div>
                  <div className="tiny dim">{p.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="bold small mt mb">الأسبوع الأول بالتفصيل</div>
      <div className="session-list">
        {firstWeek.map((s) => (
          <div className="session" key={s.date}>
            <div className="session-date">
              <b>{DAYS[fromKey(s.date).getDay()]}</b>
              <span className="tiny muted">{formatShort(s.date)}</span>
            </div>
            <div className="grow">
              <div className="bold small">{s.title}</div>
              <div className="session-desc">{s.desc.split('\n').slice(1).join('\n')}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function WeeklyTable({ weekly, editable, onChange }) {
  const ordered = [...weekly].sort((a, b) => a.dow - b.dow);
  return (
    <div className="week-table">
      {ordered.map((d) => (
        <div className={`wt-row ${d.rest ? 'rest' : ''}`} key={d.dow}>
          <span className="wt-day">{DAYS[d.dow]}</span>
          {editable ? (
            <>
              <input className="input wt-input" value={d.rest ? '' : d.focus} disabled={d.rest} placeholder={d.rest ? 'إجازة' : ''} onChange={(e) => onChange(d.dow, { focus: e.target.value })} aria-label={`تركيز يوم ${DAYS[d.dow]}`} />
              <button className={`chip chip-xs ${d.rest ? 'on' : ''}`} onClick={() => onChange(d.dow, { rest: !d.rest })}>
                {d.rest ? 'إجازة' : 'عمل'}
              </button>
            </>
          ) : (
            <span className="wt-focus">{d.rest ? <><Coffee size={13} /> إجازة</> : d.focus}</span>
          )}
        </div>
      ))}
    </div>
  );
}

// ————— بطاقة هدف بخطة —————
export function PlanGoalCard({ g, tasks, open, onToggle, delay }) {
  const confirm = useConfirm();
  const { deleteGoal, replanGoal, toggleTask } = useStore.getState();
  const pct = goalProgress(g, tasks);
  const gt = useMemo(() => tasks.filter((t) => t.goalId === g.id && !t.deletedAt && !t.template).sort((a, b) => (a.date < b.date ? -1 : 1)), [tasks, g.id]);
  const done = gt.filter((t) => t.done).length;
  const T = todayKey();
  const todayTask = gt.find((t) => t.date === T);
  const left = diffDays(g.plan.endDate, T);
  const now = T >= g.plan.startDate && T <= g.plan.endDate ? weekOf(g.plan, T) : null;
  const color = AREAS[g.area]?.color || 'var(--primary)';
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(g.plan.weekly);
  const [openPhase, setOpenPhase] = useState(now ? now.phaseIndex : 0);
  const [openWeek, setOpenWeek] = useState(now ? now.week : 1);

  function applyWeekly() {
    const n = replanGoal(g.id, { weekly: draft.map((d) => ({ ...d, focus: d.rest ? 'إجازة' : d.focus.trim() || 'جلسة', key: d.key || 'do' })) });
    setEditing(false);
    useStore.getState().toast(`طُبّق الجدول الجديد على ${n} يومًا قادمًا`, { icon: 'check' });
  }

  return (
    <div className={`card reveal ${open ? '' : 'hover'}`} style={{ animationDelay: `${delay * 0.05}s`, gridColumn: open ? '1 / -1' : undefined }}>
      <div className="row" style={{ gap: 18, alignItems: 'flex-start' }}>
        <Ring value={pct} size={88} stroke={8} id={`g${g.id}`}>
          <span className="xbold num">{pct}%</span>
        </Ring>
        <div className="grow" style={{ minWidth: 0 }}>
          <div className="row between" style={{ alignItems: 'flex-start' }}>
            <h3 className="row" style={{ fontSize: '1.12rem', gap: 8 }}>
              <IconTile name={g.icon} color={color} size={32} /> {g.title}
            </h3>
            <button className="icon-btn sm plain" onClick={onToggle} aria-label={open ? 'إخفاء تفاصيل الهدف' : 'عرض خطة الهدف'} aria-expanded={open}>
              <ChevronDown style={{ transform: open ? 'rotate(180deg)' : '', transition: 'transform .25s' }} />
            </button>
          </div>
          <div className="goal-now mt-s">
            <div className="small">
              <span className="muted">{now ? `الأسبوع ${now.week} · المرحلة ${now.phaseIndex + 1}: ` : T < g.plan.startDate ? 'تبدأ الخطة ' : 'انتهت مدة الخطة'}</span>
              <b>{now ? now.phase.title : T < g.plan.startDate ? formatShort(g.plan.startDate) : ''}</b>
            </div>
            <div className="small">
              <span className="muted">اليوم: </span>
              {todayTask ? (
                <>
                  {todayTask.title.replace(/ — الأسبوع \d+$/, '')} {todayTask.done && <span className="badge green">تم</span>}
                </>
              ) : (
                'إجازة'
              )}
            </div>
          </div>
          <div className="row wrap tiny muted mt-s" style={{ gap: 12 }}>
            <span className="meta-item">
              <CalendarDays size={13} /> {formatShort(g.plan.startDate)} ← {formatShort(g.plan.endDate)} ({left >= 0 ? <>باقي <span className="num">{left}</span> يوم</> : 'انتهت'})
            </span>
            <span className="meta-item">
              <ListChecks size={13} /> <span className="num">{done}/{gt.length}</span> جلسة
            </span>
            {g.plan.time && (
              <span className="meta-item">
                <Clock size={13} /> <span className="num">{g.plan.time}</span>
              </span>
            )}
          </div>
        </div>
      </div>
      {!open && (
        <button className="btn btn-sm btn-ghost mt" onClick={onToggle}>
          عرض الخطة بالتفصيل
        </button>
      )}
      {open && (
        <div className="mt">
          <div className="dash" style={{ marginTop: 6 }}>
            <div className="span-4">
              <div className="row between mb">
                <div className="bold">الجدول الأسبوعي</div>
                {!editing ? (
                  <button className="btn btn-xs" onClick={() => (setDraft(g.plan.weekly), setEditing(true))}>
                    <Pencil size={13} /> تعديل
                  </button>
                ) : null}
              </div>
              <WeeklyTable weekly={editing ? draft : g.plan.weekly} editable={editing} onChange={(dow, patch) => setDraft(draft.map((d) => (d.dow === dow ? { ...d, ...patch, key: d.key || 'do' } : d)))} />
              {editing && (
                <div className="col mt-s" style={{ gap: 8 }}>
                  <p className="tiny muted">التعديل يُطبَّق على كل الأيام القادمة حتى نهاية الخطة. الجلسات المنجزة تبقى كما هي.</p>
                  <div className="row">
                    <button className="btn btn-sm btn-primary" onClick={applyWeekly}>
                      <Check /> تطبيق على كل الأيام
                    </button>
                    <button className="btn btn-sm btn-ghost" onClick={() => setEditing(false)}>
                      إلغاء
                    </button>
                  </div>
                </div>
              )}
              {g.plan.tips?.length > 0 && (
                <div className="mt">
                  <div className="bold small mb">نصائح الخطة</div>
                  <ul className="tips">
                    {g.plan.tips.map((t) => (
                      <li key={t}>{t}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            <div className="span-8">
              <div className="bold mb">المراحل والأسابيع</div>
              <div className="stage-list">
                {g.plan.phases.map((p, i) => {
                  const pt = gt.filter((t) => t.date >= p.from && t.date <= p.to);
                  const pd = pt.filter((t) => t.done).length;
                  const state = pt.length && pd === pt.length ? 'done' : now?.phaseIndex === i ? 'current' : '';
                  const isOpen = openPhase === i;
                  return (
                    <div key={i} className={`stage ${state}`}>
                      <span className="stage-dot num" aria-hidden>
                        {state === 'done' ? <Check size={14} /> : i + 1}
                      </span>
                      <div className="stage-body">
                        <button className="phase-head" onClick={() => setOpenPhase(isOpen ? -1 : i)} aria-expanded={isOpen}>
                          <span className="grow">
                            <span className="bold small" style={{ display: 'block' }}>{p.title}</span>
                            <span className="tiny muted">
                              الأسابيع <span className="num">{p.fromWeek}–{p.toWeek}</span> · {formatShort(p.from)} ← {formatShort(p.to)} · <span className="num">{pd}/{pt.length}</span>
                            </span>
                          </span>
                          <ChevronDown size={16} className="dim" style={{ transform: isOpen ? 'rotate(180deg)' : '' }} />
                        </button>
                        <Bar value={pt.length ? (pd / pt.length) * 100 : 0} variant={state === 'done' ? 'green' : ''} className="thin mt-s" />
                        {isOpen && (
                          <div className="col mt-s" style={{ gap: 6 }}>
                            <p className="tiny muted">{p.desc}</p>
                            {Array.from({ length: p.toWeek - p.fromWeek + 1 }, (_, k) => p.fromWeek + k).map((w) => {
                              const ws = addDays(g.plan.startDate, (w - 1) * 7);
                              const we = addDays(ws, 6) > g.plan.endDate ? g.plan.endDate : addDays(ws, 6);
                              const wt = gt.filter((t) => t.date >= ws && t.date <= we);
                              const wd = wt.filter((t) => t.done).length;
                              const wOpen = openWeek === w;
                              return (
                                <div className={`week-block ${now?.week === w ? 'current' : ''}`} key={w}>
                                  <button className="phase-head" onClick={() => setOpenWeek(wOpen ? 0 : w)} aria-expanded={wOpen}>
                                    <span className="grow small">
                                      <b>الأسبوع <span className="num">{w}</span></b> <span className="muted">· {formatShort(ws)} ← {formatShort(we)}</span>
                                    </span>
                                    <span className="tiny num muted">{wd}/{wt.length}</span>
                                    <ChevronDown size={15} className="dim" style={{ transform: wOpen ? 'rotate(180deg)' : '' }} />
                                  </button>
                                  {wOpen && (
                                    <div className="session-list mt-s">
                                      {wt.map((t) => (
                                        <div className={`session ${t.done ? 'done' : ''} ${t.date === T ? 'today' : ''}`} key={t.id}>
                                          <button className={`check ${t.done ? 'on' : ''}`} onClick={() => toggleTask(t.id)} aria-label={t.done ? `إلغاء إكمال ${t.title}` : `إكمال ${t.title}`} aria-pressed={t.done}>
                                            <Check />
                                          </button>
                                          <div className="session-date">
                                            <b>{DAYS[fromKey(t.date).getDay()]}</b>
                                            <span className="tiny muted">{formatShort(t.date)}</span>
                                          </div>
                                          <div className="grow">
                                            <div className="bold small">{t.title.replace(/ — الأسبوع \d+$/, '')}</div>
                                            <div className="session-desc">{(t.desc || '').split('\n').slice(1).join('\n')}</div>
                                          </div>
                                        </div>
                                      ))}
                                      {!wt.length && <p className="tiny muted">أسبوع إجازة</p>}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
          <div className="row mt" style={{ justifyContent: 'flex-end' }}>
            <button
              className="btn btn-sm btn-danger"
              onClick={() => confirm({ title: 'حذف الهدف', body: `سيتم حذف "${g.title}" وكل مهامه (${gt.length} مهمة). تقدر تتراجع مباشرة بعد الحذف.`, danger: true, confirmLabel: 'حذف الهدف ومهامه', onConfirm: () => deleteGoal(g.id) })}
            >
              <Trash2 /> حذف الهدف ومهامه
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export { Target };
