import { useState } from 'react';
import { Gift, Plus, Trash2, History, Star } from 'lucide-react';
import { useStore } from '../store.js';
import { Modal, Bar, Num, Empty, CardTitle, useConfirm } from '../components/ui.jsx';
import { fmt, timeAgo } from '../lib/date.js';
import { Glyph, IconTile } from '../components/Glyph.jsx';
import { tr, trf, isEn } from '../i18n/index.js';

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
            {tr('مكافآتي')}
          </h1>
          <p>{tr('أنت من يحدد مكافآته — أنجز، اجمع XP، واستمتع')}</p>
        </div>
        <button className="btn btn-primary" onClick={() => setAdding(true)}>
          <Plus /> {tr('مكافأة جديدة')}
        </button>
      </div>
      <div className="card glow mb reveal">
        <div className="row between wrap">
          <div className="row" style={{ gap: 16 }}>
            <IconTile name="star" color="var(--gold)" size={56} />
            <div>
              <div className="small muted bold">{tr('رصيد XP')}</div>
              <div className="xbold" style={{ fontSize: '2.4rem', lineHeight: 1.1 }}>
                <Num value={user.xp} /> <span className="small muted">XP</span>
              </div>
            </div>
          </div>
          <p className="small muted" style={{ maxWidth: 360 }}>
            {tr('الاستبدال يخصم من رصيدك فقط، ولا يؤثر على مستواك (المستوى يعتمد على مجموع XP الذي جمعته).')}
          </p>
        </div>
      </div>
      {!rewards.length ? (
        <div className="card">
          <Empty icon={<Gift />} title={tr('لا توجد مكافآت بعد')} text={tr('أضف شيئًا تحبه ليكون حافزك.')} action={<button className="btn btn-primary" onClick={() => setAdding(true)}><Plus /> {tr('مكافأة جديدة')}</button>} />
        </div>
      ) : (
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))' }}>
          {rewards.map((r, i) => {
            const can = user.xp >= r.cost;
            return (
              <div key={r.id} className="card reward hover reveal" style={{ animationDelay: `${i * 0.05}s` }}>
                <button className="icon-btn sm plain" style={{ position: 'absolute', top: 10, insetInlineEnd: 10 }} aria-label={tr('حذف المكافأة')} onClick={() => confirm({ title: tr('حذف المكافأة'), body: trf('حذف "{title}"؟', { title: tr(r.title) }), danger: true, confirmLabel: tr('حذف'), onConfirm: () => deleteReward(r.id) })}>
                  <Trash2 />
                </button>
                <div className="em">
                  <Glyph name={r.icon} size={30} />
                </div>
                <div className="bold">{tr(r.title)}</div>
                <div className="purple xbold num">{fmt(r.cost)} XP</div>
                {!can && (
                  <div style={{ width: '100%' }}>
                    <Bar value={(user.xp / r.cost) * 100} className="thin" />
                    <div className="tiny muted mt-s">
                      {isEn() ? <><span className="num">{fmt(r.cost - user.xp)}</span> XP to go</> : <>باقي <span className="num">{fmt(r.cost - user.xp)}</span> XP</>}
                    </div>
                  </div>
                )}
                <button
                  className={`btn btn-sm btn-block ${can ? 'btn-primary' : ''}`}
                  disabled={!can}
                  onClick={() =>
                    confirm({
                      title: tr('استبدال المكافأة'),
                      icon: r.icon,
                      body: trf('سيتم خصم {cost} XP من رصيدك مقابل "{title}". رصيدك بعد الاستبدال: {after} XP.', { cost: fmt(r.cost), title: tr(r.title), after: fmt(user.xp - r.cost) }),
                      confirmLabel: tr('استبدال'),
                      onConfirm: () => redeemReward(r.id),
                    })
                  }
                >
                  {tr('استبدال')}
                </button>
              </div>
            );
          })}
        </div>
      )}
      <div className="card mt">
        <CardTitle icon={<History size={18} />} color="blue">
          {tr('سجل الاستبدال')}
        </CardTitle>
        {!history.length ? (
          <p className="small muted mt">{tr('لم تستبدل أي مكافأة بعد.')}</p>
        ) : (
          <div className="col mt">
            {history.slice(0, 20).map((h) => (
              <div key={h.id} className="row between small">
                <span>
                  <Glyph name={h.icon} size={14} /> {tr(h.title)}
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

const ICONS = ['fun', 'meal', 'film', 'cart', 'coffee', 'cake', 'smartphone', 'travel', 'beach', 'headphones', 'book', 'gift'];

function RewardModal({ onClose }) {
  const add = useStore((s) => s.addReward);
  const [f, setF] = useState({ icon: 'gift', title: '', cost: 200 });
  function save() {
    if (!f.title.trim()) return;
    add({ ...f, title: f.title.trim(), cost: Math.max(10, +f.cost || 100) });
    onClose();
  }
  return (
    <Modal
      title={tr('مكافأة جديدة')}
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose}>
            {tr('إلغاء')}
          </button>
          <button className="btn btn-primary" onClick={save} disabled={!f.title.trim()}>
            <Star /> {tr('إضافة')}
          </button>
        </>
      }
    >
      <div className="col" style={{ gap: 14 }}>
        <div className="chips">
          {ICONS.map((i) => (
            <button key={i} className={`chip icon-chip ${f.icon === i ? 'on' : ''}`} onClick={() => setF({ ...f, icon: i })} aria-label={i}>
              <Glyph name={i} size={17} />
            </button>
          ))}
        </div>
        <label className="field">
          <span>{tr('المكافأة')}</span>
          <input className="input" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder={tr('مثال: قهوة مختصة')} autoFocus />
        </label>
        <label className="field">
          <span>{tr('التكلفة (XP)')}</span>
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
