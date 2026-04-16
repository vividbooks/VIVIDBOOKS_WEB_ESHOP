import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router';
import {
  BookOpen,
  ChevronDown,
  ChevronRight,
  Database,
  Filter,
  Loader2,
  RefreshCw,
  Tag,
  Users,
  X,
} from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import { getSupabaseBrowser } from '@/lib/supabaseBrowser';
import { projectId, publicAnonKey } from '../../utils/supabase/info';

const SERVER = `https://${projectId}.supabase.co/functions/v1/make-server-93a20b6f`;
const FF = { fontFamily: "'Fenomen Sans', sans-serif" } as const;

const PAGE_SIZE = 100;
const EVENTS_LIMIT = 35;

/** Slugy shodné s přepočtem zájmů (`subjectInterestRecompute`). OR uvnitř výběru. */
const AUDIENCE_SUBJECT_OPTIONS: { slug: string; label: string }[] = [
  { slug: 'matematika', label: 'Matematika' },
  { slug: 'fyzika', label: 'Fyzika' },
  { slug: 'chemie', label: 'Chemie' },
  { slug: 'prirodopis', label: 'Přírodopis' },
  { slug: 'prvouka', label: 'Prvouka' },
  { slug: 'cesky-jazyk', label: 'Český jazyk' },
];

const SUBJECT_SLUG_LABEL: Record<string, string> = Object.fromEntries(
  AUDIENCE_SUBJECT_OPTIONS.map((o) => [o.slug, o.label]),
);

/** Nenulová skóre, seřazená podle síly (pro tabulku i detail). */
function subjectInterestEntries(raw: Record<string, number> | null): { slug: string; label: string; score: number }[] {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return [];
  return Object.entries(raw as Record<string, unknown>)
    .filter(([, v]) => typeof v === 'number' && (v as number) > 0)
    .map(([slug, v]) => ({
      slug,
      label: SUBJECT_SLUG_LABEL[slug] ?? slug,
      score: v as number,
    }))
    .sort((a, b) => b.score - a.score);
}

const SUBSCRIBER_SELECT_COLS = [
  'id',
  'email',
  'first_name',
  'last_name',
  'phone',
  'ico',
  'status',
  'source',
  'contact_type',
  'position_label',
  'school_name',
  'mc_list_id',
  'mc_member_id',
  'merge_fields',
  'subscribed_at',
  'unsubscribed_at',
  'last_opened_at',
  'last_clicked_at',
  'engagement_score',
  'subject_interest_scores',
  'updated_at',
] as const;

type SubscriberRow = {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  ico: string | null;
  status: string;
  source: string;
  contact_type: string;
  /** Hodnota z Mailchimp merge pole SELECT (pozice / role v účtu). */
  position_label: string | null;
  school_name: string | null;
  mc_list_id: string | null;
  mc_member_id: string | null;
  merge_fields: Record<string, unknown> | null;
  subscribed_at: string | null;
  unsubscribed_at: string | null;
  last_opened_at: string | null;
  last_clicked_at: string | null;
  engagement_score: number | null;
  /** Slug předmětu → skóre z /admin/mailing/recompute-subject-interests */
  subject_interest_scores: Record<string, number> | null;
  updated_at: string;
};

type SubscriberTagMeta = { tagId: string; name: string; source: string };

type ListMembership = { listName: string | null; listMcId: string | null; status: string; subscribed_at: string | null };

type ActivityRow = {
  event_type: string;
  occurred_at: string;
  campaigns: { name: string | null; subject_line: string | null } | null;
};

function buildTagMetaBySubscriber(
  st: { subscriber_id: string; tag_id: string; source: string }[],
  tags: { id: string; name: string }[] | null,
): Record<string, SubscriberTagMeta[]> {
  const tagName = new Map((tags || []).map((t) => [t.id, t.name]));
  const m: Record<string, SubscriberTagMeta[]> = {};
  for (const row of st) {
    const name = tagName.get(row.tag_id);
    if (!name) continue;
    if (!m[row.subscriber_id]) m[row.subscriber_id] = [];
    m[row.subscriber_id].push({
      tagId: row.tag_id,
      name,
      source: row.source || 'mailchimp',
    });
  }
  for (const k of Object.keys(m)) {
    m[k].sort((a, b) => a.name.localeCompare(b.name, 'cs'));
  }
  return m;
}

function buildListsBySubscriber(
  sl: { subscriber_id: string; list_id: string; status: string; subscribed_at: string | null }[],
  lists: { id: string; name: string | null; mailchimp_list_id: string }[] | null,
): Record<string, ListMembership[]> {
  const listMeta = new Map(
    (lists || []).map((l) => [l.id, { name: l.name, mailchimp_list_id: l.mailchimp_list_id }]),
  );
  const m: Record<string, ListMembership[]> = {};
  for (const row of sl) {
    const meta = listMeta.get(row.list_id);
    if (!m[row.subscriber_id]) m[row.subscriber_id] = [];
    m[row.subscriber_id].push({
      listName: meta?.name ?? null,
      listMcId: meta?.mailchimp_list_id ?? null,
      status: row.status,
      subscribed_at: row.subscribed_at,
    });
  }
  return m;
}

export default function MailingAudiencePage() {
  const [rows, setRows] = useState<SubscriberRow[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [tagMetaBySub, setTagMetaBySub] = useState<Record<string, SubscriberTagMeta[]>>({});
  const [listsBySub, setListsBySub] = useState<Record<string, ListMembership[]>>({});
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [eventsBySub, setEventsBySub] = useState<Record<string, ActivityRow[]>>({});
  const [eventsLoadingId, setEventsLoadingId] = useState<string | null>(null);
  const [subjectScoresBusy, setSubjectScoresBusy] = useState(false);

  const [newGlobalTag, setNewGlobalTag] = useState('');
  const [tagMutationBusy, setTagMutationBusy] = useState(false);
  const [syncMailchimp, setSyncMailchimp] = useState(true);
  const [tagAddInput, setTagAddInput] = useState('');

  /** Filtr kontaktů: kontakt se zobrazí, pokud má alespoň jeden z vybraných tagů (OR). */
  const [filterTagIds, setFilterTagIds] = useState<string[]>([]);
  const [tagFilterOpen, setTagFilterOpen] = useState(false);
  const [tagFilterSearch, setTagFilterSearch] = useState('');
  const [dropdownTags, setDropdownTags] = useState<{ id: string; name: string }[]>([]);
  const tagFilterRef = useRef<HTMLDivElement | null>(null);
  const positionFilterRef = useRef<HTMLDivElement | null>(null);

  /** Vybraná pozice (přesná hodnota sloupce position_label / Mailchimp SELECT). */
  const [filterPosition, setFilterPosition] = useState('');
  const [positionOptions, setPositionOptions] = useState<string[]>([]);
  const [positionOptionsLoading, setPositionOptionsLoading] = useState(false);
  const [positionFilterOpen, setPositionFilterOpen] = useState(false);
  const [positionFilterSearch, setPositionFilterSearch] = useState('');

  /** Filtr: kontakt má nenulové skóre u alespoň jednoho vybraného předmětu (OR). */
  const [filterSubjectSlugs, setFilterSubjectSlugs] = useState<string[]>([]);
  const [subjectFilterOpen, setSubjectFilterOpen] = useState(false);
  const [subjectFilterSearch, setSubjectFilterSearch] = useState('');
  const subjectFilterRef = useRef<HTMLDivElement | null>(null);

  const filterTagKey = useMemo(() => [...filterTagIds].sort().join(','), [filterTagIds]);
  const filterSubjectKey = useMemo(() => [...filterSubjectSlugs].sort().join(','), [filterSubjectSlugs]);

  const filteredDropdownTags = useMemo(() => {
    const q = tagFilterSearch.trim().toLowerCase();
    if (!q) return dropdownTags;
    return dropdownTags.filter((t) => t.name.toLowerCase().includes(q));
  }, [dropdownTags, tagFilterSearch]);

  const filteredPositionOptions = useMemo(() => {
    const q = positionFilterSearch.trim().toLowerCase();
    if (!q) return positionOptions;
    return positionOptions.filter((p) => p.toLowerCase().includes(q));
  }, [positionOptions, positionFilterSearch]);

  const filteredSubjectOptions = useMemo(() => {
    const q = subjectFilterSearch.trim().toLowerCase();
    if (!q) return AUDIENCE_SUBJECT_OPTIONS;
    return AUDIENCE_SUBJECT_OPTIONS.filter(
      (o) => o.label.toLowerCase().includes(q) || o.slug.toLowerCase().includes(q),
    );
  }, [subjectFilterSearch]);

  useEffect(() => {
    setPage(0);
  }, [filterTagKey, filterSubjectKey, filterPosition]);

  useEffect(() => {
    setTagAddInput('');
  }, [expandedId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = getSupabaseBrowser();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session || cancelled) return;
      const { data, error } = await supabase.from('tags').select('id, name').order('name');
      if (error) {
        console.warn('[audience] tags dropdown', error.message);
        return;
      }
      if (!cancelled) setDropdownTags((data || []) as { id: string; name: string }[]);
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = getSupabaseBrowser();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session || cancelled) return;
      setPositionOptionsLoading(true);
      try {
        const seen = new Set<string>();
        let from = 0;
        const PAGE = 1000;
        for (;;) {
          const { data, error } = await supabase
            .from('subscribers')
            .select('position_label')
            .not('position_label', 'is', null)
            .order('position_label', { ascending: true })
            .range(from, from + PAGE - 1);
          if (error) {
            console.warn('[audience] position options', error.message);
            break;
          }
          const rows = data || [];
          for (const r of rows) {
            const v = (r.position_label as string | null)?.trim();
            if (v) seen.add(v);
          }
          if (rows.length < PAGE) break;
          from += PAGE;
          if (from > 200_000) break;
        }
        if (!cancelled) setPositionOptions([...seen].sort((a, b) => a.localeCompare(b, 'cs')));
      } finally {
        if (!cancelled) setPositionOptionsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      const t = e.target instanceof Node ? e.target : null;
      if (tagFilterOpen) {
        const el = tagFilterRef.current;
        if (el && t && !el.contains(t)) {
          setTagFilterOpen(false);
          setTagFilterSearch('');
        }
      }
      if (positionFilterOpen) {
        const el = positionFilterRef.current;
        if (el && t && !el.contains(t)) {
          setPositionFilterOpen(false);
          setPositionFilterSearch('');
        }
      }
      if (subjectFilterOpen) {
        const el = subjectFilterRef.current;
        if (el && t && !el.contains(t)) {
          setSubjectFilterOpen(false);
          setSubjectFilterSearch('');
        }
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [tagFilterOpen, positionFilterOpen, subjectFilterOpen]);

  const load = useCallback(async () => {
    setLoading(true);
    setExpandedId(null);
    setEventsBySub({});
    try {
      const supabase = getSupabaseBrowser();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        toast.error('Pro zobrazení kontaktů se přihlas.');
        setRows([]);
        setTotal(null);
        setTagMetaBySub({});
        setListsBySub({});
        return;
      }

      const colStr = SUBSCRIBER_SELECT_COLS.join(',');
      let list: SubscriberRow[];
      let countTotal: number;

      const hasTag = filterTagIds.length > 0;
      const hasSubj = filterSubjectSlugs.length > 0;
      const hasPos = Boolean(filterPosition);

      const handleSelectError = (msg: string) => {
        if (/permission|policy|rls|42501/i.test(msg)) {
          toast.error('Nemáš oprávnění číst subscribers (ověř přihlášení a RLS).');
        } else if (/does not exist|42P01/i.test(msg)) {
          toast.error('Tabulka subscribers neexistuje — spusť SQL migraci email marketingu.');
        } else {
          toast.error(msg);
        }
      };

      if (!hasTag && !hasSubj && !hasPos) {
        const from = page * PAGE_SIZE;
        const to = from + PAGE_SIZE - 1;
        const { data, error, count } = await supabase
          .from('subscribers')
          .select(colStr, { count: 'exact' })
          .order('updated_at', { ascending: false })
          .range(from, to);

        if (error) {
          handleSelectError(error.message || String(error));
          setRows([]);
          setTotal(null);
          setTagMetaBySub({});
          setListsBySub({});
          return;
        }

        list = (data || []) as SubscriberRow[];
        countTotal = typeof count === 'number' ? count : 0;
      } else if (!hasTag && !hasSubj && hasPos) {
        const from = page * PAGE_SIZE;
        const to = from + PAGE_SIZE - 1;
        const { data, error, count } = await supabase
          .from('subscribers')
          .select(colStr, { count: 'exact' })
          .eq('position_label', filterPosition)
          .order('updated_at', { ascending: false })
          .range(from, to);

        if (error) {
          handleSelectError(error.message || String(error));
          setRows([]);
          setTotal(null);
          setTagMetaBySub({});
          setListsBySub({});
          return;
        }

        list = (data || []) as SubscriberRow[];
        countTotal = typeof count === 'number' ? count : 0;
      } else {
        let idSet: Set<string> | null = null;

        if (hasTag) {
          const tagAccum = new Set<string>();
          let stOffset = 0;
          const ST_PAGE = 1000;
          for (;;) {
            const { data: stPart, error: stErr } = await supabase
              .from('subscriber_tags')
              .select('subscriber_id')
              .in('tag_id', filterTagIds)
              .range(stOffset, stOffset + ST_PAGE - 1);
            if (stErr) {
              toast.error(stErr.message);
              setRows([]);
              setTotal(null);
              setTagMetaBySub({});
              setListsBySub({});
              return;
            }
            const part = stPart || [];
            for (const r of part) tagAccum.add(r.subscriber_id as string);
            if (part.length < ST_PAGE) break;
            stOffset += ST_PAGE;
          }
          idSet = tagAccum;
        }

        if (hasSubj) {
          const { data: subjRows, error: subjErr } = await supabase.rpc('subscriber_ids_by_subject_interests', {
            p_slugs: filterSubjectSlugs,
          });
          if (subjErr) {
            toast.error(subjErr.message);
            setRows([]);
            setTotal(null);
            setTagMetaBySub({});
            setListsBySub({});
            return;
          }
          const subjSet = new Set((subjRows || []) as string[]);
          if (idSet === null) {
            idSet = subjSet;
          } else {
            idSet = new Set([...idSet].filter((id) => subjSet.has(id)));
          }
        }

        let allIds = [...(idSet || [])];

        if (hasPos) {
          const posFiltered: string[] = [];
          const POS_CHUNK = 150;
          for (let i = 0; i < allIds.length; i += POS_CHUNK) {
            const chunk = allIds.slice(i, i + POS_CHUNK);
            const { data: rows, error: pe } = await supabase
              .from('subscribers')
              .select('id')
              .in('id', chunk)
              .eq('position_label', filterPosition);
            if (pe) {
              toast.error(pe.message);
              setRows([]);
              setTotal(null);
              setTagMetaBySub({});
              setListsBySub({});
              return;
            }
            for (const r of rows || []) posFiltered.push(r.id as string);
          }
          allIds = posFiltered;
        }

        countTotal = allIds.length;

        if (allIds.length === 0) {
          list = [];
        } else {
          const mini: { id: string; updated_at: string }[] = [];
          const CHUNK = 150;
          for (let i = 0; i < allIds.length; i += CHUNK) {
            const chunk = allIds.slice(i, i + CHUNK);
            const { data: rows, error: e2 } = await supabase
              .from('subscribers')
              .select('id, updated_at')
              .in('id', chunk);
            if (e2) {
              toast.error(e2.message);
              setRows([]);
              setTotal(null);
              setTagMetaBySub({});
              setListsBySub({});
              return;
            }
            mini.push(...((rows || []) as { id: string; updated_at: string }[]));
          }
          mini.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
          const from = page * PAGE_SIZE;
          const pageIds = mini.slice(from, from + PAGE_SIZE).map((m) => m.id);

          if (pageIds.length === 0) {
            list = [];
          } else {
            const { data: full, error: e3 } = await supabase.from('subscribers').select(colStr).in('id', pageIds);
            if (e3) {
              toast.error(e3.message);
              setRows([]);
              setTotal(null);
              setTagMetaBySub({});
              setListsBySub({});
              return;
            }
            const order = new Map(pageIds.map((id, idx) => [id, idx]));
            list = ((full || []) as SubscriberRow[]).sort(
              (a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0),
            );
          }
        }
      }

      setRows(list);
      setTotal(countTotal);

      const ids = list.map((r) => r.id);
      if (ids.length === 0) {
        setTagMetaBySub({});
        setListsBySub({});
        return;
      }

      const [stRes, slRes] = await Promise.all([
        supabase.from('subscriber_tags').select('subscriber_id, tag_id, source').in('subscriber_id', ids),
        supabase
          .from('subscriber_lists')
          .select('subscriber_id, list_id, status, subscribed_at')
          .in('subscriber_id', ids),
      ]);

      if (stRes.error) console.warn('[audience] subscriber_tags', stRes.error.message);
      if (slRes.error) console.warn('[audience] subscriber_lists', slRes.error.message);

      const st = stRes.data || [];
      const sl = slRes.data || [];
      const tagIds = [...new Set(st.map((r) => r.tag_id))];
      const listIds = [...new Set(sl.map((r) => r.list_id))];

      const [tagsRes, listsRes] = await Promise.all([
        tagIds.length
          ? supabase.from('tags').select('id, name').in('id', tagIds)
          : Promise.resolve({ data: [] as { id: string; name: string }[], error: null }),
        listIds.length
          ? supabase.from('lists').select('id, name, mailchimp_list_id').in('id', listIds)
          : Promise.resolve({
              data: [] as { id: string; name: string | null; mailchimp_list_id: string }[],
              error: null,
            }),
      ]);

      setTagMetaBySub(buildTagMetaBySubscriber(st as { subscriber_id: string; tag_id: string; source: string }[], tagsRes.data));
      setListsBySub(buildListsBySubscriber(sl, listsRes.data));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Načtení selhalo');
      setRows([]);
      setTotal(null);
      setTagMetaBySub({});
      setListsBySub({});
    } finally {
      setLoading(false);
    }
  }, [page, refreshKey, filterTagKey, filterSubjectKey, filterPosition]);

  useEffect(() => {
    void load();
  }, [load]);

  const loadEventsFor = useCallback(async (subscriberId: string) => {
    if (eventsBySub[subscriberId]) return;
    setEventsLoadingId(subscriberId);
    try {
      const supabase = getSupabaseBrowser();
      const { data, error } = await supabase
        .from('email_events')
        .select('event_type, occurred_at, campaigns(name, subject_line)')
        .eq('subscriber_id', subscriberId)
        .order('occurred_at', { ascending: false })
        .limit(EVENTS_LIMIT);

      if (error) {
        const { data: plain } = await supabase
          .from('email_events')
          .select('event_type, occurred_at')
          .eq('subscriber_id', subscriberId)
          .order('occurred_at', { ascending: false })
          .limit(EVENTS_LIMIT);
        setEventsBySub((prev) => ({
          ...prev,
          [subscriberId]: (plain || []).map((r) => ({ ...r, campaigns: null })),
        }));
        return;
      }
      setEventsBySub((prev) => ({ ...prev, [subscriberId]: (data || []) as ActivityRow[] }));
    } finally {
      setEventsLoadingId(null);
    }
  }, [eventsBySub]);

  const toggleExpand = (id: string) => {
    setExpandedId((cur) => {
      const next = cur === id ? null : id;
      if (next) void loadEventsFor(next);
      return next;
    });
  };

  const refreshAll = () => {
    setRefreshKey((k) => k + 1);
  };

  const recomputeSubjectInterests = async () => {
    if (
      !confirm(
        'Přepočítat zájmy o předměty? Kontakty jdou po dávkách 1000 (nejdříve nejnověji aktualizovaní); po každé dávce se automaticky pokračuje, dokud nedojdou záznamy. (Heuristika z tagů, pozice a merge fields — bez AI.)',
      )
    ) {
      return;
    }
    setSubjectScoresBusy(true);
    let offset = 0;
    let totalUpdated = 0;
    let batch = 0;
    let lastSamples: unknown = null;
    try {
      for (;;) {
        batch += 1;
        const res = await fetch(`${SERVER}/admin/mailing/recompute-subject-interests`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${publicAnonKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ limit: 1000, offset }),
        });
        const rawText = await res.text();
        let data: { ok?: boolean; error?: string; updated?: number; processed?: number; samples?: unknown } = {};
        try {
          data = rawText ? (JSON.parse(rawText) as typeof data) : {};
        } catch {
          data = {};
        }
        if (!res.ok || data.ok === false) {
          const hint = data.error || (rawText?.slice(0, 200) || res.statusText);
          toast.error(`${res.status}: ${hint}`);
          return;
        }
        const upd = data.updated ?? 0;
        const proc = data.processed ?? 0;
        totalUpdated += upd;
        if (Array.isArray(data.samples) && data.samples.length) {
          lastSamples = data.samples;
        }
        if (proc < 1000) break;
        offset += 1000;
        toast.message(`Dávka ${batch}: +${upd} aktualizací. Pokračuji dalšími 1000 kontakty…`);
        await new Promise((r) => setTimeout(r, 300));
      }
      toast.success(
        `Zájmy přepočteny: ${totalUpdated} aktualizací celkem (${batch} dávek). Vzorky s nenulovým skóre v konzoli (F12).`,
      );
      if (Array.isArray(lastSamples) && lastSamples.length) {
        console.info('[audience] subject_interest samples (poslední dávka)', lastSamples);
      }
      refreshAll();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Přepočet selhal');
    } finally {
      setSubjectScoresBusy(false);
    }
  };

  const toggleFilterTag = (tagId: string) => {
    setFilterTagIds((prev) => {
      const next = prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId];
      return next;
    });
    setPage(0);
  };

  const clearTagFilter = () => {
    setFilterTagIds([]);
    setPage(0);
    setTagFilterOpen(false);
    setTagFilterSearch('');
  };

  const clearPositionFilter = () => {
    setFilterPosition('');
    setPositionFilterOpen(false);
    setPositionFilterSearch('');
    setPage(0);
  };

  const toggleFilterSubject = (slug: string) => {
    setFilterSubjectSlugs((prev) => {
      const next = prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug];
      return next;
    });
    setPage(0);
  };

  const clearSubjectFilter = () => {
    setFilterSubjectSlugs([]);
    setPage(0);
    setSubjectFilterOpen(false);
    setSubjectFilterSearch('');
  };

  const hasActiveFilters = filterTagIds.length > 0 || filterSubjectSlugs.length > 0 || Boolean(filterPosition);

  const createGlobalTag = async () => {
    const name = newGlobalTag.trim();
    if (!name) return;
    setTagMutationBusy(true);
    try {
      const res = await fetch(`${SERVER}/admin/mailing/tags`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${publicAnonKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        toast.error(String(data.error || 'Tag se nepodařilo vytvořit'));
        return;
      }
      toast.success(`Tag „${data.tag?.name || name}“ byl vytvořen`);
      setNewGlobalTag('');
      setRefreshKey((k) => k + 1);
    } finally {
      setTagMutationBusy(false);
    }
  };

  const patchSubscriberTags = async (
    subscriberId: string,
    body: { addNames?: string[]; removeTagIds?: string[] },
  ) => {
    setTagMutationBusy(true);
    try {
      const res = await fetch(`${SERVER}/admin/mailing/subscribers/${subscriberId}/tags`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${publicAnonKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...body, syncMailchimp }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.ok === false) {
        toast.error(String(data.error || 'Úprava tagů selhala'));
        return;
      }
      const parts: string[] = [];
      if (data.added) parts.push(`+${data.added}`);
      if (data.removed) parts.push(`−${data.removed}`);
      toast.success(parts.length ? `Tagy: ${parts.join(', ')}` : 'Hotovo');
      if (data.mailchimpDetail && data.mailchimpSynced === false) {
        toast.message(`Mailchimp: ${data.mailchimpDetail}`);
      }
      refreshAll();
    } finally {
      setTagMutationBusy(false);
    }
  };

  const totalPages = total != null ? Math.max(1, Math.ceil(total / PAGE_SIZE)) : 1;
  const showPager = total != null && total > PAGE_SIZE;

  return (
    <div className="min-h-full p-6 md:p-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-fuchsia-50 px-3 py-1 text-fuchsia-700">
              <Users className="h-4 w-4" />
              <span style={FF} className="text-[11px] font-bold uppercase tracking-[0.12em]">
                Audience
              </span>
            </div>
            <h1 style={FF} className="mt-3 text-[26px] font-bold leading-tight text-[#001161]">
              Kontakty (Postgres)
            </h1>
            <p style={FF} className="mt-2 max-w-2xl text-[14px] leading-6 text-[#001161]/60">
              Import z Mailchimpu pokrývá členy audience, merge fields, tagy u člena, seznamy, kampaně a volitelně aktivitu
              (opens/clicks). Neimportujeme segmenty Mailchimpu, skupiny zájmů, poznámky u kontaktu ani e‑commerce události.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex cursor-pointer items-center gap-2 text-[12px] text-[#001161]/70" style={FF}>
              <input
                type="checkbox"
                checked={syncMailchimp}
                onChange={(e) => setSyncMailchimp(e.target.checked)}
                className="accent-fuchsia-600"
              />
              Při úpravě tagů sync do Mailchimp
            </label>
            <button
              type="button"
              onClick={() => refreshAll()}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-[13px] font-bold text-[#001161] transition-colors hover:bg-gray-50 disabled:opacity-50"
              style={FF}
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Obnovit
            </button>
            <button
              type="button"
              onClick={() => void recomputeSubjectInterests()}
              disabled={loading || subjectScoresBusy}
              className="inline-flex items-center gap-2 rounded-xl border border-sky-200 bg-sky-50 px-4 py-2 text-[13px] font-bold text-sky-900 transition-colors hover:bg-sky-100 disabled:opacity-50"
              style={FF}
              title="Dávky po 1000 kontaktech (updated_at desc), dokud nedojdou záznamy"
            >
              {subjectScoresBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {subjectScoresBusy ? 'Počítám zájmy…' : 'Přepočítat zájmy'}
            </button>
            <Link
              to="/admin/migrace"
              className="inline-flex items-center gap-2 rounded-xl bg-[#001161] px-4 py-2 text-[13px] font-bold text-white transition-opacity hover:opacity-95"
              style={FF}
            >
              <Database className="h-4 w-4" />
              Import z Mailchimp
            </Link>
          </div>
        </div>

        <div className="overflow-hidden rounded-[20px] border border-gray-200 bg-white shadow-[0_10px_30px_rgba(0,17,97,0.06)]">
          <div
            className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-4 py-3 text-[12px] text-[#001161]/55"
            style={FF}
          >
            <div className="flex flex-wrap items-center gap-3">
              <span>
                {total != null ? (
                  <>
                    <strong className="text-[#001161]">{total.toLocaleString('cs-CZ')}</strong>{' '}
                    {hasActiveFilters ? 'kontaktů ve filtru' : 'kontaktů v databázi'}
                  </>
                ) : loading ? (
                  'Načítám…'
                ) : (
                  '—'
                )}
              </span>
              <div
                className="flex flex-wrap items-center gap-2 border-l border-gray-200 pl-3"
                onClick={(e) => e.stopPropagation()}
              >
                <Tag className="h-3.5 w-3.5 shrink-0 text-fuchsia-600" aria-hidden />
                <input
                  type="text"
                  value={newGlobalTag}
                  onChange={(e) => setNewGlobalTag(e.target.value)}
                  placeholder="Nový tag…"
                  className="w-[140px] rounded-lg border border-gray-200 px-2.5 py-1.5 text-[12px] outline-none focus:border-fuchsia-400 sm:w-[180px]"
                  style={FF}
                  onKeyDown={(e) => e.key === 'Enter' && void createGlobalTag()}
                />
                <button
                  type="button"
                  onClick={() => void createGlobalTag()}
                  disabled={tagMutationBusy || !newGlobalTag.trim()}
                  className="rounded-lg bg-fuchsia-600 px-3 py-1.5 text-[12px] font-bold text-white disabled:opacity-50"
                  style={FF}
                >
                  Vytvořit
                </button>
              </div>
              <div className="relative" ref={tagFilterRef}>
                <button
                  type="button"
                  onClick={() => {
                    setTagFilterOpen((o) => {
                      if (o) setTagFilterSearch('');
                      return !o;
                    });
                  }}
                  className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-[12px] font-bold transition-colors ${
                    filterTagIds.length > 0
                      ? 'border-fuchsia-400 bg-fuchsia-50 text-fuchsia-900'
                      : 'border-gray-200 bg-white text-[#001161] hover:bg-gray-50'
                  }`}
                  style={FF}
                >
                  <Filter className="h-3.5 w-3.5" />
                  Filtr podle tagů
                  {filterTagIds.length > 0 ? (
                    <span className="rounded-full bg-fuchsia-600 px-1.5 py-0.5 text-[10px] text-white">
                      {filterTagIds.length}
                    </span>
                  ) : null}
                  <ChevronDown className={`h-3.5 w-3.5 transition-transform ${tagFilterOpen ? 'rotate-180' : ''}`} />
                </button>
                {tagFilterOpen ? (
                  <div
                    className="absolute left-0 top-full z-40 mt-1 w-[min(100vw-2rem,320px)] rounded-xl border border-gray-200 bg-white py-2 shadow-lg"
                    style={FF}
                  >
                    <p className="border-b border-gray-100 px-3 pb-2 text-[10px] font-bold uppercase tracking-wide text-[#001161]/45">
                      Má libovolný z vybraných (OR)
                    </p>
                    <div className="border-b border-gray-100 px-3 pb-2 pt-2">
                      <input
                        type="search"
                        autoFocus
                        value={tagFilterSearch}
                        onChange={(e) => setTagFilterSearch(e.target.value)}
                        placeholder="Hledat tag…"
                        className="w-full rounded-lg border border-gray-200 px-2.5 py-2 text-[13px] outline-none focus:border-fuchsia-400"
                        style={FF}
                        onMouseDown={(e) => e.stopPropagation()}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                    <div className="max-h-[280px] overflow-y-auto px-2 pt-2">
                      {dropdownTags.length === 0 ? (
                        <p className="px-2 py-3 text-[12px] text-[#001161]/45">Žádné tagy v databázi.</p>
                      ) : filteredDropdownTags.length === 0 ? (
                        <p className="px-2 py-3 text-[12px] text-[#001161]/45">Žádný tag neodpovídá hledání.</p>
                      ) : (
                        filteredDropdownTags.map((t) => (
                          <label
                            key={t.id}
                            className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-[13px] text-[#001161] hover:bg-fuchsia-50/60"
                          >
                            <input
                              type="checkbox"
                              checked={filterTagIds.includes(t.id)}
                              onChange={() => toggleFilterTag(t.id)}
                              className="accent-fuchsia-600"
                            />
                            <span className="min-w-0 flex-1 truncate">{t.name}</span>
                          </label>
                        ))
                      )}
                    </div>
                    {filterTagIds.length > 0 ? (
                      <div className="border-t border-gray-100 px-2 pt-2">
                        <button
                          type="button"
                          onClick={clearTagFilter}
                          className="w-full rounded-lg py-2 text-center text-[12px] font-bold text-fuchsia-700 hover:bg-fuchsia-50"
                        >
                          Zrušit filtr tagů
                        </button>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
              <div className="relative" ref={subjectFilterRef}>
                <button
                  type="button"
                  onClick={() => {
                    setSubjectFilterOpen((o) => {
                      if (o) setSubjectFilterSearch('');
                      return !o;
                    });
                  }}
                  className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-[12px] font-bold transition-colors ${
                    filterSubjectSlugs.length > 0
                      ? 'border-emerald-400 bg-emerald-50 text-emerald-950'
                      : 'border-gray-200 bg-white text-[#001161] hover:bg-gray-50'
                  }`}
                  style={FF}
                >
                  <BookOpen className="h-3.5 w-3.5" />
                  Zájem o předmět
                  {filterSubjectSlugs.length > 0 ? (
                    <span className="rounded-full bg-emerald-600 px-1.5 py-0.5 text-[10px] text-white">
                      {filterSubjectSlugs.length}
                    </span>
                  ) : null}
                  <ChevronDown className={`h-3.5 w-3.5 transition-transform ${subjectFilterOpen ? 'rotate-180' : ''}`} />
                </button>
                {subjectFilterOpen ? (
                  <div
                    className="absolute left-0 top-full z-40 mt-1 w-[min(100vw-2rem,320px)] rounded-xl border border-gray-200 bg-white py-2 shadow-lg"
                    style={FF}
                  >
                    <p className="border-b border-gray-100 px-3 pb-2 text-[10px] font-bold uppercase tracking-wide text-[#001161]/45">
                      Nenulové skóre u libovolného z vybraných (OR)
                    </p>
                    <div className="border-b border-gray-100 px-3 pb-2 pt-2">
                      <input
                        type="search"
                        autoFocus
                        value={subjectFilterSearch}
                        onChange={(e) => setSubjectFilterSearch(e.target.value)}
                        placeholder="Hledat předmět…"
                        className="w-full rounded-lg border border-gray-200 px-2.5 py-2 text-[13px] outline-none focus:border-emerald-400"
                        style={FF}
                        onMouseDown={(e) => e.stopPropagation()}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                    <div className="max-h-[280px] overflow-y-auto px-2 pt-2">
                      {filteredSubjectOptions.length === 0 ? (
                        <p className="px-2 py-3 text-[12px] text-[#001161]/45">Žádný předmět neodpovídá hledání.</p>
                      ) : (
                        filteredSubjectOptions.map((o) => (
                          <label
                            key={o.slug}
                            className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-[13px] text-[#001161] hover:bg-emerald-50/60"
                          >
                            <input
                              type="checkbox"
                              checked={filterSubjectSlugs.includes(o.slug)}
                              onChange={() => toggleFilterSubject(o.slug)}
                              className="accent-emerald-600"
                            />
                            <span className="min-w-0 flex-1 truncate">{o.label}</span>
                          </label>
                        ))
                      )}
                    </div>
                    {filterSubjectSlugs.length > 0 ? (
                      <div className="border-t border-gray-100 px-2 pt-2">
                        <button
                          type="button"
                          onClick={clearSubjectFilter}
                          className="w-full rounded-lg py-2 text-center text-[12px] font-bold text-emerald-800 hover:bg-emerald-50"
                        >
                          Zrušit filtr předmětů
                        </button>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
              <div className="flex flex-wrap items-center gap-2 border-l border-gray-200 pl-3">
                <div className="relative" ref={positionFilterRef}>
                  <button
                    type="button"
                    onClick={() => {
                      setPositionFilterOpen((o) => {
                        if (o) setPositionFilterSearch('');
                        return !o;
                      });
                    }}
                    className={`inline-flex max-w-[min(100vw-4rem,280px)] items-center gap-2 rounded-xl border px-3 py-2 text-[12px] font-bold transition-colors ${
                      filterPosition
                        ? 'border-sky-400 bg-sky-50 text-sky-950'
                        : 'border-gray-200 bg-white text-[#001161] hover:bg-gray-50'
                    }`}
                    style={FF}
                  >
                    <span className="min-w-0 truncate">
                      {filterPosition ? filterPosition : 'Pozice (SELECT)'}
                    </span>
                    <ChevronDown className={`h-3.5 w-3.5 shrink-0 transition-transform ${positionFilterOpen ? 'rotate-180' : ''}`} />
                  </button>
                  {positionFilterOpen ? (
                    <div
                      className="absolute left-0 top-full z-40 mt-1 w-[min(100vw-2rem,360px)] rounded-xl border border-gray-200 bg-white py-2 shadow-lg"
                      style={FF}
                    >
                    <p className="border-b border-gray-100 px-3 pb-2 text-[10px] font-bold uppercase tracking-wide text-[#001161]/45">
                      Jedna hodnota z databáze (Mailchimp SELECT)
                    </p>
                    <div className="border-b border-gray-100 px-3 pb-2 pt-2">
                      <input
                        type="search"
                        autoFocus
                        value={positionFilterSearch}
                        onChange={(e) => setPositionFilterSearch(e.target.value)}
                        placeholder="Hledat pozici…"
                        className="w-full rounded-lg border border-gray-200 px-2.5 py-2 text-[13px] outline-none focus:border-sky-400"
                        style={FF}
                        onMouseDown={(e) => e.stopPropagation()}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                    <div className="max-h-[280px] overflow-y-auto px-2 pt-2">
                      <button
                        type="button"
                        onClick={() => {
                          clearPositionFilter();
                        }}
                        className="mb-1 w-full rounded-lg px-2 py-2 text-left text-[12px] font-bold text-[#001161]/60 hover:bg-gray-50"
                        style={FF}
                      >
                        Všechny pozice
                      </button>
                      {positionOptionsLoading ? (
                        <p className="flex items-center gap-2 px-2 py-3 text-[12px] text-[#001161]/45">
                          <Loader2 className="h-4 w-4 animate-spin text-sky-500" />
                          Načítám seznam pozic…
                        </p>
                      ) : filteredPositionOptions.length === 0 ? (
                        <p className="px-2 py-3 text-[12px] text-[#001161]/45">
                          {positionOptions.length === 0
                            ? 'Žádná vyplněná pozice v datech — po importu se naplní.'
                            : 'Žádná pozice neodpovídá hledání.'}
                        </p>
                      ) : (
                        filteredPositionOptions.map((p) => (
                          <button
                            key={p}
                            type="button"
                            onClick={() => {
                              setFilterPosition(p);
                              setPositionFilterOpen(false);
                              setPositionFilterSearch('');
                              setPage(0);
                            }}
                            className={`mb-0.5 w-full rounded-lg px-2 py-2 text-left text-[13px] hover:bg-sky-50/80 ${
                              filterPosition === p ? 'bg-sky-100 font-bold text-sky-950' : 'text-[#001161]'
                            }`}
                            style={FF}
                          >
                            <span className="line-clamp-2">{p}</span>
                          </button>
                        ))
                      )}
                    </div>
                    </div>
                  ) : null}
                </div>
                {filterPosition ? (
                  <button
                    type="button"
                    onClick={() => clearPositionFilter()}
                    className="rounded-lg border border-gray-200 bg-white px-2.5 py-2 text-[11px] font-bold text-[#001161]/70 hover:bg-gray-50"
                    style={FF}
                  >
                    Zrušit pozici
                  </button>
                ) : null}
              </div>
            </div>
            {showPager && (
              <span>
                Stránka <strong className="text-[#001161]">{page + 1}</strong> / {totalPages}
              </span>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[1040px] text-left text-[13px]" style={FF}>
              <thead>
                <tr className="border-b border-gray-100 bg-[#fafbfd] text-[10px] font-bold uppercase tracking-wide text-[#001161]/45">
                  <th className="w-10 px-2 py-3" aria-label="Rozbalit" />
                  <th className="px-4 py-3">E-mail</th>
                  <th className="px-4 py-3">Jméno</th>
                  <th className="px-4 py-3">Stav</th>
                  <th className="px-4 py-3">Tagy</th>
                  <th className="min-w-[140px] px-3 py-3">Zájmy</th>
                  <th className="px-4 py-3">Zdroj</th>
                  <th className="px-4 py-3">Typ</th>
                  <th className="px-4 py-3">Pozice</th>
                  <th className="px-4 py-3">Škola / IČ</th>
                  <th className="px-4 py-3 whitespace-nowrap">Aktualizováno</th>
                </tr>
              </thead>
              <tbody>
                {loading && rows.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="px-4 py-16 text-center text-[#001161]/45">
                      <Loader2 className="mx-auto h-8 w-8 animate-spin text-fuchsia-500" />
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="px-4 py-12 text-center leading-7 text-[#001161]/55">
                      Zatím tu nejsou žádné záznamy. Spusť import v{' '}
                      <Link to="/admin/migrace" className="font-bold text-fuchsia-700 underline">
                        Migrace obsahu → Mailchimp → kontakty
                      </Link>
                      .
                    </td>
                  </tr>
                ) : (
                  rows.flatMap((r) => {
                    const name = [r.first_name, r.last_name].filter(Boolean).join(' ') || '—';
                    const updated = r.updated_at
                      ? new Date(r.updated_at).toLocaleString('cs-CZ', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : '—';
                    const metas = tagMetaBySub[r.id] || [];
                    const interests = subjectInterestEntries(r.subject_interest_scores);
                    const expanded = expandedId === r.id;
                    const events = eventsBySub[r.id];
                    const mergeObj =
                      r.merge_fields &&
                      typeof r.merge_fields === 'object' &&
                      !Array.isArray(r.merge_fields)
                        ? (r.merge_fields as Record<string, unknown>)
                        : {};
                    const mergePretty =
                      Object.keys(mergeObj).length > 0
                        ? JSON.stringify(mergeObj, null, 2)
                        : '(prázdné — Mailchimp merge_fields)';

                    const mainRow = (
                      <tr
                        key={r.id}
                        className={`border-b border-gray-50 last:border-0 ${expanded ? 'bg-fuchsia-50/50' : 'hover:bg-fuchsia-50/30'}`}
                      >
                        <td className="px-2 py-3 align-top">
                          <button
                            type="button"
                            onClick={() => toggleExpand(r.id)}
                            className="rounded-lg p-1 text-[#001161]/50 hover:bg-white hover:text-[#001161]"
                            aria-expanded={expanded}
                            title={expanded ? 'Sbalit detail' : 'Detail, tagy, aktivita'}
                          >
                            {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                          </button>
                        </td>
                        <td className="max-w-[200px] truncate px-4 py-3 font-mono text-[12px] text-[#001161]">{r.email}</td>
                        <td className="max-w-[140px] truncate px-4 py-3 text-[#001161]/80">{name}</td>
                        <td className="px-4 py-3 align-top">
                          <span className="inline-block rounded-md bg-gray-100 px-2 py-0.5 text-[11px] font-bold text-[#001161]/80">
                            {r.status}
                          </span>
                        </td>
                        <td className="max-w-[320px] min-w-[120px] px-3 py-2 align-middle">
                          <div
                            className="flex max-w-full flex-nowrap items-center gap-1 overflow-x-auto py-0.5 [scrollbar-width:thin]"
                            style={FF}
                          >
                            {metas.length === 0 ? (
                              <span className="shrink-0 text-[12px] text-[#001161]/35">—</span>
                            ) : (
                              metas.map((tm) => (
                                <span
                                  key={tm.tagId}
                                  title={`${tm.name}${tm.source === 'mailchimp' ? ' (Mailchimp)' : ''}`}
                                  className="shrink-0 whitespace-nowrap rounded bg-gray-100 px-1.5 py-0.5 text-[11px] text-[#001161]/85"
                                >
                                  {tm.name}
                                </span>
                              ))
                            )}
                          </div>
                        </td>
                        <td className="max-w-[220px] min-w-[120px] px-3 py-2 align-middle">
                          <div
                            className="flex max-w-full flex-nowrap items-center gap-1 overflow-x-auto py-0.5 [scrollbar-width:thin]"
                            style={FF}
                            title={
                              interests.length
                                ? interests.map((i) => `${i.label} ×${i.score}`).join(', ')
                                : undefined
                            }
                          >
                            {interests.length === 0 ? (
                              <span className="shrink-0 text-[12px] text-[#001161]/35">—</span>
                            ) : (
                              interests.map((i) => (
                                <span
                                  key={i.slug}
                                  className="shrink-0 whitespace-nowrap rounded bg-emerald-100/90 px-1.5 py-0.5 text-[11px] font-bold text-emerald-950/90"
                                >
                                  {i.label}
                                  <span className="ml-0.5 font-mono text-[10px] font-bold text-emerald-800/80">
                                    ×{i.score}
                                  </span>
                                </span>
                              ))
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-[#001161]/70">{r.source}</td>
                        <td className="px-4 py-3 text-[#001161]/70">{r.contact_type}</td>
                        <td
                          className="max-w-[200px] truncate px-4 py-3 text-[12px] text-[#001161]/75"
                          title={r.position_label || ''}
                        >
                          {r.position_label || '—'}
                        </td>
                        <td className="max-w-[160px] truncate px-4 py-3 text-[#001161]/60" title={r.school_name || ''}>
                          {r.school_name || r.ico || '—'}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-[12px] text-[#001161]/50">{updated}</td>
                      </tr>
                    );

                    const detailRow = expanded ? (
                      <tr key={`${r.id}-detail`} className="border-b border-gray-100 bg-[#fafbfd]">
                        <td colSpan={11} className="px-4 py-4">
                          <div className="mb-4 rounded-xl border border-sky-200/70 bg-sky-50/40 p-4">
                            <h3 style={FF} className="text-[11px] font-bold uppercase tracking-wide text-[#001161]/45">
                              Pozice (Mailchimp SELECT)
                            </h3>
                            <p style={FF} className="mt-1 text-[11px] leading-5 text-[#001161]/50">
                              Odděleně od tagů — jde o hodnotu z merge pole{' '}
                              <code className="rounded bg-white px-1 font-mono">SELECT</code> v Mailchimpu (např. učitelská
                              role).
                            </p>
                            <p style={FF} className="mt-2 text-[14px] font-bold text-[#001161]">
                              {r.position_label || '—'}
                            </p>
                          </div>
                          <div className="mb-4 rounded-xl border border-emerald-200/80 bg-emerald-50/50 p-4">
                            <h3 style={FF} className="text-[11px] font-bold uppercase tracking-wide text-[#001161]/45">
                              Zájmy o předmětech (auto)
                            </h3>
                            <p style={FF} className="mt-1 text-[11px] leading-5 text-[#001161]/50">
                              Skóre z tagů, pozice a merge fields — tlačítko „Přepočítat zájmy“ nahoře (dávky po 1000).
                              Vyšší číslo = silnější shoda klíčových slov. V tabulce je sloupec Zájmy.
                            </p>
                            {interests.length === 0 ? (
                              <p style={FF} className="mt-2 text-[12px] text-[#001161]/45">
                                Zatím žádné skóre u tohoto kontaktu — spusť přepočet, případně kontakt v datech nesedí na
                                heuristiku.
                              </p>
                            ) : (
                              <ul style={FF} className="mt-2 flex flex-wrap gap-2">
                                {interests.map(({ slug, label, score }) => (
                                  <li
                                    key={slug}
                                    className="rounded-lg bg-white px-2.5 py-1 text-[12px] font-bold text-[#001161] shadow-sm ring-1 ring-emerald-200/60"
                                    title={slug}
                                  >
                                    <span className="text-emerald-900">{label}</span>
                                    <span className="ml-1.5 font-mono text-[11px] text-[#001161]/60">×{score}</span>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                          <div className="mb-4 rounded-xl border border-fuchsia-200/60 bg-white p-4">
                            <h3 style={FF} className="text-[11px] font-bold uppercase tracking-wide text-[#001161]/45">
                              Tagy u tohoto kontaktu
                            </h3>
                            <div className="mt-2 flex flex-wrap gap-2">
                              {metas.length === 0 ? (
                                <span style={FF} className="text-[12px] text-[#001161]/45">
                                  Zatím žádné tagy.
                                </span>
                              ) : (
                                metas.map((tm) => (
                                  <span
                                    key={tm.tagId}
                                    className="inline-flex items-center gap-1 rounded-full bg-fuchsia-100/70 pl-2.5 pr-1 py-0.5 text-[12px] font-bold text-[#001161]"
                                    style={FF}
                                  >
                                    {tm.name}
                                    <span className="rounded bg-white/80 px-1 text-[9px] font-bold uppercase text-[#001161]/50">
                                      {tm.source === 'mailchimp' ? 'MC' : 'web'}
                                    </span>
                                    <button
                                      type="button"
                                      disabled={tagMutationBusy}
                                      onClick={() => {
                                        if (!confirm(`Odebrat tag „${tm.name}“ u tohoto kontaktu?`)) return;
                                        void patchSubscriberTags(r.id, { removeTagIds: [tm.tagId] });
                                      }}
                                      className="rounded-full p-0.5 text-[#001161]/40 hover:bg-fuchsia-200/50 hover:text-red-600 disabled:opacity-40"
                                      title="Odebrat tag"
                                    >
                                      <X className="h-3.5 w-3.5" />
                                    </button>
                                  </span>
                                ))
                              )}
                            </div>
                            <div className="mt-3 flex flex-wrap items-center gap-2">
                              <input
                                type="text"
                                value={expandedId === r.id ? tagAddInput : ''}
                                onChange={(e) => setTagAddInput(e.target.value)}
                                placeholder="Přidat tag (název)…"
                                className="min-w-[200px] flex-1 rounded-xl border border-gray-200 px-3 py-2 text-[13px] outline-none focus:border-fuchsia-400"
                                style={FF}
                                onKeyDown={(e) => {
                                  if (e.key !== 'Enter') return;
                                  const v = tagAddInput.trim();
                                  if (!v) return;
                                  void patchSubscriberTags(r.id, { addNames: [v] });
                                  setTagAddInput('');
                                }}
                              />
                              <button
                                type="button"
                                disabled={tagMutationBusy || !tagAddInput.trim()}
                                onClick={() => {
                                  const v = tagAddInput.trim();
                                  if (!v) return;
                                  void patchSubscriberTags(r.id, { addNames: [v] });
                                  setTagAddInput('');
                                }}
                                className="rounded-xl bg-[#001161] px-4 py-2 text-[12px] font-bold text-white disabled:opacity-50"
                                style={FF}
                              >
                                Přidat
                              </button>
                            </div>
                          </div>

                          <div className="grid gap-4 md:grid-cols-2">
                            <div>
                              <h3 style={FF} className="text-[11px] font-bold uppercase tracking-wide text-[#001161]/45">
                                Mailchimp merge fields
                              </h3>
                              <p style={FF} className="mt-1 text-[11px] leading-5 text-[#001161]/50">
                                Typ kontaktu (sloupec „Typ“) se odvozuje z polí jako CTYPE / CONTACT / ROLE. Pozice výše je z
                                pole SELECT. Když typ chybí, zůstane{' '}
                                <code className="rounded bg-white px-1 font-mono">unknown</code>.
                              </p>
                              <pre
                                className="mt-2 max-h-48 overflow-auto rounded-xl border border-gray-200 bg-white p-3 font-mono text-[11px] leading-relaxed text-[#001161]/80"
                                style={FF}
                              >
                                {mergePretty}
                              </pre>
                            </div>
                            <div className="space-y-4">
                              <div>
                                <h3 style={FF} className="text-[11px] font-bold uppercase tracking-wide text-[#001161]/45">
                                  Členství v seznamech (lists)
                                </h3>
                                <ul style={FF} className="mt-2 space-y-1.5 text-[12px] text-[#001161]/75">
                                  {(listsBySub[r.id] || []).length === 0 ? (
                                    <li className="text-[#001161]/45">Žádný záznam v subscriber_lists.</li>
                                  ) : (
                                    (listsBySub[r.id] || []).map((l, i) => (
                                      <li key={i}>
                                        <span className="font-bold text-[#001161]">{l.listName || l.listMcId || 'List'}</span>
                                        {l.listMcId && l.listName ? (
                                          <span className="font-mono text-[10px] text-[#001161]/40"> · {l.listMcId}</span>
                                        ) : null}
                                        <span className="ml-2 rounded bg-gray-200/80 px-1.5 py-0.5 text-[10px] font-bold">
                                          {l.status}
                                        </span>
                                      </li>
                                    ))
                                  )}
                                </ul>
                              </div>
                              <div>
                                <h3 style={FF} className="text-[11px] font-bold uppercase tracking-wide text-[#001161]/45">
                                  Technické
                                </h3>
                                <dl style={FF} className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[12px] text-[#001161]/70">
                                  <dt className="text-[#001161]/45">mc_member_id</dt>
                                  <dd className="font-mono text-[11px] break-all">{r.mc_member_id || '—'}</dd>
                                  <dt className="text-[#001161]/45">mc_list_id</dt>
                                  <dd className="font-mono text-[11px] break-all">{r.mc_list_id || '—'}</dd>
                                  <dt className="text-[#001161]/45">Telefon</dt>
                                  <dd>{r.phone || '—'}</dd>
                                  <dt className="text-[#001161]/45">IČ</dt>
                                  <dd>{r.ico || '—'}</dd>
                                  <dt className="text-[#001161]/45">Engagement</dt>
                                  <dd>{r.engagement_score ?? '—'}</dd>
                                  <dt className="text-[#001161]/45">Posl. otevření / klik</dt>
                                  <dd className="text-[11px]">
                                    {r.last_opened_at
                                      ? new Date(r.last_opened_at).toLocaleString('cs-CZ')
                                      : '—'}{' '}
                                    /{' '}
                                    {r.last_clicked_at
                                      ? new Date(r.last_clicked_at).toLocaleString('cs-CZ')
                                      : '—'}
                                  </dd>
                                  <dt className="text-[#001161]/45">Opt-in / opt-out</dt>
                                  <dd className="text-[11px]">
                                    {r.subscribed_at
                                      ? new Date(r.subscribed_at).toLocaleString('cs-CZ')
                                      : '—'}{' '}
                                    /{' '}
                                    {r.unsubscribed_at
                                      ? new Date(r.unsubscribed_at).toLocaleString('cs-CZ')
                                      : '—'}
                                  </dd>
                                </dl>
                              </div>
                            </div>
                          </div>
                          <div className="mt-4 border-t border-gray-200 pt-4">
                            <h3 style={FF} className="text-[11px] font-bold uppercase tracking-wide text-[#001161]/45">
                              Nedávná aktivita (email_events)
                            </h3>
                            <p style={FF} className="mt-1 text-[11px] text-[#001161]/50">
                              Naplní se importem s volbou „Včetně aktivity“ v migraci, jinak bude prázdné.
                            </p>
                            {eventsLoadingId === r.id ? (
                              <div className="mt-3 flex items-center gap-2 text-[12px] text-[#001161]/50">
                                <Loader2 className="h-4 w-4 animate-spin" /> Načítám události…
                              </div>
                            ) : !events || events.length === 0 ? (
                              <p style={FF} className="mt-2 text-[12px] text-[#001161]/45">
                                Žádné uložené události pro tento kontakt.
                              </p>
                            ) : (
                              <ul style={FF} className="mt-2 max-h-40 divide-y divide-gray-100 overflow-y-auto rounded-xl border border-gray-200 bg-white text-[12px]">
                                {events.map((ev, i) => {
                                  const when = new Date(ev.occurred_at).toLocaleString('cs-CZ', {
                                    day: 'numeric',
                                    month: 'short',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  });
                                  const camp =
                                    ev.campaigns?.subject_line || ev.campaigns?.name || null;
                                  return (
                                    <li key={i} className="flex flex-wrap items-baseline gap-x-2 px-3 py-2">
                                      <span className="font-bold capitalize text-fuchsia-800">{ev.event_type}</span>
                                      <span className="text-[#001161]/45">{when}</span>
                                      {camp ? (
                                        <span className="min-w-0 truncate text-[#001161]/65" title={camp}>
                                          {camp}
                                        </span>
                                      ) : null}
                                    </li>
                                  );
                                })}
                              </ul>
                            )}
                          </div>
                        </td>
                      </tr>
                    ) : null;

                    return detailRow ? [mainRow, detailRow] : [mainRow];
                  })
                )}
              </tbody>
            </table>
          </div>

          {showPager && !loading && rows.length > 0 && (
            <div className="flex items-center justify-end gap-2 border-t border-gray-100 px-4 py-3">
              <button
                type="button"
                disabled={page <= 0 || loading}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                className="rounded-lg border border-gray-200 px-3 py-1.5 text-[12px] font-bold text-[#001161] disabled:opacity-40"
                style={FF}
              >
                Předchozí
              </button>
              <button
                type="button"
                disabled={page >= totalPages - 1 || loading}
                onClick={() => setPage((p) => p + 1)}
                className="rounded-lg border border-gray-200 px-3 py-1.5 text-[12px] font-bold text-[#001161] disabled:opacity-40"
                style={FF}
              >
                Další
              </button>
            </div>
          )}
        </div>

        <p style={FF} className="mt-4 text-[12px] leading-6 text-[#001161]/45">
          Marketingová záložka „Kontakty“ pořád ukazuje starší KV snapshot z Mailchimpu — tady jde o nový model{' '}
          <code className="rounded bg-gray-100 px-1 font-mono text-[11px]">public.subscribers</code> a tagy v{' '}
          <code className="rounded bg-gray-100 px-1 font-mono text-[11px]">public.tags</code>.
        </p>
      </div>
    </div>
  );
}
