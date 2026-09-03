import React, { useEffect } from 'react';
import { useParams, Navigate, useSearchParams } from 'react-router';
import { useWebinars } from '../contexts/WebinarsContext';
import { WebinarLivePage } from './WebinarLivePage';
import { WebinarLiveRedirectPage } from './WebinarLiveRedirectPage';
import { Loader2 } from 'lucide-react';
import type { Webinar } from '../data/webinars';
import { recallLiveUrl, rememberLiveUrl } from '../utils/webinarLiveFallback';
import { liveStreamUrlOf, resolveLiveDelivery } from '../utils/webinarLiveDelivery';
import { WebinarUnavailableNotice } from './WebinarUnavailableNotice';

function getLiveStatus(w: Webinar): 'upcoming' | 'live' | 'ended' {
  const [h, m] = (w.time || '18:00').split(':').map(Number);
  const date = new Date(w.year, (w.monthNum || 1) - 1, w.day || 1, h || 18, m || 0);
  const diffMin = (Date.now() - date.getTime()) / 60000;
  if (diffMin < -60) return 'upcoming';
  if (diffMin < 150) return 'live';
  return 'ended';
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
    const url = liveStreamUrlOf(webinar);
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

  /**
   * Režim „zapsat příchod a přesměrovat na YouTube" — vlastní přehrávač, chat
   * ani reakce se nezobrazují, takže výpadek webu nemůže divákovi zavřít stream.
   * Bez vyplněné URL streamu není kam přesměrovat → padáme na běžnou live stránku.
   */
  const delivery = resolveLiveDelivery(webinar);
  const redirectUrl = delivery.kind === 'youtube_redirect' ? delivery.streamUrl : '';

  // Preview z adminu (tlačítko „Náhled") → vždy zobrazit live stránku fullscreen
  if (isPreview) {
    return redirectUrl
      ? <WebinarLiveRedirectPage webinar={webinar} streamUrl={redirectUrl} />
      : <WebinarLivePage webinar={webinar} />;
  }

  // Dev switch → přímý vstup bez čekání na live
  const devImminentId = typeof localStorage !== 'undefined' ? localStorage.getItem('vvb_dev_imminent') : null;
  if (devImminentId === webinar.id || devImminentId === webinar.slug) {
    return redirectUrl
      ? <WebinarLiveRedirectPage webinar={webinar} streamUrl={redirectUrl} />
      : <WebinarLivePage webinar={webinar} />;
  }

  // Webinář ještě nezačal → přesměrovat na detail stránku (má sidebar, registraci atd.)
  const status = getLiveStatus(webinar);
  if (status === 'upcoming') {
    return <Navigate to={`/webinar/${encodeURIComponent(canonicalSeg)}`} replace />;
  }

  // Probíhá a je v režimu přesměrování → zapsat příchod a poslat na YouTube
  if (status === 'live' && redirectUrl) {
    return <WebinarLiveRedirectPage webinar={webinar} streamUrl={redirectUrl} />;
  }

  // Live nebo skončený → fullscreen live stránka (po skončení i se záznamem)
  return <WebinarLivePage webinar={webinar} />;
}
