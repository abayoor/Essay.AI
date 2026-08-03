import { supabase } from './supabase';

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
  events: { id: string; title: string; event_type: 'race' | 'gran_fondo' | 'club_ride' | 'marathon'; event_date: string; location: string | null; registration_url: string | null; description: string | null }[];
};

export async function loadMapOverview(): Promise<{ marketplace: MarketplaceOverview[] }> {
  const marketplaceResult = await supabase.from('marketplace_listings').select('id, title, description, price, category, condition, city, photos').eq('status', 'active').order('created_at', { ascending: false }).limit(24);
  if (marketplaceResult.error) throw marketplaceResult.error;
  return {
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
