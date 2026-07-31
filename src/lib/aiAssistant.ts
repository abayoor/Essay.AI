import type { Locale } from './cyclingModels';
import { supabase } from './supabase';

export type AiAssistTask = 'post_caption' | 'route_copy' | 'ride_analysis';

export type AiAssistResult = {
  title: string;
  text: string;
  highlights: string[];
  provider: 'gemini';
};

function isResult(value: unknown): value is AiAssistResult {
  if (typeof value !== 'object' || value === null) return false;
  const item = value as Record<string, unknown>;
  return typeof item.title === 'string'
    && typeof item.text === 'string'
    && Array.isArray(item.highlights)
    && item.highlights.every((highlight) => typeof highlight === 'string')
    && item.provider === 'gemini';
}

export async function requestAiAssist(task: AiAssistTask, locale: Locale, context: Record<string, unknown>): Promise<AiAssistResult> {
  const { data } = await supabase.auth.getSession();
  const accessToken = data.session?.access_token;
  if (!accessToken) throw new Error('Войди в аккаунт, чтобы использовать Gemini.');
  const response = await fetch('/api/ai/assist', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${accessToken}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ task, locale, context }),
  });
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message = typeof payload === 'object' && payload !== null && typeof (payload as Record<string, unknown>).error === 'string'
      ? (payload as Record<string, unknown>).error as string
      : 'Gemini временно недоступен.';
    throw new Error(message);
  }
  if (!isResult(payload)) throw new Error('Gemini вернул неполный ответ.');
  return payload;
}
