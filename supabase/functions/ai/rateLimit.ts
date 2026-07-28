type RateLimitResult = { allowed: true } | { allowed: false; status: number; error: string };

const UPSTASH_URL = Deno.env.get('UPSTASH_REDIS_REST_URL')?.replace(/\/$/, '');
const UPSTASH_TOKEN = Deno.env.get('UPSTASH_REDIS_REST_TOKEN');

function requestIp(request: Request): string {
  return request.headers.get('cf-connecting-ip')
    ?? request.headers.get('x-real-ip')
    ?? request.headers.get('x-forwarded-for')?.split(',')[0].trim()
    ?? 'unknown';
}

async function hash(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function requestCount(value: unknown): number | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  const first = value[0];
  if (typeof first !== 'object' || first === null) return null;
  const result = (first as Record<string, unknown>).result;
  return typeof result === 'number' ? result : null;
}

export async function enforceHookRateLimit(request: Request): Promise<RateLimitResult> {
  if (!UPSTASH_URL || !UPSTASH_TOKEN) {
    return { allowed: false, status: 503, error: 'Проверка хука пока не настроена. Нужен защищённый лимит запросов.' };
  }

  try {
    const key = `hook-check:${await hash(requestIp(request))}`;
    const response = await fetch(`${UPSTASH_URL}/pipeline`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${UPSTASH_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify([['INCR', key], ['EXPIRE', key, '3600', 'NX']]),
    });
    const data: unknown = await response.json();
    const count = requestCount(data);
    if (!response.ok || count === null) {
      return { allowed: false, status: 503, error: 'Не удалось безопасно проверить лимит запросов. Попробуй позже.' };
    }
    if (count > 5) return { allowed: false, status: 429, error: 'Лимит: 5 бесплатных проверок хука в час. Попробуй позже.' };
    return { allowed: true };
  } catch {
    return { allowed: false, status: 503, error: 'Не удалось безопасно проверить лимит запросов. Попробуй позже.' };
  }
}
