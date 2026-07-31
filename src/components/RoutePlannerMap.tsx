import { CircleMarker, MapContainer, Polyline, useMapEvents } from 'react-leaflet';
import type { RoutePoint } from '../lib/cyclingModels';
import { CommunityTileLayer } from './CommunityTileLayer';

function ClickToAdd({ onAdd, disabled }: { onAdd: (point: RoutePoint) => void; disabled: boolean }) {
  useMapEvents({ click(event) { if (!disabled) onAdd({ lat: event.latlng.lat, lng: event.latlng.lng }); } });
  return null;
}

export function RoutePlannerMap({ points, waypoints, onAdd, routing }: { points: RoutePoint[]; waypoints: RoutePoint[]; onAdd: (point: RoutePoint) => void; routing: boolean }) {
  const positions = points.map((point) => [point.lat, point.lng] as [number, number]);
  return (
    <MapContainer center={[43.2389, 76.8897]} zoom={11} zoomSnap={0.125} zoomDelta={0.25} wheelPxPerZoomLevel={360} touchZoom="center" scrollWheelZoom className="route-map planner-map">
      <CommunityTileLayer />
      <ClickToAdd onAdd={onAdd} disabled={routing} />
      {positions.length > 1 && <Polyline positions={positions} pathOptions={{ color: '#1b8577', weight: 4 }} />}
      {waypoints.map((point, index) => <CircleMarker center={[point.lat, point.lng]} key={`${point.lat}-${point.lng}-${index}`} radius={index === 0 ? 7 : 5} pathOptions={{ color: '#fff', fillColor: index === 0 ? '#3e6f5c' : '#1b8577', fillOpacity: 1, weight: 2 }} />)}
    </MapContainer>
  );
}
