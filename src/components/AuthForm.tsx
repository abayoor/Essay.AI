import { useState, type FormEvent } from 'react';
import { Link, useLocation } from 'wouter';
import { startGoogleSignIn, signUpWithEmail } from '../lib/auth';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { PasswordField } from './PasswordField';
import { SupabaseSetupMessage } from './SupabaseSetupMessage';

type AuthFormProps = {
  mode: 'sign-in' | 'sign-up';
};

function authErrorMessage(error: string): string {
  if (error.toLowerCase().includes('already registered')) {
    return 'Этот адрес уже зарегистрирован. Войди с паролем на странице входа.';
  }
  return 'Не удалось выполнить вход. Проверь почту и пароль.';
}

export function AuthForm({ mode }: AuthFormProps) {
  const [, navigate] = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const isSignUp = mode === 'sign-up';

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (password.length < 8) {
      setMessage('Пароль должен быть не короче 8 символов.');
      return;
    }

    setBusy(true);
    setMessage('');
    const action = isSignUp
      ? signUpWithEmail(email, password)
      : supabase.auth.signInWithPassword({ email, password });
    const { data, error } = await action;
    setBusy(false);

    if (error) {
      if (!isSignUp && error.message.toLowerCase().includes('email not confirmed')) {
        navigate(`/auth/confirm?email=${encodeURIComponent(email)}`);
        return;
      }
      setMessage(authErrorMessage(error.message));
      return;
    }
    if (isSignUp && !data.session) {
      navigate(`/auth/confirm?email=${encodeURIComponent(email)}`);
      return;
    }
    navigate(isSignUp ? '/onboarding' : '/dashboard');
  }

  async function signInWithGoogle() {
    setBusy(true);
    setMessage('');
    const { error } = await startGoogleSignIn();
    if (error) {
      setMessage(error.message.includes('provider is not enabled')
        ? 'Вход через Google пока не включён в настройках Supabase.'
        : 'Не удалось начать вход через Google. Попробуй ещё раз.');
      setBusy(false);
    }
  }

  if (!isSupabaseConfigured) return <SupabaseSetupMessage />;

  return (
    <section className="auth-card">
      <p className="eyebrow">EssayCoach</p>
      <h1>{isSignUp ? 'Создай личное пространство для эссе' : 'С возвращением'}</h1>
      <p className="muted">ИИ помогает думать и замечать детали, но твой текст всегда остаётся твоим.</p>
      <form onSubmit={(event) => void submit(event)} className="stack-form">
        <label>Электронная почта<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
        <PasswordField value={password} onChange={(event) => setPassword(event.target.value)} />
        <button disabled={busy} type="submit">{busy ? 'Подождём…' : isSignUp ? 'Создать аккаунт' : 'Войти'}</button>
      </form>
      <div className="separator">или</div>
      <button className="secondary-button" disabled={busy} onClick={() => void signInWithGoogle()}>Продолжить с Google</button>
      {message && <p className="form-message" role="alert">{message}</p>}
      <p className="muted small-text">
        {isSignUp ? 'Уже есть аккаунт? ' : 'Впервые здесь? '}
        <Link href={isSignUp ? '/auth/sign-in' : '/auth/sign-up'}>{isSignUp ? 'Войти' : 'Зарегистрироваться'}</Link>
      </p>
    </section>
  );
}
