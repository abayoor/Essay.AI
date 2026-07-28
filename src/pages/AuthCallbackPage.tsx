import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'wouter';
import { PageShell } from '../components/PageShell';
import { exchangeAuthCode } from '../lib/auth';

export function AuthCallbackPage() {
  const [, navigate] = useLocation();
  const [message, setMessage] = useState('Завершаем вход…');
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const authError = params.get('error_description') ?? params.get('error');

    if (authError) {
      setMessage('Вход не завершился. Вернись и попробуй ещё раз.');
      return;
    }
    if (!code) {
      setMessage('Не удалось получить код входа. Вернись и попробуй ещё раз.');
      return;
    }

    void exchangeAuthCode(code).then(({ error }) => {
      setMessage(error ? 'Не удалось сохранить вход. Попробуй ещё раз.' : 'Готово, открываем профиль…');
      if (!error) navigate('/onboarding');
    });
  }, [navigate]);

  return <PageShell><main className="auth-page"><section className="auth-card"><p className="kicker">VeloKZ</p><h1>{message}</h1></section></main></PageShell>;
}
