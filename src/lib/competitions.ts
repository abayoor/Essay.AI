import { supabase } from './supabase';

export const WEEKLY_DISTANCE_GOAL_KM = 50;

export type WeeklyCompetitionProgress = {
  distanceKm: number;
  rideCount: number;
  activeDays: number;
  streakDays: number;
  goalKm: number;
  weekStart: string;
  weekEnd: string;
};

export type ChallengeGroupSummary = {
  id: string;
  name: string;
  memberCount: number;
  isMember: boolean;
};

export type CompetitionEvent = {
  id: string;
  title: string;
  eventType: 'race' | 'gran_fondo' | 'club_ride' | 'marathon';
  eventDate: string;
  location: string | null;
  city: string | null;
  country: string | null;
  distanceKm: number | null;
  organizerName: string | null;
  registrationUrl: string | null;
  description: string | null;
  isInterested: boolean;
  isHomeCity: boolean;
  isHomeCountry: boolean;
};

export type CompetitionsOverview = {
  weekly: WeeklyCompetitionProgress;
  leaderboard: WeeklyLeaderboardEntry[];
  challengeGroups: ChallengeGroupSummary[];
  events: CompetitionEvent[];
  homeCity: string | null;
};

export type NewMarathon = {
  title: string;
  organizerName: string;
  city: string;
  country: string;
  eventDate: string;
  distanceKm: number;
  registrationUrl: string;
  description: string;
};

export type WeeklyLeaderboardEntry = {
  rank: number;
  userId: string;
  username: string;
  fullName: string;
  avatarUrl: string | null;
  distanceKm: number;
  rideCount: number;
};

type RideActivityRow = {
  distance_km: number | string;
  ride_date: string;
};

type ChallengeGroupRow = {
  id: string;
  name: string;
  challenge_group_members: { count: number }[] | null;
};

type ChallengeMembershipRow = {
  challenge_group_id: string;
};

type EventRow = {
  id: string;
  title: string;
  event_type: CompetitionEvent['eventType'];
  event_date: string;
  location: string | null;
  city: string | null;
  country: string | null;
  distance_km: number | string | null;
  organizer_name: string | null;
  registration_url: string | null;
  description: string | null;
};

type EventInterestRow = {
  event_id: string;
};

type WeekBounds = {
  start: Date;
  endExclusive: Date;
  startKey: string;
  endKey: string;
  endExclusiveKey: string;
};

function dateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function currentWeekBounds(now: Date): WeekBounds {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const daysSinceMonday = (start.getDay() + 6) % 7;
  start.setDate(start.getDate() - daysSinceMonday);

  const endExclusive = new Date(start);
  endExclusive.setDate(endExclusive.getDate() + 7);

  const end = new Date(endExclusive);
  end.setDate(end.getDate() - 1);

  return {
    start,
    endExclusive,
    startKey: dateKey(start),
    endKey: dateKey(end),
    endExclusiveKey: dateKey(endExclusive),
  };
}

function currentWeekStreak(activeDateKeys: Set<string>, bounds: WeekBounds, now: Date): number {
  const cursor = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  if (!activeDateKeys.has(dateKey(cursor))) {
    cursor.setDate(cursor.getDate() - 1);
  }

  let streak = 0;
  while (cursor >= bounds.start && cursor < bounds.endExclusive && activeDateKeys.has(dateKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

function safeRegistrationUrl(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : null;
  } catch {
    return null;
  }
}

const placeAliases: Record<string, string> = {
  'алматы': 'almaty', almaty: 'almaty',
  'астана': 'astana', astana: 'astana', 'nur sultan': 'astana',
  'альбукерке': 'albuquerque', albuquerque: 'albuquerque',
  'александрия': 'alexandria', alexandria: 'alexandria',
  'дубай': 'dubai', dubai: 'dubai',
  'лондон': 'london', london: 'london',
  'нью йорк': 'new york', 'new york': 'new york',
  'токио': 'tokyo', tokyo: 'tokyo',
  'казахстан': 'kazakhstan', 'қазақстан': 'kazakhstan', kazakhstan: 'kazakhstan',
  'сша': 'united states', 'ақш': 'united states', 'united states': 'united states',
  'египет': 'egypt', 'мысыр': 'egypt', egypt: 'egypt',
  'оаэ': 'united arab emirates', 'баә': 'united arab emirates', 'біріккен араб әмірліктері': 'united arab emirates', 'united arab emirates': 'united arab emirates',
  'великобритания': 'united kingdom', 'ұлыбритания': 'united kingdom', 'united kingdom': 'united kingdom',
  'япония': 'japan', 'жапония': 'japan', japan: 'japan',
};

function normalizePlace(value: string | null): string {
  const normalized = (value ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase()
    .replace(/[-–—]/g, ' ')
    .replace(/[^\p{L}\p{N} ]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
  return placeAliases[normalized] ?? normalized;
}

function locationParts(value: string | null): { city: string; country: string } {
  const parts = (value ?? '').split(',').map((part) => part.trim()).filter(Boolean);
  return {
    city: normalizePlace(parts[0] ?? null),
    country: normalizePlace(parts.length > 1 ? parts[parts.length - 1] : null),
  };
}

export async function loadCompetitionsOverview(userId: string, now = new Date()): Promise<CompetitionsOverview> {
  if (!userId) throw new Error('A signed-in rider is required.');

  const todayKey = dateKey(now);
  const [weekly, leaderboardResult, groupsResult, eventsResult, profileResult] = await Promise.all([
    loadWeeklyCompetitionProgress(userId, now),
    supabase.rpc('current_week_distance_leaderboard', { max_rows: 50 }),
    supabase
      .from('challenge_groups')
      .select('id, name, challenge_group_members(count)')
      .eq('is_public', true)
      .order('name')
      .limit(30),
    supabase
      .from('events_calendar')
      .select('id, title, event_type, event_date, location, city, country, distance_km, organizer_name, registration_url, description')
      .gte('event_date', todayKey)
      .order('event_date', { ascending: true })
      .limit(40),
    supabase.from('users').select('home_city').eq('id', userId).maybeSingle(),
  ]);

  if (groupsResult.error) throw groupsResult.error;
  if (eventsResult.error) throw eventsResult.error;
  if (profileResult.error) throw profileResult.error;
  // Keep the existing challenges usable while a freshly deployed database is
  // still receiving the leaderboard migration.
  void supabase.rpc('ensure_previous_week_pro_winner').then(() => undefined);

  const groups = (groupsResult.data ?? []) as ChallengeGroupRow[];
  const events = (eventsResult.data ?? []) as EventRow[];
  const groupIds = groups.map((group) => group.id);
  const eventIds = events.map((event) => event.id);

  const [membershipsResult, interestsResult] = await Promise.all([
    groupIds.length
      ? supabase
          .from('challenge_group_members')
          .select('challenge_group_id')
          .eq('user_id', userId)
          .in('challenge_group_id', groupIds)
      : Promise.resolve({ data: [] as ChallengeMembershipRow[], error: null }),
    eventIds.length
      ? supabase
          .from('event_interest')
          .select('event_id')
          .eq('user_id', userId)
          .in('event_id', eventIds)
      : Promise.resolve({ data: [] as EventInterestRow[], error: null }),
  ]);

  if (membershipsResult.error) throw membershipsResult.error;
  if (interestsResult.error) throw interestsResult.error;

  const memberships = new Set(
    ((membershipsResult.data ?? []) as ChallengeMembershipRow[]).map((membership) => membership.challenge_group_id),
  );
  const interests = new Set(
    ((interestsResult.data ?? []) as EventInterestRow[]).map((interest) => interest.event_id),
  );
  const homeCity = (profileResult.data as { home_city: string | null } | null)?.home_city ?? null;
  const home = locationParts(homeCity);
  const mappedEvents: CompetitionEvent[] = events.map((event) => {
    const fallbackLocation = locationParts(event.location);
    const eventCity = normalizePlace(event.city) || fallbackLocation.city;
    const eventCountry = normalizePlace(event.country) || fallbackLocation.country;
    return {
      id: event.id,
      title: event.title,
      eventType: event.event_type,
      eventDate: event.event_date,
      location: event.location,
      city: event.city,
      country: event.country,
      distanceKm: event.distance_km === null ? null : Number(event.distance_km),
      organizerName: event.organizer_name,
      registrationUrl: safeRegistrationUrl(event.registration_url),
      description: event.description,
      isInterested: interests.has(event.id),
      isHomeCity: Boolean(home.city && eventCity === home.city),
      isHomeCountry: Boolean(home.country && eventCountry === home.country),
    };
  }).sort((first, second) => Number(second.isHomeCity) - Number(first.isHomeCity)
    || Number(second.isHomeCountry) - Number(first.isHomeCountry)
    || first.eventDate.localeCompare(second.eventDate));
  return {
    weekly,
    leaderboard: ((leaderboardResult.error ? [] : leaderboardResult.data ?? []) as {
      rank: number | string;
      user_id: string;
      username: string;
      full_name: string;
      avatar_url: string | null;
      distance_km: number | string;
      ride_count: number | string;
    }[]).map((entry) => ({
      rank: Number(entry.rank),
      userId: entry.user_id,
      username: entry.username,
      fullName: entry.full_name,
      avatarUrl: entry.avatar_url,
      distanceKm: Number(entry.distance_km),
      rideCount: Number(entry.ride_count),
    })),
    challengeGroups: groups.map((group) => ({
      id: group.id,
      name: group.name,
      memberCount: Number(group.challenge_group_members?.[0]?.count ?? 0),
      isMember: memberships.has(group.id),
    })),
    events: mappedEvents,
    homeCity,
  };
}

export async function createMarathon(input: NewMarathon): Promise<void> {
  const title = input.title.trim();
  const organizerName = input.organizerName.trim();
  const city = input.city.trim();
  const country = input.country.trim();
  if (!title || !organizerName || !city || !input.eventDate) throw new Error('Fill in the required marathon fields.');
  if (!Number.isFinite(input.distanceKm) || input.distanceKm < 1 || input.distanceKm > 2000) throw new Error('Distance is outside the allowed range.');
  const registrationUrl = safeRegistrationUrl(input.registrationUrl.trim() || null);
  if (input.registrationUrl.trim() && !registrationUrl) throw new Error('Registration URL must use http or https.');
  const { error } = await supabase.from('events_calendar').insert({
    title,
    event_type: 'marathon',
    event_date: input.eventDate,
    location: [city, country].filter(Boolean).join(', '),
    city,
    country: country || null,
    distance_km: input.distanceKm,
    organizer_name: organizerName,
    registration_url: registrationUrl,
    description: input.description.trim() || null,
  });
  if (error) throw error;
}

export async function loadWeeklyCompetitionProgress(
  userId: string,
  now = new Date(),
): Promise<WeeklyCompetitionProgress> {
  if (!userId) throw new Error('A signed-in rider is required.');

  const bounds = currentWeekBounds(now);
  const { data, error } = await supabase
    .from('ride_activities')
    .select('distance_km, ride_date')
    .eq('user_id', userId)
    .gte('ride_date', bounds.startKey)
    .lt('ride_date', bounds.endExclusiveKey)
    .order('ride_date', { ascending: true });

  if (error) throw error;

  const rides = (data ?? []) as RideActivityRow[];
  const activeDateKeys = new Set(rides.map((ride) => ride.ride_date));
  const distanceKm = rides.reduce((sum, ride) => {
    const distance = Number(ride.distance_km);
    return Number.isFinite(distance) && distance > 0 ? sum + distance : sum;
  }, 0);

  return {
    distanceKm,
    rideCount: rides.length,
    activeDays: activeDateKeys.size,
    streakDays: currentWeekStreak(activeDateKeys, bounds, now),
    goalKm: WEEKLY_DISTANCE_GOAL_KM,
    weekStart: bounds.startKey,
    weekEnd: bounds.endKey,
  };
}

export async function setChallengeGroupMembership(groupId: string, userId: string, isMember: boolean): Promise<void> {
  if (!groupId || !userId) throw new Error('Group and rider are required.');

  const query = isMember
    ? supabase
        .from('challenge_group_members')
        .upsert(
          { challenge_group_id: groupId, user_id: userId },
          { onConflict: 'challenge_group_id,user_id', ignoreDuplicates: true },
        )
    : supabase
        .from('challenge_group_members')
        .delete()
        .eq('challenge_group_id', groupId)
        .eq('user_id', userId);

  const { error } = await query;
  if (error) throw error;
}

export async function setEventInterest(eventId: string, userId: string, isInterested: boolean): Promise<void> {
  if (!eventId || !userId) throw new Error('Event and rider are required.');

  const query = isInterested
    ? supabase
        .from('event_interest')
        .upsert(
          { event_id: eventId, user_id: userId },
          { onConflict: 'event_id,user_id', ignoreDuplicates: true },
        )
    : supabase
        .from('event_interest')
        .delete()
        .eq('event_id', eventId)
        .eq('user_id', userId);

  const { error } = await query;
  if (error) throw error;
}
