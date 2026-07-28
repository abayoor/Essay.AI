import type { Bike, BikeType } from './cyclingModels';
import { supabase } from './supabase';

type NewBike = { name: string; brand: string; bikeType: BikeType; purchaseDate: string };
type RideLog = { bikeId: string; distanceKm: number; elevationM: number; durationMinutes: number; rideDate: string };

const defaultMaintenance = [
  { component: 'chain', interval_km: 3000 },
  { component: 'tires', interval_km: 5000 },
  { component: 'brake_pads', interval_km: 2000 },
] as const;

export async function loadBikes(): Promise<Bike[]> {
  const { data, error } = await supabase
    .from('bikes')
    .select('id, name, brand, bike_type, purchase_date, total_distance_km, maintenance_intervals(id, component, interval_km, last_service_km, last_service_date)')
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as Bike[];
}

export async function addBike(input: NewBike): Promise<void> {
  const { data, error } = await supabase
    .from('bikes')
    .insert({ name: input.name.trim(), brand: input.brand.trim() || null, bike_type: input.bikeType, purchase_date: input.purchaseDate || null })
    .select('id')
    .single();
  if (error) throw error;
  const bike = data as { id: string };
  const { error: maintenanceError } = await supabase.from('maintenance_intervals').insert(
    defaultMaintenance.map((item) => ({ bike_id: bike.id, ...item })),
  );
  if (maintenanceError) throw maintenanceError;
}

export async function logRide(input: RideLog): Promise<void> {
  const { error } = await supabase.from('ride_activities').insert({
    bike_id: input.bikeId,
    distance_km: input.distanceKm,
    elevation_gain_m: input.elevationM || 0,
    duration_seconds: input.durationMinutes ? Math.round(input.durationMinutes * 60) : null,
    ride_date: input.rideDate,
  });
  if (error) throw error;
}
