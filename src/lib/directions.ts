import type { RoutePoint } from './cyclingModels';

type DirectionsResponse = { points?: RoutePoint[]; error?: string };

export async function routeCyclingWaypoints(waypoints: RoutePoint[]): Promise<RoutePoint[]> {
  if (waypoints.length < 2) return waypoints;
  const response = await fetch('/api/routes/directions', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ waypoints }),
  });
  const body = await response.json().catch((): DirectionsResponse => ({})) as DirectionsResponse;
  if (!response.ok || !body.points?.length) throw new Error(body.error ?? 'Не удалось проложить путь по дорогам.');
  return body.points;
}
