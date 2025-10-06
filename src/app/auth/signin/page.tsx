// src/app/auth/signin/page.tsx
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { signIn, useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'react-toastify';

const NEXTAUTH_ERROR_MAP: Record<string, string> = {
  CredentialsSignin: 'Invalid username/email or password.',
  AccessDenied: 'Access denied.',
  OAuthSignin: 'Sign-in failed. Please try again.',
  OAuthCallback: 'Could not complete sign-in.',
  OAuthCreateAccount: 'Could not create account.',
  EmailCreateAccount: 'Could not create account with email.',
  Callback: 'Unexpected callback error.',
  OAuthAccountNotLinked: 'Account not linked.',
  EmailSignin: 'Email sign-in failed.',
  SessionRequired: 'Please sign in to continue.',
  Default: 'Sign-in failed. Please try again.',
};

// ─────────────────────────────────────────────────────────────────────────────
// helper: ensure callbackUrl is an internal path (prevent open-redirect)
// - allow: "/path", "/path?x=y"
// - otherwise fallback to "/dashboard"
// ─────────────────────────────────────────────────────────────────────────────
function sanitizeCallbackUrl(raw: string | null, fallback = '/dashboard') {
  if (!raw) return fallback;
  try {
    // external absolute URLs → block
    if (/^https?:\/\//i.test(raw)) return fallback;
    // ensure leading slash
    const path = raw.startsWith('/') ? raw : `/${raw}`;
    return path;
  } catch {
    return fallback;
  }
}

export default function SignIn() {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const router = useRouter();
  const search = useSearchParams();
  const { status } = useSession(); // for auto-redirect if already logged in

  // compute a sanitized callbackUrl once
  const callbackUrl = useMemo(
    () => sanitizeCallbackUrl(search.get('callbackUrl')),
    [search]
  );

  // ── toast guard so the same error doesn't spam
  const toastsShown = useRef<string | null>(null);

  // show next-auth error (from query ?error=...)
  useEffect(() => {
    const err = search.get('error');
    if (err && toastsShown.current !== err) {
      toastsShown.current = err;
      toast.error(NEXTAUTH_ERROR_MAP[err] ?? NEXTAUTH_ERROR_MAP.Default);
    }
  }, [search]);

  // already authenticated? redirect to callbackUrl
  useEffect(() => {
    if (status === 'authenticated') {
      router.replace(callbackUrl);
    }
  }, [status, callbackUrl, router]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!identifier || !password) {
      toast.error('Please enter your username/email and password.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await signIn('credentials', {
        redirect: false, // we will route ourselves
        identifier,
        password,
        // callbackUrl not used by redirect:false, but we keep for parity
        callbackUrl,
      });

      if (res?.error) {
        toast.error(NEXTAUTH_ERROR_MAP[res.error] ?? NEXTAUTH_ERROR_MAP.Default);
        setSubmitting(false);
        return;
        // res.ok can be false without error in some edge cases; treat as success if no error
      }

      toast.success('Login successful!');
      router.replace(callbackUrl);
    } catch (err: any) {
      toast.error(err?.message || 'Sign-in failed.');
      setSubmitting(false);
    }
  }

  return (
    <div className="form-container" style={{ maxWidth: 440, margin: '48px auto' }}>
      <h2 style={{ marginBottom: 12 }}>Sign In</h2>
      {/* INFO: If you use a global layout, you can center via container classes instead of inline styles */}

      <form onSubmit={handleSubmit} noValidate>
        {/* ── Username / Email */}
        <div className="form-group" style={{ marginBottom: 12 }}>
          <label htmlFor="identifier">Username or Email</label>
          <input
            id="identifier"
            type="text"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            required
            autoComplete="username"
            disabled={submitting}
            autoFocus
            aria-required="true"
            style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #ddd' }}
          />
        </div>

        {/* ── Password + show/hide toggle */}
        <div className="form-group" style={{ marginBottom: 16 }}>
          <label htmlFor="password" style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Password</span>
            <button
              type="button"
              onClick={() => setShowPw((s) => !s)}
              className="text-sm"
              aria-pressed={showPw}
              style={{ background: 'none', border: 0, color: '#2563eb', cursor: 'pointer' }}
              disabled={submitting}
            >
              {showPw ? 'Hide' : 'Show'}
            </button>
          </label>
          <input
            id="password"
            type={showPw ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
            disabled={submitting}
            aria-required="true"
            style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #ddd' }}
          />
        </div>

        {/* ── Submit */}
        <button
          type="submit"
          className="btn"
          disabled={submitting}
          aria-busy={submitting}
          style={{
            padding: '12px 14px',
            width: '100%',
            borderRadius: 8,
            background: submitting ? '#9ca3af' : '#111827',
            color: '#fff',
          }}
        >
          {submitting ? 'Signing in…' : 'Sign In'}
        </button>

        {/* ── subtle helper */}
        <p style={{ marginTop: 10, fontSize: 12, color: '#6b7280' }}>
          You’ll be signed out automatically after 24 hours for security.
        </p>
      </form>
    </div>
  );
}
