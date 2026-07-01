import type { ButtonHTMLAttributes, PropsWithChildren } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

export function Button({ children, className, variant = 'primary', ...props }: PropsWithChildren<ButtonProps>) {
  return (
    <button
      className={['ui-button', `ui-button--${variant}`, className].filter(Boolean).join(' ')}
      {...props}
    >
      {children}
    </button>
  );
}
