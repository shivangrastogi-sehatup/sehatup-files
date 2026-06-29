import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import KpiCard from './KpiCard';
import Panel from './Panel';
import { AXIS, COLORS, GRID, TOOLTIP_STYLE } from './colors';
import { formatCurrency, formatNumber, formatPercent } from '../utils/dataProcessor';

export default function HealthscoreSection({ h }) {
  return (
    <div className="flex flex-col gap-3">
      <SectionTitle
        title="Healthscore"
        subtitle={`Consultation funnel · ${h.days} days`}
        accent={COLORS.green}
      />

      {/* KPI strip */}
      <div className="grid grid-cols-5 gap-3">
        <KpiCard label="Total Leads" value={formatNumber(h.totalLeads)} accent={COLORS.cyan} />
        <KpiCard
          label="Consults Booked"
          value={formatNumber(h.booked)}
          sub={`${formatPercent(h.bookingRate)} of leads`}
          accent={COLORS.blue}
        />
        <KpiCard label="Consults Done" value={formatNumber(h.done)} accent={COLORS.violet} />
        <KpiCard
          label="Conversions"
          value={formatNumber(h.conversions)}
          sub={`${formatPercent(h.conversionRate)} conversion`}
          accent={COLORS.green}
        />
        <KpiCard label="Kit Revenue" value={formatCurrency(h.kitValue)} accent={COLORS.amber} />
      </div>

      {/* Charts */}
      <div className="grid shrink-0 grid-cols-12 gap-3" style={{ height: 230 }}>
        <Panel title="Daily Leads & Consultations" accent={COLORS.green} className="col-span-8">
          <TrendChart data={h.series} />
        </Panel>

        <Panel title="Conversion % Trend" accent={COLORS.amber} className="col-span-4">
          <ConversionChart data={h.series} />
        </Panel>
      </div>
    </div>
  );
}

function SectionTitle({ title, subtitle, accent }) {
  return (
    <div className="flex items-center gap-3">
      <span className="h-5 w-1.5 rounded-full" style={{ background: accent }} />
      <h2 className="text-xl font-bold">{title}</h2>
      <span className="text-sm text-text-faint">{subtitle}</span>
    </div>
  );
}

function TrendChart({ data }) {
  if (!data || data.length === 0) return <Empty />;
  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={data} margin={{ left: -8, right: 8, top: 6, bottom: 2 }}>
        <defs>
          <linearGradient id="leadsFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={COLORS.cyan} stopOpacity={0.35} />
            <stop offset="100%" stopColor={COLORS.cyan} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="date" tick={{ ...AXIS }} tickLine={false} axisLine={{ stroke: GRID }} interval="preserveStartEnd" minTickGap={24} />
        <YAxis tick={{ ...AXIS }} tickLine={false} axisLine={false} width={36} />
        <Tooltip {...TOOLTIP_STYLE} />
        <Area type="monotone" dataKey="leads" name="Leads" stroke={COLORS.cyan} fill="url(#leadsFill)" strokeWidth={2} />
        <Bar dataKey="booked" name="Booked" fill={COLORS.blue} barSize={10} radius={[3, 3, 0, 0]} />
        <Line type="monotone" dataKey="done" name="Done" stroke={COLORS.green} strokeWidth={2} dot={false} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

function ConversionChart({ data }) {
  if (!data || data.length === 0) return <Empty />;
  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={data} margin={{ left: -8, right: 8, top: 6, bottom: 2 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="date" tick={{ ...AXIS }} tickLine={false} axisLine={{ stroke: GRID }} interval="preserveStartEnd" minTickGap={24} />
        <YAxis tick={{ ...AXIS }} tickLine={false} axisLine={false} width={36} unit="%" />
        <Tooltip {...TOOLTIP_STYLE} formatter={(v) => `${v}%`} />
        <Line type="monotone" dataKey="convPct" name="Conversion %" stroke={COLORS.amber} strokeWidth={2} dot={{ r: 2, fill: COLORS.amber }} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

function Empty() {
  return (
    <div className="grid h-full place-items-center text-sm text-text-faint">No data</div>
  );
}
