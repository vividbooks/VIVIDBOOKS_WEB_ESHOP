import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  RefreshCw, ChevronDown, ChevronRight, Users, CheckCircle2,
  Rocket, Calendar, Mail, Phone, Briefcase, Clock, Search,
  Download, Tag, Building2, User
} from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import { projectId, publicAnonKey } from '../../utils/supabase/info';
import { webinarEventTimestampMs } from '../../utils/webinarEventTimestamp';
import { cn } from '../ui/utils';

const SERVER = `https://${projectId}.supabase.co/functions/v1/make-server-93a20b6f`;

/** Horizontální scroll — padding pod obsahem + tenký scrollbar, ať nepřekrývá řádek (macOS overlay). */
const ROW_SCROLL_CLASS = cn(
  'min-w-0 flex flex-nowrap items-center gap-x-2 gap-y-0 overflow-x-auto overflow-y-visible',
  'pb-4 pt-0.5 pr-1',
  '[scrollbar-width:thin] [scrollbar-color:rgba(148,163,184,0.85)_transparent]',
  '[&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-300/90',
);

function mergePartsFromMember(school: string, mergeExtra: string): string[] {
  const a = school ? school.split(' · ').map((s) => s.trim()).filter(Boolean) : [];
  const b = mergeExtra ? mergeExtra.split(' · ').map((s) => s.trim()).filter(Boolean) : [];
  return [...a, ...b];
}

function mergeSegmentKind(labelLower: string): 'org' | 'role' | 'meta' | 'other' {
  if (/org|organization|škola|skola|school|instit|zák|zaklad|mateřsk|matersk|gymn|střed/i.test(labelLower)) {
    return 'org';
  }
  if (/position|pozice|role|funkce|zaměst|učitel|ucitel|titul/i.test(labelLower)) {
    return 'role';
  }
  if (/last|changed|birth|datum|narozen|změna|zmena/i.test(labelLower)) {
    return 'meta';
  }
  return 'other';
}

function mergeShortLabel(labelRaw: string, kind: ReturnType<typeof mergeSegmentKind>): string {
  const l = labelRaw.toLowerCase();
  if (kind === 'org') return 'Škola';
  if (kind === 'role') return 'Role';
  if (/last_changed|last changed/.test(l)) return 'Změna';
  if (/birth|narozen/i.test(l)) return 'Nar.';
  if (kind === 'meta') return labelRaw.replace(/_/g, ' ').slice(0, 10);
  return labelRaw.length > 16 ? `${labelRaw.slice(0, 14)}…` : labelRaw;
}

/** Normalizace pro porovnání tagů (MC může lišit diakritiku / mezery). */
function stripTagForCompare(s: string): string {
  return s
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function tagMatchesWebinarTitle(t: string, webinarTag: string): boolean {
  const a = stripTagForCompare(t);
  const b = stripTagForCompare(webinarTag);
  if (!a || !b) return false;
  if (a === b) return true;
  if (a.includes(b) || b.includes(a)) return true;
  return false;
}

function hasWebinarFormTag(tags: string[]): boolean {
  return tags.some((t) => /webinar\s*form/i.test(String(t).trim()));
}

/** Tag vypadá jako konkrétní webinář (dlouhý název / datum), ne obecné „Webinar form“. */
function isLikelyWebinarEventTag(t: string): boolean {
  const s = String(t).trim();
  if (/webinar\s*form/i.test(s)) return false;
  if (/^newsletter$/i.test(s)) return false;
  if (/^webinar-[a-z0-9-]{4,}/i.test(s)) return true;
  if (s.length < 18) return false;
  if (/\d{4}/.test(s) && /[-–—]/.test(s)) return true;
  if (s.length >= 36) return true;
  if (/webinar|webinář|webináře|predstaveni|představen/i.test(s)) return true;
  return false;
}

/** Jiný „webinářový“ tag než aktuální webinář (už dřív registrovaný na jiný webinář). */
function hasAnotherWebinarEventTag(tags: string[], webinarTag: string): boolean {
  return tags.some(
    (t) => isLikelyWebinarEventTag(t) && !tagMatchesWebinarTitle(t, webinarTag),
  );
}

/** Nově příchozí: Webinar form + tag tohoto webináře, bez jiného webinářového tagu. */
function isMailchimpNewcomer(tags: string[], webinarTag: string): boolean {
  if (!webinarTag.trim()) return false;
  if (!hasWebinarFormTag(tags)) return false;
  if (!tags.some((t) => tagMatchesWebinarTitle(t, webinarTag))) return false;
  if (hasAnotherWebinarEventTag(tags, webinarTag)) return false;
  return true;
}

/**
 * Už byly aspoň na jednom webináři: v segmentu tohoto webináře, ale ne „čistý“ nováček
 * (mají jiný webinářový tag, nebo se k webináři dostali bez Webinar form).
 */
function isMailchimpRepeatAttendee(tags: string[], webinarTag: string): boolean {
  if (!webinarTag.trim()) return false;
  const hasCurrent = tags.some((t) => tagMatchesWebinarTitle(t, webinarTag));
  if (!hasCurrent) return false;
  if (hasAnotherWebinarEventTag(tags, webinarTag)) return true;
  if (!hasWebinarFormTag(tags)) return true;
  return false;
}

function MailchimpMergeSegment({ part }: { part: string }) {
  const m = part.match(/^([^:]+):\s*(.+)$/s);
  if (!m) {
    return (
      <span className="inline-flex max-w-[min(280px,42vw)] items-center gap-1 text-gray-700">
        <Briefcase className="h-3 w-3 shrink-0 text-gray-400" />
        <span className="truncate" title={part}>
          {part}
        </span>
      </span>
    );
  }
  const labelRaw = m[1].trim();
  const value = m[2].trim();
  const kind = mergeSegmentKind(labelRaw.toLowerCase());
  const Icon = kind === 'org' ? Building2 : kind === 'role' ? User : kind === 'meta' ? Calendar : Briefcase;
  const showShort = mergeShortLabel(labelRaw, kind);
  return (
    <span
      className="inline-flex max-w-[min(300px,44vw)] min-w-0 shrink-0 items-center gap-1 text-gray-700"
      title={`${labelRaw}: ${value}`}
    >
      <Icon className="h-3 w-3 shrink-0 text-gray-400" />
      <span className="shrink-0 text-[9px] font-semibold uppercase tracking-wide text-gray-400">{showShort}</span>
      <span className="min-w-0 truncate text-[11px] text-[#001161]/90">{value}</span>
    </span>
  );
}

/** Lokálně — spolehlivější než importovaný comparator (Vite/HMR občas ztratí named export). */
function compareWebinarsByScheduleLocal(a: WebinarStat, b: WebinarStat): number {
  const ap = !!a.isPast;
  const bp = !!b.isPast;
  if (ap !== bp) return ap ? 1 : -1;
  const ta = webinarEventTimestampMs(a);
  const tb = webinarEventTimestampMs(b);
  if (!ap) return ta - tb;
  return tb - ta;
}

interface Registration {
  name: string;
  email: string;
  phone: string;
  position: string;
  newsletter: boolean;
  registeredAt: string;
  attended: boolean;
  attendedAt?: string;
  trialToken?: string;
}

interface WebinarStat {
  webinarId: string;
  webinarTitle: string;
  day: number;
  monthName: string;
  /** 1–12 z CMS — spolehlivé řazení */
  monthNum?: number;
  year: number;
  time: string;
  isPast: boolean;
  total: number;
  attended: number;
  withTrial: number;
  registrations: Registration[];
  /** Tag v Mailchimp (např. webinar-jak-na-zlomky) — počet z audience API */
  mailchimpTag?: string;
  mailchimpTagCount?: number | null;
}

interface MailchimpMemberRow {
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  status: string;
  /** Sloučené pole, která vypadají jako škola / organizace (merge fields v MC). */
  school: string;
  /** Ostatní merge pole kromě jména, tel. */
  mergeExtra: string;
  /** Názvy tagů u kontaktu v Mailchimp. */
  tags: string[];
}

interface McPanelState {
  loading: boolean;
  error?: string;
  rows?: MailchimpMemberRow[];
}

export default function WebinarRegistraceAdmin() {
  const [data, setData] = useState<WebinarStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  /** Kontakty z Mailchimp pro rozbalenou dlaždici (klíč = webinarId) */
  const [mcByWebinar, setMcByWebinar] = useState<Record<string, McPanelState>>({});
  /** Filtr tagů u Mailchimp: vše / nově příchozí / už byli na webináři */
  const [mcTagFilter, setMcTagFilter] = useState<Record<string, 'all' | 'new' | 'repeat'>>({});
  const mcLoadedRef = useRef<Set<string>>(new Set());
  const load = useCallback(async () => {
    setLoading(true);
    const ctrl = new AbortController();
    const to = window.setTimeout(() => ctrl.abort(), 60_000);
    try {
      const res = await fetch(`${SERVER}/admin/registrace`, {
        headers: { Authorization: `Bearer ${publicAnonKey}` },
        signal: ctrl.signal,
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || res.statusText);
      }
      const d = await res.json();
      setData(d.webinars || []);
      setMcByWebinar({});
      setMcTagFilter({});
      mcLoadedRef.current.clear();
    } catch (e: any) {
      if (e?.name === 'AbortError') {
        toast.error('Časový limit (60 s). Zkuste Obnovit — případně zkontrolujte nasazení funkce.');
      } else {
        toast.error(`Chyba: ${e.message}`);
      }
    } finally {
      window.clearTimeout(to);
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const rows = data.filter((w) => !search || w.webinarTitle.toLowerCase().includes(search.toLowerCase()));
    return [...rows].sort(compareWebinarsByScheduleLocal);
  }, [data, search]);

  const totalRegs = data.reduce((s, w) => s + w.total, 0);
  const totalAttended = data.reduce((s, w) => s + w.attended, 0);
  const totalTrial = data.reduce((s, w) => s + w.withTrial, 0);

  const exportCsv = (webinar: WebinarStat) => {
    const headers = ['Jméno', 'E-mail', 'Telefon', 'Pozice', 'Newsletter', 'Registrace', 'Byl/a', 'Trial'];
    const rows = webinar.registrations.map(r => [
      r.name, r.email, r.phone, r.position,
      r.newsletter ? 'Ano' : 'Ne',
      new Date(r.registeredAt).toLocaleString('cs-CZ'),
      r.attended ? 'Ano' : 'Ne',
      r.trialToken ? 'Ano' : 'Ne',
    ]);
    const csv = '\uFEFF' + [headers, ...rows].map(row =>
      row.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')
    ).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `registrace-${webinar.webinarId}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('CSV exportováno');
  };

  useEffect(() => {
    if (!expanded) return;
    const w = data.find((x) => x.webinarId === expanded);
    if (!w?.mailchimpTag) return;
    if (mcLoadedRef.current.has(expanded)) return;
    setMcByWebinar((prev) => ({ ...prev, [expanded]: { loading: true } }));
    const ac = new AbortController();
    (async () => {
      try {
        const res = await fetch(
          `${SERVER}/admin/registrace/mailchimp-members/${encodeURIComponent(expanded)}`,
          { headers: { Authorization: `Bearer ${publicAnonKey}` }, signal: ac.signal },
        );
        const text = await res.text();
        let d: { members?: MailchimpMemberRow[]; error?: string } = {};
        try {
          d = text ? JSON.parse(text) : {};
        } catch {
          /* ignore */
        }
        if (!res.ok) {
          throw new Error(d.error || text.slice(0, 280) || res.statusText);
        }
        setMcByWebinar((prev) => ({
          ...prev,
          [expanded]: { loading: false, rows: d.members || [] },
        }));
        mcLoadedRef.current.add(expanded);
      } catch (e: any) {
        if (e?.name === 'AbortError') return;
        setMcByWebinar((prev) => ({
          ...prev,
          [expanded]: { loading: false, error: e?.message || 'Chyba' },
        }));
        mcLoadedRef.current.add(expanded);
      }
    })();
    return () => ac.abort();
  }, [expanded, data]);

  return (
    <div className="h-full flex flex-col overflow-hidden bg-[#f7f8fc]" style={{ fontFamily: "'Fenomen Sans', sans-serif" }}>

      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 shrink-0">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-[18px] font-bold text-[#001161]">{'Registrace na webin\u00e1\u0159e'}</h1>
          <button
            onClick={load}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-[12px] font-bold text-gray-600 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            {'Obnovit'}
          </button>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-4 mb-4">
          {[
            { label: 'Celkem registrací', value: totalRegs, icon: Users, color: '#001161', bg: '#EEF0F8' },
            { label: 'Check-in (bylo)', value: totalAttended, icon: CheckCircle2, color: '#16a34a', bg: '#f0fdf4' },
            { label: 'Trial aktivace', value: totalTrial, icon: Rocket, color: '#7C3AED', bg: '#f5f3ff' },
          ].map(s => (
            <div key={s.label} className="rounded-2xl px-4 py-3 flex items-center gap-3" style={{ background: s.bg }}>
              <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: s.color + '20' }}>
                <s.icon className="w-4.5 h-4.5" style={{ color: s.color }} />
              </div>
              <div>
                <div className="text-[22px] font-black" style={{ color: s.color }}>{s.value}</div>
                <div className="text-[11px] font-medium text-gray-500">{s.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Search — server vrací jen plánované webináře (rychlejší než Mailchimp u všech) */}
        <div className="flex flex-col gap-2">
          <p className="text-[11px] text-gray-500 leading-snug">
            {'Zobrazujeme jen '}
            <span className="font-bold text-[#001161]">{'plánované webináře'}</span>
            {' (minulé zatím ne — kvůli rychlosti načítání).'}
          </p>
          <div className="relative flex-1 max-w-[280px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={'Hledat webinář\u2026'}
              className="w-full pl-9 pr-3 py-2 text-[13px] border border-gray-200 rounded-xl bg-white focus:border-[#001161] outline-none"
            />
          </div>
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-6 space-y-3">
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-2 border-gray-200 border-t-[#001161] rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-400 text-[14px]">{'Žádné webináře nenalezeny.'}</div>
        ) : filtered.map(w => {
          const isOpen = expanded === w.webinarId;
          const convRate = w.total > 0 ? Math.round((w.attended / w.total) * 100) : 0;

          return (
            <div key={w.webinarId} className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
              {/* Webinar header row — div instead of button to allow nested button (CSV export) */}
              <div
                onClick={() => setExpanded(isOpen ? null : w.webinarId)}
                className="w-full text-left px-5 py-4 flex items-center gap-4 hover:bg-gray-50 transition-colors cursor-pointer"
              >
                <div className="flex flex-col items-center bg-[#f0f2f8] rounded-xl px-3 py-2 shrink-0 min-w-[52px]">
                  <span className="text-[20px] font-black text-[#001161] leading-none">{w.day}</span>
                  <span className="text-[10px] text-[#001161]/60 leading-tight">{w.monthName}</span>
                  <span className="text-[10px] font-bold text-[#FF8C00] leading-none">{w.year}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[14px] font-bold text-[#001161] truncate">{w.webinarTitle}</span>
                    {w.isPast ? (
                      <span className="text-[10px] bg-gray-100 text-gray-400 px-2 py-0.5 rounded-full font-bold shrink-0">{'MIN'}</span>
                    ) : (
                      <span className="text-[10px] bg-purple-100 text-purple-600 px-2 py-0.5 rounded-full font-bold shrink-0">{'PLÁN'}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-4 flex-wrap">
                    <span className="text-[12px] text-gray-400 flex items-center gap-1">
                      <Clock className="w-3 h-3" />{w.time}
                    </span>
                    <span
                      className="text-[12px] text-[#001161]/70 flex items-center gap-1 flex-wrap max-w-full"
                      title={
                        w.mailchimpTag
                          ? `Mailchimp: kontakty s tagem „${w.mailchimpTag}“ (stejné jako při registraci na webu). Segment v MC s jiným názvem může mít jiné číslo.`
                          : 'Registrace přes formulář na webu'
                      }
                    >
                      <Users className="w-3 h-3 shrink-0" />
                      <span className="font-semibold text-[#001161]">{w.total}</span>
                      <span className="text-gray-400">{'formulář'}</span>
                      <span className="text-gray-300 mx-0.5">·</span>
                      <Tag className="w-3 h-3 shrink-0 text-[#7C3AED]" />
                      <span className="font-semibold text-[#001161]">
                        {w.mailchimpTagCount != null ? w.mailchimpTagCount : '—'}
                      </span>
                      <span className="text-gray-400">{'Mailchimp'}</span>
                    </span>
                    {w.mailchimpTag && (
                      <span
                        className="w-full text-[10px] text-gray-400 font-mono truncate pl-0.5"
                        title="Tag v Mailchimp — musí sedět s tagem u kontaktu"
                      >
                        {w.mailchimpTag}
                      </span>
                    )}
                    <span className="text-[12px] text-green-600 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      {w.attended}{' '}
                      <span className="text-gray-400">{`bylo (${convRate}%)`}</span>
                    </span>
                    <span className="text-[12px] text-purple-600 flex items-center gap-1">
                      <Rocket className="w-3 h-3" />{w.withTrial} <span className="text-gray-400">{'trial'}</span>
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {w.total > 0 && (
                    <button
                      type="button"
                      onClick={e => { e.stopPropagation(); exportCsv(w); }}
                      className="p-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-500 transition-colors"
                      title={'Exportovat CSV z formuláře'}
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {isOpen
                    ? <ChevronDown className="w-4 h-4 text-gray-400" />
                    : <ChevronRight className="w-4 h-4 text-gray-400" />
                  }
                </div>
              </div>

              {/* Expanded: formulář + Mailchimp */}
              {isOpen && (
                <div className="border-t border-gray-100">
                  <div className="px-5 py-2 border-b border-gray-100 bg-gray-50/80">
                    <span className="text-[11px] font-bold text-gray-600">{'Registrace z formuláře na webu'}</span>
                  </div>
                  {w.registrations.length === 0 ? (
                    <p className="px-5 py-4 text-center text-gray-400 text-[13px]">{'Zatím nikdo z formuláře.'}</p>
                  ) : (
                    <div className="divide-y divide-gray-50">
                      {w.registrations.map((reg, idx) => (
                        <div
                          key={idx}
                          className="px-5 py-2.5 flex items-center gap-2 hover:bg-gray-50/50 transition-colors min-w-0"
                        >
                          <div className="w-7 h-7 rounded-full bg-[#001161]/10 flex items-center justify-center shrink-0">
                            <span className="text-[11px] font-bold text-[#001161]">
                              {(reg.name || '?').charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div className={cn(ROW_SCROLL_CLASS, 'text-[11px] text-[#001161]/90')}>
                            <span className="font-semibold text-[#001161] shrink-0">{reg.name}</span>
                            <span className="text-gray-300 shrink-0">·</span>
                            <span className="flex items-center gap-0.5 shrink-0 text-gray-600">
                              <Mail className="w-3 h-3 shrink-0 opacity-60" />{reg.email}
                            </span>
                            {reg.phone ? (
                              <>
                                <span className="text-gray-300 shrink-0">·</span>
                                <span className="flex items-center gap-0.5 shrink-0 text-gray-600">
                                  <Phone className="w-3 h-3 shrink-0 opacity-60" />{reg.phone}
                                </span>
                              </>
                            ) : null}
                            <span className="text-gray-300 shrink-0">·</span>
                            <span className="flex items-center gap-0.5 shrink-0 text-gray-600">
                              <Briefcase className="w-3 h-3 shrink-0 opacity-60" />{reg.position}
                            </span>
                            <span className="text-gray-300 shrink-0">·</span>
                            <span className="flex items-center gap-0.5 shrink-0 text-gray-500">
                              <Calendar className="w-3 h-3 shrink-0 opacity-60" />
                              {new Date(reg.registeredAt).toLocaleDateString('cs-CZ')}
                            </span>
                            {reg.newsletter && (
                              <>
                                <span className="text-gray-300 shrink-0">·</span>
                                <span className="text-[10px] bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded-full font-bold shrink-0">{'NL'}</span>
                              </>
                            )}
                            {reg.attended ? (
                              <>
                                <span className="text-gray-300 shrink-0">·</span>
                                <span className="text-[10px] bg-green-100 text-green-600 px-1.5 py-0.5 rounded-full font-bold shrink-0">{'Byl/a'}</span>
                              </>
                            ) : (
                              <>
                                <span className="text-gray-300 shrink-0">·</span>
                                <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full font-bold shrink-0">{'Nebyl/a'}</span>
                              </>
                            )}
                            {reg.trialToken ? (
                              <>
                                <span className="text-gray-300 shrink-0">·</span>
                                <span className="text-[10px] bg-purple-100 text-purple-600 px-1.5 py-0.5 rounded-full font-bold shrink-0">{'Trial'}</span>
                              </>
                            ) : null}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {w.mailchimpTag && (() => {
                    const rowsRawCount = mcByWebinar[w.webinarId]?.rows || [];
                    const webinarTagForCount = w.mailchimpTag || '';
                    const countAll = rowsRawCount.length;
                    const countNew = rowsRawCount.filter((m) =>
                      isMailchimpNewcomer(m.tags || [], webinarTagForCount),
                    ).length;
                    const countRepeat = rowsRawCount.filter((m) =>
                      isMailchimpRepeatAttendee(m.tags || [], webinarTagForCount),
                    ).length;
                    return (
                    <>
                      <div className="border-t border-b border-gray-100 bg-purple-50/50 px-5 py-2">
                        <span className="text-[11px] font-bold text-[#7C3AED]">{'Kontakty v Mailchimp'}</span>
                        <span className="mt-0.5 block truncate font-mono text-[10px] text-gray-500">{w.mailchimpTag}</span>
                        <div className="mt-2 flex flex-wrap items-center gap-1.5">
                          <span className="text-[10px] font-medium text-gray-500">{'Filtr:'}</span>
                          {(
                            [
                              { id: 'all' as const, label: 'Vše', n: countAll, title: undefined as string | undefined },
                              {
                                id: 'new' as const,
                                label: 'Nově příchozí',
                                n: countNew,
                                title:
                                  'Tag „Webinar form“ a tag tohoto webináře, bez jiného webinářového tagu',
                              },
                              {
                                id: 'repeat' as const,
                                label: 'Už byly na webináři',
                                n: countRepeat,
                                title:
                                  'Jiný webinářový tag v profilu, nebo bez „Webinar form“ (už se zúčastnili / jiný zdroj)',
                              },
                            ] as const
                          ).map((opt) => {
                            const mode = mcTagFilter[w.webinarId] ?? 'all';
                            const active = mode === opt.id;
                            return (
                              <button
                                key={opt.id}
                                type="button"
                                title={opt.title || undefined}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setMcTagFilter((prev) => ({
                                    ...prev,
                                    [w.webinarId]: opt.id,
                                  }));
                                }}
                                className={cn(
                                  'rounded-full px-2.5 py-1 text-[10px] font-semibold transition-colors',
                                  active
                                    ? 'bg-[#7C3AED] text-white shadow-sm'
                                    : 'bg-white/90 text-gray-600 ring-1 ring-gray-200/90 hover:bg-white hover:ring-[#7C3AED]/30',
                                )}
                              >
                                {`${opt.label} (${opt.n})`}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                      {mcByWebinar[w.webinarId]?.loading ? (
                        <div className="flex justify-center py-8">
                          <div className="w-7 h-7 border-2 border-gray-200 border-t-[#7C3AED] rounded-full animate-spin" />
                        </div>
                      ) : mcByWebinar[w.webinarId]?.error ? (
                        <p className="px-5 py-4 text-center text-red-500 text-[13px]">{mcByWebinar[w.webinarId]?.error}</p>
                      ) : (
                        <div className="max-h-[min(420px,50vh)] divide-y divide-gray-50 overflow-y-auto">
                          {(() => {
                            const rowsRaw = mcByWebinar[w.webinarId]?.rows || [];
                            const webinarTag = w.mailchimpTag || '';
                            const mode = mcTagFilter[w.webinarId] ?? 'all';
                            const rowsForDisplay =
                              mode === 'all' || !webinarTag
                                ? rowsRaw
                                : rowsRaw.filter((m) => {
                                    const tags = Array.isArray(m.tags) ? m.tags : [];
                                    if (mode === 'new') return isMailchimpNewcomer(tags, webinarTag);
                                    if (mode === 'repeat') return isMailchimpRepeatAttendee(tags, webinarTag);
                                    return true;
                                  });
                            return (
                              <>
                          {rowsForDisplay.map((m, mi) => {
                            const displayName = [m.firstName, m.lastName].filter(Boolean).join(' ').trim() || m.email;
                            const tags = Array.isArray(m.tags) ? m.tags : [];
                            const mergeParts = mergePartsFromMember(m.school || '', m.mergeExtra || '');
                            return (
                              <div key={`${m.email}-${mi}`} className="flex min-w-0 items-center gap-2 px-5 py-2.5 hover:bg-purple-50/30">
                                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#7C3AED]/15">
                                  <span className="text-[11px] font-bold text-[#7C3AED]">
                                    {(displayName || '?').charAt(0).toUpperCase()}
                                  </span>
                                </div>
                                <div className={cn(ROW_SCROLL_CLASS, 'flex-1 text-[11px] text-[#001161]/90')}>
                                  <div className="flex shrink-0 items-center gap-2 border-r border-gray-200/90 pr-3">
                                    <span className="shrink-0 font-semibold whitespace-nowrap text-[#001161]">{displayName}</span>
                                    <span className="flex shrink-0 items-center gap-0.5 text-gray-600">
                                      <Mail className="h-3 w-3 shrink-0 opacity-60" />
                                      {m.email}
                                    </span>
                                    {m.phone ? (
                                      <span className="flex shrink-0 items-center gap-0.5 text-gray-600">
                                        <Phone className="h-3 w-3 shrink-0 opacity-60" />
                                        {m.phone}
                                      </span>
                                    ) : null}
                                  </div>
                                  {mergeParts.length > 0 ? (
                                    <div className="flex shrink-0 items-center gap-2 border-r border-gray-200/90 px-3">
                                      {mergeParts.map((part, pi) => (
                                        <React.Fragment key={`${mi}-p-${pi}-${part.slice(0, 24)}`}>
                                          {pi > 0 ? (
                                            <span className="shrink-0 text-[10px] text-gray-200" aria-hidden>
                                              |
                                            </span>
                                          ) : null}
                                          <MailchimpMergeSegment part={part} />
                                        </React.Fragment>
                                      ))}
                                    </div>
                                  ) : null}
                                  {m.status ? (
                                    <div className="flex shrink-0 items-center border-r border-gray-200/90 px-3">
                                      <span className="text-[10px] uppercase tracking-wide text-gray-400">{m.status}</span>
                                    </div>
                                  ) : null}
                                  {tags.length > 0 ? (
                                    <div className="flex shrink-0 items-center gap-1 border-l border-gray-200/90 pl-3">
                                      {tags.map((t, ti) => (
                                        <span
                                          key={`${mi}-${ti}-${t.slice(0, 24)}`}
                                          className="inline-block max-w-[min(220px,40vw)] truncate rounded-md bg-purple-100 px-1.5 py-0.5 text-[10px] font-medium whitespace-nowrap text-purple-800 align-middle"
                                          title={t}
                                        >
                                          {t}
                                        </span>
                                      ))}
                                    </div>
                                  ) : null}
                                </div>
                              </div>
                            );
                          })}
                          {(mcByWebinar[w.webinarId]?.rows?.length === 0 && !mcByWebinar[w.webinarId]?.loading) ? (
                            <p className="px-5 py-4 text-center text-gray-400 text-[13px]">{'Žádné kontakty s tímto tagem v audience.'}</p>
                          ) : null}
                          {rowsRaw.length > 0 &&
                          rowsForDisplay.length === 0 &&
                          !mcByWebinar[w.webinarId]?.loading ? (
                            <p className="px-5 py-4 text-center text-amber-700/90 text-[13px]">
                              {
                                'Podle zvoleného filtru tu nikdo nevyhovuje — zvolte „Vše“ nebo zkuste druhý filtr.'
                              }
                            </p>
                          ) : null}
                              </>
                            );
                          })()}
                        </div>
                      )}
                    </>
                    );
                  })()}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}