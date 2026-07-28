import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'wouter';
import { PageShell } from '../components/PageShell';
import { exchangeAuthCode } from '../lib/auth';

export function AuthCallbackPage() {
  const [, navigate] = useLocation(); const [message, setMessage] = useState('Завершаем вход…'); const started = useRef(false);
  useEffect(() => { if (started.current) return; started.current = true; const code = new URLSearchParams(window.location.search).get('code'); if (!code) { setMessage('Google не передал код входа. Попробуй ещё раз.'); return; } void exchangeAuthCode(code).then(({ error }) => error ? setMessage('Не удалось сохранить вход. Попробуй ещё раз.') : navigate('/onboarding')); }, [navigate]);
  return <PageShell><main className="auth-page"><section className="auth-card"><p className="kicker">VeloKZ</p><h1>{message}</h1></section></main></PageShell>;
}
