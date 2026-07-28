import { useEffect, useState, type FormEvent } from 'react';
import { useLocation } from 'wouter';
import { PageShell } from '../components/PageShell';
import { useSession } from '../lib/auth';
import type { Locale } from '../lib/models';
import { loadProfile, saveProfile } from '../lib/profile';
import { applyPendingReferral } from '../lib/referrals';

const schools = ['Common App', 'Nazarbayev University', 'University of Toronto', 'University of Hong Kong'];

export function OnboardingPage() {
  const { session, loading } = useSession();
  const [, navigate] = useLocation();
  const [locale, setLocale] = useState<Locale>('ru');
  const [school, setSchool] = useState(schools[0]);
  const [applicationType, setApplicationType] = useState('university');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && !session) navigate('/auth/sign-in');
    if (session) {
      void loadProfile().then((profile) => {
        if (profile) {
          setLocale(profile.locale);
          setSchool(profile.target_schools[0] ?? schools[0]);
          setApplicationType(profile.application_type ?? 'university');
        }
      });
      void applyPendingReferral().catch(() => setMessage('Аккаунт создан, но реферальный бонус пока не удалось применить. Обнови страницу.'));
    }
  }, [loading, navigate, session]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    try {
      await saveProfile({ full_name: null, locale, target_schools: school ? [school] : [], application_type: applicationType });
      navigate('/dashboard');
    } catch {
      setMessage('Не удалось сохранить ответы. Попробуй ещё раз.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <PageShell>
      <main className="narrow-page">
        <section className="onboarding-card">
          <p className="eyebrow">Шаг 1 из 1</p>
          <h1>Сделаем пространство твоим</h1>
          <p className="muted">Эти ответы нужны только для удобной организации твоих эссе.</p>
          <form className="stack-form" onSubmit={(event) => void submit(event)}>
            <label>Язык интерфейса<select value={locale} onChange={(event) => setLocale(event.target.value as Locale)}><option value="ru">Русский</option><option value="kz">Қазақша</option><option value="en">English</option></select></label>
            <label>Главная цель<select value={applicationType} onChange={(event) => setApplicationType(event.target.value)}><option value="university">Университет</option><option value="scholarship">Стипендия</option><option value="grant">Грант</option></select></label>
            <label>Первая школа или система подачи<input list="schools" value={school} onChange={(event) => setSchool(event.target.value)} placeholder="Например, Common App" /><datalist id="schools">{schools.map((item) => <option key={item} value={item} />)}</datalist></label>
            <button disabled={busy}>{busy ? 'Сохраняем…' : 'Перейти к эссе'}</button>
          </form>
          {message && <p className="form-message" role="alert">{message}</p>}
        </section>
      </main>
    </PageShell>
  );
}
