/**
 * /knihovna — rozvržení jako Netflix: billboard s vybraným záznamem, pod ním řádky
 * (Pokračovat · Doporučeno · Řady · Nejsledovanější · Témata) se šipkami, police osvědčení
 * a hlasování „Natočíme příště“. Karty záznamů vypadají jako karty webinářů na homepage
 * (obrázek webináře na podkladu v jeho barvě, lišta s datem a tlačítkem).
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router';
import { Award, ChevronLeft, ChevronRight, Info, Lock, Play, ThumbsUp, Users } from 'lucide-react';
import { dvppApi, type DvppCatalog, type DvppCatalogVideo, type DvppCertificate, type DvppTopic } from '../../utils/dvppApi';
import { extractYoutubeId } from '../../utils/youtube';
import { DVPP_SERIF, DvppButton, DvppCard, DvppShell } from './DvppShell';
import { useDvppSession } from './DvppSession';

export const CARD_W = 300;
const CARD_GAP = 12;

/* Podklady karet podle předmětu — stejné barvy jako u webinářů na homepage (SubjectHowToWebinarsSection). */
const SUBJECT_WASH: Array<[RegExp, string]> = [
  [/matematika 1|1\. stup/i, '#5386FF'],
  [/matemat/i, '#CEDCFF'],
  [/fyzik/i, '#F8F3E2'],
  [/prirodopis|přírodopis/i, '#98FFDE'],
  [/prvouk/i, '#177E5D'],
  [/chemi/i, '#FFEC99'],
  [/cesky|česk|jazyk/i, '#FFE4E6'],
  [/umela|umělá|\bai\b/i, '#EFE3FF'],
  [/vividboard/i, '#DCEBFF'],
  [/vedeni|vedení/i, '#D8F3E6'],
  [/svp|švp|rvp/i, '#E8ECF7'],
  [/rozvoj/i, '#FFE7C2'],
];
const WASH_FALLBACK = ['#CEDCFF', '#F8F3E2', '#98FFDE', '#FFEC99', '#EFE3FF', '#FFE4E6'];

export function washOf(v: DvppCatalogVideo): string {
  if (v.coverBg && /^#[0-9a-f]{6}$/i.test(v.coverBg)) return v.coverBg;
  const hay = `${(v.subjects || []).join(' ')} ${v.name}`;
  for (const [re, color] of SUBJECT_WASH) if (re.test(hay)) return color;
  let h = 0;
  for (const ch of v.id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return WASH_FALLBACK[h % WASH_FALLBACK.length];
}

/** Světlý podklad → tmavý text, tmavý podklad → bílý (stejně jako homepage `washTextClass`). */
export function washIsDark(hex: string): boolean {
  const n = parseInt(hex.replace('#', ''), 16);
  const r = (n >> 16) & 255; const g = (n >> 8) & 255; const b = n & 255;
  return (r * 299 + g * 587 + b * 114) / 1000 < 150;
}

export function thumbOf(v: DvppCatalogVideo): string {
  if (v.thumbnail) return v.thumbnail;
  const id = extractYoutubeId(v.youtubeUrl);
  return id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : '';
}

function airedLabel(v: DvppCatalogVideo): string | null {
  if (!v.airedAt) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v.airedAt);
  if (!m) return null;
  return `${Number(m[3])}. ${Number(m[2])}. ${m[1]}`;
}

function progressPct(v: DvppCatalogVideo): number {
  return v.progress && v.progress.duration ? Math.min(100, Math.round((v.progress.position / v.progress.duration) * 100)) : 0;
}

/** Karta záznamu ve stylu webinářových karet na homepage. */
export function VideoTile({ video, guest = false }: { video: DvppCatalogVideo; guest?: boolean }) {
  const wash = washOf(video);
  const onDark = washIsDark(wash);
  const pct = progressPct(video);
  const thumb = thumbOf(video);
  const meta = [airedLabel(video) || 'Záznam', video.durationMinutes ? `${video.durationMinutes} min` : null].filter(Boolean).join(' · ');
  const cta = video.certificate ? 'Osvědčení' : video.locked ? (guest ? 'Ukázka' : 'Pro sborovnu') : pct > 0 && !video.progress?.completed ? 'Pokračovat' : 'Přehrát';
  return (
    <Link
      to={`/knihovna/zaznam/${encodeURIComponent(video.id)}`}
      aria-label={video.name}
      className="group relative block shrink-0 overflow-hidden rounded-[20px] no-underline transition-transform duration-200 ease-out will-change-transform hover:z-10 hover:scale-[1.05] hover:shadow-[0_18px_44px_rgba(0,0,0,0.35)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#F06632]"
      style={{ width: CARD_W, background: wash }}
    >
      <div className="relative aspect-[16/9] overflow-hidden" style={{ background: wash }}>
        {thumb ? (
          <img src={thumb} alt="" className="absolute inset-0 h-full w-full object-cover" loading="lazy" />
        ) : (
          <div className="absolute inset-0 flex items-end px-4 py-3.5">
            <span className={`text-[22px] font-bold leading-tight ${onDark ? 'text-white' : 'text-[#001161]'}`}>{video.name}</span>
          </div>
        )}
        {video.certificate ? (
          <span className="absolute left-2.5 top-2.5 inline-flex items-center gap-1 rounded-full bg-[#1f7a4d] px-2 py-0.5 text-[11px] font-bold text-white"><Award className="h-3 w-3" /> Osvědčení</span>
        ) : video.locked && !guest ? (
          <span className="absolute left-2.5 top-2.5 inline-flex items-center gap-1 rounded-full bg-[#001161]/85 px-2 py-0.5 text-[11px] font-bold text-white"><Lock className="h-3 w-3" /> Pro sborovnu</span>
        ) : null}
        {pct > 0 && !video.progress?.completed ? (
          <div className="absolute inset-x-0 bottom-0 h-1.5 bg-black/25"><div className="h-full bg-[#F06632]" style={{ width: `${pct}%` }} /></div>
        ) : null}
      </div>
      <div className="flex items-center justify-between gap-2 px-3.5 py-2.5">
        <span className={`truncate text-[12px] font-bold ${onDark ? 'text-white/90' : 'text-[#001161]/65'}`}>{meta}</span>
        <span className="inline-flex shrink-0 items-center gap-1 rounded-xl bg-[#001161] px-3 py-1.5 text-[12px] font-bold text-white transition-colors group-hover:bg-[#5B4FD8]">
          {video.locked && !guest && !video.certificate ? <Lock className="h-3 w-3" /> : <Play className="h-3 w-3" fill="currentColor" />} {cta}
        </span>
      </div>
    </Link>
  );
}

/** Řádek jako na Netflixu: posun po celé šířce, šipky na okrajích, bez viditelného scrollbaru. */
export function VideoRow({ title, subtitle, videos, guest = false, to }: { title: string; subtitle?: string; videos: DvppCatalogVideo[]; guest?: boolean; to?: string }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState({ left: 0, more: true });
  const update = () => {
    const el = ref.current; if (!el) return;
    setPos({ left: el.scrollLeft, more: el.scrollLeft + el.clientWidth < el.scrollWidth - 8 });
  };
  useEffect(() => { update(); }, [videos.length]);
  const scrollByDir = (dir: -1 | 1) => {
    const el = ref.current; if (!el) return;
    const step = Math.max(CARD_W + CARD_GAP, Math.floor(el.clientWidth / (CARD_W + CARD_GAP)) * (CARD_W + CARD_GAP));
    el.scrollBy({ left: dir * step, behavior: 'smooth' });
  };
  if (!videos.length) return null;
  return (
    <section className="group/row relative mb-8">
      <div className="mb-2.5 flex items-baseline justify-between gap-3 px-4 md:px-10">
        <h2 className="text-[20px] font-extrabold md:text-[22px]" style={{ color: 'var(--dvpp-heading)' }}>
          {to ? <Link to={to} className="no-underline hover:underline" style={{ color: 'inherit' }}>{title}</Link> : title}
        </h2>
        {subtitle ? <span className="shrink-0 text-[13px]" style={{ color: 'var(--dvpp-muted)' }}>{subtitle}</span> : null}
      </div>
      <div
        ref={ref}
        onScroll={update}
        className="flex items-stretch gap-3 overflow-x-auto overflow-y-hidden px-4 py-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:px-10"
      >
        {videos.map((v) => <VideoTile key={v.id} video={v} guest={guest} />)}
      </div>
      {pos.left > 10 ? (
        <button
          type="button"
          onClick={() => scrollByDir(-1)}
          aria-label="Posunout doleva"
          className="absolute left-0 top-[44px] bottom-0 hidden w-10 items-center justify-center bg-gradient-to-r from-[color:var(--dvpp-bg)] to-transparent opacity-0 transition group-hover/row:opacity-100 md:flex"
        >
          <span className="flex size-9 items-center justify-center rounded-full bg-white text-[#001161] shadow-lg"><ChevronLeft className="h-5 w-5" /></span>
        </button>
      ) : null}
      {pos.more ? (
        <button
          type="button"
          onClick={() => scrollByDir(1)}
          aria-label="Posunout doprava"
          className="absolute right-0 top-[44px] bottom-0 hidden w-10 items-center justify-center bg-gradient-to-l from-[color:var(--dvpp-bg)] to-transparent opacity-0 transition group-hover/row:opacity-100 md:flex"
        >
          <span className="flex size-9 items-center justify-center rounded-full bg-white text-[#001161] shadow-lg"><ChevronRight className="h-5 w-5" /></span>
        </button>
      ) : null}
    </section>
  );
}

/** Vybraný záznam nahoře: rozkoukaný, jinak doporučený, jinak nejsledovanější, jinak první z řady. */
function pickFeatured(catalog: DvppCatalog): { video: DvppCatalogVideo; reason: string } | null {
  const order: Array<[string, string]> = [
    ['continue', 'Pokračovat ve sledování'],
    ['recommended', 'Doporučeno pro vás'],
    ['top', 'Nejsledovanější tento měsíc'],
  ];
  for (const [key, reason] of order) {
    const row = catalog.rows.find((r) => r.key === key);
    if (row?.videos.length) return { video: row.videos[0], reason };
  }
  const series = catalog.rows.find((r) => r.key.startsWith('series:'));
  if (series?.videos.length) return { video: series.videos[0], reason: series.title };
  const any = catalog.rows.find((r) => r.videos.length);
  return any ? { video: any.videos[0], reason: any.title } : null;
}

function Billboard({ catalog, me }: { catalog: DvppCatalog; me: DvppCatalog['me'] }) {
  const picked = pickFeatured(catalog);
  if (!picked) return null;
  const { video, reason } = picked;
  const thumb = thumbOf(video);
  const wash = washOf(video);
  const pct = progressPct(video);
  const href = `/knihovna/zaznam/${encodeURIComponent(video.id)}`;
  const meta = [video.lecturer, video.durationMinutes ? `${video.durationMinutes} min` : null, ...(video.subjects || []).slice(0, 2)].filter(Boolean);
  const a = catalog.access;
  return (
    <section className="relative overflow-hidden" style={{ background: '#050B2E' }}>
      <div className="absolute inset-0">
        <div className="absolute inset-y-0 right-0 w-full md:w-[58%]" style={{ background: wash }}>
          {thumb ? <img src={thumb} alt="" className="absolute inset-0 h-full w-full object-cover object-right" /> : null}
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-[#050B2E] via-[#050B2E]/55 to-transparent md:hidden" />
        <div className="absolute inset-0 hidden md:block" style={{ background: 'linear-gradient(90deg, #050B2E 0%, #050B2E 44%, rgba(5,11,46,0.92) 56%, rgba(5,11,46,0.35) 74%, rgba(5,11,46,0) 92%)' }} />
        <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-[#050B2E] to-transparent" />
      </div>
      <div className="relative mx-auto max-w-[1400px] px-4 pb-14 pt-[46vw] md:px-10 md:pb-24 md:pt-24 lg:pt-28">
        <div className="max-w-[600px]">
          <p className="mb-3 text-[12px] font-black uppercase tracking-[0.18em] text-[#FF9A6B]">{reason}</p>
          <h1 className="mb-3 text-[34px] leading-[1.05] text-white md:text-[48px] lg:text-[56px]" style={{ fontFamily: DVPP_SERIF, textWrap: 'balance' }}>{video.name}</h1>
          {meta.length ? <p className="mb-3 text-[14px] font-semibold text-white/75">{meta.join(' · ')}</p> : null}
          {video.description ? <div className="mb-5 line-clamp-3 max-w-[520px] text-[15px] leading-relaxed text-white/85 [&_*]:!m-0" dangerouslySetInnerHTML={{ __html: video.description }} /> : null}
          {pct > 0 && !video.progress?.completed ? (
            <div className="mb-5 max-w-[320px]">
              <div className="h-1.5 overflow-hidden rounded-full bg-white/20"><div className="h-full bg-[#F06632]" style={{ width: `${pct}%` }} /></div>
              <p className="mt-1 text-[12px] text-white/65">Zhlédnuto {pct} %</p>
            </div>
          ) : null}
          <div className="flex flex-wrap items-center gap-2.5">
            {me ? (
              <>
                <DvppButton to={href} className="px-6 text-[15px]"><Play className="h-4 w-4" fill="currentColor" /> {pct > 0 && !video.progress?.completed ? 'Pokračovat' : video.locked ? 'Otevřít' : 'Přehrát'}</DvppButton>
                <DvppButton to={href} variant="glass"><Info className="h-4 w-4" /> Více informací</DvppButton>
              </>
            ) : (
              <>
                <DvppButton to={href} className="px-6 text-[15px]"><Play className="h-4 w-4" fill="currentColor" /> Přehrát ukázku</DvppButton>
                <DvppButton to="/knihovna/prihlaseni" variant="glass"><Users className="h-4 w-4" /> Přihlásit se e-mailem</DvppButton>
              </>
            )}
          </div>
          {!me ? (
            <p className="mt-4 max-w-[520px] text-[13px] text-white/65">Prvních 10 minut každého záznamu je bez přihlášení. Po přihlášení e-mailem máte tři záznamy a osvědčení DVPP; když se přidá třetina sborovny, celou knihovnu má zdarma celá škola.</p>
          ) : a.level === 'starter' ? (
            <p className="mt-4 max-w-[520px] text-[13px] text-white/65">Máte otevřené {a.starterUsed} ze {a.starterLimit} záznamů zdarma. <Link to="/sborovna" className="font-bold text-white">Pozvěte kolegu</Link> a máte celý rok.</p>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function CertificatesShelf({ certificates }: { certificates: DvppCertificate[] }) {
  if (!certificates.length) return null;
  const hours = certificates.reduce((a, c) => a + Number(c.hours || 0), 0);
  return (
    <section className="mb-8 px-4 md:px-10">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-[20px] font-extrabold md:text-[22px]" style={{ color: 'var(--dvpp-heading)' }}>Vaše osvědčení</h2>
        <span className="text-[13px]" style={{ color: 'var(--dvpp-muted)' }}>{certificates.length}× · {hours} h DVPP</span>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {certificates.map((c) => (
          <DvppCard key={c.id} className="flex w-[300px] shrink-0 items-start gap-3 p-4">
            <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#F06632]/15 text-[#FF9A6B]"><Award className="h-5 w-5" /></span>
            <div className="min-w-0">
              <p className="line-clamp-2 text-[14px] font-bold" style={{ color: 'var(--dvpp-heading)' }}>{c.title}</p>
              <p className="text-[12px]" style={{ color: 'var(--dvpp-muted)' }}>{c.number} · {c.hours} h · {new Date(c.issued_at).toLocaleDateString('cs-CZ')}</p>
              {(c.webinar_id || c.video_id) ? (
                <Link to={`/knihovna/zaznam/${encodeURIComponent(c.video_id || c.webinar_id || '')}#osvedceni`} className="text-[12px] font-semibold" style={{ color: 'var(--dvpp-heading)' }}>Stáhnout PDF</Link>
              ) : null}
            </div>
          </DvppCard>
        ))}
      </div>
    </section>
  );
}

export function TopicsVoting({ compact = false, padded = true }: { compact?: boolean; padded?: boolean }) {
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
    <section className={`mb-9 ${padded ? 'px-4 md:px-10' : ''}`}>
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-[20px] font-extrabold md:text-[22px]" style={{ color: 'var(--dvpp-heading)' }}>Natočíme příště</h2>
        <span className="text-[13px]" style={{ color: 'var(--dvpp-muted)' }}>Vítězné téma vysíláme do 4 týdnů</span>
      </div>
      <div className={`grid gap-3 ${compact ? 'sm:grid-cols-2' : 'sm:grid-cols-2 lg:grid-cols-3'}`}>
        {topics.map((t) => (
          <DvppCard key={t.id} className="flex items-start justify-between gap-3 p-4">
            <div>
              <p className="text-[14px] font-bold" style={{ color: 'var(--dvpp-heading)' }}>{t.title}</p>
              {t.description ? <p className="text-[12px]" style={{ color: 'var(--dvpp-muted)' }}>{t.description}</p> : null}
            </div>
            <button
              type="button"
              onClick={() => (me ? void vote(t.id) : undefined)}
              disabled={busy === t.id || !me}
              title={me ? 'Hlasovat' : 'Hlasovat mohou přihlášení'}
              className="inline-flex shrink-0 items-center gap-1 rounded-full border px-3 py-1.5 text-[13px] font-bold transition disabled:opacity-60"
              style={t.myVote
                ? { background: 'var(--dvpp-chip-active)', color: 'var(--dvpp-chip-active-ink)', borderColor: 'transparent' }
                : { background: 'var(--dvpp-chip)', color: 'var(--dvpp-heading)', borderColor: 'var(--dvpp-line)' }}
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
  const guest = !me;

  return (
    <DvppShell title="Knihovna DVPP zdarma" description="Záznamy webinářů pro učitele ZŠ s osvědčením DVPP. Zdarma pro celou sborovnu." path="/knihovna" wide tone="dark" flush>
      {catalog ? <Billboard catalog={catalog} me={me} /> : null}
      <div className={catalog ? '-mt-6 relative' : 'pt-8'}>
        {joined ? (
          <div className="mx-4 mb-6 rounded-2xl bg-[#1f7a4d] px-4 py-3 text-[14px] text-white md:mx-10">Přidali jsme vás do sborovny <strong>{joined.schoolName}</strong>. Jakmile si pustíte první záznam, počítáte se do milníku školy.</div>
        ) : null}
        {me && !me.profileDone ? (
          <div className="mx-4 mb-6 flex flex-col gap-2 rounded-2xl border border-white/12 bg-white/6 px-4 py-3 md:mx-10 md:flex-row md:items-center md:justify-between">
            <p className="text-[14px] text-white/80"><strong className="text-white">Doporučení podle vašich předmětů</strong> se zapne po krátkém kvízu (40 sekund).</p>
            <DvppButton to="/kviz" variant="glass">Jaký jste učitel?</DvppButton>
          </div>
        ) : null}
        {error ? <p className="mx-4 mb-6 rounded-xl bg-[#fde9df] px-4 py-3 text-[14px] text-[#8a3a1f] md:mx-10">{error}</p> : null}
        {!catalog && !error ? <p className="px-4 md:px-10" style={{ color: 'var(--dvpp-muted)' }}>Načítáme knihovnu…</p> : null}
        {me ? <CertificatesShelf certificates={certs} /> : null}
        {rows.map((r) => <VideoRow key={r.key} title={r.title} subtitle={r.subtitle} videos={r.videos} guest={guest} />)}
        <TopicsVoting />
      </div>
    </DvppShell>
  );
}
