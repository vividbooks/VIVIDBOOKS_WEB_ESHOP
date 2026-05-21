import { useState, useMemo, useEffect, type ChangeEvent } from 'react';
import { Link } from 'react-router';
import {
  Upload, AlertCircle, CheckCircle, Database, Loader2, ArrowRight, Eye, FileText, Bug, Radio, Newspaper,
  ImageIcon, FolderSync, Video, RefreshCw, LayoutGrid, Code2, ArrowRightLeft, Store, Sparkles, Mail,
} from 'lucide-react';
import { projectId, publicAnonKey } from '../../utils/supabase/info';
import { fetchProducts, seedCollection } from '../../utils/adminApi';
import { eshopUrl } from '../../utils/publicSiteUrl';
import {
  parseShoptetProductsCompleteXml,
  summarizeShoptetImportByCategory,
  SHOPTET_IMPORT_ALLOWED_ROOTS,
  type ShoptetMerchMergedProduct,
} from '../../utils/shoptetProductsXmlImport';
import { BLOG_POSTS } from '../../data/blogPosts';
import { NOVINKA_POSTS } from '../../data/novinkaPosts';
import { WEBINARS } from '../../data/webinars';
import { getMethodPrinciplesTemplateForSlug } from '../../data/subjectMethodPrinciples';
import {
  matchFilesToPrincipleIndices,
  mergeMethodPrinciplesWithTemplate,
  methodPrincipleTitleToFileStem,
  type PrincipleMatch,
} from '../../utils/methodPrinciplesImageBulk';
import { toast } from 'sonner@2.0.3';

const SERVER = `https://${projectId}.supabase.co/functions/v1/make-server-93a20b6f`;
const AUTH = (key: string) => ({ Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' });
const UPLOAD_AUTH_HEADERS = { Authorization: `Bearer ${publicAnonKey}` };

type McAudienceKey = 'newsletter' | 'no_newsletter' | 'primary';

type McBatchLocalState = {
  resumeFrom: { offset: number; skipInPage: number } | null;
  membersPerRun: number;
  updatedAt: string;
  lastMembersSynced?: number;
  mailchimpTotal?: number;
  lastMembersImportHasMore?: boolean;
};

const MC_BATCH_LS = 'vividbooks_mailchimp_batch_v1';

function mcBatchStorageKey(audience: McAudienceKey): string {
  return `${MC_BATCH_LS}:${audience}`;
}

function readMcBatchLocal(audience: McAudienceKey): McBatchLocalState | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(mcBatchStorageKey(audience));
    if (!raw) return null;
    const p = JSON.parse(raw) as Partial<McBatchLocalState>;
    if (typeof p.membersPerRun !== 'number' || typeof p.updatedAt !== 'string') return null;
    if (p.resumeFrom != null) {
      if (typeof p.resumeFrom.offset !== 'number' || typeof p.resumeFrom.skipInPage !== 'number') return null;
    }
    return {
      resumeFrom: p.resumeFrom ?? null,
      membersPerRun: p.membersPerRun,
      updatedAt: p.updatedAt,
      lastMembersSynced: typeof p.lastMembersSynced === 'number' ? p.lastMembersSynced : undefined,
      mailchimpTotal: typeof p.mailchimpTotal === 'number' ? p.mailchimpTotal : undefined,
      lastMembersImportHasMore: typeof p.lastMembersImportHasMore === 'boolean' ? p.lastMembersImportHasMore : undefined,
    };
  } catch {
    return null;
  }
}

function writeMcBatchLocal(audience: McAudienceKey, state: McBatchLocalState): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(mcBatchStorageKey(audience), JSON.stringify(state));
}

function clearMcBatchLocal(audience: McAudienceKey): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(mcBatchStorageKey(audience));
}

const MC_AUDIENCE_LABEL: Record<McAudienceKey, string> = {
  newsletter: 'Newsletter',
  no_newsletter: 'Bez newsletteru',
  primary: 'Primární',
};

export default function MigrationPage() {
  const [isMigrating, setIsMigrating] = useState(false);
  const [customIds, setCustomIds] = useState({
    digital: '68fcbc58bae5a1ec053b1c40',
    print: '64135780db7f1b2187727635',
  });

  // Blog Webflow import state
  const [blogStatus, setBlogStatus] = useState<'idle' | 'previewing' | 'importing'>('idle');
  const [blogPreview, setBlogPreview] = useState<any>(null);

  // Webinář Webflow import state
  const [webinarId, setWebinarId] = useState('64135780db7f1bdff5727631');
  const [webinarStatus, setWebinarStatus] = useState<'idle' | 'previewing' | 'importing'>('idle');
  const [webinarPreview, setWebinarPreview] = useState<any>(null);
  const [webinarResult, setWebinarResult] = useState<any>(null);

  // Novinky Webflow import state
  const [novinkyId] = useState('67c5f807aba1fc4614283bfe');
  const [novinkyStatus, setNovinkyStatus] = useState<'idle' | 'previewing' | 'importing'>('idle');
  const [novinkyPreview, setNovinkyPreview] = useState<any>(null);
  const [novinkyResult, setNovinkyResult] = useState<any>(null);

  // Debug raw Webflow JSON
  const [debugLoading, setDebugLoading] = useState(false);
  const [debugData, setDebugData] = useState<any>(null);

  // Debug webinářů
  const [debugWebinarLoading, setDebugWebinarLoading] = useState(false);
  const [debugWebinarData, setDebugWebinarData] = useState<any>(null);

  // Image migration state
  const [imgCollections, setImgCollections] = useState({
    products: true,
    blog: true,
    novinky: true,
    webinars: true,
  });
  const [imgMigrating, setImgMigrating] = useState(false);
  const [imgResult, setImgResult] = useState<any>(null);

  /** Mailchimp → Postgres (`subscribers`, kampaně, volitelně události) */
  const [mcMigrateBusy, setMcMigrateBusy] = useState(false);
  const [mcMigrateResult, setMcMigrateResult] = useState<Record<string, unknown> | null>(null);
  const [mcAudience, setMcAudience] = useState<McAudienceKey>('newsletter');
  const [mcIncludeActivity, setMcIncludeActivity] = useState(false);
  const [mcMembersPerRun, setMcMembersPerRun] = useState(() => readMcBatchLocal('newsletter')?.membersPerRun ?? 2000);
  const [mcResumeCursor, setMcResumeCursor] = useState<{ offset: number; skipInPage: number } | null>(
    () => readMcBatchLocal('newsletter')?.resumeFrom ?? null,
  );
  /** Poslední uložený stav dávky (localStorage) pro zobrazení po obnovení stránky. */
  const [mcBatchLocalInfo, setMcBatchLocalInfo] = useState<McBatchLocalState | null>(() => readMcBatchLocal('newsletter'));

  useEffect(() => {
    const loaded = readMcBatchLocal(mcAudience);
    setMcBatchLocalInfo(loaded);
    setMcResumeCursor(loaded?.resumeFrom ?? null);
    if (loaded) setMcMembersPerRun(loaded.membersPerRun);
  }, [mcAudience]);

  /** Metodické principy — hromadné obrázky podle názvu souboru */
  const [mpiSubjects, setMpiSubjects] = useState<any[] | null>(null);
  const [mpiSubjectId, setMpiSubjectId] = useState('');
  const [mpiBusy, setMpiBusy] = useState(false);
  const [mpiPreview, setMpiPreview] = useState<{ matches: PrincipleMatch[]; unmatchedFiles: string[] } | null>(null);

  // DVPP Videa sync state
  const [dvppStatus, setDvppStatus] = useState<'idle' | 'syncing' | 'done' | 'error'>('idle');
  const [dvppResult, setDvppResult] = useState<any>(null);
  const [dvppDebugLoading, setDvppDebugLoading] = useState(false);
  const [dvppDebugData, setDvppDebugData] = useState<any>(null);
  const [dvppDebugCollectionId, setDvppDebugCollectionId] = useState('66b119eaa0271061207bdd18');

  // ── Taby z Webflow state ──────────────────────────────────────
  const [tabsId, setTabsId] = useState('67efdf2e531b09c85dc3132e');
  const [tabsStatus, setTabsStatus] = useState<'idle' | 'previewing' | 'importing'>('idle');
  const [tabsPreview, setTabsPreview] = useState<any>(null);
  const [tabsResult, setTabsResult] = useState<any>(null);
  const [tabsMapping, setTabsMapping] = useState<Record<string,string>>({});
  const [tabsForceSubject, setTabsForceSubject] = useState('');
  const [subjectList, setSubjectList] = useState<string[]>([]);
  const [tabsDiagLoading, setTabsDiagLoading] = useState(false);
  const [tabsDiag, setTabsDiag] = useState<any>(null);

  // ── Generický JSON import state ──────────────────────────────
  const [jsonText, setJsonText] = useState('');
  const [jsonCollection, setJsonCollection] = useState('tabs');
  const [jsonAppend, setJsonAppend] = useState(true);
  const [jsonStatus, setJsonStatus] = useState<'idle' | 'importing'>('idle');
  const [jsonParsed, setJsonParsed] = useState<any[] | null>(null);
  const [jsonError, setJsonError] = useState('');
  const [jsonMapping, setJsonMapping] = useState<Record<string,string>>({});
  const [jsonResult, setJsonResult] = useState<any>(null);

  // Shoptet productsComplete.xml → merch
  const [shoptetUrl, setShoptetUrl] = useState('');
  const [shoptetFileName, setShoptetFileName] = useState('');
  const [shoptetStatus, setShoptetStatus] = useState<'idle' | 'loading' | 'importing'>('idle');
  const [shoptetPreview, setShoptetPreview] = useState<ShoptetMerchMergedProduct[] | null>(null);
  const [shoptetByCat, setShoptetByCat] = useState<Record<string, number> | null>(null);
  const [shoptetSkipExisting, setShoptetSkipExisting] = useState(true);
  const [shoptetImportResult, setShoptetImportResult] = useState<{ ok: number; skipped: number; fail: number } | null>(null);
  /** Které konkrétní varianty (id řádku) se mají importovat — po načtení XML defaultně vše zaškrtnuto. */
  const [shoptetRowSelected, setShoptetRowSelected] = useState<Record<string, boolean>>({});

  const shoptetRowsToImport = useMemo(() => {
    if (!shoptetPreview?.length) return [];
    return shoptetPreview.filter((p) => shoptetRowSelected[p.id]);
  }, [shoptetPreview, shoptetRowSelected]);

  const applyShoptetXml = (xml: string, toastLabel?: string) => {
    const products = parseShoptetProductsCompleteXml(xml);
    const byCat = summarizeShoptetImportByCategory(products);
    const selected: Record<string, boolean> = {};
    for (const p of products) selected[p.id] = true;
    setShoptetRowSelected(selected);
    setShoptetPreview(products);
    setShoptetByCat(byCat);
    setShoptetImportResult(null);
    toast.success(
      toastLabel
        ? `Načteno ${products.length} variant (${toastLabel}).`
        : `Načteno ${products.length} variant.`,
    );
  };

  const handleShoptetLoadUrl = async () => {
    const u = shoptetUrl.trim();
    if (!u) {
      toast.error('Zadej URL exportu z Shoptetu.');
      return;
    }
    try {
      const parsed = new URL(u);
      const h = parsed.searchParams.get('hash');
      if (!h || !h.trim()) {
        toast.error(
          'V URL chybí parametr hash=… Z administrace Shoptetu zkopíruj celý odkaz u exportu productsComplete (bez něj eshop vrací 404).',
        );
        return;
      }
    } catch {
      toast.error('Neplatná URL.');
      return;
    }
    setShoptetStatus('loading');
    setShoptetImportResult(null);
    try {
      const res = await fetch(`${SERVER}/admin/shoptet-products-xml-fetch`, {
        method: 'POST',
        headers: AUTH(publicAnonKey),
        body: JSON.stringify({ url: u }),
      });
      const data = await safeJson(res);
      if (data.error) {
        toast.error(String(data.error));
        return;
      }
      if (typeof data.xml !== 'string') {
        toast.error('Neočekávaná odpověď serveru.');
        return;
      }
      applyShoptetXml(data.xml, 'URL');
    } catch (e: any) {
      toast.error(e.message || 'Stažení XML selhalo.');
    } finally {
      setShoptetStatus('idle');
    }
  };

  const handleShoptetFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setShoptetFileName(f.name);
    setShoptetStatus('loading');
    setShoptetImportResult(null);
    try {
      const text = await f.text();
      applyShoptetXml(text, f.name);
    } catch (err: any) {
      toast.error(err.message || 'Čtení souboru selhalo.');
    } finally {
      setShoptetStatus('idle');
      e.target.value = '';
    }
  };

  const handleShoptetImport = async () => {
    if (!shoptetPreview?.length) {
      toast.error('Nejdřív načti XML (tlačítkem u URL nebo výběrem souboru).');
      return;
    }
    if (shoptetRowsToImport.length === 0) {
      toast.error('Zaškrtni alespoň jednu variantu v tabulce.');
      return;
    }
    if (
      !confirm(
        `Importovat ${shoptetRowsToImport.length} produktů (merch, včetně variant uvnitř) do katalogu? ${
          shoptetSkipExisting ? 'Záznamy se stejným ID už v katalogu jsou přeskočeny.' : 'Pozor: bez přeskakování může vzniknout duplicita se stejným id.'
        }`,
      )
    )
      return;
    setShoptetStatus('importing');
    setShoptetImportResult(null);
    let existing = new Set<string>();
    if (shoptetSkipExisting) {
      try {
        const list = await fetchProducts();
        existing = new Set(list.map((p: { id?: string }) => String(p.id)));
      } catch {
        toast.error('Nepodařilo se načíst stávající produkty.');
        setShoptetStatus('idle');
        return;
      }
    }
    let ok = 0;
    let skipped = 0;
    let fail = 0;
    for (const p of shoptetRowsToImport) {
      if (shoptetSkipExisting && existing.has(p.id)) {
        skipped++;
        continue;
      }
      try {
        const res = await fetch(`${SERVER}/products`, {
          method: 'POST',
          headers: AUTH(publicAnonKey),
          body: JSON.stringify(p),
        });
        const data = await safeJson(res);
        if (res.ok && data.success !== false) {
          ok++;
          existing.add(p.id);
        } else fail++;
      } catch {
        fail++;
      }
    }
    setShoptetImportResult({ ok, skipped, fail });
    setShoptetStatus('idle');
    if (fail === 0) toast.success(`Import hotov: ${ok} nových, ${skipped} přeskočeno.`);
    else toast.warning(`Import dokončen s chybami: ${ok} OK, ${skipped} přeskočeno, ${fail} selhalo.`);
  };

  const handleWebflowMigrate = async () => {
    if (!confirm('Tímto přemažete všechna produktová data v Supabase daty z Webflow. Pokračovat?')) return;
    setIsMigrating(true);
    try {
      const response = await fetch(`${SERVER}/import-webflow`, {
        method: 'POST',
        headers: AUTH(publicAnonKey),
        body: JSON.stringify({ digitalId: customIds.digital, printId: customIds.print }),
      });
      const data = await response.json();
      if (data.success) {
        toast.success(`Migrace úspěšná! ${data.count} produktů naimportováno.`);
      } else {
        toast.error(`Chyba migrace: ${data.details || data.error}`);
      }
    } catch (e) {
      toast.error('Migrace selhala: síťová chyba');
    } finally {
      setIsMigrating(false);
    }
  };

  const handleSeedAll = async () => {
    if (!confirm('Tímto naimportujete statická data (blog, novinky, webináře) do Supabase. Pokračovat?')) return;
    setIsMigrating(true);
    try {
      await Promise.all([
        seedCollection('blog', BLOG_POSTS),
        seedCollection('novinky', NOVINKA_POSTS),
        seedCollection('webinare', WEBINARS),
      ]);
      toast.success('Všechna statická data naimportována!');
    } catch (e: any) {
      toast.error(`Seed selhal: ${e.message}`);
    } finally {
      setIsMigrating(false);
    }
  };

  // Safe JSON parser — vždy zobrazí raw text při chybě
  const safeJson = async (res: Response) => {
    const text = await res.text();
    try {
      return JSON.parse(text);
    } catch (_e) {
      throw new Error(`Server nevrátil JSON (status ${res.status}): ${text.slice(0, 300)}`);
    }
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${SERVER}/admin/predmety`, { headers: { Authorization: `Bearer ${publicAnonKey}` } });
        const data = await res.json();
        if (!cancelled && Array.isArray(data.items)) setMpiSubjects(data.items);
      } catch {
        if (!cancelled) toast.error('Nepodařilo se načíst předměty (metodické obrázky).');
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const mpiSelected = useMemo(
    () => (mpiSubjects && mpiSubjectId ? mpiSubjects.find((s: any) => s.id === mpiSubjectId) : null),
    [mpiSubjects, mpiSubjectId],
  );
  const mpiTemplate = useMemo(
    () => (mpiSelected?.slug ? getMethodPrinciplesTemplateForSlug(String(mpiSelected.slug)) : null),
    [mpiSelected],
  );
  const mpiWorkingRows = useMemo(() => {
    if (!mpiSelected) return [];
    const existing = Array.isArray(mpiSelected.methodPrinciplesItems) ? mpiSelected.methodPrinciplesItems : [];
    if (mpiTemplate && mpiTemplate.length > 0) {
      return mergeMethodPrinciplesWithTemplate(mpiTemplate, existing);
    }
    if (existing.length > 0) {
      return existing.map((x: any) => ({ ...x }));
    }
    return [];
  }, [mpiSelected, mpiTemplate]);

  useEffect(() => {
    setMpiPreview(null);
  }, [mpiSubjectId]);

  const handleMpiFilesChosen = (e: ChangeEvent<HTMLInputElement>) => {
    const list = e.target.files;
    if (!list?.length) {
      e.target.value = '';
      return;
    }
    if (!mpiWorkingRows.length) {
      toast.error('Nejdřív vyber předmět se šablonou nebo s už vyplněnými kartami v CMS.');
      e.target.value = '';
      return;
    }
    const files = [...list];
    const matches = matchFilesToPrincipleIndices(files, mpiWorkingRows);
    const matchedNames = new Set(matches.map((m) => m.file.name));
    const unmatchedFiles = files.filter((f) => !matchedNames.has(f.name)).map((f) => f.name);
    setMpiPreview({ matches, unmatchedFiles });
    if (unmatchedFiles.length) {
      toast.warning(`Nespárováno ${unmatchedFiles.length} souborů — zkontroluj název (slug z nadpisu).`);
    }
    e.target.value = '';
  };

  const handleMpiApply = async () => {
    if (!mpiPreview?.matches.length || !mpiSelected) {
      toast.error('Vyber předmět a soubory, které se podařilo spárovat.');
      return;
    }
    if (!mpiWorkingRows.length) {
      toast.error('Žádné metodické karty — vyplň je v Předmětech u tohoto předmětu.');
      return;
    }
    if (
      !confirm(
        `Nahrát ${mpiPreview.matches.length} obrázků a uložit předmět „${mpiSelected.displayName || mpiSelected.slug}“?`,
      )
    ) {
      return;
    }
    setMpiBusy(true);
    try {
      const items = mpiWorkingRows.map((x: any) => ({ ...x }));
      for (const m of mpiPreview.matches) {
        const fd = new FormData();
        fd.append('file', m.file);
        const res = await fetch(`${SERVER}/upload-image`, { method: 'POST', headers: UPLOAD_AUTH_HEADERS, body: fd });
        const data = await res.json();
        if (!data.url) throw new Error(data.error || `Upload selhal: ${m.file.name}`);
        items[m.index] = { ...items[m.index], imageUrl: data.url };
      }
      const putRes = await fetch(`${SERVER}/admin/predmety/${encodeURIComponent(mpiSelected.id)}`, {
        method: 'PUT',
        headers: AUTH(publicAnonKey),
        body: JSON.stringify({ methodPrinciplesItems: items }),
      });
      const putData = await safeJson(putRes);
      if (putData.error) throw new Error(String(putData.error));
      toast.success(`Uloženo — ${mpiPreview.matches.length} obrázků přiřazeno ke kartám.`);
      setMpiSubjects((prev) =>
        prev ? prev.map((s: any) => (s.id === mpiSelected.id ? { ...s, methodPrinciplesItems: items } : s)) : null,
      );
      setMpiPreview(null);
    } catch (err: any) {
      toast.error(err.message || 'Ukládání selhalo.');
    } finally {
      setMpiBusy(false);
    }
  };

  const handleBlogPreview = async () => {
    setBlogStatus('previewing');
    setBlogPreview(null);
    try {
      const res = await fetch(`${SERVER}/import-webflow`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${publicAnonKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'preview-blog' }),
      });
      const data = await safeJson(res);
      if (data.error) { toast.error(`Preview chyba: ${data.error}`); setBlogStatus('idle'); return; }
      setBlogPreview(data);
      toast.success(`Preview OK — ${data.count} příspěvků v kolekci.`);
    } catch (e: any) {
      toast.error(`Preview selhal: ${e.message}`);
    } finally {
      setBlogStatus('idle');
    }
  };

  const handleBlogImport = async () => {
    if (!confirm('Přepíše stávající blog příspěvky v Supabase daty z Webflow. Pokračovat?')) return;
    setBlogStatus('importing');
    try {
      const res = await fetch(`${SERVER}/import-webflow`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${publicAnonKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'import-blog' }),
      });
      const data = await safeJson(res);
      if (data.success) {
        toast.success(`Blog naimportován! ${data.count} příspěvků uloženo.`);
        setBlogPreview(null);
      } else {
        toast.error(`Chyba importu: ${data.details || data.error}`);
      }
    } catch (e: any) {
      toast.error(`Import selhal: ${e.message}`);
    } finally {
      setBlogStatus('idle');
    }
  };

  // ── Webinář handlers ───────────────────────────────────────────
  const handleWebinarPreview = async () => {
    setWebinarStatus('previewing');
    setWebinarPreview(null);
    setWebinarResult(null);
    try {
      const res = await fetch(`${SERVER}/import-webflow`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${publicAnonKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'preview-webinare', webinarId }),
      });
      const data = await safeJson(res);
      if (data.error) { toast.error(`Preview chyba: ${data.error}`); setWebinarStatus('idle'); return; }
      setWebinarPreview(data);
      toast.success(`Preview OK — ${data.count} webinářů v kolekci.`);
    } catch (e: any) {
      toast.error(`Preview selhal: ${e.message}`);
    } finally {
      setWebinarStatus('idle');
    }
  };

  const handleWebinarImport = async () => {
    if (!confirm('Přepíše stávající webináře v Supabase daty z Webflow. Pokračovat?')) return;
    setWebinarStatus('importing');
    setWebinarResult(null);
    try {
      const res = await fetch(`${SERVER}/import-webflow`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${publicAnonKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'import-webinare', webinarId }),
      });
      const data = await safeJson(res);
      if (data.success) {
        toast.success(`Webináře naimportovány! ${data.count} webinářů uloženo.`);
        setWebinarPreview(null);
        setWebinarResult(data);
      } else {
        toast.error(`Chyba importu: ${data.details || data.error}`);
      }
    } catch (e: any) {
      toast.error(`Import selhal: ${e.message}`);
    } finally {
      setWebinarStatus('idle');
    }
  };

  const handleNovinkyPreview = async () => {
    setNovinkyStatus('previewing');
    setNovinkyPreview(null);
    setNovinkyResult(null);
    try {
      const res = await fetch(`${SERVER}/import-webflow`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${publicAnonKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'preview-novinky', novinkyId }),
      });
      const data = await safeJson(res);
      if (data.error) { toast.error(`Preview chyba: ${data.error}`); setNovinkyStatus('idle'); return; }
      setNovinkyPreview(data);
      toast.success(`Preview OK — ${data.count} novinek v kolekci.`);
    } catch (e: any) {
      toast.error(`Preview selhal: ${e.message}`);
    } finally {
      setNovinkyStatus('idle');
    }
  };

  const handleNovinkyImport = async () => {
    if (!confirm('Přepíše stávající novinky v Supabase daty z Webflow. Pokračovat?')) return;
    setNovinkyStatus('importing');
    setNovinkyResult(null);
    try {
      const res = await fetch(`${SERVER}/import-webflow`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${publicAnonKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'import-novinky', novinkyId }),
      });
      const data = await safeJson(res);
      if (data.success) {
        toast.success(`Novinky naimportovány! ${data.count} novinek uloženo.`);
        setNovinkyPreview(null);
        setNovinkyResult(data);
      } else {
        toast.error(`Chyba importu: ${data.details || data.error}`);
      }
    } catch (e: any) {
      toast.error(`Import selhal: ${e.message}`);
    } finally {
      setNovinkyStatus('idle');
    }
  };

  const handleImageMigration = async () => {
    const selected = Object.entries(imgCollections)
      .filter(([, v]) => v)
      .map(([k]) => k);
    if (selected.length === 0) {
      toast.error('Vyber alespon jednu kolekci.');
      return;
    }
    if (!confirm(`Spustit migraci obrázků pro: ${selected.join(', ')}?\n\nObrázky budou staženy z Webflow a uloženy do Supabase Storage. Existující URL budou přepsány novými.`)) return;

    setImgMigrating(true);
    setImgResult(null);
    try {
      const res = await fetch(`${SERVER}/migrate-images`, {
        method: 'POST',
        headers: AUTH(publicAnonKey),
        body: JSON.stringify({ collections: selected }),
      });
      const data = await safeJson(res);
      if (data.success) {
        setImgResult(data);
        toast.success(`Migrace obrázků hotova! Celkem migrováno: ${data.totalMigrated} obrázků.`);
      } else {
        toast.error(`Chyba migrace obrázků: ${data.error || data.details}`);
      }
    } catch (e: any) {
      toast.error(`Migrace obrázků selhala: ${e.message}`);
    } finally {
      setImgMigrating(false);
    }
  };

  const handleMailchimpContactsMigrate = async (mode: 'full' | 'sample' | 'batch') => {
    const isSample = mode === 'sample';
    const isBatch = mode === 'batch';
    if (isSample) {
      if (
        !confirm(
          'Otestovat import jen prvních 10 kontaktů z vybrané audience? Kampaně se i tak naimportují celé z účtu Mailchimp.',
        )
      ) {
        return;
      }
    } else if (isBatch) {
      const n = Math.min(10_000, Math.max(1, Math.floor(mcMembersPerRun) || 2000));
      if (
        !confirm(
          `Postupný import: dávky po max. ${n} členech, další dávka se spustí automaticky až do konce listu.${mcResumeCursor ? ' Začínáme od uložené pozice v Mailchimp API.' : ''} Nech tuto stránku otevřenou. Kampaně a případná aktivita se doplní až po poslední dávce.`,
        )
      ) {
        return;
      }
    } else {
      const n = Math.min(10_000, Math.max(1, Math.floor(mcMembersPerRun) || 2000));
      if (
        !confirm(
          `Celý list: automaticky poběží dávky po ${n} členech (opakované volání Edge funkce, bez jednoho dlouhého běhu). Nech stránku otevřenou. Naplní subscribers, tagy, kampaně; import je idempotentní (upsert).`,
        )
      ) {
        return;
      }
    }
    setMcMigrateBusy(true);
    if (mode === 'full') {
      setMcResumeCursor(null);
      clearMcBatchLocal(mcAudience);
      setMcBatchLocalInfo(null);
    }
    setMcMigrateResult(null);
    try {
      const batchN = Math.min(10_000, Math.max(1, Math.floor(mcMembersPerRun) || 2000));

      if (isSample) {
        const res = await fetch(`${SERVER}/admin/migrate-mailchimp-contacts`, {
          method: 'POST',
          headers: AUTH(publicAnonKey),
          body: JSON.stringify({
            audience: mcAudience,
            includeActivity: mcIncludeActivity,
            maxMembers: 10,
          }),
        });
        const data = await safeJson(res);
        setMcMigrateResult(data);
        if (data.ok) {
          toast.success(
            `Mailchimp: ${data.membersSynced ?? 0} členů, ${data.campaignsUpserted ?? 0} kampaní.` +
              (data.emailEventsUpserted ? ` Události: ${data.emailEventsUpserted}.` : ''),
          );
          if (data.warning) toast.message(String(data.warning));
        } else {
          toast.error(String(data.error || 'Migrace kontaktů selhala'));
        }
        return;
      }

      /** Celý list i „postupně“ jedou stejnou smyčkou; další dávka se spustí sama. */
      const runChained = isBatch || mode === 'full';
      let cursor: { offset: number; skipInPage: number } | null = isBatch ? mcResumeCursor : null;
      let totalMembersSynced = 0;
      let batchIdx = 0;
      let lastWarning: string | undefined;

      while (runChained) {
        batchIdx++;
        const res = await fetch(`${SERVER}/admin/migrate-mailchimp-contacts`, {
          method: 'POST',
          headers: AUTH(publicAnonKey),
          body: JSON.stringify({
            audience: mcAudience,
            includeActivity: mcIncludeActivity,
            membersPerRun: batchN,
            ...(cursor ? { resumeFrom: cursor } : {}),
          }),
        });
        const data = await safeJson(res);
        if (typeof data.membersSynced === 'number') totalMembersSynced += data.membersSynced;
        if (data.warning) lastWarning = String(data.warning);

        setMcMigrateResult({
          ...data,
          _mailchimpChained: {
            batchIndex: batchIdx,
            totalMembersSyncedSoFar: totalMembersSynced,
            resumeFrom: cursor,
          },
        });

        if (!data.ok) {
          toast.error(String(data.error || 'Migrace kontaktů selhala'));
          break;
        }

        const more = Boolean(data.membersImportHasMore);
        let nextCursor: { offset: number; skipInPage: number } | null = null;
        if (more) {
          if (data.nextResume && typeof data.nextResume === 'object') {
            const nr = data.nextResume as { offset?: unknown; skipInPage?: unknown };
            if (typeof nr.offset === 'number' && typeof nr.skipInPage === 'number') {
              nextCursor = { offset: nr.offset, skipInPage: nr.skipInPage };
            }
          }
          if (!nextCursor) {
            toast.error(
              'Odpověď hlásí další dávku, ale chybí platné nextResume — automatické pokračování zastaveno. Zkontroluj JSON níže.',
            );
            setMcResumeCursor(cursor);
            const batchSnapshot: McBatchLocalState = {
              resumeFrom: cursor,
              membersPerRun: batchN,
              updatedAt: new Date().toISOString(),
              lastMembersSynced: typeof data.membersSynced === 'number' ? data.membersSynced : undefined,
              mailchimpTotal:
                typeof data.mailchimpMembersApiTotalItems === 'number'
                  ? data.mailchimpMembersApiTotalItems
                  : undefined,
              lastMembersImportHasMore: true,
            };
            writeMcBatchLocal(mcAudience, batchSnapshot);
            setMcBatchLocalInfo(batchSnapshot);
            break;
          }
        }

        if (!more) nextCursor = null;
        cursor = nextCursor;
        setMcResumeCursor(nextCursor);

        const batchSnapshot: McBatchLocalState = {
          resumeFrom: nextCursor,
          membersPerRun: batchN,
          updatedAt: new Date().toISOString(),
          lastMembersSynced: typeof data.membersSynced === 'number' ? data.membersSynced : undefined,
          mailchimpTotal:
            typeof data.mailchimpMembersApiTotalItems === 'number' ? data.mailchimpMembersApiTotalItems : undefined,
          lastMembersImportHasMore: more,
        };
        writeMcBatchLocal(mcAudience, batchSnapshot);
        setMcBatchLocalInfo(batchSnapshot);

        if (!more) {
          const lastCamp = typeof data.campaignsUpserted === 'number' ? data.campaignsUpserted : 0;
          const lastEv = typeof data.emailEventsUpserted === 'number' ? data.emailEventsUpserted : 0;
          setMcMigrateResult({
            ...data,
            _mailchimpChainedSummary: {
              batches: batchIdx,
              totalMembersSynced,
            },
          });
          toast.success(
            `Mailchimp hotovo: ${batchIdx} dávek, celkem ${totalMembersSynced} kontaktů v tomto běhu. ` +
              `Kampaně (poslední dávka): ${lastCamp}.` +
              (lastEv ? ` Události: ${lastEv}.` : ''),
          );
          if (lastWarning) toast.message(lastWarning);
          break;
        }

        toast.message(`Dávka ${batchIdx}: +${data.membersSynced ?? 0} kontaktů (celkem ${totalMembersSynced}). Spouštím další…`);
        await new Promise(r => setTimeout(r, 350));
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Migrace selhala');
    } finally {
      setMcMigrateBusy(false);
    }
  };

  const handleDebugWebflow = async () => {
    setDebugLoading(true);
    setDebugData(null);
    try {
      const res = await fetch(`${SERVER}/debug-webflow/651f03e0bca47206a22d436d`, {
        headers: { Authorization: `Bearer ${publicAnonKey}` },
      });
      const text = await res.text();
      try {
        const json = JSON.parse(text);
        setDebugData(json);
        toast.success(`Webflow odpověděl (API ${json.api}, status ${json.status}, ${json.itemCount ?? '?'} items)`);
      } catch {
        setDebugData({ raw: text.slice(0, 5000) });
        toast.error('Webflow nevrátil platný JSON');
      }
    } catch (e: any) {
      toast.error(`Debug selhal: ${e.message}`);
      setDebugData({ error: e.message });
    } finally {
      setDebugLoading(false);
    }
  };

  const handleDebugWebinar = async () => {
    setDebugWebinarLoading(true);
    setDebugWebinarData(null);
    try {
      const res = await fetch(`${SERVER}/debug-webflow/${webinarId}`, {
        headers: { Authorization: `Bearer ${publicAnonKey}` },
      });
      const text = await res.text();
      try {
        const json = JSON.parse(text);
        setDebugWebinarData(json);
        toast.success(`Webflow webináře (API ${json.api}, ${json.itemCount ?? '?'} items)`);
      } catch {
        setDebugWebinarData({ raw: text.slice(0, 8000) });
        toast.error('Webflow nevrátil platný JSON');
      }
    } catch (e: any) {
      toast.error(`Debug selhal: ${e.message}`);
      setDebugWebinarData({ error: e.message });
    } finally {
      setDebugWebinarLoading(false);
    }
  };

  const handleDvppSync = async () => {
    if (!confirm('Synchronizuje DVPP záznamy z Webflow (videa + témata). Pokračovat?')) return;
    setDvppStatus('syncing');
    setDvppResult(null);
    try {
      const res = await fetch(`${SERVER}/dvpp-videos/sync`, {
        method: 'POST',
        headers: AUTH(publicAnonKey),
      });
      const data = await safeJson(res);
      if (data.success) {
        setDvppResult(data);
        setDvppStatus('done');
        toast.success(`DVPP videa synchronizována! ${data.videosCount} videí, ${data.topicsCount} témat.`);
      } else {
        setDvppStatus('error');
        toast.error(`Sync selhal: ${data.error}`);
      }
    } catch (e: any) {
      setDvppStatus('error');
      toast.error(`Sync selhal: ${e.message}`);
    }
  };

  const handleDvppDebug = async () => {
    setDvppDebugLoading(true);
    setDvppDebugData(null);
    try {
      const res = await fetch(`${SERVER}/debug-webflow/${dvppDebugCollectionId}`, {
        headers: { Authorization: `Bearer ${publicAnonKey}` },
      });
      const text = await res.text();
      try {
        const json = JSON.parse(text);
        setDvppDebugData(json);
        toast.success(`Webflow odpověděl — ${json.itemCount ?? '?'} položek`);
      } catch {
        setDvppDebugData({ raw: text.slice(0, 8000) });
        toast.error('Webflow nevrátil platný JSON');
      }
    } catch (e: any) {
      toast.error(`Debug selhal: ${e.message}`);
      setDvppDebugData({ error: e.message });
    } finally {
      setDvppDebugLoading(false);
    }
  };

  // ── Taby handlers ─────────────────────────────────────────────
  const handleTabsPreview = async () => {
    setTabsStatus('previewing');
    setTabsPreview(null);
    setTabsResult(null);
    setTabsMapping({});
    // Načti seznam předmětů pro dropdown
    try {
      const res = await fetch(`${SERVER}/admin/predmety`, { headers: { Authorization: `Bearer ${publicAnonKey}` } });
      const data = await res.json();
      const names = (data.items || []).map((s: any) => s.displayName).filter(Boolean).sort();
      setSubjectList(names);
    } catch { /* tiché selhání */ }
    try {
      const res = await fetch(`${SERVER}/import-webflow`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${publicAnonKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'preview-tabs', tabsId }),
      });
      const data = await safeJson(res);
      if (data.error) { toast.error(`Preview chyba: ${data.error}`); setTabsStatus('idle'); return; }
      setTabsPreview(data);
      if (data.preview?.[0]?.fieldData) {
        const keys = Object.keys(data.preview[0].fieldData);
        const autoMap: Record<string,string> = {};
        const guesses: Record<string, string[]> = {
          tabText: ['tab-text','nazev','name','title','label','tab'],
          contentHeadline: ['content-headline','headline','nadpis','heading'],
          contentRichText: ['content-rich-text','obsah','content','text','rich-text','body','popis'],
          contentImage: ['content-image','image','obrazek','foto'],
          // subject: auto-resolved serverem z Webflow ref ID — nepřiřazovat z mapování
          // subpage: Webflow reference ID — nepřiřazovat automaticky
          order: ['order','poradi','sort'],
          bgColor: ['bg-color','background-color','barva','color'],
        };
        for (const [target, hints] of Object.entries(guesses)) {
          for (const hint of hints) { if (keys.includes(hint)) { autoMap[hint] = target; break; } }
        }
        setTabsMapping(autoMap);
      }
      toast.success(`Preview OK — ${data.count} tabů v kolekci.`);
    } catch (e: any) { toast.error(`Preview selhal: ${e.message}`); }
    finally { setTabsStatus('idle'); }
  };

  const handleTabsImport = async () => {
    if (!confirm('Importovat taby z Webflow do Supabase? Existující záznamy se sloučí.')) return;
    setTabsStatus('importing');
    setTabsResult(null);
    try {
      const res = await fetch(`${SERVER}/import-webflow`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${publicAnonKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'import-tabs', tabsId, fieldMapping: tabsMapping, forceSubject: tabsForceSubject || undefined }),
      });
      const data = await safeJson(res);
      if (data.success) {
        toast.success(`Taby naimportovány! ${data.count} tabů uloženo (celkem ${data.total} v DB).`);
        setTabsPreview(null);
        setTabsResult(data);
      } else { toast.error(`Chyba importu: ${data.details || data.error}`); }
    } catch (e: any) { toast.error(`Import selhal: ${e.message}`); }
    finally { setTabsStatus('idle'); }
  };

  // ── Diagnostika tabů ──────────────────────────────────────────
  const handleTabsDiag = async () => {
    setTabsDiagLoading(true);
    setTabsDiag(null);
    try {
      const res = await fetch(`${SERVER}/admin/tabs`, { headers: { Authorization: `Bearer ${publicAnonKey}` } });
      const data = await res.json();
      const items: any[] = data.items || [];
      const bySubject: Record<string, number> = {};
      for (const t of items) {
        const k = t.subject || '(prázdný)';
        bySubject[k] = (bySubject[k] || 0) + 1;
      }
      setTabsDiag({ total: items.length, bySubject, sample: items.slice(0, 5) });
    } catch (e: any) { toast.error(`Diag chyba: ${e.message}`); }
    finally { setTabsDiagLoading(false); }
  };

  // ── Generický JSON import handlers ───────────────────────────
  const handleJsonParse = () => {
    setJsonError('');
    setJsonParsed(null);
    setJsonResult(null);
    try {
      const raw = jsonText.trim();
      let parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        const arr = parsed.items || parsed.data || parsed.records || parsed.results;
        if (Array.isArray(arr)) { parsed = arr; } else { parsed = [parsed]; }
      }
      setJsonParsed(parsed);
      if (parsed.length > 0) {
        const initMap: Record<string,string> = {};
        for (const k of Object.keys(parsed[0])) { initMap[k] = k; }
        setJsonMapping(initMap);
      }
      toast.success(`Parsováno OK — ${parsed.length} záznamů.`);
    } catch (e: any) { setJsonError(`JSON chyba: ${e.message}`); }
  };

  const handleJsonImport = async () => {
    if (!jsonParsed || jsonParsed.length === 0) { toast.error('Nejprve parseuj JSON.'); return; }
    if (!confirm(`Importovat ${jsonParsed.length} záznamů do kolekce „${jsonCollection}"? ${jsonAppend ? 'Záznamy se sloučí.' : 'PŘEPÍŠE existující data!'}`)) return;
    setJsonStatus('importing');
    setJsonResult(null);
    try {
      const activeMapping: Record<string,string> = {};
      for (const [src, tgt] of Object.entries(jsonMapping)) {
        if (tgt && tgt !== src) { activeMapping[src] = tgt; }
      }
      const res = await fetch(`${SERVER}/import-webflow`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${publicAnonKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'import-json', collection: jsonCollection, items: jsonParsed, fieldMapping: activeMapping, appendMode: jsonAppend }),
      });
      const data = await safeJson(res);
      if (data.success) {
        toast.success(`Import hotov! ${data.count} záznamů uloženo.`);
        setJsonResult(data);
        setJsonParsed(null);
        setJsonText('');
      } else { toast.error(`Import selhal: ${data.details || data.error}`); }
    } catch (e: any) { toast.error(`Import selhal: ${e.message}`); }
    finally { setJsonStatus('idle'); }
  };

  return (
    <div className="h-full overflow-y-auto p-8">
      <div className="max-w-3xl">
        <h1 className="text-2xl font-bold text-[#001161] mb-1 font-['Fenomen_Sans']">{'Migrace obsahu'}</h1>
        <p className="text-[14px] text-gray-500 mb-8">
          {'Import dat z Webflow, Shoptetu (merch / XML) a statických souborů do Supabase databáze.'}
        </p>

        {/* Webflow Produkty Migration */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-6">
          <div className="flex items-start gap-4 mb-4">
            <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center shrink-0">
              <Upload className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-[#001161]">{'Migrace produktů z Webflow'}</h2>
              <p className="text-[13px] text-gray-500 mt-1">
                {'Stáhne produkty z Webflow CMS kolekcí (Digitální učebnice + Tiskoviny) a uloží je do Supabase.'}
              </p>
            </div>
          </div>

          <div className="bg-blue-50 rounded-xl p-4 mb-4">
            <div className="flex items-start gap-2 mb-3">
              <AlertCircle className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
              <p className="text-[12px] text-blue-700">
                {'Zadejte správná ID kolekcí z Webflow. Najdete je v URL, když otevřete CMS kolekci ve Webflow.'}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-blue-800 mb-1">{'Digitální učebnice ID'}</label>
                <input
                  value={customIds.digital}
                  onChange={(e) => setCustomIds({ ...customIds, digital: e.target.value })}
                  className="w-full px-3 py-2 text-[12px] bg-white border border-blue-200 rounded-lg focus:border-blue-500 outline-none font-mono"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-blue-800 mb-1">{'Tiskoviny ID'}</label>
                <input
                  value={customIds.print}
                  onChange={(e) => setCustomIds({ ...customIds, print: e.target.value })}
                  className="w-full px-3 py-2 text-[12px] bg-white border border-blue-200 rounded-lg focus:border-blue-500 outline-none font-mono"
                />
              </div>
            </div>
          </div>

          <button
            onClick={handleWebflowMigrate}
            disabled={isMigrating}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl text-[13px] font-bold transition-colors disabled:opacity-50 cursor-pointer"
          >
            {isMigrating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Database className="w-4 h-4" />}
            {'Spustit migraci z Webflow'}
          </button>
        </div>

        {/* Shoptet productsComplete.xml → merch */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-6">
          <div className="flex items-start gap-4 mb-4">
            <div className="w-12 h-12 bg-emerald-50 rounded-xl flex items-center justify-center shrink-0">
              <Store className="w-6 h-6 text-emerald-600" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-bold text-[#001161]">{'Merch ze Shoptetu (productsComplete.xml)'}</h2>
              <p className="text-[13px] text-gray-500 mt-1">
                {
                  'Z exportu se berou jen produkty, jejichž strom kategorií ve Shoptetu začíná na některou z těchto skupin: '
                }
                <span className="font-mono text-[12px] text-gray-600">
                  {SHOPTET_IMPORT_ALLOWED_ROOTS.join(', ')}
                </span>
                {
                  '. Ostatní zboží v XML se ignoruje. Jeden „Shoptet produkt“ = jeden záznam u nás; velikosti jsou v poli variant uvnitř. Po importu typicky doplníš Shopify variant ID u každé velikosti (Shopify linker).'
                }
              </p>
            </div>
          </div>

          <div className="bg-emerald-50 rounded-xl p-4 mb-4">
            <div className="flex items-start gap-2 mb-3">
              <AlertCircle className="w-4 h-4 text-emerald-700 mt-0.5 shrink-0" />
              <p className="text-[12px] text-emerald-900">
                {
                  'Pro platby kartou přes Stripe je potřeba u nových položek doplnit Shopify variant ID (např. nástrojem Shopify linker v adminu). Pole Shoptet ID slouží ke skladu / párování.'
                }
              </p>
            </div>
            <label className="block text-[11px] font-bold text-emerald-900 mb-1">{'URL exportu (eshop.vividbooks.com)'}</label>
            <p className="text-[11px] text-emerald-800 mb-2">
              {
                'Ve Shoptetu: Export → productsComplete.xml → zkopíruj celou adresu včetně hash= (dlouhý řetězec). Neúplná URL bez hashe skončí chybou 404.'
              }
            </p>
            <input
              value={shoptetUrl}
              onChange={(e) => setShoptetUrl(e.target.value)}
              className="w-full px-3 py-2 text-[12px] bg-white border border-emerald-200 rounded-lg focus:border-emerald-500 outline-none font-mono mb-3"
              placeholder={`${eshopUrl('/export/productsComplete.xml')}?patternId=…&partnerId=…&hash=…`}
            />
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleShoptetLoadUrl}
                disabled={shoptetStatus !== 'idle'}
                className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl text-[13px] font-bold transition-colors disabled:opacity-50 cursor-pointer"
              >
                {shoptetStatus === 'loading' ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                {'Stáhnout a zobrazit náhled'}
              </button>
              <label className="flex items-center gap-2 text-[13px] font-bold text-emerald-900 cursor-pointer">
                <span className="px-3 py-2 rounded-xl bg-white border border-emerald-200 hover:bg-emerald-100/50 transition-colors">
                  {shoptetStatus === 'loading' ? '…' : 'Nebo vybrat soubor .xml'}
                </span>
                <input type="file" accept=".xml,text/xml,application/xml" className="hidden" onChange={handleShoptetFile} disabled={shoptetStatus !== 'idle'} />
              </label>
              {shoptetFileName ? (
                <span className="text-[11px] text-gray-500 truncate max-w-[200px]" title={shoptetFileName}>
                  {shoptetFileName}
                </span>
              ) : null}
            </div>
          </div>

          {shoptetPreview && shoptetPreview.length > 0 && (
            <div className="space-y-4 mb-4">
              <div className="rounded-xl border border-gray-200 bg-gray-50/80 p-4 space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-[12px] font-bold text-gray-700 w-full sm:w-auto sm:mr-2">
                    {'Vyber konkrétní varianty v tabulce níže:'}
                  </p>
                  <button
                    type="button"
                    onClick={() =>
                      setShoptetRowSelected((prev) => {
                        const next = { ...prev };
                        for (const p of shoptetPreview) next[p.id] = true;
                        return next;
                      })
                    }
                    className="text-[12px] font-bold px-3 py-1.5 rounded-lg bg-white border border-gray-300 text-gray-800 hover:bg-gray-50 cursor-pointer"
                  >
                    {'Vybrat vše'}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setShoptetRowSelected((prev) => {
                        const next = { ...prev };
                        for (const p of shoptetPreview) next[p.id] = false;
                        return next;
                      })
                    }
                    className="text-[12px] font-bold px-3 py-1.5 rounded-lg bg-white border border-gray-300 text-gray-800 hover:bg-gray-50 cursor-pointer"
                  >
                    {'Odznačit vše'}
                  </button>
                  {shoptetByCat &&
                    Object.entries(shoptetByCat)
                      .filter(([, n]) => n > 0)
                      .map(([cat]) => (
                        <button
                          key={cat}
                          type="button"
                          onClick={() =>
                            setShoptetRowSelected((prev) => {
                              const next = { ...prev };
                              for (const p of shoptetPreview) next[p.id] = p.merchCategory === cat;
                              return next;
                            })
                          }
                          className="text-[12px] font-bold px-3 py-1.5 rounded-lg bg-emerald-100 border border-emerald-200 text-emerald-900 hover:bg-emerald-200/80 cursor-pointer"
                        >
                          {`Jen: ${cat.length > 28 ? `${cat.slice(0, 28)}…` : cat}`}
                        </button>
                      ))}
                </div>
                <div className="flex flex-wrap gap-2 text-[11px] text-gray-600">
                  {shoptetByCat &&
                    Object.entries(shoptetByCat).map(([cat, n]) => (
                      <span key={cat} className="px-2 py-0.5 rounded-md bg-white border border-gray-200">
                        <strong>{cat}</strong>
                        {`: ${n}`}
                      </span>
                    ))}
                </div>
                <p className="text-[11px] text-gray-500">
                  {`K importu: ${shoptetRowsToImport.length} z ${shoptetPreview.length} řádků.`}
                </p>
              </div>
              <label className="flex items-center gap-2 text-[13px] text-gray-700 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={shoptetSkipExisting}
                  onChange={(e) => setShoptetSkipExisting(e.target.checked)}
                  className="rounded border-gray-300"
                />
                {'Přeskočit ID, která už v katalogu jsou (doporučeno)'}
              </label>
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={handleShoptetImport}
                  disabled={shoptetStatus !== 'idle' || shoptetRowsToImport.length === 0}
                  className="flex items-center gap-2 bg-[#001161] hover:bg-[#001a8a] text-white px-5 py-2.5 rounded-xl text-[13px] font-bold transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {shoptetStatus === 'importing' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Database className="w-4 h-4" />}
                  {`Importovat do katalogu (${shoptetRowsToImport.length})`}
                </button>
              </div>
              {shoptetImportResult ? (
                <p className="text-[12px] text-gray-600">
                  {`Výsledek: ${shoptetImportResult.ok} nových, ${shoptetImportResult.skipped} přeskočeno, ${shoptetImportResult.fail} chyb.`}
                </p>
              ) : null}
              <div className="bg-gray-50 rounded-xl border border-gray-200 overflow-x-auto max-h-[min(70vh,520px)] overflow-y-auto">
                <table className="w-full text-[11px] min-w-[720px]">
                  <thead className="sticky top-0 bg-gray-100 z-10 shadow-sm">
                    <tr>
                      <th className="text-left p-2 w-10 font-bold text-gray-600">
                        <span className="sr-only">{'Import'}</span>
                        <input
                          type="checkbox"
                          title="Vybrat / zrušit všechny řádky"
                          checked={
                            shoptetPreview.length > 0 &&
                            shoptetPreview.every((p) => shoptetRowSelected[p.id])
                          }
                          onChange={(e) => {
                            const v = e.target.checked;
                            setShoptetRowSelected((prev) => {
                              const next = { ...prev };
                              for (const p of shoptetPreview) next[p.id] = v;
                              return next;
                            });
                          }}
                          className="rounded border-gray-300"
                        />
                      </th>
                      <th className="text-left p-2 font-bold text-gray-600">{'ID'}</th>
                      <th className="text-left p-2 font-bold text-gray-600">{'Název'}</th>
                      <th className="text-left p-2 font-bold text-gray-600">{'Varianty'}</th>
                      <th className="text-left p-2 font-bold text-gray-600">{'Cena'}</th>
                      <th className="text-left p-2 font-bold text-gray-600">{'Skupina'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shoptetPreview.map((row) => {
                      const on = !!shoptetRowSelected[row.id];
                      return (
                        <tr
                          key={row.id}
                          className={`border-t border-gray-200 ${on ? '' : 'opacity-45 bg-gray-100/50'}`}
                        >
                          <td className="p-2 align-middle">
                            <input
                              type="checkbox"
                              checked={on}
                              onChange={() =>
                                setShoptetRowSelected((prev) => ({
                                  ...prev,
                                  [row.id]: !prev[row.id],
                                }))
                              }
                              className="rounded border-gray-300"
                            />
                          </td>
                          <td className="p-2 font-mono text-gray-500 whitespace-nowrap">{row.id}</td>
                          <td className="p-2 text-gray-800">{row.name}</td>
                          <td className="p-2 text-gray-700">{`${row.merchVariants?.length ?? 0}× (${row.merchVariants?.map((v) => v.label).join(', ') || '—'})`}</td>
                          <td className="p-2 whitespace-nowrap">{row.price}</td>
                          <td className="p-2 text-gray-600">{row.merchCategory}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {shoptetRowsToImport.length === 0 ? (
                  <p className="p-3 text-[12px] text-amber-800 bg-amber-50 border-t border-amber-100">
                    {'Není zaškrtnutá žádná varianta — import je vypnutý.'}
                  </p>
                ) : null}
              </div>
            </div>
          )}

          {shoptetPreview && shoptetPreview.length === 0 ? (
            <p className="text-[13px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
              {
                'V XML nejsou žádné položky z povolených kategorií. Zkontroluj export nebo kategorie ve Shoptetu.'
              }
            </p>
          ) : null}
        </div>

        {/* ── Blog z Webflow ─────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-6">
          <div className="flex items-start gap-4 mb-4">
            <div className="w-12 h-12 bg-orange-50 rounded-xl flex items-center justify-center shrink-0">
              <FileText className="w-6 h-6 text-orange-500" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg font-bold text-[#001161]">{'Blog příspěvky z Webflow'}</h2>
                <span className="px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 text-[11px] font-bold font-mono">
                  {'651f03e0bca47206a22d436d'}
                </span>
              </div>
              <p className="text-[13px] text-gray-500 mt-1">
                {'Stáhne blog příspěvky z Webflow CMS a uloží je do Supabase. Nejdřív proveď Preview pro kontrolu polí.'}
              </p>
            </div>
          </div>

          <div className="flex gap-3 mb-4">
            <button
              onClick={handleBlogPreview}
              disabled={blogStatus !== 'idle'}
              className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2.5 rounded-xl text-[13px] font-bold transition-colors disabled:opacity-50 cursor-pointer"
            >
              {blogStatus === 'previewing' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />}
              {'Preview (3 položky)'}
            </button>
            <button
              onClick={handleBlogImport}
              disabled={blogStatus !== 'idle'}
              className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-5 py-2.5 rounded-xl text-[13px] font-bold transition-colors disabled:opacity-50 cursor-pointer"
            >
              {blogStatus === 'importing' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Database className="w-4 h-4" />}
              {'Importovat do Supabase'}
            </button>
          </div>

          {blogPreview && (
            <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
              <p className="text-[12px] font-bold text-gray-600 mb-3">
                {`Kolekce obsahuje ${blogPreview.count} příspěvků. Ukázka polí prvního záznamu:`}
              </p>
              {blogPreview.preview?.slice(0, 1).map((item: any) => (
                <div key={item.id} className="mb-3">
                  <p className="text-[11px] font-mono text-gray-400 mb-1">{`ID: ${item.id}`}</p>
                  <div className="bg-white rounded-lg border border-gray-200 p-3 max-h-[280px] overflow-y-auto">
                    <table className="w-full text-[11px]">
                      <tbody>
                        {Object.entries(item.fieldData).map(([key, val]) => (
                          <tr key={key} className="border-b border-gray-100 last:border-none">
                            <td className="py-1 pr-3 font-mono font-bold text-[#001161]/60 whitespace-nowrap align-top">{key}</td>
                            <td className="py-1 text-gray-600 break-all">
                              {typeof val === 'object' ? JSON.stringify(val).slice(0, 120) : String(val).slice(0, 120)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
              <p className="text-[11px] text-gray-400 mt-2 italic">
                {'Zkontroluj klíče polí výše — pokud je mapování správné, klikni na Import.'}
              </p>
            </div>
          )}
        </div>

        {/* ── Webináře z Webflow ─────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-6">
          <div className="flex items-start gap-4 mb-4">
            <div className="w-12 h-12 bg-purple-50 rounded-xl flex items-center justify-center shrink-0">
              <Radio className="w-6 h-6 text-purple-600" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg font-bold text-[#001161]">{'Webináře z Webflow'}</h2>
                <span className="px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 text-[11px] font-bold font-mono">
                  {webinarId}
                </span>
              </div>
              <p className="text-[13px] text-gray-500 mt-1">
                {'Stáhne webináře z Webflow CMS kolekce a uloží je do Supabase. Datum se mapuje automaticky z ISO stringu nebo z polí den/měsíc/rok.'}
              </p>
            </div>
          </div>

          {/* Collection ID input */}
          <div className="bg-purple-50 rounded-xl p-3 mb-4">
            <label className="block text-[11px] font-bold text-purple-800 mb-1">{'Webflow Collection ID'}</label>
            <input
              value={webinarId}
              onChange={e => setWebinarId(e.target.value)}
              className="w-full px-3 py-2 text-[12px] bg-white border border-purple-200 rounded-lg focus:border-purple-500 outline-none font-mono"
            />
          </div>

          <div className="flex gap-3 mb-4">
            <button
              onClick={handleWebinarPreview}
              disabled={webinarStatus !== 'idle'}
              className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2.5 rounded-xl text-[13px] font-bold transition-colors disabled:opacity-50 cursor-pointer"
            >
              {webinarStatus === 'previewing' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />}
              {'Preview (3 položky)'}
            </button>
            <button
              onClick={handleWebinarImport}
              disabled={webinarStatus !== 'idle'}
              className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-5 py-2.5 rounded-xl text-[13px] font-bold transition-colors disabled:opacity-50 cursor-pointer"
            >
              {webinarStatus === 'importing' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Database className="w-4 h-4" />}
              {'Importovat webináře do Supabase'}
            </button>
          </div>

          {/* Preview tabulka */}
          {webinarPreview && (
            <div className="bg-gray-50 rounded-xl p-4 border border-gray-200 mb-3">
              <p className="text-[12px] font-bold text-gray-600 mb-3">
                {`Kolekce obsahuje ${webinarPreview.count} webinářů. Ukázka polí prvního záznamu:`}
              </p>
              {webinarPreview.preview?.slice(0, 1).map((item: any) => (
                <div key={item.id}>
                  <p className="text-[11px] font-mono text-gray-400 mb-1">{`ID: ${item.id}`}</p>
                  <div className="bg-white rounded-lg border border-gray-200 p-3 max-h-[280px] overflow-y-auto">
                    <table className="w-full text-[11px]">
                      <tbody>
                        {Object.entries(item.fieldData).map(([key, val]) => (
                          <tr key={key} className="border-b border-gray-100 last:border-none">
                            <td className="py-1 pr-3 font-mono font-bold text-[#001161]/60 whitespace-nowrap align-top">{key}</td>
                            <td className="py-1 text-gray-600 break-all">
                              {typeof val === 'object' ? JSON.stringify(val).slice(0, 120) : String(val).slice(0, 120)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
              <p className="text-[11px] text-gray-400 mt-2 italic">
                {'Zkontroluj mapování polí — klíče jako "datum", "cas", "lektor" se mapují automaticky.'}
              </p>
            </div>
          )}

          {/* Import výsledek */}
          {webinarResult && (
            <div className="bg-purple-50 rounded-xl p-4 border border-purple-200">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="w-4 h-4 text-purple-600" />
                <p className="text-[12px] font-bold text-purple-800">
                  {`Importováno ${webinarResult.count} webinářů. Ukázka:`}
                </p>
              </div>
              <div className="space-y-1">
                {webinarResult.sample?.map((w: any, i: number) => (
                  <div key={i} className="text-[11px] text-purple-700 flex items-center gap-2">
                    <span className="font-bold">{w.day}. {w.monthName} {w.year}</span>
                    <span className="text-purple-400">·</span>
                    <span className="truncate">{w.title}</span>
                    {w.isPast && <span className="ml-auto text-[10px] bg-purple-200 px-1.5 py-0.5 rounded-full shrink-0">{'minulý'}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Debug tlačítko */}
          <div className="mt-4 pt-4 border-t border-gray-100">
            <button
              onClick={handleDebugWebinar}
              disabled={debugWebinarLoading}
              className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-600 px-4 py-2 rounded-xl text-[12px] font-bold transition-colors disabled:opacity-50 cursor-pointer"
            >
              {debugWebinarLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Bug className="w-3.5 h-3.5" />}
              {'Raw debug — zobrazit JSON pole z Webflow'}
            </button>
            {debugWebinarData && (
              <div className="mt-3 bg-gray-900 rounded-xl p-4 max-h-[500px] overflow-y-auto">
                <p className="text-[10px] text-gray-400 mb-2 font-mono">
                  {`// Webflow collection: ${webinarId} — zkopíruj a sdílej pro opravu mapování`}
                </p>
                <pre className="text-[11px] font-mono text-green-300 whitespace-pre-wrap break-all">
                  {JSON.stringify(debugWebinarData?.data?.items?.[0] ?? debugWebinarData?.data?.[0] ?? debugWebinarData, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>

        {/* ── Novinky z Webflow ──────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-6">
          <div className="flex items-start gap-4 mb-4">
            <div className="w-12 h-12 bg-teal-50 rounded-xl flex items-center justify-center shrink-0">
              <Newspaper className="w-6 h-6 text-teal-600" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg font-bold text-[#001161]">{'Novinky z Webflow'}</h2>
                <span className="px-2 py-0.5 rounded-full bg-teal-100 text-teal-700 text-[11px] font-bold font-mono">
                  {novinkyId}
                </span>
              </div>
              <p className="text-[13px] text-gray-500 mt-1">
                {'Stáhne novinky z Webflow CMS kolekce a uloží je do Supabase. Nejdřív proveď Preview pro kontrolu polí.'}
              </p>
            </div>
          </div>

          <div className="flex gap-3 mb-4">
            <button
              onClick={handleNovinkyPreview}
              disabled={novinkyStatus !== 'idle'}
              className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2.5 rounded-xl text-[13px] font-bold transition-colors disabled:opacity-50 cursor-pointer"
            >
              {novinkyStatus === 'previewing' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />}
              {'Preview (3 položky)'}
            </button>
            <button
              onClick={handleNovinkyImport}
              disabled={novinkyStatus !== 'idle'}
              className="flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white px-5 py-2.5 rounded-xl text-[13px] font-bold transition-colors disabled:opacity-50 cursor-pointer"
            >
              {novinkyStatus === 'importing' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Database className="w-4 h-4" />}
              {'Importovat novinky do Supabase'}
            </button>
          </div>

          {novinkyPreview && (
            <div className="bg-gray-50 rounded-xl p-4 border border-gray-200 mb-3">
              <p className="text-[12px] font-bold text-gray-600 mb-3">
                {`Kolekce obsahuje ${novinkyPreview.count} novinek. Ukázka polí prvního záznamu:`}
              </p>
              {novinkyPreview.preview?.slice(0, 1).map((item: any) => (
                <div key={item.id}>
                  <p className="text-[11px] font-mono text-gray-400 mb-1">{`ID: ${item.id}`}</p>
                  <div className="bg-white rounded-lg border border-gray-200 p-3 max-h-[280px] overflow-y-auto">
                    <table className="w-full text-[11px]">
                      <tbody>
                        {Object.entries(item.fieldData).map(([key, val]) => (
                          <tr key={key} className="border-b border-gray-100 last:border-none">
                            <td className="py-1 pr-3 font-mono font-bold text-[#001161]/60 whitespace-nowrap align-top">{key}</td>
                            <td className="py-1 text-gray-600 break-all">
                              {typeof val === 'object' ? JSON.stringify(val).slice(0, 120) : String(val).slice(0, 120)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
              <p className="text-[11px] text-gray-400 mt-2 italic">
                {'Zkontroluj klíče polí výše — pokud je mapování správné, klikni na Import.'}
              </p>
            </div>
          )}

          {novinkyResult && (
            <div className="bg-teal-50 rounded-xl p-4 border border-teal-200">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="w-4 h-4 text-teal-600" />
                <p className="text-[12px] font-bold text-teal-800">
                  {`Importováno ${novinkyResult.count} novinek. Ukázka:`}
                </p>
              </div>
              <div className="space-y-1">
                {novinkyResult.sample?.map((n: any, i: number) => (
                  <div key={i} className="text-[11px] text-teal-700 flex items-center gap-2">
                    <span className="font-bold truncate">{n.title}</span>
                    <span className="text-teal-400">·</span>
                    <span className="shrink-0">{n.date}</span>
                    {n.hasImage && <span className="ml-auto text-[10px] bg-teal-200 px-1.5 py-0.5 rounded-full shrink-0">{'foto'}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── DVPP Videa z Webflow ───────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-6">
          <div className="flex items-start gap-4 mb-4">
            <div className="w-12 h-12 bg-red-50 rounded-xl flex items-center justify-center shrink-0">
              <Video className="w-6 h-6 text-red-500" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg font-bold text-[#001161]">{'DVPP Záznamy webinářů'}</h2>
                <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-[11px] font-bold font-mono">
                  {'videa: 66b119eaa0271061207bdd18'}
                </span>
                <span className="px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 text-[11px] font-bold font-mono">
                  {'témata: 67c5e17f4844f5f538279158'}
                </span>
              </div>
              <p className="text-[13px] text-gray-500 mt-1">
                {'Synchronizuje záznamy DVPP webinářů a jejich témata z Webflow. Mapuje pole: nadpis-videa, video-link, grey-button-link (certifikát), image.'}
              </p>
            </div>
          </div>

          <div className="flex gap-3 mb-4">
            <button
              onClick={handleDvppSync}
              disabled={dvppStatus === 'syncing'}
              className="flex items-center gap-2 bg-red-500 hover:bg-red-600 text-white px-5 py-2.5 rounded-xl text-[13px] font-bold transition-colors disabled:opacity-50 cursor-pointer"
            >
              {dvppStatus === 'syncing'
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <RefreshCw className="w-4 h-4" />}
              {dvppStatus === 'syncing' ? 'Synchronizuji...' : 'Synchronizovat z Webflow'}
            </button>
          </div>

          {dvppResult && dvppStatus === 'done' && (
            <div className="bg-red-50 rounded-xl p-4 border border-red-200 mb-4">
              <div className="flex items-center gap-2 mb-1">
                <CheckCircle className="w-4 h-4 text-red-500" />
                <p className="text-[12px] font-bold text-red-800">
                  {`Hotovo! ${dvppResult.videosCount} videí, ${dvppResult.topicsCount} témat uloženo do Supabase.`}
                </p>
              </div>
              <p className="text-[11px] text-red-600">
                {'Videa jsou nyní dostupná na stránce /webinare pod záložkou Záznamy.'}
              </p>
            </div>
          )}

          {/* Debug sekce */}
          <div className="mt-4 pt-4 border-t border-gray-100">
            <p className="text-[11px] font-bold text-gray-500 mb-2">{'Debug — zobrazit raw JSON z Webflow:'}</p>
            <div className="flex gap-2 mb-3 flex-wrap items-center">
              <select
                value={dvppDebugCollectionId}
                onChange={e => setDvppDebugCollectionId(e.target.value)}
                className="px-3 py-2 text-[12px] bg-white border border-gray-200 rounded-xl font-mono outline-none focus:border-red-400 cursor-pointer"
              >
                <option value="66b119eaa0271061207bdd18">Videa (záznamy)</option>
                <option value="67c5e17f4844f5f538279158">{'DVPP Témata'}</option>
              </select>
              <button
                onClick={handleDvppDebug}
                disabled={dvppDebugLoading}
                className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-600 px-4 py-2 rounded-xl text-[12px] font-bold transition-colors disabled:opacity-50 cursor-pointer"
              >
                {dvppDebugLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Bug className="w-3.5 h-3.5" />}
                {'Raw debug JSON'}
              </button>
            </div>
            {dvppDebugData && (
              <div className="bg-gray-900 rounded-xl p-4 max-h-[500px] overflow-y-auto">
                <p className="text-[10px] text-gray-400 mb-2 font-mono">
                  {`// Collection: ${dvppDebugCollectionId} — 1. položka`}
                </p>
                <pre className="text-[11px] font-mono text-green-300 whitespace-pre-wrap break-all">
                  {JSON.stringify(dvppDebugData?.data?.items?.[0] ?? dvppDebugData?.data?.[0] ?? dvppDebugData, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>

        {/* ── Mailchimp kontakty → Postgres ───────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-6">
          <div className="flex items-start gap-4 mb-4">
            <div className="w-12 h-12 bg-sky-50 rounded-xl flex items-center justify-center shrink-0">
              <Mail className="w-6 h-6 text-sky-600" />
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-bold text-[#001161]">{'Mailchimp → kontakty (Postgres)'}</h2>
              <p className="text-[13px] text-gray-500 mt-1">
                {'Použije MAILCHIMP_API_KEY a ID audience z Edge secrets. Vyplní tabulky lists, subscribers, subscriber_lists, tags, campaigns; volitelně email_events (pomalé).'}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <label className="text-[12px] font-bold text-gray-600">{'Audience:'}</label>
            <select
              value={mcAudience}
              onChange={(e) => setMcAudience(e.target.value as McAudienceKey)}
              disabled={mcMigrateBusy}
              className="border border-gray-200 rounded-lg px-3 py-2 text-[13px] bg-white min-w-[220px]"
            >
              <option value="newsletter">{'Newsletter (MAILCHIMP_AUDIENCE_NEWSLETTER)'}</option>
              <option value="no_newsletter">{'Bez newsletteru (MAILCHIMP_AUDIENCE_NO_NEWSLETTER)'}</option>
              <option value="primary">{'Primární (PRIMARY → NEWSLETTER fallback)'}</option>
            </select>
            <label className="flex items-center gap-2 text-[12px] text-gray-700 cursor-pointer">
              <input
                type="checkbox"
                checked={mcIncludeActivity}
                onChange={(e) => setMcIncludeActivity(e.target.checked)}
                disabled={mcMigrateBusy}
                className="accent-sky-600"
              />
              {'Včetně aktivity (opens/clicks, ~180 dní; může trvat dlouho)'}
            </label>
          </div>
          <div className="flex flex-wrap items-center gap-3 mb-3">
            <label className="flex items-center gap-2 text-[12px] text-gray-700">
              <span className="font-bold text-gray-600">{'Velikost dávky:'}</span>
              <input
                type="number"
                min={1}
                max={10_000}
                value={mcMembersPerRun}
                onChange={(e) => setMcMembersPerRun(Number(e.target.value) || 2000)}
                disabled={mcMigrateBusy}
                className="border border-gray-200 rounded-lg px-2 py-1.5 w-[100px] text-[13px] bg-white"
              />
            </label>
            {mcResumeCursor && (
              <span className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1 font-mono">
                {`resume offset=${mcResumeCursor.offset} skip=${mcResumeCursor.skipInPage}`}
              </span>
            )}
            {mcResumeCursor && (
              <button
                type="button"
                onClick={() => {
                  setMcResumeCursor(null);
                  clearMcBatchLocal(mcAudience);
                  setMcBatchLocalInfo(null);
                }}
                disabled={mcMigrateBusy}
                className="text-[12px] font-bold text-gray-600 underline hover:text-gray-900 disabled:opacity-50 cursor-pointer"
              >
                {'Zrušit uloženou pozici'}
              </button>
            )}
          </div>
          {mcBatchLocalInfo ? (
            <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50/80 px-4 py-3 text-[12px] text-amber-950">
              <p className="font-bold text-[#001161]">{'Postup dávkového importu (uloženo v tomto prohlížeči)'}</p>
              <p className="mt-1 text-[#001161]/80">
                {`Audience: ${MC_AUDIENCE_LABEL[mcAudience]} · Poslední změna: ${new Date(mcBatchLocalInfo.updatedAt).toLocaleString('cs-CZ')}`}
              </p>
              {mcBatchLocalInfo.resumeFrom ? (
                <p className="mt-1 font-mono text-[11px] text-[#001161]/90">
                  {`Další dávka začne v Mailchimp API na offset=${mcBatchLocalInfo.resumeFrom.offset}, skipInPage=${mcBatchLocalInfo.resumeFrom.skipInPage}. Velikost dávky: ${mcBatchLocalInfo.membersPerRun}.`}
                </p>
              ) : (
                <p className="mt-1 text-[#001161]/80">
                  {mcBatchLocalInfo.lastMembersImportHasMore === false
                    ? 'Uložený stav: poslední dávkový běh nahlásil, že už není co načítat (můžeš zkusit ještě jednou „Postupně“ — je to idempotentní).'
                    : 'Není uložená pozice pokračování — klikni „Postupně (dávka)“ pro nový začátek, nebo pokračuj z poslední odpovědi API níže.'}
                </p>
              )}
              {mcBatchLocalInfo.mailchimpTotal != null ? (
                <p className="mt-1 text-[#001161]/75">
                  {`Mailchimp u tohoto listu hlásí celkem cca ${mcBatchLocalInfo.mailchimpTotal} členů (z poslední odpovědi migrace).`}
                </p>
              ) : null}
              {mcBatchLocalInfo.lastMembersSynced != null ? (
                <p className="mt-1 text-[#001161]/75">
                  {`Poslední dávka v jednom requestu: ${mcBatchLocalInfo.lastMembersSynced} zpracovaných záznamů.`}
                </p>
              ) : null}
              <p className="mt-2 text-[11px] text-[#001161]/60">
                {'Kdo už je v Postgresu, uvidíš v '}
                <Link to="/mailing/audience" className="font-bold text-fuchsia-700 underline">
                  Mailing → Audience
                </Link>
                {' (import je podle e-mailu idempotentní — stejný kontakt se nepřidá dvakrát).'}
              </p>
            </div>
          ) : (
            <p className="mb-3 text-[11px] text-gray-500">
              {
                'Tip: po každé dávce se pozice uloží do prohlížeče — obnovení stránky už nepřijdeš o „kde pokračovat“.'
              }
            </p>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void handleMailchimpContactsMigrate('full')}
              disabled={mcMigrateBusy}
              className="flex items-center gap-2 bg-sky-600 hover:bg-sky-700 text-white px-5 py-2.5 rounded-xl text-[13px] font-bold transition-colors disabled:opacity-50 cursor-pointer"
            >
              {mcMigrateBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Database className="w-4 h-4" />}
              {mcMigrateBusy ? 'Probíhá import…' : 'Celý list (auto dávky)'}
            </button>
            <button
              type="button"
              onClick={() => void handleMailchimpContactsMigrate('batch')}
              disabled={mcMigrateBusy}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl text-[13px] font-bold transition-colors disabled:opacity-50 cursor-pointer"
            >
              {mcMigrateBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              {mcResumeCursor ? 'Pokračovat (auto až do konce)' : 'Postupně (auto až do konce)'}
            </button>
            <button
              type="button"
              onClick={() => void handleMailchimpContactsMigrate('sample')}
              disabled={mcMigrateBusy}
              className="flex items-center gap-2 bg-white border-2 border-sky-200 text-sky-800 hover:bg-sky-50 px-4 py-2.5 rounded-xl text-[13px] font-bold transition-colors disabled:opacity-50 cursor-pointer"
            >
              {'Ověřit: prvních 10 kontaktů'}
            </button>
          </div>
          <p className="text-[11px] text-gray-500 mt-2">
            {
              '„Celý list“ i „Postupně“ po sobě automaticky spouští další dávku až do konce listu (velikost dávky výše). Po poslední dávce se doplní kampaně a případně aktivita. Nech stránku otevřenou. Zkouška 10 kontaktů je jednorázová a synchronizuje všechny kampaně z účtu.'
            }
          </p>
          {mcMigrateResult && (
            <div className="mt-4 bg-sky-50 rounded-xl p-4 border border-sky-200 text-[12px] text-sky-900 font-mono whitespace-pre-wrap break-all">
              {JSON.stringify(mcMigrateResult, null, 2)}
            </div>
          )}
        </div>

        {/* ── Migrace obrázků do Supabase Storage ─────────────── */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-6">
          <div className="flex items-start gap-4 mb-4">
            <div className="w-12 h-12 bg-violet-50 rounded-xl flex items-center justify-center shrink-0">
              <FolderSync className="w-6 h-6 text-violet-600" />
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-bold text-[#001161]">{'Migrace obrázků → Supabase Storage'}</h2>
              <p className="text-[13px] text-gray-500 mt-1">
                {'Stáhne všechny obrázky z Webflow URL a nahraje je do Supabase Storage. URL v databázi budou automaticky aktualizovány. Pokud je obrázek již v Supabase, přeskočí se.'}
              </p>
            </div>
          </div>

          {/* Kolekce checkboxy */}
          <div className="bg-violet-50 rounded-xl p-4 mb-4">
            <p className="text-[11px] font-bold text-violet-800 mb-3">{'Vyberte kolekce ke zpracování:'}</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {([
                { key: 'products', label: 'Produkty', icon: '📦' },
                { key: 'blog', label: 'Blog', icon: '📝' },
                { key: 'novinky', label: 'Novinky', icon: '📰' },
                { key: 'webinars', label: 'Webináře', icon: '🎥' },
              ] as { key: keyof typeof imgCollections; label: string; icon: string }[]).map(({ key, label, icon }) => (
                <label key={key} className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border-2 cursor-pointer transition-all ${imgCollections[key] ? 'border-violet-500 bg-white shadow-sm' : 'border-violet-200 bg-violet-50/50'}`}>
                  <input
                    type="checkbox"
                    checked={imgCollections[key]}
                    onChange={(e) => setImgCollections(prev => ({ ...prev, [key]: e.target.checked }))}
                    className="w-3.5 h-3.5 accent-violet-600"
                  />
                  <span className="text-[13px]">{icon}</span>
                  <span className="text-[12px] font-bold text-violet-800">{label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Info box */}
          <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4">
            <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
            <p className="text-[12px] text-amber-700">
              {'Migrace probíhá sekvenčně — u větších kolekcí může trvat několik minut. Stránku nezavírejte.'}
            </p>
          </div>

          <button
            onClick={handleImageMigration}
            disabled={imgMigrating || !Object.values(imgCollections).some(Boolean)}
            className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white px-5 py-2.5 rounded-xl text-[13px] font-bold transition-colors disabled:opacity-50 cursor-pointer"
          >
            {imgMigrating ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImageIcon className="w-4 h-4" />}
            {imgMigrating ? 'Probíhá migrace obrázků...' : 'Spustit migraci obrázků'}
          </button>

          {/* Výsledky */}
          {imgResult && (
            <div className="mt-4 bg-violet-50 rounded-xl p-4 border border-violet-200">
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle className="w-4 h-4 text-violet-600" />
                <p className="text-[13px] font-bold text-violet-800">
                  {`Hotovo! Celkem migrováno ${imgResult.totalMigrated} obrázků${imgResult.totalErrors > 0 ? `, ${imgResult.totalErrors} chyb` : ''}.`}
                </p>
              </div>
              <div className="text-[11px] text-violet-600 mb-3 font-mono">
                {'Bucket: '}<span className="font-bold">{imgResult.bucket}</span>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {Object.entries(imgResult.results || {}).map(([col, stats]: [string, any]) => (
                  <div key={col} className="bg-white rounded-lg border border-violet-200 p-3">
                    <p className="text-[11px] font-bold text-violet-700 mb-2 capitalize">{col}</p>
                    <div className="space-y-1">
                      <div className="flex justify-between text-[11px]">
                        <span className="text-gray-500">{'Celkem'}</span>
                        <span className="font-bold text-gray-700">{stats.total}</span>
                      </div>
                      <div className="flex justify-between text-[11px]">
                        <span className="text-green-600">{'Migrováno'}</span>
                        <span className="font-bold text-green-700">{stats.migrated}</span>
                      </div>
                      <div className="flex justify-between text-[11px]">
                        <span className="text-gray-400">{'Přeskočeno'}</span>
                        <span className="font-bold text-gray-500">{stats.skipped}</span>
                      </div>
                      {stats.errors > 0 && (
                        <div className="flex justify-between text-[11px]">
                          <span className="text-red-500">{'Chyby'}</span>
                          <span className="font-bold text-red-600">{stats.errors}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Metodické principy: hromadné obrázky ───────────────── */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-6">
          <div className="flex items-start gap-4 mb-4">
            <div className="w-12 h-12 bg-sky-50 rounded-xl flex items-center justify-center shrink-0">
              <Sparkles className="w-6 h-6 text-sky-600" />
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-bold text-[#001161]">Metodické principy — hromadné obrázky</h2>
              <p className="text-[13px] text-gray-500 mt-1">
                Vyber předmět, nahraj více souborů najednou. Soubory se přiřadí kartám podle{' '}
                <strong>názvu bez přípony</strong> — odpovídá „slugu“ z nadpisu karty (malá písmena, bez diakritiky,
                místo mezer pomlčky). Volitelně <code className="text-[11px] bg-gray-100 px-1 rounded">1.png</code> až{' '}
                <code className="text-[11px] bg-gray-100 px-1 rounded">N.png</code> podle pořadí karty v seznamu níže.
              </p>
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-1">Předmět</label>
            <select
              value={mpiSubjectId}
              onChange={(e) => setMpiSubjectId(e.target.value)}
              className="w-full max-w-xl px-3 py-2 text-[13px] border border-gray-200 rounded-xl bg-white focus:border-sky-400 outline-none"
            >
              <option value="">— vyber předmět —</option>
              {(mpiSubjects ?? []).map((s: any) => (
                <option key={s.id} value={s.id}>
                  {s.displayName || s.slug || s.id}
                  {s.slug ? ` (${s.slug})` : ''}
                </option>
              ))}
            </select>
            <p className="text-[12px] text-gray-500 mt-2">
              U předmětů se známou šablonou se seznam doplní o chybějící karty z repa (např. 9. princip u matematiky 2. st.), aby šlo nahrát všechny obrázky.
            </p>
          </div>

          {mpiSelected && (
            <div className="rounded-xl border border-sky-100 bg-sky-50/60 p-4 mb-4">
              <p className="text-[11px] font-bold text-sky-900 mb-2">
                {mpiWorkingRows.length
                  ? `Očekávané názvy souborů (${mpiWorkingRows.length} karet):`
                  : 'Pro tento předmět není šablona ani uložené karty — nejdřív vyplň metodické principy v kolekci Předměty.'}
              </p>
              {mpiWorkingRows.length > 0 && (
                <ul className="max-h-40 overflow-y-auto space-y-1 text-[11px] font-mono text-sky-900/85">
                  {mpiWorkingRows.map((row: any, i: number) => (
                    <li key={i}>
                      <span className="text-sky-600/70 w-5 inline-block">{i + 1}.</span>
                      {methodPrincipleTitleToFileStem(row.title)}
                      <span className="text-gray-400">.png</span>
                      <span className="text-sky-700/60 ml-2">(nebo {i + 1}.png)</span>
                    </li>
                  ))}
                </ul>
              )}
              {!mpiWorkingRows.length && mpiTemplate == null && (
                <p className="text-[12px] text-amber-800">
                  Slug „{String(mpiSelected.slug)}“ nemá automatickou šablonu. Otevři{' '}
                  <strong>Admin → Kolekce → Předměty</strong> a použij tlačítko pro vyplnění principů, pak sem vrať.
                </p>
              )}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3 mb-4">
            <label className="flex items-center gap-2 bg-sky-600 hover:bg-sky-700 text-white px-4 py-2.5 rounded-xl text-[13px] font-bold cursor-pointer transition-colors disabled:opacity-50">
              <Upload className="w-4 h-4" />
              Vybrat obrázky…
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                multiple
                className="hidden"
                disabled={!mpiSubjectId || mpiBusy || !mpiWorkingRows.length}
                onChange={handleMpiFilesChosen}
              />
            </label>
            <button
              type="button"
              onClick={handleMpiApply}
              disabled={mpiBusy || !mpiPreview?.matches.length}
              className="flex items-center gap-2 bg-[#001161] hover:bg-[#000d4a] text-white px-4 py-2.5 rounded-xl text-[13px] font-bold transition-colors disabled:opacity-50"
            >
              {mpiBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
              Nahrát a uložit předmět
            </button>
          </div>

          {mpiPreview && (
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 space-y-2">
              <p className="text-[12px] font-bold text-gray-700">
                Náhled párování: {mpiPreview.matches.length} souborů → karty
              </p>
              <ul className="text-[11px] text-gray-600 space-y-1 max-h-36 overflow-y-auto">
                {mpiPreview.matches.map((m, i) => (
                  <li key={i}>
                    <span className="font-mono text-[#001161]">{m.file.name}</span>
                    {' → '}
                    karta {m.index + 1} ({m.how})
                    {' — '}
                    {mpiWorkingRows[m.index]?.title ?? '?'}
                  </li>
                ))}
              </ul>
              {mpiPreview.unmatchedFiles.length > 0 && (
                <div className="text-[11px] text-amber-800 pt-2 border-t border-amber-100">
                  <span className="font-bold">Nespárováno:</span> {mpiPreview.unmatchedFiles.join(', ')}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Static Data Seed */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-6">
          <div className="flex items-start gap-4 mb-4">
            <div className="w-12 h-12 bg-emerald-50 rounded-xl flex items-center justify-center shrink-0">
              <ArrowRight className="w-6 h-6 text-emerald-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-[#001161]">{'Import statických dat'}</h2>
              <p className="text-[13px] text-gray-500 mt-1">
                {'Naimportuje blog příspěvky, novinky a webináře z lokálních statických souborů do Supabase.'}
              </p>
            </div>
          </div>

          <div className="bg-emerald-50 rounded-xl p-4 mb-4">
            <div className="flex items-center gap-4 text-[12px] text-emerald-700">
              <span className="flex items-center gap-1.5">
                <CheckCircle className="w-3.5 h-3.5" />
                {`Blog: ${BLOG_POSTS.length} příspěvků`}
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle className="w-3.5 h-3.5" />
                {`Novinky: ${NOVINKA_POSTS.length} položek`}
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle className="w-3.5 h-3.5" />
                {`Webináře: ${WEBINARS.length} webinářů`}
              </span>
            </div>
          </div>

          <button
            onClick={handleSeedAll}
            disabled={isMigrating}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl text-[13px] font-bold transition-colors disabled:opacity-50 cursor-pointer"
          >
            {isMigrating ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
            {'Naimportovat vše do Supabase'}
          </button>
        </div>

        {/* ── Taby z Webflow ────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-6">
          <div className="flex items-start gap-4 mb-4">
            <div className="w-12 h-12 bg-orange-50 rounded-xl flex items-center justify-center shrink-0">
              <LayoutGrid className="w-6 h-6 text-[#ff8c66]" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg font-bold text-[#001161]">Taby (prodejní argumenty) z Webflow</h2>
                <span className="px-2 py-0.5 rounded-full bg-orange-100 text-[#ff8c66] text-[11px] font-bold font-mono">{tabsId}</span>
              </div>
              <p className="text-[13px] text-gray-500 mt-1">
                Stáhne taby z Webflow kolekce, zobrazí všechna pole, umožní je namapovat na naše schéma a importuje do Supabase (sloučení — existující záznamy se nepřepíší).
              </p>
            </div>
          </div>

          {/* Info box */}
          <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4">
            <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
            <p className="text-[12px] text-amber-700">
              Taby jsou vždy spjaté s konkrétním předmětem — viditelné <strong>pouze v sekci Předměty → [Předmět] → Taby</strong>. Při importu vyber, ke kterému předmětu taby patří.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-4">
            <div>
              <label className="block text-[11px] font-bold text-orange-800 mb-1">Webflow Collection ID</label>
              <input
                value={tabsId}
                onChange={e => setTabsId(e.target.value)}
                className="w-full px-3 py-2 text-[12px] bg-white border border-orange-200 rounded-lg focus:border-orange-400 outline-none font-mono"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-orange-800 mb-1">
                Přiřadit k předmětu <span className="text-orange-400 font-normal text-[10px]">(volitelné — server přiřadí automaticky z Webflow ref ID)</span>
              </label>
              {subjectList.length > 0 ? (
                <select
                  value={tabsForceSubject}
                  onChange={e => setTabsForceSubject(e.target.value)}
                  className="w-full px-3 py-2 text-[12px] bg-white border border-orange-200 rounded-lg focus:border-[#ff8c66] outline-none"
                >
                  <option value="">-- Auto (z Webflow reference ID) --</option>
                  {subjectList.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              ) : (
                <input
                  type="text"
                  value={tabsForceSubject}
                  onChange={e => setTabsForceSubject(e.target.value)}
                  placeholder="Nechat prázdné = auto-přiřazení"
                  className="w-full px-3 py-2 text-[12px] bg-white border border-orange-200 rounded-lg focus:border-[#ff8c66] outline-none"
                />
              )}
            </div>
          </div>

          <div className="flex gap-3 mb-4 flex-wrap">
            <button
              onClick={handleTabsPreview}
              disabled={tabsStatus !== 'idle'}
              className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2.5 rounded-xl text-[13px] font-bold transition-colors disabled:opacity-50 cursor-pointer"
            >
              {tabsStatus === 'previewing' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />}
              Preview + auto-mapování polí
            </button>
            <button
              onClick={handleTabsImport}
              disabled={tabsStatus !== 'idle' || !tabsPreview}
              className="flex items-center gap-2 bg-[#ff8c66] hover:bg-[#ff7a4d] text-white px-5 py-2.5 rounded-xl text-[13px] font-bold transition-colors disabled:opacity-50 cursor-pointer"
            >
              {tabsStatus === 'importing' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Database className="w-4 h-4" />}
              {tabsForceSubject ? `Importovat → ${tabsForceSubject}` : 'Importovat taby do Supabase'}
            </button>
            <button
              onClick={handleTabsDiag}
              disabled={tabsDiagLoading}
              className="flex items-center gap-2 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 px-4 py-2.5 rounded-xl text-[13px] font-bold transition-colors disabled:opacity-50 cursor-pointer"
            >
              {tabsDiagLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bug className="w-4 h-4" />}
              Diagnostika DB
            </button>
            <button
              onClick={async () => {
                if (!confirm('Pokusí se opravit prázdné subject hodnoty u existujících tabů z metadata.name. Pokračovat?')) return;
                setTabsDiagLoading(true);
                try {
                  const res = await fetch(`${SERVER}/admin/tabs/reassign-subjects`, { method: 'POST', headers: AUTH(publicAnonKey) });
                  const d = await safeJson(res);
                  if (d.success) { toast.success(`Opraveno ${d.fixed} tabů z ${d.total}.`); handleTabsDiag(); }
                  else toast.error(`Chyba: ${d.error}`);
                } catch (e: any) { toast.error(e.message); }
                finally { setTabsDiagLoading(false); }
              }}
              disabled={tabsDiagLoading}
              className="flex items-center gap-2 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 px-4 py-2.5 rounded-xl text-[13px] font-bold transition-colors disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
              Opravit subject (z metadata.name)
            </button>
            <button
              onClick={async () => {
                if (!confirm('Rozdělí předmět "Matematika" na dva záznamy: "Matematika-1" (1. stupeň) a "Matematika 2" (2. stupeň). Původní "Matematika" bude odstraněna. Pokračovat?')) return;
                setTabsDiagLoading(true);
                try {
                  const res = await fetch(`${SERVER}/admin/predmety/split-matematika`, { method: 'POST', headers: AUTH(publicAnonKey) });
                  const d = await safeJson(res);
                  if (d.success) {
                    const msg = d.created.length > 0
                      ? `Vytvořeno: ${d.created.join(', ')}. Odstraněno: "${d.removed}". Celkem ${d.total} předmětů.`
                      : `Již existovalo: ${d.alreadyExisted.join(', ')}`;
                    toast.success(msg);
                  } else {
                    toast.error(`Chyba: ${d.error}`);
                  }
                } catch (e: any) { toast.error(e.message); }
                finally { setTabsDiagLoading(false); }
              }}
              disabled={tabsDiagLoading}
              className="flex items-center gap-2 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 px-4 py-2.5 rounded-xl text-[13px] font-bold transition-colors disabled:opacity-50 cursor-pointer"
            >
              ✂️ Rozdělit Matematiku (1. + 2. stupeň)
            </button>
          </div>

          {tabsDiag && (
            <div className="bg-blue-50 rounded-xl p-4 border border-blue-200 mb-4">
              <p className="text-[12px] font-bold text-blue-800 mb-2">🔍 V DB: {tabsDiag.total} tabů — rozložení dle subject:</p>
              <div className="space-y-1 mb-3">
                {Object.entries(tabsDiag.bySubject).sort((a: any, b: any) => b[1] - a[1]).map(([subj, cnt]: any) => (
                  <div key={subj} className="flex items-center gap-2">
                    <span className={`inline-block w-2 h-2 rounded-full shrink-0 ${subj === '(prázdný)' ? 'bg-red-400' : 'bg-blue-400'}`} />
                    <span className="text-[11px] font-mono text-blue-900">{subj}</span>
                    <span className="text-[10px] text-blue-500 ml-auto">{cnt}×</span>
                  </div>
                ))}
              </div>
              {tabsDiag.sample?.[0] && (
                <details className="text-[10px] text-blue-600">
                  <summary className="cursor-pointer font-bold">Ukázka prvního tabu (raw)</summary>
                  <pre className="mt-1 bg-white p-2 rounded text-[9px] overflow-x-auto border border-blue-100">
                    {JSON.stringify({ tabText: tabsDiag.sample[0].tabText, subject: tabsDiag.sample[0].subject, order: tabsDiag.sample[0].order }, null, 2)}
                  </pre>
                </details>
              )}
            </div>
          )}

          {tabsPreview && (
            <div className="bg-gray-50 rounded-xl p-4 border border-gray-200 mb-4">
              <p className="text-[12px] font-bold text-gray-600 mb-1">
                {`${tabsPreview.count} tabů v kolekci. Webflow pole → naše pole (uprav dle potřeby):`}
              </p>
              <p className="text-[11px] text-gray-400 mb-3 italic">
                Cílová pole: <span className="font-mono text-[#ff8c66] not-italic">tabText, contentHeadline, contentRichText, contentImage, subject, subpage, order, bgColor</span>
              </p>
              <div className="space-y-1.5 max-h-[320px] overflow-y-auto">
                {tabsPreview.preview?.[0]?.fieldData && Object.keys(tabsPreview.preview[0].fieldData).map((wfKey: string) => {
                  const exampleVal = tabsPreview.preview[0].fieldData[wfKey];
                  return (
                    <div key={wfKey} className="flex items-center gap-2">
                      <div className="w-[190px] shrink-0 px-2.5 py-1.5 bg-white border border-gray-200 rounded-lg font-mono text-[#001161]/60 text-[11px] truncate" title={wfKey}>
                        {wfKey}
                      </div>
                      <ArrowRightLeft className="w-3.5 h-3.5 text-gray-300 shrink-0" />
                      <input
                        value={tabsMapping[wfKey] ?? ''}
                        onChange={e => setTabsMapping(m => ({ ...m, [wfKey]: e.target.value }))}
                        placeholder="cílové pole (prázdné = přeskočit)"
                        className="w-[190px] shrink-0 px-2.5 py-1.5 bg-white border border-orange-200 rounded-lg text-[11px] font-mono focus:border-[#ff8c66] outline-none"
                      />
                      <div className="flex-1 text-[10px] text-gray-400 truncate pl-1">
                        {typeof exampleVal === 'object' ? JSON.stringify(exampleVal).slice(0, 60) : String(exampleVal ?? '').slice(0, 60)}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {tabsResult && (
            <div className="bg-orange-50 rounded-xl p-4 border border-orange-200">
              <div className="flex items-center gap-2 mb-1">
                <CheckCircle className="w-4 h-4 text-[#ff8c66]" />
                <p className="text-[12px] font-bold text-orange-800">
                  {`Importováno ${tabsResult.count} tabů (celkem ${tabsResult.total} v databázi).`}
                </p>
              </div>
              <p className="text-[11px] text-orange-500 mb-2 pl-6">
                {tabsForceSubject
                  ? <>Přiřazeno k předmětu: <strong>{tabsForceSubject}</strong> — zobrazte je v <strong>Předměty → {tabsForceSubject} → Taby</strong></>
                  : <>Subject přeložen automaticky z Webflow reference ID. Zkontrolujte v Předměty → Taby.</>
                }
              </p>
              <div className="space-y-1">
                {tabsResult.sample?.map((t: any, i: number) => (
                  <div key={i} className="text-[11px] text-orange-700 flex items-center gap-2">
                    <span className="font-bold w-4 shrink-0">{t.order}.</span>
                    <span className="font-semibold truncate">{t.tabText || '—'}</span>
                    {t.subject && <><span className="text-orange-300">·</span><span className="text-orange-500 shrink-0">{t.subject}</span></>}
                    {t.contentHeadline && <><span className="text-orange-300">·</span><span className="truncate text-orange-600">{t.contentHeadline}</span></>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Generický JSON importer ───────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-6">
          <div className="flex items-start gap-4 mb-4">
            <div className="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center shrink-0">
              <Code2 className="w-6 h-6 text-indigo-600" />
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-bold text-[#001161]">Generický JSON import</h2>
              <p className="text-[13px] text-gray-500 mt-1">
                Vlož libovolný JSON (pole objektů nebo <code className="text-[11px] bg-gray-100 px-1 rounded">{"{ items: [...] }"}</code>), vyber cílovou kolekci, nastav mapování polí a importuj do Supabase.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-4">
            <div>
              <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-1">Cílová kolekce</label>
              <select
                value={jsonCollection}
                onChange={e => setJsonCollection(e.target.value)}
                className="w-full px-3 py-2 text-[13px] border border-gray-200 rounded-xl bg-white focus:border-indigo-400 outline-none"
              >
                <option value="tabs">Taby</option>
                <option value="predmety">Předměty</option>
                <option value="blog">Blog</option>
                <option value="novinky">Novinky</option>
                <option value="webinare">Webináře</option>
                <option value="notifikace">Notifikace</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-1">Režim importu</label>
              <div className="flex gap-2 h-[38px]">
                <button
                  onClick={() => setJsonAppend(true)}
                  className={`flex-1 text-[12px] font-bold rounded-xl border-2 transition-colors ${jsonAppend ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}
                >Sloučit</button>
                <button
                  onClick={() => setJsonAppend(false)}
                  className={`flex-1 text-[12px] font-bold rounded-xl border-2 transition-colors ${!jsonAppend ? 'border-red-400 bg-red-50 text-red-600' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}
                >Přepsat</button>
              </div>
            </div>
          </div>

          <div className="mb-3">
            <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-1">JSON data</label>
            <textarea
              value={jsonText}
              onChange={e => { setJsonText(e.target.value); setJsonParsed(null); setJsonError(''); setJsonResult(null); }}
              placeholder={'[\n  {\n    "tab-text": "Učební text",\n    "content-headline": "Interaktivní lekce",\n    "subject": "Fyzika",\n    "order": 1\n  }\n]'}
              rows={8}
              className="w-full px-3 py-2.5 text-[12px] font-mono border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:border-indigo-400 outline-none resize-y transition-all"
            />
            {jsonError && (
              <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-red-600">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />{jsonError}
              </div>
            )}
          </div>

          <button
            onClick={handleJsonParse}
            disabled={!jsonText.trim()}
            className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2.5 rounded-xl text-[13px] font-bold mb-4 transition-colors disabled:opacity-40"
          >
            <Eye className="w-4 h-4" />
            Parsovat JSON + nastavit mapování
          </button>

          {jsonParsed && jsonParsed.length > 0 && (
            <div className="bg-gray-50 rounded-xl p-4 border border-gray-200 mb-4">
              <div className="flex items-center justify-between mb-1">
                <p className="text-[12px] font-bold text-gray-600">{`${jsonParsed.length} záznamů, ${Object.keys(jsonParsed[0]).length} polí. Nastav mapování (zdrojové pole → cílové pole):`}</p>
              </div>
              <p className="text-[11px] text-gray-400 mb-3 italic">
                Uprav cílové názvy polí. Pokud je zdroj = cíl, pole se přenese beze změny. Prefix <code className="bg-white px-1 rounded">_</code> = přeskočit.
              </p>
              <div className="space-y-1.5 max-h-[300px] overflow-y-auto">
                {Object.keys(jsonParsed[0]).map((srcKey) => {
                  const exampleVal = jsonParsed[0][srcKey];
                  return (
                    <div key={srcKey} className="flex items-center gap-2">
                      <div className="w-[170px] shrink-0 px-2.5 py-1.5 bg-white border border-gray-200 rounded-lg font-mono text-[#001161]/60 text-[11px] truncate" title={srcKey}>
                        {srcKey}
                      </div>
                      <ArrowRight className="w-3.5 h-3.5 text-gray-300 shrink-0" />
                      <input
                        value={jsonMapping[srcKey] ?? srcKey}
                        onChange={e => setJsonMapping(m => ({ ...m, [srcKey]: e.target.value }))}
                        className="w-[170px] shrink-0 px-2.5 py-1.5 bg-white border border-indigo-200 rounded-lg text-[11px] font-mono focus:border-indigo-500 outline-none"
                      />
                      <div className="flex-1 text-[10px] text-gray-400 truncate pl-1">
                        {typeof exampleVal === 'object' ? JSON.stringify(exampleVal).slice(0, 60) : String(exampleVal ?? '').slice(0, 60)}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {jsonParsed && (
            <button
              onClick={handleJsonImport}
              disabled={jsonStatus === 'importing'}
              className={`flex items-center gap-2 text-white px-5 py-2.5 rounded-xl text-[13px] font-bold transition-colors disabled:opacity-50 ${jsonAppend ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-red-500 hover:bg-red-600'}`}
            >
              {jsonStatus === 'importing' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Database className="w-4 h-4" />}
              {jsonAppend ? `Sloučit ${jsonParsed.length} záznamů → „${jsonCollection}"` : `PŘEPSAT „${jsonCollection}" (${jsonParsed.length} záznamů)`}
            </button>
          )}

          {jsonResult && (
            <div className="mt-4 bg-indigo-50 rounded-xl p-4 border border-indigo-200">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="w-4 h-4 text-indigo-600" />
                <p className="text-[12px] font-bold text-indigo-800">
                  {`Import hotov! ${jsonResult.count} záznamů importováno, ${jsonResult.total} celkem v databázi.`}
                </p>
              </div>
              {jsonResult.sample?.[0] && (
                <div className="bg-white rounded-lg p-3 border border-indigo-100">
                  <pre className="text-[10px] font-mono text-gray-600 whitespace-pre-wrap overflow-x-auto max-h-[200px]">
                    {JSON.stringify(jsonResult.sample[0], null, 2).slice(0, 600)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Future: AI & RAG note */}
        <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-2xl border border-gray-200 p-6">
          <h3 className="text-[14px] font-bold text-gray-600 mb-2">{'Připravujeme: RAG Databáze & AI Agent'}</h3>
          <p className="text-[12px] text-gray-500 leading-relaxed">
            {'V budoucnu zde bude možnost automaticky indexovat veškerý firemní obsah do RAG databáze. AI agent bude moci automaticky vytvářet nové produkty, generovat popisy, psát blogové příspěvky a novinky.'}
          </p>
        </div>

        {/* Debug Webflow */}
        <div className="bg-gray-50 rounded-2xl border border-gray-200 p-6 mt-6">
          <div className="flex items-start gap-4 mb-4">
            <div className="w-12 h-12 bg-red-50 rounded-xl flex items-center justify-center shrink-0">
              <Bug className="w-6 h-6 text-red-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-[#001161]">{'Debug Webflow'}</h2>
              <p className="text-[13px] text-gray-500 mt-1">
                {'Získáte raw JSON odpověď z Webflow API pro ladění a kontrolu dat.'}
              </p>
            </div>
          </div>

          <button
            onClick={handleDebugWebflow}
            disabled={debugLoading}
            className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-5 py-2.5 rounded-xl text-[13px] font-bold transition-colors disabled:opacity-50 cursor-pointer"
          >
            {debugLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Database className="w-4 h-4" />}
            {'Spustit debug Webflow'}
          </button>

          {debugData && (
            <div className="bg-gray-50 rounded-xl p-4 border border-gray-200 mt-4">
              <p className="text-[12px] font-bold text-gray-600 mb-3">{'Debug odpověď z Webflow:'}</p>
              <div className="bg-white rounded-lg border border-gray-200 p-3 max-h-[600px] overflow-y-auto">
                <pre className="text-[11px] font-mono text-gray-600 whitespace-pre-wrap break-all">
                  {JSON.stringify(debugData, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}