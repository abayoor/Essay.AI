import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Smile } from 'lucide-react';
import { useLocaleText } from '../lib/localized';

const emojis = ['😀', '🥹', '😎', '🤩', '😂', '😍', '🔥', '👏', '💚', '🚲', '⚡️', '🏔️', '🌿', '☀️', '🎉', '💪', '🙌', '🤝', '❤️', '✨'];

type EmojiPickerProps = {
  onPick: (emoji: string) => void;
  className?: string;
  label?: string;
};

export function EmojiPicker({ onPick, className = '', label }: EmojiPickerProps) {
  const text = useLocaleText();
  const pickerLabel = label || text('Добавить эмодзи', 'Эмодзи қосу', 'Add emoji');
  const [open, setOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function closeOnOutsidePress(event: MouseEvent) {
      if (!pickerRef.current?.contains(event.target as Node)) setOpen(false);
    }

    if (open) document.addEventListener('mousedown', closeOnOutsidePress);
    return () => document.removeEventListener('mousedown', closeOnOutsidePress);
  }, [open]);

  return <div className={`emoji-picker ${className}`} ref={pickerRef}>
    <button type="button" className="emoji-trigger" aria-label={pickerLabel} title={pickerLabel} aria-expanded={open} onClick={() => setOpen((current) => !current)}>
      <Smile size={19} aria-hidden="true" />
    </button>
    <AnimatePresence>
      {open && <motion.div className="emoji-popover" role="dialog" aria-label={text('Выбор эмодзи', 'Эмодзи таңдау', 'Emoji picker')} initial={{ opacity: 0, y: 8, scale: .96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 6, scale: .96 }} transition={{ duration: .16 }}>
        <p>{text('Добавить настроение', 'Көңіл күй қосу', 'Add a mood')}</p>
        <div className="emoji-grid">{emojis.map((emoji) => <button type="button" key={emoji} onClick={() => { onPick(emoji); setOpen(false); }} aria-label={`${text('Добавить', 'Қосу', 'Add')} ${emoji}`}>{emoji}</button>)}</div>
      </motion.div>}
    </AnimatePresence>
  </div>;
}
