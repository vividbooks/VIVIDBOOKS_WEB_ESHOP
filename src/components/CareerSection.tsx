import { CAREER_CONTACT_EMAIL, CAREER_POSITIONS, type CareerPosition } from '../data/careerPositions';

const ff = "'Fenomen Sans', sans-serif";

function PositionCard({ position }: { position: CareerPosition }) {
  const subject = encodeURIComponent(`Kariéra: ${position.title}`);
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
        <p className="text-[#001161]/80 text-[15px] leading-relaxed max-w-[640px]">{position.intro}</p>

        {position.sections.map((section) => (
          <div key={section.heading} className="mt-6">
            <h3 className="text-[#001161] text-[15px] font-bold mb-2">{section.heading}</h3>
            <ul className="list-disc pl-5 space-y-1.5 max-w-[640px]">
              {section.items.map((item) => (
                <li key={item} className="text-[#001161]/80 text-[14px] leading-relaxed">
                  {item}
                </li>
              ))}
            </ul>
          </div>
        ))}

        <p className="mt-7 text-[#001161]/80 text-[14px] leading-relaxed max-w-[640px]">
          {'Zaujalo vás to? Napište pár vět o sobě a přiložte životopis nebo odkaz na LinkedIn: '}
          <a
            href={`mailto:${CAREER_CONTACT_EMAIL}?subject=${subject}`}
            className="text-[#4B48CC] underline hover:text-[#7C3AED] transition-colors"
          >
            {CAREER_CONTACT_EMAIL}
          </a>
        </p>
      </div>
    </details>
  );
}

/** Sekce Kariéra na stránce Kontakt — viz src/config/careerPreview.ts (kdy je vidět). */
export default function CareerSection() {
  const positions = CAREER_POSITIONS.filter((p) => p.published);
  if (positions.length === 0) return null;

  return (
    <>
      <div className="border-t border-[#001161]/8 mx-6" />
      <section id="kariera" className="max-w-3xl mx-auto px-6 py-16">
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
