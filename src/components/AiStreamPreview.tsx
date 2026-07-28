type AiStreamPreviewProps = {
  label: string;
  text: string;
};

export function AiStreamPreview({ label, text }: AiStreamPreviewProps) {
  return (
    <section className="ai-stream-preview" aria-live="polite">
      <p><span className="stream-dot" aria-hidden="true" />{label}</p>
      {text && <pre>{text}</pre>}
    </section>
  );
}
