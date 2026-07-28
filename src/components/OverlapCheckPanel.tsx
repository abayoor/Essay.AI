import { useState } from 'react';
import type { OverlapCheckResult } from '../lib/models';

type OverlapCheckPanelProps = {
  disabled: boolean;
  onCheck: () => Promise<OverlapCheckResult[]>;
};

export function OverlapCheckPanel({ disabled, onCheck }: OverlapCheckPanelProps) {
  const [results, setResults] = useState<OverlapCheckResult[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function check() {
    setLoading(true);
    setError('');
    try {
      setResults(await onCheck());
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Не удалось проверить пересечения. Попробуй ещё раз.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="overlap-panel" aria-labelledby="overlap-title">
      <div>
        <p className="eyebrow">Общий взгляд</p>
        <h2 id="overlap-title">Пересечения между эссе</h2>
        <p className="muted">Сравним черновик только с твоими другими эссе — не с чужими текстами.</p>
      </div>
      <button className="secondary-button overlap-button" onClick={() => void check()} disabled={disabled || loading}>
        {loading ? 'Сравниваем…' : 'Проверить пересечения'}
      </button>
      {error && <p className="form-message" role="alert">{error}</p>}
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
    </section>
  );
}
