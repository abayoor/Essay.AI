import { UserRound } from 'lucide-react';
import type { PublicProfile } from '../lib/cyclingModels';

type AvatarProps = {
  profile: Pick<PublicProfile, 'full_name' | 'username' | 'avatar_url'>;
  className?: string;
};

export function Avatar({ profile, className = '' }: AvatarProps) {
  const label = profile.full_name?.trim() || profile.username;
  if (profile.avatar_url) return <img className={`avatar-image ${className}`} src={profile.avatar_url} alt={`Аватар ${label}`} />;
  return <span className={`avatar-fallback ${className}`} aria-label={`Аватар ${label}`}><UserRound aria-hidden="true" strokeWidth={1.8} /></span>;
}
