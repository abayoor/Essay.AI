import type { GpsTrackPoint, RideActivity, RideRecordingMetrics } from './cyclingModels';
import { simplifyGpsTrack } from './gps';
import { supabase } from './supabase';

export type SavedRecordedRide = {
  id: string;
  metrics: RideRecordingMetrics;
  track: GpsTrackPoint[];
  title: string;
  description: string;
};

type SaveRecordedRideInput = {
  track: GpsTrackPoint[];
  metrics: RideRecordingMetrics;
  title: string;
  description: string;
};

type RideRow = {
  id: string;
  title: string | null;
  description: string | null;
  distance_km: number | string;
  duration_seconds: number | null;
  moving_time_seconds: number | null;
  elevation_gain_m: number | string | null;
  avg_speed_kmh: number | string | null;
  max_speed_kmh: number | string | null;
  pace_min_per_km: number | string | null;
  ride_date: string;
  created_at: string;
  gps_track: unknown;
};

function numberOrNull(value: number | string | null): number | null {
  if (value === null) return null;
  const result = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(result) ? result : null;
}

function gpsPoint(value: unknown): value is GpsTrackPoint {
  if (typeof value !== 'object' || value === null) return false;
  const point = value as Record<string, unknown>;
  return typeof point.lat === 'number'
    && typeof point.lng === 'number'
    && (typeof point.elevation === 'number' || point.elevation === null)
    && typeof point.timestamp === 'number';
}

function rideFromRow(row: RideRow): RideActivity {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    distanceKm: numberOrNull(row.distance_km) ?? 0,
    durationSeconds: row.duration_seconds ?? 0,
    movingTimeSeconds: row.moving_time_seconds,
    elevationGainM: numberOrNull(row.elevation_gain_m) ?? 0,
    averageSpeedKmh: numberOrNull(row.avg_speed_kmh),
    maxSpeedKmh: numberOrNull(row.max_speed_kmh),
    paceMinPerKm: numberOrNull(row.pace_min_per_km),
    rideDate: row.ride_date,
    createdAt: row.created_at,
    gpsTrack: Array.isArray(row.gps_track) ? row.gps_track.filter(gpsPoint) : [],
  };
}

const rideFields = 'id, title, description, distance_km, duration_seconds, moving_time_seconds, elevation_gain_m, avg_speed_kmh, max_speed_kmh, pace_min_per_km, ride_date, created_at, gps_track';

export async function saveRecordedRide(input: SaveRecordedRideInput): Promise<SavedRecordedRide> {
  const { track, metrics } = input;
  const title = input.title.trim();
  const description = input.description.trim();
  if (track.length < 2 || metrics.distanceKm <= 0) throw new Error('Недостаточно точек GPS для сохранения поездки.');
  if (!title) throw new Error('Дай заезду короткое название.');
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) throw new Error('Войди в аккаунт, чтобы сохранить тренировку.');
  const simplifiedTrack = simplifyGpsTrack(track).map(({ lat, lng, elevation, timestamp }) => ({ lat, lng, elevation, timestamp }));
  const { data, error } = await supabase.from('ride_activities').insert({
    user_id: authData.user.id,
    title,
    description: description || null,
    distance_km: metrics.distanceKm,
    duration_seconds: Math.round(metrics.elapsedTimeSeconds),
    elevation_gain_m: metrics.elevationGainM,
    ride_date: new Date(track[0].timestamp).toISOString().slice(0, 10),
    source: 'gps',
    gps_track: simplifiedTrack,
    avg_speed_kmh: metrics.averageSpeedKmh,
    max_speed_kmh: metrics.maxSpeedKmh,
    moving_time_seconds: Math.round(metrics.movingTimeSeconds),
    pace_min_per_km: metrics.paceMinPerKm,
  }).select('id').single();
  if (error) throw error;
  return { id: (data as { id: string }).id, metrics, track: simplifiedTrack, title, description };
}

export async function loadRecordedRides(): Promise<RideActivity[]> {
  const { data, error } = await supabase.from('ride_activities').select(rideFields).order('ride_date', { ascending: false }).order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => rideFromRow(row as RideRow));
}

export async function loadRecordedRide(id: string): Promise<RideActivity | null> {
  const { data, error } = await supabase.from('ride_activities').select(rideFields).eq('id', id).maybeSingle();
  if (error) throw error;
  return data ? rideFromRow(data as RideRow) : null;
}
