import { Link } from 'wouter';
import type { RoutePostPreview as RoutePostPreviewData } from '../lib/cyclingModels';
import { useLocaleText } from '../lib/localized';
import { RouteMap } from './RouteMap';

export function RoutePostPreview({ route }: { route: RoutePostPreviewData }) {
  const text = useLocaleText();
  const difficultyLabel = {
    easy: text('Лёгкий', 'Жеңіл', 'Easy'),
    moderate: text('Средний', 'Орташа', 'Moderate'),
    hard: text('Сложный', 'Қиын', 'Hard'),
  };
  const content = <section className="post-route-preview">
    <div className="post-route-heading"><p className={`difficulty ${route.difficulty}`}>{difficultyLabel[route.difficulty]}</p><h2>{route.title}</h2>{route.description && <p>{route.description}</p>}</div>
    {route.path.length >= 2 && <RouteMap points={route.path} className="post-route-map" />}
    <dl><div><dt>{text('Дистанция', 'Қашықтық', 'Distance')}</dt><dd>{route.distanceKm.toFixed(1)} {text('км', 'км', 'km')}</dd></div><div><dt>{text('Набор', 'Биіктік', 'Elevation')}</dt><dd>{Math.round(route.elevationGainM)} {text('м', 'м', 'm')}</dd></div></dl>
  </section>;
  return route.routeId ? <Link href={`/routes/${route.routeId}`}>{content}</Link> : content;
}
