import { useState, type FormEvent, type ReactNode } from 'react';
import {
  Activity,
  Bike,
  BrainCircuit,
  Check,
  ChevronRight,
  CircleAlert,
  Gauge,
  HeartPulse,
  LockKeyhole,
  MapPinned,
  Salad,
  ShieldCheck,
  Wrench,
} from 'lucide-react';
import { Link } from 'wouter';
import { useLocaleText } from '../lib/localized';
import { usePreferences } from '../lib/preferences';
import { requestProBikeAnalysis, type ProBikeAnalysis, type ProRiderInput } from '../lib/proAnalysis';

type ProAnalyzerProps = {
  active: boolean;
  statusLoading: boolean;
};

type ProFormState = {
  heightCm: string;
  weightKg: string;
  inseamCm: string;
  weeklyHours: string;
  budgetUsd: string;
  experience: ProRiderInput['experience'];
  ridingStyle: ProRiderInput['ridingStyle'];
  primaryGoal: ProRiderInput['primaryGoal'];
  terrain: ProRiderInput['terrain'];
  currentBike: string;
  discomfort: string;
};

const initialForm: ProFormState = {
  heightCm: '',
  weightKg: '',
  inseamCm: '',
  weeklyHours: '',
  budgetUsd: '',
  experience: 'beginner',
  ridingStyle: 'city',
  primaryGoal: 'fitness',
  terrain: 'mixed',
  currentBike: '',
  discomfort: '',
};

function ResultSection({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return <section className="pro-analysis-section">
    <header><span>{icon}</span><h4>{title}</h4></header>
    {children}
  </section>;
}

export function ProAnalyzer({ active, statusLoading }: ProAnalyzerProps) {
  const text = useLocaleText();
  const { locale } = usePreferences();
  const [form, setForm] = useState<ProFormState>(initialForm);
  const [analysis, setAnalysis] = useState<ProBikeAnalysis | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [consent, setConsent] = useState(false);

  function update<K extends keyof ProFormState>(key: K, value: ProFormState[K]): void {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function analyze(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!active) return;
    if (!consent) {
      setError(text(
        'Подтверди передачу данных ИИ-модели для этого анализа.',
        'Осы талдау үшін деректерді AI моделіне жіберуге келісімді раста.',
        'Confirm that your data may be sent to the AI model for this analysis.',
      ));
      return;
    }
    setSubmitting(true);
    setError('');
    setAnalysis(null);
    try {
      setAnalysis(await requestProBikeAnalysis({
        locale,
        consentToAi: true,
        consentPolicyVersion: '2026-08-01',
        heightCm: Number(form.heightCm),
        weightKg: Number(form.weightKg),
        inseamCm: Number(form.inseamCm),
        weeklyHours: Number(form.weeklyHours),
        budgetUsd: form.budgetUsd.trim() ? Number(form.budgetUsd) : null,
        experience: form.experience,
        ridingStyle: form.ridingStyle,
        primaryGoal: form.primaryGoal,
        terrain: form.terrain,
        currentBike: form.currentBike.trim(),
        discomfort: form.discomfort.trim(),
      }));
    } catch (value) {
      setError(value instanceof Error ? value.message : text(
        'Не удалось выполнить анализ. Попробуй ещё раз.',
        'Талдау орындалмады. Қайтадан көр.',
        'Could not complete the analysis. Try again.',
      ));
    } finally {
      setSubmitting(false);
    }
  }

  const confidenceLabel = analysis ? {
    low: text('Нужны дополнительные данные', 'Қосымша деректер қажет', 'More data needed'),
    medium: text('Средняя уверенность', 'Орташа сенімділік', 'Medium confidence'),
    high: text('Высокая уверенность', 'Жоғары сенімділік', 'High confidence'),
  }[analysis.confidence.level] : '';

  return <section className="pro-analyzer" aria-labelledby="pro-analyzer-title">
    <header className="pro-analyzer-heading">
      <div>
        <p className="pro-eyebrow"><BrainCircuit size={14} /> {text('Pro-анализ', 'Pro талдау', 'Pro analysis')}</p>
        <h2 id="pro-analyzer-title">{text('Один понятный отчёт именно для тебя', 'Дәл саған арналған бір түсінікті есеп', 'One clear report built around you')}</h2>
        <p>{text(
          'Ответь на несколько вопросов. ИИ сопоставит твои параметры, опыт и цели и даст конкретный план без сложных таблиц.',
          'Бірнеше сұраққа жауап бер. AI параметрлеріңді, тәжірибеңді және мақсаттарыңды салыстырып, күрделі кестесіз нақты жоспар береді.',
          'Answer a few questions. AI combines your measurements, experience and goals into a concrete plan without complicated tables.',
        )}</p>
      </div>
      <span className="pro-analyzer-private"><ShieldCheck size={15} /> {text('Без автосохранения', 'Автосақтаусыз', 'No auto-save')}</span>
    </header>

    <div className="pro-analyzer-outcomes">
      <strong>{text('Что будет в отчёте', 'Есепте не болады', 'What the report includes')}</strong>
      <ul>
        <li><Check size={15} />{text('Размер и посадка', 'Өлшем және отырыс', 'Size and fit')}</li>
        <li><Check size={15} />{text('План тренировок', 'Жаттығу жоспары', 'Training plan')}</li>
        <li><Check size={15} />{text('Маршруты и безопасность', 'Бағыттар және қауіпсіздік', 'Routes and safety')}</li>
        <li><Check size={15} />{text('Обслуживание и питание', 'Қызмет көрсету және тамақтану', 'Maintenance and nutrition')}</li>
      </ul>
    </div>

    {!active ? <div className={`pro-analyzer-locked${statusLoading ? ' loading' : ''}`}>
      <div className="pro-locked-preview" aria-hidden="true">
        <article><Bike size={21} /><span>{text('Размер рамы', 'Рама өлшемі', 'Frame size')}</span><strong>54–56 cm</strong></article>
        <article><Gauge size={21} /><span>{text('Посадка', 'Отырыс', 'Fit')}</span><strong>{text('Endurance', 'Endurance', 'Endurance')}</strong></article>
        <article><MapPinned size={21} /><span>{text('Маршрут', 'Бағыт', 'Route')}</span><strong>{text('Асфальт · холмы', 'Асфальт · төбе', 'Road · hills')}</strong></article>
      </div>
      <div className="pro-locked-panel">
        <span><LockKeyhole size={22} /></span>
        <h3>{statusLoading
          ? text('Проверяем подписку…', 'Жазылымды тексеріп жатырмыз…', 'Checking your subscription…')
          : text('Персональный разбор доступен в Pro', 'Жеке талдау Pro ішінде қолжетімді', 'Personal analysis is available with Pro')}</h3>
        <p>{text(
          'Активируй Pro, чтобы получить не общий совет, а подробный отчёт по твоим параметрам.',
          'Жалпы кеңес емес, өз параметрлерің бойынша толық есеп алу үшін Pro-ны қос.',
          'Activate Pro for a detailed report based on your measurements, not generic advice.',
        )}</p>
        {!statusLoading && <a href="#pro-price">{text('Посмотреть тариф', 'Тарифті көру', 'See the plan')} <ChevronRight size={16} /></a>}
      </div>
    </div> : <>
      <form className="pro-analysis-form" onSubmit={(event) => void analyze(event)}>
        <div className="pro-analysis-form-intro">
          <span><BrainCircuit size={21} /></span>
          <div><h3>{text('Расскажи немного о себе', 'Өзің туралы қысқаша айт', 'Tell us a little about yourself')}</h3><p>{text('8 коротких вопросов · около 2 минут', '8 қысқа сұрақ · шамамен 2 минут', '8 short questions · about 2 minutes')}</p></div>
        </div>

        <section className="pro-form-section">
          <header><span>01</span><div><h3>{text('Размер и посадка', 'Өлшем және отырыс', 'Size and fit')}</h3><p>{text('Эти данные нужны для примерного размера рамы и настройки посадки.', 'Бұл деректер шамамен рама өлшемі мен отырысты реттеу үшін қажет.', 'These details help estimate frame size and fit.')}</p></div></header>
          <div className="pro-form-grid three">
            <label>{text('Рост', 'Бой', 'Height')}<span><input type="number" inputMode="decimal" min="120" max="230" step="0.1" placeholder="175" required value={form.heightCm} onChange={(event) => update('heightCm', event.target.value)} /><b>{text('см', 'см', 'cm')}</b></span></label>
            <label>{text('Вес', 'Салмақ', 'Weight')}<span><input type="number" inputMode="decimal" min="30" max="250" step="0.1" placeholder="70" required value={form.weightKg} onChange={(event) => update('weightKg', event.target.value)} /><b>{text('кг', 'кг', 'kg')}</b></span></label>
            <label>{text('Длина ноги по внутреннему шву', 'Аяқтың ішкі ұзындығы', 'Inseam')}<span><input type="number" inputMode="decimal" min="50" max="125" step="0.1" placeholder="80" required value={form.inseamCm} onChange={(event) => update('inseamCm', event.target.value)} /><b>{text('см', 'см', 'cm')}</b></span></label>
          </div>
          <p className="pro-form-tip">{text(
            'Длину ноги измерь босиком от пола до точки опоры седла. Это важнее одного только роста.',
            'Аяқ ұзындығын жалаңаяқ еденнен ер тірелетін нүктеге дейін өлше. Бұл бойдан да маңызды.',
            'Measure inseam barefoot from the floor to the saddle contact point; it matters more than height alone.',
          )}</p>
        </section>

        <section className="pro-form-section">
          <header><span>02</span><div><h3>{text('Как и зачем ты катаешься', 'Қалай және не үшін мінесің', 'How and why you ride')}</h3><p>{text('Так рекомендации будут соответствовать твоему уровню и реальным маршрутам.', 'Осылайша ұсыныстар деңгейіңе және нақты бағыттарыңа сәйкес келеді.', 'This keeps recommendations relevant to your level and real routes.')}</p></div></header>
          <div className="pro-form-grid two">
            <label>{text('Опыт', 'Тәжірибе', 'Experience')}<select value={form.experience} onChange={(event) => update('experience', event.target.value as ProRiderInput['experience'])}><option value="beginner">{text('Начинающий', 'Бастаушы', 'Beginner')}</option><option value="intermediate">{text('Регулярно катаюсь', 'Тұрақты мінемін', 'Intermediate')}</option><option value="advanced">{text('Опытный', 'Тәжірибелі', 'Advanced')}</option></select></label>
            <label>{text('Стиль катания', 'Міну стилі', 'Riding style')}<select value={form.ridingStyle} onChange={(event) => update('ridingStyle', event.target.value as ProRiderInput['ridingStyle'])}><option value="city">{text('Город', 'Қала', 'City')}</option><option value="road">{text('Шоссе', 'Шоссе', 'Road')}</option><option value="gravel">{text('Гревел', 'Гревел', 'Gravel')}</option><option value="mountain">{text('MTB', 'MTB', 'Mountain')}</option><option value="touring">{text('Туринг', 'Туринг', 'Touring')}</option></select></label>
            <label>{text('Главная цель', 'Негізгі мақсат', 'Primary goal')}<select value={form.primaryGoal} onChange={(event) => update('primaryGoal', event.target.value as ProRiderInput['primaryGoal'])}><option value="comfort">{text('Комфорт', 'Жайлылық', 'Comfort')}</option><option value="fitness">{text('Форма и здоровье', 'Форма және денсаулық', 'Fitness')}</option><option value="commute">{text('Поездки по делам', 'Күнделікті сапар', 'Commuting')}</option><option value="speed">{text('Скорость', 'Жылдамдық', 'Speed')}</option><option value="adventure">{text('Путешествия', 'Саяхат', 'Adventure')}</option></select></label>
            <label>{text('Основной рельеф', 'Негізгі жер бедері', 'Main terrain')}<select value={form.terrain} onChange={(event) => update('terrain', event.target.value as ProRiderInput['terrain'])}><option value="flat">{text('Равнина', 'Жазық', 'Flat')}</option><option value="mixed">{text('Смешанный', 'Аралас', 'Mixed')}</option><option value="hilly">{text('Много подъёмов', 'Көп өр', 'Hilly')}</option><option value="trails">{text('Трейлы и грунт', 'Соқпақ пен топырақ', 'Trails')}</option></select></label>
          </div>
        </section>

        <section className="pro-form-section">
          <header><span>03</span><div><h3>{text('Твои реальные условия', 'Нақты жағдайларың', 'Your real-world situation')}</h3><p>{text('Время, бюджет и текущий велосипед делают итоговый план практичным.', 'Уақыт, бюджет және қазіргі велосипед қорытынды жоспарды пайдалы етеді.', 'Time, budget and your current bike make the final plan practical.')}</p></div></header>
          <div className="pro-form-grid two">
            <label>{text('Часов в неделю', 'Аптасына сағат', 'Hours per week')}<span><input type="number" inputMode="decimal" min="0" max="40" step="0.5" placeholder="4" required value={form.weeklyHours} onChange={(event) => update('weeklyHours', event.target.value)} /><b>{text('ч', 'сағ', 'h')}</b></span></label>
            <label>{text('Бюджет, необязательно', 'Бюджет, міндетті емес', 'Budget, optional')}<span><input type="number" inputMode="numeric" min="100" max="50000" step="50" placeholder="1200" value={form.budgetUsd} onChange={(event) => update('budgetUsd', event.target.value)} /><b>USD</b></span></label>
          </div>
          <label className="pro-wide-label">{text('Текущий велосипед, если есть', 'Қазіргі велосипед, бар болса', 'Current bike, if any')}<input type="text" maxLength={160} placeholder={text('Например: городской велосипед, рама M, колёса 700×35', 'Мысалы: қала велосипеді, M рама, 700×35 дөңгелек', 'Example: city bike, size M, 700×35 tires')} value={form.currentBike} onChange={(event) => update('currentBike', event.target.value)} /></label>
          <label className="pro-wide-label">{text('Что неудобно или беспокоит?', 'Не ыңғайсыз немесе мазалайды?', 'Any discomfort or concerns?')}<textarea maxLength={500} rows={3} placeholder={text('Например: немеют ладони после часа, слишком тянусь к рулю', 'Мысалы: бір сағаттан кейін алақан ұйиды, рульге тым созыламын', 'Example: hands go numb after an hour; reach feels too long')} value={form.discomfort} onChange={(event) => update('discomfort', event.target.value)} /></label>
        </section>

        <label className="pro-analysis-consent">
          <input type="checkbox" required checked={consent} onChange={(event) => setConsent(event.target.checked)} />
          <span><strong>{text(
            'Я согласен передать эти параметры модели ИИ Google для создания одного отчёта.',
            'Бір есеп жасау үшін осы параметрлерді Google AI моделіне жіберуге келісемін.',
            'I agree to send these details to Google AI to create one report.',
          )}</strong><small>{text(
            'Slipstream не сохраняет анкету автоматически. Не указывай медицинские документы или секретные данные.',
            'Slipstream сауалнаманы автоматты түрде сақтамайды. Медициналық құжаттарды немесе құпия деректерді жазба.',
            'Slipstream does not auto-save the form. Do not enter medical records or secrets.',
          )}</small></span>
        </label>
        <p className="pro-analysis-policy-link">
          <Link href="/legal/privacy">{text('Как используются данные', 'Деректер қалай пайдаланылады', 'How your data is used')}</Link>
        </p>

        <div className="pro-analysis-submit">
          <div><ShieldCheck size={16} /><span><strong>{text('Данные не сохраняются автоматически', 'Деректер автоматты сақталмайды', 'Nothing is auto-saved')}</strong><small>{text('Они используются для этого анализа', 'Олар осы талдау үшін пайдаланылады', 'They are used for this analysis')}</small></span></div>
          <button type="submit" disabled={submitting}>{submitting ? text('Собираем отчёт…', 'Есеп дайындалып жатыр…', 'Building your report…') : <><BrainCircuit size={17} />{text('Создать мой Pro-разбор', 'Менің Pro талдауымды жасау', 'Create my Pro analysis')}</>}</button>
        </div>
      </form>

      {error && <p className="pro-analysis-error" role="alert"><CircleAlert size={17} /> {error}</p>}

      {analysis && <article className="pro-analysis-result" aria-live="polite">
        <header className="pro-result-hero">
          <div><p className="pro-eyebrow"><Gauge size={14} /> {text('Твой персональный разбор', 'Сенің жеке талдауың', 'Your personal analysis')}</p><h3>{analysis.headline}</h3><p>{analysis.summary}</p></div>
          <span className={`pro-confidence ${analysis.confidence.level}`}><Check size={14} /> {confidenceLabel}</span>
        </header>

        <div className="pro-result-grid">
          <ResultSection icon={<Bike size={19} />} title={text('Велосипед и посадка', 'Велосипед және отырыс', 'Bike and fit')}>
            <dl className="pro-spec-list">
              <div><dt>{text('Категория', 'Санат', 'Category')}</dt><dd>{analysis.bikeRecommendation.category}</dd></div>
              <div><dt>{text('Размер рамы', 'Рама өлшемі', 'Frame size')}</dt><dd>{analysis.bikeRecommendation.frameSizeGuidance}</dd></div>
              <div><dt>{text('Геометрия', 'Геометрия', 'Geometry')}</dt><dd>{analysis.bikeRecommendation.geometry}</dd></div>
              <div><dt>{text('Колёса и шины', 'Дөңгелек пен шина', 'Wheels and tires')}</dt><dd>{analysis.bikeRecommendation.wheelAndTires}</dd></div>
              <div><dt>{text('Рама и вилка', 'Рама және аша', 'Frame and fork')}</dt><dd>{analysis.bikeRecommendation.frameAndFork}</dd></div>
              <div><dt>{text('Трансмиссия', 'Трансмиссия', 'Drivetrain')}</dt><dd>{analysis.bikeRecommendation.drivetrain}</dd></div>
              <div><dt>{text('Тормоза', 'Тежегіштер', 'Brakes')}</dt><dd>{analysis.bikeRecommendation.brakes}</dd></div>
            </dl>
          </ResultSection>

          <ResultSection icon={<Activity size={19} />} title={text('Тренировочный план', 'Жаттығу жоспары', 'Training plan')}>
            <div className="pro-copy-stack"><p><strong>{text('Неделя', 'Апта', 'Week')}</strong>{analysis.training.weeklyStructure}</p><p><strong>{text('Интенсивность', 'Қарқындылық', 'Intensity')}</strong>{analysis.training.intensity}</p><p><strong>{text('Восстановление', 'Қалпына келу', 'Recovery')}</strong>{analysis.training.recovery}</p></div>
          </ResultSection>

          <ResultSection icon={<MapPinned size={19} />} title={text('Маршруты', 'Бағыттар', 'Routes')}>
            <div className="pro-copy-stack"><p><strong>{text('Приоритет', 'Басымдық', 'Routing')}</strong>{analysis.route.routingPreference}</p><p><strong>{text('Покрытие и рельеф', 'Жол мен жер бедері', 'Surface and climbing')}</strong>{analysis.route.surfaceAndClimbing}</p><p><strong>{text('Безопасность', 'Қауіпсіздік', 'Safety')}</strong>{analysis.route.safety}</p></div>
          </ResultSection>

          <ResultSection icon={<Wrench size={19} />} title={text('Обслуживание', 'Қызмет көрсету', 'Maintenance')}>
            <ul className="pro-result-checklist">{analysis.maintenance.map((item, index) => <li key={`${index}-${item}`}><Check size={14} />{item}</li>)}</ul>
          </ResultSection>

          <ResultSection icon={<Salad size={19} />} title={text('Питание и вода', 'Тамақ пен су', 'Nutrition and hydration')}>
            <div className="pro-copy-stack"><p><strong>{text('До поездки', 'Сапар алдында', 'Before')}</strong>{analysis.nutrition.before}</p><p><strong>{text('В пути', 'Жолда', 'During')}</strong>{analysis.nutrition.during}</p><p><strong>{text('После', 'Кейін', 'After')}</strong>{analysis.nutrition.after}</p></div>
          </ResultSection>

          <ResultSection icon={<Gauge size={19} />} title={text('Проверка перед покупкой', 'Сатып алу алдындағы тексеру', 'Buying checklist')}>
            <ul className="pro-result-checklist">{analysis.bikeRecommendation.buyingChecklist.map((item, index) => <li key={`${index}-${item}`}><Check size={14} />{item}</li>)}</ul>
          </ResultSection>
        </div>

        <ResultSection icon={<HeartPulse size={19} />} title={text('Проверка посадки', 'Отырысты тексеру', 'Fit checklist')}>
          <ul className="pro-result-checklist columns">{analysis.bikeRecommendation.fitChecklist.map((item, index) => <li key={`${index}-${item}`}><Check size={14} />{item}</li>)}</ul>
        </ResultSection>

        {analysis.confidence.missingData.length > 0 && <p className="pro-missing-data"><CircleAlert size={16} /><span><strong>{text('Чтобы сделать вывод точнее:', 'Нәтижені нақтылау үшін:', 'To improve accuracy:')}</strong> {analysis.confidence.missingData.join(' · ')}</span></p>}
        <p className="pro-result-safety"><ShieldCheck size={17} /> {analysis.safetyNote}</p>
      </article>}
    </>}
  </section>;
}
