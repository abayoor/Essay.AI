import { Capacitor } from '@capacitor/core';
import { BackgroundGeolocation, type CallbackError, type Location } from '@capgo/background-geolocation';
import type { GpsTrackPoint } from './cyclingModels';

type BackgroundLocationHandlers = {
  onLocation: (point: GpsTrackPoint) => void;
  onError: (message: string) => void;
};

function toGpsTrackPoint(location: Location): GpsTrackPoint {
  return {
    lat: location.latitude,
    lng: location.longitude,
    elevation: location.altitude,
    timestamp: location.time ?? Date.now(),
    accuracyMeters: location.accuracy,
    altitudeAccuracyMeters: location.altitudeAccuracy,
    speedMps: location.speed,
  };
}

function errorMessage(error: CallbackError): string {
  if (error.code === 'NOT_AUTHORIZED') return 'Разреши геолокацию «Всегда», чтобы запись продолжалась при заблокированном экране.';
  return 'Не удалось получать GPS в фоновом режиме. Проверь разрешение геолокации в настройках телефона.';
}

export function supportsBackgroundRecording(): boolean {
  return Capacitor.isNativePlatform();
}

export async function startBackgroundRecording({ onLocation, onError }: BackgroundLocationHandlers): Promise<boolean> {
  if (!supportsBackgroundRecording()) return false;
  await BackgroundGeolocation.start({
    backgroundTitle: 'Slipstream записывает заезд',
    backgroundMessage: 'GPS-запись продолжается. Нажми, чтобы вернуться к тренировке.',
    requestPermissions: true,
    stale: false,
    distanceFilter: 3,
  }, (location, error) => {
    if (error) {
      onError(errorMessage(error));
      return;
    }
    if (location) onLocation(toGpsTrackPoint(location));
  });
  return true;
}

export async function stopBackgroundRecording(): Promise<void> {
  if (!supportsBackgroundRecording()) return;
  await BackgroundGeolocation.stop();
}
