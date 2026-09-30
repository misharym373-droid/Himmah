import { memo } from 'react';
import { Play, Pencil, Trash2, Repeat, Clock, CalendarClock, GripVertical, ListChecks, Target } from 'lucide-react';
import { useStore } from '../store.js';
import { CheckBox } from './ui.jsx';
import { AREAS, PRIORITIES } from '../config.js';
import { formatDuration, relativeDay } from '../lib/date.js';
import { isOverdue, taskXp } from '../lib/game.js';

function TaskItem({ task, showDate, dragHandle, current, compact, selectable, selected, onSelect }) {
  const toggle = useStore((s) => s.toggleTask);
  const del = useStore((s) => s.deleteTask);
  const open = useStore((s) => s.openModal);
  const startFocus = useStore((s) => s.startFocus);
  const goal = useStore((s) => (task.goalId ? s.goals.find((g) => g.id === task.goalId) : null));
  const overdue = isOverdue(task);
  const prio = PRIORITIES[task.priority] || PRIORITIES.med;
  const subDone = task.subtasks?.filter((x) => x.done).length || 0;

  return (
    <div
      className={`task ${task.done ? 'done' : ''} ${current ? 'current' : ''} ${overdue ? 'overdue' : ''}`}
      onClick={() => open('task', { task })}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && e.target === e.currentTarget && open('task', { task })}
      aria-label={`${task.title}${task.time ? ' — ' + task.time : ''}`}
    >
      {dragHandle}
      {selectable && (
        <input
          type="checkbox"
          aria-label="تحديد"
          checked={!!selected}
          onClick={(e) => e.stopPropagation()}
          onChange={() => onSelect(task.id)}
          style={{ width: 18, height: 18, accentColor: 'var(--primary)' }}
        />
      )}
      <span className="prio" style={{ background: prio.color, opacity: task.done ? 0.3 : 0.9 }} title={`أولوية ${prio.label}`} />
      {task.time && !compact && <span className="t-time">{task.time}</span>}
      <span className="t-icon" aria-hidden>
        {task.icon || AREAS[task.area]?.emoji}
      </span>
      <div className="grow">
        <div className="t-title ellipsis">{task.title}</div>
        <div className="t-meta">
          {showDate && (
            <span className={overdue ? 'red' : ''}>
              <CalendarClock size={12} style={{ verticalAlign: -2 }} /> {relativeDay(task.date)}
              {task.time && compact ? ` · ${task.time}` : ''}
            </span>
          )}
          {compact && !showDate && task.time && <span className="num">{task.time}</span>}
          <span>
            <Clock size={12} style={{ verticalAlign: -2 }} /> {formatDuration(task.duration)}
          </span>
          {!compact && <span className="badge" style={{ color: AREAS[task.area]?.color }}>{AREAS[task.area]?.label}</span>}
          {(task.template || task.seriesId) && <Repeat size={12} aria-label="متكررة" />}
          {task.subtasks?.length > 0 && (
            <span>
              <ListChecks size={12} style={{ verticalAlign: -2 }} /> <span className="num">{subDone}/{task.subtasks.length}</span>
            </span>
          )}
          {goal && !compact && (
            <span className="purple ellipsis" style={{ maxWidth: 140 }}>
              <Target size={12} style={{ verticalAlign: -2 }} /> {goal.title}
            </span>
          )}
          {overdue && <span className="badge red">متأخرة</span>}
          {task.done && <span className="badge green num">+{task.xpAwarded || taskXp(task)} XP</span>}
        </div>
      </div>
      <div className="t-actions" onClick={(e) => e.stopPropagation()}>
        {overdue && (
          <button className="icon-btn sm plain" title="إعادة التخطيط" aria-label="إعادة التخطيط" onClick={() => open('reschedule', { id: task.id })}>
            <CalendarClock className="red" />
          </button>
        )}
        {!task.done && !compact && (
          <button className="icon-btn sm plain hide-mobile" title="ابدأ التركيز" aria-label="ابدأ التركيز" onClick={() => startFocus(task.id)}>
            <Play />
          </button>
        )}
        {!compact && (
          <>
            <button className="icon-btn sm plain hide-mobile" title="تعديل" aria-label="تعديل" onClick={() => open('task', { task })}>
              <Pencil />
            </button>
            <button className="icon-btn sm plain hide-mobile" title="حذف" aria-label="حذف" onClick={() => del(task.id)}>
              <Trash2 />
            </button>
          </>
        )}
      </div>
      <CheckBox on={task.done} onChange={() => toggle(task.id)} label={task.done ? 'إلغاء الإكمال' : 'إكمال المهمة'} />
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
