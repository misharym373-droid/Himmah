import { useMemo, useRef, useState } from 'react';
import { User, Camera, LogOut, Wallet, ExternalLink, Plus, Save, Palette, Flame, Star, Target } from 'lucide-react';
import { useStore, goalProgress } from '../store.js';
import { navigate } from '../router.js';
import { Avatar, Bar, Num, CardTitle, useConfirm, asset } from '../components/ui.jsx';
import { SurraLink } from '../components/Layout.jsx';
import { levelInfo, ACHIEVEMENTS } from '../lib/game.js';
import { fmt, formatHM } from '../lib/date.js';
import { summary } from '../lib/stats.js';
import { AREAS } from '../config.js';
import { IconTile } from '../components/Glyph.jsx';
import { Collapsible } from '../components/Widgets.jsx';

const GOALS = ['زيادة اللياقة', 'تحسين الدراسة', 'تنظيم الوقت', 'قراءة أكثر', 'تعلم مهارة', 'إنجاز مشروع'];
const INTERESTS = ['التقنية', 'الرياضة', 'القراءة', 'التصميم', 'الطبخ', 'السفر', 'الألعاب', 'ريادة الأعمال', 'اللغات', 'الموسيقى'];

export default function Profile() {
  const profile = useStore((s) => s.profile);
  const user = useStore((s) => s.user);
  const streak = useStore((s) => s.streak);
  const surra = useStore((s) => s.settings.surraUrl);
  const setProfile = useStore((s) => s.setProfile);
  const goals = useStore((s) => s.goals);
  const tasks = useStore((s) => s.tasks);
  const focusLog = useStore((s) => s.focusLog);
  const achievements = useStore((s) => s.achievements);
  const stats = useMemo(() => summary(tasks, focusLog, Infinity), [tasks, focusLog]);
  const unlocked = ACHIEVEMENTS.filter((a) => achievements[a.id]).length;
  const confirm = useConfirm();
  const [f, setF] = useState(profile);
  const [goal, setGoal] = useState('');
  const fileRef = useRef(null);
  const lv = levelInfo(user.totalXp);
  const dirty = JSON.stringify(f) !== JSON.stringify(profile);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  function onAvatar(file) {
    if (!file) return;
    const img = new Image();
    img.onload = () => {
      // ضغط الصورة إلى 256px
      const c = document.createElement('canvas');
      const s = 256;
      c.width = c.height = s;
      const ctx = c.getContext('2d');
      const r = Math.max(s / img.width, s / img.height);
      ctx.drawImage(img, (s - img.width * r) / 2, (s - img.height * r) / 2, img.width * r, img.height * r);
      const data = c.toDataURL('image/webp', 0.85);
      setF((x) => ({ ...x, avatar: data }));
      setProfile({ avatar: data });
      URL.revokeObjectURL(img.src);
    };
    img.src = URL.createObjectURL(file);
  }
  function save() {
    if (!f.name.trim()) return useStore.getState().toast('الاسم مطلوب');
    setProfile({ ...f, name: f.name.trim() });
    useStore.getState().toast('تم حفظ معلوماتك', { icon: 'check' });
  }
  const toggle = (k, v) => setF((x) => ({ ...x, [k]: x[k].includes(v) ? x[k].filter((y) => y !== v) : [...x[k], v] }));

  return (
    <>
      <div className="page-head">
        <div>
          <h1>
            <span className="ico">
              <User />
            </span>
            ملفي الشخصي
          </h1>
        </div>
      </div>

      <div className="card glow profile-hero reveal">
        <div className="avatar-wrap">
          <Avatar name={f.name} src={f.avatar} size="lg" />
          <button className="icon-btn sm primary edit" onClick={() => fileRef.current.click()} aria-label="تغيير الصورة">
            <Camera />
          </button>
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => onAvatar(e.target.files[0])} />
        </div>
        <div className="grow" style={{ minWidth: 200 }}>
          <h2 style={{ fontSize: '1.7rem' }}>{profile.name || 'بدون اسم'}</h2>
          <p className="muted small">{profile.email}</p>
          <div className="row wrap mt-s" style={{ gap: 8 }}>
            <span className="badge purple">
              <Star size={12} /> المستوى <span className="num">{lv.level}</span>
            </span>
            <span className="badge gold">
              <Flame size={12} /> <span className="num">{streak.count}</span> يوم متتالي
            </span>
            {profile.field && <span className="badge blue">{profile.field}</span>}
          </div>
        </div>
        <div style={{ minWidth: 220 }} className="grow">
          <div className="row between small">
            <span className="muted">XP</span>
            <span className="bold">
              <Num value={user.xp} /> رصيد · <span className="num">{fmt(user.totalXp)}</span> إجمالي
            </span>
          </div>
          <Bar value={lv.pct} className="mt-s" />
          <div className="tiny muted mt-s">
            <span className="num">{fmt(lv.need - lv.into)}</span> XP للمستوى {lv.level + 1}
          </div>
        </div>
      </div>

      <div className="kpis mt">
        {[
          ['award', 'var(--green)', 'مهمة مكتملة', fmt(stats.done)],
          ['zap', 'var(--blue)', 'ساعات تركيز', formatHM(stats.focus)],
          ['flame', 'var(--gold)', 'أفضل Streak', `${streak.best || streak.count} يوم`],
          ['trophy', 'var(--primary)', 'إنجازات مفتوحة', `${unlocked}/${ACHIEVEMENTS.length}`],
        ].map(([icon, c, l, v]) => (
          <div className="sum-tile" key={l}>
            <IconTile name={icon} color={c} size={40} />
            <div>
              <div className="sum-l">{l}</div>
              <div className="sum-v num">{v}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="dash">
        <div className="card span-7 reveal d1">
          <div className="card-hd">
            <CardTitle icon={<Target size={18} />} color="green" sub="أهدافك الكبيرة وتقدمك فيها">
              أهدافي
            </CardTitle>
            <button className="btn btn-xs btn-ghost" onClick={() => navigate('goals')}>
              إدارة الأهداف
            </button>
          </div>
          {goals.length ? (
            <div className="col" style={{ gap: 12 }}>
              {goals.slice(0, 3).map((g) => {
                const p = goalProgress(g, tasks);
                return (
                  <div key={g.id} className="row">
                    <IconTile name={g.icon} color={AREAS[g.area]?.color} size={36} />
                    <div className="grow">
                      <div className="row between small">
                        <span className="bold ellipsis">{g.title}</span>
                        <span className="num purple bold">{p}%</span>
                      </div>
                      <Bar value={p} className="thin mt-s" />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="small muted">لا توجد أهداف بعد.</p>
          )}
          <div className="divider" />
          <div className="small bold mb">أهدافي الشخصية</div>
            <div className="chips">
              {[...new Set([...GOALS, ...f.personalGoals])].map((g) => (
                <button key={g} className={`chip ${f.personalGoals.includes(g) ? 'on' : ''}`} onClick={() => (toggle('personalGoals', g), setProfile({ personalGoals: f.personalGoals.includes(g) ? f.personalGoals.filter((x) => x !== g) : [...f.personalGoals, g] }))}>
                  {g}
                </button>
              ))}
            </div>
            <form
              className="row mt"
              onSubmit={(e) => {
                e.preventDefault();
                if (!goal.trim()) return;
                const next = [...f.personalGoals, goal.trim()];
                setF({ ...f, personalGoals: next });
                setProfile({ personalGoals: next });
                setGoal('');
              }}
            >
              <input className="input" value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="هدف خاص…" aria-label="هدف خاص" />
              <button className="icon-btn" aria-label="إضافة هدف">
                <Plus />
              </button>
            </form>
        </div>

        <div className="span-5 col" style={{ gap: 20 }}>
          <div className="product-card reveal d2">
            <span className="p-ico">
              <Wallet />
            </span>
            <div className="grow" style={{ minWidth: 150 }}>
              <div className="tiny muted bold">منتجاتي</div>
              <div className="bold">صُرّة لإدارة الأموال</div>
              <div className="small muted">إدارة أموالك ومصروفاتك وأهدافك المالية في مكان واحد.</div>
            </div>
            <SurraLink url={surra} className="btn btn-sm btn-primary">
              فتح صُرّة <ExternalLink />
            </SurraLink>
          </div>

          <div className="card reveal d3">
            <div className="row" style={{ gap: 12 }}>
              <img src={asset('brand/icon.webp')} alt="" width="44" height="44" style={{ borderRadius: 13 }} />
              <div className="grow">
                <div className="bold">حسابك</div>
                <div className="tiny muted ellipsis">{profile.email || 'حساب محلي على هذا الجهاز'}</div>
              </div>
              <button className="btn btn-sm btn-ghost" onClick={() => navigate('settings')}>
                <Palette /> الإعدادات
              </button>
            </div>
            <button
              className="btn btn-danger btn-block mt"
              onClick={() =>
                confirm({
                  title: 'تسجيل الخروج',
                  body: 'هل تريد تسجيل الخروج؟ بياناتك تبقى محفوظة على هذا الجهاز.',
                  confirmLabel: 'تسجيل الخروج',
                  danger: true,
                  onConfirm: () => requestLogout(),
                })
              }
            >
              <LogOut /> تسجيل الخروج
            </button>
          </div>
        </div>

        <Collapsible id="profile-info" title="معلوماتي" icon={<User size={18} />} hint="الاسم، التواصل، العمر، أوقات الاستيقاظ والنوم — كلها اختيارية ما عدا الاسم">
          <div className="card span-12">
          <div className="grid g2">
            <label className="field">
              <span>الاسم *</span>
              <input className="input" value={f.name} onChange={set('name')} />
            </label>
            <label className="field">
              <span>البريد الإلكتروني</span>
              <input className="input" type="email" value={f.email} onChange={set('email')} dir="ltr" style={{ textAlign: 'right' }} />
            </label>
            <label className="field">
              <span>رقم الجوال</span>
              <input className="input" type="tel" value={f.phone} onChange={set('phone')} dir="ltr" style={{ textAlign: 'right' }} />
            </label>
            <label className="field">
              <span>المدينة</span>
              <input className="input" value={f.city} onChange={set('city')} placeholder="اختياري" />
            </label>
            <label className="field">
              <span>مجال الدراسة / العمل</span>
              <input className="input" value={f.field} onChange={set('field')} placeholder="مثال: طالب هندسة" />
            </label>
            <div className="grid g3" style={{ gap: 10 }}>
              <label className="field">
                <span>العمر</span>
                <input className="input" type="number" min="5" max="120" value={f.age} onChange={set('age')} />
              </label>
              <label className="field">
                <span>الوزن (كجم)</span>
                <input className="input" type="number" min="20" max="300" value={f.weight} onChange={set('weight')} />
              </label>
              <label className="field">
                <span>الطول (سم)</span>
                <input className="input" type="number" min="80" max="250" value={f.height} onChange={set('height')} />
              </label>
            </div>
            <label className="field">
              <span>وقت الاستيقاظ</span>
              <input className="input" type="time" value={f.wake} onChange={set('wake')} />
            </label>
            <label className="field">
              <span>وقت النوم</span>
              <input className="input" type="time" value={f.sleep} onChange={set('sleep')} />
            </label>
          </div>
          <div className="field mt">
            <span>الاهتمامات</span>
            <div className="chips">
              {[...new Set([...INTERESTS, ...f.interests])].map((i) => (
                <button key={i} className={`chip ${f.interests.includes(i) ? 'on' : ''}`} onClick={() => toggle('interests', i)}>
                  {i}
                </button>
              ))}
            </div>
          </div>
          <div className="row mt" style={{ justifyContent: 'flex-end' }}>
            {dirty && (
              <button className="btn btn-ghost" onClick={() => setF(profile)}>
                تراجع
              </button>
            )}
            <button className="btn btn-primary" onClick={save} disabled={!dirty}>
              <Save /> حفظ
            </button>
          </div>
          </div>
        </Collapsible>
      </div>
    </>
  );
}
