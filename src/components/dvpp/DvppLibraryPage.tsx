/**
 * /knihovna — řádky jako Netflix: Pokračovat · Doporučeno · Řady · Nejsledovanější · Témata,
 * plus police certifikátů a hlasování „Natočíme příště“.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router';
import { Award, Lock, Play, ThumbsUp, Users } from 'lucide-react';
import { dvppApi, type DvppCatalog, type DvppCatalogVideo, type DvppCertificate, type DvppTopic } from '../../utils/dvppApi';
import { extractYoutubeId } from '../../utils/youtube';
import { DvppButton, DvppCard, DvppShell } from './DvppShell';
import { useDvppSession } from './DvppSession';

function thumbOf(v: DvppCatalogVideo): string {
  if (v.thumbnail) return v.thumbnail;
  const id = extractYoutubeId(v.youtubeUrl);
  return id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : '';
}

export function VideoTile({ video }: { video: DvppCatalogVideo }) {
  const pct = video.progress && video.progress.duration ? Math.min(100, Math.round((video.progress.position / video.progress.duration) * 100)) : 0;
  return (
    <Link to={`/knihovna/zaznam/${encodeURIComponent(video.id)}`} className="group block w-[240px] shrink-0 no-underline sm:w-[264px]">
      <div className="relative mb-2 aspect-video overflow-hidden rounded-[14px] bg-[#DEE4F1] shadow-[0_2px_10px_rgba(0,17,97,0.10)]">
        {thumbOf(video) ? <img src={thumbOf(video)} alt="" className="h-full w-full object-cover transition group-hover:scale-105" loading="lazy" /> : null}
        <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition group-hover:bg-black/20">
          <span className="flex h-11 w-11 scale-90 items-center justify-center rounded-full bg-white/90 opacity-0 shadow transition group-hover:scale-100 group-hover:opacity-100">
            {video.locked ? <Lock className="h-5 w-5 text-[#001161]" /> : <Play className="ml-0.5 h-5 w-5 text-[#001161]" fill="#001161" />}
          </span>
        </div>
        {video.certificate ? (
          <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-[#1f7a4d] px-2 py-0.5 text-[11px] font-bold text-white"><Award className="h-3 w-3" /> Osvědčení</span>
        ) : video.locked ? (
          <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-[#001161]/80 px-2 py-0.5 text-[11px] font-bold text-white"><Lock className="h-3 w-3" /> Pro sborovnu</span>
        ) : null}
        {pct > 0 && !video.progress?.completed ? (
          <div className="absolute inset-x-0 bottom-0 h-1.5 bg-black/30"><div className="h-full bg-[#F06632]" style={{ width: `${pct}%` }} /></div>
        ) : null}
      </div>
      <p className="line-clamp-2 px-0.5 text-[14px] font-bold leading-snug text-[#001161]">{video.name}</p>
      {video.lecturer ? <p className="px-0.5 text-[12px] text-[#6b7398]">{video.lecturer}</p> : null}
    </Link>
  );
}

export function VideoRow({ title, subtitle, videos }: { title: string; subtitle?: string; videos: DvppCatalogVideo[] }) {
  if (!videos.length) return null;
  return (
    <section className="mb-9">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="text-[20px] font-extrabold text-[#001161]">{title}</h2>
        {subtitle ? <span className="text-[13px] text-[#6b7398]">{subtitle}</span> : null}
      </div>
      <div className="-mx-4 flex gap-4 overflow-x-auto px-4 pb-2 [scrollbar-width:thin]">
        {videos.map((v) => <VideoTile key={v.id} video={v} />)}
      </div>
    </section>
  );
}

function AccessBanner({ catalog }: { catalog: DvppCatalog }) {
  const a = catalog.access;
  if (a.level === 'full') return null;
  if (a.level === 'guest') {
    return (
      <DvppCard className="mb-8 flex flex-col items-start gap-3 bg-[#001161] text-white md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-[18px] font-extrabold">Záznamy webinářů s osvědčením DVPP. Zdarma pro celou sborovnu.</p>
          <p className="text-[14px] text-white/80">Přihlaste se e-mailem, otevřete si tři záznamy a po krátkém ověření si stáhněte osvědčení. Když se přidá třetina sborovny, má knihovnu zdarma celá škola.</p>
        </div>
        <DvppButton to="/knihovna/prihlaseni">Přihlásit se e-mailem</DvppButton>
      </DvppCard>
    );
  }
  return (
    <DvppCard className="mb-8 flex flex-col items-start gap-3 md:flex-row md:items-center md:justify-between">
      <div>
        <p className="text-[16px] font-extrabold text-[#001161]">Máte otevřené {a.starterUsed} ze {a.starterLimit} záznamů zdarma.</p>
        <p className="text-[14px] text-[#3a4270]">Pozvěte jednoho kolegu a máte celý rok. Když se přidá třetina sborovny, má knihovnu celá škola.</p>
      </div>
      <DvppButton to="/sborovna" variant="secondary"><Users className="h-4 w-4" /> Otevřít sborovnu</DvppButton>
    </DvppCard>
  );
}

function CertificatesShelf({ certificates }: { certificates: DvppCertificate[] }) {
  if (!certificates.length) return null;
  const hours = certificates.reduce((a, c) => a + Number(c.hours || 0), 0);
  return (
    <section className="mb-9">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-[20px] font-extrabold text-[#001161]">Vaše osvědčení</h2>
        <span className="text-[13px] text-[#6b7398]">{certificates.length}× · {hours} h DVPP</span>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {certificates.map((c) => (
          <DvppCard key={c.id} className="flex items-start gap-3 p-4">
            <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#fde9df] text-[#F06632]"><Award className="h-5 w-5" /></span>
            <div className="min-w-0">
              <p className="line-clamp-2 text-[14px] font-bold text-[#001161]">{c.title}</p>
              <p className="text-[12px] text-[#6b7398]">{c.number} · {c.hours} h · {new Date(c.issued_at).toLocaleDateString('cs-CZ')}</p>
              {(c.webinar_id || c.video_id) ? (
                <Link to={`/knihovna/zaznam/${encodeURIComponent(c.video_id || c.webinar_id || '')}#osvedceni`} className="text-[12px] font-semibold text-[#001161]">Stáhnout PDF</Link>
              ) : null}
            </div>
          </DvppCard>
        ))}
      </div>
    </section>
  );
}

export function TopicsVoting({ compact = false }: { compact?: boolean }) {
  const { me } = useDvppSession();
  const [topics, setTopics] = useState<DvppTopic[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  useEffect(() => { dvppApi.topics().then((r) => setTopics(r.topics)).catch(() => {}); }, [me?.id]);
  const vote = async (id: string) => {
    if (!me) return;
    setBusy(id);
    try {
      const r = await dvppApi.vote(id);
      setTopics((ts) => ts.map((t) => (t.id === id ? { ...t, myVote: r.voted, votes_count: r.votes } : t)));
    } finally { setBusy(null); }
  };
  if (!topics.length) return null;
  return (
    <section className="mb-9">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-[20px] font-extrabold text-[#001161]">Natočíme příště</h2>
        <span className="text-[13px] text-[#6b7398]">Vítězné téma vysíláme do 4 týdnů</span>
      </div>
      <div className={`grid gap-3 ${compact ? 'sm:grid-cols-2' : 'sm:grid-cols-2 lg:grid-cols-3'}`}>
        {topics.map((t) => (
          <DvppCard key={t.id} className="flex items-start justify-between gap-3 p-4">
            <div>
              <p className="text-[14px] font-bold text-[#001161]">{t.title}</p>
              {t.description ? <p className="text-[12px] text-[#6b7398]">{t.description}</p> : null}
            </div>
            <button
              type="button"
              onClick={() => (me ? void vote(t.id) : undefined)}
              disabled={busy === t.id || !me}
              title={me ? 'Hlasovat' : 'Hlasovat mohou přihlášení'}
              className={`inline-flex shrink-0 items-center gap-1 rounded-full px-3 py-1.5 text-[13px] font-bold transition ${t.myVote ? 'bg-[#001161] text-white' : 'border border-[#001161]/15 bg-white text-[#001161] hover:bg-[#f0f2f8]'} disabled:opacity-60`}
            >
              <ThumbsUp className="h-3.5 w-3.5" /> <span className="tabular-nums">{t.votes_count}</span>
            </button>
          </DvppCard>
        ))}
      </div>
    </section>
  );
}

export function DvppLibraryPage() {
  const { me, loading } = useDvppSession();
  const location = useLocation();
  const [catalog, setCatalog] = useState<DvppCatalog | null>(null);
  const [certs, setCerts] = useState<DvppCertificate[]>([]);
  const [error, setError] = useState('');
  const joined = (location.state as { joined?: { code: string; schoolName: string } } | null)?.joined;

  useEffect(() => {
    if (loading) return;
    let cancelled = false;
    dvppApi.catalog().then((c) => { if (!cancelled) setCatalog(c); }).catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : 'Knihovnu se nepodařilo načíst.'); });
    if (me) dvppApi.certificates().then((r) => { if (!cancelled) setCerts(r.certificates); }).catch(() => {});
    return () => { cancelled = true; };
  }, [loading, me?.id]);

  const rows = useMemo(() => catalog?.rows ?? [], [catalog]);

  return (
    <DvppShell title="Knihovna DVPP zdarma" description="Záznamy webinářů pro učitele ZŠ s osvědčením DVPP. Zdarma pro celou sborovnu." path="/knihovna" wide>
      {joined ? (
        <DvppCard className="mb-6 bg-[#e8f5ee] text-[#1f5a3d]">Přidali jsme vás do sborovny <strong>{joined.schoolName}</strong>. Jakmile si pustíte první záznam, počítáte se do milníku školy.</DvppCard>
      ) : null}
      {catalog ? <AccessBanner catalog={catalog} /> : null}
      {me && !me.profileDone ? (
        <DvppCard className="mb-6 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <p className="text-[14px] text-[#3a4270]"><strong className="text-[#001161]">Doporučení podle vašich předmětů</strong> se zapne po krátkém kvízu (40 sekund).</p>
          <DvppButton to="/kviz" variant="ghost">Jaký jste učitel?</DvppButton>
        </DvppCard>
      ) : null}
      {error ? <p className="mb-6 rounded-xl bg-[#fde9df] px-4 py-3 text-[14px] text-[#8a3a1f]">{error}</p> : null}
      {!catalog && !error ? <p className="text-[#6b7398]">Načítáme knihovnu…</p> : null}
      {me ? <CertificatesShelf certificates={certs} /> : null}
      {rows.map((r) => <VideoRow key={r.key} title={r.title} subtitle={r.subtitle} videos={r.videos} />)}
      <TopicsVoting />
    </DvppShell>
  );
}
