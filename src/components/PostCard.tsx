import { useState, type FormEvent } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Heart } from 'lucide-react';
import { Link } from 'wouter';
import type { SocialPost } from '../lib/cyclingModels';
import { addPostComment, togglePostLike } from '../lib/posts';
import { Avatar } from './Avatar';
import { RideOverlay } from './RideOverlay';
import { RoutePostPreview } from './RoutePostPreview';

type PostCardProps = {
  post: SocialPost;
  viewerId: string;
  onChange: () => Promise<void>;
};

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('ru', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(value));
}

export function PostCard({ post, viewerId, onChange }: PostCardProps) {
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [likeBurst, setLikeBurst] = useState(false);
  const liked = post.likes.some((like) => like.user_id === viewerId);

  async function changeLike() {
    if (!liked) {
      setLikeBurst(true);
      window.setTimeout(() => setLikeBurst(false), 520);
    }
    setBusy(true); setError('');
    try { await togglePostLike(post.id, liked); await onChange(); }
    catch { setError('Не удалось обновить лайк.'); }
    finally { setBusy(false); }
  }

  async function submitComment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setError('');
    try { await addPostComment(post.id, comment); setComment(''); await onChange(); }
    catch { setError('Не удалось отправить комментарий.'); }
    finally { setBusy(false); }
  }

  return <article className="post-card" id={`post-${post.id}`}>
    <header className="post-author">
      <Link href={`/u/${post.author.username}`}><Avatar profile={post.author} /></Link>
      <div><Link href={`/u/${post.author.username}`}><strong>{post.author.full_name || post.author.username}</strong></Link><span>@{post.author.username} · {formatDate(post.created_at)}</span></div>
    </header>
    {(post.media_url || post.rideStats) && <div className={`post-media ${post.media_url ? '' : 'post-media-empty'}`}>
      {post.media_url && post.media_type === 'image' && <img src={post.media_url} alt={post.caption || 'Публикация райдера'} />}
      {post.media_url && post.media_type === 'video' && <video controls preload="metadata" src={post.media_url} />}
      {post.rideStats && <RideOverlay stats={post.rideStats} />}
    </div>}
    <div className="post-copy">
      {post.caption && <p className="post-caption">{post.caption}</p>}
      {post.routePreview && <RoutePostPreview route={post.routePreview} />}
      <div className="post-actions"><span className="like-control"><motion.button className={liked ? 'like-button liked' : 'like-button'} onClick={() => void changeLike()} disabled={busy} aria-label={liked ? 'Убрать лайк' : 'Поставить лайк'} whileTap={{ scale: .78 }} animate={liked ? { scale: [1, 1.28, 1] } : { scale: 1 }} transition={{ type: 'spring', stiffness: 430, damping: 16 }}><Heart size={19} fill={liked ? 'currentColor' : 'none'} aria-hidden="true" /> <span>{post.likes.length}</span></motion.button><AnimatePresence>{likeBurst && <span className="like-burst" aria-hidden="true">{[0, 1, 2, 3].map((particle) => <motion.i key={particle} initial={{ opacity: 1, scale: .5, x: 0, y: 0 }} animate={{ opacity: 0, scale: 1, x: [ -13, 12, -8, 15 ][particle], y: [ -20, -14, -28, -24 ][particle] }} exit={{ opacity: 0 }} transition={{ duration: .48 }}><Heart size={11} fill="currentColor" /></motion.i>)}</span>}</AnimatePresence></span><span>{post.comments.length} комм.</span></div>
      <div className="post-comments">{post.comments.map((item) => <p key={item.id}><Link href={`/u/${item.author.username}`}><strong>{item.author.username}</strong></Link> {item.comment}</p>)}</div>
      <form className="comment-form" onSubmit={(event) => void submitComment(event)}><input value={comment} onChange={(event) => setComment(event.target.value)} maxLength={1000} placeholder="Оставить комментарий" /><button disabled={busy || !comment.trim()}>Отправить</button></form>
      {error && <p className="form-note" role="alert">{error}</p>}
    </div>
  </article>;
}
