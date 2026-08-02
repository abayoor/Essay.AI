import type { RoutePoint } from './cyclingModels';

const routeDraftKey = 'slipstream-map-route-draft';

export type MapRouteDraft = {
  title: string;
  region: string;
  waypoints: RoutePoint[];
  snappedWaypoints: RoutePoint[];
  points: RoutePoint[];
  elevationGainM: number;
};

function isPoint(value: unknown): value is RoutePoint {
  return typeof value === 'object'
    && value !== null
    && typeof (value as Record<string, unknown>).lat === 'number'
    && typeof (value as Record<string, unknown>).lng === 'number';
}

function inferSnappedWaypoints(points: readonly RoutePoint[], waypoints: readonly RoutePoint[]): RoutePoint[] {
  if (points.length === 0) return waypoints.slice();
  let minimumIndex = 0;
  return waypoints.map((waypoint, waypointIndex) => {
    if (waypointIndex === 0) return points[0];
    if (waypointIndex === waypoints.length - 1) return points[points.length - 1];
    let closestIndex = minimumIndex;
    let closestDistance = Number.POSITIVE_INFINITY;
    for (let pointIndex = minimumIndex; pointIndex < points.length; pointIndex += 1) {
      const point = points[pointIndex];
      const distance = (point.lat - waypoint.lat) ** 2 + (point.lng - waypoint.lng) ** 2;
      if (distance < closestDistance) {
        closestDistance = distance;
        closestIndex = pointIndex;
      }
    }
    minimumIndex = closestIndex;
    return points[closestIndex];
  });
}

export function saveMapRouteDraft(draft: MapRouteDraft): void {
  window.sessionStorage.setItem(routeDraftKey, JSON.stringify(draft));
}

export function takeMapRouteDraft(): MapRouteDraft | null {
  const raw = window.sessionStorage.getItem(routeDraftKey);
  if (!raw) return null;
  window.sessionStorage.removeItem(routeDraftKey);
  try {
    const value: unknown = JSON.parse(raw);
    if (typeof value !== 'object' || value === null) return null;
    const item = value as Record<string, unknown>;
    if (!Array.isArray(item.waypoints) || !item.waypoints.every(isPoint) || !Array.isArray(item.points) || !item.points.every(isPoint)) return null;
    const snappedWaypoints = Array.isArray(item.snappedWaypoints)
      && item.snappedWaypoints.length === item.waypoints.length
      && item.snappedWaypoints.every(isPoint)
      ? item.snappedWaypoints
      : inferSnappedWaypoints(item.points, item.waypoints);
    return {
      title: typeof item.title === 'string' ? item.title : '',
      region: typeof item.region === 'string' ? item.region : '',
      waypoints: item.waypoints,
      snappedWaypoints,
      points: item.points,
      elevationGainM: typeof item.elevationGainM === 'number' ? item.elevationGainM : 0,
    };
  } catch {
    return null;
  }
}
