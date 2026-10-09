import { memo, useEffect, useRef, useState } from 'react';
import { Play, Pencil, Trash2, Repeat, Clock, CalendarClock, GripVertical, ListChecks, Target, Zap, Sun, CalendarArrowUp, CalendarDays } from 'lucide-react';
import { useStore } from '../store.js';
import { CheckBox } from './ui.jsx';
import { Glyph } from './Glyph.jsx';
import { AREAS, PRIORITIES } from '../config.js';
import { formatDuration, relativeDay } from '../lib/date.js';
import { isOverdue, taskXp } from '../lib/game.js';

export const POSTPONE_OPTIONS = [
  ['now', 'الآن', Zap],
  ['later', 'لاحقًا اليوم', Sun],
  ['tomorrow', 'غدًا', CalendarArrowUp],
  ['week', 'هذا الأسبوع', CalendarDays],
];

// قائمة تأجيل سريعة (بدون نافذة كاملة)
export function PostponeMenu({ taskId, onDone, compact }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const close = (e) => !ref.current?.contains(e.target) && setOpen(false);
    const esc = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', esc);
    return () => (document.removeEventListener('pointerdown', close), document.removeEventListener('keydown', esc));
  }, [open]);
  function pick(k) {
    const s = useStore.getState();
    s.postponeTask(taskId, k);
    if (k === 'now') s.pickFocus(taskId);
    setOpen(false);
    onDone?.();
  }
  return (
    <div className="pop-wrap" ref={ref} onClick={(e) => e.stopPropagation()}>
      <button className={compact ? 'icon-btn sm plain' : 'btn btn-ghost'} aria-haspopup="menu" aria-expanded={open} aria-label="تأجيل المهمة" title="تأجيل" onClick={() => setOpen(!open)}>
        <CalendarClock />
        {!compact && 'تأجيل'}
      </button>
      {open && (
        <div className="pop-menu" role="menu">
          {POSTPONE_OPTIONS.map(([k, l, I]) => (
            <button key={k} role="menuitem" onClick={() => pick(k)}>
              <I size={16} /> {l}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function TaskItem({ task, showDate, dragHandle, current, compact, selectable, selected, onSelect }) {
  const toggle = useStore((s) => s.toggleTask);
  const del = useStore((s) => s.deleteTask);
  const open = useStore((s) => s.openModal);
  const pickFocus = useStore((s) => s.pickFocus);
  const goal = useStore((s) => (task.goalId ? s.goals.find((g) => g.id === task.goalId) : null));
  const [justDone, setJustDone] = useState(false);
  const overdue = isOverdue(task);
  const prio = PRIORITIES[task.priority] || PRIORITIES.med;
  const area = AREAS[task.area] || AREAS.work;
  const subDone = task.subtasks?.filter((x) => x.done).length || 0;
  const openTask = () => open('task', { task });

  return (
    <div
      className={`task ${task.done ? 'done' : ''} ${current ? 'current' : ''} ${overdue ? 'overdue' : ''} ${justDone ? 'just-done' : ''}`}
      onClick={openTask}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && e.target === e.currentTarget && openTask()}
      aria-label={`${task.title}${task.time ? ' — ' + task.time : ''}${task.done ? ' — مكتملة' : ''}`}
    >
      {dragHandle}
      {selectable && (
        <input type="checkbox" aria-label={`تحديد ${task.title}`} checked={!!selected} onClick={(e) => e.stopPropagation()} onChange={() => onSelect(task.id)} className="sel-box" />
      )}
      <CheckBox
        on={task.done}
        onChange={() => {
          if (!task.done) {
            setJustDone(true);
            setTimeout(() => setJustDone(false), 700);
          }
          toggle(task.id);
        }}
        label={task.done ? `إلغاء إكمال ${task.title}` : `إكمال ${task.title}`}
      />
      <span className="t-icon" style={{ color: area.color }} aria-hidden>
        <Glyph name={task.icon} fallback={area.icon} size={18} />
      </span>
      <div className="grow">
        <div className="t-title ellipsis">{task.title}</div>
        <div className="t-meta">
          <span className={`meta-item ${overdue ? 'red' : ''}`}>
            <Clock size={12} aria-hidden />
            {showDate && relativeDay(task.date)}
            {showDate && ' · '}
            {task.time ? <span className="num">{task.time}</span> : 'طوال اليوم'}
          </span>
          {task.time && <span className="meta-item">{formatDuration(task.duration)}</span>}
          {!compact && (
            <span className="meta-item" style={{ color: area.color }}>
              <Glyph name={area.icon} size={12} /> {area.label}
            </span>
          )}
          {task.priority !== 'med' && task.priority !== 'low' && (
            <span className="prio-tag" style={{ '--c': prio.color }}>
              {prio.label}
            </span>
          )}
          {(task.template || task.seriesId) && <Repeat size={12} aria-label="متكررة" />}
          {task.subtasks?.length > 0 && (
            <span className="meta-item">
              <ListChecks size={12} aria-hidden /> <span className="num">{subDone}/{task.subtasks.length}</span>
            </span>
          )}
          {goal && (
            <span className="meta-item purple ellipsis" style={{ maxWidth: 150 }} title={`مرتبطة بهدف: ${goal.title}`}>
              <Target size={12} aria-hidden /> {goal.title}
            </span>
          )}
          {overdue && <span className="prio-tag" style={{ '--c': 'var(--red)' }}>متأخرة</span>}
          {task.done && <span className="meta-item green num">+{task.xpAwarded || taskXp(task)} XP</span>}
        </div>
      </div>
      <div className="t-actions" onClick={(e) => e.stopPropagation()}>
        {overdue && (
          <button className="icon-btn sm plain" title="إعادة التخطيط" aria-label="إعادة التخطيط" onClick={() => open('reschedule', { id: task.id })}>
            <CalendarClock className="red" />
          </button>
        )}
        {!task.done && !overdue && !compact && <PostponeMenu taskId={task.id} compact />}
        {!task.done && (
          <button className="icon-btn sm plain" title="ابدأ جلسة تركيز" aria-label={`ابدأ جلسة تركيز: ${task.title}`} onClick={() => pickFocus(task.id)}>
            <Play />
          </button>
        )}
        {!compact && (
          <>
            <button className="icon-btn sm plain hide-mobile" title="تعديل" aria-label={`تعديل ${task.title}`} onClick={openTask}>
              <Pencil />
            </button>
            <button className="icon-btn sm plain hide-mobile" title="حذف" aria-label={`حذف ${task.title}`} onClick={() => del(task.id)}>
              <Trash2 />
            </button>
          </>
        )}
      </div>
      <span className="prio-bar" style={{ background: prio.color }} aria-hidden />
    </div>
  );
}

export default memo(TaskItem);

export function DragHandle(props) {
  return (
    <span className="drag-handle" aria-label="اسحب لإعادة الترتيب" onClick={(e) => e.stopPropagation()} {...props}>
      <GripVertical size={18} />
    </span>
  );
}
