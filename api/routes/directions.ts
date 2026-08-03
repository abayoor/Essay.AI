import { corsPreflight, withCors } from '../_cors.js';
import { authenticatedUser, assertRoutingRateLimit, RoutingRateLimitError } from '../billing/_shared.js';

type RoutePoint = Readonly<{ lat: number; lng: number }>;
type RoutePreference = 'recommended' | 'shortest';
type RouteManeuverKind = 'left' | 'right' | 'keep-left' | 'keep-right' | 'straight' | 'roundabout' | 'uturn' | 'finish';

type RouteInstruction = {
  pointIndex: number;
  kind: RouteManeuverKind;
  exitNumber?: number;
};

type RouteResult = {
  points: RoutePoint[];
  snappedWaypoints: RoutePoint[];
  instructions: RouteInstruction[];
  distanceKm: number;
  elevationGainM: number;
  durationMinutes: number;
};

type RouteFeature = {
  geometry?: { coordinates?: unknown };
  properties?: {
    summary?: { distance?: unknown; duration?: unknown; ascent?: unknown };
    way_points?: unknown;
    messages?: unknown;
    voicehints?: unknown;
    segments?: unknown;
    name?: unknown;
    'track-length'?: unknown;
    'filtered ascend'?: unknown;
    'total-time'?: unknown;
  };
};

type RoutePayload = { features?: RouteFeature[] };

const MAX_WAYPOINTS = 50;
const MAX_REQUEST_BODY_BYTES = 12_000;
const MAX_REQUESTED_DISTANCE_KM = 600;
const ROUTING_BUDGET_MS = 30_000;
const PROVIDER_ATTEMPT_TIMEOUT_MS = 8_000;
// Building and POI search results are commonly located in the middle of a
// large complex. ORS supports a snap search radius up to 2 km; these attempts
// keep precise street addresses strict while still serving malls, campuses
// and residential blocks whose mapped centre is far from the entrance.
const ORS_SNAP_RADIUS_ATTEMPTS_M = [80, 450, 1_500] as const;
const MAX_ACCEPTED_SNAP_DISTANCE_M = 1_500;
const ROUTE_CACHE_TTL_MS = 60_000;
const MAX_CACHE_ENTRIES = 40;
const routeCache = new Map<string, { expiresAt: number; result: RouteResult }>();

function json(value: object, status = 200, headers?: HeadersInit): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      ...headers,
    },
  });
}

class RequestBodyTooLargeError extends Error {}

async function readJsonBody(request: Request): Promise<unknown> {
  const declaredLength = Number(request.headers.get('content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_REQUEST_BODY_BYTES) {
    throw new RequestBodyTooLargeError();
  }
  if (!request.body) return null;

  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let totalBytes = 0;
  let raw = '';
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > MAX_REQUEST_BODY_BYTES) throw new RequestBodyTooLargeError();
      raw += decoder.decode(value, { stream: true });
    }
    raw += decoder.decode();
  } finally {
    reader.releaseLock();
  }
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

function routeCacheKey(waypoints: readonly RoutePoint[], preference: RoutePreference): string {
  return `${preference}:${waypoints.map((point) => `${point.lat.toFixed(5)},${point.lng.toFixed(5)}`).join('|')}`;
}

function cachedRoute(key: string): RouteResult | null {
  const cached = routeCache.get(key);
  if (!cached) return null;
  if (cached.expiresAt <= Date.now()) {
    routeCache.delete(key);
    return null;
  }
  return cached.result;
}

function cacheRoute(key: string, result: RouteResult): void {
  const now = Date.now();
  routeCache.forEach((stored, storedKey) => {
    if (stored.expiresAt <= now) routeCache.delete(storedKey);
  });
  while (routeCache.size >= MAX_CACHE_ENTRIES) {
    const oldestKey = routeCache.keys().next().value as string | undefined;
    if (!oldestKey) break;
    routeCache.delete(oldestKey);
  }
  routeCache.set(key, { expiresAt: now + ROUTE_CACHE_TTL_MS, result });
}

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

function coordinatesToPoints(coordinates: unknown): RoutePoint[] {
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

function routeDistanceKm(points: readonly RoutePoint[]): number {
  let distanceM = 0;
  for (let index = 1; index < points.length; index += 1) {
    distanceM += distanceBetweenMeters(points[index - 1], points[index]);
  }
  return distanceM / 1000;
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

function snappedWaypointsFromIndices(
  path: readonly RoutePoint[],
  waypoints: readonly RoutePoint[],
  rawIndices: unknown,
): RoutePoint[] {
  if (!Array.isArray(rawIndices)
    || rawIndices.length !== waypoints.length
    || !rawIndices.every((index) => Number.isInteger(index) && index >= 0 && index < path.length)) {
    return inferSnappedWaypoints(path, waypoints);
  }
  return rawIndices.map((index) => path[index]);
}

function snapsAreWithinLimit(original: readonly RoutePoint[], snapped: readonly RoutePoint[], maximumM: number): boolean {
  return original.length === snapped.length
    && original.every((point, index) => distanceBetweenMeters(point, snapped[index]) <= maximumM);
}

function bRouterRouteIsBicycleSafe(feature: RouteFeature): boolean {
  const messages = feature.properties?.messages;
  if (!Array.isArray(messages) || messages.length < 2) return false;
  return !messages.some((row) => {
    if (!Array.isArray(row)) return false;
    const tags = row.filter((value): value is string => typeof value === 'string').join(' ');
    // The bicycle profile is the source of truth for routability. A second
    // hand-written access classifier used to discard valid street geometry
    // whenever a route touched a driveway, crossing or shared footway.
    return /(?:^|\s)(?:highway=steps|route=ferry|bicycle=(?:dismount|no|private))(?:\s|$)/.test(tags);
  });
}

function orsManeuverKind(type: number): RouteManeuverKind | null {
  if (type === 0 || type === 2 || type === 4) return 'left';
  if (type === 1 || type === 3 || type === 5) return 'right';
  if (type === 6 || type === 11) return 'straight';
  if (type === 7 || type === 8) return 'roundabout';
  if (type === 9) return 'uturn';
  if (type === 10) return 'finish';
  if (type === 12) return 'keep-left';
  if (type === 13) return 'keep-right';
  return null;
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

function parseOrsInstructions(rawSegments: unknown, maximumPointIndex: number): RouteInstruction[] {
  if (!Array.isArray(rawSegments)) return [];
  return rawSegments.flatMap((rawSegment): RouteInstruction[] => {
    if (typeof rawSegment !== 'object' || rawSegment === null) return [];
    const rawSteps = (rawSegment as Record<string, unknown>).steps;
    if (!Array.isArray(rawSteps)) return [];
    return rawSteps.flatMap((rawStep): RouteInstruction[] => {
      if (typeof rawStep !== 'object' || rawStep === null) return [];
      const step = rawStep as Record<string, unknown>;
      const kind = typeof step.type === 'number' ? orsManeuverKind(step.type) : null;
      const wayPoints = step.way_points;
      const pointIndex = Array.isArray(wayPoints) && Number.isInteger(wayPoints[0]) ? Number(wayPoints[0]) : -1;
      if (!kind || pointIndex < 0 || pointIndex > maximumPointIndex) return [];
      const exitNumber = typeof step.exit_number === 'number' && Number.isInteger(step.exit_number) && step.exit_number > 0
        ? step.exit_number
        : undefined;
      return [{ pointIndex, kind, ...(exitNumber === undefined ? {} : { exitNumber }) }];
    });
  });
}

function parseBRouterInstructions(rawVoiceHints: unknown, maximumPointIndex: number): RouteInstruction[] {
  if (!Array.isArray(rawVoiceHints)) return [];
  return rawVoiceHints.flatMap((rawHint): RouteInstruction[] => {
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

function hasDistinctConsecutiveWaypoints(waypoints: readonly RoutePoint[]): boolean {
  return waypoints.every((point, index) => index === 0 || distanceBetweenMeters(waypoints[index - 1], point) >= 2);
}

async function fetchWithDeadline(url: string, deadline: number, init?: RequestInit): Promise<Response> {
  const remainingMs = deadline - Date.now();
  if (remainingMs <= 0) throw new Error('Routing deadline exceeded.');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Math.min(PROVIDER_ATTEMPT_TIMEOUT_MS, remainingMs));
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function parsePayload(response: Response): Promise<RoutePayload> {
  const payload = await response.json() as unknown;
  if (typeof payload !== 'object' || payload === null) return {};
  return payload as RoutePayload;
}

function completeMetrics(
  points: RoutePoint[],
  snappedWaypoints: RoutePoint[],
  instructions: RouteInstruction[],
  distanceMeters: unknown,
  ascentMeters: unknown,
  durationSeconds: unknown,
): RouteResult {
  const measuredDistanceKm = routeDistanceKm(points);
  const reportedDistanceKm = numericValue(distanceMeters);
  const reportedDurationSeconds = numericValue(durationSeconds);
  const distanceKm = reportedDistanceKm !== null && reportedDistanceKm > 0
    ? reportedDistanceKm / 1000
    : measuredDistanceKm;

  return {
    points,
    snappedWaypoints,
    instructions,
    distanceKm,
    elevationGainM: numericValue(ascentMeters) ?? 0,
    durationMinutes: reportedDurationSeconds !== null && reportedDurationSeconds > 0
      ? reportedDurationSeconds / 60
      : distanceKm / 18 * 60,
  };
}

async function routeWithBRouter(waypoints: RoutePoint[], preference: RoutePreference, deadline: number): Promise<RouteResult> {
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

  for (const plan of plans) {
    const url = new URL('https://brouter.de/brouter');
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
    }
    if (plan.profile === 'trekking-nosteps') params.set('profile:avoid_unsafe', '1');
    url.search = params.toString();

    try {
      const response = await fetchWithDeadline(url.toString(), deadline, { headers: { accept: 'application/geo+json, application/json' } });
      if (!response.ok) continue;
      const payload = await parsePayload(response);
      const feature = payload.features?.[0];
      const points = coordinatesToPoints(feature?.geometry?.coordinates);
      if (points.length < 2 || !feature || !bRouterRouteIsBicycleSafe(feature)) continue;
      const snappedWaypoints = inferSnappedWaypoints(points, waypoints);
      if (!snapsAreWithinLimit(waypoints, snappedWaypoints, MAX_ACCEPTED_SNAP_DISTANCE_M)) continue;
      const properties = feature.properties;
      return completeMetrics(
        points,
        snappedWaypoints,
        parseBRouterInstructions(properties?.voicehints, points.length - 1),
        properties?.['track-length'],
        properties?.['filtered ascend'],
        properties?.['total-time'],
      );
    } catch {
      if (Date.now() >= deadline) break;
    }
  }
  throw new Error('BRouter did not return a fully cyclable route.');
}

async function routeWithOpenRouteService(
  apiKey: string,
  waypoints: RoutePoint[],
  preference: RoutePreference,
  deadline: number,
): Promise<RouteResult> {
  for (const snappingRadiusM of ORS_SNAP_RADIUS_ATTEMPTS_M) {
    const response = await fetchWithDeadline('https://api.openrouteservice.org/v2/directions/cycling-regular/geojson', deadline, {
      method: 'POST',
      headers: {
        authorization: apiKey,
        accept: 'application/geo+json, application/json',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        coordinates: waypoints.map((point) => [point.lng, point.lat]),
        preference,
        elevation: true,
        instructions: true,
        radiuses: waypoints.map(() => snappingRadiusM),
        extra_info: ['steepness', 'suitability', 'surface', 'waytype'],
        options: {
          avoid_features: ['steps', 'fords', 'ferries'],
          ...(preference === 'recommended' ? {
            profile_params: { weightings: { steepness_difficulty: 1 } },
          } : {}),
        },
      }),
    });
    if (!response.ok) {
      const snapRetryable = response.status === 400 || response.status === 404;
      if (snapRetryable && snappingRadiusM !== ORS_SNAP_RADIUS_ATTEMPTS_M[ORS_SNAP_RADIUS_ATTEMPTS_M.length - 1]) continue;
      throw new Error(`OpenRouteService returned ${response.status}.`);
    }

    const payload = await parsePayload(response);
    const feature = payload.features?.[0];
    const coordinates = feature?.geometry?.coordinates;
    const points = coordinatesToPoints(coordinates);
    if (points.length < 2 || !feature) {
      if (snappingRadiusM !== ORS_SNAP_RADIUS_ATTEMPTS_M[ORS_SNAP_RADIUS_ATTEMPTS_M.length - 1]) continue;
      throw new Error('OpenRouteService returned invalid geometry.');
    }
    const properties = feature.properties;
    const snappedWaypoints = snappedWaypointsFromIndices(points, waypoints, properties?.way_points);
    if (!snapsAreWithinLimit(waypoints, snappedWaypoints, snappingRadiusM + 10)) {
      if (snappingRadiusM !== ORS_SNAP_RADIUS_ATTEMPTS_M[ORS_SNAP_RADIUS_ATTEMPTS_M.length - 1]) continue;
      throw new Error('OpenRouteService snapped a waypoint too far away.');
    }

    let calculatedAscent = 0;
    let previousElevation: number | null = null;
    if (Array.isArray(coordinates)) {
      coordinates.forEach((coordinate) => {
        const elevation = Array.isArray(coordinate) ? numericValue(coordinate[2]) : null;
        if (elevation !== null && previousElevation !== null && elevation > previousElevation) {
          calculatedAscent += elevation - previousElevation;
        }
        previousElevation = elevation;
      });
    }

    const summary = properties?.summary;
    return completeMetrics(
      points,
      snappedWaypoints,
      parseOrsInstructions(properties?.segments, points.length - 1),
      summary?.distance,
      numericValue(summary?.ascent) ?? calculatedAscent,
      summary?.duration,
    );
  }
  throw new Error('OpenRouteService could not snap the selected points safely.');
}

async function handleRequest(request: Request): Promise<Response> {
  if (request.method !== 'POST') {
    return json({ error: 'Этот метод не поддерживается.' }, 405);
  }

  let body: unknown;
  try {
    body = await readJsonBody(request);
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) {
      return json({ error: 'Запрос маршрута слишком большой.' }, 413);
    }
    return json({ error: 'Не удалось прочитать данные маршрута.' }, 400);
  }
  if (typeof body !== 'object' || body === null) {
    return json({ error: 'Не удалось прочитать данные маршрута.' }, 400);
  }

  const requestBody = body as Record<string, unknown>;
  const rawWaypoints = requestBody.waypoints;
  const rawPreference = requestBody.preference;
  if (rawPreference !== undefined && rawPreference !== 'recommended' && rawPreference !== 'shortest') {
    return json({ error: 'Неизвестный режим маршрута.' }, 400);
  }
  const preference: RoutePreference = rawPreference === 'shortest' ? 'shortest' : 'recommended';

  if (!Array.isArray(rawWaypoints)
    || rawWaypoints.length < 2
    || rawWaypoints.length > MAX_WAYPOINTS
    || !rawWaypoints.every(isRoutePoint)) {
    return json({ error: 'Укажите от 2 до 50 корректных точек маршрута.' }, 400);
  }
  if (!hasDistinctConsecutiveWaypoints(rawWaypoints)) {
    return json({ error: 'Соседние точки маршрута слишком близко друг к другу.' }, 400);
  }
  if (routeDistanceKm(rawWaypoints) > MAX_REQUESTED_DISTANCE_KM) {
    return json({ error: 'Один запрос маршрута не может быть длиннее 600 км.' }, 400);
  }

  try {
    const user = await authenticatedUser(request);
    await assertRoutingRateLimit(user);
  } catch (error) {
    if (error instanceof RoutingRateLimitError) {
      return json({ error: error.message }, 429, { 'retry-after': String(error.retryAfterSeconds) });
    }
    const message = error instanceof Error ? error.message : 'Не удалось проверить доступ к маршрутизации.';
    const status = message.includes('авторизац') || message.includes('Сессия') ? 401 : 503;
    return json({ error: message }, status);
  }

  const cacheKey = routeCacheKey(rawWaypoints, preference);
  const cached = cachedRoute(cacheKey);
  if (cached) return json(cached);

  const apiKey = process.env.ORS_API_KEY?.trim();
  const deadline = Date.now() + ROUTING_BUDGET_MS;
  if (apiKey) {
    try {
      const result = await routeWithOpenRouteService(apiKey, rawWaypoints, preference, deadline);
      cacheRoute(cacheKey, result);
      return json(result);
    } catch {
      // A second road-network provider keeps routing available during ORS outages or quota errors.
    }
  }

  try {
    const result = await routeWithBRouter(rawWaypoints, preference, deadline);
    cacheRoute(cacheKey, result);
    return json(result);
  } catch {
    return json({
      error: 'Не удалось проложить велосипедный маршрут по дорогам. Проверьте точки и попробуйте ещё раз.',
    }, 502);
  }
}

async function handler(request: Request): Promise<Response> {
  const preflight = corsPreflight(request, 'POST, OPTIONS');
  if (preflight) return preflight;
  return withCors(request, await handleRequest(request), 'POST, OPTIONS');
}

export default { fetch: handler };
