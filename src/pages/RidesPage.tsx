import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation } from 'wouter';
import { BikeLoader } from '../components/BikeLoader';
import { PageShell } from '../components/PageShell';
import { useSession } from '../lib/auth';
import type { RideActivity } from '../lib/cyclingModels';
import { loadRecordedRides } from '../lib/recordedRides';

function dateLabel(value: string): string {
  return new Intl.DateTimeFormat('ru', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(`${value}T12:00:00`));
}

export function RidesPage() {
  const { session, loading } = useSession();
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
      setError('Не удалось загрузить твои заезды. Попробуй ещё раз.');
    } finally { setRidesLoading(false); }
  }, []);

  useEffect(() => {
    if (!loading && !session) navigate('/auth/sign-in');
    if (session) void refresh();
  }, [loading, navigate, refresh, session]);

  return <PageShell><main className="cycle-page rides-page">
    <header className="page-heading"><div><p className="kicker">Личный журнал</p><h1>Мои заезды</h1><p>Здесь остаются все сохранённые тренировки: маршрут, статистика и твои заметки.</p></div><Link className="signal-button" href="/record">Записать заезд</Link></header>
    {error && <div className="inline-error" role="alert">{error}<button onClick={() => void refresh()}>Повторить</button></div>}
    {ridesLoading ? <BikeLoader label="Загружаем твои заезды…" /> : rides.length ? <section className="rides-list">{rides.map((ride) => <Link className="ride-list-card" href={`/rides/${ride.id}`} key={ride.id}>
      <div><p className="kicker">{dateLabel(ride.rideDate)}</p><h2>{ride.title || 'Заезд без названия'}</h2>{ride.description && <p>{ride.description}</p>}</div>
      <dl><div><dt>Дистанция</dt><dd>{ride.distanceKm.toFixed(1)} км</dd></div><div><dt>В движении</dt><dd>{Math.round((ride.movingTimeSeconds ?? ride.durationSeconds) / 60)} мин</dd></div><div><dt>Набор</dt><dd>{Math.round(ride.elevationGainM)} м</dd></div></dl>
    </Link>)}</section> : <section className="empty-panel"><h2>Заездов пока нет</h2><p>Запусти GPS-запись — после финиша маршрут и показатели можно сохранить здесь.</p><Link className="signal-button" href="/record">Начать запись</Link></section>}
  </main></PageShell>;
}
