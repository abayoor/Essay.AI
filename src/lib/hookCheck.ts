import { invokeAi } from './aiClient';

function isHookResult(value: unknown): value is { hook_feedback: string } {
  return typeof value === 'object' && value !== null
    && typeof (value as Record<string, unknown>).hook_feedback === 'string';
}

export async function requestHookCheck(content: string): Promise<string> {
  const data = await invokeAi({
    mode: 'hook',
    prompt: content,
    system: [
      'Ты — бережный коуч по вступительным эссе.',
      'Оцени только первое предложение или абзац: насколько он вызывает интерес и даёт конкретную деталь.',
      'Не переписывай текст и не предлагай готовые фразы. Верни только JSON: {"hook_feedback":"короткий полезный комментарий"}.',
      'Отвечай на языке текста.',
    ].join('\n'),
  });
  if (!isHookResult(data)) throw new Error('AI вернул ответ в неожиданном формате.');
  return data.hook_feedback;
}
