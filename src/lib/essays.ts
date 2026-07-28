import type { EssayDetail, EssaySummary, EssayType, EssayVersion } from './models';
import { generateAndSaveEssayEmbedding } from './essayOverlap';
import { supabase } from './supabase';

type NewEssay = {
  title: string;
  essayType: EssayType;
  targetSchool: string;
};

export function countWords(content: string): number {
  return content.trim() ? content.trim().split(/\s+/).length : 0;
}

export async function loadEssays(): Promise<EssaySummary[]> {
  const { data, error } = await supabase
    .from('essays')
    .select('id, title, target_school, essay_type, status, updated_at')
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as EssaySummary[];
}

export async function createEssay(input: NewEssay): Promise<string> {
  const { data, error } = await supabase
    .from('essays')
    .insert({
      title: input.title.trim(),
      essay_type: input.essayType,
      target_school: input.targetSchool.trim() || null,
    })
    .select('id')
    .single();
  if (error) throw error;
  return (data as { id: string }).id;
}

export async function loadEssay(id: string): Promise<EssayDetail | null> {
  const { data, error } = await supabase
    .from('essays')
    .select('id, title, target_school, essay_type, status, updated_at, prompt_id, current_version_id, essay_versions!essay_versions_essay_id_fkey(id, content, word_count, created_at)')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const row = data as EssayDetail & { essay_versions: EssayVersion[] | null };
  return { ...row, versions: row.essay_versions ?? [] };
}

export async function saveVersion(essayId: string, content: string): Promise<EssayVersion> {
  const { data, error } = await supabase
    .from('essay_versions')
    .insert({ essay_id: essayId, content, word_count: countWords(content) })
    .select('id, content, word_count, created_at')
    .single();
  if (error) throw error;
  const version = data as EssayVersion;

  const { error: updateError } = await supabase
    .from('essays')
    .update({ current_version_id: version.id })
    .eq('id', essayId);
  if (updateError) throw updateError;

  // Черновик уже сохранён, даже если AI временно недоступен. Проверка пересечений
  // попробует дополнить отсутствующий вектор перед сравнением.
  const embedding = await generateAndSaveEssayEmbedding(version.id, content).catch(() => null);
  return { ...version, embedding };
}

export async function saveFeedback(versionId: string, feedback: object): Promise<void> {
  const { error } = await supabase
    .from('feedback_logs')
    .insert({ essay_version_id: versionId, feedback });
  if (error) throw error;
}
