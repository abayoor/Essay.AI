import { useEffect, useMemo, useState } from 'react';
import { Activity, ArrowRight, Bike, LockKeyhole, Mountain, Target, TimerReset } from 'lucide-react';
import { Link } from 'wouter';
import type { RideActivity } from '../lib/cyclingModels';
import { useLocaleText } from '../lib/localized';
import { loadRecordedRides } from '../lib/recordedRides';

type WeekSummary = {
  distanceKm: number;
  durationSeconds: number;
  elevationM: number;
  rides: number;
};

function summarize(rides: RideActivity[], from: number, to: number): WeekSummary {
  return rides.reduce<WeekSummary>((summary, ride) => {
    const timestamp = new Date(`${ride.rideDate}T12:00:00`).getTime();
    if (!Number.isFinite(timestamp) || timestamp < from || timestamp >= to) return summary;
    return {
      distanceKm: summary.distanceKm + ride.distanceKm,
      durationSeconds: summary.durationSeconds + ride.durationSeconds,
      elevationM: summary.elevationM + ride.elevationGainM,
      rides: summary.rides + 1,
    };
  }, { distanceKm: 0, durationSeconds: 0, elevationM: 0, rides: 0 });
}

function formatDuration(seconds: number, hourUnit: string, minuteUnit: string): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.round((seconds % 3600) / 60);
  return hours ? `${hours} ${hourUnit} ${minutes} ${minuteUnit}` : `${minutes} ${minuteUnit}`;
}

export function ProWeeklyDigest({ active }: { active: boolean }) {
  const text = useLocaleText();
  const [rides, setRides] = useState<RideActivity[]>([]);
  const [loading, setLoading] = useState(active);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!active) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError('');
    void loadRecordedRides()
      .then((items) => { if (!cancelled) setRides(items); })
      .catch(() => { if (!cancelled) setError(text('Не удалось собрать недельный отчёт.', 'Апталық есепті жинау мүмкін болмады.', 'Could not build the weekly report.')); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [active, text]);

  const report = useMemo(() => {
    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;
    const current = summarize(rides, now - 7 * day, now + day);
    const previous = summarize(rides, now - 14 * day, now - 7 * day);
    const change = previous.distanceKm > 0
      ? Math.round(((current.distanceKm - previous.distanceKm) / previous.distanceKm) * 100)
      : current.distanceKm > 0 ? 100 : 0;
    const averageSpeed = current.durationSeconds > 0 ? current.distanceKm / (current.durationSeconds / 3600) : 0;
    const advice = current.rides === 0
      ? text('Начни с короткого спокойного заезда и постепенно верни ритм.', 'Қысқа тыныш сапардан бастап, ырғағыңа біртіндеп орал.', 'Start with a short easy ride and rebuild your rhythm gradually.')
      : previous.distanceKm > 0 && current.distanceKm > previous.distanceKm * 1.3
        ? text('Объём заметно вырос. Следующий заезд лучше сделать лёгким.', 'Көлем айтарлықтай өсті. Келесі сапарды жеңіл жасаған дұрыс.', 'Volume rose noticeably. Make the next ride an easy one.')
        : current.rides >= 3
          ? text('Хорошая регулярность. Сохрани ритм и оставь один день для восстановления.', 'Жүйелілік жақсы. Ырғақты сақтап, бір күнді қалпына келуге қалдыр.', 'Good consistency. Keep the rhythm and leave one recovery day.')
          : text('Добавь ещё один лёгкий заезд — регулярность важнее резкого роста объёма.', 'Тағы бір жеңіл сапар қос — тұрақтылық көлемнің күрт өсуінен маңызды.', 'Add one easy ride—consistency matters more than a sudden volume jump.');
    return { averageSpeed, change, current, advice };
  }, [rides, text]);

  return <section className={`pro-weekly-digest${active ? '' : ' locked'}`} aria-labelledby="pro-weekly-digest-title">
    <header>
      <div><p className="pro-eyebrow"><Activity size={14} /> {text('Недельный отчёт', 'Апталық есеп', 'Weekly report')}</p><h2 id="pro-weekly-digest-title">{text('Прогресс без догадок', 'Болжамсыз прогресс', 'Progress without guesswork')}</h2><p>{text('Сравнение последних семи дней с предыдущей неделей на основе твоих поездок.', 'Соңғы жеті күнді сапарларың негізінде алдыңғы аптамен салыстыру.', 'A comparison of the last seven days with the previous week, based on your rides.')}</p></div>
      {active && !loading && <span className={`pro-week-change${report.change < 0 ? ' down' : ''}`}>{report.change > 0 ? '+' : ''}{report.change}%</span>}
    </header>

    {loading ? <p className="pro-digest-state">{text('Собираем поездки…', 'Сапарлар жиналуда…', 'Collecting rides…')}</p> : error ? <p className="pro-digest-state" role="alert">{error}</p> : <>
      <div className="pro-digest-metrics">
        <article><Bike size={19} /><span>{text('Дистанция', 'Қашықтық', 'Distance')}</span><strong>{report.current.distanceKm.toFixed(1)} km</strong></article>
        <article><Activity size={19} /><span>{text('Заезды', 'Сапарлар', 'Rides')}</span><strong>{report.current.rides}</strong></article>
        <article><Mountain size={19} /><span>{text('Набор', 'Биіктік', 'Elevation')}</span><strong>{Math.round(report.current.elevationM)} m</strong></article>
        <article><TimerReset size={19} /><span>{text('Время', 'Уақыт', 'Time')}</span><strong>{formatDuration(report.current.durationSeconds, text('ч', 'сағ', 'h'), text('мин', 'мин', 'min'))}</strong><small>{report.averageSpeed > 0 ? `${report.averageSpeed.toFixed(1)} km/h` : '—'}</small></article>
      </div>
      <div className="pro-digest-advice"><Target size={19} /><div><strong>{text('Фокус следующей недели', 'Келесі аптаның бағыты', 'Next-week focus')}</strong><p>{report.advice}</p></div><Link href="/coach">{text('Открыть тренера', 'Жаттықтырушыны ашу', 'Open coach')}<ArrowRight size={16} /></Link></div>
    </>}

    {!active && <div className="pro-digest-lock"><LockKeyhole size={21} /><strong>{text('Персональный отчёт входит в Pro', 'Жеке есеп Pro құрамына кіреді', 'Personal reports are included with Pro')}</strong><a href="#pro-price">{text('Открыть отчёты', 'Есептерді ашу', 'Unlock reports')}</a></div>}
  </section>;
}
