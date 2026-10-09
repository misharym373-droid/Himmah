// النوافذ التفاعلية: الصوت، الصورة، التركيز، إعادة التخطيط، أنقذ يومي، عندي ساعة، وش أسوي الآن، التجربة التفاعلية
import { useEffect, useMemo, useRef, useState } from 'react';
import { Mic, Square, Check, X, ImagePlus, Camera, Loader2, Sparkles, Play, CalendarPlus, Trash2, ArrowLeft, Undo2, Keyboard, Calendar, Clock, Timer, Repeat, MicOff, RotateCcw, Pencil, Zap, Sun, CalendarArrowUp, CalendarDays, BatteryLow, BatteryMedium, BatteryFull, Siren, Hourglass } from 'lucide-react';
import { useStore } from '../store.js';
import { useAssistantState } from '../hooks.js';
import { Modal, CheckBox, Switch } from './ui.jsx';
import { Glyph } from './Glyph.jsx';
import { parseTasks, guessMeta } from '../lib/nlp.js';
import { extractText } from '../lib/ocr.js';
import { filterOcrLines, linesToItems, nextDateFor } from '../lib/scheduleOcr.js';
import { ScenePicker, useSceneSettings, useCustomMedia } from './FocusScene.jsx';
import { rescuePlan, fitInTime, suggestNow, say } from '../lib/assistant.js';
import { formatDuration, relativeDay, todayKey, addDays, formatLong, formatShort, dayName, toMin } from '../lib/date.js';
import { AREAS, PRIORITIES } from '../config.js';
import { tr, trf, isEn } from '../i18n/index.js';

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
              <span className="meta-item num"><Clock size={12} /> {t.time || tr('طوال اليوم')}</span>
              {t.time && <span className="meta-item"><Timer size={12} /> {formatDuration(t.duration)}</span>}
              {t.priority && t.priority !== 'med' && <span className="prio-tag" style={{ '--c': PRIORITIES[t.priority]?.color }}>{tr(PRIORITIES[t.priority]?.label)}</span>}
              {t.repeat?.type && t.repeat.type !== 'none' && <span className="meta-item"><Repeat size={12} /> {tr('متكررة')}</span>}
            </div>
          </div>
          {onOpen && <Pencil size={15} className="dim" aria-hidden />}
          {onRemove && (
            <button className="icon-btn sm plain" aria-label={trf('إزالة {title}', { title: t.title })} onClick={() => onRemove(i)}>
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
            <input className="input" value={t.title} aria-label={tr('عنوان المهمة')} onChange={(e) => upd(i, { title: e.target.value, ...guessMeta(e.target.value) })} />
            <button className="icon-btn sm plain" aria-label={trf('إزالة {title}', { title: t.title })} onClick={() => onChange(items.filter((_, j) => j !== i))}>
              <X />
            </button>
          </div>
          <div className="parsed-fields">
            <label className="field">
              <span>{tr('التاريخ')}</span>
              <input className="input" type="date" value={t.date} onChange={(e) => upd(i, { date: e.target.value })} />
            </label>
            <label className="field">
              <span className="row between">
                {tr('الوقت')}
                <button type="button" className={`chip chip-xs ${!t.time ? 'on' : ''}`} onClick={() => upd(i, { time: null })}>
                  {tr('طوال اليوم')}
                </button>
              </span>
              <input className="input" type="time" value={t.time || ''} onChange={(e) => upd(i, { time: e.target.value || null })} />
            </label>
            <label className="field">
              <span>{tr('المدة (د)')}</span>
              <input className="input" type="number" min="5" step="5" value={t.duration} onChange={(e) => upd(i, { duration: Math.max(5, +e.target.value || 30) })} />
            </label>
            <label className="field">
              <span>{tr('الأولوية')}</span>
              <select className="select" value={t.priority || 'med'} onChange={(e) => upd(i, { priority: e.target.value })}>
                {Object.entries(PRIORITIES).map(([k, p]) => (
                  <option key={k} value={k}>{tr(p.label)}</option>
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
      r.lang = isEn() ? 'en-US' : 'ar-SA';
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
          'not-allowed': tr('اسمح للموقع باستخدام الميكروفون من إعدادات المتصفح.'),
          'service-not-allowed': tr('اسمح للموقع باستخدام الميكروفون من إعدادات المتصفح.'),
          'no-speech': tr('ما سمعت شيء. حاول مرة ثانية وتكلم بوضوح.'),
          'audio-capture': tr('ما فيه ميكروفون متصل بالجهاز.'),
          network: tr('التعرف على الصوت يحتاج اتصال بالإنترنت.'),
        }[e.error];
        if (e.error !== 'aborted') setErr(msg || tr('تعذر التعرف على الصوت، حاول مرة أخرى أو اكتب مهامك.'));
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
      setErr(tr('تعذر تشغيل الميكروفون. اكتب مهامك بالأسفل.'));
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
    s.toast(list.length > 1 ? trf('تمت إضافة {n} مهام إلى يومك', { n: list.length }) : trf('تمت إضافة "{title}" إلى يومك', { title: list[0].title }), { icon: 'check' });
    close();
  }
  const example = isEn() ? 'Remind me tomorrow at 8pm to study calculus for an hour' : 'ذكرني بكرة الساعة 8 أذاكر التفاضل لمدة ساعة';
  const listening = status === 'listening';
  const label = { idle: tr('اضغط على المايك وتكلم'), listening: tr('أسمعك الآن… تكلم براحتك'), review: items.length ? tr('راجع المهام قبل الحفظ') : tr('ما فهمت مهام واضحة — عدّل النص'), unsupported: tr('التعرف على الصوت غير مدعوم في هذا المتصفح') }[status];

  return (
    <Modal title={tr('إضافة بالصوت')} sub={tr('تكلم بطريقتك: المهمة، الوقت، والمدة')} onClose={close} size={items.length ? 'wide' : ''}>
      <div className="col" style={{ alignItems: 'stretch', gap: 16 }}>
        <div className="voice-stage" aria-live="polite">
          <button className={`mic-big ${listening ? 'live' : ''}`} onClick={listening ? stop : start} disabled={status === 'unsupported'} aria-pressed={listening} aria-label={listening ? tr('إيقاف التسجيل') : tr('ابدأ التسجيل الصوتي')}>
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
          {status === 'unsupported' && <p className="small muted">{tr('جرّب Chrome أو Safari، أو اكتب مهامك بالأسفل — النتيجة نفسها.')}</p>}
        </div>
        {err && <div className="err" role="alert">{err}</div>}
        <label className="field">
          <span>{tr('النص')} {status === 'review' ? tr('(تقدر تعدّله)') : ''}</span>
          <div className="row">
            <input className="input" value={text} placeholder={tr('أو اكتب هنا…')} onChange={(e) => setTranscript(e.target.value)} />
            {!text && (
              <button className="btn btn-sm" onClick={() => (setTranscript(example), setStatus('review'))}>
                {tr('مثال')}
              </button>
            )}
            {text && !listening && (
              <button className="icon-btn" aria-label={tr('مسح وإعادة التسجيل')} title={tr('من جديد')} onClick={() => (setTranscript(''), setStatus(SR ? 'idle' : 'unsupported'))}>
                <RotateCcw />
              </button>
            )}
          </div>
        </label>
        {items.length > 0 && !listening && (
          <>
            <div className="row green bold small">
              <Check size={16} /> {items.length > 1 ? trf('فهمت {n} مهام — عدّل أي شيء قبل الحفظ', { n: items.length }) : tr('فهمت مهمة واحدة — عدّل أي شيء قبل الحفظ')}
            </div>
            <ParsedEditor items={items} onChange={setItems} />
            <button className="btn btn-primary btn-lg btn-block" onClick={add} disabled={!items.some((t) => t.title.trim())}>
              <CalendarPlus /> {tr('إضافة إلى يومي')}
            </button>
          </>
        )}
        <p className="tiny dim" style={{ textAlign: 'center' }}>
          {tr('التحليل يتم محليًا على جهازك')}
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
      title={tasks.length > 1 ? trf('أضفت {n} مهام', { n: tasks.length }) : tr('تمت إضافة المهمة')}
      sub={tr('اضغط على أي مهمة لتعديلها')}
      footer={
        <>
          <button className="btn btn-ghost" onClick={() => (ids.forEach(purge), close(), useStore.getState().toast(tr('تم التراجع')))}>
            <Undo2 /> {tr('تراجع')}
          </button>
          <button className="btn btn-primary" onClick={close}>
            <Check /> {tr('تمام')}
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
  const tasks = useStore((s) => s.tasks);
  const startFocus = useStore((s) => s.startFocus);
  // المهمة اختيارية: «تركيز حر» بدون ربط بمهمة
  const [pick, setPick] = useState(taskId || '');
  const task = tasks.find((t) => t.id === pick);
  const open = useMemo(() => tasks.filter((t) => !t.done && !t.deletedAt && !t.template && t.date === todayKey()).slice(0, 30), [tasks]);
  const [custom, setCustom] = useState(task?.duration || 25);
  const cfg = useSceneSettings();
  const media = useCustomMedia();
  const presets = [15, 25, 45];
  const go = (m) => startFocus(pick || null, m);
  return (
    <Modal title={tr('ابدأ جلسة تركيز')} sub={task ? task.title : tr('تركيز حر — بدون ربط بمهمة')} onClose={close} size="wide">
      <label className="field">
        <span>{tr('على ماذا ستركّز؟')}</span>
        <select className="select" value={pick} onChange={(e) => setPick(e.target.value)}>
          <option value="">{tr('تركيز حر (بدون مهمة)')}</option>
          {task && !open.includes(task) && <option value={task.id}>{task.title}</option>}
          {open.map((t) => (
            <option key={t.id} value={t.id}>
              {t.title}
            </option>
          ))}
        </select>
      </label>
      <div className="focus-presets mt">
        {presets.map((m) => (
          <button key={m} className="seg-btn" onClick={() => go(m)}>
            <span className="xbold num" style={{ fontSize: '1.6rem' }}>{m}</span>
            <span className="tiny muted">{tr('دقيقة')}</span>
          </button>
        ))}
      </div>
      <label className="field mt">
        <span>{tr('تخصيص المدة (دقيقة)')}</span>
        <div className="row">
          <input className="input" type="number" min="5" max="240" step="5" value={custom} onChange={(e) => setCustom(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && go(Math.max(1, +custom || 25))} />
          <button className="btn btn-primary" onClick={() => go(Math.max(1, +custom || 25))}>
            <Play /> {tr('ابدأ')}
          </button>
        </div>
      </label>
      {task?.duration && !presets.includes(task.duration) && (
        <button className="btn btn-ghost btn-sm mt" onClick={() => go(task.duration)}>
          <Timer /> {trf('مدة المهمة كاملة ({d})', { d: formatDuration(task.duration) })}
        </button>
      )}
      <div className="divider" />
      <ScenePicker cfg={cfg} media={media} compact />
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
  const [items, setItems] = useState([]);
  const [ocr, setOcr] = useState({ keep: [], dropped: [] });
  const [showIgnored, setShowIgnored] = useState(false);
  const [weekly, setWeekly] = useState(false);
  const [err, setErr] = useState('');
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

  function build(keep, dropped, withIgnored) {
    const found = linesToItems(withIgnored ? [...keep, ...dropped] : keep);
    setItems(found);
    setWeekly(found.some((x) => x.dow != null));
    return found;
  }
  async function onFile(file) {
    if (!file) return;
    if (!file.type.startsWith('image/')) return setErr(tr('الملف يجب أن يكون صورة'));
    setErr('');
    setItems([]);
    setImg(URL.createObjectURL(file));
    setBusy(true);
    setProgress(0);
    try {
      const data = await extractText(file, setProgress);
      const res = filterOcrLines(data);
      setOcr(res);
      setShowIgnored(false);
      const found = build(res.keep, res.dropped, false);
      if (!found.length) setErr(tr('ما قدرت ألقى مهام واضحة في الصورة. جرّب صورة أوضح أو أضف المهام يدويًا.'));
    } catch (e) {
      setErr(e.message || tr('حدث خطأ أثناء قراءة الصورة'));
    } finally {
      setBusy(false);
    }
  }
  const upd = (i, patch) => setItems(items.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  function setDay(i, v) {
    const dow = v === '' ? null : +v;
    upd(i, { dow, date: dow == null ? todayKey() : nextDateFor(dow) });
  }
  function setRange(i, key, v) {
    const it = { ...items[i], [key]: v || null };
    const a = toMin(it.time);
    const e = toMin(it.end);
    upd(i, { [key]: v || null, duration: a != null && e != null && e > a ? e - a : it.duration });
  }
  function add() {
    const chosen = items.filter((l) => l.on && l.title.trim());
    addTasks(
      chosen.map((l) => ({
        ...guessMeta(l.title),
        title: l.title.trim(),
        date: l.date,
        time: l.time || null,
        duration: l.duration || 60,
        desc: l.place ? trf('المكان: {place}', { place: l.place }) : '',
        repeat: weekly && l.dow != null ? { type: 'days', days: [l.dow] } : { type: 'none', days: [] },
      }))
    );
    useStore.getState().toast(trf('تمت إضافة {n} مهام من الصورة', { n: chosen.length }), { icon: 'check' });
    close();
  }
  const count = items.filter((l) => l.on).length;
  return (
    <Modal title={tr('أضف مهمة من صورة')} sub={tr('صوّر جدولك أو قائمة مهامك، ومسار يستخرج اليوم والوقت والمكان')} onClose={close} size="xl">
      {/* اختيار من المعرض/الملفات (يعمل على الجوال والكمبيوتر) + التقاط بالكاميرا على الجوال */}
      <input ref={input} type="file" accept="image/*" hidden onChange={(e) => (onFile(e.target.files[0]), (e.target.value = ''))} />
      <input ref={camera} type="file" accept="image/*" capture="environment" hidden onChange={(e) => (onFile(e.target.files[0]), (e.target.value = ''))} />
      {!img ? (
        <div className="drop-zone" onDragOver={(e) => e.preventDefault()} onDrop={(e) => (e.preventDefault(), onFile(e.dataTransfer.files[0]))}>
          <div className="drop-ico">
            <ImagePlus size={30} />
          </div>
          <div className="bold">{tr('اختر صورة من جهازك أو صوّر ورقة')}</div>
          <div className="tiny muted">{tr('أو اسحب الصورة هنا، أو الصقها (Ctrl+V)')}</div>
          <div className="row wrap" style={{ justifyContent: 'center', marginTop: 6 }}>
            <button className="btn btn-primary" onClick={() => input.current.click()}>
              <ImagePlus /> {tr('اختيار صورة')}
            </button>
            <button className="btn show-mobile" onClick={() => camera.current.click()}>
              <Camera /> {tr('التقاط صورة')}
            </button>
          </div>
          <div className="tiny dim">{tr('يفهم الجداول: «الأحد 8-12 محاضرة الرياضيات قاعة 3» · العربية والإنجليزية · الصورة تُعالج على جهازك')}</div>
        </div>
      ) : (
        <div className="ocr-layout">
          <div className="ocr-image">
            <img src={img} alt={tr('الصورة المرفوعة')} />
            <button className="btn btn-sm btn-ghost mt-s" onClick={() => input.current.click()}>
              {tr('تغيير الصورة')}
            </button>
          </div>
          <div className="grow" style={{ minWidth: 0 }}>
            {busy ? (
              <div className="col" style={{ alignItems: 'center', padding: 30 }}>
                <Loader2 className="purple" size={36} style={{ animation: 'spin 1s linear infinite' }} />
                <div className="bold">
                  {tr('جاري قراءة الصورة…')} <span className="num">{progress}%</span>
                </div>
                <div style={{ width: '100%' }}>
                  <div className="bar">
                    <i style={{ width: `${progress}%` }} />
                  </div>
                </div>
                <p className="tiny dim">{tr('أول مرة قد تأخذ وقتًا أطول لتحميل محرك القراءة')}</p>
              </div>
            ) : (
              items.length > 0 && (
                <div className="col" style={{ gap: 10 }}>
                  <div className="row between wrap">
                    <div className="bold green row">
                      <Check size={18} /> {trf('وجدت {n} مهام', { n: items.length })}
                    </div>
                    {items.some((x) => x.dow != null) && (
                      <label className="row small" style={{ cursor: 'pointer' }}>
                        <Switch on={weekly} onChange={setWeekly} label={tr('كرر أسبوعيًا')} /> {tr('كرر أسبوعيًا (جدول ثابت)')}
                      </label>
                    )}
                  </div>
                  <div className="ocr-list">
                    {items.map((l, i) => (
                      <div className={`ocr-item ${l.on ? '' : 'off'}`} key={i}>
                        <CheckBox on={l.on} onChange={(v) => upd(i, { on: v })} label={l.title} />
                        <div className="ocr-fields">
                          <input className="input ocr-title" value={l.title} onChange={(e) => upd(i, { title: e.target.value })} aria-label={tr('عنوان المهمة')} />
                          <select className="select" value={l.dow ?? ''} onChange={(e) => setDay(i, e.target.value)} aria-label={tr('يوم الأسبوع')}>
                            <option value="">{formatShort(l.date)}</option>
                            {[0, 1, 2, 3, 4, 5, 6].map((d) => (
                              <option key={d} value={d}>
                                {dayName(d)}
                              </option>
                            ))}
                          </select>
                          <input className="input" type="time" value={l.time || ''} onChange={(e) => setRange(i, 'time', e.target.value)} aria-label={tr('من')} />
                          <input className="input" type="time" value={l.end || ''} onChange={(e) => setRange(i, 'end', e.target.value)} aria-label={tr('إلى')} />
                          <input className="input" value={l.place} placeholder={tr('المكان')} onChange={(e) => upd(i, { place: e.target.value })} aria-label={tr('المكان')} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            )}
            {!busy && ocr.dropped.length > 0 && (
              <p className="tiny muted mt-s">
                {trf('تجاهلت {n} سطرًا (نص صغير أو إشعارات أو غير واضح).', { n: ocr.dropped.length })}{' '}
                <button className="purple bold" onClick={() => (setShowIgnored(!showIgnored), build(ocr.keep, ocr.dropped, !showIgnored))}>
                  {showIgnored ? tr('إخفاؤها') : tr('إظهارها')}
                </button>
              </p>
            )}
          </div>
        </div>
      )}
      {err && <div className="err mt">{err}</div>}
      {count > 0 && !busy && (
        <div className="modal-ft">
          <button className="btn btn-primary" onClick={add}>
            <CalendarPlus /> {trf('إضافة {n} مهام', { n: count })}
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
    ['now', Zap, tr('الآن'), tr('ابدأها بجلسة تركيز')],
    ['later', Sun, tr('لاحقًا اليوم'), tr('بعد ساعتين تقريبًا')],
    ['tomorrow', CalendarArrowUp, tr('غدًا'), formatLong(addDays(todayKey(), 1))],
    ['week', CalendarDays, tr('هذا الأسبوع'), tr('قبل نهاية الأسبوع')],
  ];
  return (
    <Modal title={tr('ماذا تريد أن تفعل بهذه المهمة؟')} onClose={close}>
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
        <Trash2 /> {tr('حذف المهمة')}
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
    <Modal title={<span className="row"><Siren size={22} className="red" /> {tr('أنقذ يومي')}</span>} labelledBy={tr('أنقذ يومي')} onClose={close} size="wide">
      {!plan.total ? (
        <p className="muted">{tr('ما عندك مهام متبقية اليوم — يومك بأمان.')}</p>
      ) : (
        <>
          <div className="grid g2 mb">
            <div className="mini-stat">
              <div className="v num">{plan.total}</div>
              <div className="l">{tr('مهام متبقية')}</div>
            </div>
            <div className="mini-stat">
              <div className="v">{formatDuration(plan.remaining)}</div>
              <div className="l">{tr('الوقت المتبقي حتى النوم')}</div>
            </div>
          </div>
          <p className="muted mb">{plan.text}</p>
          <div className="bold mb">{trf('خطتك الجديدة — أهم {n} مهام:', { n: plan.keep.length })}</div>
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
              <div className="bold mt mb">{trf('نقترح نقلها لبكرة ({n}):', { n: plan.move.length })}</div>
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
              {tr('إلغاء')}
            </button>
            <button className="btn btn-primary" onClick={() => (apply(plan), close())}>
              <Sparkles /> {tr('طبّق الخطة')}
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
    <Modal title={<span className="row"><Hourglass size={22} className="gold" /> {tr('عندي وقت محدود')}</span>} labelledBy={tr('عندي وقت محدود')} sub={tr('اختر الوقت المتاح وسأعرض أفضل ما يمكن إنجازه')} onClose={close}>
      <div className="chips mb">
        {[15, 30, 45, 60, 90, 120].map((m) => (
          <button key={m} className={`chip ${min === m ? 'on' : ''}`} onClick={() => setMin(m)}>
            <span className="num">{m}</span> {tr('دقيقة')}
          </button>
        ))}
      </div>
      {r.tasks.length ? (
        <>
          <p className="muted mb">
            {tr('خلال')} <b>{formatDuration(min)}</b> {trf('تقدر تنجز {n} مهام ({used}):', { n: r.tasks.length, used: formatDuration(r.used) })}
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
                  <Play /> {tr('ابدأ')}
                </button>
              </div>
            ))}
          </div>
        </>
      ) : r.partial ? (
        <p className="muted">
          {tr('ما فيه مهمة كاملة تناسب هذا الوقت، لكن تقدر تبدأ جزء من')} <b>{r.partial.title}</b>.
          <button className="btn btn-sm btn-primary mt" onClick={() => (close(), startFocus(r.partial.id, min))}>
            <Play /> {trf('ابدأ {n} دقيقة منها', { n: min })}
          </button>
        </p>
      ) : (
        <p className="muted">{tr('ما عندك مهام مفتوحة اليوم.')}</p>
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
            <div className="bold">{tr('أحلل وقتك ومهامك وطاقتك…')}</div>
            <div className="typing">
              <i />
              <i />
              <i />
            </div>
          </div>
        ) : r.task ? (
          <div className="onb-step">
            <p className="muted small">{tr('وش أسوي الآن؟')}</p>
            <h3 style={{ fontSize: '1.4rem', margin: '8px 0 6px' }}>{r.text}</h3>
            {r.reasons?.length > 0 && (
              <div className="chips" style={{ justifyContent: 'center' }}>
                {r.reasons.map((x) => (
                  <span className="badge purple" key={x}>
                    {x}
                  </span>
                ))}
                {!energy && <span className="badge">{tr('حدد طاقتك لاقتراح أدق')}</span>}
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
                <Play /> {tr('ابدأ المهمة')}
              </button>
            </div>
            {r.alternatives?.length > 0 && (
              <p className="tiny dim mt">
                {trf('بدائل: {list}', { list: r.alternatives.map((a) => a.title).join(tr('، ')) })}
              </p>
            )}
          </div>
        ) : (
          <div className="onb-step">
            <h3>{r.text}</h3>
            <button className="btn btn-primary mt" onClick={() => open('task')}>
              {tr('إضافة مهمة')}
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
    const base = what.trim() || tr('مذاكرة التفاضل');
    const brk = tr('استراحة');
    const parsed = parseTasks(base);
    const main = parsed[0] || { title: base, duration: 60, ...guessMeta(base) };
    const now = new Date();
    let c = Math.ceil((now.getHours() * 60 + now.getMinutes() + 10) / 5) * 5;
    const chunk = energy === 'low' ? 25 : energy === 'mid' ? 45 : 60;
    const out = [];
    let budget = hours * 60;
    let n = 1;
    while (budget >= chunk && out.length < 6 && c < 23 * 60) {
      out.push({ title: n > 1 ? trf('{title} — جلسة {n}', { title: main.title, n }) : main.title, duration: chunk, icon: main.icon, area: main.area, priority: n === 1 ? 'high' : 'med', time: toHM(c), date: todayKey(), repeat: { type: 'none', days: [] } });
      c += chunk;
      budget -= chunk;
      if (budget >= 15 && out.length < 6) {
        out.push({ title: brk, duration: 15, icon: 'coffee', area: 'health', priority: 'low', time: toHM(c), date: todayKey(), repeat: { type: 'none', days: [] } });
        c += 15;
        budget -= 15;
      }
      n++;
    }
    if (out.at(-1)?.title === brk) out.pop();
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
            <h3 style={{ fontSize: '1.5rem' }}>{tr('لنبدأ رحلتك')}</h3>
            <p className="muted small">{tr('أخبرنا قليلًا عن يومك، وسنصمم لك خطة مخصصة.')}</p>
          </div>
          <label className="field">
            <span>{tr('ما أهم شيء تود إنجازه اليوم؟')}</span>
            <input className="input" value={what} onChange={(e) => setWhat(e.target.value)} placeholder={tr('أذاكر التفاضل')} autoFocus onKeyDown={(e) => e.key === 'Enter' && build()} />
          </label>
          <div className="field">
            <span>{tr('ما طاقتك اليوم؟')}</span>
            <div className="seg">
              {[
                ['low', BatteryLow, tr('منخفضة')],
                ['mid', BatteryMedium, tr('متوسطة')],
                ['high', BatteryFull, tr('عالية')],
              ].map(([k, I, l]) => (
                <button key={k} className={`seg-btn ${energy === k ? 'on' : ''}`} onClick={() => setE(k)}>
                  <I size={22} />
                  {l}
                </button>
              ))}
            </div>
          </div>
          <div className="field">
            <span>{tr('كم لديك من الوقت؟')}</span>
            <div className="seg">
              {[2, 4, 6, 10].map((h) => (
                <button key={h} className={`seg-btn ${hours === h ? 'on' : ''}`} onClick={() => setHours(h)}>
                  {h === 10 ? tr('اليوم كامل') : <span><span className="num">{h}</span> {tr('ساعات')}</span>}
                </button>
              ))}
            </div>
          </div>
          <button className="btn btn-primary btn-lg btn-block" onClick={build}>
            {tr('ابدأ')} <ArrowLeft />
          </button>
        </div>
      )}
      {step === 1 && (
        <div className="build-anim onb-step">
          <div className="spinner" />
          <div className="bold">{say(persona, 'hi')} {tr('مسار يبني يومك…')}</div>
        </div>
      )}
      {step === 2 && (
        <div className="onb-step">
          <h3 style={{ textAlign: 'center', marginBottom: 14 }}>{tr('خطتك جاهزة')}</h3>
          <ParsedList items={plan} onRemove={(i) => setPlan(plan.filter((_, j) => j !== i))} />
          <div className="modal-ft">
            <button className="btn btn-ghost" onClick={() => setStep(0)}>
              {tr('تعديل')}
            </button>
            <button
              className="btn btn-primary"
              onClick={() => {
                setEnergy(energy);
                addTasks(plan);
                useStore.getState().toast(tr('تمت إضافة خطتك إلى يومك'), { icon: 'sparkles' });
                close();
                document.getElementById('day-map')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }}
            >
              <CalendarPlus /> {tr('أضفها ليومي')}
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
    ['Ctrl / ⌘ + K', tr('قائمة الأوامر والبحث')],
    ['N', tr('مهمة جديدة')],
    ['/', tr('الإدخال السريع')],
    ['V', tr('إضافة بالصوت')],
    ['W', tr('وش أسوي الآن؟')],
    ['A', tr('اسأل مسار')],
    ['G ثم H', tr('الرئيسية')],
    ['G ثم T', tr('المهام')],
    ['G ثم S', tr('الجدول')],
    ['?', tr('عرض الاختصارات')],
    ['Esc', tr('إغلاق النافذة')],
  ];
  return (
    <Modal title={<span className="row"><Keyboard size={22} /> {tr('اختصارات لوحة المفاتيح')}</span>} labelledBy={tr('اختصارات لوحة المفاتيح')} onClose={close}>
      <div className="col">
        {rows.map(([k, l]) => (
          <div className="row between" key={k}>
            <span>{l}</span>
            <span className="row" style={{ gap: 4 }}>
              {k.split(' ').map((p, i) => (p === '+' || p === 'ثم' ? <span key={i} className="tiny dim">{p === '+' ? p : tr('ثم')}</span> : <span key={i} className="kbd">{p}</span>))}
            </span>
          </div>
        ))}
      </div>
    </Modal>
  );
}

