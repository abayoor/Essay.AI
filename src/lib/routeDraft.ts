import type { RoutePoint } from './cyclingModels';

const routeDraftKey = 'slipstream-map-route-draft';

export type MapRouteDraft = {
  title: string;
  region: string;
  waypoints: RoutePoint[];
  points: RoutePoint[];
  elevationGainM: number;
};

function isPoint(value: unknown): value is RoutePoint {
  return typeof value === 'object'
    && value !== null
    && typeof (value as Record<string, unknown>).lat === 'number'
    && typeof (value as Record<string, unknown>).lng === 'number';
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
    return {
      title: typeof item.title === 'string' ? item.title : '',
      region: typeof item.region === 'string' ? item.region : '',
      waypoints: item.waypoints,
      points: item.points,
      elevationGainM: typeof item.elevationGainM === 'number' ? item.elevationGainM : 0,
    };
  } catch {
    return null;
  }
}
