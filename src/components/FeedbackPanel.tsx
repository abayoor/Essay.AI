import { MarginComment } from './MarginComment';
import { PersonaFeedbackCards } from './PersonaFeedbackCards';
import type { CoachingFeedback, PersonaFeedback } from '../lib/models';

type FeedbackPanelProps = {
  feedback: CoachingFeedback | null;
  loading: boolean;
  onRequest: () => void;
  disabled: boolean;
  error: string;
  personas: PersonaFeedback | null;
  personasLoading: boolean;
  personasError: string;
  onRequestPersonas: () => void;
};

export function FeedbackPanel({
  feedback, loading, onRequest, disabled, error, personas, personasLoading, personasError, onRequestPersonas,
}: FeedbackPanelProps) {
  if (loading) {
    return <aside className="feedback-panel"><p className="eyebrow">ИИ-коуч</p><div className="feedback-skeleton" /><div className="feedback-skeleton short" /></aside>;
  }

  return (
    <>
      <aside className="feedback-panel">
      <p className="eyebrow">ИИ-коуч</p>
      <h2>Мягкая обратная связь</h2>
      <p className="muted">Не переписывает текст — помогает сделать его яснее и честнее.</p>
      <div className="feedback-actions">
        <button onClick={onRequest} disabled={disabled}>Получить фидбэк</button>
        <button className="secondary-button" onClick={onRequestPersonas} disabled={disabled || personasLoading}>
          {personasLoading ? 'Слушаем читателей…' : 'Три читателя'}
        </button>
      </div>
      {error && <p className="form-message" role="alert">{error}</p>}
      {personasError && <p className="form-message" role="alert">{personasError}</p>}
      {!feedback && !error && <p className="empty-copy">Напиши хотя бы пару предложений — затем попроси коуча посмотреть на черновик.</p>}
      {feedback && (
        <div className="feedback-content">
          {feedback.ghostwriting_request && <p className="ethics-note">Я не могу писать эссе за тебя, но помогу найти твой собственный угол и следующие шаги.</p>}
          <FeedbackSection title="Начало" text={feedback.hook_feedback} />
          <FeedbackSection title="Структура" text={feedback.structure_feedback} />
          <FeedbackSection title="Показывай, а не рассказывай" text={feedback.show_dont_tell_ratio} />
          <FeedbackSection title="Твой голос" text={feedback.voice_notes} />
          {feedback.cliche_flags.length > 0 && <FeedbackSection title="На что посмотреть глубже" text={feedback.cliche_flags.join(' ')} />}
          {feedback.margin_comments?.map((comment, index) => <MarginComment key={comment.quote + index} comment={comment} />)}
        </div>
      )}
      </aside>
      {personas && <PersonaFeedbackCards feedback={personas} />}
    </>
  );
}

function FeedbackSection({ title, text }: { title: string; text: string }) {
  return <section className="feedback-section"><h3>{title}</h3><p>{text}</p></section>;
}
