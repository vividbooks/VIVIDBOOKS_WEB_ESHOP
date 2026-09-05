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
import { DvppYouTubePlayer, type DvppPlayerHandle } from './DvppYouTubePlayer';
import { currentChapterIndex, formatTime } from '../../supabase/functions/server/dvpp/content';

const PROGRESS_SAVE_EVERY_S = 30;
const GUEST_PREVIEW_SECONDS = 600;

export function DvppPlayerPage() {
  const { id = '' } = useParams();
  const { me, loading, refresh } = useDvppSession();
  const [catalog, setCatalog] = useState<DvppCatalog | null>(null);
  const [error, setError] = useState('');
  const [lockedMsg, setLockedMsg] = useState('');
  const [cert, setCert] = useState<DvppCertificate | null>(null);
  const [certError, setCertError] = useState('');
  const [certBusy, setCertBusy] = useState(false);
  const lastSaved = useRef<number>(0);
  const [previewEnded, setPreviewEnded] = useState(false);
  const playerRef = useRef<DvppPlayerHandle | null>(null);
  const [position, setPosition] = useState(0);

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
  const trailerId = video?.trailerUrl ? extractYoutubeId(video.trailerUrl) : null;
  /* Host: upoutávka (pokud je), jinak prvních 10 minut záznamu. */
  const guestVideoId = trailerId || ytId;
  const chapters = Array.isArray(video?.chapters) ? video!.chapters! : [];
  const activeChapter = currentChapterIndex(chapters, position);

  /* Progress: první zápis hned po startu (= událost play + kontrola limitu), pak každých 30 s podle skutečné pozice v přehrávači. */
  const saveProgress = async (position: number, duration: number | null, completed = false) => {
    if (!video) return;
    try {
      const r = await dvppApi.progress({ videoId: video.id, position: Math.floor(position), duration: duration ? Math.floor(duration) : null, completed });
      if (r.activated) void refresh();
    } catch (e) {
      const err = e as Error & { code?: string };
      if (err.code === 'starter_limit') setLockedMsg(err.message);
    }
  };
  useEffect(() => {
    if (!canPlay || !video) return;
    lastSaved.current = 0;
    void saveProgress(video.progress?.position || 0, null);
  }, [canPlay, video?.id]);

  const onProgress = (position: number, duration: number) => {
    setPosition(position);
    if (!canPlay) return;
    if (position - lastSaved.current >= PROGRESS_SAVE_EVERY_S) {
      lastSaved.current = position;
      void saveProgress(position, duration, duration > 0 && position >= duration * 0.9);
    }
  };

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
              {guestVideoId && !lockedMsg && (canPlay || (!me && !previewEnded)) ? (
                <DvppYouTubePlayer
                  ref={playerRef}
                  videoId={canPlay ? ytId! : guestVideoId}
                  startSeconds={canPlay ? (video.progress?.position || 0) : 0}
                  limitSeconds={canPlay || trailerId ? null : GUEST_PREVIEW_SECONDS}
                  onProgress={onProgress}
                  onLimitReached={() => { setPreviewEnded(true); void dvppApi.event('preview_limit', { videoId: video.id }); }}
                  onEnded={() => { if (canPlay) void saveProgress(video.durationMinutes ? video.durationMinutes * 60 : 0, null, true); else setPreviewEnded(true); }}
                  autoplay={canPlay}
                />
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center text-white">
                  {video.thumbnail ? <img src={video.thumbnail} alt="" className="absolute inset-0 h-full w-full object-cover opacity-30" /> : null}
                  <span className="relative inline-flex h-12 w-12 items-center justify-center rounded-full bg-white/15"><Lock className="h-6 w-6" /></span>
                  {!me ? (
                    <>
                      <p className="relative text-[18px] font-extrabold">{previewEnded ? (trailerId ? 'Celý záznam po přihlášení' : 'Prvních 10 minut máte za sebou') : 'Záznam otevřete po přihlášení e-mailem'}</p>
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
            {!me && !previewEnded && guestVideoId ? <p className="mb-3 rounded-xl bg-[#efe8ff] px-3 py-2 text-[13px] text-[#3a2470]">{trailerId ? 'Tohle je upoutávka.' : 'Prvních 10 minut je bez přihlášení.'} Celý záznam a osvědčení DVPP máte po přihlášení e-mailem, bez hesla.</p> : null}
            {chapters.length ? (
              <div className="mb-4 flex flex-wrap gap-2">
                {chapters.map((c, i) => (
                  <button
                    key={`${c.t}-${i}`}
                    type="button"
                    disabled={!canPlay}
                    onClick={() => playerRef.current?.seekTo(c.t)}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[12px] font-semibold transition disabled:opacity-50 ${i === activeChapter ? 'border-[#001161] bg-[#001161] text-white' : 'border-[#001161]/15 bg-white text-[#001161] hover:bg-[#f0f2f8]'}`}
                    title={canPlay ? 'Skočit na kapitolu' : 'Kapitoly fungují po přihlášení'}
                  >
                    <span className="tabular-nums opacity-70">{formatTime(c.t)}</span> {c.title}
                  </button>
                ))}
              </div>
            ) : null}
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
