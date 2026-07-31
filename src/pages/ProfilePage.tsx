import { useCallback, useEffect, useState } from 'react';
import {
  Bike,
  ChevronRight,
  CircleGauge,
  Images,
  MapPin,
  Mountain,
  Pencil,
  Plus,
  Route,
  Sparkles,
} from 'lucide-react';
import { Link, useLocation } from 'wouter';
import { Avatar } from '../components/Avatar';
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
  theme_preference: 'light',
};

function PostGrid({ posts, text }: { posts: SocialPost[]; text: LocaleText }) {
  if (!posts.length) {
    return (
      <section className="profile-empty-state">
        <span><Images size={30} /></span>
        <div>
          <h3>{text('Здесь появятся твои истории', 'Мұнда сенің оқиғаларың пайда болады', 'Your stories will appear here')}</h3>
          <p>{text(
            'Опубликуй фотографию, маршрут или результат следующего заезда.',
            'Келесі сапардың фотосын, бағытын немесе нәтижесін жарияла.',
            'Share a photo, route or result from your next ride.',
          )}</p>
        </div>
        <Link className="signal-button" href="/posts/new"><Plus size={17} /> {text('Создать пост', 'Жазба жасау', 'Create post')}</Link>
      </section>
    );
  }

  return (
    <section className="profile-post-grid">
      {posts.map((post, index) => (
        <Link
          className="profile-post-thumb"
          href={`/feed#post-${post.id}`}
          key={post.id}
          aria-label={text(`Открыть публикацию ${index + 1}`, `${index + 1}-жазбаны ашу`, `Open post ${index + 1}`)}
        >
          <span className="profile-post-thumb-image">
            {post.media_url && post.media_type === 'image' && <img src={post.media_url} alt="" />}
            {post.media_url && post.media_type === 'video' && <video src={post.media_url} muted preload="metadata" />}
            {!post.media_url && (
              <span className="profile-ride-post">
                <Bike size={28} />
                <b>{post.rideStats?.distanceKm.toFixed(1) ?? '—'} <small>{text('км', 'км', 'km')}</small></b>
                <em>{post.caption || text('Велозаезд', 'Велосапар', 'Cycling ride')}</em>
              </span>
            )}
          </span>
          {post.media_type === 'video' && post.media_url && <span className="profile-media-type">{text('Видео', 'Видео', 'Video')}</span>}
          <small className="profile-post-engagement">♥ {post.likes.length} <span>•</span> ◌ {post.comments.length}</small>
        </Link>
      ))}
    </section>
  );
}

export function ProfilePage() {
  const { session, loading } = useSession();
  const [, navigate] = useLocation();
  const text = useLocaleText();
  const [profile, setProfile] = useState<RiderProfile>(blankProfile);
  const [stats, setStats] = useState<RiderStats | null>(null);
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    const [nextProfile, nextStats, nextPosts] = await Promise.all([
      loadRiderProfile(),
      loadRiderStats(),
      loadPosts(session?.user.id),
    ]);
    setProfile(nextProfile ?? blankProfile);
    setStats(nextStats);
    setPosts(nextPosts);
  }, [session?.user.id]);

  useEffect(() => {
    if (!loading && !session) navigate('/auth/sign-in');
    if (session) {
      void refresh().catch(() => setError(text(
        'Не удалось загрузить профиль.',
        'Профильді жүктеу мүмкін болмады.',
        'Could not load the profile.',
      )));
    }
  }, [loading, navigate, refresh, session, text]);

  const displayName = profile.full_name?.trim() || text('Твой профиль', 'Сенің профилің', 'Your profile');
  const city = profile.home_city?.trim();

  return (
    <PageShell>
      <main className="cycle-page profile-page profile-page-modern">
        <section className="profile-hero">
          <div className="profile-hero-pattern" aria-hidden="true">
            <i /><i /><i />
          </div>
          <div className="profile-identity">
            <Avatar profile={profile} className="profile-avatar profile-avatar-modern" />
            <div className="profile-identity-copy">
              <div className="profile-eyebrow"><Sparkles size={14} /> {text('Профиль райдера', 'Райдер профилі', 'Rider profile')}</div>
              <h1>{displayName}</h1>
              <div className="profile-meta">
                <span>@{profile.username}</span>
                <span><MapPin size={14} /> {city || text('Город не указан', 'Қала көрсетілмеген', 'City not set')}</span>
              </div>
            </div>
          </div>
          <Link className="profile-edit-button" href="/settings"><Pencil size={16} /> {text('Редактировать', 'Өңдеу', 'Edit profile')}</Link>
        </section>

        <section className="profile-stats" aria-label={text('Статистика райдера', 'Райдер статистикасы', 'Rider statistics')}>
          <article>
            <span><Route size={19} /></span>
            <div><strong>{stats ? stats.distanceKm.toFixed(1) : '—'}</strong><small>{text('км всего', 'км барлығы', 'km total')}</small></div>
          </article>
          <article>
            <span><Bike size={19} /></span>
            <div><strong>{stats?.ridesCount ?? '—'}</strong><small>{text('заездов', 'сапар', 'rides')}</small></div>
          </article>
          <article>
            <span><Mountain size={19} /></span>
            <div><strong>{stats ? Math.round(stats.elevationM).toLocaleString() : '—'}</strong><small>{text('м набора', 'м биіктік', 'm climbed')}</small></div>
          </article>
          <article>
            <span><CircleGauge size={19} /></span>
            <div><strong>{stats ? stats.longestRideKm.toFixed(1) : '—'}</strong><small>{text('км лучший', 'км рекорд', 'km longest')}</small></div>
          </article>
        </section>

        {error && <div className="inline-error" role="alert">{error}<button onClick={() => void refresh()}>{text('Повторить', 'Қайталау', 'Retry')}</button></div>}

        <div className="profile-content-grid">
          <section className="profile-about-card">
            <div className="profile-section-title">
              <div><p className="kicker">{text('О райдере', 'Райдер туралы', 'About rider')}</p><h2>{text('За пределами километров', 'Километрлерден тыс', 'Beyond the kilometres')}</h2></div>
            </div>
            <p className={profile.bio ? '' : 'profile-placeholder-copy'}>
              {profile.bio || text(
                'Добавь пару слов о стиле катания, любимых дорогах и целях.',
                'Жүру мәнерің, сүйікті жолдарың және мақсаттарың туралы жаз.',
                'Add a few words about your riding style, favourite roads and goals.',
              )}
            </p>
            {profile.interests.length > 0 ? (
              <div className="interest-tags profile-interest-tags">{profile.interests.map((interest) => <span key={interest}>{interest}</span>)}</div>
            ) : (
              <Link className="profile-add-details" href="/settings">{text('Добавить интересы', 'Қызығушылықтарды қосу', 'Add interests')} <ChevronRight size={15} /></Link>
            )}
          </section>

          <aside className="profile-quick-card">
            <p className="kicker">{text('Быстрый старт', 'Жылдам бастау', 'Quick start')}</p>
            <h2>{text('Куда дальше?', 'Әрі қарай не істейміз?', 'What is next?')}</h2>
            <Link href="/record"><span><Bike size={18} /></span><div><strong>{text('Записать заезд', 'Сапарды жазу', 'Record a ride')}</strong><small>{text('GPS и статистика', 'GPS және статистика', 'GPS and statistics')}</small></div><ChevronRight size={17} /></Link>
            <Link href="/map"><span><MapPin size={18} /></span><div><strong>{text('Построить маршрут', 'Бағыт құру', 'Plan a route')}</strong><small>{text('По велоинфраструктуре', 'Велоинфрақұрылым бойынша', 'Using cycling infrastructure')}</small></div><ChevronRight size={17} /></Link>
          </aside>
        </div>

        <section className="profile-posts-section profile-posts-modern">
          <div className="section-heading profile-posts-heading">
            <div><p className="kicker">{text('Твоя активность', 'Сенің белсенділігің', 'Your activity')}</p><h2>{text('Публикации', 'Жазбалар', 'Posts')} <span>{posts.length}</span></h2></div>
            <Link className="outline-inline-button" href="/posts/new"><Plus size={16} /> {text('Новый пост', 'Жаңа жазба', 'New post')}</Link>
          </div>
          <PostGrid posts={posts} text={text} />
        </section>
      </main>
    </PageShell>
  );
}
