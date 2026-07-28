import { Link } from 'wouter';
import { ElevationLine } from '../components/ElevationLine';
import { PageShell } from '../components/PageShell';

export function HomePage() {
  return (
    <PageShell>
      <main className="landing-page">
        <section className="cycle-hero"><p className="kicker">Локальное велосообщество</p><h1>Ближе к дороге.<br /><em>Ближе</em> к своим.</h1><p>Маршруты, гараж, журнал заездов и люди, с которыми хочется крутить дальше.</p><div><Link className="signal-button" href="/auth/sign-up">Присоединиться</Link><Link className="text-link" href="/routes">Смотреть маршруты →</Link></div></section>
        <ElevationLine />
        <section className="landing-grid"><article><span>01</span><h2>Собирай километры</h2><p>Логируй заезды и смотри честную статистику — без шума.</p></article><article><span>02</span><h2>Знай свою технику</h2><p>Гараж напоминает о цепи, покрышках и тормозах до того, как станет поздно.</p></article><article><span>03</span><h2>Находи дорогу</h2><p>Делись маршрутами из своего региона и забирай с собой проверенные треки.</p></article></section>
      </main>
    </PageShell>
  );
}
