import type { PublicProfile } from './cyclingModels';
import { loadPublicProfiles } from './rider';
import { supabase } from './supabase';

export const marketplaceCategories = ['bike', 'frame', 'wheels', 'components', 'accessories'] as const;
export const marketplaceConditions = ['new', 'like_new', 'used', 'for_parts'] as const;

export type MarketplaceCategory = typeof marketplaceCategories[number];
export type MarketplaceCondition = typeof marketplaceConditions[number];
export type MarketplaceStatus = 'active' | 'sold';

export const marketplaceCategoryLabels: Record<MarketplaceCategory, string> = {
  bike: 'Велосипеды',
  frame: 'Рамы',
  wheels: 'Колёса',
  components: 'Комплектующие',
  accessories: 'Аксессуары',
};

export const marketplaceConditionLabels: Record<MarketplaceCondition, string> = {
  new: 'Новое',
  like_new: 'Как новое',
  used: 'Б/у',
  for_parts: 'На запчасти',
};

type MarketplaceListingRow = {
  id: string;
  seller_id: string;
  title: string;
  description: string;
  price: number | string;
  category: MarketplaceCategory;
  condition: MarketplaceCondition;
  photos: string[];
  city: string | null;
  status: MarketplaceStatus;
  is_negotiable: boolean;
  created_at: string;
};

export type MarketplaceListing = Omit<MarketplaceListingRow, 'seller_id'> & {
  sellerId: string;
  seller: PublicProfile | null;
};

export type MarketplaceListingInput = {
  title: string;
  description: string;
  price: number;
  category: MarketplaceCategory;
  condition: MarketplaceCondition;
  photos: string[];
  city: string;
  isNegotiable: boolean;
};

const listingColumns = 'id, seller_id, title, description, price, category, condition, photos, city, status, is_negotiable, created_at';

function mapListing(row: MarketplaceListingRow, profiles: Map<string, PublicProfile>): MarketplaceListing {
  const { seller_id: sellerId, ...listing } = row;
  return { ...listing, sellerId, seller: profiles.get(sellerId) ?? null };
}

async function attachSellers(rows: MarketplaceListingRow[]): Promise<MarketplaceListing[]> {
  const profiles = await loadPublicProfiles([...new Set(rows.map((row) => row.seller_id))]);
  const profilesById = new Map(profiles.map((profile) => [profile.id, profile]));
  return rows.map((row) => mapListing(row, profilesById));
}

export async function loadMarketplaceListings(): Promise<MarketplaceListing[]> {
  const { data, error } = await supabase
    .from('marketplace_listings')
    .select(listingColumns)
    .eq('status', 'active')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return attachSellers((data ?? []) as MarketplaceListingRow[]);
}

export async function loadMarketplaceListing(listingId: string): Promise<MarketplaceListing | null> {
  const { data, error } = await supabase
    .from('marketplace_listings')
    .select(listingColumns)
    .eq('id', listingId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const [listing] = await attachSellers([data as MarketplaceListingRow]);
  return listing ?? null;
}

export async function createMarketplaceListing(input: MarketplaceListingInput): Promise<string> {
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) throw new Error('Войди в аккаунт, чтобы разместить объявление.');
  const { data, error } = await supabase.from('marketplace_listings').insert({
    seller_id: authData.user.id,
    title: input.title.trim(),
    description: input.description.trim(),
    price: input.price,
    category: input.category,
    condition: input.condition,
    photos: input.photos,
    city: input.city.trim(),
    is_negotiable: input.isNegotiable,
  }).select('id').single();
  if (error) throw error;
  return (data as { id: string }).id;
}

export async function uploadMarketplacePhoto(file: File): Promise<string> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('Подойдут изображения JPG, PNG или WebP.');
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) throw new Error('Войди в аккаунт, чтобы загрузить фото.');

  const extension = file.name.includes('.') ? `.${file.name.split('.').pop()?.toLowerCase()}` : '';
  const path = `${authData.user.id}/${crypto.randomUUID()}${extension}`;
  const { error } = await supabase.storage.from('marketplace-media').upload(path, file, { upsert: false });
  if (error) throw error;
  const { data } = supabase.storage.from('marketplace-media').getPublicUrl(path);
  return data.publicUrl;
}

export async function markMarketplaceListingAsSold(listingId: string): Promise<void> {
  const { error } = await supabase.from('marketplace_listings').update({ status: 'sold' }).eq('id', listingId);
  if (error) throw error;
}
