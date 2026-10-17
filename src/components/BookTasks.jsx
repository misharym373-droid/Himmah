// قراءة اليوم كمهام: لكل كتاب "أقرأه الحين" مهمة بعدد صفحات اليوم (من الهدف اليومي أو الموعد)
import { useState } from 'react';
import { ChevronDown, Timer, BookOpen } from 'lucide-react';
import { useStore } from '../store.js';
import { navigate } from '../router.js';
import { BookCover } from './BookModals.jsx';
import { bookStats } from '../lib/books.js';
import { todayKey } from '../lib/date.js';
import { tr, trf } from '../i18n/index.js';

const KEY = 'himmah:bookTasksOpen';
function readOpen() {
  try {
    return localStorage.getItem(KEY) !== '0';
  } catch (e) {
    console.warn('[himmah:books]', e?.message || e);
    return true;
  }
}

export default function BookTasks({ className = '' }) {
  const books = useStore((s) => s.books);
  const openModal = useStore((s) => s.openModal);
  const [open, setOpen] = useState(readOpen);
  const T = todayKey();
  const list = books.filter((b) => b.status === 'reading').map((b) => ({ b, st: bookStats(b, T) }));
  if (!list.length) return null;
  const doneN = list.filter(({ st }) => st.todayLeft === 0).length;
  const toggle = () =>
    setOpen((o) => {
      try {
        localStorage.setItem(KEY, o ? '0' : '1');
      } catch (e) {
        console.warn('[himmah:books]', e?.message || e);
      }
      return !o;
    });
  list.sort((x, y) => (x.st.todayLeft === 0) - (y.st.todayLeft === 0));
  return (
    <div className={`habit-tasks ${className}`}>
      <button className="habit-tasks-hd" onClick={toggle} aria-expanded={open}>
        <span className="bold small">{tr('قراءة اليوم')}</span>
        <span className={`count num ${doneN === list.length ? 'all' : ''}`}>
          {doneN}/{list.length}
        </span>
        <span className="grow" />
        <ChevronDown size={16} style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }} aria-hidden />
      </button>
      {open && (
        <div className="col" style={{ gap: 8 }}>
          {list.map(({ b, st }) => {
            const done = st.todayLeft === 0;
            return (
              <div key={b.id} className={`task habit-task ${done ? 'done' : ''}`} onClick={() => navigate('books')} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && e.target === e.currentTarget && navigate('books')}>
                <span className={`habit-count num ${done ? 'on' : ''}`} aria-hidden>
                  {st.readToday}/{st.target}
                </span>
                <BookCover book={b} size={22} />
                <div className="grow" style={{ minWidth: 0 }}>
                  <div className="t-title ellipsis">{trf('اقرأ {n} صفحة من «{title}»', { n: st.target, title: b.title })}</div>
                  <div className="t-meta">
                    <span className="habit-badge">
                      <BookOpen size={11} aria-hidden /> {tr('قراءة')}
                    </span>
                    <span className="meta-item">{trf('صفحة {p} من {n}', { p: st.current, n: st.pages })}</span>
                  </div>
                </div>
                <div className="row" style={{ gap: 4 }} onClick={(e) => e.stopPropagation()}>
                  <button className="icon-btn sm" onClick={() => openModal('focusStart', { bookId: b.id })} aria-label={trf('اقرأ «{title}» بالتركيز', { title: b.title })}>
                    <Timer />
                  </button>
                  <button className="btn btn-xs btn-primary" onClick={() => openModal('bookLog', { bookId: b.id })}>
                    {tr('سجّل')}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
