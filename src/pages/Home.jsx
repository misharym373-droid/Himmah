import { SlidersHorizontal, CalendarDays, Repeat, Star, ChartColumn, Bot, ChartPie, Hourglass } from 'lucide-react';
import { useStore } from '../store.js';
import { navigate } from '../router.js';
import { QuickInput } from '../components/Layout.jsx';
import { WIDGETS } from '../lib/seed.js';
import { tr } from '../i18n/index.js';
import { PrayerStrip } from './Prayer.jsx';
import {
  Greeting, SummaryStrip, Insights, TopThree, NextTask, GoalsShortcut, FocusCard, Collapsible, DayMap, HabitsWidget, StatsWidget, XpWidget, AIWidget,
  BalanceWidget, TimeMachineWidget,
} from '../components/Widgets.jsx';

// الأقسام الإضافية (قابلة للطي) — ترتيبها وإظهارها من الإعدادات
const MORE = {
  dayMap: { icon: <CalendarDays size={18} />, hint: 'كل مهام اليوم مع السحب والإفلات', open: true, render: () => <DayMap span="span-12" title={null} /> },
  habits: { icon: <Repeat size={18} />, hint: 'سجّل عادات اليوم وتابع تحدياتك', render: () => <HabitsWidget /> },
  xp: { icon: <Star size={18} />, hint: 'المستوى، الـStreak، ورصيد المكافآت', render: () => <XpWidget /> },
  stats: { icon: <ChartColumn size={18} />, hint: 'إنجازك وتركيزك هذا الأسبوع', render: () => <StatsWidget /> },
  ai: { icon: <Bot size={18} />, hint: 'خطة مذاكرة أو هدف في ثوانٍ', render: () => <AIWidget /> },
  balance: { icon: <ChartPie size={18} />, hint: 'كيف يتوزع وقتك على مجالات حياتك', render: () => <BalanceWidget span="span-12" /> },
  timeMachine: { icon: <Hourglass size={18} />, hint: 'أين ستصل بنفس معدلك', render: () => <TimeMachineWidget span="span-12" /> },
};

export default function Home() {
  const dashboard = useStore((s) => s.dashboard);
  const hideStats = useStore((s) => s.settings.privacy?.hideStatsOnHome);
  const shown = (id) => !dashboard.hidden.includes(id) && !(hideStats && id === 'stats');
  const label = (id) => WIDGETS.find((w) => w.id === id)?.label;
  const more = dashboard.order.filter((id) => MORE[id] && shown(id));
  // البطاقات المتجاورة تأخذ العرض كاملًا إذا أُخفي شريكها
  const pair = (a, b, wide, narrow) => (shown(a) && shown(b) ? [wide, narrow] : ['span-12', 'span-12']);
  const [topSpan, nextSpan] = pair('top3', 'next', 'span-7', 'span-5');
  const [goalSpan, focusSpan] = pair('goals', 'focus', 'span-7', 'span-5');

  return (
    <>
      <div className="dash home">
        <Greeting input={<QuickInput id="home-input" big />} />
        {shown('summary') && <SummaryStrip />}
        {shown('prayer') && <PrayerStrip />}
        <Insights />
        {shown('top3') && <TopThree span={topSpan} />}
        {shown('next') && <NextTask span={nextSpan} />}
        {shown('goals') && <GoalsShortcut span={goalSpan} />}
        {shown('focus') && <FocusCard span={focusSpan} />}
      </div>

      <div className="row between" style={{ margin: '34px 0 12px' }}>
        <h2 style={{ fontSize: '1.15rem' }}>{tr('المزيد من يومك')}</h2>
        <button className="btn btn-sm btn-ghost" onClick={() => navigate('settings?tab=dashboard')}>
          <SlidersHorizontal /> {tr('تخصيص الرئيسية')}
        </button>
      </div>
      <div className="dash" style={{ marginTop: 0, gap: 12 }}>
        {more.map((id) => (
          <Collapsible key={id} id={id} title={tr(label(id))} icon={MORE[id].icon} hint={tr(MORE[id].hint)} defaultOpen={!!MORE[id].open}>
            {MORE[id].render()}
          </Collapsible>
        ))}
      </div>
    </>
  );
}
