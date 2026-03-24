import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Loader2 } from 'lucide-react';
import { useNovinky } from '../contexts/NovinkyContext';
import { NovinkaCard } from './NovinkaCard';
import { SEOHead } from './SEOHead';
import { NewsletterInlineBlock } from './NewsletterInlineBlock';

export function NovinkyPage() {
  const { posts, loading, source } = useNovinky();

  // Only show published posts (or all if from static data)
  const visible = posts.filter(p => source === 'static' || (p as any).published !== false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="min-h-screen"
    >
      <SEOHead
        title="Novinky"
        path="/novinky"
        description="Novinky z Vividbooks — aktuální informace o nových produktech, digitálních učebnicích a dění ve světě moderního vzdělávání."
      />

      {/* Hero */}
      <div className="bg-white border-b border-[#001161]/6 px-6 md:px-10 pt-10 pb-10 text-center">
        <h1 className="font-['Cooper_Light',serif] text-[#001161] text-[32px] md:text-[40px] leading-tight mb-3">
          {'Novinky'}
        </h1>
        <p className="font-['Fenomen_Sans',sans-serif] text-[#001161]/60 text-[15px] md:text-[16px] max-w-[480px] mx-auto leading-relaxed">
          {'Aktuální informace o nových produktech, aktualizacích a dění ve Vividbooks.'}
        </p>
      </div>

      {/* Posts grid */}
      <section className="px-6 md:px-10 py-10 pb-20">
        {loading ? (
          <div className="flex justify-center items-center py-24">
            <Loader2 className="w-8 h-8 text-[#001161]/30 animate-spin" />
          </div>
        ) : visible.length === 0 ? (
          <p className="text-center font-['Fenomen_Sans',sans-serif] text-[#001161]/40 text-[16px] py-20">
            {'Žádné novinky k zobrazení.'}
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 md:gap-10">
            {visible.map((post, i) => (
              <motion.div
                key={post.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.06, duration: 0.35 }}
              >
                <NovinkaCard post={post} />
              </motion.div>
            ))}
          </div>
        )}
      </section>

      {/* Newsletter */}
      <section className="px-6 md:px-10 pb-20">
        <NewsletterInlineBlock source="novinky-prehled" />
      </section>
    </motion.div>
  );
}