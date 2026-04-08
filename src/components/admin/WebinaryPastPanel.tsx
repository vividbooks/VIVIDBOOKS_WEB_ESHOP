import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Search, RefreshCw, Radio, Play, Save, Loader2, X,
  Brain, CheckCircle2, AlertCircle, ChevronRight, Clock,
  FileText, Video, Trash2, ExternalLink, Info,
  BookOpen, Plus, Award, Zap, Link2,
  ChevronDown, ChevronUp, Link, Unlink, ClipboardList, Sparkles, Mail, Copy,
  MessageSquare, Users,
} from 'lucide-react';
import type { PostWebinarQuizQuestion, PostWebinarPart2Step } from '../../data/webinars';
import { DEFAULT_POST_WEBINAR_PART2_STEPS } from '../../utils/webinarSurveyDefaults';
import { WebinarLearningsRichEditor } from './WebinarLearningsRichEditor';
import { toast } from 'sonner@2.0.3';
import { projectId, publicAnonKey } from '../../utils/supabase/info';
import { useWebinars } from '../../contexts/WebinarsContext';
import { WebinarSurveyResponsesPanel } from './WebinarSurveyResponsesPanel';
import { parseJsonResponseBody } from '../../utils/parseJsonResponseBody';

const SERVER = `https://${projectId}.supabase.co/functions/v1/make-server-93a20b6f`;

function extractYoutubeId(url: string): string | null {
  const pats = [
    /youtube\.com\/watch\?v=([a-zA-Z0-9_-]+)/,
    /youtu\.be\/([a-zA-Z0-9_-]+)/,
    /youtube\.com\/embed\/([a-zA-Z0-9_-]+)/,
  ];
  for (const p of pats) { const m = url.match(p); if (m) return m[1]; }
  return null;
}

function norm(s: string) {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
}

function matchDvppVideo(webinar: any, dvppVideos: any[]): any | null {
  if (!dvppVideos?.length) return null;
  const wSlug  = norm(webinar.slug || webinar.id || '');
  const wTitle = norm(webinar.title || '');
  const bySlug = dvppVideos.find(v => norm(v.slug || v.id || '') === wSlug);
  if (bySlug) return bySlug;
  const byTitle = dvppVideos.find(v => {
    const vt = norm(v.name || v.title || '');
    return wTitle.length > 5 && (
      vt.includes(wTitle.slice(0, Math.floor(wTitle.length * 0.7))) ||
      wTitle.includes(vt.slice(0, Math.floor(vt.length * 0.7)))
    );
  });
  return byTitle ?? null;
}

const MONTH_NAMES = [
  'Leden','Únor','Březen','Duben','Květen','Červen',
  'Červenec','Srpen','Září','Říjen','Listopad','Prosinec',
];

type RagStatus = { count: number; loading: boolean; lastIndexed?: string };

type PastPanelTab = 'uprava' | 'dotaznik';

interface FormState {
  title: string; subtitle: string;
  day: number; monthNum: number; year: number; time: string;
  lecturer: string; description: string; perks: string; targetAudience: string;
  coverImage: string; recordingUrl: string;
  certificateLinkMode: 'external' | 'survey';
  certificateUrl: string; greyButtonText: string;
  orangeButtonText: string; orangeButtonLink: string;
  prepis: string;
  postWebinarLearningsHtml: string;
  postWebinarQuizQuestions: PostWebinarQuizQuestion[];
  postWebinarPart2: PostWebinarPart2Step[];
}

function cloneDefaultPart2(): PostWebinarPart2Step[] {
  return JSON.parse(JSON.stringify(DEFAULT_POST_WEBINAR_PART2_STEPS)) as PostWebinarPart2Step[];
}

function normalizePart2FromItem(raw: unknown): PostWebinarPart2Step[] {
  if (raw === undefined) return cloneDefaultPart2();
  if (!Array.isArray(raw)) return cloneDefaultPart2();
  if (raw.length === 0) return [];
  const out: PostWebinarPart2Step[] = [];
  for (const s of raw) {
    if (!s || typeof s !== 'object') continue;
    const o = s as Record<string, unknown>;
    const type = o.type;
    const id = String(o.id ?? '').trim();
    if (!type || !id) continue;
    if (type === 'intro') {
      out.push({
        type: 'intro',
        id,
        title: String(o.title ?? ''),
        subtitle: typeof o.subtitle === 'string' ? o.subtitle : undefined,
      });
    } else if (type === 'open') {
      out.push({
        type: 'open',
        id,
        label: String(o.label ?? ''),
        sublabel: typeof o.sublabel === 'string' ? o.sublabel : undefined,
        placeholder: typeof o.placeholder === 'string' ? o.placeholder : undefined,
      });
    } else if (type === 'abc') {
      const opts = Array.isArray(o.options) ? o.options.map((x) => String(x)) : [];
      while (opts.length < 3) opts.push('');
      out.push({
        type: 'abc',
        id,
        label: String(o.label ?? ''),
        options: opts.slice(0, 12),
      });
    }
  }
  return out.length > 0 ? out : cloneDefaultPart2();
}

const EMPTY_FORM: FormState = {
  title: '', subtitle: '',
  day: new Date().getDate(), monthNum: new Date().getMonth() + 1, year: new Date().getFullYear(),
  time: '18:00', lecturer: '', description: '', perks: '', targetAudience: 'Pro učitele',
  coverImage: '', recordingUrl: '',
  certificateUrl: '', greyButtonText: 'Certifikát DVPP',
  orangeButtonText: 'Vyzkoušejte zdarma', orangeButtonLink: '/vyzkousejte',
  prepis: '',
  postWebinarLearningsHtml: '',
  postWebinarQuizQuestions: [],
  postWebinarPart2: cloneDefaultPart2(),
};

function normalizeQuizFromItem(raw: unknown): PostWebinarQuizQuestion[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((q: any, i: number) => {
    const opts = Array.isArray(q?.options) ? q.options.map((x: unknown) => String(x)) : [];
    const pad = [...opts, '', '', '', ''].slice(0, 4);
    return {
      id: String(q?.id || `dvpp-q-${i}`),
      type: 'abc' as const,
      label: String(q?.label ?? q?.question ?? '').trim(),
      options: pad,
      correctIndex: typeof q?.correctIndex === 'number' && q.correctIndex >= 0 && q.correctIndex <= 3
        ? q.correctIndex
        : 0,
    };
  });
}

function itemToForm(webinar: any, dvpp: any | null): FormState {
  return {
    title:            webinar.title            ?? '',
    subtitle:         webinar.subtitle         ?? '',
    day:              webinar.day              ?? new Date().getDate(),
    monthNum:         webinar.monthNum         ?? (new Date().getMonth() + 1),
    year:             webinar.year             ?? new Date().getFullYear(),
    time:             webinar.time             ?? '18:00',
    lecturer:         webinar.lecturer         ?? '',
    description:      webinar.description      ?? dvpp?.description ?? '',
    perks:            webinar.perks            ?? '',
    targetAudience:   webinar.targetAudience   ?? '',
    coverImage:       webinar.coverImage       ?? dvpp?.thumbnail   ?? '',
    recordingUrl:     webinar.recordingUrl || webinar.youtubeUrl || dvpp?.youtubeUrl       || '',
    certificateLinkMode:
      webinar.certificateLinkMode === 'survey' || dvpp?.certificateLinkMode === 'survey' ? 'survey' : 'external',
    certificateUrl:   webinar.certificateUrl   || dvpp?.certificateUrl   || '',
    greyButtonText:   webinar.greyButtonText   || dvpp?.greyButtonText   || 'Certifikát DVPP',
    orangeButtonText: webinar.orangeButtonText || dvpp?.orangeButtonText || 'Vyzkoušejte zdarma',
    orangeButtonLink: webinar.orangeButtonLink || dvpp?.orangeButtonLink || '/vyzkousejte',
    prepis:           webinar.prepis           ?? '',
    postWebinarLearningsHtml: typeof webinar.postWebinarLearningsHtml === 'string' ? webinar.postWebinarLearningsHtml : '',
    postWebinarQuizQuestions: normalizeQuizFromItem(webinar.postWebinarQuizQuestions),
    postWebinarPart2: normalizePart2FromItem(webinar.postWebinarPart2),
  };
}

// ── Collapsible section ──────────────────────────────────────────────────
function Section({
  icon, title, subtitle, color = '#001161', bgColor = '#EEF0FA',
  defaultOpen = true, badge, children,
}: {
  icon: React.ReactNode; title: string; subtitle?: string;
  color?: string; bgColor?: string; defaultOpen?: boolean;
  badge?: React.ReactNode; children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
      <button type="button" onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: bgColor }}>
            <span style={{ color }}>{icon}</span>
          </div>
          <div className="text-left">
            <div className="flex items-center gap-2">
              <span className="text-[13px] font-bold text-gray-700 uppercase tracking-wide">{title}</span>
              {badge}
            </div>
            {subtitle && <div className="text-[11px] text-gray-400 mt-0.5">{subtitle}</div>}
          </div>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
      </button>
      {open && <div className="border-t border-gray-100 px-5 pb-5 pt-4 space-y-4">{children}</div>}
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wide block mb-1.5">{label}</label>
      {children}
      {hint && <p className="text-[11px] text-gray-400 mt-1">{hint}</p>}
    </div>
  );
}

const inputCls    = "w-full px-3 py-2 text-[13px] border border-gray-200 rounded-xl focus:border-purple-400 outline-none transition-colors bg-white";
const textareaCls = "w-full px-3 py-2 text-[13px] border border-gray-200 rounded-xl focus:border-purple-400 outline-none transition-colors resize-none leading-relaxed bg-white";

// ── Main component ───────────────────────────────────────────────────────
type WebinaryPastPanelProps = {
  /** Když je panel skrytý (jiná záložka), nenačítáme. Po přepnutí na záložku znovu načteme seznam (čerstvá data z editoru). */
  active?: boolean;
};

export default function WebinaryPastPanel({ active = true }: WebinaryPastPanelProps) {
  const { refresh: refreshContext } = useWebinars();
  const [items, setItems]           = useState<any[]>([]);
  const [dvppVideos, setDvppVideos] = useState<any[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [search, setSearch]         = useState('');
  const [selected, setSelected]     = useState<any | null>(null);
  const [matchedDvpp, setMatchedDvpp] = useState<any | null>(null);
  const [isNew, setIsNew]           = useState(false);

  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const upd = (patch: Partial<FormState>) => setForm(f => ({ ...f, ...patch }));

  const [saving, setSaving]       = useState(false);
  const [ragStatus, setRagStatus] = useState<Record<string, RagStatus>>({});
  const [indexing, setIndexing]   = useState<string | null>(null);
  const [pastPanelTab, setPastPanelTab] = useState<PastPanelTab>('uprava');
  const [generatingDvppQuestions, setGeneratingDvppQuestions] = useState(false);
  const [generatingDvppLearnings, setGeneratingDvppLearnings] = useState(false);
  const [followupTestEmail, setFollowupTestEmail] = useState('');
  const [followupSending, setFollowupSending] = useState(false);
  const [regCount, setRegCount] = useState<number | null>(null);
  const [regCountLoading, setRegCountLoading] = useState(false);
  /** Položky z GET /webinar-registrace/:id — stejný dotaz jako u počtu. */
  const [registrants, setRegistrants] = useState<
    Array<{
      name?: string;
      email?: string;
      position?: string;
      phone?: string;
      registeredAt?: string;
    }>
  >([]);
  const [bulkFollowupSending, setBulkFollowupSending] = useState(false);
  /** Sloučení KV registrací + Mailchimp (stejný tag jako u registrace na webu). */
  const [followupPreview, setFollowupPreview] = useState<{
    kvCount: number;
    mailchimpCount: number;
    uniqueTotal: number;
    mailchimpTag: string | null;
    mailchimpError: string | null;
  } | null>(null);
  const [followupPreviewLoading, setFollowupPreviewLoading] = useState(false);
  /** Kontakty z Mailchimp (stejný tag jako u hromadného follow-upu). */
  const [mcListState, setMcListState] = useState<{
    loading: boolean;
    tag: string | null;
    rows: Array<{
      email: string;
      firstName: string;
      lastName: string;
      phone: string;
      status: string;
      school: string;
      tags: string[];
    }>;
    error: string | null;
  }>({ loading: false, tag: null, rows: [], error: null });
  /** Remount WYSIWYG po AI generování článku (stejné id webináře). */
  const [learningsRemountKey, setLearningsRemountKey] = useState(0);

  const loadList = useCallback(async (): Promise<{ past: any[]; dvpp: any[] }> => {
    setLoadingList(true);
    try {
      const [webinarRes, dvppRes] = await Promise.all([
        fetch(`${SERVER}/admin/webinare`, { headers: { Authorization: `Bearer ${publicAnonKey}` } }),
        fetch(`${SERVER}/dvpp-videos`,    { headers: { Authorization: `Bearer ${publicAnonKey}` } }),
      ]);
      const webinarData = await webinarRes.json();
      const dvppData    = await dvppRes.json();
      const past = (webinarData.items || []).filter((w: any) => !!w.isPast);
      const dvpp = dvppData.videos ?? [];
      setItems(past);
      setDvppVideos(dvpp);
      return { past, dvpp };
    } catch (e: any) {
      toast.error(`Chyba: ${e.message}`);
      return { past: [], dvpp: [] };
    } finally {
      setLoadingList(false);
    }
  }, []);

  useEffect(() => {
    if (!active) return;
    void loadList();
  }, [active, loadList]);

  useEffect(() => {
    if (!selected?.id || isNew) {
      setRegCount(null);
      setRegistrants([]);
      return;
    }
    let cancelled = false;
    setRegCountLoading(true);
    void fetch(
      `${SERVER}/webinar-registrace/${encodeURIComponent(String(selected.id))}`,
      { headers: { Authorization: `Bearer ${publicAnonKey}` } },
    )
      .then((r) => r.text())
      .then((raw) => (parseJsonResponseBody(raw) || {}) as { count?: number; registrations?: unknown[] })
      .then((d: { count?: number; registrations?: unknown[] }) => {
        if (cancelled) return;
        const raw = Array.isArray(d.registrations) ? d.registrations : [];
        const mapped = raw.map((row: any) => ({
          name: typeof row?.name === 'string' ? row.name : '',
          email: typeof row?.email === 'string' ? row.email : '',
          position: typeof row?.position === 'string' ? row.position : '',
          phone: typeof row?.phone === 'string' ? row.phone : '',
          registeredAt: typeof row?.registeredAt === 'string' ? row.registeredAt : '',
        }));
        mapped.sort((a, b) => {
          const ta = a.registeredAt ? new Date(a.registeredAt).getTime() : 0;
          const tb = b.registeredAt ? new Date(b.registeredAt).getTime() : 0;
          return tb - ta;
        });
        setRegistrants(mapped);
        const n =
          typeof d.count === 'number'
            ? d.count
            : mapped.length;
        setRegCount(n);
      })
      .catch(() => {
        if (!cancelled) {
          setRegCount(0);
          setRegistrants([]);
        }
      })
      .finally(() => {
        if (!cancelled) setRegCountLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selected?.id, isNew]);

  useEffect(() => {
    if (!selected?.id || isNew) {
      setFollowupPreview(null);
      return;
    }
    let cancelled = false;
    setFollowupPreviewLoading(true);
    void fetch(
      `${SERVER}/admin/webinar-post-followup-recipient-preview/${encodeURIComponent(String(selected.id))}`,
      { headers: { Authorization: `Bearer ${publicAnonKey}` } },
    )
      .then((r) => r.text())
      .then((raw) => (parseJsonResponseBody(raw) || {}) as Record<string, unknown>)
      .then((d) => {
        if (cancelled) return;
        if (typeof d.uniqueTotal === 'number') {
          setFollowupPreview({
            kvCount: typeof d.kvCount === 'number' ? d.kvCount : 0,
            mailchimpCount: typeof d.mailchimpCount === 'number' ? d.mailchimpCount : 0,
            uniqueTotal: d.uniqueTotal,
            mailchimpTag: typeof d.mailchimpTag === 'string' ? d.mailchimpTag : null,
            mailchimpError: typeof d.mailchimpError === 'string' ? d.mailchimpError : null,
          });
        } else {
          setFollowupPreview(null);
        }
      })
      .catch(() => {
        if (!cancelled) setFollowupPreview(null);
      })
      .finally(() => {
        if (!cancelled) setFollowupPreviewLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selected?.id, isNew]);

  useEffect(() => {
    if (!selected?.id || isNew) {
      setMcListState({ loading: false, tag: null, rows: [], error: null });
      return;
    }
    let cancelled = false;
    setMcListState((s) => ({ ...s, loading: true, error: null }));
    void fetch(
      `${SERVER}/admin/registrace/mailchimp-members/${encodeURIComponent(String(selected.id))}`,
      { headers: { Authorization: `Bearer ${publicAnonKey}` } },
    )
      .then(async (res) => {
        const raw = await res.text();
        const d = (parseJsonResponseBody(raw) || {}) as {
          tag?: string;
          members?: Array<{
            email?: string;
            firstName?: string;
            lastName?: string;
            phone?: string;
            status?: string;
            school?: string;
            tags?: string[];
          }>;
          error?: string;
        };
        if (cancelled) return;
        if (!res.ok) {
          setMcListState({
            loading: false,
            tag: null,
            rows: [],
            error: d.error || raw.slice(0, 220) || `HTTP ${res.status}`,
          });
          return;
        }
        const rows = (Array.isArray(d.members) ? d.members : []).map((m) => ({
          email: String(m.email || ''),
          firstName: String(m.firstName || ''),
          lastName: String(m.lastName || ''),
          phone: String(m.phone || ''),
          status: String(m.status || ''),
          school: String(m.school || ''),
          tags: Array.isArray(m.tags) ? m.tags.map((t) => String(t)) : [],
        }));
        setMcListState({
          loading: false,
          tag: typeof d.tag === 'string' ? d.tag : null,
          rows,
          error: null,
        });
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setMcListState({
            loading: false,
            tag: null,
            rows: [],
            error: e instanceof Error ? e.message : 'Chyba načtení Mailchimp',
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [selected?.id, isNew]);

  const loadRagStatus = useCallback(async (webinarId: string) => {
    setRagStatus(prev => ({ ...prev, [webinarId]: { ...prev[webinarId], loading: true, count: prev[webinarId]?.count ?? 0 } }));
    try {
      const res  = await fetch(`${SERVER}/rag/webinar-prepis-status/${webinarId}`, { headers: { Authorization: `Bearer ${publicAnonKey}` } });
      const data = await res.json();
      setRagStatus(prev => ({ ...prev, [webinarId]: { count: data.count ?? 0, loading: false } }));
    } catch {
      setRagStatus(prev => ({ ...prev, [webinarId]: { count: 0, loading: false } }));
    }
  }, []);

  function handleSelect(item: any) {
    setIsNew(false);
    setSelected(item);
    setPastPanelTab('uprava');
    const dvpp = matchDvppVideo(item, dvppVideos);
    setMatchedDvpp(dvpp);
    setForm(itemToForm(item, dvpp));
    loadRagStatus(item.id);
  }

  function handleNewRecord() {
    setIsNew(true);
    setSelected(null);
    setMatchedDvpp(null);
    setPastPanelTab('uprava');
    setForm({ ...EMPTY_FORM });
  }

  function updateQuizQuestion(index: number, patch: Partial<PostWebinarQuizQuestion>) {
    setForm((f) => {
      const list = [...(f.postWebinarQuizQuestions || [])];
      const cur = list[index];
      if (!cur) return f;
      list[index] = { ...cur, ...patch };
      return { ...f, postWebinarQuizQuestions: list };
    });
  }

  function updateQuizOption(qIndex: number, optIndex: number, value: string) {
    setForm((f) => {
      const list = [...(f.postWebinarQuizQuestions || [])];
      const cur = list[qIndex];
      if (!cur) return f;
      const options = [...cur.options];
      options[optIndex] = value;
      list[qIndex] = { ...cur, options };
      return { ...f, postWebinarQuizQuestions: list };
    });
  }

  function replacePart2Step(index: number, step: PostWebinarPart2Step) {
    setForm((f) => {
      const list = [...f.postWebinarPart2];
      if (!list[index]) return f;
      list[index] = step;
      return { ...f, postWebinarPart2: list };
    });
  }

  function updatePart2AbcOption(stepIndex: number, optIndex: number, value: string) {
    setForm((f) => {
      const list = [...f.postWebinarPart2];
      const cur = list[stepIndex];
      if (!cur || cur.type !== 'abc') return f;
      const options = [...cur.options];
      options[optIndex] = value;
      list[stepIndex] = { ...cur, options };
      return { ...f, postWebinarPart2: list };
    });
  }

  async function callDvppGenerate(part: 'questions' | 'learnings') {
    if (!selected?.id) return;
    if (!form.prepis.trim()) {
      toast.error('V záložce „Úprava záznamu“ vyplň přepis webináře (nebo ho uložte z minula).');
      return;
    }
    if (part === 'questions') setGeneratingDvppQuestions(true);
    else setGeneratingDvppLearnings(true);
    try {
      const res = await fetch(`${SERVER}/admin/webinar-generate-dvpp-quiz`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${publicAnonKey}` },
        body: JSON.stringify({ webinarId: selected.id, prepis: form.prepis, part }),
      });
      let data: any;
      try {
        data = await res.json();
      } catch {
        throw new Error(
          res.status === 404
            ? 'Endpoint není na serveru (404). Znovu nasaďte Edge funkci make-server-93a20b6f z tohoto repa (supabase functions deploy make-server-93a20b6f).'
            : `Neplatná odpověď serveru (${res.status}).`,
        );
      }
      if (res.status === 404) {
        throw new Error(
          'Endpoint není na serveru (404). Znovu nasaďte Edge funkci make-server-93a20b6f z tohoto repa (supabase functions deploy make-server-93a20b6f).',
        );
      }
      if (!res.ok) throw new Error(data.error || res.statusText);

      setForm((f) => ({
        ...f,
        ...(Array.isArray(data.questions) && data.questions.length > 0
          ? { postWebinarQuizQuestions: data.questions as PostWebinarQuizQuestion[] }
          : {}),
        ...(typeof data.learningsHtml === 'string'
          ? { postWebinarLearningsHtml: data.learningsHtml }
          : {}),
      }));

      if (typeof data.learningsHtml === 'string') {
        setLearningsRemountKey((k) => k + 1);
      }

      if (part === 'questions') {
        const n = Array.isArray(data.questions) ? data.questions.length : 0;
        if (n === 0) throw new Error('Server nevrátil otázky');
        toast.success(`Vygenerováno ${n} otázek — zkontrolujte a uložte.`);
      } else {
        toast.success('Vygenerován článek — zkontrolujte a uložte.');
      }
    } catch (e: any) {
      toast.error(e?.message || 'Generování selhalo');
    } finally {
      if (part === 'questions') setGeneratingDvppQuestions(false);
      else setGeneratingDvppLearnings(false);
    }
  }

  async function handleBulkPostFollowupSend() {
    if (!selected?.id) return;
    const n = followupPreview?.uniqueTotal ?? regCount ?? 0;
    if (n <= 0) {
      toast.error(
        'Žádní příjemci (registrace na webu ani Mailchimp tag). Zkontrolujte Mailchimp / tag u webináře.',
      );
      return;
    }
    const kv = followupPreview?.kvCount ?? regCount ?? 0;
    const mc = followupPreview?.mailchimpCount ?? 0;
    if (
      !confirm(
        `Odeslat e-mail se záznamem webináře a odkazem na dotazník?\n\n` +
          `Příjemců (unikátní e-maily): ${n} — z toho z webu ${kv}, z Mailchimpu ${mc} (stejný tag jako při registraci; duplicity se sloučí).\n\n` +
          `Akci nelze vrátit zpět.`,
      )
    ) {
      return;
    }
    setBulkFollowupSending(true);
    try {
      const res = await fetch(`${SERVER}/admin/webinar-post-followup-bulk-send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${publicAnonKey}` },
        body: JSON.stringify({
          webinarId: selected.id,
          learningsHtml: form.postWebinarLearningsHtml || undefined,
          postWebinarQuizQuestions:
            form.postWebinarQuizQuestions && form.postWebinarQuizQuestions.length > 0
              ? form.postWebinarQuizQuestions
              : undefined,
        }),
      });
      const rawText = await res.text();
      let data: { error?: string; sent?: number; total?: number; failed?: number };
      try {
        data = (parseJsonResponseBody(rawText) || {}) as typeof data;
      } catch {
        throw new Error(
          rawText?.slice(0, 200) || `Neplatná odpověď serveru (${res.status}).`,
        );
      }
      if (!res.ok) throw new Error(data.error || res.statusText);
      const sent = typeof data.sent === 'number' ? data.sent : 0;
      const total = typeof data.total === 'number' ? data.total : n;
      const failed = typeof data.failed === 'number' ? data.failed : 0;
      const br = (data as { breakdown?: { kvRegistrations?: number; mailchimpTagged?: number } }).breakdown;
      let okMsg = `Odesláno ${sent} z ${total} e-mailů.`;
      if (br && typeof br.mailchimpTagged === 'number' && br.mailchimpTagged > 0) {
        okMsg += ` (KV ${br.kvRegistrations ?? '—'}, Mailchimp ${br.mailchimpTagged})`;
      }
      toast.success(okMsg);
      if (failed > 0) {
        toast.error(`${failed} e-mailů se nepodařilo odeslat — zkontrolujte Edge Function logy (Mandrill).`);
      }
    } catch (e: any) {
      toast.error(e?.message || 'Hromadné odeslání selhalo');
    } finally {
      setBulkFollowupSending(false);
    }
  }

  async function handlePostFollowupTestSend() {
    if (!selected?.id) return;
    const em = followupTestEmail.trim();
    if (!em || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) {
      toast.error('Zadejte platný e-mail pro test.');
      return;
    }
    setFollowupSending(true);
    try {
      const res = await fetch(`${SERVER}/admin/webinar-post-followup-test-send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${publicAnonKey}` },
        body: JSON.stringify({
          webinarId: selected.id,
          toEmail: em,
          learningsHtml: form.postWebinarLearningsHtml || undefined,
          postWebinarQuizQuestions:
            form.postWebinarQuizQuestions?.length > 0 ? form.postWebinarQuizQuestions : undefined,
        }),
      });
      const rawText = await res.text();
      const data = (parseJsonResponseBody(rawText) || {}) as { error?: string; template?: string };
      if (!res.ok) throw new Error(data.error || res.statusText);
      const tpl = typeof data.template === 'string' ? data.template : '';
      toast.success(
        tpl
          ? `Odesláno (šablona ${tpl}). Starý vzhled = nenasazená Edge funkce — deploy make-server-93a20b6f.`
          : 'Testovací e-mail odeslán (Mandrill).',
      );
    } catch (e: any) {
      toast.error(e?.message || 'Odeslání selhalo');
    } finally {
      setFollowupSending(false);
    }
  }

  function handleCopyLearningsBlock() {
    const h = form.postWebinarLearningsHtml?.trim();
    if (!h) {
      toast.error('Nejdříve vygenerujte nebo vložte shrnutí.');
      return;
    }
    const block =
      `<h2>Co jsme se na webináři dozvěděli</h2>\n` +
      h;
    void navigator.clipboard.writeText(block).then(
      () => toast.success('Blok zkopírován — vložte do Mailchimp / e-mailu.'),
      () => toast.error('Kopírování se nepovedlo'),
    );
  }

  async function handleSave() {
    if (!form.title.trim()) { toast.error('Vyplň název webináře.'); return; }
    setSaving(true);
    try {
      const monthNum = Number(form.monthNum);
      const webinarPayload: any = {
        ...form,
        monthName:   MONTH_NAMES[monthNum - 1] ?? '',
        monthNum,
        day:         Number(form.day),
        year:        Number(form.year),
        isPast:      true,
        youtubeUrl:  form.recordingUrl || undefined,
        updatedAt:   new Date().toISOString(),
      };

      const dvppPayload = {
        name:             form.title,
        slug:             selected?.slug || selected?.id || `webinar-${Date.now()}`,
        thumbnail:        form.coverImage || '',
        youtubeUrl:       form.recordingUrl,
        certificateUrl:   form.certificateUrl,
        certificateLinkMode: form.certificateLinkMode,
        greyButtonText:   form.greyButtonText,
        orangeButtonText: form.orangeButtonText,
        orangeButtonLink: form.orangeButtonLink,
        description:      form.description,
        topicIds:         matchedDvpp?.topicIds ?? [],
      };

      if (isNew) {
        webinarPayload.id = `webinar-${Date.now()}`;
        webinarPayload.thumbnailVariant = 1;
        const res = await fetch(`${SERVER}/admin/webinare`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${publicAnonKey}` },
          body: JSON.stringify(webinarPayload),
        });
        if (!res.ok) { const e = await res.json(); throw new Error(e.error || res.statusText); }
        const data = await res.json();
        const newWebinar = data.item ?? webinarPayload;
        if (form.recordingUrl || form.certificateUrl || form.certificateLinkMode === 'survey') {
          const dvppId = matchedDvpp?.id || newWebinar.id;
          await fetch(`${SERVER}/dvpp-videos/${dvppId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${publicAnonKey}` },
            body: JSON.stringify({ ...dvppPayload, slug: newWebinar.slug || newWebinar.id }),
          });
        }
        toast.success('Webinář vytvořen!');
        await loadList();
        setIsNew(false);
        setSelected(newWebinar);
        setForm(itemToForm(newWebinar, null));
        if (newWebinar.id) loadRagStatus(newWebinar.id);
      } else {
        const res = await fetch(`${SERVER}/admin/webinare/${selected.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${publicAnonKey}` },
          body: JSON.stringify(webinarPayload),
        });
        if (!res.ok) { const e = await res.json(); throw new Error(e.error || res.statusText); }
        const dvppId = matchedDvpp?.id || selected.id;
        const dvppRes = await fetch(`${SERVER}/dvpp-videos/${dvppId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${publicAnonKey}` },
          body: JSON.stringify({ ...dvppPayload, slug: selected.slug || selected.id }),
        });
        if (dvppRes.ok) {
          const d = await dvppRes.json();
          toast.success(d.created ? 'Uloženo + vytvořen nový DVPP záznam' : 'Uloženo + aktualizováno DVPP video');
          await loadList();
          setSelected((prev: any) => ({ ...prev, ...webinarPayload }));
          setItems(prev => prev.map((w: any) => w.id === selected.id ? { ...w, ...webinarPayload } : w));
        } else {
          toast.success('Uloženo!');
          setSelected((prev: any) => ({ ...prev, ...webinarPayload }));
          setItems(prev => prev.map((w: any) => w.id === selected.id ? { ...w, ...webinarPayload } : w));
        }
      }
      refreshContext();
    } catch (e: any) { toast.error(`Chyba: ${e.message}`); }
    finally { setSaving(false); }
  }

  async function handleIndexRag() {
    const webinarId = selected?.id;
    if (!webinarId) return;
    if (!form.prepis.trim()) {
      toast.error('Nejdříve vyplň přepis výše.');
      return;
    }
    setIndexing(webinarId);
    try {
      // Send prepis directly in body — server will use it even if not saved yet
      const res = await fetch(`${SERVER}/rag/ingest-webinar-prepis`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${publicAnonKey}` },
        body: JSON.stringify({ webinarId, prepis: form.prepis }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || res.statusText);
      const n = data.ingested ?? 0;
      if (n === 0) {
        toast.warning('Indexace skončila s 0 chunky — zkontroluj přepis (délka, jen mezery?) nebo log edge funkce (embedding / DB).');
      } else {
        toast.success(`RAG: ${n} chunků indexováno`);
      }
      const { past } = await loadList();
      const fresh = past.find((w: any) => w.id === webinarId);
      if (fresh && typeof fresh.prepis === 'string' && fresh.prepis.length > 0) {
        setForm((f) => ({ ...f, prepis: fresh.prepis }));
      }
      await loadRagStatus(webinarId);
      setRagStatus(prev => ({
        ...prev,
        [webinarId]: { ...(prev[webinarId] || { count: 0, loading: false }), lastIndexed: new Date().toLocaleTimeString('cs-CZ') },
      }));
    } catch (e: any) { toast.error(`RAG chyba: ${e.message}`); }
    finally { setIndexing(null); }
  }

  const searchTrim = search.trim();
  const q = searchTrim.toLowerCase();
  const filtered = items.filter((w) => {
    if (!q) return true;
    return (w.title || '').toLowerCase().includes(q);
  });
  const videoId  = form.recordingUrl ? extractYoutubeId(form.recordingUrl) : null;
  const status   = selected ? ragStatus[selected.id] : null;

  return (
    <div className="h-full flex overflow-hidden bg-[#f7f8fc]" style={{ fontFamily: "'Fenomen Sans', sans-serif" }}>

      {/* ── LEFT LIST ─────────────────────────────────────── */}
      <div className="w-[270px] bg-white border-r border-gray-200 flex flex-col shrink-0">
        <div className="p-3 border-b border-gray-100 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[13px] font-bold text-[#001161] uppercase tracking-wide">
              {'Minulé webináře'}
              <span className="text-gray-400 font-normal ml-1">({items.length})</span>
            </span>
            <div className="flex items-center gap-1">
              <button onClick={loadList} className="p-1 text-gray-400 hover:text-[#001161]" title="Obnovit">
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
              <button onClick={handleNewRecord}
                className="p-1 text-[#7C3AED] hover:bg-purple-50 rounded-lg transition-colors"
                title={'Nový záznam'}>
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder={'Hledat…'}
              className="w-full pl-8 pr-3 py-1.5 text-[12px] border border-gray-200 rounded-lg bg-gray-50 focus:bg-white focus:border-[#001161] outline-none transition-all" />
          </div>
        </div>

        <button onClick={handleNewRecord}
          className={`mx-3 mt-2 mb-1 flex items-center gap-2 px-3 py-2 rounded-xl border-2 border-dashed text-[12px] font-bold transition-colors ${isNew ? 'border-purple-400 bg-purple-50 text-purple-700' : 'border-gray-200 text-gray-400 hover:border-purple-300 hover:text-purple-600 hover:bg-purple-50'}`}>
          <Plus className="w-3.5 h-3.5" />
          {'Nový záznam webináře'}
        </button>

        <div className="flex-1 overflow-y-auto">
          {loadingList ? (
            <div className="flex justify-center p-8"><Loader2 className="w-5 h-5 text-gray-300 animate-spin" /></div>
          ) : filtered.length === 0 ? (
            <div className="p-6 text-center space-y-2">
              <Clock className="w-8 h-8 text-gray-200 mx-auto mb-2" />
              {items.length > 0 && searchTrim ? (
                <>
                  <div className="text-[12px] text-gray-500">
                    {'Žádný výsledek pro „'}
                    <span className="font-semibold text-[#001161]">{searchTrim}</span>
                    {'“. Zkuste jiný dotaz nebo '}
                    <button
                      type="button"
                      onClick={() => setSearch('')}
                      className="text-[#7C3AED] font-semibold underline underline-offset-2"
                    >
                      {'vymazat hledání'}
                    </button>
                    .
                  </div>
                </>
              ) : (
                <div className="text-[12px] text-gray-400">{'Žádné minulé webináře'}</div>
              )}
            </div>
          ) : filtered.map(item => {
            const isSel     = !isNew && selected?.id === item.id;
            const dvpp      = matchDvppVideo(item, dvppVideos);
            const hasVideo  = !!(item.recordingUrl || item.youtubeUrl || dvpp?.youtubeUrl);
            const hasCert   = !!(
              item.certificateUrl || dvpp?.certificateUrl ||
              item.certificateLinkMode === 'survey' || dvpp?.certificateLinkMode === 'survey'
            );
            const hasPrepis = !!item.prepis;
            const st        = ragStatus[item.id];
            return (
              <button key={item.id} onClick={() => handleSelect(item)}
                className={`w-full text-left px-3 py-3 border-b border-gray-50 flex items-start gap-2.5 transition-all ${isSel ? 'bg-[#001161]' : 'hover:bg-gray-50'}`}>
                {item.coverImage || dvpp?.thumbnail ? (
                  <img src={item.coverImage || dvpp?.thumbnail} className="w-9 h-9 rounded-lg object-cover shrink-0 border border-gray-100" alt="" />
                ) : (
                  <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                    <Radio className="w-4 h-4 text-gray-300" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className={`text-[12px] font-semibold leading-snug line-clamp-2 ${isSel ? 'text-white' : 'text-[#001161]'}`}>
                    {item.title || 'Bez názvu'}
                  </div>
                  <div className={`text-[10px] font-mono mt-0.5 ${isSel ? 'text-blue-200' : 'text-gray-400'}`}>
                    {item.day}. {item.monthName} {item.year}
                  </div>
                  <div className="flex items-center gap-1 mt-1 flex-wrap">
                    {dvpp && (
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-0.5 ${isSel ? 'bg-emerald-800 text-emerald-200' : 'bg-emerald-50 text-emerald-600'}`}>
                        <Link className="w-2 h-2" /> DVPP
                      </span>
                    )}
                    {hasVideo && (
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-0.5 ${isSel ? 'bg-red-800 text-red-200' : 'bg-red-50 text-red-500'}`}>
                        <Play className="w-2 h-2" /> {'Záznam'}
                      </span>
                    )}
                    {hasCert && (
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-0.5 ${isSel ? 'bg-blue-800 text-blue-200' : 'bg-blue-50 text-blue-500'}`}>
                        <Award className="w-2 h-2" /> Cert.
                      </span>
                    )}
                    {hasPrepis && (
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-0.5 ${isSel ? 'bg-purple-800 text-purple-200' : 'bg-purple-50 text-purple-500'}`}>
                        <FileText className="w-2 h-2" /> {'Přepis'}
                      </span>
                    )}
                    {st && st.count > 0 && (
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-0.5 ${isSel ? 'bg-amber-800 text-amber-200' : 'bg-amber-50 text-amber-600'}`}>
                        <Brain className="w-2 h-2" /> RAG {st.count}
                      </span>
                    )}
                  </div>
                </div>
                {isSel && <ChevronRight className="w-3.5 h-3.5 text-blue-300 shrink-0 mt-0.5" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── RIGHT PANEL ─────────────────────────────────────── */}
      {(selected || isNew) ? (
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-[860px] mx-auto p-6 space-y-4">

            {/* Header */}
            <div className="bg-white rounded-2xl border border-gray-200 p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-4">
                  {form.coverImage && (
                    <img src={form.coverImage} className="w-14 h-14 rounded-xl object-cover border border-gray-100 shrink-0" alt="" />
                  )}
                  <div>
                    <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-1">
                      {isNew ? '✦ Nový záznam webináře' : 'Editace záznamu'}
                    </div>
                    <h2 className="font-bold text-[18px] text-[#001161] leading-tight">
                      {form.title || (isNew ? 'Nový webinář' : 'Bez názvu')}
                    </h2>
                    {!isNew && selected && (
                      <div className="text-[12px] text-gray-500 mt-1">
                        {selected.day}. {selected.monthName} {selected.year}
                        {selected.lecturer && ` · ${selected.lecturer}`}
                      </div>
                    )}
                    {!isNew && (
                      <div className="flex items-center gap-1.5 mt-2">
                        {matchedDvpp ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <Link className="w-2.5 h-2.5" />
                            {'DVPP video napárováno: '}{(matchedDvpp.name || '').slice(0, 28)}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 border border-amber-200">
                            <Unlink className="w-2.5 h-2.5" />
                            {'Bez DVPP záznamu — uložením vytvoříte nový'}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap items-center justify-end gap-2 shrink-0">
                  {isNew && (
                    <button onClick={() => setIsNew(false)}
                      className="flex items-center gap-1.5 border border-gray-200 text-gray-500 px-3 py-2 rounded-xl text-[12px] font-bold hover:bg-gray-50 transition-colors">
                      <X className="w-3.5 h-3.5" /> {'Zrušit'}
                    </button>
                  )}
                  {!isNew && selected?.id ? (
                    <button
                      type="button"
                      onClick={() => void handleBulkPostFollowupSend()}
                      disabled={
                        bulkFollowupSending ||
                        regCountLoading ||
                        followupPreviewLoading ||
                        ((followupPreview?.uniqueTotal ?? regCount ?? 0) <= 0)
                      }
                      className="flex items-center gap-1.5 border border-[#001161]/15 bg-[#001161]/[0.04] text-[#001161] px-3 py-2 rounded-xl text-[12px] font-bold hover:bg-[#001161]/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                      title={
                        followupPreview
                          ? `Unikátní příjemci: ${followupPreview.uniqueTotal} (web ${followupPreview.kvCount}, Mailchimp ${followupPreview.mailchimpCount}${followupPreview.mailchimpTag ? ` · tag „${followupPreview.mailchimpTag}“` : ''})`
                          : 'Stejný obsah jako u testovacího e-mailu v záložce Dotazník — KV + Mailchimp se stejným tagem jako při registraci'
                      }
                    >
                      {bulkFollowupSending ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                      ) : (
                        <Users className="w-3.5 h-3.5 shrink-0" />
                      )}
                      <span className="whitespace-nowrap">
                        {'Odeslat záznam + dotazník ('}
                        {followupPreviewLoading || regCountLoading
                          ? '…'
                          : followupPreview?.uniqueTotal ?? regCount ?? 0}
                        {')'}
                      </span>
                    </button>
                  ) : null}
                  <button onClick={handleSave} disabled={saving}
                    className="flex items-center gap-1.5 bg-[#7C3AED] hover:bg-purple-700 disabled:opacity-50 text-white px-4 py-2 rounded-xl text-[13px] font-bold transition-colors">
                    {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                    {saving ? 'Ukládám…' : isNew ? 'Vytvořit' : 'Uložit'}
                  </button>
                </div>
              </div>

              {!isNew && selected?.id ? (
                <details className="group mt-4 pt-4 border-t border-gray-100">
                  <summary className="flex cursor-pointer list-none items-center gap-2 text-[12px] font-bold text-[#001161] hover:text-[#001161]/80 [&::-webkit-details-marker]:hidden">
                    <ChevronDown className="h-4 w-4 shrink-0 text-[#001161]/50 transition-transform group-open:rotate-180" />
                    <Users className="h-3.5 w-3.5 shrink-0 text-[#001161]/40" />
                    {'Registrace na webu (KV)'}
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-bold tabular-nums text-gray-600">
                      {regCountLoading ? '…' : registrants.length}
                    </span>
                  </summary>
                  <div className="mt-3 overflow-x-auto rounded-xl border border-gray-100 bg-gray-50/50">
                    {regCountLoading ? (
                      <div className="flex items-center justify-center gap-2 py-8 text-[12px] text-gray-400">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        {'Načítám…'}
                      </div>
                    ) : registrants.length === 0 ? (
                      <p className="px-4 py-6 text-center text-[12px] text-gray-400">{'Zatím žádné registrace.'}</p>
                    ) : (
                      <table className="w-full min-w-[520px] text-left text-[11px]">
                        <thead>
                          <tr className="border-b border-gray-200 bg-white">
                            <th className="px-3 py-2 font-bold text-gray-500">Jméno</th>
                            <th className="px-3 py-2 font-bold text-gray-500">E-mail</th>
                            <th className="px-3 py-2 font-bold text-gray-500">Pozice</th>
                            <th className="px-3 py-2 font-bold text-gray-500">Telefon</th>
                            <th className="px-3 py-2 font-bold text-gray-500 whitespace-nowrap">Registrace</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {registrants.map((r, i) => (
                            <tr key={`${r.email || i}-${i}`} className="bg-white/80 hover:bg-white">
                              <td className="px-3 py-2 text-[#001161] font-medium">{r.name?.trim() || '—'}</td>
                              <td className="px-3 py-2 font-mono text-[10px] text-gray-700">{r.email?.trim() || '—'}</td>
                              <td className="px-3 py-2 text-gray-600">{r.position?.trim() || '—'}</td>
                              <td className="px-3 py-2 text-gray-600 font-mono text-[10px]">{r.phone?.trim() || '—'}</td>
                              <td className="px-3 py-2 whitespace-nowrap text-gray-500">
                                {r.registeredAt
                                  ? new Date(r.registeredAt).toLocaleString('cs-CZ', {
                                      day: 'numeric',
                                      month: 'numeric',
                                      year: 'numeric',
                                      hour: '2-digit',
                                      minute: '2-digit',
                                    })
                                  : '—'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </details>
              ) : null}

              {!isNew && selected?.id ? (
                <details className="group mt-3 pt-3 border-t border-gray-100">
                  <summary className="flex cursor-pointer list-none items-center gap-2 text-[12px] font-bold text-[#001161] hover:text-[#001161]/80 [&::-webkit-details-marker]:hidden">
                    <ChevronDown className="h-4 w-4 shrink-0 text-[#001161]/50 transition-transform group-open:rotate-180" />
                    <Mail className="h-3.5 w-3.5 shrink-0 text-[#FFE01B]" />
                    {'Mailchimp (stejný tag jako u odeslání)'}
                    <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-bold tabular-nums text-amber-900 border border-amber-200/80">
                      {mcListState.loading ? '…' : mcListState.rows.length}
                    </span>
                  </summary>
                  <div className="mt-2 space-y-2">
                    {mcListState.tag && (
                      <p className="text-[11px] text-gray-500 leading-snug px-0.5">
                        {'Tag v audience: '}
                        <span className="font-mono font-bold text-[#001161]">{mcListState.tag}</span>
                        {' — kontakty, které mají v Mailchimpu tento tag (včetně těch z registrace na webu).'}
                      </p>
                    )}
                    {mcListState.error && (
                      <p className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                        {mcListState.error}
                      </p>
                    )}
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        disabled={mcListState.loading || !!mcListState.error || mcListState.rows.length === 0}
                        onClick={() => {
                          if (!selected?.id) return;
                          void (async () => {
                            try {
                              const res = await fetch(
                                `${SERVER}/admin/registrace/mailchimp-csv/${encodeURIComponent(String(selected.id))}`,
                                { headers: { Authorization: `Bearer ${publicAnonKey}` } },
                              );
                              const raw = await res.text();
                              if (!res.ok) {
                                const err = (parseJsonResponseBody(raw) as { error?: string })?.error || raw.slice(0, 220);
                                toast.error(err);
                                return;
                              }
                              const blob = new Blob([raw], { type: 'text/csv;charset=utf-8' });
                              const url = URL.createObjectURL(blob);
                              const a = document.createElement('a');
                              a.href = url;
                              a.download = `mailchimp-${String(selected.slug || selected.id).replace(/[^a-z0-9]+/gi, '-').slice(0, 80)}.csv`;
                              a.click();
                              URL.revokeObjectURL(url);
                              toast.success('CSV staženo');
                            } catch (e: unknown) {
                              toast.error(e instanceof Error ? e.message : 'Chyba');
                            }
                          })();
                        }}
                        className="text-[11px] font-bold text-[#001161] border border-[#001161]/20 rounded-lg px-2.5 py-1 hover:bg-[#001161]/5 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        {'Stáhnout CSV z Mailchimp'}
                      </button>
                    </div>
                    <div className="overflow-x-auto rounded-xl border border-amber-100 bg-amber-50/30">
                      {mcListState.loading ? (
                        <div className="flex items-center justify-center gap-2 py-8 text-[12px] text-gray-400">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          {'Načítám Mailchimp…'}
                        </div>
                      ) : mcListState.error && mcListState.rows.length === 0 ? (
                        <p className="px-4 py-6 text-center text-[12px] text-gray-400">
                          {'Tabulku nelze zobrazit — vyřešte chybu výše nebo zkontrolujte MAILCHIMP_API_KEY a audience.'}
                        </p>
                      ) : mcListState.rows.length === 0 ? (
                        <p className="px-4 py-6 text-center text-[12px] text-gray-400">
                          {'Žádné kontakty s tímto tagem v Mailchimpu (nebo tag v audience neexistuje).'}
                        </p>
                      ) : (
                        <table className="w-full min-w-[560px] text-left text-[11px]">
                          <thead>
                            <tr className="border-b border-amber-200/80 bg-white">
                              <th className="px-3 py-2 font-bold text-gray-500">Jméno</th>
                              <th className="px-3 py-2 font-bold text-gray-500">E-mail</th>
                              <th className="px-3 py-2 font-bold text-gray-500">Telefon</th>
                              <th className="px-3 py-2 font-bold text-gray-500">Škola / org.</th>
                              <th className="px-3 py-2 font-bold text-gray-500">Stav</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-amber-100">
                            {mcListState.rows.map((r, i) => (
                              <tr key={`${r.email}-${i}`} className="bg-white/80 hover:bg-white">
                                <td className="px-3 py-2 text-[#001161] font-medium">
                                  {[r.firstName, r.lastName].filter(Boolean).join(' ') || '—'}
                                </td>
                                <td className="px-3 py-2 font-mono text-[10px] text-gray-700">{r.email || '—'}</td>
                                <td className="px-3 py-2 text-gray-600 font-mono text-[10px]">{r.phone?.trim() || '—'}</td>
                                <td className="px-3 py-2 text-gray-600 max-w-[200px] truncate" title={r.school}>
                                  {r.school?.trim() || '—'}
                                </td>
                                <td className="px-3 py-2 text-gray-500 whitespace-nowrap">{r.status || '—'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  </div>
                </details>
              ) : null}
            </div>

            {!isNew && selected && (
              <div className="flex gap-1 p-1 bg-gray-100/90 rounded-xl border border-gray-200/80">
                <button
                  type="button"
                  onClick={() => setPastPanelTab('uprava')}
                  className={`flex-1 px-3 py-2 rounded-lg text-[12px] font-bold transition-colors ${
                    pastPanelTab === 'uprava'
                      ? 'bg-white text-[#001161] shadow-sm border border-gray-200'
                      : 'text-gray-500 hover:text-[#001161] hover:bg-white/60'
                  }`}
                >
                  {'Úprava záznamu'}
                </button>
                <button
                  type="button"
                  onClick={() => setPastPanelTab('dotaznik')}
                  className={`flex-1 px-3 py-2 rounded-lg text-[12px] font-bold transition-colors ${
                    pastPanelTab === 'dotaznik'
                      ? 'bg-white text-[#001161] shadow-sm border border-gray-200'
                      : 'text-gray-500 hover:text-[#001161] hover:bg-white/60'
                  }`}
                >
                  {'Dotazník'}
                </button>
              </div>
            )}

            {(isNew || pastPanelTab === 'uprava') && (
            <>
            {/* ── ZÁZNAM (YouTube) ── */}
            <Section
              icon={<Play className="w-4 h-4" />}
              title={'Záznam webináře'}
              subtitle={'YouTube URL videa'}
              color="#ef4444" bgColor="#FEF2F2"
              badge={form.recordingUrl
                ? <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-red-50 text-red-600 flex items-center gap-0.5"><CheckCircle2 className="w-2.5 h-2.5" /> Nastaven</span>
                : <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-400">Prázdný</span>
              }
            >
              <Field
                label={'YouTube URL záznamu'}
                hint={'Video se zobrazí na veřejné stránce webináře jako záznam.'}
              >
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={form.recordingUrl}
                    onChange={e => upd({ recordingUrl: e.target.value })}
                    placeholder={'https://www.youtube.com/watch?v=…'}
                    className={inputCls + ' flex-1 font-mono text-[12px]'}
                  />
                  {form.recordingUrl && videoId && (
                    <a href={form.recordingUrl} target="_blank" rel="noopener noreferrer"
                      className="flex items-center px-3 py-2 bg-red-50 border border-red-200 text-red-600 rounded-xl hover:bg-red-100 transition-colors">
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                  {form.recordingUrl && (
                    <button onClick={() => upd({ recordingUrl: '' })}
                      className="flex items-center px-2 py-2 border border-gray-200 text-gray-400 rounded-xl hover:bg-red-50 hover:text-red-400 transition-colors">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </Field>

              {videoId ? (
                <div className="rounded-xl overflow-hidden border border-gray-100 bg-black" style={{ aspectRatio: '16/9' }}>
                  <iframe
                    src={`https://www.youtube.com/embed/${videoId}`}
                    title={'Náhled záznamu'}
                    className="w-full h-full"
                    frameBorder="0"
                    allowFullScreen
                  />
                </div>
              ) : form.recordingUrl && !videoId ? (
                <div className="rounded-xl border-2 border-dashed border-red-200 bg-red-50 p-4 flex items-center gap-3">
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                  <span className="text-[12px] text-red-600">{'Neplatná YouTube URL — zkontroluj odkaz'}</span>
                </div>
              ) : (
                <div className="rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 p-6 flex flex-col items-center justify-center gap-2">
                  <Video className="w-8 h-8 text-gray-300" />
                  <span className="text-[12px] text-gray-400">{'Vlož YouTube URL záznamu výše'}</span>
                </div>
              )}
            </Section>

            {/* ── TLAČÍTKA ── */}
            <Section
              icon={<Link2 className="w-4 h-4" />}
              title={'Tlačítka a odkazy'}
              subtitle={'Certifikát DVPP · CTA tlačítko'}
              color="#0ea5e9" bgColor="#F0F9FF"
              badge={
                (form.certificateLinkMode === 'survey' || form.certificateUrl || form.orangeButtonLink)
                  ? <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-600 flex items-center gap-0.5"><CheckCircle2 className="w-2.5 h-2.5" /> Nastavena</span>
                  : <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-400">Prázdná</span>
              }
            >
              {/* Certifikát DVPP */}
              <div className="rounded-xl bg-gray-50 border border-gray-200 p-4 space-y-3">
                <div className="flex items-center gap-2 mb-1">
                  <Award className="w-4 h-4 text-gray-600" />
                  <span className="text-[12px] font-bold text-gray-700 uppercase tracking-wide">{'Certifikát DVPP (šedé tlačítko)'}</span>
                </div>
                <div className="flex flex-col gap-2">
                  <span className="text-[11px] font-semibold text-gray-600">{'Způsob certifikátu'}</span>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => upd({ certificateLinkMode: 'external' })}
                      className={`px-3 py-2 rounded-xl text-[12px] font-bold border transition-colors ${
                        form.certificateLinkMode === 'external'
                          ? 'bg-white border-[#001161] text-[#001161] shadow-sm'
                          : 'bg-white/60 border-gray-200 text-gray-500 hover:border-gray-300'
                      }`}
                    >
                      {'Externí odkaz'}
                    </button>
                    <button
                      type="button"
                      onClick={() => upd({ certificateLinkMode: 'survey' })}
                      className={`px-3 py-2 rounded-xl text-[12px] font-bold border transition-colors ${
                        form.certificateLinkMode === 'survey'
                          ? 'bg-white border-[#001161] text-[#001161] shadow-sm'
                          : 'bg-white/60 border-gray-200 text-gray-500 hover:border-gray-300'
                      }`}
                    >
                      {'Dotazník v administraci'}
                    </button>
                  </div>
                  <p className="text-[11px] text-gray-500 leading-snug">
                    {form.certificateLinkMode === 'external'
                      ? 'Vlastní URL (Google Form, Typeform…) — odkaz se použije v e-mailu a na stránce záznamu.'
                      : 'Odkaz povede na stránku DVPP dotazníku na webu (`/webinar/…/dvpp-dotaznik`). Otázky nastavíte v záložce Dotazník.'}
                  </p>
                </div>
                {form.certificateLinkMode === 'external' ? (
                  <Field
                    label={'URL certifikátu'}
                    hint={'Odkaz na formulář pro vyžádání certifikátu (Google Form, Typeform…)'}
                  >
                    <div className="flex gap-2">
                      <input
                        type="url"
                        value={form.certificateUrl}
                        onChange={e => upd({ certificateUrl: e.target.value })}
                        placeholder={'https://forms.google.com/…'}
                        className={inputCls + ' flex-1 font-mono text-[12px]'}
                      />
                      {form.certificateUrl && (
                        <>
                          <a href={form.certificateUrl} target="_blank" rel="noopener noreferrer"
                            className="flex items-center px-3 py-2 bg-blue-50 border border-blue-200 text-blue-600 rounded-xl hover:bg-blue-100 transition-colors">
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                          <button type="button" onClick={() => upd({ certificateUrl: '' })}
                            className="flex items-center px-2 py-2 border border-gray-200 text-gray-400 rounded-xl hover:bg-red-50 hover:text-red-400 transition-colors">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </Field>
                ) : null}
                <Field label={'Text tlačítka'}>
                  <input
                    value={form.greyButtonText}
                    onChange={e => upd({ greyButtonText: e.target.value })}
                    placeholder={'Certifikát DVPP'}
                    className={inputCls}
                  />
                </Field>
              </div>

              {/* CTA button */}
              <div className="rounded-xl bg-purple-50 border border-purple-200 p-4 space-y-3">
                <div className="flex items-center gap-2 mb-1">
                  <Zap className="w-4 h-4 text-purple-600" />
                  <span className="text-[12px] font-bold text-purple-700 uppercase tracking-wide">{'CTA tlačítko (fialové) — Vyzkoušejte'}</span>
                </div>
                <Field label={'Text tlačítka'}>
                  <input
                    value={form.orangeButtonText}
                    onChange={e => upd({ orangeButtonText: e.target.value })}
                    placeholder={'Vyzkoušejte zdarma'}
                    className={inputCls}
                  />
                </Field>
                <Field label={'Odkaz'}>
                  <input
                    value={form.orangeButtonLink}
                    onChange={e => upd({ orangeButtonLink: e.target.value })}
                    placeholder={'/vyzkousejte'}
                    className={inputCls + ' font-mono text-[12px]'}
                  />
                </Field>
              </div>
            </Section>

            {/* ── ZÁKLADNÍ INFORMACE ── */}
            <Section
              icon={<FileText className="w-4 h-4" />}
              title={'Základní informace'}
              subtitle={'Název, datum, přednášející'}
              defaultOpen={false}
            >
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Field label={'Název webináře *'}>
                    <input value={form.title} onChange={e => upd({ title: e.target.value })}
                      placeholder={'Jak na zlomky ve Vividbooks Matematice'} className={inputCls} />
                  </Field>
                </div>
                <div className="col-span-2">
                  <Field label={'Podtitulek'}>
                    <input value={form.subtitle} onChange={e => upd({ subtitle: e.target.value })}
                      placeholder={'ve Vividbooks Matematice.'} className={inputCls} />
                  </Field>
                </div>
                <Field label={'Den'}>
                  <input type="number" min={1} max={31} value={form.day}
                    onChange={e => upd({ day: Number(e.target.value) })} className={inputCls} />
                </Field>
                <Field label={'Měsíc'}>
                  <select value={form.monthNum} onChange={e => upd({ monthNum: Number(e.target.value) })} className={inputCls}>
                    {MONTH_NAMES.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
                  </select>
                </Field>
                <Field label={'Rok'}>
                  <input type="number" min={2020} max={2099} value={form.year}
                    onChange={e => upd({ year: Number(e.target.value) })} className={inputCls} />
                </Field>
                <Field label={'Čas'}>
                  <input value={form.time} onChange={e => upd({ time: e.target.value })}
                    placeholder={'18:00'} className={inputCls} />
                </Field>
                <div className="col-span-2">
                  <Field label={'Přednášející'}>
                    <input value={form.lecturer} onChange={e => upd({ lecturer: e.target.value })}
                      placeholder={'František Cáb'} className={inputCls} />
                  </Field>
                </div>
                <div className="col-span-2">
                  <Field label={'Cílová skupina'}>
                    <input value={form.targetAudience} onChange={e => upd({ targetAudience: e.target.value })}
                      placeholder={'Pro učitele matematiky'} className={inputCls} />
                  </Field>
                </div>
                <div className="col-span-2">
                  <Field label={'URL obrázku (cover)'}>
                    <div className="flex gap-2">
                      <input value={form.coverImage} onChange={e => upd({ coverImage: e.target.value })}
                        placeholder={'https://…'} className={inputCls + ' flex-1'} />
                      {form.coverImage && (
                        <img src={form.coverImage} alt="" className="w-10 h-10 rounded-lg object-cover border border-gray-200 shrink-0" />
                      )}
                    </div>
                  </Field>
                </div>
                <div className="col-span-2">
                  <Field label={'Popis webináře'}>
                    <textarea value={form.description} onChange={e => upd({ description: e.target.value })} rows={3}
                      placeholder={'Popiš, co se účastníci dozví…'} className={textareaCls} />
                  </Field>
                </div>
                <div className="col-span-2">
                  <Field label={'Perky / co získá účastník'}>
                    <textarea value={form.perks} onChange={e => upd({ perks: e.target.value })} rows={2}
                      placeholder={'Účastníci webináře získají…'} className={textareaCls} />
                  </Field>
                </div>
              </div>
            </Section>

            {/* ── PŘEPIS ── */}
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-purple-50 flex items-center justify-center">
                    <FileText className="w-4 h-4 text-purple-500" />
                  </div>
                  <div>
                    <h3 className="text-[13px] font-bold text-gray-700 uppercase tracking-wide">{'Přepis webináře'}</h3>
                    <p className="text-[11px] text-gray-400 mt-0.5">{'Textový přepis — pro RAG indexaci'}</p>
                  </div>
                </div>
                {form.prepis && (
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-gray-400 font-mono">
                      {form.prepis.length.toLocaleString('cs-CZ')} zn.
                    </span>
                    <button onClick={() => upd({ prepis: '' })}
                      className="p-1.5 text-gray-300 hover:text-red-400 hover:bg-red-50 rounded-lg transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
              <textarea
                value={form.prepis}
                onChange={e => upd({ prepis: e.target.value })}
                placeholder={'Vložte sem přepis webináře…\n\nTip: YouTube → Titulky → Zobrazit přepis'}
                rows={12}
                className="w-full px-5 py-4 text-[13px] text-[#001161] leading-relaxed resize-none outline-none border-0 focus:ring-0"
                style={{ fontFamily: "'Fenomen Sans', sans-serif" }}
              />
              {form.prepis && (
                <div className="border-t border-gray-100 px-5 py-3 bg-gray-50 flex items-center justify-between text-[11px] text-gray-400">
                  <span>{'~'}{Math.ceil(form.prepis.length / 1600)}{' chunků po indexaci'}</span>
                  <span>gemini-embedding-001 · 3072 dim.</span>
                </div>
              )}
            </div>

            {/* ── RAG INDEXACE ── */}
            {!isNew && selected && (
              <div className="bg-white rounded-2xl border border-gray-200 p-5">
                <div className="flex items-center gap-2.5 mb-4">
                  <div className="w-7 h-7 rounded-lg bg-amber-50 flex items-center justify-center">
                    <Brain className="w-4 h-4 text-amber-500" />
                  </div>
                  <div>
                    <h3 className="text-[13px] font-bold text-gray-700 uppercase tracking-wide">RAG Indexace</h3>
                    <p className="text-[11px] text-gray-400 mt-0.5">{'Přepis se embeduje do znalostní báze'}</p>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3 mb-4">
                  {[
                    { label: 'Chunků v RAG',       val: status?.loading ? null : (status?.count ?? 0) },
                    { label: 'Chunků po indexaci',  val: form.prepis ? Math.ceil(form.prepis.length / 1600) : 0 },
                    { label: 'Znaků přepisu',       val: form.prepis ? form.prepis.length.toLocaleString('cs-CZ') : '—' },
                  ].map(s => (
                    <div key={s.label} className="bg-gray-50 rounded-xl p-3 text-center">
                      <div className="text-[18px] font-bold text-[#001161]" style={{ fontFamily: "'Cooper Light', serif" }}>
                        {s.val === null ? <Loader2 className="w-4 h-4 animate-spin mx-auto text-gray-400" /> : s.val}
                      </div>
                      <div className="text-[10px] text-gray-400 mt-0.5">{s.label}</div>
                    </div>
                  ))}
                </div>

                {status && status.count > 0 && (
                  <div className="flex items-center gap-2 px-3 py-2.5 bg-emerald-50 border border-emerald-200 rounded-xl mb-4">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span className="text-[12px] text-emerald-700 font-bold">
                      {`Indexováno — ${status.count} chunků v RAG`}
                      {status.lastIndexed && ` · naposledy ${status.lastIndexed}`}
                    </span>
                  </div>
                )}

                {!form.prepis && (
                  <div className="flex items-center gap-2 px-3 py-2.5 bg-amber-50 border border-amber-200 rounded-xl mb-4">
                    <Info className="w-4 h-4 text-amber-500 shrink-0" />
                    <span className="text-[12px] text-amber-700">{'Nejdříve vyplň přepis výše. Po indexaci se uloží do záznamu webináře.'}</span>
                  </div>
                )}

                <div className="flex flex-col sm:flex-row gap-2">
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={saving}
                    className="flex-1 flex items-center justify-center gap-2 py-3 border-2 border-[#7C3AED] bg-white text-[#7C3AED] hover:bg-purple-50 disabled:opacity-40 rounded-xl text-[14px] font-bold transition-colors"
                  >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    {saving ? 'Ukládám…' : 'Uložit'}
                  </button>
                  <button
                    type="button"
                    onClick={handleIndexRag}
                    disabled={!form.prepis.trim() || !!indexing}
                    className="flex-1 flex items-center justify-center gap-2 py-3 bg-amber-500 hover:bg-amber-600 disabled:opacity-40 text-white rounded-xl text-[14px] font-bold transition-colors"
                  >
                    {indexing === selected?.id
                      ? <><Loader2 className="w-4 h-4 animate-spin" />{'Indexuji přepis do RAG…'}</>
                      : <><Brain className="w-4 h-4" />{'Indexovat přepis do RAG'}</>
                    }
                  </button>
                </div>

                <p className="mt-3 text-[11px] text-gray-400 text-center leading-relaxed">
                  {'„Uložit“ zapíše přepis do záznamu webináře. „Indexovat“ navíc uloží embeddingy do RAG ('}
                  <code className="text-[10px] bg-gray-100 px-1 rounded">rag_chunks</code>
                  {').'}
                </p>
              </div>
            )}
            </>
            )}

            {!isNew && selected && pastPanelTab === 'dotaznik' && (
              <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                  <div className="flex items-start gap-2.5 min-w-0">
                    <div className="w-7 h-7 rounded-lg bg-purple-50 flex items-center justify-center shrink-0">
                      <ClipboardList className="w-4 h-4 text-purple-500" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-[13px] font-bold text-gray-700 uppercase tracking-wide">{'Dotazník (DVPP)'}</h3>
                      <p className="text-[11px] text-gray-400 mt-0.5">
                        {'Čtyři otázky s výběrem odpovědí podle přepisu — ověření pochopení tématu po webináři.'}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleSave()}
                    disabled={saving || generatingDvppQuestions || generatingDvppLearnings}
                    className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-[#7C3AED] hover:bg-purple-700 disabled:opacity-40 text-white px-4 py-2.5 text-[13px] font-bold transition-colors shadow-sm"
                  >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    {saving ? 'Ukládám…' : 'Uložit'}
                  </button>
                </div>

                <div className="rounded-xl border border-amber-200 bg-amber-50/80 px-3 py-2.5 text-[12px] text-amber-900/90 leading-snug">
                  {'Generování mění jen obsah v tomto okně — po úpravách klikněte '}
                  <strong>{'Uložit'}</strong>
                  {', jinak se po obnovení stránky ztratí.'}
                </div>

                {!form.prepis.trim() && (
                  <div className="flex items-center gap-2 px-3 py-2.5 bg-amber-50 border border-amber-200 rounded-xl">
                    <Info className="w-4 h-4 text-amber-500 shrink-0" />
                    <span className="text-[12px] text-amber-700">
                      {'V záložce „Úprava záznamu“ vložte přepis webináře, pak sem přepněte a klikněte na Generovat.'}
                    </span>
                  </div>
                )}

                <div className="flex flex-col sm:flex-row gap-2">
                  <button
                    type="button"
                    onClick={() => void callDvppGenerate('questions')}
                    disabled={generatingDvppQuestions || generatingDvppLearnings || !form.prepis.trim()}
                    className="flex-1 flex items-center justify-center gap-2 py-3 bg-[#7C3AED] hover:bg-purple-700 disabled:opacity-40 text-white rounded-xl text-[14px] font-bold transition-colors"
                  >
                    {generatingDvppQuestions ? (
                      <><Loader2 className="w-4 h-4 animate-spin" />{'Generuji otázky…'}</>
                    ) : (
                      <><Sparkles className="w-4 h-4" />{'Generovat otázky z přepisu'}</>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => void callDvppGenerate('learnings')}
                    disabled={generatingDvppQuestions || generatingDvppLearnings || !form.prepis.trim()}
                    className="flex-1 flex items-center justify-center gap-2 py-3 bg-[#001161] hover:opacity-95 disabled:opacity-40 text-white rounded-xl text-[14px] font-bold transition-colors"
                  >
                    {generatingDvppLearnings ? (
                      <><Loader2 className="w-4 h-4 animate-spin" />{'Generuji článek…'}</>
                    ) : (
                      <><BookOpen className="w-4 h-4" />{'Generovat článek z přepisu'}</>
                    )}
                  </button>
                </div>
                <p className="text-[11px] text-gray-400 text-center leading-relaxed">
                  {'Každé tlačítko volá Gemini zvlášť — můžete generovat jen otázky, jen článek, nebo postupně obojí.'}
                </p>

                <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-[#7C3AED] shrink-0" />
                    <span className="text-[12px] font-bold text-[#001161]">{'Co jsme se na webináři dozvěděli (do e-mailu)'}</span>
                  </div>
                  <p className="text-[11px] text-gray-500 leading-relaxed">
                    {'Dlouhý text z přepisu — stejný obsah můžete použít v Mailchimp nebo v follow-up e-mailu. Upravujte přímo v náhledu (formátování jako v editoru).'}
                  </p>
                  <WebinarLearningsRichEditor
                    key={`${selected?.id ?? 'new'}-${learningsRemountKey}`}
                    value={form.postWebinarLearningsHtml}
                    onChange={(html) => upd({ postWebinarLearningsHtml: html })}
                  />
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={handleCopyLearningsBlock}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 text-[12px] font-bold text-gray-700 hover:bg-gray-50"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      {'Kopírovat blok pro e-mail'}
                    </button>
                  </div>
                </div>

                <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50/80 p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-gray-600 shrink-0" />
                    <span className="text-[12px] font-bold text-gray-700">{'Test e-mailu (Mandrill)'}</span>
                  </div>
                  <p className="text-[11px] text-gray-500">
                    {
                      'Odešle náhled: shrnutí, seznam otázek kvízu a odkaz „Otevřít kvíz a dotazník“ (stejný jako po registraci). Vyžaduje MANDRILL_API_KEY na serveru.'
                    }
                  </p>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="email"
                      value={followupTestEmail}
                      onChange={(e) => setFollowupTestEmail(e.target.value)}
                      placeholder="vas@email.cz"
                      className={`${inputCls} flex-1`}
                    />
                    <button
                      type="button"
                      onClick={() => void handlePostFollowupTestSend()}
                      disabled={followupSending}
                      className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-[#001161] text-white text-[13px] font-bold hover:opacity-95 disabled:opacity-40"
                    >
                      {followupSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
                      {'Odeslat test'}
                    </button>
                  </div>
                </div>

                {form.postWebinarQuizQuestions.length > 0 && (
                  <div className="space-y-4">
                    {form.postWebinarQuizQuestions.map((q, qi) => (
                      <div key={q.id} className="rounded-xl border border-gray-200 p-4 space-y-3 bg-gray-50/80">
                        <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-1">
                          {`Otázka ${qi + 1}`}
                        </div>
                        <label className="block">
                          <span className="sr-only">Text otázky</span>
                          <textarea
                            value={q.label}
                            onChange={(e) => updateQuizQuestion(qi, { label: e.target.value })}
                            rows={2}
                            className={textareaCls + ' w-full bg-white'}
                          />
                        </label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {q.options.map((opt, oi) => (
                            <label key={oi} className="block text-[11px] font-semibold text-gray-500">
                              {`Možnost ${oi + 1}`}
                              <input
                                type="text"
                                value={opt}
                                onChange={(e) => updateQuizOption(qi, oi, e.target.value)}
                                className={`${inputCls} mt-1 w-full bg-white`}
                              />
                            </label>
                          ))}
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[11px] font-bold text-gray-500">{'Správná odpověď'}</span>
                          <select
                            value={q.correctIndex ?? 0}
                            onChange={(e) =>
                              updateQuizQuestion(qi, { correctIndex: Number(e.target.value) as 0 | 1 | 2 | 3 })
                            }
                            className="text-[13px] border border-gray-200 rounded-lg px-2 py-1.5 bg-white"
                          >
                            {[0, 1, 2, 3].map((i) => (
                              <option key={i} value={i}>{`Možnost ${i + 1}`}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="mt-6 pt-6 border-t border-gray-200 space-y-4">
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex items-start gap-2.5 min-w-0">
                      <div className="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center shrink-0">
                        <MessageSquare className="w-4 h-4 text-emerald-600" />
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-[12px] font-bold text-[#001161]">{'Zpětná vazba (druhá část dotazníku)'}</h4>
                        <p className="text-[11px] text-gray-500 mt-0.5 leading-relaxed">
                          {'Otázky typu „líbilo se“, vyzkoušení Vividbooks apod. — zobrazí se po kvízu DVPP. Výchozí texty jsou předvyplněné; můžete je upravit nebo obnovit standard ze šablony.'}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => upd({ postWebinarPart2: cloneDefaultPart2() })}
                        className="text-[11px] font-bold px-3 py-1.5 rounded-lg border border-emerald-200 text-emerald-800 bg-emerald-50/80 hover:bg-emerald-100/80"
                      >
                        {'Obnovit výchozí otázky'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (form.postWebinarPart2.length === 0) return;
                          if (!confirm('Vypnout druhou část dotazníku u tohoto webináře? (Uložením se uloží prázdný seznam.)')) return;
                          upd({ postWebinarPart2: [] });
                        }}
                        disabled={form.postWebinarPart2.length === 0}
                        className="text-[11px] font-bold px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40"
                      >
                        {'Vypnout sekci'}
                      </button>
                    </div>
                  </div>

                  {form.postWebinarPart2.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50/80 p-5 text-center space-y-2">
                      <p className="text-[12px] text-gray-600">{'Sekce zpětné vazby je u tohoto webináře vypnutá.'}</p>
                      <button
                        type="button"
                        onClick={() => upd({ postWebinarPart2: cloneDefaultPart2() })}
                        className="inline-flex items-center justify-center px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[13px] font-bold"
                      >
                        {'Načíst výchozí otázky'}
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {form.postWebinarPart2.map((step, si) => (
                        <div
                          key={step.id}
                          className="rounded-xl border border-emerald-100 bg-emerald-50/40 p-4 space-y-3"
                        >
                          <div className="text-[10px] font-bold text-emerald-700/80 uppercase tracking-wide">
                            {step.type === 'intro' && 'Úvod'}
                            {step.type === 'open' && 'Otevřená otázka'}
                            {step.type === 'abc' && 'Výběr z možností'}
                            <span className="text-gray-400 font-mono normal-case ml-2">{step.id}</span>
                          </div>
                          {step.type === 'intro' && (
                            <>
                              <label className="block text-[11px] font-bold text-gray-500 mb-1">{'Nadpis'}</label>
                              <input
                                type="text"
                                value={step.title}
                                onChange={(e) =>
                                  replacePart2Step(si, { ...step, title: e.target.value })
                                }
                                className={inputCls}
                              />
                              <label className="block text-[11px] font-bold text-gray-500 mb-1 mt-2">{'Podnadpis (volitelný)'}</label>
                              <input
                                type="text"
                                value={step.subtitle ?? ''}
                                onChange={(e) =>
                                  replacePart2Step(si, {
                                    ...step,
                                    subtitle: e.target.value.trim() ? e.target.value : undefined,
                                  })
                                }
                                className={inputCls}
                              />
                            </>
                          )}
                          {step.type === 'open' && (
                            <>
                              <label className="block text-[11px] font-bold text-gray-500 mb-1">{'Otázka'}</label>
                              <textarea
                                value={step.label}
                                onChange={(e) =>
                                  replacePart2Step(si, { ...step, label: e.target.value })
                                }
                                rows={2}
                                className={textareaCls + ' w-full bg-white'}
                              />
                              <label className="block text-[11px] font-bold text-gray-500 mb-1">{'Doplňující text (volitelný)'}</label>
                              <textarea
                                value={step.sublabel ?? ''}
                                onChange={(e) =>
                                  replacePart2Step(si, {
                                    ...step,
                                    sublabel: e.target.value.trim() ? e.target.value : undefined,
                                  })
                                }
                                rows={2}
                                className={textareaCls + ' w-full bg-white'}
                              />
                              <label className="block text-[11px] font-bold text-gray-500 mb-1">{'Placeholder pole'}</label>
                              <input
                                type="text"
                                value={step.placeholder ?? ''}
                                onChange={(e) =>
                                  replacePart2Step(si, {
                                    ...step,
                                    placeholder: e.target.value.trim() ? e.target.value : undefined,
                                  })
                                }
                                className={inputCls}
                              />
                            </>
                          )}
                          {step.type === 'abc' && (
                            <>
                              <label className="block text-[11px] font-bold text-gray-500 mb-1">{'Otázka'}</label>
                              <textarea
                                value={step.label}
                                onChange={(e) =>
                                  replacePart2Step(si, { ...step, label: e.target.value })
                                }
                                rows={3}
                                className={textareaCls + ' w-full bg-white'}
                              />
                              <div className="space-y-2">
                                <span className="text-[11px] font-bold text-gray-500">{'Možnosti odpovědí'}</span>
                                {step.options.map((opt, oi) => (
                                  <div key={oi} className="flex items-center gap-2">
                                    <span className="text-[10px] font-bold text-gray-400 w-16 shrink-0">{`#${oi + 1}`}</span>
                                    <input
                                      type="text"
                                      value={opt}
                                      onChange={(e) => updatePart2AbcOption(si, oi, e.target.value)}
                                      className={`${inputCls} flex-1 bg-white`}
                                    />
                                  </div>
                                ))}
                              </div>
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {selected?.id ? (
                  <div className="mt-6 rounded-2xl border border-emerald-200 overflow-hidden bg-white shadow-sm">
                    <WebinarSurveyResponsesPanel
                      webinarId={String(selected.id)}
                      title="Odpovědi účastníků"
                      subtitle="Shromážděné odpovědi z kvízu DVPP, druhé části zpětné vazby a vlastních otázek — podle aktuálního záznamu webináře v CMS."
                      showPublicLinkToolbar
                    />
                  </div>
                ) : null}

                <div className="mt-2 pt-4 border-t border-gray-200 space-y-2">
                  <button
                    type="button"
                    onClick={() => void handleSave()}
                    disabled={saving || generatingDvppQuestions || generatingDvppLearnings}
                    className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-[#001161] hover:opacity-95 disabled:opacity-40 text-white text-[15px] font-bold transition-opacity shadow-md shadow-[#001161]/15"
                  >
                    {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                    {saving ? 'Ukládám…' : 'Uložit otázky a článek do webináře'}
                  </button>
                  <p className="text-[11px] text-gray-400 text-center leading-relaxed">
                    {'Stejné tlačítko je i v horní liště vedle názvu webináře.'}
                  </p>
                </div>
              </div>
            )}

          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center bg-[#f7f8fc]">
          <div className="text-center">
            <div className="w-20 h-20 bg-white border-2 border-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-5 shadow-sm">
              <Clock className="w-10 h-10 text-gray-300" />
            </div>
            <p className="text-[15px] font-semibold text-gray-500">{'Vyberte minulý webinář'}</p>
            <p className="text-[12px] text-gray-400 mt-1 mb-5">{'Přidejte záznam, certifikát a přepis pro RAG indexaci'}</p>
            <button onClick={handleNewRecord}
              className="inline-flex items-center gap-2 bg-[#7C3AED] hover:bg-purple-700 text-white px-5 py-2.5 rounded-xl text-[13px] font-bold transition-colors">
              <Plus className="w-4 h-4" />
              {'Nový záznam webináře'}
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
