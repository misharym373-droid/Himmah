// واجهة الأهداف ذات الخطة: إنشاء الخطة، الجدول الأسبوعي، المراحل والأسابيع بالتفصيل
import { useMemo, useState } from 'react';
import { Check, Wand2, CalendarDays, ListChecks, ChevronDown, Pencil, Trash2, Coffee, Clock, Sparkles, Target, Scale, TriangleAlert, Shuffle, Utensils, Gauge } from 'lucide-react';
import { useStore, goalProgress } from '../store.js';
import { Modal, Bar, Ring, Switch, useConfirm } from './ui.jsx';
import { IconTile, Glyph } from './Glyph.jsx';
import { AREAS, GOAL_ICONS } from '../config.js';
import { DAYS, dayName, todayKey, addDays, formatShort, diffDays, fromKey, clock12 } from '../lib/date.js';
import { buildGoalPlan, planSessions, detectKind, defaultRestDays, weekOf, INTENSITIES, intensityOf, workDays } from '../lib/goalPlan.js';
import { calcBody, mealsForDay, MEAL_MODES } from '../lib/nutrition.js';
import { monthsFromText } from '../lib/assistant.js';
import { tr, trf, isEn } from '../i18n/index.js';

const DURATIONS = [1, 2, 3, 6, 12];
const monthsLabel = (m) => (isEn() ? (m === 12 ? '1 year' : m === 1 ? '1 month' : `${m} months`) : m === 12 ? 'سنة' : m === 1 ? 'شهر' : m === 2 ? 'شهرين' : `${m} أشهر`);

// ————— إنشاء/تعديل هدف بخطة كاملة —————
const normT = (s) => String(s || '').replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').toLowerCase();
const LOSE_RE = /وزن|تخسيس|نزول|انقاص|نقص|حرق|تنشيف|رشاق|كرش|دهون|lose|weight|fat|slim|cut/;
const GAIN_RE = /ضخام|تضخيم|زياده وزن|زيادة وزن|bulk|gain/;
// "أنقص 20-25 كيلو" => 25
function kgFromText(t) {
  const m = normT(t).match(/(\d+(?:\.\d+)?)\s*(?:(?:-|–|الى|إلى|to|او)\s*(\d+(?:\.\d+)?))?\s*(كيلو|كيلوات|كجم|كغ|كيلوجرام|kg|kilo)/);
  return m ? Math.max(+m[1], +(m[2] || 0)) : null;
}
// شدة الخطة القديمة (قبل خاصية الشدة) حسب عدد أيام العمل
function guessIntensity(g) {
  if (g?.plan?.intensity) return g.plan.intensity;
  if (!g?.plan) return 'medium';
  const n = 7 - (g.plan.restDays?.length || 0);
  const list = g.plan.kind === 'fitness' ? [3, 4, 5, 6] : [4, 5, 6, 7];
  return INTENSITIES[Math.max(0, list.findIndex((d) => d >= n))].key;
}

export function GoalPlanModal({ onClose, goal }) {
  const editing = !!goal?.plan;
  const addGoal = useStore((s) => s.addGoal);
  const profile = useStore((s) => s.profile);
  const [title, setTitle] = useState(goal?.title || '');
  const [months, setMonths] = useState(goal?.months || 3);
  const kind = useMemo(() => detectKind(title), [title]);
  const [intensity, setIntensity] = useState(() => guessIntensity(goal));
  const [rest, setRest] = useState(editing ? goal.plan.restDays : null); // null = افتراضي حسب نوع الهدف والشدة
  const restDays = rest ?? defaultRestDays(kind, intensity);
  const [fixedTime, setFixedTime] = useState(!!goal?.plan?.time);
  const [time, setTime] = useState(goal?.plan?.time || '18:00');
  const [icon, setIcon] = useState(goal?.icon || null);
  // الوزن والأكل (لخطط اللياقة)
  const [bodyOn, setBodyOn] = useState(editing ? !!goal.plan.nutrition : null);
  const bodyActive = kind === 'fitness' && (bodyOn ?? (LOSE_RE.test(normT(title)) || GAIN_RE.test(normT(title))));
  const [body, setBody] = useState(() => goal?.plan?.nutrition?.body || { mode: 'lose', sex: 'm', weight: profile.weight || '', height: profile.height || '', age: profile.age || '', change: '' });
  const [meals, setMeals] = useState(goal?.plan?.nutrition?.meals || '2');
  const setB = (k, v) => setBody((b) => ({ ...b, [k]: v }));
  const days = Math.max(7, Math.round(months * 30.4));
  const calc = useMemo(() => (bodyActive ? calcBody(body, { days, intensity }) : null), [bodyActive, body, days, intensity]);
  const nutrition = calc ? { body, meals, ...calc } : null;
  const plan = useMemo(
    () => (title.trim().length > 2 ? buildGoalPlan({ title, months, restDays, time: fixedTime ? time : null, intensity, nutrition, ...(editing ? { startDate: goal.plan.startDate } : {}) }) : null),
    [title, months, restDays, fixedTime, time, intensity, JSON.stringify(nutrition), editing] // eslint-disable-line
  );
  const T = todayKey();
  const sessions = useMemo(() => (plan ? planSessions(plan, title, editing ? T : plan.startDate) : []), [plan, title, editing, T]);

  function onTitle(v) {
    setTitle(v);
    if (/شهر|اشهر|أشهر|شهور|سنة|سنه|عام/.test(v)) setMonths(Math.max(1, Math.min(12, monthsFromText(v))));
    // English: "in 3 months", "for 6 months", "a year", "12 weeks"
    const en = v.toLowerCase().match(/(\d+)\s*(months?|weeks?|years?)\b/);
    if (en) setMonths(Math.max(1, Math.min(12, en[2].startsWith('year') ? 12 * +en[1] : en[2].startsWith('week') ? Math.round(+en[1] / 4.3) || 1 : +en[1])));
    else if (/\b(a|one) year\b/i.test(v)) setMonths(12);
    const kg = kgFromText(v);
    if (kg) setB('change', kg);
    if (GAIN_RE.test(normT(v))) setB('mode', 'gain');
  }
  function toggleRest(d) {
    const cur = restDays.includes(d) ? restDays.filter((x) => x !== d) : [...restDays, d];
    if (cur.length >= 7) return;
    setRest(cur);
  }
  function pickIntensity(k) {
    setIntensity(k);
    setRest(null);
  }
  function save() {
    if (!plan) return;
    const st = useStore.getState();
    if (nutrition) {
      const p = {};
      for (const k of ['weight', 'height', 'age']) if (body[k] && String(profile[k]) !== String(body[k])) p[k] = body[k];
      if (Object.keys(p).length) st.setProfile(p);
    }
    if (editing) {
      const n = st.replanGoal(goal.id, { plan });
      st.updateGoal(goal.id, { months, ...(icon ? { icon } : {}) });
      st.toast(trf('تم تحديث الخطة: {n} جلسة قادمة', { n }), { icon: 'check' });
      return onClose(goal);
    }
    const g = addGoal({ title: title.trim().replace(/\s*(خلال|لمدة|in|for|within)\s+\d.*$/i, '').replace(/\s*(خلال|لمدة)\s.*$/, '') || title.trim(), months, area: plan.area, icon: icon || plan.icon, plan });
    st.toast(trf('تم إنشاء الهدف وخطته: {n} جلسة حتى {date}', { n: sessions.length, date: formatShort(plan.endDate) }), { icon: 'sparkles' });
    onClose(g);
  }
  const suggestMonths = calc?.tooFast && calc.weeksNeeded ? Math.min(12, Math.ceil(calc.weeksNeeded / 4.3)) : null;

  return (
    <Modal
      title={editing ? tr('تعديل الخطة') : tr('هدف جديد')}
      sub={editing ? tr('غيّر الشدة أو أيام الإجازة أو هدف الوزن — يُطبَّق على الأيام القادمة، والجلسات المنجزة تبقى') : tr('اكتب هدفك، واختر المدة وأيام الإجازة — ومسار يبني لك جدولًا يوميًا مفصلًا لكل المدة')}
      onClose={() => onClose()}
      size="xl"
      footer={
        <>
          <button className="btn btn-ghost" onClick={() => onClose()}>
            {tr('إلغاء')}
          </button>
          <button className="btn btn-primary" onClick={save} disabled={!plan}>
            <Check />{' '}
            {editing
              ? tr('حفظ التعديلات')
              : isEn()
                ? <>Create goal and {sessions.length ? <span className="num">{sessions.length}</span> : ''} tasks</>
                : <>إنشاء الهدف و{sessions.length ? <span className="num">{sessions.length}</span> : ''} مهمة</>}
          </button>
        </>
      }
    >
      <div className="col" style={{ gap: 18 }}>
        <label className="field">
          <span>{tr('الهدف')}</span>
          <input className="input" value={title} onChange={(e) => onTitle(e.target.value)} placeholder={tr('مثال: أنقص 10 كيلو وأبني عضل خلال 3 شهور')} autoFocus={!editing} disabled={editing} />
          {plan && (
            <span className="tiny muted">
              <Sparkles size={12} style={{ verticalAlign: -2 }} /> {tr('نوع الخطة:')} <b>{plan.label}</b>
            </span>
          )}
        </label>
        <div className="field">
          <span>{tr('شدة الخطة')}</span>
          <div className="int-grid">
            {INTENSITIES.map((it) => {
              const n = workDays(kind, it.key);
              const dur = Math.round(((plan?.duration || 60) / intensityOf(intensity).factor) * it.factor / 5) * 5;
              return (
                <button key={it.key} className={`int-opt ${intensity === it.key ? 'on' : ''}`} onClick={() => pickIntensity(it.key)} aria-pressed={intensity === it.key}>
                  <span className="int-bars" aria-hidden>
                    {[0, 1, 2, 3].map((b) => (
                      <i key={b} className={b <= INTENSITIES.indexOf(it) ? 'on' : ''} />
                    ))}
                  </span>
                  <b className="small">{tr(it.label)}</b>
                  <span className="tiny muted">{trf('{n} أيام/أسبوع · ~{m} د', { n, m: dur })}</span>
                </button>
              );
            })}
          </div>
        </div>
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
        {kind === 'fitness' && (
          <div className="body-box">
            <div className="set-row" style={{ padding: 0, borderBottom: 0 }}>
              <div className="grow">
                <div className="t row" style={{ gap: 6 }}>
                  <Scale size={16} /> {tr('هدف الوزن والأكل')}
                </div>
                <div className="d">{tr('نحسب سعراتك اليومية بأمان ونرتب لك وجبات بسيطة ورخيصة')}</div>
              </div>
              <Switch on={bodyActive} onChange={setBodyOn} label={tr('هدف الوزن والأكل')} />
            </div>
            {bodyActive && (
              <div className="col mt" style={{ gap: 14 }}>
                <div className="row wrap" style={{ gap: 14 }}>
                  <div className="chips">
                    {[['lose', 'إنقاص الوزن'], ['gain', 'زيادة عضل ووزن'], ['keep', 'ثبات الوزن']].map(([k, l]) => (
                      <button key={k} className={`chip ${body.mode === k ? 'on' : ''}`} onClick={() => setB('mode', k)}>
                        {tr(l)}
                      </button>
                    ))}
                  </div>
                  <div className="chips">
                    {[['m', 'ذكر'], ['f', 'أنثى']].map(([k, l]) => (
                      <button key={k} className={`chip ${body.sex === k ? 'on' : ''}`} onClick={() => setB('sex', k)}>
                        {tr(l)}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="body-inputs">
                  <label className="field">
                    <span>{tr('وزنك الحالي (كجم)')}</span>
                    <input className="input num" type="number" inputMode="decimal" min="35" max="300" value={body.weight} onChange={(e) => setB('weight', e.target.value)} />
                  </label>
                  <label className="field">
                    <span>{tr('الطول (سم)')}</span>
                    <input className="input num" type="number" inputMode="numeric" min="120" max="230" value={body.height} onChange={(e) => setB('height', e.target.value)} />
                  </label>
                  <label className="field">
                    <span>{tr('العمر')}</span>
                    <input className="input num" type="number" inputMode="numeric" min="13" max="90" value={body.age} onChange={(e) => setB('age', e.target.value)} />
                  </label>
                  {body.mode !== 'keep' && (
                    <label className="field">
                      <span>{body.mode === 'lose' ? tr('كم تبغى تنزل؟ (كجم)') : tr('كم تبغى تزيد؟ (كجم)')}</span>
                      <input className="input num" type="number" inputMode="decimal" min="0" max="80" value={body.change} onChange={(e) => setB('change', e.target.value)} placeholder={tr('اختياري')} />
                    </label>
                  )}
                </div>
                {!calc ? (
                  <p className="small muted">{tr('اكتب وزنك وطولك وعمرك عشان نحسب سعراتك.')}</p>
                ) : (
                  <>
                    <div className="kpis">
                      <div className="mini-stat">
                        <div className="v num">{calc.calories.toLocaleString('en')}</div>
                        <div className="l">{tr('سعرة باليوم')}</div>
                      </div>
                      <div className="mini-stat">
                        <div className="v num">{calc.protein}</div>
                        <div className="l">{tr('جم بروتين')}</div>
                      </div>
                      <div className="mini-stat">
                        <div className="v num">{calc.water}</div>
                        <div className="l">{tr('لتر ماء')}</div>
                      </div>
                      <div className="mini-stat">
                        <div className="v num">{calc.steps.toLocaleString('en')}</div>
                        <div className="l">{tr('خطوة باليوم')}</div>
                      </div>
                    </div>
                    <p className="tiny muted">{trf('حرقك اليومي التقريبي مع التمرين: {n} سعرة', { n: calc.tdee.toLocaleString('en') })}</p>
                    {body.mode === 'lose' &&
                      (calc.tooFast ? (
                        <div className="notice warn">
                          <TriangleAlert size={18} />
                          <div className="grow small" style={{ minWidth: 220 }}>
                            {trf('نزول {change} كجم في {months} يحتاج {rate} كجم بالأسبوع، وهذا أسرع من الآمن لجسمك (الحد الآمن لك تقريبًا {safe} كجم/أسبوع). الخطة الآمنة توصلك تقريبًا {expected} كجم في هالمدة، وتكمل الباقي بعدها.', { change: body.change, months: monthsLabel(months), rate: calc.requiredRate, safe: calc.safeRate, expected: calc.expected })}
                          </div>
                          {suggestMonths && suggestMonths > months && (
                            <button className="btn btn-xs" onClick={() => setMonths(suggestMonths)}>
                              {trf('خلّ المدة {m}', { m: monthsLabel(suggestMonths) })}
                            </button>
                          )}
                        </div>
                      ) : (
                        <div className="notice">
                          <Check size={18} className="green" />
                          <span className="small">{trf('المتوقع تنزل تقريبًا {expected} كجم بهالمدة — معدل آمن.', { expected: calc.expected })}</span>
                        </div>
                      ))}
                    <div className="field">
                      <span>{tr('عدد الوجبات')}</span>
                      <div className="chips">
                        {MEAL_MODES.map(([k, l]) => (
                          <button key={k} className={`chip ${meals === k ? 'on' : ''}`} onClick={() => setMeals(k)}>
                            {tr(l)}
                          </button>
                        ))}
                      </div>
                    </div>
                    {plan && <MealDay plan={plan} date={editing && T > plan.startDate ? T : plan.startDate} />}
                    <p className="tiny dim">{tr('الأرقام تقريبية وليست استشارة طبية. إذا عندك سكر أو ضغط أو أي مرض مزمن، استشر طبيب قبل الدايت.')}</p>
                  </>
                )}
              </div>
            )}
          </div>
        )}
        <div className="set-row" style={{ padding: '2px 0', borderBottom: 0 }}>
          <div className="grow">
            <div className="t">{tr('وقت ثابت للجلسة')}</div>
            <div className="d">{tr('بدونه تكون مهام الخطة «طوال اليوم» وتنجزها متى ما ناسبك')}</div>
          </div>
          {fixedTime && <input className="input" type="time" style={{ width: 130 }} value={time} onChange={(e) => setTime(e.target.value)} aria-label={tr('وقت الجلسة')} />}
          <Switch on={fixedTime} onChange={setFixedTime} label={tr('وقت ثابت للجلسة')} />
        </div>
        {!editing && (
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
        )}
        {plan ? <PlanPreview plan={plan} sessions={sessions} /> : <p className="small muted">{tr('اكتب هدفك لتظهر الخطة المقترحة هنا مباشرة.')}</p>}
      </div>
    </Modal>
  );
}

// وجبات يوم واحد (مع زر تبديل كل وجبة)
export function MealDay({ plan, date, onSwap, compact }) {
  const day = mealsForDay(plan, date);
  if (!day) return null;
  return (
    <div className={`meal-day ${compact ? 'compact' : ''}`}>
      {day.meals.map((m) => (
        <div className="meal" key={m.key}>
          <div className="row between" style={{ gap: 8 }}>
            <span className="tiny muted bold">{m.label}</span>
            <span className="tiny muted num">
              {m.kcal} {tr('سعرة')} · {m.protein} {tr('جم بروتين')}
            </span>
          </div>
          <div className="row between" style={{ gap: 8, alignItems: 'flex-start' }}>
            <div className="grow" style={{ minWidth: 0 }}>
              <div className="bold small">{m.name}</div>
              <div className="tiny muted meal-items">{m.items.join(' + ')}</div>
            </div>
            {onSwap && (
              <button className="btn btn-xs btn-ghost" onClick={() => onSwap(m.key)} aria-label={trf('بدّل {meal}', { meal: m.label })}>
                <Shuffle size={13} /> {tr('بدّل')}
              </button>
            )}
          </div>
        </div>
      ))}
      {day.gap > 0 && <div className="tiny gold">{trf('باقي لك ~{n} سعرة: أضف سناك (تمر وحليب، زبادي، أو حفنة مكسرات) عشان ما تنزل تحت الحد الآمن.', { n: day.gap })}</div>}
      <div className="tiny muted num">
        {trf('المجموع: ~{kcal} سعرة · {p} جم بروتين (هدفك {target})', { kcal: day.kcal.toLocaleString('en'), p: day.protein, target: day.target.toLocaleString('en') })}
      </div>
    </div>
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
  const [editPlan, setEditPlan] = useState(false);
  const n = g.plan.nutrition;
  const mealDate = T < g.plan.startDate ? g.plan.startDate : T;

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
            {g.plan.intensity && (
              <span className="meta-item">
                <Gauge size={13} /> {trf('شدة {level}', { level: tr(intensityOf(g.plan.intensity).label) })}
              </span>
            )}
            {n?.calories && (
              <span className="meta-item">
                <Utensils size={13} /> <span className="num">{n.calories.toLocaleString('en')}</span> {tr('سعرة باليوم')}
              </span>
            )}
          </div>
        </div>
      </div>
      {!open && (
        <div className="row wrap mt" style={{ gap: 8 }}>
          <button className="btn btn-sm btn-ghost" onClick={onToggle}>
            {tr('عرض الخطة بالتفصيل')}
          </button>
          <button className="btn btn-sm" onClick={() => setEditPlan(true)}>
            <Pencil size={14} /> {tr('تعديل الخطة')}
          </button>
        </div>
      )}
      {editPlan && <GoalPlanModal goal={g} onClose={() => setEditPlan(false)} />}
      {open && (
        <div className="mt">
          {n?.calories && mealDate <= g.plan.endDate && (
            <div className="meals-box mb">
              <div className="row between wrap" style={{ gap: 6, marginBottom: 10 }}>
                <div className="bold row" style={{ gap: 6 }}>
                  <Utensils size={16} /> {mealDate === T ? tr('وجبات اليوم') : trf('وجبات {date}', { date: formatShort(mealDate) })}
                </div>
                <span className="tiny muted">{tr('بسيطة ورخيصة — اضغط «بدّل» إذا ما تبغاها')}</span>
              </div>
              <MealDay plan={g.plan} date={mealDate} onSwap={(slot) => useStore.getState().swapMeal(g.id, mealDate, slot)} />
            </div>
          )}
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
          <div className="row mt" style={{ justifyContent: 'flex-end', gap: 8 }}>
            <button className="btn btn-sm" onClick={() => setEditPlan(true)}>
              <Pencil size={14} /> {tr('تعديل الخطة')}
            </button>
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

// بطاقة الرئيسية: وجبات اليوم من خطة اللياقة الفعّالة
export function MealsToday({ span = 'span-12' }) {
  const goals = useStore((s) => s.goals);
  const swapMeal = useStore((s) => s.swapMeal);
  const T = todayKey();
  const g = goals.find((x) => x.plan?.nutrition?.calories && T >= x.plan.startDate && T <= x.plan.endDate);
  if (!g) return null;
  return (
    <div className={`card ${span} meals-card`}>
      <div className="row between wrap" style={{ gap: 8, marginBottom: 12 }}>
        <span className="card-title" style={{ margin: 0 }}>
          <span className="ico">
            <Utensils size={17} />
          </span>
          {tr('وجبات اليوم')}
        </span>
        <span className="small muted">
          <span className="num">{g.plan.nutrition.calories.toLocaleString('en')}</span> {tr('سعرة')} · {g.title}
        </span>
      </div>
      <MealDay plan={g.plan} date={T} onSwap={(slot) => swapMeal(g.id, T, slot)} compact />
    </div>
  );
}

export { Target };
