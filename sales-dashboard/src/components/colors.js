// Shared chart palette — mirrors the Tailwind `accent.*` theme tokens so
// Recharts series match the dark TV theme.
export const COLORS = {
  cyan: '#22d3ee',
  green: '#34d399',
  amber: '#fbbf24',
  red: '#f87171',
  violet: '#a78bfa',
  blue: '#60a5fa',
};

export const SERIES = [
  COLORS.cyan,
  COLORS.violet,
  COLORS.green,
  COLORS.amber,
  COLORS.blue,
  COLORS.red,
];

// Axis/grid styling reused across charts.
export const AXIS = { fontSize: 13, fill: '#9aa7c7' };
export const GRID = '#26304f';

// Dark tooltip styling for Recharts.
export const TOOLTIP_STYLE = {
  contentStyle: {
    background: '#141a2e',
    border: '1px solid #26304f',
    borderRadius: 10,
    color: '#e8edf7',
    fontSize: 13,
  },
  labelStyle: { color: '#9aa7c7' },
  itemStyle: { color: '#e8edf7' },
  cursor: { fill: 'rgba(255,255,255,0.04)' },
};
