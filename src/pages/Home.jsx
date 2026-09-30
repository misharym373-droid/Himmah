import { SlidersHorizontal } from 'lucide-react';
import { useStore } from '../store.js';
import { navigate } from '../router.js';
import { Hero, ProgressWidget, QuickActions, Insights, TopTaskWidget, DayMap, TrioWidget, StatsWidget, XpWidget, AIWidget, BalanceWidget, TimeMachineWidget } from '../components/Widgets.jsx';

export default function Home() {
  const dashboard = useStore((s) => s.dashboard);
  const hideStats = useStore((s) => s.settings.privacy?.hideStatsOnHome);
  const visible = dashboard.order.filter((id) => !dashboard.hidden.includes(id) && !(hideStats && id === 'stats'));

  // بطاقات تتشارك الصف إذا كانت متجاورة
  const pairs = { topTask: 'dayMap', dayMap: 'topTask', balance: 'timeMachine', timeMachine: 'balance' };
  const paired = (id) => {
    const i = visible.indexOf(id);
    const mate = pairs[id];
    return mate && (visible[i - 1] === mate || visible[i + 1] === mate);
  };

  const render = (id) => {
    switch (id) {
      case 'progress':
        return [<ProgressWidget key="p" />, <QuickActions key="qa" />, <Insights key="in" />];
      case 'topTask':
        return <TopTaskWidget key={id} />;
      case 'dayMap':
        return <DayMap key={id} span={paired('dayMap') ? 'span-7' : 'span-12'} />;
      case 'trio':
        return <TrioWidget key={id} />;
      case 'stats':
        return <StatsWidget key={id} />;
      case 'xp':
        return <XpWidget key={id} />;
      case 'ai':
        return <AIWidget key={id} />;
      case 'balance':
        return <BalanceWidget key={id} span={paired('balance') ? 'span-6' : 'span-12'} />;
      case 'timeMachine':
        return <TimeMachineWidget key={id} span={paired('timeMachine') ? 'span-6' : 'span-12'} />;
      default:
        return null;
    }
  };

  return (
    <>
      <Hero />
      <div className="row between" style={{ marginTop: 26 }}>
        <h2 style={{ fontSize: '1.35rem' }}>لوحة يومك</h2>
        <button className="btn btn-sm btn-ghost" onClick={() => navigate('settings?tab=dashboard')}>
          <SlidersHorizontal /> تخصيص
        </button>
      </div>
      <div className="dash">{visible.map(render)}</div>
    </>
  );
}
