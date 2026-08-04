import { ShieldCheck } from 'lucide-react';
import { Link } from 'wouter';
import type { GpsTrackPoint, RideRecordingMetrics } from '../lib/cyclingModels';
import type { SavedRecordedRide } from '../lib/recordedRides';
import { shareUrl, type RideShareData } from '../lib/share';
import { LiveRecordMap } from './LiveRecordMap';

type RideReviewModalProps = {
  track: GpsTrackPoint[];
  metrics: RideRecordingMetrics;
  title: string;
  description: string;
  savedRide: SavedRecordedRide | null;
  busy: boolean;
  message: string;
  onTitleChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onSave: () => void;
  onPublish: () => void;
  onShare: () => void;
  onClose: () => void;
};

function formatTime(totalSeconds: number): string {
  const rounded = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(rounded / 3600);
  const minutes = Math.floor((rounded % 3600) / 60);
  return hours ? `${hours} ч ${minutes} мин` : `${minutes} мин`;
}

function formatPace(pace: number | null): string {
  if (pace === null || !Number.isFinite(pace)) return '—';
  const minutes = Math.floor(pace);
  const seconds = Math.round((pace - minutes) * 60);
  return `${minutes}:${String(seconds).padStart(2, '0')} /км`;
}

export function RideReviewModal(props: RideReviewModalProps) {
  const shareData: RideShareData = {
    title: props.title.trim() || 'Моя тренировка',
    distanceKm: props.metrics.distanceKm,
    elevationGainM: props.metrics.elevationGainM,
    durationSeconds: props.metrics.movingTimeSeconds,
  };
  return <div className="ride-review-backdrop" role="presentation">
    <section className="ride-review-modal" role="dialog" aria-modal="true" aria-labelledby="ride-review-title">
      <header><div><p className="kicker">Тренировка завершена</p><h1 id="ride-review-title">Проверь заезд</h1></div><button type="button" className="modal-close" onClick={props.onClose} aria-label="Закрыть окно">×</button></header>
      <LiveRecordMap track={props.track} className="ride-review-map" />
      <dl className="ride-review-stats">
        <div><dt>Дистанция</dt><dd>{props.metrics.distanceKm.toFixed(2)} км</dd></div>
        <div><dt>В движении</dt><dd>{formatTime(props.metrics.movingTimeSeconds)}</dd></div>
        <div><dt>Ср. скорость</dt><dd>{props.metrics.averageSpeedKmh.toFixed(1)} км/ч</dd></div>
        <div><dt>Макс. скорость</dt><dd>{props.metrics.maxSpeedKmh.toFixed(1)} км/ч</dd></div>
        <div><dt>Набор</dt><dd>{Math.round(props.metrics.elevationGainM)} м</dd></div>
        <div><dt>Темп</dt><dd>{formatPace(props.metrics.paceMinPerKm)}</dd></div>
      </dl>
      <div className="ride-review-fields">
        <label>Название заезда <span>(необязательно)</span><input value={props.title} onChange={(event) => props.onTitleChange(event.target.value)} maxLength={120} placeholder="Например, вечерний круг" /></label>
        <label>Описание <span>(необязательно)</span><textarea value={props.description} onChange={(event) => props.onDescriptionChange(event.target.value)} maxLength={1000} placeholder="Как прошёл заезд, погода, покрытие" /></label>
      </div>
      <div className="ride-review-actions">
        <button className="outline-inline-button" disabled={props.busy} onClick={props.onSave}>{props.savedRide ? 'Сохранить изменения' : 'Сохранить в мои заезды'}</button>
        <button className="signal-button" disabled={props.busy} onClick={props.onPublish}>Опубликовать в Slipstream</button>
      </div>
      <p className="ride-privacy-note"><ShieldCheck size={16} aria-hidden="true" />При публикации Slipstream удаляет точки в радиусе 200 м вокруг старта и финиша. Если безопасного фрагмента не остаётся, линия маршрута не публикуется.</p>
      {props.savedRide && <p className="ride-saved-note" role="status">Заезд сохранён. <Link href={`/rides/${props.savedRide.id}`}>Открыть его</Link> или поделиться ниже.</p>}
      <section className="ride-share" aria-label="Поделиться тренировкой">
        <p>Поделиться</p>
        <div><button type="button" className="outline-inline-button" onClick={props.onShare}>Другие приложения</button><a className="outline-inline-button" href={shareUrl('whatsapp', shareData)} target="_blank" rel="noreferrer">WhatsApp</a><a className="outline-inline-button" href={shareUrl('telegram', shareData)} target="_blank" rel="noreferrer">Telegram</a></div>
      </section>
      {props.message && <p className="record-note" role="status">{props.message}</p>}
    </section>
  </div>;
}
