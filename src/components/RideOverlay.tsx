import type { RidePostStats, RoutePoint } from '../lib/cyclingModels';

type Point = { x: number; y: number };

function decodePolyline(value: string): Point[] {
  const points: Point[] = [];
  let index = 0;
  let latitude = 0;
  let longitude = 0;
  while (index < value.length) {
    let result = 0;
    let shift = 0;
    let byte: number;
    do {
      byte = value.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20 && index < value.length);
    latitude += result & 1 ? ~(result >> 1) : result >> 1;
    result = 0;
    shift = 0;
    do {
      byte = value.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20 && index < value.length);
    longitude += result & 1 ? ~(result >> 1) : result >> 1;
    points.push({ x: longitude / 1e5, y: latitude / 1e5 });
  }
  return points;
}

function scaledPath(polyline: string | null): string {
  if (!polyline) return '';
  const points = decodePolyline(polyline);
  if (points.length < 2) return '';
  const xValues = points.map((point) => point.x);
  const yValues = points.map((point) => point.y);
  const minX = Math.min(...xValues);
  const maxX = Math.max(...xValues);
  const minY = Math.min(...yValues);
  const maxY = Math.max(...yValues);
  const spanX = maxX - minX || 1;
  const spanY = maxY - minY || 1;
  return points.map((point, index) => {
    const x = 8 + ((point.x - minX) / spanX) * 164;
    const y = 64 - ((point.y - minY) / spanY) * 52;
    return `${index === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
}

function scaledTrackPath(track: RoutePoint[] | null): string {
  if (!track || track.length < 2) return '';
  const xValues = track.map((point) => point.lng);
  const yValues = track.map((point) => point.lat);
  const minX = Math.min(...xValues);
  const maxX = Math.max(...xValues);
  const minY = Math.min(...yValues);
  const maxY = Math.max(...yValues);
  const spanX = maxX - minX || 1;
  const spanY = maxY - minY || 1;
  return track.map((point, index) => {
    const x = 8 + ((point.lng - minX) / spanX) * 164;
    const y = 64 - ((point.lat - minY) / spanY) * 52;
    return `${index === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
}

function formatDuration(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  return hours ? `${hours} ч ${minutes} мин` : `${minutes} мин`;
}

export function RideOverlay({ stats }: { stats: RidePostStats }) {
  const path = scaledTrackPath(stats.track) || scaledPath(stats.summaryPolyline);
  return <aside className="ride-overlay" aria-label="Статистика тренировки">
    <svg viewBox="0 0 180 72" role="img" aria-label="Маршрут тренировки">
      <path className="ride-map-grid" d="M0 18H180M0 36H180M0 54H180M45 0V72M90 0V72M135 0V72" />
      {path ? <path className="ride-map-path" d={path} /> : <path className="ride-map-path placeholder" d="M10 56 C42 12, 72 70, 104 29 S144 55, 170 16" />}
    </svg>
    <div><strong>{stats.distanceKm.toFixed(1)} км</strong><span>дистанция</span></div>
    <div><strong>{Math.round(stats.elevationGainM)} м</strong><span>набор</span></div>
    <div><strong>{formatDuration(stats.durationSeconds)}</strong><span>время</span></div>
  </aside>;
}
