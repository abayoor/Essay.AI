import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation } from 'wouter';
import { BikeLoader } from '../components/BikeLoader';
import { PageShell } from '../components/PageShell';
import { PostCard } from '../components/PostCard';
import type { SocialPost } from '../lib/cyclingModels';
import { useSession } from '../lib/auth';
import { loadPosts } from '../lib/posts';
import { useTranslations } from '../lib/translations';

export function FeedPage() {
  const { session, loading } = useSession();
  const [, navigate] = useLocation();
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [postsLoading, setPostsLoading] = useState(true);
  const [error, setError] = useState('');
  const t = useTranslations();

  const refresh = useCallback(async (showLoader = false) => {
    if (showLoader) setPostsLoading(true);
    try { setError(''); setPosts(await loadPosts()); }
    catch { setError('Не удалось загрузить ленту. Попробуй ещё раз.'); }
    finally { if (showLoader) setPostsLoading(false); }
  }, []);

  function updateLike(postId: string, shouldBeLiked: boolean) {
    const viewerId = session?.user.id;
    if (!viewerId) return;
    setPosts((current) => current.map((post) => {
      if (post.id !== postId) return post;
      return {
        ...post,
        likes: shouldBeLiked
          ? [...post.likes.filter((like) => like.user_id !== viewerId), { id: crypto.randomUUID(), user_id: viewerId }]
          : post.likes.filter((like) => like.user_id !== viewerId),
      };
    }));
  }

  useEffect(() => {
    if (!loading && !session) navigate('/auth/sign-in');
    if (session) void refresh(true);
  }, [loading, navigate, refresh, session]);

  return <PageShell><main className="cycle-page feed-page"><header className="page-heading"><div><p className="kicker">{t('feedKicker')}</p><h1>{t('feedTitle')}</h1><p>{t('feedDescription')}</p></div><Link className="signal-button" href="/posts/new">{t('newPost')}</Link></header>{error && <div className="inline-error" role="alert">{error}<button onClick={() => void refresh()}>{t('retry')}</button></div>}{postsLoading ? <BikeLoader label={t('loadFeed')} /> : posts.length ? <section className="feed-list">{posts.map((post) => <PostCard key={post.id} post={post} viewerId={session?.user.id ?? ''} onLikeChange={updateLike} onRefresh={refresh} />)}</section> : <section className="empty-panel"><h2>{t('emptyFeedTitle')}</h2><p>{t('emptyFeedDescription')}</p><Link className="signal-button" href="/posts/new">{t('newPost')}</Link></section>}</main></PageShell>;
}
