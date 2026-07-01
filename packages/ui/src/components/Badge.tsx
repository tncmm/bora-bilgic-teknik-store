import type { HTMLAttributes, PropsWithChildren } from 'react';

export function Badge({ children, className, ...props }: PropsWithChildren<HTMLAttributes<HTMLSpanElement>>) {
  return (
    <span className={['ui-badge', className].filter(Boolean).join(' ')} {...props}>
      {children}
    </span>
  );
}
