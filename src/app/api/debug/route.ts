import { NextResponse } from 'next/server'
import { jina } from '@/lib/clients'
import { index } from '@/lib/pinecone'

export async function GET() {
  const checks: Record<string, any> = {
    has_jina_key: !!process.env.JINA_API_KEY,
    jina_key_prefix: process.env.JINA_API_KEY?.slice(0, 8) || 'MISSING',
    has_groq_key: !!process.env.GROQ_API_KEY,
    has_pinecone_key: !!process.env.PINECONE_API_KEY,
    pinecone_index_name: process.env.PINECONE_INDEX_NAME,
    node_env: process.env.NODE_ENV,
  }

  // Test Jina connectivity with a dummy embedding
  try {
    const test = await jina.embeddings.create({
      input: ['test'],
      model: 'jina-embeddings-v3',
    })
    checks.jina_status = 'OK'
    checks.jina_dim = test.data[0].embedding.length
  } catch (err: any) {
    checks.jina_status = 'FAILED'
    checks.jina_error = err.message
    checks.jina_status_code = err.status || err.statusCode || 'unknown'
  }

  // Test Pinecone connectivity
  try {
    const stats = await index.describeIndexStats()
    checks.pinecone_status = 'OK'
    checks.total_vectors = stats.totalRecordCount || 0
  } catch (err: any) {
    checks.pinecone_status = 'FAILED'
    checks.pinecone_error = err.message
  }

  return NextResponse.json(checks)
}
