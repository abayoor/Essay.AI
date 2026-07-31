import type { RoutePoint } from './cyclingModels';

export type MapPlace = RoutePoint & {
  id: string;
  name: string;
  subtitle: string;
};

export type ResolvedMapLocation = {
  label: string;
  city: string | null;
  country: string | null;
};

type PhotonFeature = {
  geometry?: { coordinates?: unknown };
  properties?: Record<string, unknown>;
};

function featureProperties(feature: PhotonFeature): Record<string, unknown> {
  return feature.properties ?? {};
}

function photonFeatureToPlace(feature: PhotonFeature, index: number, fallbackName: string): MapPlace | null {
  const coordinates = feature.geometry?.coordinates;
  const properties = featureProperties(feature);
  if (!Array.isArray(coordinates) || typeof coordinates[0] !== 'number' || typeof coordinates[1] !== 'number') return null;
  const name = typeof properties.name === 'string' ? properties.name : fallbackName;
  const subtitle = [properties.street, properties.housenumber, properties.city, properties.state, properties.country]
    .filter((item): item is string => typeof item === 'string')
    .filter((item, itemIndex, values) => values.indexOf(item) === itemIndex)
    .join(', ');
  return {
    id: `osm-${String(properties.osm_type ?? 'place')}-${String(properties.osm_id ?? index)}`,
    lat: coordinates[1],
    lng: coordinates[0],
    name,
    subtitle: subtitle || 'Адрес из OpenStreetMap',
  };
}

async function photonFeatures(url: string, signal?: AbortSignal): Promise<PhotonFeature[]> {
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error('Поиск адресов временно недоступен.');
  const payload: unknown = await response.json();
  return typeof payload === 'object' && payload !== null && Array.isArray((payload as Record<string, unknown>).features)
    ? (payload as { features: PhotonFeature[] }).features
    : [];
}

function latinSearchValue(value: string): string {
  const letters: Record<string, string> = {
    а: 'a', ә: 'a', б: 'b', в: 'v', г: 'g', ғ: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z',
    и: 'i', й: 'i', к: 'k', қ: 'k', л: 'l', м: 'm', н: 'n', ң: 'n', о: 'o', ө: 'o', п: 'p',
    р: 'r', с: 's', т: 't', у: 'u', ұ: 'u', ү: 'u', ф: 'f', х: 'h', һ: 'h', ц: 'ts', ч: 'ch',
    ш: 'sh', щ: 'sh', ы: 'y', і: 'i', э: 'e', ю: 'yu', я: 'ya', ь: '', ъ: '',
  };
  return value
    .toLocaleLowerCase('ru')
    .replace(/^(ул\.?|улица|көшесі)\s+/u, '')
    .split('')
    .map((letter) => letters[letter] ?? letter)
    .join('');
}

export async function searchMapPlaces(query: string, center: RoutePoint | null, signal?: AbortSignal): Promise<MapPlace[]> {
  const value = query.trim();
  if (value.length < 2) return [];
  const globalParams = new URLSearchParams({ q: value, limit: '10' });
  if (!center) {
    const features = await photonFeatures(`https://photon.komoot.io/api/?${globalParams.toString()}`, signal);
    return features.map((feature, index) => photonFeatureToPlace(feature, index, value)).filter((place): place is MapPlace => place !== null);
  }

  const latitudeRadius = 0.32;
  const longitudeRadius = Math.min(0.55, latitudeRadius / Math.max(Math.cos(center.lat * Math.PI / 180), 0.35));
  const localParams = new URLSearchParams({
    q: value,
    limit: '10',
    lat: String(center.lat),
    lon: String(center.lng),
    zoom: '13',
    location_bias_scale: '0.05',
    bbox: [
      center.lng - longitudeRadius,
      center.lat - latitudeRadius,
      center.lng + longitudeRadius,
      center.lat + latitudeRadius,
    ].map((coordinate) => coordinate.toFixed(6)).join(','),
  });
  globalParams.set('lat', String(center.lat));
  globalParams.set('lon', String(center.lng));
  globalParams.set('zoom', '11');
  globalParams.set('location_bias_scale', '0.15');

  const latinValue = latinSearchValue(value);
  const latinParams = new URLSearchParams(localParams);
  latinParams.set('q', latinValue);
  const [localFeatures, latinFeatures, globalFeatures] = await Promise.all([
    photonFeatures(`https://photon.komoot.io/api/?${localParams.toString()}`, signal),
    latinValue !== value.toLocaleLowerCase('ru')
      ? photonFeatures(`https://photon.komoot.io/api/?${latinParams.toString()}`, signal)
      : Promise.resolve([]),
    photonFeatures(`https://photon.komoot.io/api/?${globalParams.toString()}`, signal),
  ]);
  const places = [...localFeatures, ...latinFeatures, ...globalFeatures]
    .map((feature, index) => photonFeatureToPlace(feature, index, value))
    .filter((place): place is MapPlace => place !== null);
  return places.filter((place, index) => places.findIndex((candidate) => candidate.id === place.id) === index).slice(0, 10);
}

export async function reverseMapLocation(point: RoutePoint, signal?: AbortSignal): Promise<ResolvedMapLocation> {
  const params = new URLSearchParams({
    lat: String(point.lat),
    lon: String(point.lng),
    radius: '5',
    limit: '1',
  });
  const feature = (await photonFeatures(`https://photon.komoot.io/reverse?${params.toString()}`, signal))[0];
  const properties = feature ? featureProperties(feature) : {};
  const city = [properties.city, properties.locality, properties.county].find((value): value is string => typeof value === 'string') ?? null;
  const country = typeof properties.country === 'string' ? properties.country : null;
  const street = typeof properties.street === 'string' ? properties.street : null;
  const label = [street, city, country].filter((value, index, values) => Boolean(value) && values.indexOf(value) === index).join(', ');
  return { label: label || `${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}`, city, country };
}
