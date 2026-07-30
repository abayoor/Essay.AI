import { useCallback, useEffect, useState } from 'react';
import { MessageCircle, Search, Sparkles } from 'lucide-react';
import { Link, useLocation } from 'wouter';
import { Avatar } from '../components/Avatar';
import { BikeLoader } from '../components/BikeLoader';
import { PageShell } from '../components/PageShell';
import { useSession } from '../lib/auth';
import type { ConversationSummary, PublicProfile } from '../lib/cyclingModels';
import { loadConversations, startDirectConversation } from '../lib/messages';
import { searchPublicProfiles } from '../lib/rider';

function preview(conversation: ConversationSummary): string {
  const message = conversation.lastMessage;
  if (!message) return 'Новый диалог';
  if (message.content_type === 'text') return message.text_content ?? '';
  if (message.content_type === 'shared_post') return 'Прикреплён пост';
  if (message.content_type === 'image') return 'Фотография';
  if (message.content_type === 'video') return 'Видео';
  return 'Файл';
}

function formatTime(value: string | undefined): string {
  if (!value) return '';
  return new Intl.DateTimeFormat('ru', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(value));
}

export function MessagesPage() {
  const { session, loading } = useSession();
  const [, navigate] = useLocation();
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [conversationsLoading, setConversationsLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [riders, setRiders] = useState<PublicProfile[]>([]);
  const [searching, setSearching] = useState(false);
  const [startingId, setStartingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const refresh = useCallback(async () => { setConversationsLoading(true); try { setError(''); setConversations(await loadConversations()); } catch { setError('Не удалось загрузить сообщения.'); } finally { setConversationsLoading(false); } }, []);
  useEffect(() => { if (!loading && !session) navigate('/auth/sign-in'); if (session) void refresh(); }, [loading, navigate, refresh, session]);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (query.trim().length < 2) { setRiders([]); setSearching(false); return; }
      setSearching(true);
      void searchPublicProfiles(query).then((results) => setRiders(results.filter((rider) => rider.id !== session?.user.id))).catch(() => setError('Не удалось найти райдеров.')).finally(() => setSearching(false));
    }, 220);
    return () => window.clearTimeout(timer);
  }, [query, session?.user.id]);

  async function startConversation(rider: PublicProfile) {
    setStartingId(rider.id); setError('');
    try { navigate(`/messages/${await startDirectConversation(rider.id)}`); }
    catch { setError('Не удалось начать диалог.'); }
    finally { setStartingId(null); }
  }

  return <PageShell><main className="cycle-page messages-page"><header className="messages-hero"><div><p className="kicker">Личные сообщения</p><h1>На связи<br /><em>с райдерами.</em></h1><p>Обсуждай заезды, спрашивай про технику и договаривайся о следующем маршруте.</p></div><div className="messages-hero-visual" aria-hidden="true"><span className="message-orbit one" /><span className="message-orbit two" /><span className="message-orbit three" /><MessageCircle size={42} /></div></header>{conversationsLoading ? <BikeLoader label="Загружаем диалоги…" /> : <><section className="messages-launchpad"><div className="messages-launchpad-copy"><span><Sparkles size={17} aria-hidden="true" /></span><div><strong>Начать новый разговор</strong><p>Найди райдера по нику — мы сразу откроем личный чат.</p></div></div><section className="rider-search" aria-label="Поиск райдера"><Search size={19} aria-hidden="true" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Поиск по @username" maxLength={48} /></section>{query.trim().length >= 2 && <section className="rider-search-results" aria-live="polite">{searching ? <p>Ищем райдеров…</p> : riders.length ? riders.map((rider) => <article key={rider.id}><Avatar profile={rider} /><div><strong>{rider.full_name || rider.username}</strong><span>@{rider.username}{rider.home_city ? ` · ${rider.home_city}` : ''}</span></div><button className="outline-inline-button" disabled={startingId === rider.id} onClick={() => void startConversation(rider)}>{startingId === rider.id ? 'Открываем…' : 'Написать'}</button></article>) : <p>По этому нику никого не нашли.</p>}</section>}</section>{error && <div className="inline-error">{error}<button type="button" onClick={() => void refresh()}>Повторить</button></div>}<section className="messages-inbox"><header><div><p className="kicker">Твои чаты</p><h2>{conversations.length ? 'Недавние диалоги' : 'Первый разговор начинается здесь'}</h2></div><span>{conversations.length}</span></header>{conversations.length ? <section className="conversations-list">{conversations.map((conversation) => <Link href={`/messages/${conversation.id}`} className="conversation-row" key={conversation.id}><Avatar profile={conversation.participant} className="conversation-avatar" /><div><strong>{conversation.participant.full_name || conversation.participant.username}</strong><span>{preview(conversation)}</span></div><time>{formatTime(conversation.lastMessage?.created_at)}</time></Link>)}</section> : <section className="messages-empty-state"><div className="empty-chat-art" aria-hidden="true"><i>Привет!</i><b>🚲</b><em>Погнали?</em></div><div><h3>Здесь будет твоя переписка</h3><p>Напиши райдеру через поиск выше или найди интересный профиль в ленте.</p><Link className="outline-inline-button" href="/feed">Открыть ленту</Link></div></section>}</section></>}</main></PageShell>;
}
