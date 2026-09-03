import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { toast } from 'sonner@2.0.3';
import {
  GraduationCap, Users, School, Target, BookOpen, RefreshCw, Search, Download, Mail, Send, Copy, Plus, Trash2, X,
  CheckCircle2, AlertTriangle, Clock, ExternalLink, Loader2, Phone, KeyRound, ChevronRight, Sparkles, Play,
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
  type StudentProgramOverview,
  type StudentProgramSettings,
  type StudentProgramStudentRow,
} from '../../utils/studentProgramApi';

type Tab = 'prehled' | 'studenti' | 'fakulty' | 'cile' | 'metodika';

const TABS: Array<{ id: Tab; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { id: 'prehled', label: 'Přehled', icon: Target },
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
    { key: 'extension_due', label: 'Prodloužit trial v legacy adminu', count: data.queues.extensionDue, tone: 'warn' as const },
    { key: 'checkin_due', label: 'Check-in po termínu', count: data.queues.checkinsDue, tone: 'warn' as const },
    { key: 'graduating_soon', label: 'Končí do 90 dnů', count: data.queues.graduatingSoon, tone: 'info' as const },
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
            {data.queues.studentsNeedingExtension.length > 0 && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                <p className="mb-1 flex items-center gap-1.5 text-[12px] font-bold text-amber-800"><KeyRound className="h-3.5 w-3.5" /> Prodloužit trial v legacy adminu ({data.queues.extensionDue})</p>
                <ul className="space-y-0.5 text-[12px] text-amber-900">
                  {data.queues.studentsNeedingExtension.slice(0, 8).map((st) => (
                    <li key={st.id}>{st.name} ({st.facultyShort || '?'}) — kódy do {st.codesValidUntil ? formatCzDate(st.codesValidUntil) : 'neuvedeno'}, nárok do {st.accessValidUntil ? formatCzDate(st.accessValidUntil) : '?'}</li>
                  ))}
                </ul>
                <p className="mt-1 text-[11px] text-amber-800/80">Po prodloužení zapište nové datum do „Kódy platí do“ v detailu studenta.</p>
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
            <label className="text-[11px] font-semibold text-gray-500">Konec studia
              <input type="date" value={merged.expected_graduation || ''} onChange={(e) => set('expected_graduation', e.target.value)} className={INPUT} />
            </label>
            <label className="text-[11px] font-semibold text-gray-500">Prodlouženo do
              <input type="date" value={merged.access_extended_until || ''} onChange={(e) => set('access_extended_until', e.target.value || null)} className={INPUT} />
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
            <label className="col-span-2 text-[11px] font-semibold text-gray-500">Kódy platí do (legacy admin)
              <input type="date" value={merged.codes_valid_until || ''} onChange={(e) => set('codes_valid_until', e.target.value || null)} className={INPUT} />
              <span className="mt-1 block text-[10px] font-normal text-gray-400">Po založení je to 14 dní. Když trial v legacy adminu prodloužíte, zapište sem nové datum — nárok studenta je do {formatCzDate(merged.access_extended_until && merged.access_extended_until > (merged.access_valid_until || '') ? merged.access_extended_until : merged.access_valid_until)}.</span>
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
              <button type="button" onClick={() => void act('issue', async () => { const r = await studentProgramAdmin.issueCodes(student.id); if (r.ok) onChanged(r.item); return { ok: r.ok, detail: r.legacyReason || r.legacyResult }; }, 'Kódy založeny')} disabled={busy !== null} className={cn(BTN_PRIMARY, 'bg-amber-600 hover:bg-amber-700')}><KeyRound className="h-4 w-4" /> Založit kódy (legacy API)</button>
            )}
            <button type="button" onClick={() => void act('codes', () => studentProgramAdmin.resendCodes(student.id), 'Kódy odeslány')} disabled={busy !== null || student.status === 'pending' || !student.teacher_code} className={BTN_SECONDARY}><KeyRound className="h-3.5 w-3.5" /> Poslat kódy znovu</button>
            <button type="button" onClick={() => void act('checkin', () => studentProgramAdmin.sendCheckin(student.id), 'Check-in odeslán')} disabled={busy !== null || student.status === 'pending'} className={BTN_SECONDARY}><Mail className="h-3.5 w-3.5" /> Poslat check-in</button>
            <button type="button" onClick={() => void remove()} disabled={busy !== null} className={cn(BTN_SECONDARY, 'text-rose-600')}><Trash2 className="h-3.5 w-3.5" /> Smazat</button>
          </div>

          <div className="rounded-xl bg-gray-50 p-4 text-[12px] text-gray-600">
            <div className="grid grid-cols-2 gap-y-1">
              <span>Registrace</span><span className="text-[#001161]">{formatCzDate(student.created_at, true)}</span>
              <span>Ověřeno</span><span className="text-[#001161]">{formatCzDate(student.verified_at, true)}</span>
              <span>Nárok do</span><span className="text-[#001161]">{formatCzDate(student.access_extended_until && student.access_extended_until > (student.access_valid_until || '') ? student.access_extended_until : student.access_valid_until)}</span>
              <span>Kódy platí do</span><span className={cn('text-[#001161]', student.teacher_code && (!student.codes_valid_until || student.codes_valid_until < (student.access_valid_until || '')) && 'text-amber-700 font-semibold')}>{formatCzDate(student.codes_valid_until)}{student.codes_issued_at ? ` (založeno ${formatCzDate(student.codes_issued_at)})` : ''}</span>
              <span>Další check-in</span><span className="text-[#001161]">{formatCzDate(student.next_checkin_at)} (odesláno {student.checkin_count}×)</span>
              <span>Poslední odpověď</span><span className="text-[#001161]">{formatCzDate(student.last_response_at, true)}</span>
              <span>Legacy</span><span className="text-[#001161]">{student.legacy_result || '—'}{student.legacy_reason ? ` · ${student.legacy_reason}` : ''}</span>
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
          <option value="extension_due">Prodloužit trial v legacy adminu</option>
          <option value="checkin_due">Check-in po termínu</option>
          <option value="graduating_soon">Končí do 90 dnů</option>
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
                <th className="px-3 py-2">Konec studia</th>
                <th className="px-3 py-2">Kódy</th>
                <th className="px-3 py-2">Check-in</th>
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
                    <td className="px-3 py-2 text-gray-700">{formatCzDate(s.expected_graduation)}</td>
                    <td className="px-3 py-2">{s.teacher_code ? <span className="font-mono text-[#001161]">{s.teacher_code}</span> : s.status === 'pending' ? <span className="text-gray-300">—</span> : <span className="text-rose-600">chybí</span>}</td>
                    <td className="px-3 py-2 text-gray-600">{s.checkin_count}× · {s.last_response_at ? <span className="text-emerald-700">odpověď {formatCzDate(s.last_response_at)}</span> : <span className="text-gray-400">bez odpovědi</span>}</td>
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
    if (!dryRun && !window.confirm('Spustit denní běh naostro? Odešle check-iny a přechody stavů, které jsou po termínu.')) return;
    setCronBusy(true);
    try {
      const r = await studentProgramAdmin.runCron(dryRun);
      toast.success(`${dryRun ? 'Nasucho' : 'Hotovo'}: ${r.checkins} check-inů, ${r.graduating} končí studium, ${r.expired} vypršelo${r.errors.length ? `, chyby: ${r.errors.length}` : ''}`);
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
        <p className="mb-4 text-[12px] text-gray-500">Každý student má vlastní kódy z legacy free-trial API (organizace „Jméno – student Fakulta“). Tady se nastavuje, jak se volá, jak často píšeme studentům a kam chodí denní přehled.</p>
        <div className="grid grid-cols-2 gap-3">
          <label className="text-[11px] font-semibold text-gray-500">Zakládat kódy automaticky
            <select value={settings.autoIssueCodes ? '1' : '0'} onChange={(e) => setSettings({ ...settings, autoIssueCodes: e.target.value === '1' })} className={INPUT}>
              <option value="1">Ano — každý student vlastní trial přes free-trial API</option>
              <option value="0">Ne, kódy vkládám ručně</option>
            </select>
          </label>
          <label className="text-[11px] font-semibold text-gray-500">IČO v legacy volání
            <select value={settings.legacyVatMode} onChange={(e) => setSettings({ ...settings, legacyVatMode: e.target.value as StudentProgramSettings['legacyVatMode'] })} className={INPUT}>
              <option value="none">Neposílat (vlastní organizace na studenta)</option>
              <option value="university_ico">IČO univerzity</option>
            </select>
          </label>
          <label className="text-[11px] font-semibold text-gray-500">Délka trialu z API (dny)<input type="number" min={1} max={3650} value={settings.legacyTrialDays} onChange={(e) => setSettings({ ...settings, legacyTrialDays: Number(e.target.value) })} className={INPUT} /></label>
          <label className="text-[11px] font-semibold text-gray-500">Interval check-inu (dny)<input type="number" min={30} max={365} value={settings.checkinIntervalDays} onChange={(e) => setSettings({ ...settings, checkinIntervalDays: Number(e.target.value) })} className={INPUT} /></label>
          <label className="text-[11px] font-semibold text-gray-500">Varovat před koncem kódů (dny)<input type="number" min={1} max={90} value={settings.extensionWarnDays} onChange={(e) => setSettings({ ...settings, extensionWarnDays: Number(e.target.value) })} className={INPUT} /></label>
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
          <li><strong>Registrace</strong> na /studenti — univerzitní e-mail, fakulta (auto podle domény), osobní e-mail, telefon (nepovinně), stupeň a předměty, konec studia.</li>
          <li><strong>Ověření</strong> odkazem v e-mailu (7 dní). Po kliknutí vznikne přístup: kódy fakulty, uvítací e-mail (kopie na osobní e-mail), zápis do subscribers s tagem <code>student-program</code>.</li>
          <li><strong>Check-in každých 182 dní</strong> — „ještě studujete?“, datum konce, používání, telefon. Odpověď = engagement <em>active/passive</em>; dvě nezodpovězené výzvy = <em>inactive</em>.</li>
          <li><strong>Konec studia</strong> — jednorázový e-mail „kam nastupujete“ + hledání školy v rejstříku. Absolvent = stav <em>alumni</em>, přístup běží ještě 6 měsíců.</li>
          <li><strong>Vypršení</strong> — půl roku po studiu končí přístup, e-mail nabídne školní trial a kalkulaci. Absolvent se známou školou = lead pro obchod (upozornění na e-mail hned po nahlášení).</li>
        </ol>
      </Block>
      <Block title="Co se děje, když student používá / nepoužívá">
        <p><strong>Používá</strong> (odpověděl ano): pozvánky na workshopy a webináře pro budoucí učitele, výzva sdílet přístup se spolužáky přes odkaz fakulty, po státnicích prioritní kontakt obchodu se školou.</p>
        <p><strong>Nepoužívá / neodpovídá</strong>: check-in dál chodí (max. 2× ročně), ale bez dalších aktivit. Po dvou nezodpovězených check-inech je engagement <em>inactive</em> — signál pro fakultu (nestačí odkaz, je potřeba workshop) a pro nás (co v aplikaci chybí). Přístup se kvůli nečinnosti neruší, ruší se jen po vypršení nebo na žádost.</p>
      </Block>
      <Block title="Kódy a legacy admin">
        <p>Přístup do aplikace stále řídí legacy Vividbooks (kódy školy). <strong>Každý student má vlastní kódy</strong>: při ověření e-mailu se zavolá free-trial API pod jménem studenta (Position „Student“, organizace „Jméno – student Fakulta“) a vznikne 14denní trial s vlastní dvojicí kódů.</p>
        <p>Obchod pak v legacy adminu prodlouží studentův trial (ideálně do konce studia + 6 měsíců) a zapíše datum do <em>Kódy platí do</em> v detailu studenta. Cron hlídá konec 21 dní předem — fronta <em>Prodloužit trial v legacy adminu</em> a denní přehled. Když API kódy nevrátí, student je ve frontě <em>Bez kódů</em>: „Založit kódy“ zkusí API znovu, nebo se kódy vloží ručně.</p>
      </Block>
      <Block title="Fakulty: oslovení a pokrytí">
        <p>Seznam = 9 pedagogických fakult (jádro) + fakulty s učitelskými programy. U každé sledujeme stav oslovení (neosloveno → osloveno → v jednání → partner/odmítli), kontakty (proděkan pro studium, vedoucí kateder didaktiky, studijní oddělení) a follow-up.</p>
        <p>Šablony e-mailů jménem Vítka: úvod pro vedení (prosba o rozeslání studentům), úvod pro katedru (vzorky sešitů zdarma + workshop), připomenutí, text pro studenty. Odesílá se jen po kliknutí v adminu; odpovědi chodí na vitek@vividbooks.com.</p>
        <p>Partner = fakulta odkaz oficiálně rozeslala nebo proběhl workshop. Pokrytí = fakulta má aspoň jednoho aktivního studenta; cílový stav je 9/9 PedF.</p>
      </Block>
      <Block title="Provoz a rytmus">
        <ul className="list-disc space-y-1 pl-5">
          <li><strong>Denně</strong> (cron 7:10 UTC): check-iny, přechody stavů, digest na e-mail s frontami (bez kódů, k prodloužení, absolventi).</li>
          <li><strong>Týdně</strong>: projít frontu „K oslovení / follow-up“ ve Fakultách a „Absolventi bez školy“.</li>
          <li><strong>Září a únor</strong> (začátek semestrů): kampaň na fakulty — rozeslání textu pro studenty, workshopy, vzorky pro katedry.</li>
          <li><strong>Červen</strong>: většina studií končí — zkontrolovat, že fakultní kódy platí přes léto, připravit obchodní follow-up absolventů.</li>
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
          <p className="max-w-2xl text-[14px] text-gray-600">Studentský program: registrace z /studenti, přístup po dobu studia, půlroční check-iny, absolventi jako leady a oslovení pedagogických fakult.</p>
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
      {tab === 'studenti' && <StudentsTab faculties={faculties} initialQueue={queue} onQueueConsumed={() => setQueue('')} />}
      {tab === 'fakulty' && <FacultiesTab />}
      {tab === 'cile' && <GoalsTab />}
      {tab === 'metodika' && <MethodologyTab />}
    </div>
  );
}
