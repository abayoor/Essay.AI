import { TileLayer } from 'react-leaflet';

export function CommunityTileLayer() {
  return (
    <TileLayer
      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      maxZoom={18}
      maxNativeZoom={18}
      updateWhenIdle={false}
      updateWhenZooming
      updateInterval={500}
      keepBuffer={4}
    />
  );
}
