import { divIcon, latLngBounds } from 'leaflet';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Bike,
  Clock3,
  Gauge,
  LocateFixed,
  MapPin,
  Mountain,
  Navigation,
  Play,
  RefreshCw,
  Route,
  Search,
  ShieldCheck,
  Square,
  Timer,
  Utensils,
  Trees,
  Landmark,
  Wrench,
  X,
} from 'lucide-react';
import { MapContainer, Marker, Polyline, Popup, useMap, useMapEvents, ZoomControl } from 'react-leaflet';
import { useLocation } from 'wouter';
import { clearMapNavigation, loadMapNavigation, navigationUpdatedEvent, saveMapNavigation } from '../lib/activeNavigation';
import type { LocaleText } from '../lib/localized';
import { useLocaleText } from '../lib/localized';
import { usePreferences } from '../lib/preferences';
import type { RoutePoint } from '../lib/cyclingModels';
import { routeCyclingWaypoints, type CyclingRouteInstruction, type CyclingRoutePreference, type CyclingRouteResult } from '../lib/directions';
import { reverseMapLocation, searchMapPlaces, type MapPlace, type ResolvedMapLocation } from '../lib/places';
import { saveMapRouteDraft } from '../lib/routeDraft';
import { distanceMeters, distanceToRouteMeters, routeProgress, type RouteProgress } from '../lib/routeProjection';
import type { HazardReport, HazardType } from '../lib/hazards';
import { CommunityTileLayer } from './CommunityTileLayer';
import { DirectionalRouteLine } from './DirectionalRouteLine';
import { HazardLayer } from './HazardLayer';

type RouteOption = {
  preference: CyclingRoutePreference;
  result: CyclingRouteResult;
};

type WakeLockSentinelLike = {
  release: () => Promise<void>;
};

type HazardAction = (hazard: HazardReport) => void | Promise<void>;

type CityExploreMapProps = {
  hazards: readonly HazardReport[];
  currentUserId: string | null;
  busyHazardId: string | null;
  hazardPickMode: boolean;
  onConfirmHazard: HazardAction;
  onUnconfirmHazard: HazardAction;
  onResolveHazard: HazardAction;
  onOpenHazardReport: () => void;
  onPickHazardLocation: (point: RoutePoint) => void;
  onRiderLocationChange: (point: RoutePoint | null) => void;
};

type RouteSafety = {
  hazards: HazardReport[];
  score: number;
};

const riderIcon = divIcon({
  className: 'rider-location-marker',
  html: '<span aria-hidden="true">🚴</span>',
  iconSize: [46, 46],
  iconAnchor: [23, 23],
});

const destinationIcon = divIcon({
  className: 'destination-location-marker',
  html: '<span aria-hidden="true"><b>B</b></span>',
  iconSize: [34, 42],
  iconAnchor: [17, 40],
});

const hazardPenalty: Record<HazardType, number> = {
  pothole: 12,
  no_lighting: 9,
  glass: 16,
  aggressive_dogs: 18,
  road_closed: 34,
};

function calculateRouteSafety(route: RoutePoint[], hazards: readonly HazardReport[]): RouteSafety {
  const nearby = hazards.filter((hazard) => distanceToRouteMeters(hazard.location, route) <= 45);
  const penalty = nearby.reduce((total, hazard) => total + hazardPenalty[hazard.hazardType] + Math.min(8, hazard.confirmations * 2), 0);
  return { hazards: nearby, score: Math.max(20, 100 - penalty) };
}

function bearingDegrees(first: RoutePoint, second: RoutePoint): number {
  const firstLat = first.lat * Math.PI / 180;
  const secondLat = second.lat * Math.PI / 180;
  const dLng = (second.lng - first.lng) * Math.PI / 180;
  const y = Math.sin(dLng) * Math.cos(secondLat);
  const x = Math.cos(firstLat) * Math.sin(secondLat)
    - Math.sin(firstLat) * Math.cos(secondLat) * Math.cos(dLng);
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}

function distanceToRoutePoint(points: readonly RoutePoint[], progress: RouteProgress, pointIndex: number): number {
  if (pointIndex <= progress.segmentIndex || pointIndex >= points.length) return 0;
  let distanceM = distanceMeters(progress.projectedPoint, points[progress.segmentIndex + 1]);
  for (let index = progress.segmentIndex + 1; index < pointIndex; index += 1) {
    distanceM += distanceMeters(points[index], points[index + 1]);
  }
  return distanceM;
}

function providerInstructionCopy(
  instruction: CyclingRouteInstruction,
  distanceM: number,
  text: LocaleText,
): { text: string; distanceM: number; turn: 'left' | 'right' | 'straight' | 'finish' } {
  if (instruction.kind === 'roundabout') {
    const exit = instruction.exitNumber;
    return {
      text: exit
        ? text(`На круговом движении выберите съезд №${exit}`, `Айналма жолдан №${exit} шығуды таңдаңыз`, `At the roundabout, take exit ${exit}`)
        : text('Въезжайте на круговое движение', 'Айналма жолға кіріңіз', 'Enter the roundabout'),
      distanceM,
      turn: 'right',
    };
  }
  if (instruction.kind === 'uturn') {
    return { text: text('Развернитесь', 'Кері бұрылыңыз', 'Make a U-turn'), distanceM, turn: 'left' };
  }
  if (instruction.kind === 'keep-left' || instruction.kind === 'keep-right') {
    const keepRight = instruction.kind === 'keep-right';
    return {
      text: keepRight
        ? text('Держитесь правее', 'Оң жақпен жүріңіз', 'Keep right')
        : text('Держитесь левее', 'Сол жақпен жүріңіз', 'Keep left'),
      distanceM,
      turn: keepRight ? 'right' : 'left',
    };
  }
  if (instruction.kind === 'left' || instruction.kind === 'right') {
    const turnRight = instruction.kind === 'right';
    return {
      text: turnRight
        ? text('Поверните направо', 'Оңға бұрылыңыз', 'Turn right')
        : text('Поверните налево', 'Солға бұрылыңыз', 'Turn left'),
      distanceM,
      turn: instruction.kind,
    };
  }
  if (instruction.kind === 'finish') {
    return { text: text('Финиш впереди', 'Мәре алда', 'Destination ahead'), distanceM, turn: 'straight' };
  }
  return { text: text('Продолжайте прямо', 'Тура жүріңіз', 'Continue straight'), distanceM, turn: 'straight' };
}

function nextNavigationInstruction(
  points: RoutePoint[],
  instructions: readonly CyclingRouteInstruction[],
  progress: RouteProgress,
  destinationDistanceM: number | null,
  text: LocaleText,
): { text: string; distanceM: number; turn: 'left' | 'right' | 'straight' | 'finish' } {
  if (progress.remainingM < 30) {
    if (destinationDistanceM !== null && destinationDistanceM > 35) {
      return {
        text: text('Маршрут заканчивается у дороги — дальше к точке назначения', 'Бағыт жолда аяқталады — межелі жерге қарай жалғастырыңыз', 'The street route ends here — continue to the destination'),
        distanceM: Math.round(destinationDistanceM),
        turn: 'finish',
      };
    }
    return { text: text('Вы прибыли', 'Сіз келдіңіз', 'You have arrived'), distanceM: 0, turn: 'finish' };
  }

  if (instructions.length > 0) {
    const upcoming = instructions
      .filter((instruction) => instruction.pointIndex > progress.segmentIndex)
      .map((instruction) => ({
        instruction,
        distanceM: distanceToRoutePoint(points, progress, instruction.pointIndex),
      }))
      .sort((first, second) => first.distanceM - second.distanceM)[0];
    if (upcoming && upcoming.distanceM <= 1_200) {
      return providerInstructionCopy(upcoming.instruction, Math.round(upcoming.distanceM), text);
    }
    return {
      text: text('Продолжайте прямо', 'Тура жүріңіз', 'Continue straight'),
      distanceM: Math.min(Math.round(upcoming?.distanceM ?? progress.remainingM), 900),
      turn: 'straight',
    };
  }

  let coveredM = distanceMeters(progress.projectedPoint, points[progress.segmentIndex + 1]);
  for (let index = progress.segmentIndex + 1; index < points.length - 1 && coveredM < 900; index += 1) {
    if (index > progress.segmentIndex + 1) coveredM += distanceMeters(points[index - 1], points[index]);
    if (coveredM < 35) continue;
    const before = bearingDegrees(points[Math.max(progress.segmentIndex, index - 2)], points[index]);
    const after = bearingDegrees(points[index], points[Math.min(points.length - 1, index + 2)]);
    const turnAngle = ((after - before + 540) % 360) - 180;
    if (Math.abs(turnAngle) >= 38) {
      const turn = turnAngle > 0 ? 'right' : 'left';
      return {
        text: turn === 'right'
          ? text('Поверните направо', 'Оңға бұрылыңыз', 'Turn right')
          : text('Поверните налево', 'Солға бұрылыңыз', 'Turn left'),
        distanceM: Math.round(coveredM),
        turn,
      };
    }
  }
  return { text: text('Продолжайте прямо', 'Тура жүріңіз', 'Continue straight'), distanceM: Math.min(Math.round(progress.remainingM), 900), turn: 'straight' };
}

function estimatedRideMinutes(route: CyclingRouteResult, distanceKm = route.distanceKm, elevationGainM = route.elevationGainM): number {
  const flatMinutes = distanceKm / 18 * 60;
  const climbingMinutes = elevationGainM / 600 * 60 * 0.55;
  return Math.max(1, Math.ceil(Math.max(route.durationMinutes * (distanceKm / Math.max(route.distanceKm, 0.01)), flatMinutes + climbingMinutes)));
}

function arrivalTime(minutes: number, locale: string): string {
  return new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' })
    .format(new Date(Date.now() + minutes * 60_000));
}

function formatDistance(meters: number, locale: string): string {
  return `${Math.max(0, Math.round(meters)).toLocaleString(locale)} м`;
}

function sampleRouteAnchors(points: readonly RoutePoint[], maximum = 24): RoutePoint[] {
  if (points.length <= maximum) return points.slice();
  return Array.from({ length: maximum }, (_, index) => (
    points[Math.round(index * (points.length - 1) / (maximum - 1))]
  ));
}

function MapViewport({ focus, route, recenterRequest, navigationActive }: {
  focus: RoutePoint | null;
  route: RoutePoint[];
  recenterRequest: { point: RoutePoint; id: number } | null;
  navigationActive: boolean;
}) {
  const map = useMap();
  useEffect(() => {
    if (navigationActive) return;
    if (route.length > 1) {
      map.fitBounds(latLngBounds(route.map((point) => [point.lat, point.lng])), { padding: [48, 48], maxZoom: 16 });
    } else if (focus) {
      map.flyTo([focus.lat, focus.lng], Math.max(map.getZoom(), 14), { duration: 0.7 });
    }
  }, [focus, map, navigationActive, route]);
  useEffect(() => {
    if (recenterRequest && !navigationActive) {
      map.flyTo([recenterRequest.point.lat, recenterRequest.point.lng], Math.max(map.getZoom(), 15), { duration: 0.7 });
    }
  }, [map, navigationActive, recenterRequest]);
  return null;
}

function NavigationCamera({ active, rider }: { active: boolean; rider: RoutePoint | null }) {
  const map = useMap();
  useEffect(() => {
    if (!active || !rider) return;
    map.invalidateSize();
    map.setView([rider.lat, rider.lng], 17, { animate: false });
  }, [active, map, rider]);
  return null;
}

function StartPicker({ enabled, onPick }: { enabled: boolean; onPick: (point: RoutePoint) => void }) {
  useMapEvents({
    click(event) {
      if (enabled) onPick({ lat: event.latlng.lat, lng: event.latlng.lng });
    },
  });
  return null;
}

function HazardPointPicker({ enabled, onPick }: { enabled: boolean; onPick: (point: RoutePoint) => void }) {
  const map = useMapEvents({
    click(event) {
      if (enabled) onPick({ lat: event.latlng.lat, lng: event.latlng.lng });
    },
  });

  useEffect(() => {
    if (!enabled) return undefined;
    const container = map.getContainer();
    function pickMapCenter(event: KeyboardEvent) {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      const center = map.getCenter();
      onPick({ lat: center.lat, lng: center.lng });
    }
    container.addEventListener('keydown', pickMapCenter);
    return () => container.removeEventListener('keydown', pickMapCenter);
  }, [enabled, map, onPick]);

  return null;
}

function preferenceCopy(preference: CyclingRoutePreference, text: LocaleText): { title: string; description: string; icon: typeof Route } {
  return preference === 'recommended'
    ? { title: text('Лучший для велосипеда', 'Велосипедке ең қолайлы', 'Best for cycling'), description: text('Приоритет велодорожек и подходящих улиц', 'Веложолдар мен қолайлы көшелерге басымдық', 'Prioritizes cycleways and suitable streets'), icon: ShieldCheck }
    : { title: text('Более прямой', 'Тура бағыт', 'More direct'), description: text('Быстрый велопрофиль без ступеней и автомагистралей', 'Баспалдақсыз және автомагистральсыз жылдам велобағыт', 'Fast bike profile without steps or motorways'), icon: Timer };
}

export function CityExploreMap({
  hazards,
  currentUserId,
  busyHazardId,
  hazardPickMode,
  onConfirmHazard,
  onUnconfirmHazard,
  onResolveHazard,
  onOpenHazardReport,
  onPickHazardLocation,
  onRiderLocationChange,
}: CityExploreMapProps) {
  const [, navigate] = useLocation();
  const { locale } = usePreferences();
  const text = useLocaleText();
  const restoredNavigation = useMemo(() => loadMapNavigation(), []);
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<MapPlace[]>([]);
  const [searching, setSearching] = useState(false);
  const [riderLocation, setRiderLocation] = useState<RoutePoint | null>(null);
  const [riderHeading, setRiderHeading] = useState(0);
  const [currentSpeedKmh, setCurrentSpeedKmh] = useState<number | null>(null);
  const [routingOrigin, setRoutingOrigin] = useState<RoutePoint | null>(null);
  const [destination, setDestination] = useState<MapPlace | null>(() => restoredNavigation ? {
    id: restoredNavigation.id,
    name: restoredNavigation.destinationName,
    subtitle: restoredNavigation.destinationSubtitle,
    ...restoredNavigation.destination,
  } : null);
  const [resolvedLocation, setResolvedLocation] = useState<ResolvedMapLocation | null>(null);
  const [locationStatus, setLocationStatus] = useState(() => text('Определяем твоё местоположение…', 'Орналасқан жеріңді анықтап жатырмыз…', 'Finding your location…'));
  const [locationAttempt, setLocationAttempt] = useState(0);
  const [routeOptions, setRouteOptions] = useState<RouteOption[]>(() => restoredNavigation ? [{
    preference: restoredNavigation.preference,
    result: restoredNavigation.result,
  }] : []);
  const [activePreference, setActivePreference] = useState<CyclingRoutePreference>(restoredNavigation?.preference ?? 'recommended');
  const [navigationSource, setNavigationSource] = useState<'search' | 'popular'>(restoredNavigation?.source ?? 'search');
  const [routing, setRouting] = useState(false);
  const [routeError, setRouteError] = useState('');
  const [navigationActive, setNavigationActive] = useState(restoredNavigation?.active ?? false);
  const [recenterRequest, setRecenterRequest] = useState<{ point: RoutePoint; id: number } | null>(null);
  const routeRequest = useRef(0);
  const hasCenteredOnRider = useRef(false);
  const lastAutoRerouteAt = useRef(0);
  const offRouteSince = useRef<number | null>(null);
  const lastGpsPoint = useRef<RoutePoint | null>(null);
  const lastGpsTimestamp = useRef(0);
  const lastNavigationFixAt = useRef(0);
  const lastGpsAccuracyM = useRef(Number.POSITIVE_INFINITY);
  const distanceAlongRouteM = useRef<number | null>(navigationActive ? 0 : null);
  const progressRoutePoints = useRef<RoutePoint[] | null>(null);
  const popularRematchAttempted = useRef(false);
  const reverseLookupPoint = useRef<RoutePoint | null>(null);
  const wakeLock = useRef<WakeLockSentinelLike | null>(null);
  const warnedHazards = useRef(new Set<string>());
  const hazardsRef = useRef(hazards);
  const riderLocationRef = useRef<RoutePoint | null>(riderLocation);
  const onRiderLocationChangeRef = useRef(onRiderLocationChange);
  hazardsRef.current = hazards;
  riderLocationRef.current = riderLocation;
  onRiderLocationChangeRef.current = onRiderLocationChange;

  useEffect(() => {
    const restoreSelectedRoute = () => {
      const navigation = loadMapNavigation();
      if (!navigation) return;
      routeRequest.current += 1;
      setRouting(false);
      setRouteError('');
      setDestination({
        id: navigation.id,
        name: navigation.destinationName,
        subtitle: navigation.destinationSubtitle,
        ...navigation.destination,
      });
      setRouteOptions([{ preference: navigation.preference, result: navigation.result }]);
      setActivePreference(navigation.preference);
      setNavigationSource(navigation.source);
      setNavigationActive(navigation.active);
      distanceAlongRouteM.current = navigation.active ? 0 : null;
      progressRoutePoints.current = null;
      popularRematchAttempted.current = false;
    };
    window.addEventListener(navigationUpdatedEvent, restoreSelectedRoute);
    return () => window.removeEventListener(navigationUpdatedEvent, restoreSelectedRoute);
  }, []);

  const activeRoute = useMemo(
    () => routeOptions.find((option) => option.preference === activePreference) ?? routeOptions[0] ?? null,
    [activePreference, routeOptions],
  );
  const activeSnappedWaypoints = activeRoute?.result.snappedWaypoints ?? [];
  const activeRoutePoints = activeRoute?.result.points ?? [];
  const snappedDestination = activeSnappedWaypoints[activeSnappedWaypoints.length - 1]
    ?? activeRoutePoints[activeRoutePoints.length - 1]
    ?? null;
  const destinationRoadGapM = destination && snappedDestination
    ? distanceMeters(snappedDestination, destination)
    : 0;
  const directDestinationDistanceM = destination && riderLocation
    ? distanceMeters(riderLocation, destination)
    : null;

  const progress = useMemo(() => {
    if (!activeRoute || !riderLocation) return null;
    const routePoints = activeRoute.result.points;
    if (!navigationActive || progressRoutePoints.current !== routePoints) {
      progressRoutePoints.current = routePoints;
      distanceAlongRouteM.current = navigationActive ? 0 : null;
    }
    return routeProgress(routePoints, riderLocation, navigationActive ? distanceAlongRouteM.current : null);
  }, [activeRoute, navigationActive, riderLocation]);

  useEffect(() => {
    if (!navigationActive || !progress) {
      distanceAlongRouteM.current = null;
      return;
    }
    const acceptableGpsDistanceM = Math.max(45, Math.min(100, lastGpsAccuracyM.current * 1.5));
    if (progress.distanceFromRouteM > acceptableGpsDistanceM) return;
    distanceAlongRouteM.current = Math.max(distanceAlongRouteM.current ?? 0, progress.distanceAlongRouteM);
  }, [navigationActive, progress]);

  const instruction = useMemo(
    () => activeRoute && progress
      ? nextNavigationInstruction(activeRoute.result.points, activeRoute.result.instructions, progress, directDestinationDistanceM, text)
      : null,
    [activeRoute, directDestinationDistanceM, progress, text],
  );

  const routeSafety = useMemo(() => new Map(
    routeOptions.map((option) => [option.preference, calculateRouteSafety(option.result.points, hazards)]),
  ), [hazards, routeOptions]);

  const upcomingHazard = useMemo(() => {
    if (!navigationActive || !activeRoute || !progress || !riderLocation) return null;
    const candidates = hazards.flatMap((hazard) => {
      const riderDistanceM = distanceMeters(riderLocation, hazard.location);
      if (riderDistanceM > 300) return [];
      const routeDistanceM = distanceToRouteMeters(hazard.location, activeRoute.result.points, progress.segmentIndex);
      return routeDistanceM <= 45 ? [{ hazard, riderDistanceM }] : [];
    });
    return candidates.sort((first, second) => first.riderDistanceM - second.riderDistanceM)[0] ?? null;
  }, [activeRoute, hazards, navigationActive, progress, riderLocation]);

  const navigationRiderIcon = useMemo(() => divIcon({
    className: 'navigation-rider-marker',
    html: `<span aria-hidden="true" style="--rider-heading:${Math.round(riderHeading)}deg"><svg viewBox="0 0 48 48" focusable="false"><path d="M24 4 39 40 24 33 9 40 24 4Z" /></svg></span>`,
    iconSize: [64, 64],
    iconAnchor: [32, 32],
  }), [riderHeading]);

  useEffect(() => {
    if (!navigator.geolocation) {
      setLocationStatus(text('Геолокация недоступна — нажми на карту, чтобы указать старт.', 'Геолокация қолжетімсіз — бастау нүктесін картадан таңда.', 'Location is unavailable — tap the map to set a start.'));
      return undefined;
    }
    const receivePosition = (position: GeolocationPosition) => {
      const rawPoint = { lat: position.coords.latitude, lng: position.coords.longitude };
      const accuracyM = position.coords.accuracy;
      if (!Number.isFinite(rawPoint.lat) || !Number.isFinite(rawPoint.lng)
        || rawPoint.lat < -90 || rawPoint.lat > 90 || rawPoint.lng < -180 || rawPoint.lng > 180
        || !Number.isFinite(accuracyM) || accuracyM < 0 || accuracyM > 25_000) {
        lastGpsAccuracyM.current = Number.isFinite(accuracyM) ? accuracyM : Number.POSITIVE_INFINITY;
        setLocationStatus(text('GPS-сигнал слишком слабый…', 'GPS сигналы тым әлсіз…', 'GPS signal is too weak…'));
        return;
      }

      const previousPoint = lastGpsPoint.current;
      const fixTimestamp = position.timestamp > 10_000_000_000 ? position.timestamp : Date.now();
      if (lastGpsTimestamp.current > 0 && fixTimestamp < lastGpsTimestamp.current - 1_000) return;
      const intervalSeconds = lastGpsTimestamp.current > 0 ? (fixTimestamp - lastGpsTimestamp.current) / 1000 : 0;
      const rawMovedM = previousPoint ? distanceMeters(previousPoint, rawPoint) : 0;
      const impliedSpeedKmh = intervalSeconds > 0 ? rawMovedM / intervalSeconds * 3.6 : 0;
      const reportedSpeedKmh = typeof position.coords.speed === 'number' && Number.isFinite(position.coords.speed) && position.coords.speed >= 0
        ? position.coords.speed * 3.6
        : null;
      const previousAccuracyM = lastGpsAccuracyM.current;
      if (previousPoint && previousAccuracyM <= 150 && accuracyM <= 150 && intervalSeconds > 0 && impliedSpeedKmh > 100
        && (reportedSpeedKmh === null || Math.abs(impliedSpeedKmh - reportedSpeedKmh) > 30)) {
        setLocationStatus(text('Уточняем GPS после скачка…', 'GPS секірісінен кейін нақтылануда…', 'Refining GPS after a jump…'));
        return;
      }

      const shouldSmooth = previousPoint && previousAccuracyM <= 100 && accuracyM <= 100;
      const smoothingWeight = accuracyM <= 25 ? 1 : Math.max(.45, 1 - (accuracyM - 25) / 100);
      const point = shouldSmooth ? {
        lat: previousPoint.lat + (rawPoint.lat - previousPoint.lat) * smoothingWeight,
        lng: previousPoint.lng + (rawPoint.lng - previousPoint.lng) * smoothingWeight,
      } : rawPoint;
      const movedM = previousPoint ? distanceMeters(previousPoint, point) : 0;
      const gpsHeading = position.coords.heading;
      if (typeof gpsHeading === 'number' && Number.isFinite(gpsHeading)) {
        setRiderHeading(gpsHeading);
      } else if (previousPoint && movedM > Math.max(3, accuracyM * .15)) {
        setRiderHeading(bearingDegrees(previousPoint, point));
      }
      if (reportedSpeedKmh !== null) {
        setCurrentSpeedKmh(Math.max(0, Math.min(100, reportedSpeedKmh)));
      } else if (intervalSeconds > 0) {
        setCurrentSpeedKmh(Math.max(0, Math.min(100, movedM / intervalSeconds * 3.6)));
      }
      lastGpsAccuracyM.current = accuracyM;
      lastGpsPoint.current = point;
      lastGpsTimestamp.current = fixTimestamp;
      lastNavigationFixAt.current = Date.now();
      riderLocationRef.current = point;
      setRiderLocation(point);
      onRiderLocationChangeRef.current(point);
      const accuracyLabel = accuracyM >= 1_000
        ? `${(accuracyM / 1_000).toFixed(1)} ${text('км', 'км', 'km')}`
        : `${Math.round(accuracyM)} ${text('м', 'м', 'm')}`;
      setLocationStatus(`${accuracyM > 100 ? text('Примерная позиция', 'Шамамен орналасқан жер', 'Approximate location') : accuracyM > 45 ? text('Слабый GPS', 'GPS сигналы әлсіз', 'Weak GPS') : 'GPS'} ±${accuracyLabel}`);
      if (!hasCenteredOnRider.current) {
        hasCenteredOnRider.current = true;
        setRoutingOrigin((current) => current ?? point);
        reverseLookupPoint.current = point;
        void reverseMapLocation(point, locale).then(setResolvedLocation).catch(() => undefined);
      }
    };
    const handleLocationError = (error: GeolocationPositionError) => {
      if (error.code === error.PERMISSION_DENIED) {
        setLocationStatus(text('Разреши геолокацию в настройках устройства.', 'Құрылғы баптауларында геолокацияға рұқсат бер.', 'Allow location access in your device settings.'));
      } else if (!riderLocationRef.current) {
        setLocationStatus(text('Ищем GPS-сигнал…', 'GPS сигналын іздеп жатырмыз…', 'Searching for GPS signal…'));
      }
    };
    navigator.geolocation.getCurrentPosition(receivePosition, handleLocationError, {
      enableHighAccuracy: false,
      maximumAge: 30_000,
      timeout: 8_000,
    });
    const watchId = navigator.geolocation.watchPosition(receivePosition, handleLocationError, {
      enableHighAccuracy: true,
      maximumAge: 5_000,
      timeout: 30_000,
    });
    return () => navigator.geolocation.clearWatch(watchId);
  }, [locale, locationAttempt, text]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      if (lastNavigationFixAt.current > 0 && Date.now() - lastNavigationFixAt.current > 15_000) {
        setCurrentSpeedKmh(0);
        setLocationStatus(text('GPS временно потерян — ищем сигнал…', 'GPS уақытша жоғалды — сигнал ізделуде…', 'GPS temporarily lost — searching…'));
      }
    }, 3_000);
    return () => window.clearInterval(interval);
  }, [text]);

  useEffect(() => {
    if (!upcomingHazard || warnedHazards.current.has(upcomingHazard.hazard.id)) return;
    warnedHazards.current.add(upcomingHazard.hazard.id);
    if (typeof navigator.vibrate === 'function') navigator.vibrate([140, 80, 140]);
  }, [upcomingHazard]);

  useEffect(() => {
    if (!navigationActive) warnedHazards.current.clear();
  }, [navigationActive]);

  useEffect(() => {
    const point = reverseLookupPoint.current;
    if (!point) return undefined;
    const controller = new AbortController();
    void reverseMapLocation(point, locale, controller.signal).then(setResolvedLocation).catch(() => undefined);
    return () => controller.abort();
  }, [locale]);

  useEffect(() => {
    if (!navigationActive) return undefined;
    let disposed = false;
    const wakeLockNavigator = navigator as Navigator & {
      wakeLock?: { request: (type: 'screen') => Promise<WakeLockSentinelLike> };
    };

    async function releaseWakeLock() {
      const activeLock = wakeLock.current;
      wakeLock.current = null;
      if (activeLock) await activeLock.release().catch(() => undefined);
    }

    async function requestWakeLock() {
      if (disposed || document.visibilityState !== 'visible' || wakeLock.current || !wakeLockNavigator.wakeLock) return;
      try {
        const sentinel = await wakeLockNavigator.wakeLock.request('screen');
        if (disposed) await sentinel.release().catch(() => undefined);
        else wakeLock.current = sentinel;
      } catch {
        // Browsers and low-power modes may refuse a wake lock.
      }
    }

    function handleVisibilityChange() {
      if (document.visibilityState === 'visible') void requestWakeLock();
      else void releaseWakeLock();
    }

    document.addEventListener('visibilitychange', handleVisibilityChange);
    void requestWakeLock();
    return () => {
      disposed = true;
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      void releaseWakeLock();
    };
  }, [navigationActive]);

  useEffect(() => {
    const value = query.trim();
    if (value.length < 2) {
      setSearchResults([]);
      setSearching(false);
      return undefined;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setSearching(true);
      void searchMapPlaces(value, riderLocationRef.current, locale, controller.signal)
        .then(setSearchResults)
        .catch((error: unknown) => {
          if (!(error instanceof DOMException && error.name === 'AbortError')) setSearchResults([]);
        })
        .finally(() => setSearching(false));
    }, 300);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [locale, query]);

  useEffect(() => {
    if (!navigationActive || !destination || !riderLocation || !progress || navigationSource === 'popular') {
      offRouteSince.current = null;
      return;
    }
    const accuracyM = lastGpsAccuracyM.current;
    const rerouteDistanceM = Math.max(55, Math.min(100, accuracyM * 1.5));
    if (!Number.isFinite(accuracyM) || accuracyM > 100 || progress.distanceFromRouteM <= rerouteDistanceM) {
      offRouteSince.current = null;
      return;
    }
    const now = Date.now();
    if (offRouteSince.current === null) {
      offRouteSince.current = now;
      return;
    }
    if (now - offRouteSince.current < 4_000 || now - lastAutoRerouteAt.current < 15_000) return;
    offRouteSince.current = null;
    lastAutoRerouteAt.current = now;
    setRoutingOrigin({ ...riderLocation });
  }, [destination, navigationActive, navigationSource, progress, riderLocation]);

  useEffect(() => {
    if (!activeRoute || !destination) return;
    saveMapNavigation({
      id: destination.id,
      destinationName: destination.name,
      destinationSubtitle: destination.subtitle,
      destination: { lat: destination.lat, lng: destination.lng },
      result: activeRoute.result,
      preference: activeRoute.preference,
      active: navigationActive,
      source: navigationSource,
      savedAt: new Date().toISOString(),
    }, { notify: false });
  }, [activeRoute, destination, navigationActive, navigationSource]);

  useEffect(() => {
    if (navigationSource === 'popular') {
      if (popularRematchAttempted.current) return;
      popularRematchAttempted.current = true;
      const storedRoute = routeOptions[0];
      if (!storedRoute || storedRoute.result.points.length < 2) return;
      const requestId = ++routeRequest.current;
      setRouteError('');
      setRouting(true);
      void routeCyclingWaypoints(sampleRouteAnchors(storedRoute.result.points), 'recommended')
        .then((result) => {
          if (requestId !== routeRequest.current) return;
          setRouteOptions([{ preference: 'recommended', result }]);
          setActivePreference('recommended');
        })
        .catch(() => {
          if (requestId === routeRequest.current) {
            setRouteError(text('Этот старый маршрут не удалось полностью привязать к улицам — показываем сохранённую линию.', 'Бұл ескі бағытты көшелерге толық байланыстыру мүмкін болмады — сақталған сызық көрсетіледі.', 'This older route could not be fully matched to streets, so its saved line remains visible.'));
          }
        })
        .finally(() => {
          if (requestId === routeRequest.current) setRouting(false);
        });
      return;
    }
    const requestId = ++routeRequest.current;
    setRouteError('');
    if (!routingOrigin || !destination) {
      if (!destination) setRouteOptions([]);
      setRouting(false);
      return;
    }
    setRouting(true);
    const waypoints = [routingOrigin, { lat: destination.lat, lng: destination.lng }];
    void Promise.allSettled([
      routeCyclingWaypoints(waypoints, 'recommended'),
      routeCyclingWaypoints(waypoints, 'shortest'),
    ]).then((results) => {
      if (requestId !== routeRequest.current) return;
      const options = results.flatMap((result, index): RouteOption[] => result.status === 'fulfilled'
        ? [{ preference: index === 0 ? 'recommended' : 'shortest', result: result.value }]
        : []);
      if (!options.length) {
        setRouteError(text('Не удалось построить путь по улицам. Попробуй выбрать другой адрес.', 'Көшелермен бағыт құру мүмкін болмады. Басқа мекенжайды таңда.', 'A street route could not be built. Try another address.'));
        return;
      }
      setRouteOptions(options);
      // Keep the road-aware recommended profile as the predictable default.
      // Previously a small difference in community hazard reports could make
      // the shorter, more abrupt alternative become active automatically.
      setActivePreference(options.some((option) => option.preference === 'recommended') ? 'recommended' : options[0].preference);
    }).finally(() => {
      if (requestId === routeRequest.current) setRouting(false);
    });
  }, [destination, navigationSource, routingOrigin, text]);

  function chooseDestination(place: MapPlace) {
    clearMapNavigation();
    setDestination(place);
    setNavigationSource('search');
    setNavigationActive(false);
    setRouteOptions([]);
    setQuery('');
    setSearchResults([]);
    if (riderLocation) {
      setRoutingOrigin(riderLocation);
      setRouteError('');
    } else {
      setRouteError(text('Сначала разреши геолокацию или нажми на карту, чтобы указать точку старта.', 'Алдымен геолокацияға рұқсат бер немесе бастау нүктесін картадан таңда.', 'Allow location access or tap the map to set your start first.'));
    }
  }

  function chooseManualStart(point: RoutePoint) {
    if (riderLocation) return;
    riderLocationRef.current = point;
    setRiderLocation(point);
    onRiderLocationChangeRef.current(point);
    setRoutingOrigin(point);
    setLocationStatus(text('Старт указан вручную', 'Бастау нүктесі қолмен таңдалды', 'Start set manually'));
    reverseLookupPoint.current = point;
    void reverseMapLocation(point, locale).then(setResolvedLocation).catch(() => undefined);
  }

  function recenterOnRider() {
    if (!riderLocation) {
      setLocationStatus(text('Повторно ищем GPS…', 'GPS қайта ізделуде…', 'Trying GPS again…'));
      setLocationAttempt((current) => current + 1);
      return;
    }
    setRoutingOrigin(riderLocation);
    setRecenterRequest({ point: { ...riderLocation }, id: Date.now() });
  }

  function startNavigation() {
    if (!activeRoute || !riderLocation) return;
    setNavigationActive(true);
    setRoutingOrigin({ ...riderLocation });
  }

  function saveRoute() {
    if (!activeRoute || !routingOrigin || !destination) return;
    saveMapRouteDraft({
      title: `${text('Маршрут до', 'Бағыт:', 'Route to')} ${destination.name}`,
      region: resolvedLocation?.city || resolvedLocation?.country || '',
      waypoints: [routingOrigin, { lat: destination.lat, lng: destination.lng }],
      snappedWaypoints: activeRoute.result.snappedWaypoints,
      points: activeRoute.result.points,
      elevationGainM: activeRoute.result.elevationGainM,
    });
    navigate('/routes/new');
  }

  function resetRoute() {
    setNavigationActive(false);
    clearMapNavigation();
    setDestination(null);
    setRouteOptions([]);
    setRouteError('');
    setQuery('');
  }

  const focusPoint = destination ?? riderLocation;
  const visibleRoute = activeRoute?.result.points ?? [];
  const totalMinutes = activeRoute ? estimatedRideMinutes(activeRoute.result) : 0;
  const remainingRatio = activeRoute && progress
    ? Math.min(1, progress.remainingM / Math.max(activeRoute.result.distanceKm * 1000, 1))
    : 1;
  const remainingClimbM = activeRoute ? Math.round(activeRoute.result.elevationGainM * remainingRatio) : 0;
  const remainingMinutes = activeRoute && progress
    ? estimatedRideMinutes(activeRoute.result, (progress.remainingM + destinationRoadGapM) / 1000, remainingClimbM)
    : totalMinutes;
  const displayedRemainingM = progress
    ? progress.remainingM + (progress.remainingM < 30 && directDestinationDistanceM !== null
      ? directDestinationDistanceM
      : destinationRoadGapM)
    : 0;

  const quickSearches = [
    { label: text('Кофе', 'Кофе', 'Coffee'), query: text('кофейня', 'кофехана', 'coffee shop'), icon: Utensils },
    { label: text('Парки', 'Саябақтар', 'Parks'), query: text('парк', 'саябақ', 'park'), icon: Trees },
    { label: text('Интересные места', 'Көрікті жерлер', 'Things to see'), query: text('достопримечательность', 'көрікті жер', 'tourist attraction'), icon: Landmark },
    { label: text('Веломастерские', 'Велошеберханалар', 'Bike repair'), query: text('веломастерская', 'велошеберхана', 'bike repair'), icon: Wrench },
  ];

  return <section className={`city-explore global-city-map${navigationActive ? ' navigation-active' : ''}${hazardPickMode ? ' safety-pick-mode' : ''}`}>
    <div className="city-map-layout global-map-layout">
      <div className="global-map-search">
        <div className="map-place-search">
          <Search size={19} aria-hidden="true" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={destination ? text('Куда теперь?', 'Енді қайда?', 'Where next?') : text('Куда поедем? Адрес или место', 'Қайда барамыз? Мекенжай не орын', 'Where to? Address or place')} aria-label={text('Поиск адреса или места', 'Мекенжайды не орынды іздеу', 'Search address or place')} autoComplete="off" />
          {query && <button type="button" aria-label={text('Очистить поиск', 'Іздеуді тазарту', 'Clear search')} onClick={() => setQuery('')}><X size={16} /></button>}
          {(searching || searchResults.length > 0) && <div className="map-search-results">
            {searching && <p>{text('Сначала ищем рядом с тобой…', 'Алдымен маңайыңнан іздейміз…', 'Searching nearby first…')}</p>}
            {!searching && searchResults.map((place, index) => <button type="button" key={place.id} onClick={() => chooseDestination(place)}><MapPin size={16} /><span><strong>{place.name}{index === 0 && <em>{text('Рядом', 'Жақын', 'Nearby')}</em>}</strong><small>{place.subtitle}</small></span></button>)}
          </div>}
        </div>
        <div className="rider-location-strip"><span><Bike size={17} /></span><div><strong>{resolvedLocation?.label || text('Твоё местоположение', 'Сенің орналасқан жерің', 'Your location')}</strong><small>{locationStatus}</small></div><button type="button" onClick={recenterOnRider} aria-label={text('Показать моё местоположение', 'Орналасқан жерімді көрсету', 'Show my location')}><LocateFixed size={18} /></button></div>
        {!destination && <div className="map-quick-searches">{quickSearches.map(({ label, query: quickQuery, icon: Icon }) => <button type="button" key={label} onClick={() => setQuery(quickQuery)}><Icon size={14} />{label}</button>)}</div>}
      </div>
      <div className="city-map-canvas global-map-canvas" role="region" aria-label={text('Интерактивная велосипедная карта', 'Интерактивті велосипед картасы', 'Interactive cycling map')}>
        <MapContainer center={[20, 0]} zoom={3} minZoom={2} maxZoom={18} zoomSnap={0.125} zoomDelta={0.25} wheelPxPerZoomLevel={360} touchZoom="center" scrollWheelZoom zoomControl={false} className="city-leaflet-map global-leaflet-map">
          <CommunityTileLayer showSwitcher />
          {!navigationActive && <ZoomControl position="bottomright" />}
          <StartPicker enabled={!riderLocation && !hazardPickMode} onPick={chooseManualStart} />
          <HazardPointPicker enabled={hazardPickMode} onPick={onPickHazardLocation} />
          <MapViewport focus={focusPoint} route={visibleRoute} recenterRequest={recenterRequest} navigationActive={navigationActive} />
          <NavigationCamera active={navigationActive} rider={riderLocation} />
          <HazardLayer
            hazards={hazards}
            busyHazardId={busyHazardId}
            interactive={!hazardPickMode && !navigationActive}
            canResolve={(hazard) => hazard.reporterId === currentUserId}
            onConfirm={onConfirmHazard}
            onUnconfirm={onUnconfirmHazard}
            onResolve={onResolveHazard}
          />
          {riderLocation && <Marker position={[riderLocation.lat, riderLocation.lng]} icon={navigationActive ? navigationRiderIcon : riderIcon} interactive={!hazardPickMode} keyboard={!hazardPickMode} zIndexOffset={1000}><Popup>{text('Твоё текущее местоположение', 'Сенің қазіргі орналасқан жерің', 'Your current location')}</Popup></Marker>}
          {destination && <Marker position={[destination.lat, destination.lng]} icon={destinationIcon} interactive={!hazardPickMode} keyboard={!hazardPickMode} zIndexOffset={900}><Popup><strong>{destination.name}</strong><br />{destination.subtitle}</Popup></Marker>}
          {destination && snappedDestination && destinationRoadGapM >= 8 && <Polyline
            positions={[[snappedDestination.lat, snappedDestination.lng], [destination.lat, destination.lng]]}
            interactive={false}
            pathOptions={{ color: '#f8fbff', opacity: .76, weight: 3, dashArray: '3 7', lineCap: 'round' }}
          />}
          {routeOptions.map((option) => activePreference === option.preference
            ? <DirectionalRouteLine
              key={option.preference}
              points={option.result.points}
              color="#2f6f55"
              weight={navigationActive ? 9 : 7}
              opacity={0.98}
              showArrows
              maxArrows={navigationActive ? 24 : 16}
              interactive={!hazardPickMode && !navigationActive}
              onClick={() => !navigationActive && setActivePreference(option.preference)}
            />
            : <Polyline
              key={option.preference}
              positions={option.result.points.map((point) => [point.lat, point.lng] as [number, number])}
              interactive={!hazardPickMode && !navigationActive}
              pathOptions={{ color: '#9078d6', weight: 4, opacity: navigationActive ? 0 : 0.45, lineCap: 'round', lineJoin: 'round' }}
              eventHandlers={{ click: () => !navigationActive && setActivePreference(option.preference) }}
            />)}
        </MapContainer>
        {!riderLocation && !hazardPickMode && <div className="map-start-hint"><MapPin size={16} />{text('Нажми на карту, чтобы указать старт', 'Бастау нүктесін таңдау үшін картаны бас', 'Tap the map to set a start')}</div>}
        {hazardPickMode && <div className="safety-map-pick-hint" role="status"><MapPin size={17} /><span>{text('Нажми на место или выбери центр карты клавишей Enter', 'Орынды бас немесе Enter арқылы карта ортасын таңда', 'Tap the place or press Enter to use the map center')}</span><button type="button" aria-label={text('Отменить выбор точки', 'Нүкте таңдаудан бас тарту', 'Cancel location picking')} onClick={onOpenHazardReport}><X size={16} aria-hidden="true" /></button></div>}
        {!hazardPickMode && <button type="button" className={`safety-report-trigger${navigationActive ? ' is-navigation' : ''}`} onClick={onOpenHazardReport}><AlertTriangle size={18} aria-hidden="true" /><span>{text('Сообщить об опасности', 'Қауіп туралы хабарлау', 'Report hazard')}</span></button>}

        {navigationActive && instruction && destination && <div className="navigation-instruction-card" role="status">
          <span className={`navigation-turn ${instruction.turn}`}><Navigation size={30} /></span>
          <div><strong>{instruction.text}</strong><small>{instruction.distanceM > 15 ? `${text('через', 'кейін', 'in')} ${formatDistance(instruction.distanceM, locale)}` : instruction.turn === 'finish' ? destination.name : text('сейчас', 'қазір', 'now')}</small></div>
        </div>}

        {navigationActive && upcomingHazard && <div className="safety-navigation-warning" role="status" aria-live="polite" aria-label={text('Опасность впереди. Снизь скорость.', 'Алда қауіп бар. Жылдамдықты азайт.', 'Hazard ahead. Slow down.')}>
          <span aria-hidden="true"><AlertTriangle size={22} /></span>
          <div aria-hidden="true"><strong>{text('Опасность впереди', 'Алда қауіп бар', 'Hazard ahead')}</strong><small>{Math.round(upcomingHazard.riderDistanceM)} {text('м', 'м', 'm')} · {text('снизь скорость', 'жылдамдықты азайт', 'slow down')}</small></div>
          <b aria-hidden="true">{upcomingHazard.hazard.confirmations}</b>
        </div>}

        {navigationActive && activeRoute && progress && <div className="navigation-bottom-sheet">
          <div className="navigation-live-metrics">
            <span><strong>{formatDistance(displayedRemainingM, locale)}</strong><small>{text('осталось', 'қалды', 'remaining')}</small></span>
            <span><strong>↑ {remainingClimbM} {text('м', 'м', 'm')}</strong><small>{text('подъём', 'өрлеу', 'climb')}</small></span>
            <span><strong>{arrivalTime(remainingMinutes, locale)}</strong><small>{text('прибытие', 'келу', 'arrival')}</small></span>
            <span><strong>{currentSpeedKmh === null ? '—' : currentSpeedKmh.toFixed(1)}</strong><small>{text('км/ч', 'км/сағ', 'km/h')}</small></span>
          </div>
          {routing && <p className="navigation-rerouting"><RefreshCw size={14} />{text('Перестраиваем маршрут по улицам…', 'Бағытты көшелермен қайта құрып жатырмыз…', 'Rerouting on streets…')}</p>}
          <button type="button" className="navigation-stop-button" onClick={() => setNavigationActive(false)}><Square size={15} />{text('Завершить', 'Аяқтау', 'Finish')}</button>
        </div>}
      </div>

      <aside className="city-map-panel global-route-panel">
        <div className="map-panel-heading"><span><Navigation size={19} /></span><div><p className="kicker">{text('Маршрут по улицам', 'Көшелермен бағыт', 'Street route')}</p><h2>{destination ? destination.name : text('Выбери место', 'Орынды таңда', 'Choose a place')}</h2></div>{destination && <button type="button" className="route-new-destination" onClick={resetRoute}><X size={17} /><span>{text('Новый', 'Жаңа', 'New')}</span></button>}</div>
        {!destination ? <>
          <p className="map-panel-copy">{text('Введи любой адрес, кафе, парк или достопримечательность. Сначала покажем места рядом с тобой.', 'Кез келген мекенжайды, кофехананы, саябақты не көрікті жерді енгіз. Алдымен жақын орындарды көрсетеміз.', 'Enter any address, café, park or attraction. Nearby results appear first.')}</p>
          <div className="map-panel-tip"><Bike size={18} /><span><strong>{text('Твоя позиция показана велосипедом', 'Орналасқан жерің велосипедпен көрсетіледі', 'Your position is shown as a bicycle')}</strong><small>{text('Маркер обновляется по GPS во время движения.', 'Қозғалыс кезінде белгі GPS арқылы жаңарады.', 'The marker updates from GPS while you ride.')}</small></span></div>
          <div className="map-panel-tip"><Route size={18} /><span><strong>{text('Только реальные улицы', 'Тек нақты көшелер', 'Real streets only')}</strong><small>{text('Оба варианта проходят по дорожной сети.', 'Екі нұсқа да жол желісімен өтеді.', 'Both alternatives follow the street network.')}</small></span></div>
        </> : <>
          <div className="route-addresses"><div><span className="route-address-marker start">A</span><p><small>{text('Откуда', 'Қайдан', 'From')}</small><strong>{resolvedLocation?.label || text('Моё местоположение', 'Менің орналасқан жерім', 'My location')}</strong></p></div><div><span className="route-address-marker finish">B</span><p><small>{text('Куда', 'Қайда', 'To')}</small><strong>{destination.name}</strong></p></div></div>
          {routing && <p className="route-build-status">{text('Ищем два лучших пути по улицам…', 'Көшелермен екі үздік бағытты іздеп жатырмыз…', 'Finding the two best street routes…')}</p>}
          {routeError && <p className="form-note" role="alert">{routeError}</p>}
          {activeRoute && destinationRoadGapM >= 20 && <p className="route-snap-notice" role="status"><MapPin size={15} />{text(`Точка находится в ${Math.round(destinationRoadGapM)} м от доступной дороги. Пунктиром показан последний отрезок.`, `Нүкте қолжетімді жолдан ${Math.round(destinationRoadGapM)} м жерде. Соңғы бөлік үзік сызықпен көрсетілген.`, `The place is ${Math.round(destinationRoadGapM)} m from the nearest routable road. The final link is dashed.`)}</p>}
          {routeOptions.length > 0 && <div className="route-option-list">{routeOptions.map((option) => {
            const copy = preferenceCopy(option.preference, text);
            const Icon = copy.icon;
            const duration = estimatedRideMinutes(option.result);
            const safety = routeSafety.get(option.preference) ?? { hazards: [], score: 100 };
            return <button type="button" aria-pressed={activePreference === option.preference} className={activePreference === option.preference ? 'active' : ''} key={option.preference} onClick={() => setActivePreference(option.preference)}><Icon size={19} /><span><strong>{copy.title}</strong><small>{copy.description}</small><em className={`route-safety-score${safety.score < 70 ? ' is-caution' : ''}`}><ShieldCheck size={12} />{safety.score}/100 · {safety.hazards.length ? `${safety.hazards.length} ${text('опасн.', 'қауіп', 'hazards')}` : text('путь чист', 'жол таза', 'clear')}</em></span><b>{formatDistance(option.result.distanceKm * 1000, locale)}<small>≈ {duration} {text('мин', 'мин', 'min')} · ↑ {Math.round(option.result.elevationGainM)} {text('м', 'м', 'm')}</small></b></button>;
          })}</div>}
          {activeRoute && <div className="route-navigation-summary">
            <span><Route size={17} /><small>{text('Путь', 'Жол', 'Distance')}</small><strong>{formatDistance(activeRoute.result.distanceKm * 1000, locale)}</strong></span>
            <span><Mountain size={17} /><small>{text('Подъём', 'Өрлеу', 'Climb')}</small><strong>{Math.round(activeRoute.result.elevationGainM)} {text('м', 'м', 'm')}</strong></span>
            <span><Clock3 size={17} /><small>{text('В дороге', 'Жолда', 'Ride time')}</small><strong>≈ {totalMinutes} {text('мин', 'мин', 'min')}</strong></span>
            <span><Gauge size={17} /><small>{text('Прибытие', 'Келу', 'Arrival')}</small><strong>{arrivalTime(totalMinutes, locale)}</strong></span>
          </div>}
          {activeRoute && <div className={`route-safety-summary${(routeSafety.get(activeRoute.preference)?.score ?? 100) < 70 ? ' is-caution' : ''}`}>
            <ShieldCheck size={18} aria-hidden="true" />
            <span><strong>{text('Safety Score', 'Safety Score', 'Safety Score')} {routeSafety.get(activeRoute.preference)?.score ?? 100}/100</strong><small>{(routeSafety.get(activeRoute.preference)?.hazards.length ?? 0) === 0
              ? text('На пути нет свежих отметок сообщества.', 'Жолда қауымдастықтың жаңа белгілері жоқ.', 'No fresh community reports are on this route.')
              : text(`Опасностей рядом с путём: ${routeSafety.get(activeRoute.preference)?.hazards.length ?? 0}.`, `Бағыт маңындағы қауіптер: ${routeSafety.get(activeRoute.preference)?.hazards.length ?? 0}.`, `${routeSafety.get(activeRoute.preference)?.hazards.length ?? 0} hazards are close to this route.`)}</small></span>
          </div>}
          <button type="button" className="start-navigation-button" disabled={!activeRoute || !riderLocation || routing} onClick={startNavigation}><Play size={19} fill="currentColor" />{text('В путь', 'Жолға шығу', 'Start')}</button>
          <div className="map-panel-actions global-route-actions"><button type="button" className="outline-inline-button" disabled={!riderLocation || routing} onClick={() => riderLocation && setRoutingOrigin({ ...riderLocation })}><RefreshCw size={16} />{text('Перестроить', 'Қайта құру', 'Reroute')}</button><button type="button" className="signal-button" disabled={!activeRoute || routing} onClick={saveRoute}>{text('Сохранить маршрут', 'Бағытты сақтау', 'Save route')}</button></div>
          <button type="button" className="quiet-button map-clear-route" onClick={resetRoute}>{text('Выбрать другое место', 'Басқа орынды таңдау', 'Choose another place')}</button>
        </>}
      </aside>
    </div>
    <small className="map-attribution-note">{text('Карта и адреса:', 'Карта мен мекенжайлар:', 'Map and addresses:')} <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap contributors</a>. {text('Веломаршруты:', 'Велобағыттар:', 'Bike routing:')} openrouteservice / BRouter.</small>
  </section>;
}
