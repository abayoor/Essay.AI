import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useLocation } from 'wouter';
import { MetricCard } from '../components/MetricCard';
import { PageShell } from '../components/PageShell';
import { useSession } from '../lib/auth';
import type { RiderProfile, RiderStats } from '../lib/cyclingModels';
import { loadRiderProfile, loadRiderStats, saveRiderProfile } from '../lib/rider';

const blankProfile: RiderProfile = { full_name: '', avatar_url: null, home_city: '', bio: '' };

export function ProfilePage() {
  const { session, loading } = useSession(); const [, navigate] = useLocation();
  const [profile, setProfile] = useState<RiderProfile>(blankProfile); const [stats, setStats] = useState<RiderStats | null>(null); const [message, setMessage] = useState(''); const [busy, setBusy] = useState(false);
  const load = useCallback(async () => { const [nextProfile, nextStats] = await Promise.all([loadRiderProfile(), loadRiderStats()]); setProfile(nextProfile ?? blankProfile); setStats(nextStats); }, []);
  useEffect(() => { if (!loading && !session) navigate('/auth/sign-in'); if (session) void load().catch(() => setMessage('Не удалось загрузить профиль.')); }, [load, loading, navigate, session]);
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setBusy(true); setMessage(''); try { await saveRiderProfile(profile); setMessage('Профиль сохранён.'); } catch { setMessage('Не удалось сохранить профиль. Попробуй ещё раз.'); } finally { setBusy(false); } }
  const initials = (profile.full_name?.trim() || session?.user.email || 'R').slice(0, 1).toUpperCase();
  return <PageShell><main className="cycle-page profile-page"><header className="rider-profile-header"><div className="rider-avatar">{initials}</div><div><p className="kicker">Профиль райдера</p><h1>{profile.full_name || 'Твой профиль'}</h1><p>{profile.home_city || 'Город пока не указан'}</p></div></header>{stats && <section className="metrics profile-metrics"><MetricCard label="Километраж" value={stats.distanceKm.toFixed(1)} unit="км" /><MetricCard label="Заездов" value={String(stats.ridesCount)} /><MetricCard label="Набор" value={String(Math.round(stats.elevationM))} unit="м" /><MetricCard label="Лучший выезд" value={stats.longestRideKm.toFixed(1)} unit="км" /></section>}<section className="form-card"><p className="kicker">Твои данные</p><h2>Сделай профиль узнаваемым</h2><form className="cycle-form" onSubmit={(event) => void submit(event)}><label>Имя<input value={profile.full_name ?? ''} onChange={(event) => setProfile({ ...profile, full_name: event.target.value })} maxLength={80} /></label><label>Город<input value={profile.home_city ?? ''} onChange={(event) => setProfile({ ...profile, home_city: event.target.value })} placeholder="Например, Алматы" maxLength={80} /></label><label>О себе<textarea value={profile.bio ?? ''} onChange={(event) => setProfile({ ...profile, bio: event.target.value })} maxLength={280} placeholder="Какие дороги любишь, в каком темпе ездишь?" /></label><button className="signal-button" disabled={busy}>{busy ? 'Сохраняем…' : 'Сохранить профиль'}</button></form>{message && <p className="form-note" role="status">{message}</p>}</section></main></PageShell>;
}
