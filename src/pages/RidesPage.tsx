import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation } from 'wouter';
import { BikeLoader } from '../components/BikeLoader';
import { PageShell } from '../components/PageShell';
import { useSession } from '../lib/auth';
import type { RideActivity } from '../lib/cyclingModels';
import { useLocaleText } from '../lib/localized';
import { usePreferences } from '../lib/preferences';
import { loadRecordedRides } from '../lib/recordedRides';

function dateLabel(value: string, locale: 'ru' | 'kz' | 'en'): string {
  const dateLocale = locale === 'kz' ? 'kk-KZ' : locale === 'en' ? 'en-US' : 'ru-RU';
  return new Intl.DateTimeFormat(dateLocale, { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(`${value}T12:00:00`));
}

export function RidesPage() {
  const { session, loading } = useSession();
  const { locale } = usePreferences();
  const t = useLocaleText();
  const [, navigate] = useLocation();
  const [rides, setRides] = useState<RideActivity[]>([]);
  const [ridesLoading, setRidesLoading] = useState(true);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    setRidesLoading(true);
    try {
      setError('');
      setRides(await loadRecordedRides());
    } catch {
      setError(t('Не удалось загрузить твои заезды. Попробуй ещё раз.', 'Сапарларыңды жүктеу мүмкін болмады. Қайта көр.', 'Could not load your rides. Please try again.'));
    } finally { setRidesLoading(false); }
  }, [t]);

  useEffect(() => {
    if (!loading && !session) navigate('/auth/sign-in');
    if (session) void refresh();
  }, [loading, navigate, refresh, session]);

  return <PageShell><main className="cycle-page rides-page">
    <header className="page-heading"><div><p className="kicker">{t('Личный журнал', 'Жеке журнал', 'Personal log')}</p><h1>{t('Мои заезды', 'Менің сапарларым', 'My rides')}</h1><p>{t('Здесь остаются все сохранённые тренировки: маршрут, статистика и твои заметки.', 'Мұнда барлық сақталған жаттығулар қалады: бағыт, статистика және жазбаларың.', 'All saved workouts live here: route, statistics and your notes.')}</p></div><Link className="signal-button" href="/record">{t('Записать заезд', 'Сапарды жазу', 'Record a ride')}</Link></header>
    {error && <div className="inline-error" role="alert">{error}<button onClick={() => void refresh()}>{t('Повторить', 'Қайталау', 'Retry')}</button></div>}
    {ridesLoading ? <BikeLoader label={t('Загружаем твои заезды…', 'Сапарларың жүктелуде…', 'Loading your rides…')} /> : rides.length ? <section className="rides-list">{rides.map((ride) => <Link className="ride-list-card" href={`/rides/${ride.id}`} key={ride.id}>
      <div><p className="kicker">{dateLabel(ride.rideDate, locale)}</p><h2>{ride.title || t('Заезд без названия', 'Атаусыз сапар', 'Untitled ride')}</h2>{ride.description && <p>{ride.description}</p>}</div>
      <dl><div><dt>{t('Дистанция', 'Қашықтық', 'Distance')}</dt><dd>{ride.distanceKm.toFixed(1)} {t('км', 'км', 'km')}</dd></div><div><dt>{t('В движении', 'Қозғалыста', 'Moving time')}</dt><dd>{Math.round((ride.movingTimeSeconds ?? ride.durationSeconds) / 60)} {t('мин', 'мин', 'min')}</dd></div><div><dt>{t('Набор', 'Биіктік', 'Climb')}</dt><dd>{Math.round(ride.elevationGainM)} {t('м', 'м', 'm')}</dd></div></dl>
    </Link>)}</section> : <section className="empty-panel"><h2>{t('Заездов пока нет', 'Сапарлар әзірге жоқ', 'No rides yet')}</h2><p>{t('Запусти GPS-запись — после финиша маршрут и показатели можно сохранить здесь.', 'GPS жазуды баста — мәреден кейін бағыт пен көрсеткіштерді осында сақтайсың.', 'Start GPS recording, then save the route and metrics here after the finish.')}</p><Link className="signal-button" href="/record">{t('Начать запись', 'Жазуды бастау', 'Start recording')}</Link></section>}
  </main></PageShell>;
}
