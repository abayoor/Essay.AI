import { Link } from 'wouter';
import type { EssaySummary } from '../lib/models';

const statusLabels: Record<EssaySummary['status'], string> = {
  draft: 'Черновик',
  in_review: 'На проверке',
  final: 'Финал',
  submitted: 'Отправлено',
};

export function EssayCard({ essay }: { essay: EssaySummary }) {
  const updated = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long' }).format(new Date(essay.updated_at));
  return (
    <Link href={'/essays/' + essay.id + '/edit'} className="essay-card">
      <div>
        <span className={'status status-' + essay.status}>{statusLabels[essay.status]}</span>
        <h2>{essay.title}</h2>
        <p>{essay.target_school || 'Школа пока не выбрана'}</p>
      </div>
      <span className="essay-date">Изменено {updated}</span>
    </Link>
  );
}
