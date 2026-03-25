import React from 'react';
import { motion } from 'motion/react';
import { ChevronLeft, Clock, User } from 'lucide-react';
import { useNavigate } from 'react-router';
import type { NovinkaPost, NovinkaBlock } from '../data/novinkaPosts';
import { useNovinky } from '../contexts/NovinkyContext';
import { NovinkaCard } from './NovinkaCard';
import { SEOHead, articleJsonLd } from './SEOHead';
import { buildOgImageAlt, resolveShareImageUrl } from '../utils/ogImage';
import { NewsletterInlineBlock } from './NewsletterInlineBlock';

/* ── Sidebar CTA card ──────────────────────────────────────────── */
function SidebarCTA() {
  const navigate = useNavigate();
  return (
    <div className="bg-[#FEF3C7] rounded-[20px] p-6 border border-[#F5D645]/60">
      <p className="font-['Fenomen_Sans',sans-serif] font-black text-[#001161] text-[18px] leading-snug mb-3">
        {'\uD83D\uDE80 Učení, které inspiruje a baví.'}
      </p>
      <p className="font-['Fenomen_Sans',sans-serif] text-[#001161]/70 text-[13px] leading-relaxed mb-5">
        {'Vividbooks \u2013 nakladatelství pro základní školy, které nabízí učitelům vše potřebné pro moderní a smysluplnou výuku.'}
      </p>
      <a
        href="/vyzkousejte"
        onClick={(e) => { e.preventDefault(); navigate('/vyzkousejte'); }}
        className="block w-full text-center bg-[#7C3AED] hover:bg-[#6D28D9] text-white font-['Fenomen_Sans',sans-serif] font-bold text-[13px] px-4 py-3 rounded-[12px] transition-all hover:scale-[1.02] cursor-pointer mb-2 no-underline"
      >
        {'Vyzkoušet zdarma online'}
      </a>
      <a
        href="https://eshop.vividbooks.com"
        target="_blank"
        rel="noopener noreferrer"
        className="block w-full text-center bg-[#001161] hover:bg-[#001161]/80 text-white font-['Fenomen_Sans',sans-serif] font-bold text-[13px] px-4 py-3 rounded-[12px] transition-all hover:scale-[1.02] cursor-pointer no-underline"
      >
        {'Prolistovat si naše pracovní sešity a učebnice'}
      </a>
    </div>
  );
}

/* ── Block renderer (fallback pro statická data) ───────────────── */
function ContentBlock({ block }: { block: NovinkaBlock }) {
  if (block.type === 'paragraph') {
    return (
      <p className="font-['Fenomen_Sans',sans-serif] text-[#001161] text-[16px] leading-[1.8] mb-5">
        {block.text}
      </p>
    );
  }
  if (block.type === 'heading') {
    return (
      <h2 className="font-['Fenomen_Sans',sans-serif] font-black text-[#001161] text-[18px] md:text-[20px] leading-snug mt-10 mb-4">
        {block.text}
      </h2>
    );
  }
  if (block.type === 'image') {
    return (
      <figure className="my-7">
        <img
          src={block.src}
          alt={block.alt}
          className="w-full rounded-[14px] object-cover"
          style={{ maxHeight: '280px' }}
        />
        {block.caption && (
          <figcaption className="font-['Fenomen_Sans',sans-serif] text-[#001161]/40 text-[12px] text-center mt-2">
            {block.caption}
          </figcaption>
        )}
      </figure>
    );
  }
  if (block.type === 'quote') {
    return (
      <blockquote className="my-8 bg-[#F0F2F8] rounded-[16px] px-6 py-5 border-l-4 border-[#ff6a35]">
        <p className="font-['Cooper_Light',serif] text-[#001161] text-[19px] leading-snug italic mb-2">
          {'\u201e'}{block.text}{'\u201c'}
        </p>
        {block.author && (
          <p className="font-['Fenomen_Sans',sans-serif] text-[#001161]/50 text-[13px]">
            {'— '}{block.author}
          </p>
        )}
      </blockquote>
    );
  }
  return null;
}

/* ── Main component ────────────────────────────────────────────── */
interface NovinkaDetailPageProps {
  post: NovinkaPost;
}

export function NovinkaDetailPage({ post }: NovinkaDetailPageProps) {
  const navigate = useNavigate();
  const { posts } = useNovinky();

  const contentHtml = (post as any).contentHtml as string | undefined;
  const hasHtml = contentHtml && contentHtml.trim().length > 10;

  const coverImage = post.coverImage || (post as any).image;

  const related = posts
    .filter(p => p.id !== post.id && (p as any).published !== false)
    .slice(0, 2);

  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="min-h-screen bg-white"
    >
      <SEOHead
        title={post.title}
        path={`/novinky/${post.slug}`}
        description={post.excerpt || post.title}
        image={resolveShareImageUrl({ explicitImage: coverImage, category: post.category })}
        imageAlt={buildOgImageAlt({ title: post.title, categoryLabel: post.category })}
        type="article"
        article={{ publishedTime: post.date, author: post.author, section: post.category }}
        jsonLd={articleJsonLd({
          title: post.title,
          description: post.excerpt || post.title,
          image: coverImage,
          datePublished: post.date,
          url: `https://www.vividbooks.com/novinky/${post.slug}`,
        })}
      />

      {/* Breadcrumb */}
      <div className="relative z-30 border-b border-[#001161]/6 bg-white md:sticky md:top-14 md:bg-white/90 md:backdrop-blur-md">
        <div className="max-w-[1100px] mx-auto px-6 h-11 flex items-center gap-2">
          <button
            onClick={() => navigate('/novinky')}
            className="flex items-center gap-1.5 text-[#001161]/60 hover:text-[#001161] font-['Fenomen_Sans',sans-serif] text-[13px] transition-colors cursor-pointer group"
          >
            <ChevronLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
            {'Novinky'}
          </button>
          <span className="text-[#001161]/20 text-[13px]">/</span>
          <span className="font-['Fenomen_Sans',sans-serif] text-[13px] truncate max-w-[300px] text-[#001161]/50">
            {post.category}
          </span>
        </div>
      </div>

      <div className="max-w-[1100px] mx-auto px-6 pt-8 pb-24">

        {/* Title + meta */}
        <header className="max-w-[680px] mx-auto text-center mb-10">
          {post.category && (
            <span className="inline-block font-['Fenomen_Sans',sans-serif] font-bold text-[12px] uppercase tracking-widest text-[#ff6a35] mb-3">
              {post.category}
            </span>
          )}
          <h1 className="font-['Cooper_Light',serif] text-[#001161] text-[30px] md:text-[40px] leading-[1.15] mb-5">
            {post.title}
          </h1>
          <div className="flex items-center justify-center gap-4 flex-wrap">
            {post.author && (
              <span className="flex items-center gap-1.5 font-['Fenomen_Sans',sans-serif] text-[13px] text-[#001161]/50">
                <User className="w-3.5 h-3.5" />
                {post.author}
              </span>
            )}
            {post.author && post.date && <span className="text-[#001161]/20">&middot;</span>}
            {post.date && (
              <span className="font-['Fenomen_Sans',sans-serif] text-[13px] text-[#001161]/50">
                {post.date}
              </span>
            )}
            {(post as any).readTime && (
              <>
                <span className="text-[#001161]/20">&middot;</span>
                <span className="flex items-center gap-1.5 font-['Fenomen_Sans',sans-serif] text-[13px] text-[#001161]/50">
                  <Clock className="w-3.5 h-3.5" />
                  {(post as any).readTime}{' min čtení'}
                </span>
              </>
            )}
          </div>
        </header>

        {/* Cover image */}
        {coverImage && (
          <div className="max-w-[820px] mx-auto mb-10">
            <img
              src={coverImage}
              alt={post.title}
              className="w-full rounded-[20px] object-cover"
              style={{ maxHeight: '420px' }}
            />
          </div>
        )}

        {/* Two-column layout */}
        <div className="flex gap-10 items-start">

          {/* Article content */}
          <article className="flex-1 min-w-0">
            {hasHtml ? (
              /* HTML z Webflow importu nebo WYSIWYG editoru */
              <div
                className="novinka-richtext"
                dangerouslySetInnerHTML={{ __html: contentHtml! }}
              />
            ) : (
              /* Fallback: statické bloky */
              post.content?.map((block, i) => (
                <ContentBlock key={i} block={block} />
              ))
            )}
          </article>

          {/* Sticky sidebar */}
          <aside className="hidden lg:block w-[280px] xl:w-[300px] shrink-0 self-start sticky top-[112px]">
            <SidebarCTA />
            <div className="mt-4">
              <NewsletterInlineBlock source="novinka-detail-sidebar" compact />
            </div>
          </aside>
        </div>

        {/* Related posts */}
        {related.length > 0 && (
          <div className="mt-20 pt-10 border-t border-[#001161]/8">
            <h2 className="font-['Cooper_Light',serif] text-[#001161] text-[30px] mb-8">
              {'Další novinky'}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-[800px]">
              {related.map(p => (
                <NovinkaCard key={p.id} post={p} />
              ))}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}