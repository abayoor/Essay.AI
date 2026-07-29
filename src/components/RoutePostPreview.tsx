import { Link } from 'wouter';
import type { RoutePostPreview as RoutePostPreviewData } from '../lib/cyclingModels';
import { RouteMap } from './RouteMap';

const difficultyLabel = { easy: 'Лёгкий', moderate: 'Средний', hard: 'Сложный' };

export function RoutePostPreview({ route }: { route: RoutePostPreviewData }) {
  const content = <section className="post-route-preview">
    <div className="post-route-heading"><p className={`difficulty ${route.difficulty}`}>{difficultyLabel[route.difficulty]}</p><h2>{route.title}</h2>{route.description && <p>{route.description}</p>}</div>
    {route.path.length >= 2 && <RouteMap points={route.path} className="post-route-map" />}
    <dl><div><dt>Дистанция</dt><dd>{route.distanceKm.toFixed(1)} км</dd></div><div><dt>Набор</dt><dd>{Math.round(route.elevationGainM)} м</dd></div></dl>
  </section>;
  return route.routeId ? <Link href={`/routes/${route.routeId}`}>{content}</Link> : content;
}
