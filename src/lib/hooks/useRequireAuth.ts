// src/lib/hooks/useRequireAuth.ts
'use client';

import { useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { usePathname, useRouter } from 'next/navigation';

export function useRequireAuth(redirectTo = '/auth/signin') {
  const { data: session, status } = useSession();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (status === 'unauthenticated') {
      const url = `${redirectTo}?callbackUrl=${encodeURIComponent(pathname || '/')}`;
      router.replace(url);
    }
  }, [status, redirectTo, pathname, router]);

  return {
    session,
    status,
    isLoading: status === 'loading',
    isAuthenticated: status === 'authenticated',
  };
}
