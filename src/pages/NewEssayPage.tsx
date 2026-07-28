import { useEffect, useState, type FormEvent } from 'react';
import { useLocation } from 'wouter';
import { PageShell } from '../components/PageShell';
import { useSession } from '../lib/auth';
import { createEssay } from '../lib/essays';
import type { EssayType } from '../lib/models';

function creationErrorMessage(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'PGRST205') {
    return 'В Supabase ещё нет таблицы для эссе. Нужно применить миграцию базы — после этого создание заработает.';
  }
  return 'Не удалось создать эссе. Проверь подключение к базе и попробуй ещё раз.';
}

export function NewEssayPage() {
  const { session, loading } = useSession();
  const [, navigate] = useLocation();
  const [title, setTitle] = useState('');
  const [school, setSchool] = useState('');
  const [essayType, setEssayType] = useState<EssayType>('personal_statement');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!loading && !session) navigate('/auth/sign-in');
  }, [loading, navigate, session]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    try {
      const id = await createEssay({ title, targetSchool: school, essayType });
      navigate('/essays/' + id + '/edit');
    } catch (error) {
      setMessage(creationErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <PageShell>
      <main className="narrow-page">
        <section className="onboarding-card">
          <p className="eyebrow">Новое эссе</p>
          <h1>Начнём с контекста</h1>
          <p className="muted">Не нужно иметь идеальный план. Достаточно назвать черновик и открыть страницу.</p>
          <form className="stack-form" onSubmit={(event) => void submit(event)}>
            <label>Название эссе<input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Например, Common App — первый черновик" maxLength={120} required /></label>
            <label>Школа или система подачи<input value={school} onChange={(event) => setSchool(event.target.value)} placeholder="Например, Common App" /></label>
            <label>Тип эссе<select value={essayType} onChange={(event) => setEssayType(event.target.value as EssayType)}><option value="personal_statement">Личное эссе</option><option value="supplemental">Дополнительное эссе</option><option value="scholarship">Стипендия</option><option value="grant">Грант</option></select></label>
            <button disabled={busy}>{busy ? 'Создаём…' : 'Открыть редактор'}</button>
          </form>
          {message && <p className="form-message" role="alert">{message}</p>}
        </section>
      </main>
    </PageShell>
  );
}
