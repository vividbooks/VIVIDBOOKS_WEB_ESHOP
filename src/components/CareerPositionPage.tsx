import { ArrowLeft, ArrowRight, Mail, MapPin } from 'lucide-react';
import { Link, useParams } from 'react-router';
import { CAREER_PUBLIC, careerListPath, careerPositionPath } from '../config/careerPreview';
import { CAREER_ABOUT, CAREER_CONTACT_EMAIL, CAREER_POSITIONS, findCareerPosition } from '../data/careerPositions';
import { CareerPositionContent, CopyPositionLinkButton, careerFont, careerMailto } from './CareerPositionContent';
import { NotFound } from './NotFound';
import { SEOHead } from './SEOHead';

/**
 * Samostatná stránka jedné pozice, aby šel inzerát poslat jako odkaz.
 * Kdy je vidět a na jaké adrese: viz src/config/careerPreview.ts.
 */
export default function CareerPositionPage() {
  const { positionId } = useParams();
  const position = findCareerPosition(positionId);
  if (!position) return <NotFound />;

  const others = CAREER_POSITIONS.filter((p) => p.published && p.id !== position.id);

  return (
    <div className="min-h-screen bg-white" style={{ fontFamily: careerFont }}>
      <SEOHead
        title={`${position.title} – kariéra`}
        description={position.intro}
        path={careerPositionPath(position.id)}
        noIndex={!CAREER_PUBLIC}
      />

      <article className="max-w-3xl mx-auto px-6 pt-10 pb-24">
        <Link
          to={careerListPath()}
          className="inline-flex items-center gap-2 text-[14px] font-semibold text-[#4B48CC] hover:text-[#7C3AED] transition-colors"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Všechny volné pozice
        </Link>

        <p className="mt-10 text-[#001161] text-[15px] font-semibold tracking-wide">Kariéra ve Vividbooks</p>
        <h1 className="mt-2 text-[#001161] text-[32px] sm:text-[42px] font-black leading-[1.1]">{position.title}</h1>
        <p className="mt-4 inline-flex items-center gap-2 text-[#001161]/70 text-[15px]">
          <MapPin className="h-4 w-4 shrink-0" aria-hidden />
          {position.place}
        </p>

        <p className="mt-6 text-[#001161]/80 text-[16px] leading-relaxed max-w-[640px]">{CAREER_ABOUT}</p>

        <div className="mt-6">
          <CopyPositionLinkButton position={position} />
        </div>

        <div className="mt-9">
          <CareerPositionContent position={position} large />
        </div>

        <div className="mt-12 rounded-2xl bg-[#F4F3FF] px-6 py-7 sm:px-8">
          <h2 className="text-[#001161] text-[21px] font-bold">Zaujalo vás to?</h2>
          <p className="mt-2 text-[#001161]/80 text-[15px] leading-relaxed max-w-[560px]">
            {'Napište pár vět o sobě a přiložte životopis nebo odkaz na LinkedIn: '}
            <a href={careerMailto(position)} className="text-[#4B48CC] underline hover:text-[#7C3AED] transition-colors">
              {CAREER_CONTACT_EMAIL}
            </a>
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <a
              href={careerMailto(position)}
              className="inline-flex items-center gap-2 rounded-[12px] bg-[#4B48CC] px-5 py-2.5 text-[14px] font-bold text-white hover:bg-[#3d3ab5] transition-colors"
            >
              <Mail className="h-4 w-4" aria-hidden />
              Napsat e-mail
            </a>
            <CopyPositionLinkButton position={position} />
          </div>
        </div>

        {others.length > 0 ? (
          <div className="mt-14">
            <h2 className="text-[#001161] text-[17px] font-bold mb-4">Další volné pozice</h2>
            <div className="flex flex-col gap-3">
              {others.map((other) => (
                <Link
                  key={other.id}
                  to={careerPositionPath(other.id)}
                  className="group flex items-center justify-between gap-4 rounded-2xl border border-[#001161]/10 px-6 py-4 hover:border-[#4B48CC]/50 transition-colors"
                >
                  <span className="flex flex-col gap-1">
                    <span className="text-[#001161] text-[17px] font-bold leading-tight">{other.title}</span>
                    <span className="text-[#001161]/60 text-[13px]">{other.place}</span>
                  </span>
                  <ArrowRight className="h-5 w-5 shrink-0 text-[#4B48CC] transition-transform group-hover:translate-x-1" aria-hidden />
                </Link>
              ))}
            </div>
          </div>
        ) : null}
      </article>
    </div>
  );
}
