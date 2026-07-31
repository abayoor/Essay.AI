import { useState, type FormEvent } from 'react';
import { Link, useLocation } from 'wouter';
import { PageShell } from '../components/PageShell';
import { resendSignupCode, verifySignupCode } from '../lib/auth';
import { useLocaleText } from '../lib/localized';

export function ConfirmEmailPage() {
  const [, navigate] = useLocation();
  const text = useLocaleText();
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
      setMessage(text('Код не подошёл или уже истёк. Открой письмо и нажми кнопку подтверждения.', 'Код жарамсыз немесе мерзімі өтіп кеткен. Хатты ашып, растау түймесін бас.', 'The code is invalid or has expired. Open the email and click the confirmation button.'));
      return;
    }
    navigate('/onboarding');
  }

  async function resend() {
    setBusy(true);
    const { error } = await resendSignupCode(email);
    setBusy(false);
    setMessage(error ? text('Не удалось отправить письмо. Попробуй ещё раз через минуту.', 'Хатты жіберу мүмкін болмады. Бір минуттан кейін қайталап көр.', 'Could not send the email. Try again in a minute.') : text('Новое письмо отправлено. Проверь «Входящие» и «Спам».', 'Жаңа хат жіберілді. «Кіріс» пен «Спамды» тексер.', 'A new email was sent. Check your inbox and spam folder.'));
  }

  return <PageShell><main className="auth-page"><section className="auth-card"><p className="kicker">{text('Подтверждение', 'Растау', 'Confirmation')}</p><h1>{text('Проверь почту.', 'Поштаңды тексер.', 'Check your email.')}</h1><p>{text('Открой письмо от Supabase и нажми кнопку подтверждения — сайт продолжит вход сам. Если в письме есть шесть цифр, их можно ввести ниже.', 'Supabase хатын ашып, растау түймесін бас — сайт кіруді өзі жалғастырады. Хатта алты сан болса, оларды төменге енгізуге болады.', 'Open the Supabase email and click the confirmation button. If it contains a six-digit code, enter it below.')}</p><form className="cycle-form" onSubmit={(event) => void submit(event)}><label>{text('Почта', 'Пошта', 'Email')}<input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} /></label><label>{text('Код из письма (если есть)', 'Хаттағы код (бар болса)', 'Email code (if provided)')}<input required inputMode="numeric" maxLength={6} value={code} onChange={(event) => setCode(event.target.value)} /></label><button className="signal-button" disabled={busy}>{text('Подтвердить код', 'Кодты растау', 'Confirm code')}</button></form><button className="quiet-button" disabled={busy} onClick={() => void resend()}>{text('Отправить письмо ещё раз', 'Хатты қайта жіберу', 'Send email again')}</button>{message && <p className="form-note" role="status">{message}</p>}<p className="auth-switch"><Link href="/auth/sign-in">{text('Вернуться ко входу', 'Кіруге оралу', 'Back to sign in')}</Link></p></section></main></PageShell>;
}
