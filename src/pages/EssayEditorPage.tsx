import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'wouter';
import { EssayEditor } from '../components/EssayEditor';
import { FeedbackPanel } from '../components/FeedbackPanel';
import { OverlapCheckPanel } from '../components/OverlapCheckPanel';
import { PageShell } from '../components/PageShell';
import { requestFeedback } from '../lib/ai';
import { requestPersonaFeedback } from '../lib/analysisAi';
import { useSession } from '../lib/auth';
import { checkEssayOverlap } from '../lib/essayOverlap';
import { loadEssay, saveFeedback, saveVersion } from '../lib/essays';
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
  const [personas, setPersonas] = useState<PersonaFeedback | null>(null);
  const [personasLoading, setPersonasLoading] = useState(false);
  const [personasError, setPersonasError] = useState('');
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    if (!loading && !session) navigate('/auth/sign-in');
    if (!session || !id) return;
    void loadEssay(id).then((item) => {
      if (!item) {
        navigate('/dashboard');
        return;
      }
      const latest = [...item.versions].sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
      setEssay(item);
      setContent(latest?.content ?? '');
      setVersionId(latest?.id ?? null);
    }).catch(() => setLoadError('Не удалось открыть это эссе.'));
  }, [id, loading, navigate, session]);

  const persist = useCallback(async (text: string) => {
    if (!id) return;
    const version = await saveVersion(id, text);
    setVersionId(version.id);
  }, [id]);

  async function getFeedback() {
    if (!essay || !content.trim()) return;
    setFeedbackLoading(true);
    setFeedbackError('');
    try {
      let latestVersion = versionId;
      if (!latestVersion) {
        const version = await saveVersion(essay.id, content);
        latestVersion = version.id;
        setVersionId(version.id);
      }
      const result = await requestFeedback(content, essay.target_school);
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
    try {
      setPersonas(await requestPersonaFeedback(content));
    } catch (reason) {
      setPersonasError(reason instanceof Error ? reason.message : 'Не удалось получить мнения читателей. Попробуй ещё раз.');
    } finally {
      setPersonasLoading(false);
    }
  }

  async function findOverlaps() {
    if (!essay || !content.trim()) return [];
    const version = await saveVersion(essay.id, content);
    setVersionId(version.id);
    return checkEssayOverlap(essay.id, version.id, content, version.embedding);
  }

  return (
    <PageShell>
      <main className="editor-page">
        {!essay && <p className="loading-copy">{loadError || 'Открываем черновик…'}</p>}
        {essay && (
          <>
            <header className="editor-heading"><div><p className="eyebrow">{essay.target_school || 'Личное эссе'}</p><h1>{essay.title}</h1><div className="editor-actions"><Link href={`/essays/${essay.id}/interview-prep`} className="secondary-button">Тренажёр интервью</Link></div></div><span className="status status-draft">Черновик</span></header>
            <div className="editor-layout">
              <EssayEditor key={essay.id} content={content} onSave={persist} onChange={setContent} />
              <FeedbackPanel feedback={feedback} loading={feedbackLoading} onRequest={() => void getFeedback()} disabled={!content.trim() || feedbackLoading} error={feedbackError} personas={personas} personasLoading={personasLoading} personasError={personasError} onRequestPersonas={() => void getPersonas()} />
            </div>
            <OverlapCheckPanel disabled={!content.trim()} onCheck={findOverlaps} />
          </>
        )}
      </main>
    </PageShell>
  );
}
