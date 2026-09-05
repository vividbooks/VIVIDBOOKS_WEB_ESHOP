/**
 * /marketing/dvpp — dashboard DVPP zdarma: KPI strom, pokrytí škol, sborovny, import rejstříku.
 * Data: GET /admin/dvpp/dashboard, /admin/dvpp/staffrooms (staff JWT).
 */
import React, { useEffect, useState } from 'react';
import { Loader2, RefreshCw, School, Users } from 'lucide-react';
import { edgeFunctionBase } from '../../utils/edgeFunctionBase';

type Dashboard = {
  days: number;
  funnel: { byEvent: Record<string, number>; byDay: Array<{ day: string; event: string; count: number }> };
  coverage: { byStatus: Record<string, number>; primarySchools: number; schoolsWithContacts: number; staffrooms: Record<string, number> };
  subscribers: { active: number; withSchool: number };
  certificates: number;
};

type StaffroomRow = {
  red_izo: string; code: string; status: string; milestone_target: number; confirmed_count: number; unlocked_by: string | null;
  unlocked_at: string | null; grace_until: string | null; created_at: string;
  schools: { name: string; city: string | null; teachers_count: number | null };
};

async function adminCall<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const { getRequiredEdgeFunctionHeaders } = await import('../../lib/edgeFunctionHeaders');
  const headers = await getRequiredEdgeFunctionHeaders(true);
  const res = await fetch(`${edgeFunctionBase()}${path}`, { method: init.method || (init.body ? 'POST' : 'GET'), headers, body: init.body ? JSON.stringify(init.body) : undefined });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
  return data;
}

const EVENT_ORDER: Array<[string, string]> = [
  ['visit', 'Návštěvy'], ['lead', 'E-mail zadán'], ['confirmed', 'Potvrzeno (přihlášení)'], ['profile_done', 'Kvíz hotový'],
  ['school_linked', 'Škola přiřazena'], ['play', 'První přehrání'], ['certificate', 'Osvědčení'],
  ['staffroom_created', 'Sborovny založené'], ['invite_shared', 'Sdílení odkazu'], ['invite_sent', 'Vzkazy kolegům'],
  ['invite_confirmed', 'Kolega přišel'], ['staffroom_unlocked', 'Sborovny odemčené'], ['director_unlock', 'Ředitel odemkl'], ['vote', 'Hlasy'],
];

const STATUS_LABEL: Record<string, string> = { customer: 'Zákazník', staffroom: 'Sborovna', active: 'Rozjetá (3+)', trace: 'Stopa (1–2)', blank: 'Bílé místo', lost: 'Ztracená' };

export default function DvppDashboardPage() {
  const [days, setDays] = useState(30);
  const [data, setData] = useState<Dashboard | null>(null);
  const [staffrooms, setStaffrooms] = useState<StaffroomRow[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  const load = async () => {
    setError('');
    try {
      const [d, s] = await Promise.all([adminCall<Dashboard>(`/admin/dvpp/dashboard?days=${days}`), adminCall<{ staffrooms: StaffroomRow[] }>('/admin/dvpp/staffrooms')]);
      setData(d); setStaffrooms(s.staffrooms);
    } catch (e) { setError(e instanceof Error ? e.message : 'Nepodařilo se načíst.'); }
  };
  useEffect(() => { void load(); }, [days]);

  const run = async (key: string, path: string, body?: unknown) => {
    setBusy(key); setMsg('');
    try { const r = await adminCall<Record<string, unknown>>(path, { body: body ?? {} }); setMsg(`${key}: ${JSON.stringify(r)}`); await load(); }
    catch (e) { setMsg(`${key}: ${e instanceof Error ? e.message : 'chyba'}`); }
    finally { setBusy(null); }
  };

  const ev = data?.funnel.byEvent || {};
  const pct = (a: number, b: number) => (b > 0 ? `${Math.round((a / b) * 100)} %` : '–');

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#001161]">DVPP zdarma · dashboard</h1>
          <p className="text-sm text-gray-500">Severní hvězda: aktivní odběratelé se školou. Zdroj: funnel_events, schools, staffrooms.</p>
        </div>
        <div className="flex items-center gap-2">
          <select value={days} onChange={(e) => setDays(Number(e.target.value))} className="rounded-lg border px-3 py-2 text-sm">
            {[7, 14, 30, 90, 120].map((d) => <option key={d} value={d}>{d} dní</option>)}
          </select>
          <button type="button" onClick={() => void load()} className="inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-sm"><RefreshCw className="h-4 w-4" /> Obnovit</button>
        </div>
      </div>
      {error ? <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}
      {!data && !error ? <p className="text-gray-500"><Loader2 className="inline h-4 w-4 animate-spin" /> Načítám…</p> : null}

      {data ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {[
              ['Aktivní odběratelé', data.subscribers.active],
              ['… z toho se školou', data.subscribers.withSchool],
              ['ZŠ v rejstříku', data.coverage.primarySchools],
              ['ZŠ s kontaktem', data.coverage.schoolsWithContacts],
              ['Osvědčení celkem', data.certificates],
            ].map(([l, v]) => (
              <div key={String(l)} className="rounded-xl border bg-white p-4"><p className="text-xs uppercase tracking-wide text-gray-500">{l}</p><p className="text-2xl font-bold tabular-nums text-[#001161]">{Number(v).toLocaleString('cs-CZ')}</p></div>
            ))}
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-xl border bg-white p-4">
              <h2 className="mb-3 font-semibold text-[#001161]">Funnel za {data.days} dní</h2>
              <table className="w-full text-sm">
                <tbody>
                  {EVENT_ORDER.map(([k, l]) => (
                    <tr key={k} className="border-t"><td className="py-1.5">{l}</td><td className="py-1.5 text-right tabular-nums">{(ev[k] || 0).toLocaleString('cs-CZ')}</td></tr>
                  ))}
                </tbody>
              </table>
              <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-gray-600">
                <div>lead → potvrzeno: <b>{pct(ev.confirmed || 0, ev.lead || 0)}</b></div>
                <div>potvrzeno → přehrání: <b>{pct(ev.play || 0, ev.confirmed || 0)}</b></div>
                <div>sdílení → kolega: <b>{pct(ev.invite_confirmed || 0, ev.invite_shared || 0)}</b></div>
              </div>
            </div>
            <div className="rounded-xl border bg-white p-4">
              <h2 className="mb-3 font-semibold text-[#001161]">Pokrytí základních škol</h2>
              <table className="w-full text-sm">
                <tbody>
                  {['customer', 'staffroom', 'active', 'trace', 'blank', 'lost'].map((s) => (
                    <tr key={s} className="border-t"><td className="py-1.5">{STATUS_LABEL[s]}</td><td className="py-1.5 text-right tabular-nums">{(data.coverage.byStatus[s] || 0).toLocaleString('cs-CZ')}</td></tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-3 text-xs text-gray-600">Sborovny: {Object.entries(data.coverage.staffrooms).map(([k, v]) => `${k} ${v}`).join(' · ') || 'zatím žádné'}</p>
            </div>
          </div>

          <div className="rounded-xl border bg-white p-4">
            <h2 className="mb-2 font-semibold text-[#001161]">Údržba dat</h2>
            <div className="flex flex-wrap gap-2">
              <button type="button" disabled={!!busy} onClick={() => void run('import', '/admin/dvpp/schools/import')} className="inline-flex items-center gap-1 rounded-lg bg-[#001161] px-3 py-2 text-sm text-white disabled:opacity-50"><School className="h-4 w-4" /> Importovat rejstřík do tabulky schools</button>
              <button type="button" disabled={!!busy} onClick={() => void run('backfill', '/admin/dvpp/schools/backfill', { limit: 500 })} className="inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-sm disabled:opacity-50"><Users className="h-4 w-4" /> Dopárovat kontakty podle domény (500)</button>
            </div>
            <p className="mt-2 text-xs text-gray-500">Import je bezpečné opakovat (upsert podle RED_IZO). Dopárování spouštějte, dokud vrací linked &gt; 0.</p>
            {msg ? <pre className="mt-2 max-h-40 overflow-auto rounded bg-gray-50 p-2 text-xs">{msg}</pre> : null}
          </div>

          <div className="rounded-xl border bg-white p-4">
            <h2 className="mb-3 font-semibold text-[#001161]">Sborovny ({staffrooms.length})</h2>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead><tr className="text-left text-xs uppercase tracking-wide text-gray-500"><th className="py-1">Škola</th><th>Kód</th><th>Stav</th><th>Potvrzeno / milník</th><th>Sbor</th><th>Odemkl</th><th></th></tr></thead>
                <tbody>
                  {staffrooms.map((s) => (
                    <tr key={s.red_izo} className="border-t">
                      <td className="py-1.5">{s.schools?.name}<span className="block text-xs text-gray-500">{s.schools?.city}</span></td>
                      <td className="font-mono">{s.code}</td>
                      <td>{s.status}</td>
                      <td className="tabular-nums">{s.confirmed_count} / {s.milestone_target}</td>
                      <td className="tabular-nums">{s.schools?.teachers_count ?? '–'}</td>
                      <td>{s.unlocked_by || '–'}</td>
                      <td className="text-right">
                        <button type="button" disabled={!!busy} onClick={() => void run(`recount ${s.code}`, `/admin/dvpp/staffrooms/${s.red_izo}/recount`)} className="mr-2 text-xs text-[#001161] underline">přepočítat</button>
                        {s.status !== 'unlocked' ? <button type="button" disabled={!!busy} onClick={() => { if (window.confirm(`Odemknout ${s.schools?.name} ručně?`)) void run(`unlock ${s.code}`, `/admin/dvpp/staffrooms/${s.red_izo}/unlock`); }} className="text-xs text-[#F06632] underline">odemknout</button> : null}
                      </td>
                    </tr>
                  ))}
                  {!staffrooms.length ? <tr><td colSpan={7} className="py-3 text-gray-500">Zatím žádná sborovna.</td></tr> : null}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
