import { Polyline } from 'react-leaflet';
import type { RoutePoint } from '../lib/cyclingModels';

type DirectionalRouteLineProps = {
  points: readonly RoutePoint[];
  color?: string;
  weight?: number;
  opacity?: number;
  interactive?: boolean;
  onClick?: () => void;
};

export function DirectionalRouteLine({
  points,
  color = '#00b98a',
  weight = 8,
  opacity = 1,
  interactive = false,
  onClick,
}: DirectionalRouteLineProps) {
  const positions = points.map((point) => [point.lat, point.lng] as [number, number]);
  const eventHandlers = onClick ? { click: onClick } : undefined;

  if (positions.length < 2 || opacity <= 0) return null;

  return <>
    <Polyline
      positions={positions}
      interactive={false}
      pathOptions={{
        color: '#061713',
        weight: weight + 7,
        opacity: Math.min(1, opacity * .88),
        lineCap: 'round',
        lineJoin: 'round',
      }}
    />
    <Polyline
      positions={positions}
      interactive={interactive}
      eventHandlers={eventHandlers}
      pathOptions={{
        color,
        weight,
        opacity,
        lineCap: 'round',
        lineJoin: 'round',
      }}
    />
  </>;
}
