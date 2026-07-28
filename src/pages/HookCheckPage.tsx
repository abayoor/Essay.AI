import { useState, type FormEvent } from 'react';
import { Link } from 'wouter';
import { PageShell } from '../components/PageShell';
import { requestHookCheck } from '../lib/hookCheck';

export function HookCheckPage() {
  const [content, setContent] = useState('');
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!content.trim()) return;
    setLoading(true);
    setError('');
    try {
      setFeedback(await requestHookCheck(content.trim()));
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
          {error && <p className="form-message" role="alert">{error}</p>}
          {feedback && <section className="hook-result"><p className="eyebrow">Отклик коуча</p><p>{feedback}</p><div><p>Хочешь полный разбор эссе — структуру, клише, голос и сравнение с другими твоими эссе?</p><Link href="/auth/sign-up" className="primary-link">Зарегистрироваться бесплатно</Link></div></section>}
        </section>
      </main>
    </PageShell>
  );
}
