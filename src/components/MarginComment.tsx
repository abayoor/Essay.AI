import type { CoachComment } from '../lib/models';

export function MarginComment({ comment }: { comment: CoachComment }) {
  return (
    <article className="margin-comment">
      <p className="comment-quote">«{comment.quote}»</p>
      <p>{comment.note}</p>
    </article>
  );
}
