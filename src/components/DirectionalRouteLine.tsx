import { divIcon, type Map as LeafletMap } from 'leaflet';
import { useEffect, useMemo, useState } from 'react';
import { Marker, Polyline, useMap } from 'react-leaflet';
import type { RoutePoint } from '../lib/cyclingModels';
import './DirectionalRouteLine.css';

type DirectionArrow = {
  bearing: number;
  position: [number, number];
};

type DirectionalRouteLineProps = {
  points: readonly RoutePoint[];
  color?: string;
  weight?: number;
  opacity?: number;
  showArrows?: boolean;
  maxArrows?: number;
  interactive?: boolean;
  onClick?: () => void;
};

function bearingBetween(first: RoutePoint, second: RoutePoint): number {
  const firstLatitude = first.lat * Math.PI / 180;
  const secondLatitude = second.lat * Math.PI / 180;
  const longitudeDelta = (second.lng - first.lng) * Math.PI / 180;
  const y = Math.sin(longitudeDelta) * Math.cos(secondLatitude);
  const x = Math.cos(firstLatitude) * Math.sin(secondLatitude)
    - Math.sin(firstLatitude) * Math.cos(secondLatitude) * Math.cos(longitudeDelta);
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}

function routeArrows(points: readonly RoutePoint[], map: LeafletMap, requestedMaximum: number): DirectionArrow[] {
  if (points.length < 2) return [];
  const size = map.getSize();
  if (size.x <= 0 || size.y <= 0) return [];
  const spacingPx = size.x < 640 ? 82 : 104;
  const viewportCapacity = Math.ceil((size.x * size.y) / (spacingPx * spacingPx * 2.4));
  const maximum = Math.max(2, Math.min(48, Math.max(Math.round(requestedMaximum), viewportCapacity)));
  const paddingPx = 20;
  const arrows: DirectionArrow[] = [];
  let distanceSinceArrowPx = spacingPx * .55;
  let longestVisibleSegment: { start: RoutePoint; end: RoutePoint; lengthPx: number } | null = null;

  for (let index = 0; index < points.length - 1; index += 1) {
    const start = points[index];
    const end = points[index + 1];
    const startPixel = map.latLngToContainerPoint([start.lat, start.lng]);
    const endPixel = map.latLngToContainerPoint([end.lat, end.lng]);
    const segmentLengthPx = startPixel.distanceTo(endPixel);
    if (segmentLengthPx <= .5) continue;
    const intersectsViewport = Math.max(startPixel.x, endPixel.x) >= -paddingPx
      && Math.min(startPixel.x, endPixel.x) <= size.x + paddingPx
      && Math.max(startPixel.y, endPixel.y) >= -paddingPx
      && Math.min(startPixel.y, endPixel.y) <= size.y + paddingPx;
    if (!intersectsViewport) {
      distanceSinceArrowPx = spacingPx * .55;
      continue;
    }
    if (!longestVisibleSegment || segmentLengthPx > longestVisibleSegment.lengthPx) {
      longestVisibleSegment = { start, end, lengthPx: segmentLengthPx };
    }

    for (let offsetPx = spacingPx - distanceSinceArrowPx; offsetPx <= segmentLengthPx; offsetPx += spacingPx) {
      const ratio = offsetPx / segmentLengthPx;
      const x = startPixel.x + (endPixel.x - startPixel.x) * ratio;
      const y = startPixel.y + (endPixel.y - startPixel.y) * ratio;
      if (x >= -paddingPx && x <= size.x + paddingPx && y >= -paddingPx && y <= size.y + paddingPx) {
        arrows.push({
          bearing: bearingBetween(start, end),
          position: [
            start.lat + (end.lat - start.lat) * ratio,
            start.lng + (end.lng - start.lng) * ratio,
          ],
        });
        if (arrows.length >= maximum) return arrows;
      }
    }
    distanceSinceArrowPx = (distanceSinceArrowPx + segmentLengthPx) % spacingPx;
  }

  if (arrows.length === 0 && longestVisibleSegment) {
    const { start, end } = longestVisibleSegment;
    arrows.push({
      bearing: bearingBetween(start, end),
      position: [(start.lat + end.lat) / 2, (start.lng + end.lng) / 2],
    });
  }
  return arrows;
}

function arrowIcon(bearing: number) {
  const rotation = Number.isFinite(bearing) ? bearing.toFixed(1) : '0';
  return divIcon({
    className: 'slipstream-direction-arrow-marker',
    html: `<span style="transform:rotate(${rotation}deg)" aria-hidden="true"><svg viewBox="0 0 24 24" focusable="false"><path d="M12 2.5 20 20l-8-4-8 4 8-17.5Z" /></svg></span>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
}

export function DirectionalRouteLine({
  points,
  color = '#2f6f55',
  weight = 6,
  opacity = 1,
  showArrows = true,
  maxArrows = 18,
  interactive = false,
  onClick,
}: DirectionalRouteLineProps) {
  const map = useMap();
  const [viewportRevision, setViewportRevision] = useState(0);
  useEffect(() => {
    const update = () => setViewportRevision((revision) => revision + 1);
    map.on('moveend zoomend resize', update);
    return () => {
      map.off('moveend zoomend resize', update);
    };
  }, [map]);
  const positions = useMemo(
    () => points.map((point) => [point.lat, point.lng] as [number, number]),
    [points],
  );
  const arrows = useMemo(
    () => showArrows ? routeArrows(points, map, maxArrows) : [],
    [map, maxArrows, points, showArrows, viewportRevision],
  );
  const eventHandlers = onClick ? { click: onClick } : undefined;

  if (positions.length < 2 || opacity <= 0) return null;

  return <>
    <Polyline
      positions={positions}
      interactive={false}
      pathOptions={{
        color: '#061713',
        weight: weight + 6,
        opacity: Math.min(1, opacity * .92),
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
    {showArrows && opacity >= .65 && arrows.map((arrow, index) => <Marker
      key={`${index}-${arrow.position[0]}-${arrow.position[1]}`}
      position={arrow.position}
      icon={arrowIcon(arrow.bearing)}
      interactive={false}
      keyboard={false}
      zIndexOffset={400}
    />)}
  </>;
}
