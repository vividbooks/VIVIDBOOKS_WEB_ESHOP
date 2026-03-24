import React from 'react';
import { useNavigate } from 'react-router';
import { useNovinky } from '../contexts/NovinkyContext';
import { NovinkaCard } from './NovinkaCard';

const ff = "'Fenomen Sans', sans-serif";

export function NovinkySection() {
  const navigate = useNavigate();
  const { posts, loading } = useNovinky();

  const visible = posts
    .filter(p => (p as any).published !== false)
    .slice(0, 4);

  if (loading || visible.length === 0) return null;

  return (
    <section className="px-4 md:px-8 py-10 border-t border-[#001161]/6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8 flex-wrap">
        <span className="w-2.5 h-2.5 rounded-full bg-[#E8942A] shrink-0 shadow-[0_1px_4px_rgba(232,148,42,0.55)]" />
        <h2 className="font-['Cooper_Light',serif] text-[#001161] text-[28px] md:text-[36px] xl:text-[41px] leading-tight">
          {'Naše novinky'}
        </h2>
        <div className="flex-1 h-px bg-[#001161]/8 hidden md:block" />
        <button
          onClick={() => navigate('/novinky')}
          className="text-[#001161]/50 hover:text-[#001161] text-[13px] transition-colors cursor-pointer whitespace-nowrap"
          style={{ fontFamily: ff }}
        >
          {'Všechny novinky →'}
        </button>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5 mb-8">
        {visible.map(post => (
          <NovinkaCard key={post.id || post.slug} post={post} />
        ))}
      </div>

      {/* CTA */}
      <div className="flex justify-center">
        <button
          onClick={() => navigate('/novinky')}
          className="font-bold text-[15px] text-[#001161] bg-transparent hover:bg-[#001161]/6 border border-[#001161]/25 hover:border-[#001161]/40 px-8 py-3 rounded-full transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
          style={{ fontFamily: ff }}
        >
          {'Zobrazit všechny novinky'}
        </button>
      </div>
    </section>
  );
}
