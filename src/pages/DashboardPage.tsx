import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation } from 'wouter';
import { EssayCard } from '../components/EssayCard';
import { PageShell } from '../components/PageShell';
import { useSession } from '../lib/auth';
import { loadEssays } from '../lib/essays';
import type { EssaySummary } from '../lib/models';
import { isSupabaseConfigured } from '../lib/supabase';

export function DashboardPage() {
  const { session, loading } = useSession();
  const [, navigate] = useLocation();
  const [essays, setEssays] = useState<EssaySummary[]>([]);
  const [message, setMessage] = useState('');
  const [loadingEssays, setLoadingEssays] = useState(false);

  const refresh = useCallback(async () => {
    setLoadingEssays(true);
    setMessage('');
    try {
      setEssays(await loadEssays());
    } catch {
      setMessage('Не удалось загрузить эссе.');
    } finally {
      setLoadingEssays(false);
    }
  }, []);

  useEffect(() => {
    if (!loading && !session) navigate('/auth/sign-in');
    if (session) void refresh();
  }, [loading, navigate, refresh, session]);

  return (
    <PageShell>
      <main className="content-page">
        <section className="page-intro">
          <div><p className="eyebrow">Твоя мастерская</p><h1>Мои эссе</h1></div>
          <Link href="/essays/new" className="primary-link">Новое эссе</Link>
        </section>
        {!isSupabaseConfigured && <p className="setup-note">Сначала добавь данные Supabase в .env — тогда эссе будут сохраняться.</p>}
        {loadingEssays && <p className="loading-copy">Загружаем твои эссе…</p>}
        {message && <div className="error-action" role="alert"><p className="form-message">{message}</p><button className="text-button" onClick={() => void refresh()} disabled={loadingEssays}>Попробовать снова</button></div>}
        {session && !loadingEssays && !message && essays.length === 0 && <section className="empty-state"><h2>Здесь пока тихо</h2><p>Создай первый черновик и начни с одной живой детали, которую помнишь только ты.</p><Link href="/essays/new" className="primary-link">Создать первое эссе</Link></section>}
        <section className="essay-list">{essays.map((essay) => <EssayCard key={essay.id} essay={essay} />)}</section>
      </main>
    </PageShell>
  );
}
