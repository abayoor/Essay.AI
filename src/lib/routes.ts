import type { CycleRoute, Difficulty, RoutePoint } from './cyclingModels';
import { featuredRoutes, findFeaturedRoute } from './featuredRoutes';
import { supabase } from './supabase';

type NewRoute = { title: string; description: string; points: RoutePoint[]; elevationGain: number; difficulty: Difficulty; region: string };

function isPoint(value: unknown): value is RoutePoint {
  return typeof value === 'object' && value !== null
    && typeof (value as Record<string, unknown>).lat === 'number'
    && typeof (value as Record<string, unknown>).lng === 'number';
}

function routeFromRow(row: Record<string, unknown>): CycleRoute {
  return {
    ...row,
    path: Array.isArray(row.path) ? row.path.filter(isPoint) : [],
    route_kind: 'community',
    source_name: 'Сообщество Slipstream',
    popularity_score: 0,
  } as CycleRoute;
}

export function routeDistanceKm(points: RoutePoint[]): number {
  const radius = 6371;
  return points.slice(1).reduce((total, point, index) => {
    const previous = points[index];
    const dLat = (point.lat - previous.lat) * Math.PI / 180;
    const dLng = (point.lng - previous.lng) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(previous.lat * Math.PI / 180) * Math.cos(point.lat * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
    return total + radius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }, 0);
}

export async function loadRoutes(): Promise<CycleRoute[]> {
  const { data, error } = await supabase
    .from('routes')
    .select('id, title, description, path, distance_km, elevation_gain_m, difficulty, region, created_at')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return [
    ...featuredRoutes,
    ...(data ?? []).map((row) => routeFromRow(row as Record<string, unknown>)),
  ].sort((first, second) => (second.popularity_score ?? 0) - (first.popularity_score ?? 0)
    || new Date(second.created_at).getTime() - new Date(first.created_at).getTime());
}

export async function loadRoute(id: string): Promise<CycleRoute | null> {
  const featuredRoute = findFeaturedRoute(id);
  if (featuredRoute) return featuredRoute;
  const { data, error } = await supabase
    .from('routes')
    .select('id, title, description, path, distance_km, elevation_gain_m, difficulty, region, created_at')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data ? routeFromRow(data as Record<string, unknown>) : null;
}

export async function createRoute(input: NewRoute): Promise<string> {
  const { data, error } = await supabase.from('routes').insert({
    title: input.title.trim(), description: input.description.trim() || null, path: input.points,
    distance_km: routeDistanceKm(input.points), elevation_gain_m: input.elevationGain,
    difficulty: input.difficulty, region: input.region.trim() || null,
  }).select('id').single();
  if (error) throw error;
  return (data as { id: string }).id;
}
