import type { MapPlace } from './places';
import { supabase } from './supabase';

export type PinnedMapPlaceKind = 'home' | 'work' | 'favorite';
export type StoredMapPlaceKind = PinnedMapPlaceKind | 'history';

export type StoredMapPlace = MapPlace & {
  recordId: string;
  kind: StoredMapPlaceKind;
  lastUsedAt: string;
};

type MapPlaceRow = {
  id: string;
  place_kind: StoredMapPlaceKind;
  source_id: string;
  name: string;
  subtitle: string;
  latitude: number;
  longitude: number;
  last_used_at: string;
};

function fromRow(row: MapPlaceRow): StoredMapPlace {
  return {
    recordId: row.id,
    kind: row.place_kind,
    id: row.source_id,
    name: row.name,
    subtitle: row.subtitle,
    lat: row.latitude,
    lng: row.longitude,
    lastUsedAt: row.last_used_at,
  };
}

async function authenticatedUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!data.user) throw new Error('Authentication is required to save map places.');
  return data.user.id;
}

export async function loadMapPlaces(): Promise<StoredMapPlace[]> {
  const { data, error } = await supabase
    .from('map_places')
    .select('id, place_kind, source_id, name, subtitle, latitude, longitude, last_used_at')
    .order('last_used_at', { ascending: false })
    .limit(40);
  if (error) throw error;
  return (data ?? []).map((row) => fromRow(row as MapPlaceRow));
}

export async function rememberMapSearch(place: MapPlace): Promise<void> {
  const userId = await authenticatedUserId();
  const now = new Date().toISOString();
  const { error } = await supabase.from('map_places').upsert({
    user_id: userId,
    place_kind: 'history',
    source_id: place.id,
    name: place.name,
    subtitle: place.subtitle,
    latitude: place.lat,
    longitude: place.lng,
    last_used_at: now,
  }, { onConflict: 'user_id,place_kind,source_id' });
  if (error) throw error;

  const { data: oldRows, error: historyError } = await supabase
    .from('map_places')
    .select('id')
    .eq('place_kind', 'history')
    .order('last_used_at', { ascending: false })
    .range(10, 100);
  if (historyError) throw historyError;
  const oldIds = (oldRows ?? []).map((row) => (row as { id: string }).id);
  if (oldIds.length > 0) {
    const { error: deleteError } = await supabase.from('map_places').delete().in('id', oldIds);
    if (deleteError) throw deleteError;
  }
}

export async function savePinnedMapPlace(kind: PinnedMapPlaceKind, place: MapPlace): Promise<void> {
  const userId = await authenticatedUserId();
  if (kind === 'home' || kind === 'work') {
    const { error: replaceError } = await supabase.from('map_places').delete().eq('place_kind', kind);
    if (replaceError) throw replaceError;
  }
  const { error } = await supabase.from('map_places').upsert({
    user_id: userId,
    place_kind: kind,
    source_id: place.id,
    name: place.name,
    subtitle: place.subtitle,
    latitude: place.lat,
    longitude: place.lng,
    last_used_at: new Date().toISOString(),
  }, { onConflict: 'user_id,place_kind,source_id' });
  if (error) throw error;
}

export async function removeMapPlace(recordId: string): Promise<void> {
  const { error } = await supabase.from('map_places').delete().eq('id', recordId);
  if (error) throw error;
}

export async function clearMapSearchHistory(): Promise<void> {
  const { error } = await supabase.from('map_places').delete().eq('place_kind', 'history');
  if (error) throw error;
}
