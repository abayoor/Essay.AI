import { Link } from 'wouter';
import { PageShell } from '../components/PageShell';

export function NotFoundPage() {
  return (
    <PageShell>
      <main className="narrow-page">
        <section className="empty-state">
          <h1>Такой страницы пока нет</h1>
          <p>Возможно, ссылка устарела или в ней есть опечатка.</p>
          <Link href="/" className="primary-link">Вернуться на главную</Link>
        </section>
      </main>
    </PageShell>
  );
}
