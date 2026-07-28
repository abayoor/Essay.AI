import { useState } from 'react';
import { Link } from 'wouter';
import { AiStreamPreview } from './AiStreamPreview';
import type { OverlapCheckResult } from '../lib/models';

type OverlapCheckPanelProps = {
  disabled: boolean;
  onCheck: (onChunk: (chunk: string) => void) => Promise<OverlapCheckResult[]>;
  onComplete: () => void;
  nextHref: string;
};

export function OverlapCheckPanel({ disabled, onCheck, onComplete, nextHref }: OverlapCheckPanelProps) {
  const [results, setResults] = useState<OverlapCheckResult[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [streamText, setStreamText] = useState('');

  async function check() {
    setLoading(true);
    setError('');
    setStreamText('');
    try {
      setResults(await onCheck((chunk) => setStreamText((current) => current + chunk)));
      onComplete();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Не удалось проверить пересечения. Попробуй ещё раз.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="overlap-panel" id="overlap-check" aria-labelledby="overlap-title">
      <div>
        <p className="eyebrow">Общий взгляд</p>
        <h2 id="overlap-title">Пересечения между эссе</h2>
        <p className="muted">Сравним черновик только с твоими другими эссе — не с чужими текстами.</p>
      </div>
      <button className="secondary-button overlap-button" onClick={() => void check()} disabled={disabled || loading}>
        {loading ? 'Сравниваем…' : 'Проверить пересечения'}
      </button>
      {loading && <AiStreamPreview label="Сверяем только твои сохранённые эссе…" text={streamText} />}
      {error && <div className="error-action" role="alert"><p className="form-message">{error}</p><button className="text-button" onClick={() => void check()} disabled={loading}>Попробовать снова</button></div>}
      {results?.length === 0 && <p className="empty-copy">Пересечений с другими твоими эссе не найдено.</p>}
      {results && results.length > 0 && <div className="overlap-results">
        {results.map((result) => (
          <article className="overlap-result" key={result.essayId}>
            <p className="eyebrow">{result.verdict === 'warning' ? 'Возможное повторение' : 'Похожая тема — это нормально'}</p>
            <h3>{result.title}</h3>
            <p>{result.explanation}</p>
            <p className="muted">{result.recommendation}</p>
          </article>
        ))}
      </div>}
      {results && <Link href={nextHref} className="next-step">Дальше: потренируйся отвечать на вопросы интервью по этому эссе</Link>}
    </section>
  );
}
