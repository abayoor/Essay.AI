export const locationPermissionGrantedEvent = 'slipstream:location-permission-granted';
export const locationPermissionRequestEvent = 'slipstream:location-permission-request';

const permissionStoragePrefix = 'slipstream-location-permission';

export type LocationPermissionResult =
  | { status: 'granted'; position: GeolocationPosition }
  | { status: 'denied' | 'unavailable' | 'timeout' };

function permissionStorageKey(userId: string): string {
  return `${permissionStoragePrefix}:${userId}`;
}

export function hasVerifiedLocationPermission(userId: string): boolean {
  return window.localStorage.getItem(permissionStorageKey(userId)) === 'granted';
}

export function rememberLocationPermission(userId: string): void {
  window.localStorage.setItem(permissionStorageKey(userId), 'granted');
}

export function forgetLocationPermission(userId: string): void {
  window.localStorage.removeItem(permissionStorageKey(userId));
}

export function requestLocationPermissionPrompt(): void {
  window.dispatchEvent(new CustomEvent(locationPermissionRequestEvent));
}

export function requestCurrentLocation(): Promise<LocationPermissionResult> {
  if (!window.isSecureContext || !navigator.geolocation) {
    return Promise.resolve({ status: 'unavailable' });
  }

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) => resolve({ status: 'granted', position }),
      (error) => {
        if (error.code === error.PERMISSION_DENIED) {
          resolve({ status: 'denied' });
          return;
        }
        resolve({ status: error.code === error.TIMEOUT ? 'timeout' : 'unavailable' });
      },
      { enableHighAccuracy: true, maximumAge: 5_000, timeout: 20_000 },
    );
  });
}
