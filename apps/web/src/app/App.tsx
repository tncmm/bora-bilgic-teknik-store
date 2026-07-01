import { I18nProvider } from './providers/I18nProvider';
import { SessionProvider } from './providers/SessionProvider';
import { ToastProvider } from './providers/ToastProvider';
import { AppRouter } from './router/AppRouter';

export default function App() {
  return (
    <I18nProvider>
      <SessionProvider>
        <ToastProvider>
          <AppRouter />
        </ToastProvider>
      </SessionProvider>
    </I18nProvider>
  );
}
