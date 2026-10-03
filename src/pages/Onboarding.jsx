import { useState } from 'react';
import { ArrowLeft, ArrowRight, Sparkles, Mic, BatteryLow, BatteryMedium, BatteryFull } from 'lucide-react';
import { useStore } from '../store.js';
import { parseTasks, guessMeta } from '../lib/nlp.js';
import { AREAS, TAGLINE } from '../config.js';
import { todayKey } from '../lib/date.js';
import { Glyph } from '../components/Glyph.jsx';

const GOALS = ['تحسين الدراسة', 'زيادة اللياقة', 'تنظيم الوقت', 'قراءة أكثر', 'تعلم مهارة', 'إنجاز مشروع'];

export default function Onboarding() {
  const name = useStore((s) => s.profile.name);
  const complete = useStore((s) => s.completeOnboarding);
  const [step, setStep] = useState(0);
  const [a, setA] = useState({ goal: '', energy: 'mid', time: 240, wake: '07:00', areas: ['study', 'health'], task: '' });
  const set = (k, v) => setA((x) => ({ ...x, [k]: v }));
  const total = 7;
  const next = () => setStep((s) => Math.min(total - 1, s + 1));
  const back = () => setStep((s) => Math.max(0, s - 1));

  function finish(skip = false) {
    setStep(6);
    const text = skip ? '' : a.task.trim();
    const parsed = text ? parseTasks(text) : [];
    const firstTask = parsed.length ? parsed : text ? [{ title: text, date: todayKey(), duration: 45, ...guessMeta(text) }] : [];
    setTimeout(() => {
      complete({
        goal: a.goal,
        energy: a.energy,
        time: a.time,
        wake: a.wake,
        areas: a.areas.map((x) => AREAS[x].label),
        firstTask,
      });
      useStore.getState().setProfile({ personalGoals: a.goal ? [a.goal] : [] });
      useStore.getState().toast('يومك جاهز', { icon: 'sparkles' });
    }, 2200);
  }

  return (
    <div className="onb">
      <div className="onb-card card glow">
        <div className="steps" aria-label={`الخطوة ${step + 1} من ${total}`}>
          {Array.from({ length: total }).map((_, i) => (
            <i key={i} className={i <= step ? 'on' : ''} />
          ))}
        </div>
        <div className="onb-step" key={step}>
          {step === 0 && (
            <div style={{ textAlign: 'center' }} className="col">
              <span className="brand-full onb-logo" role="img" aria-label={`مسار — ${TAGLINE}`} />
              <h2 style={{ fontSize: '1.7rem', marginTop: 8 }}>مرحبًا بك في مسار{name ? ` يا ${name}` : ''}</h2>
              <p className="muted">خلنا نجهز يومك في أقل من دقيقة، بخمس أسئلة بسيطة.</p>
              <button className="btn btn-primary btn-lg mt" onClick={next} style={{ alignSelf: 'center' }}>
                يلا نبدأ <ArrowLeft />
              </button>
            </div>
          )}
          {step === 1 && (
            <div className="col" style={{ gap: 16 }}>
              <h2>ما أهم شيء تريد إنجازه؟</h2>
              <p className="muted">هدفك الأساسي في هذه الفترة</p>
              <input className="input" value={a.goal} onChange={(e) => set('goal', e.target.value)} placeholder="مثال: التفوق في الجامعة" autoFocus onKeyDown={(e) => e.key === 'Enter' && next()} />
              <div className="chips">
                {GOALS.map((g) => (
                  <button key={g} className={`chip ${a.goal === g ? 'on' : ''}`} onClick={() => set('goal', g)}>
                    {g}
                  </button>
                ))}
              </div>
            </div>
          )}
          {step === 2 && (
            <div className="col" style={{ gap: 16 }}>
              <h2>كم طاقتك اليوم؟</h2>
              <p className="muted">نستخدمها لاقتراح المهام المناسبة لك</p>
              <div className="seg">
                {[
                  ['low', BatteryLow, 'منخفضة'],
                  ['mid', BatteryMedium, 'متوسطة'],
                  ['high', BatteryFull, 'عالية'],
                ].map(([k, E, l]) => (
                  <button key={k} className={`seg-btn ${a.energy === k ? 'on' : ''}`} onClick={() => set('energy', k)} style={{ padding: 20 }}>
                    <E size={28} />
                    {l}
                  </button>
                ))}
              </div>
            </div>
          )}
          {step === 3 && (
            <div className="col" style={{ gap: 16 }}>
              <h2>كم لديك من الوقت اليوم؟</h2>
              <div className="seg">
                {[
                  [120, 'ساعتان'],
                  [240, '4 ساعات'],
                  [360, '6 ساعات'],
                  [600, 'اليوم كامل'],
                ].map(([k, l]) => (
                  <button key={k} className={`seg-btn ${a.time === k ? 'on' : ''}`} onClick={() => set('time', k)}>
                    {l}
                  </button>
                ))}
              </div>
              <label className="field mt">
                <span>متى تبدأ يومك عادة؟</span>
                <input className="input" type="time" value={a.wake} onChange={(e) => set('wake', e.target.value)} />
              </label>
            </div>
          )}
          {step === 4 && (
            <div className="col" style={{ gap: 16 }}>
              <h2>ما المجالات التي تريد التركيز عليها؟</h2>
              <p className="muted">اختر واحدًا أو أكثر</p>
              <div className="grid g3" style={{ gridTemplateColumns: 'repeat(3,minmax(0,1fr))' }}>
                {Object.entries(AREAS).map(([k, ar]) => (
                  <button key={k} className={`seg-btn ${a.areas.includes(k) ? 'on' : ''}`} onClick={() => set('areas', a.areas.includes(k) ? a.areas.filter((x) => x !== k) : [...a.areas, k])}>
                    <Glyph name={ar.icon} size={22} />
                    {ar.label}
                  </button>
                ))}
              </div>
            </div>
          )}
          {step === 5 && (
            <div className="col" style={{ gap: 16 }}>
              <h2>أضف أول مهمة</h2>
              <p className="muted">اكتبها بطريقتك — مسار يفهم الوقت والمدة تلقائيًا</p>
              <div className="quick" style={{ maxWidth: 'none' }}>
                <Sparkles size={18} className="spark" />
                <input value={a.task} onChange={(e) => set('task', e.target.value)} placeholder="مذاكرة التفاضل الساعة 8 لمدة ساعة" autoFocus onKeyDown={(e) => e.key === 'Enter' && finish(false)} aria-label="أول مهمة" />
                <Mic size={18} className="dim" style={{ marginInlineEnd: 8 }} />
              </div>
              {a.task && parseTasks(a.task).length > 0 && (
                <div className="parsed">
                  {parseTasks(a.task).map((t, i) => (
                    <div className="parsed-item" key={i}>
                      <Glyph name={t.icon} size={16} />
                      <span className="bold">{t.title}</span>
                      <span className="tiny muted num">
                        {t.time || '—'} · {t.duration}د
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          {step === 6 && (
            <div className="build-anim">
              <div className="ai-orb">
                <Sparkles />
              </div>
              <h2>مسار يبني يومك…</h2>
              <div className="typing">
                <i />
                <i />
                <i />
              </div>
            </div>
          )}
        </div>
        {step > 0 && step < 6 && (
          <div className="row between mt" style={{ marginTop: 26 }}>
            <button className="btn btn-ghost" onClick={back}>
              <ArrowRight /> رجوع
            </button>
            <div className="row">
              {step === 5 && (
                <button className="btn btn-ghost" onClick={() => finish(true)}>
                  تخطي
                </button>
              )}
              <button className="btn btn-primary" onClick={() => (step === 5 ? finish(false) : next())}>
                {step === 5 ? 'ابنِ يومي' : 'التالي'} <ArrowLeft />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
