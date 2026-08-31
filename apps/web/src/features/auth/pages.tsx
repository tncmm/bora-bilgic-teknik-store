import { Button, InputField } from '@bora/ui';
import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';

import { useSession } from '../../app/providers/SessionProvider';
import { useI18n } from '../../app/providers/I18nProvider';
import { api, ApiError } from '../../shared/api/client';

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

function useCountdown(seconds: number, active: boolean) {
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    if (!active) {
      setRemaining(0);
      return;
    }
    setRemaining(seconds);
    const id = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(id);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [active, seconds]);

  return remaining;
}

export function LoginPage() {
  const { login } = useSession();
  const { language } = useI18n();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isUnverified, setIsUnverified] = useState(false);
  const [resendTriggered, setResendTriggered] = useState(false);
  const [resendMessage, setResendMessage] = useState<string | null>(null);
  const [resendError, setResendError] = useState<string | null>(null);

  const cooldownActive = resendTriggered && resendMessage !== null;
  const countdown = useCountdown(60, cooldownActive);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsUnverified(false);
    setResendMessage(null);
    setResendError(null);
    try {
      await login({ email, password });
      navigate(resolveAuthReturnPath(location.state), { replace: true });
    } catch (nextError) {
      const msg = (nextError as Error).message;
      setError(msg);
      if (
        nextError instanceof ApiError &&
        nextError.status === 403
      ) {
        setIsUnverified(true);
      }
    }
  }

  async function handleResend() {
    setResendMessage(null);
    setResendError(null);
    try {
      const result = await api.resendVerification(email);
      setResendMessage(result.message);
      setResendTriggered(true);
    } catch (err) {
      setResendError((err as Error).message);
    }
  }

  return (
    <section className="auth-shell">
      <div className="ui-shell">
        <div className="auth-card">
          <div className="detail-chip">{language === 'tr' ? 'Hesap Girişi' : 'Account Login'}</div>
          <h1>{language === 'tr' ? 'Hesabınıza giriş yapın' : 'Log in to your account'}</h1>
          <p>
            {language === 'tr'
              ? 'Siparişlerinizi takip etmek ve favori ürünlerinizi kaydetmek için giriş yapın.'
              : 'Sign in to track your orders and save your favorite products.'}
          </p>
          <form onSubmit={handleSubmit}>
            <div className="auth-form-grid">
              <div className="full">
                <InputField label={language === 'tr' ? 'E-posta' : 'Email'} onChange={(event) => setEmail(event.target.value)} value={email} />
              </div>
              <div className="full">
                <InputField
                  label={language === 'tr' ? 'Şifre' : 'Password'}
                  onChange={(event) => setPassword(event.target.value)}
                  type="password"
                  value={password}
                />
              </div>
            </div>
            {error ? <p className="form-feedback form-feedback--error">{error}</p> : null}
            {isUnverified && (
              <div style={{ marginTop: '0.75rem' }}>
                {resendMessage ? (
                  <p className="form-feedback form-feedback--success">{resendMessage}</p>
                ) : resendError ? (
                  <p className="form-feedback form-feedback--error">{resendError}</p>
                ) : null}
                <Button
                  type="button"
                  variant="secondary"
                  onClick={handleResend}
                  disabled={countdown > 0}
                  style={{ marginTop: '0.5rem', width: '100%' }}
                >
                  {countdown > 0
                    ? `${language === 'tr' ? 'Tekrar gönder' : 'Resend'} (${countdown}s)`
                    : language === 'tr'
                      ? 'Doğrulama e-postasını tekrar gönder'
                      : 'Resend verification email'}
                </Button>
              </div>
            )}
            <div className="auth-actions" style={{ marginTop: '1.25rem' }}>
              <Button type="submit">{language === 'tr' ? 'Giriş Yap' : 'Log In'}</Button>
              <Link state={location.state} to="/kayit">
                <Button variant="secondary">{language === 'tr' ? 'Kayıt Ol' : 'Register'}</Button>
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
  const location = useLocation();
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<RegisterFieldErrors>({});
  const [registeredEmail, setRegisteredEmail] = useState<string | null>(null);
  const [resendMessage, setResendMessage] = useState<string | null>(null);
  const [resendError, setResendError] = useState<string | null>(null);
  const [resendTriggered, setResendTriggered] = useState(false);

  const cooldownActive = resendTriggered && resendMessage !== null;
  const countdown = useCountdown(60, cooldownActive);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setFieldErrors({});

    try {
      await register(form);
      setRegisteredEmail(form.email);
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

  async function handleResend() {
    if (!registeredEmail) return;
    setResendMessage(null);
    setResendError(null);
    try {
      const result = await api.resendVerification(registeredEmail);
      setResendMessage(result.message);
      setResendTriggered(true);
    } catch (err) {
      setResendError((err as Error).message);
    }
  }

  if (registeredEmail) {
    return (
      <section className="auth-shell">
        <div className="ui-shell">
          <div className="auth-card">
            <div className="detail-chip">{language === 'tr' ? 'E-posta Doğrulama' : 'Email Verification'}</div>
            <h1>{language === 'tr' ? 'Gelen kutunuzu kontrol edin' : 'Check your inbox'}</h1>
            <p>
              {language === 'tr'
                ? `${registeredEmail} adresine bir doğrulama bağlantısı gönderdik. Hesabınızı aktifleştirmek için e-postadaki bağlantıya tıklayın.`
                : `We sent a verification link to ${registeredEmail}. Click the link in the email to activate your account.`}
            </p>
            <p style={{ fontSize: '0.9rem', color: '#666' }}>
              {language === 'tr'
                ? 'E-postayı göremiyor musunuz? Spam klasörünüzü de kontrol etmeyi unutmayın.'
                : "Can't see the email? Don't forget to check your spam folder."}
            </p>
            {resendMessage ? (
              <p className="form-feedback form-feedback--success">{resendMessage}</p>
            ) : resendError ? (
              <p className="form-feedback form-feedback--error">{resendError}</p>
            ) : null}
            <div className="auth-actions" style={{ marginTop: '1.25rem' }}>
              <Button
                type="button"
                variant="secondary"
                onClick={handleResend}
                disabled={countdown > 0}
              >
                {countdown > 0
                  ? `${language === 'tr' ? 'Tekrar gönder' : 'Resend'} (${countdown}s)`
                  : language === 'tr'
                    ? 'Doğrulama e-postasını tekrar gönder'
                    : 'Resend verification email'}
              </Button>
              <Link state={location.state} to="/giris">
                <Button variant="secondary">{language === 'tr' ? 'Giriş sayfasına git' : 'Go to login'}</Button>
              </Link>
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="auth-shell">
      <div className="ui-shell">
        <div className="auth-card">
          <div className="detail-chip">{language === 'tr' ? 'Kayıt' : 'Register'}</div>
          <h1>{language === 'tr' ? 'Yeni hesap oluşturun' : 'Create a new account'}</h1>
          <p>
            {language === 'tr'
              ? 'Alışverişe başlamak, siparişlerinizi takip etmek ve kampanyalardan haberdar olmak için ücretsiz kayıt olun.'
              : 'Sign up for free to start shopping, track your orders, and stay updated on campaigns.'}
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
                  hint={language === 'tr' ? 'En az 8 karakter olmalı.' : 'Must be at least 8 characters.'}
                  label={language === 'tr' ? 'Şifre' : 'Password'}
                  onChange={(event) => setForm((value) => ({ ...value, password: event.target.value }))}
                  type="password"
                  value={form.password}
                />
              </div>
            </div>
            {error ? <p className="form-feedback form-feedback--error">{error}</p> : null}
            <div className="auth-actions" style={{ marginTop: '1.25rem' }}>
              <Button type="submit">{language === 'tr' ? 'Hesap Oluştur' : 'Create Account'}</Button>
              <Link state={location.state} to="/giris">
                <Button variant="secondary">{language === 'tr' ? 'Giriş' : 'Login'}</Button>
              </Link>
            </div>
          </form>
        </div>
      </div>
    </section>
  );
}

export function VerifyEmailPage() {
  const { applyAuthResponse } = useSession();
  const { language } = useI18n();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const [resendEmail, setResendEmail] = useState('');
  const [resendMessage, setResendMessage] = useState<string | null>(null);
  const [resendError, setResendError] = useState<string | null>(null);
  const [resendTriggered, setResendTriggered] = useState(false);

  const ran = useRef(false);

  const cooldownActive = resendTriggered && resendMessage !== null;
  const countdown = useCountdown(60, cooldownActive);

  useEffect(() => {
    if (!token || ran.current) return;
    ran.current = true;

    (async () => {
      try {
        const response = await api.verifyEmail(token);
        applyAuthResponse(response);
        setStatus('success');
      } catch (err) {
        setErrorMessage((err as Error).message);
        setStatus('error');
      }
    })();
  }, [token, applyAuthResponse]);

  async function handleResend() {
    if (!resendEmail) return;
    setResendMessage(null);
    setResendError(null);
    try {
      const result = await api.resendVerification(resendEmail);
      setResendMessage(result.message);
      setResendTriggered(true);
    } catch (err) {
      setResendError((err as Error).message);
    }
  }

  if (status === 'loading') {
    return (
      <section className="auth-shell">
        <div className="ui-shell">
          <div className="auth-card">
            <h1>{language === 'tr' ? 'E-posta doğrulanıyor…' : 'Verifying your email…'}</h1>
            <p>{language === 'tr' ? 'Lütfen bekleyin.' : 'Please wait.'}</p>
          </div>
        </div>
      </section>
    );
  }

  if (status === 'success') {
    // Navigate after a brief moment so user sees the success message.
    setTimeout(() => navigate('/', { replace: true }), 1500);
    return (
      <section className="auth-shell">
        <div className="ui-shell">
          <div className="auth-card">
            <h1>{language === 'tr' ? 'E-postanız doğrulandı!' : 'Email verified!'}</h1>
            <p>
              {language === 'tr'
                ? 'Hesabınız başarıyla aktifleştirildi. Ana sayfaya yönlendiriliyorsunuz.'
                : 'Your account has been activated. Redirecting to the homepage.'}
            </p>
          </div>
        </div>
      </section>
    );
  }

  // error state
  return (
    <section className="auth-shell">
      <div className="ui-shell">
        <div className="auth-card">
          <h1>{language === 'tr' ? 'Doğrulama başarısız' : 'Verification failed'}</h1>
          <p className="form-feedback form-feedback--error">{errorMessage}</p>
          <div style={{ marginTop: '1rem' }}>
            <InputField
              label={language === 'tr' ? 'E-posta adresiniz' : 'Your email address'}
              value={resendEmail}
              onChange={(event) => setResendEmail(event.target.value)}
            />
            {resendMessage ? (
              <p className="form-feedback form-feedback--success" style={{ marginTop: '0.5rem' }}>{resendMessage}</p>
            ) : resendError ? (
              <p className="form-feedback form-feedback--error" style={{ marginTop: '0.5rem' }}>{resendError}</p>
            ) : null}
            <Button
              type="button"
              variant="secondary"
              onClick={handleResend}
              disabled={countdown > 0 || !resendEmail}
              style={{ marginTop: '0.5rem', width: '100%' }}
            >
              {countdown > 0
                ? `${language === 'tr' ? 'Tekrar gönder' : 'Resend'} (${countdown}s)`
                : language === 'tr'
                  ? 'Doğrulama e-postasını tekrar gönder'
                  : 'Resend verification email'}
            </Button>
          </div>
          <div className="auth-actions" style={{ marginTop: '1.25rem' }}>
            <Link to="/giris">
              <Button variant="secondary">{language === 'tr' ? 'Giriş sayfasına git' : 'Go to login'}</Button>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
