import { Link } from 'wouter';
import { PageShell } from '../components/PageShell';

export function HomePage() {
  return (
    <PageShell>
      <main className="landing">
        <section className="hero">
          <p className="eyebrow">Для абитуриентов из Центральной Азии</p>
          <h1>Твоя история.<br /><em>Твой</em> голос.</h1>
          <p className="hero-copy">EssayCoach помогает собрать мысли, увидеть сильные детали и отточить эссе — без шаблонных текстов, написанных вместо тебя.</p>
          <div className="hero-actions">
            <Link href="/auth/sign-up" className="primary-link">Начать бесплатно</Link>
            <Link href="/hook-check" className="secondary-button hero-hook-link">Проверить хук</Link>
            <a href="#approach" className="quiet-link">Как это работает</a>
          </div>
        </section>
        <section id="approach" className="approach-grid">
          <article><span>01</span><h2>Пишешь сам</h2><p>Черновик остаётся твоим. Никаких «идеальных» эссе от нейросети.</p></article>
          <article><span>02</span><h2>Получаешь вопросы</h2><p>Коуч подсвечивает детали, структуру и места, которые стоит раскрыть глубже.</p></article>
          <article><span>03</span><h2>Становишься увереннее</h2><p>Сохраняй версии и возвращайся к тексту со свежим взглядом.</p></article>
        </section>
      </main>
    </PageShell>
  );
}
