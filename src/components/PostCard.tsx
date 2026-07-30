import { useRef, useState, type FormEvent } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Heart, MessageCircle, Send } from 'lucide-react';
import { Link } from 'wouter';
import type { SocialPost } from '../lib/cyclingModels';
import { addPostComment, togglePostLike } from '../lib/posts';
import { Avatar } from './Avatar';
import { EmojiPicker } from './EmojiPicker';
import { RideOverlay } from './RideOverlay';
import { RoutePostPreview } from './RoutePostPreview';

type PostCardProps = {
  post: SocialPost;
  viewerId: string;
  onLikeChange: (postId: string, shouldBeLiked: boolean) => void;
  onRefresh: () => Promise<void>;
};

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('ru', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(value));
}

export function PostCard({ post, viewerId, onLikeChange, onRefresh }: PostCardProps) {
  const [comment, setComment] = useState('');
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [likeBusy, setLikeBusy] = useState(false);
  const [commentBusy, setCommentBusy] = useState(false);
  const [error, setError] = useState('');
  const [likeBurst, setLikeBurst] = useState(false);
  const [mediaLikeAnimationId, setMediaLikeAnimationId] = useState(0);
  const commentInputRef = useRef<HTMLInputElement>(null);
  const lastMediaTapAtRef = useRef(0);
  const lastMediaLikeAtRef = useRef(0);
  const liked = post.likes.some((like) => like.user_id === viewerId);

  async function changeLike(fromMedia = false) {
    if (likeBusy) return;
    if (!liked) {
      setLikeBurst(true);
      if (fromMedia) setMediaLikeAnimationId(Date.now());
      window.setTimeout(() => setLikeBurst(false), 520);
      window.setTimeout(() => setMediaLikeAnimationId(0), 820);
    }
    const shouldBeLiked = !liked;
    onLikeChange(post.id, shouldBeLiked);
    setLikeBusy(true); setError('');
    try { await togglePostLike(post.id, liked); await onRefresh(); }
    catch { onLikeChange(post.id, liked); setError('Не удалось обновить лайк.'); }
    finally { setLikeBusy(false); }
  }

  async function submitComment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCommentBusy(true); setError('');
    try { await addPostComment(post.id, comment); setComment(''); await onRefresh(); }
    catch { setError('Не удалось отправить комментарий.'); }
    finally { setCommentBusy(false); }
  }

  function openComments() {
    setCommentsOpen((current) => !current);
    if (!commentsOpen) window.setTimeout(() => commentInputRef.current?.focus(), 170);
  }

  function handleMediaTap() {
    const now = Date.now();
    if (now - lastMediaTapAtRef.current < 460) {
      lastMediaTapAtRef.current = 0;
      triggerMediaLike();
      return;
    }
    lastMediaTapAtRef.current = now;
  }

  function triggerMediaLike() {
    const now = Date.now();
    if (now - lastMediaLikeAtRef.current < 650) return;
    lastMediaLikeAtRef.current = now;
    void changeLike(true);
  }

  return <article className="post-card" id={`post-${post.id}`}>
    <header className="post-author">
      <Link href={`/u/${post.author.username}`}><Avatar profile={post.author} /></Link>
      <div><Link href={`/u/${post.author.username}`}><strong>{post.author.full_name || post.author.username}</strong></Link><span>@{post.author.username} · {formatDate(post.created_at)}</span></div>
    </header>
    {(post.media_url || post.rideStats) && <div className={`post-media ${post.media_url ? '' : 'post-media-empty'}`} onDoubleClick={triggerMediaLike} onPointerUp={(event) => { if (event.pointerType === 'touch') handleMediaTap(); }}>
      {post.media_url && post.media_type === 'image' && <img src={post.media_url} alt={post.caption || 'Публикация райдера'} />}
      {post.media_url && post.media_type === 'video' && <video controls preload="metadata" src={post.media_url} />}
      {post.rideStats && <RideOverlay stats={post.rideStats} />}
      {mediaLikeAnimationId > 0 && <span className="media-like-burst" key={mediaLikeAnimationId} aria-hidden="true"><Heart size={116} fill="currentColor" /></span>}
    </div>}
    <div className="post-copy">
      {post.caption && <p className="post-caption">{post.caption}</p>}
      {post.routePreview && <RoutePostPreview route={post.routePreview} />}
      <div className="post-actions"><span className="like-control"><motion.button type="button" className={liked ? 'like-button liked' : 'like-button'} onClick={() => void changeLike()} disabled={likeBusy} aria-label={liked ? 'Убрать лайк' : 'Поставить лайк'} whileTap={{ scale: .78 }} animate={liked ? { scale: [1, 1.28, 1] } : { scale: 1 }} transition={{ type: 'spring', stiffness: 430, damping: 16 }}><Heart size={19} fill={liked ? 'currentColor' : 'none'} aria-hidden="true" /> <span>{post.likes.length}</span></motion.button><AnimatePresence>{likeBurst && <span className="like-burst" aria-hidden="true">{[0, 1, 2, 3].map((particle) => <motion.i key={particle} initial={{ opacity: 1, scale: .5, x: 0, y: 0 }} animate={{ opacity: 0, scale: 1, x: [-13, 12, -8, 15][particle], y: [-20, -14, -28, -24][particle] }} exit={{ opacity: 0 }} transition={{ duration: .48 }}><Heart size={11} fill="currentColor" /></motion.i>)}</span>}</AnimatePresence></span><button type="button" className={commentsOpen ? 'post-action-button active' : 'post-action-button'} onClick={openComments} aria-expanded={commentsOpen} aria-controls={`comments-${post.id}`}><MessageCircle size={19} aria-hidden="true" /><span>{post.comments.length || ''} комментариев</span></button></div>
      <AnimatePresence initial={false}>{commentsOpen && <motion.section id={`comments-${post.id}`} className="post-comment-panel" initial={{ opacity: 0, height: 0, y: -8 }} animate={{ opacity: 1, height: 'auto', y: 0 }} exit={{ opacity: 0, height: 0, y: -8 }} transition={{ duration: .24, ease: 'easeOut' }}><div className="comment-panel-heading"><strong>Комментарии</strong><span>{post.comments.length}</span></div><div className="post-comments">{post.comments.length ? post.comments.map((item) => <article className="post-comment" key={item.id}><Link href={`/u/${item.author.username}`}><Avatar profile={item.author} className="comment-avatar" /></Link><p><Link href={`/u/${item.author.username}`}><strong>{item.author.full_name || item.author.username}</strong></Link><span>{item.comment}</span></p></article>) : <p className="comment-empty">Начни обсуждение этого заезда.</p>}</div><form className="comment-form" onSubmit={(event) => void submitComment(event)}><EmojiPicker onPick={(emoji) => setComment((current) => `${current}${emoji}`)} /><input ref={commentInputRef} value={comment} onChange={(event) => setComment(event.target.value)} maxLength={1000} placeholder="Напиши комментарий…" /><button type="submit" disabled={commentBusy || !comment.trim()} aria-label="Отправить комментарий"><Send size={17} aria-hidden="true" /></button></form></motion.section>}</AnimatePresence>
      {error && <p className="form-note" role="alert">{error}</p>}
    </div>
  </article>;
}
