import { AiStreamPreview } from './AiStreamPreview';
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
  streamText: string;
  personasStreamText: string;
};

export function FeedbackPanel({
  feedback, loading, onRequest, disabled, error, personas, personasLoading, personasError, onRequestPersonas,
  streamText, personasStreamText,
}: FeedbackPanelProps) {
  return (
    <>
      <aside className="feedback-panel">
      <p className="eyebrow">ИИ-коуч</p>
      <h2>Мягкая обратная связь</h2>
      <p className="muted">Не переписывает текст — помогает сделать его яснее и честнее.</p>
      <div className="feedback-actions">
        <button onClick={onRequest} disabled={disabled || loading}>{loading ? 'Коуч читает текст…' : 'Получить фидбэк'}</button>
        <button className="secondary-button" onClick={onRequestPersonas} disabled={disabled || personasLoading}>
          {personasLoading ? 'Слушаем читателей…' : 'Три читателя'}
        </button>
      </div>
      {loading && <AiStreamPreview label="Коуч формирует разбор по твоим фразам…" text={streamText} />}
      {personasLoading && <AiStreamPreview label="Читатели формулируют разные отклики…" text={personasStreamText} />}
      {error && <div className="error-action" role="alert"><p className="form-message">{error}</p><button className="text-button" onClick={onRequest} disabled={loading}>Попробовать снова</button></div>}
      {personasError && <div className="error-action" role="alert"><p className="form-message">{personasError}</p><button className="text-button" onClick={onRequestPersonas} disabled={personasLoading}>Попробовать снова</button></div>}
      {!feedback && !error && !loading && <p className="empty-copy">Напиши хотя бы пару предложений — затем попроси коуча посмотреть на черновик.</p>}
      {feedback && (
        <div className="feedback-content">
          {feedback.ghostwriting_request && <p className="ethics-note">Я не могу писать эссе за тебя, но помогу найти твой собственный угол и следующие шаги.</p>}
          <FeedbackSection title="Начало" text={feedback.hook_feedback} />
          <FeedbackSection title="Структура" text={feedback.structure_feedback} />
          <FeedbackSection title="Показывай, а не рассказывай" text={feedback.show_dont_tell_ratio} />
          <FeedbackSection title="Твой голос" text={feedback.voice_notes} />
          {feedback.cliche_flags.length > 0 && <FeedbackSection title="На что посмотреть глубже" text={feedback.cliche_flags.join(' ')} />}
          {feedback.margin_comments?.map((comment, index) => <MarginComment key={comment.quote + index} comment={comment} />)}
          <a className="next-step" href="#overlap-check">Готово с правками? Проверь свои пересечения</a>
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
