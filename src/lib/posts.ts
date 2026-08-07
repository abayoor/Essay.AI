import type { Difficulty, PostComment, PostMediaType, PublicProfile, RidePostStats, RoutePoint, RoutePostPreview, SocialPost } from './cyclingModels';
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

function isRoutePoint(value: unknown): value is RoutePoint {
  if (typeof value !== 'object' || value === null) return false;
  const point = value as Record<string, unknown>;
  return typeof point.lat === 'number'
    && typeof point.lng === 'number'
    && Number.isFinite(point.lat)
    && Number.isFinite(point.lng)
    && point.lat >= -90
    && point.lat <= 90
    && point.lng >= -180
    && point.lng <= 180;
}

function createRideStats(post: PostRow): RidePostStats | null {
  if (post.strava_distance_km === null || post.strava_elevation_gain_m === null || post.strava_duration_seconds === null) return null;
  return {
    distanceKm: numberOrZero(post.strava_distance_km),
    elevationGainM: numberOrZero(post.strava_elevation_gain_m),
    durationSeconds: post.strava_duration_seconds,
    summaryPolyline: post.strava_summary_polyline,
    track: Array.isArray(post.ride_track) ? post.ride_track.filter(isRoutePoint) : null,
  };
}

const rideCopyPrefix = 'slipstream:ride:v1:';

type RideCopy = {
  title: string | null;
  description: string | null;
};

function decodeRideCopy(caption: string, hasRide: boolean): RideCopy {
  if (!hasRide || !caption) return { title: null, description: null };
  if (caption.startsWith(rideCopyPrefix)) {
    try {
      const value: unknown = JSON.parse(caption.slice(rideCopyPrefix.length));
      if (typeof value === 'object' && value !== null) {
        const record = value as Record<string, unknown>;
        return {
          title: typeof record.title === 'string' && record.title.trim() ? record.title.trim() : null,
          description: typeof record.description === 'string' && record.description.trim() ? record.description.trim() : null,
        };
      }
    } catch {
      return { title: null, description: caption };
    }
  }
  const [firstLine, ...remainingLines] = caption.split(/\r?\n/);
  const remainingCopy = remainingLines.join('\n').trim();
  if (remainingCopy) return { title: firstLine.trim() || null, description: remainingCopy };
  return caption.length <= 120
    ? { title: caption.trim() || null, description: null }
    : { title: null, description: caption.trim() };
}

function encodeRideCopy(title: string | null | undefined, description: string | null | undefined): string {
  const normalizedTitle = title?.trim() || null;
  const normalizedDescription = description?.trim() || null;
  if (!normalizedTitle && !normalizedDescription) return '';
  return `${rideCopyPrefix}${JSON.stringify({ title: normalizedTitle, description: normalizedDescription })}`;
}

function isDifficulty(value: string | null): value is Difficulty {
  return value === 'easy' || value === 'moderate' || value === 'hard';
}

function routePoints(value: unknown): { lat: number; lng: number }[] {
  return Array.isArray(value) ? value.filter(isRoutePoint) : [];
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

export type LoadPostsOptions = {
  before?: string;
  limit?: number;
  postId?: string;
  authorIds?: string[];
  preferredHomeCity?: string | null;
};

function locationRecommendationScore(authorCity: string | null, viewerCity: string | null | undefined): number {
  const authorParts = authorCity?.split(',').map((part) => part.trim().toLocaleLowerCase()).filter(Boolean) ?? [];
  const viewerParts = viewerCity?.split(',').map((part) => part.trim().toLocaleLowerCase()).filter(Boolean) ?? [];
  if (!authorParts.length || !viewerParts.length) return 0;
  if (authorParts.join('|') === viewerParts.join('|')) return 3;
  if (authorParts[0] === viewerParts[0]) return 2;
  return authorParts[authorParts.length - 1] === viewerParts[viewerParts.length - 1] ? 1 : 0;
}

export async function loadPosts(userId?: string, options: LoadPostsOptions = {}): Promise<SocialPost[]> {
  if (options.authorIds && options.authorIds.length === 0) return [];
  const limit = Math.min(Math.max(options.limit ?? 30, 1), 50);
  let query = supabase
    .from('posts')
    .select('id, user_id, media_url, media_type, caption, created_at, strava_distance_km, strava_elevation_gain_m, strava_duration_seconds, strava_summary_polyline, ride_track, route_id, route_title, route_description, route_path, route_distance_km, route_elevation_gain_m, route_difficulty')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (userId) query = query.eq('user_id', userId);
  if (options.authorIds) query = query.in('user_id', options.authorIds);
  if (options.before) query = query.lt('created_at', options.before);
  if (options.postId) query = query.eq('id', options.postId);
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

  const likesByPost = new Map<string, LikeRow[]>();
  for (const like of likes) {
    const group = likesByPost.get(like.post_id) ?? [];
    group.push(like);
    likesByPost.set(like.post_id, group);
  }
  const commentsByPost = new Map<string, CommentRow[]>();
  for (const comment of comments) {
    const group = commentsByPost.get(comment.post_id) ?? [];
    group.push(comment);
    commentsByPost.set(comment.post_id, group);
  }

  const result = posts.map((post): SocialPost => {
    const rideStats = createRideStats(post);
    const rideCopy = decodeRideCopy(post.caption, Boolean(rideStats));
    return {
      id: post.id,
      user_id: post.user_id,
      media_url: post.media_url,
      media_type: post.media_type,
      caption: rideStats ? '' : post.caption,
      rideTitle: rideCopy.title,
      rideDescription: rideCopy.description,
      created_at: post.created_at,
      author: profilesById.get(post.user_id) ?? { ...unknownProfile, id: post.user_id },
      likes: (likesByPost.get(post.id) ?? []).map((like) => ({ id: like.id, user_id: like.user_id })),
      comments: (commentsByPost.get(post.id) ?? [])
        .map((comment): PostComment => ({
          ...comment,
          author: profilesById.get(comment.user_id) ?? { ...unknownProfile, id: comment.user_id },
        })),
      rideStats,
      routePreview: createRoutePreview(post),
    };
  });
  return options.preferredHomeCity ? result.sort((first, second) => {
    const scoreDifference = locationRecommendationScore(second.author.home_city, options.preferredHomeCity)
      - locationRecommendationScore(first.author.home_city, options.preferredHomeCity);
    return scoreDifference || second.created_at.localeCompare(first.created_at);
  }) : result;
}

export async function loadPost(postId: string): Promise<SocialPost | null> {
  const [post] = await loadPosts(undefined, { postId, limit: 1 });
  return post ?? null;
}

export type CreatePostInput = {
  mediaUrl?: string | null;
  mediaType?: PostMediaType | null;
  caption: string;
  rideTitle?: string | null;
  rideDescription?: string | null;
  rideActivityId?: string;
  rideStats?: RidePostStats;
  routePreview?: RoutePostPreview;
};

function decodeSummaryPolyline(value: string): RoutePoint[] {
  const points: RoutePoint[] = [];
  let index = 0;
  let latitude = 0;
  let longitude = 0;

  function decodeComponent(): number | null {
    let result = 0;
    let shift = 0;
    while (index < value.length) {
      const code = value.charCodeAt(index);
      index += 1;
      if (code < 63 || code > 126) return null;
      const byte = code - 63;
      result += (byte & 0x1f) * 2 ** shift;
      if (!Number.isSafeInteger(result)) return null;
      if (byte < 0x20) return result % 2 === 1 ? -(result + 1) / 2 : result / 2;
      shift += 5;
      if (shift > 50) return null;
    }
    return null;
  }

  while (index < value.length) {
    const latitudeDelta = decodeComponent();
    const longitudeDelta = decodeComponent();
    if (latitudeDelta === null || longitudeDelta === null) return [];
    latitude += latitudeDelta;
    longitude += longitudeDelta;
    if (!Number.isSafeInteger(latitude) || !Number.isSafeInteger(longitude)) return [];
    const point = { lat: latitude / 1e5, lng: longitude / 1e5 };
    if (!isRoutePoint(point)) return [];
    points.push(point);
    if (points.length > 20_000) return [];
  }
  return points;
}

function normalizeTrack(track: RoutePoint[] | null): RoutePoint[] {
  if (!track?.length || track.length > 20_000 || track.some((point) => !isRoutePoint(point))) return [];
  return track.map((point) => ({ lat: point.lat, lng: point.lng }));
}

function sourceRideTrack(stats: RidePostStats | undefined): RoutePoint[] | null {
  if (!stats) return null;
  const recordedTrack = normalizeTrack(stats.track);
  const source = recordedTrack.length >= 2
    ? recordedTrack
    : (stats.summaryPolyline ? decodeSummaryPolyline(stats.summaryPolyline) : []);
  return source.length >= 2 && source.length <= 20_000 ? source : null;
}

export async function createPost(input: CreatePostInput): Promise<string> {
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) throw new Error('Войди в аккаунт, чтобы опубликовать пост.');

  const mediaUrl = input.mediaUrl || null;
  const durationSeconds = input.rideStats
    ? Math.max(1, Math.round(input.rideStats.durationSeconds))
    : null;
  const hasExplicitRideCopy = input.rideTitle !== undefined || input.rideDescription !== undefined;
  const caption = input.rideStats && hasExplicitRideCopy
    ? encodeRideCopy(input.rideTitle, input.rideDescription)
    : input.caption.trim();
  const { data, error } = await supabase.rpc('create_public_post', {
    p_caption: caption,
    p_media_url: mediaUrl,
    p_media_type: mediaUrl ? input.mediaType ?? null : null,
    p_ride_activity_id: input.rideActivityId ?? null,
    p_distance_km: input.rideStats?.distanceKm ?? null,
    p_elevation_gain_m: input.rideStats?.elevationGainM ?? null,
    p_duration_seconds: durationSeconds,
    p_ride_track: sourceRideTrack(input.rideStats),
    p_route_id: input.routePreview?.routeId ?? null,
    p_route_title: input.routePreview?.title ?? null,
    p_route_description: input.routePreview?.description ?? null,
    p_route_path: input.routePreview?.path ?? null,
    p_route_distance_km: input.routePreview?.distanceKm ?? null,
    p_route_elevation_gain_m: input.routePreview?.elevationGainM ?? null,
    p_route_difficulty: input.routePreview?.difficulty ?? null,
  });
  if (error) throw error;
  if (typeof data !== 'string' || !data.trim()) {
    throw new Error('Сервер не подтвердил создание публикации. Попробуй ещё раз.');
  }
  return data;
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
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) throw new Error('Войди в аккаунт, чтобы удалить публикацию.');

  const { data, error } = await supabase
    .from('posts')
    .delete()
    .eq('id', postId)
    .eq('user_id', authData.user.id)
    .select('id')
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('Публикация не найдена или принадлежит другому райдеру.');
}
