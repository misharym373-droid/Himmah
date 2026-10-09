import { useMemo, useState } from 'react';
import { Sparkles, Trash2, Plus, X, Wand2, Check, Timer } from 'lucide-react';
import { useStore } from '../store.js';
import { Modal, Switch } from './ui.jsx';
import { Glyph, IconPicker } from './Glyph.jsx';
import { AREAS, PRIORITIES, TASK_ICONS } from '../config.js';
import { DAYS_SHORT, todayKey } from '../lib/date.js';
import { guessMeta, parseTasks, looksLikeSchedule } from '../lib/nlp.js';
import { breakdownTask, isBigTask } from '../lib/assistant.js';
import { taskXp, taskSize } from '../lib/game.js';

const DURS = [15, 30, 45, 60, 90, 120];

export default function TaskModal({ task, preset = {} }) {
  const close = useStore((s) => s.closeModal);
  const addTask = useStore((s) => s.addTask);
  const updateTask = useStore((s) => s.updateTask);
  const deleteTask = useStore((s) => s.deleteTask);
  const pickFocus = useStore((s) => s.pickFocus);
  const goals = useStore((s) => s.goals);
  const editing = !!task;
  const [f, setF] = useState(() => ({
    title: '', desc: '', notes: '', date: todayKey(), time: '', duration: 30, priority: 'med', area: 'study', icon: 'book',
    repeat: { type: 'none', days: [] }, goalId: '', subtasks: [], ...preset, ...(task || {}),
  }));
  const [iconTouched, setIconTouched] = useState(editing);
  // بدون وقت = طوال اليوم (افتراضي للمهمة الجديدة إذا لم يُحدد وقت)
  const [allDay, setAllDay] = useState(() => !(task?.time || preset.time));
  const [newSub, setNewSub] = useState('');
  const [showBreak, setShowBreak] = useState(false);
  const [err, setErr] = useState('');
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));

  const suggestion = useMemo(() => (f.title.length > 3 && isBigTask(f) && !f.subtasks.length ? breakdownTask(f.title) : null), [f]);
  const [breakSteps, setBreakSteps] = useState([]);

  function onTitle(v) {
    set('title', v);
    if (!iconTouched && v.length > 2) {
      const m = guessMeta(v);
      setF((x) => ({ ...x, title: v, icon: m.icon, area: m.area }));
    }
  }
  function smartParse() {
    const [p] = parseTasks(f.title, { base: f.date || todayKey() });
    if (!p) return;
    if (p.time) setAllDay(false);
    setF((x) => ({ ...x, title: p.title, time: p.time || x.time, duration: p.duration, date: p.date, area: p.area, icon: p.icon, repeat: p.repeat.type !== 'none' ? p.repeat : x.repeat }));
  }
  function save() {
    if (!f.title.trim()) return setErr('اكتب اسم المهمة');
    const data = { ...f, title: f.title.trim(), time: allDay ? null : f.time || null, duration: Number(f.duration) || 30, goalId: f.goalId || null };
    if (editing) updateTask(task.id, data);
    else addTask(data);
    useStore.getState().toast(editing ? 'تم حفظ التعديلات' : `تمت إضافة "${data.title}"`, { icon: 'check' });
    close();
  }

  const showParse = !editing && looksLikeSchedule(f.title);

  return (
    <Modal
      title={editing ? 'تعديل المهمة' : 'مهمة جديدة'}
      sub={editing ? null : 'كل التفاصيل اختيارية ما عدا الاسم'}
      onClose={close}
      size="wide"
      footer={
        <>
          {editing && (
            <button className="btn btn-danger" style={{ marginInlineEnd: 'auto' }} onClick={() => (deleteTask(task.id), close())}>
              <Trash2 /> حذف
            </button>
          )}
          {editing && !task.done && (
            <button className="btn" onClick={() => pickFocus(task.id)}>
              <Timer /> ابدأ جلسة تركيز
            </button>
          )}
          <button className="btn btn-ghost" onClick={close}>
            إلغاء
          </button>
          <button className="btn btn-primary" onClick={save}>
            <Check /> {editing ? 'حفظ' : 'إضافة المهمة'}
          </button>
        </>
      }
    >
      <div className="col" style={{ gap: 16 }}>
        <label className="field">
          <span>اسم المهمة</span>
          <div className="row">
            <input
              className="input"
              value={f.title}
              onChange={(e) => onTitle(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && save()}
              placeholder="مثال: مذاكرة التفاضل الساعة 8 لمدة ساعة"
              autoFocus
            />
            {showParse && (
              <button className="btn btn-sm" onClick={smartParse} title="استخراج الوقت والمدة من النص">
                <Wand2 /> فهم تلقائي
              </button>
            )}
          </div>
          {err && <span className="err">{err}</span>}
        </label>

        <div className="field">
          <span>الأيقونة</span>
          <IconPicker value={f.icon} options={TASK_ICONS} onChange={(i) => (set('icon', i), setIconTouched(true))} />
        </div>

        <div className="set-row" style={{ padding: '4px 0', borderBottom: 0 }}>
          <div className="grow">
            <div className="t">طوال اليوم</div>
            <div className="d">بدون وقت محدد — تنجزها في أي وقت خلال اليوم وتعلّمها «تم» متى ما خلصت</div>
          </div>
          <Switch on={allDay} onChange={(v) => (setAllDay(v), v ? set('time', '') : set('time', f.time || '09:00'))} label="طوال اليوم" />
        </div>
        <div className={`grid ${allDay ? 'g1' : 'g3'}`}>
          <label className="field">
            <span>التاريخ</span>
            <input className="input" type="date" value={f.date} onChange={(e) => set('date', e.target.value)} />
          </label>
          {!allDay && (
            <>
              <label className="field">
                <span>الوقت</span>
                <input className="input" type="time" value={f.time || ''} onChange={(e) => set('time', e.target.value)} />
              </label>
              <label className="field">
                <span>المدة (دقيقة)</span>
                <input className="input" type="number" min="5" step="5" value={f.duration} onChange={(e) => set('duration', e.target.value)} />
              </label>
            </>
          )}
        </div>
        <div className="chips">
          {DURS.map((d) => (
            <button key={d} className={`chip ${+f.duration === d ? 'on' : ''}`} onClick={() => set('duration', d)}>
              <span className="num">{d}</span> د
            </button>
          ))}
          <span className="badge purple" style={{ alignSelf: 'center' }}>
            مهمة {taskSize(f)} · <span className="num">+{taskXp(f)} XP</span>
          </span>
        </div>

        <div className="field">
          <span>الأولوية</span>
          <div className="chips">
            {Object.entries(PRIORITIES).map(([k, p]) => (
              <button key={k} className={`chip ${f.priority === k ? 'on' : ''}`} onClick={() => set('priority', k)}>
                <i style={{ width: 8, height: 8, borderRadius: 4, background: p.color }} /> {p.label}
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <span>المجال</span>
          <div className="chips">
            {Object.entries(AREAS).map(([k, a]) => (
              <button key={k} className={`chip ${f.area === k ? 'on' : ''}`} onClick={() => set('area', k)}>
                <Glyph name={a.icon} size={15} /> {a.label}
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <span>التكرار</span>
          <div className="chips">
            {[
              ['none', 'بدون'],
              ['daily', 'يوميًا'],
              ['weekly', 'أسبوعيًا'],
              ['monthly', 'شهريًا'],
              ['days', 'أيام محددة'],
            ].map(([k, l]) => (
              <button key={k} className={`chip ${f.repeat.type === k ? 'on' : ''}`} onClick={() => set('repeat', { type: k, days: f.repeat.days || [] })} disabled={editing && !!task.seriesId}>
                {l}
              </button>
            ))}
          </div>
          {f.repeat.type === 'days' && (
            <div className="chips mt-s">
              {DAYS_SHORT.map((d, i) => (
                <button
                  key={i}
                  className={`chip ${f.repeat.days.includes(i) ? 'on' : ''}`}
                  onClick={() => set('repeat', { type: 'days', days: f.repeat.days.includes(i) ? f.repeat.days.filter((x) => x !== i) : [...f.repeat.days, i] })}
                >
                  {d}
                </button>
              ))}
            </div>
          )}
          {editing && task.seriesId && <span className="tiny dim">هذه نسخة من مهمة متكررة — التعديل يخص هذا اليوم فقط.</span>}
        </div>

        {goals.length > 0 && (
          <label className="field">
            <span>الهدف المرتبط</span>
            <select className="select" value={f.goalId || ''} onChange={(e) => set('goalId', e.target.value)}>
              <option value="">بدون</option>
              {goals.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.title}
                </option>
              ))}
            </select>
          </label>
        )}

        <label className="field">
          <span>الوصف</span>
          <textarea className="textarea" rows="2" value={f.desc} onChange={(e) => set('desc', e.target.value)} placeholder="تفاصيل إضافية…" />
        </label>

        {/* تقسيم المهام الكبيرة */}
        {suggestion && !showBreak && (
          <div className="card tight glow" style={{ background: 'rgba(var(--primary-rgb),.08)' }}>
            <div className="row between wrap">
              <div className="row">
                <Sparkles className="purple" size={20} />
                <div>
                  <div className="bold">تحويل المهمة إلى خطوات</div>
                  <div className="tiny muted">المهام الكبيرة أسهل لما تتقسم</div>
                </div>
              </div>
              <button className="btn btn-sm btn-primary" onClick={() => (setShowBreak(true), setBreakSteps(suggestion))}>
                عرض الاقتراح
              </button>
            </div>
          </div>
        )}
        {showBreak && (
          <div className="card tight glow">
            <div className="bold mb row"><Sparkles size={16} className="purple" /> الخطوات المقترحة — عدّلها كما تحب</div>
            <div className="col">
              {breakSteps.map((s, i) => (
                <div className="row" key={i}>
                  <span className="check on" style={{ width: 20, height: 20 }}>
                    <Check />
                  </span>
                  <input className="input" style={{ height: 38 }} value={s} onChange={(e) => setBreakSteps(breakSteps.map((x, j) => (j === i ? e.target.value : x)))} />
                  <button className="icon-btn sm plain" aria-label="حذف الخطوة" onClick={() => setBreakSteps(breakSteps.filter((_, j) => j !== i))}>
                    <X />
                  </button>
                </div>
              ))}
            </div>
            <div className="row mt">
              <button className="btn btn-sm btn-primary" onClick={() => (set('subtasks', breakSteps.filter(Boolean).map((title, i) => ({ id: 's' + i + Date.now(), title, done: false }))), setShowBreak(false))}>
                قبول التقسيم
              </button>
              <button className="btn btn-sm btn-ghost" onClick={() => setShowBreak(false)}>
                تجاهل
              </button>
            </div>
          </div>
        )}

        <div className="field">
          <span>الخطوات الفرعية</span>
          <div className="col" style={{ gap: 6 }}>
            {f.subtasks.map((s) => (
              <div key={s.id} className="row">
                <button
                  className={`check ${s.done ? 'on' : ''}`}
                  style={{ width: 22, height: 22 }}
                  aria-label={s.title}
                  onClick={() => set('subtasks', f.subtasks.map((x) => (x.id === s.id ? { ...x, done: !x.done } : x)))}
                >
                  <Check />
                </button>
                <span className="grow" style={{ textDecoration: s.done ? 'line-through' : 'none', color: s.done ? 'var(--dim)' : '' }}>
                  {s.title}
                </span>
                <button className="icon-btn sm plain" aria-label="حذف" onClick={() => set('subtasks', f.subtasks.filter((x) => x.id !== s.id))}>
                  <X />
                </button>
              </div>
            ))}
            <div className="row">
              <input
                className="input"
                style={{ height: 40 }}
                placeholder="أضف خطوة…"
                value={newSub}
                onChange={(e) => setNewSub(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newSub.trim()) {
                    set('subtasks', [...f.subtasks, { id: 's' + Date.now(), title: newSub.trim(), done: false }]);
                    setNewSub('');
                  }
                }}
              />
              <button
                className="icon-btn"
                aria-label="إضافة خطوة"
                onClick={() => {
                  if (!newSub.trim()) return;
                  set('subtasks', [...f.subtasks, { id: 's' + Date.now(), title: newSub.trim(), done: false }]);
                  setNewSub('');
                }}
              >
                <Plus />
              </button>
            </div>
          </div>
        </div>

        <label className="field">
          <span>ملاحظات</span>
          <textarea className="textarea" rows="2" value={f.notes} onChange={(e) => set('notes', e.target.value)} placeholder="ملاحظات خاصة…" />
        </label>
      </div>
    </Modal>
  );
}
