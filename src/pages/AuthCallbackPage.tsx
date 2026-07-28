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

    async function finishSignIn() {
      const params = new URLSearchParams(window.location.search);
      const providerError = params.get('error_description');
      const code = params.get('code');
      if (providerError || !code) {
        setMessage(providerError ? 'Google отменил вход или вернул ошибку. Попробуй ещё раз.' : 'Не получили код входа от Google. Попробуй ещё раз.');
        return;
      }

      const { error } = await exchangeAuthCode(code);
      if (error) {
        setMessage('Не удалось сохранить вход. Вернись на страницу входа и повтори попытку.');
        return;
      }
      navigate('/onboarding');
    }

    void finishSignIn();
  }, [navigate]);

  return (
    <PageShell>
      <main className="auth-page">
        <section className="auth-card"><p className="eyebrow">Авторизация</p><h1>{message}</h1></section>
      </main>
    </PageShell>
  );
}
