type EssayProgressProps = {
  draftReady: boolean;
  feedbackReady: boolean;
  personasReady: boolean;
  overlapChecked: boolean;
  interviewReady: boolean;
};

export function EssayProgress({
  draftReady, feedbackReady, personasReady, overlapChecked, interviewReady,
}: EssayProgressProps) {
  const steps = [
    { label: 'Черновик', complete: draftReady },
    { label: 'ИИ-фидбэк', complete: feedbackReady },
    { label: 'Три читателя', complete: personasReady },
    { label: 'Свои пересечения', complete: overlapChecked },
    { label: 'Мок-интервью', complete: interviewReady },
  ];

  return (
    <ol className="essay-progress" aria-label="Путь работы над эссе">
      {steps.map((step) => (
        <li className={step.complete ? 'complete' : ''} key={step.label}>
          <span aria-hidden="true">{step.complete ? '✓' : '○'}</span>{step.label}
        </li>
      ))}
    </ol>
  );
}
