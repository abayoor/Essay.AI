import { useState, type FormEvent } from 'react';
import { Link } from 'wouter';
import { AiStreamPreview } from '../components/AiStreamPreview';
import { PageShell } from '../components/PageShell';
import { requestHookCheck } from '../lib/hookCheck';

export function HookCheckPage() {
  const [content, setContent] = useState('');
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [streamText, setStreamText] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await checkHook();
  }

  async function checkHook() {
    if (!content.trim()) return;
    setLoading(true);
    setError('');
    setFeedback('');
    setStreamText('');
    try {
      setFeedback(await requestHookCheck(content.trim(), (chunk) => setStreamText((current) => current + chunk)));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Не удалось проверить хук. Попробуй ещё раз.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <PageShell>
      <main className="hook-page">
        <section className="hook-card">
          <p className="eyebrow">Бесплатная проверка за 10 секунд</p>
          <h1>Сработает ли начало эссе?</h1>
          <p className="muted">Вставь первое предложение или абзац. Мы посмотрим только на силу хука.</p>
          <form onSubmit={(event) => void submit(event)} className="hook-form">
            <label className="visually-hidden" htmlFor="hook-content">Начало эссе</label>
            <textarea id="hook-content" value={content} onChange={(event) => setContent(event.target.value)} placeholder="Например: В семь лет я научился различать голоса птиц по утрам…" maxLength={3000} />
            <button disabled={loading || !content.trim()}>{loading ? 'Смотрим…' : 'Проверить'}</button>
          </form>
          {loading && <AiStreamPreview label="Коуч читает начало по словам…" text={streamText} />}
          {error && <div className="error-action" role="alert"><p className="form-message">{error}</p><button className="text-button" onClick={() => void checkHook()} disabled={loading}>Попробовать снова</button></div>}
          {feedback && <section className="hook-result"><p className="eyebrow">Отклик коуча</p><p>{feedback}</p><div><p>Хочешь полный разбор эссе — структуру, клише, голос и сравнение с другими твоими эссе?</p><Link href="/auth/sign-up" className="primary-link">Зарегистрироваться бесплатно</Link></div></section>}
        </section>
      </main>
    </PageShell>
  );
}
