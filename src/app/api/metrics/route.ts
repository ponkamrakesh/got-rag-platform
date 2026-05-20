import { NextResponse } from 'next/server'
import { index } from '@/lib/pinecone'
import { safeKvGet, safeKvLrange } from '@/lib/kv'

export const maxDuration = 30

export async function GET() {
  try {
    // 1. Pinecone vector stats
    const stats = await index.describeIndexStats()
    const totalVectors =
      stats.namespaces?.['']?.recordCount ||
      stats.totalRecordCount ||
      0

    // 2. Operational metrics from KV (real-time query logs)
    const opsSummary = await safeKvGet<{
      totalQueries: number
      avgLatencyMs: number
      lastQueryAt: number
      lastQuery: string
    }>('citadel:ops:summary')

    const rawQueryLogs = await safeKvLrange<any>('citadel:ops:queries', 0, 49)
    // Handle both auto-parsed objects (Upstash) and raw strings
    const queryLogs = rawQueryLogs
      .map((s) => {
        if (typeof s === 'string') {
          try {
            return JSON.parse(s)
          } catch {
            return null
          }
        }
        if (s && typeof s === 'object') return s
        return null
      })
      .filter(Boolean)

    // 3. Synthetic eval results from KV
    const evalData = await safeKvGet<any>('citadel:eval:latest')

    // 4. Compute live rolling stats from last 24h of query logs
    const now = Date.now()
    const dayAgo = now - 24 * 60 * 60 * 1000
    const todayLogs = queryLogs.filter((l: any) => l.t && l.t > dayAgo)
    const todayCount = todayLogs.length
    const todayAvgLat =
      todayCount > 0
        ? Math.round(todayLogs.reduce((a: number, l: any) => a + (l.l || 0), 0) / todayCount)
        : 0

    return NextResponse.json({
      totalVectors,
      ops: {
        totalQueriesAllTime: opsSummary?.totalQueries || 0,
        totalQueries24h: todayCount,
        avgLatencyMs: opsSummary?.avgLatencyMs || 0,
        avgLatency24hMs: todayAvgLat,
        lastQueryAt: opsSummary?.lastQueryAt || null,
        lastQuery: opsSummary?.lastQuery || null,
        recentQueries: queryLogs.slice(0, 10),
      },
      eval: evalData || null,
    })
  } catch (err: any) {
    console.error('Metrics error:', err)
    return NextResponse.json(
      { error: err.message || 'Internal error' },
      { status: 500 }
    )
  }
}
