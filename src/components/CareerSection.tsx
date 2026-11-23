import { useEffect, useRef } from 'react';
import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router';
import { careerPositionPath } from '../config/careerPreview';
import { CAREER_CONTACT_EMAIL, CAREER_POSITIONS, type CareerPosition } from '../data/careerPositions';
import { CareerPositionContent, CopyPositionLinkButton, careerFont as ff, careerMailto } from './CareerPositionContent';

function PositionCard({ position }: { position: CareerPosition }) {
  return (
    <details
      className="group rounded-2xl border border-[#001161]/10 bg-white open:shadow-[0_8px_24px_rgba(0,17,97,0.08)] transition-shadow"
      style={{ fontFamily: ff }}
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-6 py-5 [&::-webkit-details-marker]:hidden">
        <span className="flex flex-col gap-1 text-left">
          <span className="text-[#001161] text-[19px] font-bold leading-tight">{position.title}</span>
          <span className="text-[#001161]/60 text-[13px]">{position.place}</span>
        </span>
        <span
          aria-hidden
          className="shrink-0 text-[#4B48CC] text-[26px] leading-none transition-transform group-open:rotate-45"
        >
          +
        </span>
      </summary>

      <div className="px-6 pb-7 pt-1">
        <CareerPositionContent position={position} />

        <p className="mt-7 text-[#001161]/80 text-[14px] leading-relaxed max-w-[640px]">
          {'Zaujalo vás to? Napište pár vět o sobě a přiložte životopis nebo odkaz na LinkedIn: '}
          <a
            href={careerMailto(position)}
            className="text-[#4B48CC] underline hover:text-[#7C3AED] transition-colors"
          >
            {CAREER_CONTACT_EMAIL}
          </a>
        </p>

        <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-3">
          <Link
            to={careerPositionPath(position.id)}
            className="inline-flex items-center gap-2 text-[14px] font-semibold text-[#4B48CC] hover:text-[#7C3AED] transition-colors"
          >
            Otevřít jako samostatnou stránku
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
          <CopyPositionLinkButton position={position} />
        </div>
      </div>
    </details>
  );
}

/** Sekce Kariéra na stránce Kontakt — viz src/config/careerPreview.ts (kdy je vidět). */
export default function CareerSection() {
  const positions = CAREER_POSITIONS.filter((p) => p.published);
  const sectionRef = useRef<HTMLElement>(null);

  // Sekce se načítá až po stránce, takže na odkaz …#kariera (návrat ze stránky pozice)
  // prohlížeč sám nedoskočí — doskočíme sem po vykreslení.
  useEffect(() => {
    if (window.location.hash === '#kariera') sectionRef.current?.scrollIntoView({ block: 'start' });
  }, []);

  if (positions.length === 0) return null;

  return (
    <>
      <div className="border-t border-[#001161]/8 mx-6" />
      <section id="kariera" ref={sectionRef} className="max-w-3xl mx-auto px-6 py-16 scroll-mt-20">
        <p
          className="text-[#001161] text-[15px] font-semibold text-center mb-3 tracking-wide"
          style={{ fontFamily: ff }}
        >
          Kariéra
        </p>
        <h2
          className="text-[#001161] text-[26px] sm:text-[30px] font-black text-center mb-3"
          style={{ fontFamily: ff }}
        >
          Pojďte dělat učebnice s námi
        </h2>
        <p
          className="text-[#001161]/70 text-[15px] text-center max-w-[560px] mx-auto leading-relaxed mb-10"
          style={{ fontFamily: ff }}
        >
          Vividbooks dělá interaktivní učebnice a pracovní sešity pro základní školy. Do týmu teď hledáme tyto kolegy:
        </p>
        <div className="flex flex-col gap-4">
          {positions.map((position) => (
            <PositionCard key={position.id} position={position} />
          ))}
        </div>
      </section>
    </>
  );
}
