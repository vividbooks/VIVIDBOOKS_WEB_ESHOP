import React from 'react';
import { SEOHead } from './SEOHead';
import { ImageWithFallback } from './figma/ImageWithFallback';
import { Mail } from 'lucide-react';
import imgVitekSkop from '../assets/team/vitek-skop.png';
import imgFrantisekCab from '../assets/team/frantisek-cab.png';
import { CONTACT_REPRESENTATIVES } from '../data/contactRepresentatives';
import { openCookieSettings } from '@/lib/cookieConsentStorage';

/* ─── Obchodní zástupci ─────────────────────────────────────────── */
const REPRESENTATIVES = CONTACT_REPRESENTATIVES;

/* ─── Chyby v materiálech (redakce / obsah) ───────────────────────── */
/** cropScale = přiblížení ve kruhovém výřezu (1 = bez zoomu; +100 % → 2, +40 % → 1,4) */
const EDITORIAL_CONTACTS = [
  {
    id: 'vitek',
    name: 'Vítek Škop',
    email: 'vitek@vividbooks.com',
    phone: '+420\u00a0728\u00a0417\u00a0279',
    photo: imgVitekSkop,
    cropScale: 2,
    /** nižší % = víc horní části snímku (celá hlava); translateY posune bitmapu dolů v kruhu */
    /** kompromis mezi „moc dole“ (22px) a „moc nahoře“ (−18px) */
    objectPositionY: '36%',
    nudgeY: '8px',
  },
  {
    id: 'frantisek',
    name: 'František Cáb',
    email: 'frantisek@vividbooks.com',
    photo: imgFrantisekCab,
    cropScale: 1.4,
    objectPositionY: '34%',
    nudgeY: '16px',
  },
] as const;

/* ─── Distributoři ─────────────────────────────────────────────── */
const DISTRIBUTORS = [
  {
    id: 1,
    name: 'Baar Group s.r.o.',
    address: 'Hradská 506',
    city: '747 64  Velká Polom',
    phone: '+420 596 615 290',
    email: 'kancelar@baargroup.cz',
    logoColor: '#1A73E8',
    logoText: 'Baar\nGroup',
  },
  {
    id: 2,
    name: 'ABC učebnice',
    address: 'Menšíkova 1154',
    city: '383 01 Prachatice',
    phone: '+420 388 314 136',
    email: 'info@abcucebnice.cz',
    logoColor: '#2E7D32',
    logoText: 'ABC\nučebnice',
  },
  {
    id: 3,
    name: 'Učebnice Vaníček',
    address: 'Bohunická 52',
    city: '619 00 Brno - Horní Heršpice',
    phone: '+420 547 232 504',
    email: 'info@ucebnicevanicek.cz',
    logoColor: '#E53935',
    logoText: 'Vaníček',
  },
  {
    id: 4,
    name: 'ALBRA',
    address: 'Havlíčkova 197',
    city: '250 82 Úvaly',
    phone: '+420 281 980 201',
    email: 'uvaly@albra.cz',
    logoColor: '#FF6F00',
    logoText: 'ALBRA',
  },
  {
    id: 5,
    name: 'ANSA knihy',
    address: 'Pod Šternberkem 306',
    city: '763 02 Zlín 4',
    phone: '+420 577 018 073',
    email: 'ucebnice@ansa.cz',
    logoColor: '#1565C0',
    logoText: 'ANSA\nknihy',
  },
  {
    id: 6,
    name: 'Poprokan',
    address: 'Menšíkova 1154',
    city: '383 01 Prachatice',
    phone: '+420 388 314 136',
    email: 'kinstova@poprokan.cz',
    logoColor: '#E65100',
    logoText: 'POPROKAN',
  },
  {
    id: 7,
    name: 'Sevt',
    address: 'Pekařová 4',
    city: '181 06 Praha 8 - Bohnice',
    phone: '+420 283 090 354',
    email: 'objednavky@sevt.cz',
    logoColor: '#1976D2',
    logoText: 'SEVT',
  },
  {
    id: 8,
    name: 'Učebnice Vitoul',
    address: 'Nová Ves 5',
    city: '783 21 Litovel',
    phone: '+420 604 704 922',
    email: 'vitoul@javidis.cz',
    logoColor: '#6A1B9A',
    logoText: 'VITOUL',
  },
];

/* ─── Rep karta ─────────────────────────────────────────────────── */
function RepCard({ rep }: { rep: typeof REPRESENTATIVES[0] }) {
  return (
    <div className="flex flex-col items-center text-center gap-2">
      <div
        className="w-[120px] h-[120px] rounded-full overflow-hidden border-4 border-white mb-1 flex-shrink-0"
        style={{ boxShadow: '0 8px 24px rgba(0,17,97,0.13)' }}
      >
        <ImageWithFallback
          src={rep.photo}
          alt={rep.name}
          className="w-full h-full object-cover object-top"
        />
      </div>

      <h3
        className="text-[#001161] text-[17px] font-bold leading-tight"
        style={{ fontFamily: "'Fenomen Sans', sans-serif" }}
      >
        {rep.name}
      </h3>

      <a
        href={`mailto:${rep.email}`}
        className="text-[#4B48CC] text-[13px] underline hover:text-[#7C3AED] transition-colors"
        style={{ fontFamily: "'Fenomen Sans', sans-serif" }}
      >
        {rep.email}
      </a>

      <p
        className="text-[#001161] text-[13px]"
        style={{ fontFamily: "'Fenomen Sans', sans-serif" }}
      >
        {rep.phone}
      </p>

      <p
        className="text-[#001161]/55 text-[12px] leading-[1.5] max-w-[190px]"
        style={{ fontFamily: "'Fenomen Sans', sans-serif" }}
      >
        {rep.regions}
      </p>
    </div>
  );
}

function EditorialContactCard({ contact }: { contact: (typeof EDITORIAL_CONTACTS)[number] }) {
  return (
    <div className="flex flex-col items-center text-center gap-2 w-[220px]">
      <div
        className="w-[120px] h-[120px] rounded-full overflow-hidden border-4 border-white mb-1 flex-shrink-0"
        style={{ boxShadow: '0 8px 24px rgba(0,17,97,0.13)' }}
      >
        <ImageWithFallback
          src={contact.photo}
          alt={contact.name}
          className="w-full h-full max-w-none max-h-none object-cover"
          style={{
            objectPosition: `center ${contact.objectPositionY}`,
            transform: `scale(${contact.cropScale}) translateY(${contact.nudgeY})`,
            transformOrigin: 'center center',
          }}
        />
      </div>
      <h3
        className="text-[#001161] text-[17px] font-bold leading-tight"
        style={{ fontFamily: "'Fenomen Sans', sans-serif" }}
      >
        {contact.name}
      </h3>
      <a
        href={`mailto:${contact.email}`}
        className="text-[#4B48CC] text-[13px] underline hover:text-[#7C3AED] transition-colors break-all"
        style={{ fontFamily: "'Fenomen Sans', sans-serif" }}
      >
        {contact.email}
      </a>
      {'phone' in contact && contact.phone ? (
        <p className="text-[#001161] text-[13px]" style={{ fontFamily: "'Fenomen Sans', sans-serif" }}>
          {contact.phone}
        </p>
      ) : null}
    </div>
  );
}

/* ─── Distributor karta ─────────────────────────────────────────── */
function DistributorCard({ dist }: { dist: typeof DISTRIBUTORS[0] }) {
  const ff = "'Fenomen Sans', sans-serif";
  return (
    <div className="flex flex-col gap-1.5">
      <p
        className="text-[#001161] text-[15px] font-bold"
        style={{ fontFamily: ff }}
      >
        {dist.name}
      </p>
      <p
        className="text-[#001161]/70 text-[13px]"
        style={{ fontFamily: ff }}
      >
        {dist.address}
      </p>
      <p
        className="text-[#001161]/70 text-[13px]"
        style={{ fontFamily: ff }}
      >
        {dist.city}
      </p>
      <p
        className="text-[#001161]/70 text-[13px]"
        style={{ fontFamily: ff }}
      >
        {dist.phone}
      </p>
      <a
        href={`mailto:${dist.email}`}
        className="text-[#4B48CC] text-[13px] underline hover:text-[#7C3AED] transition-colors"
        style={{ fontFamily: ff }}
      >
        {dist.email}
      </a>
    </div>
  );
}

const ff = "'Fenomen Sans', sans-serif";

/* ─── Hlavní stránka ─────────────────────────────────────────────── */
export function ContactPage() {
  return (
    <div className="min-h-screen bg-white">
      <SEOHead
        title="Kontakt"
        path="/kontakt"
        description="Kontaktujte Vividbooks: telefon +420 602 227 674, e-mail hello@vividbooks.com. Obchodní zástupci po krajích, redakce a distribuce."
      />

      {/* ══ SEKCE 0: Kontakt ══ */}
      <section className="max-w-3xl mx-auto px-6 pt-14 pb-2 text-center">
        <p
          className="text-[#001161] text-[26px] font-normal mb-1"
          style={{ fontFamily: ff }}
        >
          {'Máte dotazy? Jsme tu pro vás.'}
        </p>
        <a
          href="mailto:hello@vividbooks.com"
          className="inline-flex items-center justify-center gap-2.5 text-[#001161] text-[26px] sm:text-[30px] font-black mb-3 hover:text-[#4B48CC] transition-colors break-all sm:break-normal"
          style={{ fontFamily: ff }}
        >
          <Mail className="w-6 h-6 sm:w-7 sm:h-7 shrink-0" aria-hidden />
          <span>hello@vividbooks.com</span>
        </a>
        <h1
          className="text-[#001161] text-[28px] sm:text-[32px] font-black mb-4"
          style={{ fontFamily: ff }}
        >
          {'Zavolejte: +420\u00a0602\u00a0227\u00a0674'}
        </h1>
        <p className="text-[#001161]/55 text-[15px] max-w-md mx-auto" style={{ fontFamily: ff }}>
          {'Obchodní tým odpovídá na e-mail a telefon v pracovní dny. Kontakty zástupců po krajích najdete níže.'}
        </p>
      </section>

      {/* Oddělovač */}
      <div className="border-t border-[#001161]/8 mx-6 mt-14" />

      {/* ══ SEKCE 1: Hero + Obchodní zástupci ══ */}
      <section className="max-w-5xl mx-auto px-6 pt-16 pb-20">

        {/* Nadpis sekce */}
        <p
          className="text-[#001161] text-[15px] font-semibold text-center mb-10 tracking-wide"
          style={{ fontFamily: ff }}
        >
          Naši obchodní zástupci
        </p>

        {/* Grid — 4 nahoře */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-12 mb-12">
          {REPRESENTATIVES.slice(0, 4).map(rep => (
            <RepCard key={rep.id} rep={rep} />
          ))}
        </div>

        {/* 2 dole — centrovaně */}
        <div className="flex justify-center gap-12 flex-wrap">
          {REPRESENTATIVES.slice(4).map(rep => (
            <div key={rep.id} className="w-[220px]">
              <RepCard rep={rep} />
            </div>
          ))}
        </div>

        <div className="border-t border-[#001161]/10 pt-14 mt-14">
          <p
            className="text-[#001161] text-[15px] font-semibold text-center mb-3 tracking-wide max-w-[520px] mx-auto leading-snug"
            style={{ fontFamily: ff }}
          >
            {'Na\u0161li jste chybu v na\u0161ich materi\xe1lech? Napi\u0161te n\xe1m:'}
          </p>
          <p
            className="text-[#001161]/70 text-[14px] text-center max-w-[560px] mx-auto leading-relaxed mb-10 px-1"
            style={{ fontFamily: ff }}
          >
            {'Chyby v online materi\xe1lech opravujeme ihned \u2014 je to na\u0161e priorita.'}
          </p>
          <div className="flex justify-center gap-12 md:gap-20 flex-wrap">
            {EDITORIAL_CONTACTS.map((c) => (
              <EditorialContactCard key={c.id} contact={c} />
            ))}
          </div>
        </div>
      </section>

      {/* Oddělovač */}
      <div className="border-t border-[#001161]/8 mx-6" />

      {/* ══ SEKCE 2: Distribuce tištěných materiálů ══ */}
      <section className="max-w-5xl mx-auto px-6 py-16 pb-24">
        <p
          className="text-[#001161] text-[15px] font-semibold text-center mb-12 tracking-wide"
          style={{ fontFamily: ff }}
        >
          Distribuce tište{'n'}ých materiálů
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-8 gap-y-12">
          {DISTRIBUTORS.map(dist => (
            <DistributorCard key={dist.id} dist={dist} />
          ))}
        </div>

        <p className="mt-14 text-center">
          <button
            type="button"
            onClick={() => openCookieSettings()}
            className="font-['Fenomen_Sans',sans-serif] text-[13px] text-[#001161]/60 underline underline-offset-2 hover:text-[#001161]"
          >
            {'Nastavení cookies'}
          </button>
        </p>
      </section>
    </div>
  );
}