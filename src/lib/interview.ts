import { requestInterviewFeedback, requestInterviewQuestions } from './analysisAi';
import type { InterviewAnswer, InterviewFeedback, InterviewQuestion, InterviewSession } from './models';
import { supabase } from './supabase';

export async function startInterview(essayId: string, content: string): Promise<InterviewSession> {
  const questions = await requestInterviewQuestions(content);
  const { data, error } = await supabase
    .from('interview_practice_sessions')
    .insert({ essay_id: essayId, questions })
    .select('id, questions')
    .single();
  if (error) throw error;
  const session = data as { id: string; questions: unknown };
  if (!Array.isArray(session.questions) || !session.questions.every((item) => isInterviewQuestion(item))) {
    throw new Error('Не удалось сохранить вопросы для интервью.');
  }
  return { id: session.id, questions: session.questions as InterviewQuestion[] };
}

function isInterviewQuestion(value: unknown): value is InterviewQuestion {
  if (typeof value !== 'object' || value === null) return false;
  const item = value as Record<string, unknown>;
  return typeof item.question === 'string' && typeof item.category === 'string';
}

export async function finishInterview(
  sessionId: string,
  content: string,
  answers: InterviewAnswer[],
): Promise<InterviewFeedback[]> {
  const feedback = await requestInterviewFeedback(content, answers);
  const { error } = await supabase
    .from('interview_practice_sessions')
    .update({ answers, feedback })
    .eq('id', sessionId);
  if (error) throw error;
  return feedback;
}
