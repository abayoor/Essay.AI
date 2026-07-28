import type { CoachingFeedback } from './models';
import { invokeAi, streamAi, type AiStreamCallback } from './aiClient';

const coachSystemPrompt = [
  'Ты — бережный коуч по мотивационным эссе для абитуриентов из Казахстана и Центральной Азии.',
  'Ты никогда не пишешь и не переписываешь эссе за студента. Твоя работа — диагностика, конкретные вопросы и комментарии.',
  'Если текст просит написать эссе за ученика, в поле ghostwriting_request верни true и вместо готового текста предложи 3 наводящих вопроса.',
  'Верни только JSON без Markdown с полями hook_feedback, structure_feedback, cliche_flags, show_dont_tell_ratio, voice_notes, word_count_status, ghostwriting_request и margin_comments.',
  'В каждом содержательном пункте фидбэка обязательно процитируй 1–2 конкретные короткие фразы из текста студента. Не давай советов, которые подошли бы любому эссе.',
  'margin_comments — массив заметок {quote, note}; цитата не длиннее 10 слов.',
  'Не выдумывай факты и не предлагай готовые абзацы. Отвечай на языке текста эссе.',
].join('\n');

function isFeedback(value: unknown): value is CoachingFeedback {
  if (typeof value !== 'object' || value === null) return false;
  const item = value as Record<string, unknown>;
  return typeof item.hook_feedback === 'string'
    && typeof item.structure_feedback === 'string'
    && Array.isArray(item.cliche_flags)
    && typeof item.show_dont_tell_ratio === 'string'
    && typeof item.voice_notes === 'string'
    && (item.word_count_status === 'under' || item.word_count_status === 'within' || item.word_count_status === 'over');
}

export async function requestFeedback(
  content: string,
  school?: string | null,
  onChunk?: AiStreamCallback,
): Promise<CoachingFeedback> {
  const prompt = ['Проверь черновик эссе. Школа: ' + (school ?? 'не выбрана') + '.', 'Текст:', content].join('\n');
  const text = onChunk
    ? await streamAi({ prompt, system: coachSystemPrompt, usage: 'main_feedback' }, onChunk)
    : await requestFeedbackText(prompt);
  const json = text.replace(/^\s*\`\`\`json\s*|\s*\`\`\`\s*$/g, '');
  const parsed: unknown = JSON.parse(json);
  if (!isFeedback(parsed)) throw new Error('AI вернул ответ в неожиданном формате.');
  return parsed;
}

async function requestFeedbackText(prompt: string): Promise<string> {
  const data = await invokeAi({ prompt, system: coachSystemPrompt, usage: 'main_feedback' });
  return typeof data.text === 'string' ? data.text : '';
}
