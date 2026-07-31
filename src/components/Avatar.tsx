import { UserRound } from 'lucide-react';
import type { PublicProfile } from '../lib/cyclingModels';
import { useLocaleText } from '../lib/localized';

type AvatarProps = {
  profile: Pick<PublicProfile, 'full_name' | 'username' | 'avatar_url'>;
  className?: string;
};

export function Avatar({ profile, className = '' }: AvatarProps) {
  const text = useLocaleText();
  const label = profile.full_name?.trim() || profile.username;
  const avatarLabel = `${text('Аватар', 'Аватар', 'Avatar')} ${label}`;
  if (profile.avatar_url) return <img className={`avatar-image ${className}`} src={profile.avatar_url} alt={avatarLabel} />;
  return <span className={`avatar-fallback ${className}`} aria-label={avatarLabel}><UserRound aria-hidden="true" strokeWidth={1.8} /></span>;
}
