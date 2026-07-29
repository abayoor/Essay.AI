import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation } from 'wouter';
import { Avatar } from '../components/Avatar';
import { MetricCard } from '../components/MetricCard';
import { PageShell } from '../components/PageShell';
import { useSession } from '../lib/auth';
import type { RiderProfile, RiderStats, SocialPost } from '../lib/cyclingModels';
import { loadPosts } from '../lib/posts';
import { loadRiderProfile, loadRiderStats } from '../lib/rider';

const blankProfile: RiderProfile = { full_name: '', avatar_url: null, home_city: '', bio: '', username: 'rider', interests: [], locale: 'ru', theme_preference: 'light' };

function PostGrid({ posts }: { posts: SocialPost[] }) {
  if (!posts.length) return <section className="empty-panel compact-empty"><h3>Пока нет публикаций</h3><p>Покажи сообществу свой следующий заезд.</p><Link className="signal-button" href="/posts/new">Создать пост</Link></section>;
  return <section className="profile-post-grid">{posts.map((post) => <Link className="profile-post-thumb" href="/feed" key={post.id} aria-label={`Открыть пост от ${post.author.username}`}><span className="profile-post-thumb-image">{post.media_url && post.media_type === 'image' && <img src={post.media_url} alt="" />}{post.media_url && post.media_type === 'video' && <video src={post.media_url} muted preload="metadata" />}{!post.media_url && <b>{post.rideStats?.distanceKm.toFixed(1)} км</b>}</span><small>♥ {post.likes.length} · {post.comments.length}</small></Link>)}</section>;
}

export function ProfilePage() {
  const { session, loading } = useSession();
  const [, navigate] = useLocation();
  const [profile, setProfile] = useState<RiderProfile>(blankProfile);
  const [stats, setStats] = useState<RiderStats | null>(null);
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [error, setError] = useState('');
  const refresh = useCallback(async () => {
    const [nextProfile, nextStats, nextPosts] = await Promise.all([loadRiderProfile(), loadRiderStats(), loadPosts(session?.user.id)]);
    setProfile(nextProfile ?? blankProfile); setStats(nextStats); setPosts(nextPosts);
  }, [session?.user.id]);
  useEffect(() => { if (!loading && !session) navigate('/auth/sign-in'); if (session) void refresh().catch(() => setError('Не удалось загрузить профиль.')); }, [loading, navigate, refresh, session]);
  return <PageShell><main className="cycle-page profile-page"><section className="rider-profile-header profile-summary"><Avatar profile={profile} className="profile-avatar" /><div className="profile-title"><div><p className="kicker">Профиль райдера</p><h1>{profile.full_name || 'Твой профиль'}</h1><p className="username-copy">@{profile.username}</p><p>{profile.home_city || 'Город пока не указан'}</p></div><Link className="outline-inline-button" href="/settings">Редактировать профиль</Link></div></section>{profile.bio && <section className="profile-about"><h2>О себе</h2><p>{profile.bio}</p>{profile.interests.length > 0 && <div className="interest-tags">{profile.interests.map((interest) => <span key={interest}>{interest}</span>)}</div>}</section>}{stats && <section className="metrics profile-metrics"><MetricCard label="Километраж" value={stats.distanceKm.toFixed(1)} unit="км" /><MetricCard label="Заездов" value={String(stats.ridesCount)} /><MetricCard label="Набор" value={String(Math.round(stats.elevationM))} unit="м" /><MetricCard label="Лучший выезд" value={stats.longestRideKm.toFixed(1)} unit="км" /></section>}{error && <p className="inline-error">{error}</p>}<section className="profile-posts-section"><div className="section-heading"><div><p className="kicker">Твоя лента</p><h2>Публикации</h2></div><Link href="/posts/new">Новый пост →</Link></div><PostGrid posts={posts} /></section></main></PageShell>;
}
