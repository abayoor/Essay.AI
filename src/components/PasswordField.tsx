import { useState, type ChangeEventHandler } from 'react';

type PasswordFieldProps = {
  value: string;
  onChange: ChangeEventHandler<HTMLInputElement>;
};

export function PasswordField({ value, onChange }: PasswordFieldProps) {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <label>
      Пароль
      <span className="password-input">
        <input type={isVisible ? 'text' : 'password'} minLength={8} value={value} onChange={onChange} required />
        <button type="button" className="password-toggle" onClick={() => setIsVisible((visible) => !visible)} aria-label={isVisible ? 'Скрыть пароль' : 'Показать пароль'}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M2.5 12s3.4-5.5 9.5-5.5 9.5 5.5 9.5 5.5-3.4 5.5-9.5 5.5S2.5 12 2.5 12Z" />
            <circle cx="12" cy="12" r="2.5" />
            {!isVisible && <path d="m4 4 16 16" />}
          </svg>
        </button>
      </span>
    </label>
  );
}
