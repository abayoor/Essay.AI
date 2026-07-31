import { useCallback, useEffect, useState } from 'react';
import { ArrowRight, BrainCircuit, ShieldCheck, Sparkles, Trophy } from 'lucide-react';
import { Link, useLocation } from 'wouter';
import { BikeIcon } from '../components/BikeIcon';
import { BikeLoader } from '../components/BikeLoader';
import { ElevationLine } from '../components/ElevationLine';
import { MetricCard } from '../components/MetricCard';
import { PageShell } from '../components/PageShell';
import { RoutePreview } from '../components/RoutePreview';
import { useSession } from '../lib/auth';
import type { Bike, CycleRoute, RiderProfile, RiderStats } from '../lib/cyclingModels';
import { loadBikes } from '../lib/bikes';
import { loadWeeklyCompetitionProgress, type WeeklyCompetitionProgress } from '../lib/competitions';
import { loadRiderProfile, loadRiderStats } from '../lib/rider';
import { loadRoutes } from '../lib/routes';
import { useLocaleText } from '../lib/localized';

export function DashboardPage() {
  const { session, loading } = useSession();
  const [, navigate] = useLocation();
  const [profile, setProfile] = useState<RiderProfile | null>(null);
  const [stats, setStats] = useState<RiderStats | null>(null);
  const [bikes, setBikes] = useState<Bike[]>([]);
  const [routes, setRoutes] = useState<CycleRoute[]>([]);
  const [weekly, setWeekly] = useState<WeeklyCompetitionProgress | null>(null);
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);
  const t = useLocaleText();
  const userId = session?.user.id ?? '';

  const refresh = useCallback(async () => {
    if (!userId) return;
    setError('');
    setReady(false);
    try {
      const [nextProfile, nextStats, nextBikes, nextRoutes, nextWeekly] = await Promise.all([
        loadRiderProfile(),
        loadRiderStats(),
        loadBikes(),
        loadRoutes(),
        loadWeeklyCompetitionProgress(userId).catch(() => null),
      ]);
      setProfile(nextProfile); setStats(nextStats); setBikes(nextBikes); setRoutes(nextRoutes);
      setWeekly(nextWeekly);
    } catch {
      setStats(null);
      setError(t('Не удалось загрузить твою велосводку. Попробуй ещё раз.', 'Велошолуды жүктеу мүмкін болмады. Қайта көр.', 'Could not load your cycling overview. Please try again.'));
    } finally {
      setReady(true);
    }
  }, [t, userId]);

  useEffect(() => { if (!loading && !session) navigate('/auth/sign-in'); if (session) void refresh(); }, [loading, navigate, refresh, session]);
  const name = session ? profile?.full_name?.trim() || session.user.email?.split('@')[0] || t('Райдер', 'Райдер', 'Rider') : t('Райдер', 'Райдер', 'Rider');
  const weeklyPercent = weekly ? Math.min(100, Math.max(0, weekly.distanceKm / weekly.goalKm * 100)) : 0;

  return <PageShell><main className="cycle-page dashboard-page">
    <header className="page-heading"><div><p className="kicker">{t('Твоя сводка', 'Сенің шолуың', 'Your overview')}</p><h1>{t('Привет', 'Сәлем', 'Hello')}, {name}.</h1><p>{profile?.home_city || t('Добавь город в профиле — так маршруты станут ближе.', 'Профильге қалаңды қос — сонда жақын бағыттарды табамыз.', 'Add your city to the profile to find closer routes.')}</p></div><div className="page-heading-actions"><Link className="outline-inline-button" href="/rides">{t('Мои заезды', 'Менің сапарларым', 'My rides')}</Link><Link className="signal-button" href="/record">{t('Записать GPS-заезд', 'GPS сапарын жазу', 'Record GPS ride')}</Link></div></header>
    {error && <div className="inline-error" role="alert">{error}<button type="button" onClick={() => void refresh()}>{t('Повторить', 'Қайталау', 'Retry')}</button></div>}
    {session && ready && stats && <section className="dashboard-command-center" aria-label={t('Главное сегодня', 'Бүгінгі бастысы', 'Today at a glance')}>
      <Link className="dashboard-safety-mission" href="/map">
        <span className="dashboard-mission-icon"><ShieldCheck size={26} aria-hidden="true" /></span>
        <div><p className="kicker">Safety Radar</p><h2>{t('Построй безопасный маршрут', 'Қауіпсіз бағыт құр', 'Plan a safer route')}</h2><p>{t('Сравни варианты по свежим опасностям и получай предупреждения в пути.', 'Бағыттарды жаңа қауіптер бойынша салыстырып, жолда ескерту ал.', 'Compare alternatives using fresh hazard reports and get warned on the way.')}</p></div>
        <ArrowRight size={22} aria-hidden="true" />
      </Link>
      <Link className="dashboard-weekly-card" href="/competitions">
        <header><span><Trophy size={18} aria-hidden="true" /></span><div><p className="kicker">{t('Цель недели', 'Апталық мақсат', 'Weekly goal')}</p><strong>{weekly ? `${weekly.distanceKm.toFixed(1)} / ${weekly.goalKm} ${t('км', 'км', 'km')}` : t('Открыть прогресс', 'Прогресті ашу', 'Open progress')}</strong></div></header>
        <div className="dashboard-weekly-progress" role="progressbar" aria-valuemin={0} aria-valuemax={weekly?.goalKm ?? 50} aria-valuenow={weekly ? Math.min(weekly.goalKm, Number(weekly.distanceKm.toFixed(1))) : 0} aria-valuetext={weekly ? t(`${weekly.distanceKm.toFixed(1)} из ${weekly.goalKm} километров`, `${weekly.goalKm} километрдің ${weekly.distanceKm.toFixed(1)} километрі`, `${weekly.distanceKm.toFixed(1)} of ${weekly.goalKm} kilometres`) : t('Прогресс ещё не загружен', 'Прогресс әлі жүктелмеді', 'Progress has not loaded yet')}><span style={{ width: `${weeklyPercent}%` }} /></div>
        <footer><span>{weekly ? `${Math.round(weeklyPercent)}%` : '50 km'}</span><ArrowRight size={17} aria-hidden="true" /></footer>
      </Link>
    </section>}
    {!ready ? <BikeLoader label={t('Собираем данные поездок…', 'Сапар деректері жиналуда…', 'Collecting ride data…')} /> : session && stats ? <section className="metrics"><MetricCard label={t('За всё время', 'Барлық уақытта', 'All time')} value={stats.distanceKm.toFixed(1)} unit={t('км', 'км', 'km')} /><MetricCard label={t('Заездов', 'Сапарлар', 'Rides')} value={String(stats.ridesCount)} /><MetricCard label={t('Набор', 'Биіктік', 'Climb')} value={String(Math.round(stats.elevationM))} unit={t('м', 'м', 'm')} /><MetricCard label={t('Самый длинный', 'Ең ұзыны', 'Longest')} value={stats.longestRideKm.toFixed(1)} unit={t('км', 'км', 'km')} /></section> : null}
    {session && ready && stats && <section className="dashboard-coach-teaser"><span><BrainCircuit size={28} aria-hidden="true" /></span><div><p className="kicker"><Sparkles size={13} aria-hidden="true" /> Slipstream AI</p><h2>{t('Что делать на следующей тренировке?', 'Келесі жаттығуда не істеу керек?', 'What should your next workout be?')}</h2><p>{t('ИИ-тренер оценит последние поездки, нагрузку и самочувствие, а затем предложит безопасный план.', 'AI жаттықтырушы соңғы сапарларды, жүктемені және көңіл-күйіңді бағалап, қауіпсіз жоспар ұсынады.', 'The AI coach reviews recent rides, training load and how you feel, then suggests a safe plan.')}</p></div><Link className="signal-button" href="/coach">{t('Открыть тренера', 'Жаттықтырушыны ашу', 'Open coach')}</Link></section>}
    {session && ready && stats && <ElevationLine />}
    {session && ready && stats && <section className="dashboard-section"><div className="section-heading"><div><p className="kicker">{t('Гараж', 'Гараж', 'Garage')}</p><h2>{t('Техника готова?', 'Велосипед дайын ба?', 'Is your bike ready?')}</h2></div><Link href="/bikes">{t('Открыть гараж →', 'Гаражды ашу →', 'Open garage →')}</Link></div>{bikes.length ? <div className="bike-strip">{bikes.slice(0, 3).map((bike) => <article className="bike-mini" key={bike.id}><BikeIcon type={bike.bike_type} /><div><h3>{bike.name}</h3><p>{bike.brand || t('Без бренда', 'Брендсіз', 'No brand')}</p></div><strong>{Number(bike.total_distance_km).toFixed(0)} <small>{t('км', 'км', 'km')}</small></strong></article>)}</div> : <div className="empty-panel"><h3>{t('Пока нет велосипеда', 'Велосипед әзірге жоқ', 'No bike yet')}</h3><p>{t('Добавь первый байк — журнал обслуживания будет считать всё за тебя.', 'Алғашқы велосипедіңді қос — қызмет журналы бәрін есептейді.', 'Add your first bike and the service log will track everything.')}</p><Link className="signal-button" href="/bikes">{t('Добавить велосипед', 'Велосипед қосу', 'Add bike')}</Link></div>}</section>}
    {session && ready && stats && <section className="dashboard-section"><div className="section-heading"><div><p className="kicker">{t('Выбор сообщества', 'Қауымдастық таңдауы', 'Community picks')}</p><h2>{t('Маршруты рядом', 'Жақын бағыттар', 'Routes nearby')}</h2></div><Link href="/routes">{t('Все маршруты →', 'Барлық бағыттар →', 'All routes →')}</Link></div>{routes.length ? <div className="route-grid">{routes.slice(0, 3).map((route) => <RoutePreview key={route.id} route={route} />)}</div> : <div className="empty-panel"><h3>{t('Маршрутов ещё нет', 'Бағыттар әзірге жоқ', 'No routes yet')}</h3><p>{t('Нарисуй первый трек на карте — он станет ориентиром для сообщества.', 'Картада алғашқы тректі сыз — ол қауымдастыққа бағдар болады.', 'Draw the first track on the map and help guide the community.')}</p><Link className="signal-button" href="/routes/new">{t('Создать маршрут', 'Бағыт жасау', 'Create route')}</Link></div>}</section>}
  </main></PageShell>;
}
