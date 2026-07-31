import { CircleMarker, MapContainer, Polyline, useMap, ZoomControl } from 'react-leaflet';
import { useEffect } from 'react';
import type { GpsTrackPoint } from '../lib/cyclingModels';
import { CommunityTileLayer } from './CommunityTileLayer';

const almaty: [number, number] = [43.2389, 76.8897];

function FollowRider({ point }: { point: GpsTrackPoint | null }) {
  const map = useMap();
  useEffect(() => {
    if (point) map.panTo([point.lat, point.lng], { animate: true });
  }, [map, point]);
  return null;
}

function KeepMapSized() {
  const map = useMap();
  useEffect(() => {
    const timer = window.setTimeout(() => map.invalidateSize(), 0);
    return () => window.clearTimeout(timer);
  }, [map]);
  return null;
}

export function LiveRecordMap({ track, currentPoint = null, className = 'record-map' }: { track: GpsTrackPoint[]; currentPoint?: GpsTrackPoint | null; className?: string }) {
  const displayedPoint = currentPoint ?? track[track.length - 1] ?? null;
  const positions = track.map((point) => [point.lat, point.lng] as [number, number]);
  return <MapContainer center={displayedPoint ? [displayedPoint.lat, displayedPoint.lng] : almaty} zoom={15} minZoom={4} maxZoom={18} zoomSnap={0.125} zoomDelta={0.25} wheelPxPerZoomLevel={360} touchZoom="center" scrollWheelZoom className={className} zoomControl={false}>
    <CommunityTileLayer showSwitcher />
    <ZoomControl position="bottomright" />
    <KeepMapSized />
    <FollowRider point={displayedPoint} />
    {positions.length > 1 && <Polyline positions={positions} pathOptions={{ color: '#1b8577', weight: 5, lineCap: 'round', lineJoin: 'round' }} />}
    {displayedPoint && <>
      <CircleMarker center={[displayedPoint.lat, displayedPoint.lng]} radius={18} pathOptions={{ color: '#1b8577', fillColor: '#1b8577', fillOpacity: .16, weight: 2 }} />
      <CircleMarker center={[displayedPoint.lat, displayedPoint.lng]} radius={8} pathOptions={{ color: '#fff', fillColor: '#1b8577', fillOpacity: 1, weight: 3 }} />
    </>}
  </MapContainer>;
}
