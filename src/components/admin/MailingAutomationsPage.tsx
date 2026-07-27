import React, { useCallback, useEffect, useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Loader2,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import { getSupabaseBrowser } from '@/lib/supabaseBrowser';
import { getEdgeFunctionHeaders } from '../../lib/edgeFunctionHeaders';
import { projectId } from '../../utils/supabase/info';

const SERVER = `https://${projectId}.supabase.co/functions/v1/make-server-93a20b6f`;
const FF = { fontFamily: "'Fenomen Sans', sans-serif" } as const;

/* Stejný formát jako automationEngine.ts na serveru. */
type FlowStep = {
  key: string;
  type: 'send_email' | 'wait' | 'add_tag' | 'remove_tag' | 'condition' | 'exit';
  draftId?: string;
  subject?: string;
  html?: string;
  days?: number;
  hours?: number;
  untilField?: 'trial_expires_at';
  offsetDays?: number;
  tag?: string;
  if?: { hasTag?: string; isCustomer?: boolean };
  thenKey?: string;
  elseKey?: string;
};

type FlowDefinition = {
  trigger?: { type?: string; filter?: { source?: string; tag?: string } };
  steps?: FlowStep[];
};

type FlowRow = {
  id: string;
  name: string;
  slug: string | null;
  definition: FlowDefinition;
  is_active: boolean;
  created_at: string;
};

type EnrollmentCounts = { active: number; completed: number; exited: number; paused: number };

type FunnelRow = { stepKey: string; label: string; sends: number };

const TRIGGER_LABELS: Record<string, string> = {
  subscriber_created: 'Nový kontakt',
  tag_added: 'Přidán tag',
  trial_activated: 'Aktivace trialu',
  webinar_registered: 'Registrace na webinář',
  order_paid: 'Zaplacená objednávka',
};

const STEP_TYPE_LABELS: Record<FlowStep['type'], string> = {
  send_email: 'Poslat e-mail',
  wait: 'Počkat',
  add_tag: 'Přidat tag',
  remove_tag: 'Odebrat tag',
  condition: 'Podmínka',
  exit: 'Konec',
};

function stepSummary(step: FlowStep): string {
  switch (step.type) {
    case 'send_email':
      return step.subject || (step.draftId ? `draft ${step.draftId.slice(0, 8)}…` : '(bez předmětu)');
    case 'wait':
      if (step.untilField === 'trial_expires_at') {
        const off = step.offsetDays || 0;
        return off === 0 ? 'do konce trialu' : `do konce trialu ${off > 0 ? '+' : ''}${off} dní`;
      }
      return [step.days ? `${step.days} dní` : '', step.hours ? `${step.hours} h` : ''].filter(Boolean).join(' ') || '0';
    case 'add_tag':
    case 'remove_tag':
      return step.tag || '(bez tagu)';
    case 'condition':
      return step.if?.hasTag ? `má tag „${step.if.hasTag}"` : typeof step.if?.isCustomer === 'boolean' ? `zákazník = ${step.if.isCustomer ? 'ano' : 'ne'}` : '(prázdná)';
    case 'exit':
      return 'ukončit flow';
  }
}

/** Admin automatizací: seznam flows, lineární editor kroků, enrollmenty a funnel. */
export default function MailingAutomationsPage() {
  const [loading, setLoading] = useState(true);
  const [flows, setFlows] = useState<FlowRow[]>([]);
  const [counts, setCounts] = useState<Record<string, EnrollmentCounts>>({});
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [funnels, setFunnels] = useState<Record<string, FunnelRow[]>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [seeding, setSeeding] = useState(false);

  /* Editor */
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorSaving, setEditorSaving] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editTriggerType, setEditTriggerType] = useState('subscriber_created');
  const [editTriggerSource, setEditTriggerSource] = useState('');
  const [editSteps, setEditSteps] = useState<FlowStep[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const supabase = getSupabaseBrowser();
      const { data, error } = await supabase
        .from('automation_flows')
        .select('id, name, slug, definition, is_active, created_at')
        .order('created_at', { ascending: true });
      if (error) throw new Error(error.message);
      const rows = (data || []) as FlowRow[];
      setFlows(rows);

      if (rows.length > 0) {
        const { data: enr, error: enrErr } = await supabase
          .from('automation_enrollments')
          .select('flow_id, status')
          .in('flow_id', rows.map((f) => f.id));
        if (enrErr) throw new Error(enrErr.message);
        const byFlow: Record<string, EnrollmentCounts> = {};
        for (const e of enr || []) {
          const fid = e.flow_id as string;
          const cur = byFlow[fid] || { active: 0, completed: 0, exited: 0, paused: 0 };
          const st = String(e.status) as keyof EnrollmentCounts;
          if (st in cur) cur[st] += 1;
          byFlow[fid] = cur;
        }
        setCounts(byFlow);
      } else {
        setCounts({});
      }
    } catch (e) {
      console.error('Flows load error:', e);
      toast.error(`Načtení automatizací: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  /** Funnel: počet send eventů per krok (metadata.step_key z automation runneru). */
  const loadFunnel = useCallback(async (flow: FlowRow) => {
    try {
      const supabase = getSupabaseBrowser();
      const { data, error } = await supabase
        .from('email_events')
        .select('metadata')
        .eq('event_type', 'send')
        .eq('metadata->>flow_id', flow.id)
        .limit(10000);
      if (error) throw new Error(error.message);
      const byStep = new Map<string, number>();
      for (const ev of data || []) {
        const key = String((ev.metadata as Record<string, unknown> | null)?.step_key || '');
        if (key) byStep.set(key, (byStep.get(key) || 0) + 1);
      }
      const steps = (flow.definition.steps || []).filter((s) => s.type === 'send_email');
      setFunnels((prev) => ({
        ...prev,
        [flow.id]: steps.map((s) => ({ stepKey: s.key, label: s.subject || s.key, sends: byStep.get(s.key) || 0 })),
      }));
    } catch (e) {
      console.error('Funnel load error:', e);
    }
  }, []);

  const toggleExpand = (flow: FlowRow) => {
    if (expandedId === flow.id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(flow.id);
    if (!funnels[flow.id]) void loadFunnel(flow);
  };

  const toggleActive = async (flow: FlowRow) => {
    setBusyId(flow.id);
    try {
      const r = await fetch(`${SERVER}/admin/mailing/flows/${flow.id}/toggle`, {
        method: 'POST',
        headers: await getEdgeFunctionHeaders(true),
        body: JSON.stringify({ isActive: !flow.is_active }),
      });
      const data = await r.json();
      if (!data.ok) throw new Error(data.error || `HTTP ${r.status}`);
      toast.success(!flow.is_active ? 'Flow aktivováno.' : 'Flow pozastaveno — kroky se přestanou vykonávat.');
      await load();
    } catch (e) {
      toast.error(`Přepnutí flow: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusyId(null);
    }
  };

  const deleteFlow = async (flow: FlowRow) => {
    if (!window.confirm(`Smazat flow „${flow.name}" včetně enrollmentů?`)) return;
    setBusyId(flow.id);
    try {
      const r = await fetch(`${SERVER}/admin/mailing/flows/${flow.id}`, {
        method: 'DELETE',
        headers: await getEdgeFunctionHeaders(true),
      });
      const data = await r.json();
      if (!data.ok) throw new Error(data.error || `HTTP ${r.status}`);
      toast.success('Flow smazáno.');
      await load();
    } catch (e) {
      toast.error(`Smazání flow: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusyId(null);
    }
  };

  const seedDefaults = async () => {
    setSeeding(true);
    try {
      const r = await fetch(`${SERVER}/admin/mailing/flows/seed-defaults`, {
        method: 'POST',
        headers: await getEdgeFunctionHeaders(true),
      });
      const data = await r.json();
      if (!data.ok) throw new Error(data.error || `HTTP ${r.status}`);
      toast.success(data.created > 0 ? `Vytvořeno ${data.created} připravených flows (neaktivní).` : 'Připravené flows už existují.');
      await load();
    } catch (e) {
      toast.error(`Seed flows: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setSeeding(false);
    }
  };

  const openEditor = (flow?: FlowRow) => {
    setEditId(flow?.id ?? null);
    setEditName(flow?.name ?? '');
    setEditTriggerType(flow?.definition.trigger?.type || 'subscriber_created');
    setEditTriggerSource(flow?.definition.trigger?.filter?.source || '');
    setEditSteps(flow?.definition.steps ? JSON.parse(JSON.stringify(flow.definition.steps)) : []);
    setEditorOpen(true);
  };

  const updateStep = (idx: number, patch: Partial<FlowStep>) => {
    setEditSteps((prev) => prev.map((s, i) => (i === idx ? { ...s, ...patch } : s)));
  };

  const addStep = (type: FlowStep['type']) => {
    setEditSteps((prev) => [...prev, { key: `krok-${Date.now().toString(36)}`, type }]);
  };

  const saveFlow = async () => {
    if (!editName.trim()) {
      toast.error('Vyplňte název flow.');
      return;
    }
    setEditorSaving(true);
    try {
      const definition: FlowDefinition = {
        trigger: {
          type: editTriggerType,
          ...(editTriggerSource.trim() ? { filter: { source: editTriggerSource.trim() } } : {}),
        },
        steps: editSteps,
      };
      const r = await fetch(`${SERVER}/admin/mailing/flows`, {
        method: 'POST',
        headers: await getEdgeFunctionHeaders(true),
        body: JSON.stringify({ id: editId || undefined, name: editName.trim(), definition }),
      });
      const data = await r.json();
      if (!data.ok) throw new Error(data.error || `HTTP ${r.status}`);
      toast.success('Flow uloženo.');
      setEditorOpen(false);
      await load();
    } catch (e) {
      toast.error(`Uložení flow: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setEditorSaving(false);
    }
  };

  return (
    <div className="min-h-0 flex-1 overflow-y-auto bg-[#fcfcfe] p-6" style={FF}>
      <div className="mx-auto max-w-[1000px] space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-[#7C3AED]" aria-hidden />
            <h1 className="text-[18px] font-bold text-[#001161]">Automatizace</h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void seedDefaults()}
              disabled={seeding}
              className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-[12px] font-bold text-[#001161]/60 hover:border-[#7C3AED]/35 hover:text-[#7C3AED] disabled:opacity-45 transition-all cursor-pointer"
            >
              {seeding ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden /> : <Sparkles className="w-4 h-4" aria-hidden />}
              Připravené flows
            </button>
            <button
              type="button"
              onClick={() => void load()}
              disabled={loading}
              className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-[12px] font-bold text-[#001161]/60 hover:border-[#7C3AED]/35 hover:text-[#7C3AED] disabled:opacity-45 transition-all cursor-pointer"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden /> : <RefreshCw className="w-4 h-4" aria-hidden />}
              Obnovit
            </button>
            <button
              type="button"
              onClick={() => openEditor()}
              className="flex items-center gap-2 rounded-xl bg-[#7C3AED] px-3 py-2 text-[12px] font-bold text-white hover:bg-[#6D28D9] transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" aria-hidden />
              Nové flow
            </button>
          </div>
        </div>

        <p className="text-[12px] text-[#001161]/45 leading-snug">
          Flow se spouští triggerem (trial, webinář, newsletter, objednávka) a vykonává lineární kroky — e-maily posílá runner každých 5 minut přes Resend.
          Odhlášený kontakt z flow automaticky vypadne.
        </p>

        {loading && flows.length === 0 ? (
          <div className="flex items-center gap-2 rounded-2xl border border-gray-200 bg-white px-4 py-8 justify-center text-[13px] text-[#001161]/50">
            <Loader2 className="w-4 h-4 animate-spin text-[#7C3AED]" aria-hidden />
            Načítám automatizace…
          </div>
        ) : flows.length === 0 ? (
          <div className="rounded-2xl border border-gray-200 bg-white px-4 py-10 text-center space-y-3">
            <Sparkles className="w-6 h-6 text-[#7C3AED]/50 mx-auto" aria-hidden />
            <p className="text-[13px] text-[#001161]/55">
              Zatím žádná flow. Začněte tlačítkem „Připravené flows" (trial welcome, expirace, webinar follow-up, newsletter welcome).
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {flows.map((flow) => {
              const cnt = counts[flow.id] || { active: 0, completed: 0, exited: 0, paused: 0 };
              const expanded = expandedId === flow.id;
              const steps = flow.definition.steps || [];
              const trigger = flow.definition.trigger;
              return (
                <div key={flow.id} className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
                  <div
                    className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-[#7C3AED]/[0.03] transition-colors"
                    onClick={() => toggleExpand(flow)}
                  >
                    {expanded ? (
                      <ChevronDown className="w-4 h-4 text-[#001161]/40 shrink-0" aria-hidden />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-[#001161]/40 shrink-0" aria-hidden />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-bold text-[#001161] leading-tight truncate">{flow.name}</p>
                      <p className="text-[11px] text-[#001161]/40 mt-0.5">
                        Trigger: {TRIGGER_LABELS[trigger?.type || ''] || trigger?.type || '—'}
                        {trigger?.filter?.source ? ` (source ${trigger.filter.source})` : ''}
                        {' · '}{steps.length} kroků
                      </p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0 text-[11px] text-[#001161]/55" onClick={(e) => e.stopPropagation()}>
                      <span title="aktivní / dokončené / vyřazené enrollmenty">
                        {cnt.active} aktivních · {cnt.completed} hotových · {cnt.exited} vyřazených
                      </span>
                      <span
                        className={`inline-block px-2 py-0.5 rounded-lg text-[10px] font-bold ${
                          flow.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-[#001161]/50'
                        }`}
                      >
                        {flow.is_active ? 'Aktivní' : 'Vypnuto'}
                      </span>
                      <button
                        type="button"
                        onClick={() => void toggleActive(flow)}
                        disabled={busyId === flow.id}
                        className="p-1.5 rounded-lg text-[#001161]/40 hover:text-[#7C3AED] hover:bg-[#7C3AED]/10 disabled:opacity-45 transition-colors cursor-pointer"
                        title={flow.is_active ? 'Pozastavit' : 'Aktivovat'}
                      >
                        {busyId === flow.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" aria-hidden />
                        ) : flow.is_active ? (
                          <Pause className="w-4 h-4" aria-hidden />
                        ) : (
                          <Play className="w-4 h-4" aria-hidden />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => openEditor(flow)}
                        className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-gray-100 text-[#001161]/60 hover:bg-[#7C3AED]/15 hover:text-[#7C3AED] transition-colors cursor-pointer"
                      >
                        Upravit
                      </button>
                      <button
                        type="button"
                        onClick={() => void deleteFlow(flow)}
                        disabled={busyId === flow.id}
                        className="p-1.5 rounded-lg text-[#001161]/40 hover:text-red-600 hover:bg-red-50 disabled:opacity-45 transition-colors cursor-pointer"
                        title="Smazat flow"
                      >
                        <Trash2 className="w-4 h-4" aria-hidden />
                      </button>
                    </div>
                  </div>
                  {expanded && (
                    <div className="border-t border-gray-100 bg-[#fafbfd] px-5 py-4 grid gap-4 lg:grid-cols-2">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#001161]/40 mb-2">Kroky</p>
                        <ol className="space-y-1.5">
                          {steps.map((s, i) => (
                            <li key={s.key} className="text-[12px] text-[#001161]/70 flex items-start gap-2">
                              <span className="font-bold text-[#7C3AED] shrink-0">{i + 1}.</span>
                              <span>
                                <strong>{STEP_TYPE_LABELS[s.type]}</strong> — {stepSummary(s)}
                              </span>
                            </li>
                          ))}
                          {steps.length === 0 && <li className="text-[12px] text-[#001161]/45">Žádné kroky.</li>}
                        </ol>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#001161]/40 mb-2">Funnel (odeslané e-maily per krok)</p>
                        {funnels[flow.id] ? (
                          funnels[flow.id].length > 0 ? (
                            <ul className="space-y-1.5">
                              {funnels[flow.id].map((f) => (
                                <li key={f.stepKey} className="text-[12px] text-[#001161]/70 flex items-start gap-2">
                                  <span className="font-bold text-[#7C3AED] shrink-0">{f.sends}×</span>
                                  <span className="leading-snug">{f.label}</span>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="text-[12px] text-[#001161]/45">Flow nemá e-mailové kroky.</p>
                          )
                        ) : (
                          <p className="text-[12px] text-[#001161]/45">Načítám…</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {editorOpen && (
        <div
          className="fixed inset-0 z-[21000] flex items-center justify-center bg-black/45 p-4"
          role="presentation"
          onClick={() => !editorSaving && setEditorOpen(false)}
        >
          <div
            className="w-full max-w-[640px] max-h-[85vh] rounded-2xl bg-white shadow-2xl border border-gray-100 overflow-hidden flex flex-col"
            style={FF}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 pt-4 pb-3 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-[15px] font-bold text-[#001161]">{editId ? 'Upravit flow' : 'Nové flow'}</h2>
              <button type="button" onClick={() => setEditorOpen(false)} className="p-1.5 rounded-lg text-[#001161]/40 hover:bg-gray-100 cursor-pointer">
                <X className="w-4 h-4" aria-hidden />
              </button>
            </div>
            <div className="px-5 py-4 space-y-4 overflow-y-auto">
              <div>
                <label className="block text-[10px] font-bold text-[#001161]/40 uppercase tracking-wide mb-1.5">Název</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-[13px] text-[#001161] focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/25"
                  placeholder="např. Trial welcome"
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-[10px] font-bold text-[#001161]/40 uppercase tracking-wide mb-1.5">Trigger</label>
                  <select
                    value={editTriggerType}
                    onChange={(e) => setEditTriggerType(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-[13px] text-[#001161] bg-white focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/25"
                  >
                    {Object.entries(TRIGGER_LABELS).map(([v, l]) => (
                      <option key={v} value={v}>{l}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-[#001161]/40 uppercase tracking-wide mb-1.5">Filtr source (volitelné)</label>
                  <input
                    type="text"
                    value={editTriggerSource}
                    onChange={(e) => setEditTriggerSource(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-[13px] text-[#001161] focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/25"
                    placeholder="např. newsletter"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-[#001161]/40 uppercase tracking-wide mb-1.5">Kroky (vykonávají se postupně)</label>
                <div className="space-y-2">
                  {editSteps.map((s, i) => (
                    <div key={s.key} className="rounded-xl border border-gray-200 p-3 space-y-2 bg-[#fafbfd]">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-bold text-[#7C3AED] shrink-0">{i + 1}.</span>
                        <select
                          value={s.type}
                          onChange={(e) => updateStep(i, { type: e.target.value as FlowStep['type'] })}
                          className="rounded-lg border border-gray-200 px-2 py-1.5 text-[12px] text-[#001161] bg-white"
                        >
                          {Object.entries(STEP_TYPE_LABELS).map(([v, l]) => (
                            <option key={v} value={v}>{l}</option>
                          ))}
                        </select>
                        <div className="flex-1" />
                        <button
                          type="button"
                          onClick={() => setEditSteps((prev) => prev.filter((_, j) => j !== i))}
                          className="p-1 rounded-lg text-[#001161]/40 hover:text-red-600 hover:bg-red-50 cursor-pointer"
                          title="Odebrat krok"
                        >
                          <Trash2 className="w-3.5 h-3.5" aria-hidden />
                        </button>
                      </div>
                      {s.type === 'send_email' && (
                        <div className="space-y-2">
                          <input
                            type="text"
                            value={s.subject || ''}
                            onChange={(e) => updateStep(i, { subject: e.target.value })}
                            className="w-full rounded-lg border border-gray-200 px-2.5 py-1.5 text-[12px] text-[#001161]"
                            placeholder="Předmět e-mailu"
                          />
                          <input
                            type="text"
                            value={s.draftId || ''}
                            onChange={(e) => updateStep(i, { draftId: e.target.value || undefined })}
                            className="w-full rounded-lg border border-gray-200 px-2.5 py-1.5 text-[12px] text-[#001161] font-mono"
                            placeholder="ID draftu z EmailBuilderu (volitelné — jinak HTML níže)"
                          />
                          <textarea
                            value={s.html || ''}
                            onChange={(e) => updateStep(i, { html: e.target.value || undefined })}
                            rows={3}
                            className="w-full rounded-lg border border-gray-200 px-2.5 py-1.5 text-[12px] text-[#001161] font-mono"
                            placeholder="HTML těla (merge fieldy {{first_name|učiteli}} fungují)"
                          />
                        </div>
                      )}
                      {s.type === 'wait' && (
                        <div className="flex flex-wrap items-center gap-2 text-[12px] text-[#001161]/70">
                          <label className="flex items-center gap-1.5">
                            <input
                              type="checkbox"
                              checked={s.untilField === 'trial_expires_at'}
                              onChange={(e) => updateStep(i, e.target.checked ? { untilField: 'trial_expires_at', days: undefined, hours: undefined } : { untilField: undefined, offsetDays: undefined })}
                            />
                            do konce trialu
                          </label>
                          {s.untilField === 'trial_expires_at' ? (
                            <label className="flex items-center gap-1.5">
                              offset dní
                              <input
                                type="number"
                                value={s.offsetDays ?? 0}
                                onChange={(e) => updateStep(i, { offsetDays: Number(e.target.value) })}
                                className="w-20 rounded-lg border border-gray-200 px-2 py-1"
                              />
                            </label>
                          ) : (
                            <>
                              <label className="flex items-center gap-1.5">
                                dní
                                <input
                                  type="number"
                                  min={0}
                                  value={s.days ?? 0}
                                  onChange={(e) => updateStep(i, { days: Number(e.target.value) })}
                                  className="w-16 rounded-lg border border-gray-200 px-2 py-1"
                                />
                              </label>
                              <label className="flex items-center gap-1.5">
                                hodin
                                <input
                                  type="number"
                                  min={0}
                                  value={s.hours ?? 0}
                                  onChange={(e) => updateStep(i, { hours: Number(e.target.value) })}
                                  className="w-16 rounded-lg border border-gray-200 px-2 py-1"
                                />
                              </label>
                            </>
                          )}
                        </div>
                      )}
                      {(s.type === 'add_tag' || s.type === 'remove_tag') && (
                        <input
                          type="text"
                          value={s.tag || ''}
                          onChange={(e) => updateStep(i, { tag: e.target.value })}
                          className="w-full rounded-lg border border-gray-200 px-2.5 py-1.5 text-[12px] text-[#001161]"
                          placeholder="Název tagu"
                        />
                      )}
                      {s.type === 'condition' && (
                        <div className="flex flex-wrap items-center gap-2 text-[12px] text-[#001161]/70">
                          <label className="flex items-center gap-1.5">
                            má tag
                            <input
                              type="text"
                              value={s.if?.hasTag || ''}
                              onChange={(e) => updateStep(i, { if: { ...s.if, hasTag: e.target.value || undefined } })}
                              className="w-36 rounded-lg border border-gray-200 px-2 py-1"
                              placeholder="název tagu"
                            />
                          </label>
                          <span className="text-[#001161]/40">nesplněno bez else = konec flow</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {(Object.keys(STEP_TYPE_LABELS) as FlowStep['type'][]).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => addStep(t)}
                      className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-gray-100 text-[#001161]/60 hover:bg-[#7C3AED]/15 hover:text-[#7C3AED] transition-colors cursor-pointer"
                    >
                      + {STEP_TYPE_LABELS[t]}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-end gap-2 bg-[#fafbfd]">
              <button
                type="button"
                onClick={() => setEditorOpen(false)}
                disabled={editorSaving}
                className="px-4 py-2 rounded-xl text-[12px] font-bold text-[#001161]/55 hover:bg-gray-100 cursor-pointer disabled:opacity-45"
              >
                Zrušit
              </button>
              <button
                type="button"
                onClick={() => void saveFlow()}
                disabled={editorSaving}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-[12px] font-bold bg-[#7C3AED] text-white hover:bg-[#6D28D9] disabled:opacity-45 cursor-pointer"
              >
                {editorSaving && <Loader2 className="w-4 h-4 animate-spin" aria-hidden />}
                Uložit flow
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
