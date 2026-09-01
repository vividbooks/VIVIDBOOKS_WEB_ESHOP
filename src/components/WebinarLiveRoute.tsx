import React, { useEffect } from 'react';
import { useParams, Navigate, useSearchParams } from 'react-router';
import { useWebinars } from '../contexts/WebinarsContext';
import { WebinarLivePage } from './WebinarLivePage';
import { Loader2 } from 'lucide-react';
import type { Webinar } from '../data/webinars';
import { recallLiveUrl, rememberLiveUrl } from '../utils/webinarLiveFallback';
import { WebinarUnavailableNotice } from './WebinarUnavailableNotice';

function getLiveStatus(w: Webinar): 'upcoming' | 'live' | 'ended' {
  const [h, m] = (w.time || '18:00').split(':').map(Number);
  const date = new Date(w.year, (w.monthNum || 1) - 1, w.day || 1, h || 18, m || 0);
  const diffMin = (Date.now() - date.getTime()) / 60000;
  if (diffMin < -60) return 'upcoming';
  if (diffMin < 150) return 'live';
  return 'ended';
}

function streamUrlOf(w: Webinar): string {
  return (
    (w as { liveUrl?: string }).liveUrl ||
    w.youtubeUrl ||
    (w as { recordingUrl?: string }).recordingUrl ||
    ''
  );
}

export function WebinarLiveRoute() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const isPreview = searchParams.get('preview') === '1';
  const { webinars, loading } = useWebinars();

  const webinar = webinars.find(w => w.id === id || w.slug === id);

  /**
   * Dokud web funguje, ukládáme si odkaz na stream. Když příště selže Edge API,
   * máme kam diváka poslat místo toho, abychom mu zavřeli vysílání.
   */
  useEffect(() => {
    if (!webinar) return;
    const url = streamUrlOf(webinar);
    if (url) rememberLiveUrl(webinar, url);
  }, [webinar]);

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-3 py-32 text-[#001161]/40">
        <Loader2 className="w-5 h-5 animate-spin" />
        <span style={{ fontFamily: "'Fenomen Sans', sans-serif" }} className="text-[14px]">
          {'Na\u010d\u00edt\u00e1m\u2026'}
        </span>
      </div>
    );
  }

  /**
   * Nedohledaný webinář je téměř vždy výpadek API, ne neplatná adresa.
   * 1. 9. 2026 se tady přesměrovávalo na /webinare, což divákům uprostřed
   * vysílání zavřelo stream. Nikdy neodnavigovat pryč — poslat na stream.
   */
  if (!webinar) {
    const remembered = recallLiveUrl(id);
    if (remembered && typeof window !== 'undefined') window.location.replace(remembered);
    return <WebinarUnavailableNotice streamUrl={remembered} />;
  }

  const canonicalSeg = String(webinar.slug || webinar.id || '').trim();
  const search = searchParams.toString();
  const searchSuffix = search ? `?${search}` : '';

  // Kanonická live URL = slug (pokud existuje)
  if (id && canonicalSeg && id !== canonicalSeg) {
    return <Navigate to={`/webinar/${encodeURIComponent(canonicalSeg)}/live${searchSuffix}`} replace />;
  }

  // Preview z adminu (tlačítko „Náhled") → vždy zobrazit live stránku fullscreen
  if (isPreview) {
    return <WebinarLivePage webinar={webinar} />;
  }

  // Dev switch → přímý vstup bez čekání na live
  const devImminentId = typeof localStorage !== 'undefined' ? localStorage.getItem('vvb_dev_imminent') : null;
  if (devImminentId === webinar.id || devImminentId === webinar.slug) {
    return <WebinarLivePage webinar={webinar} />;
  }

  // Webinář ještě nezačal → přesměrovat na detail stránku (má sidebar, registraci atd.)
  const status = getLiveStatus(webinar);
  if (status === 'upcoming') {
    return <Navigate to={`/webinar/${encodeURIComponent(canonicalSeg)}`} replace />;
  }

  // Live nebo skončený → fullscreen live stránka
  return <WebinarLivePage webinar={webinar} />;
}
