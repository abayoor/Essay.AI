import { useState, type FormEvent } from 'react';
import { Link, useLocation } from 'wouter';
import { PageShell } from '../components/PageShell';
import { resendSignupCode, verifySignupCode } from '../lib/auth';

function emailFromUrl(): string {
  return new URLSearchParams(window.location.search).get('email') ?? '';
}

export function ConfirmEmailPage() {
  const [, navigate] = useLocation();
  const [email, setEmail] = useState(emailFromUrl);
  const [code, setCode] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const token = code.replace(/\s/g, '');
    if (!/^\d{6}$/.test(token)) {
      setMessage('Введи шесть цифр из письма.');
      return;
    }

    setBusy(true);
    setMessage('');
    const { error } = await verifySignupCode(email, token);
    setBusy(false);
    if (error) {
      setMessage('Код не подошёл или уже истёк. Запроси новый и попробуй ещё раз.');
      return;
    }
    navigate('/onboarding');
  }

  async function resend() {
    setBusy(true);
    setMessage('');
    const { error } = await resendSignupCode(email);
    setBusy(false);
    setMessage(error ? 'Не удалось отправить новый код. Подожди минуту и повтори.' : 'Новый код отправлен на почту.');
  }

  return (
    <PageShell>
      <main className="auth-page">
        <section className="auth-card">
          <p className="eyebrow">Подтверждение почты</p>
          <h1>Введи код из письма</h1>
          <p className="muted">Мы отправили на почту одноразовый код из шести цифр.</p>
          <form onSubmit={(event) => void submit(event)} className="stack-form">
            <label>Электронная почта<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
            <label>Код<input value={code} onChange={(event) => setCode(event.target.value)} inputMode="numeric" autoComplete="one-time-code" maxLength={6} required /></label>
            <button disabled={busy} type="submit">{busy ? 'Проверяем…' : 'Подтвердить аккаунт'}</button>
          </form>
          <button className="text-button" disabled={busy || !email} onClick={() => void resend()}>Отправить код ещё раз</button>
          {message && <p className="form-message" role="alert">{message}</p>}
          <p className="muted small-text">Если код не пришёл, проверь папку «Спам». Если аккаунт с этой почтой уже создан, <Link href="/auth/sign-in">войди</Link> вместо повторной регистрации.</p>
        </section>
      </main>
    </PageShell>
  );
}
