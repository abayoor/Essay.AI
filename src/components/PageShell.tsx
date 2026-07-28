import type { ReactNode } from 'react';
import { Link, useLocation } from 'wouter';
import { useSession } from '../lib/auth';
import { supabase } from '../lib/supabase';

export function PageShell({ children }: { children: ReactNode }) {
  const { session } = useSession();
  const [, navigate] = useLocation();

  async function signOut() {
    await supabase.auth.signOut();
    navigate('/');
  }

  return (
    <div className="cycle-shell">
      <header className="cycle-header">
        <Link href="/" className="cycle-brand"><span>↗</span> VeloKZ</Link>
        <nav aria-label="Основная навигация">
          {session ? <>
            <Link href="/dashboard">Сводка</Link><Link href="/routes">Маршруты</Link><Link href="/bikes">Гараж</Link><Link href="/profile">Профиль</Link>
            <button className="quiet-button" onClick={() => void signOut()}>Выйти</button>
          </> : <Link className="header-cta" href="/auth/sign-in">Войти</Link>}
        </nav>
      </header>
      {children}
    </div>
  );
}
