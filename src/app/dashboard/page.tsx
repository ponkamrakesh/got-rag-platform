'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  Database,
  Clock,
  Shield,
  Target,
  Crosshair,
  Scroll,
} from 'lucide-react'
import {
  ResponsiveContainer,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
} from 'recharts'

type EvalDetail = {
  question: string
  answer: string
  ground_truth: string
  faithfulness: number
  relevancy: number
  context_precision: number
  context_recall: number
  latency_seconds: number
  books_hit: string[]
}

type MetricsPayload = {
  totalVectors: number
  eval?: {
    run_date: string
    total_questions: number
    avg_faithfulness: number
    avg_relevancy: number
    avg_context_precision: number
    avg_context_recall: number
    avg_latency_seconds: number
    details: EvalDetail[]
  }
}

const COLORS = ['#c0392b', '#f39c12', '#74b9ff', '#a29bfe']

export default function DashboardPage() {
  const [data, setData] = useState<MetricsPayload | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/metrics')
      .then((r) => {
        if (!r.ok) throw new Error('Failed to load metrics')
        return r.json()
      })
      .then((d) => setData(d))
      .catch((e) => setError(e.message))
  }, [])

  if (error) {
    return (
      <div className="min-h-screen bg-iron-900 p-6 text-fire-400">
        Error loading metrics: {error}
      </div>
    )
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-iron-900 p-10 text-zinc-400 flex items-center gap-3">
        <div className="w-5 h-5 border-2 border-zinc-500 border-t-transparent rounded-full animate-spin" />
        Loading Citadel archives...
      </div>
    )
  }

  const ev = data.eval

  const overallRadar = ev
    ? [
        { metric: 'Faithfulness', score: ev.avg_faithfulness, fullMark: 1 },
        { metric: 'Relevancy', score: ev.avg_relevancy, fullMark: 1 },
        { metric: 'Precision', score: ev.avg_context_precision, fullMark: 1 },
        { metric: 'Recall', score: ev.avg_context_recall, fullMark: 1 },
      ]
    : []

  const perQuestion =
    ev?.details.map((d, i) => ({
      name: `Q${i + 1}`,
      faith: d.faithfulness,
      relev: d.relevancy,
      prec: d.context_precision,
      rec: d.context_recall,
    })) || []

  const latencyData =
    ev?.details.map((d, i) => ({
      name: `Q${i + 1}`,
      latency: Number((d.latency_seconds).toFixed(2)),
    })) || []

  return (
    <div className="min-h-screen bg-iron-900 text-zinc-100 p-4 md:p-8">
      {/* Header */}
      <header className="flex items-center gap-4 mb-8 md:mb-10">
        <Link
          href="/"
          className="text-zinc-400 hover:text-zinc-100 transition p-2 rounded-md hover:bg-iron-700"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-xl md:text-2xl font-serif font-bold text-zinc-100 tracking-wide">
            Citadel Metrics
          </h1>
          <p className="text-xs md:text-sm text-zinc-500 mt-0.5">
            RAG Evaluation &amp; Retrieval Analytics
          </p>
        </div>
      </header>

      {/* Metric cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-8">
        <MetricCard
          icon={<Database className="w-5 h-5" />}
          label="Total Chunks"
          value={data.totalVectors.toLocaleString()}
          accent="text-ice-400"
        />
        <MetricCard
          icon={<Clock className="w-5 h-5" />}
          label="Avg Latency"
          value={ev ? `${ev.avg_latency_seconds.toFixed(2)}s` : 'N/A'}
          accent="text-fire-300"
        />
        <MetricCard
          icon={<Shield className="w-5 h-5" />}
          label="Faithfulness"
          value={ev ? `${(ev.avg_faithfulness * 100).toFixed(0)}%` : 'N/A'}
          accent="text-emerald-400"
        />
        <MetricCard
          icon={<Target className="w-5 h-5" />}
          label="Relevancy"
          value={ev ? `${(ev.avg_relevancy * 100).toFixed(0)}%` : 'N/A'}
          accent="text-ice-400"
        />
      </div>

      {ev && (
        <>
          {/* Charts row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6 mb-8">
            {/* Radar */}
            <div className="bg-iron-800 border border-iron-600 rounded-lg p-4 md:p-5">
              <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-400 mb-4 flex items-center gap-2">
                <Crosshair className="w-4 h-4" />
                Quality Radar
              </h3>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={overallRadar}>
                    <PolarGrid stroke="#3f3f46" />
                    <PolarAngleAxis
                      dataKey="metric"
                      tick={{ fill: '#a1a1aa', fontSize: 11 }}
                    />
                    <PolarRadiusAxis
                      angle={30}
                      domain={[0, 1]}
                      tick={{ fill: '#71717a', fontSize: 10 }}
                    />
                    <Radar
                      name="RAG Scores"
                      dataKey="score"
                      stroke="#e74c3c"
                      fill="#e74c3c"
                      fillOpacity={0.25}
                    />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Per-question bar */}
            <div className="bg-iron-800 border border-iron-600 rounded-lg p-4 md:p-5 lg:col-span-2">
              <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-400 mb-4 flex items-center gap-2">
                <Scroll className="w-4 h-4" />
                Per-Question Scores
              </h3>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={perQuestion}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                    <XAxis
                      dataKey="name"
                      tick={{ fill: '#71717a', fontSize: 11 }}
                    />
                    <YAxis
                      domain={[0, 1]}
                      tick={{ fill: '#71717a', fontSize: 11 }}
                    />
                    <Tooltip
                      contentStyle={{
                        background: '#1c1c1f',
                        borderColor: '#3f3f46',
                        color: '#e4e4e7',
                        fontSize: 12,
                      }}
                    />
                    <Bar dataKey="faith" fill={COLORS[0]} name="Faithfulness" />
                    <Bar dataKey="relev" fill={COLORS[1]} name="Relevancy" />
                    <Bar dataKey="prec" fill={COLORS[2]} name="Precision" />
                    <Bar dataKey="rec" fill={COLORS[3]} name="Recall" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Latency chart */}
          <div className="bg-iron-800 border border-iron-600 rounded-lg p-4 md:p-5 mb-8">
            <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-400 mb-4 flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Query Latency Distribution
            </h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={latencyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                  <XAxis dataKey="name" tick={{ fill: '#71717a', fontSize: 11 }} />
                  <YAxis
                    tick={{ fill: '#71717a', fontSize: 11 }}
                    label={{
                      value: 'Seconds',
                      angle: -90,
                      position: 'insideLeft',
                      fill: '#71717a',
                      fontSize: 11,
                    }}
                  />
                  <Tooltip
                    contentStyle={{
                      background: '#1c1c1f',
                      borderColor: '#3f3f46',
                      color: '#e4e4e7',
                      fontSize: 12,
                    }}
                  />
                  <Bar dataKey="latency" fill="#f39c12" radius={[4, 4, 0, 0]}>
                    {latencyData.map((_, i) => (
                      <Cell
                        key={`cell-${i}`}
                        fill={
                          latencyData[i].latency > 3
                            ? '#c0392b'
                            : '#f39c12'
                        }
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Eval detail table */}
          <div className="bg-iron-800 border border-iron-600 rounded-lg overflow-hidden">
            <div className="px-4 md:px-5 py-3 border-b border-iron-600 bg-iron-700/50 flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-400">
                Evaluation Log
              </h3>
              <span className="text-[10px] text-zinc-500">
                Run: {ev.run_date}
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs md:text-sm">
                <thead className="bg-iron-700/40 text-zinc-400 text-left">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Question</th>
                    <th className="px-4 py-3 font-semibold text-center">Faith</th>
                    <th className="px-4 py-3 font-semibold text-center">Rel</th>
                    <th className="px-4 py-3 font-semibold text-center">Prec</th>
                    <th className="px-4 py-3 font-semibold text-center">Rec</th>
                    <th className="px-4 py-3 font-semibold text-center">Latency</th>
                    <th className="px-4 py-3 font-semibold">Books Retrieved</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-iron-600">
                  {ev.details.map((d, i) => (
                    <tr key={i} className="hover:bg-iron-700/30 transition">
                      <td className="px-4 py-3 text-zinc-300 max-w-xs truncate">
                        {d.question}
                      </td>
                      <td className="px-4 py-3 text-center text-zinc-300">
                        {d.faithfulness.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-center text-zinc-300">
                        {d.relevancy.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-center text-zinc-300">
                        {d.context_precision.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-center text-zinc-300">
                        {d.context_recall.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-center text-zinc-300">
                        {d.latency_seconds.toFixed(2)}s
                      </td>
                      <td className="px-4 py-3 text-zinc-400 max-w-xs truncate">
                        {d.books_hit.join(', ')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {!ev && (
        <div className="bg-iron-800 border border-iron-600 rounded-lg p-6 text-center text-zinc-400">
          <Scroll className="w-8 h-8 mx-auto mb-3 opacity-50" />
          <p className="text-sm">
            No evaluation results found. Run{' '}
            <code className="bg-iron-700 px-1.5 py-0.5 rounded text-fire-300 text-xs">
              python scripts/run_eval.py
            </code>{' '}
            locally and commit <code className="text-zinc-300">eval/results.json</code> to populate this dashboard.
          </p>
        </div>
      )}
    </div>
  )
}

function MetricCard({
  icon,
  label,
  value,
  accent,
}: {
  icon: React.ReactNode
  label: string
  value: string
  accent: string
}) {
  return (
    <div className="bg-iron-800 border border-iron-600 rounded-lg p-4 md:p-5 flex items-center gap-3 md:gap-4 hover:border-zinc-500 transition">
      <div className={`${accent}`}>{icon}</div>
      <div>
        <div className="text-[10px] md:text-xs text-zinc-500 uppercase tracking-wider font-semibold">
          {label}
        </div>
        <div className="text-lg md:text-xl font-bold text-zinc-100 mt-0.5">
          {value}
        </div>
      </div>
    </div>
  )
}
