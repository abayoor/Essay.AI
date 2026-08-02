import { useEffect, useMemo, useRef, useState, type SyntheticEvent } from 'react';
import { Bike, LoaderCircle, Map, Mountain } from 'lucide-react';
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
  try {
    const value = window.localStorage.getItem(storageKey);
    return value === 'standard' || value === 'terrain' || value === 'cycling' ? value : 'cycling';
  } catch {
    return 'cycling';
  }
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

type TileEvent = { tile?: HTMLImageElement };

export function CommunityTileLayer({ showSwitcher = false }: { showSwitcher?: boolean }) {
  const text = useLocaleText();
  const [style, setStyle] = useState<MapLayerStyle>(savedLayer);
  const [loadingTiles, setLoadingTiles] = useState(0);
  const [showTileLoading, setShowTileLoading] = useState(false);
  const pendingTiles = useRef(new Set<HTMLImageElement>());
  const layer = layers[style];
  const options = [
    { value: 'standard' as const, label: text('Обычная', 'Қалыпты', 'Standard'), icon: Map },
    { value: 'terrain' as const, label: text('Спутник + рельеф', 'Спутник + жер бедері', 'Satellite + terrain'), icon: Mountain },
    { value: 'cycling' as const, label: text('Вело', 'Вело', 'Cycling'), icon: Bike },
  ];

  function chooseLayer(nextStyle: MapLayerStyle) {
    setStyle(nextStyle);
    try { window.localStorage.setItem(storageKey, nextStyle); }
    catch { /* The selected layer still works when storage is unavailable. */ }
  }

  useEffect(() => {
    pendingTiles.current.clear();
    setLoadingTiles(0);
  }, [style]);

  useEffect(() => {
    if (loadingTiles === 0) {
      setShowTileLoading(false);
      return undefined;
    }
    const timer = window.setTimeout(() => setShowTileLoading(true), 220);
    return () => window.clearTimeout(timer);
  }, [loadingTiles]);

  const tileEvents = useMemo(() => ({
    tileloadstart: (event: unknown) => {
      const tile = (event as TileEvent).tile;
      if (!tile || pendingTiles.current.has(tile)) return;
      pendingTiles.current.add(tile);
      setLoadingTiles(pendingTiles.current.size);
    },
    tileload: (event: unknown) => {
      const tile = (event as TileEvent).tile;
      if (!tile || !pendingTiles.current.delete(tile)) return;
      setLoadingTiles(pendingTiles.current.size);
    },
    tileerror: (event: unknown) => {
      const tile = (event as TileEvent).tile;
      if (tile) {
        tile.style.opacity = '0';
        tile.setAttribute('aria-hidden', 'true');
        pendingTiles.current.delete(tile);
      }
      setLoadingTiles(pendingTiles.current.size);
    },
    tileunload: (event: unknown) => {
      const tile = (event as TileEvent).tile;
      if (!tile || !pendingTiles.current.delete(tile)) return;
      setLoadingTiles(pendingTiles.current.size);
    },
  }), []);

  const sharedTileProps = {
    maxZoom: 20,
    updateWhenIdle: false,
    updateWhenZooming: false,
    updateInterval: 160,
    keepBuffer: 3,
    eventHandlers: tileEvents,
  };

  return <>
    <MapBackground style={style} />
    <TileLayer
      key={style}
      className="community-map-tiles"
      attribution={layer.attribution}
      url={layer.url}
      maxNativeZoom={layer.maxNativeZoom}
      {...sharedTileProps}
    />
    {style === 'terrain' && <TileLayer
      key="terrain-hillshade"
      className="community-map-tiles community-map-hillshade"
      attribution=""
      url="https://services.arcgisonline.com/ArcGIS/rest/services/Elevation/World_Hillshade/MapServer/tile/{z}/{y}/{x}"
      maxNativeZoom={20}
      opacity={0.34}
      {...sharedTileProps}
    />}
    {showTileLoading && <div className="map-tile-loading visible" role="status" aria-live="polite">
      <LoaderCircle size={14} aria-hidden="true" />
      <span>{text('Обновляем карту', 'Карта жаңартылуда', 'Updating map')}</span>
    </div>}
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
