import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import { SubjectPage, type SubjectHeroMeta } from './SubjectPage';
import { useProducts } from '../contexts/ProductsContext';
import { slugToSubject } from '../utils/slugify';
import { projectId, publicAnonKey } from '../utils/supabase/info';

const SERVER = `https://${projectId}.supabase.co/functions/v1/make-server-93a20b6f`;
const AUTH_HEADERS = { Authorization: `Bearer ${publicAnonKey}`, 'Content-Type': 'application/json' };

export function SubjectPageRoute() {
  const { slug }   = useParams<{ slug: string }>();
  const navigate   = useNavigate();
  const { products } = useProducts();
  const [subjectHeroMeta, setSubjectHeroMeta] = useState<SubjectHeroMeta | undefined>(undefined);

  const subject = slug ? slugToSubject(slug) : null;

  useEffect(() => {
    if (!slug || !subject) {
      setSubjectHeroMeta(undefined);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const q = new URLSearchParams();
        q.set('slug', slug);
        q.set('subject', subject);
        const r = await fetch(`${SERVER}/public/predmet?${q.toString()}`, { headers: AUTH_HEADERS });
        const d = r.ok ? await r.json() : null;
        if (cancelled) return;
        if (d?.item) {
          const faqsRaw = d.item.faqs;
          const faqs = Array.isArray(faqsRaw)
            ? faqsRaw
                .map((x: any) => ({
                  question: String(x?.question ?? '').trim(),
                  answer: String(x?.answer ?? '').trim(),
                }))
                .filter((x: { question: string; answer: string }) => x.question && x.answer)
            : [];
          const mpi = d.item.methodPrinciplesItems;
          setSubjectHeroMeta({
            heroText: typeof d.item.heroText === 'string' ? d.item.heroText : '',
            authorIntroHeading: typeof d.item.authorIntroHeading === 'string' ? d.item.authorIntroHeading : '',
            authorIntroBody: typeof d.item.authorIntroBody === 'string' ? d.item.authorIntroBody : '',
            faqs,
            methodPrinciplesItems:
              Array.isArray(mpi) && mpi.length > 0
                ? mpi
                    .map((x: any) => ({
                      title: String(x?.title ?? '').trim(),
                      body: String(x?.body ?? '').trim(),
                      visualId: (() => {
                        const n = Math.floor(Number(x?.visualId));
                        return Number.isFinite(n) ? Math.max(0, Math.min(8, n)) : 0;
                      })(),
                      imageUrl: typeof x?.imageUrl === 'string' && x.imageUrl.trim() ? x.imageUrl.trim() : undefined,
                    }))
                    .filter((x: { title: string; body: string }) => x.title && x.body)
                : undefined,
          });
        } else {
          setSubjectHeroMeta(null);
        }
      } catch {
        if (!cancelled) setSubjectHeroMeta(null);
      }
    })();
    return () => { cancelled = true; };
  }, [slug, subject]);

  // If slug doesn't match a known subject, fall back to catalog
  if (!subject) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <p className="font-['Cooper_Light',serif] text-[#001161] text-[32px] mb-4">
            {'P\u0159edm\u011bt nenalezen'}
          </p>
          <button
            onClick={() => navigate('/')}
            className="font-['Fenomen_Sans',sans-serif] text-[#FF6B1A] text-[16px] underline cursor-pointer"
          >
            {'Zp\u011bt do katalogu'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <SubjectPage
      subject={subject}
      products={products}
      subjectHeroMeta={subjectHeroMeta}
      onBack={() => navigate(-1)}
      onOrder={() => navigate(`/objednat?predmet=${encodeURIComponent(subject)}`, { state: { category: subject } })}
      onProductClick={(p) => navigate(`/produkt/${encodeURIComponent(p.id)}`)}
      hideTopNav
    />
  );
}