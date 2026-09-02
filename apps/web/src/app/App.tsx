import { I18nProvider } from './providers/I18nProvider';
import { SessionProvider } from './providers/SessionProvider';
import { ToastProvider } from './providers/ToastProvider';
import { AppRouter } from './router/AppRouter';

export default function App() {
  return (
    <I18nProvider>
      {/* ToastProvider en dista: SessionProvider, misafir sepeti birlesiminde toast gosterebilir. */}
      <ToastProvider>
        <SessionProvider>
          <AppRouter />
        </SessionProvider>
      </ToastProvider>
    </I18nProvider>
  );
}
