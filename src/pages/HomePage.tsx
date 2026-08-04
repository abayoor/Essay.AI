import { ArrowRight, Check, MessageCircleMore, Route, Sparkles, Store, TimerReset } from 'lucide-react';
import { Link } from 'wouter';
import { LandingVisual } from '../components/LandingVisual';
import { PageShell } from '../components/PageShell';
import { useLocaleText } from '../lib/localized';

export function HomePage() {
  const t = useLocaleText();

  return (
    <PageShell>
      <main className="landing-page landing-full">
        <section className="landing-hero">
          <div className="landing-hero-copy">
            <p className="kicker">{t('Велосообщество в одном приложении', 'Велоқоғамдастық бір қолданбада', 'Your cycling community in one app')}</p>
            <h1>{t('Всё для следующего заезда', 'Келесі сапарға керектің бәрі', 'Everything for your next ride')}</h1>
            <p>{t(
              'Записывай тренировки, строй маршруты на открытой карте, разбирай заезды с ИИ и оставайся на связи с райдерами своего города',
              'Жаттығуларды жаз, ашық картада бағыт құр, сапарларды AI көмегімен талда және қалаңдағы райдерлермен байланыста бол',
              'Record workouts, plan routes on an open map, review rides with AI and stay connected with riders in your city',
            )}</p>
            <div className="landing-hero-actions">
              <Link className="signal-button landing-main-cta" href="/auth/sign-up">
                {t('Начать бесплатно', 'Тегін бастау', 'Start free')}
                <ArrowRight size={18} />
              </Link>
              <Link className="landing-secondary-cta" href="/auth/sign-in">
                {t('У меня уже есть аккаунт', 'Менде аккаунт бар', 'I already have an account')}
              </Link>
            </div>
            <ul className="landing-quick-list" aria-label={t('Главные возможности', 'Негізгі мүмкіндіктер', 'Key features')}>
              <li><Check size={15} />{t('GPS-запись', 'GPS жазба', 'GPS recording')}</li>
              <li><Check size={15} />{t('Открытая карта', 'Ашық карта', 'Open map')}</li>
              <li><Check size={15} />{t('ИИ-разбор', 'AI талдау', 'AI review')}</li>
            </ul>
          </div>
          <LandingVisual kind="hero" />
        </section>

        <section className="landing-proof-strip" aria-label={t('Что уже есть в Slipstream', 'Slipstream ішінде не бар', 'What is already in Slipstream')}>
          <span><TimerReset size={18} />{t('Тренировки', 'Жаттығулар', 'Workouts')}</span>
          <span><Route size={18} />{t('Маршруты', 'Бағыттар', 'Routes')}</span>
          <span><Sparkles size={18} />{t('ИИ-анализ', 'AI талдау', 'AI analysis')}</span>
          <span><MessageCircleMore size={18} />{t('Чаты', 'Чаттар', 'Chats')}</span>
          <span><Store size={18} />{t('Маркетплейс', 'Маркетплейс', 'Marketplace')}</span>
        </section>

        <section className="landing-feature">
          <div className="landing-copy">
            <p className="kicker">{t('01 · Запись тренировок', '01 · Жаттығуды жазу', '01 · Workout recording')}</p>
            <h2>{t('Просто нажми старт и поезжай', 'Стартты бас та, жолға шық', 'Tap start and ride')}</h2>
            <p>{t(
              'Slipstream запишет трек, время, дистанцию, среднюю скорость и набор высоты. После финиша заезд сразу сохранится в твоём журнале',
              'Slipstream тректі, уақытты, қашықтықты, орташа жылдамдықты және биіктік жинауды жазады. Мәреден кейін сапар журналыңа бірден сақталады',
              'Slipstream records your track, time, distance, average speed and elevation. Your ride is saved to your journal as soon as you finish',
            )}</p>
            <Link className="text-link" href="/auth/sign-up">{t('Записать первый заезд', 'Алғашқы сапарды жазу', 'Record your first ride')} <ArrowRight size={16} /></Link>
          </div>
          <LandingVisual kind="recording" />
        </section>

        <section className="landing-feature landing-feature-reverse">
          <div className="landing-copy">
            <p className="kicker">{t('02 · Открытая карта', '02 · Ашық карта', '02 · Open map')}</p>
            <h2>{t('Собери маршрут под свою поездку', 'Сапарыңа сай бағыт құр', 'Build a route for your ride')}</h2>
            <p>{t(
              'Выбери старт и финиш, сравни варианты по расстоянию и времени и сохрани подходящий маршрут. На карте также видны места и предупреждения сообщества',
              'Бастау мен мәрені таңда, бағыттарды қашықтық пен уақыт бойынша салыстыр және қолайлысын сақта. Картада қауымдастық орындары мен ескертулері де көрінеді',
              'Choose a start and finish, compare options by distance and time, then save the route that works. Community places and alerts are visible on the map too',
            )}</p>
            <Link className="text-link" href="/auth/sign-up">{t('Построить маршрут', 'Бағыт құру', 'Plan a route')} <ArrowRight size={16} /></Link>
          </div>
          <LandingVisual kind="routes" />
        </section>

        <section className="landing-feature">
          <div className="landing-copy">
            <p className="kicker">{t('03 · ИИ-анализ заезда', '03 · Сапарды AI талдау', '03 · AI ride analysis')}</p>
            <h2>{t('Пойми тренировку без таблиц', 'Жаттығуды кестесіз түсін', 'Understand your workout without spreadsheets')}</h2>
            <p>{t(
              'ИИ смотрит на темп, дистанцию, набор высоты и твою историю, а затем объясняет нагрузку простыми словами и подсказывает, как восстановиться',
              'AI қарқынға, қашықтыққа, биіктікке және тарихыңа қарап, жүктемені қарапайым тілмен түсіндіреді және қалпына келу жолын ұсынады',
              'AI reviews pace, distance, elevation and your history, then explains the effort in plain language and suggests how to recover',
            )}</p>
            <Link className="text-link" href="/auth/sign-up">{t('Получить разбор', 'Талдауды алу', 'Get a ride review')} <ArrowRight size={16} /></Link>
          </div>
          <LandingVisual kind="analysis" />
        </section>

        <section className="landing-feature landing-feature-reverse">
          <div className="landing-copy">
            <p className="kicker">{t('04 · Сообщество и чаты', '04 · Қауымдастық пен чаттар', '04 · Community and chats')}</p>
            <h2>{t('Кататься интереснее вместе', 'Бірге жүру қызығырақ', 'Riding is better together')}</h2>
            <p>{t(
              'Публикуй заезды и фотографии, обсуждай маршруты в комментариях, находи райдеров рядом и продолжай разговор в личном чате',
              'Сапарлар мен фотоларды жарияла, бағыттарды пікірлерде талқыла, жақын райдерлерді тап және жеке чатта сөйлес',
              'Share rides and photos, discuss routes in comments, find nearby riders and keep the conversation going in direct messages',
            )}</p>
            <Link className="text-link" href="/auth/sign-up">{t('Войти в сообщество', 'Қауымдастыққа қосылу', 'Join the community')} <ArrowRight size={16} /></Link>
          </div>
          <LandingVisual kind="community" />
        </section>

        <section className="landing-feature">
          <div className="landing-copy">
            <p className="kicker">{t('05 · Маркетплейс', '05 · Маркетплейс', '05 · Marketplace')}</p>
            <h2>{t('Велосипеды и детали находят вторую жизнь', 'Велосипедтер мен бөлшектер екінші өмір табады', 'Bikes and parts find a second life')}</h2>
            <p>{t(
              'Размещай велосипеды, экипировку и запчасти с фотографиями, ценой и состоянием или находи нужное у райдеров из своего города',
              'Велосипедтерді, жабдықтарды және бөлшектерді фото, баға және күйімен жарияла немесе қалаңдағы райдерлерден керегіңді тап',
              'List bikes, gear and parts with photos, price and condition, or find what you need from riders in your city',
            )}</p>
            <Link className="text-link" href="/auth/sign-up">{t('Открыть маркетплейс', 'Маркетплейсті ашу', 'Open marketplace')} <ArrowRight size={16} /></Link>
          </div>
          <LandingVisual kind="marketplace" />
        </section>

        <section className="landing-final-cta">
          <p className="kicker">{t('Твой следующий заезд', 'Келесі сапарың', 'Your next ride')}</p>
          <h2>{t('Начни с одной поездки', 'Бір сапардан баста', 'Start with one ride')}</h2>
          <p>{t(
            'Создай бесплатный аккаунт и собери всю велосипедную жизнь в одном месте',
            'Тегін аккаунт ашып, велосипед өміріңді бір жерге жина',
            'Create a free account and keep your whole cycling life in one place',
          )}</p>
          <Link className="signal-button landing-main-cta" href="/auth/sign-up">
            {t('Создать аккаунт', 'Аккаунт ашу', 'Create account')}
            <ArrowRight size={18} />
          </Link>
        </section>
      </main>
    </PageShell>
  );
}
