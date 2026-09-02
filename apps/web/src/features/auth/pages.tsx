import { Button, InputField } from '@bora/ui';
import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';

import { useSession } from '../../app/providers/SessionProvider';
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
      // Countdown state mirrors an external resend window; reset immediately when it closes.
      // eslint-disable-next-line react-hooks/set-state-in-effect
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
          <div className="detail-chip">Hesap Girişi</div>
          <h1>Hesabınıza giriş yapın</h1>
          <p>Siparişlerinizi takip etmek ve favori ürünlerinizi kaydetmek için giriş yapın.</p>
          <form onSubmit={handleSubmit}>
            <div className="auth-form-grid">
              <div className="full">
                <InputField label="E-posta" onChange={(event) => setEmail(event.target.value)} value={email} />
              </div>
              <div className="full">
                <InputField
                  label="Şifre"
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
                  {countdown > 0 ? `Tekrar gönder (${countdown}s)` : 'Doğrulama e-postasını tekrar gönder'}
                </Button>
              </div>
            )}
            <div className="auth-actions" style={{ marginTop: '1.25rem' }}>
              <Button type="submit">Giriş Yap</Button>
              <Link state={location.state} to="/kayit">
                <Button variant="secondary">Kayıt Ol</Button>
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
            <div className="detail-chip">E-posta Doğrulama</div>
            <h1>Gelen kutunuzu kontrol edin</h1>
            <p>
              {`${registeredEmail} adresine bir doğrulama bağlantısı gönderdik. Hesabınızı aktifleştirmek için e-postadaki bağlantıya tıklayın.`}
            </p>
            <p style={{ fontSize: '0.9rem', color: '#666' }}>
              E-postayı göremiyor musunuz? Spam klasörünüzü de kontrol etmeyi unutmayın.
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
                {countdown > 0 ? `Tekrar gönder (${countdown}s)` : 'Doğrulama e-postasını tekrar gönder'}
              </Button>
              <Link state={location.state} to="/giris">
                <Button variant="secondary">Giriş sayfasına git</Button>
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
          <div className="detail-chip">Kayıt</div>
          <h1>Yeni hesap oluşturun</h1>
          <p>
            Alışverişe başlamak, siparişlerinizi takip etmek ve kampanyalardan haberdar olmak için ücretsiz kayıt olun.
          </p>
          <form onSubmit={handleSubmit}>
            <div className="auth-form-grid">
              <InputField
                error={fieldErrors.firstName}
                label="Ad"
                onChange={(event) => setForm((value) => ({ ...value, firstName: event.target.value }))}
                value={form.firstName}
              />
              <InputField
                error={fieldErrors.lastName}
                label="Soyad"
                onChange={(event) => setForm((value) => ({ ...value, lastName: event.target.value }))}
                value={form.lastName}
              />
              <div className="full">
                <InputField
                  error={fieldErrors.email}
                  label="E-posta"
                  onChange={(event) => setForm((value) => ({ ...value, email: event.target.value }))}
                  value={form.email}
                />
              </div>
              <div className="full">
                <InputField
                  error={fieldErrors.password}
                  hint="En az 8 karakter olmalı."
                  label="Şifre"
                  onChange={(event) => setForm((value) => ({ ...value, password: event.target.value }))}
                  type="password"
                  value={form.password}
                />
              </div>
            </div>
            {error ? <p className="form-feedback form-feedback--error">{error}</p> : null}
            <div className="auth-actions" style={{ marginTop: '1.25rem' }}>
              <Button type="submit">Hesap Oluştur</Button>
              <Link state={location.state} to="/giris">
                <Button variant="secondary">Giriş</Button>
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

  // Navigate after a brief moment so user sees the success message.
  useEffect(() => {
    if (status !== 'success') return;
    const timer = window.setTimeout(() => navigate('/', { replace: true }), 1500);
    return () => window.clearTimeout(timer);
  }, [navigate, status]);

  if (status === 'loading') {
    return (
      <section className="auth-shell">
        <div className="ui-shell">
          <div className="auth-card">
            <h1>E-posta doğrulanıyor…</h1>
            <p>Lütfen bekleyin.</p>
          </div>
        </div>
      </section>
    );
  }

  if (status === 'success') {
    return (
      <section className="auth-shell">
        <div className="ui-shell">
          <div className="auth-card">
            <h1>E-postanız doğrulandı!</h1>
            <p>Hesabınız başarıyla aktifleştirildi. Ana sayfaya yönlendiriliyorsunuz.</p>
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
          <h1>Doğrulama başarısız</h1>
          <p className="form-feedback form-feedback--error">{errorMessage}</p>
          <div style={{ marginTop: '1rem' }}>
            <InputField
              label="E-posta adresiniz"
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
              {countdown > 0 ? `Tekrar gönder (${countdown}s)` : 'Doğrulama e-postasını tekrar gönder'}
            </Button>
          </div>
          <div className="auth-actions" style={{ marginTop: '1.25rem' }}>
            <Link to="/giris">
              <Button variant="secondary">Giriş sayfasına git</Button>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
