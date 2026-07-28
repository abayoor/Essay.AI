import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'wouter';
import { EssayEditor } from '../components/EssayEditor';
import { EssayProgress } from '../components/EssayProgress';
import { FeedbackPanel } from '../components/FeedbackPanel';
import { OverlapCheckPanel } from '../components/OverlapCheckPanel';
import { PageShell } from '../components/PageShell';
import { requestFeedback } from '../lib/ai';
import { requestPersonaFeedback } from '../lib/analysisAi';
import { useSession } from '../lib/auth';
import { checkEssayOverlap } from '../lib/essayOverlap';
import { loadEssay, saveFeedback, saveVersion } from '../lib/essays';
import { hasCompletedInterview } from '../lib/interview';
import type { CoachingFeedback, EssayDetail, PersonaFeedback } from '../lib/models';

export function EssayEditorPage() {
  const { id } = useParams<{ id: string }>();
  const { session, loading } = useSession();
  const [, navigate] = useLocation();
  const [essay, setEssay] = useState<EssayDetail | null>(null);
  const [content, setContent] = useState('');
  const [versionId, setVersionId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<CoachingFeedback | null>(null);
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [feedbackError, setFeedbackError] = useState('');
  const [feedbackStream, setFeedbackStream] = useState('');
  const [personas, setPersonas] = useState<PersonaFeedback | null>(null);
  const [personasLoading, setPersonasLoading] = useState(false);
  const [personasError, setPersonasError] = useState('');
  const [personasStream, setPersonasStream] = useState('');
  const [overlapChecked, setOverlapChecked] = useState(false);
  const [interviewReady, setInterviewReady] = useState(false);
  const [loadError, setLoadError] = useState('');

  const load = useCallback(async () => {
    if (!id) return;
    setLoadError('');
    try {
      const item = await loadEssay(id);
      if (!item) return navigate('/dashboard');
      const latest = [...item.versions].sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
      setEssay(item);
      setContent(latest?.content ?? '');
      setVersionId(latest?.id ?? null);
      setInterviewReady(await hasCompletedInterview(item.id));
    } catch {
      setLoadError('Не удалось открыть это эссе.');
    }
  }, [id, navigate]);

  useEffect(() => {
    if (!loading && !session) navigate('/auth/sign-in');
    if (session) void load();
  }, [load, loading, navigate, session]);

  const persist = useCallback(async (text: string) => {
    if (!id) return;
    const version = await saveVersion(id, text);
    setVersionId(version.id);
  }, [id]);

  async function getFeedback() {
    if (!essay || !content.trim()) return;
    setFeedbackLoading(true);
    setFeedbackError('');
    setFeedbackStream('');
    try {
      const latestVersion = versionId ?? (await saveVersion(essay.id, content)).id;
      setVersionId(latestVersion);
      const result = await requestFeedback(content, essay.target_school, (chunk) => {
        setFeedbackStream((current) => current + chunk);
      });
      setFeedback(result);
      await saveFeedback(latestVersion, result);
    } catch (reason) {
      setFeedbackError(reason instanceof Error ? reason.message : 'Не удалось получить фидбэк. Попробуй ещё раз.');
    } finally {
      setFeedbackLoading(false);
    }
  }

  async function getPersonas() {
    if (!content.trim()) return;
    setPersonasLoading(true);
    setPersonasError('');
    setPersonasStream('');
    try {
      setPersonas(await requestPersonaFeedback(content, (chunk) => setPersonasStream((current) => current + chunk)));
    } catch (reason) {
      setPersonasError(reason instanceof Error ? reason.message : 'Не удалось получить мнения читателей. Попробуй ещё раз.');
    } finally {
      setPersonasLoading(false);
    }
  }

  async function findOverlaps(onChunk: (chunk: string) => void) {
    if (!essay || !content.trim()) return [];
    const version = await saveVersion(essay.id, content);
    setVersionId(version.id);
    return checkEssayOverlap(essay.id, version.id, content, version.embedding, onChunk);
  }

  return (
    <PageShell>
      <main className="editor-page">
        {!essay && <section className="loading-copy"><p>{loadError || 'Открываем черновик…'}</p>{loadError && <button className="text-button" onClick={() => void load()}>Попробовать снова</button>}</section>}
        {essay && <>
          <header className="editor-heading"><div><p className="eyebrow">{essay.target_school || 'Личное эссе'}</p><h1>{essay.title}</h1><div className="editor-actions"><Link href={`/essays/${essay.id}/interview-prep`} className="secondary-button">Тренажёр интервью</Link></div></div><span className="status status-draft">Черновик</span></header>
          <EssayProgress draftReady={Boolean(content.trim())} feedbackReady={Boolean(feedback)} personasReady={Boolean(personas)} overlapChecked={overlapChecked} interviewReady={interviewReady} />
          <div className="editor-layout">
            <EssayEditor key={essay.id} content={content} onSave={persist} onChange={setContent} />
            <FeedbackPanel feedback={feedback} loading={feedbackLoading} onRequest={() => void getFeedback()} disabled={!content.trim()} error={feedbackError} personas={personas} personasLoading={personasLoading} personasError={personasError} onRequestPersonas={() => void getPersonas()} streamText={feedbackStream} personasStreamText={personasStream} />
          </div>
          <OverlapCheckPanel disabled={!content.trim()} onCheck={findOverlaps} onComplete={() => setOverlapChecked(true)} nextHref={`/essays/${essay.id}/interview-prep`} />
        </>}
      </main>
    </PageShell>
  );
}
