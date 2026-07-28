import type { PersonaFeedback } from '../lib/models';

const readers: Array<{ key: keyof PersonaFeedback; title: string; description: string }> = [
  { key: 'strict_formalist', title: 'Строгий формалист', description: 'Форма и требования' },
  { key: 'empathetic_reader', title: 'Эмпатичный читатель', description: 'Эмоциональный отклик' },
  { key: 'pragmatic_reviewer', title: 'Прагматичный читатель', description: 'Вклад в кампус' },
];

export function PersonaFeedbackCards({ feedback }: { feedback: PersonaFeedback }) {
  return (
    <section className="persona-feedback" aria-labelledby="personas-title">
      <div><p className="eyebrow">Три взгляда</p><h2 id="personas-title">Как текст могут прочитать</h2></div>
      <div className="persona-grid">
        {readers.map((reader) => (
          <article className="persona-card" key={reader.key}>
            <p className="eyebrow">{reader.description}</p>
            <h3>{reader.title}</h3>
            <p>{feedback[reader.key]}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
