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
  eventType: 'race' | 'gran_fondo' | 'club_ride';
  eventDate: string;
  location: string | null;
  registrationUrl: string | null;
  description: string | null;
  isInterested: boolean;
};

export type CompetitionsOverview = {
  weekly: WeeklyCompetitionProgress;
  leaderboard: WeeklyLeaderboardEntry[];
  challengeGroups: ChallengeGroupSummary[];
  events: CompetitionEvent[];
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

export async function loadCompetitionsOverview(userId: string, now = new Date()): Promise<CompetitionsOverview> {
  if (!userId) throw new Error('A signed-in rider is required.');

  const todayKey = dateKey(now);
  const [weekly, leaderboardResult, groupsResult, eventsResult] = await Promise.all([
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
      .select('id, title, event_type, event_date, location, registration_url, description')
      .gte('event_date', todayKey)
      .order('event_date', { ascending: true })
      .limit(40),
  ]);

  if (groupsResult.error) throw groupsResult.error;
  if (eventsResult.error) throw eventsResult.error;
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
    events: events.map((event) => ({
      id: event.id,
      title: event.title,
      eventType: event.event_type,
      eventDate: event.event_date,
      location: event.location,
      registrationUrl: safeRegistrationUrl(event.registration_url),
      description: event.description,
      isInterested: interests.has(event.id),
    })),
  };
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
