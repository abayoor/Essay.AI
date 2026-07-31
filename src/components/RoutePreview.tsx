import { Navigation } from 'lucide-react';
import { Link, useLocation } from 'wouter';
import { startCycleRouteNavigation } from '../lib/activeNavigation';
import type { CycleRoute } from '../lib/cyclingModels';
import { useLocaleText } from '../lib/localized';
import { ElevationLine } from './ElevationLine';

function routeSketchPoints(route: CycleRoute): string {
  if (route.path.length < 2) return '';
  const latitudes = route.path.map((point) => point.lat);
  const longitudes = route.path.map((point) => point.lng);
  const minLat = Math.min(...latitudes);
  const maxLat = Math.max(...latitudes);
  const minLng = Math.min(...longitudes);
  const maxLng = Math.max(...longitudes);
  const latRange = Math.max(maxLat - minLat, 0.0001);
  const lngRange = Math.max(maxLng - minLng, 0.0001);
  return route.path.map((point) => {
    const x = 22 + ((point.lng - minLng) / lngRange) * 256;
    const y = 128 - ((point.lat - minLat) / latRange) * 106;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
}

export function RoutePreview({ route }: { route: CycleRoute }) {
  const [, navigate] = useLocation();
  const text = useLocaleText();
  const labels = { easy: text('Лёгкий', 'Жеңіл', 'Easy'), moderate: text('Средний', 'Орташа', 'Moderate'), hard: text('Сложный', 'Қиын', 'Hard') };
  const sketch = routeSketchPoints(route);
  const sketchCoordinates = sketch.split(' ');
  const [startX, startY] = sketchCoordinates[0]?.split(',') ?? [];
  const [endX, endY] = sketchCoordinates[sketchCoordinates.length - 1]?.split(',') ?? [];
  return (
    <article className="route-preview">
    <Link href={`/routes/${route.id}`} className="route-preview-link">
      <div className="route-sketch"><span className="grid" /><svg viewBox="0 0 300 150" aria-hidden="true">{sketch ? <><polyline points={sketch} /><circle cx={startX} cy={startY} r="5" /><circle cx={endX} cy={endY} r="5" /></> : <path d="M20 114C55 103 48 49 89 62s37 49 67 32c25-13 11-54 51-47 27 5 19 32 70 19" />}</svg>{route.route_kind === 'curated' && <span className="route-curated-badge">{text('Выбор города', 'Қала таңдауы', 'City pick')}</span>}</div>
      <ElevationLine compact />
      <div className="route-preview-copy"><p className={`difficulty ${route.difficulty}`}>{labels[route.difficulty]}</p><h3>{route.title}</h3><p>{route.region || text('Регион не указан', 'Аймақ көрсетілмеген', 'Region not specified')}</p><dl><div><dt>{text('Дистанция', 'Қашықтық', 'Distance')}</dt><dd>{Number(route.distance_km).toFixed(1)} {text('км', 'км', 'km')}</dd></div><div><dt>{text('Набор', 'Өрлеу', 'Climb')}</dt><dd>{Math.round(Number(route.elevation_gain_m))} {text('м', 'м', 'm')}</dd></div>{route.duration_minutes ? <div><dt>{text('Время', 'Уақыт', 'Time')}</dt><dd>≈ {Math.round(route.duration_minutes)} {text('мин', 'мин', 'min')}</dd></div> : null}</dl></div>
    </Link>
    <button type="button" className="route-preview-go" onClick={() => { if (startCycleRouteNavigation(route)) navigate('/map'); }}><Navigation size={16} />{text('В путь', 'Жолға шығу', 'Start')}</button>
    </article>
  );
}
