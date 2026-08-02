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
  const segments = points.reduce<[number, number][][]>((result, point) => {
    const segmentStart = 'segmentStart' in point && point.segmentStart === true;
    if (!result.length || (segmentStart && result[result.length - 1].length > 0)) result.push([]);
    result[result.length - 1].push([point.lat, point.lng]);
    return result;
  }, []);
  const center = positions[0] ?? almaty;
  return (
    <MapContainer center={center} zoom={positions.length ? 12 : 11} scrollWheelZoom={false} className={`route-map ${className}`}>
      <CommunityTileLayer />
      <FitRoute positions={positions} />
      {segments.map((segment, index) => segment.length > 1 && <Polyline key={`route-segment-${index}`} positions={segment} pathOptions={{ color: '#52d0bc', weight: 5, lineCap: 'round', lineJoin: 'round' }} />)}
      {positions[0] && <CircleMarker center={positions[0]} radius={7} pathOptions={{ color: '#fff', fillColor: '#3e6f5c', fillOpacity: 1, weight: 2 }} />}
      {positions.length > 1 && <CircleMarker center={positions[positions.length - 1]} radius={6} pathOptions={{ color: '#fff', fillColor: '#52d0bc', fillOpacity: 1, weight: 2 }} />}
    </MapContainer>
  );
}
