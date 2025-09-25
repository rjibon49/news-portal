// src/app/(dashboard)/dashboard/page.tsx
'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { signOut } from 'next-auth/react';
import { toast } from 'react-toastify';
import { useRequireAuth } from '@/lib/hooks/useRequireAuth';

export default function Dashboard() {
  const { session, isLoading, isAuthenticated } = useRequireAuth();
  const router = useRouter();

  const handleSignOut = async () => {
    try {
      await signOut({ redirect: false });
      toast.success('Signed out');
      router.replace('/');
    } catch {
      toast.error('Sign out failed');
    }
  };

  if (isLoading) return <div className="container">Loading...</div>;
  if (!isAuthenticated) return null;

  return (
    <div className="container">
      <nav
        className="navbar"
        style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 16 }}
      >
        <Link href="/">Home</Link>
        <Link href="/dashboard">Dashboard</Link>
        <Link href="/dashboard/post/new">Add Post</Link>
        <Link href="/dashboard/category">Categories</Link>
        <span style={{ marginLeft: 'auto', opacity: 0.8 }}>
          Signed in as {session?.user?.username || session?.user?.email}
        </span>
        <button className="btn" onClick={handleSignOut}>
          Sign Out
        </button>
      </nav>

      {/* dashboard content goes here */}
    </div>
  );
}
