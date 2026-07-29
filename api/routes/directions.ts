type RoutePoint = { lat: number; lng: number };

function json(value: object, status = 200): Response {
  return new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
}

function isRoutePoint(value: unknown): value is RoutePoint {
  return typeof value === 'object' && value !== null
    && typeof (value as Record<string, unknown>).lat === 'number'
    && typeof (value as Record<string, unknown>).lng === 'number';
}

async function handler(request: Request): Promise<Response> {
  if (request.method !== 'POST') return json({ error: 'Метод не поддерживается.' }, 405);
  const apiKey = process.env.ORS_API_KEY;
  if (!apiKey) return json({ error: 'Маршрутизация пока не настроена: отсутствует ORS_API_KEY.' }, 503);
  const body = await request.json().catch((): unknown => null);
  const rawWaypoints = typeof body === 'object' && body !== null ? (body as Record<string, unknown>).waypoints : null;
  if (!Array.isArray(rawWaypoints) || rawWaypoints.length < 2 || rawWaypoints.length > 50 || !rawWaypoints.every(isRoutePoint)) {
    return json({ error: 'Нужно передать от 2 до 50 корректных точек.' }, 400);
  }
  const response = await fetch('https://api.openrouteservice.org/v2/directions/cycling-regular/geojson', {
    method: 'POST',
    headers: { authorization: apiKey, 'content-type': 'application/json' },
    body: JSON.stringify({ coordinates: rawWaypoints.map((point) => [point.lng, point.lat]) }),
  });
  if (!response.ok) return json({ error: 'OpenRouteService не смог построить маршрут. Проверь ключ и попробуй позже.' }, response.status === 429 ? 429 : 502);
  const payload = await response.json() as { features?: { geometry?: { coordinates?: unknown } }[] };
  const coordinates = payload.features?.[0]?.geometry?.coordinates;
  if (!Array.isArray(coordinates)) return json({ error: 'OpenRouteService вернул маршрут без геометрии.' }, 502);
  const points = coordinates.flatMap((coordinate): RoutePoint[] => {
    if (!Array.isArray(coordinate) || typeof coordinate[0] !== 'number' || typeof coordinate[1] !== 'number') return [];
    return [{ lat: coordinate[1], lng: coordinate[0] }];
  });
  return json({ points });
}

export default { fetch: handler };
