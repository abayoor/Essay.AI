import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'wouter';
import { BikeLoader } from '../components/BikeLoader';
import { PageShell } from '../components/PageShell';
import { RouteMap } from '../components/RouteMap';
import { useSession } from '../lib/auth';
import type { RideActivity } from '../lib/cyclingModels';
import { createPost } from '../lib/posts';
import { loadRecordedRide } from '../lib/recordedRides';
import { shareRide, shareUrl, type RideShareData } from '../lib/share';

function timeLabel(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  return hours ? `${hours} ч ${minutes} мин` : `${minutes} мин`;
}

export function RideDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { session, loading } = useSession();
  const [, navigate] = useLocation();
  const [ride, setRide] = useState<RideActivity | null>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    if (!id) return;
    try {
      const item = await loadRecordedRide(id);
      if (!item) navigate('/rides');
      else setRide(item);
    } catch {
      setMessage('Не удалось открыть этот заезд.');
    }
  }, [id, navigate]);

  useEffect(() => {
    if (!loading && !session) navigate('/auth/sign-in');
    if (session) void refresh();
  }, [loading, navigate, refresh, session]);

  async function publish() {
    if (!ride) return;
    setBusy(true);
    setMessage('Публикуем в ленте…');
    try {
      await createPost({
        mediaUrl: '',
        mediaType: 'image',
        caption: [ride.title, ride.description].filter(Boolean).join('\n'),
        rideActivityId: ride.id,
        rideStats: { distanceKm: ride.distanceKm, elevationGainM: ride.elevationGainM, durationSeconds: ride.movingTimeSeconds ?? ride.durationSeconds, summaryPolyline: null, track: ride.gpsTrack },
      });
      navigate('/feed');
    } catch {
      setMessage('Не удалось опубликовать заезд. Попробуй ещё раз.');
    } finally {
      setBusy(false);
    }
  }

  async function share() {
    if (!ride) return;
    try {
      const result = await shareRide({ title: ride.title || 'Моя тренировка', distanceKm: ride.distanceKm, elevationGainM: ride.elevationGainM, durationSeconds: ride.movingTimeSeconds ?? ride.durationSeconds });
      if (result === 'copied') setMessage('Текст заезда скопирован.');
      if (result === 'unavailable') setMessage('Выбери WhatsApp или Telegram ниже.');
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError')) setMessage('Не удалось открыть меню отправки.');
    }
  }

  if (!ride) return <PageShell><main className="cycle-page">{message ? <p className="inline-error">{message}</p> : <BikeLoader label="Открываем заезд…" />}</main></PageShell>;
  const shareData: RideShareData = { title: ride.title || 'Моя тренировка', distanceKm: ride.distanceKm, elevationGainM: ride.elevationGainM, durationSeconds: ride.movingTimeSeconds ?? ride.durationSeconds };

  return <PageShell><main className="cycle-page ride-detail-page">
    <header className="page-heading"><div><p className="kicker">Мой заезд</p><h1>{ride.title || 'Заезд без названия'}</h1><p>{ride.description || 'Без заметки'}</p></div><Link className="text-link" href="/rides">← Все мои заезды</Link></header>
    {ride.gpsTrack.length >= 2 ? <RouteMap points={ride.gpsTrack} className="detail-map" /> : <section className="empty-panel"><h2>Маршрут не записан</h2><p>У этой тренировки сохранилась статистика, но нет GPS-точек для карты.</p></section>}
    <section className="ride-detail-stats"><article><span>Дистанция</span><strong>{ride.distanceKm.toFixed(2)} <small>км</small></strong></article><article><span>В движении</span><strong>{timeLabel(ride.movingTimeSeconds ?? ride.durationSeconds)}</strong></article><article><span>Ср. скорость</span><strong>{(ride.averageSpeedKmh ?? 0).toFixed(1)} <small>км/ч</small></strong></article><article><span>Набор</span><strong>{Math.round(ride.elevationGainM)} <small>м</small></strong></article></section>
    <section className="ride-detail-actions"><button className="signal-button" disabled={busy} onClick={() => void publish()}>Опубликовать в Slipstream</button><button className="outline-inline-button" onClick={() => void share()}>Другие приложения</button><a className="outline-inline-button" href={shareUrl('whatsapp', shareData)} target="_blank" rel="noreferrer">WhatsApp</a><a className="outline-inline-button" href={shareUrl('telegram', shareData)} target="_blank" rel="noreferrer">Telegram</a></section>
    {message && <p className="record-note" role="status">{message}</p>}
  </main></PageShell>;
}
