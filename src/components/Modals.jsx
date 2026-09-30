// النوافذ التفاعلية: الصوت، الصورة، إعادة التخطيط، أنقذ يومي، عندي ساعة، وش أسوي الآن، التجربة التفاعلية
import { useEffect, useMemo, useRef, useState } from 'react';
import { Mic, Square, Check, X, ImagePlus, Loader2, Sparkles, Play, CalendarPlus, Trash2, ArrowLeft, Undo2, Keyboard } from 'lucide-react';
import { useStore } from '../store.js';
import { Modal, CheckBox } from './ui.jsx';
import { parseTasks } from '../lib/nlp.js';
import { extractText, textToTasks } from '../lib/ocr.js';
import { rescuePlan, fitInTime, suggestNow, say } from '../lib/assistant.js';
import { formatDuration, relativeDay, todayKey, addDays, formatLong } from '../lib/date.js';
import { guessMeta } from '../lib/nlp.js';

const SR = typeof window !== 'undefined' ? window.SpeechRecognition || window.webkitSpeechRecognition : null;

function ParsedList({ items, onRemove }) {
  return (
    <div className="parsed">
      {items.map((t, i) => (
        <div className="parsed-item" key={i} style={{ animationDelay: `${i * 0.08}s` }}>
          <span style={{ fontSize: '1.4rem' }}>{t.icon}</span>
          <div className="grow">
            <div className="bold">{t.title}</div>
            <div className="tiny muted row wrap" style={{ gap: 10 }}>
              <span>📅 {relativeDay(t.date)}</span>
              <span className="num">⏰ {t.time || '—'}</span>
              <span>⏱️ {formatDuration(t.duration)}</span>
              {t.repeat?.type !== 'none' && <span>🔁 متكررة</span>}
            </div>
          </div>
          {onRemove && (
            <button className="icon-btn sm plain" aria-label="إزالة" onClick={() => onRemove(i)}>
              <X />
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

// ————— إضافة بالصوت —————
export function VoiceModal() {
  const close = useStore((s) => s.closeModal);
  const addTasks = useStore((s) => s.addTasks);
  const setFlag = useStore((s) => s.setFlag);
  const [listening, setListening] = useState(false);
  const [text, setText] = useState('');
  const [interim, setInterim] = useState('');
  const [items, setItems] = useState([]);
  const [err, setErr] = useState('');
  const rec = useRef(null);

  useEffect(() => () => rec.current?.abort?.(), []);

  function start() {
    setErr('');
    if (!SR) {
      setErr('متصفحك لا يدعم التعرف على الصوت. جرّب Chrome أو Safari، أو اكتب مهمتك بالأسفل.');
      return;
    }
    const r = new SR();
    r.lang = 'ar-SA';
    r.interimResults = true;
    r.continuous = false;
    r.onresult = (e) => {
      let fin = '';
      let mid = '';
      for (const res of e.results) (res.isFinal ? (fin += res[0].transcript) : (mid += res[0].transcript));
      if (fin) {
        setText((t) => (t ? t + ' ' : '') + fin);
        setItems(parseTasks((text ? text + ' ' : '') + fin));
      }
      setInterim(mid);
    };
    r.onerror = (e) => {
      setErr(e.error === 'not-allowed' ? 'اسمح للموقع باستخدام الميكروفون من إعدادات المتصفح.' : 'لم أتمكن من سماعك بوضوح، حاول مرة أخرى.');
      setListening(false);
    };
    r.onend = () => setListening(false);
    rec.current = r;
    r.start();
    setListening(true);
  }
  function stop() {
    rec.current?.stop();
    setListening(false);
  }
  function add() {
    addTasks(items);
    setFlag('voice');
    useStore.getState().checkAchievements();
    useStore.getState().toast(items.length > 1 ? `تمت إضافة ${items.length} مهام إلى الجدول` : 'تمت الإضافة إلى الجدول', { icon: 'check' });
    close();
  }
  const example = 'ذكرني بكرة الساعة 8 أذاكر التفاضل لمدة ساعة';

  return (
    <Modal title="إضافة مهمة بالصوت" onClose={close}>
      <div className="col" style={{ alignItems: 'stretch', gap: 18 }}>
        <div style={{ textAlign: 'center' }}>
          <button className={`mic-big ${listening ? 'live' : ''}`} onClick={listening ? stop : start} aria-label={listening ? 'إيقاف التسجيل' : 'ابدأ التحدث'}>
            {listening ? <Square /> : <Mic />}
          </button>
          <div className="bold mt">{listening ? 'تحدث الآن…' : items.length ? 'تم فهم المهمة ✓' : 'اضغط وتحدث'}</div>
          <div className={`wave mt-s ${listening ? '' : 'idle'}`} aria-hidden>
            {Array.from({ length: 22 }).map((_, i) => (
              <i key={i} style={{ '--h': `${14 + ((i * 37) % 44)}px`, animationDelay: `${(i % 7) * 0.09}s` }} />
            ))}
          </div>
          {(interim || text) && <p className="muted mt-s">"{text} <span className="dim">{interim}</span>"</p>}
          {!text && !listening && <p className="tiny dim mt-s">مثال: "{example}"</p>}
        </div>
        {err && <div className="err">{err}</div>}
        <div className="row">
          <input
            className="input"
            value={text}
            placeholder="أو اكتب هنا…"
            onChange={(e) => {
              setText(e.target.value);
              setItems(parseTasks(e.target.value));
            }}
          />
          {!text && (
            <button className="btn btn-sm" onClick={() => (setText(example), setItems(parseTasks(example)))}>
              مثال
            </button>
          )}
        </div>
        {items.length > 0 && (
          <>
            <div className="row green bold">
              <Check size={18} /> تم فهم {items.length > 1 ? `${items.length} مهام` : 'المهمة'}
            </div>
            <ParsedList items={items} onRemove={(i) => setItems(items.filter((_, j) => j !== i))} />
            <button className="btn btn-primary btn-lg btn-block" onClick={add}>
              <CalendarPlus /> إضافة إلى الجدول
            </button>
          </>
        )}
      </div>
    </Modal>
  );
}

// ————— تم إنشاء جدولك (من الإدخال السريع) —————
export function CreatedModal({ ids }) {
  const close = useStore((s) => s.closeModal);
  const all = useStore((s) => s.tasks);
  const tasks = useMemo(() => all.filter((t) => ids.includes(t.id)), [all, ids]);
  const purge = useStore((s) => s.purgeTask);
  return (
    <Modal
      onClose={close}
      footer={
        <>
          <button className="btn btn-ghost" onClick={() => (ids.forEach(purge), close(), useStore.getState().toast('تم التراجع'))}>
            <Undo2 /> تراجع
          </button>
          <button className="btn btn-primary" onClick={close}>
            تمام
          </button>
        </>
      }
    >
      <div style={{ textAlign: 'center' }} className="mb">
        <div className="ai-orb" style={{ margin: '0 auto 14px', width: 70, height: 70, borderRadius: 22 }}>
          <Sparkles />
        </div>
        <h3 style={{ fontSize: '1.35rem' }}>تم إنشاء جدولك {tasks[0]?.date === todayKey() ? 'اليومي' : ''} ✨</h3>
        <p className="muted small mt-s">أضفت {tasks.length > 1 ? `${tasks.length} مهام` : 'المهمة'} إلى جدولك</p>
      </div>
      <ParsedList items={tasks} />
    </Modal>
  );
}

// ————— أضف مهمة من صورة —————
export function ImageModal() {
  const close = useStore((s) => s.closeModal);
  const addTasks = useStore((s) => s.addTasks);
  const [img, setImg] = useState(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [lines, setLines] = useState([]);
  const [err, setErr] = useState('');
  const [date, setDate] = useState(todayKey());
  const input = useRef(null);

  async function onFile(file) {
    if (!file) return;
    if (!file.type.startsWith('image/')) return setErr('الملف يجب أن يكون صورة');
    setErr('');
    setLines([]);
    setImg(URL.createObjectURL(file));
    setBusy(true);
    setProgress(0);
    try {
      const text = await extractText(file, setProgress);
      const found = textToTasks(text);
      if (!found.length) setErr('ما قدرت ألقى مهام واضحة في الصورة. جرّب صورة أوضح أو أضف المهام يدويًا.');
      setLines(found.map((t) => ({ title: t, on: true })));
    } catch (e) {
      setErr(e.message || 'حدث خطأ أثناء قراءة الصورة');
    } finally {
      setBusy(false);
    }
  }
  function add() {
    const chosen = lines.filter((l) => l.on && l.title.trim());
    addTasks(chosen.map((l) => ({ title: l.title.trim(), date, duration: 30, ...guessMeta(l.title) })));
    useStore.getState().toast(`تمت إضافة ${chosen.length} مهام من الصورة`, { icon: 'check' });
    close();
  }
  return (
    <Modal title="أضف مهمة من صورة" sub="صوّر ورقة واجب أو قائمة مهام، وهّمة يستخرج المهام منها" onClose={close} size="wide">
      <input ref={input} type="file" accept="image/*" capture="environment" hidden onChange={(e) => onFile(e.target.files[0])} />
      {!img ? (
        <button
          className="card"
          style={{ width: '100%', borderStyle: 'dashed', borderWidth: 2, textAlign: 'center', padding: 40 }}
          onClick={() => input.current.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => (e.preventDefault(), onFile(e.dataTransfer.files[0]))}
        >
          <div className="e-ico" style={{ margin: '0 auto 12px', width: 70, height: 70, borderRadius: 22, display: 'grid', placeItems: 'center', background: 'rgba(var(--primary-rgb),.14)', color: 'var(--primary-soft)' }}>
            <ImagePlus size={32} />
          </div>
          <div className="bold">اسحب صورة هنا أو اضغط للاختيار</div>
          <div className="tiny muted mt-s">يدعم العربية والإنجليزية · الصورة تُعالج على جهازك</div>
        </button>
      ) : (
        <div className="grid g2" style={{ alignItems: 'start' }}>
          <div>
            <img src={img} alt="الصورة المرفوعة" style={{ borderRadius: 16, maxHeight: 320, width: '100%', objectFit: 'contain', background: '#0003' }} />
            <button className="btn btn-sm btn-ghost mt-s" onClick={() => input.current.click()}>
              تغيير الصورة
            </button>
          </div>
          <div>
            {busy ? (
              <div className="col" style={{ alignItems: 'center', padding: 30 }}>
                <Loader2 className="purple" size={36} style={{ animation: 'spin 1s linear infinite' }} />
                <div className="bold">جاري قراءة الصورة… <span className="num">{progress}%</span></div>
                <div style={{ width: '100%' }}>
                  <div className="bar">
                    <i style={{ width: `${progress}%` }} />
                  </div>
                </div>
                <p className="tiny dim">أول مرة قد تأخذ وقتًا أطول لتحميل محرك القراءة</p>
              </div>
            ) : (
              lines.length > 0 && (
                <div className="col">
                  <div className="bold green row">
                    <Check size={18} /> وجدت {lines.length} مهام
                  </div>
                  {lines.map((l, i) => (
                    <div className="row" key={i}>
                      <CheckBox on={l.on} onChange={(v) => setLines(lines.map((x, j) => (j === i ? { ...x, on: v } : x)))} label={l.title} />
                      <input className="input" style={{ height: 38 }} value={l.title} onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))} />
                    </div>
                  ))}
                  <label className="field mt-s">
                    <span>تاريخ المهام</span>
                    <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                  </label>
                </div>
              )
            )}
          </div>
        </div>
      )}
      {err && <div className="err mt">{err}</div>}
      {lines.some((l) => l.on) && !busy && (
        <div className="modal-ft">
          <button className="btn btn-primary" onClick={add}>
            <CalendarPlus /> إضافة {lines.filter((l) => l.on).length} مهام
          </button>
        </div>
      )}
    </Modal>
  );
}

// ————— إعادة التخطيط لمهمة غير منجزة —————
export function RescheduleModal({ id }) {
  const close = useStore((s) => s.closeModal);
  const task = useStore((s) => s.tasks.find((t) => t.id === id));
  const postpone = useStore((s) => s.postponeTask);
  const del = useStore((s) => s.deleteTask);
  const startFocus = useStore((s) => s.startFocus);
  if (!task) return null;
  const opts = [
    ['now', '⚡', 'الآن', 'ابدأها مباشرة'],
    ['later', '🕐', 'لاحقًا', 'بعد ساعتين اليوم'],
    ['tomorrow', '🌅', 'غدًا', formatLong(addDays(todayKey(), 1))],
    ['week', '📅', 'هذا الأسبوع', 'قبل نهاية الأسبوع'],
  ];
  return (
    <Modal title="ماذا تريد أن تفعل بهذه المهمة؟" onClose={close}>
      <div className="task mb" style={{ pointerEvents: 'none' }}>
        <span className="t-icon">{task.icon}</span>
        <div className="grow">
          <div className="t-title">{task.title}</div>
          <div className="t-meta">
            {relativeDay(task.date)} {task.time && `· ${task.time}`} · {formatDuration(task.duration)}
          </div>
        </div>
      </div>
      <div className="grid g2">
        {opts.map(([k, em, l, d]) => (
          <button
            key={k}
            className="seg-btn"
            onClick={() => {
              postpone(id, k);
              close();
              if (k === 'now') startFocus(id);
            }}
          >
            <span className="em">{em}</span>
            {l}
            <span className="tiny dim">{d}</span>
          </button>
        ))}
      </div>
      <button className="btn btn-danger btn-block mt" onClick={() => (del(id), close())}>
        <Trash2 /> حذف المهمة
      </button>
    </Modal>
  );
}

// ————— أنقذ يومي —————
export function RescueModal() {
  const close = useStore((s) => s.closeModal);
  const state = useStore();
  const plan = useMemo(() => rescuePlan(state), []); // eslint-disable-line
  const apply = useStore((s) => s.applyRescue);
  return (
    <Modal title="🚨 أنقذ يومي" onClose={close} size="wide">
      {!plan.total ? (
        <p className="muted">ما عندك مهام متبقية اليوم — يومك بأمان 👌</p>
      ) : (
        <>
          <div className="grid g2 mb">
            <div className="mini-stat">
              <div className="v num">{plan.total}</div>
              <div className="l">مهام متبقية</div>
            </div>
            <div className="mini-stat">
              <div className="v">{formatDuration(plan.remaining)}</div>
              <div className="l">الوقت المتبقي حتى النوم</div>
            </div>
          </div>
          <p className="muted mb">{plan.text}</p>
          <div className="bold mb">خطتك الجديدة — أهم {plan.keep.length} مهام:</div>
          <div className="col">
            {plan.keep.map((t, i) => (
              <div className="parsed-item" key={t.id} style={{ animationDelay: `${i * 0.1}s` }}>
                <span className="xbold purple num" style={{ fontSize: '1.2rem' }}>
                  {i + 1}
                </span>
                <div className="grow">
                  <div className="bold">
                    {t.icon} {t.title}
                  </div>
                  <div className="tiny muted">
                    <span className="num">{t.newTime}</span> · {formatDuration(t.duration)}
                  </div>
                </div>
                <Check className="green" size={18} />
              </div>
            ))}
          </div>
          {plan.move.length > 0 && (
            <>
              <div className="bold mt mb">نقترح نقلها لبكرة ({plan.move.length}):</div>
              <div className="chips">
                {plan.move.map((t) => (
                  <span className="chip" key={t.id}>
                    {t.icon} {t.title}
                  </span>
                ))}
              </div>
            </>
          )}
          <div className="modal-ft">
            <button className="btn btn-ghost" onClick={close}>
              إلغاء
            </button>
            <button className="btn btn-primary" onClick={() => (apply(plan), close())}>
              <Sparkles /> طبّق الخطة
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}

// ————— عندي ساعة فقط —————
export function OneHourModal() {
  const close = useStore((s) => s.closeModal);
  const state = useStore();
  const startFocus = useStore((s) => s.startFocus);
  const [min, setMin] = useState(60);
  const r = fitInTime(state, min);
  return (
    <Modal title="⏳ عندي وقت محدود" sub="اختر الوقت المتاح وسأعرض أفضل ما يمكن إنجازه" onClose={close}>
      <div className="chips mb">
        {[15, 30, 45, 60, 90, 120].map((m) => (
          <button key={m} className={`chip ${min === m ? 'on' : ''}`} onClick={() => setMin(m)}>
            <span className="num">{m}</span> دقيقة
          </button>
        ))}
      </div>
      {r.tasks.length ? (
        <>
          <p className="muted mb">
            خلال <b>{formatDuration(min)}</b> تقدر تنجز {r.tasks.length} مهام ({formatDuration(r.used)}):
          </p>
          <div className="col">
            {r.tasks.map((t, i) => (
              <div className="parsed-item" key={t.id} style={{ animationDelay: `${i * 0.08}s` }}>
                <span style={{ fontSize: '1.3rem' }}>{t.icon}</span>
                <div className="grow">
                  <div className="bold">{t.title}</div>
                  <div className="tiny muted">{formatDuration(t.duration)}</div>
                </div>
                <button className="btn btn-xs" onClick={() => (close(), startFocus(t.id))}>
                  <Play /> ابدأ
                </button>
              </div>
            ))}
          </div>
        </>
      ) : r.partial ? (
        <p className="muted">
          ما فيه مهمة كاملة تناسب هذا الوقت، لكن تقدر تبدأ جزء من <b>{r.partial.title}</b>.
          <button className="btn btn-sm btn-primary mt" onClick={() => (close(), startFocus(r.partial.id, min))}>
            <Play /> ابدأ {min} دقيقة منها
          </button>
        </p>
      ) : (
        <p className="muted">ما عندك مهام مفتوحة اليوم 🌿</p>
      )}
    </Modal>
  );
}

// ————— وش أسوي الآن؟ —————
export function WhatNowModal() {
  const close = useStore((s) => s.closeModal);
  const state = useStore();
  const startFocus = useStore((s) => s.startFocus);
  const open = useStore((s) => s.openModal);
  const [thinking, setThinking] = useState(true);
  const r = useMemo(() => suggestNow(state), []); // eslint-disable-line
  useEffect(() => {
    const t = setTimeout(() => setThinking(false), 900);
    return () => clearTimeout(t);
  }, []);
  const energy = state.energy[todayKey()];
  return (
    <Modal onClose={close}>
      <div style={{ textAlign: 'center' }}>
        <div className="ai-orb" style={{ margin: '0 auto 16px' }}>
          <Sparkles />
        </div>
        {thinking ? (
          <div className="col" style={{ alignItems: 'center' }}>
            <div className="bold">أحلل وقتك ومهامك وطاقتك…</div>
            <div className="typing">
              <i />
              <i />
              <i />
            </div>
          </div>
        ) : r.task ? (
          <div className="onb-step">
            <p className="muted small">وش أسوي الآن؟</p>
            <h3 style={{ fontSize: '1.4rem', margin: '8px 0 6px' }}>{r.text}</h3>
            {r.reasons?.length > 0 && (
              <div className="chips" style={{ justifyContent: 'center' }}>
                {r.reasons.map((x) => (
                  <span className="badge purple" key={x}>
                    {x}
                  </span>
                ))}
                {!energy && <span className="badge">حدد طاقتك لاقتراح أدق</span>}
              </div>
            )}
            <div className="task mt" style={{ pointerEvents: 'none', textAlign: 'start' }}>
              <span className="t-icon">{r.task.icon}</span>
              <div className="grow">
                <div className="t-title">{r.task.title}</div>
                <div className="t-meta">
                  {r.task.time && <span className="num">{r.task.time}</span>} · {formatDuration(r.task.duration)}
                </div>
              </div>
            </div>
            <div className="row mt" style={{ justifyContent: 'center' }}>
              <button className="btn btn-primary btn-lg" onClick={() => (close(), startFocus(r.task.id))}>
                <Play /> ابدأ المهمة
              </button>
            </div>
            {r.alternatives?.length > 0 && (
              <p className="tiny dim mt">
                بدائل: {r.alternatives.map((a) => a.title).join('، ')}
              </p>
            )}
          </div>
        ) : (
          <div className="onb-step">
            <h3>{r.text}</h3>
            <button className="btn btn-primary mt" onClick={() => open('task')}>
              إضافة مهمة
            </button>
          </div>
        )}
      </div>
    </Modal>
  );
}

// ————— التجربة التفاعلية (لنبدأ رحلتك) —————
export function InteractiveModal() {
  const close = useStore((s) => s.closeModal);
  const setEnergy = useStore((s) => s.setEnergy);
  const addTasks = useStore((s) => s.addTasks);
  const persona = useStore((s) => s.settings.persona);
  const [step, setStep] = useState(0);
  const [what, setWhat] = useState('');
  const [energy, setE] = useState(useStore.getState().energy[todayKey()] || 'high');
  const [hours, setHours] = useState(4);
  const [plan, setPlan] = useState([]);

  function build() {
    setStep(1);
    const base = what.trim() || 'مذاكرة التفاضل';
    const parsed = parseTasks(base);
    const main = parsed[0] || { title: base, duration: 60, ...guessMeta(base) };
    const now = new Date();
    let c = Math.ceil((now.getHours() * 60 + now.getMinutes() + 10) / 5) * 5;
    const chunk = energy === 'low' ? 25 : energy === 'mid' ? 45 : 60;
    const out = [];
    let budget = hours * 60;
    let n = 1;
    while (budget >= chunk && out.length < 6 && c < 23 * 60) {
      out.push({ title: `${main.title}${n > 1 ? ` — جلسة ${n}` : ''}`, duration: chunk, icon: main.icon, area: main.area, priority: n === 1 ? 'high' : 'med', time: toHM(c), date: todayKey(), repeat: { type: 'none', days: [] } });
      c += chunk;
      budget -= chunk;
      if (budget >= 15 && out.length < 6) {
        out.push({ title: 'استراحة', duration: 15, icon: '☕', area: 'health', priority: 'low', time: toHM(c), date: todayKey(), repeat: { type: 'none', days: [] } });
        c += 15;
        budget -= 15;
      }
      n++;
    }
    if (out.at(-1)?.title === 'استراحة') out.pop();
    setTimeout(() => (setPlan(out), setStep(2)), 1100);
  }
  return (
    <Modal onClose={close}>
      <div className="steps">
        {[0, 1, 2].map((i) => (
          <i key={i} className={i <= step ? 'on' : ''} />
        ))}
      </div>
      {step === 0 && (
        <div className="onb-step col" style={{ gap: 18 }}>
          <div style={{ textAlign: 'center' }}>
            <h3 style={{ fontSize: '1.5rem' }}>لنبدأ رحلتك</h3>
            <p className="muted small">أخبرنا قليلًا عن يومك، وسنصمم لك خطة مخصصة.</p>
          </div>
          <label className="field">
            <span>ما أهم شيء تود إنجازه اليوم؟</span>
            <input className="input" value={what} onChange={(e) => setWhat(e.target.value)} placeholder="أذاكر التفاضل" autoFocus onKeyDown={(e) => e.key === 'Enter' && build()} />
          </label>
          <div className="field">
            <span>ما طاقتك اليوم؟</span>
            <div className="seg">
              {[
                ['low', '😴', 'منخفضة'],
                ['mid', '😐', 'متوسطة'],
                ['high', '🔥', 'عالية'],
              ].map(([k, e, l]) => (
                <button key={k} className={`seg-btn ${energy === k ? 'on green' : ''}`} onClick={() => setE(k)}>
                  <span className="em">{e}</span>
                  {l}
                </button>
              ))}
            </div>
          </div>
          <div className="field">
            <span>كم لديك من الوقت؟</span>
            <div className="seg">
              {[2, 4, 6, 10].map((h) => (
                <button key={h} className={`seg-btn ${hours === h ? 'on' : ''}`} onClick={() => setHours(h)}>
                  {h === 10 ? 'اليوم كامل' : <span><span className="num">{h}</span> ساعات</span>}
                </button>
              ))}
            </div>
          </div>
          <button className="btn btn-primary btn-lg btn-block" onClick={build}>
            ابدأ <ArrowLeft />
          </button>
        </div>
      )}
      {step === 1 && (
        <div className="build-anim onb-step">
          <div className="spinner" />
          <div className="bold">{say(persona, 'hi')} هّمة يبني يومك…</div>
        </div>
      )}
      {step === 2 && (
        <div className="onb-step">
          <h3 style={{ textAlign: 'center', marginBottom: 14 }}>خطتك جاهزة ✨</h3>
          <ParsedList items={plan} onRemove={(i) => setPlan(plan.filter((_, j) => j !== i))} />
          <div className="modal-ft">
            <button className="btn btn-ghost" onClick={() => setStep(0)}>
              تعديل
            </button>
            <button
              className="btn btn-primary"
              onClick={() => {
                setEnergy(energy);
                addTasks(plan);
                useStore.getState().toast('تمت إضافة خطتك إلى يومك 🚀', { icon: 'sparkles' });
                close();
                document.getElementById('day-map')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }}
            >
              <CalendarPlus /> أضفها ليومي
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
const toHM = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

// ————— اختصارات لوحة المفاتيح —————
export function ShortcutsModal() {
  const close = useStore((s) => s.closeModal);
  const rows = [
    ['Ctrl / ⌘ + K', 'قائمة الأوامر والبحث'],
    ['N', 'مهمة جديدة'],
    ['/', 'الإدخال السريع'],
    ['V', 'إضافة بالصوت'],
    ['W', 'وش أسوي الآن؟'],
    ['A', 'اسأل هّمة'],
    ['G ثم H', 'الرئيسية'],
    ['G ثم T', 'المهام'],
    ['G ثم S', 'الجدول'],
    ['?', 'عرض الاختصارات'],
    ['Esc', 'إغلاق النافذة'],
  ];
  return (
    <Modal title={<span className="row"><Keyboard size={22} /> اختصارات لوحة المفاتيح</span>} labelledBy="اختصارات لوحة المفاتيح" onClose={close}>
      <div className="col">
        {rows.map(([k, l]) => (
          <div className="row between" key={k}>
            <span>{l}</span>
            <span className="row" style={{ gap: 4 }}>
              {k.split(' ').map((p, i) => (p === '+' || p === 'ثم' ? <span key={i} className="tiny dim">{p}</span> : <span key={i} className="kbd">{p}</span>))}
            </span>
          </div>
        ))}
      </div>
    </Modal>
  );
}

