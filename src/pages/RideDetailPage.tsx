import { useCallback, useEffect, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { Link, useLocation, useParams } from 'wouter';
import { BikeLoader } from '../components/BikeLoader';
import { PageShell } from '../components/PageShell';
import { RouteMap } from '../components/RouteMap';
import { useSession } from '../lib/auth';
import { requestAiAssist, type AiAssistResult } from '../lib/aiAssistant';
import type { RideActivity } from '../lib/cyclingModels';
import { createPost } from '../lib/posts';
import { loadRecordedRide } from '../lib/recordedRides';
import { rideMetricInsights } from '../lib/rideAnalysis';
import { shareRide, shareUrl, type RideShareData } from '../lib/share';
import { usePreferences } from '../lib/preferences';

function timeLabel(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  return hours ? `${hours} ч ${minutes} мин` : `${minutes} мин`;
}

export function RideDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { session, loading } = useSession();
  const { locale } = usePreferences();
  const [, navigate] = useLocation();
  const [ride, setRide] = useState<RideActivity | null>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiInsight, setAiInsight] = useState<AiAssistResult | null>(null);

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
      const postId = await createPost({
        mediaUrl: '',
        mediaType: 'image',
        caption: [ride.title, ride.description].filter(Boolean).join('\n'),
        rideActivityId: ride.id,
        rideStats: { distanceKm: ride.distanceKm, elevationGainM: ride.elevationGainM, durationSeconds: ride.movingTimeSeconds ?? ride.durationSeconds, summaryPolyline: null, track: ride.gpsTrack },
      });
      navigate(`/feed?published=${encodeURIComponent(postId)}#post-${postId}`);
    } catch (error) {
      setMessage(error instanceof Error ? `Не удалось опубликовать заезд: ${error.message}` : 'Не удалось опубликовать заезд. Попробуй ещё раз.');
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

  async function analyzeRide() {
    if (!ride) return;
    setAiBusy(true);
    setMessage('');
    try {
      const result = await requestAiAssist('ride_analysis', locale, {
        title: ride.title,
        distanceKm: Number(ride.distanceKm.toFixed(2)),
        movingTimeMinutes: Math.round((ride.movingTimeSeconds ?? ride.durationSeconds) / 60),
        elevationGainM: Math.round(ride.elevationGainM),
        averageSpeedKmh: ride.averageSpeedKmh !== null ? Number(ride.averageSpeedKmh.toFixed(1)) : null,
        maxSpeedKmh: ride.maxSpeedKmh !== null ? Number(ride.maxSpeedKmh.toFixed(1)) : null,
        paceMinPerKm: ride.paceMinPerKm,
        elapsedTimeMinutes: Math.round(ride.durationSeconds / 60),
        stoppedTimeMinutes: Math.max(0, Math.round((ride.durationSeconds - (ride.movingTimeSeconds ?? ride.durationSeconds)) / 60)),
        elevationPerKm: ride.distanceKm > 0 ? Number((ride.elevationGainM / ride.distanceKm).toFixed(1)) : 0,
        gpsPointCount: ride.gpsTrack.length,
      });
      setAiInsight(result);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'ИИ-анализ временно недоступен.');
    } finally {
      setAiBusy(false);
    }
  }

  if (!ride) return <PageShell><main className="cycle-page">{message ? <p className="inline-error">{message}</p> : <BikeLoader label="Открываем заезд…" />}</main></PageShell>;
  const shareData: RideShareData = { title: ride.title || 'Моя тренировка', distanceKm: ride.distanceKm, elevationGainM: ride.elevationGainM, durationSeconds: ride.movingTimeSeconds ?? ride.durationSeconds };
  const metricInsights = rideMetricInsights(ride);

  return <PageShell><main className="cycle-page ride-detail-page">
    <header className="page-heading"><div><p className="kicker">Мой заезд</p><h1>{ride.title || 'Заезд без названия'}</h1><p>{ride.description || 'Без заметки'}</p></div><Link className="text-link" href="/rides">← Все мои заезды</Link></header>
    {ride.gpsTrack.length >= 2 ? <RouteMap points={ride.gpsTrack} className="detail-map" /> : <section className="empty-panel"><h2>Маршрут не записан</h2><p>У этой тренировки сохранилась статистика, но нет GPS-точек для карты.</p></section>}
    <section className="ride-detail-stats"><article><span>Дистанция</span><strong>{ride.distanceKm.toFixed(2)} <small>км</small></strong></article><article><span>В движении</span><strong>{timeLabel(ride.movingTimeSeconds ?? ride.durationSeconds)}</strong></article><article><span>Ср. скорость</span><strong>{(ride.averageSpeedKmh ?? 0).toFixed(1)} <small>км/ч</small></strong></article><article><span>Набор</span><strong>{Math.round(ride.elevationGainM)} <small>м</small></strong></article></section>
    <section className="ride-ai-section">
      <div><p className="kicker"><Sparkles size={14} /> ИИ-анализ</p><h2>{aiInsight?.title || 'Что говорит эта поездка?'}</h2><p>{aiInsight?.text || 'Получи короткий персональный разбор темпа, дистанции и набора высоты.'}</p></div>
      {!aiInsight && <button className="ai-assist-button" disabled={aiBusy} onClick={() => void analyzeRide()}><Sparkles size={17} />{aiBusy ? 'Анализируем…' : 'Разобрать заезд'}</button>}
      {aiInsight?.highlights.length ? <section className="ride-ai-observations"><h3>Выводы ИИ</h3><ul>{aiInsight.highlights.map((highlight) => <li key={highlight}>{highlight}</li>)}</ul></section> : null}
      {aiInsight && <section className="ride-metric-analysis" aria-label="Подробный анализ показателей">{metricInsights.map((insight) => <article key={insight.label}><header><span>{insight.label}</span><strong>{insight.value}</strong></header><p>{insight.assessment}</p><small><b>Что делать дальше:</b> {insight.nextStep}</small></article>)}</section>}
    </section>
    <section className="ride-detail-actions"><button className="signal-button" disabled={busy} onClick={() => void publish()}>Опубликовать в Slipstream</button><button className="outline-inline-button" onClick={() => void share()}>Другие приложения</button><a className="outline-inline-button" href={shareUrl('whatsapp', shareData)} target="_blank" rel="noreferrer">WhatsApp</a><a className="outline-inline-button" href={shareUrl('telegram', shareData)} target="_blank" rel="noreferrer">Telegram</a></section>
    {message && <p className="record-note" role="status">{message}</p>}
  </main></PageShell>;
}
