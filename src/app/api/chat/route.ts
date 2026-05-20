import { NextRequest } from 'next/server'
import { groq } from '@/lib/clients'

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

    // Groq streaming — blazing fast on LPU
    const stream = await groq.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      messages: [{ role: 'system', content: systemPrompt }, ...messages.slice(-6)],
      temperature: 0.25,
      max_tokens: 900,
      stream: true,
    })

    const encoder = new TextEncoder()
    const readable = new ReadableStream({
      async start(controller) {
        for await (const part of stream) {
          const content = part.choices[0]?.delta?.content || ''
          if (content) {
            controller.enqueue(encoder.encode(content))
          }
        }
        controller.close()
      },
    })

    return new Response(readable, {
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
