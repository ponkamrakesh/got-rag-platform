import { NextResponse } from 'next/server'
import { index } from '@/lib/pinecone'

export async function GET() {
  const checks: Record<string, any> = {
    has_groq_key: !!process.env.GROQ_API_KEY,
    has_pinecone_key: !!process.env.PINECONE_API_KEY,
    pinecone_key_prefix: process.env.PINECONE_API_KEY?.slice(0, 8) || 'MISSING',
    pinecone_index_name: process.env.PINECONE_INDEX_NAME,
    node_env: process.env.NODE_ENV,
  }

  // Test Pinecone Native Embedding API connectivity with a dummy text
  try {
    const embedRes = await fetch('https://pinecone.io/embed', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Api-Key': process.env.PINECONE_API_KEY || '',
      },
      body: JSON.stringify({
        model: 'llama-text-embed-v2',
        parameters: {
          input_type: 'query',
        },
        inputs: [{ text: 'test' }],
      }),
    })

    if (!embedRes.ok) {
      const txt = await embedRes.text()
      throw new Error(`HTTP ${embedRes.status}: ${txt.slice(0, 150)}`)
    }

    const embedData = await embedRes.json()
    const embedding = embedData.data?.[0]?.values

    if (embedding && Array.isArray(embedding)) {
      checks.pinecone_embed_status = 'OK'
      checks.pinecone_embed_dim = embedding.length
    } else {
      checks.pinecone_embed_status = 'FAILED'
      checks.pinecone_embed_error = 'Invalid or missing data payload format'
    }
  } catch (err: any) {
    checks.pinecone_embed_status = 'FAILED'
    checks.pinecone_embed_error = err.message
  }

  // Test Pinecone Database Index connectivity
  try {
    const stats = await index.describeIndexStats()
    checks.pinecone_db_status = 'OK'
    checks.total_vectors = stats.totalRecordCount || 0
  } catch (err: any) {
    checks.pinecone_db_status = 'FAILED'
    checks.pinecone_db_error = err.message
  }

  return NextResponse.json(checks)
}
