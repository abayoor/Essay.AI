import { latLngBounds } from 'leaflet';
import { useEffect } from 'react';
import { CircleMarker, MapContainer, Polyline, useMap } from 'react-leaflet';
import type { RoutePoint } from '../lib/cyclingModels';
import { CommunityTileLayer } from './CommunityTileLayer';

const almaty: [number, number] = [43.2389, 76.8897];

function FitRoute({ positions }: { positions: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (positions.length > 1) {
      map.fitBounds(latLngBounds(positions), { padding: [28, 28], maxZoom: 15 });
    } else if (positions[0]) {
      map.setView(positions[0], 14);
    }
  }, [map, positions]);
  return null;
}

export function RouteMap({ points, className = '' }: { points: RoutePoint[]; className?: string }) {
  const positions = points.map((point) => [point.lat, point.lng] as [number, number]);
  const center = positions[0] ?? almaty;
  return (
    <MapContainer center={center} zoom={positions.length ? 12 : 11} scrollWheelZoom={false} className={`route-map ${className}`}>
      <CommunityTileLayer />
      <FitRoute positions={positions} />
      {positions.length > 1 && <Polyline positions={positions} pathOptions={{ color: '#1b8577', weight: 4 }} />}
      {positions.map((position, index) => <CircleMarker center={position} key={`${position[0]}-${position[1]}`} radius={index === 0 ? 7 : 4} pathOptions={{ color: '#fff', fillColor: index === 0 ? '#3e6f5c' : '#1b8577', fillOpacity: 1, weight: 2 }} />)}
    </MapContainer>
  );
}
