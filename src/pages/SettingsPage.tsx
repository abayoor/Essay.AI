import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { PageShell } from '../components/PageShell';
import { useSession } from '../lib/auth';
import { loadReferralCode } from '../lib/referrals';

export function SettingsPage() {
  const { session, loading } = useSession();
  const [, navigate] = useLocation();
  const [link, setLink] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!loading && !session) navigate('/auth/sign-in');
    if (!session) return;
    void loadReferralCode()
      .then((code) => setLink(`${window.location.origin}/auth/sign-up?ref=${code}`))
      .catch(() => setMessage('Не удалось загрузить реферальную ссылку. Попробуй обновить страницу.'));
  }, [loading, navigate, session]);

  async function copyLink() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setMessage('Ссылка скопирована.');
    } catch {
      setMessage('Не удалось скопировать ссылку автоматически. Выдели её и скопируй вручную.');
    }
  }

  return (
    <PageShell>
      <main className="settings-page">
        <section className="settings-card"><p className="eyebrow">Пригласи друга</p><h1>Реферальная ссылка</h1><p className="muted">Когда друг зарегистрируется по этой ссылке, вы оба получите по 5 дополнительных анализов эссе.</p>{link && <div className="referral-link"><input value={link} readOnly aria-label="Твоя реферальная ссылка" /><button onClick={() => void copyLink()}>Скопировать</button></div>}{!link && !message && <p className="loading-copy">Готовим ссылку…</p>}{message && <p className="form-message" role="status">{message}</p>}</section>
      </main>
    </PageShell>
  );
}
