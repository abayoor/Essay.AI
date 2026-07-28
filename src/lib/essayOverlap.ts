import { createEssayEmbedding, requestOverlapVerdict } from './analysisAi';
import type { OverlapCheckResult } from './models';
import { supabase } from './supabase';

type CurrentVersion = {
  id: string;
  content: string;
  embedding: string | null;
};

type RelatedEssay = {
  id: string;
  essay_versions: CurrentVersion[];
};

type SimilarEssay = {
  essay_id: string;
  title: string;
  content: string;
  similarity: number;
};

function vectorLiteral(values: number[]): string {
  return `[${values.join(',')}]`;
}

export async function generateAndSaveEssayEmbedding(versionId: string, content: string): Promise<string | null> {
  if (!content.trim()) return null;
  const embedding = await createEssayEmbedding(content);
  const embeddingValue = vectorLiteral(embedding);
  const { error } = await supabase
    .from('essay_versions')
    .update({ embedding: embeddingValue })
    .eq('id', versionId);
  if (error) throw error;
  return embeddingValue;
}

async function completeExistingEmbeddings(essayId: string): Promise<void> {
  const { data, error } = await supabase
    .from('essays')
    .select('id, essay_versions!essays_current_version_id_fkey(id, content, embedding)')
    .neq('id', essayId)
    .not('current_version_id', 'is', null);
  if (error) throw error;

  const related = (data ?? []) as RelatedEssay[];
  for (const essay of related) {
    const version = essay.essay_versions[0];
    if (version && !version.embedding && version.content.trim()) {
      await generateAndSaveEssayEmbedding(version.id, version.content);
    }
  }
}

function isSimilarEssay(value: unknown): value is SimilarEssay {
  if (typeof value !== 'object' || value === null) return false;
  const row = value as Record<string, unknown>;
  return typeof row.essay_id === 'string' && typeof row.title === 'string'
    && typeof row.content === 'string' && typeof row.similarity === 'number';
}

export async function checkEssayOverlap(
  essayId: string,
  versionId: string,
  content: string,
  savedEmbedding?: string | null,
): Promise<OverlapCheckResult[]> {
  const targetEmbedding = savedEmbedding ?? await generateAndSaveEssayEmbedding(versionId, content);
  if (!targetEmbedding) return [];

  await completeExistingEmbeddings(essayId);
  const { data, error } = await supabase.rpc('find_similar_essay_versions', {
    target_essay_id: essayId,
    target_embedding: targetEmbedding,
    similarity_threshold: 0.75,
    match_limit: 5,
  });
  if (error) throw error;

  const candidates = (data ?? []).filter(isSimilarEssay);
  const results: OverlapCheckResult[] = [];
  for (const candidate of candidates) {
    const verdict = await requestOverlapVerdict(content, candidate.content);
    results.push({
      essayId: candidate.essay_id,
      title: candidate.title,
      similarity: candidate.similarity,
      ...verdict,
    });
  }
  return results;
}
