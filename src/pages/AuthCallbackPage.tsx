import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'wouter';
import { PageShell } from '../components/PageShell';
import { exchangeAuthCode } from '../lib/auth';
import { useLocaleText } from '../lib/localized';

export function AuthCallbackPage() {
  const [, navigate] = useLocation();
  const text = useLocaleText();
  const [message, setMessage] = useState('');
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const authError = params.get('error_description') ?? params.get('error');

    if (authError) {
      setMessage(text('Вход не завершился. Вернись и попробуй ещё раз.', 'Кіру аяқталмады. Артқа оралып, қайта көр.', 'Sign-in did not complete. Go back and try again.'));
      return;
    }
    if (!code) {
      setMessage(text('Не удалось получить код входа. Вернись и попробуй ещё раз.', 'Кіру кодын алу мүмкін болмады. Артқа оралып, қайта көр.', 'Could not get the sign-in code. Go back and try again.'));
      return;
    }

    void exchangeAuthCode(code).then(({ error }) => {
      setMessage(error ? text('Не удалось сохранить вход. Попробуй ещё раз.', 'Кіруді сақтау мүмкін болмады. Қайта көр.', 'Could not save the sign-in. Try again.') : text('Готово, открываем профиль…', 'Дайын, профиль ашылуда…', 'Done, opening your profile…'));
      if (!error) navigate('/onboarding');
    });
  }, [navigate, text]);

  return <PageShell><main className="auth-page"><section className="auth-card"><p className="kicker">Slipstream</p><h1>{message || text('Завершаем вход…', 'Кіру аяқталуда…', 'Completing sign-in…')}</h1></section></main></PageShell>;
}
