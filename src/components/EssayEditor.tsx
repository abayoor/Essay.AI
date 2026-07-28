import { useEffect, useRef, useState } from 'react';
import { countWords } from '../lib/essays';

type EssayEditorProps = {
  content: string;
  onSave: (content: string) => Promise<void>;
  onChange: (content: string) => void;
};

export function EssayEditor({ content, onSave, onChange }: EssayEditorProps) {
  const [saveState, setSaveState] = useState<'saved' | 'saving' | 'error'>('saved');
  const lastSavedContent = useRef(content);

  useEffect(() => {
    if (content === lastSavedContent.current) return;
    const timer = window.setTimeout(() => {
      setSaveState('saving');
      void onSave(content)
        .then(() => {
          lastSavedContent.current = content;
          setSaveState('saved');
        })
        .catch(() => setSaveState('error'));
    }, 30000);
    return () => window.clearTimeout(timer);
  }, [content, onSave]);

  function update(value: string) {
    onChange(value);
  }

  async function saveNow() {
    if (content === lastSavedContent.current) return;
    setSaveState('saving');
    try {
      await onSave(content);
      lastSavedContent.current = content;
      setSaveState('saved');
    } catch {
      setSaveState('error');
    }
  }

  const wordCount = countWords(content);
  const status = saveState === 'saving' ? 'Сохраняем…' : saveState === 'error' ? 'Попробовать сохранить' : 'Сохранено';

  return (
    <section className="editor-card">
      <div className="editor-toolbar">
        <span>{wordCount} слов</span>
        <button className="text-button" onClick={() => void saveNow()} disabled={saveState === 'saving'}>{status}</button>
      </div>
      <label className="visually-hidden" htmlFor="essay-content">Текст эссе</label>
      <textarea
        id="essay-content"
        value={content}
        onChange={(event) => update(event.target.value)}
        placeholder="Начни с детали, которую можешь увидеть, услышать или вспомнить только ты…"
      />
    </section>
  );
}
