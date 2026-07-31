import type { RideActivity } from './cyclingModels';

export type CoachGoal = 'consistency' | 'endurance' | 'speed' | 'distance';
export type CoachIntensity = 'recovery' | 'easy' | 'moderate' | 'hard';

export type CoachSummary = {
  ridesCount28Days: number;
  distanceKm28Days: number;
  durationMinutes28Days: number;
  elevationGainM28Days: number;
  averageSpeedKmh28Days: number | null;
  ridesCount7Days: number;
  distanceKm7Days: number;
  durationMinutes7Days: number;
  load7Days: number;
  previousLoad7Days: number;
  loadTrendPercent: number;
  daysSinceLastRide: number | null;
  readinessScore: number;
  readinessLabel: string;
  enoughData: boolean;
};

export type CoachAdvice = {
  headline: string;
  summary: string;
  readinessExplanation: string;
  nextWorkout: {
    title: string;
    durationMinutes: number;
    intensity: CoachIntensity;
    description: string;
  };
  focus: string[];
  caution: string;
  source: 'local' | 'ai';
};

type DatedRide = { ride: RideActivity; timestamp: number };

const dayMs = 24 * 60 * 60 * 1000;

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function rounded(value: number, digits = 0): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function rideTimestamp(ride: RideActivity): number {
  const value = new Date(`${ride.rideDate}T12:00:00`).getTime();
  return Number.isFinite(value) ? value : new Date(ride.createdAt).getTime();
}

function rideDurationMinutes(ride: RideActivity): number {
  return Math.max(0, (ride.movingTimeSeconds ?? ride.durationSeconds) / 60);
}

function trainingLoad(ride: RideActivity): number {
  return ride.distanceKm * 1.6 + rideDurationMinutes(ride) * 0.35 + ride.elevationGainM / 30;
}

function aggregate(rides: RideActivity[]) {
  const durationMinutes = rides.reduce((total, ride) => total + rideDurationMinutes(ride), 0);
  const distanceKm = rides.reduce((total, ride) => total + ride.distanceKm, 0);
  const elevationGainM = rides.reduce((total, ride) => total + ride.elevationGainM, 0);
  const speedMinutes = rides.reduce((total, ride) => {
    const speed = ride.averageSpeedKmh;
    return speed && speed > 0 ? total + speed * rideDurationMinutes(ride) : total;
  }, 0);
  const speedDuration = rides.reduce((total, ride) => ride.averageSpeedKmh && ride.averageSpeedKmh > 0
    ? total + rideDurationMinutes(ride)
    : total, 0);
  return {
    ridesCount: rides.length,
    distanceKm,
    durationMinutes,
    elevationGainM,
    averageSpeedKmh: speedDuration > 0 ? speedMinutes / speedDuration : null,
    load: rides.reduce((total, ride) => total + trainingLoad(ride), 0),
  };
}

export function summarizeCoachRides(rides: RideActivity[], feeling: number, now = new Date()): CoachSummary {
  const nowTimestamp = now.getTime();
  const dated = rides
    .map((ride): DatedRide => ({ ride, timestamp: rideTimestamp(ride) }))
    .filter(({ timestamp }) => Number.isFinite(timestamp) && timestamp <= nowTimestamp + dayMs);
  const recent28 = dated.filter(({ timestamp }) => timestamp >= nowTimestamp - 28 * dayMs).map(({ ride }) => ride);
  const recent7 = dated.filter(({ timestamp }) => timestamp >= nowTimestamp - 7 * dayMs).map(({ ride }) => ride);
  const previous7 = dated
    .filter(({ timestamp }) => timestamp >= nowTimestamp - 14 * dayMs && timestamp < nowTimestamp - 7 * dayMs)
    .map(({ ride }) => ride);
  const totals28 = aggregate(recent28);
  const totals7 = aggregate(recent7);
  const previousTotals7 = aggregate(previous7);
  const latestTimestamp = dated.reduce((latest, item) => Math.max(latest, item.timestamp), 0);
  const daysSinceLastRide = latestTimestamp
    ? Math.max(0, Math.floor((nowTimestamp - latestTimestamp) / dayMs))
    : null;
  const loadTrendPercent = previousTotals7.load > 0
    ? (totals7.load - previousTotals7.load) / previousTotals7.load * 100
    : totals7.load > 0 ? 100 : 0;

  let readiness = 68 + (clamp(feeling, 1, 5) - 3) * 8;
  if (daysSinceLastRide === 0) readiness -= 14;
  else if (daysSinceLastRide === 1) readiness += 2;
  else if (daysSinceLastRide !== null && daysSinceLastRide >= 2) readiness += 7;
  if (loadTrendPercent > 40) readiness -= 17;
  else if (loadTrendPercent > 15) readiness -= 8;
  if (totals7.durationMinutes > 300) readiness -= 7;
  if (!dated.length) readiness = 72;
  readiness = Math.round(clamp(readiness, 25, 95));

  const readinessLabel = readiness >= 78
    ? 'Готов к тренировке'
    : readiness >= 58
      ? 'Умеренная готовность'
      : 'Лучше восстановиться';

  return {
    ridesCount28Days: totals28.ridesCount,
    distanceKm28Days: rounded(totals28.distanceKm, 1),
    durationMinutes28Days: Math.round(totals28.durationMinutes),
    elevationGainM28Days: Math.round(totals28.elevationGainM),
    averageSpeedKmh28Days: totals28.averageSpeedKmh === null ? null : rounded(totals28.averageSpeedKmh, 1),
    ridesCount7Days: totals7.ridesCount,
    distanceKm7Days: rounded(totals7.distanceKm, 1),
    durationMinutes7Days: Math.round(totals7.durationMinutes),
    load7Days: Math.round(totals7.load),
    previousLoad7Days: Math.round(previousTotals7.load),
    loadTrendPercent: Math.round(loadTrendPercent),
    daysSinceLastRide,
    readinessScore: readiness,
    readinessLabel,
    enoughData: recent28.length >= 3,
  };
}

function workoutFor(summary: CoachSummary, goal: CoachGoal, feeling: number): CoachAdvice['nextWorkout'] {
  if (feeling <= 2 || summary.readinessScore < 50 || summary.loadTrendPercent > 45) {
    return {
      title: 'Восстановительная поездка',
      durationMinutes: 30,
      intensity: 'recovery',
      description: 'Ровный маршрут в разговорном темпе. Не гонись за скоростью и избегай длинных подъёмов.',
    };
  }
  if (!summary.ridesCount28Days) {
    return {
      title: 'Спокойный старт',
      durationMinutes: 35,
      intensity: 'easy',
      description: 'Начни с лёгкого маршрута на 8–12 км и оставь запас сил в конце поездки.',
    };
  }
  if (goal === 'speed' && summary.readinessScore >= 72) {
    return {
      title: 'Короткие ускорения',
      durationMinutes: 50,
      intensity: 'moderate',
      description: 'После разминки сделай 5 ускорений по 2 минуты, между ними катись легко по 3 минуты.',
    };
  }
  if (goal === 'distance' || goal === 'endurance') {
    return {
      title: 'Ровная тренировка на выносливость',
      durationMinutes: summary.readinessScore >= 75 ? 75 : 55,
      intensity: summary.readinessScore >= 75 ? 'moderate' : 'easy',
      description: 'Держи устойчивый темп без резких ускорений и выбери маршрут с удобным возвращением домой.',
    };
  }
  return {
    title: 'Поддерживающая поездка',
    durationMinutes: 45,
    intensity: 'easy',
    description: 'Спокойная тренировка, после которой должно оставаться ощущение, что мог проехать ещё немного.',
  };
}

export function buildLocalCoachAdvice(summary: CoachSummary, goal: CoachGoal, feeling: number): CoachAdvice {
  const nextWorkout = workoutFor(summary, goal, feeling);
  const trendCopy = summary.loadTrendPercent > 25
    ? `Недельная нагрузка выросла на ${summary.loadTrendPercent}%.`
    : summary.loadTrendPercent < -25
      ? `Недельная нагрузка снизилась на ${Math.abs(summary.loadTrendPercent)}%.`
      : 'Недельная нагрузка меняется плавно.';
  const dataCopy = summary.enoughData
    ? `За 28 дней записано ${summary.ridesCount28Days} поездок и ${summary.distanceKm28Days.toFixed(1)} км.`
    : 'Для точной персонализации нужно хотя бы три сохранённые поездки.';
  return {
    headline: summary.readinessLabel,
    summary: `${dataCopy} ${trendCopy}`,
    readinessExplanation: feeling <= 2
      ? 'Самочувствие сейчас важнее плана — нагрузку лучше снизить.'
      : `Готовность рассчитана по недавним поездкам, паузе между ними и твоей оценке самочувствия.`,
    nextWorkout,
    focus: [
      nextWorkout.intensity === 'recovery' ? 'Дыши свободно и не соревнуйся с темпом' : 'Начни с 8–10 минут лёгкой разминки',
      'Возьми воду и проверь тормоза перед выездом',
      'После поездки снова оцени самочувствие',
    ],
    caution: 'Это спортивная подсказка, а не медицинская рекомендация. При боли, головокружении или плохом самочувствии остановись и обратись к взрослому или врачу.',
    source: 'local',
  };
}

function isCoachIntensity(value: unknown): value is CoachIntensity {
  return value === 'recovery' || value === 'easy' || value === 'moderate' || value === 'hard';
}

function isCoachAdvice(value: unknown): value is Omit<CoachAdvice, 'source'> {
  if (typeof value !== 'object' || value === null) return false;
  const item = value as Record<string, unknown>;
  const workout = item.nextWorkout;
  return typeof item.headline === 'string'
    && typeof item.summary === 'string'
    && typeof item.readinessExplanation === 'string'
    && Array.isArray(item.focus)
    && item.focus.every((entry) => typeof entry === 'string')
    && typeof item.caution === 'string'
    && typeof workout === 'object'
    && workout !== null
    && typeof (workout as Record<string, unknown>).title === 'string'
    && typeof (workout as Record<string, unknown>).durationMinutes === 'number'
    && isCoachIntensity((workout as Record<string, unknown>).intensity)
    && typeof (workout as Record<string, unknown>).description === 'string';
}

export async function requestAiCoachAdvice(
  summary: CoachSummary,
  goal: CoachGoal,
  feeling: number,
  accessToken: string,
): Promise<CoachAdvice> {
  const response = await fetch('/api/coach/analyze', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${accessToken}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ summary, goal, feeling }),
  });
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message = typeof payload === 'object' && payload !== null && typeof (payload as Record<string, unknown>).error === 'string'
      ? (payload as Record<string, string>).error
      : 'ИИ-тренер пока не ответил.';
    throw new Error(message);
  }
  if (!isCoachAdvice(payload)) throw new Error('ИИ-тренер вернул неполный ответ.');
  return { ...payload, source: 'ai' };
}
