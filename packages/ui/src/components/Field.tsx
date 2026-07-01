import type { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';

interface FieldProps {
  label: string;
  hint?: string;
  error?: string;
}

export function InputField({
  label,
  hint,
  error,
  ...props
}: FieldProps & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="ui-field">
      <label>{label}</label>
      <input aria-invalid={Boolean(error)} className={['ui-input', error ? 'ui-input--error' : ''].filter(Boolean).join(' ')} {...props} />
      {hint && !error ? <p className="ui-field__hint">{hint}</p> : null}
      {error ? <p className="ui-field__error">{error}</p> : null}
    </div>
  );
}

export function SelectField({
  label,
  hint,
  error,
  children,
  ...props
}: FieldProps & SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="ui-field">
      <label>{label}</label>
      <select aria-invalid={Boolean(error)} className={['ui-select', error ? 'ui-input--error' : ''].filter(Boolean).join(' ')} {...props}>
        {children}
      </select>
      {hint && !error ? <p className="ui-field__hint">{hint}</p> : null}
      {error ? <p className="ui-field__error">{error}</p> : null}
    </div>
  );
}

export function TextareaField({
  label,
  hint,
  error,
  ...props
}: FieldProps & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <div className="ui-field">
      <label>{label}</label>
      <textarea aria-invalid={Boolean(error)} className={['ui-textarea', error ? 'ui-input--error' : ''].filter(Boolean).join(' ')} {...props} />
      {hint && !error ? <p className="ui-field__hint">{hint}</p> : null}
      {error ? <p className="ui-field__error">{error}</p> : null}
    </div>
  );
}
