import type { GpsTrackPoint, RideRecordingMetrics } from './cyclingModels';

const earthRadiusKm = 6371;
const autoPauseSpeedKmh = 1.8;
const autoPauseAfterSeconds = 8;
const maximumPlausibleSpeedKmh = 85;
const maximumTrackAccuracyMeters = 45;
const elevationDeadbandMeters = 3;

export const emptyRecordingMetrics: RideRecordingMetrics = {
  distanceKm: 0,
  currentSpeedKmh: 0,
  averageSpeedKmh: 0,
  maxSpeedKmh: 0,
  movingTimeSeconds: 0,
  elapsedTimeSeconds: 0,
  elevationGainM: 0,
  paceMinPerKm: null,
};

export function distanceBetweenKm(first: Pick<GpsTrackPoint, 'lat' | 'lng'>, second: Pick<GpsTrackPoint, 'lat' | 'lng'>): number {
  const latitudeDelta = (second.lat - first.lat) * Math.PI / 180;
  const longitudeDelta = (second.lng - first.lng) * Math.PI / 180;
  const a = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(first.lat * Math.PI / 180) * Math.cos(second.lat * Math.PI / 180) * Math.sin(longitudeDelta / 2) ** 2;
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function calculateRecordingMetrics(track: GpsTrackPoint[], elapsedTimeSeconds: number): RideRecordingMetrics {
  if (track.length < 2) return { ...emptyRecordingMetrics, elapsedTimeSeconds };
  let distanceKm = 0;
  let movingTimeSeconds = 0;
  let maxSpeedKmh = 0;
  let currentSpeedKmh = 0;
  let elevationGainM = 0;
  let stationaryRunSeconds = 0;
  let elevationBaseline: number | null = null;

  track.slice(1).forEach((point, index) => {
    const previous = track[index];
    const intervalSeconds = Math.max(0, (point.timestamp - previous.timestamp) / 1000);
    if (!intervalSeconds || intervalSeconds > 90) return;
    if ((point.accuracyMeters ?? 0) > maximumTrackAccuracyMeters || (previous.accuracyMeters ?? 0) > maximumTrackAccuracyMeters) return;
    const segmentDistanceKm = distanceBetweenKm(previous, point);
    const calculatedSpeedKmh = segmentDistanceKm / intervalSeconds * 3600;
    const speedKmh = point.speedMps !== null && point.speedMps !== undefined && point.speedMps >= 0
      ? point.speedMps * 3.6
      : calculatedSpeedKmh;
    if (speedKmh > maximumPlausibleSpeedKmh) return;

    const accuracyFloorKm = Math.max(0.0025, Math.min(0.012, Math.max(point.accuracyMeters ?? 0, previous.accuracyMeters ?? 0) / 3500));
    const isGpsJitter = segmentDistanceKm < accuracyFloorKm && speedKmh < autoPauseSpeedKmh;
    if (!isGpsJitter) distanceKm += segmentDistanceKm;
    currentSpeedKmh = speedKmh;
    maxSpeedKmh = Math.max(maxSpeedKmh, speedKmh);
    const isMoving = speedKmh >= autoPauseSpeedKmh;
    if (isMoving) {
      movingTimeSeconds += intervalSeconds;
      stationaryRunSeconds = 0;
    } else {
      const previousStationaryRunSeconds = stationaryRunSeconds;
      stationaryRunSeconds += intervalSeconds;
      if (stationaryRunSeconds <= autoPauseAfterSeconds) {
        movingTimeSeconds += intervalSeconds;
      } else if (previousStationaryRunSeconds <= autoPauseAfterSeconds) {
        movingTimeSeconds = Math.max(0, movingTimeSeconds - previousStationaryRunSeconds);
      }
    }

    const altitudeIsAccurate = (point.altitudeAccuracyMeters ?? 0) <= 20 && (previous.altitudeAccuracyMeters ?? 0) <= 20;
    if (point.elevation !== null && altitudeIsAccurate) {
      if (elevationBaseline === null) {
        elevationBaseline = previous.elevation ?? point.elevation;
      }
      const elevationDelta = point.elevation - elevationBaseline;
      if (elevationDelta >= elevationDeadbandMeters) {
        elevationGainM += elevationDelta;
        elevationBaseline = point.elevation;
      } else if (elevationDelta <= -elevationDeadbandMeters) {
        elevationBaseline = point.elevation;
      }
    }
  });

  const averageSpeedKmh = movingTimeSeconds > 0 ? distanceKm / movingTimeSeconds * 3600 : 0;
  return {
    distanceKm,
    currentSpeedKmh,
    averageSpeedKmh,
    maxSpeedKmh,
    movingTimeSeconds,
    elapsedTimeSeconds,
    elevationGainM,
    paceMinPerKm: distanceKm > 0 ? movingTimeSeconds / 60 / distanceKm : null,
  };
}

function perpendicularDistanceMeters(point: GpsTrackPoint, first: GpsTrackPoint, last: GpsTrackPoint): number {
  const latitudeScale = 111320;
  const longitudeScale = latitudeScale * Math.cos(((first.lat + last.lat) / 2) * Math.PI / 180);
  const pointX = point.lng * longitudeScale;
  const pointY = point.lat * latitudeScale;
  const firstX = first.lng * longitudeScale;
  const firstY = first.lat * latitudeScale;
  const lastX = last.lng * longitudeScale;
  const lastY = last.lat * latitudeScale;
  const lengthSquared = (lastX - firstX) ** 2 + (lastY - firstY) ** 2;
  if (!lengthSquared) return Math.hypot(pointX - firstX, pointY - firstY);
  const ratio = Math.max(0, Math.min(1, ((pointX - firstX) * (lastX - firstX) + (pointY - firstY) * (lastY - firstY)) / lengthSquared));
  return Math.hypot(pointX - (firstX + ratio * (lastX - firstX)), pointY - (firstY + ratio * (lastY - firstY)));
}

export function simplifyGpsTrack(track: GpsTrackPoint[], toleranceMeters = 4): GpsTrackPoint[] {
  if (track.length < 3) return track;
  let greatestDistance = 0;
  let greatestIndex = 0;
  const first = track[0];
  const last = track[track.length - 1];
  track.slice(1, -1).forEach((point, index) => {
    const distance = perpendicularDistanceMeters(point, first, last);
    if (distance > greatestDistance) {
      greatestDistance = distance;
      greatestIndex = index + 1;
    }
  });
  if (greatestDistance <= toleranceMeters) return [first, last];
  return [
    ...simplifyGpsTrack(track.slice(0, greatestIndex + 1), toleranceMeters).slice(0, -1),
    ...simplifyGpsTrack(track.slice(greatestIndex), toleranceMeters),
  ];
}
