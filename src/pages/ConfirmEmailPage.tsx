import { useState, type FormEvent } from 'react';
import { Link, useLocation } from 'wouter';
import { PageShell } from '../components/PageShell';
import { resendSignupCode, verifySignupCode } from '../lib/auth';

export function ConfirmEmailPage() {
  const [, navigate] = useLocation();
  const [email, setEmail] = useState(new URLSearchParams(window.location.search).get('email') ?? '');
  const [code, setCode] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    const { error } = await verifySignupCode(email, code.replace(/\s/g, ''));
    setBusy(false);
    if (error) {
      setMessage('Код не подошёл или уже истёк. Открой письмо и нажми кнопку подтверждения.');
      return;
    }
    navigate('/onboarding');
  }

  async function resend() {
    setBusy(true);
    const { error } = await resendSignupCode(email);
    setBusy(false);
    setMessage(error ? 'Не удалось отправить письмо. Попробуй ещё раз через минуту.' : 'Новое письмо отправлено. Проверь «Входящие» и «Спам».');
  }

  return <PageShell><main className="auth-page"><section className="auth-card"><p className="kicker">Подтверждение</p><h1>Проверь почту.</h1><p>Открой письмо от Supabase и нажми кнопку подтверждения — сайт продолжит вход сам. Если в письме есть шесть цифр, их можно ввести ниже.</p><form className="cycle-form" onSubmit={(event) => void submit(event)}><label>Почта<input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} /></label><label>Код из письма (если есть)<input required inputMode="numeric" maxLength={6} value={code} onChange={(event) => setCode(event.target.value)} /></label><button className="signal-button" disabled={busy}>Подтвердить код</button></form><button className="quiet-button" disabled={busy} onClick={() => void resend()}>Отправить письмо ещё раз</button>{message && <p className="form-note" role="status">{message}</p>}<p className="auth-switch"><Link href="/auth/sign-in">Вернуться ко входу</Link></p></section></main></PageShell>;
}
