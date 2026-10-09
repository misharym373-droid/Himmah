import { useMemo, useState } from 'react';
import { ChartColumn, CheckCheck, Timer, Sun, CalendarDays, CalendarClock, Target, TrendingUp, TrendingDown } from 'lucide-react';
import { useStore } from '../store.js';
import { Ring, Num, CardTitle } from '../components/ui.jsx';
import { Bars } from '../components/Charts.jsx';
import { BalanceWidget, TimeMachineWidget } from '../components/Widgets.jsx';
import { summary, weekBars } from '../lib/stats.js';
import { formatHM, dayShort, formatDuration } from '../lib/date.js';
import { tr, trf } from '../i18n/index.js';

// كل بطاقة تجيب عن سؤال واحد واضح
function QA({ icon: I, color = '', q, a, note, children, span = 'span-4' }) {
  return (
    <div className={`card qa-card ${span} reveal`}>
      <div className="qa-q">
        <span className={`card-title`}>
          <span className={`ico ${color}`} style={{ width: 30, height: 30, borderRadius: 10 }}>
            <I size={15} />
          </span>
        </span>
        {q}
      </div>
      <div className="qa-a">{a}</div>
      {note && <div className="qa-note">{note}</div>}
      {children}
    </div>
  );
}

export default function Stats() {
  const tasks = useStore((s) => s.tasks);
  const focusLog = useStore((s) => s.focusLog);
  const [range, setRange] = useState(7);
  const s = useMemo(() => summary(tasks, focusLog, range), [tasks, focusLog, range]);
  const prev = useMemo(() => (range === 7 ? summary(tasks, focusLog, 14) : null), [tasks, focusLog, range]);
  const lastWeekDone = prev ? prev.done - s.done : null;
  const days = range === Infinity ? 30 : range;
  const bars = useMemo(() => weekBars(tasks, days).map((b, i, a) => ({ ...b, label: days === 7 ? tr(b.label) : i % 5 === 0 || i === a.length - 1 ? b.date.slice(8) : '' })), [tasks, days]);
  const hours = useMemo(() => s.hours.map((v, h) => ({ label: h % 3 === 0 ? String(h).padStart(2, '0') : '', done: v })).slice(5, 24), [s.hours]);
  const weekdays = useMemo(() => s.byDay.map((v, i) => ({ label: dayShort(i), done: v })), [s.byDay]);
  const period = range === 7 ? tr('هذا الأسبوع') : range === 30 ? tr('هذا الشهر') : tr('منذ البداية');
  const diff = lastWeekDone != null ? s.done - lastWeekDone : null;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>
            <span className="ico">
              <ChartColumn />
            </span>
            {tr('إحصائياتي')}
          </h1>
          <p>{tr('أرقامك الحقيقية — بدون أحكام، فقط وضوح')}</p>
        </div>
        <div className="tabs" role="tablist" aria-label={tr('الفترة')}>
          {[
            [7, 'الأسبوع'],
            [30, 'الشهر'],
            [Infinity, 'الكل'],
          ].map(([k, l]) => (
            <button key={l} role="tab" aria-selected={range === k} className={`tab ${range === k ? 'on' : ''}`} onClick={() => setRange(k)}>
              {tr(l)}
            </button>
          ))}
        </div>
      </div>

      <div className="dash" style={{ marginTop: 0 }}>
        <QA
          icon={CheckCheck}
          color="green"
          q={trf('كم أنجزت {period}؟', { period })}
          a={
            <>
              <Num value={s.done} /> <span className="small muted">{tr('مهمة')}</span>
            </>
          }
          note={
            diff != null && lastWeekDone > 0 ? (
              <span className={diff >= 0 ? 'green' : 'red'}>
                {diff >= 0 ? <TrendingUp size={14} style={{ verticalAlign: -2 }} /> : <TrendingDown size={14} style={{ verticalAlign: -2 }} />} {diff >= 0 ? trf('{n} أكثر من الأسبوع الماضي', { n: Math.abs(diff) }) : trf('{n} أقل من الأسبوع الماضي', { n: Math.abs(diff) })}
              </span>
            ) : (
              trf('من أصل {n} مهمة مخططة', { n: s.total })
            )
          }
        />
        <QA icon={Target} q={tr('كم نسبة التزامي؟')} a={<span className="num">{s.rate}%</span>} note={trf('أنجزت {done} من {total} مهمة {period}', { done: s.done, total: s.total, period })}>
          <div className="bar mt-s">
            <i style={{ width: `${s.rate}%` }} />
          </div>
        </QA>
        <QA icon={Timer} color="green" q={tr('كم دقيقة تركيز أنجزت؟')} a={<span className="num">{Math.round(s.focus)}</span>} note={trf('{hm} ساعة · اليوم {today} دقيقة', { hm: formatHM(s.focus), today: s.focusToday })} />
        <QA icon={Sun} color="gold" q={tr('متى أكون أكثر إنتاجية؟')} a={<span className="num" style={{ fontSize: '1.5rem' }}>{s.bestWindow}</span>} note={tr('الفترة التي تنجز فيها أكثر مهامك')} span="span-6">
          <div className="mt">
            <Bars data={hours} height={120} />
          </div>
        </QA>
        <QA icon={CalendarDays} color="blue" q={tr('ما أكثر الأيام إنتاجية؟')} a={tr(s.topDay)} note={tr('إجمالي المهام المكتملة لكل يوم')} span="span-6">
          <div className="mt">
            <Bars data={weekdays} height={120} />
          </div>
        </QA>
        <QA
          icon={CalendarClock}
          color="red"
          q={tr('كم مهمة أؤجل عادة؟')}
          a={
            <>
              <Num value={s.postponedTasks} /> <span className="small muted">{trf('مهمة ({rate}%)', { rate: s.postponeRate })}</span>
            </>
          }
          note={s.mostPostponedCount ? trf('أكثر مجال يتأجل: {area}', { area: tr(s.mostPostponed) }) : tr('ما فيه تأجيل يذكر — ممتاز')}
        />
        <QA icon={ChartColumn} color="blue" q={tr('متوسط مدة المهمة')} a={formatDuration(s.avgDur)} note={tr('للمهام المكتملة')} />
        <div className="card span-4 reveal" style={{ display: 'grid', placeItems: 'center' }}>
          <Ring value={s.rate} size={130} stroke={11} id="statsRing">
            <div>
              <div className="xbold num" style={{ fontSize: '1.8rem', lineHeight: 1 }}>{s.rate}%</div>
              <div className="tiny muted mt-s">{trf('إنجاز {period}', { period })}</div>
            </div>
          </Ring>
        </div>
        <div className="card span-12 reveal">
          <CardTitle icon={<ChartColumn size={18} />} color="blue" sub={tr('عدد المهام المكتملة كل يوم')}>
            {tr('إنجازك يومًا بيوم')}
          </CardTitle>
          <div className="mt">
            <Bars data={bars} height={180} />
          </div>
        </div>
        <BalanceWidget span="span-6" />
        <TimeMachineWidget span="span-6" />
      </div>
    </>
  );
}
