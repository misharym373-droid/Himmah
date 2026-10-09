import { useState, useEffect, useMemo } from 'react';
import { Target, Plus, Trash2, Minus, Check, ChevronDown, CalendarDays, Clock, ListChecks, ArrowLeft } from 'lucide-react';
import { useStore, goalProgress } from '../store.js';
import { useRoute, navigate } from '../router.js';
import { Bar, Ring, Empty, CardTitle, useConfirm } from '../components/ui.jsx';
import TaskItem from '../components/TaskItem.jsx';
import { AREAS } from '../config.js';
import { todayKey, formatShort, diffDays, timeAgo } from '../lib/date.js';
import { IconTile } from '../components/Glyph.jsx';
import { GoalPlanModal, PlanGoalCard } from '../components/GoalPlan.jsx';

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
          <p>كل هدف يتحول إلى خطة: مراحل، ثم أسابيع بتواريخها، ثم جلسة مفصلة لكل يوم — وتقدمك يُحسب تلقائيًا</p>
        </div>
        <button className="btn btn-primary" onClick={() => setCreating(true)}>
          <Plus /> هدف جديد
        </button>
      </div>
      {!goals.length ? (
        <div className="card">
          <Empty icon={<Target />} title="ما الشيء الذي تريد الوصول إليه؟" text="اكتب هدفك، ومسار يقسمه لخطة واضحة." action={<button className="btn btn-primary" onClick={() => setCreating(true)}><Plus /> إنشاء هدف</button>} />
        </div>
      ) : (
        <div className="grid g2">
          {goals.map((g, i) => {
            const Card = g.plan?.startDate ? PlanGoalCard : GoalCard;
            return <Card key={g.id} g={g} tasks={tasks} open={openId === g.id} onToggle={() => setOpenId(openId === g.id ? null : g.id)} delay={i} />;
          })}
        </div>
      )}
      {creating && <GoalPlanModal onClose={(g) => (setCreating(false), g && setOpenId(g.id))} />}
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
            <button className="btn btn-sm btn-danger" onClick={() => confirm({ title: 'حذف الهدف', body: `سيتم حذف "${g.title}" وكل مهامه المرتبطة. تقدر تتراجع مباشرة بعد الحذف.`, danger: true, confirmLabel: 'حذف', onConfirm: () => deleteGoal(g.id) })}>
              <Trash2 /> حذف الهدف
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export { CardTitle };
