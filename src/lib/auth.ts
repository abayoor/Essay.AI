import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { isSupabaseConfigured, supabase } from './supabase';

type SessionState = {
  session: Session | null;
  loading: boolean;
};

export function useSession(): SessionState {
  const [state, setState] = useState<SessionState>({
    session: null,
    loading: isSupabaseConfigured,
  });

  useEffect(() => {
    if (!isSupabaseConfigured) return;

    void supabase.auth.getSession().then(({ data }) => {
      setState({ session: data.session, loading: false });
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setState({ session, loading: false });
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  return state;
}

function callbackUrl(): string {
  return `${window.location.origin}/auth/callback`;
}

export function signUpWithEmail(email: string, password: string) {
  return supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: callbackUrl() },
  });
}

export function startGoogleSignIn() {
  return supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: callbackUrl(),
      skipBrowserRedirect: true,
      queryParams: { prompt: 'select_account' },
    },
  });
}

export function verifySignupCode(email: string, token: string) {
  return supabase.auth.verifyOtp({ email, token, type: 'email' });
}

export function resendSignupCode(email: string) {
  return supabase.auth.resend({
    type: 'signup',
    email,
    options: { emailRedirectTo: callbackUrl() },
  });
}

export function exchangeAuthCode(code: string) {
  return supabase.auth.exchangeCodeForSession(code);
}
