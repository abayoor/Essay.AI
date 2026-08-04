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

type RouteMapProps = {
  className?: string;
  points: RoutePoint[];
  staticPreview?: boolean;
};

export function RouteMap({ points, className = '', staticPreview = false }: RouteMapProps) {
  const positions = points.map((point) => [point.lat, point.lng] as [number, number]);
  const segments = points.reduce<[number, number][][]>((result, point) => {
    const segmentStart = 'segmentStart' in point && point.segmentStart === true;
    if (!result.length || (segmentStart && result[result.length - 1].length > 0)) result.push([]);
    result[result.length - 1].push([point.lat, point.lng]);
    return result;
  }, []);
  const center = positions[0] ?? almaty;
  return (
    <MapContainer
      attributionControl
      boxZoom={!staticPreview}
      center={center}
      doubleClickZoom={!staticPreview}
      dragging={!staticPreview}
      fadeAnimation={false}
      keyboard={!staticPreview}
      preferCanvas
      scrollWheelZoom={false}
      touchZoom={!staticPreview}
      zoom={positions.length ? 12 : 11}
      zoomControl={!staticPreview}
      className={`route-map ${className}`}
    >
      <CommunityTileLayer fixedStyle={staticPreview ? 'standard' : undefined} showLoading={!staticPreview} />
      <FitRoute positions={positions} />
      {segments.map((segment, index) => segment.length > 1 && <Polyline interactive={false} key={`route-segment-${index}`} positions={segment} pathOptions={{ color: '#087d69', weight: staticPreview ? 6 : 5, lineCap: 'round', lineJoin: 'round' }} />)}
      {positions[0] && <CircleMarker interactive={false} center={positions[0]} radius={7} pathOptions={{ color: '#fff', fillColor: '#087d69', fillOpacity: 1, weight: 3 }} />}
      {positions.length > 1 && <CircleMarker interactive={false} center={positions[positions.length - 1]} radius={7} pathOptions={{ color: '#fff', fillColor: '#f6bf18', fillOpacity: 1, weight: 3 }} />}
    </MapContainer>
  );
}
