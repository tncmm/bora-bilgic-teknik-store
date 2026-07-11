import { Button, InputField } from '@bora/ui';
import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';

import { useSession } from '../../app/providers/SessionProvider';
import { useI18n } from '../../app/providers/I18nProvider';
import { ApiError } from '../../shared/api/client';

interface RegisterFieldErrors {
  firstName?: string;
  lastName?: string;
  email?: string;
  password?: string;
}

function resolveAuthReturnPath(state: unknown) {
  if (!state || typeof state !== 'object') return '/profil';
  const from = 'from' in state ? state.from : null;
  return typeof from === 'string' && from.length > 0 ? from : '/profil';
}

export function LoginPage() {
  const { login } = useSession();
  const { language } = useI18n();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('admin@borabilgicteknik.com');
  const [password, setPassword] = useState('Password123!');
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    try {
      await login({ email, password });
      navigate(resolveAuthReturnPath(location.state), { replace: true });
    } catch (nextError) {
      setError((nextError as Error).message);
    }
  }

  return (
    <section className="auth-shell">
      <div className="ui-shell">
        <div className="auth-card">
          <div className="detail-chip">System Access</div>
          <h1>{language === 'tr' ? 'Teknik kontrol katmanina giris yapin.' : 'Log in to the technical control layer.'}</h1>
          <p>{language === 'tr' ? 'Demo admin: admin@borabilgicteknik.com / Password123!' : 'Demo admin: admin@borabilgicteknik.com / Password123!'}</p>
          <form onSubmit={handleSubmit}>
            <div className="auth-form-grid">
              <div className="full">
                <InputField label={language === 'tr' ? 'E-posta' : 'Email'} onChange={(event) => setEmail(event.target.value)} value={email} />
              </div>
              <div className="full">
                <InputField
                  label={language === 'tr' ? 'Sifre' : 'Password'}
                  onChange={(event) => setPassword(event.target.value)}
                  type="password"
                  value={password}
                />
              </div>
            </div>
            {error ? <p className="form-feedback form-feedback--error">{error}</p> : null}
            <div className="auth-actions" style={{ marginTop: '1.25rem' }}>
              <Button type="submit">{language === 'tr' ? 'Giris Yap' : 'Log In'}</Button>
              <Link state={location.state} to="/kayit">
                <Button variant="secondary">{language === 'tr' ? 'Kayit Ol' : 'Register'}</Button>
              </Link>
            </div>
          </form>
        </div>
      </div>
    </section>
  );
}

export function RegisterPage() {
  const { register } = useSession();
  const { language } = useI18n();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<RegisterFieldErrors>({});

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setFieldErrors({});

    try {
      await register(form);
      navigate(resolveAuthReturnPath(location.state), { replace: true });
    } catch (nextError) {
      if (nextError instanceof ApiError) {
        const nextFieldErrors = {
          firstName: nextError.fieldErrors?.firstName?.[0],
          lastName: nextError.fieldErrors?.lastName?.[0],
          email: nextError.fieldErrors?.email?.[0],
          password: nextError.fieldErrors?.password?.[0],
        };

        const hasFieldError = Object.values(nextFieldErrors).some(Boolean);
        setError(hasFieldError ? null : nextError.message);
        setFieldErrors({
          firstName: nextFieldErrors.firstName,
          lastName: nextFieldErrors.lastName,
          email: nextFieldErrors.email,
          password: nextFieldErrors.password,
        });
        return;
      }

      setError((nextError as Error).message);
    }
  }

  return (
    <section className="auth-shell">
      <div className="ui-shell">
        <div className="auth-card">
          <div className="detail-chip">{language === 'tr' ? 'Kayit' : 'Register'}</div>
          <h1>{language === 'tr' ? 'Kontrollu bir musteri hesabi olusturun.' : 'Create a controlled buyer account.'}</h1>
          <p>
            {language === 'tr'
              ? 'Mock dataset icindeki siparis akislarini test etmek icin yeni musteri hesabi olusturabilirsiniz.'
              : 'Create a new customer account to test order flows from the mock dataset.'}
          </p>
          <form onSubmit={handleSubmit}>
            <div className="auth-form-grid">
              <InputField
                error={fieldErrors.firstName}
                label={language === 'tr' ? 'Ad' : 'First Name'}
                onChange={(event) => setForm((value) => ({ ...value, firstName: event.target.value }))}
                value={form.firstName}
              />
              <InputField
                error={fieldErrors.lastName}
                label={language === 'tr' ? 'Soyad' : 'Last Name'}
                onChange={(event) => setForm((value) => ({ ...value, lastName: event.target.value }))}
                value={form.lastName}
              />
              <div className="full">
                <InputField
                  error={fieldErrors.email}
                  label={language === 'tr' ? 'E-posta' : 'Email'}
                  onChange={(event) => setForm((value) => ({ ...value, email: event.target.value }))}
                  value={form.email}
                />
              </div>
              <div className="full">
                <InputField
                  error={fieldErrors.password}
                  hint={language === 'tr' ? 'En az 8 karakter olmali.' : 'Must be at least 8 characters.'}
                  label={language === 'tr' ? 'Sifre' : 'Password'}
                  onChange={(event) => setForm((value) => ({ ...value, password: event.target.value }))}
                  type="password"
                  value={form.password}
                />
              </div>
            </div>
            {error ? <p className="form-feedback form-feedback--error">{error}</p> : null}
            <div className="auth-actions" style={{ marginTop: '1.25rem' }}>
              <Button type="submit">{language === 'tr' ? 'Hesap Olustur' : 'Create Account'}</Button>
              <Link state={location.state} to="/giris">
                <Button variant="secondary">{language === 'tr' ? 'Giris' : 'Login'}</Button>
              </Link>
            </div>
          </form>
        </div>
      </div>
    </section>
  );
}
