import type { PublicProfile } from '../lib/cyclingModels';

type AvatarProps = {
  profile: Pick<PublicProfile, 'full_name' | 'username' | 'avatar_url'>;
  className?: string;
};

export function Avatar({ profile, className = '' }: AvatarProps) {
  const label = profile.full_name?.trim() || profile.username;
  const initial = label.slice(0, 1).toUpperCase();
  if (profile.avatar_url) return <img className={`avatar-image ${className}`} src={profile.avatar_url} alt={`Аватар ${label}`} />;
  return <span className={`avatar-fallback ${className}`} aria-label={`Аватар ${label}`}>{initial}</span>;
}
