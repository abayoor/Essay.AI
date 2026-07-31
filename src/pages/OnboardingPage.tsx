import { useEffect, useState, type FormEvent } from 'react';
import { useLocation } from 'wouter';
import { CityAutocomplete } from '../components/CityAutocomplete';
import { PageShell } from '../components/PageShell';
import { useSession } from '../lib/auth';
import { useLocaleText } from '../lib/localized';
import { isUsernameAvailable, loadRiderProfile, saveRiderProfile } from '../lib/rider';
import {
  isGeneratedUsername,
  isUsernameConflict,
  isValidUsername,
  normalizeUsername,
} from '../lib/usernames';

export function OnboardingPage() {
  const { session, loading } = useSession();
  const text = useLocaleText();
  const [, navigate] = useLocation();
  const [username, setUsername] = useState('');
  const [originalUsername, setOriginalUsername] = useState('');
  const [name, setName] = useState('');
  const [city, setCity] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && !session) navigate('/auth/sign-in');
    if (!session) return;

    void loadRiderProfile().then((profile) => {
      const storedUsername = profile?.username ?? '';
      const visibleUsername = isGeneratedUsername(storedUsername) ? '' : storedUsername;
      setUsername(visibleUsername);
      setOriginalUsername(visibleUsername);
      setName(profile?.full_name ?? '');
      setCity(profile?.home_city ?? '');
    }).catch(() => setMessage(text(
      'Не удалось загрузить профиль.',
      'Профильді жүктеу мүмкін болмады.',
      'Could not load the profile.',
    )));
  }, [loading, navigate, session, text]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedUsername = normalizeUsername(username);
    if (!isValidUsername(normalizedUsername)) {
      setMessage(text(
        'Никнейм: 3–48 символов, только латинские буквы, цифры, _ и -.',
        'Никнейм: 3–48 таңба, тек латын әріптері, сандар, _ және -.',
        'Username: 3–48 characters using letters, numbers, _ and -.',
      ));
      return;
    }

    setBusy(true);
    setMessage('');
    try {
      if (normalizedUsername !== normalizeUsername(originalUsername)
        && !await isUsernameAvailable(normalizedUsername)) {
        setMessage(text(
          'Этот никнейм уже занят. Выбери другой.',
          'Бұл никнейм бос емес. Басқасын таңда.',
          'This username is already taken. Choose another one.',
        ));
        return;
      }

      await saveRiderProfile({
        username: normalizedUsername,
        full_name: name.trim() || null,
        home_city: city.trim() || null,
      });
      navigate('/dashboard');
    } catch (error) {
      setMessage(isUsernameConflict(error) ? text(
        'Этот никнейм уже занят. Выбери другой.',
        'Бұл никнейм бос емес. Басқасын таңда.',
        'This username is already taken. Choose another one.',
      ) : text(
        'Не удалось сохранить профиль. Попробуй ещё раз.',
        'Профильді сақтау мүмкін болмады. Қайта көр.',
        'Could not save the profile. Please try again.',
      ));
    } finally {
      setBusy(false);
    }
  }

  return <PageShell><main className="auth-page"><section className="auth-card">
    <p className="kicker">{text('Первый выезд', 'Алғашқы сапар', 'First ride')}</p>
    <h1>{text('Создай профиль райдера.', 'Райдер профилін жаса.', 'Create your rider profile.')}</h1>
    <p>{text(
      'Выбери уникальный никнейм и город — так тебя легко найдут другие райдеры.',
      'Бірегей никнейм мен қаланы таңда — сонда басқа райдерлер сені оңай табады.',
      'Choose a unique username and city so other riders can find you.',
    )}</p>
    <form className="cycle-form" onSubmit={(event) => void submit(event)}>
      <label>{text('Никнейм', 'Никнейм', 'Username')}
        <div className="username-input-wrap">
          <span aria-hidden="true">@</span>
          <input
            required
            minLength={3}
            maxLength={48}
            autoComplete="username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            onBlur={() => setUsername((current) => normalizeUsername(current))}
            placeholder="rider_name"
          />
        </div>
        <small>{text(
          '3–48 символов. Латиница, цифры, _ и -.',
          '3–48 таңба. Латын әріптері, сандар, _ және -.',
          '3–48 characters. Letters, numbers, _ and -.',
        )}</small>
      </label>
      <label>{text('Как к тебе обращаться?', 'Саған қалай хабарласамыз?', 'What should we call you?')}
        <input required value={name} onChange={(event) => setName(event.target.value)} maxLength={80} />
      </label>
      <div className="city-form-field">
        <span>{text('Твой город', 'Сенің қалаң', 'Your city')}</span>
        <CityAutocomplete required value={city} onChange={setCity} />
      </div>
      <button className="signal-button" disabled={busy}>
        {busy
          ? text('Сохраняем…', 'Сақталуда…', 'Saving…')
          : text('Открыть сводку', 'Шолуды ашу', 'Open overview')}
      </button>
    </form>
    {message && <p className="form-note" role="alert">{message}</p>}
  </section></main></PageShell>;
}
