import type { GpsTrackPoint, RideRecordingMetrics } from './cyclingModels';

const earthRadiusKm = 6371;
const autoPauseSpeedKmh = 1.8;
const autoPauseAfterSeconds = 8;
const maximumPlausibleSpeedKmh = 85;
const maximumTrackAccuracyMeters = 45;
const elevationDeadbandMeters = 3;

export type GpsPointDecision = 'accept' | 'display-only' | 'reject';

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
  const normalized = Math.min(1, Math.max(0, a));
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(normalized), Math.sqrt(1 - normalized));
}

function validGpsCoordinate(point: GpsTrackPoint): boolean {
  return Number.isFinite(point.lat)
    && point.lat >= -90
    && point.lat <= 90
    && Number.isFinite(point.lng)
    && point.lng >= -180
    && point.lng <= 180
    && Number.isFinite(point.timestamp)
    && point.timestamp > 0;
}

export function classifyGpsPoint(point: GpsTrackPoint, previous: GpsTrackPoint | undefined): GpsPointDecision {
  const accuracyM = point.accuracyMeters ?? Number.POSITIVE_INFINITY;
  if (!validGpsCoordinate(point) || !Number.isFinite(accuracyM) || accuracyM < 0 || accuracyM > maximumTrackAccuracyMeters) {
    return 'reject';
  }
  if (!previous) return 'accept';

  const intervalMs = point.timestamp - previous.timestamp;
  if (!Number.isFinite(intervalMs) || intervalMs <= 0) return 'reject';
  if (intervalMs < 800) return 'display-only';

  const intervalSeconds = intervalMs / 1000;
  const distanceM = distanceBetweenKm(previous, point) * 1000;
  const calculatedSpeedKmh = distanceM / intervalSeconds * 3.6;
  const reportedSpeedKmh = typeof point.speedMps === 'number' && Number.isFinite(point.speedMps) && point.speedMps >= 0
    ? point.speedMps * 3.6
    : null;
  const maximumAccuracyM = Math.max(accuracyM, previous.accuracyMeters ?? accuracyM);

  if (calculatedSpeedKmh > maximumPlausibleSpeedKmh
    && (reportedSpeedKmh === null || reportedSpeedKmh > maximumPlausibleSpeedKmh || Math.abs(calculatedSpeedKmh - reportedSpeedKmh) > 25)) {
    return 'reject';
  }
  const maximumDistanceM = intervalSeconds * (maximumPlausibleSpeedKmh / 3.6) + maximumAccuracyM * 2;
  if (distanceM > Math.max(80, maximumDistanceM)) return 'reject';

  const uncertaintyFloorM = Math.max(3, Math.min(25, maximumAccuracyM * .7));
  if (distanceM < uncertaintyFloorM && (reportedSpeedKmh === null || reportedSpeedKmh < 2.5)) {
    return 'display-only';
  }
  return 'accept';
}

export function splitGpsTrackSegments(track: readonly GpsTrackPoint[]): GpsTrackPoint[][] {
  const segments: GpsTrackPoint[][] = [];
  track.forEach((point) => {
    if (!segments.length || (point.segmentStart === true && segments[segments.length - 1].length > 0)) {
      segments.push([point]);
    } else {
      segments[segments.length - 1].push(point);
    }
  });
  return segments;
}

export function calculateRecordingMetrics(track: GpsTrackPoint[], elapsedTimeSeconds: number, currentTimestamp = Date.now()): RideRecordingMetrics {
  if (track.length < 2) return { ...emptyRecordingMetrics, elapsedTimeSeconds };
  let distanceKm = 0;
  let movingTimeSeconds = 0;
  let maxSpeedKmh = 0;
  let currentSpeedKmh = 0;
  let elevationGainM = 0;
  let stationaryRunSeconds = 0;
  let elevationBaseline: number | null = null;
  const recentSpeedsKmh: number[] = [];

  track.slice(1).forEach((point, index) => {
    const previous = track[index];
    if (point.segmentStart) {
      stationaryRunSeconds = 0;
      elevationBaseline = point.elevation;
      currentSpeedKmh = 0;
      return;
    }
    const intervalSeconds = Math.max(0, (point.timestamp - previous.timestamp) / 1000);
    if (!intervalSeconds || intervalSeconds > 90) return;
    if ((point.accuracyMeters ?? 0) > maximumTrackAccuracyMeters || (previous.accuracyMeters ?? 0) > maximumTrackAccuracyMeters) return;
    const segmentDistanceKm = distanceBetweenKm(previous, point);
    const calculatedSpeedKmh = segmentDistanceKm / intervalSeconds * 3600;
    const reportedSpeedKmh = point.speedMps !== null && point.speedMps !== undefined
      && Number.isFinite(point.speedMps) && point.speedMps >= 0
      ? point.speedMps * 3.6
      : null;
    const speedKmh = reportedSpeedKmh !== null && reportedSpeedKmh <= maximumPlausibleSpeedKmh
      ? reportedSpeedKmh
      : calculatedSpeedKmh;
    if (speedKmh > maximumPlausibleSpeedKmh) return;

    const maximumAccuracyM = Math.max(point.accuracyMeters ?? 0, previous.accuracyMeters ?? 0);
    const accuracyFloorKm = Math.max(0.003, Math.min(0.025, maximumAccuracyM * .7 / 1000));
    const isGpsJitter = segmentDistanceKm < accuracyFloorKm
      && (reportedSpeedKmh === null || reportedSpeedKmh < 2.5);
    if (!isGpsJitter) distanceKm += segmentDistanceKm;
    const effectiveSpeedKmh = isGpsJitter ? 0 : speedKmh;
    recentSpeedsKmh.push(effectiveSpeedKmh);
    if (recentSpeedsKmh.length > 3) recentSpeedsKmh.shift();
    const sortedRecentSpeeds = [...recentSpeedsKmh].sort((first, second) => first - second);
    currentSpeedKmh = sortedRecentSpeeds[Math.floor(sortedRecentSpeeds.length / 2)] ?? 0;
    maxSpeedKmh = Math.max(maxSpeedKmh, effectiveSpeedKmh);
    const isMoving = effectiveSpeedKmh >= autoPauseSpeedKmh;
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

    const pointAltitudeAccuracyM = point.altitudeAccuracyMeters ?? (point.accuracyMeters ?? Number.POSITIVE_INFINITY) * 1.5;
    const previousAltitudeAccuracyM = previous.altitudeAccuracyMeters ?? (previous.accuracyMeters ?? Number.POSITIVE_INFINITY) * 1.5;
    const altitudeIsAccurate = pointAltitudeAccuracyM <= 20 && previousAltitudeAccuracyM <= 20;
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

  const lastPoint = track[track.length - 1];
  if (!lastPoint || currentTimestamp - lastPoint.timestamp > 5_000) currentSpeedKmh = 0;

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

function simplifyGpsSegment(track: GpsTrackPoint[], toleranceMeters: number): GpsTrackPoint[] {
  if (track.length < 3) return track;
  const keep = new Uint8Array(track.length);
  keep[0] = 1;
  keep[track.length - 1] = 1;
  const ranges: Array<[number, number]> = [[0, track.length - 1]];

  while (ranges.length) {
    const range = ranges.pop();
    if (!range) break;
    const [firstIndex, lastIndex] = range;
    let greatestDistance = 0;
    let greatestIndex = -1;
    for (let index = firstIndex + 1; index < lastIndex; index += 1) {
      const distance = perpendicularDistanceMeters(track[index], track[firstIndex], track[lastIndex]);
      if (distance > greatestDistance) {
        greatestDistance = distance;
        greatestIndex = index;
      }
    }
    if (greatestIndex >= 0 && greatestDistance > toleranceMeters) {
      keep[greatestIndex] = 1;
      ranges.push([firstIndex, greatestIndex], [greatestIndex, lastIndex]);
    }
  }

  return track.filter((_point, index) => keep[index] === 1);
}

export function simplifyGpsTrack(track: GpsTrackPoint[], toleranceMeters = 2): GpsTrackPoint[] {
  return splitGpsTrackSegments(track).flatMap((segment, segmentIndex) => {
    const simplified = simplifyGpsSegment(segment, toleranceMeters);
    return simplified.map((point, pointIndex) => pointIndex === 0 && (segmentIndex > 0 || point.segmentStart)
      ? { ...point, segmentStart: true }
      : point);
  });
}
