import { useMemo, useState } from 'react';
import { ListChecks, Plus, Search, Trash2, RotateCcw, CheckCheck, CalendarClock, X, Repeat, SquareCheck, ImagePlus } from 'lucide-react';
import { useStore } from '../store.js';
import { useRoute } from '../router.js';
import TaskItem from '../components/TaskItem.jsx';
import { Empty, useConfirm } from '../components/ui.jsx';
import { AREAS, PRIORITIES } from '../config.js';
import { todayKey, addDays, toMin, relativeDay, timeAgo, DAYS_SHORT } from '../lib/date.js';
import { isOverdue } from '../lib/game.js';
import { Glyph } from '../components/Glyph.jsx';

const TABS = [
  ['today', 'اليوم'],
  ['upcoming', 'القادمة'],
  ['overdue', 'المتأخرة'],
  ['done', 'المكتملة'],
  ['postponed', 'المؤجلة'],
  ['all', 'الكل'],
  ['recurring', 'المتكررة'],
  ['trash', 'المحذوفات'],
];

export default function Tasks() {
  const { params } = useRoute();
  const tasks = useStore((s) => s.tasks);
  const open = useStore((s) => s.openModal);
  const st = useStore.getState;
  const confirm = useConfirm();
  const [tab, setTab] = useState(params.tab || 'today');
  const [q, setQ] = useState('');
  const [area, setArea] = useState('');
  const [prio, setPrio] = useState('');
  const [sort, setSort] = useState('time');
  const [selecting, setSelecting] = useState(false);
  const [sel, setSel] = useState([]);
  const T = todayKey();

  const base = useMemo(() => {
    const live = tasks.filter((t) => !t.deletedAt && !t.template);
    return {
      today: live.filter((t) => t.date === T),
      upcoming: live.filter((t) => t.date > T && !t.done),
      overdue: live.filter((t) => isOverdue(t)),
      done: live.filter((t) => t.done),
      postponed: live.filter((t) => t.postponed > 0 && !t.done),
      all: live,
      recurring: tasks.filter((t) => t.template && !t.deletedAt),
      trash: tasks.filter((t) => t.deletedAt),
    };
  }, [tasks, T]);

  const list = useMemo(() => {
    let l = base[tab] || [];
    if (q.trim()) l = l.filter((t) => (t.title + ' ' + (t.desc || '') + ' ' + (t.notes || '')).includes(q.trim()));
    if (area) l = l.filter((t) => t.area === area);
    if (prio) l = l.filter((t) => t.priority === prio);
    const by = {
      time: (a, b) => (a.date === b.date ? (toMin(a.time) ?? 9999) - (toMin(b.time) ?? 9999) : a.date < b.date ? -1 : 1),
      priority: (a, b) => (PRIORITIES[b.priority]?.weight || 0) - (PRIORITIES[a.priority]?.weight || 0),
      duration: (a, b) => b.duration - a.duration,
      created: (a, b) => b.createdAt - a.createdAt,
    };
    l = [...l].sort(by[sort]);
    if (tab === 'done' || tab === 'all') l.reverse();
    if (tab === 'trash') l.sort((a, b) => b.deletedAt - a.deletedAt);
    return l.slice(0, 300);
  }, [base, tab, q, area, prio, sort]);

  const toggleSel = (id) => setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const groups = useMemo(() => {
    if (!['upcoming', 'all', 'done', 'postponed', 'overdue'].includes(tab) || sort !== 'time') return [['', list]];
    const g = {};
    for (const t of list) (g[t.date] = g[t.date] || []).push(t);
    return Object.entries(g);
  }, [list, tab, sort]);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>
            <span className="ico">
              <ListChecks />
            </span>
            مهامي
          </h1>
          <p>
            <span className="num">{base.today.filter((t) => t.done).length}</span> من <span className="num">{base.today.length}</span> مهام اليوم مكتملة
          </p>
        </div>
        <div className="row">
          <button className={`btn ${selecting ? 'btn-primary' : ''}`} onClick={() => (setSelecting(!selecting), setSel([]))}>
            <SquareCheck /> {selecting ? 'إلغاء التحديد' : 'تحديد'}
          </button>
          <button className="btn" onClick={() => open('image')}>
            <ImagePlus /> من صورة
          </button>
          <button className="btn btn-primary" onClick={() => open('task')}>
            <Plus /> مهمة جديدة
          </button>
        </div>
      </div>

      <div className="tabs mb" role="tablist">
        {TABS.map(([k, l]) => (
          <button key={k} role="tab" aria-selected={tab === k} className={`tab ${tab === k ? 'on' : ''}`} onClick={() => (setTab(k), setSel([]))}>
            {l}
            {base[k]?.length > 0 && k !== 'all' && k !== 'done' && <span className="count num">{base[k].length}</span>}
          </button>
        ))}
      </div>

      <div className="card tight mb">
        <div className="row wrap" style={{ gap: 10 }}>
          <div className="input-icon grow" style={{ minWidth: 200 }}>
            <Search />
            <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="ابحث في المهام…" aria-label="بحث" />
          </div>
          <select className="select" style={{ width: 'auto', minWidth: 140 }} value={area} onChange={(e) => setArea(e.target.value)} aria-label="المجال">
            <option value="">كل المجالات</option>
            {Object.entries(AREAS).map(([k, a]) => (
              <option key={k} value={k}>
                {a.label}
              </option>
            ))}
          </select>
          <select className="select" style={{ width: 'auto', minWidth: 140 }} value={prio} onChange={(e) => setPrio(e.target.value)} aria-label="الأولوية">
            <option value="">كل الأولويات</option>
            {Object.entries(PRIORITIES).map(([k, p]) => (
              <option key={k} value={k}>
                {p.label}
              </option>
            ))}
          </select>
          <select className="select" style={{ width: 'auto', minWidth: 140 }} value={sort} onChange={(e) => setSort(e.target.value)} aria-label="الترتيب">
            <option value="time">ترتيب: الوقت</option>
            <option value="priority">ترتيب: الأولوية</option>
            <option value="duration">ترتيب: المدة</option>
            <option value="created">ترتيب: الأحدث</option>
          </select>
        </div>
      </div>

      {selecting && (
        <div className="card tight mb glow" style={{ position: 'sticky', top: 'calc(var(--header) + 8px)', zIndex: 5 }}>
          <div className="row wrap between">
            <div className="row">
              <button className="btn btn-sm btn-ghost" onClick={() => setSel(sel.length === list.length ? [] : list.map((t) => t.id))}>
                {sel.length === list.length ? 'إلغاء الكل' : 'تحديد الكل'}
              </button>
              <span className="small muted">
                محدد: <span className="num bold">{sel.length}</span>
              </span>
            </div>
            <div className="row wrap">
              {tab === 'trash' ? (
                <>
                  <button className="btn btn-sm" disabled={!sel.length} onClick={() => (sel.forEach(st().restoreTask), setSel([]))}>
                    <RotateCcw /> استرجاع
                  </button>
                  <button
                    className="btn btn-sm btn-danger"
                    disabled={!sel.length}
                    onClick={() => confirm({ title: 'حذف نهائي', body: `سيتم حذف ${sel.length} مهام نهائيًا ولا يمكن استرجاعها.`, danger: true, confirmLabel: 'حذف نهائي', onConfirm: () => (sel.forEach(st().purgeTask), setSel([])) })}
                  >
                    <Trash2 /> حذف نهائي
                  </button>
                </>
              ) : (
                <>
                  <button className="btn btn-sm" disabled={!sel.length} onClick={() => (sel.forEach((id) => st().completeTask(id, { silent: true })), st().toast(`تم إكمال ${sel.length} مهام`), setSel([]))}>
                    <CheckCheck /> إكمال
                  </button>
                  <button className="btn btn-sm" disabled={!sel.length} onClick={() => (sel.forEach((id) => st().moveTaskToDate(id, addDays(T, 1))), st().toast(`تم نقل ${sel.length} مهام إلى الغد`), setSel([]))}>
                    <CalendarClock /> نقل للغد
                  </button>
                  <button className="btn btn-sm btn-danger" disabled={!sel.length} onClick={() => (st().deleteTasks(sel), setSel([]))}>
                    <Trash2 /> حذف
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {tab === 'trash' && base.trash.length > 0 && !selecting && (
        <div className="row between mb wrap">
          <p className="small muted">المهام المحذوفة تبقى هنا حتى تحذفها نهائيًا.</p>
          <button className="btn btn-sm btn-danger" onClick={() => confirm({ title: 'إفراغ المحذوفات', body: 'سيتم حذف كل المهام في سلة المحذوفات نهائيًا.', danger: true, confirmLabel: 'إفراغ', onConfirm: () => st().emptyTrash() })}>
            <Trash2 /> إفراغ المحذوفات
          </button>
        </div>
      )}

      {!list.length ? (
        <div className="card">
          {tab === 'trash' ? (
            <Empty icon={<Trash2 />} title="سلة المحذوفات فارغة" text="المهام المحذوفة تظهر هنا ويمكنك استرجاعها." />
          ) : tab === 'overdue' ? (
            <Empty icon={<CheckCheck />} title="لا توجد مهام متأخرة" text="أنت ماشي على الخطة." />
          ) : tab === 'recurring' ? (
            <Empty icon={<Repeat />} title="لا توجد مهام متكررة" text="مثل: النادي كل الأحد والثلاثاء والخميس" action={<button className="btn btn-primary" onClick={() => open('task', { preset: { repeat: { type: 'days', days: [0, 2, 4] } } })}><Plus /> مهمة متكررة</button>} />
          ) : q || area || prio ? (
            <Empty icon={<Search />} title="لا توجد نتائج" text="جرّب تغيير البحث أو الفلاتر." action={<button className="btn btn-sm" onClick={() => (setQ(''), setArea(''), setPrio(''))}><X /> مسح الفلاتر</button>} />
          ) : (
            <Empty icon={<ListChecks />} title="يومك جاهز لك." text="أضف أول مهمة وابدأ." action={<button className="btn btn-primary" onClick={() => open('task')}><Plus /> إضافة مهمة</button>} />
          )}
        </div>
      ) : (
        <div className="col" style={{ gap: 18 }}>
          {groups.map(([date, items]) => (
            <div key={date || 'all'} className="col" style={{ gap: 8 }}>
              {date && (
                <div className="small bold muted">
                  {relativeDay(date)} <span className="dim num">· {date}</span>
                </div>
              )}
              {items.map((t, i) =>
                tab === 'trash' ? (
                  <TrashRow key={t.id} t={t} selecting={selecting} selected={sel.includes(t.id)} onSelect={toggleSel} />
                ) : tab === 'recurring' ? (
                  <RecurringRow key={t.id} t={t} />
                ) : (
                  <div key={t.id} className="reveal" style={{ animationDelay: `${Math.min(i, 10) * 0.03}s` }}>
                    <TaskItem task={t} showDate={tab !== 'today'} selectable={selecting} selected={sel.includes(t.id)} onSelect={toggleSel} />
                  </div>
                )
              )}
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function TrashRow({ t, selecting, selected, onSelect }) {
  const confirm = useConfirm();
  const { restoreTask, purgeTask } = useStore.getState();
  return (
    <div className="task" style={{ cursor: 'default' }}>
      {selecting && <input type="checkbox" checked={selected} onChange={() => onSelect(t.id)} aria-label="تحديد" style={{ width: 18, height: 18, accentColor: 'var(--primary)' }} />}
      <span className="t-icon"><Glyph name={t.icon} size={18} /></span>
      <div className="grow">
        <div className="t-title ellipsis">{t.title}</div>
        <div className="t-meta">حُذفت {timeAgo(t.deletedAt)}</div>
      </div>
      <button className="btn btn-sm" onClick={() => restoreTask(t.id)}>
        <RotateCcw /> استرجاع
      </button>
      <button
        className="icon-btn sm"
        aria-label="حذف نهائي"
        onClick={() => confirm({ title: 'حذف نهائي', body: `هل تريد حذف "${t.title}" نهائيًا؟ لا يمكن التراجع.`, danger: true, confirmLabel: 'حذف نهائي', onConfirm: () => purgeTask(t.id) })}
      >
        <Trash2 />
      </button>
    </div>
  );
}

function RecurringRow({ t }) {
  const open = useStore((s) => s.openModal);
  const confirm = useConfirm();
  const r = t.repeat;
  const label = r.type === 'daily' ? 'يوميًا' : r.type === 'weekly' ? 'أسبوعيًا' : r.type === 'monthly' ? 'شهريًا' : `كل ${r.days.map((d) => DAYS_SHORT[d]).join('، ')}`;
  return (
    <div className="task" onClick={() => open('task', { task: t })} role="button" tabIndex={0}>
      <span className="t-icon"><Glyph name={t.icon} size={18} /></span>
      <div className="grow">
        <div className="t-title">{t.title}</div>
        <div className="t-meta">
          <Repeat size={12} /> {label} {t.time && <span className="num">· {t.time}</span>} · {t.duration} دقيقة
        </div>
      </div>
      <button
        className="icon-btn sm"
        aria-label="حذف التكرار"
        onClick={(e) => {
          e.stopPropagation();
          confirm({
            title: 'إيقاف المهمة المتكررة',
            body: `سيتم إيقاف تكرار "${t.title}" وحذف نسخها القادمة غير المكتملة.`,
            danger: true,
            confirmLabel: 'إيقاف وحذف',
            onConfirm: () => {
              const s = useStore.getState();
              const T = todayKey();
              useStore.setState({ tasks: s.tasks.filter((x) => x.id !== t.id && !(x.seriesId === t.id && !x.done && x.date >= T)) });
              s.toast('تم إيقاف التكرار');
            },
          });
        }}
      >
        <Trash2 />
      </button>
    </div>
  );
}
