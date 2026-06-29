import { useEffect, useState } from 'react';
import { useDashboardData } from './hooks/useDashboardData';
import TelesalesLeaderboard from './components/TelesalesLeaderboard';
import MensWellnessSection from './components/MensWellnessSection';
import HealthscoreSection from './components/HealthscoreSection';

// The dashboard is designed at a fixed 1920×1080 (TV wall). FitScreen scales that
// canvas down (or up) to fit whatever window it's viewed in — so it never crops and
// you never have to zoom manually. transform-origin top-center keeps it pinned to the top.
const DESIGN_W = 1920;
const DESIGN_H = 1080;

function FitScreen({ children }) {
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const fit = () => setScale(Math.min(window.innerWidth / DESIGN_W, window.innerHeight / DESIGN_H));
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, []);
  return (
    <div className="grid h-screen w-screen place-items-start justify-center overflow-hidden bg-bg">
      <div style={{ width: DESIGN_W, height: DESIGN_H, transform: `scale(${scale})`, transformOrigin: 'top center', flexShrink: 0 }}>
        {children}
      </div>
    </div>
  );
}

export default function App() {
  const { mens, health, telesales, mensTab, telesalesTab, status, updatedAt } = useDashboardData();

  return (
    <FitScreen>
      <div className="relative flex h-full w-full flex-col overflow-hidden px-6 py-3">
        <Header status={status} updatedAt={updatedAt} />

        <main className="mt-3 flex min-h-0 flex-1 flex-col gap-3">
          <TelesalesLeaderboard t={telesales} tab={telesalesTab} />
          <MensWellnessSection m={mens} tab={mensTab} />
          <HealthscoreSection h={health} />
        </main>

        <Watermark />
      </div>
    </FitScreen>
  );
}

function Header({ status, updatedAt }) {
  return (
    <header className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="grid h-9 w-9 place-items-center rounded-xl bg-accent/20 ring-1 ring-accent/40">
          <span className="text-lg font-extrabold text-accent">S</span>
        </div>
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">SehatUP — Sales Dashboard</h1>
          <p className="text-sm text-text-muted">Men's Wellness &amp; Healthscore · live overview</p>
        </div>
      </div>
      <StatusPill status={status} updatedAt={updatedAt} />
    </header>
  );
}

function StatusPill({ status, updatedAt }) {
  const map = {
    loading: { dot: 'bg-accent-amber', label: 'Loading…' },
    ready: { dot: 'bg-accent-green', label: 'Live' },
    error: { dot: 'bg-accent-red', label: 'No data — check API key / sharing' },
  };
  const s = map[status] ?? map.loading;
  return (
    <div className="panel flex items-center gap-2 px-3 py-1.5">
      <span className={`h-2.5 w-2.5 rounded-full ${s.dot} animate-pulse`} />
      <span className="text-sm text-text-muted">{s.label}</span>
      {updatedAt && (
        <span className="text-sm text-text-faint">· {updatedAt.toLocaleTimeString('en-IN')}</span>
      )}
    </div>
  );
}

function Watermark() {
  return (
    <div className="pointer-events-none fixed bottom-2 right-4 select-none text-sm font-semibold tracking-wide text-text-faint">
      SehatUP
    </div>
  );
}
