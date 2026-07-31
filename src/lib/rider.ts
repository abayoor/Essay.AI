import type { PublicProfile, RiderProfile, RiderStats } from './cyclingModels';
import { supabase } from './supabase';

type RiderProfileUpdate = Partial<Pick<RiderProfile, 'full_name' | 'avatar_url' | 'home_city' | 'bio' | 'username' | 'interests' | 'locale' | 'theme_preference'>>;

function numberValue(value: unknown): number {
  return typeof value === 'number' ? value : typeof value === 'string' ? Number(value) || 0 : 0;
}

export async function loadRiderProfile(): Promise<RiderProfile | null> {
  const { data, error } = await supabase
    .from('users')
    .select('full_name, avatar_url, home_city, bio, username, interests, locale, theme_preference')
    .maybeSingle();
  if (error) throw error;
  return data as RiderProfile | null;
}

export async function loadPublicProfile(username: string): Promise<PublicProfile | null> {
  const { data, error } = await supabase
    .from('public_profiles')
    .select('id, username, full_name, avatar_url, home_city, bio, interests')
    .ilike('username', username)
    .maybeSingle();
  if (error) throw error;
  return data as PublicProfile | null;
}

export async function loadPublicProfiles(ids: string[]): Promise<PublicProfile[]> {
  if (!ids.length) return [];
  const { data, error } = await supabase
    .from('public_profiles')
    .select('id, username, full_name, avatar_url, home_city, bio, interests')
    .in('id', ids);
  if (error) throw error;
  return (data ?? []) as PublicProfile[];
}

export async function searchPublicProfiles(username: string): Promise<PublicProfile[]> {
  const query = username.trim();
  if (query.length < 2) return [];
  const { data, error } = await supabase
    .from('public_profiles')
    .select('id, username, full_name, avatar_url, home_city, bio, interests')
    .ilike('username', `%${query}%`)
    .order('username')
    .limit(12);
  if (error) throw error;
  return (data ?? []) as PublicProfile[];
}

export async function isUsernameAvailable(username: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('is_username_available', { candidate: username });
  if (error) throw error;
  return data === true;
}

export async function saveRiderProfile(profile: RiderProfileUpdate): Promise<void> {
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error('Войди в аккаунт, чтобы сохранить профиль.');
  const { error } = await supabase.from('users').update(profile).eq('id', data.user.id);
  if (error) throw error;
}

function storageFilename(name: string): string {
  const extension = name.includes('.') ? `.${name.split('.').pop()?.toLowerCase()}` : '';
  return `${crypto.randomUUID()}${extension}`;
}

export async function uploadAvatar(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('Выбери изображение для аватара.');
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) throw new Error('Войди в аккаунт, чтобы загрузить аватар.');

  const path = `${userData.user.id}/${storageFilename(file.name)}`;
  const { error } = await supabase.storage.from('avatars').upload(path, file, { upsert: false });
  if (error) throw error;
  const { data } = supabase.storage.from('avatars').getPublicUrl(path);
  return data.publicUrl;
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
