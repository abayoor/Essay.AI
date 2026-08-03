import type { RideActivity } from './cyclingModels';

export type RideMetricInsight = {
  label: string;
  value: string;
  assessment: string;
  nextStep: string;
};

function formatMinutes(totalSeconds: number): string {
  const minutes = Math.max(0, Math.round(totalSeconds / 60));
  if (minutes < 60) return `${minutes} мин`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder ? `${hours} ч ${remainder} мин` : `${hours} ч`;
}

function formatPace(pace: number | null): string {
  if (pace === null || !Number.isFinite(pace) || pace <= 0) return 'Нет точных данных';
  const minutes = Math.floor(pace);
  const seconds = Math.round((pace - minutes) * 60);
  return `${minutes}:${String(seconds).padStart(2, '0')} мин/км`;
}

export function rideMetricInsights(ride: RideActivity): RideMetricInsight[] {
  const movingSeconds = Math.max(0, ride.movingTimeSeconds ?? ride.durationSeconds);
  const elapsedSeconds = Math.max(movingSeconds, ride.durationSeconds);
  const stoppedSeconds = Math.max(0, elapsedSeconds - movingSeconds);
  const movingShare = elapsedSeconds > 0 ? movingSeconds / elapsedSeconds * 100 : 0;
  const climbPerKm = ride.distanceKm > 0 ? ride.elevationGainM / ride.distanceKm : 0;
  const averageSpeed = ride.averageSpeedKmh ?? (movingSeconds > 0 ? ride.distanceKm / (movingSeconds / 3600) : 0);
  const maxSpeed = ride.maxSpeedKmh;
  const maxLooksUnreliable = maxSpeed !== null && (maxSpeed > 85 || (averageSpeed > 0 && maxSpeed > averageSpeed * 2.4));

  const distanceAssessment = ride.distanceKm < 8
    ? 'Короткий заезд: он хорошо показывает скорость на небольшом отрезке, но ещё не говорит о выносливости на длинной дистанции.'
    : ride.distanceKm < 30
      ? 'Средняя дистанция: уже можно оценивать устойчивость темпа и базовую выносливость.'
      : 'Длинная дистанция: результат заметно отражает выносливость и умение распределять силы.';
  const distanceNext = ride.distanceKm < 8
    ? 'Следующий спокойный заезд увеличь только до 6–8 км, не пытаясь одновременно поднять скорость.'
    : 'Увеличивай объём постепенно — ориентир до 10% за одну неделю при нормальном самочувствии.';

  const durationAssessment = stoppedSeconds >= 60
    ? `В движении ${Math.round(movingShare)}% общего времени; остановки заняли около ${formatMinutes(stoppedSeconds)}.`
    : 'Почти всё время прошло в движении, поэтому средняя скорость хорошо описывает сам заезд.';

  const speedAssessment = averageSpeed <= 0
    ? 'Среднюю скорость определить не удалось — для вывода нужны корректные время движения и дистанция.'
    : averageSpeed < 15
      ? 'Спокойный темп, подходящий для лёгкой поездки или восстановления.'
      : averageSpeed < 25
        ? 'Умеренный любительский темп: его обычно легче удерживать без резких ускорений.'
        : 'Высокий средний темп. На коротком заезде он может отражать интенсивный отрезок, поэтому не стоит автоматически переносить его на длинную тренировку.';

  const elevationAssessment = ride.elevationGainM <= 5
    ? 'Маршрут практически плоский, поэтому скорость меньше зависела от подъёмов.'
    : climbPerKm < 8
      ? `Небольшая холмистость — примерно ${Math.round(climbPerKm)} м набора на километр.`
      : climbPerKm < 20
        ? `Холмистый маршрут — примерно ${Math.round(climbPerKm)} м набора на километр; подъёмы уже заметно влияют на темп.`
        : `Выраженный рельеф — примерно ${Math.round(climbPerKm)} м набора на километр; среднюю скорость нужно оценивать с учётом подъёмов.`;

  const maxAssessment = maxSpeed === null
    ? 'Максимальная скорость не записалась, поэтому разбор не делает выводов о пиковых усилиях.'
    : maxLooksUnreliable
      ? 'Пик сильно отличается от средней скорости и может быть коротким спуском или GPS-скачком. Не используй его как главный показатель формы.'
      : 'Пиковая скорость выглядит согласованной со средней, но важнее то, насколько ровно удерживался основной темп.';

  return [
    { label: 'Дистанция', value: `${ride.distanceKm.toFixed(2)} км`, assessment: distanceAssessment, nextStep: distanceNext },
    { label: 'Время и остановки', value: `${formatMinutes(movingSeconds)} в движении`, assessment: durationAssessment, nextStep: 'Для сравнения следующих поездок смотри отдельно время в движении и полное время.' },
    { label: 'Средняя скорость и темп', value: `${averageSpeed.toFixed(1)} км/ч · ${formatPace(ride.paceMinPerKm)}`, assessment: speedAssessment, nextStep: 'На следующем заезде постарайся держать ровный темп без частых резких ускорений.' },
    { label: 'Максимальная скорость', value: maxSpeed === null ? 'Нет данных' : `${maxSpeed.toFixed(1)} км/ч`, assessment: maxAssessment, nextStep: 'Оценивай прогресс по средней скорости на похожем маршруте, а не по одному максимальному значению.' },
    { label: 'Рельеф', value: `${Math.round(ride.elevationGainM)} м · ${Math.round(climbPerKm)} м/км`, assessment: elevationAssessment, nextStep: 'Сравнивай скорость только на маршрутах с похожим набором высоты.' },
    { label: 'Качество данных', value: `${ride.gpsTrack.length} GPS-точек`, assessment: ride.gpsTrack.length >= 20 ? 'Трек содержит достаточно точек для карты и основных расчётов.' : 'Точек мало, поэтому скорость, набор высоты и форма маршрута могут быть менее точными.', nextStep: 'Записывай поездку с включённой точной геолокацией и не закрывай приложение во время старта.' },
  ];
}
