import { requestInterviewFeedback, requestInterviewQuestions } from './analysisAi';
import type { InterviewAnswer, InterviewFeedback, InterviewQuestion, InterviewSession } from './models';
import { supabase } from './supabase';

export async function hasCompletedInterview(essayId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('interview_practice_sessions')
    .select('id')
    .eq('essay_id', essayId)
    .not('feedback', 'is', null)
    .limit(1);
  if (error) throw error;
  return (data?.length ?? 0) > 0;
}

export async function startInterview(
  essayId: string,
  content: string,
  onChunk?: (chunk: string) => void,
): Promise<InterviewSession> {
  const questions = await requestInterviewQuestions(content, onChunk);
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
  onChunk?: (chunk: string) => void,
): Promise<InterviewFeedback[]> {
  const feedback = await requestInterviewFeedback(content, answers, onChunk);
  const { error } = await supabase
    .from('interview_practice_sessions')
    .update({ answers, feedback })
    .eq('id', sessionId);
  if (error) throw error;
  return feedback;
}
