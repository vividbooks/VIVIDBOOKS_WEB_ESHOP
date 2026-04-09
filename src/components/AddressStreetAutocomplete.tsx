import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { projectId, publicAnonKey } from '../utils/supabase/info';

const SERVER = `https://${projectId}.supabase.co/functions/v1/make-server-93a20b6f`;

export type ResolvedAddressParts = { street: string; city: string; zip: string };

type Prediction = { description: string; placeId: string };

const INPUT_BASE =
  'w-full rounded-[14px] border bg-white px-4 py-3 text-[14px] text-[#001161] outline-none';
const INPUT_OK = `${INPUT_BASE} border-[#001161]/10 focus:border-[#5b4fd8] focus:ring-2 focus:ring-[#5b4fd8]/15`;
const INPUT_ERR = `${INPUT_BASE} border-red-500 ring-2 ring-red-500/20 focus:border-red-600 focus:ring-red-500/25`;

type Props = {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  /** Po výběru z našeptávače — typicky doplní i město a PSČ. */
  onResolved: (parts: ResolvedAddressParts) => void;
  disabled?: boolean;
  placeholder?: string;
  /** Ikona vlevo (např. Home) — stejně jako u doručovacích polí v OrderPage */
  leftIcon?: React.ReactNode;
  /** Červený rámeček — chybí údaj / validace */
  invalid?: boolean;
};

export function AddressStreetAutocomplete({
  id,
  value,
  onChange,
  onResolved,
  disabled,
  placeholder,
  leftIcon,
  invalid,
}: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [hintEnabled, setHintEnabled] = useState(false);
  /** Server vrátil enabled:false (typicky chybí Google Places klíč v Edge Secrets). */
  const [serverSuggestionsOff, setServerSuggestionsOff] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const fetchPredictions = useCallback(async (q: string) => {
    if (q.trim().length < 2) {
      setPredictions([]);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(
        `${SERVER}/address-autocomplete?input=${encodeURIComponent(q.trim())}`,
        { headers: { Authorization: `Bearer ${publicAnonKey}` } },
      );
      const data = (await res.json()) as {
        ok?: boolean;
        enabled?: boolean;
        predictions?: Prediction[];
      };
      if (data.enabled) {
        setHintEnabled(true);
        setServerSuggestionsOff(false);
      } else {
        setServerSuggestionsOff(true);
      }
      setPredictions(Array.isArray(data.predictions) ? data.predictions : []);
      setOpen((data.predictions?.length ?? 0) > 0);
    } catch {
      setPredictions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const onInputChange = (v: string) => {
    onChange(v);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => void fetchPredictions(v), 320);
  };

  const pick = async (p: Prediction) => {
    setOpen(false);
    setLoading(false);
    setDetailLoading(true);
    onChange(p.description);
    try {
      const res = await fetch(
        `${SERVER}/place-details?placeId=${encodeURIComponent(p.placeId)}`,
        { headers: { Authorization: `Bearer ${publicAnonKey}` } },
      );
      const data = (await res.json()) as {
        ok?: boolean;
        street?: string;
        city?: string;
        zip?: string;
      };
      if (data.ok) {
        onResolved({
          street: (data.street || p.description || '').trim(),
          city: (data.city || '').trim(),
          zip: (data.zip || '').trim(),
        });
      }
    } catch {
      /* ignore */
    } finally {
      setDetailLoading(false);
    }
  };

  return (
    <div ref={wrapRef} className="relative">
      <div className="relative">
        <input
          id={id}
          type="text"
          autoComplete="off"
          disabled={disabled}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onInputChange(e.target.value)}
          onFocus={() => {
            if (predictions.length > 0) setOpen(true);
          }}
          className={leftIcon ? `${invalid ? INPUT_ERR : INPUT_OK} pl-11` : invalid ? INPUT_ERR : INPUT_OK}
          aria-autocomplete="list"
          aria-expanded={open}
          aria-invalid={invalid ? true : undefined}
        />
        {leftIcon ? (
          <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#001161]/30" aria-hidden>
            {leftIcon}
          </span>
        ) : null}
        {(loading || detailLoading) && (
          <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-[#001161]/35" aria-hidden />
        )}
      </div>
      {hintEnabled ? (
        <p className="mt-1.5 font-['Fenomen_Sans',sans-serif] text-[11px] text-[#001161]/45">
          {'Vyberte návrh z nabídky — doplníte město a PSČ. Adresu můžete i dál upravit ručně.'}
        </p>
      ) : null}
      {serverSuggestionsOff && value.trim().length >= 2 && !loading && !detailLoading ? (
        <p className="mt-1.5 font-['Fenomen_Sans',sans-serif] text-[11px] text-amber-800/90">
          {
            'Automatické návrhy adres nejsou zapnuté na serveru. Vyplňte ulici, město a PSČ ručně, případně použijte uložené adresy nad polem.'
          }
        </p>
      ) : null}
      {open && predictions.length > 0 && (
        <ul
          role="listbox"
          className="absolute left-0 right-0 top-full z-[80] mt-1 max-h-56 overflow-auto rounded-[12px] border border-[#001161]/12 bg-white py-1 shadow-lg"
        >
          {predictions.map((p) => (
            <li key={p.placeId} role="option">
              <button
                type="button"
                className="w-full px-3 py-2.5 text-left font-['Fenomen_Sans',sans-serif] text-[13px] leading-snug text-[#001161] hover:bg-[#001161]/5"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => void pick(p)}
              >
                {p.description}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
