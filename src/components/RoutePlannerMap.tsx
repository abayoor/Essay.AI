import { divIcon, latLngBounds } from 'leaflet';
import { useEffect, useMemo } from 'react';
import { MapContainer, Marker, Polyline, useMap, useMapEvents } from 'react-leaflet';
import type { RoutePoint } from '../lib/cyclingModels';
import { CommunityTileLayer } from './CommunityTileLayer';
import { DirectionalRouteLine } from './DirectionalRouteLine';
import './RoutePlannerMap.css';

const DEFAULT_CENTER: [number, number] = [43.2389, 76.8897];

type PlannerMapProps = {
  points: RoutePoint[];
  waypoints: RoutePoint[];
  snappedWaypoints?: RoutePoint[];
  onAdd: (point: RoutePoint) => void;
  routing: boolean;
};

type VisibleMarker = {
  key: string;
  point: RoutePoint;
  kind: 'start' | 'finish' | 'roundtrip' | 'via';
  label: string;
};

function distanceBetweenMeters(first: RoutePoint, second: RoutePoint): number {
  const latitudeScale = 111_320;
  const longitudeScale = latitudeScale * Math.max(.05, Math.cos(first.lat * Math.PI / 180));
  const latitudeDistance = (second.lat - first.lat) * latitudeScale;
  const longitudeDistance = (second.lng - first.lng) * longitudeScale;
  return Math.hypot(latitudeDistance, longitudeDistance);
}

function markerIcon(marker: VisibleMarker) {
  const isVia = marker.kind === 'via';
  const className = `slipstream-route-marker slipstream-route-marker--${marker.kind}`;
  const caption = marker.kind === 'start'
    ? '<small>Старт</small>'
    : marker.kind === 'finish'
      ? '<small>Финиш</small>'
      : marker.kind === 'roundtrip'
        ? '<small>Старт · финиш</small>'
        : '';
  return divIcon({
    className: 'slipstream-route-marker-container',
    html: `<span class="${className}" aria-hidden="true"><b>${marker.label}</b>${caption}</span>`,
    iconSize: isVia ? [30, 30] : [112, 42],
    iconAnchor: isVia ? [15, 15] : [21, 21],
  });
}

function ClickToAdd({ onAdd, disabled }: { onAdd: (point: RoutePoint) => void; disabled: boolean }) {
  const map = useMapEvents({
    click(event) {
      if (!disabled) onAdd({ lat: event.latlng.lat, lng: event.latlng.lng });
    },
  });

  useEffect(() => {
    const container = map.getContainer();
    container.setAttribute('aria-label', disabled
      ? 'Карта строит велосипедный маршрут по дорогам'
      : 'Карта выбора маршрута. Коснитесь карты или нажмите Enter, чтобы добавить точку в центре.');
    container.setAttribute('aria-busy', String(disabled));

    function addCenterWithKeyboard(event: KeyboardEvent) {
      if (disabled || event.target !== container || (event.key !== 'Enter' && event.key !== ' ')) return;
      event.preventDefault();
      const center = map.getCenter();
      onAdd({ lat: center.lat, lng: center.lng });
    }

    container.addEventListener('keydown', addCenterWithKeyboard);
    return () => container.removeEventListener('keydown', addCenterWithKeyboard);
  }, [disabled, map, onAdd]);

  return null;
}

function PlannerViewport({ positions }: { positions: [number, number][] }) {
  const map = useMap();

  useEffect(() => {
    const container = map.getContainer();
    if (typeof ResizeObserver === 'undefined') {
      map.invalidateSize({ animate: false, pan: false });
      return undefined;
    }
    const observer = new ResizeObserver(() => map.invalidateSize({ animate: false, pan: false }));
    observer.observe(container);
    map.invalidateSize({ animate: false, pan: false });
    return () => observer.disconnect();
  }, [map]);

  useEffect(() => {
    if (positions.length === 0) return;
    const animate = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (positions.length === 1) {
      map.setView(positions[0], 15, { animate });
      return;
    }
    map.fitBounds(latLngBounds(positions), {
      animate,
      duration: .35,
      maxZoom: 17,
      paddingTopLeft: [34, 54],
      paddingBottomRight: [34, 42],
    });
  }, [map, positions]);

  return null;
}

function visibleMarkers(
  points: readonly RoutePoint[],
  waypoints: readonly RoutePoint[],
  snappedWaypoints: readonly RoutePoint[],
  routing: boolean,
): VisibleMarker[] {
  if (waypoints.length === 0) return [];
  if (waypoints.length === 1) {
    return [{ key: 'start', point: waypoints[0], kind: 'start', label: 'A' }];
  }

  const hasSnappedWaypoints = !routing && points.length > 1 && snappedWaypoints.length === waypoints.length;
  const markerPoints = hasSnappedWaypoints ? snappedWaypoints : waypoints;
  const start = markerPoints[0];
  const finish = markerPoints[markerPoints.length - 1];
  const markers: VisibleMarker[] = markerPoints.slice(1, -1).map((point, index) => ({
    key: `via-${index}-${point.lat}-${point.lng}`,
    point,
    kind: 'via',
    label: String(index + 2),
  }));

  if (distanceBetweenMeters(start, finish) < 20) {
    return [{ key: 'roundtrip', point: start, kind: 'roundtrip', label: 'A/Б' }, ...markers];
  }
  return [
    { key: 'start', point: start, kind: 'start', label: 'A' },
    ...markers,
    { key: 'finish', point: finish, kind: 'finish', label: 'Б' },
  ];
}

export function RoutePlannerMap({ points, waypoints, snappedWaypoints = [], onAdd, routing }: PlannerMapProps) {
  const routePositions = useMemo(
    () => points.map((point) => [point.lat, point.lng] as [number, number]),
    [points],
  );
  const fitPositions = useMemo(() => [
    ...routePositions,
    ...waypoints.map((point) => [point.lat, point.lng] as [number, number]),
  ], [routePositions, waypoints]);
  const markers = useMemo(
    () => visibleMarkers(points, waypoints, snappedWaypoints, routing),
    [points, routing, snappedWaypoints, waypoints],
  );
  const snapConnectors = useMemo(() => {
    if (routing || snappedWaypoints.length !== waypoints.length) return [];
    return waypoints.flatMap((point, index) => {
      const snapped = snappedWaypoints[index];
      if (!snapped || distanceBetweenMeters(point, snapped) < 8) return [];
      return [[[point.lat, point.lng], [snapped.lat, snapped.lng]] as [number, number][]];
    });
  }, [routing, snappedWaypoints, waypoints]);
  const hint = routing
    ? 'Строим путь по дорогам и велодорожкам…'
    : waypoints.length === 0
      ? 'Коснитесь карты, чтобы поставить старт'
      : waypoints.length === 1
        ? 'Теперь выберите финиш маршрута'
        : '';

  return (
    <MapContainer
      center={DEFAULT_CENTER}
      zoom={11}
      minZoom={3}
      maxZoom={19}
      zoomSnap={0.125}
      zoomDelta={0.25}
      wheelPxPerZoomLevel={360}
      touchZoom="center"
      scrollWheelZoom
      className={`route-map planner-map slipstream-route-planner${routing ? ' is-routing' : ''}`}
    >
      <CommunityTileLayer />
      <ClickToAdd onAdd={onAdd} disabled={routing} />
      <PlannerViewport positions={fitPositions} />
      {snapConnectors.map((positions, index) => <Polyline
        key={`snap-${index}`}
        positions={positions}
        pathOptions={{ color: '#f8fbff', opacity: .72, weight: 3, dashArray: '3 7', lineCap: 'round' }}
        interactive={false}
      />)}
      <DirectionalRouteLine points={points} weight={6} maxArrows={18} />
      {markers.map((marker) => <Marker
        key={marker.key}
        position={[marker.point.lat, marker.point.lng]}
        icon={markerIcon(marker)}
        title={marker.kind === 'start' ? 'Старт' : marker.kind === 'finish' ? 'Финиш' : marker.kind === 'roundtrip' ? 'Старт и финиш' : `Промежуточная точка ${marker.label}`}
        alt={marker.kind === 'start' ? 'Старт маршрута' : marker.kind === 'finish' ? 'Финиш маршрута' : marker.kind === 'roundtrip' ? 'Старт и финиш маршрута' : `Промежуточная точка ${marker.label}`}
        interactive={false}
        keyboard={false}
        zIndexOffset={marker.kind === 'via' ? 650 : 800}
      />)}
      {hint && <div className="slipstream-route-map-status" role="status" aria-live="polite">
        {routing && <span aria-hidden="true" />}
        {hint}
      </div>}
    </MapContainer>
  );
}
