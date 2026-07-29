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

export function PublicProfilePage() {
  const [, params] = useRoute('/u/:username');
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
  useEffect(() => { if (!loading && !session) navigate('/auth/sign-in'); if (session) void refresh().catch(() => setError('Не удалось загрузить профиль райдера.')); }, [loading, navigate, refresh, session]);
  async function messageRider() { if (!profile) return; setBusy(true); try { const id = await startDirectConversation(profile.id); navigate(`/messages/${id}`); } catch { setError('Не удалось начать диалог.'); } finally { setBusy(false); } }
  if (!profile && !error) return <PageShell><main className="cycle-page"><BikeLoader label="Загружаем профиль…" /></main></PageShell>;
  if (!profile) return <PageShell><main className="cycle-page"><section className="empty-panel"><h2>Профиль не найден</h2><p>Проверь никнейм в ссылке.</p><Link className="signal-button" href="/feed">Открыть ленту</Link></section></main></PageShell>;
  const ownProfile = profile.id === session?.user.id;
  return <PageShell><main className="cycle-page profile-page"><section className="rider-profile-header profile-summary"><Avatar profile={profile} className="profile-avatar" /><div className="profile-title"><div><p className="kicker">Райдер сообщества</p><h1>{profile.full_name || profile.username}</h1><p className="username-copy">@{profile.username}</p><p>{profile.home_city || 'Город не указан'}</p></div>{ownProfile ? <Link className="outline-inline-button" href="/settings">Редактировать</Link> : <button className="signal-button" disabled={busy} onClick={() => void messageRider()}>{busy ? 'Открываем…' : 'Написать'}</button>}</div></section>{profile.bio && <section className="profile-about"><h2>О себе</h2><p>{profile.bio}</p>{profile.interests.length > 0 && <div className="interest-tags">{profile.interests.map((interest) => <span key={interest}>{interest}</span>)}</div>}</section>}{error && <p className="inline-error">{error}</p>}<section className="profile-posts-section"><div className="section-heading"><div><p className="kicker">Лента райдера</p><h2>Публикации</h2></div></div>{posts.length ? <section className="profile-post-grid">{posts.map((post) => <Link className="profile-post-thumb" href="/feed" key={post.id}><span className="profile-post-thumb-image">{post.media_url && post.media_type === 'image' && <img src={post.media_url} alt="" />}{post.media_url && post.media_type === 'video' && <video src={post.media_url} muted preload="metadata" />}{!post.media_url && <b>{post.rideStats?.distanceKm.toFixed(1)} км</b>}</span><small>♥ {post.likes.length} · {post.comments.length}</small></Link>)}</section> : <section className="empty-panel compact-empty"><h3>Постов пока нет</h3></section>}</section></main></PageShell>;
}
