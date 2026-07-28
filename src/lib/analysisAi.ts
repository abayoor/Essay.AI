import { invokeAi, streamAi, type AiStreamCallback } from './aiClient';
import type { InterviewAnswer, InterviewFeedback, InterviewQuestion, PersonaFeedback } from './models';

type OverlapVerdict = {
  verdict: 'warning' | 'okay';
  explanation: string;
  recommendation: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function parseJson(text: string): unknown {
  return JSON.parse(text.replace(/^\s*```json\s*|\s*```\s*$/g, ''));
}

async function requestJson<T>(
  prompt: string,
  system: string,
  isExpected: (value: unknown) => value is T,
  onChunk?: AiStreamCallback,
): Promise<T> {
  const text = onChunk ? await streamAi({ prompt, system }, onChunk) : await requestJsonText(prompt, system);
  const parsed = parseJson(text);
  if (!isExpected(parsed)) throw new Error('AI вернул ответ в неожиданном формате.');
  return parsed;
}

async function requestJsonText(prompt: string, system: string): Promise<string> {
  const data = await invokeAi({ prompt, system });
  if (typeof data.text !== 'string') throw new Error('AI вернул ответ в неожиданном формате.');
  return data.text;
}

export async function createEssayEmbedding(content: string): Promise<number[]> {
  const data = await invokeAi({ mode: 'embedding', prompt: content });
  if (!Array.isArray(data.embedding) || data.embedding.length !== 1024
    || data.embedding.some((value) => typeof value !== 'number' || !Number.isFinite(value))) {
    throw new Error('Не удалось подготовить текст для сравнения.');
  }
  return data.embedding as number[];
}

function isPersonas(value: unknown): value is PersonaFeedback {
  if (!isRecord(value)) return false;
  return typeof value.strict_formalist === 'string'
    && typeof value.empathetic_reader === 'string'
    && typeof value.pragmatic_reviewer === 'string';
}

export function requestPersonaFeedback(content: string, onChunk?: AiStreamCallback): Promise<PersonaFeedback> {
  return requestJson(
    `Эссе студента:\n${content}`,
    [
      'Прочитай эссе от лица трёх разных читателей приёмной комиссии.',
      'Верни только JSON с полями strict_formalist, empathetic_reader, pragmatic_reviewer.',
      'Каждое поле — 2–3 предложения на языке эссе.',
      'В каждом поле обязательно процитируй 1–2 конкретные короткие фразы из текста студента. Не давай советов, которые звучали бы одинаково для любого эссе.',
      'strict_formalist: сухо оценивает только структуру, ясность, грамматику, лимит слов и соответствие промту; не обсуждает эмоции или кампус.',
      'empathetic_reader: честно описывает эмоциональный отклик, доверие к голосу автора и живые детали; не превращает отзыв в проверку грамматики.',
      'pragmatic_reviewer: смотрит только на инициативу, выборы автора и возможный вклад в кампус; называет один практический риск для решения о приёме.',
      'Три голоса должны выбрать разные наблюдения из текста и не повторять одну мысль разными словами. Не пиши эссе за студента и не выдумывай факты.',
    ].join('\n'),
    isPersonas,
    onChunk,
  );
}

function isOverlapVerdict(value: unknown): value is OverlapVerdict {
  if (!isRecord(value)) return false;
  return (value.verdict === 'warning' || value.verdict === 'okay')
    && typeof value.explanation === 'string'
    && typeof value.recommendation === 'string';
}

export function requestOverlapVerdict(
  currentContent: string,
  otherContent: string,
  onChunk?: AiStreamCallback,
): Promise<OverlapVerdict> {
  return requestJson(
    `Текущее эссе:\n${currentContent}\n\nДругое эссе:\n${otherContent}`,
    [
      'Сравни два эссе одного студента. Верни только JSON: verdict, explanation, recommendation.',
      'verdict = warning, только если это одна и та же конкретная история или анекдот, пересказанные иначе.',
      'verdict = okay, если совпадает тема или ценность, но конкретные истории разные.',
      'В explanation обязательно процитируй 1–2 конкретные короткие фразы из текущего эссе и, если есть совпадение, из другого эссе. Не давай советов, которые подошли бы любой паре текстов.',
      'Коротко назови, что именно пересекается, и дай мягкую практичную рекомендацию.',
      'Не пиши эссе за студента и не выдумывай детали.',
    ].join('\n'),
    isOverlapVerdict,
    onChunk,
  );
}

function isQuestions(value: unknown): value is InterviewQuestion[] {
  return Array.isArray(value) && value.length >= 5 && value.length <= 7
    && value.every((item) => isRecord(item)
      && typeof item.question === 'string' && item.question.trim().length > 0
      && typeof item.category === 'string' && item.category.trim().length > 0);
}

export function requestInterviewQuestions(content: string, onChunk?: AiStreamCallback): Promise<InterviewQuestion[]> {
  return requestJson(
    `Эссе студента:\n${content}`,
    [
      'Сгенерируй 5–7 вопросов для практики интервью на основе эссе студента.',
      'Верни только JSON-массив объектов {question: string, category: string}.',
      'Каждый вопрос относится ровно к одной категории: Лидерство, Трудная проблема, Тяжёлый выбор, Неудача/провал, Конфликт или разногласие, Работа в команде, Мотивация/почему это важно.',
      'Используй категорию только при наличии конкретной зацепки в тексте. Лучше 5 сильных вопросов, чем 7 общих.',
      'В каждом вопросе обязательно процитируй 1–2 конкретные короткие фразы из текста студента и спроси именно о них; не используй общие вопросы вроде «расскажи о себе».',
      'Не добавляй факты и не пиши ответы вместо студента.',
    ].join('\n'),
    isQuestions,
    onChunk,
  );
}

function isInterviewFeedback(value: unknown): value is InterviewFeedback[] {
  return Array.isArray(value) && value.every((item) => isRecord(item)
    && typeof item.question === 'string' && typeof item.consistency_note === 'string');
}

export function requestInterviewFeedback(
  content: string,
  answers: InterviewAnswer[],
  onChunk?: AiStreamCallback,
): Promise<InterviewFeedback[]> {
  return requestJson(
    `Эссе студента:\n${content}\n\nВопросы и ответы:\n${JSON.stringify(answers)}`,
    [
      'Сравни ответы студента на интервью с его эссе. Верни только JSON-массив объектов {question, consistency_note}.',
      'Для каждого вопроса мягко отметь: звучит ли ответ естественным продолжением той же истории и голоса.',
      'В каждой consistency_note обязательно процитируй 1–2 конкретные короткие фразы из эссе студента или его ответа. Не давай советов, которые звучали бы одинаково для любого интервью.',
      'Если есть конкретная нестыковка — назови её без обвинения. Если ответ добавляет живую деталь, которой не было в эссе, отметь это как хороший знак.',
      'Не пиши эссе и не выдумывай сведения.',
    ].join('\n'),
    isInterviewFeedback,
    onChunk,
  );
}
