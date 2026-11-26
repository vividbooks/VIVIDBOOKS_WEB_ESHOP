/**
 * DVPP TV — prototyp (neveřejná adresa, viz src/config/dvppTvPreview.ts).
 *
 * Co je skutečné: záznamy webinářů (DvppVideosContext, stejné jako /knihovna), nadcházející
 * webináře (WebinarsContext), odkazy na přehrávač, přihlášení a sborovnu.
 * Co je atrapa: sekce BOZP a formulář registrace školy (nic se neodesílá ani neukládá).
 */
import React, { useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { ChevronLeft, ChevronRight, HardHat, Loader2, Play, Radio, ShieldCheck, Sparkles, Users } from 'lucide-react';
import { SEOHead } from '../SEOHead';
import { useDvppVideos, type DvppVideo } from '../../contexts/DvppVideosContext';
import { useWebinars } from '../../contexts/WebinarsContext';
import { DvppVideoCard } from '../DvppVideoCard';
import { WebinarCard } from '../WebinarCard';
import { DVPPTV_TEASER } from '../../config/dvppTvPreview';

const ff = "'Fenomen Sans', sans-serif";

/** Miniaplikace zdarma — zatím vedou na stránku webináře, kde se aplikace představuje. */
const MINI_APPS = [
  {
    title: 'Rýsování na tabuli',
    text: 'Kružítko, pravítko a úhloměr, které na interaktivní tabuli opravdu fungují.',
    slug: 'webinar-novy-nastroj-na-rysovani-zdarma',
    image: 'https://cdn.prod.website-files.com/5dfa34b974e1f6fab1ef33cd/69844caf9b46a4c4359bc1ba_rysovani.png',
    bg: '#ffe3c4',
  },
  {
    title: 'Elektrický obvod',
    text: 'Žáci si zapojí obvod sami, bez stavebnice a bez rozsypaných součástek.',
    slug: 'jak-na-elektricky-obvod---nova-aplikace-zdarma',
    image: 'https://cdn.prod.website-files.com/5dfa34b974e1f6fab1ef33cd/69b9382401be3943500e85f2_el%20obvod.png',
    bg: '#dff1ff',
  },
  {
    title: 'Fyzikální simulace',
    text: 'Zkoumat, měřit a objevovat přímo v hodině fyziky.',
    slug: 'novy-nastroj-na-fyzikalni-simulace',
    image: 'https://iekkundgizzdbmkzatdl.supabase.co/storage/v1/object/public/make-93a20b6f-images/1778192241307-vwpop41ez2j.png',
    bg: '#e6f7e9',
  },
  {
    title: 'Přijímací zkoušky',
    text: 'Procvičování na jednotné přijímací zkoušky z matematiky.',
    slug: 'predstaveni-aplikace-prijimaci-zkousky',
    image: 'https://iekkundgizzdbmkzatdl.supabase.co/storage/v1/object/public/make-93a20b6f-images/1792617143356-mo7xy7c9wgk.jpg',
    bg: '#001161',
  },
  {
    title: 'Vividboard',
    text: 'Interaktivní tabule a aktivity pro třídu, které si připravíte za pár minut.',
    slug: 'jak-na-tvorbu-interaktivnich-materialu',
    image: 'https://iekkundgizzdbmkzatdl.supabase.co/storage/v1/object/public/make-93a20b6f-images/1792670062972-s2bwtr4b08.jpg',
    bg: '#1e2436',
  },
];

const BOZP_TOPICS = [
  'Úvodní a opakované školení BOZP a PO pro pedagogy',
  'Dohled nad žáky: o přestávkách, na akcích a na výletech',
  'První pomoc ve škole a záznam o úrazu žáka',
  'Bezpečnost v tělocvičně, v dílnách a v laboratoři',
];

function Section({ id, title, kicker, children }: { id?: string; title: string; kicker?: string; children: React.ReactNode }) {
  return (
    <section id={id} className="mx-auto w-full max-w-[1240px] px-5 py-10 md:px-8 md:py-14">
      {kicker ? <p className="mb-2 text-[12px] font-black uppercase tracking-[0.18em] text-[#ff9b5e]">{kicker}</p> : null}
      <h2 className="mb-6 text-[26px] font-black leading-tight text-white md:text-[34px]">{title}</h2>
      {children}
    </section>
  );
}

/** Řádek karet přes celou šířku se šipkami (jako v knihovně). */
function VideoRow({ title, videos }: { title: string; videos: DvppVideo[] }) {
  const navigate = useNavigate();
  const ref = useRef<HTMLDivElement>(null);
  const scroll = (dir: number) => ref.current?.scrollBy({ left: dir * (ref.current.clientWidth * 0.8), behavior: 'smooth' });
  if (videos.length === 0) return null;
  return (
    <div className="group/row relative mb-9">
      <h3 className="mb-3 px-5 text-[19px] font-black text-white md:px-8">
        {title} <span className="ml-1 text-[14px] font-bold text-white/40">{videos.length}</span>
      </h3>
      <div className="relative">
        <button type="button" aria-label="Posunout zpět" onClick={() => scroll(-1)}
          className="absolute left-0 top-0 z-10 hidden h-full w-12 items-center justify-center bg-gradient-to-r from-[#0b1020] to-transparent text-white opacity-0 transition group-hover/row:opacity-100 md:flex">
          <ChevronLeft className="h-8 w-8" />
        </button>
        <div ref={ref} className="flex gap-4 overflow-x-auto scroll-smooth px-5 pb-3 md:px-8 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {videos.map((video) => (
            <div key={video.id} className="w-[250px] shrink-0 md:w-[300px] [&_.aspect-video]:h-[141px] [&_.aspect-video]:shrink-0 md:[&_.aspect-video]:h-[169px]">
              <DvppVideoCard video={video} onClick={() => navigate(`/knihovna/zaznam/${encodeURIComponent(video.id)}`)} />
            </div>
          ))}
        </div>
        <button type="button" aria-label="Posunout dál" onClick={() => scroll(1)}
          className="absolute right-0 top-0 z-10 hidden h-full w-12 items-center justify-center bg-gradient-to-l from-[#0b1020] to-transparent text-white opacity-0 transition group-hover/row:opacity-100 md:flex">
          <ChevronRight className="h-8 w-8" />
        </button>
      </div>
    </div>
  );
}

/** Atrapa registrace školy: oddělené souhlasy, nic se neukládá. */
function SchoolSignupMock() {
  const [sent, setSent] = useState(false);
  const [newsletter, setNewsletter] = useState(false);
  const [phoneOk, setPhoneOk] = useState(false);
  const input = 'w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-[15px] text-white placeholder-white/35 outline-none focus:border-[#ff9b5e]';
  if (sent) {
    return (
      <div className="rounded-[24px] border border-[#ff9b5e]/40 bg-[#ff9b5e]/10 p-6 text-white">
        <p className="text-[18px] font-black">Tohle je zatím jen prototyp, nic se neuložilo.</p>
        <p className="mt-2 text-[15px] text-white/75">
          Ve skutečném provozu by učitel dostal přihlašovací odkaz e-mailem a škola by se mu propojila podle e-mailu nebo kódu školy
          (dnes už to tak funguje v knihovně: <Link to="/knihovna/prihlaseni" className="underline">přihlášení</Link> a{' '}
          <Link to="/sborovna" className="underline">sborovna</Link>).
        </p>
        <button type="button" onClick={() => setSent(false)} className="mt-4 text-[14px] font-bold text-[#ff9b5e] underline">Zkusit znovu</button>
      </div>
    );
  }
  return (
    <form
      className="grid gap-3 rounded-[24px] border border-white/10 bg-white/[0.04] p-6"
      onSubmit={(e) => { e.preventDefault(); setSent(true); }}
    >
      <div className="grid gap-3 md:grid-cols-2">
        <input className={input} placeholder="Jméno a příjmení" required />
        <input className={input} type="email" placeholder="Školní e-mail" required />
      </div>
      <input className={input} placeholder="Škola (název nebo obec)" required />
      <input className={input} type="tel" placeholder="Telefon (nepovinné)" />
      <label className="mt-1 flex items-start gap-3 text-[14px] text-white/80">
        <input type="checkbox" checked={phoneOk} onChange={(e) => setPhoneOk(e.target.checked)} className="mt-1 h-4 w-4 accent-[#ff9b5e]" />
        <span>Telefon smíme použít jen k domluvě přístupu pro školu (nepovinné, souhlas můžete kdykoli odvolat).</span>
      </label>
      <label className="flex items-start gap-3 text-[14px] text-white/80">
        <input type="checkbox" checked={newsletter} onChange={(e) => setNewsletter(e.target.checked)} className="mt-1 h-4 w-4 accent-[#ff9b5e]" />
        <span>Chci e-mailem dostávat pozvánky na nové webináře a novinky Vividbooks (nepovinné, odhlásit se jde jedním klikem).</span>
      </label>
      <p className="text-[12px] text-white/45">
        Přístup ke knihovně nevyžaduje žádný z těchto souhlasů. Každý učitel se registruje sám za sebe.
      </p>
      <button type="submit" className="mt-2 inline-flex items-center justify-center gap-2 rounded-full bg-[#ff9b5e] px-6 py-3.5 text-[15px] font-black text-[#0b1020] transition hover:bg-[#ffb07e]">
        Chci přístup pro sebe a svou školu
      </button>
    </form>
  );
}

export function DvppTvPage() {
  const { topics, videos, loading, error } = useDvppVideos();
  const { upcoming } = useWebinars();

  const rows = useMemo(() => {
    const out = topics
      .map((t) => ({ id: t.id, title: t.name.trim(), videos: videos.filter((v) => v.topicIds?.includes(t.id)) }))
      .filter((r) => r.videos.length > 0);
    const rest = videos.filter((v) => !v.topicIds?.length);
    if (rest.length) out.push({ id: 'ostatni', title: 'Další záznamy', videos: rest });
    return out;
  }, [topics, videos]);

  const teaserSrc = `https://www.youtube-nocookie.com/embed/${DVPPTV_TEASER.videoId}?start=${DVPPTV_TEASER.start}&end=${DVPPTV_TEASER.end}&rel=0&modestbranding=1`;

  return (
    <main className="min-h-screen bg-[#0b1020] text-white" style={{ fontFamily: ff }}>
      <SEOHead title="DVPP TV · vzdělávání pro celou sborovnu zdarma" path="" description="Prototyp" noIndex />

      <div className="bg-[#ff9b5e] px-4 py-2 text-center text-[13px] font-bold text-[#0b1020]">
        Prototyp na neveřejné adrese · záznamy jsou skutečné, BOZP a registrace jsou zatím jen ukázka
      </div>

      <header className="mx-auto flex max-w-[1240px] items-center justify-between px-5 py-5 md:px-8">
        <div className="flex items-center gap-2 text-[22px] font-black tracking-tight">
          <span className="rounded-lg bg-[#ff9b5e] px-2 py-0.5 text-[#0b1020]">DVPP</span>
          <span>TV</span>
          <span className="ml-2 hidden text-[13px] font-bold text-white/45 md:inline">od Vividbooks</span>
        </div>
        <nav className="flex items-center gap-5 text-[14px] font-bold text-white/70">
          <a href="#zaznamy" className="hidden hover:text-white md:inline">Webináře</a>
          <a href="#miniaplikace" className="hidden hover:text-white md:inline">Miniaplikace</a>
          <a href="#bozp" className="hidden hover:text-white md:inline">BOZP</a>
          <Link to="/knihovna/prihlaseni" className="rounded-full bg-white px-4 py-2 text-[#0b1020] hover:bg-white/85">Přihlásit se</Link>
        </nav>
      </header>

      {/* Hlavička s upoutávkou */}
      <section className="mx-auto grid max-w-[1240px] items-center gap-8 px-5 pb-10 pt-4 md:grid-cols-[1fr_1.15fr] md:px-8 md:pb-16">
        <div>
          <h1 className="text-[38px] font-black leading-[1.05] md:text-[56px]">
            Vzdělávání pro celou sborovnu.<br /><span className="text-[#ff9b5e]">Zdarma.</span>
          </h1>
          <p className="mt-5 max-w-[520px] text-[17px] leading-relaxed text-white/75">
            Webináře od učitelů a didaktiků z pedagogických fakult, miniaplikace do hodin a školení, která škola potřebuje každý rok.
            Kdykoli, z domova i ze sborovny, s osvědčením po krátkém dotazníku.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <a href="#zaznamy" className="inline-flex items-center gap-2 rounded-full bg-[#ff9b5e] px-6 py-3.5 text-[15px] font-black text-[#0b1020] hover:bg-[#ffb07e]">
              <Play className="h-4 w-4 fill-current" /> Začít sledovat
            </a>
            <a href="#skola" className="inline-flex items-center gap-2 rounded-full border border-white/25 px-6 py-3.5 text-[15px] font-black text-white hover:border-white/60">
              <Users className="h-4 w-4" /> Pro celou školu
            </a>
          </div>
          <div className="mt-8 flex gap-8 text-white/70">
            <div><p className="text-[28px] font-black text-white">{loading ? '…' : videos.length}</p><p className="text-[13px]">záznamů</p></div>
            <div><p className="text-[28px] font-black text-white">{rows.length || '…'}</p><p className="text-[13px]">témat a předmětů</p></div>
            <div><p className="text-[28px] font-black text-white">0 Kč</p><p className="text-[13px]">pro učitele i školu</p></div>
          </div>
        </div>
        <div>
          <div className="relative aspect-video overflow-hidden rounded-[24px] bg-black shadow-[0_30px_80px_rgba(0,0,0,0.5)]">
            <iframe
              src={teaserSrc}
              title={DVPPTV_TEASER.title}
              className="absolute inset-0 h-full w-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
          <p className="mt-3 text-[15px] font-black">{DVPPTV_TEASER.title}</p>
          <p className="text-[13px] text-white/55">
            {DVPPTV_TEASER.who} ·{' '}
            <Link to={`/webinar/${DVPPTV_TEASER.webinarSlug}`} className="underline hover:text-white">celý webinář</Link>
          </p>
        </div>
      </section>

      {/* Živě */}
      {upcoming.length > 0 ? (
        <Section title="Brzy živě" kicker="Webináře naživo">
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {upcoming.slice(0, 3).map((w) => (
              <div key={w.id} className="rounded-[24px] bg-white p-1 text-[#001161]"><WebinarCard webinar={w} /></div>
            ))}
          </div>
        </Section>
      ) : null}

      {/* Záznamy podle předmětů */}
      <div id="zaznamy" className="pt-6">
        <div className="mx-auto max-w-[1240px] px-5 md:px-8">
          <p className="mb-2 text-[12px] font-black uppercase tracking-[0.18em] text-[#ff9b5e]">Záznamy webinářů</p>
          <h2 className="mb-6 text-[26px] font-black text-white md:text-[34px]">Podle předmětů a témat</h2>
        </div>
        {loading ? (
          <div className="flex items-center gap-3 px-8 py-10 text-white/60"><Loader2 className="h-5 w-5 animate-spin" /> Načítám záznamy…</div>
        ) : error ? (
          <p className="px-8 py-10 text-red-300">{error}</p>
        ) : rows.length === 0 ? (
          <p className="flex items-center gap-2 px-8 py-10 text-white/50"><Radio className="h-5 w-5" /> Zatím tu nejsou žádné záznamy.</p>
        ) : (
          <div className="mx-auto max-w-[1400px]">
            {rows.map((r) => <VideoRow key={r.id} title={r.title} videos={r.videos} />)}
          </div>
        )}
      </div>

      {/* Miniaplikace */}
      <Section id="miniaplikace" title="Miniaplikace do hodin zdarma" kicker="Vyzkoušejte ve třídě">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-5">
          {MINI_APPS.map((app) => (
            <Link key={app.slug} to={`/webinar/${app.slug}`}
              className="group overflow-hidden rounded-[20px] border border-white/10 bg-white/[0.04] transition hover:-translate-y-1 hover:border-white/30">
              <div className="flex aspect-[4/3] items-center justify-center overflow-hidden" style={{ background: app.bg }}>
                <img src={app.image} alt="" className="h-full w-full object-cover transition group-hover:scale-105" loading="lazy" />
              </div>
              <div className="p-4">
                <p className="flex items-center gap-2 text-[16px] font-black"><Sparkles className="h-4 w-4 text-[#ff9b5e]" />{app.title}</p>
                <p className="mt-1 text-[13px] leading-snug text-white/60">{app.text}</p>
              </div>
            </Link>
          ))}
        </div>
      </Section>

      {/* BOZP — atrapa */}
      <Section id="bozp" title="BOZP pro celou sborovnu" kicker="Připravujeme">
        <div className="grid gap-6 rounded-[28px] border border-white/10 bg-gradient-to-br from-[#1b2450] to-[#0f1530] p-6 md:grid-cols-[1.2fr_1fr] md:p-10">
          <div>
            <p className="flex items-center gap-2 text-[20px] font-black"><HardHat className="h-6 w-6 text-[#ffd25e]" /> Školení, které škola řeší každý rok</p>
            <p className="mt-3 text-[15px] leading-relaxed text-white/70">
              Krátká videa pro pedagogy, test na konci a přehled pro vedení školy, kdo ze sborovny školení dokončil.
            </p>
            <ul className="mt-5 grid gap-2.5">
              {BOZP_TOPICS.map((t) => (
                <li key={t} className="flex items-start gap-2 text-[15px] text-white/85"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[#ffd25e]" />{t}</li>
              ))}
            </ul>
          </div>
          <div className="flex flex-col justify-center rounded-[20px] bg-white/[0.06] p-6">
            <p className="text-[15px] font-black">Dejte vědět, že o BOZP máte zájem</p>
            <p className="mt-2 text-[14px] text-white/60">Ozveme se, až budou první videa hotová. (V prototypu tlačítko nic neodesílá.)</p>
            <button type="button" className="mt-4 rounded-full bg-[#ffd25e] px-5 py-3 text-[15px] font-black text-[#0b1020] opacity-90" onClick={() => window.alert('Prototyp: zatím se nic neodesílá.')}>
              Chci BOZP pro naši školu
            </button>
          </div>
        </div>
      </Section>

      {/* Registrace školy — atrapa */}
      <Section id="skola" title="Zdarma pro učitele i celou školu" kicker="Registrace">
        <div className="grid gap-8 md:grid-cols-[1fr_1.1fr]">
          <div className="text-[15px] leading-relaxed text-white/75">
            <p>Každý učitel má vlastní přístup a vlastní osvědčení. Když se přidá víc kolegů z jedné sborovny, odemkne se celá škola.</p>
            <ol className="mt-5 grid gap-3">
              {['Zaregistrujete se školním e-mailem.', 'Pozvete kolegy odkazem nebo kódem školy.', 'Vedení školy vidí, kdo co absolvoval.'].map((s, i) => (
                <li key={s} className="flex items-start gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#ff9b5e] text-[14px] font-black text-[#0b1020]">{i + 1}</span>
                  <span className="pt-0.5">{s}</span>
                </li>
              ))}
            </ol>
          </div>
          <SchoolSignupMock />
        </div>
      </Section>

      <footer className="mx-auto max-w-[1240px] px-5 pb-12 pt-6 text-[13px] text-white/40 md:px-8">
        DVPP TV je projekt Vividbooks · <Link to="/" className="underline hover:text-white/70">vividbooks.com</Link>
      </footer>
    </main>
  );
}

export default DvppTvPage;
