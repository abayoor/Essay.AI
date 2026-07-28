import { useCallback, useEffect, useState } from 'react';
import { useLocation, useParams } from 'wouter';
import { EssayEditor } from '../components/EssayEditor';
import { FeedbackPanel } from '../components/FeedbackPanel';
import { PageShell } from '../components/PageShell';
import { requestFeedback } from '../lib/ai';
import { useSession } from '../lib/auth';
import { loadEssay, saveFeedback, saveVersion } from '../lib/essays';
import type { CoachingFeedback, EssayDetail } from '../lib/models';

export function EssayEditorPage() {
  const { id } = useParams<{ id: string }>();
  const { session, loading } = useSession();
  const [, navigate] = useLocation();
  const [essay, setEssay] = useState<EssayDetail | null>(null);
  const [content, setContent] = useState('');
  const [versionId, setVersionId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<CoachingFeedback | null>(null);
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [error, setError] = useState('');

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
    }).catch(() => setError('Не удалось открыть это эссе.'));
  }, [id, loading, navigate, session]);

  const persist = useCallback(async (text: string) => {
    if (!id) return;
    const version = await saveVersion(id, text);
    setVersionId(version.id);
  }, [id]);

  async function getFeedback() {
    if (!essay || !content.trim()) return;
    setFeedbackLoading(true);
    setError('');
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
      setError(reason instanceof Error ? reason.message : 'Не удалось получить фидбэк. Попробуй ещё раз.');
    } finally {
      setFeedbackLoading(false);
    }
  }

  return (
    <PageShell>
      <main className="editor-page">
        {!essay && <p className="loading-copy">{error || 'Открываем черновик…'}</p>}
        {essay && (
          <>
            <header className="editor-heading"><div><p className="eyebrow">{essay.target_school || 'Личное эссе'}</p><h1>{essay.title}</h1></div><span className="status status-draft">Черновик</span></header>
            <div className="editor-layout">
              <EssayEditor key={essay.id} content={content} onSave={persist} onChange={setContent} />
              <FeedbackPanel feedback={feedback} loading={feedbackLoading} onRequest={() => void getFeedback()} disabled={!content.trim() || feedbackLoading} error={error} />
            </div>
          </>
        )}
      </main>
    </PageShell>
  );
}
