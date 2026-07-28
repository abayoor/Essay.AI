type InterviewQuestionCardProps = {
  question: string;
  category: string;
  value: string;
  questionNumber: number;
  total: number;
  onChange: (value: string) => void;
  onNext: () => void;
  isLast: boolean;
};

export function InterviewQuestionCard({
  question, category, value, questionNumber, total, onChange, onNext, isLast,
}: InterviewQuestionCardProps) {
  return (
    <section className="interview-card">
      <p className="eyebrow">Вопрос {questionNumber} из {total}</p>
      <span className="interview-category">{category}</span>
      <h2>{question}</h2>
      <label className="visually-hidden" htmlFor="interview-answer">Твой ответ</label>
      <textarea id="interview-answer" value={value} onChange={(event) => onChange(event.target.value)} placeholder="Ответь так, как рассказал(а) бы это живому человеку…" />
      {!isLast && <button onClick={onNext}>Следующий вопрос</button>}
    </section>
  );
}
