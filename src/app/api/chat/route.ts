import { NextRequest } from 'next/server'

export const maxDuration = 60

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'
const MAX_RETRIES = 3
const BASE_DELAY_MS = 2000  // Groq TPM limits reset quickly

async function fetchGroqWithRetry(
  body: object,
  apiKey: string,
  retries = MAX_RETRIES
): Promise<Response> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    const res = await fetch(GROQ_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    })

    if (res.status === 429) {
      const delay = BASE_DELAY_MS * 2 ** (attempt - 1) // 2s, 4s, 8s
      console.warn(`Groq 429 (attempt ${attempt}/${retries}). Retrying in ${delay}ms...`)
      await new Promise((r) => setTimeout(r, delay))
      continue
    }

    // Non-429: return immediately (caller handles other errors)
    return res
  }

  // All retries exhausted — return the last 429 response
  return await fetch(GROQ_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  })
}

export async function POST(req: NextRequest) {
  try {
    const { messages, sources } = await req.json()
    if (!Array.isArray(messages) || !Array.isArray(sources)) {
      return new Response(JSON.stringify({ error: 'Invalid body' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    if (!process.env.GROQ_API_KEY) {
      return new Response(JSON.stringify({ error: 'GROQ_API_KEY not configured' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Build a tighter context block to reduce TPM
    const contextText = sources
      .map(
        (s: any, i: number) =>
          `[${i + 1}] ${s.book} p.${s.start_page}${
            s.end_page !== s.start_page ? `-${s.end_page}` : ''
          }: ${s.text.slice(0, 500)}` // cap each source to 500 chars to save tokens
      )
      .join('\n---\n')

    const systemPrompt =
      `You are the Grand Maester of the Citadel. Answer using ONLY the excerpts below. ` +
      `Cite sources [1], [2], etc. If unknown, say you lack the scrolls.\n\n` +
      `EXCERPTS:\n${contextText}`

    const groqBody = {
      model: 'llama-3.1-8b-instant',
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages.slice(-6),
      ],
      temperature: 0.25,
      max_tokens: 500, // reduced from 900 to stay under free-tier TPM
      stream: true,
    }

    const groqRes = await fetchGroqWithRetry(groqBody, process.env.GROQ_API_KEY)

    if (!groqRes.ok) {
      const errText = await groqRes.text()
      console.error('Groq error after retries:', groqRes.status, errText)
      return new Response(
        JSON.stringify({
          error:
            groqRes.status === 429
              ? 'Groq rate limit exceeded. Please wait 10-20 seconds and try again.'
              : `Groq error: ${groqRes.status} ${errText.slice(0, 200)}`,
        }),
        { status: 502, headers: { 'Content-Type': 'application/json' } }
      )
    }

    if (!groqRes.body) {
      return new Response(
        JSON.stringify({ error: 'Groq returned empty stream body' }),
        { status: 502, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Proxy the SSE stream directly
    return new Response(groqRes.body, {
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    })
  } catch (err: any) {
    console.error('Chat error:', err)
    return new Response(JSON.stringify({ error: err.message || 'Internal error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
