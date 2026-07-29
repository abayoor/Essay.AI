import { supabase } from './supabase';

export type GroupRideOverview = {
  id: string;
  title: string;
  description: string | null;
  scheduled_at: string;
  max_participants: number | null;
};

export type HazardOverview = {
  id: string;
  hazard_type: 'pothole' | 'no_lighting' | 'glass' | 'aggressive_dogs' | 'road_closed';
  description: string | null;
  status: 'active' | 'resolved';
  upvotes: number;
};

export type MarketplaceOverview = {
  id: string;
  title: string;
  description: string;
  price: number | string;
  category: string;
  condition: string;
  city: string | null;
  photos: string[];
};

export type CompetitionOverview = {
  challengeGroups: { id: string; name: string; is_public: boolean }[];
  events: { id: string; title: string; event_type: 'race' | 'gran_fondo' | 'club_ride'; event_date: string; location: string | null; registration_url: string | null; description: string | null }[];
};

export async function loadMapOverview(): Promise<{ groupRides: GroupRideOverview[]; hazards: HazardOverview[]; marketplace: MarketplaceOverview[] }> {
  const [groupsResult, hazardsResult, marketplaceResult] = await Promise.all([
    supabase.from('group_rides').select('id, title, description, scheduled_at, max_participants').gte('scheduled_at', new Date().toISOString()).order('scheduled_at').limit(20),
    supabase.from('hazard_reports').select('id, hazard_type, description, status, upvotes').eq('status', 'active').order('created_at', { ascending: false }).limit(30),
    supabase.from('marketplace_listings').select('id, title, description, price, category, condition, city, photos').eq('status', 'active').order('created_at', { ascending: false }).limit(24),
  ]);
  if (groupsResult.error) throw groupsResult.error;
  if (hazardsResult.error) throw hazardsResult.error;
  if (marketplaceResult.error) throw marketplaceResult.error;
  return {
    groupRides: (groupsResult.data ?? []) as GroupRideOverview[],
    hazards: (hazardsResult.data ?? []) as HazardOverview[],
    marketplace: (marketplaceResult.data ?? []) as MarketplaceOverview[],
  };
}

export async function loadCompetitionOverview(): Promise<CompetitionOverview> {
  const [groupsResult, eventsResult] = await Promise.all([
    supabase.from('challenge_groups').select('id, name, is_public').order('name').limit(20),
    supabase.from('events_calendar').select('id, title, event_type, event_date, location, registration_url, description').gte('event_date', new Date().toISOString().slice(0, 10)).order('event_date').limit(30),
  ]);
  if (groupsResult.error) throw groupsResult.error;
  if (eventsResult.error) throw eventsResult.error;
  return { challengeGroups: (groupsResult.data ?? []) as CompetitionOverview['challengeGroups'], events: (eventsResult.data ?? []) as CompetitionOverview['events'] };
}
