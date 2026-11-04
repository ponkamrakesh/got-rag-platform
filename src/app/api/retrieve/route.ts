import { NextRequest, NextResponse } from 'next/server'
import { index } from '@/lib/pinecone'
import { safeKvLpush, safeKvSet, safeKvLrange } from '@/lib/kv'

export const maxDuration = 60

// Correct Pinecone Inference Endpoint URL
const PINECONE_EMBED_URL = 'https://api.pinecone.io/embed'
const TOP_K = 4

export async function POST(req: NextRequest) {
  const t0 = Date.now()
  try {
    const { query, topK = 8, bookFilter } = await req.json()
    if (!query || typeof query !== 'string') {
      return NextResponse.json({ error: 'Missing query' }, { status: 400 })
    }

    if (!process.env.PINECONE_API_KEY) {
      console.error('❌ PINECONE_API_KEY is not set on Vercel')
      return NextResponse.json(
        { error: 'Server misconfiguration: PINECONE_API_KEY missing' },
        { status: 500 }
      )
    }

    // === PINECONE NATIVE EMBEDDING via raw fetch ===
    const pineconeEmbedRes = await fetch(PINECONE_EMBED_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Api-Key': process.env.PINECONE_API_KEY,
        'X-Pinecone-Api-Version': '2025-04', // Required for hosted inference version routing
      },
      body: JSON.stringify({
        model: 'llama-text-embed-v2',
        parameters: {
          input_type: 'query'
        },
        inputs: [{ text: query }],
      }),
    })

    if (!pineconeEmbedRes.ok) {
      const errText = await pineconeEmbedRes.text()
      console.error('Pinecone embedding error:', pineconeEmbedRes.status, errText)
      return NextResponse.json(
        { error: `Pinecone embedding failed: ${pineconeEmbedRes.status} ${errText.slice(0, 200)}` },
        { status: 502 }
      )
    }

    const pineconeEmbedData = await pineconeEmbedRes.json()
    const vector: number[] = pineconeEmbedData.data?.[0]?.values

    if (!vector || !Array.isArray(vector)) {
      console.error('Pinecone returned invalid embedding format:', JSON.stringify(pineconeEmbedData).slice(0, 500))
      return NextResponse.json(
        { error: 'Pinecone returned invalid embedding format or values structure' },
        { status: 502 }
      )
    }

    // === PINECONE RETRIEVAL ===
    const filter: Record<string, any> = {}
    if (bookFilter) {
      filter.book = { $eq: bookFilter }
    }

    const results = await index.query({
      vector,
      topK,
      includeMetadata: true,
      filter: Object.keys(filter).length ? filter : undefined,
    })

    const chunks = (results.matches || []).map((m: any) => m.metadata)
    const latencyMs = Date.now() - t0

    // === LIVE OPERATIONAL METRICS LOGGING ===
    const logEntry = {
      t: Date.now(),
      q: query.slice(0, 120),
      k: topK,
      c: chunks.length,
      l: latencyMs,
    }
    // @upstash/redis auto-serializes objects
    await safeKvLpush('citadel:ops:queries', logEntry, 200)

    // Update rolling summary from last 100 log entries
    const recentLogs = await safeKvLrange<typeof logEntry>('citadel:ops:queries', 0, 99)
    const total = recentLogs.length
    const avgLat = total > 0
      ? Math.round(recentLogs.reduce((a, b) => a + (b.l || 0), 0) / total)
      : 0

    await safeKvSet('citadel:ops:summary', {
      totalQueries: total,
      avgLatencyMs: avgLat,
      lastQueryAt: Date.now(),
      lastQuery: query.slice(0, 120),
    })

    return NextResponse.json({ chunks, latencyMs })
  } catch (err: any) {
    console.error('Retrieve error:', err)
    return NextResponse.json(
      { error: err.message || 'Internal error' },
      { status: 500 }
    )
  }
}
