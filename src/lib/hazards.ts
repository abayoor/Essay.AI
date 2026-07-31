import { supabase } from './supabase';

export const HAZARD_TYPES = [
  'pothole',
  'no_lighting',
  'glass',
  'aggressive_dogs',
  'road_closed',
] as const;

export type HazardType = (typeof HAZARD_TYPES)[number];
export type HazardStatus = 'active' | 'resolved';
export type HazardPoint = { lat: number; lng: number };

export type HazardReport = {
  id: string;
  reporterId: string;
  location: HazardPoint;
  hazardType: HazardType;
  description: string | null;
  photoUrl: string | null;
  status: HazardStatus;
  confirmations: number;
  confirmedByMe: boolean;
  createdAt: string;
  lastConfirmedAt: string;
  expiresAt: string;
};

export type LoadHazardsOptions = {
  center?: HazardPoint;
  radiusKm?: number;
  limit?: number;
};

export type HazardLoadResult = {
  hazards: HazardReport[];
  source: 'network' | 'cache';
  cachedAt: string | null;
};

export type ReportHazardInput = {
  location: HazardPoint;
  hazardType: HazardType;
  description?: string;
};

export type ReportHazardResult = {
  hazardId: string;
  merged: boolean;
};

type CachedHazards = {
  savedAt: string;
  hazards: HazardReport[];
};

const CACHE_PREFIX = 'slipstream:safety-radar:v1';
const CACHE_MAX_AGE_MS = 12 * 60 * 60 * 1000;
const DEFAULT_RADIUS_KM = 25;
const DEFAULT_LIMIT = 120;
const MAX_LIMIT = 250;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isHazardType(value: unknown): value is HazardType {
  return typeof value === 'string' && HAZARD_TYPES.some((item) => item === value);
}

function isIsoDate(value: unknown): value is string {
  return typeof value === 'string' && Number.isFinite(Date.parse(value));
}

function parsePoint(value: unknown): HazardPoint | null {
  if (!isRecord(value)) return null;
  const lat = value.lat;
  const lng = value.lng;
  if (typeof lat !== 'number' || typeof lng !== 'number' || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng };
}

function parseHazardRow(value: unknown, confirmedIds: ReadonlySet<string>): HazardReport | null {
  if (!isRecord(value)) return null;
  const id = value.id;
  const reporterId = value.reporter_id;
  const location = parsePoint(value.location);
  const hazardType = value.hazard_type;
  const status = value.status;
  const confirmations = value.upvotes;
  const createdAt = value.created_at;
  const lastConfirmedAt = value.last_confirmed_at;
  const expiresAt = value.expires_at;

  if (typeof id !== 'string' || typeof reporterId !== 'string' || !location || !isHazardType(hazardType)) return null;
  if (status !== 'active' && status !== 'resolved') return null;
  if (typeof confirmations !== 'number' || !Number.isInteger(confirmations) || confirmations < 0) return null;
  if (!isIsoDate(createdAt) || !isIsoDate(lastConfirmedAt) || !isIsoDate(expiresAt)) return null;

  return {
    id,
    reporterId,
    location,
    hazardType,
    description: typeof value.description === 'string' ? value.description : null,
    photoUrl: typeof value.photo_url === 'string' ? value.photo_url : null,
    status,
    confirmations,
    confirmedByMe: confirmedIds.has(id),
    createdAt,
    lastConfirmedAt,
    expiresAt,
  };
}

function parseCachedHazard(value: unknown): HazardReport | null {
  if (!isRecord(value)) return null;
  const databaseShape = {
    id: value.id,
    reporter_id: value.reporterId,
    location: value.location,
    hazard_type: value.hazardType,
    description: value.description,
    photo_url: value.photoUrl,
    status: value.status,
    upvotes: value.confirmations,
    created_at: value.createdAt,
    last_confirmed_at: value.lastConfirmedAt,
    expires_at: value.expiresAt,
  };
  const id = typeof value.id === 'string' ? value.id : '';
  const parsed = parseHazardRow(databaseShape, value.confirmedByMe === true ? new Set([id]) : new Set());
  return parsed;
}

function clamp(value: number | undefined, fallback: number, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

function cacheKey(userId: string): string {
  return `${CACHE_PREFIX}:${userId}`;
}

function readCache(userId: string | null): CachedHazards | null {
  if (!userId) return null;
  try {
    const raw = window.localStorage.getItem(cacheKey(userId));
    if (!raw) return null;
    const value: unknown = JSON.parse(raw);
    if (!isRecord(value) || !isIsoDate(value.savedAt) || !Array.isArray(value.hazards)) return null;
    const cacheAgeMs = Date.now() - Date.parse(value.savedAt);
    if (cacheAgeMs < -5 * 60 * 1000 || cacheAgeMs > CACHE_MAX_AGE_MS) return null;
    return {
      savedAt: value.savedAt,
      hazards: value.hazards.map(parseCachedHazard).filter((hazard): hazard is HazardReport => hazard !== null),
    };
  } catch {
    return null;
  }
}

function writeCache(userId: string | null, hazards: HazardReport[]): void {
  if (!userId) return;
  try {
    const value: CachedHazards = { savedAt: new Date().toISOString(), hazards };
    window.localStorage.setItem(cacheKey(userId), JSON.stringify(value));
  } catch {
    // Storage can be unavailable in private browsing. Network data still works.
  }
}

async function currentUserId(): Promise<string | null> {
  try {
    const { data } = await supabase.auth.getSession();
    return data.session?.user.id ?? null;
  } catch {
    return null;
  }
}

export function distanceBetweenHazardPointsMeters(first: HazardPoint, second: HazardPoint): number {
  const radiusM = 6_371_000;
  const firstLat = first.lat * Math.PI / 180;
  const secondLat = second.lat * Math.PI / 180;
  const deltaLat = (second.lat - first.lat) * Math.PI / 180;
  const deltaLng = (second.lng - first.lng) * Math.PI / 180;
  const rawHaversine = Math.sin(deltaLat / 2) ** 2
    + Math.cos(firstLat) * Math.cos(secondLat) * Math.sin(deltaLng / 2) ** 2;
  const haversine = Math.min(1, Math.max(0, rawHaversine));
  return radiusM * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

function filterForRequest(hazards: HazardReport[], options: LoadHazardsOptions): HazardReport[] {
  const now = Date.now();
  const radiusKm = clamp(options.radiusKm, DEFAULT_RADIUS_KM, 0.25, 100);
  return hazards
    .filter((hazard) => hazard.status === 'active' && Date.parse(hazard.expiresAt) > now)
    .filter((hazard) => !options.center
      || distanceBetweenHazardPointsMeters(options.center, hazard.location) <= radiusKm * 1000)
    .slice(0, Math.round(clamp(options.limit, DEFAULT_LIMIT, 1, MAX_LIMIT)));
}

export async function loadHazards(options: LoadHazardsOptions = {}): Promise<HazardLoadResult> {
  if (options.center) assertValidPoint(options.center);
  const userId = await currentUserId();
  const limit = Math.round(clamp(options.limit, DEFAULT_LIMIT, 1, MAX_LIMIT));
  const radiusKm = clamp(options.radiusKm, DEFAULT_RADIUS_KM, 0.25, 100);
  let query = supabase
    .from('hazard_reports')
    .select('id, reporter_id, location, hazard_type, description, photo_url, status, upvotes, created_at, last_confirmed_at, expires_at, latitude, longitude')
    .eq('status', 'active')
    .gt('expires_at', new Date().toISOString())
    .order('upvotes', { ascending: false })
    .order('last_confirmed_at', { ascending: false })
    .limit(limit);

  if (options.center) {
    const latitudeDelta = radiusKm / 111.32;
    const longitudeKmPerDegree = 111.32 * Math.abs(Math.cos(options.center.lat * Math.PI / 180));
    query = query
      .gte('latitude', options.center.lat - latitudeDelta)
      .lte('latitude', options.center.lat + latitudeDelta);

    if (longitudeKmPerDegree > 0 && radiusKm / longitudeKmPerDegree < 180) {
      const longitudeDelta = radiusKm / longitudeKmPerDegree;
      const minimumLongitude = options.center.lng - longitudeDelta;
      const maximumLongitude = options.center.lng + longitudeDelta;
      if (minimumLongitude < -180) {
        query = query.or(`longitude.gte.${minimumLongitude + 360},longitude.lte.${maximumLongitude}`);
      } else if (maximumLongitude > 180) {
        query = query.or(`longitude.gte.${minimumLongitude},longitude.lte.${maximumLongitude - 360}`);
      } else {
        query = query.gte('longitude', minimumLongitude).lte('longitude', maximumLongitude);
      }
    }
  }

  try {
    const hazardsResult = await query;
    if (hazardsResult.error) throw hazardsResult.error;

    const rawRows: unknown[] = Array.isArray(hazardsResult.data) ? hazardsResult.data : [];
    const hazardIds = rawRows
      .map((row) => isRecord(row) && typeof row.id === 'string' ? row.id : null)
      .filter((id): id is string => id !== null);
    const confirmedIds = new Set<string>();

    if (hazardIds.length > 0) {
      const confirmationsResult = await supabase
        .from('hazard_confirmations')
        .select('hazard_id')
        .in('hazard_id', hazardIds);
      if (confirmationsResult.error) throw confirmationsResult.error;
      const rawConfirmations: unknown[] = Array.isArray(confirmationsResult.data) ? confirmationsResult.data : [];
      rawConfirmations.forEach((value) => {
        if (isRecord(value) && typeof value.hazard_id === 'string') confirmedIds.add(value.hazard_id);
      });
    }

    const hazards = filterForRequest(
      rawRows.map((row) => parseHazardRow(row, confirmedIds)).filter((hazard): hazard is HazardReport => hazard !== null),
      options,
    );
    writeCache(userId, hazards);
    return { hazards, source: 'network', cachedAt: null };
  } catch (error) {
    const cached = readCache(userId);
    if (!cached) throw error;
    return {
      hazards: filterForRequest(cached.hazards, options),
      source: 'cache',
      cachedAt: cached.savedAt,
    };
  }
}

function assertValidPoint(point: HazardPoint): void {
  if (!Number.isFinite(point.lat) || !Number.isFinite(point.lng)
    || point.lat < -90 || point.lat > 90 || point.lng < -180 || point.lng > 180) {
    throw new Error('Invalid hazard coordinates.');
  }
}

export async function reportHazard(input: ReportHazardInput): Promise<ReportHazardResult> {
  assertValidPoint(input.location);
  const description = input.description?.trim() || null;
  if (description && description.length > 280) throw new Error('Hazard description must be 280 characters or fewer.');

  const { data, error } = await supabase.rpc('report_hazard', {
    p_lat: input.location.lat,
    p_lng: input.location.lng,
    p_hazard_type: input.hazardType,
    p_description: description,
  });
  if (error) throw error;

  const value: unknown = Array.isArray(data) ? data[0] : data;
  if (!isRecord(value) || typeof value.hazard_id !== 'string' || typeof value.merged !== 'boolean') {
    throw new Error('The hazard report response is invalid.');
  }
  return { hazardId: value.hazard_id, merged: value.merged };
}

async function updateCachedConfirmation(hazardId: string, confirmations: number, confirmedByMe: boolean): Promise<void> {
  const userId = await currentUserId();
  const cached = readCache(userId);
  if (!cached) return;
  writeCache(userId, cached.hazards.map((hazard) => hazard.id === hazardId
    ? { ...hazard, confirmations, confirmedByMe }
    : hazard));
}

function parseConfirmationCount(value: unknown): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    throw new Error('The hazard confirmation response is invalid.');
  }
  return value;
}

export async function confirmHazard(hazardId: string): Promise<number> {
  const { data, error } = await supabase.rpc('confirm_hazard', { p_hazard_id: hazardId });
  if (error) throw error;
  const confirmations = parseConfirmationCount(data);
  await updateCachedConfirmation(hazardId, confirmations, true);
  return confirmations;
}

export async function unconfirmHazard(hazardId: string): Promise<number> {
  const { data, error } = await supabase.rpc('unconfirm_hazard', { p_hazard_id: hazardId });
  if (error) throw error;
  const confirmations = parseConfirmationCount(data);
  await updateCachedConfirmation(hazardId, confirmations, false);
  return confirmations;
}

export async function resolveHazard(hazardId: string): Promise<void> {
  const { data, error } = await supabase.rpc('resolve_hazard', { p_hazard_id: hazardId });
  if (error) throw error;
  if (data !== true) throw new Error('The hazard resolution response is invalid.');

  const userId = await currentUserId();
  const cached = readCache(userId);
  if (cached) writeCache(userId, cached.hazards.filter((hazard) => hazard.id !== hazardId));
}

export function subscribeToHazards(onChange: () => void): () => void {
  const channelName = `safety-radar:${Date.now()}:${Math.random().toString(36).slice(2)}`;
  const channel = supabase
    .channel(channelName)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'hazard_reports' }, () => onChange())
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}
