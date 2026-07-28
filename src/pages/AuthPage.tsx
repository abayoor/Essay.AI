import { AuthForm } from '../components/AuthForm';
import { PageShell } from '../components/PageShell';

export function AuthPage({ mode }: { mode: 'sign-in' | 'sign-up' }) {
  return <PageShell><main className="auth-page"><AuthForm mode={mode} /></main></PageShell>;
}
