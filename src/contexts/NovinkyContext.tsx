import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { projectId, publicAnonKey } from '../utils/supabase/info';
import { NOVINKA_POSTS } from '../data/novinkaPosts';
import type { NovinkaPost } from '../data/novinkaPosts';

const SERVER = `https://${projectId}.supabase.co/functions/v1/make-server-93a20b6f`;

interface NovinkyContextType {
  posts: NovinkaPost[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
  source: 'supabase' | 'static' | null;
}

const NovinkyContext = createContext<NovinkyContextType>({
  posts: [],
  loading: true,
  error: null,
  refresh: () => {},
  source: null,
});

export function NovinkyProvider({ children }: { children: ReactNode }) {
  const [posts, setPosts] = useState<NovinkaPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<'supabase' | 'static' | null>(null);

  async function fetchPosts() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${SERVER}/admin/novinky`, {
        headers: { Authorization: `Bearer ${publicAnonKey}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const items: NovinkaPost[] = data.items || [];
      if (items.length > 0) {
        setPosts(items);
        setSource('supabase');
      } else {
        setPosts(NOVINKA_POSTS);
        setSource('static');
      }
    } catch (e: any) {
      console.error('[NovinkyContext] Chyba:', e.message);
      setError(e.message);
      setPosts(NOVINKA_POSTS);
      setSource('static');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchPosts(); }, []);

  return (
    <NovinkyContext.Provider value={{ posts, loading, error, refresh: fetchPosts, source }}>
      {children}
    </NovinkyContext.Provider>
  );
}

export function useNovinky() {
  return useContext(NovinkyContext);
}
