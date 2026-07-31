import { useCallback, useEffect } from 'react';
import { useLocation } from 'wouter';
import { PageShell } from '../components/PageShell';
import { PostComposer } from '../components/PostComposer';
import { useSession } from '../lib/auth';
import { useLocaleText } from '../lib/localized';

export function NewPostPage() {
  const { session, loading } = useSession();
  const text = useLocaleText();
  const [, navigate] = useLocation();
  useEffect(() => { if (!loading && !session) navigate('/auth/sign-in'); }, [loading, navigate, session]);
  const afterPublish = useCallback(async () => { navigate('/feed'); }, [navigate]);
  return <PageShell><main className="cycle-page narrow-page"><header className="page-heading"><div><p className="kicker">{text('Публикация', 'Жарияланым', 'Publishing')}</p><h1>{text('Новый пост', 'Жаңа жазба', 'New post')}</h1><p>{text('Добавь медиа или преврати тренировку из Strava в историю маршрута.', 'Медиа қос немесе Strava жаттығуын бағыт тарихына айналдыр.', 'Add media or turn a Strava workout into a route story.')}</p></div></header><PostComposer onPublished={afterPublish} /></main></PageShell>;
}
