export type BikeType = 'road' | 'mountain' | 'gravel' | 'city';
export type Difficulty = 'easy' | 'moderate' | 'hard';

export type RoutePoint = { lat: number; lng: number };

export type RiderProfile = {
  full_name: string | null;
  avatar_url: string | null;
  home_city: string | null;
  bio: string | null;
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
};
