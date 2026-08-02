import { divIcon, latLngBounds } from 'leaflet';
import { useEffect } from 'react';
import { MapContainer, Marker, Popup, useMap, ZoomControl } from 'react-leaflet';
import type { FriendLiveLocation } from '../lib/friends';
import { CommunityTileLayer } from './CommunityTileLayer';

const friendMarker = divIcon({
  className: 'friend-map-marker',
  html: '<span aria-hidden="true"></span>',
  iconSize: [34, 34],
  iconAnchor: [17, 17],
});

function FriendsViewport({ locations }: { locations: FriendLiveLocation[] }) {
  const map = useMap();
  useEffect(() => {
    if (!locations.length) return;
    if (locations.length === 1) {
      map.setView([locations[0].lat, locations[0].lng], 15);
      return;
    }
    map.fitBounds(latLngBounds(locations.map((location) => [location.lat, location.lng])), { padding: [38, 38], maxZoom: 16 });
  }, [locations, map]);
  return null;
}

export function FriendsMap({ locations }: { locations: FriendLiveLocation[] }) {
  return <div className="friends-map" aria-label="Карта друзей">
    <MapContainer center={locations.length ? [locations[0].lat, locations[0].lng] : [43.2389, 76.8897]} zoom={12} zoomControl={false}>
      <CommunityTileLayer />
      <ZoomControl position="bottomright" />
      <FriendsViewport locations={locations} />
      {locations.map((location) => <Marker key={location.rider.id} position={[location.lat, location.lng]} icon={friendMarker}>
        <Popup>
          <strong>{location.rider.full_name || `@${location.rider.username}`}</strong><br />
          GPS ±{Math.round(location.accuracyM)} м<br />
          <small>{new Intl.DateTimeFormat('ru', { hour: '2-digit', minute: '2-digit' }).format(new Date(location.updatedAt))}</small>
        </Popup>
      </Marker>)}
    </MapContainer>
  </div>;
}
