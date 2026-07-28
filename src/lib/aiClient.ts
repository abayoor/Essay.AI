import { supabase, supabaseAnonKey, supabaseUrl } from './supabase';

export type AiStreamCallback = (chunk: string) => void;

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

async function readableResponseError(response: Response): Promise<Error> {
  try {
    const payload: unknown = await response.json();
    if (isRecord(payload) && typeof payload.error === 'string') return new Error(payload.error);
  } catch {
    // Сервер мог оборвать поток до JSON-ответа.
  }
  return new Error('Не удалось обратиться к AI. Попробуй ещё раз.');
}

function chunkText(eventData: string): string {
  try {
    const value: unknown = JSON.parse(eventData);
    if (!isRecord(value) || !Array.isArray(value.candidates)) return '';
    const candidate = value.candidates[0];
    if (!isRecord(candidate) || !isRecord(candidate.content) || !Array.isArray(candidate.content.parts)) return '';
    return candidate.content.parts
      .map((part) => isRecord(part) && typeof part.text === 'string' ? part.text : '')
      .join('');
  } catch {
    return '';
  }
}

function consumeEvents(buffer: string, onChunk: AiStreamCallback): { remainder: string; text: string } {
  const events = buffer.split(/\r?\n\r?\n/);
  const remainder = events.pop() ?? '';
  const text = events.reduce((allText, event) => {
    const data = event
      .split(/\r?\n/)
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice(5).trim())
      .join('');
    const nextChunk = data === '[DONE]' ? '' : chunkText(data);
    if (nextChunk) onChunk(nextChunk);
    return allText + nextChunk;
  }, '');
  return { remainder, text };
}

export async function invokeAi(body: Record<string, unknown>): Promise<Record<string, unknown>> {
  const { data, error } = await supabase.functions.invoke('ai', { body });
  if (error) throw await readableError(error);
  if (!isRecord(data)) throw new Error('AI вернул ответ в неожиданном формате.');
  return data;
}

export async function streamAi(body: Record<string, unknown>, onChunk: AiStreamCallback): Promise<string> {
  if (!supabaseUrl || !supabaseAnonKey) throw new Error('Supabase ещё не настроен.');

  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token ?? supabaseAnonKey;
  const response = await fetch(`${supabaseUrl}/functions/v1/ai`, {
    method: 'POST',
    headers: {
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ ...body, stream: true }),
  });

  if (!response.ok) throw await readableResponseError(response);
  if (!response.body) throw new Error('AI не открыл поток ответа. Попробуй ещё раз.');

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let remainder = '';
  let text = '';

  while (true) {
    const { done, value } = await reader.read();
    remainder += decoder.decode(value, { stream: !done });
    const consumed = consumeEvents(remainder, onChunk);
    remainder = consumed.remainder;
    text += consumed.text;
    if (done) break;
  }

  if (remainder.trim()) {
    const finalChunk = chunkText(remainder.replace(/^data:\s*/, '').trim());
    if (finalChunk) onChunk(finalChunk);
    text += finalChunk;
  }
  if (!text.trim()) throw new Error('AI вернул пустой ответ. Попробуй ещё раз.');
  return text;
}
