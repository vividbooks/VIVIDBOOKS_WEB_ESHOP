/**
 * /marketing/skoleni-certifikaty — certifikáty ze školení pro školy.
 * Po školení se tu založí záznam a škole se pošle odkaz, kde si učitelé certifikát stáhnou.
 * Data: /skoleni-certifikaty (staff JWT), viz server/skoleniCertifikaty.ts.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Check, Copy, ExternalLink, Loader2, Pencil, Plus, Trash2 } from 'lucide-react';
import { edgeFunctionBase } from '../../utils/edgeFunctionBase';
import {
  SKOLENI_KIND_LABEL,
  formatSkoleniDateCs,
  type SkoleniCertForm,
  type SkoleniCertKind,
} from '../../lib/skoleniCertifikat';

type Issue = { email: string; name: string; birthDateIso: string; issuedAt: string };
type Item = {
  token: string;
  title: string;
  schoolName: string;
  dateIso: string;
  time: string;
  durationMinutes: number;
  lecturer: string;
  form: SkoleniCertForm;
  kind: SkoleniCertKind;
  allowedEmails: string[];
  issued: Issue[];
};
type FormState = {
  token: string;
  title: string;
  schoolName: string;
  dateIso: string;
  time: string;
  durationMinutes: string;
  lecturer: string;
  form: SkoleniCertForm | '';
  kind: SkoleniCertKind | '';
  allowedEmails: string;
};

const EMPTY: FormState = {
  token: '',
  title: 'Školení Vividbooks',
  schoolName: '',
  dateIso: '',
  time: '',
  durationMinutes: '60',
  lecturer: '',
  form: '',
  kind: '',
  allowedEmails: '',
};

const FF = { fontFamily: "'Fenomen Sans', sans-serif" } as const;
const INPUT =
  'w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-[14px] text-[#001161] outline-none focus:border-[#001161]/50';
const LABEL = 'mb-1 block text-[12px] font-bold text-[#001161]/70';

async function adminCall<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const { getRequiredEdgeFunctionHeaders } = await import('../../lib/edgeFunctionHeaders');
  const headers = await getRequiredEdgeFunctionHeaders(true);
  const res = await fetch(`${edgeFunctionBase()}/skoleni-certifikaty${path}`, {
    method: init.method || (init.body ? 'POST' : 'GET'),
    headers,
    body: init.body ? JSON.stringify(init.body) : undefined,
  });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
  return data;
}

function linkFor(token: string): string {
  return `https://www.vividbooks.com/skoleni/certifikat/${token}`;
}

function Choice<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T | '';
  onChange: (v: T) => void;
  options: Array<[T, string]>;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(([v, label]) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          className={`rounded-lg border px-3 py-2 text-[13px] font-bold transition ${
            value === v
              ? 'border-[#001161] bg-[#001161] text-white'
              : 'border-gray-200 bg-white text-[#001161]/70 hover:border-[#001161]/40'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

export default function SkoleniCertifikatyAdminPage() {
  const [items, setItems] = useState<Item[] | null>(null);
  const [error, setError] = useState('');
  const [form, setForm] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [copied, setCopied] = useState('');

  const loadItems = useCallback(async () => {
    try {
      const d = await adminCall<{ items: Item[] }>('');
      setItems(d.items);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Chyba');
      setItems((prev) => prev ?? []);
    }
  }, []);

  useEffect(() => {
    void loadItems();
  }, [loadItems]);

  const upd = (patch: Partial<FormState>) => setForm((f) => (f ? { ...f, ...patch } : f));

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form || saving) return;
    setSaving(true);
    setFormError('');
    try {
      await adminCall('', { body: { ...form, durationMinutes: Number(form.durationMinutes) } });
      setForm(null);
      await loadItems();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Chyba');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (it: Item) => {
    if (!window.confirm(`Smazat „${it.title}“ (${it.schoolName || formatSkoleniDateCs(it.dateIso)})? Odkaz pro školu přestane fungovat.`)) return;
    try {
      await adminCall(`/${it.token}`, { method: 'DELETE' });
      await loadItems();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Chyba');
    }
  };

  const copy = async (token: string) => {
    try {
      await navigator.clipboard.writeText(linkFor(token));
      setCopied(token);
      window.setTimeout(() => setCopied(''), 2000);
    } catch {
      window.prompt('Zkopírujte odkaz:', linkFor(token));
    }
  };

  return (
    <div className="mx-auto w-full max-w-[980px] p-6" style={FF}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[24px] font-bold text-[#001161]">Certifikáty ze školení</h1>
          <p className="mt-1 max-w-[620px] text-[14px] leading-relaxed text-[#001161]/65">
            Po školení ve škole nebo online tu založte záznam a škole pošlete odkaz. Každý učitel si na něm
            vyplní jméno a certifikát si stáhne sám.
          </p>
        </div>
        {!form ? (
          <button
            type="button"
            onClick={() => { setForm(EMPTY); setFormError(''); }}
            className="inline-flex items-center gap-2 rounded-xl bg-[#001161] px-4 py-2.5 text-[14px] font-bold text-white"
          >
            <Plus className="h-4 w-4" /> Nové školení
          </button>
        ) : null}
      </div>

      {error ? <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-[13px] text-red-700">{error}</p> : null}

      {form ? (
        <form onSubmit={save} className="mt-6 rounded-2xl border border-gray-200 bg-white p-5">
          <h2 className="text-[16px] font-bold text-[#001161]">{form.token ? 'Upravit školení' : 'Nové školení'}</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="block sm:col-span-2">
              <span className={LABEL}>Název školení (tak, jak bude na certifikátu)</span>
              <input className={INPUT} value={form.title} onChange={(e) => upd({ title: e.target.value })} required />
            </label>
            <label className="block sm:col-span-2">
              <span className={LABEL}>Škola</span>
              <input className={INPUT} value={form.schoolName} onChange={(e) => upd({ schoolName: e.target.value })} placeholder="např. ZŠ Lipová, Brno" />
            </label>
            <label className="block">
              <span className={LABEL}>Datum</span>
              <input className={INPUT} type="date" value={form.dateIso} onChange={(e) => upd({ dateIso: e.target.value })} required />
            </label>
            <label className="block">
              <span className={LABEL}>Začátek</span>
              <input className={INPUT} type="time" value={form.time} onChange={(e) => upd({ time: e.target.value })} />
            </label>
            <label className="block">
              <span className={LABEL}>Délka v minutách</span>
              <input className={INPUT} type="number" min={15} max={600} step={15} value={form.durationMinutes} onChange={(e) => upd({ durationMinutes: e.target.value })} required />
            </label>
            <label className="block">
              <span className={LABEL}>Lektor</span>
              <input className={INPUT} value={form.lecturer} onChange={(e) => upd({ lecturer: e.target.value })} placeholder="např. Iveta Fišerová" />
            </label>
            <div>
              <span className={LABEL}>Kde proběhlo</span>
              <Choice value={form.form} onChange={(v) => upd({ form: v })} options={[['online', 'Online'], ['prezencni', 'Ve škole']]} />
            </div>
            <div>
              <span className={LABEL}>Typ dokladu</span>
              <Choice value={form.kind} onChange={(v) => upd({ kind: v })} options={[['dvpp', 'Certifikát DVPP'], ['ucast', 'Potvrzení o účasti']]} />
              <p className="mt-1.5 text-[12px] leading-relaxed text-[#001161]/55">
                Certifikát DVPP jen u školení, které je akreditované. U ostatních potvrzení o účasti.
              </p>
            </div>
            <label className="block sm:col-span-2">
              <span className={LABEL}>E-maily účastníků (nepovinné)</span>
              <textarea
                className={`${INPUT} min-h-[90px]`}
                value={form.allowedEmails}
                onChange={(e) => upd({ allowedEmails: e.target.value })}
                placeholder="Jeden na řádek nebo oddělené čárkou. Když pole necháte prázdné, certifikát si stáhne každý, kdo má odkaz."
              />
            </label>
          </div>
          {formError ? <p className="mt-3 text-[13px] text-red-600">{formError}</p> : null}
          <div className="mt-5 flex gap-3">
            <button type="submit" disabled={saving} className="rounded-xl bg-[#001161] px-5 py-2.5 text-[14px] font-bold text-white disabled:opacity-50">
              {saving ? 'Ukládám…' : 'Uložit'}
            </button>
            <button type="button" onClick={() => setForm(null)} className="rounded-xl border border-gray-200 px-5 py-2.5 text-[14px] font-bold text-[#001161]/70">
              Zrušit
            </button>
          </div>
        </form>
      ) : null}

      <div className="mt-6 flex flex-col gap-4">
        {items === null ? (
          <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-[#001161]/40" /></div>
        ) : items.length === 0 && !form ? (
          <p className="rounded-2xl border border-dashed border-gray-300 bg-white px-6 py-10 text-center text-[14px] text-[#001161]/60">
            Zatím tu není žádné školení. Založte první tlačítkem Nové školení.
          </p>
        ) : (
          items.map((it) => (
            <div key={it.token} className="rounded-2xl border border-gray-200 bg-white p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-[16px] font-bold text-[#001161]">{it.title}</p>
                  <p className="mt-0.5 text-[13px] text-[#001161]/65">
                    {[it.schoolName, formatSkoleniDateCs(it.dateIso), `${it.durationMinutes} min`, it.form === 'online' ? 'online' : 've škole', it.lecturer]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                </div>
                <span className={`rounded-full px-3 py-1 text-[12px] font-bold ${it.kind === 'dvpp' ? 'bg-[#001161] text-white' : 'bg-gray-100 text-[#001161]/70'}`}>
                  {SKOLENI_KIND_LABEL[it.kind]}
                </span>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <code className="min-w-0 flex-1 truncate rounded-lg bg-[#f7f8fc] px-3 py-2 text-[12px] text-[#001161]/80">{linkFor(it.token)}</code>
                <button type="button" onClick={() => copy(it.token)} className="inline-flex items-center gap-1.5 rounded-lg bg-[#001161] px-3 py-2 text-[13px] font-bold text-white">
                  {copied === it.token ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  {copied === it.token ? 'Zkopírováno' : 'Kopírovat odkaz'}
                </button>
                <a href={`/skoleni/certifikat/${it.token}`} target="_blank" rel="noreferrer" title="Otevřít" className="rounded-lg border border-gray-200 p-2 text-[#001161]/70 hover:text-[#001161]">
                  <ExternalLink className="h-4 w-4" />
                </a>
                <button
                  type="button"
                  title="Upravit"
                  onClick={() => {
                    setFormError('');
                    setForm({ ...it, durationMinutes: String(it.durationMinutes), allowedEmails: it.allowedEmails.join('\n') });
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className="rounded-lg border border-gray-200 p-2 text-[#001161]/70 hover:text-[#001161]"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button type="button" title="Smazat" onClick={() => remove(it)} className="rounded-lg border border-gray-200 p-2 text-red-600/80 hover:text-red-600">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>

              <p className="mt-4 text-[12px] font-bold uppercase tracking-wide text-[#001161]/45">
                Stáhli si certifikát: {it.issued.length}
                {it.allowedEmails.length ? ` z ${it.allowedEmails.length} nahlášených` : ''}
              </p>
              {it.issued.length ? (
                <ul className="mt-2 divide-y divide-gray-100 text-[13px] text-[#001161]">
                  {it.issued.map((i) => (
                    <li key={i.email} className="flex flex-wrap justify-between gap-2 py-1.5">
                      <span className="font-semibold">{i.name}</span>
                      <span className="text-[#001161]/60">{i.email} · {new Date(i.issuedAt).toLocaleDateString('cs-CZ')}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
