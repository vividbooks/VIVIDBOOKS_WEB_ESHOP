import { useState } from 'react';
import { motion } from 'motion/react';
import { ChevronLeft, Clock, User, ChevronRight, ChevronLeft as ChevLeft } from 'lucide-react';
import { useNavigate } from 'react-router';
import type { BlogPost, BlogBlock } from '../data/blogPosts';
import { BlogCard } from './BlogCard';
import { SEOHead, articleJsonLd } from './SEOHead';
import { buildOgImageAlt, resolveShareImageUrl } from '../utils/ogImage';
import { useBlogPosts } from '../contexts/BlogContext';
import { NewsletterInlineBlock } from './NewsletterInlineBlock';

/* ── YouTube helper ────────────────────────────────────────────── */
function extractYoutubeId(url: string): string | null {
  const patterns = [
    /youtube\.com\/watch\?v=([a-zA-Z0-9_-]+)/,
    /youtu\.be\/([a-zA-Z0-9_-]+)/,
    /youtube\.com\/embed\/([a-zA-Z0-9_-]+)/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

/* ── Sidebar CTA card ──────────────────────────────────────────── */
function SidebarCTA() {
  const navigate = useNavigate();
  return (
    <div className="bg-[#FEF3C7] rounded-[20px] p-6 border border-[#F5D645]/60">
      <p className="font-['Fenomen_Sans',sans-serif] font-black text-[#001161] text-[18px] leading-snug mb-3">
        {'\uD83D\uDE80 U\u010den\u00ed, kter\u00e9 inspiruje a bav\u00ed.'}
      </p>
      <p className="font-['Fenomen_Sans',sans-serif] text-[#001161]/70 text-[13px] leading-relaxed mb-5">
        {'Vividbooks \u2013 nakladatelstv\u00ed pro z\u00e1kladn\u00ed \u0161koly, kter\u00e9 nab\u00edz\u00ed u\u010ditel\u016fm v\u0161e pot\u0159ebn\u00e9 pro modern\u00ed a smysluplnou v\u00fduku.'}
      </p>
      <a
        href="/vyzkousejte"
        onClick={(e) => { e.preventDefault(); navigate('/vyzkousejte'); }}
        className="block w-full text-center bg-[#7C3AED] hover:bg-[#6D28D9] text-white font-['Fenomen_Sans',sans-serif] font-bold text-[13px] px-4 py-3 rounded-[12px] transition-all hover:scale-[1.02] cursor-pointer mb-2 no-underline"
      >
        {'Vyzkou\u0161et zdarma online'}
      </a>
      <a
        href="https://eshop.vividbooks.com"
        target="_blank"
        rel="noopener noreferrer"
        className="block w-full text-center bg-[#001161] hover:bg-[#001161]/80 text-white font-['Fenomen_Sans',sans-serif] font-bold text-[13px] px-4 py-3 rounded-[12px] transition-all hover:scale-[1.02] cursor-pointer no-underline"
      >
        {'Prolistovat si na\u0161e pracovn\u00ed se\u0161ity a u\u010debnice'}
      </a>
    </div>
  );
}

/* ── Content block renderer ────────────────────────────────────── */
function ContentBlock({ block }: { block: BlogBlock }) {
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
            {'\u2014 '}{block.author}
          </p>
        )}
      </blockquote>
    );
  }
  if (block.type === 'video') {
    const videoId = extractYoutubeId(block.url);
    if (!videoId) return null;
    return (
      <figure className="my-8">
        <div className="relative w-full rounded-[16px] overflow-hidden shadow-lg" style={{ paddingBottom: '56.25%' }}>
          <iframe
            src={`https://www.youtube.com/embed/${videoId}`}
            title={block.title || 'Video'}
            className="absolute inset-0 w-full h-full"
            frameBorder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
        {block.title && (
          <figcaption className="font-['Fenomen_Sans',sans-serif] text-[#001161]/40 text-[12px] text-center mt-2">
            {block.title}
          </figcaption>
        )}
      </figure>
    );
  }
  if (block.type === 'slider') {
    return <BlogSlider images={block.images} caption={block.caption} />;
  }
  if (block.type === 'tabs') {
    return <BlogTabs tabs={block.tabs} heading={block.heading} />;
  }
  return null;
}

/* ── Slider block ───────────────────────────────────────────────── */
function BlogSlider({ images, caption }: { images: { src: string; alt?: string; caption?: string }[]; caption?: string }) {
  const [idx, setIdx] = useState(0);
  if (!images || images.length === 0) return null;
  const current = images[idx];
  const prev = () => setIdx(i => (i - 1 + images.length) % images.length);
  const next = () => setIdx(i => (i + 1) % images.length);
  return (
    <figure className="my-7">
      <div className="relative rounded-[16px] overflow-hidden bg-[#001161]/5" style={{ aspectRatio: '16/9' }}>
        <img
          src={current.src}
          alt={current.alt || ''}
          className="w-full h-full object-cover transition-opacity duration-300"
          key={idx}
        />
        {/* Nav buttons */}
        {images.length > 1 && (
          <>
            <button
              onClick={prev}
              className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/80 hover:bg-white shadow-md flex items-center justify-center cursor-pointer transition-all"
            >
              <ChevLeft className="w-4 h-4 text-[#001161]" />
            </button>
            <button
              onClick={next}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/80 hover:bg-white shadow-md flex items-center justify-center cursor-pointer transition-all"
            >
              <ChevronRight className="w-4 h-4 text-[#001161]" />
            </button>
            {/* Dots */}
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5">
              {images.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setIdx(i)}
                  className={`rounded-full transition-all cursor-pointer ${i === idx ? 'w-5 h-2 bg-white' : 'w-2 h-2 bg-white/50 hover:bg-white/80'}`}
                />
              ))}
            </div>
            {/* Counter */}
            <span className="absolute top-3 right-3 font-['Fenomen_Sans',sans-serif] text-[11px] text-white bg-black/40 px-2 py-0.5 rounded-full">
              {idx + 1} / {images.length}
            </span>
          </>
        )}
      </div>
      {/* Per-image caption */}
      {current.caption && (
        <figcaption className="font-['Fenomen_Sans',sans-serif] text-[#001161]/40 text-[12px] text-center mt-2">
          {current.caption}
        </figcaption>
      )}
      {/* Overall caption */}
      {caption && !current.caption && (
        <figcaption className="font-['Fenomen_Sans',sans-serif] text-[#001161]/40 text-[12px] text-center mt-2">
          {caption}
        </figcaption>
      )}
      {/* Thumbnail strip */}
      {images.length > 1 && (
        <div className="flex gap-1.5 mt-2 overflow-x-auto pb-1">
          {images.map((img, i) => (
            <button
              key={i}
              onClick={() => setIdx(i)}
              className={`flex-shrink-0 w-14 h-14 rounded-[8px] overflow-hidden border-2 transition-all cursor-pointer ${i === idx ? 'border-[#7C3AED]' : 'border-transparent opacity-60 hover:opacity-90'}`}
            >
              <img src={img.src} alt={img.alt || ''} className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </figure>
  );
}

/* ── Tabs block ─────────────────────────────────────────────────── */
function BlogTabs({ tabs, heading }: { tabs: { label: string; content: string; imageUrl?: string }[]; heading?: string }) {
  const [active, setActive] = useState(0);
  if (!tabs || tabs.length === 0) return null;
  const tab = tabs[active];
  return (
    <div className="my-8 bg-[#F8F7FF] rounded-[20px] overflow-hidden border border-[#001161]/8">
      {heading && (
        <div className="px-5 pt-5 pb-3">
          <h3 className="font-['Fenomen_Sans',sans-serif] font-black text-[#001161] text-[17px]">{heading}</h3>
        </div>
      )}
      {/* Tab labels */}
      <div className="flex overflow-x-auto border-b border-[#001161]/10 px-4 gap-1 pt-4">
        {tabs.map((t, i) => (
          <button
            key={i}
            onClick={() => setActive(i)}
            className={`flex-shrink-0 px-4 py-2 rounded-t-[12px] text-[13px] font-bold cursor-pointer transition-all ${
              i === active
                ? 'bg-white text-[#7C3AED] border-t-2 border-x border-[#001161]/10 border-t-[#7C3AED] -mb-px'
                : 'text-[#001161]/50 hover:text-[#001161]/80 hover:bg-white/50'
            }`}
            style={{ fontFamily: "'Fenomen Sans', sans-serif" }}
          >
            {t.label}
          </button>
        ))}
      </div>
      {/* Tab content */}
      <div className="p-5 bg-white">
        {tab.imageUrl && (
          <img
            src={tab.imageUrl}
            alt={tab.label}
            className="w-full rounded-[12px] object-cover mb-4"
            style={{ maxHeight: '220px' }}
          />
        )}
        <p className="font-['Fenomen_Sans',sans-serif] text-[#001161] text-[15px] leading-relaxed whitespace-pre-wrap">
          {tab.content}
        </p>
      </div>
    </div>
  );
}

/* ── Main component ────────────────────────────────────────────── */
interface BlogDetailPageProps {
  post: BlogPost;
}

export function BlogDetailPage({ post }: BlogDetailPageProps) {
  const navigate = useNavigate();
  const { posts } = useBlogPosts();

  const related = posts
    .filter(p => p.id !== post.id && p.category === post.category)
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
        path={`/blog/${post.slug}`}
        description={post.excerpt || post.title}
        image={resolveShareImageUrl({ explicitImage: post.coverImage, category: post.category })}
        imageAlt={buildOgImageAlt({ title: post.title, categoryLabel: post.category })}
        type="article"
        article={{ publishedTime: post.date, author: post.author, section: post.category }}
        jsonLd={articleJsonLd({
          title: post.title,
          description: post.excerpt || post.title,
          image: post.coverImage,
          datePublished: post.date,
          url: `https://www.vividbooks.com/blog/${post.slug}`,
        })}
      />

      {/* Breadcrumb */}
      <div className="relative z-30 border-b border-[#001161]/6 bg-white md:sticky md:top-14 md:bg-white/90 md:backdrop-blur-md">
        <div className="max-w-[1100px] mx-auto px-6 h-11 flex items-center gap-2">
          <button
            onClick={() => navigate('/blog')}
            className="flex items-center gap-1.5 text-[#001161]/60 hover:text-[#001161] font-['Fenomen_Sans',sans-serif] text-[13px] transition-colors cursor-pointer group"
          >
            <ChevronLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
            {'Blog'}
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
          <span className="inline-block font-['Fenomen_Sans',sans-serif] font-bold text-[12px] uppercase tracking-widest text-[#ff6a35] mb-3">
            {post.category}
          </span>
          <h1 className="font-['Cooper_Light',serif] text-[#001161] text-[30px] md:text-[40px] leading-[1.15] mb-5">
            {post.title}
          </h1>
          <div className="flex items-center justify-center gap-4 flex-wrap">
            <span className="flex items-center gap-1.5 font-['Fenomen_Sans',sans-serif] text-[13px] text-[#001161]/50">
              <User className="w-3.5 h-3.5" />
              {post.author}
            </span>
            <span className="text-[#001161]/20">{'\u00b7'}</span>
            <span className="flex items-center gap-1.5 font-['Fenomen_Sans',sans-serif] text-[13px] text-[#001161]/50">
              <Clock className="w-3.5 h-3.5" />
              {post.readTime}{' min \u010dten\u00ed'}
            </span>
            <span className="text-[#001161]/20">{'\u00b7'}</span>
            <span className="font-['Fenomen_Sans',sans-serif] text-[13px] text-[#001161]/50">
              {post.date}
            </span>
          </div>
        </header>

        {/* Hero image */}
        {post.coverImage && (
          <div className="mb-10 -mx-2 md:mx-0">
            <img
              src={post.coverImage}
              alt={post.title}
              className="w-full rounded-[20px] object-cover"
              style={{ maxHeight: '400px' }}
            />
          </div>
        )}

        {/* Two-column layout */}
        <div className="flex gap-10 items-start">

          {/* Article content */}
          <article className="flex-1 min-w-0">
            {Array.isArray(post.content)
              ? post.content.map((block, i) => <ContentBlock key={i} block={block} />)
              : typeof post.content === 'string' && post.content
                ? <div dangerouslySetInnerHTML={{ __html: post.content as unknown as string }} className="font-['Fenomen_Sans',sans-serif] text-[#001161] text-[16px] leading-[1.8]" />
                : null
            }
          </article>

          {/* Sticky sidebar */}
          <aside className="hidden lg:block w-[280px] xl:w-[300px] shrink-0 self-start sticky top-[112px]">
            <SidebarCTA />
            <div className="mt-4">
              <NewsletterInlineBlock source="blog-detail-sidebar" compact />
            </div>
          </aside>
        </div>

        {/* Related posts */}
        {related.length > 0 && (
          <div className="mt-20 pt-10 border-t border-[#001161]/8">
            <h2 className="font-['Cooper_Light',serif] text-[#001161] text-[30px] mb-8">
              {'Dal\u0161\u00ed \u010dl\u00e1nky'}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-[800px]">
              {related.map(p => (
                <BlogCard key={p.id} post={p} variant="grid" />
              ))}
            </div>
          </div>
        )}

        {/* Newsletter — pod článkem */}
        <div className="mt-16 pt-10 border-t border-[#001161]/8">
          <NewsletterInlineBlock source="blog-detail-bottom" />
        </div>
      </div>
    </motion.div>
  );
}