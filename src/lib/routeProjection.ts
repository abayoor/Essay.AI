import type { RoutePoint } from './cyclingModels';

export type RouteProgress = {
  closestIndex: number;
  segmentIndex: number;
  segmentFraction: number;
  projectedPoint: RoutePoint;
  distanceFromRouteM: number;
  distanceAlongRouteM: number;
  remainingM: number;
  totalDistanceM: number;
};

type SegmentProjection = {
  segmentIndex: number;
  segmentFraction: number;
  projectedPoint: RoutePoint;
  distanceM: number;
  distanceAlongRouteM: number;
};

export function distanceMeters(first: RoutePoint, second: RoutePoint): number {
  const earthRadiusM = 6_371_000;
  const firstLatitude = first.lat * Math.PI / 180;
  const secondLatitude = second.lat * Math.PI / 180;
  const latitudeDelta = (second.lat - first.lat) * Math.PI / 180;
  const longitudeDelta = (second.lng - first.lng) * Math.PI / 180;
  const haversine = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(firstLatitude) * Math.cos(secondLatitude) * Math.sin(longitudeDelta / 2) ** 2;
  const normalized = Math.min(1, Math.max(0, haversine));
  return earthRadiusM * 2 * Math.atan2(Math.sqrt(normalized), Math.sqrt(1 - normalized));
}

function projectPointToSegment(
  point: RoutePoint,
  start: RoutePoint,
  end: RoutePoint,
  segmentIndex: number,
  distanceBeforeSegmentM: number,
): SegmentProjection {
  const latitudeScale = 111_320;
  const longitudeScale = latitudeScale * Math.max(.05, Math.cos(point.lat * Math.PI / 180));
  const startX = (start.lng - point.lng) * longitudeScale;
  const startY = (start.lat - point.lat) * latitudeScale;
  const endX = (end.lng - point.lng) * longitudeScale;
  const endY = (end.lat - point.lat) * latitudeScale;
  const segmentX = endX - startX;
  const segmentY = endY - startY;
  const segmentLengthSquared = segmentX ** 2 + segmentY ** 2;
  const segmentFraction = segmentLengthSquared <= .0001
    ? 0
    : Math.max(0, Math.min(1, -(startX * segmentX + startY * segmentY) / segmentLengthSquared));
  const projectedPoint = {
    lat: start.lat + (end.lat - start.lat) * segmentFraction,
    lng: start.lng + (end.lng - start.lng) * segmentFraction,
  };
  const segmentLengthM = distanceMeters(start, end);
  return {
    segmentIndex,
    segmentFraction,
    projectedPoint,
    distanceM: Math.hypot(startX + segmentFraction * segmentX, startY + segmentFraction * segmentY),
    distanceAlongRouteM: distanceBeforeSegmentM + segmentLengthM * segmentFraction,
  };
}

function selectContinuousProjection(
  projections: readonly SegmentProjection[],
  closestDistanceM: number,
  previousDistanceAlongM: number | null,
): SegmentProjection {
  const nearest = projections.reduce((best, projection) => projection.distanceM < best.distanceM ? projection : best);
  const candidates = projections.filter((projection) => projection.distanceM <= closestDistanceM + 14);
  if (previousDistanceAlongM === null || candidates.length === 1) {
    return candidates.reduce((best, projection) => {
      if (projection.distanceM < best.distanceM - 1) return projection;
      if (Math.abs(projection.distanceM - best.distanceM) <= 1
        && projection.distanceAlongRouteM < best.distanceAlongRouteM) return projection;
      return best;
    }, nearest);
  }

  return candidates.reduce((best, projection) => {
    const bestDelta = best.distanceAlongRouteM - previousDistanceAlongM;
    const projectionDelta = projection.distanceAlongRouteM - previousDistanceAlongM;
    const bestScore = best.distanceM
      + Math.abs(bestDelta) * .035
      + (bestDelta < -35 ? 500 + Math.abs(bestDelta) * .2 : 0);
    const projectionScore = projection.distanceM
      + Math.abs(projectionDelta) * .035
      + (projectionDelta < -35 ? 500 + Math.abs(projectionDelta) * .2 : 0);
    return projectionScore < bestScore ? projection : best;
  }, candidates[0]);
}

export function routeProgress(
  points: readonly RoutePoint[],
  rider: RoutePoint,
  previousDistanceAlongM: number | null = null,
): RouteProgress | null {
  if (points.length === 0) return null;
  if (points.length === 1) {
    const distanceFromRouteM = distanceMeters(rider, points[0]);
    return {
      closestIndex: 0,
      segmentIndex: 0,
      segmentFraction: 0,
      projectedPoint: points[0],
      distanceFromRouteM,
      distanceAlongRouteM: 0,
      remainingM: 0,
      totalDistanceM: 0,
    };
  }

  const projections: SegmentProjection[] = [];
  let distanceBeforeSegmentM = 0;
  for (let segmentIndex = 0; segmentIndex < points.length - 1; segmentIndex += 1) {
    projections.push(projectPointToSegment(
      rider,
      points[segmentIndex],
      points[segmentIndex + 1],
      segmentIndex,
      distanceBeforeSegmentM,
    ));
    distanceBeforeSegmentM += distanceMeters(points[segmentIndex], points[segmentIndex + 1]);
  }

  const closestDistanceM = projections.reduce(
    (closest, projection) => Math.min(closest, projection.distanceM),
    Number.POSITIVE_INFINITY,
  );
  const selected = selectContinuousProjection(projections, closestDistanceM, previousDistanceAlongM);
  const distanceAlongRouteM = Math.min(distanceBeforeSegmentM, Math.max(0, selected.distanceAlongRouteM));
  return {
    closestIndex: selected.segmentIndex + (selected.segmentFraction >= .65 ? 1 : 0),
    segmentIndex: selected.segmentIndex,
    segmentFraction: selected.segmentFraction,
    projectedPoint: selected.projectedPoint,
    distanceFromRouteM: closestDistanceM,
    distanceAlongRouteM,
    remainingM: Math.max(0, distanceBeforeSegmentM - distanceAlongRouteM),
    totalDistanceM: distanceBeforeSegmentM,
  };
}

export function distanceToRouteMeters(
  point: RoutePoint,
  route: readonly RoutePoint[],
  fromSegmentIndex = 0,
): number {
  if (route.length === 0) return Number.POSITIVE_INFINITY;
  if (route.length === 1) return distanceMeters(point, route[0]);

  let closestDistanceM = Number.POSITIVE_INFINITY;
  let distanceBeforeSegmentM = 0;
  for (let index = 0; index < route.length - 1; index += 1) {
    const segmentLengthM = distanceMeters(route[index], route[index + 1]);
    if (index >= Math.max(0, fromSegmentIndex)) {
      const projection = projectPointToSegment(point, route[index], route[index + 1], index, distanceBeforeSegmentM);
      closestDistanceM = Math.min(closestDistanceM, projection.distanceM);
      if (closestDistanceM < 4) break;
    }
    distanceBeforeSegmentM += segmentLengthM;
  }
  return closestDistanceM;
}
