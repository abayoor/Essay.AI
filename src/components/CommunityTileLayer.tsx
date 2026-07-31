import { useState, type SyntheticEvent } from 'react';
import { Bike, Map, Mountain } from 'lucide-react';
import { TileLayer } from 'react-leaflet';
import { useLocaleText } from '../lib/localized';

type MapLayerStyle = 'standard' | 'terrain' | 'cycling';

const storageKey = 'slipstream-map-layer';

const layers: Record<MapLayerStyle, {
  attribution: string;
  maxNativeZoom: number;
  url: string;
}> = {
  standard: {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxNativeZoom: 19,
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
  },
  terrain: {
    attribution: 'Map data: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>, SRTM | Map style: &copy; <a href="https://opentopomap.org">OpenTopoMap</a> (CC-BY-SA)',
    maxNativeZoom: 17,
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
  },
  cycling: {
    attribution: '<a href="https://www.cyclosm.org">CyclOSM</a> | Map data: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxNativeZoom: 20,
    url: 'https://{s}.tile-cyclosm.openstreetmap.fr/cyclosm/{z}/{x}/{y}.png',
  },
};

function savedLayer(): MapLayerStyle {
  const value = window.localStorage.getItem(storageKey);
  return value === 'terrain' || value === 'cycling' ? value : 'standard';
}

function stopMapEvent(event: SyntheticEvent) {
  event.stopPropagation();
}

export function CommunityTileLayer({ showSwitcher = false }: { showSwitcher?: boolean }) {
  const text = useLocaleText();
  const [style, setStyle] = useState<MapLayerStyle>(savedLayer);
  const layer = layers[style];
  const options = [
    { value: 'standard' as const, label: text('Обычная', 'Қалыпты', 'Standard'), icon: Map },
    { value: 'terrain' as const, label: text('Рельеф', 'Жер бедері', 'Terrain'), icon: Mountain },
    { value: 'cycling' as const, label: text('Вело', 'Вело', 'Cycling'), icon: Bike },
  ];

  function chooseLayer(nextStyle: MapLayerStyle) {
    setStyle(nextStyle);
    window.localStorage.setItem(storageKey, nextStyle);
  }

  return <>
    <TileLayer
      key={style}
      attribution={layer.attribution}
      url={layer.url}
      maxZoom={20}
      maxNativeZoom={layer.maxNativeZoom}
      updateWhenIdle={false}
      updateWhenZooming
      updateInterval={500}
      keepBuffer={4}
    />
    {showSwitcher && <div
      className="map-layer-switcher leaflet-control"
      role="group"
      aria-label={text('Вид карты', 'Карта көрінісі', 'Map style')}
      onClick={stopMapEvent}
      onDoubleClick={stopMapEvent}
      onPointerDown={stopMapEvent}
      onWheel={stopMapEvent}
    >
      {options.map(({ value, label, icon: Icon }) => <button
        type="button"
        className={style === value ? 'active' : ''}
        aria-pressed={style === value}
        title={label}
        key={value}
        onClick={() => chooseLayer(value)}
      ><Icon size={15} aria-hidden="true" /><span>{label}</span></button>)}
    </div>}
  </>;
}
