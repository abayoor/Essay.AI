import { useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'wouter';
import { InterviewQuestionCard } from '../components/InterviewQuestionCard';
import { PageShell } from '../components/PageShell';
import { useSession } from '../lib/auth';
import { loadEssay } from '../lib/essays';
import { finishInterview, startInterview } from '../lib/interview';
import type { EssayDetail, InterviewAnswer, InterviewFeedback, InterviewSession } from '../lib/models';

export function InterviewPrepPage() {
  const { id } = useParams<{ id: string }>();
  const { session: authSession, loading } = useSession();
  const [, navigate] = useLocation();
  const [essay, setEssay] = useState<EssayDetail | null>(null);
  const [content, setContent] = useState('');
  const [practice, setPractice] = useState<InterviewSession | null>(null);
  const [answers, setAnswers] = useState<InterviewAnswer[]>([]);
  const [position, setPosition] = useState(0);
  const [feedback, setFeedback] = useState<InterviewFeedback[] | null>(null);
  const [loadingAction, setLoadingAction] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!loading && !authSession) navigate('/auth/sign-in');
    if (!authSession || !id) return;
    void loadEssay(id).then((item) => {
      if (!item) return navigate('/dashboard');
      const latest = [...item.versions].sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
      setEssay(item);
      setContent(latest?.content ?? '');
    }).catch(() => setError('Не удалось открыть эссе для интервью.'));
  }, [authSession, id, loading, navigate]);

  async function begin() {
    if (!essay || !content.trim()) return;
    setLoadingAction(true);
    setError('');
    try {
      const nextPractice = await startInterview(essay.id, content);
      setPractice(nextPractice);
      setAnswers(nextPractice.questions.map((question) => ({ question, answer: '' })));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Не удалось подготовить вопросы. Попробуй ещё раз.');
    } finally {
      setLoadingAction(false);
    }
  }

  function updateAnswer(answer: string) {
    setAnswers((current) => current.map((item, index) => index === position ? { ...item, answer } : item));
  }

  async function complete() {
    if (!practice || answers.some((item) => !item.answer.trim())) {
      setError('Ответь на каждый вопрос, чтобы получить полезный фидбэк.');
      return;
    }
    setLoadingAction(true);
    setError('');
    try {
      setFeedback(await finishInterview(practice.id, content, answers));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Не удалось сравнить ответы с эссе. Попробуй ещё раз.');
    } finally {
      setLoadingAction(false);
    }
  }

  if (!essay) return <PageShell><main className="interview-page"><p className="loading-copy">{error || 'Открываем тренажёр…'}</p></main></PageShell>;
  const currentQuestion = practice?.questions[position];

  return (
    <PageShell>
      <main className="interview-page">
        <header className="interview-intro"><p className="eyebrow">По мотивам твоего текста</p><h1>Пробное интервью</h1><p className="muted">Вопросы опираются на детали именно этого эссе: «{essay.title}».</p></header>
        {!content.trim() && <p className="setup-note">Сначала добавь в эссе несколько предложений — тогда вопросы будут по-настоящему твоими.</p>}
        {!practice && content.trim() && <section className="interview-start"><h2>Готов(а) рассказать историю вслух?</h2><p>Подготовим 5–7 конкретных вопросов, которые мог бы задать интервьюер после чтения этого текста.</p><button onClick={() => void begin()} disabled={loadingAction}>{loadingAction ? 'Готовим вопросы…' : 'Начать интервью'}</button></section>}
        {currentQuestion && !feedback && <>
          <InterviewQuestionCard question={currentQuestion} value={answers[position]?.answer ?? ''} questionNumber={position + 1} total={practice?.questions.length ?? 0} onChange={updateAnswer} onNext={() => setPosition((current) => current + 1)} isLast={position === (practice?.questions.length ?? 1) - 1} />
          {position === (practice?.questions.length ?? 1) - 1 && <button className="interview-finish" onClick={() => void complete()} disabled={loadingAction}>{loadingAction ? 'Сравниваем ответы…' : 'Завершить и получить фидбэк'}</button>}
        </>}
        {error && <p className="form-message" role="alert">{error}</p>}
        {feedback && <section className="interview-feedback"><p className="eyebrow">Итог интервью</p><h2>Как ответы соотносятся с эссе</h2><ol>{feedback.map((item, index) => <li key={item.question + index}><strong>{item.question}</strong>{item.consistency_note}</li>)}</ol></section>}
        <p className="small-text"><Link href={`/essays/${essay.id}/edit`}>Вернуться к эссе</Link></p>
      </main>
    </PageShell>
  );
}
