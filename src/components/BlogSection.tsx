import React from 'react';
import { useNavigate } from 'react-router';
import { useBlogPosts } from '../contexts/BlogContext';
import { BlogCard } from './BlogCard';

export function BlogSection() {
  const navigate = useNavigate();
  const { posts } = useBlogPosts();
  const visiblePosts = posts.slice(0, 3);

  return (
    <section className="px-4 md:px-8 py-10 border-t border-[#001161]/6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8 flex-wrap">
        <span className="w-2.5 h-2.5 rounded-full bg-[#5B4FD8] shrink-0 shadow-[0_1px_4px_rgba(91,79,216,0.5)]" />
        <h2 className="font-['Cooper_Light',serif] text-[#001161] text-[28px] md:text-[36px] xl:text-[41px] leading-tight">
          {'Ze sv\u011bta vzd\u011bl\u00e1v\u00e1n\u00e1'}
        </h2>
        <div className="flex-1 h-px bg-[#001161]/8 hidden md:block" />
      </div>

      {/* 3-column grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 mb-8">
        {visiblePosts.map(post => (
          <BlogCard key={post.id} post={post} variant="home" />
        ))}
      </div>

      {/* All posts button */}
      <div className="flex justify-center">
        <button
          onClick={() => navigate('/blog')}
          className="font-['Fenomen_Sans',sans-serif] font-bold text-[15px] text-white bg-[#001161] hover:bg-[#0d1f7a] px-8 py-3 rounded-xl transition-all hover:scale-[1.03] active:scale-[0.98] cursor-pointer shadow-[0_4px_18px_rgba(0,17,97,0.18)]"
        >
          {'V\u0161echny \u010dl\u00e1nky'}
        </button>
      </div>
    </section>
  );
}