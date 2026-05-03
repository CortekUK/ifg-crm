'use client'

// Inline chart renderer for Scout replies. The model emits a fenced code block
// with `language=scout-chart` containing a JSON spec; ScoutMarkdown intercepts
// it and mounts this component.
//
// Spec (kept narrow on purpose so the model can learn it without ambiguity):
//
//   {
//     "type": "bar" | "line" | "area" | "pie",
//     "title": "Optional title shown above the chart",
//     "data": [{ ... }, ...],
//     "xKey": "month",            // bar / line / area: category axis column
//     "series": ["2024", "2025"], // bar / line / area: numeric columns to plot
//     "nameKey": "stage",         // pie only: text column for slice label
//     "yKey": "count"             // pie only: numeric column for slice value
//   }
//
// We render with Recharts (already in the project for the /analytics page).
// ResponsiveContainer fills the bubble width; height is fixed so the chart
// reads as a media block rather than collapsing.

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Area,
  AreaChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

export interface ScoutChartSpec {
  type: 'bar' | 'line' | 'area' | 'pie'
  title?: string
  data: Record<string, string | number>[]
  xKey?: string
  series?: string[]
  nameKey?: string
  yKey?: string
}

// Restrained palette in the violet/indigo family with a few contrast accents.
// Order matters: the first colour gets the most weight (primary series).
const PALETTE = [
  '#8b5cf6', // violet-500
  '#ec4899', // pink-500
  '#6366f1', // indigo-500
  '#22d3ee', // cyan-400
  '#f59e0b', // amber-500
  '#10b981', // emerald-500
  '#ef4444', // red-500
  '#a855f7', // purple-500
]

// Try to parse the fenced block contents as a ChartSpec. Returns null on any
// failure so the markdown renderer can fall back to displaying the raw block.
export function parseChartSpec(raw: string): ScoutChartSpec | null {
  try {
    const obj = JSON.parse(raw) as Partial<ScoutChartSpec>
    if (!obj || typeof obj !== 'object') return null
    if (!obj.type || !['bar', 'line', 'area', 'pie'].includes(obj.type)) return null
    if (!Array.isArray(obj.data) || obj.data.length === 0) return null
    return obj as ScoutChartSpec
  } catch {
    return null
  }
}

export function ScoutChart({ spec }: { spec: ScoutChartSpec }) {
  return (
    <figure className="mb-3 mt-1 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700/60 dark:bg-slate-900/60">
      {spec.title && (
        <figcaption className="mb-2 px-1 text-[12px] font-semibold text-slate-700 dark:text-slate-200">
          {spec.title}
        </figcaption>
      )}
      <div className="h-60 w-full">
        <ResponsiveContainer width="100%" height="100%">
          {renderChart(spec)}
        </ResponsiveContainer>
      </div>
    </figure>
  )
}

function renderChart(spec: ScoutChartSpec) {
  const tickStyle = { fontSize: 11, fill: 'currentColor' }
  const tooltipStyle = {
    backgroundColor: 'rgba(15,23,42,0.95)',
    border: 'none',
    borderRadius: 8,
    color: 'white',
    fontSize: 12,
  }

  if (spec.type === 'pie') {
    const nameKey = spec.nameKey ?? 'name'
    const dataKey = spec.yKey ?? 'value'
    return (
      <PieChart>
        <Pie
          data={spec.data}
          dataKey={dataKey}
          nameKey={nameKey}
          innerRadius={50}
          outerRadius={88}
          paddingAngle={2}
        >
          {spec.data.map((_, i) => (
            <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
          ))}
        </Pie>
        <Tooltip contentStyle={tooltipStyle} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
      </PieChart>
    )
  }

  const xKey = spec.xKey ?? 'name'
  const series = spec.series ?? []

  if (spec.type === 'line') {
    return (
      <LineChart data={spec.data} margin={{ top: 5, right: 8, bottom: 0, left: -10 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-slate-700" />
        <XAxis dataKey={xKey} tick={tickStyle} stroke="currentColor" className="text-slate-400" />
        <YAxis tick={tickStyle} stroke="currentColor" className="text-slate-400" />
        <Tooltip contentStyle={tooltipStyle} />
        {series.length > 1 && <Legend wrapperStyle={{ fontSize: 11 }} />}
        {series.map((k, i) => (
          <Line
            key={k}
            type="monotone"
            dataKey={k}
            stroke={PALETTE[i % PALETTE.length]}
            strokeWidth={2}
            dot={{ r: 3 }}
            activeDot={{ r: 5 }}
          />
        ))}
      </LineChart>
    )
  }

  if (spec.type === 'area') {
    return (
      <AreaChart data={spec.data} margin={{ top: 5, right: 8, bottom: 0, left: -10 }}>
        <defs>
          {series.map((k, i) => (
            <linearGradient key={k} id={`scout-area-${i}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={PALETTE[i % PALETTE.length]} stopOpacity={0.45} />
              <stop offset="100%" stopColor={PALETTE[i % PALETTE.length]} stopOpacity={0.04} />
            </linearGradient>
          ))}
        </defs>
        <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-slate-700" />
        <XAxis dataKey={xKey} tick={tickStyle} stroke="currentColor" className="text-slate-400" />
        <YAxis tick={tickStyle} stroke="currentColor" className="text-slate-400" />
        <Tooltip contentStyle={tooltipStyle} />
        {series.length > 1 && <Legend wrapperStyle={{ fontSize: 11 }} />}
        {series.map((k, i) => (
          <Area
            key={k}
            type="monotone"
            dataKey={k}
            stroke={PALETTE[i % PALETTE.length]}
            strokeWidth={2}
            fill={`url(#scout-area-${i})`}
          />
        ))}
      </AreaChart>
    )
  }

  // bar (default)
  return (
    <BarChart data={spec.data} margin={{ top: 5, right: 8, bottom: 0, left: -10 }}>
      <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-slate-700" />
      <XAxis dataKey={xKey} tick={tickStyle} stroke="currentColor" className="text-slate-400" />
      <YAxis tick={tickStyle} stroke="currentColor" className="text-slate-400" />
      <Tooltip contentStyle={tooltipStyle} />
      {series.length > 1 && <Legend wrapperStyle={{ fontSize: 11 }} />}
      {series.map((k, i) => (
        <Bar
          key={k}
          dataKey={k}
          fill={PALETTE[i % PALETTE.length]}
          radius={[6, 6, 0, 0]}
        />
      ))}
    </BarChart>
  )
}
