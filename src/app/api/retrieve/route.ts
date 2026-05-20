import { NextRequest, NextResponse } from 'next/server'
import { jina } from '@/lib/clients'
import { index } from '@/lib/pinecone'

export const maxDuration = 60

export async function POST(req: NextRequest) {
  try {
    const { query, topK = 8, bookFilter } = await req.json()
    if (!query || typeof query !== 'string') {
      return NextResponse.json({ error: 'Missing query' }, { status: 400 })
    }

    // Embed via Jina AI (free tier, OpenAI-compatible)
    const embedRes = await jina.embeddings.create({
      input: query,
      model: 'jina-embeddings-v3-base',
    })
    const vector = embedRes.data[0].embedding

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
    return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 })
  }
}
