import { invokeAi, streamAi, type AiStreamCallback } from './aiClient';

function isHookResult(value: unknown): value is { hook_feedback: string } {
  return typeof value === 'object' && value !== null
    && typeof (value as Record<string, unknown>).hook_feedback === 'string';
}

export async function requestHookCheck(content: string, onChunk?: AiStreamCallback): Promise<string> {
  const body = {
    mode: 'hook',
    prompt: content,
    system: [
      'Ты — бережный коуч по вступительным эссе.',
      'Оцени только первое предложение или абзац: насколько он вызывает интерес и даёт конкретную деталь.',
      'Обязательно процитируй 1–2 конкретные короткие фразы из текста студента. Не давай советов, которые звучали бы одинаково для любого начала.',
      'Не переписывай текст и не предлагай готовые фразы. Верни только JSON: {"hook_feedback":"короткий полезный комментарий"}.',
      'Отвечай на языке текста.',
    ].join('\n'),
  };
  const data = onChunk
    ? { text: await streamAi(body, onChunk) }
    : await invokeAi(body);
  if (!isHookResult(data)) throw new Error('AI вернул ответ в неожиданном формате.');
  return data.hook_feedback;
}
