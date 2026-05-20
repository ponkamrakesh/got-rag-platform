import { Redis } from '@upstash/redis'

const redis = Redis.fromEnv()

// Graceful fallback: if Redis env vars not configured, return null/empty
export async function safeKvGet<T>(key: string): Promise<T | null> {
  try {
    if (!process.env.KV_REST_API_URL && !process.env.UPSTASH_REDIS_REST_URL) return null
    const val = await redis.get<T>(key)
    return val ?? null
  } catch {
    return null
  }
}

export async function safeKvSet(key: string, value: any, options?: { ex?: number }) {
  try {
    if (!process.env.KV_REST_API_URL && !process.env.UPSTASH_REDIS_REST_URL) return false
    if (options?.ex) {
      await redis.set(key, value, { ex: options.ex })
    } else {
      await redis.set(key, value)
    }
    return true
  } catch {
    return false
  }
}

export async function safeKvLpush(key: string, value: any, maxLen = 100) {
  try {
    if (!process.env.KV_REST_API_URL && !process.env.UPSTASH_REDIS_REST_URL) return false
    // @upstash/redis auto-serializes objects
    await redis.lpush(key, value)
    await redis.ltrim(key, 0, maxLen - 1)
    return true
  } catch {
    return false
  }
}

export async function safeKvLrange<T>(key: string, start = 0, end = -1): Promise<T[]> {
  try {
    if (!process.env.KV_REST_API_URL && !process.env.UPSTASH_REDIS_REST_URL) return []
    const val = await redis.lrange<T>(key, start, end)
    return val ?? []
  } catch {
    return []
  }
}
