import { useState } from 'react';
import { ChartColumn, Clock, CheckCheck, ListChecks, Timer, Sun, CalendarDays, Hourglass } from 'lucide-react';
import { useStore } from '../store.js';
import { Ring, Num, CardTitle } from '../components/ui.jsx';
import { Bars } from '../components/Charts.jsx';
import { BalanceWidget, TimeMachineWidget } from '../components/Widgets.jsx';
import { summary, weekBars } from '../lib/stats.js';
import { formatHM, DAYS_SHORT, formatDuration } from '../lib/date.js';

export default function Stats() {
  const tasks = useStore((s) => s.tasks);
  const focusLog = useStore((s) => s.focusLog);
  const [range, setRange] = useState(7);
  const s = summary(tasks, focusLog, range);
  const bars = weekBars(tasks, range === Infinity ? 30 : range).map((b, i, a) => ({ ...b, label: range === 7 ? b.label : i % 5 === 0 || i === a.length - 1 ? b.date.slice(8) : '' }));
  const hours = s.hours.map((v, h) => ({ label: h % 3 === 0 ? String(h).padStart(2, '0') : '', done: v })).slice(5, 24);
  const weekdays = s.byDay.map((v, i) => ({ label: DAYS_SHORT[i], done: v }));
  const cards = [
    [CheckCheck, 'green', 'مهام مكتملة', <Num value={s.done} />],
    [ListChecks, '', 'عدد المهام', <Num value={s.total} />],
    [Timer, 'blue', 'ساعات التركيز', <span className="num">{formatHM(s.focus)}</span>],
    [Clock, 'gold', 'متوسط مدة المهمة', <span>{formatDuration(s.avgDur)}</span>],
    [Sun, 'gold', 'أفضل وقت للإنجاز', <span className="num" style={{ fontSize: '1.2rem' }}>{s.bestWindow}</span>],
    [CalendarDays, 'green', 'أكثر يوم إنتاجية', <span>{s.topDay}</span>],
    [Hourglass, 'red', 'أكثر مجال يتم تأجيله', <span>{s.mostPostponed}</span>],
  ];
  return (
    <>
      <div className="page-head">
        <div>
          <h1>
            <span className="ico">
              <ChartColumn />
            </span>
            إحصائياتي
          </h1>
          <p>أرقامك الحقيقية — بدون أحكام، فقط وضوح</p>
        </div>
        <div className="tabs">
          {[
            [7, 'الأسبوع'],
            [30, 'الشهر'],
            [Infinity, 'الكل'],
          ].map(([k, l]) => (
            <button key={l} className={`tab ${range === k ? 'on' : ''}`} onClick={() => setRange(k)}>
              {l}
            </button>
          ))}
        </div>
      </div>
      <div className="dash" style={{ marginTop: 0 }}>
        <div className="card span-4 r-6 reveal" style={{ display: 'grid', placeItems: 'center', gap: 10 }}>
          <Ring value={s.rate} size={190} stroke={16} id="statsRing">
            <div>
              <div className="xbold" style={{ fontSize: '2.8rem', lineHeight: 1 }}>
                <Num value={s.rate} format={(n) => Math.round(n) + '%'} />
              </div>
              <div className="small muted mt-s">نسبة الإنجاز</div>
            </div>
          </Ring>
          <div className="row small muted" style={{ gap: 16 }}>
            <span>
              <span className="green bold num">{s.done}</span> مكتملة
            </span>
            <span>
              <span className="bold num">{s.pending}</span> متبقية
            </span>
          </div>
        </div>
        <div className="span-8 r-6 grid" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(170px,1fr))', gap: 14 }}>
          {cards.map(([I, c, l, v], i) => (
            <div key={l} className="card tight reveal" style={{ animationDelay: `${i * 0.05}s` }}>
              <span className={`card-title`}>
                <span className={`ico ${c}`}>
                  <I size={17} />
                </span>
              </span>
              <div className="xbold mt-s" style={{ fontSize: '1.5rem' }}>{v}</div>
              <div className="small muted">{l}</div>
            </div>
          ))}
        </div>
        <div className="card span-12 reveal">
          <CardTitle icon={<ChartColumn size={18} />} color="blue">
            المهام المكتملة يوميًا
          </CardTitle>
          <div className="mt">
            <Bars data={bars} height={200} />
          </div>
        </div>
        <div className="card span-6 reveal">
          <CardTitle icon={<Sun size={18} />} color="gold" sub="متى تنجز أكثر خلال اليوم">
            توزيع الإنجاز حسب الساعة
          </CardTitle>
          <div className="mt">
            <Bars data={hours} height={160} />
          </div>
        </div>
        <div className="card span-6 reveal d1">
          <CardTitle icon={<CalendarDays size={18} />} color="green" sub="إجمالي المهام المكتملة لكل يوم">
            حسب أيام الأسبوع
          </CardTitle>
          <div className="mt">
            <Bars data={weekdays} height={160} />
          </div>
        </div>
        <BalanceWidget span="span-6" />
        <TimeMachineWidget span="span-6" />
      </div>
    </>
  );
}
