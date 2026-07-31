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

export async function searchMapPlaces(query: string, center: RoutePoint | null, signal?: AbortSignal): Promise<MapPlace[]> {
  const value = query.trim();
  if (value.length < 2) return [];
  const params = new URLSearchParams({ q: value, limit: '10', lang: 'en' });
  if (center) {
    params.set('lat', String(center.lat));
    params.set('lon', String(center.lng));
    params.set('zoom', '12');
    params.set('location_bias_scale', '0.25');
  }
  const features = await photonFeatures(`https://photon.komoot.io/api/?${params.toString()}`, signal);
  return features.map((feature, index) => photonFeatureToPlace(feature, index, value)).filter((place): place is MapPlace => place !== null);
}

export async function reverseMapLocation(point: RoutePoint, signal?: AbortSignal): Promise<ResolvedMapLocation> {
  const params = new URLSearchParams({
    lat: String(point.lat),
    lon: String(point.lng),
    radius: '5',
    limit: '1',
    lang: 'en',
  });
  const feature = (await photonFeatures(`https://photon.komoot.io/reverse?${params.toString()}`, signal))[0];
  const properties = feature ? featureProperties(feature) : {};
  const city = [properties.city, properties.locality, properties.county].find((value): value is string => typeof value === 'string') ?? null;
  const country = typeof properties.country === 'string' ? properties.country : null;
  const street = typeof properties.street === 'string' ? properties.street : null;
  const label = [street, city, country].filter((value, index, values) => Boolean(value) && values.indexOf(value) === index).join(', ');
  return { label: label || `${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}`, city, country };
}
