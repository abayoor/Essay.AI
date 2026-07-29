import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation } from 'wouter';
import { Avatar } from '../components/Avatar';
import { PageShell } from '../components/PageShell';
import { useSession } from '../lib/auth';
import type { ConversationSummary } from '../lib/cyclingModels';
import { loadConversations } from '../lib/messages';

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
  const [error, setError] = useState('');
  const refresh = useCallback(async () => { try { setError(''); setConversations(await loadConversations()); } catch { setError('Не удалось загрузить сообщения.'); } }, []);
  useEffect(() => { if (!loading && !session) navigate('/auth/sign-in'); if (session) void refresh(); }, [loading, navigate, refresh, session]);
  return <PageShell><main className="cycle-page messages-page"><header className="page-heading"><div><p className="kicker">Личные сообщения</p><h1>Диалоги</h1><p>Начни переписку с профиля любого райдера.</p></div></header>{error && <div className="inline-error">{error}<button onClick={() => void refresh()}>Повторить</button></div>}{conversations.length ? <section className="conversations-list">{conversations.map((conversation) => <Link href={`/messages/${conversation.id}`} className="conversation-row" key={conversation.id}><Avatar profile={conversation.participant} className="conversation-avatar" /><div><strong>{conversation.participant.full_name || conversation.participant.username}</strong><span>{preview(conversation)}</span></div><time>{formatTime(conversation.lastMessage?.created_at)}</time></Link>)}</section> : <section className="empty-panel"><h2>Диалогов пока нет</h2><p>Открой профиль интересного райдера и нажми «Написать».</p><Link className="signal-button" href="/feed">Перейти в ленту</Link></section>}</main></PageShell>;
}
