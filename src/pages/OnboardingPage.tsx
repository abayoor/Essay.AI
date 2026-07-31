import { useEffect, useState, type FormEvent } from 'react';
import { useLocation } from 'wouter';
import { CityAutocomplete } from '../components/CityAutocomplete';
import { PageShell } from '../components/PageShell';
import { useSession } from '../lib/auth';
import { loadRiderProfile, saveRiderProfile } from '../lib/rider';
import { useLocaleText } from '../lib/localized';

export function OnboardingPage() {
  const { session, loading } = useSession();
  const text = useLocaleText();
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
      setMessage(text('Не удалось сохранить профиль. Попробуй ещё раз.', 'Профильді сақтау мүмкін болмады. Қайта көр.', 'Could not save the profile. Please try again.'));
    } finally {
      setBusy(false);
    }
  }

  return <PageShell><main className="auth-page"><section className="auth-card"><p className="kicker">{text('Первый выезд', 'Алғашқы сапар', 'First ride')}</p><h1>{text('Покажи, где ты катаешься.', 'Қай жерде жүретініңді көрсет.', 'Show us where you ride.')}</h1><p>{text('Выбери город из подсказок — так маршруты и райдеры рядом будут точнее.', 'Ұсыныстардан қаланы таңда — сонда жақын бағыттар мен райдерлер дәлірек көрсетіледі.', 'Choose a city from the suggestions for more accurate nearby routes and riders.')}</p><form className="cycle-form" onSubmit={(event) => void submit(event)}><label>{text('Как к тебе обращаться?', 'Саған қалай хабарласамыз?', 'What should we call you?')}<input required value={name} onChange={(event) => setName(event.target.value)} maxLength={80} /></label><div className="city-form-field"><span>{text('Твой город', 'Сенің қалаң', 'Your city')}</span><CityAutocomplete required value={city} onChange={setCity} /></div><button className="signal-button" disabled={busy}>{busy ? text('Сохраняем…', 'Сақталуда…', 'Saving…') : text('Открыть сводку', 'Шолуды ашу', 'Open overview')}</button></form>{message && <p className="form-note" role="alert">{message}</p>}</section></main></PageShell>;
}
