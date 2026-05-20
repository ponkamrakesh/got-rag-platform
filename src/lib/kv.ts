import { kv } from '@vercel/kv'

// Graceful fallback: if Vercel KV is not configured, return null and let callers use defaults
export async function safeKvGet<T>(key: string): Promise<T | null> {
  try {
    if (!process.env.KV_REST_API_URL && !process.env.KV_URL) return null
    const val = await kv.get<T>(key)
    return val ?? null
  } catch {
    return null
  }
}

export async function safeKvSet(key: string, value: any, options?: { ex?: number }) {
  try {
    if (!process.env.KV_REST_API_URL && !process.env.KV_URL) return false
    await kv.set(key, value, options)
    return true
  } catch {
    return false
  }
}

export async function safeKvLpush(key: string, value: any, maxLen = 100) {
  try {
    if (!process.env.KV_REST_API_URL && !process.env.KV_URL) return false
    await kv.lpush(key, value)
    await kv.ltrim(key, 0, maxLen - 1)
    return true
  } catch {
    return false
  }
}

export async function safeKvLrange<T>(key: string, start = 0, end = -1): Promise<T[]> {
  try {
    if (!process.env.KV_REST_API_URL && !process.env.KV_URL) return []
    const val = await kv.lrange<T>(key, start, end)
    return val ?? []
  } catch {
    return []
  }
}
