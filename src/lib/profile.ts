import type { Locale } from './models';
import { supabase } from './supabase';

export type Profile = {
  full_name: string | null;
  locale: Locale;
  target_schools: string[];
  application_type: string | null;
};

export async function loadProfile(): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('users')
    .select('full_name, locale, target_schools, application_type')
    .maybeSingle();

  if (error) throw error;
  return data as Profile | null;
}

export async function saveProfile(profile: Profile): Promise<void> {
  const { error } = await supabase.from('users').update(profile).eq('id', (await supabase.auth.getUser()).data.user?.id ?? '');
  if (error) throw error;
}
