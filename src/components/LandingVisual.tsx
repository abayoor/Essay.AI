import { BrainCircuit, Heart, MapPin, MessageCircle, Navigation, Send, Sparkles } from 'lucide-react';
import bikeWorkshopPhoto from '../assets/landing/bike-workshop.jpg';
import communityRidePhoto from '../assets/landing/community-ride.jpg';
import routeRidePhoto from '../assets/landing/route-ride.jpg';
import { useLocaleText } from '../lib/localized';

type LandingVisualKind = 'hero' | 'recording' | 'routes' | 'analysis' | 'community' | 'marketplace';

function PhotoCredit({ href, children }: { href: string; children: string }) {
  return <a className="landing-photo-credit" href={href} target="_blank" rel="noreferrer">{children}</a>;
}

export function LandingVisual({ kind }: { kind: LandingVisualKind }) {
  const t = useLocaleText();

  if (kind === 'hero') {
    return (
      <div className="landing-visual landing-photo-visual visual-hero-photo">
        <img src={routeRidePhoto} alt={t('Велосипедист на горной дороге', 'Таулы жолдағы велосипедші', 'Cyclist on a mountain road')} />
        <div className="landing-photo-shade" />
        <div className="hero-ride-card">
          <span>{t('Утренний заезд', 'Таңғы сапар', 'Morning ride')}</span>
          <strong>32,4 <small>{t('км', 'км', 'km')}</small></strong>
          <dl>
            <div><dt>{t('Время', 'Уақыт', 'Time')}</dt><dd>1:27:18</dd></div>
            <div><dt>{t('Набор', 'Биіктік', 'Elevation')}</dt><dd>+684 м</dd></div>
          </dl>
        </div>
        <div className="hero-live-pill"><span />GPS {t('запись', 'жазба', 'recording')}</div>
        <PhotoCredit href="https://unsplash.com/photos/cyclist-on-a-winding-road-in-the-mountains-nwDtwquRJJ0">Hassan Anayi · Unsplash</PhotoCredit>
      </div>
    );
  }

  if (kind === 'recording') {
    return (
      <div className="landing-visual visual-product-screen visual-recording-screen" aria-label={t('Экран записи тренировки', 'Жаттығуды жазу экраны', 'Workout recording screen')}>
        <header><span><i /> LIVE GPS</span><b>00:48:12</b></header>
        <strong className="recording-distance">18,42 <small>{t('км', 'км', 'km')}</small></strong>
        <div className="recording-route" aria-hidden="true">
          <svg viewBox="0 0 520 145" preserveAspectRatio="none">
            <path className="recording-road" d="M-20 108C68 120 91 28 171 58s85 90 155 34c51-40 85-76 214-37" />
            <path className="recording-track" d="M-20 108C68 120 91 28 171 58s85 90 155 34c51-40 85-76 214-37" />
          </svg>
          <span className="recording-position"><Navigation size={15} /></span>
        </div>
        <div className="recording-stats">
          <div><span>{t('Скорость', 'Жылдамдық', 'Speed')}</span><strong>24,1 <small>{t('км/ч', 'км/сағ', 'km/h')}</small></strong></div>
          <div><span>{t('Набор', 'Биіктік', 'Elevation')}</span><strong>186 <small>{t('м', 'м', 'm')}</small></strong></div>
          <div><span>{t('Темп', 'Қарқын', 'Pace')}</span><strong>2:29 <small>/{t('км', 'км', 'km')}</small></strong></div>
        </div>
        <button className="recording-finish" type="button" tabIndex={-1}>{t('Завершить', 'Аяқтау', 'Finish')}</button>
      </div>
    );
  }

  if (kind === 'routes') {
    return (
      <div className="landing-visual visual-route-planner" aria-label={t('Карта для составления маршрута', 'Бағыт құру картасы', 'Route planning map')}>
        <div className="route-planner-map" aria-hidden="true">
          <span className="map-road road-one" /><span className="map-road road-two" /><span className="map-road road-three" /><span className="map-road road-four" />
          <svg viewBox="0 0 620 390" preserveAspectRatio="none">
            <path className="planner-route-shadow" d="M82 314C132 248 175 275 220 209s83-123 146-91 64 122 167 67" />
            <path className="planner-route-line" d="M82 314C132 248 175 275 220 209s83-123 146-91 64 122 167 67" />
          </svg>
          <span className="planner-pin planner-start"><MapPin size={18} /></span>
          <span className="planner-pin planner-finish"><Navigation size={17} /></span>
        </div>
        <div className="planner-search"><MapPin size={16} /><span>{t('Парк Первого Президента', 'Тұңғыш Президент саябағы', 'First President Park')}</span></div>
        <section className="planner-summary">
          <div><span>{t('Маршрут', 'Бағыт', 'Route')}</span><strong>{t('Через набережную', 'Жағалау арқылы', 'Via the riverfront')}</strong></div>
          <dl><div><dt>{t('Дистанция', 'Қашықтық', 'Distance')}</dt><dd>21,6 км</dd></div><div><dt>{t('В пути', 'Жолда', 'Duration')}</dt><dd>1 ч 08 мин</dd></div></dl>
        </section>
      </div>
    );
  }

  if (kind === 'analysis') {
    return (
      <div className="landing-visual visual-analysis-card" aria-label={t('Пример ИИ-анализа заезда', 'Сапарды AI талдау үлгісі', 'Example AI ride analysis')}>
        <header>
          <span><BrainCircuit size={20} /></span>
          <div><small>SLIPSTREAM AI</small><strong>{t('Разбор заезда', 'Сапар талдауы', 'Ride review')}</strong></div>
          <b><Sparkles size={15} /> {t('Готово', 'Дайын', 'Ready')}</b>
        </header>
        <section className="analysis-lead">
          <span>{t('Умеренная нагрузка', 'Орташа жүктеме', 'Moderate effort')}</span>
          <h3>{t('Хорошая работа на выносливость', 'Төзімділікке жақсы жұмыс', 'Strong endurance work')}</h3>
          <p>{t('Темп был ровным даже на второй половине маршрута', 'Бағыттың екінші жартысында да қарқын тұрақты болды', 'Your pace stayed steady through the second half of the route')}</p>
        </section>
        <div className="analysis-metrics">
          <article><span>{t('Нагрузка', 'Жүктеме', 'Load')}</span><strong>68</strong><i><b style={{ width: '68%' }} /></i></article>
          <article><span>{t('Стабильность', 'Тұрақтылық', 'Consistency')}</span><strong>86%</strong><i><b style={{ width: '86%' }} /></i></article>
          <article><span>{t('Восстановление', 'Қалпына келу', 'Recovery')}</span><strong>18 ч</strong><i><b style={{ width: '54%' }} /></i></article>
        </div>
        <div className="analysis-tip"><Sparkles size={17} /><p><strong>{t('Совет на завтра', 'Ертеңге кеңес', 'Tomorrow’s tip')}</strong><span>{t('Лёгкая поездка до 40 минут или отдых', '40 минутқа дейін жеңіл сапар немесе демалыс', 'Easy ride up to 40 minutes or rest')}</span></p></div>
      </div>
    );
  }

  if (kind === 'community') {
    return (
      <div className="landing-visual landing-photo-visual visual-community-photo">
        <img src={communityRidePhoto} alt={t('Группа велосипедистов на городской улице', 'Қала көшесіндегі велосипедшілер тобы', 'A group of cyclists on a city street')} />
        <div className="community-post-card">
          <header><span>А</span><div><strong>{t('Алия Нурова', 'Әлия Нұрова', 'Aliya Nurova')}</strong><small>@aliya · {t('12 мин', '12 мин', '12 min')}</small></div></header>
          <p>{t('Субботний круг с ребятами 🚲', 'Балалармен сенбілік сапар 🚲', 'Saturday ride with the crew 🚲')}</p>
          <footer><span><Heart size={16} fill="currentColor" /> 38</span><span><MessageCircle size={16} /> 7</span><span><Send size={16} /></span></footer>
        </div>
        <div className="community-chat-chip"><MessageCircle size={16} /><span><b>{t('Данияр', 'Данияр', 'Daniyar')}</b>{t('Повторим на следующей неделе?', 'Келесі аптада қайталаймыз ба?', 'Same ride next week?')}</span></div>
        <PhotoCredit href="https://unsplash.com/photos/a-group-of-people-riding-bikes-down-a-street-ptlpYcu6ADA">Cecep Rahmat · Unsplash</PhotoCredit>
      </div>
    );
  }

  return (
    <div className="landing-visual landing-photo-visual visual-marketplace-photo">
      <img src={bikeWorkshopPhoto} alt={t('Механик обслуживает велосипед', 'Механик велосипедті жөндеп жатыр', 'Mechanic servicing a bicycle')} />
      <div className="marketplace-listing-preview">
        <span>{t('Отличное состояние', 'Өте жақсы күйде', 'Excellent condition')}</span>
        <h3>Specialized Allez Sport</h3>
        <p>{t('Алматы · Шоссейный', 'Алматы · Шоссе', 'Almaty · Road bike')}</p>
        <strong>420 000 ₸</strong>
      </div>
      <div className="marketplace-count">12 {t('фото', 'фото', 'photos')}</div>
      <PhotoCredit href="https://unsplash.com/photos/a-close-up-of-a-person-working-on-a-bike-6rctMmhTK9o">Bohdan Kadun · Unsplash</PhotoCredit>
    </div>
  );
}
