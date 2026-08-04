import { Clock3, Gauge, Mountain, Route } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { RidePostStats, RoutePoint } from '../lib/cyclingModels';
import { useLocaleText } from '../lib/localized';
import { RouteMap } from './RouteMap';

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

function formatDuration(totalSeconds: number, hourLabel: string, minuteLabel: string): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  return hours ? `${hours} ${hourLabel} ${minutes} ${minuteLabel}` : `${Math.max(1, minutes)} ${minuteLabel}`;
}

function RideRoutePreview({ points }: { points: RoutePoint[] }) {
  const text = useLocaleText();
  const containerRef = useRef<HTMLDivElement>(null);
  const [shouldRenderMap, setShouldRenderMap] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || typeof IntersectionObserver === 'undefined') {
      setShouldRenderMap(true);
      return undefined;
    }
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      setShouldRenderMap(true);
      observer.disconnect();
    }, { rootMargin: '600px 0px' });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  return <div className="ride-route-visual" ref={containerRef}>
    {shouldRenderMap
      ? <RouteMap points={points} className="ride-post-map" staticPreview />
      : <div className="ride-post-map-skeleton" aria-hidden="true" />}
    <span className="ride-route-label"><Route size={16} aria-hidden="true" />{text('Маршрут заезда', 'Жүріс бағыты', 'Ride route')}</span>
    {points.length < 2 && <span className="ride-route-private-note">{text('Линия маршрута скрыта', 'Бағыт сызығы жасырылған', 'Route line is hidden')}</span>}
  </div>;
}

export function RideOverlay({ stats, title, description }: RideOverlayProps) {
  const text = useLocaleText();
  const sourcePoints = stats.track?.length ? stats.track : stats.summaryPolyline ? decodePolyline(stats.summaryPolyline) : [];
  const averageSpeed = stats.durationSeconds > 0 ? stats.distanceKm / (stats.durationSeconds / 3600) : 0;
  const duration = formatDuration(stats.durationSeconds, text('ч', 'сағ', 'h'), text('мин', 'мин', 'min'));

  return <section className="ride-summary" aria-label={text('Заезд', 'Жүріс', 'Ride')}>
    {(title || description) && <div className="ride-summary-copy">
      {title && <h3>{title}</h3>}
      {description && <p>{description}</p>}
    </div>}

    <RideRoutePreview points={sourcePoints} />

    <dl className="ride-summary-stats">
      <div><Route size={18} aria-hidden="true" /><dt>{text('Дистанция', 'Қашықтық', 'Distance')}</dt><dd>{stats.distanceKm.toFixed(1)} {text('км', 'км', 'km')}</dd></div>
      <div><Clock3 size={18} aria-hidden="true" /><dt>{text('Время', 'Уақыт', 'Time')}</dt><dd>{duration}</dd></div>
      <div><Mountain size={18} aria-hidden="true" /><dt>{text('Набор', 'Биіктік', 'Elevation')}</dt><dd>{Math.round(stats.elevationGainM)} {text('м', 'м', 'm')}</dd></div>
      <div><Gauge size={18} aria-hidden="true" /><dt>{text('Ср. скорость', 'Орташа жылдамдық', 'Avg. speed')}</dt><dd>{averageSpeed.toFixed(1)} {text('км/ч', 'км/сағ', 'km/h')}</dd></div>
    </dl>
  </section>;
}
