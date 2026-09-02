import type { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';
import { useId } from 'react';

interface FieldProps {
  label: string;
  hint?: string;
  error?: string;
}

function useFieldIds(explicitId?: string) {
  const autoId = useId();
  const fieldId = explicitId ?? autoId;
  return { fieldId, hintId: `${fieldId}-hint`, errorId: `${fieldId}-error` };
}

export function InputField({
  label,
  hint,
  error,
  id,
  ...props
}: FieldProps & InputHTMLAttributes<HTMLInputElement>) {
  const { fieldId, hintId, errorId } = useFieldIds(id);
  return (
    <div className="ui-field">
      <label htmlFor={fieldId}>{label}</label>
      <input aria-describedby={error ? errorId : hint ? hintId : undefined} aria-invalid={Boolean(error)} className={['ui-input', error ? 'ui-input--error' : ''].filter(Boolean).join(' ')} id={fieldId} {...props} />
      {hint && !error ? <p className="ui-field__hint" id={hintId}>{hint}</p> : null}
      {error ? <p className="ui-field__error" id={errorId}>{error}</p> : null}
    </div>
  );
}

export function SelectField({
  label,
  hint,
  error,
  children,
  id,
  ...props
}: FieldProps & SelectHTMLAttributes<HTMLSelectElement>) {
  const { fieldId, hintId, errorId } = useFieldIds(id);
  return (
    <div className="ui-field">
      <label htmlFor={fieldId}>{label}</label>
      <select aria-describedby={error ? errorId : hint ? hintId : undefined} aria-invalid={Boolean(error)} className={['ui-select', error ? 'ui-input--error' : ''].filter(Boolean).join(' ')} id={fieldId} {...props}>
        {children}
      </select>
      {hint && !error ? <p className="ui-field__hint" id={hintId}>{hint}</p> : null}
      {error ? <p className="ui-field__error" id={errorId}>{error}</p> : null}
    </div>
  );
}

export function TextareaField({
  label,
  hint,
  error,
  id,
  ...props
}: FieldProps & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const { fieldId, hintId, errorId } = useFieldIds(id);
  return (
    <div className="ui-field">
      <label htmlFor={fieldId}>{label}</label>
      <textarea aria-describedby={error ? errorId : hint ? hintId : undefined} aria-invalid={Boolean(error)} className={['ui-textarea', error ? 'ui-input--error' : ''].filter(Boolean).join(' ')} id={fieldId} {...props} />
      {hint && !error ? <p className="ui-field__hint" id={hintId}>{hint}</p> : null}
      {error ? <p className="ui-field__error" id={errorId}>{error}</p> : null}
    </div>
  );
}
