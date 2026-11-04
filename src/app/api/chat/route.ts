
import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const maxDuration = 60

const GROQ_URL =
  'https://api.groq.com/openai/v1/chat/completions'

const GROQ_MODEL = 'llama-3.1-8b-instant'
const MAX_RETRIES = 3
const BASE_DELAY_MS = 2000

type ChatMessage = {
  role: 'user' | 'assistant'
  content: string
}

type NormalizedSource = {
  id: string
  score?: number
  text: string
  book: string
  chapter: string
  start_page?: number
  end_page?: number
  image_path?: string
}

function normalizeSource(source: any): NormalizedSource | null {
  if (!source || typeof source !== 'object') {
    return null
  }

  // Supports both:
  // { id, score, metadata: { text, book, ... } }
  // { id, score, text, book, ... }

  const metadata =
    source.metadata &&
    typeof source.metadata === 'object'
      ? source.metadata
      : source

  if (
    typeof metadata.text !== 'string' ||
    !metadata.text.trim()
  ) {
    return null
  }

  return {
    id: String(source.id ?? ''),
    score: source.score,
    text: metadata.text,
    book: String(metadata.book ?? 'Unknown book'),
    chapter: String(metadata.chapter ?? ''),
    start_page: metadata.start_page,
    end_page: metadata.end_page,
    image_path: metadata.image_path,
  }
}

async function fetchGroqWithRetry(
  body: object,
  apiKey: string
): Promise<Response> {
  let lastResponse: Response | undefined

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const response = await fetch(GROQ_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    })

    lastResponse = response

    if (response.status !== 429) {
      return response
    }

    if (attempt < MAX_RETRIES) {
      const delay =
        BASE_DELAY_MS * 2 ** (attempt - 1)

      console.warn(
        `Groq rate limit. Attempt ${attempt}/${MAX_RETRIES}. Retrying in ${delay}ms.`
      )

      await new Promise((resolve) =>
        setTimeout(resolve, delay)
      )
    }
  }

  return lastResponse!
}

export async function POST(req: NextRequest) {
  try {
    // 1. Parse request
    const body = await req.json()

    const { messages, sources } = body

    if (
      !Array.isArray(messages) ||
      !Array.isArray(sources)
    ) {
      return NextResponse.json(
        { error: 'Invalid request: messages and sources must be arrays' },
        { status: 400 }
      )
    }

    // 2. Validate Groq API key
    const apiKey = process.env.GROQ_API_KEY?.trim()

    if (!apiKey) {
      return NextResponse.json(
        { error: 'GROQ_API_KEY is not configured' },
        { status: 500 }
      )
    }

    // 3. Normalize retrieved Pinecone sources
    const normalizedSources = sources
      .map(normalizeSource)
      .filter(
        (source): source is NormalizedSource =>
          source !== null
      )

    console.log(
      `Chat received ${sources.length} sources; ${normalizedSources.length} valid sources`
    )

    // 4. Build grounded context
    const contextText = normalizedSources
      .map((source, i) => {
        const page =
          source.start_page != null
            ? `p.${source.start_page}${
                source.end_page != null &&
                source.end_page !== source.start_page
                  ? `-${source.end_page}`
                  : ''
              }`
            : 'page unknown'

        return (
          `[${i + 1}] ${source.book} | ` +
          `${source.chapter || 'Chapter unknown'} | ` +
          `${page}\n` +
          `${source.text.slice(0, 500)}`
        )
      })
      .join('\n\n---\n\n')

    const systemPrompt =
      `You are the Grand Maester of the Citadel, an expert on ` +
      `the Game of Thrones and A Song of Ice and Fire universe.\n\n` +
      `Answer questions using ONLY the retrieved excerpts below.\n` +
      `Do not invent facts or events that are not supported by the excerpts.\n` +
      `Cite relevant sources using [1], [2], etc.\n` +
      `If the retrieved context does not contain the answer, ` +
      `clearly say that the available scrolls do not provide enough information.\n\n` +
      `RETRIEVED CONTEXT:\n` +
      (contextText || 'No relevant documents were retrieved.')

    // 5. Validate and normalize conversation messages
    const validMessages: ChatMessage[] = messages
      .filter(
        (message: any) =>
          message &&
          ['user', 'assistant'].includes(message.role) &&
          typeof message.content === 'string'
      )
      .slice(-6)
      .map((message: any) => ({
        role: message.role,
        content: message.content,
      }))

    if (validMessages.length === 0) {
      return NextResponse.json(
        { error: 'No valid conversation messages provided' },
        { status: 400 }
      )
    }

    // 6. Prepare Groq request
    const groqBody = {
      model: GROQ_MODEL,
      messages: [
        {
          role: 'system',
          content: systemPrompt,
        },
        ...validMessages,
      ],
      temperature: 0.25,
      max_tokens: 500,
      stream: true,
    }

    // 7. Call Groq with rate-limit retry
    const groqResponse = await fetchGroqWithRetry(
      groqBody,
      apiKey
    )

    if (!groqResponse.ok) {
      const errorText = await groqResponse.text()

      console.error(
        'Groq API error:',
        groqResponse.status,
        errorText.slice(0, 500)
      )

      return NextResponse.json(
        {
          error:
            groqResponse.status === 429
              ? 'Groq rate limit exceeded. Please try again shortly.'
              : `Groq API error: ${groqResponse.status}`,
          details: errorText.slice(0, 300),
        },
        { status: 502 }
      )
    }

    // 8. Validate streaming response
    if (!groqResponse.body) {
      return NextResponse.json(
        { error: 'Groq returned an empty response stream' },
        { status: 502 }
      )
    }

    // 9. Forward SSE stream to frontend
    return new Response(groqResponse.body, {
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
      },
    })

  } catch (error: unknown) {
    console.error('Chat API error:', error)

    const message =
      error instanceof Error
        ? error.message
        : 'Internal server error'

    return NextResponse.json(
      {
        error: message,
      },
      { status: 500 }
    )
  }
}
