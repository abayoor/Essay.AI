type RoutePoint = { lat: number; lng: number };
type RoutePreference = 'recommended' | 'shortest';

function json(value: object, status = 200): Response {
  return new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
}

function isRoutePoint(value: unknown): value is RoutePoint {
  return typeof value === 'object' && value !== null
    && typeof (value as Record<string, unknown>).lat === 'number'
    && typeof (value as Record<string, unknown>).lng === 'number';
}

async function routeWithBRouter(waypoints: RoutePoint[], preference: RoutePreference): Promise<Response> {
  const url = new URL('https://brouter.de/brouter');
  url.search = new URLSearchParams({
    lonlats: waypoints.map((point) => `${point.lng},${point.lat}`).join('|'),
    profile: preference === 'shortest' ? 'shortest' : 'trekking',
    alternativeidx: '0',
    format: 'geojson',
  }).toString();
  const response = await fetch(url);
  if (!response.ok) return json({ error: 'Велосипедный маршрутизатор временно недоступен. Попробуй ещё раз позже.' }, 502);
  const payload = await response.json() as {
    features?: {
      geometry?: { coordinates?: unknown };
      properties?: { 'track-length'?: string | number; 'filtered ascend'?: string | number; 'total-time'?: string | number };
    }[];
  };
  const feature = payload.features?.[0];
  const coordinates = feature?.geometry?.coordinates;
  if (!Array.isArray(coordinates)) return json({ error: 'Маршрутизатор вернул путь без геометрии.' }, 502);
  const points = coordinates.flatMap((coordinate): RoutePoint[] => {
    if (!Array.isArray(coordinate) || typeof coordinate[0] !== 'number' || typeof coordinate[1] !== 'number') return [];
    return [{ lat: coordinate[1], lng: coordinate[0] }];
  });
  const properties = feature?.properties;
  const distanceKm = Number(properties?.['track-length'] ?? 0) / 1000;
  const reportedDurationMinutes = Number(properties?.['total-time'] ?? 0) / 60;
  return json({
    points,
    distanceKm,
    elevationGainM: Number(properties?.['filtered ascend'] ?? 0),
    durationMinutes: preference === 'shortest' ? distanceKm / 18 * 60 : reportedDurationMinutes,
  });
}

async function handler(request: Request): Promise<Response> {
  if (request.method !== 'POST') return json({ error: 'Метод не поддерживается.' }, 405);
  const apiKey = process.env.ORS_API_KEY;
  const body = await request.json().catch((): unknown => null);
  const rawWaypoints = typeof body === 'object' && body !== null ? (body as Record<string, unknown>).waypoints : null;
  const rawPreference = typeof body === 'object' && body !== null ? (body as Record<string, unknown>).preference : null;
  const preference: RoutePreference = rawPreference === 'shortest' ? 'shortest' : 'recommended';
  if (!Array.isArray(rawWaypoints) || rawWaypoints.length < 2 || rawWaypoints.length > 50 || !rawWaypoints.every(isRoutePoint)) {
    return json({ error: 'Нужно передать от 2 до 50 корректных точек.' }, 400);
  }
  if (!apiKey) return routeWithBRouter(rawWaypoints, preference);
  const response = await fetch('https://api.openrouteservice.org/v2/directions/cycling-regular/geojson', {
    method: 'POST',
    headers: { authorization: apiKey, 'content-type': 'application/json' },
    body: JSON.stringify({
      coordinates: rawWaypoints.map((point) => [point.lng, point.lat]),
      elevation: true,
      instructions: false,
      preference,
      extra_info: ['steepness', 'suitability', 'surface', 'waytype'],
    }),
  });
  if (!response.ok) return routeWithBRouter(rawWaypoints, preference);
  const payload = await response.json() as {
    features?: {
      geometry?: { coordinates?: unknown };
      properties?: { summary?: { distance?: number; duration?: number; ascent?: number } };
    }[];
  };
  const feature = payload.features?.[0];
  const coordinates = feature?.geometry?.coordinates;
  if (!Array.isArray(coordinates)) return json({ error: 'OpenRouteService вернул маршрут без геометрии.' }, 502);
  let calculatedAscent = 0;
  let previousElevation: number | null = null;
  const points = coordinates.flatMap((coordinate): RoutePoint[] => {
    if (!Array.isArray(coordinate) || typeof coordinate[0] !== 'number' || typeof coordinate[1] !== 'number') return [];
    const elevation = typeof coordinate[2] === 'number' ? coordinate[2] : null;
    if (elevation !== null && previousElevation !== null && elevation > previousElevation) calculatedAscent += elevation - previousElevation;
    previousElevation = elevation;
    return [{ lat: coordinate[1], lng: coordinate[0] }];
  });
  const summary = feature?.properties?.summary;
  return json({
    points,
    distanceKm: typeof summary?.distance === 'number' ? summary.distance / 1000 : 0,
    elevationGainM: typeof summary?.ascent === 'number' ? summary.ascent : calculatedAscent,
    durationMinutes: typeof summary?.duration === 'number' ? summary.duration / 60 : 0,
  });
}

export default { fetch: handler };
