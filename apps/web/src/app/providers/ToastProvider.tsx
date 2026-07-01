import { createContext, useContext, useMemo, useState } from 'react';

type ToastTone = 'success' | 'error' | 'info';

interface ToastInput {
  title: string;
  description?: string;
  tone?: ToastTone;
}

interface ToastRecord extends ToastInput {
  id: number;
  tone: ToastTone;
}

interface ToastContextValue {
  showToast: (toast: ToastInput) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastRecord[]>([]);

  function showToast({ tone = 'info', ...toast }: ToastInput) {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    const nextToast: ToastRecord = {
      id,
      tone,
      ...toast,
    };

    setToasts((current) => [...current, nextToast]);

    window.setTimeout(() => {
      setToasts((current) => current.filter((item) => item.id !== id));
    }, 3200);
  }

  const value = useMemo<ToastContextValue>(
    () => ({
      showToast,
    }),
    [],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div aria-live="polite" className="toast-stack">
        {toasts.map((toast) => (
          <div className={`toast toast--${toast.tone}`} key={toast.id} role="status">
            <strong>{toast.title}</strong>
            {toast.description ? <p>{toast.description}</p> : null}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);

  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }

  return context;
}
