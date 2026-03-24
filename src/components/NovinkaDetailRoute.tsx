import React from 'react';
import { useParams, Navigate } from 'react-router';
import { useNovinky } from '../contexts/NovinkyContext';
import { NovinkaDetailPage } from './NovinkaDetailPage';
import { Loader2 } from 'lucide-react';

export function NovinkaDetailRoute() {
  const { slug } = useParams<{ slug: string }>();
  const { posts, loading } = useNovinky();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#001161]/30 animate-spin" />
      </div>
    );
  }

  const post = posts.find(p => p.slug === slug);
  if (!post) return <Navigate to="/novinky" replace />;

  return <NovinkaDetailPage post={post} />;
}