import { useRef, useState, type FormEvent, type MouseEvent, type PointerEvent } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Heart, MessageCircle, Send } from 'lucide-react';
import { Link } from 'wouter';
import type { SocialPost } from '../lib/cyclingModels';
import { useLocaleText } from '../lib/localized';
import { addPostComment, loadPost, togglePostLike } from '../lib/posts';
import { Avatar } from './Avatar';
import { EmojiPicker } from './EmojiPicker';
import { RideOverlay } from './RideOverlay';
import { RoutePostPreview } from './RoutePostPreview';

type PostCardProps = {
  post: SocialPost;
  viewerId: string;
  onLikeChange: (postId: string, shouldBeLiked: boolean) => void;
  onPostChange: (post: SocialPost) => void;
};

type LikeAnimation = {
  id: number;
  x: number;
  y: number;
};

type TouchPoint = {
  at: number;
  x: number;
  y: number;
};

function formatDate(value: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function isInteractiveTarget(target: EventTarget | null): boolean {
  return target instanceof Element
    && Boolean(target.closest('a, button, input, textarea, select, video, [data-no-double-like]'));
}

export function PostCard({ post, viewerId, onLikeChange, onPostChange }: PostCardProps) {
  const text = useLocaleText();
  const [comment, setComment] = useState('');
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [likeBusy, setLikeBusy] = useState(false);
  const [commentBusy, setCommentBusy] = useState(false);
  const [error, setError] = useState('');
  const [likeBurst, setLikeBurst] = useState(false);
  const [postLikeAnimation, setPostLikeAnimation] = useState<LikeAnimation | null>(null);
  const cardRef = useRef<HTMLElement>(null);
  const commentInputRef = useRef<HTMLInputElement>(null);
  const lastTouchRef = useRef<TouchPoint | null>(null);
  const lastGestureLikeAtRef = useRef(0);
  const liked = post.likes.some((like) => like.user_id === viewerId);

  function playSmallLikeBurst() {
    setLikeBurst(true);
    window.setTimeout(() => setLikeBurst(false), 520);
  }

  function playPostLikeAnimation(clientX: number, clientY: number) {
    const bounds = cardRef.current?.getBoundingClientRect();
    if (!bounds) return;
    const edgePadding = 62;
    setPostLikeAnimation({
      id: Date.now(),
      x: Math.min(Math.max(clientX - bounds.left, edgePadding), bounds.width - edgePadding),
      y: Math.min(Math.max(clientY - bounds.top, edgePadding), bounds.height - edgePadding),
    });
  }

  async function changeLike() {
    if (likeBusy) return;
    const shouldBeLiked = !liked;
    if (shouldBeLiked) playSmallLikeBurst();
    onLikeChange(post.id, shouldBeLiked);
    setLikeBusy(true);
    setError('');
    try {
      await togglePostLike(post.id, liked);
    } catch {
      onLikeChange(post.id, liked);
      setError(text(
        'Не удалось обновить лайк.',
        'Лайкты жаңарту мүмкін болмады.',
        'Could not update the like.',
      ));
    } finally {
      setLikeBusy(false);
    }
  }

  async function likeFromGesture(clientX: number, clientY: number) {
    const now = Date.now();
    if (now - lastGestureLikeAtRef.current < 600) return;
    lastGestureLikeAtRef.current = now;
    playPostLikeAnimation(clientX, clientY);

    // Like gestures behave like Instagram: an already-liked post stays liked.
    if (liked || likeBusy) return;
    playSmallLikeBurst();
    onLikeChange(post.id, true);
    setLikeBusy(true);
    setError('');
    try {
      await togglePostLike(post.id, false);
    } catch {
      onLikeChange(post.id, false);
      setError(text(
        'Не удалось поставить лайк.',
        'Лайк қою мүмкін болмады.',
        'Could not like the post.',
      ));
    } finally {
      setLikeBusy(false);
    }
  }

  function handleDoubleClick(event: MouseEvent<HTMLElement>) {
    if (isInteractiveTarget(event.target)) return;
    event.preventDefault();
    void likeFromGesture(event.clientX, event.clientY);
  }

  function handleTouchTap(event: PointerEvent<HTMLElement>) {
    if (event.pointerType !== 'touch' || isInteractiveTarget(event.target)) return;
    const current: TouchPoint = { at: Date.now(), x: event.clientX, y: event.clientY };
    const previous = lastTouchRef.current;
    lastTouchRef.current = current;
    if (!previous) return;

    const distance = Math.hypot(current.x - previous.x, current.y - previous.y);
    if (current.at - previous.at <= 450 && distance <= 48) {
      lastTouchRef.current = null;
      void likeFromGesture(current.x, current.y);
    }
  }

  async function submitComment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCommentBusy(true);
    setError('');
    try {
      await addPostComment(post.id, comment);
      setComment('');
      const nextPost = await loadPost(post.id);
      if (nextPost) onPostChange(nextPost);
    } catch {
      setError(text(
        'Не удалось отправить комментарий.',
        'Пікірді жіберу мүмкін болмады.',
        'Could not send the comment.',
      ));
    } finally {
      setCommentBusy(false);
    }
  }

  function openComments() {
    setCommentsOpen((current) => !current);
    if (!commentsOpen) window.setTimeout(() => commentInputRef.current?.focus(), 170);
  }

  return <article
    ref={cardRef}
    className="post-card"
    id={`post-${post.id}`}
    aria-labelledby={`post-author-${post.id}`}
    onDoubleClick={handleDoubleClick}
    onPointerUp={handleTouchTap}
  >
    <AnimatePresence>
      {postLikeAnimation && <motion.span
        className="post-like-burst"
        key={postLikeAnimation.id}
        style={{ left: postLikeAnimation.x, top: postLikeAnimation.y }}
        initial={{ opacity: 0, scale: 0.15, rotate: -12 }}
        animate={{
          opacity: [0, 1, 1, 0],
          scale: [0.15, 1.28, 0.94, 1],
          rotate: [-12, 8, 0, 0],
        }}
        transition={{ duration: 0.82, times: [0, 0.24, 0.52, 1], ease: 'easeOut' }}
        onAnimationComplete={() => setPostLikeAnimation((current) => (
          current?.id === postLikeAnimation.id ? null : current
        ))}
        aria-hidden="true"
      >
        <Heart size={138} strokeWidth={1.6} fill="currentColor" />
      </motion.span>}
    </AnimatePresence>

    <header className="post-author">
      <Link href={`/u/${post.author.username}`}><Avatar profile={post.author} /></Link>
      <div className="post-author-copy">
        <Link href={`/u/${post.author.username}`}>
          <strong id={`post-author-${post.id}`}>{post.author.full_name || post.author.username}</strong>
        </Link>
        <span className="post-author-meta">
          <span>@{post.author.username}</span>
          <span aria-hidden="true">·</span>
          <time dateTime={post.created_at}>{formatDate(post.created_at, text('ru-RU', 'kk-KZ', 'en-US'))}</time>
        </span>
      </div>
    </header>

    {post.media_url && <div className="post-media">
      {post.media_type === 'image' && <img
        src={post.media_url}
        alt={post.rideTitle || post.caption || text('Публикация райдера', 'Райдер жазбасы', 'Rider post')}
        loading="lazy"
        decoding="async"
      />}
      {post.media_type === 'video' && <video controls playsInline preload="metadata" src={post.media_url} />}
    </div>}

    <div className="post-copy">
      {post.rideStats && <RideOverlay stats={post.rideStats} title={post.rideTitle} description={post.rideDescription} />}
      {post.caption && !post.rideStats && <p className="post-caption">{post.caption}</p>}
      {post.routePreview && <RoutePostPreview route={post.routePreview} />}
      <div className="post-actions">
        <span className="like-control">
          <motion.button
            type="button"
            className={liked ? 'like-button liked' : 'like-button'}
            onClick={() => void changeLike()}
            disabled={likeBusy}
            aria-label={liked
              ? text('Убрать лайк', 'Лайкты алып тастау', 'Remove like')
              : text('Поставить лайк', 'Лайк қою', 'Like')}
            whileTap={{ scale: 0.78 }}
            animate={liked ? { scale: [1, 1.28, 1] } : { scale: 1 }}
            transition={{ type: 'spring', stiffness: 430, damping: 16 }}
          >
            <Heart size={19} fill={liked ? 'currentColor' : 'none'} aria-hidden="true" />
            <span className="like-count">{post.likes.length}</span>
          </motion.button>
          <AnimatePresence>
            {likeBurst && <span className="like-burst" aria-hidden="true">
              {[0, 1, 2, 3].map((particle) => <motion.i
                key={particle}
                initial={{ opacity: 1, scale: 0.5, x: 0, y: 0 }}
                animate={{
                  opacity: 0,
                  scale: 1,
                  x: [-13, 12, -8, 15][particle],
                  y: [-20, -14, -28, -24][particle],
                }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.48 }}
              ><Heart size={11} fill="currentColor" /></motion.i>)}
            </span>}
          </AnimatePresence>
        </span>
        <button
          type="button"
          className={commentsOpen ? 'post-action-button active' : 'post-action-button'}
          onClick={openComments}
          aria-expanded={commentsOpen}
          aria-controls={`comments-${post.id}`}
        >
          <MessageCircle size={19} aria-hidden="true" />
          {post.comments.length > 0 && <span className="post-action-count">{post.comments.length}</span>}
          <span className="post-action-label">{text('Комментарии', 'Пікірлер', 'Comments')}</span>
        </button>
      </div>

      <AnimatePresence initial={false}>
        {commentsOpen && <motion.section
          id={`comments-${post.id}`}
          className="post-comment-panel"
          initial={{ opacity: 0, height: 0, y: -8 }}
          animate={{ opacity: 1, height: 'auto', y: 0 }}
          exit={{ opacity: 0, height: 0, y: -8 }}
          transition={{ duration: 0.24, ease: 'easeOut' }}
        >
          <div className="comment-panel-heading">
            <strong>{text('Комментарии', 'Пікірлер', 'Comments')}</strong>
            <span>{post.comments.length}</span>
          </div>
          <div className="post-comments">
            {post.comments.length ? post.comments.map((item) => <article className="post-comment" key={item.id}>
              <Link href={`/u/${item.author.username}`}>
                <Avatar profile={item.author} className="comment-avatar" />
              </Link>
              <p>
                <Link href={`/u/${item.author.username}`}>
                  <strong>{item.author.full_name || item.author.username}</strong>
                </Link>
                <span>{item.comment}</span>
              </p>
            </article>) : <p className="comment-empty">{text(
              'Начни обсуждение этого заезда.',
              'Осы сапарды талқылауды баста.',
              'Start a discussion about this ride.',
            )}</p>}
          </div>
          <form className="comment-form" onSubmit={(event) => void submitComment(event)}>
            <EmojiPicker onPick={(emoji) => setComment((current) => `${current}${emoji}`)} />
            <input
              ref={commentInputRef}
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              maxLength={1000}
              placeholder={text('Напиши комментарий…', 'Пікір жаз…', 'Write a comment…')}
            />
            <button
              type="submit"
              disabled={commentBusy || !comment.trim()}
              aria-label={text('Отправить комментарий', 'Пікірді жіберу', 'Send comment')}
            >
              <Send size={17} aria-hidden="true" />
            </button>
          </form>
        </motion.section>}
      </AnimatePresence>
      {error && <p className="post-inline-error" role="alert">{error}</p>}
    </div>
  </article>;
}
