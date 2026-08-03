import { useCallback, useEffect, useState } from 'react';
import { Bike, BrainCircuit, Grid3X3, Map, MapPin, Mountain, Pencil, Plus, Route, Settings, Sparkles, Wrench } from 'lucide-react';
import { Link, useLocation } from 'wouter';
import { Avatar } from '../components/Avatar';
import { BikeLoader } from '../components/BikeLoader';
import { PageShell } from '../components/PageShell';
import { useSession } from '../lib/auth';
import type { RiderProfile, RiderStats, SocialPost } from '../lib/cyclingModels';
import { useLocaleText, type LocaleText } from '../lib/localized';
import { loadPosts } from '../lib/posts';
import { loadRiderProfile, loadRiderStats } from '../lib/rider';

const blankProfile: RiderProfile = {
  full_name: '',
  avatar_url: null,
  home_city: '',
  bio: '',
  username: 'rider',
  interests: [],
  locale: 'ru',
  theme_preference: 'dark',
};

function ProfilePosts({ posts, text }: { posts: SocialPost[]; text: LocaleText }) {
  if (!posts.length) {
    return (
      <section className="profile-v2-empty">
        <span><Grid3X3 size={26} /></span>
        <h2>{text('Пока нет публикаций', 'Әзірге жазбалар жоқ', 'No posts yet')}</h2>
        <p>{text(
          'Первая поездка, фотография или маршрут появятся здесь.',
          'Алғашқы сапар, фото немесе бағыт осында пайда болады.',
          'Your first ride, photo or route will appear here.',
        )}</p>
        <Link className="signal-button" href="/posts/new"><Plus size={17} /> {text('Создать пост', 'Жазба жасау', 'Create post')}</Link>
      </section>
    );
  }

  return (
    <section className="profile-v2-grid">
      {posts.map((post, index) => (
        <Link
          className="profile-v2-post"
          href={`/feed#post-${post.id}`}
          key={post.id}
          aria-label={text(`Открыть публикацию ${index + 1}`, `${index + 1}-жазбаны ашу`, `Open post ${index + 1}`)}
        >
          {post.media_url && post.media_type === 'image' && <img src={post.media_url} alt="" loading="lazy" decoding="async" />}
          {post.media_url && post.media_type === 'video' && <video src={post.media_url} muted preload="metadata" />}
          {!post.media_url && (
            <span className="profile-v2-ride">
              <Bike size={24} />
              <strong>{post.rideStats?.distanceKm.toFixed(1) ?? '—'} <small>{text('км', 'км', 'km')}</small></strong>
              <em>{post.caption || text('Велозаезд', 'Велосапар', 'Cycling ride')}</em>
            </span>
          )}
          <span className="profile-v2-post-meta">♥ {post.likes.length} <i>◌ {post.comments.length}</i></span>
        </Link>
      ))}
    </section>
  );
}

export function ProfilePage() {
  const { session, loading } = useSession();
  const userId = session?.user.id;
  const [, navigate] = useLocation();
  const text = useLocaleText();
  const [profile, setProfile] = useState<RiderProfile | null>(null);
  const [stats, setStats] = useState<RiderStats | null>(null);
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [error, setError] = useState('');
  const [profileLoading, setProfileLoading] = useState(true);

  const refresh = useCallback(async () => {
    setProfileLoading(true);
    setError('');
    setProfile(null);
    try {
      const [nextProfile, nextStats, nextPosts] = await Promise.all([
        loadRiderProfile(),
        loadRiderStats(),
        loadPosts(userId),
      ]);
      setProfile(nextProfile ?? blankProfile);
      setStats(nextStats);
      setPosts(nextPosts);
    } catch {
      setError(text(
        'Не удалось загрузить профиль.',
        'Профильді жүктеу мүмкін болмады.',
        'Could not load the profile.',
      ));
    } finally {
      setProfileLoading(false);
    }
  }, [text, userId]);

  useEffect(() => {
    if (!loading && !userId) navigate('/auth/sign-in');
    if (userId) void refresh();
  }, [loading, navigate, refresh, userId]);

  if (loading || !userId || profileLoading) {
    return <main className="route-loading profile-loading-screen">
      <BikeLoader label={text('Загружаем профиль…', 'Профиль жүктелуде…', 'Loading profile…')} />
    </main>;
  }

  if (!profile) {
    return <PageShell>
      <main className="cycle-page route-loading">
        <div className="inline-error" role="alert">
          {error || text('Не удалось загрузить профиль.', 'Профильді жүктеу мүмкін болмады.', 'Could not load the profile.')}
          <button type="button" onClick={() => void refresh()}>{text('Повторить', 'Қайталау', 'Retry')}</button>
        </div>
      </main>
    </PageShell>;
  }

  const displayName = profile.full_name?.trim() || profile.username || text('Твой профиль', 'Сенің профилің', 'Your profile');

  return (
    <PageShell>
      <main className="cycle-page profile-v2">
        <section className="profile-v2-overview">
          <Avatar profile={profile} className="profile-v2-avatar" />

          <div className="profile-v2-copy">
            <div className="profile-v2-title">
              <div>
                <p className="profile-v2-username">@{profile.username}</p>
                <h1>{displayName}</h1>
              </div>
              <Link className="outline-inline-button profile-v2-edit" href="/settings"><Pencil size={15} /> {text('Редактировать', 'Өңдеу', 'Edit profile')}</Link>
            </div>

            <div className="profile-v2-location">
              <MapPin size={14} />
              {profile.home_city?.trim() || text('Город не указан', 'Қала көрсетілмеген', 'City not set')}
            </div>

            <p className={profile.bio ? 'profile-v2-bio' : 'profile-v2-bio profile-v2-bio-empty'}>
              {profile.bio || text(
                'Расскажи о своём стиле катания и любимых маршрутах.',
                'Жүру мәнерің мен сүйікті бағыттарың туралы айтып бер.',
                'Tell people about your riding style and favourite routes.',
              )}
            </p>

            {profile.interests.length > 0 && (
              <div className="profile-v2-tags">{profile.interests.map((interest) => <span key={interest}>{interest}</span>)}</div>
            )}
          </div>
        </section>

        <section className="profile-v2-stats" aria-label={text('Статистика райдера', 'Райдер статистикасы', 'Rider statistics')}>
          <article><strong>{stats ? stats.distanceKm.toFixed(1) : '—'}</strong><span><Route size={15} /> {text('км', 'км', 'km')}</span></article>
          <article><strong>{stats?.ridesCount ?? '—'}</strong><span><Bike size={15} /> {text('заездов', 'сапар', 'rides')}</span></article>
          <article><strong>{stats ? Math.round(stats.elevationM).toLocaleString() : '—'}</strong><span><Mountain size={15} /> {text('м набора', 'м биіктік', 'm climbed')}</span></article>
          <article><strong>{stats ? stats.longestRideKm.toFixed(1) : '—'}</strong><span>{text('лучший, км', 'рекорд, км', 'longest, km')}</span></article>
        </section>

        {error && <div className="inline-error" role="alert">{error}<button onClick={() => void refresh()}>{text('Повторить', 'Қайталау', 'Retry')}</button></div>}

        <nav className="profile-section-hub" aria-label={text('Разделы аккаунта', 'Аккаунт бөлімдері', 'Account sections')}>
          <Link href="/rides"><span><Bike size={19} /></span><div><strong>{text('Мои заезды', 'Менің сапарларым', 'My rides')}</strong><small>{text('История и статистика', 'Тарих және статистика', 'History and statistics')}</small></div></Link>
          <Link href="/bikes"><span><Wrench size={19} /></span><div><strong>{text('Мой гараж', 'Менің гаражым', 'My garage')}</strong><small>{text('Велосипеды и ТО', 'Велосипедтер және қызмет', 'Bikes and service')}</small></div></Link>
          <Link href="/coach"><span><BrainCircuit size={19} /></span><div><strong>{text('ИИ-тренер', 'AI жаттықтырушы', 'AI coach')}</strong><small>{text('Персональный план', 'Жеке жоспар', 'Personal plan')}</small></div></Link>
          <Link href="/pro"><span><Sparkles size={19} /></span><div><strong>Slipstream Pro</strong><small>{text('Расширенный анализ и инструменты', 'Кеңейтілген талдау және құралдар', 'Advanced analysis and tools')}</small></div></Link>
          <Link href="/map"><span><Map size={19} /></span><div><strong>{text('Карта', 'Карта', 'Map')}</strong><small>{text('Маршруты и места', 'Бағыттар мен орындар', 'Routes and places')}</small></div></Link>
          <Link href="/settings"><span><Settings size={19} /></span><div><strong>{text('Настройки', 'Баптаулар', 'Settings')}</strong><small>{text('Профиль и аккаунт', 'Профиль және аккаунт', 'Profile and account')}</small></div></Link>
        </nav>

        <nav className="profile-v2-tabs" aria-label={text('Разделы профиля', 'Профиль бөлімдері', 'Profile sections')}>
          <span className="active"><Grid3X3 size={16} /> {text('Публикации', 'Жазбалар', 'Posts')} <b>{posts.length}</b></span>
          <div>
            <Link href="/record"><Bike size={16} /> {text('Записать заезд', 'Сапарды жазу', 'Record ride')}</Link>
            <Link className="profile-v2-new-post" href="/posts/new"><Plus size={16} /> {text('Новый пост', 'Жаңа жазба', 'New post')}</Link>
          </div>
        </nav>

        <ProfilePosts posts={posts} text={text} />
      </main>
    </PageShell>
  );
}
