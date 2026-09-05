/**
 * /knihovna/zaznam/:id — přehrávač s ukládáním pozice, zámek podle přístupu, osvědčení.
 * Osvědčení vzniká přes existující DVPP dotazník (/webinar/{slug}/dvpp-dotaznik); tady se
 * po jeho dokončení zaeviduje (POST /dvpp/certificate) a nabídne PDF.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router';
import { Award, ChevronLeft, Lock, Users } from 'lucide-react';
import { dvppApi, type DvppCatalog, type DvppCatalogVideo, type DvppCertificate } from '../../utils/dvppApi';
import { extractYoutubeId } from '../../utils/youtube';
import { DvppButton, DvppCard, DvppShell } from './DvppShell';
import { useDvppSession } from './DvppSession';
import { VideoRow } from './DvppLibraryPage';

const PROGRESS_INTERVAL_MS = 30_000;

export function DvppPlayerPage() {
  const { id = '' } = useParams();
  const { me, loading, refresh } = useDvppSession();
  const [catalog, setCatalog] = useState<DvppCatalog | null>(null);
  const [error, setError] = useState('');
  const [lockedMsg, setLockedMsg] = useState('');
  const [cert, setCert] = useState<DvppCertificate | null>(null);
  const [certError, setCertError] = useState('');
  const [certBusy, setCertBusy] = useState(false);
  const startedAt = useRef<number>(Date.now());
  const timer = useRef<number | null>(null);

  useEffect(() => {
    if (loading) return;
    let cancelled = false;
    dvppApi.catalog().then((c) => { if (!cancelled) setCatalog(c); }).catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : 'Nepodařilo se načíst.'); });
    return () => { cancelled = true; };
  }, [loading, me?.id, id]);

  const video: DvppCatalogVideo | null = useMemo(() => {
    if (!catalog) return null;
    for (const r of catalog.rows) { const v = r.videos.find((x) => x.id === id || x.slug === id); if (v) return v; }
    return null;
  }, [catalog, id]);

  const related = useMemo(() => {
    if (!catalog || !video) return [];
    const row = catalog.rows.find((r) => r.key.startsWith('topic:') && r.videos.some((v) => v.id === video.id));
    return (row?.videos || []).filter((v) => v.id !== video.id).slice(0, 8);
  }, [catalog, video]);

  const canPlay = !!video && !video.locked && !!me;
  const ytId = video ? extractYoutubeId(video.youtubeUrl) : null;

  /* Progress: první zápis hned (= událost play, kontrola limitu), pak každých 30 s podle času na stránce. */
  useEffect(() => {
    if (!canPlay || !video) return;
    startedAt.current = Date.now();
    const send = async (completed = false) => {
      const position = Math.floor((Date.now() - startedAt.current) / 1000) + (video.progress?.position || 0);
      try {
        const r = await dvppApi.progress({ videoId: video.id, position, duration: video.durationMinutes ? video.durationMinutes * 60 : null, completed });
        if (r.activated) void refresh();
      } catch (e) {
        const err = e as Error & { code?: string };
        if (err.code === 'starter_limit') setLockedMsg(err.message);
      }
    };
    void send();
    timer.current = window.setInterval(() => void send(), PROGRESS_INTERVAL_MS);
    return () => { if (timer.current) window.clearInterval(timer.current); };
  }, [canPlay, video?.id]);

  const issue = async () => {
    if (!video) return;
    setCertBusy(true); setCertError('');
    try {
      const r = await dvppApi.issueCertificate({ webinarId: video.webinarSlugForSurvey || video.id, videoId: video.id, title: video.name, hours: video.durationMinutes ? Math.max(1, Math.round(video.durationMinutes / 60)) : 2, lecturer: video.lecturer || null });
      setCert(r.certificate);
    } catch (e) {
      setCertError(e instanceof Error ? e.message : 'Osvědčení se nepodařilo vystavit.');
    } finally { setCertBusy(false); }
  };

  const surveyHref = video?.webinarSlugForSurvey ? `/webinar/${encodeURIComponent(video.webinarSlugForSurvey)}/dvpp-dotaznik` : null;

  return (
    <DvppShell title={video ? video.name : 'Záznam'} description={video?.description?.slice(0, 160) || 'Záznam webináře s osvědčením DVPP.'} path={`/knihovna/zaznam/${id}`} wide>
      <Link to="/knihovna" className="mb-4 inline-flex items-center gap-1 text-[13px] font-semibold text-[#001161] no-underline"><ChevronLeft className="h-4 w-4" /> Zpět do knihovny</Link>
      {error ? <p className="rounded-xl bg-[#fde9df] px-4 py-3 text-[14px] text-[#8a3a1f]">{error}</p> : null}
      {!catalog && !error ? <p className="text-[#6b7398]">Načítáme…</p> : null}
      {catalog && !video ? <p className="text-[#6b7398]">Tenhle záznam v knihovně není.</p> : null}
      {video ? (
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div>
            <div className="relative mb-4 aspect-video overflow-hidden rounded-[18px] bg-[#0d1440] shadow-[0_6px_24px_rgba(0,17,97,0.18)]">
              {canPlay && ytId && !lockedMsg ? (
                <iframe
                  title={video.name}
                  src={`https://www.youtube.com/embed/${ytId}?rel=0&modestbranding=1&autoplay=1${video.progress?.position ? `&start=${video.progress.position}` : ''}`}
                  className="absolute inset-0 h-full w-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center text-white">
                  {video.thumbnail ? <img src={video.thumbnail} alt="" className="absolute inset-0 h-full w-full object-cover opacity-30" /> : null}
                  <span className="relative inline-flex h-12 w-12 items-center justify-center rounded-full bg-white/15"><Lock className="h-6 w-6" /></span>
                  {!me ? (
                    <>
                      <p className="relative text-[18px] font-extrabold">Záznam otevřete po přihlášení e-mailem</p>
                      <p className="relative max-w-[440px] text-[14px] text-white/80">Bez hesla. Tři záznamy zdarma, po ověření osvědčení DVPP. Celá sborovna zdarma, když se přidá třetina sboru.</p>
                      <DvppButton to={`/knihovna/prihlaseni?next=${encodeURIComponent(`/knihovna/zaznam/${id}`)}`} className="relative">Přihlásit se</DvppButton>
                    </>
                  ) : (
                    <>
                      <p className="relative text-[18px] font-extrabold">Tři záznamy zdarma jste už otevřeli</p>
                      <p className="relative max-w-[440px] text-[14px] text-white/80">{lockedMsg || 'Pozvěte jednoho kolegu a máte celý rok. Když se přidá třetina sborovny, má knihovnu zdarma celá škola.'}</p>
                      <DvppButton to="/sborovna" className="relative"><Users className="h-4 w-4" /> Otevřít sborovnu</DvppButton>
                    </>
                  )}
                </div>
              )}
            </div>
            <h1 className="mb-1 text-[26px] font-extrabold leading-tight text-[#001161]">{video.name}</h1>
            <p className="mb-4 text-[13px] text-[#6b7398]">{[video.lecturer, video.durationMinutes ? `${video.durationMinutes} min` : null, ...(video.subjects || [])].filter(Boolean).join(' · ')}</p>
            {video.description ? <div className="prose prose-sm max-w-none text-[15px] text-[#3a4270]" dangerouslySetInnerHTML={{ __html: video.description }} /> : null}
          </div>
          <aside className="space-y-4">
            <DvppCard id="osvedceni">
              <div className="mb-2 flex items-center gap-2"><Award className="h-5 w-5 text-[#F06632]" /><h2 className="text-[16px] font-extrabold text-[#001161]">Osvědčení DVPP</h2></div>
              {video.certificate || cert ? (
                <>
                  <p className="mb-3 text-[14px] text-[#3a4270]">Osvědčení <strong>{(cert || video.certificate)?.number}</strong> máte na polici. PDF si stáhnete v dotazníku k záznamu.</p>
                  {surveyHref ? <DvppButton to={surveyHref} variant="secondary" className="w-full">Otevřít PDF</DvppButton> : null}
                </>
              ) : (
                <>
                  <p className="mb-3 text-[14px] text-[#3a4270]">Po zhlédnutí odpovíte na 4 otázky k obsahu. Osvědčení má číslo, rozsah hodin a lektora, uznávají ho ředitelé i šablony OP JAK.</p>
                  {surveyHref ? <DvppButton to={surveyHref} variant="secondary" className="mb-2 w-full" disabled={!canPlay}>Vyplnit ověřovací dotazník</DvppButton> : <p className="text-[13px] text-[#6b7398]">K tomuto záznamu zatím dotazník nemáme.</p>}
                  {surveyHref && me ? <DvppButton onClick={() => void issue()} variant="ghost" className="w-full" disabled={certBusy}>Mám dotazník hotový, uložit osvědčení</DvppButton> : null}
                  {certError ? <p className="mt-2 text-[13px] text-[#b3261e]">{certError}</p> : null}
                </>
              )}
            </DvppCard>
            {me ? (
              <DvppCard>
                <div className="mb-2 flex items-center gap-2"><Users className="h-5 w-5 text-[#001161]" /><h2 className="text-[16px] font-extrabold text-[#001161]">Kolegům se bude hodit</h2></div>
                <p className="mb-3 text-[14px] text-[#3a4270]">Pošlete jim odkaz na sborovnu. Za prvního kolegu máte rok záznamů, za třetinu sboru celou školu.</p>
                <DvppButton to="/sborovna" variant="ghost" className="w-full">Otevřít sborovnu</DvppButton>
              </DvppCard>
            ) : null}
          </aside>
        </div>
      ) : null}
      {related.length ? <div className="mt-10"><VideoRow title="Ze stejného tématu" videos={related} /></div> : null}
    </DvppShell>
  );
}
