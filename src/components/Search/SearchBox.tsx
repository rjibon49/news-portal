// src/components/Search/SearchBoc.tsx

'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import s from './SearchBox.module.css';

export default function SearchBox({ className }: { className?: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const [q, setQ] = useState('');

  // keep input synced with current URL (?q=)
  useEffect(() => {
    setQ(params.get('q') ?? '');
  }, [params]);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const term = q.trim();
    if (!term) return;
    router.push(`/search?q=${encodeURIComponent(term)}`);
  }

  return (
    <form onSubmit={onSubmit} className={`${s.search} ${className ?? ''}`} role="search">
      <input
        className={s.input}
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="খোঁজ করুন…"
        aria-label="Search"
      />
      <button className={s.btn} type="submit" aria-label="Search">
        {/* magnifier icon */}
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
          <path fill="currentColor" d="M15.5 14h-.8l-.3-.3a6.5 6.5 0 1 0-.9.9l.3.3v.8l5 5 1.5-1.5-5-5zm-6 0A4.5 4.5 0 1 1 14 9.5 4.5 4.5 0 0 1 9.5 14z"/>
        </svg>
      </button>
    </form>
  );
}
