// src/app/auth/signin/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'react-toastify';

const NEXTAUTH_ERROR_MAP: Record<string, string> = {
  CredentialsSignin: 'Invalid username/email or password.',
  Default: 'Sign-in failed. Please try again.',
};

export default function SignIn() {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const router = useRouter();
  const search = useSearchParams();
  const callbackUrl = search.get('callbackUrl') || '/dashboard';

  useEffect(() => {
    const err = search.get('error');
    if (err) {
      toast.error(NEXTAUTH_ERROR_MAP[err] ?? NEXTAUTH_ERROR_MAP.Default);
    }
  }, [search]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!identifier || !password) {
      toast.error('Please enter your username/email and password.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await signIn('credentials', {
        redirect: false,
        identifier,
        password,
        callbackUrl, // will be used if redirect=true later
      });

      if (res?.error) {
        toast.error(NEXTAUTH_ERROR_MAP[res.error] ?? NEXTAUTH_ERROR_MAP.Default);
        setSubmitting(false);
        return;
      }

      toast.success('Login successful!');
      router.replace(callbackUrl);
    } catch (err: any) {
      toast.error(err?.message || 'Sign-in failed.');
      setSubmitting(false);
    }
  };

  return (
    <div className="form-container" style={{ maxWidth: 420, margin: '48px auto' }}>
      <h2 style={{ marginBottom: 16 }}>Sign In</h2>
      <form onSubmit={handleSubmit}>
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
            style={{ width: '100%', padding: 8 }}
          />
        </div>
        <div className="form-group" style={{ marginBottom: 16 }}>
          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
            disabled={submitting}
            style={{ width: '100%', padding: 8 }}
          />
        </div>
        <button type="submit" className="btn" disabled={submitting} style={{ padding: '10px 14px', width: '100%' }}>
          {submitting ? 'Signing in…' : 'Sign In'}
        </button>
      </form>
    </div>
  );
}
