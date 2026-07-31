import type { RoutePoint } from './cyclingModels';

export type CyclingRouteResult = {
  points: RoutePoint[];
  distanceKm: number;
  elevationGainM: number;
  durationMinutes: number;
};

export type CyclingRoutePreference = 'recommended' | 'shortest';

type DirectionsResponse = Partial<CyclingRouteResult> & { error?: string };

type BRouterPayload = {
  features?: {
    geometry?: { coordinates?: unknown };
    properties?: {
      'track-length'?: string | number;
      'filtered ascend'?: string | number;
      'total-time'?: string | number;
    };
  }[];
};

function bRouterPoints(coordinates: unknown): RoutePoint[] {
  if (!Array.isArray(coordinates)) return [];
  return coordinates.flatMap((coordinate): RoutePoint[] => {
    if (!Array.isArray(coordinate) || typeof coordinate[0] !== 'number' || typeof coordinate[1] !== 'number') return [];
    return [{ lat: coordinate[1], lng: coordinate[0] }];
  });
}

async function routeWithPublicBRouter(waypoints: RoutePoint[], preference: CyclingRoutePreference): Promise<CyclingRouteResult> {
  const params = new URLSearchParams({
    lonlats: waypoints.map((point) => `${point.lng},${point.lat}`).join('|'),
    profile: preference === 'shortest' ? 'shortest' : 'trekking',
    alternativeidx: '0',
    format: 'geojson',
  });
  const response = await fetch(`https://brouter.de/brouter?${params.toString()}`);
  if (!response.ok) throw new Error('Велосипедный маршрутизатор временно недоступен.');
  const payload = await response.json() as BRouterPayload;
  const feature = payload.features?.[0];
  const points = bRouterPoints(feature?.geometry?.coordinates);
  if (points.length < 2) throw new Error('Маршрутизатор не нашёл проезжаемый путь между выбранными местами.');
  const distanceKm = Number(feature?.properties?.['track-length'] ?? 0) / 1000;
  const reportedDurationMinutes = Number(feature?.properties?.['total-time'] ?? 0) / 60;
  return {
    points,
    distanceKm,
    elevationGainM: Number(feature?.properties?.['filtered ascend'] ?? 0),
    durationMinutes: preference === 'shortest' ? distanceKm / 18 * 60 : reportedDurationMinutes,
  };
}

export async function routeCyclingWaypoints(waypoints: RoutePoint[], preference: CyclingRoutePreference = 'recommended'): Promise<CyclingRouteResult> {
  if (waypoints.length < 2) {
    return { points: waypoints, distanceKm: 0, elevationGainM: 0, durationMinutes: 0 };
  }
  try {
    const response = await fetch('/api/routes/directions', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ waypoints, preference }),
    });
    const body = await response.json().catch((): DirectionsResponse => ({})) as DirectionsResponse;
    if (!response.ok || !body.points?.length) throw new Error(body.error ?? 'Серверный маршрутизатор не ответил.');
    return {
      points: body.points,
      distanceKm: body.distanceKm ?? 0,
      elevationGainM: body.elevationGainM ?? 0,
      durationMinutes: body.durationMinutes ?? 0,
    };
  } catch {
    return routeWithPublicBRouter(waypoints, preference);
  }
}
