import { useCallback, useEffect, useState } from 'react';
import { ClipboardCheck, Navigation } from 'lucide-react';
import { Link, useLocation, useParams } from 'wouter';
import { BikeLoader } from '../components/BikeLoader';
import { ElevationLine } from '../components/ElevationLine';
import { PageShell } from '../components/PageShell';
import { RouteMap } from '../components/RouteMap';
import { startCycleRouteNavigation } from '../lib/activeNavigation';
import { useSession } from '../lib/auth';
import type { CycleRoute } from '../lib/cyclingModels';
import { useLocaleText } from '../lib/localized';
import { loadRoute } from '../lib/routes';

export function RouteDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { session, loading } = useSession();
  const text = useLocaleText();
  const [, navigate] = useLocation();
  const [route, setRoute] = useState<CycleRoute | null>(null);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    if (!id) return;
    try {
      setError('');
      const item = await loadRoute(id);
      if (!item) navigate('/routes');
      else setRoute(item);
    } catch {
      setError(text('Не удалось открыть маршрут.', 'Бағытты ашу мүмкін болмады.', 'The route could not be opened.'));
    }
  }, [id, navigate, text]);

  useEffect(() => {
    if (!loading && !session) navigate('/auth/sign-in');
    if (session) void refresh();
  }, [loading, navigate, refresh, session]);

  if (!route) return <PageShell><main className="cycle-page">{error
    ? <p className="inline-error">{error}<button onClick={() => void refresh()}>{text('Повторить', 'Қайталау', 'Retry')}</button></p>
    : <BikeLoader label={text('Открываем маршрут…', 'Бағытты ашып жатырмыз…', 'Opening route…')} />}</main></PageShell>;

  const labels = { easy: text('Лёгкий', 'Жеңіл', 'Easy'), moderate: text('Средний', 'Орташа', 'Moderate'), hard: text('Сложный', 'Қиын', 'Hard') };
  const routeType = route.start_name && route.end_name
    ? route.start_name === route.end_name ? text('Круговой', 'Айналма', 'Loop') : text('Из точки в точку', 'Нүктеден нүктеге', 'Point to point')
    : text('Пользовательский', 'Пайдаланушы бағыты', 'Community route');
  const prepDuration = route.duration_minutes ?? Math.max(30, Math.round((Number(route.distance_km) / 20) * 60));
  const prepHref = `/pro?tool=pace&distance=${Number(route.distance_km).toFixed(1)}&elevation=${Math.round(Number(route.elevation_gain_m))}&duration=${Math.round(prepDuration)}#pro-toolkit`;

  return <PageShell><main className="cycle-page route-detail">
    <Link className="route-detail-back" href="/map">{text('← К карте и маршрутам', '← Карта мен бағыттарға', '← Back to map and routes')}</Link>
    <header className="page-heading route-detail-heading">
      <div><div className="route-detail-labels"><p className={`difficulty ${route.difficulty}`}>{labels[route.difficulty]}</p>{route.route_kind === 'curated' && <span>{text('Выбор города', 'Қала таңдауы', 'City pick')}</span>}</div><h1>{route.title}</h1><p>{route.region || text('Регион не указан', 'Аймақ көрсетілмеген', 'Region not specified')}{route.start_name ? ` · ${route.start_name}${route.end_name && route.end_name !== route.start_name ? ` → ${route.end_name}` : ` · ${text('круговой', 'айналма', 'loop')}`}` : ''}</p></div>
      <div className="route-detail-actions"><button type="button" className="signal-button" onClick={() => { if (startCycleRouteNavigation(route)) navigate('/map'); }}><Navigation size={17} />{text('В путь', 'Жолға шығу', 'Start')}</button><Link className="pro-inline-button" href={prepHref}><ClipboardCheck size={17} />{text('Подготовить поездку', 'Сапарға дайындалу', 'Prepare ride')}</Link><Link className="outline-inline-button" href="/routes/new">{text('Нарисовать свой', 'Өз бағытыңды салу', 'Draw your own')}</Link></div>
    </header>
    <RouteMap points={route.path} className="detail-map" />
    <section className="route-data">
      <article><span>{text('Дистанция', 'Қашықтық', 'Distance')}</span><strong>{Number(route.distance_km).toFixed(1)} <small>{text('км', 'км', 'km')}</small></strong></article>
      <article><span>{text('Набор высоты', 'Биіктік жинау', 'Elevation gain')}</span><strong>{Math.round(Number(route.elevation_gain_m))} <small>{text('м', 'м', 'm')}</small></strong></article>
      {route.duration_minutes ? <article><span>{text('Время в пути', 'Жол уақыты', 'Ride time')}</span><strong>≈ {Math.round(route.duration_minutes)} <small>{text('мин', 'мин', 'min')}</small></strong></article> : <article><span>{text('Точек трека', 'Трек нүктелері', 'Track points')}</span><strong>{route.path.length}</strong></article>}
      <article><span>{text('Сложность', 'Қиындық', 'Difficulty')}</span><strong className="route-difficulty-value">{labels[route.difficulty]}</strong></article>
    </section>
    <section className="route-prep-card"><span><ClipboardCheck size={23} /></span><div><p className="kicker">Slipstream Pro</p><h2>{text('Подготовься именно к этому маршруту', 'Дәл осы бағытқа дайындал', 'Prepare for this exact route')}</h2><p>{text('Дистанция, набор и примерное время уже будут заполнены. Рассчитай темп, воду, питание и список снаряжения.', 'Қашықтық, биіктік және болжамды уақыт алдын ала толтырылады. Қарқын, су, тамақ және жабдық тізімін есепте.', 'Distance, elevation and estimated time will be prefilled. Calculate pacing, hydration, fuel and your ride kit.')}</p></div><Link href={prepHref}>{text('Открыть Ride Lab', 'Ride Lab ашу', 'Open Ride Lab')} →</Link></section>
    <div className="route-detail-copy-grid">
      {route.description && <section className="route-description"><p className="kicker">{text('О маршруте', 'Бағыт туралы', 'About this route')}</p><p>{route.description}</p></section>}
      <section className="route-description route-characteristics"><p className="kicker">{text('Характеристики', 'Сипаттамалар', 'Details')}</p><dl>{route.surface && <div><dt>{text('Покрытие', 'Жол жабыны', 'Surface')}</dt><dd>{route.surface}</dd></div>}<div><dt>{text('Тип', 'Түрі', 'Type')}</dt><dd>{routeType}</dd></div><div><dt>{text('Линия', 'Сызық', 'Track')}</dt><dd>{route.path.length} {text('опорных точек', 'тірек нүкте', 'points')}</dd></div></dl>{route.source_url && <a href={route.source_url} target="_blank" rel="noreferrer">{text('Источник линии:', 'Сызық көзі:', 'Track source:')} {route.source_name || 'OpenStreetMap'} →</a>}</section>
    </div>
    <ElevationLine />
  </main></PageShell>;
}
