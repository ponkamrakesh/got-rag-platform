import { NextResponse } from 'next/server'
import { index } from '@/lib/pinecone'
import fs from 'fs'
import path from 'path'

export const maxDuration = 30

export async function GET() {
  try {
    const stats = await index.describeIndexStats()
    const totalVectors =
      stats.namespaces?.['']?.recordCount ||
      stats.totalRecordCount ||
      0

    let evalData = null
    try {
      const evalPath = path.join(process.cwd(), 'eval', 'results.json')
      if (fs.existsSync(evalPath)) {
        const raw = fs.readFileSync(evalPath, 'utf-8')
        evalData = JSON.parse(raw)
      }
    } catch (e) {
      // no eval results yet
    }

    return NextResponse.json({
      totalVectors,
      eval: evalData,
    })
  } catch (err: any) {
    console.error('Metrics error:', err)
    return NextResponse.json(
      { error: err.message || 'Internal error' },
      { status: 500 }
    )
  }
}
