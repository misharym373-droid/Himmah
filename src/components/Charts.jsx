// رسوم بيانية خفيفة بـ SVG (بدون مكتبات ضخمة)
export function Bars({ data, height = 150, valueKey = 'done', labelKey = 'label' }) {
  const max = Math.max(1, ...data.map((d) => d[valueKey]));
  return (
    <div className="bars" style={{ height }} role="img" aria-label="رسم بياني بالأعمدة">
      {data.map((d, i) => (
        <div className={`b ${d.today ? 'today' : ''}`} key={i}>
          <i data-v={d[valueKey]} style={{ height: `${Math.max(4, (d[valueKey] / max) * 100)}%`, animationDelay: `${i * 0.06}s` }} />
          <span>{d[labelKey]}</span>
        </div>
      ))}
    </div>
  );
}

// منحنى آلة الزمن: الماضي (خط) + التوقع (منقط)
export function TimeLine({ series, proj, height = 150 }) {
  const w = 600;
  const pad = 14;
  const all = [...series, ...proj];
  const minX = -30;
  const maxX = 30;
  const maxY = Math.max(1, ...all.map((p) => p.y));
  const minY = Math.min(...all.map((p) => p.y));
  const X = (x) => pad + ((x - minX) / (maxX - minX)) * (w - pad * 2);
  // RTL: الماضي على اليمين
  const Xr = (x) => w - X(x);
  const Y = (y) => height - pad - ((y - minY) / Math.max(1, maxY - minY)) * (height - pad * 2);
  const path = (pts) => pts.map((p, i) => `${i ? 'L' : 'M'}${Xr(p.x).toFixed(1)},${Y(p.y).toFixed(1)}`).join(' ');
  const smooth = (pts) => {
    if (pts.length < 2) return path(pts);
    let d = `M${Xr(pts[0].x)},${Y(pts[0].y)}`;
    for (let i = 1; i < pts.length; i++) {
      const p0 = pts[i - 1];
      const p1 = pts[i];
      const cx = (Xr(p0.x) + Xr(p1.x)) / 2;
      d += ` C${cx},${Y(p0.y)} ${cx},${Y(p1.y)} ${Xr(p1.x)},${Y(p1.y)}`;
    }
    return d;
  };
  const areaD = `${smooth(series)} L${Xr(0)},${height} L${Xr(-30)},${height} Z`;
  const now = series[series.length - 1];
  return (
    <svg className="chart-line" viewBox={`0 0 ${w} ${height}`} width="100%" height={height} preserveAspectRatio="none" role="img" aria-label="منحنى تقدم المهام">
      <defs>
        <linearGradient id="tmFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--primary)" stopOpacity=".35" />
          <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="tmLine" x1="1" y1="0" x2="0" y2="0">
          <stop offset="0%" stopColor="var(--primary-soft)" />
          <stop offset="100%" stopColor="#3B82F6" />
        </linearGradient>
      </defs>
      <path d={areaD} fill="url(#tmFill)" style={{ animation: 'fadeIn 1.2s ease both' }} />
      <path className="line" d={smooth(series)} fill="none" stroke="url(#tmLine)" strokeWidth="3" strokeLinecap="round" />
      <path d={smooth(proj)} fill="none" stroke="#3B82F6" strokeWidth="2.5" strokeDasharray="6 7" strokeLinecap="round" opacity=".85" style={{ animation: 'fadeIn 1s 1.2s ease both' }} />
      {now && (
        <g style={{ animation: 'fadeIn .6s 1.4s ease both' }}>
          <circle cx={Xr(0)} cy={Y(now.y)} r="10" fill="var(--primary)" opacity=".25" />
          <circle cx={Xr(0)} cy={Y(now.y)} r="5" fill="#fff" stroke="var(--primary)" strokeWidth="3" />
        </g>
      )}
    </svg>
  );
}

export function Donut({ data, size = 150, stroke = 18 }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  let acc = 0;
  const total = data.reduce((a, d) => a + d.pct, 0) || 1;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)' }} role="img" aria-label="توزيع المجالات">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(148,163,184,.1)" strokeWidth={stroke} />
      {data
        .filter((d) => d.pct > 0)
        .map((d) => {
          const len = (d.pct / total) * c;
          const el = (
            <circle
              key={d.key}
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={d.color}
              strokeWidth={stroke}
              strokeDasharray={`${Math.max(0, len - 3)} ${c}`}
              strokeDashoffset={-acc}
              style={{ transition: 'stroke-dasharray 1s ease', filter: `drop-shadow(0 0 6px ${d.color}88)` }}
            />
          );
          acc += len;
          return el;
        })}
    </svg>
  );
}
