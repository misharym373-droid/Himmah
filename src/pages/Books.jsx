// مكتبتي: الكتب وتقدمها + الهدف اليومي/الموعد + القراءة بالتركيز + تحدي السنة
import { useMemo, useState } from 'react';
import { Library, Plus, Flame, BookOpen, Timer, Trophy, Pencil, Play, PenLine, TriangleAlert, Check } from 'lucide-react';
import { useStore } from '../store.js';
import { Empty, Ring, Bar } from '../components/ui.jsx';
import { BookModal, BookCover, Stars } from '../components/BookModals.jsx';
import { bookStats, readingStreak, weekStats, doneInYear, readingGoal } from '../lib/books.js';
import { todayKey, formatShort, formatDuration } from '../lib/date.js';
import { tr, trf } from '../i18n/index.js';

const TABS = [
  ['reading', 'أقرأه الحين'],
  ['want', 'أبغى أقرأه'],
  ['done', 'خلصته'],
];

export default function Books() {
  const books = useStore((s) => s.books);
  const settings = useStore((s) => s.settings);
  const [tab, setTab] = useState(() => (books.some((b) => b.status === 'reading') || !books.length ? 'reading' : 'want'));
  const [edit, setEdit] = useState(null); // null | 'new' | book
  const [goalEdit, setGoalEdit] = useState(false);
  const T = todayKey();
  const year = T.slice(0, 4);
  const streak = readingStreak(books, T);
  const week = weekStats(books, T);
  const goal = readingGoal(settings).goal;
  const done = doneInYear(books, year);
  const list = useMemo(() => {
    const l = books.filter((b) => b.status === tab);
    if (tab === 'done') return l.sort((a, b) => ((b.finishedAt || '') < (a.finishedAt || '') ? -1 : 1));
    return l.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  }, [books, tab]);
  const setGoal = (v) => useStore.getState().setSetting('reading', { ...readingGoal(settings), goal: Math.max(1, Math.min(365, Math.round(+v) || 12)) });

  return (
    <>
      <div className="page-head">
        <div>
          <h1>
            <span className="ico">
              <Library />
            </span>
            {tr('مكتبتي')}
          </h1>
          <p>{tr('كتبك، تقدمك فيها، وفوائدك منها')}</p>
        </div>
        <button className="btn btn-primary" onClick={() => setEdit('new')}>
          <Plus /> {tr('كتاب جديد')}
        </button>
      </div>

      <div className="dash" style={{ marginTop: 0 }}>
        <div className="card span-8">
          <div className="kpis" style={{ gridTemplateColumns: 'repeat(3, minmax(0,1fr))' }}>
            <div className="mini-stat">
              <div className="v num">
                <Flame size={18} className="gold" style={{ verticalAlign: -2 }} /> {streak}
              </div>
              <div className="l">{tr('أيام قراءة متتالية')}</div>
            </div>
            <div className="mini-stat">
              <div className="v num">{week.pages}</div>
              <div className="l">{tr('صفحة هالأسبوع')}</div>
            </div>
            <div className="mini-stat">
              <div className="v num">{week.minutes ? formatDuration(week.minutes) : '—'}</div>
              <div className="l">{tr('وقت القراءة هالأسبوع')}</div>
            </div>
          </div>
        </div>
        <div className="card span-4 row" style={{ gap: 14 }}>
          <Ring value={Math.min(100, (done / goal) * 100)} size={74} stroke={7} id="yr">
            <span className="small xbold num">
              {done}/{goal}
            </span>
          </Ring>
          <div className="grow" style={{ minWidth: 0 }}>
            <div className="bold row" style={{ gap: 6 }}>
              <Trophy size={16} className="gold" /> {trf('تحدي {year}', { year })}
            </div>
            {goalEdit ? (
              <div className="row mt-s" style={{ gap: 6 }}>
                <input className="input num" style={{ maxWidth: 80 }} type="number" min="1" defaultValue={goal} onKeyDown={(e) => e.key === 'Enter' && (setGoal(e.target.value), setGoalEdit(false))} onBlur={(e) => (setGoal(e.target.value), setGoalEdit(false))} autoFocus aria-label={tr('عدد الكتب')} />
                <span className="small muted">{tr('كتاب')}</span>
              </div>
            ) : (
              <button className="small muted row" style={{ gap: 4 }} onClick={() => setGoalEdit(true)}>
                {trf('هدفك: {n} كتاب هالسنة', { n: goal })} <Pencil size={12} />
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="tabs mt mb" role="tablist">
        {TABS.map(([k, l]) => {
          const n = books.filter((b) => b.status === k).length;
          return (
            <button key={k} role="tab" aria-selected={tab === k} className={`tab ${tab === k ? 'on' : ''}`} onClick={() => setTab(k)}>
              {tr(l)}
              {n > 0 && <span className="count num">{n}</span>}
            </button>
          );
        })}
      </div>

      {!list.length ? (
        <div className="card">
          <Empty
            icon={<BookOpen />}
            title={tab === 'done' ? tr('ما خلصت كتاب بعد') : tab === 'want' ? tr('قائمة الكتب اللي تبغى تقرأها فاضية') : tr('ابدأ أول كتاب')}
            text={tab === 'done' ? tr('الكتب اللي تخلصها تظهر هنا مع تقييمك.') : tr('أضف الكتاب وعدد صفحاته، ومسار يحسب لك كم تقرأ كل يوم.')}
            action={
              tab !== 'done' && (
                <button className="btn btn-primary" onClick={() => setEdit('new')}>
                  <Plus /> {tr('كتاب جديد')}
                </button>
              )
            }
          />
        </div>
      ) : (
        <div className="book-grid">
          {list.map((b) => (
            <BookCard key={b.id} book={b} onOpen={() => setEdit(b)} />
          ))}
        </div>
      )}
      {edit && <BookModal key={edit === 'new' ? 'new' : edit.id} book={edit === 'new' ? null : useStore.getState().books.find((b) => b.id === edit.id) || edit} onClose={() => setEdit(null)} />}
    </>
  );
}

function BookCard({ book, onOpen }) {
  const { openModal, updateBook } = useStore.getState();
  const notesN = useStore((s) => s.bookNotes.filter((n) => n.bookId === book.id).length);
  const st = bookStats(book);
  const reading = book.status === 'reading';
  return (
    <div className="card book-card" onClick={onOpen} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && e.target === e.currentTarget && onOpen()}>
      <div className="row" style={{ gap: 14, alignItems: 'flex-start' }}>
        <BookCover book={book} size={68} />
        <div className="grow" style={{ minWidth: 0 }}>
          <div className="bold ellipsis">{book.title}</div>
          {book.author && <div className="tiny muted ellipsis">{book.author}</div>}
          {book.status === 'done' ? (
            <div className="mt-s">
              <Stars value={book.rating} size={15} />
              <div className="tiny muted mt-s">
                {book.finishedAt && trf('خلصته {date}', { date: formatShort(book.finishedAt) })} · {trf('{n} صفحة', { n: book.pages })}
              </div>
              {book.review && <div className="small mt-s clamp-2">{book.review}</div>}
            </div>
          ) : (
            <>
              <Bar value={st.pct} variant={st.pct >= 100 ? 'green' : ''} className="thin mt-s" />
              <div className="tiny muted mt-s">
                {trf('صفحة {p} من {n}', { p: st.current, n: st.pages })} · <span className="num">{st.pct}%</span>
              </div>
              {reading && (
                <div className={`tiny mt-s ${st.late || st.overdue ? 'red' : st.todayLeft === 0 ? 'green' : ''}`}>
                  {st.overdue ? (
                    <>
                      <TriangleAlert size={12} /> {trf('فات الموعد ({date}) — باقي {n} صفحة', { date: formatShort(book.targetDate), n: st.remaining })}
                    </>
                  ) : st.todayLeft === 0 && st.readToday > 0 ? (
                    <>
                      <Check size={12} /> {trf('خلصت هدف اليوم ({n} صفحة)', { n: st.readToday })}
                    </>
                  ) : book.targetDate ? (
                    trf('اليوم: {r}/{t} صفحة — عشان تخلصه قبل {date}', { r: st.readToday, t: st.target, date: formatShort(book.targetDate) })
                  ) : (
                    trf('اليوم: {r}/{t} صفحة', { r: st.readToday, t: st.target })
                  )}
                </div>
              )}
              {reading && st.eta && <div className="tiny muted">{trf('بسرعتك ({p} ص/يوم) تخلصه تقريبًا {date}', { p: st.pace, date: formatShort(st.eta) })}</div>}
            </>
          )}
          {notesN > 0 && (
            <div className="tiny muted mt-s">
              <PenLine size={12} /> {trf('{n} فائدة واقتباس', { n: notesN })}
            </div>
          )}
        </div>
      </div>
      {book.status !== 'done' && (
        <div className="row wrap mt" style={{ gap: 8 }} onClick={(e) => e.stopPropagation()}>
          {reading ? (
            <>
              <button className="btn btn-sm btn-primary" onClick={() => openModal('bookLog', { bookId: book.id })}>
                <BookOpen size={15} /> {tr('سجّل قراءة')}
              </button>
              <button className="btn btn-sm" onClick={() => openModal('focusStart', { bookId: book.id })}>
                <Timer size={15} /> {tr('اقرأ بالتركيز')}
              </button>
            </>
          ) : (
            <button className="btn btn-sm btn-primary" onClick={() => updateBook(book.id, { status: 'reading', startedAt: book.startedAt || todayKey() })}>
              <Play size={15} /> {tr('ابدأ القراءة')}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
