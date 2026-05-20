import { NextRequest, NextResponse } from 'next/server'
import { index } from '@/lib/pinecone'

export const maxDuration = 60

export async function POST(req: NextRequest) {
  try {
    const { query, topK = 8, bookFilter } = await req.json()
    if (!query || typeof query !== 'string') {
      return NextResponse.json({ error: 'Missing query' }, { status: 400 })
    }

    if (!process.env.JINA_API_KEY) {
      console.error('❌ JINA_API_KEY is not set on Vercel')
      return NextResponse.json(
        { error: 'Server misconfiguration: JINA_API_KEY missing' },
        { status: 500 }
      )
    }

    // === JINA EMBEDDING via raw fetch (bypass OpenAI SDK quirks) ===
    const jinaRes = await fetch('https://api.jina.ai/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.JINA_API_KEY}`,
      },
      body: JSON.stringify({
        input: [query],
        model: 'jina-embeddings-v3',
      }),
    })

    if (!jinaRes.ok) {
      const errText = await jinaRes.text()
      console.error('Jina embedding error:', jinaRes.status, errText)
      return NextResponse.json(
        { error: `Jina embedding failed: ${jinaRes.status} ${errText.slice(0, 200)}` },
        { status: 502 }
      )
    }

    const jinaData = await jinaRes.json()
    const vector: number[] = jinaData.data?.[0]?.embedding

    if (!vector || !Array.isArray(vector)) {
      console.error('Jina returned invalid embedding format:', JSON.stringify(jinaData).slice(0, 500))
      return NextResponse.json(
        { error: 'Jina returned invalid embedding format' },
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
    return NextResponse.json({ chunks })

  } catch (err: any) {
    console.error('Retrieve error:', err)
    return NextResponse.json(
      { error: err.message || 'Internal error' },
      { status: 500 }
    )
  }
}
