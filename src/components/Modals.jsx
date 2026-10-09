// النوافذ التفاعلية: الصوت، الصورة، التركيز، إعادة التخطيط، أنقذ يومي، عندي ساعة، وش أسوي الآن، التجربة التفاعلية
import { useEffect, useMemo, useRef, useState } from 'react';
import { Mic, Square, Check, X, ImagePlus, Camera, Loader2, Sparkles, Play, CalendarPlus, Trash2, ArrowLeft, Undo2, Keyboard, Calendar, Clock, Timer, Repeat, MicOff, RotateCcw, Pencil, Zap, Sun, CalendarArrowUp, CalendarDays, BatteryLow, BatteryMedium, BatteryFull, Siren, Hourglass } from 'lucide-react';
import { useStore } from '../store.js';
import { useAssistantState } from '../hooks.js';
import { Modal, CheckBox } from './ui.jsx';
import { Glyph } from './Glyph.jsx';
import { parseTasks, guessMeta } from '../lib/nlp.js';
import { extractText, textToTasks } from '../lib/ocr.js';
import { rescuePlan, fitInTime, suggestNow, say } from '../lib/assistant.js';
import { formatDuration, relativeDay, todayKey, addDays, formatLong } from '../lib/date.js';
import { AREAS, PRIORITIES } from '../config.js';

const SR = typeof window !== 'undefined' ? window.SpeechRecognition || window.webkitSpeechRecognition : null;

// عرض مختصر لمهام مستخرجة (للقراءة فقط)
export function ParsedList({ items, onRemove, onOpen }) {
  return (
    <div className="parsed">
      {items.map((t, i) => (
        <div className={`parsed-item ${onOpen ? 'clickable' : ''}`} key={t.id || i} style={{ animationDelay: `${i * 0.06}s` }} onClick={onOpen ? () => onOpen(t) : undefined} role={onOpen ? 'button' : undefined} tabIndex={onOpen ? 0 : undefined}>
          <span className="t-icon" style={{ color: AREAS[t.area]?.color }}>
            <Glyph name={t.icon} size={18} />
          </span>
          <div className="grow">
            <div className="bold">{t.title}</div>
            <div className="t-meta">
              <span className="meta-item"><Calendar size={12} /> {relativeDay(t.date)}</span>
              <span className="meta-item num"><Clock size={12} /> {t.time || 'طوال اليوم'}</span>
              {t.time && <span className="meta-item"><Timer size={12} /> {formatDuration(t.duration)}</span>}
              {t.priority && t.priority !== 'med' && <span className="prio-tag" style={{ '--c': PRIORITIES[t.priority]?.color }}>{PRIORITIES[t.priority]?.label}</span>}
              {t.repeat?.type && t.repeat.type !== 'none' && <span className="meta-item"><Repeat size={12} /> متكررة</span>}
            </div>
          </div>
          {onOpen && <Pencil size={15} className="dim" aria-hidden />}
          {onRemove && (
            <button className="icon-btn sm plain" aria-label={`إزالة ${t.title}`} onClick={() => onRemove(i)}>
              <X />
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

// محرر المهام المستخرجة: يسمح بتعديل كل حقل قبل الحفظ
export function ParsedEditor({ items, onChange }) {
  const upd = (i, patch) => onChange(items.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  return (
    <div className="col" style={{ gap: 10 }}>
      {items.map((t, i) => (
        <div className="parsed-edit reveal" key={i} style={{ animationDelay: `${i * 0.06}s` }}>
          <div className="row">
            <span className="t-icon" style={{ color: AREAS[t.area]?.color }}>
              <Glyph name={t.icon} size={18} />
            </span>
            <input className="input" value={t.title} aria-label="عنوان المهمة" onChange={(e) => upd(i, { title: e.target.value, ...guessMeta(e.target.value) })} />
            <button className="icon-btn sm plain" aria-label={`إزالة ${t.title}`} onClick={() => onChange(items.filter((_, j) => j !== i))}>
              <X />
            </button>
          </div>
          <div className="parsed-fields">
            <label className="field">
              <span>التاريخ</span>
              <input className="input" type="date" value={t.date} onChange={(e) => upd(i, { date: e.target.value })} />
            </label>
            <label className="field">
              <span className="row between">
                الوقت
                <button type="button" className={`chip chip-xs ${!t.time ? 'on' : ''}`} onClick={() => upd(i, { time: null })}>
                  طوال اليوم
                </button>
              </span>
              <input className="input" type="time" value={t.time || ''} onChange={(e) => upd(i, { time: e.target.value || null })} />
            </label>
            <label className="field">
              <span>المدة (د)</span>
              <input className="input" type="number" min="5" step="5" value={t.duration} onChange={(e) => upd(i, { duration: Math.max(5, +e.target.value || 30) })} />
            </label>
            <label className="field">
              <span>الأولوية</span>
              <select className="select" value={t.priority || 'med'} onChange={(e) => upd(i, { priority: e.target.value })}>
                {Object.entries(PRIORITIES).map(([k, p]) => (
                  <option key={k} value={k}>{p.label}</option>
                ))}
              </select>
            </label>
          </div>
        </div>
      ))}
    </div>
  );
}

// ————— إضافة بالصوت —————
// الحالات: idle → listening → review  (أو unsupported/error مع بقاء الإدخال النصي متاحًا)
export function VoiceModal() {
  const close = useStore((s) => s.closeModal);
  const [status, setStatus] = useState(SR ? 'idle' : 'unsupported');
  const [text, setText] = useState('');
  const [interim, setInterim] = useState('');
  const [items, setItems] = useState([]);
  const [err, setErr] = useState('');
  const rec = useRef(null);
  const textRef = useRef('');

  useEffect(
    () => () => {
      try {
        rec.current?.abort?.();
      } catch (e) {
        // ميزة ثانوية غير متاحة في هذا المتصفح — لا توقف التطبيق
        console.warn('[himmah:speech-recognition]', e?.message || e);
      }
    },
    []
  );

  const setTranscript = (v) => {
    textRef.current = v;
    setText(v);
    setItems(parseTasks(v));
  };

  function start() {
    setErr('');
    if (!SR) return setStatus('unsupported');
    try {
      const r = new SR();
      r.lang = 'ar-SA';
      r.interimResults = true;
      r.continuous = false;
      r.onresult = (e) => {
        let fin = '';
        let mid = '';
        for (let k = e.resultIndex; k < e.results.length; k++) {
          const res = e.results[k];
          if (res.isFinal) fin += res[0].transcript;
          else mid += res[0].transcript;
        }
        if (fin) setTranscript(((textRef.current ? textRef.current + ' ' : '') + fin).trim());
        setInterim(mid);
      };
      r.onerror = (e) => {
        const msg = {
          'not-allowed': 'اسمح للموقع باستخدام الميكروفون من إعدادات المتصفح.',
          'service-not-allowed': 'اسمح للموقع باستخدام الميكروفون من إعدادات المتصفح.',
          'no-speech': 'ما سمعت شيء. حاول مرة ثانية وتكلم بوضوح.',
          'audio-capture': 'ما فيه ميكروفون متصل بالجهاز.',
          network: 'التعرف على الصوت يحتاج اتصال بالإنترنت.',
        }[e.error];
        if (e.error !== 'aborted') setErr(msg || 'تعذر التعرف على الصوت، حاول مرة أخرى أو اكتب مهامك.');
        setStatus('idle');
      };
      r.onend = () => {
        setInterim('');
        setStatus(textRef.current ? 'review' : 'idle');
      };
      rec.current = r;
      r.start();
      setStatus('listening');
    } catch {
      setErr('تعذر تشغيل الميكروفون. اكتب مهامك بالأسفل.');
      setStatus('idle');
    }
  }
  function stop() {
    try {
      rec.current?.stop();
    } catch (e) {
      // ميزة ثانوية غير متاحة في هذا المتصفح — لا توقف التطبيق
      console.warn('[himmah:speech-recognition]', e?.message || e);
    }
  }
  async function add() {
    const list = items.filter((t) => t.title.trim());
    if (!list.length) return;
    const s = useStore.getState();
    s.addTasks(list);
    s.setFlag('voice');
    s.checkAchievements();
    s.toast(list.length > 1 ? `تمت إضافة ${list.length} مهام إلى يومك` : `تمت إضافة "${list[0].title}" إلى يومك`, { icon: 'check' });
    close();
  }
  const example = 'ذكرني بكرة الساعة 8 أذاكر التفاضل لمدة ساعة';
  const listening = status === 'listening';
  const label = { idle: 'اضغط على المايك وتكلم', listening: 'أسمعك الآن… تكلم براحتك', review: items.length ? 'راجع المهام قبل الحفظ' : 'ما فهمت مهام واضحة — عدّل النص', unsupported: 'التعرف على الصوت غير مدعوم في هذا المتصفح' }[status];

  return (
    <Modal title="إضافة بالصوت" sub="تكلم بطريقتك: المهمة، الوقت، والمدة" onClose={close} size={items.length ? 'wide' : ''}>
      <div className="col" style={{ alignItems: 'stretch', gap: 16 }}>
        <div className="voice-stage" aria-live="polite">
          <button className={`mic-big ${listening ? 'live' : ''}`} onClick={listening ? stop : start} disabled={status === 'unsupported'} aria-pressed={listening} aria-label={listening ? 'إيقاف التسجيل' : 'ابدأ التسجيل الصوتي'}>
            {status === 'unsupported' ? <MicOff /> : listening ? <Square /> : <Mic />}
          </button>
          <div className={`voice-status ${listening ? 'live' : ''}`}>
            {listening && <span className="rec-dot" aria-hidden />}
            {label}
          </div>
          {listening && (
            <div className="wave" aria-hidden>
              {Array.from({ length: 18 }).map((_, i) => (
                <i key={i} style={{ '--h': `${12 + ((i * 37) % 36)}px`, animationDelay: `${(i % 6) * 0.1}s` }} />
              ))}
            </div>
          )}
          {(interim || text) && (
            <p className="transcript">
              {text} <span className="dim">{interim}</span>
            </p>
          )}
          {status === 'unsupported' && <p className="small muted">جرّب Chrome أو Safari، أو اكتب مهامك بالأسفل — النتيجة نفسها.</p>}
        </div>
        {err && <div className="err" role="alert">{err}</div>}
        <label className="field">
          <span>النص {status === 'review' ? '(تقدر تعدّله)' : ''}</span>
          <div className="row">
            <input className="input" value={text} placeholder="أو اكتب هنا…" onChange={(e) => setTranscript(e.target.value)} />
            {!text && (
              <button className="btn btn-sm" onClick={() => (setTranscript(example), setStatus('review'))}>
                مثال
              </button>
            )}
            {text && !listening && (
              <button className="icon-btn" aria-label="مسح وإعادة التسجيل" title="من جديد" onClick={() => (setTranscript(''), setStatus(SR ? 'idle' : 'unsupported'))}>
                <RotateCcw />
              </button>
            )}
          </div>
        </label>
        {items.length > 0 && !listening && (
          <>
            <div className="row green bold small">
              <Check size={16} /> فهمت {items.length > 1 ? `${items.length} مهام` : 'مهمة واحدة'} — عدّل أي شيء قبل الحفظ
            </div>
            <ParsedEditor items={items} onChange={setItems} />
            <button className="btn btn-primary btn-lg btn-block" onClick={add} disabled={!items.some((t) => t.title.trim())}>
              <CalendarPlus /> إضافة إلى يومي
            </button>
          </>
        )}
        <p className="tiny dim" style={{ textAlign: 'center' }}>
          التحليل يتم محليًا على جهازك
        </p>
      </div>
    </Modal>
  );
}

// ————— تم إنشاء المهام (من الإدخال السريع) —————
export function CreatedModal({ ids }) {
  const close = useStore((s) => s.closeModal);
  const open = useStore((s) => s.openModal);
  const all = useStore((s) => s.tasks);
  const tasks = useMemo(() => all.filter((t) => ids.includes(t.id)), [all, ids]);
  const purge = useStore((s) => s.purgeTask);
  return (
    <Modal
      onClose={close}
      title={tasks.length > 1 ? `أضفت ${tasks.length} مهام` : 'تمت إضافة المهمة'}
      sub="اضغط على أي مهمة لتعديلها"
      footer={
        <>
          <button className="btn btn-ghost" onClick={() => (ids.forEach(purge), close(), useStore.getState().toast('تم التراجع'))}>
            <Undo2 /> تراجع
          </button>
          <button className="btn btn-primary" onClick={close}>
            <Check /> تمام
          </button>
        </>
      }
    >
      <ParsedList items={tasks} onOpen={(t) => open('task', { task: t })} />
    </Modal>
  );
}

// ————— بدء جلسة تركيز —————
export function FocusStartModal({ taskId }) {
  const close = useStore((s) => s.closeModal);
  const task = useStore((s) => s.tasks.find((t) => t.id === taskId));
  const startFocus = useStore((s) => s.startFocus);
  const [custom, setCustom] = useState(task?.duration || 30);
  const presets = [15, 25, 45];
  return (
    <Modal title="ابدأ جلسة تركيز" sub={task ? task.title : null} onClose={close}>
      <div className="focus-presets">
        {presets.map((m) => (
          <button key={m} className="seg-btn" onClick={() => startFocus(taskId, m)}>
            <span className="xbold num" style={{ fontSize: '1.6rem' }}>{m}</span>
            <span className="tiny muted">دقيقة</span>
          </button>
        ))}
      </div>
      <div className="divider" />
      <label className="field">
        <span>تخصيص المدة (دقيقة)</span>
        <div className="row">
          <input className="input" type="number" min="5" max="240" step="5" value={custom} onChange={(e) => setCustom(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && startFocus(taskId, Math.max(1, +custom || 25))} />
          <button className="btn btn-primary" onClick={() => startFocus(taskId, Math.max(1, +custom || 25))}>
            <Play /> ابدأ
          </button>
        </div>
      </label>
      {task?.duration && !presets.includes(task.duration) && (
        <button className="btn btn-ghost btn-sm mt" onClick={() => startFocus(taskId, task.duration)}>
          <Timer /> مدة المهمة كاملة ({formatDuration(task.duration)})
        </button>
      )}
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
  const camera = useRef(null);
  // لصق صورة مباشرة (Ctrl+V) على الكمبيوتر
  useEffect(() => {
    const onPaste = (e) => {
      const file = [...(e.clipboardData?.files || [])].find((f) => f.type.startsWith('image/'));
      if (file) onFile(file);
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, []); // eslint-disable-line

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
    <Modal title="أضف مهمة من صورة" sub="صوّر ورقة واجب أو قائمة مهام، ومسار يستخرج المهام منها" onClose={close} size="wide">
      {/* اختيار من المعرض/الملفات (يعمل على الجوال والكمبيوتر) + التقاط بالكاميرا على الجوال */}
      <input ref={input} type="file" accept="image/*" hidden onChange={(e) => (onFile(e.target.files[0]), (e.target.value = ''))} />
      <input ref={camera} type="file" accept="image/*" capture="environment" hidden onChange={(e) => (onFile(e.target.files[0]), (e.target.value = ''))} />
      {!img ? (
        <div
          className="drop-zone"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => (e.preventDefault(), onFile(e.dataTransfer.files[0]))}
        >
          <div className="drop-ico">
            <ImagePlus size={30} />
          </div>
          <div className="bold">اختر صورة من جهازك أو صوّر ورقة</div>
          <div className="tiny muted">أو اسحب الصورة هنا، أو الصقها (Ctrl+V)</div>
          <div className="row wrap" style={{ justifyContent: 'center', marginTop: 6 }}>
            <button className="btn btn-primary" onClick={() => input.current.click()}>
              <ImagePlus /> اختيار صورة
            </button>
            <button className="btn show-mobile" onClick={() => camera.current.click()}>
              <Camera /> التقاط صورة
            </button>
          </div>
          <div className="tiny dim">يدعم العربية والإنجليزية · الصورة تُعالج على جهازك</div>
        </div>
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
  const pickFocus = useStore((s) => s.pickFocus);
  if (!task) return null;
  const opts = [
    ['now', Zap, 'الآن', 'ابدأها بجلسة تركيز'],
    ['later', Sun, 'لاحقًا اليوم', 'بعد ساعتين تقريبًا'],
    ['tomorrow', CalendarArrowUp, 'غدًا', formatLong(addDays(todayKey(), 1))],
    ['week', CalendarDays, 'هذا الأسبوع', 'قبل نهاية الأسبوع'],
  ];
  return (
    <Modal title="ماذا تريد أن تفعل بهذه المهمة؟" onClose={close}>
      <ParsedList items={[task]} />
      <div className="grid g2 mt">
        {opts.map(([k, I, l, d]) => (
          <button
            key={k}
            className="seg-btn"
            onClick={() => {
              postpone(id, k);
              close();
              if (k === 'now') pickFocus(id);
            }}
          >
            <I size={20} className="purple" />
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
  const state = useAssistantState();
  const plan = useMemo(() => rescuePlan(state), []); // eslint-disable-line react-hooks/exhaustive-deps
  const apply = useStore((s) => s.applyRescue);
  return (
    <Modal title={<span className="row"><Siren size={22} className="red" /> أنقذ يومي</span>} labelledBy="أنقذ يومي" onClose={close} size="wide">
      {!plan.total ? (
        <p className="muted">ما عندك مهام متبقية اليوم — يومك بأمان.</p>
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
                  <div className="bold row" style={{ gap: 6 }}>
                    <Glyph name={t.icon} size={16} /> {t.title}
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
                    <Glyph name={t.icon} size={14} /> {t.title}
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
  const state = useAssistantState();
  const startFocus = useStore((s) => s.startFocus);
  const [min, setMin] = useState(60);
  const r = fitInTime(state, min);
  return (
    <Modal title={<span className="row"><Hourglass size={22} className="gold" /> عندي وقت محدود</span>} labelledBy="عندي وقت محدود" sub="اختر الوقت المتاح وسأعرض أفضل ما يمكن إنجازه" onClose={close}>
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
                <span className="t-icon" style={{ color: AREAS[t.area]?.color }}>
                  <Glyph name={t.icon} size={18} />
                </span>
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
        <p className="muted">ما عندك مهام مفتوحة اليوم.</p>
      )}
    </Modal>
  );
}

// ————— وش أسوي الآن؟ —————
export function WhatNowModal() {
  const close = useStore((s) => s.closeModal);
  const state = useAssistantState();
  const pickFocus = useStore((s) => s.pickFocus);
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
              <span className="t-icon" style={{ color: AREAS[r.task.area]?.color }}>
                <Glyph name={r.task.icon} size={18} />
              </span>
              <div className="grow">
                <div className="t-title">{r.task.title}</div>
                <div className="t-meta">
                  {r.task.time && <span className="num">{r.task.time}</span>} · {formatDuration(r.task.duration)}
                </div>
              </div>
            </div>
            <div className="row mt" style={{ justifyContent: 'center' }}>
              <button className="btn btn-primary btn-lg" onClick={() => pickFocus(r.task.id)}>
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
        out.push({ title: 'استراحة', duration: 15, icon: 'coffee', area: 'health', priority: 'low', time: toHM(c), date: todayKey(), repeat: { type: 'none', days: [] } });
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
                ['low', BatteryLow, 'منخفضة'],
                ['mid', BatteryMedium, 'متوسطة'],
                ['high', BatteryFull, 'عالية'],
              ].map(([k, I, l]) => (
                <button key={k} className={`seg-btn ${energy === k ? 'on' : ''}`} onClick={() => setE(k)}>
                  <I size={22} />
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
          <div className="bold">{say(persona, 'hi')} مسار يبني يومك…</div>
        </div>
      )}
      {step === 2 && (
        <div className="onb-step">
          <h3 style={{ textAlign: 'center', marginBottom: 14 }}>خطتك جاهزة</h3>
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
                useStore.getState().toast('تمت إضافة خطتك إلى يومك', { icon: 'sparkles' });
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
    ['A', 'اسأل مسار'],
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

