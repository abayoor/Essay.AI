import { useEffect, useState } from 'react';
import { useSession } from '../lib/auth';
import {
  locationSharingChangedEvent,
  locationSharingEnabled,
  publishLiveLocation,
} from '../lib/friends';

export function FriendLocationPublisher() {
  const { session } = useSession();
  const [enabled, setEnabled] = useState(locationSharingEnabled);

  useEffect(() => {
    const update = () => setEnabled(locationSharingEnabled());
    window.addEventListener(locationSharingChangedEvent, update);
    window.addEventListener('storage', update);
    return () => {
      window.removeEventListener(locationSharingChangedEvent, update);
      window.removeEventListener('storage', update);
    };
  }, []);

  useEffect(() => {
    if (!session || !enabled || !navigator.geolocation) return undefined;
    let lastPublishedAt = 0;
    const watchId = navigator.geolocation.watchPosition((position) => {
      const now = Date.now();
      if (now - lastPublishedAt < 12_000) return;
      lastPublishedAt = now;
      void publishLiveLocation(position).catch(() => undefined);
    }, () => undefined, {
      enableHighAccuracy: true,
      maximumAge: 5_000,
      timeout: 30_000,
    });
    return () => navigator.geolocation.clearWatch(watchId);
  }, [enabled, session?.user.id]);

  return null;
}
