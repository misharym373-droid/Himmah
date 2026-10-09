// واجهة الأهداف ذات الخطة: إنشاء الخطة، الجدول الأسبوعي، المراحل والأسابيع بالتفصيل
import { useMemo, useState } from 'react';
import { Check, Wand2, CalendarDays, ListChecks, ChevronDown, Pencil, Trash2, Coffee, Clock, Sparkles, Target } from 'lucide-react';
import { useStore, goalProgress } from '../store.js';
import { Modal, Bar, Ring, Switch, useConfirm } from './ui.jsx';
import { IconTile, Glyph } from './Glyph.jsx';
import { AREAS, GOAL_ICONS } from '../config.js';
import { DAYS, dayName, todayKey, addDays, formatShort, diffDays, fromKey, clock12 } from '../lib/date.js';
import { buildGoalPlan, planSessions, detectKind, defaultRestDays, weekOf } from '../lib/goalPlan.js';
import { monthsFromText } from '../lib/assistant.js';
import { tr, trf, isEn } from '../i18n/index.js';

const DURATIONS = [1, 2, 3, 6, 12];
const monthsLabel = (m) => (isEn() ? (m === 12 ? '1 year' : m === 1 ? '1 month' : `${m} months`) : m === 12 ? 'سنة' : m === 1 ? 'شهر' : m === 2 ? 'شهرين' : `${m} أشهر`);

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
    // English: "in 3 months", "for 6 months", "a year", "12 weeks"
    const en = v.toLowerCase().match(/(\d+)\s*(months?|weeks?|years?)\b/);
    if (en) setMonths(Math.max(1, Math.min(12, en[2].startsWith('year') ? 12 * +en[1] : en[2].startsWith('week') ? Math.round(+en[1] / 4.3) || 1 : +en[1])));
    else if (/\b(a|one) year\b/i.test(v)) setMonths(12);
  }
  function toggleRest(d) {
    const cur = restDays.includes(d) ? restDays.filter((x) => x !== d) : [...restDays, d];
    if (cur.length >= 7) return;
    setRest(cur);
  }
  function save() {
    if (!plan) return;
    const g = addGoal({ title: title.trim().replace(/\s*(خلال|لمدة|in|for|within)\s+\d.*$/i, '').replace(/\s*(خلال|لمدة)\s.*$/, '') || title.trim(), months, area: plan.area, icon: icon || plan.icon, plan });
    useStore.getState().toast(trf('تم إنشاء الهدف وخطته: {n} جلسة حتى {date}', { n: sessions.length, date: formatShort(plan.endDate) }), { icon: 'sparkles' });
    onClose(g);
  }

  return (
    <Modal
      title={tr('هدف جديد')}
      sub={tr('اكتب هدفك، واختر المدة وأيام الإجازة — ومسار يبني لك جدولًا يوميًا مفصلًا لكل المدة')}
      onClose={() => onClose()}
      size="xl"
      footer={
        <>
          <button className="btn btn-ghost" onClick={() => onClose()}>
            {tr('إلغاء')}
          </button>
          <button className="btn btn-primary" onClick={save} disabled={!plan}>
            <Check /> {isEn() ? <>Create goal and {sessions.length ? <span className="num">{sessions.length}</span> : ''} tasks</> : <>إنشاء الهدف و{sessions.length ? <span className="num">{sessions.length}</span> : ''} مهمة</>}
          </button>
        </>
      }
    >
      <div className="col" style={{ gap: 18 }}>
        <label className="field">
          <span>{tr('الهدف')}</span>
          <input className="input" value={title} onChange={(e) => onTitle(e.target.value)} placeholder={tr('مثال: النادي — إنقاص الوزن وبناء العضل')} autoFocus />
          {plan && (
            <span className="tiny muted">
              <Sparkles size={12} style={{ verticalAlign: -2 }} /> {tr('نوع الخطة:')} <b>{plan.label}</b>
            </span>
          )}
        </label>
        <div className="grid g2">
          <div className="field">
            <span>{tr('المدة')}</span>
            <div className="chips">
              {DURATIONS.map((m) => (
                <button key={m} className={`chip ${months === m ? 'on' : ''}`} onClick={() => setMonths(m)}>
                  {monthsLabel(m)}
                </button>
              ))}
            </div>
          </div>
          <div className="field">
            <span>{tr('أيام الإجازة (بدون مهام)')}</span>
            <div className="chips">
              {DAYS.map((d, i) => (
                <button key={d} className={`chip ${restDays.includes(i) ? 'on' : ''}`} onClick={() => toggleRest(i)} aria-pressed={restDays.includes(i)}>
                  {restDays.includes(i) && <Coffee size={13} />} {dayName(i)}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="set-row" style={{ padding: '2px 0', borderBottom: 0 }}>
          <div className="grow">
            <div className="t">{tr('وقت ثابت للجلسة')}</div>
            <div className="d">{tr('بدونه تكون مهام الخطة «طوال اليوم» وتنجزها متى ما ناسبك')}</div>
          </div>
          {fixedTime && <input className="input" type="time" style={{ width: 130 }} value={time} onChange={(e) => setTime(e.target.value)} aria-label={tr('وقت الجلسة')} />}
          <Switch on={fixedTime} onChange={setFixedTime} label={tr('وقت ثابت للجلسة')} />
        </div>
        <div className="field">
          <span>{tr('الأيقونة')}</span>
          <div className="chips">
            {GOAL_ICONS.map((i) => (
              <button key={i} className={`chip icon-chip ${(icon || plan?.icon) === i ? 'on' : ''}`} onClick={() => setIcon(i)} aria-label={i}>
                <Glyph name={i} size={17} />
              </button>
            ))}
          </div>
        </div>
        {plan ? <PlanPreview plan={plan} sessions={sessions} /> : <p className="small muted">{tr('اكتب هدفك لتظهر الخطة المقترحة هنا مباشرة.')}</p>}
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
          <CalendarDays size={12} /> {formatShort(plan.startDate)} {isEn() ? '→' : '←'} {formatShort(plan.endDate)}
        </span>
        <span className="badge">
          {isEn() ? <><span className="num">{plan.totalWeeks}</span> weeks</> : <><span className="num">{plan.totalWeeks}</span> أسبوع</>}
        </span>
        <span className="badge green">
          <ListChecks size={12} /> <span className="num">{sessions.length}</span> {isEn() ? 'sessions' : 'جلسة'}
        </span>
        <span className="badge gold">
          <Coffee size={12} /> {tr('إجازة:')} {plan.restDays.length ? plan.restDays.map((d) => dayName(d)).join(isEn() ? ', ' : '، ') : tr('لا يوجد')}
        </span>
      </div>
      <div className="dash" style={{ marginTop: 14 }}>
        <div className="span-5">
          <div className="bold small mb">{tr('الجدول الأسبوعي')}</div>
          <WeeklyTable weekly={plan.weekly} />
        </div>
        <div className="span-7">
          <div className="bold small mb">{tr('المراحل')}</div>
          <div className="stage-list">
            {plan.phases.map((p, i) => (
              <div className="stage" key={i}>
                <span className="stage-dot num">{i + 1}</span>
                <div className="stage-body">
                  <div className="bold small">{p.title}</div>
                  <div className="tiny muted">
                    {tr('الأسابيع')} <span className="num">{p.fromWeek}–{p.toWeek}</span> · {formatShort(p.from)} {isEn() ? '→' : '←'} {formatShort(p.to)}
                  </div>
                  <div className="tiny dim">{p.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="bold small mt mb">{tr('الأسبوع الأول بالتفصيل')}</div>
      <div className="session-list">
        {firstWeek.map((s) => (
          <div className="session" key={s.date}>
            <div className="session-date">
              <b>{dayName(fromKey(s.date).getDay())}</b>
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
          <span className="wt-day">{dayName(d.dow)}</span>
          {editable ? (
            <>
              <input className="input wt-input" value={d.rest ? '' : d.focus} disabled={d.rest} placeholder={d.rest ? tr('إجازة') : ''} onChange={(e) => onChange(d.dow, { focus: e.target.value })} aria-label={trf('تركيز يوم {day}', { day: dayName(d.dow) })} />
              <button className={`chip chip-xs ${d.rest ? 'on' : ''}`} onClick={() => onChange(d.dow, { rest: !d.rest })}>
                {d.rest ? tr('إجازة') : tr('عمل')}
              </button>
            </>
          ) : (
            <span className="wt-focus">{d.rest ? <><Coffee size={13} /> {tr('إجازة')}</> : d.focus}</span>
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
    const n = replanGoal(g.id, { weekly: draft.map((d) => ({ ...d, focus: d.rest ? tr('إجازة') : d.focus.trim() || tr('جلسة'), key: d.key || 'do' })) });
    setEditing(false);
    useStore.getState().toast(trf('طُبّق الجدول الجديد على {n} يومًا قادمًا', { n }), { icon: 'check' });
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
            <button className="icon-btn sm plain" onClick={onToggle} aria-label={open ? tr('إخفاء تفاصيل الهدف') : tr('عرض خطة الهدف')} aria-expanded={open}>
              <ChevronDown style={{ transform: open ? 'rotate(180deg)' : '', transition: 'transform .25s' }} />
            </button>
          </div>
          <div className="goal-now mt-s">
            <div className="small">
              <span className="muted">{now ? trf('الأسبوع {w} · المرحلة {p}: ', { w: now.week, p: now.phaseIndex + 1 }) : T < g.plan.startDate ? tr('تبدأ الخطة ') : tr('انتهت مدة الخطة')}</span>
              <b>{now ? now.phase.title : T < g.plan.startDate ? formatShort(g.plan.startDate) : ''}</b>
            </div>
            <div className="small">
              <span className="muted">{tr('اليوم:')} </span>
              {todayTask ? (
                <>
                  {todayTask.title.replace(/ — (الأسبوع|Week) \d+$/, '')} {todayTask.done && <span className="badge green">{tr('تم')}</span>}
                </>
              ) : (
                tr('إجازة')
              )}
            </div>
          </div>
          <div className="row wrap tiny muted mt-s" style={{ gap: 12 }}>
            <span className="meta-item">
              <CalendarDays size={13} /> {formatShort(g.plan.startDate)} {isEn() ? '→' : '←'} {formatShort(g.plan.endDate)} ({left >= 0 ? (isEn() ? <><span className="num">{left}</span> days left</> : <>باقي <span className="num">{left}</span> يوم</>) : tr('انتهت')})
            </span>
            <span className="meta-item">
              <ListChecks size={13} /> <span className="num">{done}/{gt.length}</span> {isEn() ? 'sessions' : 'جلسة'}
            </span>
            {g.plan.time && (
              <span className="meta-item">
                <Clock size={13} /> <span className="num">{clock12(g.plan.time)}</span>
              </span>
            )}
          </div>
        </div>
      </div>
      {!open && (
        <button className="btn btn-sm btn-ghost mt" onClick={onToggle}>
          {tr('عرض الخطة بالتفصيل')}
        </button>
      )}
      {open && (
        <div className="mt">
          <div className="dash" style={{ marginTop: 6 }}>
            <div className="span-4">
              <div className="row between mb">
                <div className="bold">{tr('الجدول الأسبوعي')}</div>
                {!editing ? (
                  <button className="btn btn-xs" onClick={() => (setDraft(g.plan.weekly), setEditing(true))}>
                    <Pencil size={13} /> {tr('تعديل')}
                  </button>
                ) : null}
              </div>
              <WeeklyTable weekly={editing ? draft : g.plan.weekly} editable={editing} onChange={(dow, patch) => setDraft(draft.map((d) => (d.dow === dow ? { ...d, ...patch, key: d.key || 'do' } : d)))} />
              {editing && (
                <div className="col mt-s" style={{ gap: 8 }}>
                  <p className="tiny muted">{tr('التعديل يُطبَّق على كل الأيام القادمة حتى نهاية الخطة. الجلسات المنجزة تبقى كما هي.')}</p>
                  <div className="row">
                    <button className="btn btn-sm btn-primary" onClick={applyWeekly}>
                      <Check /> {tr('تطبيق على كل الأيام')}
                    </button>
                    <button className="btn btn-sm btn-ghost" onClick={() => setEditing(false)}>
                      {tr('إلغاء')}
                    </button>
                  </div>
                </div>
              )}
              {g.plan.tips?.length > 0 && (
                <div className="mt">
                  <div className="bold small mb">{tr('نصائح الخطة')}</div>
                  <ul className="tips">
                    {g.plan.tips.map((t) => (
                      <li key={t}>{t}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            <div className="span-8">
              <div className="bold mb">{tr('المراحل والأسابيع')}</div>
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
                              {tr('الأسابيع')} <span className="num">{p.fromWeek}–{p.toWeek}</span> · {formatShort(p.from)} {isEn() ? '→' : '←'} {formatShort(p.to)} · <span className="num">{pd}/{pt.length}</span>
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
                                      <b>{tr('الأسبوع')} <span className="num">{w}</span></b> <span className="muted">· {formatShort(ws)} {isEn() ? '→' : '←'} {formatShort(we)}</span>
                                    </span>
                                    <span className="tiny num muted">{wd}/{wt.length}</span>
                                    <ChevronDown size={15} className="dim" style={{ transform: wOpen ? 'rotate(180deg)' : '' }} />
                                  </button>
                                  {wOpen && (
                                    <div className="session-list mt-s">
                                      {wt.map((t) => (
                                        <div className={`session ${t.done ? 'done' : ''} ${t.date === T ? 'today' : ''}`} key={t.id}>
                                          <button className={`check ${t.done ? 'on' : ''}`} onClick={() => toggleTask(t.id)} aria-label={t.done ? trf('إلغاء إكمال {title}', { title: t.title }) : trf('إكمال {title}', { title: t.title })} aria-pressed={t.done}>
                                            <Check />
                                          </button>
                                          <div className="session-date">
                                            <b>{dayName(fromKey(t.date).getDay())}</b>
                                            <span className="tiny muted">{formatShort(t.date)}</span>
                                          </div>
                                          <div className="grow">
                                            <div className="bold small">{t.title.replace(/ — (الأسبوع|Week) \d+$/, '')}</div>
                                            <div className="session-desc">{(t.desc || '').split('\n').slice(1).join('\n')}</div>
                                          </div>
                                        </div>
                                      ))}
                                      {!wt.length && <p className="tiny muted">{tr('أسبوع إجازة')}</p>}
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
              onClick={() => confirm({ title: tr('حذف الهدف'), body: trf('سيتم حذف "{title}" وكل مهامه ({n} مهمة). تقدر تتراجع مباشرة بعد الحذف.', { title: g.title, n: gt.length }), danger: true, confirmLabel: tr('حذف الهدف ومهامه'), onConfirm: () => deleteGoal(g.id) })}
            >
              <Trash2 /> {tr('حذف الهدف ومهامه')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export { Target };
