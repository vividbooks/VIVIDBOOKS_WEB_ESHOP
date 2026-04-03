import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshCw, Users, Search, Building2, Tag, Mail, Clock, Sparkles, Layers, Radio } from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import { projectId, publicAnonKey } from '../../utils/supabase/info';
import { cn } from '../ui/utils';

const SERVER = `https://${projectId}.supabase.co/functions/v1/make-server-93a20b6f`;

type ContactRow = {
  email_hash: string;
  email: string;
  list_id: string;
  status: string | null;
  merge_fields: Record<string, unknown>;
  tags: string[];
  school: string | null;
  synced_at: string;
};

type StatusFilter = '' | 'subscribed' | 'unsubscribed';

/** Rychlé skupiny — „Rodiče“ je vždy poslední v seznamu i v UI. */
const QUICK_PRESETS: Array<{
  id: string;
  label: string;
  tag: string;
  school: string;
  hint?: string;
}> = [
  { id: 'all', label: 'Vše', tag: '', school: '', hint: 'Zruší rychlé omezení tagu / školy' },
  { id: 'webinar', label: 'Webináře', tag: 'Webinar form', school: '', hint: 'Tag Webinar form' },
  { id: 'trial', label: 'Trial', tag: 'Trial form', school: '', hint: 'Tag Trial form' },
  { id: 'catalog', label: 'Katalog', tag: 'Catalog form', school: '', hint: 'Tag Catalog form' },
  { id: 'users', label: 'Uživatelé', tag: 'User', school: '', hint: 'Tag User' },
  { id: 'trial_sales', label: 'Trial prodej', tag: 'Trial sales', school: '', hint: 'Tag Trial sales' },
  {
    id: 'kampan', label: 'Kampaně (mat.)',
    tag: 'Kampan matematika',
    school: '',
    hint: 'Tag Kampan matematika',
  },
  {
    id: 'parents',
    label: 'Rodiče',
    tag: '',
    school: 'parent',
    hint: 'Text „parent“ ve škole / merge (Position, …)',
  },
];

function isParentTagLabel(t: string): boolean {
  return /\bparent\b|\brodič|rodic/i.test(t);
}

/** Tagy související s rodiči vždy na konec řádku štítků. */
function sortTagsForDisplay(tags: string[]): string[] {
  const parentLike: string[] = [];
  const rest: string[] = [];
  for (const t of tags) {
    (isParentTagLabel(t) ? parentLike : rest).push(t);
  }
  const cmp = (a: string, b: string) => a.localeCompare(b, 'cs', { sensitivity: 'base' });
  rest.sort(cmp);
  parentLike.sort(cmp);
  return [...rest, ...parentLike];
}

export default function MarketingContactsPage() {
  const [meta, setMeta] = useState<{ lastSyncedAt: string | null; totalRows: number; listId: string | null }>({
    lastSyncedAt: null,
    totalRows: 0,
    listId: null,
  });
  const [rows, setRows] = useState<ContactRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [q, setQ] = useState('');
  const [school, setSchool] = useState('');
  const [tag, setTag] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('');
  const [activePresetId, setActivePresetId] = useState<string>('all');
  const [offset, setOffset] = useState(0);
  const limit = 50;

  const loadMeta = useCallback(async () => {
    try {
      const res = await fetch(`${SERVER}/admin/marketing/contacts/meta`, {
        headers: { Authorization: `Bearer ${publicAnonKey}` },
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok) {
        setMeta({
          lastSyncedAt: d.lastSyncedAt ?? null,
          totalRows: typeof d.totalRows === 'number' ? d.totalRows : 0,
          listId: d.listId ?? null,
        });
      }
    } catch {
      /* ignore */
    }
  }, []);

  const loadRows = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (q.trim()) params.set('q', q.trim());
      if (school.trim()) params.set('school', school.trim());
      if (tag.trim()) params.set('tag', tag.trim());
      if (statusFilter) params.set('status', statusFilter);
      params.set('limit', String(limit));
      params.set('offset', String(offset));
      const res = await fetch(`${SERVER}/admin/marketing/contacts?${params}`, {
        headers: { Authorization: `Bearer ${publicAnonKey}` },
      });
      const text = await res.text();
      let d: { rows?: ContactRow[]; total?: number; error?: string } = {};
      try {
        d = text ? JSON.parse(text) : {};
      } catch {
        /* ignore */
      }
      if (!res.ok) throw new Error(d.error || text.slice(0, 200) || res.statusText);
      setRows(d.rows || []);
      setTotal(typeof d.total === 'number' ? d.total : 0);
    } catch (e: any) {
      toast.error(e.message || 'Chyba načtení');
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [q, school, tag, statusFilter, offset]);

  useEffect(() => {
    void loadMeta();
  }, [loadMeta]);

  useEffect(() => {
    void loadRows();
  }, [loadRows]);

  const applyPreset = (presetId: string) => {
    const p = QUICK_PRESETS.find((x) => x.id === presetId);
    if (!p) return;
    setActivePresetId(presetId);
    setTag(p.tag);
    setSchool(p.school);
    setOffset(0);
  };

  const runSync = async (forceResetFromScratch = false) => {
    setSyncing(true);
    try {
      let call = 0;
      for (;;) {
        const res = await fetch(`${SERVER}/admin/marketing/contacts/sync`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ reset: call === 0 && forceResetFromScratch }),
        });
        const text = await res.text();
        let d: {
          ok?: boolean;
          synced?: number;
          syncedThisRun?: number;
          done?: boolean;
          error?: string;
        } = {};
        try {
          d = text ? JSON.parse(text) : {};
        } catch {
          /* ignore */
        }
        if (!res.ok) throw new Error(d.error || text.slice(0, 200) || res.statusText);
        if (d.done) {
          toast.success(
            `Hotovo: ${d.synced ?? 0} kontaktů z Mailchimp (${call + 1} ${call === 0 ? 'dávka' : 'dávek'}).`,
          );
          break;
        }
        toast.message(`Sync… +${d.syncedThisRun ?? 0} (zatím ${d.synced ?? '…'}), pokračuji`, {
          duration: 2500,
        });
        call += 1;
        if (call > 40) {
          throw new Error('Příliš mnoho dávek — zkuste znovu později.');
        }
      }
      await loadMeta();
      setOffset(0);
      await loadRows();
    } catch (e: any) {
      toast.error(e.message || 'Sync selhal');
    } finally {
      setSyncing(false);
    }
  };

  const canPrev = offset > 0;
  const canNext = offset + limit < total;

  const presetHint = useMemo(() => {
    if (activePresetId === 'custom') return null;
    return QUICK_PRESETS.find((p) => p.id === activePresetId)?.hint ?? null;
  }, [activePresetId]);

  return (
    <div className="h-full overflow-y-auto p-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#7C3AED] to-[#9F67F5]">
              <Users className="h-5 w-5 text-white" />
            </div>
            <h1 className="font-['Fenomen_Sans'] text-3xl font-bold text-[#001161]">{'Kontakty'}</h1>
          </div>
          <p className="max-w-2xl text-[14px] text-gray-600">
            {
              'Lokální kopie hlavní Mailchimp audience. Použijte rychlé skupiny nebo stav odběru; štítky s „parent“ / rodič jsou v řádku vždy na konci.'
            }
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void runSync(false)}
            disabled={syncing}
            className={cn(
              'inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-[13px] font-semibold text-white shadow-sm transition-colors',
              syncing ? 'bg-[#7C3AED]/50' : 'bg-[#7C3AED] hover:bg-[#6d32d8]',
            )}
          >
            <RefreshCw className={cn('h-4 w-4', syncing && 'animate-spin')} />
            {syncing ? 'Synchronizuji…' : 'Stáhnout z Mailchimp'}
          </button>
          <button
            type="button"
            onClick={() => void runSync(true)}
            disabled={syncing}
            className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-[12px] font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"
            title={'Zahodí rozpracovaný import a začne od offsetu 0'}
          >
            {'Od začátku'}
          </button>
        </div>
      </div>

      <div className="mb-6 rounded-2xl border border-violet-100 bg-violet-50/60 p-4 text-[13px] text-violet-950">
        <div className="mb-2 flex items-center gap-2 font-semibold text-violet-900">
          <Sparkles className="h-4 w-4 shrink-0" />
          {'Jak to funguje'}
        </div>
        <ul className="list-inside list-disc space-y-1 text-[12px] text-violet-900/90">
          <li>
            {
              'Sync stáhne všechny členy z audience — cca 25k řádků. Cron: denní POST na contacts/sync.'
            }
          </li>
          <li>{'Rychlé skupiny nastaví tag nebo text ve sloupci školy (u Rodiče hledáme „parent“ v merge textu). '}</li>
        </ul>
        <div className="mt-3 flex flex-wrap gap-4 border-t border-violet-200/80 pt-3 text-[11px] text-violet-800/90">
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" />
            {'Poslední sync: '}
            {meta.lastSyncedAt ? new Date(meta.lastSyncedAt).toLocaleString('cs-CZ') : '—'}
          </span>
          <span>
            {'Řádků v DB: '}
            <strong>{meta.totalRows}</strong>
          </span>
          {meta.listId ? (
            <span className="font-mono text-[10px] opacity-80" title="Mailchimp list id">
              {`list: ${meta.listId}`}
            </span>
          ) : null}
        </div>
      </div>

      {/* Skupiny */}
      <div className="mb-4 rounded-2xl border border-gray-100 bg-white p-4">
        <div className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-gray-500">
          <Layers className="h-3.5 w-3.5" />
          {'Rychlé skupiny'}
        </div>
        <div className="flex flex-wrap gap-2">
          {QUICK_PRESETS.map((p) => {
            const isOn =
              p.id === 'all'
                ? activePresetId === 'all' && !q.trim() && !tag.trim() && !school.trim()
                : activePresetId === p.id;
            return (
              <button
                key={p.id}
                type="button"
                title={p.hint}
                onClick={() => applyPreset(p.id)}
                className={cn(
                  'rounded-full px-3 py-1.5 text-[11px] font-semibold transition-colors',
                  isOn
                    ? 'bg-[#7C3AED] text-white shadow-sm'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200',
                  p.id === 'parents' && !isOn && 'ring-1 ring-amber-300/70',
                )}
              >
                {p.label}
              </button>
            );
          })}
          {activePresetId === 'custom' ? (
            <span className="self-center rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-900">
              {'Vlastní filtr'}
            </span>
          ) : null}
        </div>
        {presetHint ? <p className="mt-2 text-[11px] text-gray-500">{presetHint}</p> : null}
      </div>

      {/* Stav odběru */}
      <div className="mb-4 rounded-2xl border border-gray-100 bg-white p-4">
        <div className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-gray-500">
          <Radio className="h-3.5 w-3.5" />
          {'Stav v Mailchimp'}
        </div>
        <div className="flex flex-wrap gap-2">
          {(
            [
              { id: '' as const, label: 'Všichni' },
              { id: 'subscribed' as const, label: 'Odběratelé' },
              { id: 'unsubscribed' as const, label: 'Odhlášení' },
            ] as const
          ).map((s) => (
            <button
              key={s.id || 'any'}
              type="button"
              onClick={() => {
                setStatusFilter(s.id);
                setOffset(0);
              }}
              className={cn(
                'rounded-full px-3 py-1.5 text-[11px] font-semibold transition-colors',
                statusFilter === s.id
                  ? 'bg-[#001161] text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200',
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Pokročilé */}
      <div className="mb-4 rounded-2xl border border-gray-100 bg-white p-4">
        <div className="mb-3 text-[11px] font-bold uppercase tracking-wide text-gray-500">{'Pokročilé hledání'}</div>
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex min-w-[180px] flex-1 flex-col gap-1">
            <span className="text-[10px] font-bold uppercase tracking-wide text-gray-500">{'E-mail'}</span>
            <span className="relative">
              <Mail className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
              <input
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setOffset(0);
                  setActivePresetId('custom');
                }}
                className="w-full rounded-lg border border-gray-200 py-2 pl-8 pr-3 text-[13px] outline-none focus:border-[#7C3AED]"
                placeholder="obsahuje…"
              />
            </span>
          </label>
          <label className="flex min-w-[180px] flex-1 flex-col gap-1">
            <span className="text-[10px] font-bold uppercase tracking-wide text-gray-500">{'Škola / text'}</span>
            <span className="relative">
              <Building2 className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
              <input
                value={school}
                onChange={(e) => {
                  setSchool(e.target.value);
                  setOffset(0);
                  setActivePresetId('custom');
                }}
                className="w-full rounded-lg border border-gray-200 py-2 pl-8 pr-3 text-[13px] outline-none focus:border-[#7C3AED]"
                placeholder="obsahuje…"
              />
            </span>
          </label>
          <label className="flex min-w-[160px] flex-1 flex-col gap-1">
            <span className="text-[10px] font-bold uppercase tracking-wide text-gray-500">
              {'Tag (přesná shoda v MC)'}
            </span>
            <span className="relative">
              <Tag className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
              <input
                value={tag}
                onChange={(e) => {
                  setTag(e.target.value);
                  setOffset(0);
                  setActivePresetId('custom');
                }}
                className="w-full rounded-lg border border-gray-200 py-2 pl-8 pr-3 text-[13px] outline-none focus:border-[#7C3AED]"
                placeholder="např. Webinar form"
              />
            </span>
          </label>
          <button
            type="button"
            onClick={() => void loadRows()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-[12px] font-semibold text-gray-700 hover:bg-gray-100"
          >
            <Search className="h-3.5 w-3.5" />
            {'Hledat'}
          </button>
        </div>
      </div>

      <div className="mb-2 flex items-center justify-between text-[12px] text-gray-500">
        <span>
          {'Zobrazeno '}
          <strong className="text-[#001161]">{rows.length}</strong>
          {' / '}
          <strong className="text-[#001161]">{total}</strong>
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={!canPrev || loading}
            onClick={() => setOffset((o) => Math.max(0, o - limit))}
            className="rounded-lg border border-gray-200 px-3 py-1 text-[12px] font-medium disabled:opacity-40"
          >
            {'← Předchozí'}
          </button>
          <button
            type="button"
            disabled={!canNext || loading}
            onClick={() => setOffset((o) => o + limit)}
            className="rounded-lg border border-gray-200 px-3 py-1 text-[12px] font-medium disabled:opacity-40"
          >
            {'Další →'}
          </button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-gray-100 bg-white">
        <table className="w-full min-w-[640px] border-collapse text-left text-[12px]">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50/80 text-[10px] font-bold uppercase tracking-wide text-gray-500">
              <th className="px-3 py-2">{'E-mail'}</th>
              <th className="px-3 py-2">{'Škola / pole'}</th>
              <th className="px-3 py-2">{'Stav'}</th>
              <th className="px-3 py-2">{'Tagy'}</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-gray-400">
                  {'Načítám…'}
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-gray-400">
                  {total === 0
                    ? 'Žádná data — spusťte synchronizaci z Mailchimp (tlačítko výše).'
                    : 'Žádné výsledky — upravte filtry.'}
                </td>
              </tr>
            ) : (
              rows.map((r) => {
                const sortedTags = sortTagsForDisplay([...(r.tags || [])]);
                return (
                  <tr key={r.email_hash} className="border-b border-gray-50 hover:bg-purple-50/20">
                    <td className="max-w-[220px] truncate px-3 py-2 font-mono text-[11px] text-[#001161]">{r.email}</td>
                    <td className="max-w-[280px] truncate px-3 py-2 text-gray-600" title={r.school || ''}>
                      {r.school || '—'}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-[10px] uppercase text-gray-400">{r.status || '—'}</td>
                    <td className="px-3 py-2">
                      <div className="flex max-w-[400px] flex-wrap gap-1">
                        {sortedTags.slice(0, 10).map((t) => (
                          <span
                            key={t}
                            className={cn(
                              'inline-block max-w-[200px] truncate rounded px-1.5 py-0.5 text-[10px] font-medium',
                              isParentTagLabel(t)
                                ? 'bg-amber-100 text-amber-900 ring-1 ring-amber-200/80'
                                : 'bg-purple-100 text-purple-800',
                            )}
                            title={t}
                          >
                            {t}
                          </span>
                        ))}
                        {sortedTags.length > 10 ? (
                          <span className="self-center text-[10px] text-gray-400">{`+${sortedTags.length - 10}`}</span>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
