import { useState, type FormEvent } from 'react';
import { Link, useLocation } from 'wouter';
import { PageShell } from '../components/PageShell';
import { resendSignupCode, verifySignupCode } from '../lib/auth';

export function ConfirmEmailPage() {
  const [, navigate] = useLocation(); const [email, setEmail] = useState(new URLSearchParams(window.location.search).get('email') ?? ''); const [code, setCode] = useState(''); const [message, setMessage] = useState(''); const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setBusy(true); setMessage(''); const { error } = await verifySignupCode(email, code.replace(/\s/g, '')); setBusy(false); if (error) { setMessage('Код не подошёл или уже истёк.'); return; } navigate('/onboarding'); }
  async function resend() { setBusy(true); const { error } = await resendSignupCode(email); setBusy(false); setMessage(error ? 'Не удалось отправить новый код.' : 'Новый код отправлен на почту.'); }
  return <PageShell><main className="auth-page"><section className="auth-card"><p className="kicker">Подтверждение</p><h1>Проверь почту.</h1><p>Введи шесть цифр из письма, и можно выходить на маршрут.</p><form className="cycle-form" onSubmit={(event) => void submit(event)}><label>Почта<input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} /></label><label>Код<input required inputMode="numeric" maxLength={6} value={code} onChange={(event) => setCode(event.target.value)} /></label><button className="signal-button" disabled={busy}>Подтвердить</button></form><button className="quiet-button" disabled={busy} onClick={() => void resend()}>Отправить код ещё раз</button>{message && <p className="form-note" role="status">{message}</p>}<p className="auth-switch"><Link href="/auth/sign-in">Вернуться ко входу</Link></p></section></main></PageShell>;
}
