import { Link } from 'wouter';
import { LandingVisual } from '../components/LandingVisual';
import { PageShell } from '../components/PageShell';

export function HomePage() {
  return (
    <PageShell>
      <main className="landing-page landing-full">
        <section className="landing-hero">
          <div>
            <p className="kicker">Велосипедная жизнь города</p>
            <h1>Все твои дороги.<br /><em>Один поток.</em></h1>
            <p>Slipstream — место для поездок, людей и всего, что происходит вокруг велосипеда. Записывай маршрут, находи компанию и не теряй свой ритм.</p>
            <Link className="signal-button landing-main-cta" href="/auth/sign-up">Начать бесплатно</Link>
          </div>
          <LandingVisual kind="hero" />
        </section>

        <section className="landing-feature">
          <div className="landing-copy"><p className="kicker">01 · GPS-запись</p><h2>Едь — маршрут появится сам.</h2><p>Slipstream записывает реальную дорогу, скорость, дистанцию и набор высоты. Не нужно рисовать линию на карте после каждой тренировки.</p><Link className="text-link" href="/record">Открыть запись →</Link></div>
          <LandingVisual kind="recording" />
        </section>

        <section className="landing-feature landing-feature-reverse">
          <div className="landing-copy"><p className="kicker">02 · Сообщество</p><h2>Поездки не заканчиваются на финише.</h2><p>Делись заездами в ленте, ставь лайки, обсуждай маршруты и пиши райдерам напрямую. Здесь видно, кто крутит педали рядом с тобой.</p><Link className="text-link" href="/feed">Смотреть ленту →</Link></div>
          <LandingVisual kind="community" />
        </section>

        <section className="landing-feature">
          <div className="landing-copy"><p className="kicker">03 · Групповые заезды</p><h2>Не потеряй своих на маршруте.</h2><p>Во время совместной поездки видно живую позицию участников. Собирайтесь у старта, держите темп и не гадайте, кто отстал на следующем повороте.</p></div>
          <LandingVisual kind="group" />
        </section>

        <section className="landing-feature landing-feature-reverse">
          <div className="landing-copy"><p className="kicker">04 · Челлендж недели</p><h2>Километры превращаются в гонку.</h2><p>Сравнивай свой прогресс с друзьями или всем городом. Шкала показывает не абстрактные очки, а реальную дистанцию, которую вы проехали за неделю.</p></div>
          <LandingVisual kind="challenge" />
        </section>

        <section className="landing-feature">
          <div className="landing-copy"><p className="kicker">05 · Карта и сегменты</p><h2>Знай дорогу до того, как в неё въедешь.</h2><p>Отмечай опасные участки для других и проверяй время на знакомых сегментах. Лидерборды помогают увидеть свой прогресс без лишней шумихи.</p><Link className="text-link" href="/routes">Открыть маршруты →</Link></div>
          <LandingVisual kind="safety" />
        </section>

        <section className="landing-feature landing-feature-reverse">
          <div className="landing-copy"><p className="kicker">06 · Маркетплейс</p><h2>Велосипеды и детали находят второй круг.</h2><p>Ищи б/у велосипед, колёса или запчасти у людей из своего сообщества. Без случайных объявлений — только то, что имеет смысл для райдеров.</p></div>
          <LandingVisual kind="marketplace" />
        </section>

        <section className="landing-feature">
          <div className="landing-copy"><p className="kicker">07 · Strava</p><h2>Не нужно начинать с нуля.</h2><p>Подключи Strava и перенеси историю поездок в свой профиль. Старые километры останутся с тобой, а новые сразу будут частью сообщества.</p><Link className="text-link" href="/settings">Подключить Strava →</Link></div>
          <LandingVisual kind="strava" />
        </section>

        <section className="landing-final-cta">
          <p className="kicker">Твоя следующая поездка</p>
          <h2>Начни с одного круга по городу.</h2>
          <p>Аккаунт бесплатный. Велосипед и дорога уже у тебя есть.</p>
          <Link className="signal-button landing-main-cta" href="/auth/sign-up">Начать бесплатно</Link>
        </section>
      </main>
    </PageShell>
  );
}
