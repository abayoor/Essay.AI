import { divIcon } from 'leaflet';
import { MapContainer, Marker, Polyline, useMap, ZoomControl } from 'react-leaflet';
import { useEffect, useRef } from 'react';
import type { GpsTrackPoint } from '../lib/cyclingModels';
import { splitGpsTrackSegments } from '../lib/gps';
import { CommunityTileLayer } from './CommunityTileLayer';
import './LiveRecordMap.css';

const almaty: [number, number] = [43.2389, 76.8897];

const currentLocationIcon = divIcon({
  className: 'record-rider-location-marker',
  html: '<span class="record-rider-location-beacon" aria-hidden="true"><span class="record-rider-location-dot"></span></span>',
  iconSize: [58, 58],
  iconAnchor: [29, 29],
});

function FollowRider({ point }: { point: GpsTrackPoint | null }) {
  const map = useMap();
  const hasCentered = useRef(false);
  useEffect(() => {
    if (!point) return;
    if (!hasCentered.current) {
      hasCentered.current = true;
      map.setView([point.lat, point.lng], Math.max(map.getZoom(), 16), { animate: false });
      return;
    }
    if (map.distance(map.getCenter(), [point.lat, point.lng]) > 18) {
      map.panTo([point.lat, point.lng], { animate: true, duration: .35 });
    }
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
  const segments = splitGpsTrackSegments(track).map((segment) => segment.map((point) => [point.lat, point.lng] as [number, number]));
  return <MapContainer center={displayedPoint ? [displayedPoint.lat, displayedPoint.lng] : almaty} zoom={15} minZoom={4} maxZoom={18} zoomSnap={0.125} zoomDelta={0.25} wheelPxPerZoomLevel={360} touchZoom="center" scrollWheelZoom className={className} zoomControl={false} fadeAnimation={false}>
    <CommunityTileLayer showSwitcher />
    <ZoomControl position="bottomright" />
    <KeepMapSized />
    <FollowRider point={displayedPoint} />
    {segments.map((positions, index) => positions.length > 1 && <Polyline key={`record-outline-${index}`} positions={positions} pathOptions={{ color: '#071310', opacity: .8, weight: 9, lineCap: 'round', lineJoin: 'round' }} />)}
    {segments.map((positions, index) => positions.length > 1 && <Polyline key={`record-route-${index}`} positions={positions} pathOptions={{ color: '#2f6f55', weight: 5, lineCap: 'round', lineJoin: 'round' }} />)}
    {displayedPoint && <Marker position={[displayedPoint.lat, displayedPoint.lng]} icon={currentLocationIcon} interactive={false} keyboard={false} zIndexOffset={1200} />}
  </MapContainer>;
}
