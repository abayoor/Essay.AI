import type { Locale, RideActivity } from './cyclingModels';
import { localeValue } from './localized';

export type CoachGoal = 'consistency' | 'endurance' | 'speed' | 'distance';
export type CoachIntensity = 'recovery' | 'easy' | 'moderate' | 'hard';
export type CoachConfidence = 'low' | 'medium' | 'high';

export type CoachRideSample = {
  daysAgo: number;
  distanceKm: number;
  durationMinutes: number;
  elevationGainM: number;
  averageSpeedKmh: number | null;
};

export type CoachSummary = {
  ridesCount28Days: number;
  distanceKm28Days: number;
  durationMinutes28Days: number;
  elevationGainM28Days: number;
  averageSpeedKmh28Days: number | null;
  longestRideKm28Days: number;
  averageRideDistanceKm28Days: number;
  elevationMPer10Km28Days: number;
  activeDays28Days: number;
  ridesCount7Days: number;
  distanceKm7Days: number;
  durationMinutes7Days: number;
  load7Days: number;
  previousLoad7Days: number;
  loadTrendPercent: number;
  speedTrendPercent: number | null;
  acuteChronicRatio: number;
  daysSinceLastRide: number | null;
  readinessScore: number;
  enoughData: boolean;
  recentRides: CoachRideSample[];
};

export type CoachWorkout = {
  title: string;
  durationMinutes: number;
  intensity: CoachIntensity;
  description: string;
};

export type CoachAdvice = {
  headline: string;
  summary: string;
  readinessExplanation: string;
  trainingInsight: string;
  nextWorkout: CoachWorkout;
  weeklyPlan: (CoachWorkout & { order: number; purpose: string })[];
  focus: string[];
  watchMetric: string;
  confidence: CoachConfidence;
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
    .filter(({ timestamp }) => Number.isFinite(timestamp) && timestamp <= nowTimestamp + dayMs)
    .sort((first, second) => second.timestamp - first.timestamp);
  const recent28Dated = dated.filter(({ timestamp }) => timestamp >= nowTimestamp - 28 * dayMs);
  const recent28 = recent28Dated.map(({ ride }) => ride);
  const recent7 = dated.filter(({ timestamp }) => timestamp >= nowTimestamp - 7 * dayMs).map(({ ride }) => ride);
  const previous7 = dated
    .filter(({ timestamp }) => timestamp >= nowTimestamp - 14 * dayMs && timestamp < nowTimestamp - 7 * dayMs)
    .map(({ ride }) => ride);
  const totals28 = aggregate(recent28);
  const totals7 = aggregate(recent7);
  const previousTotals7 = aggregate(previous7);
  const latestTimestamp = dated[0]?.timestamp ?? 0;
  const daysSinceLastRide = latestTimestamp ? Math.max(0, Math.floor((nowTimestamp - latestTimestamp) / dayMs)) : null;
  const loadTrendPercent = previousTotals7.load > 0
    ? (totals7.load - previousTotals7.load) / previousTotals7.load * 100
    : totals7.load > 0 ? 100 : 0;
  const speedTrendPercent = totals7.averageSpeedKmh !== null && previousTotals7.averageSpeedKmh !== null && previousTotals7.averageSpeedKmh > 0
    ? (totals7.averageSpeedKmh - previousTotals7.averageSpeedKmh) / previousTotals7.averageSpeedKmh * 100
    : null;
  const weeklyBaselineLoad = totals28.load / 4;
  const acuteChronicRatio = weeklyBaselineLoad > 0 ? totals7.load / weeklyBaselineLoad : totals7.load > 0 ? 1 : 0;

  let readiness = 68 + (clamp(feeling, 1, 5) - 3) * 8;
  if (daysSinceLastRide === 0) readiness -= 14;
  else if (daysSinceLastRide === 1) readiness += 2;
  else if (daysSinceLastRide !== null && daysSinceLastRide >= 2) readiness += 7;
  if (loadTrendPercent > 40 || acuteChronicRatio > 1.45) readiness -= 17;
  else if (loadTrendPercent > 15 || acuteChronicRatio > 1.2) readiness -= 8;
  if (totals7.durationMinutes > 300) readiness -= 7;
  if (!dated.length) readiness = 72;
  readiness = Math.round(clamp(readiness, 25, 95));

  const activeDays = new Set(recent28Dated.map(({ timestamp }) => new Date(timestamp).toISOString().slice(0, 10))).size;
  const longestRide = recent28.reduce((longest, ride) => Math.max(longest, ride.distanceKm), 0);

  return {
    ridesCount28Days: totals28.ridesCount,
    distanceKm28Days: rounded(totals28.distanceKm, 1),
    durationMinutes28Days: Math.round(totals28.durationMinutes),
    elevationGainM28Days: Math.round(totals28.elevationGainM),
    averageSpeedKmh28Days: totals28.averageSpeedKmh === null ? null : rounded(totals28.averageSpeedKmh, 1),
    longestRideKm28Days: rounded(longestRide, 1),
    averageRideDistanceKm28Days: totals28.ridesCount ? rounded(totals28.distanceKm / totals28.ridesCount, 1) : 0,
    elevationMPer10Km28Days: totals28.distanceKm ? Math.round(totals28.elevationGainM / totals28.distanceKm * 10) : 0,
    activeDays28Days: activeDays,
    ridesCount7Days: totals7.ridesCount,
    distanceKm7Days: rounded(totals7.distanceKm, 1),
    durationMinutes7Days: Math.round(totals7.durationMinutes),
    load7Days: Math.round(totals7.load),
    previousLoad7Days: Math.round(previousTotals7.load),
    loadTrendPercent: Math.round(loadTrendPercent),
    speedTrendPercent: speedTrendPercent === null ? null : Math.round(speedTrendPercent),
    acuteChronicRatio: rounded(acuteChronicRatio, 2),
    daysSinceLastRide,
    readinessScore: readiness,
    enoughData: recent28.length >= 3,
    recentRides: dated.slice(0, 6).map(({ ride, timestamp }) => ({
      daysAgo: Math.max(0, Math.floor((nowTimestamp - timestamp) / dayMs)),
      distanceKm: rounded(ride.distanceKm, 1),
      durationMinutes: Math.round(rideDurationMinutes(ride)),
      elevationGainM: Math.round(ride.elevationGainM),
      averageSpeedKmh: ride.averageSpeedKmh === null ? null : rounded(ride.averageSpeedKmh, 1),
    })),
  };
}

export function readinessLabel(summary: CoachSummary, locale: Locale): string {
  if (summary.readinessScore >= 78) return localeValue(locale, { ru: 'Готов к тренировке', kz: 'Жаттығуға дайын', en: 'Ready to train' });
  if (summary.readinessScore >= 58) return localeValue(locale, { ru: 'Умеренная готовность', kz: 'Орташа дайындық', en: 'Moderate readiness' });
  return localeValue(locale, { ru: 'Лучше восстановиться', kz: 'Қалпына келген дұрыс', en: 'Recovery is best' });
}

function workoutFor(summary: CoachSummary, goal: CoachGoal, feeling: number, locale: Locale): CoachWorkout {
  if (feeling <= 2 || summary.readinessScore < 50 || summary.acuteChronicRatio > 1.45) {
    return {
      title: localeValue(locale, { ru: 'Восстановительная поездка', kz: 'Қалпына келу сапары', en: 'Recovery ride' }),
      durationMinutes: 30,
      intensity: 'recovery',
      description: localeValue(locale, {
        ru: 'Ровный маршрут в разговорном темпе. Избегай ускорений и длинных подъёмов.',
        kz: 'Тегіс бағытта еркін сөйлесе алатын қарқында жүр. Үдеулер мен ұзақ өрлерден аулақ бол.',
        en: 'Choose a flat route at a conversational pace. Avoid hard efforts and long climbs.',
      }),
    };
  }
  if (!summary.ridesCount28Days) {
    return {
      title: localeValue(locale, { ru: 'Спокойный старт', kz: 'Жайлы бастау', en: 'Easy start' }),
      durationMinutes: 35,
      intensity: 'easy',
      description: localeValue(locale, {
        ru: 'Лёгкий маршрут на 8–12 км с запасом сил в конце.',
        kz: '8–12 км жеңіл бағытпен жүріп, соңына күш қалдыр.',
        en: 'Ride an easy 8–12 km route and finish with energy in reserve.',
      }),
    };
  }
  if (goal === 'speed' && summary.readinessScore >= 72) {
    return {
      title: localeValue(locale, { ru: 'Короткие ускорения', kz: 'Қысқа үдеулер', en: 'Short intervals' }),
      durationMinutes: 50,
      intensity: 'moderate',
      description: localeValue(locale, {
        ru: '10 минут разминки, затем 5 × 2 минуты быстро и по 3 минуты легко между ними.',
        kz: '10 минут қызын, кейін 5 × 2 минут жылдам жүріп, арасына 3 минут жеңіл қарқын қос.',
        en: 'Warm up for 10 minutes, then ride 5 × 2 minutes hard with 3 easy minutes between efforts.',
      }),
    };
  }
  if (goal === 'distance' || goal === 'endurance') {
    return {
      title: localeValue(locale, { ru: 'Ровная тренировка на выносливость', kz: 'Төзімділік жаттығуы', en: 'Steady endurance ride' }),
      durationMinutes: summary.readinessScore >= 75 ? 75 : 55,
      intensity: summary.readinessScore >= 75 ? 'moderate' : 'easy',
      description: localeValue(locale, {
        ru: 'Держи устойчивый темп без резких ускорений и выбери удобный путь домой.',
        kz: 'Кенет үдеусіз тұрақты қарқынды ұста және үйге қайтуы ыңғайлы бағытты таңда.',
        en: 'Hold a steady pace without surges and choose a route with an easy return home.',
      }),
    };
  }
  return {
    title: localeValue(locale, { ru: 'Поддерживающая поездка', kz: 'Қолдаушы сапар', en: 'Maintenance ride' }),
    durationMinutes: 45,
    intensity: 'easy',
    description: localeValue(locale, {
      ru: 'Спокойная тренировка с ощущением, что в конце осталось немного сил.',
      kz: 'Соңында аздап күш қалатындай жайлы жаттығу жаса.',
      en: 'Ride easily enough to finish feeling that you could still do a little more.',
    }),
  };
}

export function buildLocalCoachAdvice(summary: CoachSummary, goal: CoachGoal, feeling: number, locale: Locale): CoachAdvice {
  const nextWorkout = workoutFor(summary, goal, feeling, locale);
  const trend = summary.loadTrendPercent;
  const summaryText = localeValue(locale, {
    ru: summary.enoughData
      ? `За 28 дней: ${summary.ridesCount28Days} поездок, ${summary.distanceKm28Days.toFixed(1)} км. Нагрузка за неделю ${trend > 0 ? 'выросла' : 'снизилась'} на ${Math.abs(trend)}%.`
      : 'Для точной персонализации нужно хотя бы три сохранённые поездки.',
    kz: summary.enoughData
      ? `28 күнде: ${summary.ridesCount28Days} сапар, ${summary.distanceKm28Days.toFixed(1)} км. Апталық жүктеме ${trend > 0 ? 'өсті' : 'төмендеді'}: ${Math.abs(trend)}%.`
      : 'Дәл жекелеу үшін кемінде үш сақталған сапар қажет.',
    en: summary.enoughData
      ? `Last 28 days: ${summary.ridesCount28Days} rides and ${summary.distanceKm28Days.toFixed(1)} km. Weekly load ${trend > 0 ? 'rose' : 'fell'} by ${Math.abs(trend)}%.`
      : 'At least three saved rides are needed for precise personalization.',
  });
  const easyWorkout = workoutFor({ ...summary, readinessScore: 65 }, 'consistency', 3, locale);
  const longWorkout = workoutFor({ ...summary, readinessScore: Math.min(78, summary.readinessScore) }, 'endurance', 3, locale);

  return {
    headline: readinessLabel(summary, locale),
    summary: summaryText,
    readinessExplanation: localeValue(locale, {
      ru: feeling <= 2 ? 'Самочувствие сейчас важнее плана — нагрузку лучше снизить.' : 'Оценка учитывает последние поездки, паузу, резкий рост нагрузки и самочувствие.',
      kz: feeling <= 2 ? 'Қазір сезім жоспардан маңызды — жүктемені азайтқан дұрыс.' : 'Баға соңғы сапарларды, демалысты, жүктеменің күрт өсуін және сезіміңді ескереді.',
      en: feeling <= 2 ? 'How you feel matters more than the plan today, so reduce the load.' : 'The score considers recent rides, recovery time, sudden load changes and how you feel.',
    }),
    trainingInsight: localeValue(locale, {
      ru: `Самая длинная поездка — ${summary.longestRideKm28Days.toFixed(1)} км. Средняя — ${summary.averageRideDistanceKm28Days.toFixed(1)} км.`,
      kz: `Ең ұзақ сапар — ${summary.longestRideKm28Days.toFixed(1)} км. Орташа — ${summary.averageRideDistanceKm28Days.toFixed(1)} км.`,
      en: `Your longest ride was ${summary.longestRideKm28Days.toFixed(1)} km; the average was ${summary.averageRideDistanceKm28Days.toFixed(1)} km.`,
    }),
    nextWorkout,
    weeklyPlan: [
      { ...nextWorkout, order: 1, purpose: localeValue(locale, { ru: 'Главная тренировка недели', kz: 'Аптаның негізгі жаттығуы', en: 'Main session of the week' }) },
      { ...easyWorkout, order: 2, durationMinutes: Math.min(easyWorkout.durationMinutes, 40), purpose: localeValue(locale, { ru: 'Набрать объём без перегрузки', kz: 'Артық жүктемесіз көлем жинау', en: 'Build volume without overload' }) },
      { ...longWorkout, order: 3, purpose: localeValue(locale, { ru: 'Закрепить выносливость', kz: 'Төзімділікті бекіту', en: 'Reinforce endurance' }) },
    ],
    focus: [
      localeValue(locale, { ru: 'Начни с 8–10 минут лёгкой разминки', kz: '8–10 минут жеңіл қызынудан баста', en: 'Start with an easy 8–10 minute warm-up' }),
      localeValue(locale, { ru: 'Возьми воду и проверь тормоза', kz: 'Су ал және тежегіштерді тексер', en: 'Bring water and check your brakes' }),
      localeValue(locale, { ru: 'После поездки снова оцени самочувствие', kz: 'Сапардан кейін сезіміңді қайта бағала', en: 'Rate how you feel again after the ride' }),
    ],
    watchMetric: localeValue(locale, { ru: 'Следи, чтобы недельная нагрузка не росла резко.', kz: 'Апталық жүктеменің күрт өспеуін бақыла.', en: 'Keep weekly load from rising too sharply.' }),
    confidence: summary.ridesCount28Days >= 6 ? 'high' : summary.enoughData ? 'medium' : 'low',
    caution: localeValue(locale, {
      ru: 'Это спортивная подсказка, а не медицинская рекомендация. При боли, головокружении или плохом самочувствии остановись и обратись к взрослому или врачу.',
      kz: 'Бұл спорттық кеңес, медициналық ұсыныс емес. Ауырсыну, бас айналу немесе нашар сезім болса, тоқтап, ересекке не дәрігерге хабарлас.',
      en: 'This is training guidance, not medical advice. Stop and contact a trusted adult or doctor if you have pain, dizziness or feel unwell.',
    }),
    source: 'local',
  };
}

function isCoachIntensity(value: unknown): value is CoachIntensity {
  return value === 'recovery' || value === 'easy' || value === 'moderate' || value === 'hard';
}

function isWorkout(value: unknown): value is CoachWorkout {
  if (typeof value !== 'object' || value === null) return false;
  const workout = value as Record<string, unknown>;
  return typeof workout.title === 'string'
    && typeof workout.durationMinutes === 'number'
    && isCoachIntensity(workout.intensity)
    && typeof workout.description === 'string';
}

function isCoachAdvice(value: unknown): value is Omit<CoachAdvice, 'source'> {
  if (typeof value !== 'object' || value === null) return false;
  const item = value as Record<string, unknown>;
  return typeof item.headline === 'string'
    && typeof item.summary === 'string'
    && typeof item.readinessExplanation === 'string'
    && typeof item.trainingInsight === 'string'
    && isWorkout(item.nextWorkout)
    && Array.isArray(item.weeklyPlan)
    && item.weeklyPlan.length === 3
    && item.weeklyPlan.every((entry) => isWorkout(entry)
      && typeof (entry as Record<string, unknown>).order === 'number'
      && typeof (entry as Record<string, unknown>).purpose === 'string')
    && Array.isArray(item.focus)
    && item.focus.every((entry) => typeof entry === 'string')
    && typeof item.watchMetric === 'string'
    && (item.confidence === 'low' || item.confidence === 'medium' || item.confidence === 'high')
    && typeof item.caution === 'string';
}

export async function requestAiCoachAdvice(
  summary: CoachSummary,
  goal: CoachGoal,
  feeling: number,
  locale: Locale,
  accessToken: string,
): Promise<CoachAdvice> {
  const response = await fetch('/api/coach/analyze', {
    method: 'POST',
    headers: { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json' },
    body: JSON.stringify({ summary, goal, feeling, locale }),
  });
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const fallback = localeValue(locale, {
      ru: 'ИИ-тренер пока не ответил.',
      kz: 'AI жаттықтырушы әзірге жауап бермеді.',
      en: 'The AI coach did not respond.',
    });
    const message = typeof payload === 'object' && payload !== null && typeof (payload as Record<string, unknown>).error === 'string'
      ? (payload as Record<string, string>).error
      : fallback;
    throw new Error(message);
  }
  if (!isCoachAdvice(payload)) throw new Error(localeValue(locale, {
    ru: 'ИИ-тренер вернул неполный ответ.',
    kz: 'AI жаттықтырушы толық емес жауап берді.',
    en: 'The AI coach returned an incomplete response.',
  }));
  return { ...payload, source: 'ai' };
}
