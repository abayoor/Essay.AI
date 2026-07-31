import { useState, type FormEvent } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, Sparkles } from 'lucide-react';
import { requestAiAssist } from '../lib/aiAssistant';
import { createPost, uploadPostMedia } from '../lib/posts';
import { usePreferences } from '../lib/preferences';
import { loadStravaActivities, saveStravaActivity, type StravaActivity } from '../lib/strava';

type PostComposerProps = { onPublished: () => Promise<void> };

function formatActivity(activity: StravaActivity): string {
  const date = new Intl.DateTimeFormat('ru', { day: 'numeric', month: 'short' }).format(new Date(activity.startDate));
  const minutes = Math.round(activity.durationSeconds / 60);
  return `${date} · ${activity.distanceKm.toFixed(1)} км · ${minutes} мин`;
}

export function PostComposer({ onPublished }: PostComposerProps) {
  const { locale } = usePreferences();
  const [file, setFile] = useState<File | null>(null);
  const [caption, setCaption] = useState('');
  const [activities, setActivities] = useState<StravaActivity[]>([]);
  const [selectedActivity, setSelectedActivity] = useState<StravaActivity | null>(null);
  const [busy, setBusy] = useState(false);
  const [loadingActivities, setLoadingActivities] = useState(false);
  const [message, setMessage] = useState('');
  const [published, setPublished] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);

  async function generateCaption() {
    setAiBusy(true);
    setMessage('');
    try {
      const result = await requestAiAssist('post_caption', locale, {
        existingText: caption.trim(),
        ride: selectedActivity ? {
          name: selectedActivity.name,
          distanceKm: selectedActivity.distanceKm,
          elevationGainM: selectedActivity.elevationGainM,
          durationMinutes: Math.round(selectedActivity.durationSeconds / 60),
        } : null,
        hasMedia: Boolean(file),
      });
      setCaption(result.text);
      setMessage(locale === 'en' ? 'Gemini prepared a draft. You can edit it.' : locale === 'kz' ? 'Gemini нобай дайындады. Оны өзгерте аласың.' : 'Gemini подготовил черновик. Его можно изменить.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Gemini временно недоступен.');
    } finally {
      setAiBusy(false);
    }
  }

  async function importActivities() {
    setLoadingActivities(true); setMessage('');
    try {
      const nextActivities = await loadStravaActivities();
      setActivities(nextActivities);
      if (!nextActivities.length) setMessage('В Strava пока нет подходящих тренировок.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Не удалось загрузить тренировки из Strava.');
    } finally { setLoadingActivities(false); }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!caption.trim() && !file && !selectedActivity) {
      setMessage('Добавь текст, медиа или тренировку из Strava.');
      return;
    }
    setBusy(true); setMessage('');
    try {
      const media = file ? await uploadPostMedia(file) : { url: null, type: null };
      const importedRide = selectedActivity ? await saveStravaActivity(selectedActivity) : null;
      await createPost({
        mediaUrl: media.url,
        mediaType: media.type,
        caption,
        rideActivityId: importedRide?.id,
        rideStats: importedRide?.stats,
      });
      setFile(null); setCaption(''); setSelectedActivity(null); setMessage('Пост опубликован.'); setPublished(true);
      window.setTimeout(() => setPublished(false), 900);
      await onPublished();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Не удалось опубликовать пост.');
    } finally { setBusy(false); }
  }

  return <section className="form-card post-composer"><p className="kicker">Новая история</p><h2>Поделись заездом</h2><form className="cycle-form" onSubmit={(event) => void submit(event)}>
    <label>Фото или видео<input type="file" accept="image/jpeg,image/png,image/webp,video/mp4,video/webm" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />{file && <small>Выбрано: {file.name}</small>}</label>
    <div className="strava-import"><div><strong>Тренировка из Strava</strong><span>{selectedActivity ? formatActivity(selectedActivity) : 'Импортируй статистику и линию маршрута в пост.'}</span></div><button type="button" className="outline-inline-button" disabled={loadingActivities} onClick={() => void importActivities()}>{loadingActivities ? 'Загружаем…' : 'Импортировать из Strava'}</button></div>
    {activities.length > 0 && <label>Выбери тренировку<select value={selectedActivity ? String(selectedActivity.id) : ''} onChange={(event) => setSelectedActivity(activities.find((activity) => String(activity.id) === event.target.value) ?? null)}><option value="">Без тренировки</option>{activities.map((activity) => <option key={activity.id} value={activity.id}>{activity.name} — {formatActivity(activity)}</option>)}</select></label>}
    <label>Описание<textarea value={caption} onChange={(event) => setCaption(event.target.value)} maxLength={2200} placeholder="Как прошёл заезд?" /></label>
    <button type="button" className="ai-assist-button" disabled={aiBusy} onClick={() => void generateCaption()}><Sparkles size={17} />{aiBusy ? 'Gemini пишет…' : 'Помочь с текстом'}</button>
    <button className="signal-button" disabled={busy}>{busy ? 'Публикуем…' : 'Опубликовать'}</button>
  </form><AnimatePresence>{published && <motion.p className="form-note publish-success" role="status" initial={{ opacity: 0, scale: .86 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: .9 }}><Check size={16} aria-hidden="true" /> Пост опубликован</motion.p>}</AnimatePresence>{message && !published && <p className="form-note" role="status">{message}</p>}</section>;
}
