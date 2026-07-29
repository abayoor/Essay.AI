import { useCallback, useEffect } from 'react';
import { useLocation } from 'wouter';
import { PageShell } from '../components/PageShell';
import { PostComposer } from '../components/PostComposer';
import { useSession } from '../lib/auth';

export function NewPostPage() {
  const { session, loading } = useSession();
  const [, navigate] = useLocation();
  useEffect(() => { if (!loading && !session) navigate('/auth/sign-in'); }, [loading, navigate, session]);
  const afterPublish = useCallback(async () => { navigate('/feed'); }, [navigate]);
  return <PageShell><main className="cycle-page narrow-page"><header className="page-heading"><div><p className="kicker">Публикация</p><h1>Новый пост</h1><p>Добавь медиа или преврати тренировку из Strava в историю маршрута.</p></div></header><PostComposer onPublished={afterPublish} /></main></PageShell>;
}
