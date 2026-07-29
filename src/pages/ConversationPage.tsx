import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { motion } from 'framer-motion';
import { Paperclip, Send, Share2 } from 'lucide-react';
import { Link, useLocation, useRoute } from 'wouter';
import { Avatar } from '../components/Avatar';
import { PageShell } from '../components/PageShell';
import { useSession } from '../lib/auth';
import type { DirectMessage, PublicProfile, SocialPost } from '../lib/cyclingModels';
import { createMessageFileUrl, loadConversationMessages, loadConversationParticipants, sendSharedPost, sendTextMessage, subscribeToConversation, uploadMessageFile } from '../lib/messages';
import { loadPosts } from '../lib/posts';

function formatTime(value: string): string {
  return new Intl.DateTimeFormat('ru', { hour: '2-digit', minute: '2-digit' }).format(new Date(value));
}

function MessageAttachment({ message }: { message: DirectMessage }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => { if (message.file_url) void createMessageFileUrl(message.file_url).then(setUrl).catch(() => setUrl(null)); }, [message.file_url]);
  if (!url) return <span>Загружаем файл…</span>;
  if (message.content_type === 'image') return <img className="message-image" src={url} alt="Прикреплённое изображение" />;
  if (message.content_type === 'video') return <video className="message-video" controls src={url} />;
  return <a href={url} target="_blank" rel="noreferrer">Открыть файл</a>;
}

function SharedPostMessage({ postId }: { postId: string | null }) {
  if (!postId) return null;
  return <Link className="shared-post-message" href={`/feed#post-${postId}`}><Share2 size={18} aria-hidden="true" /><div><strong>Публикация из ленты</strong><small>Открыть прикреплённый пост</small></div></Link>;
}

export function ConversationPage() {
  const [, params] = useRoute('/messages/:id');
  const conversationId = params?.id ?? '';
  const { session, loading } = useSession();
  const [, navigate] = useLocation();
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [participants, setParticipants] = useState<PublicProfile[]>([]);
  const [text, setText] = useState('');
  const [sharePosts, setSharePosts] = useState<SocialPost[]>([]);
  const [sharing, setSharing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const endRef = useRef<HTMLDivElement>(null);
  const refresh = useCallback(async () => {
    const [nextMessages, nextParticipants] = await Promise.all([loadConversationMessages(conversationId), loadConversationParticipants(conversationId)]);
    setMessages(nextMessages); setParticipants(nextParticipants);
  }, [conversationId]);
  useEffect(() => { if (!loading && !session) navigate('/auth/sign-in'); if (session && conversationId) void refresh().catch(() => setError('Не удалось открыть диалог.')); }, [conversationId, loading, navigate, refresh, session]);
  useEffect(() => { if (!conversationId || !session) return; return subscribeToConversation(conversationId, (message) => setMessages((current) => current.some((item) => item.id === message.id) ? current : [...current, message])); }, [conversationId, session]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);
  const otherRider = participants.find((participant) => participant.id !== session?.user.id);

  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setBusy(true); setError(''); try { await sendTextMessage(conversationId, text); setText(''); await refresh(); } catch { setError('Не удалось отправить сообщение.'); } finally { setBusy(false); } }
  async function attachFile(file: File | null) { if (!file) return; setBusy(true); setError(''); try { await uploadMessageFile(conversationId, file); await refresh(); } catch { setError('Не удалось загрузить файл.'); } finally { setBusy(false); } }
  async function showPosts() { setSharing(true); try { setSharePosts(await loadPosts()); } catch { setError('Не удалось загрузить посты.'); } }
  async function sharePost(postId: string) { setBusy(true); try { await sendSharedPost(conversationId, postId); setSharing(false); await refresh(); } catch { setError('Не удалось прикрепить пост.'); } finally { setBusy(false); } }

  return <PageShell><main className="cycle-page conversation-page">{otherRider && <header className="conversation-header"><Link href="/messages" className="back-link">← Диалоги</Link><Link href={`/u/${otherRider.username}`} className="conversation-person"><Avatar profile={otherRider} className="conversation-avatar" /><strong>{otherRider.full_name || otherRider.username}</strong></Link></header>}{error && <p className="inline-error">{error}</p>}<section className="message-thread">{messages.map((message) => <motion.article initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ type: 'spring', stiffness: 310, damping: 26 }} className={message.sender_id === session?.user.id ? 'message-bubble mine' : 'message-bubble'} key={message.id}>{message.content_type === 'text' && <p>{message.text_content}</p>}{['image', 'video', 'file'].includes(message.content_type) && <MessageAttachment message={message} />}{message.content_type === 'shared_post' && <SharedPostMessage postId={message.shared_post_id} />}<time>{formatTime(message.created_at)}</time></motion.article>)}<div ref={endRef} /></section>{sharing && <section className="share-post-picker"><div><strong>Прикрепить пост</strong><button onClick={() => setSharing(false)}>Закрыть</button></div>{sharePosts.slice(0, 12).map((post) => <button key={post.id} disabled={busy} onClick={() => void sharePost(post.id)}><span>{post.author.username}</span>{post.caption || 'Пост с медиа'}</button>)}</section>}<form className="message-composer" onSubmit={(event) => void submit(event)}><label className="attachment-button" title="Прикрепить файл"><Paperclip size={20} aria-hidden="true" /><input type="file" accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,application/pdf" onChange={(event) => void attachFile(event.target.files?.[0] ?? null)} /></label><button type="button" className="attachment-button" title="Прикрепить пост" onClick={() => void showPosts()}><Share2 size={19} aria-hidden="true" /></button><input value={text} onChange={(event) => setText(event.target.value)} placeholder="Напиши сообщение…" maxLength={4000} /><button className="message-send-button" disabled={busy || !text.trim()} aria-label="Отправить сообщение"><Send size={20} aria-hidden="true" /></button></form></main></PageShell>;
}
