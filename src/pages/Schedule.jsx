import { useMemo, useState } from 'react';
import { DndContext, PointerSensor, TouchSensor, useSensor, useSensors, useDraggable, useDroppable, DragOverlay } from '@dnd-kit/core';
import { CalendarDays, ChevronRight, ChevronLeft, Plus } from 'lucide-react';
import { useStore } from '../store.js';
import { DayMap } from '../components/Widgets.jsx';
import { todayKey, addDays, fromKey, toKey, DAYS, DAYS_SHORT, MONTHS, formatLong, toMin } from '../lib/date.js';
import { Glyph } from '../components/Glyph.jsx';

export default function Schedule() {
  const [view, setView] = useState('week');
  const [date, setDate] = useState(todayKey());
  const open = useStore((s) => s.openModal);
  const step = view === 'day' ? 1 : view === 'week' ? 7 : 30;
  const move = (dir) => {
    if (view === 'month') {
      const d = fromKey(date);
      d.setMonth(d.getMonth() + dir, 1);
      setDate(toKey(d));
    } else setDate(addDays(date, dir * step));
  };
  const d = fromKey(date);
  const title = view === 'day' ? formatLong(date) : view === 'week' ? `أسبوع ${weekStart(date).slice(8)} ${MONTHS[fromKey(weekStart(date)).getMonth()]}` : `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
  return (
    <>
      <div className="page-head">
        <div>
          <h1>
            <span className="ico">
              <CalendarDays />
            </span>
            الجدول
          </h1>
          <p>اسحب المهام بين الأيام أو داخل اليوم لإعادة الترتيب</p>
        </div>
        <button className="btn btn-primary" onClick={() => open('task', { preset: { date: view === 'day' ? date : todayKey() } })}>
          <Plus /> مهمة جديدة
        </button>
      </div>
      <div className="row between wrap mb">
        <div className="tabs">
          {[
            ['day', 'اليوم'],
            ['week', 'الأسبوع'],
            ['month', 'الشهر'],
          ].map(([k, l]) => (
            <button key={k} className={`tab ${view === k ? 'on' : ''}`} onClick={() => setView(k)}>
              {l}
            </button>
          ))}
        </div>
        <div className="row">
          <button className="icon-btn" onClick={() => move(-1)} aria-label="السابق">
            <ChevronRight />
          </button>
          <span className="bold" style={{ minWidth: 150, textAlign: 'center' }}>{title}</span>
          <button className="icon-btn" onClick={() => move(1)} aria-label="التالي">
            <ChevronLeft />
          </button>
          <button className="btn btn-sm" onClick={() => setDate(todayKey())}>
            اليوم
          </button>
        </div>
      </div>
      {view === 'day' && (
        <div className="dash" style={{ marginTop: 0 }}>
          <DayMap key={date} span="span-12" date={date} title={date === todayKey() ? 'خريطة اليوم' : formatLong(date)} />
        </div>
      )}
      {view === 'week' && <Week date={date} onOpenDay={(k) => (setDate(k), setView('day'))} />}
      {view === 'month' && <Month date={date} onOpenDay={(k) => (setDate(k), setView('day'))} />}
    </>
  );
}

function weekStart(key) {
  const d = fromKey(key);
  return addDays(key, -d.getDay()); // الأسبوع يبدأ الأحد
}

function Week({ date, onOpenDay }) {
  const tasks = useStore((s) => s.tasks);
  const moveTo = useStore((s) => s.moveTaskToDate);
  const [active, setActive] = useState(null);
  const start = weekStart(date);
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const byDay = useMemo(() => {
    const m = {};
    for (const k of days) m[k] = [];
    for (const t of tasks) if (!t.deletedAt && !t.template && m[t.date]) m[t.date].push(t);
    for (const k of days) m[k].sort((a, b) => (toMin(a.time) ?? 9999) - (toMin(b.time) ?? 9999));
    return m;
  }, [tasks, start]); // eslint-disable-line
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }));
  return (
    <DndContext
      sensors={sensors}
      onDragStart={(e) => setActive(tasks.find((t) => t.id === e.active.id))}
      onDragCancel={() => setActive(null)}
      onDragEnd={({ active: a, over }) => {
        setActive(null);
        if (over && over.id !== tasks.find((t) => t.id === a.id)?.date) {
          moveTo(a.id, over.id);
          useStore.getState().toast(`تم نقل المهمة إلى ${DAYS[fromKey(over.id).getDay()]}`, { icon: 'clock' });
        }
      }}
    >
      <div className="week">
        {days.map((k) => (
          <DayCol key={k} k={k} tasks={byDay[k]} onOpenDay={onOpenDay} />
        ))}
      </div>
      <DragOverlay>{active ? <div className="wk-task dragging"><Glyph name={active.icon} size={13} /> {active.title}</div> : null}</DragOverlay>
    </DndContext>
  );
}

function DayCol({ k, tasks, onOpenDay }) {
  const { setNodeRef, isOver } = useDroppable({ id: k });
  const open = useStore((s) => s.openModal);
  const d = fromKey(k);
  const done = tasks.filter((t) => t.done).length;
  return (
    <div ref={setNodeRef} className={`week-col ${isOver ? 'over' : ''} ${k === todayKey() ? 'today' : ''}`}>
      <button className="row between" onClick={() => onOpenDay(k)} style={{ textAlign: 'start' }}>
        <div>
          <div className={`small bold ${k === todayKey() ? 'purple' : ''}`}>{DAYS[d.getDay()]}</div>
          <div className="tiny muted num">{d.getDate()} {MONTHS[d.getMonth()]}</div>
        </div>
        {tasks.length > 0 && <span className="badge num">{done}/{tasks.length}</span>}
      </button>
      {tasks.map((t) => (
        <DraggableTask key={t.id} t={t} />
      ))}
      <button className="btn btn-xs btn-ghost" onClick={() => open('task', { preset: { date: k } })} style={{ marginTop: 'auto' }}>
        <Plus /> إضافة
      </button>
    </div>
  );
}

function DraggableTask({ t }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: t.id });
  const open = useStore((s) => s.openModal);
  return (
    <div ref={setNodeRef} {...listeners} {...attributes} className={`wk-task ${t.done ? 'done' : ''}`} style={{ opacity: isDragging ? 0.3 : undefined, borderInlineStart: `3px solid var(--primary)` }} onClick={() => open('task', { task: t })}>
      <div className="bold ellipsis">
        <Glyph name={t.icon} size={13} /> {t.title}
      </div>
      {t.time && <div className="tiny muted num">{t.time}</div>}
    </div>
  );
}

function Month({ date, onOpenDay }) {
  const tasks = useStore((s) => s.tasks);
  const d = fromKey(date);
  const first = new Date(d.getFullYear(), d.getMonth(), 1);
  const startKey = addDays(toKey(first), -first.getDay());
  const cells = Array.from({ length: 42 }, (_, i) => addDays(startKey, i));
  const byDay = useMemo(() => {
    const m = {};
    for (const t of tasks) if (!t.deletedAt && !t.template) (m[t.date] = m[t.date] || []).push(t);
    return m;
  }, [tasks]);
  return (
    <div className="card">
      <div className="cal">
        {DAYS_SHORT.map((x) => (
          <div className="hd" key={x}>
            {x}
          </div>
        ))}
        {cells.map((k) => {
          const c = fromKey(k);
          const list = (byDay[k] || []).sort((a, b) => (toMin(a.time) ?? 9999) - (toMin(b.time) ?? 9999));
          return (
            <button key={k} className={`day ${c.getMonth() !== d.getMonth() ? 'out' : ''} ${k === todayKey() ? 'today' : ''}`} onClick={() => onOpenDay(k)} aria-label={`${formatLong(k)} — ${list.length} مهام`}>
              <span className="n num">{c.getDate()}</span>
              {list.slice(0, 3).map((t) => (
                <span key={t.id} className={`pill ${t.done ? 'done' : ''}`}>
                  <Glyph name={t.icon} size={13} /> {t.title}
                </span>
              ))}
              {list.length > 3 && <span className="tiny muted">+{list.length - 3}</span>}
              <span className="dots">
                {list.slice(0, 6).map((t) => (
                  <i key={t.id} className={t.done ? 'done' : ''} />
                ))}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
