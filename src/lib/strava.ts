import type { RidePostStats } from './cyclingModels';
import { apiFetch } from './api';
import { supabase } from './supabase';

export type StravaActivity = {
  id: number;
  name: string;
  startDate: string;
  distanceKm: number;
  elevationGainM: number;
  durationSeconds: number;
  summaryPolyline: string | null;
};

type ApiError = { error?: string };
type StravaActivitiesResponse = { activities?: StravaActivity[] } & ApiError;
type StravaAuthorizationResponse = { authorizationUrl?: string } & ApiError;
type StravaStatusResponse = { connected?: boolean } & ApiError;

const activitiesCache = new Map<string, StravaActivity[]>();

async function authenticatedRequest(path: string): Promise<Response> {
  const { data } = await supabase.auth.getSession();
  if (!data.session) throw new Error('Войди в аккаунт, чтобы подключить Strava.');
  return apiFetch(path, { headers: { Authorization: `Bearer ${data.session.access_token}` } }, 20_000);
}

async function readApiError(response: Response): Promise<string> {
  const body = await response.json().catch((): ApiError => ({})) as ApiError;
  return body.error ?? 'Сервис временно недоступен. Попробуй ещё раз.';
}

export async function startStravaConnection(): Promise<void> {
  const response = await authenticatedRequest('/api/strava/authorize');
  if (!response.ok) throw new Error(await readApiError(response));
  const payload = await response.json() as StravaAuthorizationResponse;
  if (!payload.authorizationUrl) throw new Error('Strava не вернул адрес авторизации.');
  window.location.assign(payload.authorizationUrl);
}

export async function loadStravaConnectionStatus(): Promise<boolean> {
  const response = await authenticatedRequest('/api/strava/status');
  if (!response.ok) throw new Error(await readApiError(response));
  const payload = await response.json() as StravaStatusResponse;
  return payload.connected === true;
}

export async function loadStravaActivities(forceRefresh = false): Promise<StravaActivity[]> {
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error('Войди в аккаунт, чтобы импортировать тренировку.');
  if (!forceRefresh && activitiesCache.has(data.user.id)) return activitiesCache.get(data.user.id) ?? [];
  const response = await authenticatedRequest('/api/strava/activities');
  if (!response.ok) throw new Error(await readApiError(response));
  const payload = await response.json() as StravaActivitiesResponse;
  const activities = payload.activities ?? [];
  activitiesCache.set(data.user.id, activities);
  return activities;
}

export async function saveStravaActivity(activity: StravaActivity): Promise<{ id: string; stats: RidePostStats }> {
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) throw new Error('Войди в аккаунт, чтобы импортировать тренировку.');
  const { data, error } = await supabase
    .from('ride_activities')
    .upsert({
      user_id: authData.user.id,
      distance_km: activity.distanceKm,
      duration_seconds: activity.durationSeconds,
      elevation_gain_m: activity.elevationGainM,
      ride_date: activity.startDate.slice(0, 10),
      source: 'strava',
      strava_activity_id: String(activity.id),
      strava_summary_polyline: activity.summaryPolyline,
    }, { onConflict: 'strava_activity_id' })
    .select('id')
    .single();
  if (error) throw error;
  if (!data?.id || typeof data.id !== 'string') throw new Error('Не удалось сохранить тренировку.');
  return {
    id: data.id,
    stats: {
      distanceKm: activity.distanceKm,
      elevationGainM: activity.elevationGainM,
      durationSeconds: activity.durationSeconds,
      summaryPolyline: activity.summaryPolyline,
      track: null,
    },
  };
}
