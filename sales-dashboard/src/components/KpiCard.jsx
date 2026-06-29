// Compact KPI tile. `value` is pre-formatted; `accent` tints the value + bar.
export default function KpiCard({ label, value, sub, accent = '#22d3ee' }) {
  return (
    <div className="panel relative overflow-hidden px-4 py-3">
      <span
        className="absolute inset-y-0 left-0 w-1"
        style={{ background: accent }}
        aria-hidden
      />
      <p className="text-sm font-medium text-text-muted">{label}</p>
      <p className="mt-1 text-3xl font-extrabold leading-none tracking-tight" style={{ color: accent }}>
        {value}
      </p>
      {sub && <p className="mt-1 text-sm text-text-faint">{sub}</p>}
    </div>
  );
}
