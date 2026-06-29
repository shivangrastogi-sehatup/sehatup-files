import { useEffect, useRef, useState } from 'react';
import { COLORS } from './colors';
import { formatPercent } from '../utils/dataProcessor';

// Quips the avatars "say" in a speech bubble when their close count moves.
const UP_QUIPS = ['🔥 Closed one!', 'Cha-ching! 💰', '+1 🎉', 'On fire!', 'Boom! 💥', "Let's go! 🚀"];
const DOWN_QUIPS = ['Oops…', 'Reverted 😬', 'Recount 📉'];
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

// We don't have a gender column per rep, so guess from the name (rough, Indian-name
// heuristic) with a small known override map. Drives only which avatar emoji shows.
const KNOWN_GENDER = { riya: 'f', shivam: 'm', shivang: 'm' };
function genderOf(name) {
  const n = String(name).trim().toLowerCase();
  if (KNOWN_GENDER[n]) return KNOWN_GENDER[n];
  if (/(?:a|i|ya|ka|ni|ta|na|ri|priya|shri)$/.test(n)) return 'f';
  return 'm';
}
const AVATAR = { f: '👩', m: '👨' };

export default function TelesalesLeaderboard({ t, tab }) {
  const board = t?.leaderboard || [];
  const maxCloses = Math.max(1, ...board.map((r) => r.closes));

  // Track previous close counts so we can fire a reaction when they change between
  // the 5-min refreshes. First load sets the baseline (no reaction).
  const prevRef = useRef(null);
  const [reactions, setReactions] = useState({});

  useEffect(() => {
    const prev = prevRef.current;
    const snapshot = {};
    board.forEach((r) => { snapshot[r.name] = r.closes; });

    if (prev) {
      const fresh = {};
      board.forEach((r) => {
        const before = prev[r.name];
        if (before !== undefined && r.closes !== before) {
          const up = r.closes > before;
          fresh[r.name] = { up, text: up ? pick(UP_QUIPS) : pick(DOWN_QUIPS), id: `${Date.now()}-${r.name}` };
        }
      });
      if (Object.keys(fresh).length) {
        setReactions((cur) => ({ ...cur, ...fresh }));
        setTimeout(() => {
          setReactions((cur) => {
            const next = { ...cur };
            Object.keys(fresh).forEach((k) => { if (next[k]?.id === fresh[k].id) delete next[k]; });
            return next;
          });
        }, 5200);
      }
    }
    prevRef.current = snapshot;
  }, [board]);

  return (
    <section className="panel flex shrink-0 flex-col gap-2 overflow-hidden px-4 py-3" style={{ height: 250 }}>
      <style>{`
        @keyframes tlBob { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-5px); } }
        @keyframes tlCheer { 0% { transform: translateY(0) scale(1); } 25% { transform: translateY(-14px) scale(1.18) rotate(-6deg); } 50% { transform: translateY(-4px) scale(1.1) rotate(5deg); } 75% { transform: translateY(-10px) scale(1.14) rotate(-3deg); } 100% { transform: translateY(0) scale(1); } }
        @keyframes tlSlump { 0%,100% { transform: translateY(0) rotate(0); } 40% { transform: translateY(4px) rotate(4deg); } }
        @keyframes tlBubble { 0% { opacity: 0; transform: translateY(6px) scale(.8); } 12% { opacity: 1; transform: translateY(0) scale(1); } 85% { opacity: 1; } 100% { opacity: 0; transform: translateY(-4px) scale(.95); } }
        @keyframes tlGrow { from { transform: scaleY(0); } to { transform: scaleY(1); } }
        @keyframes tlCrown { 0%,100% { transform: rotate(-8deg); } 50% { transform: rotate(8deg); } }
        .tl-bar { transform-origin: bottom; animation: tlGrow .6s cubic-bezier(.22,1,.36,1); }
        .tl-avatar-idle { animation: tlBob 2.8s ease-in-out infinite; }
        .tl-avatar-cheer { animation: tlCheer .9s ease-in-out 2; }
        .tl-avatar-sad { animation: tlSlump 1s ease-in-out 2; }
        .tl-bubble { animation: tlBubble 5.2s ease forwards; }
        .tl-crown { animation: tlCrown 2.4s ease-in-out infinite; }
      `}</style>

      {/* Header + overall stats */}
      <div className="flex items-center gap-3">
        <span className="h-5 w-1.5 rounded-full" style={{ background: COLORS.amber }} />
        <h2 className="text-xl font-bold">Telesales Leaderboard</h2>
        <span className="text-sm text-text-faint">{tab ? `${tab} · order closes by rep` : 'order closes by rep'}</span>
        <span className="ml-auto flex items-center gap-2">
          <Stat label="Closes" value={t.totalClosed} color={COLORS.green} />
          <Stat label="Calls" value={t.totalCalled} color={COLORS.cyan} />
          <Stat label="Uncalled" value={t.uncalled} color={COLORS.red} />
          <Stat label="Close %" value={formatPercent(t.overallCloseRatio)} color={COLORS.amber} />
        </span>
      </div>

      {/* Podium row */}
      {board.length === 0 ? (
        <div className="grid flex-1 place-items-center text-sm text-text-faint">
          No telesales data — check the “After Consultation” tab.
        </div>
      ) : (
        <div className="flex flex-1 items-end justify-around gap-2 pb-1">
          {board.map((rep, i) => {
            const isLeader = i === 0 && rep.closes > 0;
            const barH = rep.closes > 0 ? Math.max(10, (rep.closes / maxCloses) * 54) : 3;
            const g = genderOf(rep.name);
            const reaction = reactions[rep.name];
            const avatarClass = reaction ? (reaction.up ? 'tl-avatar-cheer' : 'tl-avatar-sad') : 'tl-avatar-idle';
            return (
              <div key={rep.name} className="flex h-full flex-col items-center justify-end" style={{ width: 110, maxWidth: 130 }}>
                {/* Speech bubble */}
                <div className="relative flex h-6 items-end justify-center">
                  {reaction && (
                    <span className="tl-bubble absolute bottom-0 whitespace-nowrap rounded-lg px-2 py-0.5 text-[11px] font-bold shadow-lg"
                      style={{ background: reaction.up ? COLORS.green : COLORS.red, color: '#0b1020' }}>
                      {reaction.text}
                    </span>
                  )}
                </div>
                {/* Crown for the leader */}
                <div className="h-4 text-base leading-none">
                  {isLeader && <span className="tl-crown inline-block">👑</span>}
                </div>
                {/* Avatar sitting on top of the bar */}
                <div className={`${avatarClass} text-2xl leading-none`} style={{ filter: isLeader ? 'drop-shadow(0 0 6px rgba(251,191,36,.7))' : 'none' }}>
                  {AVATAR[g]}
                </div>
                {/* Bar — height ∝ closes (orders) */}
                <div className="mt-1 w-8 rounded-t-md tl-bar"
                  style={{
                    height: barH,
                    background: `linear-gradient(180deg, ${isLeader ? COLORS.amber : COLORS.cyan}, ${isLeader ? '#b45309' : '#1e3a8a'})`,
                    boxShadow: isLeader ? `0 0 12px ${COLORS.amber}66` : 'none',
                  }}
                />
                {/* Labels */}
                <div className="mt-1 w-full text-center leading-tight">
                  <div className="truncate text-sm font-bold">{rep.name}</div>
                  <div className="text-base font-extrabold" style={{ color: isLeader ? COLORS.amber : COLORS.green }}>
                    {rep.closes}
                    <span className="ml-1 text-[11px] font-medium text-text-faint">closes</span>
                  </div>
                  <div className="text-[11px] text-text-muted">{rep.calls} calls · {formatPercent(rep.closeRatio)}</div>
                  {rep.uncalled > 0 && (
                    <div className="text-[11px] font-semibold" style={{ color: COLORS.red }}>{rep.uncalled} uncalled</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function Stat({ label, value, color }) {
  return (
    <span className="flex items-baseline gap-1 rounded-lg bg-white/5 px-2.5 py-1">
      <span className="text-base font-extrabold" style={{ color }}>{value}</span>
      <span className="text-xs text-text-muted">{label}</span>
    </span>
  );
}
