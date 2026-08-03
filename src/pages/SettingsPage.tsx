import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useLocation } from 'wouter';
import { Avatar } from '../components/Avatar';
import { CityAutocomplete } from '../components/CityAutocomplete';
import { PageShell } from '../components/PageShell';
import { useSession } from '../lib/auth';
import { deleteBike, loadBikes } from '../lib/bikes';
import type { Bike, Locale, RiderProfile, SocialPost } from '../lib/cyclingModels';
import { deletePost, loadPosts } from '../lib/posts';
import { useLocaleText } from '../lib/localized';
import { usePreferences } from '../lib/preferences';
import { loadRiderProfile, saveRiderProfile, uploadAvatar } from '../lib/rider';
import { deleteMyAccount, deleteMarketplaceListing, loadMyMarketplaceListings, type MarketplaceListing } from '../lib/settings';
import { loadStravaConnectionStatus, startStravaConnection } from '../lib/strava';
import { supabase } from '../lib/supabase';
import { isUsernameConflict, isValidUsername, normalizeUsername } from '../lib/usernames';

const blankProfile: RiderProfile = { full_name: '', avatar_url: null, home_city: '', bio: '', username: 'rider', interests: [], locale: 'ru', theme_preference: 'light' };

export function SettingsPage() {
  const { session, loading } = useSession();
  const { setPreferences } = usePreferences();
  const text = useLocaleText();
  const [, navigate] = useLocation();
  const [profile, setProfile] = useState<RiderProfile>(blankProfile);
  const [bikes, setBikes] = useState<Bike[]>([]);
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [listings, setListings] = useState<MarketplaceListing[]>([]);
  const [interest, setInterest] = useState('');
  const [message, setMessage] = useState('');
  const [messageTone, setMessageTone] = useState<'error' | 'success' | 'info'>('info');
  const [busy, setBusy] = useState(false);
  const [stravaConnected, setStravaConnected] = useState(false);

  const refresh = useCallback(async () => {
    const [nextProfile, nextBikes, nextListings, connected] = await Promise.all([
      loadRiderProfile(), loadBikes(), loadMyMarketplaceListings(), loadStravaConnectionStatus().catch(() => false),
    ]);
    setProfile(nextProfile ? { ...nextProfile, theme_preference: 'light' } : blankProfile);
    setBikes(nextBikes); setListings(nextListings); setStravaConnected(connected);
    if (session?.user.id) setPosts(await loadPosts(session.user.id));
  }, [session?.user.id]);

  useEffect(() => { if (!loading && !session) navigate('/auth/sign-in'); if (session) void refresh().catch(() => { setMessageTone('error'); setMessage('Не удалось загрузить настройки.'); }); }, [loading, navigate, refresh, session]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const username = normalizeUsername(profile.username);
    if (!isValidUsername(username)) {
      setMessageTone('error'); setMessage('Никнейм: 3–48 символов, только латиница, цифры, _ и - .');
      return;
    }
    setBusy(true); setMessage(''); setMessageTone('info');
    try {
      const nextProfile = { ...profile, username, theme_preference: 'light' as const };
      await saveRiderProfile(nextProfile);
      setProfile(nextProfile); setPreferences({ locale: nextProfile.locale, theme: nextProfile.theme_preference });
      setMessageTone('success'); setMessage('Изменения сохранены');
    } catch (error) {
      setMessageTone('error'); setMessage(isUsernameConflict(error) ? 'Этот никнейм уже занят.' : 'Не удалось сохранить настройки.');
    } finally { setBusy(false); }
  }

  async function changeAvatar(file: File | null) {
    if (!file) return;
    setBusy(true); setMessage(''); setMessageTone('info');
    try { const avatarUrl = await uploadAvatar(file); setProfile((current) => ({ ...current, avatar_url: avatarUrl })); setMessageTone('success'); setMessage('Аватар обновлён — теперь сохрани изменения профиля.'); }
    catch (error) { setMessageTone('error'); setMessage(error instanceof Error ? error.message : 'Не удалось загрузить аватар.'); }
    finally { setBusy(false); }
  }

  function addInterest() {
    const value = interest.trim().replace(/\s+/g, ' ');
    if (!value || profile.interests.includes(value)) return;
    setProfile({ ...profile, interests: [...profile.interests, value].slice(0, 15) }); setInterest('');
  }

  async function removePost(id: string) { if (!window.confirm('Удалить безвозвратно?')) return; try { await deletePost(id); await refresh(); } catch { setMessageTone('error'); setMessage('Не удалось удалить пост.'); } }
  async function removeBike(id: string) { if (!window.confirm('Удалить безвозвратно? Заезды останутся в журнале без привязки к велосипеду.')) return; try { await deleteBike(id); await refresh(); } catch { setMessageTone('error'); setMessage('Не удалось удалить велосипед.'); } }
  async function removeListing(id: string) { if (!window.confirm('Удалить безвозвратно?')) return; try { await deleteMarketplaceListing(id); await refresh(); } catch { setMessageTone('error'); setMessage('Не удалось удалить объявление.'); } }
  async function connectStrava() { setBusy(true); setMessage(''); setMessageTone('info'); try { await startStravaConnection(); } catch (error) { setMessageTone('error'); setMessage(error instanceof Error ? error.message : 'Не удалось открыть Strava.'); setBusy(false); } }
  async function removeAccount() {
    if (!window.confirm('Удалить аккаунт безвозвратно? Будут удалены посты, сообщения, велосипеды и другие данные.')) return;
    if (!window.confirm('Это действие нельзя отменить. Точно удалить аккаунт?')) return;
    setBusy(true);
    try { await deleteMyAccount(); await supabaseSignOutAndLeave(navigate); }
    catch { setMessageTone('error'); setMessage('Не удалось удалить аккаунт. Попробуй войти заново и повторить.'); setBusy(false); }
  }

  return <PageShell><main className="cycle-page settings-page"><header className="page-heading"><div><p className="kicker">Настройки</p><h1>Твой профиль</h1><p>Личные данные, вид профиля, язык и безопасность аккаунта.</p></div></header><section className="settings-grid"><section className="form-card"><p className="kicker">Профиль</p><h2>Основная информация</h2><form className="cycle-form" onSubmit={(event) => void save(event)}><label>Никнейм<input required value={profile.username} onChange={(event) => setProfile({ ...profile, username: event.target.value })} maxLength={48} /><small>Ссылка на профиль: /u/{profile.username || 'username'}</small></label><label>Полное имя<input value={profile.full_name ?? ''} onChange={(event) => setProfile({ ...profile, full_name: event.target.value })} maxLength={80} /></label><div className="avatar-editor"><Avatar profile={profile} className="settings-avatar" /><label className="avatar-upload-control"><input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => void changeAvatar(event.target.files?.[0] ?? null)} /><span>Изменить аватар</span><small>JPG, PNG или WebP</small></label></div><div className="city-form-field"><span>{text('Город', 'Қала', 'City')}</span><CityAutocomplete value={profile.home_city ?? ''} onChange={(homeCity) => setProfile({ ...profile, home_city: homeCity })} /></div><label>О себе<textarea value={profile.bio ?? ''} onChange={(event) => setProfile({ ...profile, bio: event.target.value })} maxLength={280} /></label><label>Интересы<div className="interest-editor"><input value={interest} onChange={(event) => setInterest(event.target.value)} maxLength={40} placeholder="Например, гравий" onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); addInterest(); } }} /><button type="button" className="outline-inline-button" onClick={addInterest}>Добавить</button></div></label><div className="interest-tags editable-tags">{profile.interests.map((item) => <button key={item} type="button" onClick={() => setProfile({ ...profile, interests: profile.interests.filter((interestItem) => interestItem !== item) })}>{item} ×</button>)}</div><label>Язык интерфейса<select value={profile.locale} onChange={(event) => { const locale = event.target.value as Locale; setProfile({ ...profile, locale, theme_preference: 'light' }); setPreferences({ locale, theme: 'light' }); }}><option value="ru">Русский</option><option value="kz">Қазақша</option><option value="en">English</option></select></label><p className="muted-copy">Используется светлая тёплая палитра с контрастными элементами управления.</p><button className="signal-button" disabled={busy}>{busy ? 'Сохраняем…' : 'Сохранить настройки'}</button></form>{message && <p className={`form-note form-note-${messageTone}`} role="status">{message}</p>}</section><aside className="settings-side"><section className="form-card"><p className="kicker">Strava</p><h2>{stravaConnected ? 'Strava подключён' : 'Подключи Strava'}</h2><p className="muted-copy">Импортируй тренировки в публикации — со статистикой и линией маршрута.</p><button className="outline-button" disabled={busy || stravaConnected} onClick={() => void connectStrava()}>{stravaConnected ? 'Подключено' : 'Подключить Strava'}</button></section><section className="danger-card"><p className="kicker">Опасная зона</p><h2>Удалить аккаунт</h2><p>Необратимо удалит профиль, посты, сообщения, велосипеды и связанные данные.</p><button className="danger-button" disabled={busy} onClick={() => void removeAccount()}>Удалить аккаунт</button></section></aside></section><section className="settings-content-list"><div className="section-heading"><div><p className="kicker">Управление контентом</p><h2>Удалить отдельные данные</h2></div></div><div className="content-management-grid"><section><h3>Посты</h3>{posts.length ? posts.map((post) => <div className="managed-row" key={post.id}><span>{post.caption || 'Пост с медиа'}</span><button onClick={() => void removePost(post.id)}>Удалить</button></div>) : <p className="muted-copy">Постов нет.</p>}</section><section><h3>Велосипеды</h3>{bikes.length ? bikes.map((bike) => <div className="managed-row" key={bike.id}><span>{bike.name}</span><button onClick={() => void removeBike(bike.id)}>Удалить</button></div>) : <p className="muted-copy">Велосипедов нет.</p>}</section><section><h3>Объявления</h3>{listings.length ? listings.map((listing) => <div className="managed-row" key={listing.id}><span>{listing.title}</span><button onClick={() => void removeListing(listing.id)}>Удалить</button></div>) : <p className="muted-copy">Объявлений нет.</p>}</section></div></section></main></PageShell>;
}

async function supabaseSignOutAndLeave(navigate: (path: string) => void): Promise<void> {
  await supabase.auth.signOut();
  navigate('/');
}
