import React from 'react';
import { useParams, Navigate } from 'react-router';
import { useBlogPosts } from '../contexts/BlogContext';
import { BlogDetailPage } from './BlogDetailPage';
import { motion } from 'motion/react';

export function BlogDetailRoute() {
  const { slug } = useParams<{ slug: string }>();
  const { posts, loading } = useBlogPosts();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <motion.div
          animate={{ opacity: [0.4, 1, 0.4] }}
          transition={{ repeat: Infinity, duration: 1.4 }}
          className="font-['Fenomen_Sans',sans-serif] text-[#001161]/40 text-[16px]"
        >
          {'Na\u010d\u00edt\u00e1m \u010dl\u00e1nek\u2026'}
        </motion.div>
      </div>
    );
  }

  const post = posts.find(p => p.slug === slug);
  if (!post) return <Navigate to="/blog" replace />;

  return <BlogDetailPage post={post} />;
}
