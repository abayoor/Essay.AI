import type { Difficulty, PostComment, PostMediaType, PublicProfile, RidePostStats, RoutePostPreview, SocialPost } from './cyclingModels';
import { loadPublicProfiles } from './rider';
import { supabase } from './supabase';

type PostRow = {
  id: string;
  user_id: string;
  media_url: string | null;
  media_type: PostMediaType | null;
  caption: string;
  created_at: string;
  strava_distance_km: number | string | null;
  strava_elevation_gain_m: number | string | null;
  strava_duration_seconds: number | null;
  strava_summary_polyline: string | null;
  ride_track: unknown;
  route_id: string | null;
  route_title: string | null;
  route_description: string | null;
  route_path: unknown;
  route_distance_km: number | string | null;
  route_elevation_gain_m: number | string | null;
  route_difficulty: string | null;
};

type LikeRow = { id: string; post_id: string; user_id: string };

type CommentRow = {
  id: string;
  post_id: string;
  user_id: string;
  comment: string;
  created_at: string;
};

const unknownProfile: PublicProfile = {
  id: '',
  username: 'rider',
  full_name: 'Райдер',
  avatar_url: null,
  home_city: null,
  bio: null,
  interests: [],
};

function numberOrZero(value: number | string | null): number {
  return typeof value === 'number' ? value : typeof value === 'string' ? Number(value) || 0 : 0;
}

function profileById(profiles: PublicProfile[]): Map<string, PublicProfile> {
  return new Map(profiles.map((profile) => [profile.id, profile]));
}

function createRideStats(post: PostRow): RidePostStats | null {
  if (post.strava_distance_km === null || post.strava_elevation_gain_m === null || post.strava_duration_seconds === null) return null;
  return {
    distanceKm: numberOrZero(post.strava_distance_km),
    elevationGainM: numberOrZero(post.strava_elevation_gain_m),
    durationSeconds: post.strava_duration_seconds,
    summaryPolyline: post.strava_summary_polyline,
    track: Array.isArray(post.ride_track) ? post.ride_track.filter((point): point is { lat: number; lng: number } => typeof point === 'object' && point !== null && typeof (point as Record<string, unknown>).lat === 'number' && typeof (point as Record<string, unknown>).lng === 'number') : null,
  };
}

function isDifficulty(value: string | null): value is Difficulty {
  return value === 'easy' || value === 'moderate' || value === 'hard';
}

function routePoints(value: unknown): { lat: number; lng: number }[] {
  return Array.isArray(value) ? value.filter((point): point is { lat: number; lng: number } => typeof point === 'object' && point !== null && typeof (point as Record<string, unknown>).lat === 'number' && typeof (point as Record<string, unknown>).lng === 'number') : [];
}

function createRoutePreview(post: PostRow): RoutePostPreview | null {
  if (!post.route_title || !isDifficulty(post.route_difficulty)) return null;
  return {
    routeId: post.route_id,
    title: post.route_title,
    description: post.route_description,
    path: routePoints(post.route_path),
    distanceKm: numberOrZero(post.route_distance_km),
    elevationGainM: numberOrZero(post.route_elevation_gain_m),
    difficulty: post.route_difficulty,
  };
}

export async function loadPosts(userId?: string): Promise<SocialPost[]> {
  let query = supabase
    .from('posts')
    .select('id, user_id, media_url, media_type, caption, created_at, strava_distance_km, strava_elevation_gain_m, strava_duration_seconds, strava_summary_polyline, ride_track, route_id, route_title, route_description, route_path, route_distance_km, route_elevation_gain_m, route_difficulty')
    .order('created_at', { ascending: false });
  if (userId) query = query.eq('user_id', userId);
  const { data: postData, error: postError } = await query;
  if (postError) throw postError;

  const posts = (postData ?? []) as PostRow[];
  if (!posts.length) return [];
  const postIds = posts.map((post) => post.id);
  const [likesResult, commentsResult] = await Promise.all([
    supabase.from('post_likes').select('id, post_id, user_id').in('post_id', postIds),
    supabase.from('post_comments').select('id, post_id, user_id, comment, created_at').in('post_id', postIds).order('created_at', { ascending: true }),
  ]);
  if (likesResult.error) throw likesResult.error;
  if (commentsResult.error) throw commentsResult.error;

  const likes = (likesResult.data ?? []) as LikeRow[];
  const comments = (commentsResult.data ?? []) as CommentRow[];
  const profiles = await loadPublicProfiles([...new Set([...posts.map((post) => post.user_id), ...comments.map((comment) => comment.user_id)])]);
  const profilesById = profileById(profiles);

  return posts.map((post) => ({
    id: post.id,
    user_id: post.user_id,
    media_url: post.media_url,
    media_type: post.media_type,
    caption: post.caption,
    created_at: post.created_at,
    author: profilesById.get(post.user_id) ?? { ...unknownProfile, id: post.user_id },
    likes: likes.filter((like) => like.post_id === post.id).map((like) => ({ id: like.id, user_id: like.user_id })),
    comments: comments
      .filter((comment) => comment.post_id === post.id)
      .map((comment): PostComment => ({
        ...comment,
        author: profilesById.get(comment.user_id) ?? { ...unknownProfile, id: comment.user_id },
      })),
    rideStats: createRideStats(post),
    routePreview: createRoutePreview(post),
  }));
}

export type CreatePostInput = {
  mediaUrl?: string | null;
  mediaType?: PostMediaType | null;
  caption: string;
  rideActivityId?: string;
  rideStats?: RidePostStats;
  routePreview?: RoutePostPreview;
};

export async function createPost(input: CreatePostInput): Promise<void> {
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) throw new Error('Войди в аккаунт, чтобы опубликовать пост.');

  const mediaUrl = input.mediaUrl || null;
  const payload = {
    user_id: authData.user.id,
    caption: input.caption.trim(),
    ride_activity_id: input.rideActivityId ?? null,
    strava_distance_km: input.rideStats?.distanceKm ?? null,
    strava_elevation_gain_m: input.rideStats?.elevationGainM ?? null,
    strava_duration_seconds: input.rideStats?.durationSeconds ?? null,
    strava_summary_polyline: input.rideStats?.summaryPolyline ?? null,
    ride_track: input.rideStats?.track ?? null,
    route_id: input.routePreview?.routeId ?? null,
    route_title: input.routePreview?.title ?? null,
    route_description: input.routePreview?.description ?? null,
    route_path: input.routePreview?.path ?? null,
    route_distance_km: input.routePreview?.distanceKm ?? null,
    route_elevation_gain_m: input.routePreview?.elevationGainM ?? null,
    route_difficulty: input.routePreview?.difficulty ?? null,
  };
  let { error } = await supabase.from('posts').insert({ ...payload, media_url: mediaUrl, media_type: mediaUrl ? input.mediaType ?? null : null });
  if (error?.code === '23502' && !mediaUrl) {
    ({ error } = await supabase.from('posts').insert({ ...payload, media_url: '', media_type: 'image' }));
  }
  if (error) throw error;
}

export async function uploadPostMedia(file: File): Promise<{ url: string; type: PostMediaType }> {
  const type: PostMediaType | null = file.type.startsWith('image/') ? 'image' : file.type.startsWith('video/') ? 'video' : null;
  if (!type) throw new Error('Поддерживаются только изображения и видео.');
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) throw new Error('Войди в аккаунт, чтобы загрузить файл.');

  const extension = file.name.includes('.') ? `.${file.name.split('.').pop()?.toLowerCase()}` : '';
  const path = `${authData.user.id}/${crypto.randomUUID()}${extension}`;
  const { error } = await supabase.storage.from('post-media').upload(path, file, { upsert: false });
  if (error) throw error;
  const { data } = supabase.storage.from('post-media').getPublicUrl(path);
  return { url: data.publicUrl, type };
}

export async function togglePostLike(postId: string, isLiked: boolean): Promise<void> {
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) throw new Error('Войди в аккаунт, чтобы поставить лайк.');
  if (isLiked) {
    const { error } = await supabase.from('post_likes').delete().eq('post_id', postId).eq('user_id', authData.user.id);
    if (error) throw error;
    return;
  }
  const { error } = await supabase.from('post_likes').insert({ post_id: postId, user_id: authData.user.id });
  if (error) throw error;
}

export async function addPostComment(postId: string, comment: string): Promise<void> {
  const trimmed = comment.trim();
  if (!trimmed) return;
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) throw new Error('Войди в аккаунт, чтобы оставить комментарий.');
  const { error } = await supabase.from('post_comments').insert({ post_id: postId, user_id: authData.user.id, comment: trimmed });
  if (error) throw error;
}

export async function deletePost(postId: string): Promise<void> {
  const { error } = await supabase.from('posts').delete().eq('id', postId);
  if (error) throw error;
}
