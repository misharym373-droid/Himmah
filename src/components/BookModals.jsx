// مكتبتي: الغلاف + نوافذ (إضافة/تعديل كتاب، تسجيل قراءة، إنهاء الكتاب) + الفوائد والاقتباسات
import { useMemo, useRef, useState } from 'react';
import { BookOpen, Camera, ImagePlus, Check, Star, Trash2, Quote, StickyNote, X, Plus, CalendarClock, Timer } from 'lucide-react';
import { useStore } from '../store.js';
import { Modal, useConfirm } from './ui.jsx';
import { BOOK_COLORS, bookStats, compressImage } from '../lib/books.js';
import { todayKey, addDays, formatShort, formatLong, formatDuration } from '../lib/date.js';
import { tr, trf, isEn } from '../i18n/index.js';

const STATUSES = [
  ['reading', 'أقرأه الحين'],
  ['want', 'أبغى أقرأه'],
  ['done', 'خلصته'],
];

export function BookCover({ book, size = 64 }) {
  const color = book.color || BOOK_COLORS[(book.title || '').length % BOOK_COLORS.length];
  return (
    <span className="book-cover" style={{ width: size, height: Math.round(size * 1.45), '--bc': color }}>
      {book.cover ? <img src={book.cover} alt="" /> : <span className="bc-title">{(book.title || '').slice(0, 18)}</span>}
    </span>
  );
}

export function Stars({ value, onChange, size = 20 }) {
  return (
    <span className="stars" role={onChange ? 'radiogroup' : undefined} aria-label={tr('التقييم')}>
      {[1, 2, 3, 4, 5].map((n) =>
        onChange ? (
          <button key={n} type="button" className={n <= (value || 0) ? 'on' : ''} onClick={() => onChange(n === value ? null : n)} aria-label={trf('{n} من 5', { n })} aria-pressed={n <= (value || 0)}>
            <Star size={size} />
          </button>
        ) : (
          <Star key={n} size={size} className={n <= (value || 0) ? 'on' : ''} />
        )
      )}
    </span>
  );
}

function ImageButtons({ onPick, label }) {
  const gallery = useRef(null);
  const camera = useRef(null);
  return (
    <div className="row" style={{ gap: 6 }}>
      <button type="button" className="btn btn-sm" onClick={() => gallery.current.click()}>
        <ImagePlus size={15} /> {label || tr('من الصور')}
      </button>
      <button type="button" className="btn btn-sm" onClick={() => camera.current.click()}>
        <Camera size={15} /> {tr('الكاميرا')}
      </button>
      <input ref={gallery} type="file" accept="image/*" hidden onChange={(e) => (onPick(e.target.files[0]), (e.target.value = ''))} />
      <input ref={camera} type="file" accept="image/*" capture="environment" hidden onChange={(e) => (onPick(e.target.files[0]), (e.target.value = ''))} />
    </div>
  );
}

// ————— إضافة / تعديل كتاب (التفاصيل + الفوائد + السجل) —————
export function BookModal({ book, onClose }) {
  const editing = !!book;
  const { addBook, updateBook, deleteBook } = useStore.getState();
  const confirm = useConfirm();
  const [tab, setTab] = useState('info');
  const [f, setF] = useState(() => ({ title: '', author: '', pages: '', currentPage: 0, status: 'reading', cover: null, color: '', daily: 20, targetDate: null, ...(book || {}) }));
  const [mode, setMode] = useState(book?.targetDate ? 'date' : 'daily');
  const [err, setErr] = useState('');
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const T = todayKey();
  const preview = useMemo(() => (+f.pages > 0 ? bookStats({ ...f, pages: +f.pages, currentPage: +f.currentPage || 0, targetDate: mode === 'date' ? f.targetDate : null, daily: +f.daily || 20 }, T) : null), [f, mode, T]);

  async function onCover(file) {
    if (!file) return;
    try {
      set('cover', await compressImage(file, 360, 0.78));
    } catch (e) {
      console.warn('[himmah:books]', e?.message || e);
      useStore.getState().toast(tr('تعذر قراءة الصورة'));
    }
  }
  function save() {
    const pages = Math.round(+f.pages);
    if (!f.title.trim()) return setErr(tr('اكتب اسم الكتاب'));
    if (!(pages > 0)) return setErr(tr('اكتب عدد صفحات الكتاب'));
    if (mode === 'date' && !f.targetDate) return setErr(tr('اختر تاريخ الانتهاء'));
    const data = {
      ...f,
      title: f.title.trim(),
      author: f.author.trim(),
      pages,
      currentPage: Math.min(pages, Math.max(0, Math.round(+f.currentPage || 0))),
      daily: mode === 'daily' ? Math.max(1, Math.round(+f.daily || 20)) : null,
      targetDate: mode === 'date' ? f.targetDate : null,
    };
    if (editing) updateBook(book.id, data);
    else addBook(data);
    useStore.getState().toast(editing ? tr('تم حفظ التعديلات') : trf('أُضيف "{title}" لمكتبتك', { title: data.title }), { icon: 'check' });
    onClose();
  }

  return (
    <Modal
      title={editing ? book.title : tr('كتاب جديد')}
      sub={editing ? book.author : tr('أضف الكتاب وحدد كم صفحة تقرأ باليوم أو متى تبغى تخلصه')}
      onClose={onClose}
      size="wide"
      footer={
        tab === 'info' ? (
          <>
            {editing && (
              <button className="btn btn-ghost red" style={{ marginInlineEnd: 'auto' }} onClick={() => confirm({ title: tr('حذف الكتاب'), body: trf('سيتم حذف "{title}" وفوائده. تقدر تتراجع مباشرة بعد الحذف.', { title: book.title }), danger: true, confirmLabel: tr('حذف'), onConfirm: () => (deleteBook(book.id), onClose()) })}>
                <Trash2 /> {tr('حذف')}
              </button>
            )}
            <button className="btn btn-ghost" onClick={onClose}>
              {tr('إلغاء')}
            </button>
            <button className="btn btn-primary" onClick={save}>
              <Check /> {editing ? tr('حفظ') : tr('إضافة الكتاب')}
            </button>
          </>
        ) : null
      }
    >
      {editing && (
        <div className="tabs mb" role="tablist">
          {[
            ['info', 'التفاصيل'],
            ['notes', 'الفوائد والاقتباسات'],
            ['log', 'سجل القراءة'],
          ].map(([k, l]) => (
            <button key={k} role="tab" aria-selected={tab === k} className={`tab ${tab === k ? 'on' : ''}`} onClick={() => setTab(k)}>
              {tr(l)}
            </button>
          ))}
        </div>
      )}
      {tab === 'notes' && <BookNotes book={book} />}
      {tab === 'log' && <BookLog book={book} />}
      {tab === 'info' && (
        <div className="col" style={{ gap: 16 }}>
          <div className="row" style={{ gap: 16, alignItems: 'flex-start' }}>
            <div className="col" style={{ gap: 8, alignItems: 'center' }}>
              <BookCover book={{ ...f }} size={84} />
              {f.cover && (
                <button className="btn btn-xs btn-ghost" onClick={() => set('cover', null)}>
                  <X size={13} /> {tr('حذف الغلاف')}
                </button>
              )}
            </div>
            <div className="col grow" style={{ gap: 12, minWidth: 0 }}>
              <label className="field">
                <span>{tr('اسم الكتاب')}</span>
                <input className="input" value={f.title} onChange={(e) => set('title', e.target.value)} placeholder={tr('مثال: العادات الذرية')} />
              </label>
              <label className="field">
                <span>{tr('المؤلف (اختياري)')}</span>
                <input className="input" value={f.author} onChange={(e) => set('author', e.target.value)} />
              </label>
              <div className="field">
                <span>{tr('الغلاف (اختياري)')}</span>
                <ImageButtons onPick={onCover} />
              </div>
            </div>
          </div>
          <div className="grid g2">
            <label className="field">
              <span>{tr('عدد الصفحات')}</span>
              <input className="input num" type="number" inputMode="numeric" min="1" value={f.pages} onChange={(e) => set('pages', e.target.value)} />
            </label>
            <label className="field">
              <span>{tr('وصلت صفحة')}</span>
              <input className="input num" type="number" inputMode="numeric" min="0" value={f.currentPage} onChange={(e) => set('currentPage', e.target.value)} />
            </label>
          </div>
          <div className="field">
            <span>{tr('الحالة')}</span>
            <div className="chips">
              {STATUSES.map(([k, l]) => (
                <button key={k} className={`chip ${f.status === k ? 'on' : ''}`} onClick={() => set('status', k)}>
                  {tr(l)}
                </button>
              ))}
            </div>
          </div>
          {f.status !== 'done' && (
            <div className="field">
              <span>{tr('خطة القراءة')}</span>
              <div className="chips">
                <button className={`chip ${mode === 'daily' ? 'on' : ''}`} onClick={() => setMode('daily')}>
                  <BookOpen size={14} /> {tr('عدد صفحات يومي')}
                </button>
                <button className={`chip ${mode === 'date' ? 'on' : ''}`} onClick={() => (setMode('date'), !f.targetDate && set('targetDate', addDays(T, 14)))}>
                  <CalendarClock size={14} /> {tr('أخلصه قبل تاريخ')}
                </button>
              </div>
              {mode === 'daily' ? (
                <div className="row mt-s" style={{ gap: 8 }}>
                  <input className="input num" style={{ maxWidth: 110 }} type="number" min="1" value={f.daily ?? 20} onChange={(e) => set('daily', e.target.value)} aria-label={tr('صفحات باليوم')} />
                  <span className="small muted">{tr('صفحة باليوم')}</span>
                </div>
              ) : (
                <div className="row wrap mt-s" style={{ gap: 6 }}>
                  {[7, 14, 30].map((d) => (
                    <button key={d} className={`chip ${f.targetDate === addDays(T, d) ? 'on' : ''}`} onClick={() => set('targetDate', addDays(T, d))}>
                      {d === 7 ? tr('أسبوع') : d === 14 ? tr('أسبوعين') : tr('شهر')}
                    </button>
                  ))}
                  <input className="input" type="date" min={T} style={{ maxWidth: 170 }} value={f.targetDate || ''} onChange={(e) => set('targetDate', e.target.value || null)} aria-label={tr('تاريخ الانتهاء')} />
                </div>
              )}
              {preview && preview.remaining > 0 && (
                <div className="tiny muted mt-s">
                  {mode === 'date' && f.targetDate
                    ? trf('تحتاج {n} صفحة باليوم عشان تخلصه قبل {date}', { n: preview.target, date: formatShort(f.targetDate) })
                    : trf('بهالمعدل تخلصه بعد {d} يوم تقريبًا', { d: Math.ceil(preview.remaining / Math.max(1, +f.daily || 20)) })}
                </div>
              )}
            </div>
          )}
          {err && <div className="small red">{err}</div>}
        </div>
      )}
    </Modal>
  );
}

// ————— تسجيل قراءة: "وصلت صفحة كم؟" —————
export function BookLogModal({ bookId, minutes = 0 }) {
  const close = useStore((s) => s.closeModal);
  const book = useStore((s) => s.books.find((b) => b.id === bookId));
  const [page, setPage] = useState(() => (book ? Math.min(book.pages, (book.currentPage || 0) + 10) : 0));
  const [min, setMin] = useState(minutes || '');
  if (!book) return null;
  const st = bookStats(book);
  const diff = Math.round(+page || 0) - (book.currentPage || 0);
  function save() {
    const reachedEnd = useStore.getState().logReading(book.id, page, +min || 0);
    useStore.getState().toast(diff > 0 ? trf('سجلنا {n} صفحة من "{title}"', { n: diff, title: book.title }) : tr('تم تحديث الصفحة'), { icon: 'check' });
    if (reachedEnd) useStore.getState().openModal('bookFinish', { bookId: book.id });
    else close();
  }
  return (
    <Modal
      title={tr('وصلت صفحة كم؟')}
      sub={book.title}
      onClose={close}
      footer={
        <>
          <button className="btn btn-ghost" onClick={close}>
            {tr('لاحقًا')}
          </button>
          <button className="btn btn-primary" onClick={save}>
            <Check /> {tr('حفظ')}
          </button>
        </>
      }
    >
      <div className="col" style={{ gap: 14 }}>
        <div className="row" style={{ gap: 14 }}>
          <BookCover book={book} size={52} />
          <div className="grow small muted">
            {trf('كنت في صفحة {p} من {n}', { p: book.currentPage || 0, n: book.pages })}
            <div className="tiny">{trf('هدف اليوم: {t} صفحة', { t: st.target })}</div>
          </div>
        </div>
        <label className="field">
          <span>{tr('الصفحة اللي وصلتها')}</span>
          <input className="input num big-num" type="number" inputMode="numeric" min="0" max={book.pages} value={page} onChange={(e) => setPage(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && save()} />
        </label>
        <div className="chips">
          {[5, 10, 20, 30].map((n) => (
            <button key={n} className="chip" onClick={() => setPage(Math.min(book.pages, (book.currentPage || 0) + n))}>
              +{n}
            </button>
          ))}
          <button className="chip" onClick={() => setPage(book.pages)}>
            {tr('خلصته')}
          </button>
        </div>
        <label className="field">
          <span>{tr('كم دقيقة قرأت؟ (اختياري)')}</span>
          <input className="input num" type="number" inputMode="numeric" min="0" value={min} onChange={(e) => setMin(e.target.value)} />
        </label>
        {diff > 0 && <div className="small green">{trf('+{n} صفحة اليوم', { n: diff })}</div>}
      </div>
    </Modal>
  );
}

// ————— إنهاء الكتاب: تقييم + رأيك —————
export function FinishBookModal({ bookId }) {
  const close = useStore((s) => s.closeModal);
  const book = useStore((s) => s.books.find((b) => b.id === bookId));
  const [rating, setRating] = useState(book?.rating || null);
  const [review, setReview] = useState(book?.review || '');
  if (!book) return null;
  const save = () => (useStore.getState().finishBook(book.id, { rating, review: review.trim() }), close());
  return (
    <Modal
      title={tr('مبروك! خلّصت الكتاب')}
      sub={book.title}
      onClose={save}
      footer={
        <button className="btn btn-primary" onClick={save}>
          <Check /> {tr('حفظ')} {book.status !== 'done' && <span className="badge green">+100 XP</span>}
        </button>
      }
    >
      <div className="col" style={{ gap: 14, alignItems: 'center', textAlign: 'center' }}>
        <BookCover book={book} size={90} />
        <div className="small muted">{tr('كم تقيّمه؟')}</div>
        <Stars value={rating} onChange={setRating} size={28} />
        <label className="field" style={{ width: '100%', textAlign: 'start' }}>
          <span>{tr('رأيك في الكتاب (اختياري)')}</span>
          <textarea className="input" rows={3} value={review} onChange={(e) => setReview(e.target.value)} placeholder={tr('وش أهم شي استفدته؟')} />
        </label>
      </div>
    </Modal>
  );
}

// ————— الفوائد والاقتباسات —————
function BookNotes({ book }) {
  const all = useStore((s) => s.bookNotes);
  const notes = useMemo(() => all.filter((n) => n.bookId === book.id).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)), [all, book.id]);
  const { addBookNote, deleteBookNote } = useStore.getState();
  const [kind, setKind] = useState('note');
  const [text, setText] = useState('');
  const [page, setPage] = useState(book.currentPage || '');
  const [image, setImage] = useState(null);
  async function onImage(file) {
    if (!file) return;
    try {
      setImage(await compressImage(file, 900, 0.7));
    } catch (e) {
      console.warn('[himmah:books]', e?.message || e);
      useStore.getState().toast(tr('تعذر قراءة الصورة'));
    }
  }
  function add() {
    if (!text.trim() && !image) return;
    addBookNote({ bookId: book.id, kind, text: text.trim(), page: page === '' ? null : +page, image });
    setText('');
    setImage(null);
  }
  return (
    <div className="col" style={{ gap: 14 }}>
      <div className="note-compose">
        <div className="chips">
          <button className={`chip ${kind === 'note' ? 'on' : ''}`} onClick={() => setKind('note')}>
            <StickyNote size={14} /> {tr('فائدة')}
          </button>
          <button className={`chip ${kind === 'quote' ? 'on' : ''}`} onClick={() => setKind('quote')}>
            <Quote size={14} /> {tr('اقتباس')}
          </button>
        </div>
        <textarea className="input mt-s" rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder={kind === 'quote' ? tr('اكتب الاقتباس كما هو…') : tr('وش الفكرة اللي استفدتها؟')} />
        {image && (
          <div className="note-img mt-s">
            <img src={image} alt="" />
            <button className="icon-btn sm" onClick={() => setImage(null)} aria-label={tr('حذف الصورة')}>
              <X />
            </button>
          </div>
        )}
        <div className="row wrap mt-s" style={{ gap: 8 }}>
          <input className="input num" style={{ maxWidth: 110 }} type="number" min="0" value={page ?? ''} onChange={(e) => setPage(e.target.value)} placeholder={tr('صفحة')} aria-label={tr('صفحة')} />
          <ImageButtons onPick={onImage} label={tr('صورة الصفحة')} />
          <span className="grow" />
          <button className="btn btn-sm btn-primary" onClick={add} disabled={!text.trim() && !image}>
            <Plus /> {tr('إضافة')}
          </button>
        </div>
      </div>
      {!notes.length ? (
        <p className="small muted">{tr('ما فيه فوائد بعد. اكتب أول فكرة استفدتها أو صوّر الصفحة.')}</p>
      ) : (
        <div className="col" style={{ gap: 10 }}>
          {notes.map((n) => (
            <div key={n.id} className={`note-item ${n.kind}`}>
              <div className="row between" style={{ gap: 8 }}>
                <span className="tiny muted">
                  {n.kind === 'quote' ? <Quote size={12} /> : <StickyNote size={12} />} {n.kind === 'quote' ? tr('اقتباس') : tr('فائدة')}
                  {n.page != null && <> · {trf('صفحة {p}', { p: n.page })}</>}
                </span>
                <button className="icon-btn sm plain" onClick={() => deleteBookNote(n.id)} aria-label={tr('حذف')}>
                  <Trash2 size={14} />
                </button>
              </div>
              {n.text && <div className="note-text">{n.kind === 'quote' ? `«${n.text}»` : n.text}</div>}
              {n.image && <img className="note-photo" src={n.image} alt="" />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ————— سجل القراءة —————
function BookLog({ book }) {
  const log = [...(book.log || [])].reverse();
  const st = bookStats(book);
  const totalMin = log.reduce((a, l) => a + (l.min || 0), 0);
  const days = new Set(log.map((l) => l.date)).size;
  return (
    <div className="col" style={{ gap: 12 }}>
      <div className="kpis">
        <div className="mini-stat">
          <div className="v num">{st.pct}%</div>
          <div className="l">{tr('التقدم')}</div>
        </div>
        <div className="mini-stat">
          <div className="v num">{days}</div>
          <div className="l">{tr('أيام قراءة')}</div>
        </div>
        <div className="mini-stat">
          <div className="v num">{st.pace || 0}</div>
          <div className="l">{tr('صفحة/يوم')}</div>
        </div>
        <div className="mini-stat">
          <div className="v num">{totalMin ? formatDuration(totalMin) : '—'}</div>
          <div className="l">{tr('وقت القراءة')}</div>
        </div>
      </div>
      {!log.length ? (
        <p className="small muted">{tr('ما سجّلت قراءة لهالكتاب بعد.')}</p>
      ) : (
        <div className="col" style={{ gap: 6 }}>
          {log.slice(0, 60).map((l, i) => (
            <div key={i} className="log-row">
              <span className="small">{formatLong(l.date)}</span>
              <span className="grow" />
              <span className="small">
                {trf('ص {a} ← {b}', { a: l.from, b: l.to })} <b className="green">+{Math.max(0, l.to - l.from)}</b>
              </span>
              {l.min > 0 && (
                <span className="tiny muted">
                  <Timer size={12} /> {l.min}
                  {isEn() ? 'm' : 'د'}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
