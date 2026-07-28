import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'wouter';
import { AiStreamPreview } from '../components/AiStreamPreview';
import { InterviewQuestionCard } from '../components/InterviewQuestionCard';
import { PageShell } from '../components/PageShell';
import { useSession } from '../lib/auth';
import { loadEssay } from '../lib/essays';
import { finishInterview, startInterview } from '../lib/interview';
import type { EssayDetail, InterviewAnswer, InterviewFeedback, InterviewSession } from '../lib/models';

type RetryAction = 'start' | 'finish' | null;

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
  const [pending, setPending] = useState<RetryAction>(null);
  const [retryAction, setRetryAction] = useState<RetryAction>(null);
  const [streamText, setStreamText] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!id) return;
    setError('');
    try {
      const item = await loadEssay(id);
      if (!item) return navigate('/dashboard');
      const latest = [...item.versions].sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
      setEssay(item);
      setContent(latest?.content ?? '');
    } catch {
      setError('Не удалось открыть эссе для интервью.');
    }
  }, [id, navigate]);

  useEffect(() => {
    if (!loading && !authSession) navigate('/auth/sign-in');
    if (authSession) void load();
  }, [authSession, load, loading, navigate]);

  async function begin() {
    if (!essay || !content.trim()) return;
    setPending('start');
    setRetryAction(null);
    setError('');
    setStreamText('');
    try {
      const nextPractice = await startInterview(essay.id, content, (chunk) => setStreamText((current) => current + chunk));
      setPractice(nextPractice);
      setAnswers(nextPractice.questions.map((item) => ({ question: item.question, answer: '' })));
    } catch (reason) {
      setRetryAction('start');
      setError(reason instanceof Error ? reason.message : 'Не удалось подготовить вопросы. Попробуй ещё раз.');
    } finally {
      setPending(null);
    }
  }

  function updateAnswer(answer: string) {
    setAnswers((current) => current.map((item, index) => index === position ? { ...item, answer } : item));
  }

  async function complete() {
    if (!practice || answers.some((item) => !item.answer.trim())) {
      setRetryAction(null);
      setError('Ответь на каждый вопрос, чтобы получить полезный фидбэк.');
      return;
    }
    setPending('finish');
    setRetryAction(null);
    setError('');
    setStreamText('');
    try {
      setFeedback(await finishInterview(practice.id, content, answers, (chunk) => setStreamText((current) => current + chunk)));
    } catch (reason) {
      setRetryAction('finish');
      setError(reason instanceof Error ? reason.message : 'Не удалось сравнить ответы с эссе. Попробуй ещё раз.');
    } finally {
      setPending(null);
    }
  }

  if (!essay) return <PageShell><main className="interview-page"><section className="loading-copy"><p>{error || 'Открываем тренажёр…'}</p>{error && <button className="text-button" onClick={() => void load()}>Попробовать снова</button>}</section></main></PageShell>;
  const currentQuestion = practice?.questions[position];
  const answerIsReady = Boolean(answers[position]?.answer.trim());

  return (
    <PageShell>
      <main className="interview-page">
        <header className="interview-intro"><p className="eyebrow">По мотивам твоего текста</p><h1>Пробное интервью</h1><p className="muted">Вопросы опираются на детали именно этого эссе: «{essay.title}».</p></header>
        {!content.trim() && <p className="setup-note">Сначала добавь в эссе несколько предложений — тогда вопросы будут по-настоящему твоими.</p>}
        {!practice && content.trim() && <section className="interview-start"><h2>Готов(а) рассказать историю вслух?</h2><p>Подготовим 5–7 конкретных вопросов, которые мог бы задать интервьюер после чтения этого текста.</p><button onClick={() => void begin()} disabled={pending === 'start'}>{pending === 'start' ? 'Готовим вопросы…' : 'Начать интервью'}</button>{pending === 'start' && <AiStreamPreview label="Интервьюер выбирает детали из твоего эссе…" text={streamText} />}</section>}
        {currentQuestion && !feedback && <><InterviewQuestionCard question={currentQuestion.question} category={currentQuestion.category} value={answers[position]?.answer ?? ''} questionNumber={position + 1} total={practice?.questions.length ?? 0} onChange={updateAnswer} onNext={() => setPosition((current) => current + 1)} isLast={position === (practice?.questions.length ?? 1) - 1} />{position === (practice?.questions.length ?? 1) - 1 && <button className="interview-finish" onClick={() => void complete()} disabled={pending === 'finish' || !answerIsReady}>{pending === 'finish' ? 'Сравниваем ответы…' : 'Завершить и получить фидбэк'}</button>}{pending === 'finish' && <AiStreamPreview label="Сверяем ответы с твоими формулировками…" text={streamText} />}</>}
        {error && <div className="error-action" role="alert"><p className="form-message">{error}</p>{retryAction && <button className="text-button" onClick={() => void (retryAction === 'start' ? begin() : complete())} disabled={Boolean(pending)}>Попробовать снова</button>}</div>}
        {feedback && <section className="interview-feedback"><p className="eyebrow">Итог интервью</p><h2>Как ответы соотносятся с эссе</h2><ol>{feedback.map((item, index) => <li key={item.question + index}><strong>{item.question}</strong>{item.consistency_note}</li>)}</ol></section>}
        <p className="small-text"><Link href={`/essays/${essay.id}/edit`}>Вернуться к эссе</Link></p>
      </main>
    </PageShell>
  );
}
