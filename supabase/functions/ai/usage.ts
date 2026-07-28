type AccessResult = { allowed: true } | { allowed: false; status: number; error: string };

const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY');

function authHeaders(request: Request): HeadersInit | null {
  const authorization = request.headers.get('authorization');
  if (!SUPABASE_ANON_KEY || !authorization) return null;
  return { apikey: SUPABASE_ANON_KEY, Authorization: authorization, 'Content-Type': 'application/json' };
}

export async function requireSignedInUser(request: Request): Promise<AccessResult> {
  const headers = authHeaders(request);
  if (!SUPABASE_URL || !headers) return { allowed: false, status: 401, error: 'Войди в аккаунт, чтобы использовать этот анализ.' };

  const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers });
  if (!response.ok) return { allowed: false, status: 401, error: 'Войди в аккаунт, чтобы использовать этот анализ.' };
  return { allowed: true };
}

export async function consumeMainFeedbackCredit(request: Request): Promise<AccessResult> {
  const headers = authHeaders(request);
  if (!SUPABASE_URL || !headers) return { allowed: false, status: 401, error: 'Войди в аккаунт, чтобы получить разбор эссе.' };

  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/consume_ai_analysis_credit`, {
    method: 'POST',
    headers,
    body: '{}',
  });
  const data: unknown = await response.json();
  if (!response.ok || typeof data !== 'object' || data === null) {
    return { allowed: false, status: 503, error: 'Не удалось проверить лимит анализов. Попробуй позже.' };
  }
  if ((data as Record<string, unknown>).allowed !== true) {
    return { allowed: false, status: 429, error: 'Месячный лимит анализов закончился. Пригласи друга, чтобы получить ещё 5.' };
  }
  return { allowed: true };
}
