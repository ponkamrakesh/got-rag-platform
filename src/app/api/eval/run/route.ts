import { NextRequest, NextResponse } from 'next/server'
import { readFileSync } from 'fs'
import { join } from 'path'
import { index } from '@/lib/pinecone'
import { safeKvGet, safeKvSet } from '@/lib/kv'

export const maxDuration = 60

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'
const JINA_URL = 'https://api.jina.ai/v1/embeddings'
const TOP_K = 4
const GROQ_SLEEP_MS = 2500

interface EvalItem {
  question: string
  ground_truth: string
  expected_books: string[]
  difficulty: string
}

async function groqChat(
  messages: { role: string; content: string }[],
  max_tokens = 500,
  temperature = 0.2
): Promise<string> {
  if (!process.env.GROQ_API_KEY) throw new Error('GROQ_API_KEY missing')

  const body = {
    model: 'llama-3.1-8b-instant',
    messages,
    temperature,
    max_tokens,
  }

  for (let attempt = 1; attempt <= 3; attempt++) {
    const res = await fetch(GROQ_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify(body),
    })

    if (res.status === 429) {
      const delay = Math.min(2000 * 2 ** (attempt - 1), 30000)
      console.warn(`Groq 429 eval attempt ${attempt}, sleep ${delay}ms`)
      await new Promise((r) => setTimeout(r, delay))
      continue
    }

    if (!res.ok) {
      const txt = await res.text()
      throw new Error(`Groq ${res.status}: ${txt.slice(0, 200)}`)
    }

    const data = await res.json()
    const content = data.choices?.[0]?.message?.content?.trim() || ''
    await new Promise((r) => setTimeout(r, GROQ_SLEEP_MS))
    return content
  }
  throw new Error('Groq rate limit exceeded after retries')
}

async function jinaEmbed(text: string): Promise<number[]> {
  if (!process.env.JINA_API_KEY) throw new Error('JINA_API_KEY missing')
  const res = await fetch(JINA_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.JINA_API_KEY}`,
    },
    body: JSON.stringify({ input: [text], model: 'jina-embeddings-v3' }),
  })
  if (!res.ok) {
    const txt = await res.text()
    throw new Error(`Jina ${res.status}: ${txt.slice(0, 200)}`)
  }
  const data = await res.json()
  return data.data?.[0]?.embedding
}

async function retrieve(query: string) {
  const vector = await jinaEmbed(query)
  const results = await index.query({
    vector,
    topK: TOP_K,
    includeMetadata: true,
  })
  return (results.matches || []).map((m: any) => m.metadata)
}

async function generateAnswer(question: string, contexts: string[]) {
  const ctx = contexts.map((c, i) => `[${i + 1}] ${c.slice(0, 500)}`).join('\n---\n')
  const prompt =
    `You are the Maester. Use ONLY the context. Answer concisely.\n\n` +
    `Context:\n${ctx}\n\nQuestion: ${question}\nAnswer:`
  return groqChat([{ role: 'user', content: prompt }], 400, 0.2)
}

async function judge(metric: string, question: string, answer: string, contexts: string[], groundTruth: string) {
  const ctx = contexts.map((c) => c.slice(0, 500)).join('\n').slice(0, 2500)
  const rubrics: Record<string, string> = {
    faithfulness: `Rate whether the ANSWER is fully supported by the CONTEXT.\nContext:\n${ctx}\n\nAnswer: ${answer}\n\nReturn ONLY 0.0-1.0.`,
    relevancy: `Rate how well the ANSWER addresses the QUESTION.\nQuestion: ${question}\n\nAnswer: ${answer}\n\nReturn ONLY 0.0-1.0.`,
    precision: `Rate what fraction of CONTEXT sentences are relevant to the QUESTION.\nQuestion: ${question}\n\nContext:\n${ctx}\n\nReturn ONLY 0.0-1.0.`,
    recall: `Rate what fraction of GROUND TRUTH appears in CONTEXT.\nGround Truth: ${groundTruth}\n\nContext:\n${ctx}\n\nReturn ONLY 0.0-1.0.`,
  }
  const raw = await groqChat([{ role: 'user', content: rubrics[metric] }], 10, 0.0)
  const val = parseFloat(raw.split(/\s/)[0])
  return Number.isFinite(val) ? Math.max(0, Math.min(1, val)) : 0.5
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const idx = parseInt(searchParams.get('index') || '0', 10)

    const datasetPath = join(process.cwd(), 'eval', 'eval_dataset.json')
    const dataset: EvalItem[] = JSON.parse(readFileSync(datasetPath, 'utf-8'))

    if (idx < 0 || idx >= dataset.length) {
      return NextResponse.json({ error: 'Invalid index' }, { status: 400 })
    }

    const item = dataset[idx]
    const t0 = Date.now()

    const chunks = await retrieve(item.question)
    const lat = (Date.now() - t0) / 1000
    const contexts = chunks.map((c: any) => c.text || '')
    const answer = await generateAnswer(item.question, contexts)

    const [faith, relev, prec, rec] = await Promise.all([
      judge('faithfulness', item.question, answer, contexts, item.ground_truth),
      judge('relevancy', item.question, answer, contexts, item.ground_truth),
      judge('precision', item.question, answer, contexts, item.ground_truth),
      judge('recall', item.question, answer, contexts, item.ground_truth),
    ])

    const result = {
      index: idx,
      total: dataset.length,
      question: item.question,
      ground_truth: item.ground_truth,
      answer,
      latency_seconds: lat,
      faithfulness: faith,
      relevancy: relev,
      context_precision: prec,
      context_recall: rec,
      books_hit: Array.from(new Set(chunks.map((c: any) => c.book || ''))),
    }

    // === STORE TO KV ===
    // Save individual question result
    await safeKvSet(`citadel:eval:q${idx}`, result)

    // Rebuild aggregate from all available question keys
    const allResults: any[] = []
    for (let i = 0; i < dataset.length; i++) {
      const cached = await safeKvGet<any>(`citadel:eval:q${i}`)
      if (cached) allResults.push(cached)
    }

    const n = allResults.length
    const avg = (key: string) =>
      n > 0 ? allResults.reduce((a, b) => a + (b[key] || 0), 0) / n : 0

    await safeKvSet('citadel:eval:latest', {
      run_date: new Date().toISOString(),
      total_questions: dataset.length,
      completed: n,
      avg_faithfulness: Math.round(avg('faithfulness') * 1000) / 1000,
      avg_relevancy: Math.round(avg('relevancy') * 1000) / 1000,
      avg_context_precision: Math.round(avg('context_precision') * 1000) / 1000,
      avg_context_recall: Math.round(avg('context_recall') * 1000) / 1000,
      avg_latency_seconds: Math.round(avg('latency_seconds') * 1000) / 1000,
      details: allResults,
    })

    return NextResponse.json(result)
  } catch (err: any) {
    console.error('Eval run error:', err)
    return NextResponse.json(
      { error: err.message || 'Internal error' },
      { status: 500 }
    )
  }
}
