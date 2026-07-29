import { useEffect, useState, type FormEvent } from 'react';
import { useLocation } from 'wouter';
import { CityAutocomplete } from '../components/CityAutocomplete';
import { PageShell } from '../components/PageShell';
import { useSession } from '../lib/auth';
import { loadRiderProfile, saveRiderProfile } from '../lib/rider';

export function OnboardingPage() {
  const { session, loading } = useSession();
  const [, navigate] = useLocation();
  const [name, setName] = useState('');
  const [city, setCity] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && !session) navigate('/auth/sign-in');
    if (session) void loadRiderProfile().then((profile) => {
      setName(profile?.full_name ?? '');
      setCity(profile?.home_city ?? '');
    });
  }, [loading, navigate, session]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    try {
      await saveRiderProfile({ full_name: name.trim() || null, home_city: city.trim() || null, avatar_url: null, bio: null });
      navigate('/dashboard');
    } catch {
      setMessage('Не удалось сохранить профиль. Попробуй ещё раз.');
    } finally {
      setBusy(false);
    }
  }

  return <PageShell><main className="auth-page"><section className="auth-card"><p className="kicker">Первый выезд</p><h1>Покажи, где ты катаешься.</h1><p>Выбери город из подсказок — так маршруты и райдеры рядом будут точнее.</p><form className="cycle-form" onSubmit={(event) => void submit(event)}><label>Как к тебе обращаться?<input required value={name} onChange={(event) => setName(event.target.value)} maxLength={80} /></label><div className="city-form-field"><span>Твой город</span><CityAutocomplete required value={city} onChange={setCity} /></div><button className="signal-button" disabled={busy}>{busy ? 'Сохраняем…' : 'Открыть сводку'}</button></form>{message && <p className="form-note" role="alert">{message}</p>}</section></main></PageShell>;
}
