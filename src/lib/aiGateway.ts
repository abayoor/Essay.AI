import { supabase } from './supabase';

function errorMessage(value: unknown): string | null {
  if (typeof value !== 'object' || value === null) return null;
  const record = value as Record<string, unknown>;
  return typeof record.error === 'string' ? record.error : null;
}

type AiFallback = {
  path: string;
  body: Record<string, unknown>;
};

async function functionErrorMessage(error: Error): Promise<string> {
  const context = 'context' in error ? error.context : null;
  if (context instanceof Response) {
    const payload: unknown = await context.json().catch(() => null);
    return errorMessage(payload) ?? `ИИ-сервис Supabase не ответил (код ${context.status}).`;
  }
  return error.message || 'Не удалось вызвать ИИ-сервис Supabase.';
}

export async function invokeAi(body: Record<string, unknown>, fallback: AiFallback): Promise<unknown> {
  const { data, error } = await supabase.functions.invoke('ai', { body });
  if (!error) return data;

  const edgeMessage = await functionErrorMessage(error);
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  if (!accessToken) throw new Error('Войди в аккаунт, чтобы использовать ИИ.');

  const response = await fetch(fallback.path, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${accessToken}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(fallback.body),
  }).catch(() => null);
  if (!response) throw new Error(edgeMessage);
  const payload: unknown = await response.json().catch(() => null);
  if (response.ok) return payload;

  const fallbackMessage = errorMessage(payload);
  if (fallbackMessage && !fallbackMessage.includes('временно недоступен')) {
    throw new Error(fallbackMessage);
  }
  throw new Error(edgeMessage);
}
