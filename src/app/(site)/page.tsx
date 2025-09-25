// src/app/(site)/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useSession, signOut } from 'next-auth/react';
import Link from 'next/link';
import { toast } from 'react-toastify';

export default function Home() {
  const { data: session, status } = useSession();
  const [posts, setPosts] = useState([]);

  useEffect(() => {
    const fetchPosts = async () => {
      try {
        const response = await fetch('/api/r2/post');
        if (!response.ok) {
          throw new Error('Failed to fetch posts');
        }
        const data = await response.json();
        setPosts(data);
      } catch (error) {
        toast.error('Failed to load posts');
      }
    };
    fetchPosts();
  }, []);

  if (status === 'loading') {
    return <div className="container">Loading...</div>;
  }

  return (
    <div className="container">
      <nav className="navbar">
        <Link href="/">Home</Link>
        {session ? (
          <>
            <Link href="/dashboard">Dashboard</Link>
            <button
              className="btn"
              onClick={() => signOut({ callbackUrl: '/' })}
              style={{ display: 'inline-block', margin: '0 15px' }}
            >
              Sign Out
            </button>
          </>
        ) : (
          <Link href="/auth/signin">Sign In</Link>
        )}
      </nav>
      <h1>News Portal</h1>
      <div>
        {posts.map((post: any) => (
          <div key={post.ID} style={{ margin: '20px 0', padding: '10px', border: '1px solid #ccc' }}>
            <h2>{post.post_title}</h2>
            <p>{post.post_excerpt || 'No excerpt available'}</p>
            <p>By {post.author?.display_name || 'Unknown'}</p>
          </div>
        ))}
      </div>
    </div>
  );
}