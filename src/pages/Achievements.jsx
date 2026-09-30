import { useState } from 'react';
import { Trophy, Lock, Plus, Trash2, Check, Swords } from 'lucide-react';
import { useStore } from '../store.js';
import { useRoute } from '../router.js';
import { Modal, Bar, Empty, useConfirm } from '../components/ui.jsx';
import { ACHIEVEMENTS, levelInfo } from '../lib/game.js';
import { todayKey, addDays, diffDays, formatShort, fromKey, DAYS_SHORT } from '../lib/date.js';

export default function Achievements() {
  const { params } = useRoute();
  const [tab, setTab] = useState(params.tab === 'challenges' ? 'challenges' : 'badges');
  const achievements = useStore((s) => s.achievements);
  const user = useStore((s) => s.user);
  const unlocked = ACHIEVEMENTS.filter((a) => achievements[a.id]).length;
  return (
    <>
      <div className="page-head">
        <div>
          <h1>
            <span className="ico">
              <Trophy />
            </span>
            {tab === 'badges' ? 'الإنجازات' : 'تحدياتي'}
          </h1>
          <p>
            فتحت <span className="num bold">{unlocked}</span> من <span className="num">{ACHIEVEMENTS.length}</span> إنجازات · المستوى <span className="num">{levelInfo(user.totalXp).level}</span>
          </p>
        </div>
        <div className="tabs">
          <button className={`tab ${tab === 'badges' ? 'on' : ''}`} onClick={() => setTab('badges')}>
            <Trophy size={16} /> الإنجازات
          </button>
          <button className={`tab ${tab === 'challenges' ? 'on' : ''}`} onClick={() => setTab('challenges')}>
            <Swords size={16} /> التحديات
          </button>
        </div>
      </div>
      {tab === 'badges' ? <Badges /> : <Challenges />}
    </>
  );
}

function Badges() {
  const achievements = useStore((s) => s.achievements);
  const pct = Math.round((ACHIEVEMENTS.filter((a) => achievements[a.id]).length / ACHIEVEMENTS.length) * 100);
  return (
    <>
      <div className="card tight mb">
        <div className="row between mb">
          <span className="bold">تقدم الإنجازات</span>
          <span className="num purple xbold">{pct}%</span>
        </div>
        <Bar value={pct} variant="gold" />
      </div>
      <div className="ach-grid">
        {ACHIEVEMENTS.map((a, i) => {
          const on = !!achievements[a.id];
          const hidden = a.secret && !on;
          return (
            <div key={a.id} className={`ach reveal ${on ? 'on' : 'off'}`} style={{ animationDelay: `${i * 0.03}s` }}>
              {!on && <Lock size={16} className="lock" />}
              <div className="em">{hidden ? '❔' : a.icon}</div>
              <div className="bold">{hidden ? 'إنجاز سري' : a.title}</div>
              <div className="tiny muted mt-s">{hidden ? 'استمر في استخدام هّمة لتكتشفه' : a.desc}</div>
              {on && <div className="tiny gold mt-s">✓ {formatShort(new Date(achievements[a.id]).toISOString().slice(0, 10))}</div>}
            </div>
          );
        })}
      </div>
    </>
  );
}

function Challenges() {
  const challenges = useStore((s) => s.challenges);
  const { checkChallenge, deleteChallenge } = useStore.getState();
  const confirm = useConfirm();
  const [adding, setAdding] = useState(false);
  const T = todayKey();
  return (
    <>
      <div className="row between mb">
        <p className="muted small">كل يوم تنجزه في التحدي = +20 XP، وإكمال التحدي = +100 XP</p>
        <button className="btn btn-primary" onClick={() => setAdding(true)}>
          <Plus /> تحدي جديد
        </button>
      </div>
      {!challenges.length ? (
        <div className="card">
          <Empty icon={<Swords />} title="لا توجد تحديات" text="ابدأ تحديًا صغيرًا واكسب XP إضافي." action={<button className="btn btn-primary" onClick={() => setAdding(true)}><Plus /> تحدي جديد</button>} />
        </div>
      ) : (
        <div className="grid g2">
          {challenges.map((c, i) => {
            const done = Object.values(c.log).filter(Boolean).length;
            const pct = Math.min(100, Math.round((done / c.days) * 100));
            const dayN = Math.min(c.days, diffDays(T, c.start) + 1);
            const complete = done >= c.days;
            return (
              <div key={c.id} className={`card reveal ${complete ? 'glow' : ''}`} style={{ animationDelay: `${i * 0.05}s` }}>
                <div className="row" style={{ gap: 14 }}>
                  <span style={{ fontSize: '2rem', width: 60, height: 60, display: 'grid', placeItems: 'center', borderRadius: 18, background: 'rgba(251,191,36,.12)', border: '1px solid rgba(251,191,36,.3)', flexShrink: 0 }}>{c.icon}</span>
                  <div className="grow">
                    <h3 style={{ fontSize: '1.1rem' }}>{c.title}</h3>
                    <div className="small muted">{c.desc}</div>
                  </div>
                  <span className="xbold gold num" style={{ fontSize: '1.3rem' }}>{pct}%</span>
                </div>
                <Bar value={pct} variant="gold" className="mt" />
                <div className="row between small muted mt-s">
                  <span>
                    المدة: <span className="num">{c.days}</span> أيام
                  </span>
                  <span>
                    اليوم <span className="num">{Math.max(1, dayN)}</span> · أنجزت <span className="num">{done}</span>
                  </span>
                </div>
                <div className="week-dots mt" style={{ flexWrap: 'wrap' }}>
                  {Array.from({ length: c.days }).map((_, k) => {
                    const d = addDays(c.start, k);
                    const on = c.log[d];
                    const future = d > T;
                    return (
                      <button key={d} className="d" style={{ minWidth: 30 }} disabled={future} onClick={() => checkChallenge(c.id, d)} aria-label={`${d} ${on ? 'منجز' : ''}`}>
                        <i className={on ? (d === T ? 'fire' : 'on') : d < T ? 'miss' : ''} style={{ opacity: future ? 0.35 : 1 }}>
                          {on ? '✓' : d < T ? '×' : k + 1}
                        </i>
                        {DAYS_SHORT[fromKey(d).getDay()].slice(0, 2)}
                      </button>
                    );
                  })}
                </div>
                <div className="row mt">
                  {c.log[T] ? (
                    <button className="btn btn-green grow" onClick={() => checkChallenge(c.id, T)}>
                      <Check /> تم اليوم
                    </button>
                  ) : T <= addDays(c.start, c.days - 1) && T >= c.start ? (
                    <button className="btn btn-primary grow" onClick={() => checkChallenge(c.id, T)}>
                      <Check /> أنجزت اليوم
                    </button>
                  ) : (
                    <span className="small muted grow">{complete ? '🏅 تحدي مكتمل!' : T < c.start ? 'يبدأ قريبًا' : 'انتهت مدة التحدي'}</span>
                  )}
                  <button className="icon-btn" aria-label="حذف التحدي" onClick={() => confirm({ title: 'حذف التحدي', body: `هل تريد حذف "${c.title}"؟`, danger: true, confirmLabel: 'حذف', onConfirm: () => deleteChallenge(c.id) })}>
                    <Trash2 />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {adding && <ChallengeModal onClose={() => setAdding(false)} />}
    </>
  );
}

const PRESETS = [
  ['🔥', 'تحدي 7 أيام بدون تأجيل', 'أنجز مهامك في وقتها', 7],
  ['📖', 'قراءة 30 دقيقة يوميًا', '30 دقيقة قراءة كل يوم', 14],
  ['🌅', 'الاستيقاظ مبكرًا', 'الاستيقاظ قبل 6:30', 7],
  ['💪', 'التمرين 5 أيام', '5 تمارين في أسبوع', 5],
  ['📵', 'ديتوكس السوشال', 'ساعة واحدة فقط يوميًا', 7],
  ['💧', '30 يوم ماء', '8 أكواب يوميًا', 30],
];

function ChallengeModal({ onClose }) {
  const add = useStore((s) => s.addChallenge);
  const [f, setF] = useState({ icon: '🔥', title: '', desc: '', days: 7 });
  function save() {
    if (!f.title.trim()) return;
    add({ ...f, days: Math.max(1, Math.min(365, +f.days || 7)) });
    useStore.getState().toast('بدأ التحدي! 🔥', { icon: 'sparkles' });
    onClose();
  }
  return (
    <Modal
      title="تحدي جديد"
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose}>
            إلغاء
          </button>
          <button className="btn btn-primary" onClick={save} disabled={!f.title.trim()}>
            ابدأ التحدي
          </button>
        </>
      }
    >
      <div className="col" style={{ gap: 14 }}>
        <div className="chips">
          {PRESETS.map(([icon, title, desc, days]) => (
            <button key={title} className={`chip ${f.title === title ? 'on' : ''}`} onClick={() => setF({ icon, title, desc, days })}>
              {icon} {title}
            </button>
          ))}
        </div>
        <label className="field">
          <span>اسم التحدي</span>
          <input className="input" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="مثال: 10 أيام بدون سكر" />
        </label>
        <label className="field">
          <span>الوصف / المهام المطلوبة</span>
          <input className="input" value={f.desc} onChange={(e) => setF({ ...f, desc: e.target.value })} />
        </label>
        <div className="grid" style={{ gridTemplateColumns: '90px 1fr', gap: 10 }}>
          <label className="field">
            <span>الرمز</span>
            <input className="input" value={f.icon} onChange={(e) => setF({ ...f, icon: e.target.value.slice(0, 2) })} style={{ textAlign: 'center' }} />
          </label>
          <label className="field">
            <span>المدة (أيام)</span>
            <input className="input" type="number" min="1" max="365" value={f.days} onChange={(e) => setF({ ...f, days: e.target.value })} />
          </label>
        </div>
      </div>
    </Modal>
  );
}
