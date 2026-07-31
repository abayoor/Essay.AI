import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { Activity, BatteryCharging, Bike, BrainCircuit, Clock3, Gauge, HeartPulse, Mountain, Route, Sparkles, Target, TrendingUp } from 'lucide-react';
import { Link, useLocation } from 'wouter';
import { BikeLoader } from '../components/BikeLoader';
import { PageShell } from '../components/PageShell';
import {
  buildLocalCoachAdvice,
  requestAiCoachAdvice,
  summarizeCoachRides,
  type CoachAdvice,
  type CoachGoal,
  type CoachIntensity,
} from '../lib/aiCoach';
import { useSession } from '../lib/auth';
import type { RideActivity } from '../lib/cyclingModels';
import { loadRecordedRides } from '../lib/recordedRides';

const goals: { id: CoachGoal; title: string; description: string }[] = [
  { id: 'consistency', title: 'Регулярность', description: 'Кататься стабильно без перегрузки' },
  { id: 'endurance', title: 'Выносливость', description: 'Дольше держать ровный темп' },
  { id: 'speed', title: 'Скорость', description: 'Постепенно ехать быстрее' },
  { id: 'distance', title: 'Дистанция', description: 'Подготовиться к длинному маршруту' },
];

const feelings = [
  { value: 1, label: 'Очень устал' },
  { value: 2, label: 'Устал' },
  { value: 3, label: 'Нормально' },
  { value: 4, label: 'Хорошо' },
  { value: 5, label: 'Отлично' },
];

const intensityLabels: Record<CoachIntensity, string> = {
  recovery: 'Восстановительная',
  easy: 'Лёгкая',
  moderate: 'Умеренная',
  hard: 'Интенсивная',
};

function timeLabel(minutes: number): string {
  if (minutes < 60) return `${minutes} мин`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder ? `${hours} ч ${remainder} мин` : `${hours} ч`;
}

export function CoachPage() {
  const { session, loading } = useSession();
  const [, navigate] = useLocation();
  const [rides, setRides] = useState<RideActivity[]>([]);
  const [ridesLoading, setRidesLoading] = useState(true);
  const [goal, setGoal] = useState<CoachGoal>('consistency');
  const [feeling, setFeeling] = useState(3);
  const [aiAdvice, setAiAdvice] = useState<CoachAdvice | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!loading && !session) navigate('/auth/sign-in');
    if (!session) return;
    setRidesLoading(true);
    void loadRecordedRides()
      .then(setRides)
      .catch(() => setMessage('Не удалось загрузить поездки. Базовый тренер покажет стартовый план.'))
      .finally(() => setRidesLoading(false));
  }, [loading, navigate, session]);

  const summary = useMemo(() => summarizeCoachRides(rides, feeling), [feeling, rides]);
  const localAdvice = useMemo(() => buildLocalCoachAdvice(summary, goal, feeling), [feeling, goal, summary]);
  const advice = aiAdvice ?? localAdvice;
  const readinessStyle = { '--coach-readiness': `${summary.readinessScore * 3.6}deg` } as CSSProperties;

  function changeGoal(nextGoal: CoachGoal) {
    setGoal(nextGoal);
    setAiAdvice(null);
    setMessage('');
  }

  function changeFeeling(nextFeeling: number) {
    setFeeling(nextFeeling);
    setAiAdvice(null);
    setMessage('');
  }

  async function generateAiAdvice() {
    if (!session || !rides.length) return;
    setAiLoading(true);
    setMessage('');
    try {
      setAiAdvice(await requestAiCoachAdvice(summary, goal, feeling, session.access_token));
      setMessage('ИИ обновил план по твоей цели и последним поездкам.');
    } catch (error) {
      setAiAdvice(null);
      setMessage(error instanceof Error ? error.message : 'ИИ-тренер пока не ответил. Базовый план продолжает работать.');
    } finally {
      setAiLoading(false);
    }
  }

  return <PageShell><main className="cycle-page coach-page">
    <header className="page-heading coach-heading">
      <div><p className="kicker"><Sparkles size={14} /> Slipstream AI</p><h1>Твой велотренер</h1><p>Анализирует сохранённые поездки, нагрузку и самочувствие, чтобы предложить следующую тренировку.</p></div>
      <Link className="signal-button" href="/record"><Bike size={17} />Записать поездку</Link>
    </header>

    <div className="coach-safety-note"><BrainCircuit size={19} /><p><strong>ИИ видит только сводные числа.</strong><span>Имя, точный маршрут и GPS-координаты не отправляются модели.</span></p></div>

    {ridesLoading ? <BikeLoader label="Собираем тренировочную сводку…" /> : <>
      <section className="coach-overview">
        <article className="coach-readiness-card">
          <div className="coach-readiness-ring" style={readinessStyle}><span>{summary.readinessScore}</span><small>из 100</small></div>
          <div><p className="kicker">Готовность сегодня</p><h2>{summary.readinessLabel}</h2><p>{advice.readinessExplanation}</p></div>
        </article>
        <div className="coach-week-metrics">
          <article><Route size={19} /><span>За 7 дней</span><strong>{summary.distanceKm7Days.toFixed(1)} км</strong></article>
          <article><Clock3 size={19} /><span>В движении</span><strong>{timeLabel(summary.durationMinutes7Days)}</strong></article>
          <article><Activity size={19} /><span>Поездок</span><strong>{summary.ridesCount7Days}</strong></article>
          <article><TrendingUp size={19} /><span>Нагрузка</span><strong>{summary.loadTrendPercent > 0 ? '+' : ''}{summary.loadTrendPercent}%</strong></article>
        </div>
      </section>

      <section className="coach-controls">
        <div>
          <div className="section-heading"><div><p className="kicker">Цель</p><h2>Над чем работаем?</h2></div></div>
          <div className="coach-goal-grid">{goals.map((item) => <button type="button" className={goal === item.id ? 'active' : ''} key={item.id} onClick={() => changeGoal(item.id)}><Target size={18} /><span><strong>{item.title}</strong><small>{item.description}</small></span></button>)}</div>
        </div>
        <div>
          <div className="section-heading"><div><p className="kicker">Самочувствие</p><h2>Как ты себя чувствуешь?</h2></div></div>
          <div className="coach-feeling-scale">{feelings.map((item) => <button type="button" className={feeling === item.value ? 'active' : ''} key={item.value} onClick={() => changeFeeling(item.value)}><strong>{item.value}</strong><span>{item.label}</span></button>)}</div>
        </div>
      </section>

      <section className={`coach-advice-card coach-intensity-${advice.nextWorkout.intensity}`}>
        <header><div><p className="kicker">{advice.source === 'ai' ? 'Персональный разбор ИИ' : 'Базовый умный план'}</p><h2>{advice.headline}</h2><p>{advice.summary}</p></div><span className="coach-source-badge">{advice.source === 'ai' ? <><Sparkles size={15} />ИИ</> : <><Gauge size={15} />Расчёт</>}</span></header>
        <div className="coach-workout">
          <div className="coach-workout-icon"><BatteryCharging size={28} /></div>
          <div><span>Следующая тренировка · {intensityLabels[advice.nextWorkout.intensity]}</span><h3>{advice.nextWorkout.title}</h3><p>{advice.nextWorkout.description}</p></div>
          <strong>{advice.nextWorkout.durationMinutes}<small>минут</small></strong>
        </div>
        <ul>{advice.focus.map((item) => <li key={item}><HeartPulse size={16} />{item}</li>)}</ul>
        <div className="coach-advice-actions">
          <button type="button" className="signal-button" disabled={aiLoading || !rides.length} onClick={() => void generateAiAdvice()}>{aiLoading ? 'ИИ анализирует…' : <><Sparkles size={17} />Получить разбор ИИ</>}</button>
          {!rides.length && <span>Сначала сохрани хотя бы одну поездку.</span>}
        </div>
        {message && <p className="coach-message" role="status">{message}</p>}
      </section>

      <section className="coach-history-card">
        <div><Mountain size={20} /><span>За 28 дней</span><strong>{summary.elevationGainM28Days} м подъёма</strong></div>
        <div><Route size={20} /><span>Общий путь</span><strong>{summary.distanceKm28Days.toFixed(1)} км</strong></div>
        <div><Gauge size={20} /><span>Средняя скорость</span><strong>{summary.averageSpeedKmh28Days === null ? 'Нет данных' : `${summary.averageSpeedKmh28Days.toFixed(1)} км/ч`}</strong></div>
        <div><Activity size={20} /><span>Поездок</span><strong>{summary.ridesCount28Days}</strong></div>
      </section>

      <p className="coach-disclaimer">{advice.caution}</p>
    </>}
  </main></PageShell>;
}
