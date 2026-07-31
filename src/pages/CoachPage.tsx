import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { Activity, BatteryCharging, Bike, BrainCircuit, CalendarDays, Clock3, Gauge, HeartPulse, Mountain, Route, Sparkles, Target, TrendingUp } from 'lucide-react';
import { Link, useLocation } from 'wouter';
import { BikeLoader } from '../components/BikeLoader';
import { PageShell } from '../components/PageShell';
import {
  buildLocalCoachAdvice,
  readinessLabel,
  requestAiCoachAdvice,
  summarizeCoachRides,
  type CoachAdvice,
  type CoachGoal,
  type CoachIntensity,
} from '../lib/aiCoach';
import { useSession } from '../lib/auth';
import type { RideActivity } from '../lib/cyclingModels';
import { useLocaleText } from '../lib/localized';
import { usePreferences } from '../lib/preferences';
import { loadRecordedRides } from '../lib/recordedRides';

export function CoachPage() {
  const { session, loading } = useSession();
  const { locale } = usePreferences();
  const text = useLocaleText();
  const [, navigate] = useLocation();
  const [rides, setRides] = useState<RideActivity[]>([]);
  const [ridesLoading, setRidesLoading] = useState(true);
  const [goal, setGoal] = useState<CoachGoal>('consistency');
  const [feeling, setFeeling] = useState(3);
  const [aiAdvice, setAiAdvice] = useState<CoachAdvice | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [message, setMessage] = useState('');

  const goals: { id: CoachGoal; title: string; description: string }[] = [
    { id: 'consistency', title: text('Регулярность', 'Тұрақтылық', 'Consistency'), description: text('Кататься стабильно без перегрузки', 'Артық жүктемесіз тұрақты жүру', 'Ride regularly without overload') },
    { id: 'endurance', title: text('Выносливость', 'Төзімділік', 'Endurance'), description: text('Дольше держать ровный темп', 'Бірқалыпты қарқынды ұзағырақ ұстау', 'Hold a steady pace for longer') },
    { id: 'speed', title: text('Скорость', 'Жылдамдық', 'Speed'), description: text('Постепенно ехать быстрее', 'Жылдамдықты біртіндеп арттыру', 'Build speed progressively') },
    { id: 'distance', title: text('Дистанция', 'Қашықтық', 'Distance'), description: text('Подготовиться к длинному маршруту', 'Ұзақ бағытқа дайындалу', 'Prepare for a long route') },
  ];

  const feelings = [
    text('Очень устал', 'Қатты шаршадым', 'Very tired'),
    text('Устал', 'Шаршадым', 'Tired'),
    text('Нормально', 'Қалыпты', 'Okay'),
    text('Хорошо', 'Жақсы', 'Good'),
    text('Отлично', 'Өте жақсы', 'Great'),
  ];

  const intensityLabels: Record<CoachIntensity, string> = {
    recovery: text('Восстановительная', 'Қалпына келу', 'Recovery'),
    easy: text('Лёгкая', 'Жеңіл', 'Easy'),
    moderate: text('Умеренная', 'Орташа', 'Moderate'),
    hard: text('Интенсивная', 'Қарқынды', 'Hard'),
  };

  function timeLabel(minutes: number): string {
    if (minutes < 60) return `${minutes} ${text('мин', 'мин', 'min')}`;
    const hours = Math.floor(minutes / 60);
    const remainder = minutes % 60;
    return remainder
      ? `${hours} ${text('ч', 'сағ', 'h')} ${remainder} ${text('мин', 'мин', 'min')}`
      : `${hours} ${text('ч', 'сағ', 'h')}`;
  }

  useEffect(() => {
    if (!loading && !session) navigate('/auth/sign-in');
    if (!session) return;
    setRidesLoading(true);
    void loadRecordedRides()
      .then(setRides)
      .catch(() => setMessage(text(
        'Не удалось загрузить поездки. Базовый тренер покажет стартовый план.',
        'Сапарлар жүктелмеді. Негізгі жаттықтырушы бастапқы жоспарды көрсетеді.',
        'Rides could not be loaded. The built-in coach will show a starter plan.',
      )))
      .finally(() => setRidesLoading(false));
  }, [loading, navigate, session, text]);

  useEffect(() => {
    setAiAdvice(null);
    setMessage('');
  }, [locale]);

  const summary = useMemo(() => summarizeCoachRides(rides, feeling), [feeling, rides]);
  const localAdvice = useMemo(() => buildLocalCoachAdvice(summary, goal, feeling, locale), [feeling, goal, locale, summary]);
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
      setAiAdvice(await requestAiCoachAdvice(summary, goal, feeling, locale, session.access_token));
      setMessage(text(
        'ИИ провёл углублённый анализ нагрузки и обновил недельный план.',
        'AI жүктемені терең талдап, апталық жоспарды жаңартты.',
        'AI completed a deeper load analysis and updated the weekly plan.',
      ));
    } catch (error) {
      setAiAdvice(null);
      const reason = error instanceof Error ? error.message : text(
        'ИИ сейчас недоступен.',
        'AI қазір қолжетімсіз.',
        'AI is unavailable right now.',
      );
      setMessage(`${reason} ${text(
        'Расширенный локальный анализ продолжает работать.',
        'Кеңейтілген жергілікті талдау жұмысын жалғастырады.',
        'The enhanced on-device analysis is still working.',
      )}`);
    } finally {
      setAiLoading(false);
    }
  }

  const confidenceLabel = {
    low: text('Низкая уверенность', 'Сенімділік төмен', 'Low confidence'),
    medium: text('Средняя уверенность', 'Сенімділік орташа', 'Medium confidence'),
    high: text('Высокая уверенность', 'Сенімділік жоғары', 'High confidence'),
  }[advice.confidence];

  return <PageShell><main className="cycle-page coach-page">
    <header className="page-heading coach-heading">
      <div><p className="kicker"><Sparkles size={14} /> Slipstream AI</p><h1>{text('Тренировки, которые понимают тебя', 'Сені түсінетін жаттығулар', 'Training that understands you')}</h1><p>{text(
        'Сравнивает нагрузку, скорость, подъёмы, восстановление и последние поездки — затем строит конкретный план на неделю.',
        'Жүктемені, жылдамдықты, өрлерді, қалпына келуді және соңғы сапарларды салыстырып, нақты апталық жоспар құрады.',
        'Compares load, speed, climbing, recovery and recent rides, then builds a concrete weekly plan.',
      )}</p></div>
      <Link className="signal-button" href="/record"><Bike size={17} />{text('Записать поездку', 'Сапарды жазу', 'Record a ride')}</Link>
    </header>

    <div className="coach-safety-note"><BrainCircuit size={19} /><p><strong>{text('Приватный анализ без GPS.', 'GPS-сіз құпия талдау.', 'Private analysis without GPS.')}</strong><span>{text(
      'Модель получает только сводные показатели и обезличенные данные последних поездок.',
      'Модель тек жиынтық көрсеткіштер мен соңғы сапарлардың жасырын деректерін алады.',
      'The model receives only summary metrics and anonymized recent-ride data.',
    )}</span></p></div>

    {ridesLoading ? <BikeLoader label={text('Собираем тренировочную сводку…', 'Жаттығу есебін жинап жатырмыз…', 'Building your training summary…')} /> : <>
      <section className="coach-overview">
        <article className="coach-readiness-card">
          <div className="coach-readiness-ring" style={readinessStyle}><span>{summary.readinessScore}</span><small>{text('из 100', '100-ден', 'of 100')}</small></div>
          <div><p className="kicker">{text('Готовность сегодня', 'Бүгінгі дайындық', 'Readiness today')}</p><h2>{readinessLabel(summary, locale)}</h2><p>{advice.readinessExplanation}</p></div>
        </article>
        <div className="coach-week-metrics">
          <article><Route size={19} /><span>{text('За 7 дней', '7 күнде', 'Last 7 days')}</span><strong>{summary.distanceKm7Days.toFixed(1)} {text('км', 'км', 'km')}</strong></article>
          <article><Clock3 size={19} /><span>{text('В движении', 'Қозғалыста', 'Moving time')}</span><strong>{timeLabel(summary.durationMinutes7Days)}</strong></article>
          <article><Activity size={19} /><span>{text('Поездок', 'Сапарлар', 'Rides')}</span><strong>{summary.ridesCount7Days}</strong></article>
          <article><TrendingUp size={19} /><span>{text('Нагрузка', 'Жүктеме', 'Load')}</span><strong>{summary.loadTrendPercent > 0 ? '+' : ''}{summary.loadTrendPercent}%</strong></article>
        </div>
      </section>

      <section className="coach-controls">
        <div>
          <div className="section-heading"><div><p className="kicker">{text('Цель', 'Мақсат', 'Goal')}</p><h2>{text('Над чем работаем?', 'Немен жұмыс істейміз?', 'What are we building?')}</h2></div></div>
          <div className="coach-goal-grid">{goals.map((item) => <button type="button" className={goal === item.id ? 'active' : ''} key={item.id} onClick={() => changeGoal(item.id)}><Target size={18} /><span><strong>{item.title}</strong><small>{item.description}</small></span></button>)}</div>
        </div>
        <div>
          <div className="section-heading"><div><p className="kicker">{text('Самочувствие', 'Сезім', 'How you feel')}</p><h2>{text('Как ты себя чувствуешь?', 'Өзіңді қалай сезінесің?', 'How do you feel?')}</h2></div></div>
          <div className="coach-feeling-scale">{feelings.map((label, index) => <button type="button" className={feeling === index + 1 ? 'active' : ''} key={label} onClick={() => changeFeeling(index + 1)}><strong>{index + 1}</strong><span>{label}</span></button>)}</div>
        </div>
      </section>

      <section className={`coach-advice-card coach-intensity-${advice.nextWorkout.intensity}`}>
        <header><div><p className="kicker">{advice.source === 'ai' ? text('Углублённый разбор ИИ', 'AI терең талдауы', 'Deep AI analysis') : text('Расширенный локальный анализ', 'Кеңейтілген жергілікті талдау', 'Enhanced local analysis')}</p><h2>{advice.headline}</h2><p>{advice.summary}</p></div><span className="coach-source-badge">{advice.source === 'ai' ? <><Sparkles size={15} />{advice.provider === 'gemini' ? 'Gemini AI' : 'AI'}</> : <><Gauge size={15} />{text('Расчёт', 'Есеп', 'Local')}</>}</span></header>
        <div className="coach-insight"><TrendingUp size={20} /><div><strong>{text('Главный вывод', 'Негізгі қорытынды', 'Key insight')}</strong><p>{advice.trainingInsight}</p></div><span>{confidenceLabel}</span></div>
        <div className="coach-workout">
          <div className="coach-workout-icon"><BatteryCharging size={28} /></div>
          <div><span>{text('Следующая тренировка', 'Келесі жаттығу', 'Next workout')} · {intensityLabels[advice.nextWorkout.intensity]}</span><h3>{advice.nextWorkout.title}</h3><p>{advice.nextWorkout.description}</p></div>
          <strong>{advice.nextWorkout.durationMinutes}<small>{text('минут', 'минут', 'minutes')}</small></strong>
        </div>

        <div className="coach-week-plan">
          <div className="section-heading"><div><p className="kicker"><CalendarDays size={14} /> {text('План на неделю', 'Апталық жоспар', 'Weekly plan')}</p><h3>{text('Три тренировки с прогрессией', 'Үдемелі үш жаттығу', 'Three progressive sessions')}</h3></div></div>
          <div>{advice.weeklyPlan.map((workout) => <article key={`${workout.order}-${workout.title}`}><span>{workout.order}</span><div><small>{workout.purpose}</small><strong>{workout.title}</strong><p>{workout.description}</p></div><b>{workout.durationMinutes} {text('мин', 'мин', 'min')}</b></article>)}</div>
        </div>

        <ul>{advice.focus.map((item) => <li key={item}><HeartPulse size={16} />{item}</li>)}</ul>
        <p className="coach-watch-metric"><Gauge size={16} /><strong>{text('Контроль прогресса:', 'Прогрестің бақылауы:', 'Progress check:')}</strong> {advice.watchMetric}</p>
        <div className="coach-advice-actions">
          <button type="button" className="signal-button" disabled={aiLoading || !rides.length} onClick={() => void generateAiAdvice()}>{aiLoading ? text('ИИ анализирует глубже…', 'AI терең талдап жатыр…', 'AI is analyzing…') : <><Sparkles size={17} />{text('Усилить анализ с ИИ', 'Талдауды AI-мен күшейту', 'Deepen with AI')}</>}</button>
          {!rides.length && <span>{text('Сначала сохрани хотя бы одну поездку.', 'Алдымен кемінде бір сапарды сақта.', 'Save at least one ride first.')}</span>}
        </div>
        {message && <p className="coach-message" role="status">{message}</p>}
      </section>

      <section className="coach-history-card">
        <div><Mountain size={20} /><span>{text('За 28 дней', '28 күнде', 'Last 28 days')}</span><strong>{summary.elevationGainM28Days} {text('м подъёма', 'м өрлеу', 'm climbed')}</strong></div>
        <div><Route size={20} /><span>{text('Самая длинная', 'Ең ұзақ', 'Longest ride')}</span><strong>{summary.longestRideKm28Days.toFixed(1)} {text('км', 'км', 'km')}</strong></div>
        <div><Gauge size={20} /><span>{text('Средняя скорость', 'Орташа жылдамдық', 'Average speed')}</span><strong>{summary.averageSpeedKmh28Days === null ? text('Нет данных', 'Дерек жоқ', 'No data') : `${summary.averageSpeedKmh28Days.toFixed(1)} ${text('км/ч', 'км/сағ', 'km/h')}`}</strong></div>
        <div><Activity size={20} /><span>{text('Активных дней', 'Белсенді күндер', 'Active days')}</span><strong>{summary.activeDays28Days}</strong></div>
      </section>

      <p className="coach-disclaimer">{advice.caution}</p>
    </>}
  </main></PageShell>;
}
