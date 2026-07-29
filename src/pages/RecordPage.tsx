import { useCallback, useEffect, useRef, useState } from 'react';
import { LocateFixed } from 'lucide-react';
import { Link, useLocation } from 'wouter';
import { LiveRecordMap } from '../components/LiveRecordMap';
import { PageShell } from '../components/PageShell';
import { RideReviewModal } from '../components/RideReviewModal';
import { useSession } from '../lib/auth';
import type { GpsTrackPoint, RideRecordingMetrics } from '../lib/cyclingModels';
import { calculateRecordingMetrics, emptyRecordingMetrics } from '../lib/gps';
import { createPost } from '../lib/posts';
import { saveRecordedRide, type SavedRecordedRide, updateRecordedRide } from '../lib/recordedRides';
import { shareRide } from '../lib/share';

type RecordStatus = 'idle' | 'running' | 'paused' | 'finished';
type GpsStatus = 'idle' | 'locating' | 'ready' | 'paused' | 'denied' | 'error';
type ScreenWakeLock = { release: () => Promise<void> };
type WakeLockNavigator = Navigator & { wakeLock?: { request: (type: 'screen') => Promise<ScreenWakeLock> } };

function formatTime(totalSeconds: number): string {
  const rounded = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(rounded / 3600);
  const minutes = Math.floor((rounded % 3600) / 60);
  const seconds = rounded % 60;
  return `${hours ? `${String(hours).padStart(2, '0')}:` : ''}${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function defaultRideTitle(timestamp = Date.now()): string {
  const date = new Intl.DateTimeFormat('ru', { day: 'numeric', month: 'long' }).format(new Date(timestamp));
  return `Заезд · ${date}`;
}

export function RecordPage() {
  const { session, loading } = useSession();
  const [, navigate] = useLocation();
  const [status, setStatus] = useState<RecordStatus>('idle');
  const [track, setTrack] = useState<GpsTrackPoint[]>([]);
  const [currentPosition, setCurrentPosition] = useState<GpsTrackPoint | null>(null);
  const [gpsStatus, setGpsStatus] = useState<GpsStatus>('idle');
  const [metrics, setMetrics] = useState<RideRecordingMetrics>(emptyRecordingMetrics);
  const [message, setMessage] = useState('');
  const [rideTitle, setRideTitle] = useState(defaultRideTitle);
  const [rideDescription, setRideDescription] = useState('');
  const [savedRide, setSavedRide] = useState<SavedRecordedRide | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const watchId = useRef<number | null>(null);
  const previewWatchId = useRef<number | null>(null);
  const wakeLock = useRef<ScreenWakeLock | null>(null);
  const trackRef = useRef<GpsTrackPoint[]>([]);
  const startedAt = useRef<number | null>(null);
  const pausedAt = useRef<number | null>(null);
  const pausedDuration = useRef(0);
  const trackingActive = useRef(false);

  const activeElapsedSeconds = useCallback((now = Date.now()): number => {
    if (!startedAt.current) return 0;
    const end = pausedAt.current ?? now;
    return Math.max(0, (end - startedAt.current - pausedDuration.current) / 1000);
  }, []);

  const updateMetrics = useCallback((nextTrack: GpsTrackPoint[], now = Date.now()) => {
    setMetrics(calculateRecordingMetrics(nextTrack, activeElapsedSeconds(now)));
  }, [activeElapsedSeconds]);

  const stopWatching = useCallback(() => {
    trackingActive.current = false;
    if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current);
    watchId.current = null;
  }, []);

  const stopPreviewLocation = useCallback(() => {
    if (previewWatchId.current !== null) navigator.geolocation.clearWatch(previewWatchId.current);
    previewWatchId.current = null;
  }, []);

  const keepScreenAwake = useCallback(async () => {
    const wakeLockNavigator = navigator as WakeLockNavigator;
    if (!wakeLockNavigator.wakeLock || wakeLock.current) return;
    try { wakeLock.current = await wakeLockNavigator.wakeLock.request('screen'); }
    catch { /* Some browsers or low-power modes do not allow a wake lock. */ }
  }, []);

  const allowScreenSleep = useCallback(async () => {
    if (!wakeLock.current) return;
    const activeWakeLock = wakeLock.current;
    wakeLock.current = null;
    try { await activeWakeLock.release(); }
    catch { /* A released wake lock does not need further handling. */ }
  }, []);

  const receiveLocation = useCallback((position: GeolocationPosition) => {
    if (!trackingActive.current) return;
    const point: GpsTrackPoint = {
      lat: position.coords.latitude,
      lng: position.coords.longitude,
      elevation: position.coords.altitude,
      timestamp: position.timestamp,
    };
    setCurrentPosition(point);
    setGpsStatus('ready');
    const previous = trackRef.current[trackRef.current.length - 1];
    if (previous && point.timestamp - previous.timestamp < 600) return;
    if (previous && position.coords.accuracy > 120) return;
    const nextTrack = [...trackRef.current, point];
    trackRef.current = nextTrack;
    setTrack(nextTrack);
    updateMetrics(nextTrack, point.timestamp);
  }, [updateMetrics]);

  const handleLocationError = useCallback((error: GeolocationPositionError) => {
    if (!trackingActive.current) return;
    if (error.code === error.PERMISSION_DENIED) {
      setGpsStatus('denied');
      setMessage('Разреши доступ к геолокации в настройках браузера — без него маршрут не записывается.');
      return;
    }
    setGpsStatus('error');
    setMessage('GPS пока не найден. Выйди на открытое место и подожди несколько секунд.');
  }, []);

  const previewLocation = useCallback((position: GeolocationPosition) => {
    const point: GpsTrackPoint = {
      lat: position.coords.latitude,
      lng: position.coords.longitude,
      elevation: position.coords.altitude,
      timestamp: position.timestamp,
    };
    setCurrentPosition(point);
    setGpsStatus('ready');
  }, []);

  const previewLocationError = useCallback((error: GeolocationPositionError) => {
    setGpsStatus(error.code === error.PERMISSION_DENIED ? 'denied' : 'error');
  }, []);

  const startPreviewLocation = useCallback(() => {
    if (!navigator.geolocation || previewWatchId.current !== null) return;
    setGpsStatus('locating');
    previewWatchId.current = navigator.geolocation.watchPosition(previewLocation, previewLocationError, { enableHighAccuracy: false, maximumAge: 15000, timeout: 30000 });
  }, [previewLocation, previewLocationError]);

  const watchLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setGpsStatus('error');
      setMessage('Браузер не поддерживает геолокацию.');
      return;
    }
    trackingActive.current = true;
    setGpsStatus('locating');
    watchId.current = navigator.geolocation.watchPosition(receiveLocation, handleLocationError, { enableHighAccuracy: true, maximumAge: 3000, timeout: 30000 });
  }, [handleLocationError, receiveLocation]);

  useEffect(() => {
    if (!loading && !session) navigate('/auth/sign-in');
  }, [loading, navigate, session]);
  useEffect(() => () => { stopWatching(); stopPreviewLocation(); void allowScreenSleep(); }, [allowScreenSleep, stopPreviewLocation, stopWatching]);
  useEffect(() => {
    if (status !== 'running') startPreviewLocation();
    return () => stopPreviewLocation();
  }, [startPreviewLocation, status, stopPreviewLocation]);
  useEffect(() => {
    if (status !== 'running') return undefined;
    const interval = window.setInterval(() => updateMetrics(trackRef.current), 1000);
    return () => window.clearInterval(interval);
  }, [status, updateMetrics]);
  useEffect(() => {
    const restoreWakeLock = () => { if (document.visibilityState === 'visible' && status === 'running') void keepScreenAwake(); };
    document.addEventListener('visibilitychange', restoreWakeLock);
    return () => document.removeEventListener('visibilitychange', restoreWakeLock);
  }, [keepScreenAwake, status]);

  function start() {
    setMessage('');
    setSavedRide(null);
    setReviewOpen(false);
    setRideTitle(defaultRideTitle());
    setRideDescription('');
    stopPreviewLocation();
    const initialTrack = currentPosition !== null && Date.now() - currentPosition.timestamp < 30_000
      ? [currentPosition]
      : [];
    setTrack(initialTrack);
    setGpsStatus('locating');
    trackRef.current = initialTrack;
    startedAt.current = Date.now();
    pausedAt.current = null;
    pausedDuration.current = 0;
    setMetrics(emptyRecordingMetrics);
    setStatus('running');
    watchLocation();
    void keepScreenAwake();
  }

  function pause() {
    stopWatching();
    void allowScreenSleep();
    setGpsStatus('paused');
    pausedAt.current = Date.now();
    setStatus('paused');
    updateMetrics(trackRef.current, pausedAt.current);
  }

  function resume() {
    if (pausedAt.current) pausedDuration.current += Date.now() - pausedAt.current;
    pausedAt.current = null;
    setStatus('running');
    watchLocation();
    void keepScreenAwake();
  }

  async function finish() {
    stopWatching();
    void allowScreenSleep();
    const completedMetrics = calculateRecordingMetrics(trackRef.current, activeElapsedSeconds());
    setMetrics(completedMetrics);
    setStatus('finished');
    if (!trackRef.current.length) {
      setMessage('Не удалось получить ни одной GPS-точки. Разреши геолокацию и попробуй ещё раз.');
      return;
    }
    const completedTitle = defaultRideTitle(trackRef.current[0].timestamp);
    setRideTitle(completedTitle);
    setMessage('');
    setReviewOpen(true);
    await saveRide({ metrics: completedMetrics, title: completedTitle, description: '' });
  }

  async function saveRide(overrides?: Partial<Pick<SavedRecordedRide, 'metrics' | 'title' | 'description'>>): Promise<SavedRecordedRide | null> {
    const nextMetrics = overrides?.metrics ?? metrics;
    const nextTitle = overrides?.title ?? rideTitle;
    const nextDescription = overrides?.description ?? rideDescription;
    setBusy(true);
    setMessage('Сохраняем тренировку…');
    try {
      if (savedRide) {
        await updateRecordedRide(savedRide.id, { title: nextTitle, description: nextDescription });
        const updatedRide = { ...savedRide, metrics: nextMetrics, title: nextTitle.trim(), description: nextDescription.trim() };
        setSavedRide(updatedRide);
        setMessage('Изменения сохранены в «Моих заездах».');
        return updatedRide;
      }
      const ride = await saveRecordedRide({ track: trackRef.current, metrics: nextMetrics, title: nextTitle, description: nextDescription });
      setSavedRide(ride);
      setMessage('Заезд сохранён в «Мои заезды».');
      return ride;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Не удалось сохранить тренировку.');
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function publish() {
    const ride = await saveRide();
    if (!ride) return;
    setBusy(true);
    setMessage('Публикуем в ленте…');
    try {
      await createPost({
        mediaUrl: '',
        mediaType: 'image',
        caption: [rideTitle.trim(), rideDescription.trim()].filter(Boolean).join('\n'),
        rideActivityId: ride.id,
        rideStats: {
          distanceKm: ride.metrics.distanceKm,
          elevationGainM: ride.metrics.elevationGainM,
          durationSeconds: ride.metrics.movingTimeSeconds,
          summaryPolyline: null,
          track: ride.track,
        },
      });
      navigate('/feed');
    } catch {
      setMessage('Не удалось опубликовать тренировку. Попробуй ещё раз.');
    } finally {
      setBusy(false);
    }
  }

  async function share() {
    try {
      const result = await shareRide({ title: rideTitle.trim() || 'Моя тренировка', distanceKm: metrics.distanceKm, elevationGainM: metrics.elevationGainM, durationSeconds: metrics.movingTimeSeconds });
      if (result === 'copied') setMessage('Текст заезда скопирован — его можно вставить в любое приложение.');
      if (result === 'unavailable') setMessage('На этом устройстве поделиться автоматически нельзя. Выбери WhatsApp или Telegram ниже.');
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError')) setMessage('Не удалось открыть меню отправки.');
    }
  }

  return (
    <PageShell>
      <main className="record-page topographic-hero">
        <section className="record-metrics" aria-label="Показатели тренировки">
          <div><span>Дистанция</span><strong>{metrics.distanceKm.toFixed(2)} <small>км</small></strong></div>
          <div><span>Скорость</span><strong>{metrics.currentSpeedKmh.toFixed(1)} <small>км/ч</small></strong></div>
          <div><span>Время</span><strong>{formatTime(metrics.elapsedTimeSeconds)}</strong></div>
        </section>
        <section className="record-map-slot" aria-label="Карта текущей тренировки"><LiveRecordMap track={track} currentPoint={currentPosition} /><p className={`gps-location-status gps-${gpsStatus}`}><LocateFixed size={16} aria-hidden="true" />{gpsStatus === 'locating' && 'Ищем GPS…'}{gpsStatus === 'ready' && (status === 'idle' ? 'GPS найден · готов к записи' : `GPS найден · точек: ${track.length}`)}{gpsStatus === 'paused' && 'Запись на паузе'}{gpsStatus === 'denied' && 'Нужен доступ к геолокации'}{gpsStatus === 'error' && 'GPS пока недоступен'}{gpsStatus === 'idle' && 'Ищем твоё местоположение…'}</p></section>
        <section className={`record-controls${status === 'running' ? ' is-recording' : ''}`} aria-label="Управление записью">
          {status === 'idle' && <button className="signal-button record-primary" onClick={start}>Старт записи</button>}
          {status === 'running' && <><button className="outline-inline-button" onClick={pause}>Пауза</button><button className="signal-button record-primary" onClick={() => void finish()}>Завершить</button></>}
          {status === 'paused' && <><button className="signal-button record-primary" onClick={resume}>Продолжить</button><button className="outline-inline-button" onClick={() => void finish()}>Завершить</button></>}
          {status === 'finished' && <><button className="signal-button record-primary" onClick={start}>Новая запись</button><Link className="outline-inline-button" href="/rides">Мои заезды</Link></>}
        </section>
        {!reviewOpen && message && <p className="record-note" role="status">{message}</p>}
        {savedRide && !reviewOpen && <p className="ride-saved-note"><Link href={`/rides/${savedRide.id}`}>Открыть сохранённый заезд</Link></p>}
        <Link className="record-back" href="/dashboard">← Вернуться к сводке</Link>
        {reviewOpen && <RideReviewModal
          track={track}
          metrics={metrics}
          title={rideTitle}
          description={rideDescription}
          savedRide={savedRide}
          busy={busy}
          message={message}
          onTitleChange={setRideTitle}
          onDescriptionChange={setRideDescription}
          onSave={() => void saveRide()}
          onPublish={() => void publish()}
          onShare={() => void share()}
          onClose={() => setReviewOpen(false)}
        />}
      </main>
    </PageShell>
  );
}
