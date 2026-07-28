import { Link } from 'wouter';
import type { CycleRoute } from '../lib/cyclingModels';
import { ElevationLine } from './ElevationLine';

const labels = { easy: 'Лёгкий', moderate: 'Средний', hard: 'Сложный' };

export function RoutePreview({ route }: { route: CycleRoute }) {
  return (
    <Link href={`/routes/${route.id}`} className="route-preview">
      <div className="route-sketch"><span className="grid" /><svg viewBox="0 0 300 150" aria-hidden="true"><path d="M20 114C55 103 48 49 89 62s37 49 67 32c25-13 11-54 51-47 27 5 19 32 70 19" /></svg></div>
      <ElevationLine compact />
      <div className="route-preview-copy"><p className={`difficulty ${route.difficulty}`}>{labels[route.difficulty]}</p><h3>{route.title}</h3><p>{route.region || 'Регион не указан'}</p><dl><div><dt>Дистанция</dt><dd>{Number(route.distance_km).toFixed(1)} км</dd></div><div><dt>Набор</dt><dd>{Math.round(Number(route.elevation_gain_m))} м</dd></div></dl></div>
    </Link>
  );
}
