import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Brain, Database, Bot, FileText, Newspaper, Radio, Package,
  Upload, RefreshCw, CheckCircle2, AlertCircle, Clock, Sparkles,
  ArrowRight, Layers, Search, Send, Plus, Trash2,
  FileUp, BookOpen, Info, ShieldCheck, Cpu, Network,
  BarChart3, XCircle, Play,
  FlaskConical, HardDrive, Settings2, AlertTriangle, Filter, Map, X, Zap,
  Download, FileJson, FileSpreadsheet, FileCode2, ChevronDown, Loader2,
  FilePlus2, FolderOpen, Tag, Replace,
  ExternalLink, ShoppingCart, Calendar, Rss, MessageSquare, Mail,
} from 'lucide-react';
import { projectId, publicAnonKey } from '../../utils/supabase/info';
import { RagKnowledgeMap } from './RagKnowledgeMap';
import * as ragApi from '../../utils/ragApi';

// ── Types ─────────────────────────────────────────────────────────────────
type Tab = 'architektura' | 'mapa' | 'zdroje' | 'databaze' | 'agent' | 'test' | 'upload';

interface DataSource {
  id: string; name: string; icon: any; type: 'supabase' | 'manual';
  count: number; indexed: number; lastSync: string | null;
  status: 'synced' | 'pending' | 'error' | 'not-indexed'; color: string;
  source: 'produkty' | 'blog' | 'novinky' | 'webinare' | 'tabs' | 'mailchimp' | null;
}

interface AgentLog { id: string; time: string; type: 'info' | 'success' | 'warning' | 'error'; message: string; }

// ── Shared helpers ─────────────────────────────────────────────────────────
function StatusDot({ status }: { status: DataSource['status'] }) {
  const map = { synced: 'bg-emerald-400', pending: 'bg-amber-400', error: 'bg-red-400', 'not-indexed': 'bg-gray-300' };
  return <span className={`inline-block w-2 h-2 rounded-full ${map[status]} shrink-0`} />;
}

// ── Architecture Tab ───────────────────────────────────────────────────────
function ArchitectureTab() {
  return (
    <div className="p-8 overflow-y-auto h-full">
      <div className="mb-8">
        <h2 className="font-['Cooper_Light',serif] text-[#001161] text-[28px] leading-tight mb-2">{'Architektura RAG syst\u00e9mu'}</h2>
        <p className="font-['Fenomen_Sans',sans-serif] text-[#001161]/55 text-[14px] max-w-[620px]">{'Data z Webflow/Supabase + ru\u010dn\u011b nahr\u00e1van\u00e9 dokumenty jsou indexov\u00e1na do vektorov\u00e9 datab\u00e1ze. Gemini agent dr\u017e\u00ed datab\u00e1zi \u010distou.'}</p>
      </div>
      <div className="flex flex-col gap-6">
        {/* Row 1 */}
        <div>
          <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-3 flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 font-black">1</span>
            {'Datov\u00e9 zdroje'}
          </div>
          <div className="grid grid-cols-7 gap-3">
            {[
              { label: 'Produkty', sub: 'Supabase table', icon: Package, color: '#7C3AED', bg: '#F5F3FF' },
              { label: 'Blog', sub: 'Supabase table', icon: FileText, color: '#001161', bg: '#EEF0FA' },
              { label: 'Novinky', sub: 'Supabase table', icon: Newspaper, color: '#ff6a35', bg: '#FFF3EE' },
              { label: 'Webin\u00e1\u0159e', sub: 'Supabase table', icon: Radio, color: '#0ea5e9', bg: '#F0F9FF' },
              { label: 'Taby p\u0159edm\u011bt\u016f', sub: 'Supabase table', icon: BookOpen, color: '#059669', bg: '#ECFDF5' },
              { label: 'Mailchimp', sub: 'Email kampaně', icon: Mail, color: '#FFE01B', bg: '#FFFDE7' },
              { label: 'Vlastn\u00ed PDF', sub: 'Manu\u00e1ln\u00ed upload', icon: Upload, color: '#16a34a', bg: '#F0FDF4' },
            ].map(s => (
              <div key={s.label} className="rounded-2xl border-2 p-3.5 flex flex-col gap-2" style={{ borderColor: s.color + '22', background: s.bg }}>
                <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: s.color + '18' }}>
                  <s.icon className="w-4 h-4" style={{ color: s.color }} />
                </div>
                <div>
                  <div className="font-['Fenomen_Sans',sans-serif] font-bold text-[13px] text-[#001161]">{s.label}</div>
                  <div className="font-['Fenomen_Sans',sans-serif] text-[11px] text-[#001161]/45">{s.sub}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-center gap-2 text-[#001161]/25">
          <div className="flex-1 border-t-2 border-dashed border-current" />
          <div className="flex flex-col items-center gap-1">
            <ArrowRight className="w-5 h-5 rotate-90" />
            <span className="text-[11px] font-['Fenomen_Sans',sans-serif] whitespace-nowrap font-bold text-[#001161]/40">{'Chunking + embedding'}</span>
          </div>
          <div className="flex-1 border-t-2 border-dashed border-current" />
        </div>

        {/* Row 2 */}
        <div>
          <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-3 flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 font-black">2</span>
            {'Zpracov\u00e1n\u00ed — Gemini Embedding'}
          </div>
          <div className="grid grid-cols-3 gap-4">
            {[
              { title: 'Chunking', icon: Layers, grad: 'from-[#001161] to-[#1a3aad]', desc: 'Text rozbit na \u00fasek (1800 znak\u016f) s p\u0159ekryvem 200 znak\u016f. Metadata (typ, id, datum) ulo\u017eena spolu.' },
              { title: 'Gemini gemini-embedding-001', icon: Cpu, grad: 'from-[#7C3AED] to-[#a855f7]', desc: 'Ka\u017ed\u00fd chunk z\u00edsk\u00e1 3072-dimenz. vektor. API vol\u00e1n\u00ed s rozestupy pro Gemini rate limity.' },
              { title: 'Supabase KV + cosine', icon: HardDrive, grad: 'from-[#0ea5e9] to-[#38bdf8]', desc: 'Vektory ulo\u017eeny v KV store (rag_chunk_v1_*). Cosine-similarity search v memory (\u226450ms pro ~1000 chunk\u016f).' },
            ].map(s => (
              <div key={s.title} className={`rounded-2xl bg-gradient-to-br ${s.grad} p-4 text-white`}>
                <div className="flex items-center gap-2 mb-3">
                  <s.icon className="w-5 h-5 opacity-70" />
                  <span className="font-['Fenomen_Sans',sans-serif] font-bold text-[13px]">{s.title}</span>
                </div>
                <p className="text-[12px] opacity-60 font-['Fenomen_Sans',sans-serif] leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-center gap-2 text-[#001161]/25">
          <div className="flex-1 border-t-2 border-dashed border-current" />
          <div className="flex flex-col items-center gap-1">
            <ArrowRight className="w-5 h-5 rotate-90" />
            <span className="text-[11px] font-['Fenomen_Sans',sans-serif] whitespace-nowrap font-bold text-[#001161]/40">{'Pr\u016fb\u011b\u017en\u00e1 \u00fdr\u017eba'}</span>
          </div>
          <div className="flex-1 border-t-2 border-dashed border-current" />
        </div>

        {/* Row 3 — Agent */}
        <div>
          <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-3 flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-amber-100 flex items-center justify-center text-amber-600 font-black">3</span>
            {'Gemini 3 Flash Cleaning Agent — dedikovan\u00fd model'}
          </div>
          <div className="rounded-2xl border-2 border-amber-200 bg-amber-50 p-5">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-amber-400/20 border-2 border-amber-300 flex items-center justify-center shrink-0">
                <Bot className="w-6 h-6 text-amber-600" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <span className="font-['Fenomen_Sans',sans-serif] font-bold text-[15px] text-[#001161]">{'Gemini 3 Flash — Agent \u010distoty'}</span>
                  <span className="text-[11px] bg-amber-200 text-amber-700 px-2 py-0.5 rounded-full font-bold font-['Fenomen_Sans',sans-serif]">{'gemini-3-flash-preview'}</span>
                  <span className="text-[11px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-bold font-['Fenomen_Sans',sans-serif]">{'Aktivn\u00ed'}</span>
                </div>
                <p className="font-['Fenomen_Sans',sans-serif] text-[13px] text-[#001161]/65 mb-4 leading-relaxed">{'Samostatn\u00fd Gemini 3 Flash se syst\u00e9mov\u00fdm promptem zam\u011b\u0159en\u00fdm v\u00fdlu\u010dn\u011b na \u010distotu znalost\u00ed.'}</p>
                <div className="grid grid-cols-4 gap-3">
                  {[
                    { icon: Filter, label: 'Deduplikace', desc: 'cosine sim > 0.95' },
                    { icon: ShieldCheck, label: 'Quality score', desc: 'threshold 0.35' },
                    { icon: Settings2, label: 'HTML \u010di\u0161t\u011bn\u00ed', desc: 'Artefakty' },
                    { icon: Trash2, label: 'Auto-clean', desc: 'N\u00edzk\u00e1 kvalita' },
                  ].map(f => (
                    <div key={f.label} className="bg-white rounded-xl p-3 border border-amber-100">
                      <f.icon className="w-4 h-4 text-amber-500 mb-1.5" />
                      <div className="font-['Fenomen_Sans',sans-serif] font-bold text-[12px] text-[#001161]">{f.label}</div>
                      <div className="font-['Fenomen_Sans',sans-serif] text-[11px] text-[#001161]/50 mt-0.5">{f.desc}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="rounded-2xl bg-[#001161] p-5 flex items-center justify-between">
          <div className="text-white">
            <div className="font-['Cooper_Light',serif] text-[18px] mb-0.5">{'Stav syst\u00e9mu'}</div>
            <div className="font-['Fenomen_Sans',sans-serif] text-[13px] opacity-50">{'Backend aktivn\u00ed — GEMINI_API_KEY_RAG zapojen, System 2 aktivn\u00ed'}</div>
          </div>
          <div className="flex gap-6">
            {[
              { val: 'KV', label: 'Vector store' },
              { val: '3072', label: 'Dimenz\u00ed' },
              { val: '3 Flash', label: 'RAG model' },
              { val: 'gemini-emb-001', label: 'Embedding' },
            ].map(s => (
              <div key={s.label} className="text-center">
                <div className="font-['Cooper_Light',serif] text-[18px] text-white">{s.val}</div>
                <div className="font-['Fenomen_Sans',sans-serif] text-[11px] text-white/40">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Sources Tab (with real ingest) ─────────────────────────────────────────
function SourcesTab() {
  const [sources, setSources] = useState<DataSource[]>([
    { id: 'produkty', name: 'Produkty (u\u010debnice)', icon: Package,   type: 'supabase', count: 0, indexed: 0, lastSync: null, status: 'not-indexed', color: '#7C3AED', source: 'produkty' },
    { id: 'blog',     name: 'Blog \u010dl\u00e1nky',  icon: FileText,  type: 'supabase', count: 0, indexed: 0, lastSync: null, status: 'not-indexed', color: '#001161', source: 'blog'     },
    { id: 'novinky',  name: 'Novinky',          icon: Newspaper, type: 'supabase', count: 0, indexed: 0, lastSync: null, status: 'not-indexed', color: '#ff6a35', source: 'novinky'  },
    { id: 'webinare', name: 'Webin\u00e1\u0159e',  icon: Radio,     type: 'supabase', count: 0, indexed: 0, lastSync: null, status: 'not-indexed', color: '#0ea5e9', source: 'webinare' },
    { id: 'tabs',     name: 'Taby p\u0159edm\u011bt\u016f', icon: BookOpen,  type: 'supabase', count: 0, indexed: 0, lastSync: null, status: 'not-indexed', color: '#059669', source: 'tabs'    },
    { id: 'mailchimp', name: 'Mailchimp kampaně', icon: Mail,     type: 'supabase', count: 0, indexed: 0, lastSync: null, status: 'not-indexed', color: '#FFE01B', source: 'mailchimp' },
    { id: 'manual',   name: 'Znalostni mapa',   icon: Upload,    type: 'manual',   count: 0, indexed: 0, lastSync: null, status: 'not-indexed', color: '#16a34a', source: null       },
  ]);
  const [ingesting, setIngesting] = useState<string | null>(null);
  const [ingestAll, setIngestAll] = useState(false);
  const [msg, setMsg]     = useState('');
  const [msgType, setMsgType] = useState<'ok' | 'err'>('ok');
  const [debugData, setDebugData] = useState<any>(null);
  const [debugLoading, setDebugLoading] = useState(false);
  const [loadingCounts, setLoadingCounts] = useState(true);

  const mergeSourcesFromDebug = (data: any, opts?: { setLastSyncFor?: string }) => {
    const now = new Date().toLocaleString('cs-CZ');
    setSources((prev) => prev.map((s) => {
      if (!s.source) return s;
      const srcCount = data.sources?.[s.source]?.items ?? 0;
      let indexed = data.chunksPerSource?.[s.source] ?? 0;
      /* Webináře v RAG = krátké záznamy (webinare) + přepisy (webinar-prepis), jinak mate počty. */
      if (s.source === 'webinare') {
        indexed = (data.chunksPerSource?.webinare ?? 0) + (data.chunksPerSource?.['webinar-prepis'] ?? 0);
      }
      const isSynced = indexed > 0;
      const lastSync = opts?.setLastSyncFor === s.id ? now : (s.lastSync ?? null);
      return {
        ...s,
        count: srcCount,
        indexed,
        status: isSynced ? 'synced' : 'not-indexed',
        lastSync,
      };
    }));
  };

  // Load real counts from backend on mount — including actual indexed chunk counts per source
  useEffect(() => {
    (async () => {
      setLoadingCounts(true);
      try {
        const data = await ragApi.ragDebug();
        mergeSourcesFromDebug(data);
        setDebugData(data);
      } catch {
        // ignore — counts stay at 0
      }
      setLoadingCounts(false);
    })();
  }, []);

  const updateSource = (id: string, patch: Partial<DataSource>) =>
    setSources(ss => ss.map(s => s.id === id ? { ...s, ...patch } : s));

  const showMsg = (text: string, type: 'ok' | 'err' = 'ok') => {
    setMsg(text); setMsgType(type);
    setTimeout(() => setMsg(''), 10000);
  };

  const runDebug = async () => {
    setDebugLoading(true);
    setDebugData(null);
    try { setDebugData(await ragApi.ragDebug()); }
    catch (e: any) { setDebugData({ error: e.message }); }
    setDebugLoading(false);
  };

  const ingest = async (src: DataSource) => {
    if (!src.source) return;
    setIngesting(src.id);
    updateSource(src.id, { status: 'pending' });
    try {
      // Mailchimp: call dedicated sync endpoint (fetches campaigns from MC API + indexes into RAG)
      if (src.source === 'mailchimp') {
        const BASE = `https://${projectId}.supabase.co/functions/v1/make-server-93a20b6f`;
        const res = await fetch(`${BASE}/admin/mailchimp/sync?skipRag=1`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${publicAnonKey}`, 'Content-Type': 'application/json' },
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
        if ((data.campaigns ?? 0) === 0) {
          updateSource(src.id, {
            status: 'not-indexed',
            indexed: 0,
            count: 0,
            lastSync: new Date().toLocaleString('cs-CZ'),
          });
          showMsg(`Mailchimp sync proběhl, ale nebyly nalezeny žádné kampaně k indexaci.`, 'err');
          return;
        }
        const r = await ragApi.ragIngestSource('mailchimp');
        let fresh: any = null;
        try { fresh = await ragApi.ragDebug(); } catch { /* ignore */ }
        if (fresh) {
          mergeSourcesFromDebug(fresh, { setLastSyncFor: src.id });
          setDebugData(fresh);
        }
        updateSource(src.id, {
          status: 'synced',
          indexed: fresh?.chunksPerSource?.mailchimp ?? r.ingested,
          count: data.campaigns ?? 0,
          lastSync: new Date().toLocaleString('cs-CZ'),
        });
        showMsg(`\u2713 ${src.name}: ${data.campaigns} kampan\u00ed sta\u017eeno, ${r.ingested} chunk\u016f zaindexov\u00e1no`, 'ok');
      } else {
        const r = await ragApi.ragIngestSource(src.source);
        let fresh: any = null;
        try { fresh = await ragApi.ragDebug(); } catch { /* ignore */ }
        if (fresh) {
          mergeSourcesFromDebug(fresh, { setLastSyncFor: src.id });
          setDebugData(fresh);
        } else {
          updateSource(src.id, {
            status: 'synced',
            indexed: r.ingested,
            count: Math.max(r.ingested, src.count),
            lastSync: new Date().toLocaleString('cs-CZ'),
          });
        }
        showMsg(`\u2713 ${src.name}: ${r.ingested} chunk\u016f ulo\u017eeno${(r as any).failed ? `, ${(r as any).failed} p\u0159esko\u010deno` : ''}`, 'ok');
      }
    } catch (e: any) {
      updateSource(src.id, { status: 'error' });
      showMsg(`Chyba p\u0159i indexaci ${src.name}: ${e.message}`, 'err');
    }
    setIngesting(null);
  };

  const ingestAllSources = async () => {
    setIngestAll(true);
    for (const src of sources.filter(s => s.source)) {
      await ingest(src);
      await new Promise(r => setTimeout(r, 600));
    }
    setIngestAll(false);
  };

  const statusLabels: Record<DataSource['status'], string> = {
    synced: 'Synchronizov\u00e1no', pending: 'Indexuje se\u2026', error: 'Chyba', 'not-indexed': 'Neindexov\u00e1no',
  };

  return (
    <div className="p-8 overflow-y-auto h-full">
      <div className="flex items-start justify-between mb-5 gap-4 flex-wrap">
        <div>
          <h2 className="font-['Cooper_Light',serif] text-[#001161] text-[26px] leading-tight">{'Datov\u00e9 zdroje'}</h2>
          <p className="font-['Fenomen_Sans',sans-serif] text-[#001161]/50 text-[13px] mt-1">{'Klikni \"Indexovat v\u0161e\" nebo jednotliv\u011b — data se embeduj\u00ed p\u0159es Gemini API (gemini-embedding-001, 3072 dim.)'}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={runDebug} disabled={debugLoading}
            className="flex items-center gap-1.5 border border-[#001161]/20 text-[#001161]/60 hover:border-[#001161]/50 px-3 py-1.5 rounded-xl text-[12px] font-['Fenomen_Sans',sans-serif] font-bold transition-colors">
            {debugLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
            {'Diagnostika'}
          </button>
          <button onClick={ingestAllSources} disabled={!!ingesting || ingestAll}
            className="flex items-center gap-1.5 bg-[#001161] disabled:opacity-50 text-white px-4 py-2 rounded-xl text-[13px] font-['Fenomen_Sans',sans-serif] font-bold hover:opacity-85 transition-opacity">
            {ingestAll ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" />{'Indexuji v\u0161e\u2026'}</> : <><Play className="w-3.5 h-3.5" />{'Indexovat v\u0161e'}</>}
          </button>
        </div>
      </div>

      {/* Message */}
      {msg && (
        <div className={`mb-4 px-4 py-3 rounded-2xl font-['Fenomen_Sans',sans-serif] text-[13px] leading-relaxed ${msgType === 'err' ? 'bg-red-50 border border-red-200 text-red-700' : 'bg-emerald-50 border border-emerald-200 text-emerald-700'}`}>
          {msg}
        </div>
      )}

      {/* Debug panel */}
      {debugData && (
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="mb-5 bg-gray-950 rounded-2xl p-5 text-[12px] font-mono">
          <div className="flex items-center justify-between mb-3">
            <span className="text-amber-400 font-bold">{'DIAGNOSTIKA — GET /rag/debug'}</span>
            <button onClick={() => setDebugData(null)} className="text-gray-500 hover:text-gray-300 p-1">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          {debugData.error ? (
            <div className="text-red-400">{'ERROR: '}{debugData.error}</div>
          ) : (
            <div className="space-y-1.5">
              <div className={debugData.geminiKeySet ? 'text-emerald-400' : 'text-red-400'}>
                {'\u2022 GEMINI_API_KEY_RAG: '}{debugData.geminiKeySet ? `SET (\u2713 ${debugData.geminiKeyLength} chars \u2014 ${debugData.geminiKeyPrefix})` : 'NOT SET \u274c'}
              </div>
              {debugData.embeddingTest && (
                <div className="text-emerald-400">{'\u2022 Embedding test: \u2713 OK ('}{debugData.embeddingTest.dims}{' dims) \u2014 API kl\u00ed\u010d funguje!'}</div>
              )}
              {debugData.embeddingError && (
                <div className="text-red-400 break-all">{'\u2022 Embedding test: FAIL \u274c '}{debugData.embeddingError}</div>
              )}
              {debugData.generateTest && (
                <div className="space-y-0.5">
                  <div className="text-emerald-400">{'\u2022 Generation test: \u2713 OK \u2014 kl\u00ed\u010d funguje pro generaci'}</div>
                  {debugData.generateTest.availableEmbedModels?.length > 0 && (
                    <div className="text-amber-300 text-xs ml-3">
                      {'\u2022 Dostupn\u00e9 embed modely: '}{debugData.generateTest.availableEmbedModels.join(', ')}
                    </div>
                  )}
                  {debugData.generateTest.availableEmbedModels?.length === 0 && (
                    <div className="text-red-400 text-xs ml-3">{'\u2022 ListModels: \u017d\u00e1dn\u00e9 embed modely nejsou dostupn\u00e9 pro tento kl\u00ed\u010d!'}</div>
                  )}
                  {debugData.generateTest.listModelsError && (
                    <div className="text-red-400 text-xs ml-3 break-all">{'\u2022 ListModels error: '}{debugData.generateTest.listModelsError}</div>
                  )}
                </div>
              )}
              {debugData.generateError && (
                <div className="text-red-400 break-all">{'\u2022 Generation test: FAIL \u274c '}{debugData.generateError}</div>
              )}
              <div className="text-gray-500 mt-2">{'\u2014 Polo\u017eky v datab\u00e1zi:'}</div>
              {Object.entries(debugData.sources ?? {}).map(([k, v]: any) => (
                <div key={k} className={v.error ? 'text-red-400' : v.items === 0 ? 'text-amber-400' : 'text-gray-300'}>
                  {'  '}{k}: {v.error ? `\u274c ${v.error}` : `${v.items} polo\u017eek`}{v.items === 0 ? ' \u26a0 Pr\u00e1zdn\u00e9 \u2014 spus\u0165 import z Webflow' : ' \u2713'}
                </div>
              ))}
              <div className="text-gray-400 mt-1">{'\u2022 RAG index: '}<span className="text-white">{debugData.ragIndex}</span>{' chunk\u016f aktu\u00e1ln\u011b ulo\u017eeno (System 2 KV)'}</div>
            </div>
          )}
        </motion.div>
      )}

      {/* Source cards */}
      <div className="flex flex-col gap-3 mb-8">
        {sources.map(src => (
          <div key={src.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex items-center gap-5">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: src.color + '18' }}>
              <src.icon className="w-5 h-5" style={{ color: src.color }} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-['Fenomen_Sans',sans-serif] font-bold text-[14px] text-[#001161]">{src.name}</div>
              <div className="font-['Fenomen_Sans',sans-serif] text-[12px] text-[#001161]/40">
                {loadingCounts
                  ? 'Na\u010d\u00edt\u00e1m po\u010dty\u2026'
                  : src.lastSync
                    ? `Posledn\u00ed index: ${src.lastSync}`
                    : src.indexed > 0
                      ? `${src.indexed} chunk\u016f v RAG \u2014 klikni Re-index pro obnoven\u00ed`
                      : 'Neindexov\u00e1no \u2014 klikni Indexovat'}
                {src.id === 'webinare' && debugData?.chunksPerSource && !loadingCounts && (
                  <span className="block text-[11px] text-[#001161]/32 mt-1">
                    {'Z\u00e1znamy (popis): '}{debugData.chunksPerSource.webinare ?? 0}
                    {' \u00b7 P\u0159episy: '}{debugData.chunksPerSource['webinar-prepis'] ?? 0}
                    {' \u2014 hromadn\u00e9 \u201eRe-index\u201c jen obnov\u00ed kr\u00e1tk\u00fd popis; dlouh\u00fd text jde p\u0159es \u201eIndexovat p\u0159epis\u201c u webin\u00e1\u0159e.'}
                  </span>
                )}
              </div>
            </div>
            <div className="w-[160px] shrink-0">
              <div className="flex justify-between mb-1">
                <span className="font-['Fenomen_Sans',sans-serif] text-[11px] text-[#001161]/50">
                  {src.indexed > 0 ? `${src.indexed} chunk\u016f` : src.count > 0 ? `${src.count} dok.` : loadingCounts ? '\u2026' : '0 dok.'}
                </span>
                <span className="font-['Fenomen_Sans',sans-serif] text-[11px] font-bold" style={{ color: src.color }}>
                  {src.status === 'synced' ? `${src.indexed} \u2713` : src.count > 0 ? `${src.count} dok.` : src.status === 'error' ? 'Chyba' : '\u2014'}
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                <motion.div className="h-full rounded-full" style={{ background: src.color }}
                  animate={{ width: src.status === 'synced' ? '100%' : src.status === 'pending' ? '50%' : '0%' }} transition={{ duration: 0.6 }} />
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0 w-[170px]">
              <StatusDot status={src.status} />
              <span className="font-['Fenomen_Sans',sans-serif] text-[12px] text-[#001161]/60">{statusLabels[src.status]}</span>
            </div>
            <div className="shrink-0">
              {src.source ? (
                <button
                  disabled={ingesting === src.id || ingestAll}
                  onClick={() => ingest(src)}
                  className="flex items-center gap-1.5 text-[12px] font-bold font-['Fenomen_Sans',sans-serif] px-3 py-1.5 rounded-lg transition-opacity hover:opacity-80 disabled:opacity-50"
                  style={{ background: src.status === 'synced' ? '#f3f4f6' : '#001161', color: src.status === 'synced' ? '#001161' : '#fff' }}
                >
                  {ingesting === src.id
                    ? <><RefreshCw className="w-3 h-3 animate-spin" />{'Indexuje\u2026'}</>
                    : src.status === 'synced'
                    ? <><RefreshCw className="w-3 h-3" />{'Re-index'}</>
                    : <><Play className="w-3 h-3" />{'Indexovat'}</>
                  }
                </button>
              ) : (
                <span className="text-[11px] font-['Fenomen_Sans',sans-serif] text-[#001161]/35 italic">{'P\u0159es Znalostni mapu'}</span>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-2xl bg-amber-50 border border-amber-200 p-5">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
          <div>
            <div className="font-['Fenomen_Sans',sans-serif] font-bold text-[13px] text-[#001161] mb-1">{'Pokud se zobraz\u00ed chyba p\u0159i indexaci'}</div>
            <div className="font-['Fenomen_Sans',sans-serif] text-[12px] text-[#001161]/60 leading-relaxed">
              {'1. Klikni \"Diagnostika\" \u2014 ov\u011b\u0159 zda je Embedding test \u2713 OK. | 2. Data mus\u00ed b\u00fdt nejprve importov\u00e1na z Webflow \u2014 p\u0159ejdi do Admin \u2192 Migrace a spus\u0165 import blogu, novinek a produktu. | 3. Potom se vra\u0165 sem a klikni \"Indexovat\".'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Export helper ──────────────────────────────────────────────────────────
const BASE_URL = `https://${projectId}.supabase.co/functions/v1/make-server-93a20b6f`;

type ExportFormat = { id: string; label: string; ext: string; desc: string; icon: any; withEmbeddings: boolean };

const EXPORT_FORMATS: ExportFormat[] = [
  { id: 'json-full',    label: 'JSON + vektory',  ext: 'json',  desc: 'Plný export — text, metadata i 3072-dim. embedding vektory. Ideální pro re-import do jiné vektorové DB.',       icon: FileJson,        withEmbeddings: true  },
  { id: 'json-noVec',  label: 'JSON (bez vektorů)', ext: 'json', desc: 'Jen text a metadata, bez embedding vektorů. Menší soubor, vhodný pro prohlížení nebo import s re-embedováním.', icon: FileCode2,       withEmbeddings: false },
  { id: 'jsonl-full',  label: 'JSONL + vektory',  ext: 'jsonl', desc: 'Newline-delimited JSON (1 chunk = 1 řádek) se „values" klíčem — přímý import do Pinecone nebo OpenAI.',         icon: FileJson,        withEmbeddings: true  },
  { id: 'csv',         label: 'CSV (jen text)',    ext: 'csv',   desc: 'Tabulka: id, source, title, chunkIndex, tokens, quality, createdAt, text. Bez vektorů. Ideální pro Excel nebo jiný RAG systém.', icon: FileSpreadsheet, withEmbeddings: false },
];

function ExportButton({ total }: { total: number }) {
  const [open, setOpen] = React.useState(false);
  const [exporting, setExporting] = React.useState<string | null>(null);

  const doExport = async (fmt: ExportFormat) => {
    setExporting(fmt.id);
    try {
      const baseFormat = fmt.id.startsWith('jsonl') ? 'jsonl' : fmt.id === 'csv' ? 'csv' : 'json';
      const url = `${BASE_URL}/rag/export?format=${baseFormat}&embeddings=${fmt.withEmbeddings ? '1' : '0'}`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${publicAnonKey}` } });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || res.statusText); }
      const blob = await res.blob();
      const date = new Date().toISOString().slice(0, 10);
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `vividbooks-rag-${date}.${fmt.ext}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(a.href);
      setOpen(false);
    } catch (e: any) {
      alert(`Export selhal: ${e.message}`);
    }
    setExporting(null);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        disabled={total === 0}
        className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white px-3 py-2 rounded-xl text-[12px] font-bold font-['Fenomen_Sans',sans-serif] transition-colors"
      >
        <Download className="w-3.5 h-3.5" />
        {'Export'}
        <ChevronDown className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-2 w-[360px] bg-white rounded-2xl border border-gray-200 shadow-xl z-40 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <div>
                <div className="font-['Fenomen_Sans',sans-serif] font-bold text-[13px] text-[#001161]">{'Export znalostní báze'}</div>
                <div className="font-['Fenomen_Sans',sans-serif] text-[11px] text-gray-400 mt-0.5">{total} chunk{total !== 1 ? 'ů' : ''} · gemini-embedding-001 · 3072 dim.</div>
              </div>
              <button onClick={() => setOpen(false)} className="p-1 text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
            </div>

            <div className="p-2 space-y-1">
              {EXPORT_FORMATS.map(fmt => (
                <button
                  key={fmt.id}
                  onClick={() => doExport(fmt)}
                  disabled={!!exporting}
                  className="w-full flex items-start gap-3 px-3 py-3 rounded-xl hover:bg-gray-50 transition-colors text-left disabled:opacity-60 group"
                >
                  <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center shrink-0 mt-0.5 group-hover:bg-emerald-100 transition-colors">
                    {exporting === fmt.id
                      ? <Loader2 className="w-4 h-4 text-emerald-600 animate-spin" />
                      : <fmt.icon className="w-4 h-4 text-emerald-600" />
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-['Fenomen_Sans',sans-serif] font-bold text-[13px] text-[#001161]">{fmt.label}</span>
                      <span className="font-mono text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">.{fmt.ext}</span>
                      {fmt.withEmbeddings && (
                        <span className="text-[10px] font-bold text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded">+ vektory</span>
                      )}
                    </div>
                    <div className="font-['Fenomen_Sans',sans-serif] text-[11px] text-gray-400 mt-0.5 leading-snug">{fmt.desc}</div>
                  </div>
                </button>
              ))}
            </div>

            <div className="px-4 py-3 border-t border-gray-100 bg-gray-50 flex items-start gap-2">
              <Info className="w-3.5 h-3.5 text-gray-400 shrink-0 mt-0.5" />
              <div className="font-['Fenomen_Sans',sans-serif] text-[11px] text-gray-500 leading-snug">
                {'Export s vektory je kompatibilní s Pinecone, Weaviate, Qdrant a pgvector. Soubor může být větší (každý vektor má 3072 float čísel).'}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ── Database Tab ───────────────────────────────────────────────────────────
function DatabaseTab() {
  const [chunks, setChunks] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('');
  const [total, setTotal] = useState(0);
  const [deleting, setDeleting] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const r = await ragApi.ragListChunks();
      setChunks(r.chunks);
      setTotal(r.total);
    } catch (e: any) {
      console.error('[RAG DB]', e.message);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const del = async (id: string) => {
    setDeleting(id);
    await ragApi.ragDeleteChunk(id).catch(() => {});
    await load();
    setDeleting(null);
  };

  const filtered = chunks.filter(c =>
    c.text?.toLowerCase().includes(filter.toLowerCase()) ||
    c.metadata?.source?.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div className="p-8 overflow-y-auto h-full">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="font-['Cooper_Light',serif] text-[#001161] text-[26px] leading-tight">{'Znalostni b\u00e1ze'}</h2>
          <p className="font-['Fenomen_Sans',sans-serif] text-[#001161]/50 text-[13px] mt-1">{'Indexovan\u00e9 chunky \u2014 gemini-embedding-001 (3072 dim.) \u2014 System 2 KV'}</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input value={filter} onChange={e => setFilter(e.target.value)} placeholder={'Hledat\u2026'}
              className="pl-8 pr-3 py-2 rounded-xl border border-gray-200 text-[13px] font-['Fenomen_Sans',sans-serif] text-[#001161] placeholder-gray-400 focus:outline-none focus:border-[#001161]/40 w-[200px]" />
          </div>
          <button onClick={load} disabled={loading} className="flex items-center gap-1.5 bg-[#001161] text-white px-3 py-2 rounded-xl text-[12px] font-bold font-['Fenomen_Sans',sans-serif] hover:opacity-85 transition-opacity">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />{'Na\u010d\u00edst'}
          </button>
          <ExportButton total={total} />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Chunk\u016f celkem', val: total || 0, icon: Layers, color: '#001161' },
          { label: 'Zdroj\u016f', val: new Set(chunks.map(c => c.metadata?.source)).size, icon: Database, color: '#7C3AED' },
          { label: 'Embedding dim.', val: 3072, icon: Cpu, color: '#0ea5e9' },
          { label: 'Pr\u016fm. tok\u016f', val: chunks.length > 0 ? Math.round(chunks.reduce((a, c) => a + (c.metadata?.tokens ?? 0), 0) / chunks.length) : 0, icon: BarChart3, color: '#16a34a' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <div className="flex items-center gap-2 mb-2">
              <s.icon className="w-4 h-4" style={{ color: s.color }} />
              <span className="font-['Fenomen_Sans',sans-serif] text-[11px] text-[#001161]/50">{s.label}</span>
            </div>
            <div className="font-['Cooper_Light',serif] text-[#001161] text-[22px]">{s.val}</div>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <RefreshCw className="w-6 h-6 text-[#001161]/30 animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-14">
            <Database className="w-10 h-10 text-[#001161]/15 mx-auto mb-3" />
            <div className="font-['Fenomen_Sans',sans-serif] text-[14px] text-[#001161]/35">
              {total === 0 ? 'Datab\u00e1ze je pr\u00e1zdn\u00e1. Spus\u0165te indexaci ve \"Datov\u00e9 zdroje\".' : 'Nic nenalezeno.'}
            </div>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/60">
                {['Zdroj', 'Text (n\u00e1hled)', 'Tok.', 'Kvalita', ''].map(h => (
                  <th key={h} className="text-left px-4 py-3 font-['Fenomen_Sans',sans-serif] text-[11px] font-bold uppercase tracking-wider text-[#001161]/40">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, 40).map(c => (
                <tr key={c.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                  <td className="px-4 py-3 shrink-0">
                    <span className="font-['Fenomen_Sans',sans-serif] text-[11px] font-bold text-[#001161]/70 bg-[#EEF0FA] px-2 py-0.5 rounded-lg whitespace-nowrap">
                      {c.metadata?.source ?? '?'}
                    </span>
                  </td>
                  <td className="px-4 py-3 max-w-[300px]">
                    <span className="font-['Fenomen_Sans',sans-serif] text-[12px] text-[#001161] line-clamp-2">{c.text?.slice(0, 100)}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-mono text-[12px] text-[#001161]/60">{c.metadata?.tokens ?? '—'}</span>
                  </td>
                  <td className="px-4 py-3">
                    {c.metadata?.quality != null ? (
                      <div className="flex items-center gap-2">
                        <div className="w-[50px] h-1.5 rounded-full bg-gray-100 overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${c.metadata.quality * 100}%`, background: c.metadata.quality >= 0.35 ? '#16a34a' : '#f59e0b' }} />
                        </div>
                        <span className="font-mono text-[11px] font-bold" style={{ color: c.metadata.quality >= 0.35 ? '#16a34a' : '#f59e0b' }}>
                          {c.metadata.quality.toFixed(2)}
                        </span>
                      </div>
                    ) : <span className="font-['Fenomen_Sans',sans-serif] text-[11px] text-[#001161]/30">{'Nekontrolov\u00e1no'}</span>}
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => del(c.id)} disabled={deleting === c.id} className="p-1.5 rounded-lg hover:bg-red-50 transition-colors text-gray-300 hover:text-red-400 disabled:opacity-50">
                      {deleting === c.id ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {filtered.length > 40 && (
          <div className="px-4 py-3 border-t border-gray-100 font-['Fenomen_Sans',sans-serif] text-[12px] text-[#001161]/40">
            {`Zobrazeno 40 z ${total} chunk\u016f`}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Agent Tab (real API) ─────────────────────────────────────────────���─────
function AgentTab() {
  const [running, setRunning] = useState(false);
  const [logs, setLogs] = useState<AgentLog[]>([]);
  const [stats, setStats] = useState<any | null>(null);

  const runAgent = async () => {
    setRunning(true);
    setLogs([]);
    setStats(null);
    const addLog = (type: AgentLog['type'], message: string) =>
      setLogs(prev => [...prev, { id: String(Date.now() + Math.random()), time: new Date().toLocaleTimeString('cs-CZ'), type, message }]);

    addLog('info', 'Agent spu\u0161t\u011bn \u2014 gemini-3.1-flash-live-preview (Live API)');
    addLog('info', 'Na\u010d\u00edt\u00e1m chunky z datab\u00e1ze\u2026');

    try {
      const r = await ragApi.ragRunAgent();
      setStats(r.stats);

      // Map System 2 agent actions to log entries
      for (const action of (r.actions ?? [])) {
        const act = action.action ?? action.type ?? '';
        const reason = action.reason ?? action.message ?? '';
        if (act === 'delete') {
          addLog('warning', `Smaz\u00e1no: ${action.title || action.id} \u2014 ${reason}`);
        } else if (act === 'deduplicate') {
          addLog('warning', `Duplik\u00e1t: ${action.id} (sim=${action.reason?.match(/[\d.]+/)?.[0] ?? '?'})`);
        } else {
          addLog('info', reason || act);
        }
      }

      if ((r.actions ?? []).length === 0) addLog('success', 'Datab\u00e1ze je \u010dist\u00e1 \u2014 \u017e\u00e1dn\u00e9 probl\u00e9my nenalezeny');

      const { total = 0, deleted = 0, kept = 0, duplicatesRemoved = 0, htmlCleaned = 0, lowQualityRemoved = 0, agentReport } = r.stats ?? {};
      addLog('success', `Agent dokon\u010dil: ${total} chunk\u016f, smazano ${deleted} (HTML: ${htmlCleaned}, kval: ${lowQualityRemoved}, duplik\u00e1ty: ${duplicatesRemoved}), zbv\u00e1: ${kept}`);

      if (agentReport) {
        addLog('info', `Gemini Live report: ${agentReport.slice(0, 200)}`);
      }
    } catch (e: any) {
      addLog('error', `Chyba: ${e.message}`);
    }
    setRunning(false);
  };

  return (
    <div className="p-8 overflow-y-auto h-full">
      <div className="flex items-start gap-6 mb-8">
        <div className="flex-1">
          <h2 className="font-['Cooper_Light',serif] text-[#001161] text-[26px] leading-tight mb-2">{'Gemini Live Cleaning Agent'}</h2>
          <p className="font-['Fenomen_Sans',sans-serif] text-[#001161]/50 text-[13px] leading-relaxed max-w-[560px]">
            {'Shrnut\u00ed po \u010di\u0161t\u011bn\u00ed generuje '}
            <span className="font-mono text-[12px]">gemini-3.1-flash-live-preview</span>
            {' (Live API, TEXT). Pravidla z\u016fst\u00e1vaj\u00ed: HTML artefakty, quality \u2265\u00a00,35, duplik\u00e1ty (cosine\u00a0>\u00a00,95). P\u0159i nedostupnosti Live se pou\u017eije REST gemini-3-flash-preview.'}
          </p>
        </div>
          <button onClick={runAgent} disabled={running}
            className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white px-5 py-2.5 rounded-xl font-['Fenomen_Sans',sans-serif] text-[14px] font-bold transition-all shrink-0">
            {running ? <><RefreshCw className="w-4 h-4 animate-spin" />{'B\u011b\u017e\u00ed\u2026'}</> : <><Play className="w-4 h-4" />{'Spustit agenta'}</>}
          </button>
        </div>

      {/* Config */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { icon: Zap, label: 'Report (LLM)', val: 'gemini-3.1-flash-live-preview', sub: 'Live API \u2192 fallback REST' },
          { icon: Clock, label: 'Trigger', val: 'Manu\u00e1ln\u00ed', sub: 'A po ka\u017ed\u00e9m importu' },
          { icon: ShieldCheck, label: 'Quality threshold', val: '\u2265 0.35', sub: 'Pod touto hranici = smaz\u00e1no' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-center gap-2 mb-2">
              <s.icon className="w-4 h-4 text-amber-500" />
              <span className="font-['Fenomen_Sans',sans-serif] font-bold text-[13px] text-[#001161]">{s.label}</span>
            </div>
            <div className="font-['Fenomen_Sans',sans-serif] text-[14px] text-[#001161] font-bold">{s.val}</div>
            <div className="font-['Fenomen_Sans',sans-serif] text-[11px] text-[#001161]/40 mt-1">{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Stats card */}
      {stats && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 mb-6 flex items-center gap-6 flex-wrap">
          {[
            { val: stats.total ?? 0, label: 'Chunk\u016f p\u0159ed' },
            { val: stats.kept ?? 0, label: 'Zbv\u00e1 chunk\u016f' },
            { val: stats.deleted ?? 0, label: 'Smazano celkem' },
            { val: stats.htmlCleaned ?? 0, label: 'HTML artefakt\u016f' },
            { val: stats.duplicatesRemoved ?? 0, label: 'Duplik\u00e1t\u016f' },
          ].map(s => (
            <div key={s.label}>
              <div className="font-['Cooper_Light',serif] text-[24px] text-emerald-700">{s.val}</div>
              <div className="font-['Fenomen_Sans',sans-serif] text-[11px] text-emerald-600/70">{s.label}</div>
            </div>
          ))}
        </motion.div>
      )}

      {/* Terminal */}
      <div className="bg-gray-950 rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <div className="flex gap-1.5">
            {['bg-red-500/60','bg-amber-500/60','bg-emerald-500/60'].map(c => <div key={c} className={`w-3 h-3 rounded-full ${c}`} />)}
          </div>
          <span className="text-[11px] text-gray-500 font-mono ml-2">{'agent_log \u2014 Gemini Live (RAG report)'}</span>
          <span className={`ml-auto text-[11px] font-mono ${running ? 'text-amber-400 animate-pulse' : logs.length > 0 ? 'text-emerald-400' : 'text-gray-600'}`}>
            {running ? '\u25cf RUNNING' : logs.length > 0 ? '\u25cf DONE' : '\u25cb IDLE'}
          </span>
        </div>
        {logs.length === 0 && !running && (
          <div className="font-mono text-[12px] text-gray-600 py-6 text-center">{'// Klikni "Spustit agenta" a uvid\u00ed\u0161 v\u00fdstup zde'}</div>
        )}
        <div className="space-y-0.5 min-h-[60px]">
          {logs.map(log => {
            const cls = { info: 'text-gray-400', success: 'text-emerald-400', warning: 'text-amber-400', error: 'text-red-400' }[log.type];
            const tag = { info: '[INFO]', success: '[OK]  ', warning: '[WARN]', error: '[ERR] ' }[log.type];
            return (
              <motion.div key={log.id} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.2 }}
                className="flex items-start gap-2 py-0.5">
                <span className="font-mono text-[11px] text-gray-600 shrink-0">{log.time}</span>
                <span className={`font-mono text-[12px] shrink-0 ${cls}`}>{tag}</span>
                <span className="font-mono text-[12px] text-gray-300">{log.message}</span>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Source link helper ────────────────────────────────────────────────────
function getSourceLink(source: string, sourceId: string, title: string): { url: string; label: string; icon: any; color: string } | null {
  if (!sourceId) return null;
  if (source === 'produkty') return { url: `/produkt/${sourceId}`, label: title || 'Zobrazit produkt', icon: ShoppingCart, color: '#7C3AED' };
  if (source === 'webinare') return { url: `/webinar/${sourceId}`, label: title || 'Detail webináře', icon: Calendar, color: '#0ea5e9' };
  if (source === 'blog')    return { url: `/blog/${sourceId}`, label: title || 'Přečíst článek', icon: FileText, color: '#001161' };
  if (source === 'novinky') return { url: `/novinky/${sourceId}`, label: title || 'Číst novinku', icon: Rss, color: '#ff6a35' };
  return null;
}

// Renders action link buttons derived from message sources
function SourceActions({ sources }: { sources: any[] }) {
  const actions = sources
    .map(s => ({ ...getSourceLink(s.source, s.sourceId, s.title), source: s.source, sourceId: s.sourceId, score: s.score }))
    .filter(a => a.url) as Array<{ url: string; label: string; icon: any; color: string; source: string; sourceId: string; score: number }>;

  if (!actions.length) return null;

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {actions.map((a, i) => (
        <a
          key={i}
          href={a.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-white text-[12px] font-bold font-['Fenomen_Sans',sans-serif] transition-opacity hover:opacity-85"
          style={{ background: a.color }}
        >
          <a.icon className="w-3.5 h-3.5" />
          {a.label}
          <ExternalLink className="w-3 h-3 opacity-70" />
        </a>
      ))}
    </div>
  );
}

// ── Test Tab (real Gemini API) ─────────────────────────────────────────────
// ── COMMANDS definition ───────────────────────────────────────────────────
const COMMANDS = [
  { prefix: '/feedback:', icon: '💬', label: '/feedback: [text]',    desc: 'Uloží zpětnou vazbu do databáze',     color: '#ff6a35' },
  { prefix: '/nauč se:', icon: '🧠', label: '/nauč se: [fakt]',      desc: 'Zaindexuje fakt přímo do RAG',         color: '#16a34a' },
  { prefix: '/pomoc',   icon: '💡', label: '/pomoc',                  desc: 'Zobrazí nápovědu příkazů',            color: '#7C3AED' },
];

type Msg = {
  role: 'user' | 'assistant' | 'system';
  text: string;
  cmdType?: 'feedback' | 'learn' | 'help' | 'error';
  sources?: any[];
  chunksUsed?: number;
};

function TestTab() {
  const [query, setQuery]       = useState('');
  const [msgs, setMsgs]         = useState<Msg[]>([]);
  const [loading, setLoading]   = useState(false);
  const [showSlack, setShowSlack] = useState(false);
  const [copied, setCopied]     = useState(false);
  const [feedbacks, setFeedbacks] = useState<any[]>([]);
  const [showFb, setShowFb]     = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef  = useRef<HTMLInputElement>(null);

  const slackUrl = `https://${projectId}.supabase.co/functions/v1/make-server-93a20b6f/slack/rag`;
  const showPalette = query.startsWith('/') && query.length < 20;

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs, loading]);

  const push = (msg: Msg) => setMsgs(prev => [...prev, msg]);

  const copySlack = () => {
    navigator.clipboard.writeText(slackUrl).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  };

  const loadFeedbacks = async () => {
    try { const r = await ragApi.ragListFeedback(); setFeedbacks(r.items); } catch {}
  };

  const send = async () => {
    const q = query.trim();
    if (!q || loading) return;
    setQuery('');
    push({ role: 'user', text: q });

    // ── /pomoc ───────────────────────────────────────────────────────
    if (q === '/pomoc') {
      push({ role: 'system', cmdType: 'help', text: 'Dostupné příkazy:\n\n💬 /feedback: [text] — uloží zpětnou vazbu k obsahu\n🧠 /nauč se: [fakt] — zaindexuje fakt přímo do RAG (okamžitě dostupný v odpovědích)\n💡 /pomoc — zobrazí tuto nápovědu\n\nPro normální dotaz prostě napiš otázku bez lomítka.' });
      return;
    }

    // ── /feedback: ──────────────────────────────────────────────────
    const fbMatch = q.match(/^\/feedback:\s*(.+)/is);
    if (fbMatch) {
      setLoading(true);
      try {
        await ragApi.ragSaveFeedback(fbMatch[1].trim(), 'admin', 'test-tab');
        push({ role: 'system', cmdType: 'feedback', text: `✅ Feedback uložen!\n\n"${fbMatch[1].trim()}"` });
        loadFeedbacks();
      } catch (e: any) {
        push({ role: 'system', cmdType: 'error', text: `Chyba při ukládání feedbacku: ${e.message}` });
      }
      setLoading(false);
      return;
    }

    // ── /nauč se: ────────────────────────────────────────────────────
    const learnMatch = q.match(/^\/nau[cč]\s*se:\s*(.+)/is);
    if (learnMatch) {
      setLoading(true);
      try {
        const factText = learnMatch[1].trim();
        const r = await ragApi.ragLearnFact(factText, `Fakt: ${factText.slice(0, 50)}`);
        push({ role: 'system', cmdType: 'learn', text: `🧠 Zaindexováno! (${r.dims} dim.)\n\n"${factText}"\n\nBude použito v dalších odpovědích.` });
      } catch (e: any) {
        push({ role: 'system', cmdType: 'error', text: `Chyba při indexaci faktu: ${e.message}` });
      }
      setLoading(false);
      return;
    }

    // ── Normální RAG dotaz ────────────────────────────────────────────
    setLoading(true);
    try {
      const r = await ragApi.ragQuery(q, 5);
      push({ role: 'assistant', text: r.answer, sources: r.sources, chunksUsed: r.chunksUsed });
    } catch (e: any) {
      push({ role: 'system', cmdType: 'error', text: `Chyba RAG: ${e.message}` });
    }
    setLoading(false);
  };

  const EXAMPLES = ['Co jsou Vividbooks?', 'Jaká je nabídka pro matematiku?', 'Jaká je cena licencí?', 'Jak začít s digitálními učebnicemi?'];

  // System bubble color by type
  const sysBg: Record<string, string> = {
    feedback: 'bg-orange-50 border-orange-200 text-orange-800',
    learn:    'bg-emerald-50 border-emerald-200 text-emerald-800',
    help:     'bg-[#EEF0FA] border-[#001161]/15 text-[#001161]',
    error:    'bg-red-50 border-red-200 text-red-700',
  };

  return (
    <div className="flex flex-col h-full">

      {/* Header */}
      <div className="px-6 pt-5 pb-4 border-b border-gray-100 shrink-0">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-['Cooper_Light',serif] text-[#001161] text-[24px] leading-tight mb-0.5">{'Testování RAG'}</h2>
            <p className="font-['Fenomen_Sans',sans-serif] text-[#001161]/45 text-[12px]">{'Gemini 3 Flash · embeddingy · příkazy: /feedback: /nauč se: /pomoc'}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={() => { setShowFb(s => !s); if (!showFb) loadFeedbacks(); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[12px] font-bold font-['Fenomen_Sans',sans-serif] border transition-colors ${showFb ? 'bg-orange-500 text-white border-orange-500' : 'border-gray-200 text-[#001161]/60 hover:border-orange-400 hover:text-orange-600'}`}>
              <MessageSquare className="w-3.5 h-3.5" />
              {'Feedbacky'}
              {feedbacks.length > 0 && <span className="bg-orange-500 text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center">{feedbacks.length}</span>}
            </button>
            <button onClick={() => setShowSlack(s => !s)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[12px] font-bold font-['Fenomen_Sans',sans-serif] border transition-colors ${showSlack ? 'bg-[#4A154B] text-white border-[#4A154B]' : 'border-gray-200 text-[#001161]/60 hover:border-[#4A154B] hover:text-[#4A154B]'}`}>
              <Network className="w-3.5 h-3.5" />
              {'Slack'}
            </button>
          </div>
        </div>

        {/* Slack setup panel */}
        <AnimatePresence>
          {showSlack && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
              <div className="mt-4 rounded-2xl bg-[#4A154B]/5 border border-[#4A154B]/20 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-6 h-6 rounded-lg bg-[#4A154B] flex items-center justify-center">
                    <Network className="w-3.5 h-3.5 text-white" />
                  </div>
                  <span className="font-['Fenomen_Sans',sans-serif] font-bold text-[13px] text-[#001161]">{'Slack slash command setup'}</span>
                  <span className="ml-auto text-[11px] font-['Fenomen_Sans',sans-serif] text-[#001161]/40">{'Tým se může ptát přímo ze Slacku'}</span>
                </div>
                <div className="grid grid-cols-[1fr_auto] gap-2 mb-3">
                  <div className="flex items-center gap-2 bg-white rounded-xl border border-gray-200 px-3 py-2">
                    <span className="font-mono text-[11px] text-[#001161]/70 truncate">{slackUrl}</span>
                  </div>
                  <button onClick={copySlack}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-[12px] font-bold font-['Fenomen_Sans',sans-serif] transition-colors ${copied ? 'bg-emerald-500 text-white' : 'bg-[#4A154B] text-white hover:bg-[#4A154B]/80'}`}>
                    {copied ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Download className="w-3.5 h-3.5 rotate-180" />}
                    {copied ? 'Zkopírováno!' : 'Kopírovat'}
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-2 text-[11px] font-['Fenomen_Sans',sans-serif]">
                  {[
                    { n: '1', text: 'V Slacku: Apps → Manage apps → Build → Create New App → From scratch' },
                    { n: '2', text: 'Slash Commands → Create New Command → příkaz: /vividbooks → URL výše → Save' },
                    { n: '3', text: 'Install to Workspace → hotovo! Příkaz bude dostupný všem v týmu.' },
                  ].map(s => (
                    <div key={s.n} className="bg-white rounded-xl p-2.5 border border-gray-100">
                      <div className="w-5 h-5 rounded-full bg-[#4A154B] text-white text-[10px] font-bold flex items-center justify-center mb-1.5">{s.n}</div>
                      <div className="text-[#001161]/60 leading-snug">{s.text}</div>
                    </div>
                  ))}
                </div>
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {[
                    { cmd: '/vividbooks kde koupit matematiku?',  desc: 'RAG dotaz' },
                    { cmd: '/vividbooks /feedback: ceny jsou vysoké', desc: 'Feedback' },
                    { cmd: '/vividbooks /nauč se: DVPP akreditace platí 3 roky', desc: 'Učení' },
                  ].map(ex => (
                    <div key={ex.cmd} className="flex items-center gap-1.5 bg-white border border-gray-200 rounded-lg px-2.5 py-1.5">
                      <span className="font-mono text-[10px] text-[#4A154B] font-bold">{ex.cmd}</span>
                      <span className="text-[10px] text-gray-400">{ex.desc}</span>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Feedback history panel */}
        <AnimatePresence>
          {showFb && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
              <div className="mt-4 rounded-2xl bg-orange-50 border border-orange-200 p-4 max-h-[200px] overflow-y-auto">
                <div className="flex items-center gap-2 mb-3">
                  <MessageSquare className="w-4 h-4 text-orange-500" />
                  <span className="font-['Fenomen_Sans',sans-serif] font-bold text-[13px] text-[#001161]">{'Uložené feedbacky'}</span>
                  <span className="ml-auto text-[11px] font-['Fenomen_Sans',sans-serif] text-[#001161]/40">{feedbacks.length} {'záznamů'}</span>
                </div>
                {feedbacks.length === 0 ? (
                  <div className="text-[12px] font-['Fenomen_Sans',sans-serif] text-orange-400 text-center py-2">{'Žádné feedbacky zatím'}</div>
                ) : (
                  <div className="space-y-2">
                    {feedbacks.map((fb, i) => (
                      <div key={i} className="bg-white rounded-xl p-2.5 border border-orange-100 flex items-start gap-2">
                        <span className="text-[10px] font-mono text-orange-300 shrink-0 mt-0.5">{fb.channel}</span>
                        <span className="font-['Fenomen_Sans',sans-serif] text-[12px] text-[#001161] flex-1">{fb.text}</span>
                        <span className="text-[10px] text-orange-300 shrink-0">{fb.createdAt ? new Date(fb.createdAt).toLocaleDateString('cs-CZ') : ''}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Chat */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {msgs.length === 0 && (
          <div className="text-center py-10">
            <FlaskConical className="w-10 h-10 text-[#001161]/15 mx-auto mb-4" />
            <div className="font-['Fenomen_Sans',sans-serif] text-[#001161]/35 text-[14px] mb-4">{'Napiš dotaz nebo příkaz'}</div>
            <div className="flex flex-wrap justify-center gap-2 mb-3">
              {EXAMPLES.map(q => (
                <button key={q} onClick={() => setQuery(q)}
                  className="text-[12px] font-['Fenomen_Sans',sans-serif] text-[#001161] bg-[#EEF0FA] hover:bg-[#001161] hover:text-white px-3 py-1.5 rounded-xl transition-colors">
                  {q}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              {['/feedback: tyto sešity jsou příliš drahé', '/nauč se: DVPP akreditace platí 3 roky', '/pomoc'].map(c => (
                <button key={c} onClick={() => setQuery(c)}
                  className="text-[11px] font-['Fenomen_Sans',sans-serif] text-gray-500 bg-gray-50 hover:bg-gray-100 border border-gray-200 px-3 py-1.5 rounded-xl transition-colors font-mono">
                  {c}
                </button>
              ))}
            </div>
          </div>
        )}

        {msgs.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {msg.role === 'system' ? (
              <div className={`max-w-[72%] rounded-2xl border px-4 py-3 text-[13px] font-['Fenomen_Sans',sans-serif] leading-relaxed whitespace-pre-wrap ${sysBg[msg.cmdType ?? 'help']}`}>
                {msg.text}
              </div>
            ) : msg.role === 'assistant' ? (
              <div className="flex items-start gap-3 max-w-[82%]">
                <div className="w-7 h-7 rounded-full bg-amber-100 flex items-center justify-center shrink-0 mt-1">
                  <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                </div>
                <div>
                  <div className="bg-white rounded-2xl rounded-tl-sm border border-gray-100 shadow-sm p-4">
                    <p className="font-['Fenomen_Sans',sans-serif] text-[14px] text-[#001161] leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                  </div>
                  {msg.sources && msg.sources.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {msg.sources.map((s, si) => {
                        const link = getSourceLink(s.source, s.sourceId, s.title);
                        const chip = (
                          <span className={`text-[11px] font-['Fenomen_Sans',sans-serif] text-[#001161]/50 px-2 py-0.5 rounded-lg flex items-center gap-1 ${link ? 'bg-gray-100 hover:bg-gray-200 cursor-pointer transition-colors' : 'bg-gray-100'}`}>
                            <BookOpen className="w-2.5 h-2.5" />
                            {s.source || s.title}{s.score != null ? ` (${typeof s.score === 'number' ? s.score.toFixed(2) : s.score})` : ''}
                          </span>
                        );
                        return link ? <a key={si} href={link.url} target="_blank" rel="noopener noreferrer">{chip}</a> : <span key={si}>{chip}</span>;
                      })}
                    </div>
                  )}
                  {msg.sources && msg.sources.length > 0 && <SourceActions sources={msg.sources} />}
                  {msg.chunksUsed !== undefined && (
                    <div className="mt-1 font-['Fenomen_Sans',sans-serif] text-[10px] text-[#001161]/30">
                      {`${msg.chunksUsed} chunků použito — gemini-3-flash-preview`}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-[#001161] text-white rounded-2xl rounded-tr-sm px-4 py-3 max-w-[62%]">
                <p className="font-['Fenomen_Sans',sans-serif] text-[14px] leading-relaxed">{msg.text}</p>
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="flex items-start gap-3">
            <div className="w-7 h-7 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
              <Sparkles className="w-3.5 h-3.5 text-amber-600 animate-pulse" />
            </div>
            <div className="bg-white rounded-2xl rounded-tl-sm border border-gray-100 shadow-sm px-4 py-3">
              <div className="flex gap-1.5">
                {[0, 1, 2].map(i => <div key={i} className="w-2 h-2 rounded-full bg-gray-300 animate-bounce" style={{ animationDelay: `${i * 150}ms` }} />)}
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input area + command palette */}
      <div className="border-t border-gray-100 bg-white shrink-0">
        {/* Command palette */}
        <AnimatePresence>
          {showPalette && (
            <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 6 }}
              className="px-4 pt-3 pb-0 flex flex-wrap gap-2">
              {COMMANDS.filter(c => c.prefix.startsWith(query) || query === '/').map(cmd => (
                <button key={cmd.prefix} onClick={() => { setQuery(cmd.prefix + ' '); inputRef.current?.focus(); }}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-xl border text-[12px] font-['Fenomen_Sans',sans-serif] font-bold hover:opacity-80 transition-opacity bg-white"
                  style={{ borderColor: cmd.color + '40', color: cmd.color }}>
                  <span>{cmd.icon}</span>
                  <span>{cmd.label}</span>
                  <span className="font-normal text-gray-400 text-[11px]">{cmd.desc}</span>
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
        <div className="p-4 flex gap-3">
          <div className="flex-1 relative">
            {query.startsWith('/') && (
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[12px] font-mono font-bold text-purple-500 pointer-events-none">/</span>
            )}
            <input
              ref={inputRef}
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
              placeholder="Napiš dotaz nebo /příkaz…"
              className={`w-full py-2.5 rounded-xl border text-[14px] font-['Fenomen_Sans',sans-serif] text-[#001161] placeholder-gray-400 focus:outline-none transition-colors ${query.startsWith('/') ? 'pl-6 pr-4 border-purple-300 bg-purple-50/40 focus:border-purple-400' : 'px-4 border-gray-200 focus:border-[#001161]/40'}`}
            />
          </div>
          <button onClick={send} disabled={!query.trim() || loading}
            className="flex items-center gap-2 bg-[#001161] disabled:opacity-40 text-white px-4 py-2.5 rounded-xl font-['Fenomen_Sans',sans-serif] text-[13px] font-bold hover:opacity-85 transition-opacity">
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Upload Tab ─────────────────────────────────────────────────────────────
const SERVER_UPLOAD = `https://${projectId}.supabase.co/functions/v1/make-server-93a20b6f`;

interface DocRecord {
  source: string; title: string; description: string;
  chunks: number; uploadedAt: string;
}

function UploadTab() {
  const [text, setText]               = useState('');
  const [title, setTitle]             = useState('');
  const [sourceTag, setSourceTag]     = useState('');
  const [description, setDescription] = useState('');
  const [replace, setReplace]         = useState(false);
  const [dragging, setDragging]       = useState(false);
  const [fileName, setFileName]       = useState('');
  const [uploading, setUploading]     = useState(false);
  const [progress, setProgress]       = useState<null | { ingested: number; total: number }>(null);
  const [docs, setDocs]               = useState<DocRecord[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [deletingSource, setDeletingSource] = useState<string | null>(null);

  const fileRef = React.useRef<HTMLInputElement>(null);

  const loadDocs = React.useCallback(async () => {
    setLoadingDocs(true);
    try {
      const res  = await fetch(`${SERVER_UPLOAD}/rag/chunks`, { headers: { Authorization: `Bearer ${publicAnonKey}` } });
      const data = await res.json();
      if (!res.ok) {
        console.error('[loadDocs] /rag/chunks error:', data);
      }
      const chunks: any[] = data.chunks ?? [];
      const map: Record<string, DocRecord> = {};
      for (const ch of chunks) {
        const src = ch.metadata?.source ?? '';
        if (!src.startsWith('doc:')) continue;
        if (!map[src]) map[src] = { source: src, title: ch.metadata?.title ?? src, description: ch.metadata?.description ?? '', chunks: 0, uploadedAt: ch.metadata?.uploadedAt ?? '' };
        map[src].chunks++;
      }
      setDocs(Object.values(map).sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt)));
    } catch (e: any) {
      console.error('[loadDocs] fetch failed:', e.message);
    } finally { setLoadingDocs(false); }
  }, []);

  React.useEffect(() => { loadDocs(); }, [loadDocs]);

  function readFile(file: File) {
    if (!file.name.match(/\.(txt|md)$/i)) { alert('Zatím jsou podporovány pouze soubory .txt a .md'); return; }
    const reader = new FileReader();
    reader.onload = e => {
      setText(e.target?.result as string ?? '');
      if (!title) setTitle(file.name.replace(/\.(txt|md)$/i, ''));
      setFileName(file.name);
    };
    reader.readAsText(file, 'UTF-8');
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault(); setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) readFile(file);
  }

  async function handleUpload() {
    if (!text.trim()) { alert('Vlož nebo nahraj text.'); return; }
    if (!title.trim()) { alert('Vyplň název dokumentu.'); return; }
    setUploading(true); setProgress(null);
    try {
      const res = await fetch(`${SERVER_UPLOAD}/rag/ingest-text`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${publicAnonKey}` },
        body: JSON.stringify({ text, title, sourceTag, description, replaceExisting: replace }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || res.statusText);
      setProgress({ ingested: data.ingested, total: data.total });
      loadDocs();
    } catch (e: any) { alert(`Chyba: ${e.message}`); }
    finally { setUploading(false); }
  }

  async function handleDelete(source: string) {
    if (!confirm(`Smazat chunky pro "${source}"?`)) return;
    setDeletingSource(source);
    try {
      await fetch(`${SERVER_UPLOAD}/rag/delete-source`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${publicAnonKey}` },
        body: JSON.stringify({ source }),
      });
      loadDocs();
    } catch { /* ignore */ }
    finally { setDeletingSource(null); }
  }

  const iCls = 'w-full px-3 py-2 text-[13px] border border-gray-200 rounded-xl focus:border-purple-400 outline-none transition-colors bg-white';

  return (
    <div className="h-full overflow-y-auto p-6 bg-[#f7f8fc]" style={{ fontFamily: "'Fenomen Sans', sans-serif" }}>
      <div className="max-w-[820px] mx-auto space-y-5">

        <div>
          <h2 className="font-bold text-[#001161] text-[20px]" style={{ fontFamily: "'Cooper Light', serif" }}>
            {'Nahrát dokument do RAG'}
          </h2>
          <p className="text-[13px] text-gray-500 mt-1">
            {'Nahraj .txt / .md soubor nebo vlož text — Gemini ho rozseká na chunky a zaindexuje.'}
          </p>
        </div>

        <div className="grid grid-cols-[1fr_320px] gap-5 items-start">

          {/* Vstup */}
          <div className="space-y-4">
            <div
              onDragOver={e => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              onClick={() => fileRef.current?.click()}
              className={`rounded-2xl border-2 border-dashed p-6 flex flex-col items-center justify-center gap-2 cursor-pointer transition-all ${dragging ? 'border-purple-400 bg-purple-50' : 'border-gray-200 bg-white hover:border-purple-300 hover:bg-purple-50/30'}`}
            >
              <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center">
                <FolderOpen className="w-5 h-5 text-purple-500" />
              </div>
              {fileName ? (
                <div className="text-center">
                  <div className="text-[13px] font-bold text-purple-700">{fileName}</div>
                  <div className="text-[11px] text-gray-400 mt-0.5">{text.length.toLocaleString('cs-CZ')} {'znaků načteno'}</div>
                </div>
              ) : (
                <div className="text-center">
                  <div className="text-[13px] font-bold text-gray-600">{'Přetáhni .txt nebo .md soubor'}</div>
                  <div className="text-[11px] text-gray-400 mt-0.5">{'nebo klikni pro výběr souboru'}</div>
                </div>
              )}
              <input ref={fileRef} type="file" accept=".txt,.md" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) readFile(f); }} />
            </div>

            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-gray-200" />
              <span className="text-[11px] font-bold text-gray-400 uppercase">{'nebo vlož text'}</span>
              <div className="flex-1 h-px bg-gray-200" />
            </div>

            <div className="relative">
              <textarea
                value={text}
                onChange={e => { setText(e.target.value); setFileName(''); }}
                placeholder={'Vlož sem libovolný text — FAQ, manuál, přepis, poznámky…'}
                rows={14}
                className="w-full px-4 py-3 text-[13px] text-[#001161] border border-gray-200 rounded-2xl focus:border-purple-400 outline-none resize-none bg-white leading-relaxed"
                style={{ fontFamily: "'Fenomen Sans', sans-serif" }}
              />
              {text && (
                <div className="absolute bottom-3 right-3 flex items-center gap-2">
                  <span className="text-[10px] text-gray-300 font-mono">{text.length.toLocaleString('cs-CZ')} zn.</span>
                  <button onClick={() => { setText(''); setFileName(''); }}
                    className="p-1 text-gray-300 hover:text-red-400 rounded-lg transition-colors">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Metadata + akce */}
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-gray-200 p-4 space-y-3">
              <div className="flex items-center gap-2 border-b border-gray-100 pb-3">
                <Tag className="w-4 h-4 text-purple-500" />
                <span className="text-[12px] font-bold text-gray-700 uppercase tracking-wide">Metadata</span>
              </div>
              <div>
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wide block mb-1.5">{'Název dokumentu *'}</label>
                <input value={title} onChange={e => setTitle(e.target.value)}
                  placeholder={'FAQ Vividbooks, Manuál učitele…'} className={iCls} />
              </div>
              <div>
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wide block mb-1.5">{'Source tag'}</label>
                <input value={sourceTag} onChange={e => setSourceTag(e.target.value)}
                  placeholder={'faq-vividbooks'} className={iCls + ' font-mono text-[12px]'} />
                <p className="text-[10px] text-gray-400 mt-1">{'Nechej prázdné = vygeneruje se z názvu'}</p>
              </div>
              <div>
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wide block mb-1.5">Popis</label>
                <textarea value={description} onChange={e => setDescription(e.target.value)}
                  placeholder={'Krátký popis obsahu…'} rows={2} className={iCls + ' resize-none'} />
              </div>
              <label className="flex items-center gap-2.5 cursor-pointer p-2.5 rounded-xl hover:bg-gray-50 transition-colors">
                <input type="checkbox" checked={replace} onChange={e => setReplace(e.target.checked)}
                  className="w-4 h-4 accent-purple-600 rounded" />
                <div>
                  <div className="text-[12px] font-bold text-gray-700">{'Přepsat existující'}</div>
                  <div className="text-[10px] text-gray-400">{'Smaže staré chunky se stejným tagem'}</div>
                </div>
              </label>
            </div>

            {text && (
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
                <div className="text-[11px] font-bold text-amber-700 uppercase tracking-wide mb-2">{'Odhad indexace'}</div>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { l: 'Chunků',  v: `~${Math.ceil(text.length / 1800)}` },
                    { l: 'Tokenů',  v: `~${Math.round(text.length / 4).toLocaleString('cs-CZ')}` },
                    { l: 'Dimenzí', v: '3 072' },
                    { l: 'Model',   v: 'emb-001' },
                  ].map(r => (
                    <div key={r.l} className="bg-white rounded-xl p-2 text-center">
                      <div className="text-[14px] font-bold text-[#001161]">{r.v}</div>
                      <div className="text-[9px] text-gray-400">{r.l}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <button onClick={handleUpload} disabled={uploading || !text.trim() || !title.trim()}
              className="w-full flex items-center justify-center gap-2 py-3.5 bg-[#7C3AED] hover:bg-purple-700 disabled:opacity-40 text-white rounded-2xl text-[14px] font-bold transition-colors">
              {uploading
                ? <><Loader2 className="w-4 h-4 animate-spin" />{'Indexuji…'}</>
                : <><FilePlus2 className="w-4 h-4" />{'Zaindexovat do RAG'}</>
              }
            </button>

            {progress && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                <div>
                  <div className="text-[13px] font-bold text-emerald-700">
                    {`Hotovo! ${progress.ingested} / ${progress.total} chunků`}
                  </div>
                  <div className="text-[11px] text-emerald-600 mt-0.5">
                    {'Dokument je dostupný v RAG dotazech.'}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Seznam nahraných dokumentů */}
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-purple-500" />
              <span className="text-[13px] font-bold text-gray-700 uppercase tracking-wide">
                {'Nahrané dokumenty'}
                <span className="text-gray-400 font-normal ml-1">({docs.length})</span>
              </span>
            </div>
            <button onClick={loadDocs} className="p-1.5 text-gray-400 hover:text-[#001161] rounded-lg transition-colors">
              <RefreshCw className={`w-3.5 h-3.5 ${loadingDocs ? 'animate-spin' : ''}`} />
            </button>
          </div>
          {loadingDocs ? (
            <div className="flex justify-center p-8"><Loader2 className="w-5 h-5 text-gray-300 animate-spin" /></div>
          ) : docs.length === 0 ? (
            <div className="p-8 text-center">
              <FilePlus2 className="w-8 h-8 text-gray-200 mx-auto mb-2" />
              <div className="text-[13px] text-gray-400">{'Zatím žádné nahrané dokumenty'}</div>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {docs.map(doc => (
                <div key={doc.source} className="flex items-center gap-4 px-5 py-3.5 hover:bg-gray-50 transition-colors">
                  <div className="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center shrink-0">
                    <FileText className="w-4 h-4 text-purple-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-bold text-[#001161] truncate">{doc.title}</div>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="text-[10px] font-mono text-gray-400">{doc.source}</span>
                      {doc.description && <span className="text-[10px] text-gray-400 truncate max-w-[180px]">{doc.description}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-600">
                      {doc.chunks} {'chunků'}
                    </span>
                    {doc.uploadedAt && (
                      <span className="text-[10px] text-gray-400">
                        {new Date(doc.uploadedAt).toLocaleDateString('cs-CZ')}
                      </span>
                    )}
                    <button onClick={() => handleDelete(doc.source)} disabled={deletingSource === doc.source}
                      className="p-1.5 text-gray-300 hover:text-red-400 hover:bg-red-50 rounded-lg transition-colors">
                      {deletingSource === doc.source
                        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        : <Trash2 className="w-3.5 h-3.5" />
                      }
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────
const TABS: Array<{ id: Tab; label: string; icon: any; badge?: string }> = [
  { id: 'architektura', label: 'Architektura',  icon: Network                   },
  { id: 'mapa',         label: 'Mapa znalostí', icon: Map,       badge: 'Nova'  },
  { id: 'zdroje',       label: 'Datové zdroje', icon: Database                  },
  { id: 'databaze',     label: 'Znalost. báze', icon: Layers                    },
  { id: 'upload',       label: 'Dokumenty',     icon: FilePlus2, badge: 'Nové'  },
  { id: 'agent',        label: 'Gemini Agent',  icon: Bot                       },
  { id: 'test',         label: 'Testování',     icon: FlaskConical              },
];

export default function RagPage() {
  const [tab, setTab] = useState<Tab>('zdroje');

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header bar */}
      <div className="bg-white border-b border-gray-100 px-6 pt-5 pb-0 shrink-0">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center">
            <Brain className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <div className="font-['Fenomen_Sans',sans-serif] font-bold text-[15px] text-[#001161]">{'RAG Datab\u00e1ze'}</div>
            <div className="font-['Fenomen_Sans',sans-serif] text-[11px] text-[#001161]/40">
              {'Gemini gemini-embedding-001 (3072 dim.) + gemini-3-flash-preview \u2014 System 2 aktivn\u00ed'}
            </div>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <span className="text-[11px] bg-emerald-100 text-emerald-700 px-2.5 py-1 rounded-full font-bold font-['Fenomen_Sans',sans-serif]">
              {'Syst\u00e9m aktivn\u00ed'}
            </span>
          </div>
        </div>
        <div className="flex gap-0.5">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-[13px] font-['Fenomen_Sans',sans-serif] font-bold border-b-2 transition-all ${
                tab === t.id ? 'border-[#001161] text-[#001161]' : 'border-transparent text-[#001161]/40 hover:text-[#001161]/70'
              }`}
            >
              <t.icon className="w-3.5 h-3.5" />
              {t.label}
              {t.badge && (
                <span className="text-[9px] bg-amber-400 text-white px-1.5 py-0.5 rounded-full font-black leading-none">
                  {t.badge}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.18 }} className="h-full">
            {tab === 'architektura' && <ArchitectureTab />}
            {tab === 'mapa'         && <RagKnowledgeMap />}
            {tab === 'zdroje'       && <SourcesTab />}
            {tab === 'databaze'     && <DatabaseTab />}
            {tab === 'upload'       && <UploadTab />}
            {tab === 'agent'        && <AgentTab />}
            {tab === 'test'         && <TestTab />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}