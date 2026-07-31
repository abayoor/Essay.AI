import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation, useRoute } from 'wouter';
import { Avatar } from '../components/Avatar';
import { BikeLoader } from '../components/BikeLoader';
import { PageShell } from '../components/PageShell';
import { useSession } from '../lib/auth';
import type { PublicProfile, SocialPost } from '../lib/cyclingModels';
import { startDirectConversation } from '../lib/messages';
import { loadPosts } from '../lib/posts';
import { loadPublicProfile } from '../lib/rider';
import { useLocaleText } from '../lib/localized';

export function PublicProfilePage() {
  const [, params] = useRoute('/u/:username');
  const text = useLocaleText();
  const { session, loading } = useSession();
  const [, navigate] = useLocation();
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const username = params?.username ?? '';
  const refresh = useCallback(async () => {
    const nextProfile = await loadPublicProfile(username);
    setProfile(nextProfile);
    setPosts(nextProfile ? await loadPosts(nextProfile.id) : []);
  }, [username]);
  useEffect(() => { if (!loading && !session) navigate('/auth/sign-in'); if (session) void refresh().catch(() => setError(text('Не удалось загрузить профиль райдера.', 'Райдер профилін жүктеу мүмкін болмады.', 'Could not load the rider profile.'))); }, [loading, navigate, refresh, session, text]);
  async function messageRider() { if (!profile) return; setBusy(true); try { const id = await startDirectConversation(profile.id); navigate(`/messages/${id}`); } catch { setError(text('Не удалось начать диалог.', 'Диалогты бастау мүмкін болмады.', 'Could not start the conversation.')); } finally { setBusy(false); } }
  if (!profile && !error) return <PageShell><main className="cycle-page"><BikeLoader label={text('Загружаем профиль…', 'Профиль жүктелуде…', 'Loading profile…')} /></main></PageShell>;
  if (!profile) return <PageShell><main className="cycle-page"><section className="empty-panel"><h2>{text('Профиль не найден', 'Профиль табылмады', 'Profile not found')}</h2><p>{text('Проверь никнейм в ссылке.', 'Сілтемедегі никнеймді тексер.', 'Check the username in the link.')}</p><Link className="signal-button" href="/feed">{text('Открыть ленту', 'Лентаны ашу', 'Open feed')}</Link></section></main></PageShell>;
  const ownProfile = profile.id === session?.user.id;
  return <PageShell><main className="cycle-page profile-page"><section className="rider-profile-header profile-summary"><Avatar profile={profile} className="profile-avatar" /><div className="profile-title"><div><p className="kicker">{text('Райдер сообщества', 'Қауымдастық райдері', 'Community rider')}</p><h1>{profile.full_name || profile.username}</h1><p className="username-copy">@{profile.username}</p><p>{profile.home_city || text('Город не указан', 'Қала көрсетілмеген', 'City not set')}</p></div>{ownProfile ? <Link className="outline-inline-button" href="/settings">{text('Редактировать', 'Өңдеу', 'Edit')}</Link> : <button className="signal-button" disabled={busy} onClick={() => void messageRider()}>{busy ? text('Открываем…', 'Ашылуда…', 'Opening…') : text('Написать', 'Жазу', 'Message')}</button>}</div></section>{profile.bio && <section className="profile-about"><h2>{text('О себе', 'Өзі туралы', 'About')}</h2><p>{profile.bio}</p>{profile.interests.length > 0 && <div className="interest-tags">{profile.interests.map((interest) => <span key={interest}>{interest}</span>)}</div>}</section>}{error && <p className="inline-error">{error}</p>}<section className="profile-posts-section"><div className="section-heading"><div><p className="kicker">{text('Лента райдера', 'Райдер лентасы', 'Rider feed')}</p><h2>{text('Публикации', 'Жарияланымдар', 'Posts')}</h2></div></div>{posts.length ? <section className="profile-post-grid">{posts.map((post) => <Link className="profile-post-thumb" href="/feed" key={post.id}><span className="profile-post-thumb-image">{post.media_url && post.media_type === 'image' && <img src={post.media_url} alt="" />}{post.media_url && post.media_type === 'video' && <video src={post.media_url} muted preload="metadata" />}{!post.media_url && <b>{post.rideStats?.distanceKm.toFixed(1)} {text('км', 'км', 'km')}</b>}</span><small>♥ {post.likes.length} · {post.comments.length}</small></Link>)}</section> : <section className="empty-panel compact-empty"><h3>{text('Постов пока нет', 'Әзірге жазбалар жоқ', 'No posts yet')}</h3></section>}</section></main></PageShell>;
}
