import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { CalendarDays, Flag, Trophy } from 'lucide-react';
import { useLocation } from 'wouter';
import { PageShell } from '../components/PageShell';
import { useSession } from '../lib/auth';
import { loadCompetitionOverview, type CompetitionOverview } from '../lib/explore';

type CompetitionTab = 'challenge' | 'events';

export function CompetitionsPage() {
  const { session, loading } = useSession();
  const [, navigate] = useLocation();
  const [tab, setTab] = useState<CompetitionTab>('challenge');
  const [overview, setOverview] = useState<CompetitionOverview>({ challengeGroups: [], events: [] });
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);
  const refresh = useCallback(async () => { try { setError(''); setOverview(await loadCompetitionOverview()); } catch { setError('Не удалось загрузить соревнования.'); } finally { setReady(true); } }, []);
  useEffect(() => { if (!loading && !session) navigate('/auth/sign-in'); if (session) void refresh(); }, [loading, navigate, refresh, session]);
  return <PageShell><main className="cycle-page competitions-page"><header className="page-heading"><div><p className="kicker">Соревнования</p><h1>Езжай вместе с городом</h1><p>Недельный километраж и календарь стартов — без отдельной вкладки для каждой функции.</p></div></header><nav className="section-tabs" aria-label="Разделы соревнований"><button className={tab === 'challenge' ? 'active' : ''} onClick={() => setTab('challenge')}><Trophy size={17} />Недельный челлендж</button><button className={tab === 'events' ? 'active' : ''} onClick={() => setTab('events')}><CalendarDays size={17} />События</button></nav>{error && <div className="inline-error">{error}<button onClick={() => void refresh()}>Повторить</button></div>}{!ready ? <p className="loading-copy">Готовим стартовую линию…</p> : tab === 'challenge' ? <><section className="challenge-card"><div><p className="kicker">Эта неделя</p><h2>Километраж двигает тебя вперёд</h2><p>Запиши заезд — его дистанция сохранится в твоей истории и попадёт в будущую гонку.</p></div><div className="challenge-track" aria-label="Шкала прогресса"><span>Старт</span><div><motion.i initial={{ x: '8%' }} animate={{ x: '64%' }} transition={{ type: 'spring', stiffness: 75, damping: 15 }}><Flag size={16} /></motion.i></div><span>Финиш</span></div></section><section className="competition-list">{overview.challengeGroups.length ? overview.challengeGroups.map((group) => <article key={group.id}><Trophy size={20} /><div><strong>{group.name}</strong><span>{group.is_public ? 'Открытый челлендж' : 'Частная группа'}</span></div></article>) : <section className="empty-panel"><h2>Челленджей пока нет</h2><p>Первая группа появится здесь, когда организатор откроет недельную гонку.</p></section>}</section></> : <section className="competition-list">{overview.events.length ? overview.events.map((event) => <article key={event.id}><CalendarDays size={20} /><div><strong>{event.title}</strong><span>{new Intl.DateTimeFormat('ru', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(event.event_date))}{event.location ? ` · ${event.location}` : ''}</span><p>{event.description || event.event_type}</p>{event.registration_url && <a href={event.registration_url} target="_blank" rel="noreferrer">Регистрация</a>}</div></article>) : <section className="empty-panel"><h2>Событий пока нет</h2><p>Когда в календаре появятся старты и клубные заезды, они будут здесь.</p></section>}</section>}</main></PageShell>;
}
