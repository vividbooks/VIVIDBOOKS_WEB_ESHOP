import { useEffect, useRef, useState } from 'react';
import { Check, Link2 } from 'lucide-react';
import { careerPositionPath } from '../config/careerPreview';
import { CAREER_CONTACT_EMAIL, type CareerPosition } from '../data/careerPositions';

export const careerFont = "'Fenomen Sans', sans-serif";

export function careerMailto(position: CareerPosition): string {
  return `mailto:${CAREER_CONTACT_EMAIL}?subject=${encodeURIComponent(`Kariéra: ${position.title}`)}`;
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Starší prohlížeče a stránky bez https: záložní cesta přes dočasné textové pole.
    try {
      const field = document.createElement('textarea');
      field.value = text;
      field.setAttribute('readonly', '');
      field.style.position = 'fixed';
      field.style.opacity = '0';
      document.body.appendChild(field);
      field.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(field);
      return ok;
    } catch {
      return false;
    }
  }
}

/** Zkopíruje do schránky celou adresu samostatné stránky pozice. */
export function CopyPositionLinkButton({ position, className = '' }: { position: CareerPosition; className?: string }) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const url = `${window.location.origin}${careerPositionPath(position.id)}`;

  const handleClick = async () => {
    const ok = await copyText(url);
    setState(ok ? 'copied' : 'failed');
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setState('idle'), 2500);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      title={url}
      className={`inline-flex items-center gap-2 rounded-[12px] border border-[#001161]/15 bg-white px-4 py-2.5 text-[14px] font-semibold text-[#001161] cursor-pointer hover:border-[#4B48CC] hover:text-[#4B48CC] transition-colors ${className}`}
      style={{ fontFamily: careerFont }}
    >
      {state === 'copied' ? <Check className="h-4 w-4" aria-hidden /> : <Link2 className="h-4 w-4" aria-hidden />}
      <span aria-live="polite">
        {state === 'copied' ? 'Odkaz zkopírován' : state === 'failed' ? 'Zkopírujte adresu z řádku prohlížeče' : 'Kopírovat odkaz'}
      </span>
    </button>
  );
}

/** Text inzerátu: uvedení a odrážky po oddílech. Společné pro kartu na Kontaktu i stránku pozice. */
export function CareerPositionContent({ position, large = false }: { position: CareerPosition; large?: boolean }) {
  return (
    <div style={{ fontFamily: careerFont }}>
      <p className={`text-[#001161]/80 leading-relaxed max-w-[640px] ${large ? 'text-[17px]' : 'text-[15px]'}`}>
        {position.intro}
      </p>

      {position.sections.map((section) => (
        <div key={section.heading} className={large ? 'mt-9' : 'mt-6'}>
          {large ? (
            <h2 className="text-[#001161] text-[19px] font-bold mb-3">{section.heading}</h2>
          ) : (
            <h3 className="text-[#001161] text-[15px] font-bold mb-2">{section.heading}</h3>
          )}
          <ul className={`list-disc pl-5 max-w-[640px] ${large ? 'space-y-2' : 'space-y-1.5'}`}>
            {section.items.map((item) => (
              <li key={item} className={`text-[#001161]/80 leading-relaxed ${large ? 'text-[15px]' : 'text-[14px]'}`}>
                {item}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
