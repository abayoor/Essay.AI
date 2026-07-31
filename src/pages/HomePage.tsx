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
            <p className="kicker">{t('Велосипедная жизнь города', 'Қаланың велоөмірі', 'The city on two wheels')}</p>
            <h1>{t('Все твои дороги.', 'Барлық жолың.', 'Every road you ride.')}<br /><em>{t('Один поток.', 'Бір ағында.', 'One flow.')}</em></h1>
            <p>{t('Slipstream — место для поездок, людей и всего, что происходит вокруг велосипеда. Записывай маршрут, находи компанию и не теряй свой ритм.', 'Slipstream — сапарлар, адамдар және велосипедке қатысты барлық нәрсе тоғысатын орын. Бағытыңды жаз, серік тап және ырғағыңды жоғалтпа.', 'Slipstream brings rides, people and everything around cycling together. Record your route, find company and keep your rhythm.')}</p>
            <Link className="signal-button landing-main-cta" href="/auth/sign-up">{t('Начать бесплатно', 'Тегін бастау', 'Start free')}</Link>
          </div>
          <LandingVisual kind="hero" />
        </section>

        <section className="landing-feature">
          <div className="landing-copy"><p className="kicker">01 · GPS</p><h2>{t('Едь — маршрут появится сам.', 'Жүре бер — бағыт өзі жазылады.', 'Ride — your route draws itself.')}</h2><p>{t('Slipstream записывает реальную дорогу, скорость, дистанцию и набор высоты. Не нужно рисовать линию на карте после каждой тренировки.', 'Slipstream нақты жолды, жылдамдықты, қашықтықты және биіктік жинауды жазады. Жаттығудан кейін картада сызық сызудың қажеті жоқ.', 'Slipstream records the real road, speed, distance and elevation. No need to redraw your ride after every workout.')}</p><Link className="text-link" href="/record">{t('Открыть запись →', 'Жазуды ашу →', 'Open recorder →')}</Link></div>
          <LandingVisual kind="recording" />
        </section>

        <section className="landing-feature landing-feature-reverse">
          <div className="landing-copy"><p className="kicker">{t('02 · Сообщество', '02 · Қауымдастық', '02 · Community')}</p><h2>{t('Поездки не заканчиваются на финише.', 'Сапар мәре сызығында аяқталмайды.', 'Rides do not end at the finish.')}</h2><p>{t('Делись заездами в ленте, ставь лайки, обсуждай маршруты и пиши райдерам напрямую. Здесь видно, кто крутит педали рядом с тобой.', 'Сапарларыңды бөліс, бағыттарды талқыла және райдерлерге тікелей жаз. Жаныңда кім жүргенін көр.', 'Share rides, discuss routes and message riders directly. See who is riding nearby.')}</p><Link className="text-link" href="/feed">{t('Смотреть ленту →', 'Лентаны көру →', 'View feed →')}</Link></div>
          <LandingVisual kind="community" />
        </section>

        <section className="landing-feature">
          <div className="landing-copy"><p className="kicker">{t('03 · Групповые заезды', '03 · Топтық сапарлар', '03 · Group rides')}</p><h2>{t('Не потеряй своих на маршруте.', 'Бағытта достарыңнан көз жазба.', 'Keep your group together.')}</h2><p>{t('Во время совместной поездки видно живую позицию участников. Собирайтесь у старта, держите темп и не гадайте, кто отстал на следующем повороте.', 'Бірлескен сапарда қатысушылардың орны көрінеді. Бастау нүктесінде жиналып, қарқынды бірге ұстаңдар.', 'See every participant live during a group ride. Meet at the start, hold the pace and know who needs support.')}</p></div>
          <LandingVisual kind="group" />
        </section>

        <section className="landing-feature landing-feature-reverse">
          <div className="landing-copy"><p className="kicker">{t('04 · Челлендж недели', '04 · Апталық челлендж', '04 · Weekly challenge')}</p><h2>{t('Километры превращаются в гонку.', 'Километрлер жарысқа айналады.', 'Turn kilometres into a race.')}</h2><p>{t('Сравнивай свой прогресс с друзьями или всем городом. Шкала показывает реальную дистанцию, которую вы проехали за неделю.', 'Ілгерілеуіңді достарыңмен немесе бүкіл қаламен салыстыр. Шкала апта бойы жүрілген нақты қашықтықты көрсетеді.', 'Compare progress with friends or the whole city. The board shows real distance ridden during the week.')}</p></div>
          <LandingVisual kind="challenge" />
        </section>

        <section className="landing-feature">
          <div className="landing-copy"><p className="kicker">{t('05 · Карта и сегменты', '05 · Карта және сегменттер', '05 · Map and segments')}</p><h2>{t('Знай дорогу до того, как в неё въедешь.', 'Жолға шықпай тұрып оны танып ал.', 'Know the road before you ride it.')}</h2><p>{t('Отмечай опасные участки и проверяй время на знакомых сегментах. Лидерборды помогают увидеть свой прогресс.', 'Қауіпті учаскелерді белгіле және таныс сегменттердегі уақытыңды тексер. Көшбасшылар кестесі ілгерілеуіңді көрсетеді.', 'Mark hazards and check your time on familiar segments. Leaderboards make progress easy to see.')}</p><Link className="text-link" href="/routes">{t('Открыть маршруты →', 'Бағыттарды ашу →', 'Open routes →')}</Link></div>
          <LandingVisual kind="safety" />
        </section>

        <section className="landing-feature landing-feature-reverse">
          <div className="landing-copy"><p className="kicker">{t('06 · Маркетплейс', '06 · Маркетплейс', '06 · Marketplace')}</p><h2>{t('Велосипеды и детали находят второй круг.', 'Велосипед пен бөлшектерге екінші өмір.', 'Give bikes and parts another lap.')}</h2><p>{t('Ищи велосипед, колёса или запчасти у людей из своего сообщества — только то, что имеет смысл для райдеров.', 'Қауымдастықтағы адамдардан велосипед, дөңгелек немесе бөлшек тап — райдерлерге керектінің бәрі осында.', 'Find bikes, wheels and parts from your community — focused on what riders actually need.')}</p></div>
          <LandingVisual kind="marketplace" />
        </section>

        <section className="landing-feature">
          <div className="landing-copy"><p className="kicker">07 · Strava</p><h2>{t('Не нужно начинать с нуля.', 'Бәрін жаңадан бастаудың қажеті жоқ.', 'No need to start from zero.')}</h2><p>{t('Подключи Strava и перенеси историю поездок в профиль. Старые километры останутся с тобой, а новые станут частью сообщества.', 'Strava-ны қосып, сапарлар тарихын профиліңе көшір. Бұрынғы километрлер сақталады, жаңалары қауымдастыққа қосылады.', 'Connect Strava and bring your ride history into your profile. Keep old kilometres and share the new ones with the community.')}</p><Link className="text-link" href="/settings">{t('Подключить Strava →', 'Strava-ны қосу →', 'Connect Strava →')}</Link></div>
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
