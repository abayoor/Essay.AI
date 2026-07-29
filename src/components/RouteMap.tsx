import { CircleMarker, MapContainer, Polyline, TileLayer } from 'react-leaflet';
import type { RoutePoint } from '../lib/cyclingModels';

const almaty: [number, number] = [43.2389, 76.8897];

export function RouteMap({ points, className = '' }: { points: RoutePoint[]; className?: string }) {
  const positions = points.map((point) => [point.lat, point.lng] as [number, number]);
  const center = positions[0] ?? almaty;
  return (
    <MapContainer center={center} zoom={positions.length ? 12 : 11} scrollWheelZoom={false} className={`route-map ${className}`}>
      <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      {positions.length > 1 && <Polyline positions={positions} pathOptions={{ color: '#1b8577', weight: 4 }} />}
      {positions.map((position, index) => <CircleMarker center={position} key={`${position[0]}-${position[1]}`} radius={index === 0 ? 7 : 4} pathOptions={{ color: '#fff', fillColor: index === 0 ? '#3e6f5c' : '#1b8577', fillOpacity: 1, weight: 2 }} />)}
    </MapContainer>
  );
}
