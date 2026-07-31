import type { Locale } from './cyclingModels';
import { invokeAi } from './aiGateway';

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
  const payload = await invokeAi(
    { mode: 'assist', task, locale, context },
    { path: '/api/ai/assist', body: { task, locale, context } },
  );
  if (!isResult(payload)) throw new Error('Gemini вернул неполный ответ.');
  return payload;
}
