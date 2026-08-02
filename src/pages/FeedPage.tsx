import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Newspaper, Plus, RefreshCw, ShoppingBag, Users } from 'lucide-react';
import { Link, useLocation } from 'wouter';
import { MarketplaceCard } from '../components/MarketplaceCard';
import { PageShell } from '../components/PageShell';
import { PostCard } from '../components/PostCard';
import { useSession } from '../lib/auth';
import type { SocialPost } from '../lib/cyclingModels';
import { useLocaleText } from '../lib/localized';
import { loadFriendHub } from '../lib/friends';
import { loadMarketplaceListings, type MarketplaceListing } from '../lib/marketplace';
import { loadPosts } from '../lib/posts';
import { loadRiderProfile } from '../lib/rider';
import { useTranslations } from '../lib/translations';

const skeletonCards = [0, 1];
const feedPageSize = 15;
type FeedTab = 'recommendations' | 'friends' | 'marketplace';

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
  const [listings, setListings] = useState<MarketplaceListing[]>([]);
  const [tab, setTab] = useState<FeedTab>('recommendations');
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
      if (tab === 'marketplace') {
        setListings(await loadMarketplaceListings());
        setPosts([]);
        setHasMore(false);
        return;
      }
      const profile = tab === 'recommendations' ? await loadRiderProfile() : null;
      const friendIds = tab === 'friends' ? (await loadFriendHub()).friends.map((friend) => friend.id) : undefined;
      const nextPosts = await loadPosts(undefined, {
        limit: tab === 'recommendations' ? feedPageSize * 3 : feedPageSize,
        authorIds: friendIds,
        preferredHomeCity: profile?.home_city,
      });
      setPosts(nextPosts);
      setListings([]);
      setHasMore(tab !== 'recommendations' && nextPosts.length === feedPageSize);
    } catch {
      setError(text(
        'Не удалось загрузить ленту. Проверь соединение и попробуй ещё раз.',
        'Лентаны жүктеу мүмкін болмады. Байланысты тексеріп, қайталап көр.',
        'Could not load the feed. Check your connection and try again.',
      ));
    } finally {
      if (showLoader) setPostsLoading(false);
    }
  }, [tab, text]);

  const loadMore = useCallback(async () => {
    const cursor = posts[posts.length - 1]?.created_at;
    if (tab === 'marketplace' || !cursor || moreLoading || !hasMore) return;
    setMoreLoading(true);
    try {
      const friendIds = tab === 'friends' ? (await loadFriendHub()).friends.map((friend) => friend.id) : undefined;
      const nextPosts = await loadPosts(undefined, { before: cursor, limit: feedPageSize, authorIds: friendIds });
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
  }, [hasMore, moreLoading, posts, tab, text]);

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

      <nav className="community-feed-tabs" aria-label={text('Разделы сообщества', 'Қауымдастық бөлімдері', 'Community sections')}>
        <button type="button" className={tab === 'recommendations' ? 'active' : ''} onClick={() => setTab('recommendations')}><Newspaper size={17} />{text('Рекомендации', 'Ұсыныстар', 'For you')}</button>
        <button type="button" className={tab === 'friends' ? 'active' : ''} onClick={() => setTab('friends')}><Users size={17} />{text('Посты друзей', 'Достар жазбалары', 'Friends')}</button>
        <button type="button" className={tab === 'marketplace' ? 'active' : ''} onClick={() => setTab('marketplace')}><ShoppingBag size={17} />{text('Маркетплейс', 'Маркетплейс', 'Marketplace')}</button>
      </nav>

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
        : tab === 'marketplace'
          ? listings.length
            ? <><div className="community-market-actions"><p>{text('Велосипеды, детали и экипировка от райдеров.', 'Райдерлердің велосипедтері, бөлшектері және жабдықтары.', 'Bikes, parts and gear from riders.')}</p><Link className="signal-button" href="/marketplace/new"><Plus size={17} />{text('Продать', 'Сату', 'Sell')}</Link></div><section className="marketplace-listings">{listings.map((listing) => <MarketplaceCard key={listing.id} listing={listing} />)}</section></>
            : <section className="empty-panel feed-empty-state"><ShoppingBag size={30} /><h2>{text('Маркет пока пуст', 'Маркет әзірге бос', 'The market is empty')}</h2><p>{text('Размести первое объявление с фотографиями, ценой и описанием.', 'Фотосуреттері, бағасы және сипаттамасы бар алғашқы хабарландыруды орналастыр.', 'Create the first listing with photos, price, and description.')}</p><Link className="signal-button" href="/marketplace/new">{text('Разместить объявление', 'Хабарландыру беру', 'Create listing')}</Link></section>
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
            <span aria-hidden="true">{tab === 'friends' ? <Users size={30} /> : <Newspaper size={30} />}</span>
            <h2>{tab === 'friends' ? text('У друзей пока нет публикаций', 'Достарыңда әзірге жазба жоқ', 'No friend posts yet') : t('emptyFeedTitle')}</h2>
            <p>{tab === 'friends' ? text('Добавь друзей по нику — их новые поездки появятся здесь.', 'Достарды ник бойынша қос — олардың жаңа сапарлары осында пайда болады.', 'Add friends by username and their new rides will appear here.') : t('emptyFeedDescription')}</p>
            <Link className="signal-button" href={tab === 'friends' ? '/friends' : '/posts/new'}>
              {tab === 'friends' ? <Users size={18} /> : <Plus size={18} aria-hidden="true" />}
              {tab === 'friends' ? text('Найти друзей', 'Достарды табу', 'Find friends') : t('newPost')}
            </Link>
          </section>}
    </main>
  </PageShell>;
}
