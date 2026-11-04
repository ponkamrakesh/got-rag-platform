
import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const maxDuration = 30

const GROQ_URL =
  'https://api.groq.com/openai/v1/chat/completions'

const GROQ_MODEL = 'openai/gpt-oss-20b'

export async function POST(req: NextRequest) {
  try {
    const { messages } = await req.json()

    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { error: 'Conversation messages are required' },
        { status: 400 }
      )
    }

    const apiKey = process.env.GROQ_API_KEY?.trim()

    if (!apiKey) {
      return NextResponse.json(
        { error: 'GROQ_API_KEY is not configured' },
        { status: 500 }
      )
    }

    const conversation = messages
      .filter(
        (m: any) =>
          ['user', 'assistant'].includes(m.role) &&
          typeof m.content === 'string'
      )
      .slice(-12)
      .map((m: any) => ({
        role: m.role,
        content: m.content.slice(0, 3000),
      }))

    const response = await fetch(GROQ_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        temperature: 0,
        max_tokens: 250,
        stream: false,
        messages: [
          {
            role: 'system',
            content: `
You are an intent router for Citadel, a conversational
Game of Thrones and A Song of Ice and Fire assistant.

Analyze the CURRENT USER MESSAGE together with the
complete conversation history.

Your task is to decide whether the application needs
to retrieve information from its Game of Thrones
knowledge base before generating an answer.

INTENT RULES:

1. conversation:
   Greetings, thanks, casual conversation, jokes,
   introductions, and normal social interaction.
   Retrieval is not needed.

2. general_question:
   General knowledge, explanations, unrelated topics,
   and questions that can be answered without the
   Game of Thrones knowledge base.
   Retrieval is not needed.

3. domain_question:
   Questions about Game of Thrones, its books,
   characters, houses, locations, events, history,
   theories, and lore.
   Retrieval is required.

4. follow_up:
   A message that depends on previous Game of Thrones
   discussion, including pronouns, references such as
   "what happened next?", "why did he do that?",
   "tell me more", and incomplete contextual questions.
   Retrieval is required when the previous context
   establishes a Game of Thrones topic.

5. clarification:
   A message that genuinely requires clarification
   before an answer can be produced.
   Retrieval is not required yet.

IMPORTANT:
- Do not classify using keywords alone.
- Understand the semantic meaning and conversational
  context of the latest user message.
- Resolve references such as he, she, they, it,
  that person, his family and the previous event.
- Do not retrieve simply because the application is
  a Game of Thrones application.
- A request to change topics must not inherit the
  previous Game of Thrones retrieval requirement.
- For domain follow-ups, rewrite the latest question
  into a standalone search query using conversation
  history.
- Preserve the user's actual question and intent.
- Do not answer the user. Only classify the request.

Return:
- intent
- needs_retrieval
- standalone_query
- reason

If retrieval is unnecessary, standalone_query must
be an empty string.
            `,
          },
          ...conversation,
        ],
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'intent_classification',
            strict: true,
            schema: {
              type: 'object',
              properties: {
                intent: {
                  type: 'string',
                  enum: [
                    'conversation',
                    'general_question',
                    'domain_question',
                    'follow_up',
                    'clarification',
                  ],
                },
                needs_retrieval: {
                  type: 'boolean',
                },
                standalone_query: {
                  type: 'string',
                },
                reason: {
                  type: 'string',
                },
              },
              required: [
                'intent',
                'needs_retrieval',
                'standalone_query',
                'reason',
              ],
              additionalProperties: false,
            },
          },
        },
      }),
    })

    if (!response.ok) {
      const details = await response.text()

      console.error('Intent classification failed:', details)

      return NextResponse.json(
        { error: 'Intent classification service failed' },
        { status: 502 }
      )
    }

    const data = await response.json()

    const content = data.choices?.[0]?.message?.content

    if (!content) {
      throw new Error('Empty intent classification response')
    }

    const classification = JSON.parse(content)

    console.log('Intent classification:', classification)

    return NextResponse.json({
      success: true,
      ...classification,
    })
  } catch (error) {
    console.error('Intent router error:', error)

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Intent classification failed',
      },
      { status: 500 }
    )
  }
}
