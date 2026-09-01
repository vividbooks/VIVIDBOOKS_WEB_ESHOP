import React, { useEffect } from 'react';
import { useParams, Navigate } from 'react-router';
import { useWebinars } from '../contexts/WebinarsContext';
import { WebinarDetailPage } from './WebinarDetailPage';
import { Loader2 } from 'lucide-react';
import { recallLiveUrl, rememberLiveUrl } from '../utils/webinarLiveFallback';
import { WebinarUnavailableNotice } from './WebinarUnavailableNotice';

export function WebinarDetailRoute() {
  const { id } = useParams<{ id: string }>();
  const { webinars, loading } = useWebinars();

  // Najdi podle id, nebo slug (pro Webflow importovaná data)
  const webinar = webinars.find(w => w.id === id || w.slug === id);

  /** Většina lidí projde detailem ještě před startem — tady se pojistka nabije. */
  useEffect(() => {
    const url = webinar?.youtubeUrl || (webinar as { liveUrl?: string } | undefined)?.liveUrl;
    if (webinar && url) rememberLiveUrl(webinar, url);
  }, [webinar]);

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-3 py-32 text-[#001161]/40">
        <Loader2 className="w-5 h-5 animate-spin" />
        <span className="font-['Fenomen_Sans',sans-serif] text-[14px]">{'Na\u010d\u00edt\u00e1m...'}</span>
      </div>
    );
  }

  // Při výpadku API neposílat pryč — nabídnout stream, pokud ho známe.
  if (!webinar) return <WebinarUnavailableNotice streamUrl={recallLiveUrl(id)} />;

  // Kanonická URL = slug (pokud existuje) — id URL přesměrujeme, ať Google nemá duplicity.
  const canonicalSeg = String(webinar.slug || webinar.id || '').trim();
  if (id && canonicalSeg && id !== canonicalSeg) {
    return <Navigate to={`/webinar/${encodeURIComponent(canonicalSeg)}`} replace />;
  }

  return <WebinarDetailPage webinar={webinar} />;
}
