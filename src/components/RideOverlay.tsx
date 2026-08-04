import { Clock3, Gauge, Mountain, Route } from 'lucide-react';
import { useId } from 'react';
import type { RidePostStats, RoutePoint } from '../lib/cyclingModels';
import { useLocaleText } from '../lib/localized';

type MapPoint = { x: number; y: number };

type RideOverlayProps = {
  stats: RidePostStats;
  title: string | null;
  description: string | null;
};

function decodePolyline(value: string): RoutePoint[] {
  const points: RoutePoint[] = [];
  let index = 0;
  let latitude = 0;
  let longitude = 0;

  function decodeComponent(): number | null {
    let result = 0;
    let shift = 0;
    while (index < value.length) {
      const byte = value.charCodeAt(index) - 63;
      index += 1;
      if (byte < 0 || byte > 63) return null;
      result += (byte & 0x1f) * 2 ** shift;
      if (byte < 0x20) return result % 2 === 1 ? -(result + 1) / 2 : result / 2;
      shift += 5;
      if (shift > 50) return null;
    }
    return null;
  }

  while (index < value.length) {
    const latitudeDelta = decodeComponent();
    const longitudeDelta = decodeComponent();
    if (latitudeDelta === null || longitudeDelta === null) return [];
    latitude += latitudeDelta;
    longitude += longitudeDelta;
    points.push({ lat: latitude / 1e5, lng: longitude / 1e5 });
  }
  return points;
}

function routeGeometry(points: RoutePoint[]): { path: string; start: MapPoint | null; end: MapPoint | null } {
  if (points.length < 2) return { path: '', start: null, end: null };
  const width = 680;
  const height = 300;
  const padding = 44;
  const longitudes = points.map((point) => point.lng);
  const latitudes = points.map((point) => point.lat);
  const minLng = Math.min(...longitudes);
  const maxLng = Math.max(...longitudes);
  const minLat = Math.min(...latitudes);
  const maxLat = Math.max(...latitudes);
  const spanLng = Math.max(maxLng - minLng, 0.000001);
  const spanLat = Math.max(maxLat - minLat, 0.000001);
  const scale = Math.min((width - padding * 2) / spanLng, (height - padding * 2) / spanLat);
  const renderedWidth = spanLng * scale;
  const renderedHeight = spanLat * scale;
  const offsetX = (width - renderedWidth) / 2;
  const offsetY = (height - renderedHeight) / 2;
  const mapped = points.map((point) => ({
    x: offsetX + (point.lng - minLng) * scale,
    y: height - offsetY - (point.lat - minLat) * scale,
  }));
  const path = mapped.map((point, pointIndex) => (
    `${pointIndex === 0 ? 'M' : 'L'}${point.x.toFixed(1)},${point.y.toFixed(1)}`
  )).join(' ');
  return { path, start: mapped[0], end: mapped[mapped.length - 1] };
}

function formatDuration(totalSeconds: number, hourLabel: string, minuteLabel: string): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  return hours ? `${hours} ${hourLabel} ${minutes} ${minuteLabel}` : `${Math.max(1, minutes)} ${minuteLabel}`;
}

export function RideOverlay({ stats, title, description }: RideOverlayProps) {
  const text = useLocaleText();
  const gridPatternId = useId().replace(/:/g, '');
  const sourcePoints = stats.track?.length ? stats.track : stats.summaryPolyline ? decodePolyline(stats.summaryPolyline) : [];
  const geometry = routeGeometry(sourcePoints);
  const averageSpeed = stats.durationSeconds > 0 ? stats.distanceKm / (stats.durationSeconds / 3600) : 0;
  const duration = formatDuration(stats.durationSeconds, text('ч', 'сағ', 'h'), text('мин', 'мин', 'min'));

  return <section className="ride-summary" aria-label={text('Заезд', 'Жүріс', 'Ride')}>
    {(title || description) && <div className="ride-summary-copy">
      {title && <h3>{title}</h3>}
      {description && <p>{description}</p>}
    </div>}

    <div className="ride-route-visual">
      <span className="ride-route-label"><Route size={16} aria-hidden="true" />{text('Маршрут заезда', 'Жүріс бағыты', 'Ride route')}</span>
      <svg viewBox="0 0 680 300" role="img" aria-label={text('Статичное превью маршрута', 'Бағыттың статикалық көрінісі', 'Static route preview')}>
        <defs>
          <pattern id={gridPatternId} width="52" height="52" patternUnits="userSpaceOnUse">
            <path d="M52 0H0V52" className="ride-route-grid" />
          </pattern>
        </defs>
        <rect width="680" height="300" className="ride-route-background" />
        <rect width="680" height="300" fill={`url(#${gridPatternId})`} />
        <path className="ride-map-road ride-map-road-wide" d="M-30 238C105 194 142 99 286 123S494 236 724 144" />
        <path className="ride-map-road" d="M73-24C132 74 219 84 269 179s87 108 152 144" />
        <path className="ride-map-road" d="M424-20c-15 90 44 117 110 142s101 73 173 80" />
        {geometry.path
          ? <>
            <path className="ride-map-path-shadow" d={geometry.path} />
            <path className="ride-map-path" d={geometry.path} />
            {geometry.start && <circle className="ride-map-start" cx={geometry.start.x} cy={geometry.start.y} r="8" />}
            {geometry.end && <circle className="ride-map-finish-ring" cx={geometry.end.x} cy={geometry.end.y} r="10" />}
            {geometry.end && <circle className="ride-map-finish" cx={geometry.end.x} cy={geometry.end.y} r="5" />}
          </>
          : <path className="ride-map-path ride-map-path-placeholder" d="M94 225C147 95 237 220 310 127s173-42 282-61" />}
      </svg>
    </div>

    <dl className="ride-summary-stats">
      <div><Route size={18} aria-hidden="true" /><dt>{text('Дистанция', 'Қашықтық', 'Distance')}</dt><dd>{stats.distanceKm.toFixed(1)} {text('км', 'км', 'km')}</dd></div>
      <div><Clock3 size={18} aria-hidden="true" /><dt>{text('Время', 'Уақыт', 'Time')}</dt><dd>{duration}</dd></div>
      <div><Mountain size={18} aria-hidden="true" /><dt>{text('Набор', 'Биіктік', 'Elevation')}</dt><dd>{Math.round(stats.elevationGainM)} {text('м', 'м', 'm')}</dd></div>
      <div><Gauge size={18} aria-hidden="true" /><dt>{text('Ср. скорость', 'Орташа жылдамдық', 'Avg. speed')}</dt><dd>{averageSpeed.toFixed(1)} {text('км/ч', 'км/сағ', 'km/h')}</dd></div>
    </dl>
  </section>;
}
