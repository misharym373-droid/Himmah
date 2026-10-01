import { useState, useEffect, useMemo } from 'react';
import { Target, Plus, Sparkles, Trash2, Minus, Check, ChevronDown, CalendarDays, Clock, ListChecks, Wand2, ArrowLeft } from 'lucide-react';
import { useStore, goalProgress } from '../store.js';
import { useRoute, navigate } from '../router.js';
import { Modal, Bar, Ring, Empty, CardTitle, useConfirm } from '../components/ui.jsx';
import TaskItem from '../components/TaskItem.jsx';
import { goalBreakdown, monthsFromText } from '../lib/assistant.js';
import { AREAS, GOAL_ICONS } from '../config.js';
import { todayKey, addDays, formatShort, diffDays, timeAgo } from '../lib/date.js';
import { Glyph, IconTile } from '../components/Glyph.jsx';

export default function Goals() {
  const { params } = useRoute();
  const goals = useStore((s) => s.goals);
  const tasks = useStore((s) => s.tasks);
  const [creating, setCreating] = useState(params.new === '1');
  const [openId, setOpenId] = useState(null);
  useEffect(() => {
    if (params.new === '1') navigate('goals');
  }, [params.new]);
  return (
    <>
      <div className="page-head">
        <div>
          <h1>
            <span className="ico">
              <Target />
            </span>
            أهدافي
          </h1>
          <p>كل هدف يتحول إلى مراحل، ثم أسابيع، ثم مهام يومية — وتقدمك يُحسب تلقائيًا</p>
        </div>
        <button className="btn btn-primary" onClick={() => setCreating(true)}>
          <Plus /> هدف جديد
        </button>
      </div>
      {!goals.length ? (
        <div className="card">
          <Empty icon={<Target />} title="ما الشيء الذي تريد الوصول إليه؟" text="اكتب هدفك، وهّمة يقسمه لخطة واضحة." action={<button className="btn btn-primary" onClick={() => setCreating(true)}><Plus /> إنشاء هدف</button>} />
        </div>
      ) : (
        <div className="grid g2">
          {goals.map((g, i) => (
            <GoalCard key={g.id} g={g} tasks={tasks} open={openId === g.id} onToggle={() => setOpenId(openId === g.id ? null : g.id)} delay={i} />
          ))}
        </div>
      )}
      {creating && <GoalModal onClose={() => setCreating(false)} />}
    </>
  );
}

function GoalCard({ g, tasks, open, onToggle, delay }) {
  const { stepMilestone, deleteGoal, addMilestone, removeMilestone, openModal } = useStore.getState();
  const confirm = useConfirm();
  const [ms, setMs] = useState('');
  const pct = goalProgress(g, tasks);
  const gt = useMemo(() => tasks.filter((t) => t.goalId === g.id && !t.deletedAt && !t.template), [tasks, g.id]);
  const done = gt.filter((t) => t.done).length;
  const openTasks = gt.filter((t) => !t.done).sort((a, b) => (a.date < b.date ? -1 : 1));
  const left = diffDays(g.deadline, todayKey());
  const currentIdx = g.milestones.findIndex((m) => m.done < m.total);
  const current = g.milestones[currentIdx];
  const weekLabel = (m, k) => m.weeks?.[k]?.replace(/^الأسبوع \d+: /, '') || `الخطوة ${k + 1}`;
  const nextMilestone = current ? weekLabel(current, current.done) : null;
  const color = AREAS[g.area]?.color || 'var(--primary)';
  return (
    <div className={`card reveal ${open ? 'glow' : 'hover'}`} style={{ animationDelay: `${delay * 0.05}s`, gridColumn: open ? '1 / -1' : undefined }}>
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
              <span className="muted">المرحلة الحالية: </span>
              <b>{current ? `${currentIdx + 1}. ${current.title}` : 'كل المراحل مكتملة'}</b>
            </div>
            {nextMilestone && (
              <div className="small">
                <span className="muted">الإنجاز القادم: </span>
                {nextMilestone}
              </div>
            )}
          </div>
          <div className="row wrap tiny muted mt-s" style={{ gap: 12 }}>
            <span className="meta-item">
              <CalendarDays size={13} /> {formatShort(g.deadline)} ({left >= 0 ? <>باقي <span className="num">{left}</span> يوم</> : 'انتهى الموعد'})
            </span>
            <span className="meta-item">
              <ListChecks size={13} /> <span className="num">{done}/{gt.length}</span> مهام مرتبطة
            </span>
            <span className="meta-item">
              <Clock size={13} /> آخر نشاط {timeAgo(g.lastActivity)}
            </span>
          </div>
        </div>
      </div>
      {!open && (
        <button className="btn btn-sm btn-ghost mt" onClick={onToggle}>
          عرض الخطة والمهام
        </button>
      )}
      {open && (
        <div className="mt">
          <div className="goal-flow" aria-label="هيكل الهدف">
            <span>الهدف</span>
            <ArrowLeft size={12} />
            <span>المراحل</span>
            <ArrowLeft size={12} />
            <span>الأسابيع</span>
            <ArrowLeft size={12} />
            <span>المهام</span>
            <ArrowLeft size={12} />
            <span className="purple bold num">{pct}%</span>
          </div>
          <div className="dash" style={{ marginTop: 16 }}>
            <div className="span-7">
              <div className="bold mb">المراحل</div>
              <div className="stage-list">
                {g.milestones.map((m, i) => {
                  const state = m.done >= m.total ? 'done' : i === currentIdx ? 'current' : '';
                  return (
                    <div key={m.id} className={`stage ${state}`}>
                      <span className="stage-dot num" aria-hidden>
                        {state === 'done' ? <Check size={14} /> : i + 1}
                      </span>
                      <div className="stage-body">
                        <div className="row between">
                          <span className="bold small">{m.title}</span>
                          <span className="row" style={{ gap: 4 }}>
                            <span className="tiny muted num">
                              {m.done}/{m.total}
                            </span>
                            <button className="icon-btn sm plain" aria-label={`تراجع خطوة في ${m.title}`} onClick={() => stepMilestone(g.id, m.id, -1)} disabled={m.done <= 0}>
                              <Minus />
                            </button>
                            <button className="icon-btn sm" aria-label={`أنجزت خطوة في ${m.title}`} onClick={() => stepMilestone(g.id, m.id, 1)} disabled={m.done >= m.total}>
                              <Check />
                            </button>
                            <button className="icon-btn sm plain" aria-label={`حذف المرحلة ${m.title}`} onClick={() => removeMilestone(g.id, m.id)}>
                              <Trash2 />
                            </button>
                          </span>
                        </div>
                        <Bar value={(m.done / m.total) * 100} variant={state === 'done' ? 'green' : ''} className="thin mt-s" />
                        {(state === 'current' || m.total <= 4) && (
                          <div className="week-pills">
                            {Array.from({ length: m.total }).map((_, k) => (
                              <span key={k} className={`week-pill ${k < m.done ? 'done' : k === m.done && state === 'current' ? 'current' : ''}`}>
                                {k < m.done && <Check size={11} />} {weekLabel(m, k)}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="row mt">
                <input className="input" value={ms} onChange={(e) => setMs(e.target.value)} placeholder="أضف مرحلة جديدة…" aria-label="مرحلة جديدة" onKeyDown={(e) => e.key === 'Enter' && ms.trim() && (addMilestone(g.id, ms.trim(), 1), setMs(''))} />
                <button className="btn" onClick={() => ms.trim() && (addMilestone(g.id, ms.trim(), 1), setMs(''))}>
                  <Plus /> إضافة
                </button>
              </div>
            </div>
            <div className="span-5">
              <div className="row between mb">
                <div className="bold">المهام المرتبطة</div>
                <button className="btn btn-sm" onClick={() => openModal('task', { preset: { goalId: g.id, area: g.area, icon: g.icon } })}>
                  <Plus /> مهمة للهدف
                </button>
              </div>
              {g.daily?.length > 0 && (
                <div className="chips mb">
                  {g.daily.map((d) => (
                    <button key={d} className="chip" onClick={() => (useStore.getState().addTask({ title: d, goalId: g.id, area: g.area, icon: g.icon, duration: 20 }), useStore.getState().toast(`أضفت "${d}" لليوم وربطتها بالهدف`))}>
                      <Plus size={14} /> {d}
                    </button>
                  ))}
                </div>
              )}
              <div className="col" style={{ gap: 8 }}>
                {[...openTasks.slice(0, 4), ...gt.filter((t) => t.done).slice(-2)].map((t) => (
                  <TaskItem key={t.id} task={t} showDate compact />
                ))}
                {!gt.length && <p className="small muted">لا توجد مهام مرتبطة بعد — أضف مهمة يومية من الاقتراحات بالأعلى.</p>}
              </div>
            </div>
          </div>
          <div className="row mt" style={{ justifyContent: 'flex-end' }}>
            <button className="btn btn-sm btn-danger" onClick={() => confirm({ title: 'حذف الهدف', body: `هل تريد حذف "${g.title}"؟ المهام المرتبطة ستبقى.`, danger: true, confirmLabel: 'حذف', onConfirm: () => deleteGoal(g.id) })}>
              <Trash2 /> حذف الهدف
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const G_ICONS = GOAL_ICONS;

function GoalModal({ onClose }) {
  const addGoal = useStore((s) => s.addGoal);
  const [title, setTitle] = useState('');
  const [months, setMonths] = useState(6);
  const [area, setArea] = useState('study');
  const [icon, setIcon] = useState('target');
  const [preview, setPreview] = useState(null);
  const [addDaily, setAddDaily] = useState(true);
  function gen() {
    if (!title.trim()) return;
    const m = /شهر|سنة|سنه|عام/.test(title) ? monthsFromText(title) : months;
    setMonths(m);
    setPreview(goalBreakdown(title, m));
  }
  function save() {
    if (!title.trim()) return;
    const b = preview || goalBreakdown(title, months);
    addGoal({ title: title.trim(), months, area, icon, breakdown: b, addDaily, deadline: addDays(todayKey(), months * 30) });
    useStore.getState().toast('تم إنشاء الهدف مع خطته', { icon: 'sparkles' });
    onClose();
  }
  return (
    <Modal
      title="هدف جديد"
      sub="اكتب هدفك الكبير، وهّمة يقسمه تلقائيًا"
      onClose={onClose}
      size="wide"
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose}>
            إلغاء
          </button>
          <button className="btn btn-primary" onClick={save} disabled={!title.trim()}>
            <Check /> إنشاء الهدف
          </button>
        </>
      }
    >
      <div className="col" style={{ gap: 16 }}>
        <label className="field">
          <span>الهدف</span>
          <div className="row">
            <input className="input" value={title} onChange={(e) => (setTitle(e.target.value), setPreview(null))} placeholder="تعلم الإنجليزية خلال 6 أشهر" autoFocus onKeyDown={(e) => e.key === 'Enter' && gen()} />
            <button className="btn" onClick={gen} disabled={!title.trim()}>
              <Wand2 /> قسّم الهدف
            </button>
          </div>
        </label>
        <div className="grid g2">
          <div className="field">
            <span>المدة</span>
            <div className="chips">
              {[1, 3, 6, 12].map((m) => (
                <button key={m} className={`chip ${months === m ? 'on' : ''}`} onClick={() => (setMonths(m), preview && setPreview(goalBreakdown(title, m)))}>
                  {m === 12 ? 'سنة' : m === 1 ? 'شهر' : <><span className="num">{m}</span> أشهر</>}
                </button>
              ))}
            </div>
          </div>
          <div className="field">
            <span>المجال</span>
            <select className="select" value={area} onChange={(e) => setArea(e.target.value)}>
              {Object.entries(AREAS).map(([k, a]) => (
                <option key={k} value={k}>
                  {a.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="field">
          <span>الأيقونة</span>
          <div className="chips">
            {G_ICONS.map((i) => (
              <button key={i} className={`chip icon-chip ${icon === i ? 'on' : ''}`} onClick={() => setIcon(i)} aria-label={i}>
                <Glyph name={i} size={17} />
              </button>
            ))}
          </div>
        </div>
        {preview && (
          <div className="card tight glow onb-step">
            <div className="row mb">
              <Sparkles className="purple" size={18} />
              <span className="bold">الخطة المقترحة</span>
            </div>
            <div className="col" style={{ gap: 8 }}>
              <div className="small">
                <b>الهدف:</b> {title}
              </div>
              {preview.months.map((m, i) => (
                <div key={i} style={{ paddingInlineStart: 14, borderInlineStart: '2px solid rgba(var(--primary-rgb),.4)' }}>
                  <div className="small bold">{m.title}</div>
                  <div className="tiny muted">{m.weeks.slice(0, 3).join(' · ')}…</div>
                </div>
              ))}
              <div className="small mt-s">
                <b>مهام يومية:</b> {preview.daily.join('، ')}
              </div>
              <label className="row small mt-s" style={{ cursor: 'pointer' }}>
                <input type="checkbox" checked={addDaily} onChange={(e) => setAddDaily(e.target.checked)} style={{ width: 17, height: 17, accentColor: 'var(--primary)' }} />
                أضف المهام اليومية إلى يومي الآن
              </label>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

export { CardTitle };
