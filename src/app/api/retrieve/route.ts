
import { NextRequest, NextResponse } from 'next/server'

import { index } from '@/lib/pinecone'
import {
  safeKvLpush,
  safeKvSet,
  safeKvLrange,
} from '@/lib/kv'

export const runtime = 'nodejs'
export const maxDuration = 60

const PINECONE_EMBED_URL = 'https://api.pinecone.io/embed'
const EMBEDDING_MODEL = 'llama-text-embed-v2'

export async function POST(req: NextRequest) {
  const t0 = Date.now()

  try {
    // 1. Validate request
    const body = await req.json()

    const {
      query,
      topK = 8,
      bookFilter,
    } = body

    if (!query || typeof query !== 'string' || !query.trim()) {
      return NextResponse.json(
        { error: 'A valid query is required' },
        { status: 400 }
      )
    }

    const normalizedTopK = Math.min(
      Math.max(Number(topK) || 8, 1),
      100
    )

    // 2. Validate Pinecone API key
    const apiKey = process.env.PINECONE_API_KEY

    if (!apiKey) {
      console.error('PINECONE_API_KEY is not configured')

      return NextResponse.json(
        { error: 'Server misconfiguration: Pinecone API key missing' },
        { status: 500 }
      )
    }

    // 3. Generate query embedding using Pinecone Inference
    const pineconeEmbedRes = await fetch(
      PINECONE_EMBED_URL,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'Api-Key': apiKey,
          'X-Pinecone-Api-Version': '2025-04',
        },
        body: JSON.stringify({
          model: EMBEDDING_MODEL,
          parameters: {
            input_type: 'query',
          },
          inputs: [
            {
              text: query.trim(),
            },
          ],
        }),
      }
    )

    // 4. Handle embedding API errors
    if (!pineconeEmbedRes.ok) {
      const errText = await pineconeEmbedRes.text()

      console.error(
        'Pinecone embedding error:',
        pineconeEmbedRes.status,
        errText.slice(0, 500)
      )

      return NextResponse.json(
        {
          error: 'Pinecone embedding service failed',
          status: pineconeEmbedRes.status,
          details: errText.slice(0, 300),
        },
        { status: 502 }
      )
    }

    // 5. Validate embedding response
    const pineconeEmbedData = await pineconeEmbedRes.json()

    const vector: number[] | undefined =
      pineconeEmbedData.data?.[0]?.values

    if (
      !Array.isArray(vector) ||
      vector.length === 0 ||
      !vector.every(
        (value: unknown) =>
          typeof value === 'number' &&
          Number.isFinite(value)
      )
    ) {
      console.error(
        'Invalid Pinecone embedding response:',
        JSON.stringify(pineconeEmbedData).slice(0, 500)
      )

      return NextResponse.json(
        { error: 'Invalid embedding vector returned by Pinecone' },
        { status: 502 }
      )
    }

    // 6. Prepare metadata filter
    const filter: Record<string, any> = {}

    if (bookFilter && typeof bookFilter === 'string') {
      filter.book = {
        $eq: bookFilter,
      }
    }

    // 7. Query existing Pinecone index
    const results = await index.query({
      vector,
      topK: normalizedTopK,
      includeMetadata: true,
      filter: Object.keys(filter).length
        ? filter
        : undefined,
    })

    // 8. Extract retrieved chunks
    const chunks = (results.matches || []).map((match: any) => ({
  id: match.id,
  score: match.score,
  ...(match.metadata || {}),
}))

    const latencyMs = Date.now() - t0

    // 9. Log operational metrics
    const logEntry = {
      t: Date.now(),
      q: query.trim().slice(0, 120),
      k: normalizedTopK,
      c: chunks.length,
      l: latencyMs,
    }

    try {
      await safeKvLpush(
        'citadel:ops:queries',
        logEntry,
        200
      )

      // 10. Calculate rolling operational summary
      const recentLogs =
        await safeKvLrange<typeof logEntry>(
          'citadel:ops:queries',
          0,
          99
        )

      const total = recentLogs.length

      const avgLat =
        total > 0
          ? Math.round(
              recentLogs.reduce(
                (sum, item) => sum + (item.l || 0),
                0
              ) / total
            )
          : 0

      await safeKvSet(
        'citadel:ops:summary',
        {
          totalQueries: total,
          avgLatencyMs: avgLat,
          lastQueryAt: Date.now(),
          lastQuery: query.trim().slice(0, 120),
        }
      )
    } catch (metricsError) {
      // Metrics failure should not break retrieval
      console.error(
        'Operational metrics logging failed:',
        metricsError
      )
    }

    // 11. Return successful response
    return NextResponse.json({
      success: true,
      chunks,
      totalChunks: chunks.length,
      latencyMs,
    })

  } catch (err: unknown) {
    console.error('Retrieve API error:', err)

    const message =
      err instanceof Error
        ? err.message
        : 'Internal server error'

    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      { status: 500 }
    )
  }
}
