import {
  Bar,
  BarChart,
  Cell,
  LabelList,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import KpiCard from './KpiCard';
import Panel from './Panel';
import { AXIS, COLORS, SERIES, TOOLTIP_STYLE } from './colors';
import { formatCurrency, formatNumber, formatPercent } from '../utils/dataProcessor';

export default function MensWellnessSection({ m, tab }) {
  const payment = [
    { name: 'COD', value: m.payment.cod },
    { name: 'Prepaid', value: m.payment.prepaid },
    { name: 'Partially Paid', value: m.payment.partial },
  ].filter((d) => d.value > 0);

  return (
    <div className="flex flex-col gap-3">
      <SectionTitle
        title="Men's Wellness"
        subtitle={`Orders${tab ? ` · ${tab}` : ''}`}
        accent={COLORS.cyan}
      />

      {/* KPI strip */}
      <div className="grid grid-cols-5 gap-3">
        <KpiCard label="Total Orders" value={formatNumber(m.totalOrders)} accent={COLORS.cyan} />
        <KpiCard label="Revenue" value={formatCurrency(m.revenue)} accent={COLORS.violet} />
        <KpiCard
          label="Delivered"
          value={formatNumber(m.delivered)}
          sub={`${formatPercent(m.deliveryRate)} of finalised`}
          accent={COLORS.green}
        />
        <KpiCard label="RTO" value={formatNumber(m.rto)} accent={COLORS.red} />
        <KpiCard
          label="Repeat Customers"
          value={formatNumber(m.repeat)}
          sub={`${formatPercent(m.repeatRate)} of orders`}
          accent={COLORS.amber}
        />
      </div>

      {/* Charts */}
      <div className="grid shrink-0 grid-cols-12 gap-3" style={{ height: 230 }}>
        <Panel title="Lead Source" accent={COLORS.cyan} className="col-span-4">
          <HBarChart data={m.bySource} color={COLORS.cyan} />
        </Panel>

        <Panel title="Order Status" accent={COLORS.green} className="col-span-4">
          <HBarChart data={m.byStatus} color={COLORS.green} />
        </Panel>

        <Panel title="Payment Mode" accent={COLORS.amber} className="col-span-4">
          <DonutChart data={payment} />
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

const truncate = (s, n = 16) => (String(s).length > n ? `${String(s).slice(0, n - 1)}…` : s);

function HBarChart({ data, color }) {
  if (!data || data.length === 0) return <Empty />;
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} layout="vertical" margin={{ left: 4, right: 28, top: 2, bottom: 2 }}>
        <XAxis type="number" hide />
        <YAxis
          type="category"
          dataKey="name"
          width={112}
          tick={{ ...AXIS }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) => truncate(v)}
        />
        <Tooltip {...TOOLTIP_STYLE} />
        <Bar dataKey="value" radius={[0, 6, 6, 0]} fill={color} barSize={18}>
          <LabelList dataKey="value" position="right" fill="#e8edf7" fontSize={13} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function DonutChart({ data }) {
  if (!data || data.length === 0) return <Empty />;
  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          innerRadius="48%"
          outerRadius="78%"
          paddingAngle={2}
          stroke="none"
        >
          {data.map((_, i) => (
            <Cell key={i} fill={SERIES[i % SERIES.length]} />
          ))}
        </Pie>
        <Tooltip {...TOOLTIP_STYLE} />
        <Legend
          verticalAlign="bottom"
          iconType="circle"
          formatter={(value, entry) => (
            <span style={{ color: '#e8edf7', fontSize: 13 }}>
              {value} · {entry?.payload?.value}
            </span>
          )}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

function Empty() {
  return <div className="grid h-full place-items-center text-sm text-text-faint">No data</div>;
}
