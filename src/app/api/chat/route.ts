import { NextRequest } from 'next/server'

export const maxDuration = 60

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

    const contextText = sources
      .map(
        (s: any, i: number) =>
          `[${i + 1}] ${s.book} ${s.chapter ? `— ${s.chapter}` : ''} (p.${s.start_page}${
            s.end_page !== s.start_page ? `-${s.end_page}` : ''
          }):\n${s.text}`
      )
      .join('\n\n---\n\n')

    const systemPrompt =
      `You are the Grand Maester of the Citadel, the foremost living authority on A Song of Ice and Fire.\n` +
      `You answer questions using ONLY the provided manuscript excerpts below.\n` +
      `If the context does not contain the answer, say you lack the scrolls on that matter.\n` +
      `Cite sources using bracket numbers like [1], [2] whenever possible.\n` +
      `Be precise about lineages, geographies, and heraldry.\n\n` +
      `CONTEXT SECTIONS:\n${contextText}\n\n` +
      `Now answer the user's question.`

    const groqMessages = [
      { role: 'system', content: systemPrompt },
      ...messages.slice(-6),
    ]

    // === GROQ STREAMING via raw fetch (OpenAI-compatible endpoint) ===
    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: groqMessages,
        temperature: 0.25,
        max_tokens: 900,
        stream: true,
      }),
    })

    if (!groqRes.ok) {
      const errText = await groqRes.text()
      return new Response(
        JSON.stringify({ error: `Groq error: ${groqRes.status} ${errText.slice(0, 200)}` }),
        { status: 502, headers: { 'Content-Type': 'application/json' } }
      )
    }

    if (!groqRes.body) {
      return new Response(
        JSON.stringify({ error: 'Groq returned empty stream body' }),
        { status: 502, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Proxy the SSE stream directly — no parsing needed
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
