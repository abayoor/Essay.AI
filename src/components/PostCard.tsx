import { useState, type FormEvent } from 'react';
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
  const liked = post.likes.some((like) => like.user_id === viewerId);

  async function changeLike() {
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
    <div className={`post-media ${post.media_url ? '' : 'post-media-empty'}`}>
      {post.media_url && post.media_type === 'image' && <img src={post.media_url} alt={post.caption || 'Публикация райдера'} />}
      {post.media_url && post.media_type === 'video' && <video controls preload="metadata" src={post.media_url} />}
      {post.rideStats && <RideOverlay stats={post.rideStats} />}
    </div>
    <div className="post-copy">
      {post.caption && <p className="post-caption">{post.caption}</p>}
      {post.routePreview && <RoutePostPreview route={post.routePreview} />}
      <div className="post-actions"><button className={liked ? 'like-button liked' : 'like-button'} onClick={() => void changeLike()} disabled={busy} aria-label={liked ? 'Убрать лайк' : 'Поставить лайк'}>{liked ? '♥' : '♡'} <span>{post.likes.length}</span></button><span>{post.comments.length} комм.</span></div>
      <div className="post-comments">{post.comments.map((item) => <p key={item.id}><Link href={`/u/${item.author.username}`}><strong>{item.author.username}</strong></Link> {item.comment}</p>)}</div>
      <form className="comment-form" onSubmit={(event) => void submitComment(event)}><input value={comment} onChange={(event) => setComment(event.target.value)} maxLength={1000} placeholder="Оставить комментарий" /><button disabled={busy || !comment.trim()}>Отправить</button></form>
      {error && <p className="form-note" role="alert">{error}</p>}
    </div>
  </article>;
}
