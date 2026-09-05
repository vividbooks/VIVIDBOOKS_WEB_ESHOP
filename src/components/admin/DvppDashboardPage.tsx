/**
 * /marketing/dvpp — DVPP zdarma v adminu: Přehled (KPI, pokrytí, sborovny, údržba) · Záznamy (kapitoly,
 * upoutávka, délka, lektor) · Řady · Témata k hlasování · Digest „Nové v knihovně“.
 * Data: /admin/dvpp/* (staff JWT).
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Loader2, Mail, RefreshCw, Save, School, Users } from 'lucide-react';
import { edgeFunctionBase } from '../../utils/edgeFunctionBase';
import { chaptersToText, parseChapters } from '../../supabase/functions/server/dvpp/content';

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
type VideoRow = {
  id: string; name: string; slug: string; thumbnail?: string; youtubeUrl: string; topicIds: string[];
  durationMinutes?: number | null; lecturer?: string; trailerUrl?: string; chapters?: Array<{ t: number; title: string }>; subjects?: string[]; addedAt?: string;
};
type Series = { id: string; title: string; description: string; subjects: string[]; videoIds: string[]; hours: number; order?: number };
type Topic = { id: string; title: string; description: string | null; subjects: string[]; status: string; votes_count: number };

async function adminCall<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const { getRequiredEdgeFunctionHeaders } = await import('../../lib/edgeFunctionHeaders');
  const headers = await getRequiredEdgeFunctionHeaders(true);
  const res = await fetch(`${edgeFunctionBase()}${path}`, { method: init.method || (init.body ? 'POST' : 'GET'), headers, body: init.body ? JSON.stringify(init.body) : undefined });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
  return data;
}

const EVENT_ORDER: Array<[string, string]> = [
  ['visit', 'Návštěvy'], ['preview_limit', 'Dokoukali upoutávku'], ['lead', 'E-mail zadán'], ['confirmed', 'Potvrzeno (přihlášení)'], ['profile_done', 'Kvíz hotový'],
  ['school_linked', 'Škola přiřazena'], ['play', 'První přehrání'], ['certificate', 'Osvědčení'],
  ['staffroom_created', 'Sborovny založené'], ['invite_shared', 'Sdílení odkazu'], ['invite_sent', 'Vzkazy kolegům'],
  ['invite_confirmed', 'Kolega přišel'], ['staffroom_unlocked', 'Sborovny odemčené'], ['director_unlock', 'Ředitel odemkl'], ['vote', 'Hlasy'],
];
const STATUS_LABEL: Record<string, string> = { customer: 'Zákazník', staffroom: 'Sborovna', active: 'Rozjetá (3+)', trace: 'Stopa (1–2)', blank: 'Bílé místo', lost: 'Ztracená' };
const SUBJECTS = ['matematika', 'fyzika', 'chemie', 'prirodopis', 'prvouka', 'cesky-jazyk', 'other'];

type Tab = 'prehled' | 'zaznamy' | 'rady' | 'temata';

export default function DvppDashboardPage() {
  const [tab, setTab] = useState<Tab>('prehled');
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  const run = async <T,>(key: string, fn: () => Promise<T>, after?: () => Promise<void>): Promise<T | null> => {
    setBusy(key); setMsg(''); setError('');
    try { const r = await fn(); setMsg(`${key}: ${typeof r === 'object' ? JSON.stringify(r).slice(0, 400) : String(r)}`); await after?.(); return r; }
    catch (e) { setError(`${key}: ${e instanceof Error ? e.message : 'chyba'}`); return null; }
    finally { setBusy(null); }
  };

  return (
    <div className="space-y-5 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#001161]">DVPP zdarma</h1>
          <p className="text-sm text-gray-500">Knihovna pro sborovny: měření, školy, obsah, digest. Dokumentace: docs/dvpp.</p>
        </div>
        <div className="flex gap-1 rounded-lg bg-gray-100 p-1">
          {([['prehled', 'Přehled'], ['zaznamy', 'Záznamy'], ['rady', 'Řady'], ['temata', 'Témata']] as Array<[Tab, string]>).map(([k, l]) => (
            <button key={k} type="button" onClick={() => setTab(k)} className={`rounded-md px-3 py-1.5 text-sm font-semibold ${tab === k ? 'bg-white text-[#001161] shadow' : 'text-gray-600'}`}>{l}</button>
          ))}
        </div>
      </div>
      {error ? <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}
      {msg ? <pre className="max-h-32 overflow-auto rounded bg-gray-50 p-2 text-xs">{msg}</pre> : null}
      {tab === 'prehled' ? <OverviewTab busy={busy} run={run} /> : null}
      {tab === 'zaznamy' ? <VideosTab busy={busy} run={run} /> : null}
      {tab === 'rady' ? <SeriesTab busy={busy} run={run} /> : null}
      {tab === 'temata' ? <TopicsTab busy={busy} run={run} /> : null}
    </div>
  );
}

type RunFn = <T,>(key: string, fn: () => Promise<T>, after?: () => Promise<void>) => Promise<T | null>;

function OverviewTab({ busy, run }: { busy: string | null; run: RunFn }) {
  const [days, setDays] = useState(30);
  const [data, setData] = useState<Dashboard | null>(null);
  const [staffrooms, setStaffrooms] = useState<StaffroomRow[]>([]);
  const [sizesCsv, setSizesCsv] = useState('');
  const load = async () => {
    const [d, s] = await Promise.all([adminCall<Dashboard>(`/admin/dvpp/dashboard?days=${days}`), adminCall<{ staffrooms: StaffroomRow[] }>('/admin/dvpp/staffrooms')]);
    setData(d); setStaffrooms(s.staffrooms);
  };
  useEffect(() => { load().catch(() => {}); }, [days]);
  const ev = data?.funnel.byEvent || {};
  const pct = (a: number, b: number) => (b > 0 ? `${Math.round((a / b) * 100)} %` : '–');
  if (!data) return <p className="text-gray-500"><Loader2 className="inline h-4 w-4 animate-spin" /> Načítám…</p>;
  return (
    <>
      <div className="flex items-center gap-2">
        <select value={days} onChange={(e) => setDays(Number(e.target.value))} className="rounded-lg border px-3 py-2 text-sm">{[7, 14, 30, 90, 120].map((d) => <option key={d} value={d}>{d} dní</option>)}</select>
        <button type="button" onClick={() => void load()} className="inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-sm"><RefreshCw className="h-4 w-4" /> Obnovit</button>
        <button type="button" disabled={!!busy} onClick={() => void run('digest', () => adminCall<{ draftId: string; subject: string; editUrl: string }>('/admin/dvpp/digest/draft', { body: { sinceDays: 7 } }))} className="inline-flex items-center gap-1 rounded-lg bg-[#7C3AED] px-3 py-2 text-sm text-white disabled:opacity-50"><Mail className="h-4 w-4" /> Vygenerovat digest „Nové v knihovně“ do EmailBuilderu</button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {[['Aktivní odběratelé', data.subscribers.active], ['… z toho se školou', data.subscribers.withSchool], ['ZŠ v rejstříku', data.coverage.primarySchools], ['ZŠ s kontaktem', data.coverage.schoolsWithContacts], ['Osvědčení celkem', data.certificates]].map(([l, v]) => (
          <div key={String(l)} className="rounded-xl border bg-white p-4"><p className="text-xs uppercase tracking-wide text-gray-500">{l}</p><p className="text-2xl font-bold tabular-nums text-[#001161]">{Number(v).toLocaleString('cs-CZ')}</p></div>
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border bg-white p-4">
          <h2 className="mb-3 font-semibold text-[#001161]">Funnel za {data.days} dní</h2>
          <table className="w-full text-sm"><tbody>{EVENT_ORDER.map(([k, l]) => <tr key={k} className="border-t"><td className="py-1.5">{l}</td><td className="py-1.5 text-right tabular-nums">{(ev[k] || 0).toLocaleString('cs-CZ')}</td></tr>)}</tbody></table>
          <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-gray-600">
            <div>lead → potvrzeno: <b>{pct(ev.confirmed || 0, ev.lead || 0)}</b></div>
            <div>potvrzeno → přehrání: <b>{pct(ev.play || 0, ev.confirmed || 0)}</b></div>
            <div>sdílení → kolega: <b>{pct(ev.invite_confirmed || 0, ev.invite_shared || 0)}</b></div>
          </div>
        </div>
        <div className="rounded-xl border bg-white p-4">
          <h2 className="mb-3 font-semibold text-[#001161]">Pokrytí základních škol</h2>
          <table className="w-full text-sm"><tbody>{['customer', 'staffroom', 'active', 'trace', 'blank', 'lost'].map((s) => <tr key={s} className="border-t"><td className="py-1.5">{STATUS_LABEL[s]}</td><td className="py-1.5 text-right tabular-nums">{(data.coverage.byStatus[s] || 0).toLocaleString('cs-CZ')}</td></tr>)}</tbody></table>
          <p className="mt-3 text-xs text-gray-600">Sborovny: {Object.entries(data.coverage.staffrooms).map(([k, v]) => `${k} ${v}`).join(' · ') || 'zatím žádné'}</p>
        </div>
      </div>
      <div className="rounded-xl border bg-white p-4">
        <h2 className="mb-2 font-semibold text-[#001161]">Údržba dat</h2>
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={!!busy} onClick={() => void run('import', () => adminCall('/admin/dvpp/schools/import', { body: {} }), load)} className="inline-flex items-center gap-1 rounded-lg bg-[#001161] px-3 py-2 text-sm text-white disabled:opacity-50"><School className="h-4 w-4" /> Importovat rejstřík do tabulky schools</button>
          <button type="button" disabled={!!busy} onClick={() => void run('backfill', () => adminCall('/admin/dvpp/schools/backfill', { body: { limit: 500 } }), load)} className="inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-sm disabled:opacity-50"><Users className="h-4 w-4" /> Dopárovat kontakty podle domény (500)</button>
        </div>
        <details className="mt-3">
          <summary className="cursor-pointer text-sm font-semibold text-[#001161]">Nahrát velikost sborů (CSV: red_izo/ico; zaci; ucitele)</summary>
          <textarea value={sizesCsv} onChange={(e) => setSizesCsv(e.target.value)} rows={5} placeholder={'red_izo;zaci;ucitele\n600051234;240;22'} className="mt-2 w-full rounded-lg border px-3 py-2 font-mono text-xs" />
          <button type="button" disabled={!!busy || sizesCsv.trim().length < 10} onClick={() => void run('import-sizes', async () => {
            const { getRequiredEdgeFunctionHeaders } = await import('../../lib/edgeFunctionHeaders');
            const headers = await getRequiredEdgeFunctionHeaders(false);
            const res = await fetch(`${edgeFunctionBase()}/admin/dvpp/schools/import-sizes`, { method: 'POST', headers: { ...headers, 'Content-Type': 'text/csv' }, body: sizesCsv });
            const j = await res.json(); if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`); return j;
          }, load)} className="mt-2 rounded-lg border px-3 py-2 text-sm disabled:opacity-50">Nahrát</button>
        </details>
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
                  <td className="font-mono">{s.code}</td><td>{s.status}</td>
                  <td className="tabular-nums">{s.confirmed_count} / {s.milestone_target}</td>
                  <td className="tabular-nums">{s.schools?.teachers_count ?? '–'}</td><td>{s.unlocked_by || '–'}</td>
                  <td className="text-right">
                    <button type="button" disabled={!!busy} onClick={() => void run(`recount ${s.code}`, () => adminCall(`/admin/dvpp/staffrooms/${s.red_izo}/recount`, { body: {} }), load)} className="mr-2 text-xs text-[#001161] underline">přepočítat</button>
                    {s.status !== 'unlocked' ? <button type="button" disabled={!!busy} onClick={() => { if (window.confirm(`Odemknout ${s.schools?.name} ručně?`)) void run(`unlock ${s.code}`, () => adminCall(`/admin/dvpp/staffrooms/${s.red_izo}/unlock`, { body: {} }), load); }} className="text-xs text-[#F06632] underline">odemknout</button> : null}
                  </td>
                </tr>
              ))}
              {!staffrooms.length ? <tr><td colSpan={7} className="py-3 text-gray-500">Zatím žádná sborovna.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

function VideosTab({ busy, run }: { busy: string | null; run: RunFn }) {
  const [videos, setVideos] = useState<VideoRow[]>([]);
  const [q, setQ] = useState('');
  const [sel, setSel] = useState<VideoRow | null>(null);
  const [form, setForm] = useState({ durationMinutes: '', lecturer: '', trailerUrl: '', chaptersText: '', subjects: [] as string[], addedAt: '' });
  const load = async () => { const r = await adminCall<{ videos: VideoRow[] }>('/admin/dvpp/videos'); setVideos(r.videos); };
  useEffect(() => { load().catch(() => {}); }, []);
  const filtered = useMemo(() => videos.filter((v) => !q || v.name.toLowerCase().includes(q.toLowerCase())), [videos, q]);
  const pick = (v: VideoRow) => {
    setSel(v);
    setForm({ durationMinutes: v.durationMinutes ? String(v.durationMinutes) : '', lecturer: v.lecturer || '', trailerUrl: v.trailerUrl || '', chaptersText: chaptersToText(v.chapters), subjects: v.subjects || [], addedAt: v.addedAt ? v.addedAt.slice(0, 10) : '' });
  };
  const save = () => sel && run(`uložit ${sel.name}`, () => adminCall(`/admin/dvpp/videos/${encodeURIComponent(sel.id)}`, { method: 'PUT', body: {
    durationMinutes: form.durationMinutes ? Number(form.durationMinutes) : null, lecturer: form.lecturer, trailerUrl: form.trailerUrl, chaptersText: form.chaptersText, subjects: form.subjects,
    addedAt: form.addedAt ? new Date(form.addedAt).toISOString() : undefined,
  } }), load);
  const parsed = parseChapters(form.chaptersText);
  return (
    <div className="grid gap-4 lg:grid-cols-[360px_minmax(0,1fr)]">
      <div className="rounded-xl border bg-white p-3">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Hledat záznam…" className="mb-2 w-full rounded-lg border px-3 py-2 text-sm" />
        <ul className="max-h-[70vh] overflow-auto text-sm">
          {filtered.map((v) => (
            <li key={v.id}>
              <button type="button" onClick={() => pick(v)} className={`w-full rounded-md px-2 py-1.5 text-left hover:bg-gray-50 ${sel?.id === v.id ? 'bg-[#efe8ff]' : ''}`}>
                <span className="block font-semibold text-[#001161]">{v.name}</span>
                <span className="block text-xs text-gray-500">{[v.lecturer, v.durationMinutes ? `${v.durationMinutes} min` : null, v.chapters?.length ? `${v.chapters.length} kapitol` : null, v.trailerUrl ? 'upoutávka' : null].filter(Boolean).join(' · ') || 'bez metadat'}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
      <div className="rounded-xl border bg-white p-4">
        {!sel ? <p className="text-sm text-gray-500">Vyberte záznam vlevo. Kapitoly a upoutávky se ukládají do KV záznamů (ne do Webflow).</p> : (
          <div className="space-y-3">
            <h2 className="font-semibold text-[#001161]">{sel.name}</h2>
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="text-sm"><span className="block text-xs text-gray-500">Délka (min) → hodiny na osvědčení</span><input value={form.durationMinutes} onChange={(e) => setForm({ ...form, durationMinutes: e.target.value })} className="w-full rounded-lg border px-3 py-2" /></label>
              <label className="text-sm"><span className="block text-xs text-gray-500">Lektor</span><input value={form.lecturer} onChange={(e) => setForm({ ...form, lecturer: e.target.value })} className="w-full rounded-lg border px-3 py-2" /></label>
              <label className="text-sm"><span className="block text-xs text-gray-500">Přidáno do knihovny (pro digest)</span><input type="date" value={form.addedAt} onChange={(e) => setForm({ ...form, addedAt: e.target.value })} className="w-full rounded-lg border px-3 py-2" /></label>
            </div>
            <label className="block text-sm"><span className="block text-xs text-gray-500">Upoutávka (YouTube URL, 45–90 s; nepřihlášený vidí ji místo prvních 10 minut)</span><input value={form.trailerUrl} onChange={(e) => setForm({ ...form, trailerUrl: e.target.value })} className="w-full rounded-lg border px-3 py-2" placeholder="https://youtu.be/…" /></label>
            <div className="text-sm">
              <span className="block text-xs text-gray-500">Předměty</span>
              <div className="flex flex-wrap gap-2">{SUBJECTS.map((s) => <label key={s} className="inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs"><input type="checkbox" checked={form.subjects.includes(s)} onChange={(e) => setForm({ ...form, subjects: e.target.checked ? [...form.subjects, s] : form.subjects.filter((x) => x !== s) })} />{s}</label>)}</div>
            </div>
            <label className="block text-sm"><span className="block text-xs text-gray-500">Kapitoly (řádek = „mm:ss Název“)</span><textarea value={form.chaptersText} onChange={(e) => setForm({ ...form, chaptersText: e.target.value })} rows={8} className="w-full rounded-lg border px-3 py-2 font-mono text-xs" placeholder={'0:00 Úvod\n7:30 Aktivita do hodiny\n38:10 Otázky'} /></label>
            <p className="text-xs text-gray-500">Rozpoznáno {parsed.length} kapitol.</p>
            <button type="button" disabled={!!busy} onClick={() => void save()} className="inline-flex items-center gap-1 rounded-lg bg-[#001161] px-3 py-2 text-sm text-white disabled:opacity-50"><Save className="h-4 w-4" /> Uložit metadata</button>
          </div>
        )}
      </div>
    </div>
  );
}

function SeriesTab({ busy, run }: { busy: string | null; run: RunFn }) {
  const [series, setSeries] = useState<Series[]>([]);
  const [videos, setVideos] = useState<VideoRow[]>([]);
  const load = async () => {
    const [s, v] = await Promise.all([adminCall<{ series: Series[] }>('/admin/dvpp/series'), adminCall<{ videos: VideoRow[] }>('/admin/dvpp/videos')]);
    setSeries(s.series); setVideos(v.videos);
  };
  useEffect(() => { load().catch(() => {}); }, []);
  const upd = (i: number, patch: Partial<Series>) => setSeries(series.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  const save = () => run('uložit řady', () => adminCall('/admin/dvpp/series', { method: 'PUT', body: { series: series.map((s, i) => ({ ...s, order: i })) } }), load);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-gray-600">Řada = 3–6 záznamů po předmětu; 4 díly ≈ 8 h DVPP se souhrnným osvědčením. Pořadí = pořadí v knihovně.</p>
        <div className="flex gap-2">
          <button type="button" onClick={() => setSeries([...series, { id: `rada-${Date.now().toString(36)}`, title: 'Nová řada', description: '', subjects: [], videoIds: [], hours: 8 }])} className="rounded-lg border px-3 py-2 text-sm">+ Přidat řadu</button>
          <button type="button" disabled={!!busy} onClick={() => void save()} className="inline-flex items-center gap-1 rounded-lg bg-[#001161] px-3 py-2 text-sm text-white disabled:opacity-50"><Save className="h-4 w-4" /> Uložit všechny řady</button>
        </div>
      </div>
      {series.map((s, i) => (
        <div key={s.id} className="rounded-xl border bg-white p-4">
          <div className="grid gap-3 sm:grid-cols-[1fr_2fr_90px_auto]">
            <input value={s.id} onChange={(e) => upd(i, { id: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') })} className="rounded-lg border px-3 py-2 font-mono text-xs" title="id (slug)" />
            <input value={s.title} onChange={(e) => upd(i, { title: e.target.value })} className="rounded-lg border px-3 py-2 text-sm" placeholder="Název řady" />
            <input type="number" value={s.hours} onChange={(e) => upd(i, { hours: Number(e.target.value) || 0 })} className="rounded-lg border px-3 py-2 text-sm" title="hodin DVPP" />
            <button type="button" onClick={() => setSeries(series.filter((_, j) => j !== i))} className="text-xs text-red-600 underline">smazat</button>
          </div>
          <input value={s.description} onChange={(e) => upd(i, { description: e.target.value })} className="mt-2 w-full rounded-lg border px-3 py-2 text-sm" placeholder="Popis (jedna věta pro učitele)" />
          <div className="mt-2 flex flex-wrap gap-2">{SUBJECTS.map((sub) => <label key={sub} className="inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs"><input type="checkbox" checked={s.subjects.includes(sub)} onChange={(e) => upd(i, { subjects: e.target.checked ? [...s.subjects, sub] : s.subjects.filter((x) => x !== sub) })} />{sub}</label>)}</div>
          <div className="mt-2">
            <p className="text-xs text-gray-500">Díly v pořadí ({s.videoIds.length}):</p>
            <ol className="text-sm">{s.videoIds.map((id, k) => <li key={id} className="flex items-center gap-2 py-0.5"><span className="w-5 text-right text-xs text-gray-400">{k + 1}.</span><span className="flex-1">{videos.find((v) => v.id === id)?.name || id}</span><button type="button" onClick={() => upd(i, { videoIds: s.videoIds.filter((x) => x !== id) })} className="text-xs text-red-600">×</button></li>)}</ol>
            <select value="" onChange={(e) => { if (e.target.value && !s.videoIds.includes(e.target.value)) upd(i, { videoIds: [...s.videoIds, e.target.value] }); }} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm">
              <option value="">+ přidat díl…</option>
              {videos.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
          </div>
        </div>
      ))}
      {!series.length ? <p className="text-sm text-gray-500">Zatím žádná řada. Doporučené první řady: Jak nadchnout žáky pro matematiku · fyziku · přírodopis · AI pro pedagogy · ŠVP krok za krokem.</p> : null}
    </div>
  );
}

function TopicsTab({ busy, run }: { busy: string | null; run: RunFn }) {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [form, setForm] = useState({ id: '', title: '', description: '', status: 'open' });
  const load = async () => { const r = await adminCall<{ topics: Topic[] }>('/dvpp/topics'); setTopics(r.topics); };
  useEffect(() => { load().catch(() => {}); }, []);
  const save = () => run(`téma ${form.id}`, () => adminCall('/admin/dvpp/topics', { method: 'PUT', body: form }), async () => { setForm({ id: '', title: '', description: '', status: 'open' }); await load(); });
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="rounded-xl border bg-white p-4">
        <h2 className="mb-2 font-semibold text-[#001161]">Otevřená témata ({topics.length})</h2>
        <ul className="text-sm">{topics.map((t) => <li key={t.id} className="flex items-center justify-between border-t py-1.5"><span><b>{t.title}</b> <span className="text-xs text-gray-500">{t.id} · {t.status}</span></span><span className="tabular-nums">{t.votes_count} hlasů <button type="button" onClick={() => setForm({ id: t.id, title: t.title, description: t.description || '', status: t.status })} className="ml-2 text-xs text-[#001161] underline">upravit</button></span></li>)}</ul>
      </div>
      <div className="rounded-xl border bg-white p-4">
        <h2 className="mb-2 font-semibold text-[#001161]">Přidat / upravit téma</h2>
        <div className="space-y-2">
          <input value={form.id} onChange={(e) => setForm({ ...form, id: e.target.value })} placeholder="id (slug), např. tridnicke-hodiny" className="w-full rounded-lg border px-3 py-2 font-mono text-xs" />
          <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Název tématu" className="w-full rounded-lg border px-3 py-2 text-sm" />
          <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Popis" className="w-full rounded-lg border px-3 py-2 text-sm" />
          <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="w-full rounded-lg border px-3 py-2 text-sm">{['open', 'scheduled', 'done', 'archived'].map((s) => <option key={s} value={s}>{s}</option>)}</select>
          <button type="button" disabled={!!busy || !form.id || !form.title} onClick={() => void save()} className="inline-flex items-center gap-1 rounded-lg bg-[#001161] px-3 py-2 text-sm text-white disabled:opacity-50"><Save className="h-4 w-4" /> Uložit téma</button>
        </div>
      </div>
    </div>
  );
}
