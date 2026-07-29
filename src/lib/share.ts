export type RideShareData = {
  title: string;
  distanceKm: number;
  elevationGainM: number;
  durationSeconds: number;
};

function durationLabel(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  return hours ? `${hours} ч ${minutes} мин` : `${minutes} мин`;
}

export function rideShareText(ride: RideShareData): string {
  return `${ride.title}: ${ride.distanceKm.toFixed(1)} км · +${Math.round(ride.elevationGainM)} м · ${durationLabel(ride.durationSeconds)}. Записано в Slipstream.`;
}

export function shareUrl(platform: 'whatsapp' | 'telegram', ride: RideShareData): string {
  const text = encodeURIComponent(rideShareText(ride));
  const siteUrl = encodeURIComponent(window.location.origin);
  return platform === 'whatsapp'
    ? `https://wa.me/?text=${encodeURIComponent(`${rideShareText(ride)} ${window.location.origin}`)}`
    : `https://t.me/share/url?url=${siteUrl}&text=${text}`;
}

export async function shareRide(ride: RideShareData): Promise<'shared' | 'copied' | 'unavailable'> {
  const text = rideShareText(ride);
  if (navigator.share) {
    await navigator.share({ title: ride.title, text, url: window.location.origin });
    return 'shared';
  }
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(`${text} ${window.location.origin}`);
    return 'copied';
  }
  return 'unavailable';
}
