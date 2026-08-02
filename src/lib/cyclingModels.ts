export type BikeType = 'road' | 'mountain' | 'gravel' | 'city';
export type Difficulty = 'easy' | 'moderate' | 'hard';

export type RoutePoint = { lat: number; lng: number };

export type GpsTrackPoint = RoutePoint & {
  elevation: number | null;
  timestamp: number;
  accuracyMeters?: number;
  altitudeAccuracyMeters?: number | null;
  speedMps?: number | null;
  segmentStart?: boolean;
};

export type RideRecordingMetrics = {
  distanceKm: number;
  currentSpeedKmh: number;
  averageSpeedKmh: number;
  maxSpeedKmh: number;
  movingTimeSeconds: number;
  elapsedTimeSeconds: number;
  elevationGainM: number;
  paceMinPerKm: number | null;
};

export type RideActivity = {
  id: string;
  title: string | null;
  description: string | null;
  distanceKm: number;
  durationSeconds: number;
  movingTimeSeconds: number | null;
  elevationGainM: number;
  averageSpeedKmh: number | null;
  maxSpeedKmh: number | null;
  paceMinPerKm: number | null;
  rideDate: string;
  createdAt: string;
  gpsTrack: GpsTrackPoint[];
};

export type RiderProfile = {
  full_name: string | null;
  avatar_url: string | null;
  home_city: string | null;
  bio: string | null;
  username: string;
  interests: string[];
  locale: Locale;
  theme_preference: ThemePreference;
};

export type Locale = 'ru' | 'kz' | 'en';
export type ThemePreference = 'light' | 'dark';

export type PublicProfile = Pick<RiderProfile, 'username' | 'full_name' | 'avatar_url' | 'home_city' | 'bio' | 'interests'> & {
  id: string;
};

export type RiderStats = {
  distanceKm: number;
  ridesCount: number;
  elevationM: number;
  longestRideKm: number;
};

export type MaintenanceItem = {
  id: string;
  component: 'chain' | 'tires' | 'brake_pads' | 'cassette';
  interval_km: number;
  last_service_km: number;
  last_service_date: string | null;
};

export type Bike = {
  id: string;
  name: string;
  brand: string | null;
  bike_type: BikeType;
  purchase_date: string | null;
  total_distance_km: number;
  maintenance_intervals: MaintenanceItem[];
};

export type CycleRoute = {
  id: string;
  title: string;
  description: string | null;
  path: RoutePoint[];
  distance_km: number;
  elevation_gain_m: number;
  difficulty: Difficulty;
  region: string | null;
  created_at: string;
  route_kind?: 'curated' | 'community';
  duration_minutes?: number | null;
  surface?: string | null;
  start_name?: string | null;
  end_name?: string | null;
  source_name?: string | null;
  source_url?: string | null;
  popularity_score?: number;
};

export type PostMediaType = 'image' | 'video';

export type RidePostStats = {
  distanceKm: number;
  elevationGainM: number;
  durationSeconds: number;
  summaryPolyline: string | null;
  track: RoutePoint[] | null;
};

export type RoutePostPreview = {
  routeId: string | null;
  title: string;
  description: string | null;
  path: RoutePoint[];
  distanceKm: number;
  elevationGainM: number;
  difficulty: Difficulty;
};

export type SocialPost = {
  id: string;
  user_id: string;
  media_url: string | null;
  media_type: PostMediaType | null;
  caption: string;
  created_at: string;
  author: PublicProfile;
  likes: { id: string; user_id: string }[];
  comments: PostComment[];
  rideStats: RidePostStats | null;
  routePreview: RoutePostPreview | null;
};

export type PostComment = {
  id: string;
  post_id: string;
  user_id: string;
  comment: string;
  created_at: string;
  author: PublicProfile;
};

export type ConversationSummary = {
  id: string;
  participant: PublicProfile;
  lastMessage: DirectMessage | null;
};

export type DirectMessage = {
  id: string;
  conversation_id: string;
  sender_id: string;
  content_type: 'text' | 'image' | 'file' | 'video' | 'shared_post';
  text_content: string | null;
  file_url: string | null;
  shared_post_id: string | null;
  created_at: string;
};
