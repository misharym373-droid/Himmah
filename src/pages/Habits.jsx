import { useState } from 'react';
import { Repeat, Plus, Minus, Trash2, Check, Flame } from 'lucide-react';
import { useStore } from '../store.js';
import { Modal, Bar, Ring, Empty, useConfirm } from '../components/ui.jsx';
import { habitStreak, habitRate } from '../lib/game.js';
import { todayKey, addDays, fromKey, DAYS_SHORT } from '../lib/date.js';
import { Glyph, IconTile, IconPicker } from '../components/Glyph.jsx';

export default function Habits() {
  const habits = useStore((s) => s.habits);
  const [adding, setAdding] = useState(false);
  const T = todayKey();
  const doneToday = habits.filter((h) => (h.log[T] || 0) >= h.target).length;
  return (
    <>
      <div className="page-head">
        <div>
          <h1>
            <span className="ico">
              <Repeat />
            </span>
            عاداتي
          </h1>
          <p>
            اليوم أنجزت <span className="num bold">{doneToday}</span> من <span className="num">{habits.length}</span> عادات
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setAdding(true)}>
          <Plus /> عادة جديدة
        </button>
      </div>
      {!habits.length ? (
        <div className="card">
          <Empty icon={<Repeat />} title="ابنِ أول عادة" text="العادات الصغيرة تصنع فرقًا كبيرًا." action={<button className="btn btn-primary" onClick={() => setAdding(true)}><Plus /> عادة جديدة</button>} />
        </div>
      ) : (
        <div className="grid g2">
          {habits.map((h, i) => (
            <HabitCard key={h.id} h={h} delay={i} />
          ))}
        </div>
      )}
      {adding && <HabitModal onClose={() => setAdding(false)} />}
    </>
  );
}

function HabitCard({ h, delay }) {
  const { logHabit, deleteHabit } = useStore.getState();
  const confirm = useConfirm();
  const T = todayKey();
  const v = h.log[T] || 0;
  const done = v >= h.target;
  const streak = habitStreak(h);
  const rate = habitRate(h);
  // خريطة حرارية: آخر 5 أسابيع مرتبة حسب أيام الأسبوع
  const end = addDays(T, 6 - fromKey(T).getDay());
  const cells = Array.from({ length: 35 }, (_, i) => addDays(end, i - 34));
  return (
    <div className={`card reveal ${done ? 'glow' : ''}`} style={{ animationDelay: `${delay * 0.05}s` }}>
      <div className="row" style={{ gap: 14 }}>
        <IconTile name={h.icon} color={h.color} size={56} />
        <div className="grow">
          <h3 style={{ fontSize: '1.1rem' }}>{h.title}</h3>
          <div className="row small muted wrap" style={{ gap: 12 }}>
            <span>
              <Flame size={14} className="gold" style={{ verticalAlign: -2 }} /> <span className="num">{streak}</span> يوم
            </span>
            <span>
              الالتزام <span className="num bold">{rate}%</span>
            </span>
            <span>
              الهدف: <span className="num">{h.target}</span> {h.unit}
            </span>
          </div>
        </div>
        <Ring value={(v / h.target) * 100} size={64} stroke={7} id={`h${h.id}`} color={h.color}>
          <span className="small xbold num">{h.target > 1 ? `${v}/${h.target}` : done ? <Check size={16} /> : '0'}</span>
        </Ring>
      </div>
      <div className="row mt">
        {h.target > 1 ? (
          <>
            <button className="icon-btn" onClick={() => logHabit(h.id, T, -1)} aria-label="إنقاص" disabled={v <= 0}>
              <Minus />
            </button>
            <div className="grow">
              <Bar value={(v / h.target) * 100} variant={done ? 'green' : 'blue'} />
            </div>
            <button className="icon-btn primary" onClick={() => logHabit(h.id, T, 1)} aria-label="زيادة" disabled={done}>
              <Plus />
            </button>
          </>
        ) : (
          <button className={`btn btn-block ${done ? 'btn-green' : 'btn-primary'}`} onClick={() => logHabit(h.id, T, done ? -1 : 1)}>
            <Check /> {done ? 'تم اليوم' : 'سجّل إنجاز اليوم'}
          </button>
        )}
      </div>
      <div className="mt">
        <div className="heat mb" style={{ gap: 5 }}>
          {DAYS_SHORT.map((d) => (
            <span key={d} className="tiny dim" style={{ textAlign: 'center' }}>
              {d}
            </span>
          ))}
        </div>
        <div className="heat" style={{ gap: 5 }}>
          {cells.map((d) => {
            const val = h.log[d] || 0;
            const lvl = d > T ? '' : val >= h.target ? 'l3' : val >= h.target / 2 && val > 0 ? 'l2' : val > 0 ? 'l1' : '';
            return (
              <button
                key={d}
                className={`c ${lvl} ${d === T ? 'today' : ''}`}
                title={`${d}: ${val}/${h.target}`}
                aria-label={`${d}: ${val >= h.target ? 'مكتمل' : 'غير مكتمل'}`}
                disabled={d > T}
                onClick={() => logHabit(h.id, d, val >= h.target ? -h.target : h.target - val)}
                style={{ opacity: d > T ? 0.25 : 1 }}
              >
                {val >= h.target ? <Check size={11} /> : ''}
              </button>
            );
          })}
        </div>
      </div>
      <div className="row between mt">
        <span className="tiny dim">اضغط على أي يوم لتعديله</span>
        <button className="btn btn-xs btn-ghost" onClick={() => confirm({ title: 'حذف العادة', body: `هل تريد حذف "${h.title}" وسجلها؟`, danger: true, confirmLabel: 'حذف', onConfirm: () => deleteHabit(h.id) })}>
          <Trash2 /> حذف
        </button>
      </div>
    </div>
  );
}

const HABIT_ICONS = ['water', 'read', 'walk', 'sleep', 'meditation', 'dumbbell', 'pray', 'phoneoff', 'food', 'heart', 'brain', 'sparkles'];

const SUGGEST = [
  ['water', 'شرب الماء', 8, 'أكواب'],
  ['read', 'القراءة', 1, 'مرة'],
  ['walk', 'المشي', 1, 'مرة'],
  ['sleep', 'النوم مبكرًا', 1, 'مرة'],
  ['meditation', 'التأمل', 1, 'مرة'],
  ['dumbbell', 'التمرين', 1, 'مرة'],
  ['pray', 'أذكار الصباح', 1, 'مرة'],
  ['phoneoff', 'بدون جوال ساعة', 1, 'مرة'],
];
const COLORS = ['#2E6B57', '#2F7CF6', '#30A46C', '#E8940C', '#D7264F', '#5856D6'];

function HabitModal({ onClose }) {
  const addHabit = useStore((s) => s.addHabit);
  const [f, setF] = useState({ icon: 'sparkles', title: '', target: 1, unit: 'مرة', color: '#2E6B57' });
  function save() {
    if (!f.title.trim()) return;
    addHabit({ ...f, title: f.title.trim(), target: Math.max(1, +f.target || 1) });
    useStore.getState().toast(`تمت إضافة عادة "${f.title}"`, { icon: 'check' });
    onClose();
  }
  return (
    <Modal
      title="عادة جديدة"
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose}>
            إلغاء
          </button>
          <button className="btn btn-primary" onClick={save} disabled={!f.title.trim()}>
            <Check /> إضافة
          </button>
        </>
      }
    >
      <div className="col" style={{ gap: 16 }}>
        <div className="chips">
          {SUGGEST.map(([icon, title, target, unit]) => (
            <button key={title} className={`chip ${f.title === title ? 'on' : ''}`} onClick={() => setF({ ...f, icon, title, target, unit })}>
              <Glyph name={icon} size={15} /> {title}
            </button>
          ))}
        </div>
        <div className="grid" style={{ gridTemplateColumns: '80px 1fr', gap: 10 }}>
          <label className="field">
            <span>الرمز</span>
            <IconPicker value={f.icon} options={HABIT_ICONS} onChange={(icon) => setF({ ...f, icon })} />
          </label>
          <label className="field">
            <span>اسم العادة</span>
            <input className="input" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="مثال: قراءة 10 صفحات" autoFocus />
          </label>
        </div>
        <div className="grid g2">
          <label className="field">
            <span>الهدف اليومي</span>
            <input className="input" type="number" min="1" value={f.target} onChange={(e) => setF({ ...f, target: e.target.value })} />
          </label>
          <label className="field">
            <span>الوحدة</span>
            <input className="input" value={f.unit} onChange={(e) => setF({ ...f, unit: e.target.value })} placeholder="مرة / أكواب / صفحات" />
          </label>
        </div>
        <div className="field">
          <span>اللون</span>
          <div className="swatches">
            {COLORS.map((c) => (
              <button key={c} className={`swatch-btn ${f.color === c ? 'on' : ''}`} style={{ background: c, color: c }} onClick={() => setF({ ...f, color: c })} aria-label={c} />
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
}
