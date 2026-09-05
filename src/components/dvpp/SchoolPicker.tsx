/**
 * Našeptávač školy nad tabulkou `schools` (RED_IZO). Uloží školu do profilu (PUT /dvpp/me).
 */
import React, { useEffect, useRef, useState } from 'react';
import { Loader2, School, Search } from 'lucide-react';
import { dvppApi } from '../../utils/dvppApi';

type Result = { redIzo: string; ico: string | null; name: string; city: string | null; type: string | null; isPrimary: boolean; teachersCount: number | null };

export function SchoolPicker({ onPicked, position }: { onPicked: () => Promise<void> | void; position?: string }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<Result[]>([]);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState('');
  const timer = useRef<number | null>(null);

  useEffect(() => {
    if (timer.current) window.clearTimeout(timer.current);
    if (q.trim().length < 2) { setResults([]); return; }
    timer.current = window.setTimeout(async () => {
      setSearching(true);
      try { setResults((await dvppApi.searchSchools(q)).results); } catch { setResults([]); } finally { setSearching(false); }
    }, 250);
    return () => { if (timer.current) window.clearTimeout(timer.current); };
  }, [q]);

  const pick = async (r: Result) => {
    setSaving(r.redIzo); setError('');
    try {
      await dvppApi.updateMe({ redIzo: r.redIzo, schoolName: r.name, ...(position ? { position } : {}) });
      await onPicked();
    } catch (e) { setError(e instanceof Error ? e.message : 'Nepodařilo se uložit.'); } finally { setSaving(null); }
  };

  return (
    <div>
      <div className="relative">
        <input
          value={q} onChange={(e) => setQ(e.target.value)} placeholder="Název školy nebo obec, např. ZŠ Milovice"
          className="w-full rounded-xl border border-[#001161]/15 bg-white py-3 pl-4 pr-10 text-[15px] outline-none focus:border-[#001161]"
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6b7398]">{searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}</span>
      </div>
      {results.length ? (
        <ul className="mt-2 max-h-[320px] overflow-auto rounded-xl border border-[#001161]/10 bg-white shadow">
          {results.map((r) => (
            <li key={r.redIzo}>
              <button type="button" onClick={() => void pick(r)} disabled={!!saving} className="flex w-full items-start gap-3 px-4 py-2.5 text-left hover:bg-[#f0f2f8] disabled:opacity-60">
                <School className="mt-0.5 h-4 w-4 shrink-0 text-[#001161]" />
                <span className="min-w-0">
                  <span className="block truncate text-[14px] font-semibold text-[#001161]">{r.name}</span>
                  <span className="block text-[12px] text-[#6b7398]">{[r.city, r.ico ? `IČO ${r.ico}` : null, r.teachersCount ? `cca ${r.teachersCount} pedagogů` : null].filter(Boolean).join(' · ')}</span>
                </span>
                {saving === r.redIzo ? <Loader2 className="ml-auto h-4 w-4 animate-spin text-[#001161]" /> : null}
              </button>
            </li>
          ))}
        </ul>
      ) : q.trim().length >= 2 && !searching ? (
        <p className="mt-2 text-[13px] text-[#6b7398]">Nic jsme nenašli. Zkuste jiný tvar názvu nebo obec. Rejstřík obsahuje školy z MŠMT.</p>
      ) : null}
      {error ? <p className="mt-2 text-[13px] text-[#b3261e]">{error}</p> : null}
    </div>
  );
}
