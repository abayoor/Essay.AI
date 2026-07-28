import { supabase } from './supabase';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

async function readableError(error: unknown): Promise<Error> {
  if (isRecord(error) && error.context instanceof Response) {
    try {
      const payload: unknown = await error.context.json();
      if (isRecord(payload) && typeof payload.error === 'string') return new Error(payload.error);
    } catch {
      // Если сервер не прислал JSON, ниже остаётся безопасное общее сообщение.
    }
  }
  return new Error(error instanceof Error ? error.message : 'Не удалось обратиться к AI. Попробуй ещё раз.');
}

export async function invokeAi(body: Record<string, unknown>): Promise<Record<string, unknown>> {
  const { data, error } = await supabase.functions.invoke('ai', { body });
  if (error) throw await readableError(error);
  if (!isRecord(data)) throw new Error('AI вернул ответ в неожиданном формате.');
  return data;
}
