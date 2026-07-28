import { MapContainer, Polyline, TileLayer, useMapEvents } from 'react-leaflet';
import type { RoutePoint } from '../lib/cyclingModels';

function ClickToAdd({ onAdd }: { onAdd: (point: RoutePoint) => void }) {
  useMapEvents({ click(event) { onAdd({ lat: event.latlng.lat, lng: event.latlng.lng }); } });
  return null;
}

export function RoutePlannerMap({ points, onAdd }: { points: RoutePoint[]; onAdd: (point: RoutePoint) => void }) {
  const positions = points.map((point) => [point.lat, point.lng] as [number, number]);
  return (
    <MapContainer center={[43.2389, 76.8897]} zoom={11} className="route-map planner-map">
      <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      <ClickToAdd onAdd={onAdd} />
      {positions.length > 1 && <Polyline positions={positions} pathOptions={{ color: '#ff5a1f', weight: 4 }} />}
    </MapContainer>
  );
}
