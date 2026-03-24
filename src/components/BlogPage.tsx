import React from 'react';
import { motion } from 'motion/react';
import { BlogCard } from './BlogCard';
import { SEOHead } from './SEOHead';
import { useBlogPosts } from '../contexts/BlogContext';
import { NewsletterInlineBlock } from './NewsletterInlineBlock';

function BlogSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-12">
      {[1, 2, 3, 4, 5, 6].map(i => (
        <div key={i} className="flex flex-col gap-3 animate-pulse">
          <div className="rounded-[16px] bg-[#F0F2F8]" style={{ aspectRatio: '16/10' }} />
          <div className="h-3 bg-[#F0F2F8] rounded-full w-1/3" />
          <div className="h-4 bg-[#F0F2F8] rounded-full w-4/5" />
          <div className="h-4 bg-[#F0F2F8] rounded-full w-3/5" />
          <div className="h-3 bg-[#F0F2F8] rounded-full w-1/4" />
        </div>
      ))}
    </div>
  );
}

export function BlogPage() {
  const { posts, loading, error } = useBlogPosts();

  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="min-h-screen"
    >
      <SEOHead
        title="Blog"
        path="/blog"
        description="Blog Vividbooks \u2014 inspirace, rozhovory s u\u010diteli a novinky ze sv\u011bta modern\u00edho vzd\u011bl\u00e1v\u00e1n\u00ed na \u010desk\u00fdch z\u00e1kladn\u00edch \u0161kol\u00e1ch."
      />

      {/* Hero */}
      <div className="bg-white border-b border-[#001161]/6 px-6 md:px-10 pt-10 pb-10 text-center">
        <h1 className="font-['Cooper_Light',serif] text-[#001161] text-[32px] md:text-[40px] leading-tight mb-3">
          {'Ze sv\u011bta vzd\u011bl\u00e1v\u00e1n\u00ed'}
        </h1>
        <p className="font-['Fenomen_Sans',sans-serif] text-[#001161]/60 text-[15px] md:text-[16px] max-w-[480px] mx-auto leading-relaxed">
          {'P\u0159in\u00e1\u0161\u00edme v\u00e1m inspiraci, rozhovory s u\u010diteli a novinky ze sv\u011bta modern\u00edho vzd\u011bl\u00e1v\u00e1n\u00ed.'}
        </p>
      </div>

      {/* Posts grid */}
      <section className="px-6 md:px-10 py-10 pb-20">
        {loading ? (
          <BlogSkeleton />
        ) : error && posts.length === 0 ? (
          <div className="text-center py-20">
            <p className="font-['Fenomen_Sans',sans-serif] text-red-500 text-[16px] mb-2">
              {'Chyba p\u0159i na\u010d\u00edt\u00e1n\u00ed \u010dl\u00e1nk\u016f'}
            </p>
            <p className="font-['Fenomen_Sans',sans-serif] text-[#001161]/40 text-[13px]">{error}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-12">
            {posts.map((post, i) => (
              <motion.div
                key={post.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.06, duration: 0.35 }}
              >
                <BlogCard post={post} variant="grid" />
              </motion.div>
            ))}
          </div>
        )}
      </section>

      {/* Newsletter */}
      <section className="px-6 md:px-10 pb-20">
        <NewsletterInlineBlock source="blog-prehled" />
      </section>
    </motion.div>
  );
}