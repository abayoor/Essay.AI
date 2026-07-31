import type { CycleRoute, RoutePoint } from './cyclingModels';
import type { CyclingRoutePreference, CyclingRouteResult } from './directions';

const navigationStorageKey = 'slipstream-active-map-route';
export const navigationUpdatedEvent = 'slipstream-navigation-updated';

export type PersistedMapNavigation = {
  id: string;
  destinationName: string;
  destinationSubtitle: string;
  destination: RoutePoint;
  result: CyclingRouteResult;
  preference: CyclingRoutePreference;
  active: boolean;
  source: 'search' | 'popular';
  savedAt: string;
};

function isPoint(value: unknown): value is RoutePoint {
  return typeof value === 'object'
    && value !== null
    && typeof (value as Record<string, unknown>).lat === 'number'
    && typeof (value as Record<string, unknown>).lng === 'number';
}

function notifyNavigationChanged(): void {
  window.dispatchEvent(new Event(navigationUpdatedEvent));
}

export function loadMapNavigation(): PersistedMapNavigation | null {
  const raw = window.localStorage.getItem(navigationStorageKey);
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (typeof value !== 'object' || value === null) return null;
    const item = value as Record<string, unknown>;
    const result = item.result as Record<string, unknown> | undefined;
    if (!isPoint(item.destination)
      || !result
      || !Array.isArray(result.points)
      || !result.points.every(isPoint)
      || typeof result.distanceKm !== 'number'
      || typeof result.elevationGainM !== 'number'
      || typeof result.durationMinutes !== 'number') return null;
    return {
      id: typeof item.id === 'string' ? item.id : crypto.randomUUID(),
      destinationName: typeof item.destinationName === 'string' ? item.destinationName : 'Маршрут',
      destinationSubtitle: typeof item.destinationSubtitle === 'string' ? item.destinationSubtitle : '',
      destination: item.destination,
      result: {
        points: result.points,
        distanceKm: result.distanceKm,
        elevationGainM: result.elevationGainM,
        durationMinutes: result.durationMinutes,
      },
      preference: item.preference === 'shortest' ? 'shortest' : 'recommended',
      active: item.active === true,
      source: item.source === 'popular' ? 'popular' : 'search',
      savedAt: typeof item.savedAt === 'string' ? item.savedAt : new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

export function saveMapNavigation(navigation: PersistedMapNavigation): void {
  window.localStorage.setItem(navigationStorageKey, JSON.stringify(navigation));
  notifyNavigationChanged();
}

export function clearMapNavigation(): void {
  window.localStorage.removeItem(navigationStorageKey);
  notifyNavigationChanged();
}

export function navigationFromCycleRoute(route: CycleRoute): PersistedMapNavigation | null {
  if (route.path.length < 2) return null;
  const destination = route.path[route.path.length - 1];
  return {
    id: route.id,
    destinationName: route.title,
    destinationSubtitle: route.region ?? 'Популярный веломаршрут',
    destination,
    result: {
      points: route.path,
      distanceKm: Number(route.distance_km),
      elevationGainM: Number(route.elevation_gain_m),
      durationMinutes: route.duration_minutes ?? Math.max(1, Number(route.distance_km) / 18 * 60),
    },
    preference: 'recommended',
    active: true,
    source: 'popular',
    savedAt: new Date().toISOString(),
  };
}

export function startCycleRouteNavigation(route: CycleRoute): boolean {
  const navigation = navigationFromCycleRoute(route);
  if (!navigation) return false;
  saveMapNavigation(navigation);
  return true;
}
