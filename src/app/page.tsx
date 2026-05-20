'use client'

import { useState, FormEvent, useRef, useEffect } from 'react'
import Link from 'next/link'
import {
  BookOpen,
  BarChart3,
  Send,
  User,
  Bot,
  Flame,
  ScrollText,
  X,
} from 'lucide-react'
import SourceCard from '@/components/source-card'
import MapBackground from '@/components/map-background'

type Message = {
  role: 'user' | 'assistant'
  content: string
}

// SSE parser: extract content from Groq/OpenAI-compatible stream chunks
function parseSSEChunk(raw: string): string {
  let text = ''
  const lines = raw.split('\n')
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || !trimmed.startsWith('data: ')) continue
    const payload = trimmed.slice(6).trim()
    if (payload === '[DONE]') continue
    try {
      const json = JSON.parse(payload)
      const delta = json.choices?.[0]?.delta?.content
      if (typeof delta === 'string') {
        text += delta
      }
    } catch {
      // ignore malformed JSON lines
    }
  }
  return text
}

export default function HomePage() {
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content:
        'Hail. I am the Grand Maester of this Citadel. Ask me of Westeros, Essos, lineages, maps, prophecies, and all that lies between. Nothing recorded shall be withheld from you.',
    },
  ])
  const [sources, setSources] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [streaming, setStreaming] = useState(false)
  const [showSources, setShowSources] = useState(true)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!input.trim() || loading || streaming) return

    const userMsg = input.trim()
    setInput('')
    setMessages((prev) => [...prev, { role: 'user', content: userMsg }])
    setLoading(true)
    setSources([])

    try {
      // 1. Retrieve sources
      const retrieveRes = await fetch('/api/retrieve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: userMsg, topK: 8 }),
      })

      if (!retrieveRes.ok) {
        const errBody = await retrieveRes.text()
        throw new Error(
          `Retrieve HTTP ${retrieveRes.status}: ${errBody.slice(0, 200)}`
        )
      }

      const { chunks } = await retrieveRes.json()
      if (!Array.isArray(chunks)) {
        throw new Error('Retrieve returned invalid chunks format')
      }
      setSources(chunks || [])

      // 2. Stream answer
      setLoading(false)
      setStreaming(true)
      setMessages((prev) => [...prev, { role: 'assistant', content: '' }])

      const chatRes = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...messages, { role: 'user', content: userMsg }].slice(-6),
          sources: chunks || [],
        }),
      })

      if (!chatRes.ok || !chatRes.body) {
        const errBody = chatRes.ok ? '' : await chatRes.text()
        throw new Error(
          `Chat HTTP ${chatRes.status}: ${errBody.slice(0, 200)}`
        )
      }

      const reader = chatRes.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let full = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        // Process complete SSE events from buffer
        const lines = buffer.split('\n')
        // Keep the last incomplete line in buffer
        buffer = lines.pop() || ''

        for (const line of lines) {
          const content = parseSSEChunk(line)
          if (content) {
            full += content
            setMessages((prev) => {
              const next = [...prev]
              next[next.length - 1].content = full
              return next
            })
          }
        }
      }

      // Flush any remaining buffer
      const final = parseSSEChunk(buffer)
      if (final) {
        full += final
        setMessages((prev) => {
          const next = [...prev]
          next[next.length - 1].content = full
          return next
        })
      }
    } catch (err: any) {
      console.error('Chat pipeline error:', err)
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `⚠️ The ravens failed to return:\n\n${err.message || 'Unknown error'}`,
        },
      ])
    } finally {
      setLoading(false)
      setStreaming(false)
    }
  }

  const hasSources = sources.length > 0

  return (
    <>
      {/* Animated Westeros & Essos map background */}
      <MapBackground />

      {/* Main chat UI — sits above the map */}
      <div className="relative z-10 flex flex-col h-screen">
        {/* Header */}
        <header className="flex items-center justify-between px-4 md:px-6 py-3 border-b border-iron-600/80 bg-iron-900/85 backdrop-blur-md shrink-0">
          <div className="flex items-center gap-3">
            <Flame className="text-fire-400 w-6 h-6 drop-shadow-md" />
            <div>
              <h1 className="text-sm md:text-base font-bold tracking-widest text-zinc-100 font-serif drop-shadow-sm">
                CITADEL RAG
              </h1>
              <p className="text-[10px] md:text-xs text-zinc-400 hidden sm:block">
                Game of Thrones — Complete Corpus Intelligence
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 md:gap-3">
            {hasSources && (
              <button
                onClick={() => setShowSources((s) => !s)}
                className="sm:hidden flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium bg-iron-800/90 border border-iron-600 text-zinc-300 backdrop-blur-sm"
              >
                <ScrollText className="w-4 h-4" />
                {showSources ? 'Hide' : 'Sources'}
              </button>
            )}
            <Link
              href="/dashboard"
              className="flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium bg-iron-800/90 border border-iron-600 text-zinc-300 hover:text-zinc-100 hover:border-zinc-500 transition backdrop-blur-sm"
            >
              <BarChart3 className="w-4 h-4" />
              <span className="hidden sm:inline">Metrics</span>
            </Link>
          </div>
        </header>

        {/* Main */}
        <div className="flex flex-1 min-h-0 overflow-hidden">
          {/* Chat column */}
          <div className="flex flex-col flex-1 min-w-0">
            <div className="flex-1 overflow-y-auto scroll-thin p-4 md:p-6 space-y-5">
              {messages.map((m, i) => (
                <div
                  key={i}
                  className={`flex gap-3 md:gap-4 ${
                    m.role === 'user' ? 'justify-end' : 'justify-start'
                  }`}
                >
                  <div
                    className={`max-w-2xl rounded-lg px-4 py-3 md:px-5 md:py-4 leading-relaxed text-sm md:text-base whitespace-pre-wrap shadow-lg ${
                      m.role === 'user'
                        ? 'bg-fire-500/20 border border-fire-500/30 text-zinc-100 backdrop-blur-sm'
                        : 'bg-iron-800/85 border border-iron-600/80 text-zinc-100 backdrop-blur-md'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1.5 opacity-80">
                      {m.role === 'assistant' ? (
                        <Bot className="w-3.5 h-3.5 md:w-4 md:h-4" />
                      ) : (
                        <User className="w-3.5 h-3.5 md:w-4 md:h-4" />
                      )}
                      <span className="text-[10px] md:text-xs font-semibold uppercase tracking-wider">
                        {m.role}
                      </span>
                    </div>
                    {m.content || (streaming && i === messages.length - 1 ? (
                      <span className="animate-pulse text-zinc-500">Scribing...</span>
                    ) : null)}
                  </div>
                </div>
              ))}

              {loading && !streaming && (
                <div className="flex gap-3 items-center text-zinc-400 text-xs md:text-sm pl-1">
                  <div className="flex gap-1">
                    <div className="w-2 h-2 bg-fire-400 rounded-full animate-bounce" />
                    <div className="w-2 h-2 bg-fire-400 rounded-full animate-bounce [animation-delay:0.1s]" />
                    <div className="w-2 h-2 bg-fire-400 rounded-full animate-bounce [animation-delay:0.2s]" />
                  </div>
                  <span>Consulting the scrolls...</span>
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            {/* Input */}
            <form
              onSubmit={handleSubmit}
              className="p-3 md:p-4 border-t border-iron-600/70 bg-iron-900/70 backdrop-blur-lg shrink-0"
            >
              <div className="flex gap-2 md:gap-3 max-w-4xl mx-auto">
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask of dragons, lineages, maps, or ancient pacts..."
                  className="flex-1 bg-iron-800/80 border border-iron-600/70 rounded-md px-3 md:px-4 py-2.5 md:py-3 text-sm placeholder-zinc-500 focus:outline-none focus:border-fire-500 transition backdrop-blur-sm"
                />
                <button
                  type="submit"
                  disabled={loading || streaming || !input.trim()}
                  className="bg-fire-500 hover:bg-fire-400 disabled:opacity-40 text-white px-4 md:px-5 py-2.5 md:py-3 rounded-md transition flex items-center gap-2 font-medium text-sm shrink-0 shadow-md"
                >
                  <Send className="w-4 h-4" />
                  <span className="hidden md:inline">Send</span>
                </button>
              </div>
            </form>
          </div>

          {/* Sources panel */}
          {hasSources && (
            <aside
              className={`${
                showSources ? 'flex' : 'hidden'
              } xl:flex w-full xl:w-80 2xl:w-96 border-l border-iron-600/70 bg-iron-900/90 backdrop-blur-xl overflow-y-auto scroll-thin p-4 flex-col gap-3 absolute xl:relative z-20 h-full sm:max-w-sm sm:right-0 sm:ml-auto`}
            >
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-bold uppercase tracking-widest text-zinc-400 flex items-center gap-2">
                  <BookOpen className="w-4 h-4" />
                  Sources Retrieved
                </h2>
                <button
                  onClick={() => setShowSources(false)}
                  className="xl:hidden text-zinc-400 hover:text-zinc-100"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              {sources.map((s, i) => (
                <SourceCard key={i} source={s} index={i} />
              ))}
            </aside>
          )}
        </div>
      </div>
    </>
  )
}
