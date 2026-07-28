import { Link, useLocation } from 'wouter';
import { useSession } from '../lib/auth';
import { supabase } from '../lib/supabase';

type PageShellProps = {
  children: React.ReactNode;
};

export function PageShell({ children }: PageShellProps) {
  const { session } = useSession();
  const [, navigate] = useLocation();

  async function signOut() {
    await supabase.auth.signOut();
    navigate('/');
  }

  return (
    <div className="app-shell">
      <header className="site-header">
        <Link href="/" className="brand">EssayCoach</Link>
        <nav aria-label="Основная навигация">
          {session ? (
            <>
              <Link href="/dashboard">Мои эссе</Link>
              <button className="text-button" onClick={() => void signOut()}>Выйти</button>
            </>
          ) : (
            <Link href="/auth/sign-in">Войти</Link>
          )}
        </nav>
      </header>
      {children}
    </div>
  );
}
