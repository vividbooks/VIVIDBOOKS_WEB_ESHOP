import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { toast } from 'sonner@2.0.3';
import {
  GraduationCap, Users, School, Target, BookOpen, RefreshCw, Search, Download, Mail, Send, Copy, Plus, Trash2, X,
  CheckCircle2, AlertTriangle, Clock, ExternalLink, Loader2, Phone, KeyRound, ChevronRight, Sparkles, Play, BarChart3,
} from 'lucide-react';
import { cn } from '../ui/utils';
import {
  CONTACT_STATUS_LABELS,
  FACULTY_OUTREACH_LABELS,
  formatCzDate,
  STUDENT_STATUS_LABELS,
  studentProgramAdmin,
  type OutreachTemplate,
  type StudentProgramEvent,
  type StudentProgramFacultyContact,
  type StudentProgramFacultyRow,
  type StudentProgramGoals,
  type StudentProgramMeasurement,
  type StudentProgramMeasurementRow,
  type StudentProgramOverview,
  type StudentProgramSettings,
  type StudentProgramStudentRow,
} from '../../utils/studentProgramApi';

type Tab = 'prehled' | 'mereni' | 'studenti' | 'fakulty' | 'cile' | 'metodika';

const TABS: Array<{ id: Tab; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { id: 'prehled', label: 'Přehled', icon: Target },
  { id: 'mereni', label: 'Měření', icon: BarChart3 },
  { id: 'studenti', label: 'Studenti', icon: Users },
  { id: 'fakulty', label: 'Fakulty', icon: School },
  { id: 'cile', label: 'Cíle a nastavení', icon: Sparkles },
  { id: 'metodika', label: 'Metodika', icon: BookOpen },
];

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-gray-100 text-gray-600',
  active: 'bg-emerald-50 text-emerald-700',
  graduating: 'bg-amber-50 text-amber-700',
  alumni: 'bg-sky-50 text-sky-700',
  expired: 'bg-slate-100 text-slate-500',
  declined: 'bg-rose-50 text-rose-600',
  unsubscribed: 'bg-rose-50 text-rose-600',
};

const OUTREACH_COLORS: Record<string, string> = {
  not_contacted: 'bg-gray-100 text-gray-600',
  contacted: 'bg-sky-50 text-sky-700',
  in_talks: 'bg-amber-50 text-amber-700',
  partner: 'bg-emerald-50 text-emerald-700',
  declined: 'bg-rose-50 text-rose-600',
};

const INPUT = 'w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-[13px] text-[#001161] outline-none focus:border-[#7C3AED] focus:ring-2 focus:ring-[#7C3AED]/15';
const BTN_PRIMARY = 'inline-flex items-center gap-2 rounded-xl bg-[#7C3AED] px-4 py-2.5 text-[13px] font-semibold text-white shadow-sm transition-colors hover:bg-[#6d32d8] disabled:opacity-50';
const BTN_SECONDARY = 'inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-[12px] font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50';

function Pill({ className, children }: { className?: string; children: React.ReactNode }) {
  return <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold', className)}>{children}</span>;
}

function Progress({ pct, color = '#7C3AED' }: { pct: number | null; color?: string }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
      <div className="h-full rounded-full transition-all" style={{ width: `${Math.max(0, Math.min(100, pct ?? 0))}%`, backgroundColor: color }} />
    </div>
  );
}

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/* ══════════════════════════════════════════════════════════════════════════
   Přehled
══════════════════════════════════════════════════════════════════════════ */
function OverviewTab({ onQueue }: { onQueue: (queue: string) => void }) {
  const [data, setData] = useState<StudentProgramOverview | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await studentProgramAdmin.overview();
      setData(r.overview);
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  if (loading && !data) return <div className="py-16 text-center text-gray-400"><Loader2 className="mx-auto h-6 w-6 animate-spin" /></div>;
  if (!data) return <div className="py-16 text-center text-gray-400">Data se nepodařilo načíst.</div>;

  const g = data.goals;
  const kpis = [
    { label: 'Aktivní studenti', value: data.totals.active, target: `cíl ${g.targetStudents} do ${formatCzDate(g.targetDate)}`, pct: data.progress.studentsPct, color: '#7C3AED' },
    { label: 'Pokrytí pedagogických fakult', value: `${data.coverage.pedfCovered} / ${data.coverage.pedfTotal}`, target: `cíl ${g.targetPedfCoverage} fakult s aktivním studentem`, pct: data.progress.pedfPct, color: '#10b981' },
    { label: 'Partnerské fakulty', value: data.coverage.partners, target: `cíl ${g.targetFacultyPartners} · osloveno ${data.coverage.contacted}`, pct: data.progress.partnersPct, color: '#0ea5e9' },
    { label: 'Používají Vividbooks', value: data.engagement.activeShare == null ? '—' : `${data.engagement.activeShare} %`, target: `cíl ${g.targetActiveShare} % · odpovědělo ${data.engagement.responded}`, pct: data.progress.activeSharePct, color: '#f59e0b' },
    { label: 'Absolventi se známou školou', value: data.alumni.schoolShare == null ? '—' : `${data.alumni.schoolShare} %`, target: `cíl ${g.targetAlumniSchoolKnown} % · absolventů ${data.alumni.total}`, pct: data.progress.alumniSchoolPct, color: '#ec4899' },
    { label: 'Ověřeno z registrací', value: data.totals.verificationRate == null ? '—' : `${data.totals.verificationRate} %`, target: `${data.totals.verified} z ${data.totals.registered} registrací`, pct: data.totals.verificationRate, color: '#64748b' },
  ];

  const queues = [
    { key: 'no_codes', label: 'Ověření bez kódů', count: data.queues.studentsWithoutCodes, tone: 'danger' as const },
    { key: 'no_licence', label: 'Kódy bez roční licence', count: data.queues.studentsWithoutLicence, tone: 'warn' as const },
    { key: 'renewal_due', label: 'Čeká na roční obnovení', count: data.queues.renewalDueCount, tone: 'warn' as const },
    { key: 'expired_recent', label: 'Skončilo bez obnovení (90 dní)', count: data.queues.expiredRecently, tone: 'info' as const },
    { key: 'alumni_no_school', label: 'Absolventi bez školy', count: data.alumni.total - data.alumni.schoolKnown, tone: 'info' as const },
    { key: 'pending_old', label: 'Neověřeno > 3 dny', count: data.queues.pendingOlderThan3Days, tone: 'muted' as const },
    { key: 'imported', label: 'Importovaní z kontaktů (nepozvaní)', count: data.queues.importedNotInvited, tone: 'info' as const },
  ];

  const monthEntries = Object.entries(data.months);
  const monthMax = Math.max(1, ...monthEntries.map(([, v]) => v.registered));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-[12px] text-gray-400">Stav k {formatCzDate(data.generatedAt, true)} · {data.progress.daysToTarget} dní do cílového data</p>
        <button type="button" onClick={() => void load()} className={BTN_SECONDARY}><RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} /> Obnovit</button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {kpis.map((k) => (
          <div key={k.label} className="rounded-2xl border border-gray-100 bg-white p-5">
            <p className="text-[12px] font-semibold uppercase tracking-wide text-gray-400">{k.label}</p>
            <p className="mt-1 text-[30px] font-bold text-[#001161]">{k.value}</p>
            <p className="mb-3 text-[12px] text-gray-500">{k.target}</p>
            <Progress pct={k.pct} color={k.color} />
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.2fr_1fr]">
        <div className="rounded-2xl border border-gray-100 bg-white p-5">
          <p className="mb-4 text-[13px] font-bold text-[#001161]">Registrace a ověření za 12 měsíců</p>
          <div className="flex h-40 items-end gap-1.5">
            {monthEntries.map(([m, v]) => (
              <div key={m} className="group relative flex flex-1 flex-col items-center justify-end gap-0.5" title={`${m}: ${v.registered} registrací, ${v.verified} ověřeno`}>
                <div className="w-full rounded-t bg-[#7C3AED]/25" style={{ height: `${(v.registered / monthMax) * 100}%`, minHeight: v.registered ? 4 : 0 }}>
                  <div className="w-full rounded-t bg-[#7C3AED]" style={{ height: v.registered ? `${(v.verified / v.registered) * 100}%` : 0 }} />
                </div>
                <span className="text-[9px] text-gray-400">{m.slice(5)}</span>
              </div>
            ))}
          </div>
          <p className="mt-2 text-[11px] text-gray-400">Světlá = registrace, tmavá = ověřeno. Telefon má {data.totals.withPhone} aktivních, osobní e-mail {data.totals.withPersonalEmail}, newsletter {data.totals.newsletter}.</p>
        </div>
        <div className="rounded-2xl border border-gray-100 bg-white p-5">
          <p className="mb-3 text-[13px] font-bold text-[#001161]">Co je potřeba udělat</p>
          <div className="space-y-2">
            {data.queues.renewalDue.length > 0 && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                <p className="mb-1 flex items-center gap-1.5 text-[12px] font-bold text-amber-800"><KeyRound className="h-3.5 w-3.5" /> Blíží se roční obnovení ({data.queues.renewalDueCount})</p>
                <ul className="space-y-0.5 text-[12px] text-amber-900">
                  {data.queues.renewalDue.slice(0, 8).map((st) => (
                    <li key={st.id}>{st.name} ({st.facultyShort || '?'}) — platí do {st.accessValidUntil ? formatCzDate(st.accessValidUntil) : '?'}{st.renewalStage ? `, výzva ${st.renewalStage}× (${formatCzDate(st.renewalSentAt)})` : ', výzva zatím neodešla'}</li>
                  ))}
                </ul>
                <p className="mt-1 text-[11px] text-amber-800/80">Výzvy chodí automaticky 30 a 7 dní před koncem, v den konce a 14 dní po něm. Student obnoví kliknutím; vy můžete „Prodloužit o rok“ v detailu.</p>
              </div>
            )}
            {queues.map((q) => (
              <button key={q.key} type="button" onClick={() => onQueue(q.key)} className="flex w-full items-center justify-between rounded-xl border border-gray-100 px-3 py-2.5 text-left hover:bg-gray-50">
                <span className="text-[13px] text-gray-700">{q.label}</span>
                <span className={cn('rounded-full px-2 py-0.5 text-[12px] font-bold', q.count > 0 ? (q.tone === 'danger' ? 'bg-rose-50 text-rose-600' : q.tone === 'warn' ? 'bg-amber-50 text-amber-700' : 'bg-sky-50 text-sky-700') : 'bg-gray-100 text-gray-400')}>{q.count}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white p-5">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-[13px] font-bold text-[#001161]">Pokrytí podle fakult</p>
          <p className="text-[11px] text-gray-400">Odhadovaný bazén studentů učitelství na PedF: {data.coverage.estimatedPool.toLocaleString('cs-CZ')} · zapojeno {data.coverage.poolShare ?? 0} %</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-gray-400">
                <th className="py-2 pr-3">Fakulta</th>
                <th className="py-2 pr-3">Typ</th>
                <th className="py-2 pr-3">Oslovení</th>
                <th className="py-2 pr-3 text-right">Aktivní</th>
                <th className="py-2 pr-3 text-right">Celkem</th>
                <th className="py-2 pr-3 text-right">Absolventi</th>
                <th className="py-2 pr-3 text-right">Používá</th>
              </tr>
            </thead>
            <tbody>
              {data.perFaculty.map((f) => (
                <tr key={f.id} className="border-t border-gray-50">
                  <td className="py-2 pr-3 font-semibold text-[#001161]">{f.facultyShort} <span className="font-normal text-gray-400">· {f.university}</span></td>
                  <td className="py-2 pr-3">{f.kind === 'pedf' ? <Pill className="bg-violet-50 text-violet-700">PedF</Pill> : <Pill className="bg-gray-100 text-gray-500">učitelství</Pill>}</td>
                  <td className="py-2 pr-3"><Pill className={OUTREACH_COLORS[f.outreachStatus]}>{FACULTY_OUTREACH_LABELS[f.outreachStatus as keyof typeof FACULTY_OUTREACH_LABELS] || f.outreachStatus}</Pill></td>
                  <td className={cn('py-2 pr-3 text-right font-bold', f.active > 0 ? 'text-emerald-700' : 'text-gray-300')}>{f.active}</td>
                  <td className="py-2 pr-3 text-right text-gray-600">{f.total}</td>
                  <td className="py-2 pr-3 text-right text-gray-600">{f.alumni}</td>
                  <td className="py-2 pr-3 text-right text-gray-600">{f.responded ? `${f.usesYes}/${f.responded}` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   Měření: úspěšnost univerzit a používání aplikace
══════════════════════════════════════════════════════════════════════════ */
function subjectLabel(name: string): string {
  return name;
}

function Rate({ value }: { value: number | null }) {
  if (value == null) return <span className="text-gray-300">—</span>;
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="relative inline-block h-1.5 w-12 overflow-hidden rounded-full bg-gray-100">
        <span className="absolute inset-y-0 left-0 rounded-full bg-[#7C3AED]" style={{ width: `${Math.min(100, value)}%` }} />
      </span>
      <span className="tabular-nums">{value} %</span>
    </span>
  );
}

function MeasurementTab() {
  const [data, setData] = useState<StudentProgramMeasurement | null>(null);
  const [loading, setLoading] = useState(true);
  const [showEmpty, setShowEmpty] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await studentProgramAdmin.measurement();
      setData(r.measurement);
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  if (loading && !data) return <div className="py-16 text-center text-gray-400"><Loader2 className="mx-auto h-6 w-6 animate-spin" /><p className="mt-2 text-[12px]">Načítám studenty z Kabinetu a jejich používání aplikace…</p></div>;
  if (!data) return <div className="py-16 text-center text-gray-400">Data se nepodařilo načíst.</div>;

  const t = data.totals;
  const funnel = [
    { label: 'Mají přístup', value: t.withAccess, hint: `platný dnes ${t.accessActive}` },
    { label: 'Vyzkoušeli aplikaci', value: t.activated, hint: 'aspoň jednou v nové aplikaci' },
    { label: 'Aktivní 30 dní', value: t.active30, hint: 'něco dělali za poslední měsíc' },
    { label: 'Pravidelní', value: t.regular, hint: '5 a více dní s aktivitou' },
    { label: 'Se žáky', value: t.withPupils, hint: 'použili žákovský kód' },
  ];
  const funnelMax = Math.max(1, t.withAccess);
  const rows: StudentProgramMeasurementRow[] = data.universities.filter((u) => showEmpty || u.withAccess > 0 || u.pending > 0);
  const monthMax = Math.max(1, ...data.months.map((m) => Math.max(m.newAccess, m.activated)));
  const subjMax = Math.max(1, ...data.subjects.map((s) => s.students));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[12px] text-gray-400">
          Stav k {formatCzDate(data.generatedAt, true)} · studentů z Kabinetu {data.sources.kabinet}, z webu {data.sources.web} (spárováno {data.sources.matched}) · používání jen z nové aplikace
        </p>
        <button type="button" onClick={() => void load()} className={BTN_SECONDARY}><RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} /> Obnovit</button>
      </div>

      {!data.kabinetOk && (
        <div className="flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-[13px] text-amber-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>Kabinet teď neodpověděl, čísla o přístupu a používání chybí. {data.kabinetError}</span>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div className="rounded-2xl border border-gray-100 bg-white p-5">
          <p className="mb-4 text-[13px] font-bold text-[#001161]">Trychtýř: od přístupu k výuce se žáky</p>
          <div className="space-y-3">
            {funnel.map((f, i) => (
              <div key={f.label} className="grid grid-cols-[150px_1fr_70px] items-center gap-3">
                <div>
                  <p className="text-[12px] font-semibold text-[#001161]">{f.label}</p>
                  <p className="text-[10px] text-gray-400">{f.hint}</p>
                </div>
                <div className="h-7 overflow-hidden rounded-lg bg-gray-50">
                  <div className="flex h-full items-center rounded-lg px-2 text-[11px] font-bold text-white" style={{ width: `${Math.max(f.value ? 6 : 0, (f.value / funnelMax) * 100)}%`, background: ['#001161', '#4c1d95', '#7C3AED', '#a78bfa', '#f59e0b'][i] }}>
                    {f.value > 0 ? f.value : ''}
                  </div>
                </div>
                <p className="text-right text-[12px] tabular-nums text-gray-500">{i === 0 ? '100 %' : t.withAccess ? `${Math.round((f.value / t.withAccess) * 100)} %` : '—'}</p>
              </div>
            ))}
          </div>
          <p className="mt-4 text-[11px] text-gray-400">
            Na webu čeká na ověření e-mailu {t.pending} registrací · otevřené lekce {t.lessonsOpened.toLocaleString('cs-CZ')}, promítnuté {t.lessonsPresented.toLocaleString('cs-CZ')}, vytištěné listy {t.worksheetsPrinted.toLocaleString('cs-CZ')} ·
            {' '}{data.neverActivated.olderThan14Days} studentů má přístup déle než 14 dní a v aplikaci ještě nebyli.
          </p>
        </div>
        <div className="rounded-2xl border border-gray-100 bg-white p-5">
          <p className="mb-4 text-[13px] font-bold text-[#001161]">Nové přístupy a první použití za 12 měsíců</p>
          <div className="flex h-40 items-end gap-1.5">
            {data.months.map((m) => (
              <div key={m.month} className="flex flex-1 flex-col items-center justify-end gap-0.5" title={`${m.month}: ${m.newAccess} nových přístupů, ${m.activated} poprvé v aplikaci`}>
                <div className="flex h-full w-full items-end gap-[2px]">
                  <div className="flex-1 rounded-t bg-[#001161]/20" style={{ height: `${(m.newAccess / monthMax) * 100}%`, minHeight: m.newAccess ? 3 : 0 }} />
                  <div className="flex-1 rounded-t bg-[#7C3AED]" style={{ height: `${(m.activated / monthMax) * 100}%`, minHeight: m.activated ? 3 : 0 }} />
                </div>
                <span className="text-[9px] text-gray-400">{m.month.slice(5)}</span>
              </div>
            ))}
          </div>
          <p className="mt-2 text-[11px] text-gray-400">Světlá = nové přístupy, fialová = poprvé v nové aplikaci.</p>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-[13px] font-bold text-[#001161]">Úspěšnost univerzit</p>
          <label className="flex items-center gap-2 text-[12px] text-gray-500">
            <input type="checkbox" checked={showEmpty} onChange={(e) => setShowEmpty(e.target.checked)} className="accent-[#7C3AED]" /> i univerzity bez studentů
          </label>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-gray-400">
                <th className="py-2 pr-3">#</th>
                <th className="py-2 pr-3">Univerzita</th>
                <th className="py-2 pr-3 text-right">S přístupem</th>
                <th className="py-2 pr-3 text-right" title="Studenti s přístupem na 100 odhadovaných studentů učitelství na pedagogické fakultě">Pokrytí</th>
                <th className="py-2 pr-3">Vyzkoušeli</th>
                <th className="py-2 pr-3">Aktivní 30 dní</th>
                <th className="py-2 pr-3 text-right">Pravidelní</th>
                <th className="py-2 pr-3 text-right">Se žáky</th>
                <th className="py-2 pr-3 text-right">Lekce</th>
                <th className="py-2 pr-3 text-right">Čeká na ověření</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((u, i) => (
                <tr key={u.key} className="border-t border-gray-50">
                  <td className="py-2 pr-3 text-gray-400">{i + 1}</td>
                  <td className="py-2 pr-3"><span className="font-semibold text-[#001161]">{u.label}</span> <span className="text-gray-400">· {u.university}</span></td>
                  <td className="py-2 pr-3 text-right font-bold text-[#001161]">{u.withAccess}</td>
                  <td className="py-2 pr-3 text-right text-gray-600">{u.penetration == null ? '—' : `${u.penetration.toLocaleString('cs-CZ')} %`}</td>
                  <td className="py-2 pr-3 text-gray-600"><Rate value={u.activationRate} /> <span className="text-gray-400">({u.activated})</span></td>
                  <td className="py-2 pr-3 text-gray-600"><Rate value={u.active30Rate} /> <span className="text-gray-400">({u.active30})</span></td>
                  <td className="py-2 pr-3 text-right text-gray-600">{u.regular}</td>
                  <td className="py-2 pr-3 text-right text-gray-600">{u.withPupils}</td>
                  <td className="py-2 pr-3 text-right text-gray-600">{u.lessonsOpened}</td>
                  <td className="py-2 pr-3 text-right text-gray-400">{u.pending || ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-[11px] text-gray-400">Pořadí: aktivní za 30 dní, pak kolik jich aplikaci vyzkoušelo. Univerzita se bere z fakulty v registraci, u starších studentů z domény e-mailu. „Pokrytí“ počítá s odhadem studentů učitelství na pedagogické fakultě (Fakulty → odhad).</p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_1.6fr]">
        <div className="rounded-2xl border border-gray-100 bg-white p-5">
          <p className="mb-3 text-[13px] font-bold text-[#001161]">Předměty, které studenti otevírají</p>
          {data.subjects.length === 0 && <p className="text-[12px] text-gray-400">Zatím bez dat.</p>}
          <div className="space-y-2">
            {data.subjects.slice(0, 10).map((s) => (
              <div key={s.subject} className="grid grid-cols-[110px_1fr_40px] items-center gap-2 text-[12px]">
                <span className="text-gray-700">{subjectLabel(s.subject)}</span>
                <span className="h-2 overflow-hidden rounded-full bg-gray-100"><span className="block h-full rounded-full bg-[#7C3AED]" style={{ width: `${(s.students / subjMax) * 100}%` }} /></span>
                <span className="text-right tabular-nums text-gray-500">{s.students}</span>
              </div>
            ))}
          </div>
          <p className="mt-3 text-[11px] text-gray-400">Počet studentů, kteří v předmětu něco otevřeli.</p>
        </div>
        <div className="rounded-2xl border border-gray-100 bg-white p-5">
          <p className="mb-3 text-[13px] font-bold text-[#001161]">Nejaktivnější studenti</p>
          {data.topStudents.length === 0 && <p className="text-[12px] text-gray-400">Zatím nikdo.</p>}
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wide text-gray-400">
                  <th className="py-1.5 pr-3">Student</th>
                  <th className="py-1.5 pr-3 text-right">Dní (30 d)</th>
                  <th className="py-1.5 pr-3 text-right">Lekcí</th>
                  <th className="py-1.5 pr-3">Předměty</th>
                  <th className="py-1.5 pr-3 text-right">Naposledy</th>
                </tr>
              </thead>
              <tbody>
                {data.topStudents.map((s, i) => (
                  <tr key={`${s.name}-${i}`} className="border-t border-gray-50">
                    <td className="py-1.5 pr-3"><span className="font-semibold text-[#001161]">{s.name}</span> <span className="text-gray-400">· {s.university}</span>{s.pupilDays > 0 && <Pill className="ml-1.5 bg-amber-50 text-amber-700">se žáky</Pill>}</td>
                    <td className="py-1.5 pr-3 text-right tabular-nums">{s.activeDays} <span className="text-gray-400">({s.activeDays30})</span></td>
                    <td className="py-1.5 pr-3 text-right tabular-nums">{s.lessonsOpened}</td>
                    <td className="py-1.5 pr-3 text-gray-500">{s.subjects.map(subjectLabel).join(', ') || '—'}</td>
                    <td className="py-1.5 pr-3 text-right text-gray-500">{s.lastOn ? formatCzDate(s.lastOn) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   Studenti (CRM)
══════════════════════════════════════════════════════════════════════════ */
function StudentDrawer({ student, faculties, onClose, onChanged }: { student: StudentProgramStudentRow; faculties: StudentProgramFacultyRow[]; onClose: () => void; onChanged: (s: StudentProgramStudentRow | null) => void }) {
  const [form, setForm] = useState<Partial<StudentProgramStudentRow>>({});
  const [events, setEvents] = useState<StudentProgramEvent[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const merged = { ...student, ...form };
  const fac = faculties.find((f) => f.id === merged.faculty_id);

  useEffect(() => {
    setForm({});
    studentProgramAdmin.studentEvents(student.id).then((r) => setEvents(r.items)).catch(() => setEvents([]));
  }, [student.id]);

  const set = (k: keyof StudentProgramStudentRow, v: unknown) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    if (Object.keys(form).length === 0) return;
    setBusy('save');
    try {
      const r = await studentProgramAdmin.updateStudent(student.id, form);
      toast.success('Uloženo');
      onChanged(r.item);
      setForm({});
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(null);
    }
  };
  const act = async (key: string, fn: () => Promise<unknown>, okMsg: string) => {
    setBusy(key);
    try {
      const r = (await fn()) as { ok?: boolean; detail?: string | null };
      if (r && r.ok === false) toast.error(r.detail || 'Nepodařilo se');
      else toast.success(okMsg);
      const ev = await studentProgramAdmin.studentEvents(student.id);
      setEvents(ev.items);
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(null);
    }
  };
  const remove = async () => {
    if (!window.confirm(`Smazat studenta ${student.university_email}? Nevratné.`)) return;
    setBusy('delete');
    try {
      await studentProgramAdmin.deleteStudent(student.id);
      toast.success('Smazáno');
      onChanged(null);
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-[#001161]/20 backdrop-blur-[1px]" onClick={onClose}>
      <div className="h-full w-full max-w-[560px] overflow-y-auto bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-gray-100 bg-white px-6 py-4">
          <div>
            <p className="text-[18px] font-bold text-[#001161]">{student.first_name} {student.last_name}</p>
            <p className="text-[12px] text-gray-500">{student.university_email}{fac ? ` · ${fac.faculty_short}` : ''}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100"><X className="h-4 w-4" /></button>
        </div>
        <div className="space-y-5 px-6 py-5">
          <div className="flex flex-wrap gap-2">
            <Pill className={STATUS_COLORS[merged.status]}>{STUDENT_STATUS_LABELS[merged.status]}</Pill>
            {merged.teacher_code ? <Pill className="bg-emerald-50 text-emerald-700">kódy OK</Pill> : merged.status !== 'pending' ? <Pill className="bg-rose-50 text-rose-600">bez kódů</Pill> : null}
            {merged.engagement !== 'unknown' && <Pill className="bg-gray-100 text-gray-600">{merged.engagement}</Pill>}
            {merged.newsletter && <Pill className="bg-violet-50 text-violet-700">newsletter</Pill>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="text-[11px] font-semibold text-gray-500">Stav
              <select value={merged.status} onChange={(e) => set('status', e.target.value)} className={INPUT}>
                {Object.entries(STUDENT_STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </label>
            <label className="text-[11px] font-semibold text-gray-500">Fakulta
              <select value={merged.faculty_id || ''} onChange={(e) => set('faculty_id', e.target.value || null)} className={INPUT}>
                <option value="">—</option>
                {faculties.map((f) => <option key={f.id} value={f.id}>{f.faculty_short}</option>)}
              </select>
            </label>
            <label className="text-[11px] font-semibold text-gray-500">Přístup platí do
              <input type="date" value={merged.access_valid_until || ''} onChange={(e) => set('access_valid_until', e.target.value || null)} className={INPUT} />
            </label>
            <label className="text-[11px] font-semibold text-gray-500">Konec studia (info)
              <input type="date" value={merged.expected_graduation || ''} onChange={(e) => set('expected_graduation', e.target.value || null)} className={INPUT} />
            </label>
            <label className="text-[11px] font-semibold text-gray-500">Telefon
              <input value={merged.phone || ''} onChange={(e) => set('phone', e.target.value)} className={INPUT} />
            </label>
            <label className="text-[11px] font-semibold text-gray-500">Osobní e-mail
              <input value={merged.personal_email || ''} onChange={(e) => set('personal_email', e.target.value)} className={INPUT} />
            </label>
            <label className="text-[11px] font-semibold text-gray-500">Kód učitele
              <input value={merged.teacher_code || ''} onChange={(e) => set('teacher_code', e.target.value)} className={cn(INPUT, 'font-mono')} />
            </label>
            <label className="text-[11px] font-semibold text-gray-500">Kód žáka
              <input value={merged.student_code || ''} onChange={(e) => set('student_code', e.target.value)} className={cn(INPUT, 'font-mono')} />
            </label>
            <label className="col-span-2 text-[11px] font-semibold text-gray-500">Licence v Kabinetu platí do
              <input type="date" value={merged.codes_valid_until || ''} onChange={(e) => set('codes_valid_until', e.target.value || null)} className={INPUT} />
              <span className="mt-1 block text-[10px] font-normal text-gray-400">Nastavuje se automaticky ročním obnovením (create-subscription-licence). Ručně měňte jen, když jste licenci upravili přímo v Kabinetu.{merged.legacy_admin_link ? <> Organizace v legacy adminu: <a href={merged.legacy_admin_link} target="_blank" rel="noopener noreferrer" className="underline">otevřít</a>.</> : null}</span>
            </label>
            <label className="text-[11px] font-semibold text-gray-500">Po škole
              <select value={merged.employer_status} onChange={(e) => set('employer_status', e.target.value)} className={INPUT}>
                <option value="unknown">nevíme</option>
                <option value="teaching">učí</option>
                <option value="not_teaching">neučí</option>
                <option value="studying_further">studuje dál</option>
              </select>
            </label>
            <label className="text-[11px] font-semibold text-gray-500">Používá Vividbooks
              <select value={merged.uses_in_practice == null ? '' : merged.uses_in_practice ? 'yes' : 'no'} onChange={(e) => set('uses_in_practice', e.target.value === '' ? null : e.target.value === 'yes')} className={INPUT}>
                <option value="">nevíme</option>
                <option value="yes">ano</option>
                <option value="no">ne</option>
              </select>
            </label>
            <label className="col-span-2 text-[11px] font-semibold text-gray-500">Škola, kam nastoupil/a
              <div className="flex gap-2">
                <input value={merged.employer_school_name || ''} onChange={(e) => set('employer_school_name', e.target.value)} placeholder="Název" className={INPUT} />
                <input value={merged.employer_school_ico || ''} onChange={(e) => set('employer_school_ico', e.target.value)} placeholder="IČO" className={cn(INPUT, 'w-32')} />
              </div>
            </label>
            <label className="col-span-2 text-[11px] font-semibold text-gray-500">Poznámka
              <textarea value={merged.notes || ''} onChange={(e) => set('notes', e.target.value)} rows={3} className={INPUT} />
            </label>
          </div>

          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => void save()} disabled={busy !== null || Object.keys(form).length === 0} className={BTN_PRIMARY}>{busy === 'save' ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Uložit</button>
            {student.status === 'pending' && (
              <button type="button" onClick={() => void act('invite', () => studentProgramAdmin.invite(student.id), 'Pozvánka odeslána')} disabled={busy !== null} className={BTN_PRIMARY}><Send className="h-4 w-4" /> {student.verification_sent_at ? 'Poslat ověřovací e-mail znovu' : 'Pozvat (ověřovací e-mail)'}</button>
            )}
            {!student.teacher_code && student.status !== 'pending' && (
              <button type="button" onClick={() => void act('issue', async () => { const r = await studentProgramAdmin.issueCodes(student.id); if (r.ok) onChanged(r.item); return { ok: r.ok, detail: r.legacyReason || r.legacyResult }; }, 'Kódy a licence založeny v Kabinetu')} disabled={busy !== null} className={cn(BTN_PRIMARY, 'bg-amber-600 hover:bg-amber-700')}><KeyRound className="h-4 w-4" /> Založit kódy (Kabinet)</button>
            )}
            {student.teacher_code && student.status !== 'pending' && (
              <button type="button" onClick={() => { if (window.confirm('Založit v Kabinetu další roční licenci na kódu studenta a posunout platnost o rok?')) void act('renew', async () => { const r = await studentProgramAdmin.renew(student.id); if (r.ok && r.item) onChanged(r.item); return { ok: r.ok, detail: r.error || null }; }, 'Prodlouženo o rok'); }} disabled={busy !== null} className={cn(BTN_PRIMARY, 'bg-emerald-600 hover:bg-emerald-700')}><Clock className="h-4 w-4" /> Prodloužit o rok</button>
            )}
            <button type="button" onClick={() => void act('codes', () => studentProgramAdmin.resendCodes(student.id), 'Kódy odeslány')} disabled={busy !== null || student.status === 'pending' || !student.teacher_code} className={BTN_SECONDARY}><KeyRound className="h-3.5 w-3.5" /> Poslat kódy znovu</button>
            <button type="button" onClick={() => void act('renewal', () => studentProgramAdmin.sendRenewal(student.id), 'Výzva k obnovení odeslána')} disabled={busy !== null || student.status === 'pending' || !student.teacher_code} className={BTN_SECONDARY}><Mail className="h-3.5 w-3.5" /> Poslat výzvu k obnovení</button>
            <button type="button" onClick={() => void remove()} disabled={busy !== null} className={cn(BTN_SECONDARY, 'text-rose-600')}><Trash2 className="h-3.5 w-3.5" /> Smazat</button>
          </div>

          <div className="rounded-xl bg-gray-50 p-4 text-[12px] text-gray-600">
            <div className="grid grid-cols-2 gap-y-1">
              <span>Registrace</span><span className="text-[#001161]">{formatCzDate(student.created_at, true)}</span>
              <span>Ověřeno</span><span className="text-[#001161]">{formatCzDate(student.verified_at, true)}</span>
              <span>Přístup do</span><span className="text-[#001161]">{formatCzDate(student.access_extended_until && student.access_extended_until > (student.access_valid_until || '') ? student.access_extended_until : student.access_valid_until)}{student.codes_issued_at ? ` (kódy založeny ${formatCzDate(student.codes_issued_at)})` : ''}</span>
              <span>Obnoveno</span><span className="text-[#001161]">{student.renewal_count || 0}× {student.renewed_at ? `(naposledy ${formatCzDate(student.renewed_at)})` : ''}</span>
              <span>Výzva k obnovení</span><span className="text-[#001161]">{student.renewal_stage ? `${student.renewal_stage}. výzva, ${formatCzDate(student.renewal_sent_at, true)}` : '—'}</span>
              <span>Poslední odpověď</span><span className="text-[#001161]">{formatCzDate(student.last_response_at, true)}</span>
              <span>Kabinet</span><span className="text-[#001161]">{student.legacy_result || '—'}{student.legacy_reason ? ` · ${student.legacy_reason}` : ''}</span>
              <span>Obor</span><span className="text-[#001161]">{student.study_programme || '—'}</span>
              <span>Předměty</span><span className="text-[#001161]">{[...(student.school_stages || []), ...(student.subjects || [])].join(', ') || '—'}</span>
              <span>Zdroj</span><span className="text-[#001161]">{student.source || '—'}</span>
            </div>
            {student.last_self_report && Object.keys(student.last_self_report).length > 0 && (
              <p className="mt-2 border-t border-gray-200 pt-2 text-[11px]">Poslední self-report: {JSON.stringify(student.last_self_report)}</p>
            )}
          </div>

          <div>
            <p className="mb-2 text-[12px] font-bold text-[#001161]">Historie</p>
            <ul className="space-y-1.5 text-[12px]">
              {events.length === 0 && <li className="text-gray-400">Zatím nic.</li>}
              {events.map((ev) => (
                <li key={ev.id} className="flex gap-2">
                  <span className="w-[112px] shrink-0 text-gray-400">{formatCzDate(ev.created_at, true)}</span>
                  <span className="text-[#001161]"><strong>{ev.type}</strong>{ev.actor !== 'system' ? ` · ${ev.actor}` : ''}{ev.payload && Object.keys(ev.payload).length ? <span className="text-gray-500"> {JSON.stringify(ev.payload)}</span> : null}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

function StudentsTab({ faculties, initialQueue, onQueueConsumed }: { faculties: StudentProgramFacultyRow[]; initialQueue: string; onQueueConsumed: () => void }) {
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [facultyId, setFacultyId] = useState('');
  const [queue, setQueue] = useState(initialQueue);
  const [rows, setRows] = useState<StudentProgramStudentRow[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<StudentProgramStudentRow | null>(null);
  const limit = 100;

  useEffect(() => {
    if (initialQueue) {
      setQueue(initialQueue);
      onQueueConsumed();
    }
  }, [initialQueue, onQueueConsumed]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await studentProgramAdmin.students({ q, status, facultyId, queue, limit, offset });
      setRows(r.items);
      setTotal(r.total);
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setLoading(false);
    }
  }, [q, status, facultyId, queue, offset]);
  useEffect(() => {
    const t = setTimeout(() => void load(), 250);
    return () => clearTimeout(t);
  }, [load]);

  const facById = useMemo(() => new Map(faculties.map((f) => [f.id, f])), [faculties]);

  const exportCsv = async () => {
    try {
      const blob = await studentProgramAdmin.exportCsv();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `studenti-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast.error(errMsg(e));
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[240px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input value={q} onChange={(e) => { setQ(e.target.value); setOffset(0); }} placeholder="Hledat jméno, e-mail, školu…" className={cn(INPUT, 'pl-9')} />
        </div>
        <select value={status} onChange={(e) => { setStatus(e.target.value); setOffset(0); }} className={cn(INPUT, 'w-auto')}>
          <option value="">Všechny stavy</option>
          {Object.entries(STUDENT_STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select value={facultyId} onChange={(e) => { setFacultyId(e.target.value); setOffset(0); }} className={cn(INPUT, 'w-auto')}>
          <option value="">Všechny fakulty</option>
          {faculties.map((f) => <option key={f.id} value={f.id}>{f.faculty_short}</option>)}
        </select>
        <select value={queue} onChange={(e) => { setQueue(e.target.value); setOffset(0); }} className={cn(INPUT, 'w-auto')}>
          <option value="">Bez fronty</option>
          <option value="no_codes">Bez kódů</option>
          <option value="no_licence">Kódy bez roční licence</option>
          <option value="renewal_due">Čeká na roční obnovení</option>
          <option value="expired_recent">Skončilo bez obnovení (90 dní)</option>
          <option value="alumni_no_school">Absolventi bez školy</option>
          <option value="pending_old">Neověřeno &gt; 3 dny</option>
          <option value="imported">Importovaní z kontaktů (nepozvaní)</option>
        </select>
        <button type="button" onClick={() => void load()} className={BTN_SECONDARY}><RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} /></button>
        <button type="button" onClick={() => void exportCsv()} className={BTN_SECONDARY}><Download className="h-3.5 w-3.5" /> CSV</button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead className="bg-gray-50 text-left text-[11px] uppercase tracking-wide text-gray-400">
              <tr>
                <th className="px-3 py-2">Student</th>
                <th className="px-3 py-2">Fakulta</th>
                <th className="px-3 py-2">Stav</th>
                <th className="px-3 py-2">Přístup do</th>
                <th className="px-3 py-2">Kódy</th>
                <th className="px-3 py-2">Obnovení</th>
                <th className="px-3 py-2">Používá</th>
                <th className="px-3 py-2">Po škole</th>
                <th className="px-3 py-2">Kontakt</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr><td colSpan={9} className="px-3 py-10 text-center text-gray-400">{loading ? 'Načítám…' : 'Žádní studenti pro tento filtr.'}</td></tr>
              )}
              {rows.map((s) => {
                const fac = s.faculty_id ? facById.get(s.faculty_id) : null;
                return (
                  <tr key={s.id} onClick={() => setSelected(s)} className="cursor-pointer border-t border-gray-50 hover:bg-violet-50/40">
                    <td className="px-3 py-2">
                      <p className="font-semibold text-[#001161]">{s.first_name} {s.last_name}</p>
                      <p className="text-[11px] text-gray-500">{s.university_email}</p>
                    </td>
                    <td className="px-3 py-2 text-gray-700">{fac ? fac.faculty_short : <span className="text-gray-300">—</span>}</td>
                    <td className="px-3 py-2"><Pill className={STATUS_COLORS[s.status]}>{STUDENT_STATUS_LABELS[s.status]}</Pill></td>
                    <td className={cn('px-3 py-2', s.status === 'active' && s.access_valid_until && s.access_valid_until <= new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10) ? 'text-amber-700 font-semibold' : 'text-gray-700')}>{formatCzDate(s.access_valid_until)}</td>
                    <td className="px-3 py-2">{s.teacher_code ? <span className="font-mono text-[#001161]">{s.teacher_code}</span> : s.status === 'pending' ? <span className="text-gray-300">—</span> : <span className="text-rose-600">chybí</span>}{s.teacher_code && !s.codes_valid_until ? <span className="ml-1 text-amber-700">bez licence</span> : null}</td>
                    <td className="px-3 py-2 text-gray-600">{s.renewal_count || 0}× {s.renewal_stage ? <span className="text-amber-700">· výzva {s.renewal_stage}</span> : null}</td>
                    <td className="px-3 py-2">{s.uses_in_practice === true ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : s.uses_in_practice === false ? <X className="h-4 w-4 text-gray-300" /> : <span className="text-gray-300">?</span>}</td>
                    <td className="px-3 py-2 text-gray-700">{s.employer_school_name || (s.employer_status !== 'unknown' ? s.employer_status : <span className="text-gray-300">—</span>)}</td>
                    <td className="px-3 py-2 text-gray-500">{s.phone ? <Phone className="inline h-3.5 w-3.5 text-emerald-600" /> : null} {s.personal_email ? <Mail className="inline h-3.5 w-3.5 text-sky-600" /> : null}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between border-t border-gray-100 px-3 py-2 text-[12px] text-gray-500">
          <span>{total} záznamů</span>
          <div className="flex gap-2">
            <button type="button" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - limit))} className={BTN_SECONDARY}>Předchozí</button>
            <button type="button" disabled={offset + limit >= total} onClick={() => setOffset(offset + limit)} className={BTN_SECONDARY}>Další</button>
          </div>
        </div>
      </div>

      {selected && (
        <StudentDrawer
          student={selected}
          faculties={faculties}
          onClose={() => setSelected(null)}
          onChanged={(s) => {
            if (!s) {
              setSelected(null);
              setRows((r) => r.filter((x) => x.id !== selected.id));
              return;
            }
            setSelected(s);
            setRows((r) => r.map((x) => (x.id === s.id ? s : x)));
          }}
        />
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   Fakulty + oslovení
══════════════════════════════════════════════════════════════════════════ */
function OutreachModal({ faculty, contact, templates, onClose, onSent }: { faculty: StudentProgramFacultyRow; contact: StudentProgramFacultyContact | null; templates: OutreachTemplate[]; onClose: () => void; onSent: () => void }) {
  const [template, setTemplate] = useState<OutreachTemplate['key']>(contact?.department ? 'intro_department' : 'intro_dean');
  const [toEmail, setToEmail] = useState(contact?.email || '');
  const [toName, setToName] = useState(contact?.name || '');
  const [subject, setSubject] = useState('');
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);

  const draft = useCallback(async () => {
    setLoading(true);
    try {
      const r = await studentProgramAdmin.outreachDraft({ facultyId: faculty.id, template, contactName: toName || undefined, department: contact?.department || undefined });
      setSubject(r.subject);
      setText(r.text);
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setLoading(false);
    }
  }, [faculty.id, template, toName, contact?.department]);
  useEffect(() => {
    void draft();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [template]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`${subject}\n\n${text}`);
      toast.success('Zkopírováno');
    } catch {
      toast.error('Kopírování se nepovedlo');
    }
  };
  const send = async () => {
    if (!toEmail) {
      toast.error('Doplňte e-mail příjemce.');
      return;
    }
    if (!window.confirm(`Odeslat e-mail na ${toEmail} jménem Vítka?`)) return;
    setSending(true);
    try {
      const r = await studentProgramAdmin.outreachSend({ facultyId: faculty.id, contactId: contact?.id, toEmail, toName, subject, text });
      if (r.ok) {
        toast.success('Odesláno');
        onSent();
        onClose();
      } else toast.error(r.detail || 'Odeslání selhalo');
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#001161]/25 p-4 backdrop-blur-[1px]" onClick={onClose}>
      <div className="max-h-[92vh] w-full max-w-[720px] overflow-y-auto rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <div>
            <p className="text-[16px] font-bold text-[#001161]">Oslovení — {faculty.faculty_short}</p>
            <p className="text-[12px] text-gray-500">Odesílá se jménem Vítka z hello@vividbooks.com, odpovědi jdou na vitek@vividbooks.com.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100"><X className="h-4 w-4" /></button>
        </div>
        <div className="space-y-3 px-6 py-5">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <label className="text-[11px] font-semibold text-gray-500">Šablona
              <select value={template} onChange={(e) => setTemplate(e.target.value as OutreachTemplate['key'])} className={INPUT}>
                {templates.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
              </select>
            </label>
            <label className="text-[11px] font-semibold text-gray-500">Komu (jméno)
              <input value={toName} onChange={(e) => setToName(e.target.value)} className={INPUT} />
            </label>
            <label className="text-[11px] font-semibold text-gray-500">Komu (e-mail)
              <input value={toEmail} onChange={(e) => setToEmail(e.target.value)} className={INPUT} />
            </label>
          </div>
          <p className="text-[11px] text-gray-400">{templates.find((t) => t.key === template)?.hint}</p>
          <label className="block text-[11px] font-semibold text-gray-500">Předmět
            <input value={subject} onChange={(e) => setSubject(e.target.value)} className={INPUT} />
          </label>
          <label className="block text-[11px] font-semibold text-gray-500">Text
            <textarea value={text} onChange={(e) => setText(e.target.value)} rows={16} className={cn(INPUT, 'font-[inherit] leading-relaxed')} />
          </label>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex gap-2">
              <button type="button" onClick={() => void draft()} disabled={loading} className={BTN_SECONDARY}><RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} /> Znovu ze šablony</button>
              <button type="button" onClick={() => void copy()} className={BTN_SECONDARY}><Copy className="h-3.5 w-3.5" /> Kopírovat</button>
            </div>
            <button type="button" onClick={() => void send()} disabled={sending || !subject || !text} className={BTN_PRIMARY}>{sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Odeslat</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function FacultyCard({ faculty, templates, onReload }: { faculty: StudentProgramFacultyRow; templates: OutreachTemplate[]; onReload: () => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Partial<StudentProgramFacultyRow>>({});
  const [saving, setSaving] = useState(false);
  const [outreach, setOutreach] = useState<{ contact: StudentProgramFacultyContact | null } | null>(null);
  const [newContact, setNewContact] = useState({ name: '', role: '', department: '', email: '', phone: '' });
  const merged = { ...faculty, ...form };
  const set = (k: keyof StudentProgramFacultyRow, v: unknown) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    setSaving(true);
    try {
      await studentProgramAdmin.updateFaculty(faculty.id, form);
      toast.success('Uloženo');
      setForm({});
      onReload();
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setSaving(false);
    }
  };
  const addContact = async () => {
    if (!newContact.name.trim()) return;
    try {
      await studentProgramAdmin.addContact(faculty.id, newContact);
      setNewContact({ name: '', role: '', department: '', email: '', phone: '' });
      toast.success('Kontakt přidán');
      onReload();
    } catch (e) {
      toast.error(errMsg(e));
    }
  };
  const patchContact = async (id: string, patch: Partial<StudentProgramFacultyContact>) => {
    try {
      await studentProgramAdmin.updateContact(id, patch);
      onReload();
    } catch (e) {
      toast.error(errMsg(e));
    }
  };
  const removeContact = async (c: StudentProgramFacultyContact) => {
    if (!window.confirm(`Smazat kontakt ${c.name}?`)) return;
    try {
      await studentProgramAdmin.deleteContact(c.id);
      onReload();
    } catch (e) {
      toast.error(errMsg(e));
    }
  };

  return (
    <div className="rounded-2xl border border-gray-100 bg-white">
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-3 px-4 py-3 text-left">
        <ChevronRight className={cn('h-4 w-4 shrink-0 text-gray-400 transition-transform', open && 'rotate-90')} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] font-bold text-[#001161]">{faculty.faculty_short} <span className="font-normal text-gray-400">· {faculty.faculty}, {faculty.university}</span></p>
          <p className="text-[11px] text-gray-500">{faculty.city} · {faculty.email_domains.join(', ')} · odhad {faculty.estimated_students ?? '?'} studentů učitelství</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {faculty.kind === 'pedf' && <Pill className="bg-violet-50 text-violet-700">PedF</Pill>}
          <Pill className={OUTREACH_COLORS[faculty.outreach_status]}>{FACULTY_OUTREACH_LABELS[faculty.outreach_status]}</Pill>
          <span className={cn('rounded-full px-2.5 py-0.5 text-[12px] font-bold', faculty.stats.active > 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-400')}>{faculty.stats.active} aktivních</span>
          {faculty.next_followup_at && faculty.next_followup_at <= new Date().toISOString() && faculty.outreach_status === 'contacted' && <Pill className="bg-amber-50 text-amber-700"><Clock className="mr-1 h-3 w-3" /> follow-up</Pill>}
        </div>
      </button>
      {open && (
        <div className="space-y-5 border-t border-gray-100 px-5 py-4">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <label className="text-[11px] font-semibold text-gray-500">Oslovení
              <select value={merged.outreach_status} onChange={(e) => set('outreach_status', e.target.value)} className={INPUT}>
                {Object.entries(FACULTY_OUTREACH_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </label>
            <label className="text-[11px] font-semibold text-gray-500">Garant u nás
              <input value={merged.outreach_owner || ''} onChange={(e) => set('outreach_owner', e.target.value)} placeholder="Vítek" className={INPUT} />
            </label>
            <label className="text-[11px] font-semibold text-gray-500">Další follow-up
              <input type="date" value={(merged.next_followup_at || '').slice(0, 10)} onChange={(e) => set('next_followup_at', e.target.value ? `${e.target.value}T09:00:00Z` : null)} className={INPUT} />
            </label>
            <label className="text-[11px] font-semibold text-gray-500">Odhad studentů
              <input type="number" value={merged.estimated_students ?? ''} onChange={(e) => set('estimated_students', e.target.value === '' ? null : Number(e.target.value))} className={INPUT} />
            </label>
            <label className="text-[11px] font-semibold text-gray-500">Vzorky odeslány
              <input type="date" value={(merged.samples_sent_at || '').slice(0, 10)} onChange={(e) => set('samples_sent_at', e.target.value ? `${e.target.value}T09:00:00Z` : null)} className={INPUT} />
            </label>
            <label className="text-[11px] font-semibold text-gray-500">Workshop
              <input type="date" value={(merged.workshop_at || '').slice(0, 10)} onChange={(e) => set('workshop_at', e.target.value ? `${e.target.value}T09:00:00Z` : null)} className={INPUT} />
            </label>
            <label className="col-span-2 text-[11px] font-semibold text-gray-500">Poznámky
              <input value={merged.notes || ''} onChange={(e) => set('notes', e.target.value)} className={INPUT} />
            </label>
          </div>

          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => void save()} disabled={saving || Object.keys(form).length === 0} className={BTN_PRIMARY}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Uložit fakultu</button>
            <button type="button" onClick={() => setOutreach({ contact: null })} className={BTN_SECONDARY}><Mail className="h-3.5 w-3.5" /> Napsat fakultě</button>
            {faculty.website && <a href={faculty.website} target="_blank" rel="noopener noreferrer" className={BTN_SECONDARY}><ExternalLink className="h-3.5 w-3.5" /> Web fakulty</a>}
          </div>

          <div>
            <p className="mb-2 text-[12px] font-bold text-[#001161]">Kontakty na fakultě</p>
            <div className="space-y-2">
              {faculty.contacts.length === 0 && <p className="text-[12px] text-gray-400">Zatím žádný kontakt. Doplňte proděkana/ku pro studium, vedoucí kateder didaktiky, studijní oddělení.</p>}
              {faculty.contacts.map((c) => (
                <div key={c.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-gray-100 px-3 py-2 text-[12px]">
                  <div className="min-w-[200px] flex-1">
                    <p className="font-semibold text-[#001161]">{c.name} <span className="font-normal text-gray-400">{[c.role, c.department].filter(Boolean).join(' · ')}</span></p>
                    <p className="text-gray-500">{c.email || '—'}{c.phone ? ` · ${c.phone}` : ''}{c.last_contacted_at ? ` · osloven ${formatCzDate(c.last_contacted_at)}` : ''}</p>
                  </div>
                  <select value={c.status} onChange={(e) => void patchContact(c.id, { status: e.target.value as StudentProgramFacultyContact['status'] })} className={cn(INPUT, 'w-auto py-1')}>
                    {Object.entries(CONTACT_STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                  <button type="button" onClick={() => setOutreach({ contact: c })} className={BTN_SECONDARY} title="Napsat"><Send className="h-3.5 w-3.5" /></button>
                  <button type="button" onClick={() => void removeContact(c)} className={cn(BTN_SECONDARY, 'text-rose-600')} title="Smazat"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              ))}
              <div className="grid grid-cols-2 gap-2 rounded-xl border border-dashed border-gray-200 p-3 md:grid-cols-6">
                <input value={newContact.name} onChange={(e) => setNewContact({ ...newContact, name: e.target.value })} placeholder="Jméno *" className={INPUT} />
                <input value={newContact.role} onChange={(e) => setNewContact({ ...newContact, role: e.target.value })} placeholder="Role (proděkan…)" className={INPUT} />
                <input value={newContact.department} onChange={(e) => setNewContact({ ...newContact, department: e.target.value })} placeholder="Katedra" className={INPUT} />
                <input value={newContact.email} onChange={(e) => setNewContact({ ...newContact, email: e.target.value })} placeholder="E-mail" className={INPUT} />
                <input value={newContact.phone} onChange={(e) => setNewContact({ ...newContact, phone: e.target.value })} placeholder="Telefon" className={INPUT} />
                <button type="button" onClick={() => void addContact()} disabled={!newContact.name.trim()} className={BTN_PRIMARY}><Plus className="h-4 w-4" /> Přidat</button>
              </div>
            </div>
          </div>
        </div>
      )}
      {outreach && <OutreachModal faculty={faculty} contact={outreach.contact} templates={templates} onClose={() => setOutreach(null)} onSent={onReload} />}
    </div>
  );
}

function FacultiesTab() {
  const [items, setItems] = useState<StudentProgramFacultyRow[]>([]);
  const [templates, setTemplates] = useState<OutreachTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pedf' | 'other' | 'todo'>('all');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await studentProgramAdmin.faculties();
      setItems(r.items);
      setTemplates(r.templates);
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const visible = items.filter((f) => {
    if (filter === 'pedf') return f.kind === 'pedf';
    if (filter === 'other') return f.kind === 'other';
    if (filter === 'todo') return f.outreach_status === 'not_contacted' || (f.next_followup_at && f.next_followup_at <= new Date().toISOString() && f.outreach_status === 'contacted');
    return true;
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {([['all', 'Všechny'], ['pedf', 'Pedagogické (9)'], ['other', 'Ostatní s učitelstvím'], ['todo', 'K oslovení / follow-up']] as const).map(([k, l]) => (
          <button key={k} type="button" onClick={() => setFilter(k)} className={cn('rounded-full px-3 py-1.5 text-[12px] font-semibold', filter === k ? 'bg-[#001161] text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50')}>{l}</button>
        ))}
        <div className="flex-1" />
        <button type="button" onClick={() => void load()} className={BTN_SECONDARY}><RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} /> Obnovit</button>
        <button type="button" onClick={() => studentProgramAdmin.seedFaculties().then((r) => { toast.success(`Doplněno ${r.inserted} fakult`); void load(); }).catch((e) => toast.error(errMsg(e)))} className={BTN_SECONDARY}><Plus className="h-3.5 w-3.5" /> Doplnit ze seznamu</button>
      </div>
      <div className="space-y-2">
        {visible.map((f) => <FacultyCard key={f.id} faculty={f} templates={templates} onReload={() => void load()} />)}
        {!loading && visible.length === 0 && <p className="py-10 text-center text-[13px] text-gray-400">Nic k zobrazení.</p>}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   Cíle a nastavení
══════════════════════════════════════════════════════════════════════════ */
function GoalsTab() {
  const [goals, setGoals] = useState<StudentProgramGoals | null>(null);
  const [settings, setSettings] = useState<StudentProgramSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [cronBusy, setCronBusy] = useState(false);

  useEffect(() => {
    studentProgramAdmin.goals().then((r) => { setGoals(r.goals); setSettings(r.settings); }).catch((e) => toast.error(errMsg(e)));
  }, []);

  if (!goals || !settings) return <div className="py-16 text-center text-gray-400"><Loader2 className="mx-auto h-6 w-6 animate-spin" /></div>;

  const save = async () => {
    setSaving(true);
    try {
      const r = await studentProgramAdmin.saveGoals({ goals, settings });
      setGoals(r.goals);
      setSettings(r.settings);
      toast.success('Uloženo');
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setSaving(false);
    }
  };
  const runCron = async (dryRun: boolean) => {
    if (!dryRun && !window.confirm('Spustit denní běh naostro? Odešle výzvy k obnovení a ukončí přístupy po ochranné lhůtě.')) return;
    setCronBusy(true);
    try {
      const r = await studentProgramAdmin.runCron(dryRun);
      toast.success(`${dryRun ? 'Nasucho' : 'Hotovo'}: ${r.reminders} výzev k obnovení, ${r.expired} vypršelo${r.errors.length ? `, chyby: ${r.errors.length}` : ''}`);
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setCronBusy(false);
    }
  };

  const num = (k: keyof StudentProgramGoals) => (e: React.ChangeEvent<HTMLInputElement>) => setGoals({ ...goals, [k]: Number(e.target.value) });

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <div className="rounded-2xl border border-gray-100 bg-white p-5">
        <p className="mb-1 text-[14px] font-bold text-[#001161]">Měřitelné cíle</p>
        <p className="mb-4 text-[12px] text-gray-500">Zobrazují se v Přehledu jako progress. Nastavte je na začátku akademického roku a neměňte je v jeho průběhu.</p>
        <div className="grid grid-cols-2 gap-3">
          <label className="text-[11px] font-semibold text-gray-500">Aktivních studentů<input type="number" value={goals.targetStudents} onChange={num('targetStudents')} className={INPUT} /></label>
          <label className="text-[11px] font-semibold text-gray-500">K datu<input type="date" value={goals.targetDate} onChange={(e) => setGoals({ ...goals, targetDate: e.target.value })} className={INPUT} /></label>
          <label className="text-[11px] font-semibold text-gray-500">Pokrytých PedF (z 9)<input type="number" min={0} max={9} value={goals.targetPedfCoverage} onChange={num('targetPedfCoverage')} className={INPUT} /></label>
          <label className="text-[11px] font-semibold text-gray-500">Partnerských fakult<input type="number" value={goals.targetFacultyPartners} onChange={num('targetFacultyPartners')} className={INPUT} /></label>
          <label className="text-[11px] font-semibold text-gray-500">Používá Vividbooks (%)<input type="number" min={0} max={100} value={goals.targetActiveShare} onChange={num('targetActiveShare')} className={INPUT} /></label>
          <label className="text-[11px] font-semibold text-gray-500">Absolventi se známou školou (%)<input type="number" min={0} max={100} value={goals.targetAlumniSchoolKnown} onChange={num('targetAlumniSchoolKnown')} className={INPUT} /></label>
          <label className="col-span-2 text-[11px] font-semibold text-gray-500">Poznámka<textarea value={goals.note || ''} onChange={(e) => setGoals({ ...goals, note: e.target.value })} rows={2} className={INPUT} /></label>
        </div>
      </div>
      <div className="rounded-2xl border border-gray-100 bg-white p-5">
        <p className="mb-1 text-[14px] font-bold text-[#001161]">Nastavení programu</p>
        <p className="mb-4 text-[12px] text-gray-500">Každý student má v Kabinetu vlastní organizaci („Student Jméno Příjmení (Fakulta)“) a roční licenci. Tady se nastavuje délka licence, výzvy k obnovení a kam chodí denní přehled.</p>
        <div className="grid grid-cols-2 gap-3">
          <label className="text-[11px] font-semibold text-gray-500">Zakládat kódy automaticky
            <select value={settings.autoIssueCodes ? '1' : '0'} onChange={(e) => setSettings({ ...settings, autoIssueCodes: e.target.value === '1' })} className={INPUT}>
              <option value="1">Ano — při ověření přes Kabinet</option>
              <option value="0">Ne, kódy vkládám ručně</option>
            </select>
          </label>
          <label className="text-[11px] font-semibold text-gray-500">Typ licence
            <select value={settings.individualLicence ? '1' : '0'} onChange={(e) => setSettings({ ...settings, individualLicence: e.target.value === '1' })} className={INPUT}>
              <option value="1">Individuální (jedno zařízení najednou)</option>
              <option value="0">Školní (bez limitu zařízení)</option>
            </select>
          </label>
          <label className="text-[11px] font-semibold text-gray-500">Délka licence (měsíce)<input type="number" min={1} max={60} value={settings.licenceMonths} onChange={(e) => setSettings({ ...settings, licenceMonths: Number(e.target.value) })} className={INPUT} /></label>
          <label className="text-[11px] font-semibold text-gray-500">První výzva před koncem (dny)<input type="number" min={3} max={120} value={settings.renewalReminderDays} onChange={(e) => setSettings({ ...settings, renewalReminderDays: Number(e.target.value) })} className={INPUT} /></label>
          <label className="text-[11px] font-semibold text-gray-500">Ochranná lhůta po konci (dny)<input type="number" min={0} max={180} value={settings.renewalGraceDays} onChange={(e) => setSettings({ ...settings, renewalGraceDays: Number(e.target.value) })} className={INPUT} /></label>
          <label className="col-span-2 text-[11px] font-semibold text-gray-500">Denní přehled a upozornění na e-mail<input value={settings.digestEmail} onChange={(e) => setSettings({ ...settings, digestEmail: e.target.value })} placeholder="prázdné = neposílat" className={INPUT} /></label>
          <label className="text-[11px] font-semibold text-gray-500">Odesílatel oslovení fakult<input value={settings.outreachFromName} onChange={(e) => setSettings({ ...settings, outreachFromName: e.target.value })} className={INPUT} /></label>
          <label className="text-[11px] font-semibold text-gray-500">Reply-To oslovení<input value={settings.outreachReplyTo} onChange={(e) => setSettings({ ...settings, outreachReplyTo: e.target.value })} className={INPUT} /></label>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 lg:col-span-2">
        <button type="button" onClick={() => void save()} disabled={saving} className={BTN_PRIMARY}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Uložit cíle a nastavení</button>
        <div className="flex-1" />
        <button type="button" onClick={() => void runCron(true)} disabled={cronBusy} className={BTN_SECONDARY}><Play className="h-3.5 w-3.5" /> Denní běh nasucho</button>
        <button type="button" onClick={() => void runCron(false)} disabled={cronBusy} className={cn(BTN_SECONDARY, 'text-amber-700')}><Play className="h-3.5 w-3.5" /> Denní běh naostro</button>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   Metodika
══════════════════════════════════════════════════════════════════════════ */
function MethodologyTab() {
  const Block = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div className="rounded-2xl border border-gray-100 bg-white p-5">
      <p className="mb-2 text-[14px] font-bold text-[#001161]">{title}</p>
      <div className="space-y-2 text-[13px] leading-relaxed text-gray-700">{children}</div>
    </div>
  );
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Block title="Cíl programu">
        <p>Dostat Vividbooks ke studentům učitelství tak, aby do škol přicházeli jako uživatelé, kteří materiály znají, umí si v aplikaci tvořit vlastní přípravy a přirozeně je přinesou do svých budoucích sboroven.</p>
        <p>Měříme: počet aktivních studentů, pokrytí fakult (aspoň jeden aktivní student), partnerské fakulty (oficiálně rozeslaly odkaz nebo proběhl workshop), podíl studentů, kteří Vividbooks používají, a podíl absolventů, u kterých víme, kam nastoupili.</p>
      </Block>
      <Block title="Cesta studenta">
        <ol className="list-decimal space-y-1 pl-5">
          <li><strong>Registrace</strong> na /studenti — jméno, <strong>univerzitní e-mail</strong> (fakulta auto podle domény) a <strong>osobní e-mail</strong> (záloha), volitelně telefon, obor, stupeň a předměty.</li>
          <li><strong>Ověření</strong> odkazem na univerzitní e-mail (7 dní). Po kliknutí Kabinet založí studentovu organizaci a <strong>roční licenci</strong>; kódy přijdou na oba e-maily, kontakt jde do subscribers s tagem <code>student-program</code>.</li>
          <li><strong>Roční obnovení</strong> — 30 dní před koncem přijde na univerzitní e-mail odkaz „Ještě studuji“ (na osobní jen upozornění). Kliknutí = důkaz, že adresu pořád má → Kabinet přidá další rok, kódy zůstávají. Připomínky 7 dní před, v den konce a 14 dní po.</li>
          <li><strong>Bez obnovení</strong> — 30 dní po konci přístup přejde do <em>expired</em> a e-mail nabídne novou registraci nebo školní trial. Nová registrace vypršelého studenta = rovnou obnovení.</li>
          <li><strong>Absolvent</strong> — v aktualizaci nahlásí „dostudoval/a“ a školu (rejstřík). Přístup doběhne do konce zaplaceného roku, dál se neobnovuje. Známá škola = lead pro obchod (upozornění hned).</li>
        </ol>
      </Block>
      <Block title="Co se děje, když student používá / nepoužívá">
        <p><strong>Používá</strong> (odpověděl ano): pozvánky na workshopy a webináře pro budoucí učitele, výzva sdílet přístup se spolužáky přes odkaz fakulty, po státnicích prioritní kontakt obchodu se školou.</p>
        <p><strong>Nepoužívá / neobnoví</strong>: kdo na roční výzvu nezareaguje, přístup po ochranné lhůtě ztratí — to je zároveň nejčistší metrika zájmu. Podíl obnovených ku vypršelým sledujeme po fakultách; nízké obnovení = signál pro fakultu (nestačí odkaz, je potřeba workshop) a pro nás (co v aplikaci chybí).</p>
      </Block>
      <Block title="Kódy a legacy admin">
        <p>Přístup do aplikace řídí kódy školy; <strong>každý student má vlastní organizaci v Kabinetu</strong>. Při ověření se zavolá hook <code>create-school</code> (bez trialu, e-mail = univerzitní) a hned <code>create-subscription-licence</code> na 12 měsíců (bundle všech předmětů, individuální licence = jedno zařízení najednou). Žádný trial, žádná zpráva do Pipedrive.</p>
        <p>Roční obnovení = další <code>create-subscription-licence</code> od konce současné licence. Když Kabinet neodpoví, student zůstává aktivní a jde do fronty <em>Bez kódů</em> / <em>Kódy bez roční licence</em>; v detailu jsou tlačítka „Založit kódy (Kabinet)“ a „Prodloužit o rok“. Tajemství <code>KABINET_SECRET</code> sdílí s funkcí kabinet-trial.</p>
      </Block>
      <Block title="Fakulty: oslovení a pokrytí">
        <p>Seznam = 9 pedagogických fakult (jádro) + fakulty s učitelskými programy. U každé sledujeme stav oslovení (neosloveno → osloveno → v jednání → partner/odmítli), kontakty (proděkan pro studium, vedoucí kateder didaktiky, studijní oddělení) a follow-up.</p>
        <p>Šablony e-mailů jménem Vítka: úvod pro vedení (prosba o rozeslání studentům), úvod pro katedru (vzorky sešitů zdarma + workshop), připomenutí, text pro studenty. Odesílá se jen po kliknutí v adminu; odpovědi chodí na vitek@vividbooks.com.</p>
        <p>Partner = fakulta odkaz oficiálně rozeslala nebo proběhl workshop. Pokrytí = fakulta má aspoň jednoho aktivního studenta; cílový stav je 9/9 PedF.</p>
      </Block>
      <Block title="Provoz a rytmus">
        <ul className="list-disc space-y-1 pl-5">
          <li><strong>Denně</strong> (cron 7:10 UTC): výzvy k obnovení, vypršení po ochranné lhůtě, digest na e-mail (nové registrace, obnovení, bez kódů).</li>
          <li><strong>Týdně</strong>: projít frontu „K oslovení / follow-up“ ve Fakultách a „Absolventi bez školy“.</li>
          <li><strong>Září a únor</strong> (začátek semestrů): kampaň na fakulty — rozeslání textu pro studenty, workshopy, vzorky pro katedry.</li>
          <li><strong>Červen</strong>: většina studií končí — projít absolventy bez školy, připravit obchodní follow-up.</li>
        </ul>
      </Block>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   Stránka
══════════════════════════════════════════════════════════════════════════ */
export default function StudentProgramAdminPage() {
  const [params, setParams] = useSearchParams();
  const tab = (params.get('tab') as Tab) || 'prehled';
  const [faculties, setFaculties] = useState<StudentProgramFacultyRow[]>([]);
  const [queue, setQueue] = useState('');

  useEffect(() => {
    studentProgramAdmin.faculties().then((r) => setFaculties(r.items)).catch(() => {});
  }, []);

  const setTab = (t: Tab) => {
    const next = new URLSearchParams(params);
    next.set('tab', t);
    setParams(next, { replace: true });
  };

  return (
    <div className="h-full overflow-y-auto p-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#d97706] to-[#f59e0b]">
              <GraduationCap className="h-5 w-5 text-white" />
            </div>
            <h1 className="font-['Fenomen_Sans'] text-3xl font-bold text-[#001161]">Studenti učitelství</h1>
          </div>
          <p className="max-w-2xl text-[14px] text-gray-600">Studentský program: registrace dvěma e-maily na /studenti, roční licence v Kabinetu, obnovení kliknutím každý rok, absolventi jako leady a oslovení pedagogických fakult.</p>
        </div>
        <a href="/studenti" target="_blank" rel="noopener noreferrer" className={BTN_SECONDARY}><ExternalLink className="h-3.5 w-3.5" /> Otevřít /studenti</a>
      </div>

      <div className="mb-6 flex flex-wrap gap-1 rounded-2xl bg-gray-100 p-1">
        {TABS.map((t) => (
          <button key={t.id} type="button" onClick={() => setTab(t.id)} className={cn('inline-flex items-center gap-2 rounded-xl px-4 py-2 text-[13px] font-semibold transition-colors', tab === t.id ? 'bg-white text-[#001161] shadow-sm' : 'text-gray-500 hover:text-[#001161]')}>
            <t.icon className="h-4 w-4" /> {t.label}
          </button>
        ))}
      </div>

      {tab === 'prehled' && <OverviewTab onQueue={(q) => { setQueue(q); setTab('studenti'); }} />}
      {tab === 'mereni' && <MeasurementTab />}
      {tab === 'studenti' && <StudentsTab faculties={faculties} initialQueue={queue} onQueueConsumed={() => setQueue('')} />}
      {tab === 'fakulty' && <FacultiesTab />}
      {tab === 'cile' && <GoalsTab />}
      {tab === 'metodika' && <MethodologyTab />}
    </div>
  );
}
