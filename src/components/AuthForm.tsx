import { useState, type FormEvent } from 'react';
import { Link, useLocation } from 'wouter';
import { signUpWithEmail, startGoogleSignIn } from '../lib/auth';
import { useLocaleText } from '../lib/localized';
import { isUsernameAvailable } from '../lib/rider';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { isValidUsername, normalizeUsername } from '../lib/usernames';
import { BrandLogo } from './BrandLogo';

export function AuthForm({ mode }: { mode: 'sign-in' | 'sign-up' }) {
  const text = useLocaleText();
  const [, navigate] = useLocation();
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const isSignup = mode === 'sign-up';

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (password.length < 8) {
      setMessage(text(
        'Пароль должен быть не короче 8 символов.',
        'Құпиясөз кемінде 8 таңбадан тұруы керек.',
        'Password must be at least 8 characters.',
      ));
      return;
    }

    const normalizedUsername = normalizeUsername(username);
    if (isSignup && !isValidUsername(normalizedUsername)) {
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
      if (isSignup && !await isUsernameAvailable(normalizedUsername)) {
        setMessage(text(
          'Этот никнейм уже занят. Выбери другой.',
          'Бұл никнейм бос емес. Басқасын таңда.',
          'This username is already taken. Choose another one.',
        ));
        return;
      }

      const { data, error } = await (isSignup
        ? signUpWithEmail(email, password, normalizedUsername)
        : supabase.auth.signInWithPassword({ email, password }));

      if (error) {
        setMessage(isSignup ? text(
          'Не удалось создать аккаунт. Проверь почту или выбери другой никнейм.',
          'Аккаунт жасау мүмкін болмады. Поштаны тексер немесе басқа никнейм таңда.',
          'Could not create the account. Check the email or choose another username.',
        ) : text(
          'Не удалось войти. Проверь почту и пароль.',
          'Кіру мүмкін болмады. Пошта мен құпиясөзді тексер.',
          'Could not sign in. Check your email and password.',
        ));
        return;
      }

      if (isSignup && !data.session) {
        navigate(`/auth/confirm?email=${encodeURIComponent(email)}`);
        return;
      }
      navigate(isSignup ? '/onboarding' : '/dashboard');
    } catch {
      setMessage(text(
        'Не удалось подключиться к аккаунту. Попробуй ещё раз.',
        'Аккаунтқа қосылу мүмкін болмады. Қайта көр.',
        'Could not connect to your account. Try again.',
      ));
    } finally {
      setBusy(false);
    }
  }

  async function google() {
    setBusy(true);
    setMessage('');
    try {
      const { data, error } = await startGoogleSignIn();
      if (error || !data.url) {
        setMessage(error?.message.includes('provider is not enabled') ? text(
          'Вход через Google пока не подключён.',
          'Google арқылы кіру әлі қосылмаған.',
          'Google sign-in is not enabled yet.',
        ) : text(
          'Не удалось открыть Google.',
          'Google ашылмады.',
          'Could not open Google.',
        ));
        return;
      }
      window.location.assign(data.url);
    } catch {
      setMessage(text(
        'Не удалось открыть Google.',
        'Google ашылмады.',
        'Could not open Google.',
      ));
    } finally {
      setBusy(false);
    }
  }

  if (!isSupabaseConfigured) {
    return <main className="auth-page"><section className="auth-card">
      <h1>{text('Supabase ещё не подключён', 'Supabase әлі қосылмаған', 'Supabase is not connected yet')}</h1>
      <p>{text(
        'Добавь настройки окружения, чтобы запустить сообщество.',
        'Қауымдастықты іске қосу үшін орта параметрлерін қос.',
        'Add environment settings to launch the community.',
      )}</p>
    </section></main>;
  }

  return <section className="auth-card">
    <BrandLogo className="auth-brand-logo" />
    <h1>{isSignup
      ? text('Начни свой путь.', 'Өз жолыңды баста.', 'Start your journey.')
      : text('С возвращением.', 'Қайта келгеніңе қуаныштымыз.', 'Welcome back.')}</h1>
    <p>{text(
      'Твой гараж, твои километры и дороги рядом.',
      'Сенің гаражың, километрлерің және жақын жолдар.',
      'Your garage, your kilometres and nearby roads.',
    )}</p>
    <form className="cycle-form" onSubmit={(event) => void submit(event)}>
      {isSignup && <label>{text('Никнейм', 'Никнейм', 'Username')}
        <div className="username-input-wrap">
          <span aria-hidden="true">@</span>
          <input
            type="text"
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
          'Он будет виден в профиле и ссылке. Никнеймы не повторяются.',
          'Ол профильде және сілтемеде көрінеді. Никнеймдер қайталанбайды.',
          'It appears in your profile and link. Usernames are unique.',
        )}</small>
      </label>}
      <label>{text('Электронная почта', 'Электрондық пошта', 'Email')}
        <input type="email" required autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} />
      </label>
      <label>{text('Пароль', 'Құпиясөз', 'Password')}
        <input
          type="password"
          required
          minLength={8}
          autoComplete={isSignup ? 'new-password' : 'current-password'}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </label>
      <button className="signal-button" disabled={busy}>
        {busy
          ? text('Подождём…', 'Күте тұрыңыз…', 'Please wait…')
          : isSignup
            ? text('Создать аккаунт', 'Аккаунт жасау', 'Create account')
            : text('Войти', 'Кіру', 'Sign in')}
      </button>
    </form>
    <div className="auth-separator">{text('или', 'немесе', 'or')}</div>
    <button type="button" className="outline-button" disabled={busy} onClick={() => void google()}>
      {text('Продолжить с Google', 'Google арқылы жалғастыру', 'Continue with Google')}
    </button>
    {message && <p className="form-note" role="alert">{message}</p>}
    <p className="auth-switch">
      {isSignup
        ? text('Уже есть аккаунт?', 'Аккаунтың бар ма?', 'Already have an account?')
        : text('Впервые здесь?', 'Мұнда алғаш ретсің бе?', 'New here?')}{' '}
      <Link href={isSignup ? '/auth/sign-in' : '/auth/sign-up'}>
        {isSignup
          ? text('Войти', 'Кіру', 'Sign in')
          : text('Создать аккаунт', 'Аккаунт жасау', 'Create account')}
      </Link>
    </p>
  </section>;
}
