import type { PublicProfile } from './cyclingModels';
import { loadPublicProfiles } from './rider';
import { supabase } from './supabase';

export type FriendRequest = {
  id: string;
  rider: PublicProfile;
};

export type FriendLiveLocation = {
  rider: PublicProfile;
  lat: number;
  lng: number;
  accuracyM: number;
  headingDegrees: number | null;
  updatedAt: string;
};

export type FriendHub = {
  friends: PublicProfile[];
  incoming: FriendRequest[];
  outgoingUserIds: string[];
  locations: FriendLiveLocation[];
};

type FriendshipRow = {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: 'pending' | 'accepted' | 'rejected';
};

type LiveLocationRow = {
  user_id: string;
  latitude: number;
  longitude: number;
  accuracy_m: number;
  heading_degrees: number | null;
  updated_at: string;
};

export const locationSharingStorageKey = 'slipstream-friend-location-sharing';
export const locationSharingChangedEvent = 'slipstream:location-sharing-changed';

export function locationSharingEnabled(): boolean {
  return window.localStorage.getItem(locationSharingStorageKey) === 'true';
}

export function setLocationSharingEnabled(enabled: boolean): void {
  window.localStorage.setItem(locationSharingStorageKey, String(enabled));
  window.dispatchEvent(new CustomEvent(locationSharingChangedEvent));
}

export async function loadFriendHub(): Promise<FriendHub> {
  const { data: authData } = await supabase.auth.getUser();
  const viewerId = authData.user?.id;
  if (!viewerId) return { friends: [], incoming: [], outgoingUserIds: [], locations: [] };

  const { data, error } = await supabase
    .from('friendships')
    .select('id, requester_id, addressee_id, status');
  if (error) throw error;
  const rows = (data ?? []) as FriendshipRow[];
  const friendIds = rows.filter((row) => row.status === 'accepted').map((row) => (
    row.requester_id === viewerId ? row.addressee_id : row.requester_id
  ));
  const incomingRows = rows.filter((row) => row.status === 'pending' && row.addressee_id === viewerId);
  const outgoingUserIds = rows
    .filter((row) => row.status === 'pending' && row.requester_id === viewerId)
    .map((row) => row.addressee_id);
  const profileIds = [...new Set([...friendIds, ...incomingRows.map((row) => row.requester_id)])];
  const profiles = await loadPublicProfiles(profileIds);
  const profileById = new Map(profiles.map((profile) => [profile.id, profile]));

  const { data: locationData, error: locationError } = friendIds.length
    ? await supabase
        .from('rider_live_locations')
        .select('user_id, latitude, longitude, accuracy_m, heading_degrees, updated_at')
        .in('user_id', friendIds)
    : { data: [] as LiveLocationRow[], error: null };
  if (locationError) throw locationError;

  return {
    friends: friendIds.flatMap((id) => profileById.get(id) ? [profileById.get(id) as PublicProfile] : []),
    incoming: incomingRows.flatMap((row) => {
      const rider = profileById.get(row.requester_id);
      return rider ? [{ id: row.id, rider }] : [];
    }),
    outgoingUserIds,
    locations: ((locationData ?? []) as LiveLocationRow[]).flatMap((location) => {
      const rider = profileById.get(location.user_id);
      return rider ? [{
        rider,
        lat: location.latitude,
        lng: location.longitude,
        accuracyM: location.accuracy_m,
        headingDegrees: location.heading_degrees,
        updatedAt: location.updated_at,
      }] : [];
    }),
  };
}

export async function sendFriendRequest(targetUserId: string): Promise<void> {
  const { error } = await supabase.rpc('send_friend_request', { target_user_id: targetUserId });
  if (error) throw error;
}

export async function respondFriendRequest(requestId: string, accept: boolean): Promise<void> {
  const { error } = await supabase.rpc('respond_friend_request', { request_id: requestId, accept_request: accept });
  if (error) throw error;
}

export async function removeFriend(friendUserId: string): Promise<void> {
  const { error } = await supabase.rpc('remove_friend', { friend_user_id: friendUserId });
  if (error) throw error;
}

export async function publishLiveLocation(position: GeolocationPosition): Promise<void> {
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) return;
  const accuracyM = position.coords.accuracy;
  if (!Number.isFinite(position.coords.latitude) || !Number.isFinite(position.coords.longitude)
    || !Number.isFinite(accuracyM) || accuracyM < 0 || accuracyM > 25_000) return;
  const heading = position.coords.heading;
  const { error } = await supabase.from('rider_live_locations').upsert({
    user_id: authData.user.id,
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
    accuracy_m: accuracyM,
    heading_degrees: typeof heading === 'number' && Number.isFinite(heading) ? Math.max(0, Math.min(360, heading)) : null,
    updated_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 30 * 60_000).toISOString(),
  }, { onConflict: 'user_id' });
  if (error) throw error;
}

export async function stopLiveLocationSharing(): Promise<void> {
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) return;
  const { error } = await supabase.from('rider_live_locations').delete().eq('user_id', authData.user.id);
  if (error) throw error;
}
