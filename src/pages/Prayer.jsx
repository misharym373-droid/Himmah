// صلاتي: الصلوات الخمس لليوم بأوقاتها + تسجيل (في وقتها / قضاء) + السجل والإحصائيات
import { useMemo, useState } from 'react';
import { Check, Clock, MapPin, LocateFixed, Flame, Bell, Sunrise, Sun, CloudSun, Sunset, Moon } from 'lucide-react';
import { useStore } from '../store.js';
import { navigate } from '../router.js';
import { useNow } from '../hooks.js';
import { Switch, Ring } from '../components/ui.jsx';
import { PRAYERS, CITIES, prayerTimes, fmtTime, cityOf, locate, dayCount, onTimeCount } from '../lib/prayer.js';
import { todayKey, addDays, fromKey, formatLong, formatShort, dayShort, nowMin, formatDuration } from '../lib/date.js';
import { tr, trf } from '../i18n/index.js';

const ICONS = { fajr: Sunrise, dhuhr: Sun, asr: CloudSun, maghrib: Sunset, isha: Moon };

// الصلاة القادمة/الحالية الآن
export function prayerNow(times, now = nowMin()) {
  const order = PRAYERS.map((p) => ({ ...p, at: times[p.key] }));
  const next = order.find((p) => p.at > now);
  const current = [...order].reverse().find((p) => p.at <= now) || null;
  return { next, current };
}

// سلسلة الأيام المتتالية التي اكتملت فيها الصلوات الخمس
export function prayerStreak(prayers, T = todayKey()) {
  const byDate = Object.fromEntries(prayers.map((p) => [p.date, p]));
  let n = 0;
  let d = dayCount(byDate[T]) === 5 ? T : addDays(T, -1);
  while (dayCount(byDate[d]) === 5) (n++, (d = addDays(d, -1)));
  return n;
}

export function PrayerRow({ p, time, status, date, compact, isNext }) {
  const mark = useStore((s) => s.markPrayer);
  const Icon = ICONS[p.key];
  const T = todayKey();
  const future = date === T && time > nowMin();
  return (
    <div className={`prayer-row ${status || ''} ${isNext ? 'next' : ''}`}>
      <span className="prayer-ico">
        <Icon size={compact ? 16 : 19} />
      </span>
      <div className="grow" style={{ minWidth: 0 }}>
        <div className="bold">{tr(p.label)}</div>
        <div className="tiny muted num">{fmtTime(time)}</div>
      </div>
      <div className="prayer-actions" role="group" aria-label={tr(p.label)}>
        <button className={`chip ${status === 'ontime' ? 'on' : ''}`} onClick={() => mark(date, p.key, 'ontime')} disabled={future} aria-pressed={status === 'ontime'} title={future ? tr('لم يدخل وقتها بعد') : ''}>
          <Check size={14} /> {compact ? tr('صليت') : tr('في وقتها')}
        </button>
        {!compact && (
          <button className={`chip late ${status === 'late' ? 'on' : ''}`} onClick={() => mark(date, p.key, 'late')} disabled={future} aria-pressed={status === 'late'}>
            <Clock size={14} /> {tr('قضاء')}
          </button>
        )}
      </div>
    </div>
  );
}

export default function Prayer() {
  useNow(30000);
  const settings = useStore((s) => s.settings);
  const prayers = useStore((s) => s.prayers);
  const setSetting = useStore((s) => s.setSetting);
  const T = todayKey();
  const [day, setDay] = useState(T);
  const city = cityOf(settings);
  const times = useMemo(() => prayerTimes(day, city), [day, city.lat, city.lng, city.tz]); // eslint-disable-line
  const todayTimes = useMemo(() => prayerTimes(T, city), [T, city.lat, city.lng, city.tz]); // eslint-disable-line
  const row = prayers.find((p) => p.date === day);
  const { next } = prayerNow(todayTimes);
  const now = nowMin();
  const streak = prayerStreak(prayers);
  const [locErr, setLocErr] = useState('');

  // إحصائيات آخر 30 يومًا (تبدأ من أول يوم سجّلت فيه، حتى لا تظلم الحساب الجديد)
  const stats = useMemo(() => {
    const first = prayers.reduce((m, p) => (p.date < m ? p.date : m), T);
    const days = Array.from({ length: 30 }, (_, i) => addDays(T, -i)).filter((d) => d >= first);
    const byDate = Object.fromEntries(prayers.map((p) => [p.date, p]));
    let done = 0, ontime = 0, total = 0;
    const missedBy = Object.fromEntries(PRAYERS.map((p) => [p.key, 0]));
    for (const d of days) {
      const r = byDate[d];
      const t = d === T ? PRAYERS.filter((p) => todayTimes[p.key] <= now).length : 5;
      total += t;
      done += dayCount(r);
      ontime += onTimeCount(r);
      PRAYERS.forEach((p, i) => i < t && !r?.[p.key] && missedBy[p.key]++);
    }
    const worst = Object.entries(missedBy).sort((a, b) => b[1] - a[1])[0];
    return { rate: total ? Math.round((done / total) * 100) : 0, onRate: done ? Math.round((ontime / done) * 100) : 0, worst: worst[1] ? PRAYERS.find((p) => p.key === worst[0]) : null };
  }, [prayers, T, todayTimes, now]);

  const cells = useMemo(() => {
    const end = addDays(T, 6 - fromKey(T).getDay());
    return Array.from({ length: 35 }, (_, i) => addDays(end, i - 34));
  }, [T]);
  const byDate = useMemo(() => Object.fromEntries(prayers.map((p) => [p.date, p])), [prayers]);

  async function useMyLocation() {
    setLocErr('');
    try {
      const loc = await locate();
      setSetting('prayer', { ...settings.prayer, city: 'custom', ...loc });
    } catch (e) {
      console.warn('[himmah:prayer]', e?.message || e);
      setLocErr(tr('ما قدرنا نحدد موقعك. اسمح للمتصفح بالوصول للموقع أو اختر مدينتك.'));
    }
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>{tr('صلاتي')}</h1>
          <p>{formatLong(T)} · {tr(city.label)}</p>
        </div>
        <div className="row wrap">
          <label className="input-icon" style={{ minWidth: 180 }}>
            <MapPin />
            <select className="select" style={{ paddingInlineStart: 38 }} value={settings.prayer?.city || 'yanbu'} onChange={(e) => (e.target.value === 'custom' ? useMyLocation() : setSetting('prayer', { ...settings.prayer, city: e.target.value }))} aria-label={tr('المدينة')}>
              {Object.entries(CITIES).map(([k, c]) => (
                <option key={k} value={k}>
                  {tr(c.label)}
                </option>
              ))}
              <option value="custom">{tr('موقعي الحالي')}</option>
            </select>
          </label>
          <button className="btn btn-sm" onClick={useMyLocation}>
            <LocateFixed /> {tr('موقعي')}
          </button>
        </div>
      </div>
      {locErr && <div className="notice warn mb">{locErr}</div>}

      <div className="dash" style={{ marginTop: 0 }}>
        <div className="card span-7">
          <div className="row between mb">
            <div>
              <div className="card-title">{day === T ? tr('صلوات اليوم') : formatLong(day)}</div>
              <div className="card-sub">
                {trf('صليت {n} من 5', { n: dayCount(row) })}
                {day === T && next && <> · {trf('{name} بعد {left}', { name: tr(next.label), left: formatDuration(next.at - now) })}</>}
              </div>
            </div>
            <Ring value={(dayCount(row) / 5) * 100} size={64} stroke={7} id="prayerRing">
              <span className="small xbold num">{dayCount(row)}/5</span>
            </Ring>
          </div>
          <div className="col" style={{ gap: 8 }}>
            {PRAYERS.map((p) => (
              <PrayerRow key={p.key} p={p} time={times[p.key]} status={row?.[p.key]} date={day} isNext={day === T && next?.key === p.key} />
            ))}
          </div>
          <div className="row tiny muted mt" style={{ gap: 14 }}>
            <span>
              {tr('الشروق')} <span className="num">{fmtTime(times.sunrise)}</span>
            </span>
            <span>{tr('حساب أم القرى · على جهازك بدون إنترنت')}</span>
          </div>
          {day !== T && (
            <button className="btn btn-sm btn-ghost mt-s" onClick={() => setDay(T)}>
              {tr('الرجوع لليوم')}
            </button>
          )}
        </div>

        <div className="span-5 col" style={{ gap: 18 }}>
          <div className="card">
            <div className="kpis" style={{ gridTemplateColumns: 'repeat(3, minmax(0,1fr))' }}>
              <div className="mini-stat">
                <div className="v num">
                  <Flame size={18} className="gold" style={{ verticalAlign: -2 }} /> {streak}
                </div>
                <div className="l">{tr('أيام كاملة متتالية')}</div>
              </div>
              <div className="mini-stat">
                <div className="v num">{stats.rate}%</div>
                <div className="l">{tr('التزام آخر 30 يوم')}</div>
              </div>
              <div className="mini-stat">
                <div className="v num">{stats.onRate}%</div>
                <div className="l">{tr('في وقتها')}</div>
              </div>
            </div>
            {stats.worst && <p className="small muted mt">{trf('أكثر صلاة تفوتك: {name} — جرّب تفعيل التذكير قبلها.', { name: tr(stats.worst.label) })}</p>}
          </div>

          <div className="card">
            <div className="row between mb">
              <b>{tr('السجل')}</b>
              <span className="tiny muted">
                {formatShort(cells[0])} ← {formatShort(cells[cells.length - 1])}
              </span>
            </div>
            <div className="heat mb" style={{ gap: 5 }}>
              {[0, 1, 2, 3, 4, 5, 6].map((i) => (
                <span key={i} className="tiny dim" style={{ textAlign: 'center' }}>
                  {dayShort(i)}
                </span>
              ))}
            </div>
            <div className="heat" style={{ gap: 5 }}>
              {cells.map((d) => {
                const n = dayCount(byDate[d]);
                const lvl = d > T ? '' : n === 5 ? 'l3' : n >= 3 ? 'l2' : n > 0 ? 'l1' : '';
                return (
                  <button key={d} className={`c ${lvl} ${d === day ? 'today' : ''}`} disabled={d > T} onClick={() => setDay(d)} title={`${formatLong(d)}: ${n}/5`} aria-label={`${formatLong(d)}: ${n}/5`} style={{ opacity: d > T ? 0.25 : 1 }}>
                    <span className="num">{fromKey(d).getDate()}</span>
                  </button>
                );
              })}
            </div>
            <p className="tiny dim mt-s">{tr('اضغط على أي يوم لتعديل صلواته')}</p>
          </div>

          <div className="card">
            <div className="set-row" style={{ padding: 0, borderBottom: 0 }}>
              <div className="grow">
                <div className="t row" style={{ gap: 6 }}>
                  <Bell size={16} /> {tr('تذكير قبل الأذان')}
                </div>
                <div className="d">{tr('تنبيه داخل الموقع (وعلى الجهاز إذا فعّلت إشعارات المتصفح من الإعدادات)')}</div>
              </div>
              <Switch on={settings.prayer?.remind !== false} onChange={(v) => setSetting('prayer', { ...settings.prayer, remind: v })} label={tr('تذكير قبل الأذان')} />
            </div>
            {settings.prayer?.remind !== false && (
              <div className="chips mt-s">
                {[5, 10, 15, 30].map((m) => (
                  <button key={m} className={`chip ${(settings.prayer?.before ?? 10) === m ? 'on' : ''}`} onClick={() => setSetting('prayer', { ...settings.prayer, before: m })}>
                    {trf('قبل {n} د', { n: m })}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

// بطاقة الرئيسية: الصلاة القادمة + تسجيل سريع للخمس
export function PrayerStrip({ span = 'span-12' }) {
  useNow(30000);
  const settings = useStore((s) => s.settings);
  const prayers = useStore((s) => s.prayers);
  const mark = useStore((s) => s.markPrayer);
  const T = todayKey();
  const city = cityOf(settings);
  const times = useMemo(() => prayerTimes(T, city), [T, city.lat, city.lng, city.tz]); // eslint-disable-line
  const row = prayers.find((p) => p.date === T);
  const now = nowMin();
  const { next } = prayerNow(times, now);
  return (
    <div className={`card prayer-strip ${span}`}>
      <div className="row between wrap" style={{ gap: 10 }}>
        <div className="row" style={{ gap: 10 }}>
          <span className="card-title" style={{ margin: 0 }}>
            <span className="ico">
              <Moon size={17} />
            </span>
            {tr('صلوات اليوم')}
          </span>
          <span className="small muted">
            {next ? trf('{name} بعد {left}', { name: tr(next.label), left: formatDuration(next.at - now) }) : tr('انتهت صلوات اليوم')} · {tr(city.label)}
          </span>
        </div>
        <button className="btn btn-xs btn-ghost" onClick={() => navigate('prayer')}>
          {tr('صلاتي')}
        </button>
      </div>
      <div className="prayer-pills mt-s">
        {PRAYERS.map((p) => {
          const st = row?.[p.key];
          const future = times[p.key] > now;
          return (
            <button key={p.key} className={`prayer-pill ${st || ''} ${next?.key === p.key ? 'next' : ''}`} disabled={future && !st} onClick={() => mark(T, p.key, st === 'late' ? 'late' : 'ontime')} aria-pressed={!!st}>
              <span className="pp-check">{st ? <Check size={13} /> : null}</span>
              <span className="bold small">{tr(p.label)}</span>
              <span className="tiny muted num">{fmtTime(times[p.key])}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
