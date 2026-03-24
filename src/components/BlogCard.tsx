import React from 'react';
import { useNavigate } from 'react-router';
import type { BlogPost } from '../data/blogPosts';

interface BlogCardProps {
  post: BlogPost;
  variant?: 'home' | 'grid';
}

export function BlogCard({ post, variant = 'grid' }: BlogCardProps) {
  const navigate = useNavigate();

  const go = () => navigate(`/blog/${post.slug}`);

  return (
    <article
      className="flex flex-col cursor-pointer group"
      onClick={go}
    >
      {/* Cover image */}
      <div className="overflow-hidden rounded-[16px] mb-4">
        <img
          src={post.coverImage}
          alt={post.title}
          className="w-full object-cover transition-transform duration-500 group-hover:scale-105"
          style={{ aspectRatio: '16/10', display: 'block' }}
        />
      </div>

      {/* Category + read time */}
      <div className="flex items-center gap-2 mb-2">
        <span className="font-['Fenomen_Sans',sans-serif] text-[12px] font-bold text-[#5B4FD8] uppercase tracking-wider">
          {post.category}
        </span>
        <span className="text-[#001161]/20">·</span>
        <span className="font-['Fenomen_Sans',sans-serif] text-[12px] text-[#001161]/40">
          {post.readTime}{' min \u010dten\u00ed'}
        </span>
      </div>

      {/* Title */}
      <h3
        className={`font-['Fenomen_Sans',sans-serif] font-bold text-[#001161] leading-snug mb-2 group-hover:opacity-70 transition-opacity ${
          variant === 'home' ? 'text-[15px] md:text-[17px]' : 'text-[16px]'
        }`}
      >
        {post.title}
      </h3>

      {/* Excerpt */}
      <p
        className={`font-['Fenomen_Sans',sans-serif] text-[#001161]/60 leading-relaxed ${
          variant === 'home' ? 'text-[13px] line-clamp-4' : 'text-[13px] line-clamp-3'
        }`}
      >
        {post.excerpt}
      </p>

      {/* Author + date */}
      <div className="flex items-center gap-2 mt-3">
        <span className="font-['Fenomen_Sans',sans-serif] text-[12px] text-[#001161]/40">
          {post.author}
        </span>
        <span className="text-[#001161]/20">·</span>
        <span className="font-['Fenomen_Sans',sans-serif] text-[12px] text-[#001161]/40">
          {post.date}
        </span>
      </div>
    </article>
  );
}
