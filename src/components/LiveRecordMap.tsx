import { CircleMarker, MapContainer, Polyline, TileLayer, useMap } from 'react-leaflet';
import { useEffect } from 'react';
import type { GpsTrackPoint } from '../lib/cyclingModels';

const almaty: [number, number] = [43.2389, 76.8897];

function FollowRider({ point }: { point: GpsTrackPoint | null }) {
  const map = useMap();
  useEffect(() => {
    if (point) map.panTo([point.lat, point.lng], { animate: true });
  }, [map, point]);
  return null;
}

export function LiveRecordMap({ track, className = 'record-map' }: { track: GpsTrackPoint[]; className?: string }) {
  const currentPoint = track[track.length - 1] ?? null;
  const positions = track.map((point) => [point.lat, point.lng] as [number, number]);
  return <MapContainer center={currentPoint ? [currentPoint.lat, currentPoint.lng] : almaty} zoom={15} className={className} zoomControl={false}>
    <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
    <FollowRider point={currentPoint} />
    {positions.length > 1 && <Polyline positions={positions} pathOptions={{ color: '#1b8577', weight: 5 }} />}
    {currentPoint && <CircleMarker center={[currentPoint.lat, currentPoint.lng]} radius={9} pathOptions={{ color: '#fff', fillColor: '#1b8577', fillOpacity: 1, weight: 3 }} />}
  </MapContainer>;
}
