// عادات اليوم كمهام: تظهر داخل قائمة مهام اليوم، وتسجيلها هنا = تسجيلها في صفحة العادات (مصدر واحد للبيانات)
import { useState } from 'react';
import { ChevronDown, Minus, Plus, Repeat } from 'lucide-react';
import { useStore } from '../store.js';
import { navigate } from '../router.js';
import { CheckBox } from './ui.jsx';
import { Glyph } from './Glyph.jsx';
import { todayKey } from '../lib/date.js';
import { tr, trf } from '../i18n/index.js';

const KEY = 'himmah:habitTasksOpen';
function readOpen() {
  try {
    return localStorage.getItem(KEY) !== '0';
  } catch (e) {
    console.warn('[himmah:habits]', e?.message || e);
    return true;
  }
}

function HabitTask({ h, date }) {
  const logHabit = useStore((s) => s.logHabit);
  const v = h.log?.[date] || 0;
  const done = v >= h.target;
  const counted = h.target > 1;
  return (
    <div className={`task habit-task ${done ? 'done' : ''}`} onClick={() => navigate('habits')} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && e.target === e.currentTarget && navigate('habits')}>
      {counted ? (
        <span className={`habit-count num ${done ? 'on' : ''}`} aria-hidden>
          {v}/{h.target}
        </span>
      ) : (
        <CheckBox on={done} onChange={() => logHabit(h.id, date, done ? -h.target : h.target)} label={done ? trf('إلغاء إكمال {title}', { title: h.title }) : trf('إكمال {title}', { title: h.title })} />
      )}
      <span className="t-icon" style={{ color: h.color }} aria-hidden>
        <Glyph name={h.icon} size={18} />
      </span>
      <div className="grow" style={{ minWidth: 0 }}>
        <div className="t-title ellipsis">{h.title}</div>
        <div className="t-meta">
          <span className="habit-badge">
            <Repeat size={11} aria-hidden /> {tr('عادة')}
          </span>
          {counted && (
            <span className="meta-item">
              <span className="num">{v}</span>/<span className="num">{h.target}</span> {h.unit}
            </span>
          )}
          {done && <span className="meta-item green num">+10 XP</span>}
        </div>
      </div>
      {counted && (
        <div className="row" style={{ gap: 4 }} onClick={(e) => e.stopPropagation()}>
          <button className="icon-btn sm" onClick={() => logHabit(h.id, date, -1)} disabled={v <= 0} aria-label={trf('إنقاص {title}', { title: h.title })}>
            <Minus />
          </button>
          <button className="icon-btn sm primary" onClick={() => logHabit(h.id, date, 1)} disabled={done} aria-label={trf('زيادة {title}', { title: h.title })}>
            <Plus />
          </button>
        </div>
      )}
    </div>
  );
}

export default function HabitTasks({ date = todayKey(), className = '' }) {
  const habits = useStore((s) => s.habits);
  const [open, setOpen] = useState(readOpen);
  if (!habits.length) return null;
  const doneN = habits.filter((h) => (h.log?.[date] || 0) >= h.target).length;
  const toggle = () => {
    setOpen((o) => {
      try {
        localStorage.setItem(KEY, o ? '0' : '1');
      } catch (e) {
        console.warn('[himmah:habits]', e?.message || e);
      }
      return !o;
    });
  };
  // غير المكتملة أولًا
  const list = [...habits].sort((a, b) => ((a.log?.[date] || 0) >= a.target) - ((b.log?.[date] || 0) >= b.target));
  return (
    <div className={`habit-tasks ${className}`}>
      <button className="habit-tasks-hd" onClick={toggle} aria-expanded={open}>
        <span className="bold small">{tr('عاداتي اليوم')}</span>
        <span className={`count num ${doneN === habits.length ? 'all' : ''}`}>
          {doneN}/{habits.length}
        </span>
        <span className="grow" />
        <ChevronDown size={16} style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }} aria-hidden />
      </button>
      {open && (
        <div className="col" style={{ gap: 8 }}>
          {list.map((h) => (
            <HabitTask key={h.id} h={h} date={date} />
          ))}
        </div>
      )}
    </div>
  );
}
