// icons.jsx — single-source SVG icon set (lucide-style outline, 1.6 stroke)
// Globally exposes Icon component: <Icon name="search" size={16} />

const I = {
  search:    "M11 19a8 8 0 1 1 0-16 8 8 0 0 1 0 16Zm10 2-4.35-4.35",
  bell:      "M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9M14 21a2 2 0 0 1-4 0",
  plus:      "M12 5v14M5 12h14",
  filter:    "M3 5h18l-7 8v6l-4 2v-8L3 5Z",
  download:  "M12 3v12m0 0 5-5m-5 5-5-5M5 21h14",
  upload:    "M12 21V9m0 0 5 5m-5-5-5 5M5 3h14",
  chevron_down:  "m6 9 6 6 6-6",
  chevron_right: "m9 6 6 6-6 6",
  chevron_left:  "m15 6-6 6 6 6",
  chevron_up:    "m6 15 6-6 6 6",
  x:         "M6 6l12 12M18 6 6 18",
  check:     "M5 13l4 4L19 7",
  copy:      "M9 9h10v10H9zM5 5h10v4H9v6H5z",
  refresh:   "M3 12a9 9 0 0 1 15-6.7L21 8M3 16l3 2.7A9 9 0 0 0 21 12M21 3v5h-5M3 21v-5h5",
  more:      "M6 12h.01M12 12h.01M18 12h.01",
  edit:      "M4 20h4l11-11-4-4L4 16v4Zm10-15 4 4",
  trash:     "M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13",
  external:  "M14 5h5v5M19 5 10 14M19 13v6H5V5h6",
  user:      "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4 21a8 8 0 0 1 16 0",
  users:     "M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 10a7 7 0 0 1 14 0M16 3a4 4 0 0 1 0 8M17 21a7 7 0 0 0-4-6.3",
  heart:     "M12 21s-7-4.5-9.5-9A5.5 5.5 0 0 1 12 6a5.5 5.5 0 0 1 9.5 6c-2.5 4.5-9.5 9-9.5 9Z",
  shield:    "M12 22s8-3 8-10V5l-8-3-8 3v7c0 7 8 10 8 10Z",
  pulse:     "M3 12h4l3-8 4 16 3-8h4",
  bar:       "M3 21V10m6 11V4m6 17v-9m6 9V8",
  pie:       "M12 3a9 9 0 1 0 9 9h-9V3Z",
  trend_up:  "M3 17l6-6 4 4 8-8M14 7h7v7",
  trend_dn:  "M3 7l6 6 4-4 8 8M14 17h7v-7",
  calendar:  "M3 9h18M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2ZM8 3v4M16 3v4",
  clock:     "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Zm0-15v5l3 3",
  phone:     "M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3-8.6A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.3 1.8.6 2.6a2 2 0 0 1-.5 2.1L8 9.6a16 16 0 0 0 6 6l1.2-1.2a2 2 0 0 1 2.1-.5c.8.3 1.7.5 2.6.6a2 2 0 0 1 1.7 2Z",
  mail:      "M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Zm0 2 8 7 8-7",
  chat:      "M21 12a8 8 0 1 1-3.4-6.6L21 4l-1.4 3.4A8 8 0 0 1 21 12Z",
  whatsapp:  "M3 21l1.65-4.5A9 9 0 1 1 8 19.4L3 21Z M8 10c.5 3 2 4.5 5 5l1.3-1.5c.3-.4.9-.5 1.4-.3l2 1c.4.2.6.6.5 1-.4 1.7-2 2.3-3.6 2-3.7-.8-7-4-7.7-7.7-.3-1.6.3-3.2 2-3.6.4-.1.8.1 1 .5l1 2c.2.5.1 1.1-.3 1.4L8 10Z",
  package:   "M12 12 3 7l9-5 9 5-9 5Zm0 0v10M3 7v10l9 5M21 7v10l-9 5",
  truck:     "M3 5h11v11H3zM14 9h4l3 4v3h-7M7 20a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm10 0a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z",
  stethoscope:"M6 3v6a4 4 0 0 0 8 0V3M9 21v-4a5 5 0 0 1 5-5 5 5 0 0 1 5 5 2 2 0 1 1-4 0",
  pill:      "m10.5 20.5 10-10a5 5 0 0 0-7-7l-10 10a5 5 0 0 0 7 7Zm-3.5-3.5 7-7",
  settings:  "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9c.4.6 1 1 1.6 1H21a2 2 0 0 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z",
  home:      "M3 11 12 3l9 8v9a2 2 0 0 1-2 2h-3v-6h-8v6H5a2 2 0 0 1-2-2v-9Z",
  inbox:     "M22 12h-6l-2 3h-4l-2-3H2M5 4h14l3 8v6a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-6l3-8Z",
  flag:      "M4 21V4h11l1 2h5v9h-6l-1-2H6v8H4Z",
  link:      "M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1.5 1.5M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1.5-1.5",
  bolt:      "M13 2 4 14h6l-1 8 9-12h-6l1-8Z",
  sparkles:  "M12 3 13.5 9 19 10.5 13.5 12 12 18 10.5 12 5 10.5 10.5 9 12 3Z M19 17l.7 2.3L22 20l-2.3.7L19 23l-.7-2.3L16 20l2.3-.7L19 17Z",
  eye:       "M2 12s4-8 10-8 10 8 10 8-4 8-10 8S2 12 2 12Zm10 3a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z",
  arrow_right:"M5 12h14M13 5l7 7-7 7",
  arrow_up_right:"M7 17 17 7M8 7h9v9",
  layers:    "M12 2 2 7l10 5 10-5-10-5Zm10 10-10 5L2 12m20 5-10 5L2 17",
  command:   "M6 3a3 3 0 0 0 0 6h12a3 3 0 0 0 0-6 3 3 0 0 0-3 3v12a3 3 0 0 0 3 3 3 3 0 0 0 0-6H6a3 3 0 0 0 0 6 3 3 0 0 0 3-3V6a3 3 0 0 0-3-3Z",
  side:      "M3 4h18v16H3zM9 4v16",
  map:       "M3 6 9 4l6 2 6-2v14l-6 2-6-2-6 2V6Zm6-2v16m6-14v16",
  clipboard: "M9 3h6v3H9zM7 5H5a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2",
  message:   "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10Z",
  star:      "m12 2 3 7 7 .6-5.3 4.7L18 21l-6-3.7L6 21l1.3-6.7L2 9.6 9 9l3-7Z",
  lock:      "M5 11h14v10H5zM7 11V8a5 5 0 0 1 10 0v3",
};

function Icon({ name, size = 16, color = "currentColor", strokeWidth = 1.6, fill = "none", className = "" }) {
  const d = I[name];
  if (!d) return null;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={color}
      strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true" className={className}>
      {d.split(' M').map((p, i) => <path key={i} d={(i ? 'M' : '') + p} />)}
    </svg>
  );
}

window.Icon = Icon;
