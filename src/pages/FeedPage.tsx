import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Newspaper, Plus, RefreshCw } from 'lucide-react';
import { Link, useLocation } from 'wouter';
import { PageShell } from '../components/PageShell';
import { PostCard } from '../components/PostCard';
import { useSession } from '../lib/auth';
import type { SocialPost } from '../lib/cyclingModels';
import { useLocaleText } from '../lib/localized';
import { loadPosts } from '../lib/posts';
import { useTranslations } from '../lib/translations';

const skeletonCards = [0, 1];
const feedPageSize = 15;

function FeedSkeleton({ label }: { label: string }) {
  return <section className="feed-skeleton" role="status" aria-label={label} aria-live="polite">
    <span className="visually-hidden">{label}</span>
    {skeletonCards.map((item) => <article className="feed-skeleton-card" key={item} aria-hidden="true">
      <div className="feed-skeleton-author">
        <span className="feed-skeleton-avatar" />
        <span className="feed-skeleton-copy">
          <i className="feed-skeleton-line" />
          <i className="feed-skeleton-line is-short" />
        </span>
      </div>
      <div className="feed-skeleton-media" />
      <div className="feed-skeleton-footer">
        <i className="feed-skeleton-line" />
        <i className="feed-skeleton-line" />
        <span className="feed-skeleton-actions">
          <i className="feed-skeleton-line" />
          <i className="feed-skeleton-line" />
        </span>
      </div>
    </article>)}
  </section>;
}

export function FeedPage() {
  const { session, loading } = useSession();
  const [, navigate] = useLocation();
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [postsLoading, setPostsLoading] = useState(true);
  const [moreLoading, setMoreLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState('');
  const t = useTranslations();
  const text = useLocaleText();

  const refresh = useCallback(async (showLoader = false) => {
    if (showLoader) setPostsLoading(true);
    try {
      setError('');
      const nextPosts = await loadPosts(undefined, { limit: feedPageSize });
      setPosts(nextPosts);
      setHasMore(nextPosts.length === feedPageSize);
    } catch {
      setError(text(
        'Не удалось загрузить ленту. Проверь соединение и попробуй ещё раз.',
        'Лентаны жүктеу мүмкін болмады. Байланысты тексеріп, қайталап көр.',
        'Could not load the feed. Check your connection and try again.',
      ));
    } finally {
      if (showLoader) setPostsLoading(false);
    }
  }, [text]);

  const loadMore = useCallback(async () => {
    const cursor = posts[posts.length - 1]?.created_at;
    if (!cursor || moreLoading || !hasMore) return;
    setMoreLoading(true);
    try {
      const nextPosts = await loadPosts(undefined, { before: cursor, limit: feedPageSize });
      setPosts((current) => {
        const known = new Set(current.map((post) => post.id));
        return [...current, ...nextPosts.filter((post) => !known.has(post.id))];
      });
      setHasMore(nextPosts.length === feedPageSize);
    } catch {
      setError(text(
        'Не удалось загрузить следующую часть ленты.',
        'Лентаның келесі бөлігін жүктеу мүмкін болмады.',
        'Could not load the next part of the feed.',
      ));
    } finally {
      setMoreLoading(false);
    }
  }, [hasMore, moreLoading, posts, text]);

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

  function updatePost(nextPost: SocialPost) {
    setPosts((current) => current.map((post) => post.id === nextPost.id ? nextPost : post));
  }

  useEffect(() => {
    if (!loading && !session) navigate('/auth/sign-in');
    if (session) void refresh(true);
  }, [loading, navigate, refresh, session]);

  return <PageShell>
    <main className="cycle-page feed-page" aria-busy={postsLoading}>
      <header className="page-heading feed-heading">
        <div>
          <p className="kicker">{t('feedKicker')}</p>
          <h1>{t('feedTitle')}</h1>
          <p>{t('feedDescription')}</p>
        </div>
        <Link className="signal-button" href="/posts/new">
          <Plus size={18} aria-hidden="true" />
          <span>{t('newPost')}</span>
        </Link>
      </header>

      {error && <div className="feed-error" role="alert">
        <AlertTriangle size={22} aria-hidden="true" />
        <p>{error}</p>
        <button type="button" onClick={() => void refresh(true)}>
          <RefreshCw size={16} aria-hidden="true" />
          {t('retry')}
        </button>
      </div>}

      {postsLoading
        ? <FeedSkeleton label={t('loadFeed')} />
        : posts.length
          ? <section className="feed-list" aria-label={t('feedTitle')}>
            {posts.map((post) => <PostCard
              key={post.id}
              post={post}
              viewerId={session?.user.id ?? ''}
              onLikeChange={updateLike}
              onPostChange={updatePost}
            />)}
            {hasMore && <button className="feed-load-more" type="button" onClick={() => void loadMore()} disabled={moreLoading}>
              {moreLoading ? text('Загружаем…', 'Жүктелуде…', 'Loading…') : text('Показать ещё', 'Тағы көрсету', 'Show more')}
            </button>}
          </section>
          : !error && <section className="empty-panel feed-empty-state">
            <span aria-hidden="true"><Newspaper size={30} /></span>
            <h2>{t('emptyFeedTitle')}</h2>
            <p>{t('emptyFeedDescription')}</p>
            <Link className="signal-button" href="/posts/new">
              <Plus size={18} aria-hidden="true" />
              {t('newPost')}
            </Link>
          </section>}
    </main>
  </PageShell>;
}
