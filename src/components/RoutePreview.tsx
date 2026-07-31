import { Link } from 'wouter';
import type { CycleRoute } from '../lib/cyclingModels';
import { ElevationLine } from './ElevationLine';

const labels = { easy: 'Лёгкий', moderate: 'Средний', hard: 'Сложный' };

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
  const sketch = routeSketchPoints(route);
  const sketchCoordinates = sketch.split(' ');
  const [startX, startY] = sketchCoordinates[0]?.split(',') ?? [];
  const [endX, endY] = sketchCoordinates[sketchCoordinates.length - 1]?.split(',') ?? [];
  return (
    <Link href={`/routes/${route.id}`} className="route-preview">
      <div className="route-sketch"><span className="grid" /><svg viewBox="0 0 300 150" aria-hidden="true">{sketch ? <><polyline points={sketch} /><circle cx={startX} cy={startY} r="5" /><circle cx={endX} cy={endY} r="5" /></> : <path d="M20 114C55 103 48 49 89 62s37 49 67 32c25-13 11-54 51-47 27 5 19 32 70 19" />}</svg>{route.route_kind === 'curated' && <span className="route-curated-badge">Выбор города</span>}</div>
      <ElevationLine compact />
      <div className="route-preview-copy"><p className={`difficulty ${route.difficulty}`}>{labels[route.difficulty]}</p><h3>{route.title}</h3><p>{route.region || 'Регион не указан'}</p><dl><div><dt>Дистанция</dt><dd>{Number(route.distance_km).toFixed(1)} км</dd></div><div><dt>Набор</dt><dd>{Math.round(Number(route.elevation_gain_m))} м</dd></div>{route.duration_minutes ? <div><dt>Время</dt><dd>≈ {Math.round(route.duration_minutes)} мин</dd></div> : null}</dl></div>
    </Link>
  );
}
