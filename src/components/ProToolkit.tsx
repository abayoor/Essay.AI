import { useMemo, useState, type ReactNode } from 'react';
import {
  Activity,
  Bike,
  Check,
  Droplets,
  Gauge,
  LockKeyhole,
  Moon,
  Salad,
  Sparkles,
  Wrench,
} from 'lucide-react';
import { useLocaleText } from '../lib/localized';

type ToolKey = 'ride' | 'pressure' | 'readiness' | 'service';
type RideIntensity = 'easy' | 'steady' | 'hard';
type Surface = 'road' | 'gravel' | 'trail';

type MetricProps = {
  icon: ReactNode;
  label: string;
  value: string;
  note: string;
};

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function Metric({ icon, label, value, note }: MetricProps) {
  return <article className="pro-tool-metric">
    <span>{icon}</span>
    <small>{label}</small>
    <strong>{value}</strong>
    <p>{note}</p>
  </article>;
}

export function ProToolkit({ active }: { active: boolean }) {
  const text = useLocaleText();
  const [tool, setTool] = useState<ToolKey>('ride');
  const [duration, setDuration] = useState(120);
  const [temperature, setTemperature] = useState(20);
  const [intensity, setIntensity] = useState<RideIntensity>('steady');
  const [riderWeight, setRiderWeight] = useState(70);
  const [bikeWeight, setBikeWeight] = useState(12);
  const [tireWidth, setTireWidth] = useState(38);
  const [surface, setSurface] = useState<Surface>('gravel');
  const [tubeless, setTubeless] = useState(false);
  const [sleepHours, setSleepHours] = useState(8);
  const [fatigue, setFatigue] = useState(2);
  const [plannedMinutes, setPlannedMinutes] = useState(60);
  const [chainKm, setChainKm] = useState(120);
  const [brakeKm, setBrakeKm] = useState(350);
  const [wetRide, setWetRide] = useState(false);

  const ridePlan = useMemo(() => {
    const hours = duration / 60;
    const heat = clamp((temperature - 15) * 12, -80, 300);
    const intensityWater = intensity === 'hard' ? 130 : intensity === 'steady' ? 60 : 0;
    const waterPerHour = Math.round(clamp(480 + heat + intensityWater, 400, 900) / 50) * 50;
    const carbsPerHour = duration < 60 ? 0 : intensity === 'hard' ? 70 : intensity === 'steady' ? 50 : 30;
    const recovery = Math.round(clamp(hours * (intensity === 'hard' ? 13 : intensity === 'steady' ? 9 : 6), 6, 48));
    return {
      waterPerHour,
      waterTotal: Math.round(waterPerHour * hours / 100) / 10,
      bottles: Math.max(1, Math.ceil(waterPerHour * hours / 600)),
      carbsPerHour,
      carbsTotal: Math.round(carbsPerHour * hours),
      recovery,
    };
  }, [duration, intensity, temperature]);

  const pressure = useMemo(() => {
    const systemWeight = riderWeight + bikeWeight;
    const setup = surface === 'road'
      ? { base: 4.5, referenceWidth: 28, minimum: 2.4, maximum: 7 }
      : surface === 'gravel'
        ? { base: 2.45, referenceWidth: 40, minimum: 1.45, maximum: 4.2 }
        : { base: 1.75, referenceWidth: 55, minimum: 1.1, maximum: 3.1 };
    const center = setup.base * (systemWeight / 85) * Math.pow(setup.referenceWidth / tireWidth, 1.08) - (tubeless ? 0.12 : 0);
    const front = clamp(center - 0.18, setup.minimum, setup.maximum);
    const rear = clamp(center + 0.18, setup.minimum, setup.maximum);
    return {
      front: Math.round(front * 10) / 10,
      rear: Math.round(rear * 10) / 10,
      frontPsi: Math.round(front * 14.5038),
      rearPsi: Math.round(rear * 14.5038),
    };
  }, [bikeWeight, riderWeight, surface, tireWidth, tubeless]);

  const readiness = useMemo(() => {
    const sleepScore = clamp((sleepHours - 5) * 15, 0, 45);
    const fatigueScore = clamp(35 - (fatigue - 1) * 8, 3, 35);
    const loadPenalty = plannedMinutes > 120 ? 10 : plannedMinutes > 75 ? 5 : 0;
    const score = Math.round(clamp(20 + sleepScore + fatigueScore - loadPenalty, 20, 100));
    const recommendation = score >= 80
      ? text('Можно выполнять запланированный заезд.', 'Жоспарланған сапарды орындауға болады.', 'You can complete the planned ride.')
      : score >= 60
        ? text('Оставь умеренный темп без максимальных усилий.', 'Максималды күшсіз орташа қарқын ұста.', 'Keep a moderate pace and avoid maximal efforts.')
        : text('Сократи поездку или выбери лёгкое восстановление.', 'Сапарды қысқарт немесе жеңіл қалпына келуді таңда.', 'Shorten the ride or choose easy recovery.');
    return { score, recommendation };
  }, [fatigue, plannedMinutes, sleepHours, text]);

  const serviceItems = useMemo(() => {
    const items: { urgent: boolean; title: string; note: string }[] = [];
    if (wetRide || chainKm >= 180) items.push({
      urgent: true,
      title: text('Очистить и смазать цепь', 'Тізбекті тазалап, майлау', 'Clean and lubricate the chain'),
      note: wetRide
        ? text('После мокрой или грязной поездки — сейчас.', 'Сулы не лас сапардан кейін — қазір.', 'Do it now after a wet or dirty ride.')
        : text(`${chainKm} км после смазки — пора обслужить.`, `Майлаудан кейін ${chainKm} км — қызмет көрсету керек.`, `${chainKm} km since lubrication — service is due.`),
    });
    else items.push({
      urgent: false,
      title: text('Цепь пока в норме', 'Тізбек әзірше қалыпты', 'Chain is currently fine'),
      note: text(`Проверь снова примерно через ${Math.max(20, 180 - chainKm)} км.`, `Шамамен ${Math.max(20, 180 - chainKm)} км кейін қайта тексер.`, `Check again in about ${Math.max(20, 180 - chainKm)} km.`),
    });
    items.push({
      urgent: brakeKm >= 500,
      title: brakeKm >= 500
        ? text('Проверить колодки и диски', 'Қалыптар мен дискілерді тексеру', 'Inspect pads and rotors')
        : text('Контроль тормозов', 'Тежегішті бақылау', 'Brake check'),
      note: brakeKm >= 500
        ? text(`${brakeKm} км с последней проверки — не откладывай.`, `Соңғы тексеруден бері ${brakeKm} км — кейінге қалдырма.`, `${brakeKm} km since the last check — do not delay.`)
        : text(`Следующая полная проверка примерно через ${500 - brakeKm} км.`, `Келесі толық тексеру шамамен ${500 - brakeKm} км кейін.`, `Next full inspection in about ${500 - brakeKm} km.`),
    });
    items.push({
      urgent: false,
      title: text('Перед следующим выездом', 'Келесі сапар алдында', 'Before the next ride'),
      note: text('Давление, люфты колёс, тормоза, свет и крепление руля.', 'Қысым, дөңгелек люфті, тежегіш, жарық және руль бекітпесі.', 'Check pressure, wheel play, brakes, lights and handlebar bolts.'),
    });
    return items;
  }, [brakeKm, chainKm, text, wetRide]);

  const tabs: { key: ToolKey; icon: ReactNode; label: string }[] = [
    { key: 'ride', icon: <Droplets size={17} />, label: text('План заезда', 'Сапар жоспары', 'Ride plan') },
    { key: 'pressure', icon: <Gauge size={17} />, label: text('Давление', 'Қысым', 'Pressure') },
    { key: 'readiness', icon: <Activity size={17} />, label: text('Готовность', 'Дайындық', 'Readiness') },
    { key: 'service', icon: <Wrench size={17} />, label: text('Сервис', 'Қызмет', 'Service') },
  ];

  return <section className="pro-toolkit" aria-labelledby="pro-toolkit-title">
    <header className="pro-toolkit-heading">
      <div>
        <p className="pro-eyebrow"><Sparkles size={14} /> Pro Ride Lab</p>
        <h2 id="pro-toolkit-title">{text('4 инструмента для каждого выезда', 'Әр сапарға арналған 4 құрал', '4 tools for every ride')}</h2>
        <p>{text(
          'Они работают сразу: помогают подготовить воду и питание, подобрать стартовое давление, оценить нагрузку и не пропустить обслуживание.',
          'Олар бірден жұмыс істейді: су мен тамақты дайындауға, бастапқы қысымды таңдауға, жүктемені бағалауға және қызмет көрсетуді өткізіп алмауға көмектеседі.',
          'Instant tools for hydration and fueling, starting pressure, workload readiness and timely maintenance.',
        )}</p>
      </div>
      <span className="pro-toolkit-live"><Check size={15} /> {text('Уже доступно', 'Қазір қолжетімді', 'Available now')}</span>
    </header>

    <div className={`pro-toolkit-shell${active ? '' : ' locked'}`}>
      <div className="pro-tool-tabs" role="tablist" aria-label={text('Инструменты Pro', 'Pro құралдары', 'Pro tools')}>
        {tabs.map((item) => <button key={item.key} type="button" role="tab" aria-selected={tool === item.key} onClick={() => setTool(item.key)}>
          {item.icon}<span>{item.label}</span>
        </button>)}
      </div>

      <div className="pro-tool-body">
        {tool === 'ride' && <div className="pro-tool-layout">
          <div className="pro-tool-controls">
            <label>{text('Длительность', 'Ұзақтығы', 'Duration')}<span><input disabled={!active} type="number" min="20" max="600" step="10" inputMode="numeric" value={duration} onChange={(event) => setDuration(clamp(Number(event.target.value), 20, 600))} /><b>{text('мин', 'мин', 'min')}</b></span></label>
            <label>{text('Температура', 'Температура', 'Temperature')}<span><input disabled={!active} type="number" min="-10" max="45" inputMode="numeric" value={temperature} onChange={(event) => setTemperature(clamp(Number(event.target.value), -10, 45))} /><b>°C</b></span></label>
            <label>{text('Интенсивность', 'Қарқындылық', 'Intensity')}<select disabled={!active} value={intensity} onChange={(event) => setIntensity(event.target.value as RideIntensity)}><option value="easy">{text('Легко', 'Жеңіл', 'Easy')}</option><option value="steady">{text('Умеренно', 'Орташа', 'Steady')}</option><option value="hard">{text('Тяжело', 'Қатты', 'Hard')}</option></select></label>
          </div>
          <div className="pro-tool-results">
            <Metric icon={<Droplets size={18} />} label={text('Вода', 'Су', 'Water')} value={`${ridePlan.waterTotal} л`} note={`${ridePlan.waterPerHour} ${text('мл/ч', 'мл/сағ', 'ml/h')} · ${ridePlan.bottles} × 600 ml`} />
            <Metric icon={<Salad size={18} />} label={text('Углеводы', 'Көмірсулар', 'Carbohydrates')} value={`${ridePlan.carbsTotal} г`} note={`${ridePlan.carbsPerHour} ${text('г/ч во время пути', 'г/сағ жолда', 'g/h during the ride')}`} />
            <Metric icon={<Moon size={18} />} label={text('Восстановление', 'Қалпына келу', 'Recovery')} value={`~${ridePlan.recovery} ч`} note={text('Стартовая оценка до следующей тяжёлой нагрузки', 'Келесі ауыр жүктемеге дейінгі бастапқы баға', 'Starting estimate before the next hard effort')} />
          </div>
        </div>}

        {tool === 'pressure' && <div className="pro-tool-layout">
          <div className="pro-tool-controls">
            <label>{text('Вес райдера', 'Райдер салмағы', 'Rider weight')}<span><input disabled={!active} type="number" min="35" max="200" inputMode="decimal" value={riderWeight} onChange={(event) => setRiderWeight(clamp(Number(event.target.value), 35, 200))} /><b>kg</b></span></label>
            <label>{text('Вес велосипеда', 'Велосипед салмағы', 'Bike weight')}<span><input disabled={!active} type="number" min="5" max="40" inputMode="decimal" value={bikeWeight} onChange={(event) => setBikeWeight(clamp(Number(event.target.value), 5, 40))} /><b>kg</b></span></label>
            <label>{text('Ширина шины', 'Шина ені', 'Tire width')}<span><input disabled={!active} type="number" min="23" max="80" inputMode="numeric" value={tireWidth} onChange={(event) => setTireWidth(clamp(Number(event.target.value), 23, 80))} /><b>mm</b></span></label>
            <label>{text('Покрытие', 'Жол жамылғысы', 'Surface')}<select disabled={!active} value={surface} onChange={(event) => setSurface(event.target.value as Surface)}><option value="road">{text('Асфальт', 'Асфальт', 'Road')}</option><option value="gravel">{text('Гревел / смешанное', 'Гревел / аралас', 'Gravel / mixed')}</option><option value="trail">{text('Грунт / MTB', 'Топырақ / MTB', 'Trail / MTB')}</option></select></label>
            <label className="pro-tool-toggle"><input disabled={!active} type="checkbox" checked={tubeless} onChange={(event) => setTubeless(event.target.checked)} /><span>{text('Бескамерные шины', 'Камерасыз шиналар', 'Tubeless tires')}</span></label>
          </div>
          <div className="pro-pressure-result">
            <Bike size={23} />
            <div><small>{text('Переднее', 'Алдыңғы', 'Front')}</small><strong>{pressure.front} bar</strong><span>{pressure.frontPsi} PSI</span></div>
            <div><small>{text('Заднее', 'Артқы', 'Rear')}</small><strong>{pressure.rear} bar</strong><span>{pressure.rearPsi} PSI</span></div>
            <p>{text('Это безопасная стартовая оценка. Не выходи за диапазон, указанный на шине и ободе.', 'Бұл қауіпсіз бастапқы баға. Шина мен жиекте көрсетілген диапазоннан шықпа.', 'This is a safe starting estimate. Never exceed the tire and rim limits.')}</p>
          </div>
        </div>}

        {tool === 'readiness' && <div className="pro-tool-layout">
          <div className="pro-tool-controls">
            <label>{text('Сон прошлой ночью', 'Кеше түнгі ұйқы', 'Sleep last night')}<span><input disabled={!active} type="number" min="3" max="12" step="0.5" inputMode="decimal" value={sleepHours} onChange={(event) => setSleepHours(clamp(Number(event.target.value), 3, 12))} /><b>{text('ч', 'сағ', 'h')}</b></span></label>
            <label>{text('Усталость 1–5', 'Шаршау 1–5', 'Fatigue 1–5')}<input disabled={!active} type="range" min="1" max="5" value={fatigue} onChange={(event) => setFatigue(Number(event.target.value))} /><output>{fatigue} / 5</output></label>
            <label>{text('Планируемая поездка', 'Жоспарланған сапар', 'Planned ride')}<span><input disabled={!active} type="number" min="20" max="360" step="10" inputMode="numeric" value={plannedMinutes} onChange={(event) => setPlannedMinutes(clamp(Number(event.target.value), 20, 360))} /><b>{text('мин', 'мин', 'min')}</b></span></label>
          </div>
          <div className="pro-readiness-result">
            <span>{readiness.score}</span><small>/ 100</small>
            <h3>{readiness.score >= 80 ? text('Готов к нагрузке', 'Жүктемеге дайын', 'Ready to ride') : readiness.score >= 60 ? text('Умеренная готовность', 'Орташа дайындық', 'Moderate readiness') : text('Нужен лёгкий день', 'Жеңіл күн қажет', 'Choose an easy day')}</h3>
            <p>{readiness.recommendation}</p>
          </div>
        </div>}

        {tool === 'service' && <div className="pro-tool-layout">
          <div className="pro-tool-controls">
            <label>{text('После смазки цепи', 'Тізбекті майлағаннан кейін', 'Since chain lubrication')}<span><input disabled={!active} type="number" min="0" max="2000" step="10" inputMode="numeric" value={chainKm} onChange={(event) => setChainKm(clamp(Number(event.target.value), 0, 2000))} /><b>km</b></span></label>
            <label>{text('После проверки тормозов', 'Тежегіш тексерілгеннен кейін', 'Since brake inspection')}<span><input disabled={!active} type="number" min="0" max="5000" step="10" inputMode="numeric" value={brakeKm} onChange={(event) => setBrakeKm(clamp(Number(event.target.value), 0, 5000))} /><b>km</b></span></label>
            <label className="pro-tool-toggle"><input disabled={!active} type="checkbox" checked={wetRide} onChange={(event) => setWetRide(event.target.checked)} /><span>{text('Последняя поездка была мокрой/грязной', 'Соңғы сапар сулы/лас болды', 'Last ride was wet or muddy')}</span></label>
          </div>
          <div className="pro-service-result">
            {serviceItems.map((item) => <article key={item.title} className={item.urgent ? 'urgent' : ''}><span>{item.urgent ? <Wrench size={17} /> : <Check size={17} />}</span><div><strong>{item.title}</strong><p>{item.note}</p></div></article>)}
          </div>
        </div>}
      </div>

      {!active && <div className="pro-tool-lock"><LockKeyhole size={22} /><strong>{text('Ride Lab входит в Pro', 'Ride Lab Pro құрамына кіреді', 'Ride Lab is included with Pro')}</strong><a href="#pro-price">{text('Открыть за $5 в месяц', 'Айына $5-ға ашу', 'Unlock for $5/month')}</a></div>}
    </div>
    <p className="pro-tool-disclaimer">{text('Расчёты дают стартовые спортивные ориентиры, а не медицинские рекомендации. Учитывай самочувствие, инструкции производителя и реальные условия.', 'Есептер медициналық кеңес емес, бастапқы спорттық бағдар береді. Өзіңнің күйіңді, өндіруші нұсқауын және нақты жағдайды ескер.', 'Calculations provide starting sports guidance, not medical advice. Follow how you feel, manufacturer limits and real conditions.')}</p>
  </section>;
}
