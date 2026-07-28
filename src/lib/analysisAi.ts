import type { InterviewAnswer, InterviewFeedback, PersonaFeedback } from './models';
import { supabase } from './supabase';

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

async function requestJson<T>(prompt: string, system: string, isExpected: (value: unknown) => value is T): Promise<T> {
  const { data, error } = await supabase.functions.invoke('ai', { body: { prompt, system } });
  if (error) throw error;
  if (!isRecord(data) || typeof data.text !== 'string') throw new Error('AI вернул ответ в неожиданном формате.');
  const parsed = parseJson(data.text);
  if (!isExpected(parsed)) throw new Error('AI вернул ответ в неожиданном формате.');
  return parsed;
}

export async function createEssayEmbedding(content: string): Promise<number[]> {
  const { data, error } = await supabase.functions.invoke('ai', { body: { mode: 'embedding', prompt: content } });
  if (error) throw error;
  if (!isRecord(data) || !Array.isArray(data.embedding) || data.embedding.length !== 1024
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

export function requestPersonaFeedback(content: string): Promise<PersonaFeedback> {
  return requestJson(
    `Эссе студента:\n${content}`,
    [
      'Прочитай эссе от лица трёх разных читателей приёмной комиссии.',
      'Верни только JSON с полями strict_formalist, empathetic_reader, pragmatic_reviewer.',
      'Каждое поле — 2–3 предложения на языке эссе.',
      'strict_formalist: сухо оценивает структуру, грамматику, лимит слов и соответствие промту.',
      'empathetic_reader: честно реагирует на эмоциональную историю и её воздействие.',
      'pragmatic_reviewer: смотрит, что текст говорит о вкладе студента в кампус и решении о приёме.',
      'Три голоса должны заметно различаться. Не пиши эссе за студента и не выдумывай факты.',
    ].join('\n'),
    isPersonas,
  );
}

function isOverlapVerdict(value: unknown): value is OverlapVerdict {
  if (!isRecord(value)) return false;
  return (value.verdict === 'warning' || value.verdict === 'okay')
    && typeof value.explanation === 'string'
    && typeof value.recommendation === 'string';
}

export function requestOverlapVerdict(currentContent: string, otherContent: string): Promise<OverlapVerdict> {
  return requestJson(
    `Текущее эссе:\n${currentContent}\n\nДругое эссе:\n${otherContent}`,
    [
      'Сравни два эссе одного студента. Верни только JSON: verdict, explanation, recommendation.',
      'verdict = warning, только если это одна и та же конкретная история или анекдот, пересказанные иначе.',
      'verdict = okay, если совпадает тема или ценность, но конкретные истории разные.',
      'Коротко назови, что именно пересекается, и дай мягкую практичную рекомендацию.',
      'Не пиши эссе за студента и не выдумывай детали.',
    ].join('\n'),
    isOverlapVerdict,
  );
}

function isQuestions(value: unknown): value is string[] {
  return Array.isArray(value) && value.length >= 5 && value.length <= 7
    && value.every((question) => typeof question === 'string' && question.trim().length > 0);
}

export function requestInterviewQuestions(content: string): Promise<string[]> {
  return requestJson(
    `Эссе студента:\n${content}`,
    [
      'Сгенерируй 5–7 вопросов для пробного интервью по этому конкретному эссе.',
      'Верни только JSON-массив строк.',
      'Каждый вопрос должен ссылаться на деталь, событие или выбор из текста, а не быть общим вроде «расскажи о себе».',
      'Не добавляй факты и не пиши ответы вместо студента.',
    ].join('\n'),
    isQuestions,
  );
}

function isInterviewFeedback(value: unknown): value is InterviewFeedback[] {
  return Array.isArray(value) && value.every((item) => isRecord(item)
    && typeof item.question === 'string' && typeof item.consistency_note === 'string');
}

export function requestInterviewFeedback(content: string, answers: InterviewAnswer[]): Promise<InterviewFeedback[]> {
  return requestJson(
    `Эссе студента:\n${content}\n\nВопросы и ответы:\n${JSON.stringify(answers)}`,
    [
      'Сравни ответы студента на интервью с его эссе. Верни только JSON-массив объектов {question, consistency_note}.',
      'Для каждого вопроса мягко отметь: звучит ли ответ естественным продолжением той же истории и голоса.',
      'Если есть конкретная нестыковка — назови её без обвинения. Если ответ добавляет живую деталь, которой не было в эссе, отметь это как хороший знак.',
      'Не пиши эссе и не выдумывай сведения.',
    ].join('\n'),
    isInterviewFeedback,
  );
}
