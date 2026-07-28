import type { RiderProfile, RiderStats } from './cyclingModels';
import { supabase } from './supabase';

function numberValue(value: unknown): number {
  return typeof value === 'number' ? value : typeof value === 'string' ? Number(value) || 0 : 0;
}

export async function loadRiderProfile(): Promise<RiderProfile | null> {
  const { data, error } = await supabase.from('users').select('full_name, avatar_url, home_city, bio').maybeSingle();
  if (error) throw error;
  return data as RiderProfile | null;
}

export async function saveRiderProfile(profile: RiderProfile): Promise<void> {
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error('Войди в аккаунт, чтобы сохранить профиль.');
  const { error } = await supabase.from('users').update(profile).eq('id', data.user.id);
  if (error) throw error;
}

export async function loadRiderStats(): Promise<RiderStats> {
  const { data, error } = await supabase
    .from('ride_activities')
    .select('distance_km, elevation_gain_m');
  if (error) throw error;
  const rides = data ?? [];
  const distances = rides.map((ride) => numberValue(ride.distance_km));
  return {
    distanceKm: distances.reduce((total, value) => total + value, 0),
    ridesCount: rides.length,
    elevationM: rides.reduce((total, ride) => total + numberValue(ride.elevation_gain_m), 0),
    longestRideKm: Math.max(0, ...distances),
  };
}
