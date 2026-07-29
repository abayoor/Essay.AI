import { supabase } from './supabase';

export type MarketplaceListing = { id: string; title: string; price: number };

export async function loadMyMarketplaceListings(): Promise<MarketplaceListing[]> {
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) return [];
  const { data, error } = await supabase
    .from('marketplace_listings')
    .select('id, title, price')
    .eq('seller_id', authData.user.id)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as MarketplaceListing[];
}

export async function deleteMarketplaceListing(listingId: string): Promise<void> {
  const { error } = await supabase.from('marketplace_listings').delete().eq('id', listingId);
  if (error) throw error;
}

export async function deleteMyAccount(): Promise<void> {
  const { error } = await supabase.rpc('delete_my_account');
  if (error) throw error;
}
