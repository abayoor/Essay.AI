import { supabase } from './supabase';
import { apiFetch } from './api';
import { proPromoRequestHeaders } from './proAccess';

function errorMessage(value: unknown): string | null {
  if (typeof value !== 'object' || value === null) return null;
  const record = value as Record<string, unknown>;
  return typeof record.error === 'string' ? record.error : null;
}

type AiFallback = {
  path: string;
  body: Record<string, unknown>;
};

function responseFromError(error: Error): Response | null {
  const context = 'context' in error ? error.context : null;
  return context instanceof Response ? context : null;
}

async function functionErrorMessage(error: Error): Promise<string> {
  const response = responseFromError(error);
  if (response) {
    const payload: unknown = await response.json().catch(() => null);
    return errorMessage(payload) ?? `ИИ-сервис Supabase не ответил (код ${response.status}).`;
  }
  return error.message || 'Не удалось вызвать ИИ-сервис Supabase.';
}

async function currentAccessToken(): Promise<string> {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw new Error('Не удалось проверить сессию. Войди в аккаунт снова.');
  if (!data.session?.access_token) {
    throw new Error('Войди в аккаунт, чтобы использовать ИИ.');
  }

  const expiresAt = (data.session.expires_at ?? 0) * 1000;
  if (!expiresAt || expiresAt > Date.now() + 60_000) return data.session.access_token;

  const refreshed = await supabase.auth.refreshSession();
  if (refreshed.error || !refreshed.data.session?.access_token) {
    throw new Error('Сессия истекла. Войди в аккаунт снова.');
  }
  return refreshed.data.session.access_token;
}

async function refreshedAccessToken(): Promise<string> {
  const refreshed = await supabase.auth.refreshSession();
  if (refreshed.error || !refreshed.data.session?.access_token) {
    throw new Error('Сессия истекла. Войди в аккаунт снова.');
  }
  return refreshed.data.session.access_token;
}

async function invokeEdgeFunction(body: Record<string, unknown>, accessToken: string) {
  return supabase.functions.invoke('ai', {
    body,
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
}

export async function invokeAi(body: Record<string, unknown>, fallback: AiFallback): Promise<unknown> {
  let accessToken = await currentAccessToken();
  let edgeResult = await invokeEdgeFunction(body, accessToken);

  if (edgeResult.error && responseFromError(edgeResult.error)?.status === 401) {
    accessToken = await refreshedAccessToken();
    edgeResult = await invokeEdgeFunction(body, accessToken);
  }
  if (!edgeResult.error) return edgeResult.data;

  const edgeMessage = await functionErrorMessage(edgeResult.error);
  const response = await apiFetch(fallback.path, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${accessToken}`,
      'content-type': 'application/json',
      ...proPromoRequestHeaders(),
    },
    body: JSON.stringify(fallback.body),
  }, 45_000).catch(() => null);

  if (!response) throw new Error(edgeMessage);
  const payload: unknown = await response.json().catch(() => null);
  if (response.ok) return payload;

  const fallbackMessage = errorMessage(payload);
  if (fallbackMessage && response.status !== 503 && !fallbackMessage.includes('временно недоступен')) {
    throw new Error(fallbackMessage);
  }
  throw new Error(edgeMessage);
}
