import { useState } from 'react';
import { Gift, Plus, Trash2, History, Star } from 'lucide-react';
import { useStore } from '../store.js';
import { Modal, Bar, Num, Empty, CardTitle, useConfirm } from '../components/ui.jsx';
import { fmt, timeAgo } from '../lib/date.js';

export default function Rewards() {
  const user = useStore((s) => s.user);
  const rewards = useStore((s) => s.rewards);
  const history = useStore((s) => s.rewardHistory);
  const { redeemReward, deleteReward } = useStore.getState();
  const confirm = useConfirm();
  const [adding, setAdding] = useState(false);
  return (
    <>
      <div className="page-head">
        <div>
          <h1>
            <span className="ico">
              <Gift />
            </span>
            مكافآتي
          </h1>
          <p>أنت من يحدد مكافآته — أنجز، اجمع XP، واستمتع</p>
        </div>
        <button className="btn btn-primary" onClick={() => setAdding(true)}>
          <Plus /> مكافأة جديدة
        </button>
      </div>
      <div className="card glow mb reveal">
        <div className="row between wrap">
          <div className="row" style={{ gap: 16 }}>
            <span style={{ fontSize: '2.6rem', filter: 'drop-shadow(0 0 14px #fbbf24)' }}>⭐</span>
            <div>
              <div className="small muted bold">رصيد XP</div>
              <div className="xbold" style={{ fontSize: '2.4rem', lineHeight: 1.1 }}>
                <Num value={user.xp} /> <span className="small muted">XP</span>
              </div>
            </div>
          </div>
          <p className="small muted" style={{ maxWidth: 360 }}>
            الاستبدال يخصم من رصيدك فقط، ولا يؤثر على مستواك (المستوى يعتمد على مجموع XP الذي جمعته).
          </p>
        </div>
      </div>
      {!rewards.length ? (
        <div className="card">
          <Empty icon={<Gift />} title="لا توجد مكافآت بعد" text="أضف شيئًا تحبه ليكون حافزك." action={<button className="btn btn-primary" onClick={() => setAdding(true)}><Plus /> مكافأة جديدة</button>} />
        </div>
      ) : (
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))' }}>
          {rewards.map((r, i) => {
            const can = user.xp >= r.cost;
            return (
              <div key={r.id} className="card reward hover reveal" style={{ animationDelay: `${i * 0.05}s` }}>
                <button className="icon-btn sm plain" style={{ position: 'absolute', top: 10, insetInlineEnd: 10 }} aria-label="حذف المكافأة" onClick={() => confirm({ title: 'حذف المكافأة', body: `حذف "${r.title}"؟`, danger: true, confirmLabel: 'حذف', onConfirm: () => deleteReward(r.id) })}>
                  <Trash2 />
                </button>
                <div className="em">{r.icon}</div>
                <div className="bold">{r.title}</div>
                <div className="purple xbold num">{fmt(r.cost)} XP</div>
                {!can && (
                  <div style={{ width: '100%' }}>
                    <Bar value={(user.xp / r.cost) * 100} className="thin" />
                    <div className="tiny muted mt-s">
                      باقي <span className="num">{fmt(r.cost - user.xp)}</span> XP
                    </div>
                  </div>
                )}
                <button
                  className={`btn btn-sm btn-block ${can ? 'btn-primary' : ''}`}
                  disabled={!can}
                  onClick={() =>
                    confirm({
                      title: 'استبدال المكافأة',
                      icon: r.icon,
                      body: `سيتم خصم ${fmt(r.cost)} XP من رصيدك مقابل "${r.title}". رصيدك بعد الاستبدال: ${fmt(user.xp - r.cost)} XP.`,
                      confirmLabel: 'استبدال',
                      onConfirm: () => redeemReward(r.id),
                    })
                  }
                >
                  استبدال
                </button>
              </div>
            );
          })}
        </div>
      )}
      <div className="card mt">
        <CardTitle icon={<History size={18} />} color="blue">
          سجل الاستبدال
        </CardTitle>
        {!history.length ? (
          <p className="small muted mt">لم تستبدل أي مكافأة بعد.</p>
        ) : (
          <div className="col mt">
            {history.slice(0, 20).map((h) => (
              <div key={h.id} className="row between small">
                <span>
                  {h.icon} {h.title}
                </span>
                <span className="muted">
                  <span className="num red">-{fmt(h.cost)} XP</span> · {timeAgo(h.time)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
      {adding && <RewardModal onClose={() => setAdding(false)} />}
    </>
  );
}

const ICONS = ['🎮', '🍔', '🎬', '🛍️', '☕', '🍰', '📱', '✈️', '🏖️', '🎧', '📚', '🎁'];

function RewardModal({ onClose }) {
  const add = useStore((s) => s.addReward);
  const [f, setF] = useState({ icon: '🎁', title: '', cost: 200 });
  function save() {
    if (!f.title.trim()) return;
    add({ ...f, title: f.title.trim(), cost: Math.max(10, +f.cost || 100) });
    onClose();
  }
  return (
    <Modal
      title="مكافأة جديدة"
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose}>
            إلغاء
          </button>
          <button className="btn btn-primary" onClick={save} disabled={!f.title.trim()}>
            <Star /> إضافة
          </button>
        </>
      }
    >
      <div className="col" style={{ gap: 14 }}>
        <div className="chips">
          {ICONS.map((i) => (
            <button key={i} className={`chip ${f.icon === i ? 'on' : ''}`} style={{ width: 42, padding: 0, justifyContent: 'center', fontSize: '1.2rem' }} onClick={() => setF({ ...f, icon: i })} aria-label={i}>
              {i}
            </button>
          ))}
        </div>
        <label className="field">
          <span>المكافأة</span>
          <input className="input" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="مثال: قهوة مختصة" autoFocus />
        </label>
        <label className="field">
          <span>التكلفة (XP)</span>
          <input className="input" type="number" min="10" step="10" value={f.cost} onChange={(e) => setF({ ...f, cost: e.target.value })} />
        </label>
        <div className="chips">
          {[100, 300, 500, 1000].map((c) => (
            <button key={c} className={`chip ${+f.cost === c ? 'on' : ''}`} onClick={() => setF({ ...f, cost: c })}>
              <span className="num">{fmt(c)}</span> XP
            </button>
          ))}
        </div>
      </div>
    </Modal>
  );
}
