import OpenAI from 'openai'

// Jina AI — free-tier embeddings (OpenAI-compatible endpoint)
export const jina = new OpenAI({
  apiKey: process.env.JINA_API_KEY || '',
  baseURL: 'https://api.jina.ai/v1',
})

// Groq — free-tier lightning-fast inference (OpenAI-compatible endpoint)
export const groq = new OpenAI({
  apiKey: process.env.GROQ_API_KEY!,
  baseURL: 'https://api.groq.com/openai/v1',
})

// Backwards compat — deprecated, remove after migration
export const openai = groq
