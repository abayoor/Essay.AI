import type { RoutePoint } from './cyclingModels';
import { apiUrl } from './api';
import { supabase } from './supabase';

export type RouteManeuverKind = 'left' | 'right' | 'keep-left' | 'keep-right' | 'straight' | 'roundabout' | 'uturn' | 'finish';

export type CyclingRouteInstruction = {
  pointIndex: number;
  kind: RouteManeuverKind;
  exitNumber?: number;
};

export type CyclingRouteResult = {
  points: RoutePoint[];
  snappedWaypoints: RoutePoint[];
  instructions: CyclingRouteInstruction[];
  distanceKm: number;
  elevationGainM: number;
  durationMinutes: number;
};

export type CyclingRoutePreference = 'recommended' | 'shortest';

type BRouterPayload = {
  features?: {
    geometry?: { coordinates?: unknown };
    properties?: {
      'track-length'?: unknown;
      'filtered ascend'?: unknown;
      'total-time'?: unknown;
      messages?: unknown;
      voicehints?: unknown;
    };
  }[];
};

const MAX_WAYPOINTS = 50;
// The server has a 22-second total provider budget. This higher client deadline
// lets it finish cleanly before the browser starts the public fallback.
const REQUEST_TIMEOUT_MS = 36_000;
// Search results for large residential and shopping complexes often point to
// the centre of the building instead of its street entrance. The router may
// legitimately snap such a point farther away; the UI keeps the destination
// marker at the requested place and explains the remaining walking gap.
const MAX_ACCEPTED_SNAP_DISTANCE_M = 1_500;
const ROUTE_CACHE_MS = 30_000;
const pendingRequests = new Map<string, Promise<CyclingRouteResult>>();
const resultCache = new Map<string, { expiresAt: number; result: CyclingRouteResult }>();

function isFiniteCoordinate(value: unknown, minimum: number, maximum: number): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= minimum && value <= maximum;
}

function isRoutePoint(value: unknown): value is RoutePoint {
  if (typeof value !== 'object' || value === null) return false;
  const point = value as Record<string, unknown>;
  return isFiniteCoordinate(point.lat, -90, 90) && isFiniteCoordinate(point.lng, -180, 180);
}

function numericValue(value: unknown): number | null {
  const parsed = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : Number.NaN;
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function pointsFromCoordinates(coordinates: unknown): RoutePoint[] {
  if (!Array.isArray(coordinates)) return [];
  if (!coordinates.every((coordinate) => Array.isArray(coordinate)
    && isFiniteCoordinate(coordinate[0], -180, 180)
    && isFiniteCoordinate(coordinate[1], -90, 90))) return [];
  return coordinates.map((coordinate) => ({ lat: coordinate[1], lng: coordinate[0] }));
}

function distanceBetweenMeters(first: RoutePoint, second: RoutePoint): number {
  const earthRadiusM = 6_371_000;
  const firstLatitude = first.lat * Math.PI / 180;
  const secondLatitude = second.lat * Math.PI / 180;
  const latitudeDelta = (second.lat - first.lat) * Math.PI / 180;
  const longitudeDelta = (second.lng - first.lng) * Math.PI / 180;
  const haversine = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(firstLatitude) * Math.cos(secondLatitude) * Math.sin(longitudeDelta / 2) ** 2;
  const normalized = Math.min(1, Math.max(0, haversine));
  return earthRadiusM * 2 * Math.atan2(Math.sqrt(normalized), Math.sqrt(1 - normalized));
}

function measuredDistanceKm(points: readonly RoutePoint[]): number {
  let totalMeters = 0;
  for (let index = 1; index < points.length; index += 1) {
    totalMeters += distanceBetweenMeters(points[index - 1], points[index]);
  }
  return totalMeters / 1000;
}

function inferSnappedWaypoints(path: readonly RoutePoint[], waypoints: readonly RoutePoint[]): RoutePoint[] {
  if (path.length === 0 || waypoints.length === 0) return [];
  if (waypoints.length === 1) return [path[0]];
  const snapped: RoutePoint[] = [path[0]];
  let minimumIndex = 0;
  for (let waypointIndex = 1; waypointIndex < waypoints.length - 1; waypointIndex += 1) {
    let closestIndex = minimumIndex;
    let closestDistanceM = Number.POSITIVE_INFINITY;
    for (let pathIndex = minimumIndex; pathIndex < path.length; pathIndex += 1) {
      const distanceM = distanceBetweenMeters(waypoints[waypointIndex], path[pathIndex]);
      if (distanceM < closestDistanceM) {
        closestDistanceM = distanceM;
        closestIndex = pathIndex;
      }
    }
    snapped.push(path[closestIndex]);
    minimumIndex = closestIndex;
  }
  snapped.push(path[path.length - 1]);
  return snapped;
}

function snapsAreWithinLimit(original: readonly RoutePoint[], snapped: readonly RoutePoint[]): boolean {
  return original.length === snapped.length
    && original.every((point, index) => distanceBetweenMeters(point, snapped[index]) <= MAX_ACCEPTED_SNAP_DISTANCE_M);
}

function bRouterRouteIsBicycleSafe(messages: unknown): boolean {
  if (!Array.isArray(messages) || messages.length < 2) return false;
  return !messages.some((row) => {
    if (!Array.isArray(row)) return false;
    const tags = row.filter((value): value is string => typeof value === 'string').join(' ');
    // BRouter has already applied the selected bicycle profile and access
    // rules. Re-interpreting every OSM tag here used to reject valid routes
    // that begin on a short driveway, crossing or shared footway. Keep only
    // explicit hard bans that should never be drawn as a cycling route.
    return /(?:^|\s)(?:highway=steps|route=ferry|bicycle=(?:dismount|no|private))(?:\s|$)/.test(tags);
  });
}

function bRouterManeuverKind(command: number): RouteManeuverKind | null {
  if (command === 1) return 'straight';
  if (command === 2 || command === 3 || command === 4 || command === 17) return 'left';
  if (command === 5 || command === 6 || command === 7 || command === 18) return 'right';
  if (command === 8) return 'keep-left';
  if (command === 9) return 'keep-right';
  if (command === 10 || command === 11 || command === 15) return 'uturn';
  if (command === 13 || command === 14 || command >= 1008) return 'roundabout';
  if (command === 100) return 'finish';
  return null;
}

function parseBRouterInstructions(rawVoiceHints: unknown, maximumPointIndex: number): CyclingRouteInstruction[] {
  if (!Array.isArray(rawVoiceHints)) return [];
  return rawVoiceHints.flatMap((rawHint): CyclingRouteInstruction[] => {
    if (!Array.isArray(rawHint)) return [];
    const pointIndex = typeof rawHint[0] === 'number' && Number.isInteger(rawHint[0]) ? rawHint[0] : -1;
    const command = typeof rawHint[1] === 'number' && Number.isInteger(rawHint[1]) ? rawHint[1] : -1;
    const kind = bRouterManeuverKind(command);
    if (!kind || pointIndex < 0 || pointIndex > maximumPointIndex) return [];
    const rawExit = typeof rawHint[2] === 'number' && Number.isInteger(rawHint[2]) ? Math.abs(rawHint[2]) : 0;
    const encodedExit = command >= 1008 ? command - 1008 : 0;
    const exitNumber = rawExit || encodedExit;
    return [{ pointIndex, kind, ...(exitNumber > 0 ? { exitNumber } : {}) }];
  });
}

function isManeuverKind(value: unknown): value is RouteManeuverKind {
  return value === 'left' || value === 'right' || value === 'keep-left' || value === 'keep-right'
    || value === 'straight' || value === 'roundabout' || value === 'uturn' || value === 'finish';
}

function parseInstructions(value: unknown, maximumPointIndex: number): CyclingRouteInstruction[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((rawInstruction): CyclingRouteInstruction[] => {
    if (typeof rawInstruction !== 'object' || rawInstruction === null) return [];
    const instruction = rawInstruction as Record<string, unknown>;
    if (!Number.isInteger(instruction.pointIndex)
      || typeof instruction.pointIndex !== 'number'
      || instruction.pointIndex < 0
      || instruction.pointIndex > maximumPointIndex
      || !isManeuverKind(instruction.kind)) return [];
    const exitNumber = typeof instruction.exitNumber === 'number'
      && Number.isInteger(instruction.exitNumber)
      && instruction.exitNumber > 0
      ? instruction.exitNumber
      : undefined;
    return [{
      pointIndex: instruction.pointIndex,
      kind: instruction.kind,
      ...(exitNumber === undefined ? {} : { exitNumber }),
    }];
  });
}

function validateWaypoints(waypoints: readonly RoutePoint[]): void {
  if (waypoints.length > MAX_WAYPOINTS) throw new Error('Маршрут может содержать не больше 50 точек.');
  if (!waypoints.every(isRoutePoint)) throw new Error('Одна из точек маршрута содержит неверные координаты.');
  for (let index = 1; index < waypoints.length; index += 1) {
    if (distanceBetweenMeters(waypoints[index - 1], waypoints[index]) < 2) {
      throw new Error('Соседние точки маршрута слишком близко друг к другу.');
    }
  }
}

function resultFromUnknown(payload: unknown, waypoints: readonly RoutePoint[]): CyclingRouteResult | null {
  if (typeof payload !== 'object' || payload === null) return null;
  const response = payload as Record<string, unknown>;
  if (!Array.isArray(response.points) || !response.points.every(isRoutePoint) || response.points.length < 2) return null;

  const points = response.points;
  const snappedWaypoints = Array.isArray(response.snappedWaypoints)
    && response.snappedWaypoints.every(isRoutePoint)
    && response.snappedWaypoints.length === waypoints.length
    ? response.snappedWaypoints
    : inferSnappedWaypoints(points, waypoints);
  if (!snapsAreWithinLimit(waypoints, snappedWaypoints)) return null;
  const fallbackDistanceKm = measuredDistanceKm(points);
  const distanceKm = numericValue(response.distanceKm) ?? fallbackDistanceKm;
  const durationMinutes = numericValue(response.durationMinutes) ?? distanceKm / 18 * 60;
  return {
    points,
    snappedWaypoints,
    instructions: parseInstructions(response.instructions, points.length - 1),
    distanceKm: distanceKm > 0 ? distanceKm : fallbackDistanceKm,
    elevationGainM: numericValue(response.elevationGainM) ?? 0,
    durationMinutes: durationMinutes > 0 ? durationMinutes : fallbackDistanceKm / 18 * 60,
  };
}

function errorMessageFromUnknown(payload: unknown): string | null {
  if (typeof payload !== 'object' || payload === null) return null;
  const error = (payload as Record<string, unknown>).error;
  return typeof error === 'string' && error.trim() ? error.trim() : null;
}

async function fetchWithTimeout(url: string, init?: RequestInit, timeoutMs = REQUEST_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    window.clearTimeout(timeout);
  }
}

async function routeWithPublicBRouter(
  waypoints: readonly RoutePoint[],
  preference: CyclingRoutePreference,
): Promise<CyclingRouteResult> {
  const plans = preference === 'recommended'
    ? [
      { profile: 'trekking-nosteps', alternativeIndex: 0 },
      { profile: 'fastbike', alternativeIndex: 0 },
      { profile: 'fastbike', alternativeIndex: 1 },
    ]
    : [
      { profile: 'fastbike', alternativeIndex: 0 },
      { profile: 'fastbike', alternativeIndex: 1 },
    ];
  const deadline = Date.now() + 27_000;

  for (const plan of plans) {
    const remainingMs = deadline - Date.now();
    if (remainingMs <= 0) break;
    const params = new URLSearchParams({
      lonlats: waypoints.map((point) => `${point.lng},${point.lat}`).join('|'),
      profile: plan.profile,
      alternativeidx: String(plan.alternativeIndex),
      format: 'geojson',
      timode: '1',
      'profile:allow_steps': '0',
      'profile:allow_ferries': '0',
    });
    if (plan.profile === 'fastbike') {
      params.set('profile:allow_motorways', '0');
      params.set('profile:consider_traffic', preference === 'recommended' ? '1' : '0.3');
    } else {
      params.set('profile:avoid_unsafe', '1');
    }

    try {
      const response = await fetchWithTimeout(`https://brouter.de/brouter?${params.toString()}`, {
        headers: { accept: 'application/geo+json, application/json' },
      }, Math.min(10_000, remainingMs));
      if (!response.ok) continue;
      const payload = await response.json() as BRouterPayload;
      const feature = payload.features?.[0];
      const points = pointsFromCoordinates(feature?.geometry?.coordinates);
      if (points.length < 2 || !bRouterRouteIsBicycleSafe(feature?.properties?.messages)) continue;
      const snappedWaypoints = inferSnappedWaypoints(points, waypoints);
      if (!snapsAreWithinLimit(waypoints, snappedWaypoints)) continue;

      const properties = feature?.properties;
      const fallbackDistanceKm = measuredDistanceKm(points);
      const trackLengthM = numericValue(properties?.['track-length']);
      const distanceKm = trackLengthM !== null && trackLengthM > 0 ? trackLengthM / 1000 : fallbackDistanceKm;
      const totalTimeSeconds = numericValue(properties?.['total-time']);
      return {
        points,
        snappedWaypoints,
        instructions: parseBRouterInstructions(properties?.voicehints, points.length - 1),
        distanceKm,
        elevationGainM: numericValue(properties?.['filtered ascend']) ?? 0,
        durationMinutes: totalTimeSeconds !== null && totalTimeSeconds > 0
          ? totalTimeSeconds / 60
          : distanceKm / 18 * 60,
      };
    } catch {
      // Try the next bicycle-safe profile/alternative within the shared deadline.
    }
  }
  throw new Error('Не найден полностью проезжаемый велосипедный путь между выбранными точками.');
}

function routeRequestKey(waypoints: readonly RoutePoint[], preference: CyclingRoutePreference): string {
  return `${preference}:${waypoints.map((point) => `${point.lat.toFixed(5)},${point.lng.toFixed(5)}`).join('|')}`;
}

async function requestCyclingRoute(
  waypoints: RoutePoint[],
  preference: CyclingRoutePreference,
): Promise<CyclingRouteResult> {
  let apiErrorMessage: string | null = null;
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  if (accessToken) {
    try {
      const response = await fetchWithTimeout(apiUrl('/api/routes/directions'), {
        method: 'POST',
        headers: {
          authorization: `Bearer ${accessToken}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ waypoints, preference }),
      });
      const payload = await response.json().catch((): unknown => null);
      const result = resultFromUnknown(payload, waypoints);
      if (response.ok && result) return result;
      apiErrorMessage = errorMessageFromUnknown(payload)
        ?? 'Сервер маршрутизации вернул некорректный ответ.';
    } catch (error) {
      apiErrorMessage = error instanceof DOMException && error.name === 'AbortError'
        ? 'Построение маршрута заняло слишком много времени.'
        : 'Сервер маршрутизации сейчас недоступен.';
    }
  } else {
    apiErrorMessage = 'Войди в аккаунт, чтобы использовать улучшенный маршрутизатор.';
  }

  try {
    return await routeWithPublicBRouter(waypoints, preference);
  } catch {
    throw new Error(apiErrorMessage
      ?? 'Не удалось проложить маршрут по дорогам. Проверьте выбранные точки и попробуйте снова.');
  }
}

export async function routeCyclingWaypoints(
  waypoints: RoutePoint[],
  preference: CyclingRoutePreference = 'recommended',
): Promise<CyclingRouteResult> {
  if (waypoints.length < 2) {
    if (!waypoints.every(isRoutePoint)) throw new Error('Точка маршрута содержит неверные координаты.');
    return {
      points: waypoints,
      snappedWaypoints: waypoints,
      instructions: [],
      distanceKm: 0,
      elevationGainM: 0,
      durationMinutes: 0,
    };
  }
  validateWaypoints(waypoints);

  const key = routeRequestKey(waypoints, preference);
  const cached = resultCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.result;
  if (cached) resultCache.delete(key);
  const pending = pendingRequests.get(key);
  if (pending) return pending;

  const request = requestCyclingRoute(waypoints, preference);
  pendingRequests.set(key, request);
  try {
    const result = await request;
    resultCache.set(key, { result, expiresAt: Date.now() + ROUTE_CACHE_MS });
    return result;
  } finally {
    if (pendingRequests.get(key) === request) pendingRequests.delete(key);
  }
}
