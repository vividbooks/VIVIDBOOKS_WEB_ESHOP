import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { projectId, publicAnonKey } from '../utils/supabase/info';
import { BLOG_POSTS } from '../data/blogPosts';
import type { BlogPost } from '../data/blogPosts';
import { sortBlogPosts } from '../utils/sortBlogPosts';

const SERVER = `https://${projectId}.supabase.co/functions/v1/make-server-93a20b6f`;

interface BlogContextType {
  /** Pouze publikované články (published !== false) — pro veřejný web */
  posts: BlogPost[];
  /** Všechny články včetně konceptů — pro admin */
  allPosts: BlogPost[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
  source: 'supabase' | 'static' | null;
}

const BlogContext = createContext<BlogContextType>({
  posts: [],
  allPosts: [],
  loading: true,
  error: null,
  refresh: () => {},
  source: null,
});

export function BlogProvider({ children }: { children: ReactNode }) {
  const [allPosts, setAllPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<'supabase' | 'static' | null>(null);

  async function fetchPosts() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${SERVER}/admin/blog`, {
        headers: { Authorization: `Bearer ${publicAnonKey}` },
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`HTTP ${res.status}: ${txt}`);
      }
      const data = await res.json();
      const items: BlogPost[] = data.items || [];
      if (items.length > 0) {
        setAllPosts(sortBlogPosts(items));
        setSource('supabase');
        console.log(`[BlogContext] Nacten ${items.length} prispevku z Supabase.`);
      } else {
        console.log('[BlogContext] Supabase je prazdne, pouzivam staticka data.');
        setAllPosts(sortBlogPosts(BLOG_POSTS));
        setSource('static');
      }
    } catch (e: any) {
      console.error('[BlogContext] Chyba pri nacitani blogu:', e.message);
      setError(e.message);
      setAllPosts(sortBlogPosts(BLOG_POSTS));
      setSource('static');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchPosts();
  }, []);

  // Public posts: only published (published !== false → undefined treated as published for backward compat)
  const posts = allPosts.filter(p => p.published !== false);

  return (
    <BlogContext.Provider value={{ posts, allPosts, loading, error, refresh: fetchPosts, source }}>
      {children}
    </BlogContext.Provider>
  );
}

export function useBlogPosts() {
  return useContext(BlogContext);
}
