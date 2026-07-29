import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation } from 'wouter';
import { PageShell } from '../components/PageShell';
import { PostCard } from '../components/PostCard';
import type { SocialPost } from '../lib/cyclingModels';
import { useSession } from '../lib/auth';
import { loadPosts } from '../lib/posts';

export function FeedPage() {
  const { session, loading } = useSession();
  const [, navigate] = useLocation();
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    try { setError(''); setPosts(await loadPosts()); }
    catch { setError('Не удалось загрузить ленту. Попробуй ещё раз.'); }
  }, []);

  useEffect(() => {
    if (!loading && !session) navigate('/auth/sign-in');
    if (session) void refresh();
  }, [loading, navigate, refresh, session]);

  return <PageShell><main className="cycle-page feed-page"><header className="page-heading"><div><p className="kicker">Общая лента</p><h1>Что у сообщества?</h1><p>Свежие фото, видео и тренировки всех райдеров — в одном месте.</p></div><Link className="signal-button" href="/posts/new">Создать пост</Link></header>{error && <div className="inline-error" role="alert">{error}<button onClick={() => void refresh()}>Повторить</button></div>}{posts.length ? <section className="feed-list">{posts.map((post) => <PostCard key={post.id} post={post} viewerId={session?.user.id ?? ''} onChange={refresh} />)}</section> : <section className="empty-panel"><h2>Лента пока пустая</h2><p>Опубликуй первый заезд — его увидит всё сообщество.</p><Link className="signal-button" href="/posts/new">Создать пост</Link></section>}</main></PageShell>;
}
