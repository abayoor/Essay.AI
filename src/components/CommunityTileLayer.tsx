import { useEffect, useState, type SyntheticEvent } from 'react';
import { Bike, Map, Mountain } from 'lucide-react';
import { TileLayer, useMap } from 'react-leaflet';
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
    attribution: 'Imagery &amp; relief &copy; <a href="https://www.esri.com/">Esri</a> and its data providers',
    maxNativeZoom: 19,
    url: 'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
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

function MapBackground({ style }: { style: MapLayerStyle }) {
  const map = useMap();

  useEffect(() => {
    const container = map.getContainer();
    const className = `map-style-${style}`;
    container.classList.add(className);
    return () => container.classList.remove(className);
  }, [map, style]);

  return null;
}

export function CommunityTileLayer({ showSwitcher = false }: { showSwitcher?: boolean }) {
  const text = useLocaleText();
  const [style, setStyle] = useState<MapLayerStyle>(savedLayer);
  const layer = layers[style];
  const options = [
    { value: 'standard' as const, label: text('Обычная', 'Қалыпты', 'Standard'), icon: Map },
    { value: 'terrain' as const, label: text('Спутник + рельеф', 'Спутник + жер бедері', 'Satellite + terrain'), icon: Mountain },
    { value: 'cycling' as const, label: text('Вело', 'Вело', 'Cycling'), icon: Bike },
  ];

  function chooseLayer(nextStyle: MapLayerStyle) {
    setStyle(nextStyle);
    window.localStorage.setItem(storageKey, nextStyle);
  }

  return <>
    <MapBackground style={style} />
    <TileLayer
      key={style}
      className="community-map-tiles"
      attribution={layer.attribution}
      url={layer.url}
      maxZoom={20}
      maxNativeZoom={layer.maxNativeZoom}
      updateWhenIdle={false}
      updateWhenZooming={false}
      updateInterval={180}
      keepBuffer={2}
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
