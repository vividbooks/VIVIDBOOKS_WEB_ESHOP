import React from 'react';
import { useParams, Navigate } from 'react-router';
import { useWebinars } from '../contexts/WebinarsContext';
import { WebinarDetailPage } from './WebinarDetailPage';
import { Loader2 } from 'lucide-react';

export function WebinarDetailRoute() {
  const { id } = useParams<{ id: string }>();
  const { webinars, loading } = useWebinars();

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-3 py-32 text-[#001161]/40">
        <Loader2 className="w-5 h-5 animate-spin" />
        <span className="font-['Fenomen_Sans',sans-serif] text-[14px]">{'Na\u010d\u00edt\u00e1m...'}</span>
      </div>
    );
  }

  // Najdi podle id, nebo slug (pro Webflow importovaná data)
  const webinar = webinars.find(w => w.id === id || w.slug === id);

  if (!webinar) return <Navigate to="/webinare" replace />;

  return <WebinarDetailPage webinar={webinar} />;
}
