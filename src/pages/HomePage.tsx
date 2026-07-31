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
          <div>
            <p className="kicker">{t('Безопасная велосистема города', 'Қаланың қауіпсіз веложүйесі', 'A safer cycling city')}</p>
            <h1>{t('Каждая поездка.', 'Әр сапар.', 'Every ride.')}<br /><em>{t('Больше уверенности.', 'Көбірек сенім.', 'More confidence.')}</em></h1>
            <p>{t('Slipstream строит маршруты по реальным улицам, показывает предупреждения сообщества и помогает планировать нагрузку по истории тренировок.', 'Slipstream нақты көшелермен бағыт құрады, қауымдастық ескертулерін көрсетеді және жаттығу тарихы бойынша жүктемені жоспарлауға көмектеседі.', 'Slipstream routes on real streets, shows community hazard alerts and helps you plan training load from your ride history.')}</p>
            <Link className="signal-button landing-main-cta" href="/auth/sign-up">{t('Начать бесплатно', 'Тегін бастау', 'Start free')}</Link>
          </div>
          <LandingVisual kind="hero" />
        </section>

        <section className="landing-feature">
          <div className="landing-copy"><p className="kicker">01 · GPS</p><h2>{t('Едь — маршрут появится сам.', 'Жүре бер — бағыт өзі жазылады.', 'Ride — your route draws itself.')}</h2><p>{t('Slipstream записывает реальную дорогу, скорость, дистанцию и набор высоты. Не нужно рисовать линию на карте после каждой тренировки.', 'Slipstream нақты жолды, жылдамдықты, қашықтықты және биіктік жинауды жазады. Жаттығудан кейін картада сызық сызудың қажеті жоқ.', 'Slipstream records the real road, speed, distance and elevation. No need to redraw your ride after every workout.')}</p><Link className="text-link" href="/record">{t('Открыть запись →', 'Жазуды ашу →', 'Open recorder →')}</Link></div>
          <LandingVisual kind="recording" />
        </section>

        <section className="landing-feature landing-feature-reverse">
          <div className="landing-copy"><p className="kicker">{t('02 · Сообщество', '02 · Қауымдастық', '02 · Community')}</p><h2>{t('Поездки не заканчиваются на финише.', 'Сапар мәре сызығында аяқталмайды.', 'Rides do not end at the finish.')}</h2><p>{t('Делись заездами и маршрутами, поддерживай райдеров лайками и комментариями и общайся с ними в личных сообщениях.', 'Сапарлар мен бағыттарды бөліс, райдерлерді лайк пен пікір арқылы қолда және олармен жеке хабарламаларда сөйлес.', 'Share rides and routes, support riders with likes and comments, and talk to them in direct messages.')}</p><Link className="text-link" href="/feed">{t('Смотреть ленту →', 'Лентаны көру →', 'View feed →')}</Link></div>
          <LandingVisual kind="community" />
        </section>

        <section className="landing-feature">
          <div className="landing-copy"><p className="kicker">03 · Safety Radar</p><h2>{t('Узнай об опасности заранее.', 'Қауіп туралы алдын ала біл.', 'Know about hazards before you reach them.')}</h2><p>{t('Райдеры отмечают ямы, стекло, тёмные участки и перекрытия прямо на карте. Подтверждения сообщества помогают сохранять предупреждения актуальными.', 'Райдерлер шұңқыр, шыны, жарықсыз учаске мен жабық жолды картада белгілейді. Қауымдастық растауы ескертулерді өзекті сақтауға көмектеседі.', 'Riders mark potholes, glass, dark stretches and road closures on the map. Community confirmations help keep warnings current.')}</p><Link className="text-link" href="/map">{t('Открыть радар →', 'Радарды ашу →', 'Open Safety Radar →')}</Link></div>
          <LandingVisual kind="safety" />
        </section>

        <section className="landing-feature landing-feature-reverse">
          <div className="landing-copy"><p className="kicker">{t('04 · Челлендж недели', '04 · Апталық челлендж', '04 · Weekly challenge')}</p><h2>{t('Пятьдесят километров. Понятная цель.', 'Елу километр. Түсінікті мақсат.', 'Fifty kilometres. One clear goal.')}</h2><p>{t('Каждый сохранённый заезд двигает недельную шкалу. Вступай в открытые группы и поддерживай регулярность вместе с сообществом.', 'Әр сақталған сапар апталық шкаланы жылжытады. Ашық топтарға қосылып, қауымдастықпен бірге тұрақтылықты сақта.', 'Every saved ride advances your weekly progress. Join open groups and build consistency with the community.')}</p><Link className="text-link" href="/competitions">{t('Проверить прогресс →', 'Прогресті тексеру →', 'Check progress →')}</Link></div>
          <LandingVisual kind="challenge" />
        </section>

        <section className="landing-feature">
          <div className="landing-copy"><p className="kicker">{t('05 · Умная навигация', '05 · Ақылды навигация', '05 · Smart navigation')}</p><h2>{t('Не просто короче. С учётом опасностей.', 'Тек қысқа емес. Қауіптерді ескереді.', 'Not just shorter. Hazards included.')}</h2><p>{t('Сравни два маршрута по дистанции, подъёму, времени и опасностям на пути. Во время поездки Slipstream предупредит о свежей проблеме впереди.', 'Екі бағытты қашықтық, биіктік, уақыт және жолдағы қауіп бойынша салыстыр. Сапар кезінде Slipstream алдағы жаңа қауіп туралы ескертеді.', 'Compare two routes by distance, climbing, time and hazards ahead. While you ride, Slipstream warns you about fresh problems on your path.')}</p><Link className="text-link" href="/map">{t('Построить маршрут →', 'Бағыт құру →', 'Plan a route →')}</Link></div>
          <LandingVisual kind="hero" />
        </section>

        <section className="landing-feature landing-feature-reverse">
          <div className="landing-copy"><p className="kicker">{t('06 · Маркетплейс', '06 · Маркетплейс', '06 · Marketplace')}</p><h2>{t('Велосипеды и детали находят второй круг.', 'Велосипед пен бөлшектерге екінші өмір.', 'Give bikes and parts another lap.')}</h2><p>{t('Ищи велосипед, колёса или запчасти у людей из своего сообщества — только то, что имеет смысл для райдеров.', 'Қауымдастықтағы адамдардан велосипед, дөңгелек немесе бөлшек тап — райдерлерге керектінің бәрі осында.', 'Find bikes, wheels and parts from your community — focused on what riders actually need.')}</p></div>
          <LandingVisual kind="marketplace" />
        </section>

        <section className="landing-feature">
          <div className="landing-copy"><p className="kicker">07 · Strava</p><h2>{t('Не нужно начинать с нуля.', 'Бәрін жаңадан бастаудың қажеті жоқ.', 'No need to start from zero.')}</h2><p>{t('Подключи Strava, выбери недавнюю тренировку и преврати её в историю для сообщества со статистикой и, если она доступна, линией маршрута.', 'Strava-ны қосып, соңғы жаттығуды таңда да, статистикасы және қолжетімді болса, бағыт сызығы бар қауымдастық оқиғасына айналдыр.', 'Connect Strava, choose a recent activity and turn it into a community story with stats and a route line when one is available.')}</p><Link className="text-link" href="/settings">{t('Подключить Strava →', 'Strava-ны қосу →', 'Connect Strava →')}</Link></div>
          <LandingVisual kind="strava" />
        </section>

        <section className="landing-final-cta">
          <p className="kicker">{t('Твоя следующая поездка', 'Келесі сапарың', 'Your next ride')}</p>
          <h2>{t('Начни с одного круга по городу.', 'Қаладағы бір айналымнан баста.', 'Start with one lap around the city.')}</h2>
          <p>{t('Аккаунт бесплатный. Велосипед и дорога уже у тебя есть.', 'Аккаунт тегін. Велосипед пен жол сенде бар.', 'Your account is free. You already have the bike and the road.')}</p>
          <Link className="signal-button landing-main-cta" href="/auth/sign-up">{t('Начать бесплатно', 'Тегін бастау', 'Start free')}</Link>
        </section>
      </main>
    </PageShell>
  );
}
