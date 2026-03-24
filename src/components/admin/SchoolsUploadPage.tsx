import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Upload, CheckCircle2, AlertCircle, School, RefreshCw, FileText, Search, X } from 'lucide-react';
import { projectId, publicAnonKey } from '../../utils/supabase/info';

const SERVER = `https://${projectId}.supabase.co/functions/v1/make-server-93a20b6f`;
const FF = { fontFamily: "'Fenomen Sans', sans-serif" } as const;

interface SchoolsStatus {
  loaded: boolean;
  count: number;
  loadedAt: string | null;
}

interface SearchResult {
  ico: string;
  name: string;
  address: string;
  kraj: string;
  source: 'csv' | 'ares';
}

export default function SchoolsUploadPage() {
  const [status, setStatus] = useState<SchoolsStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<{ ok: boolean; count?: number; error?: string } | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [preview, setPreview] = useState<string[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Test search
  const [searchQ, setSearchQ] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadStatus = useCallback(async () => {
    setStatusLoading(true);
    try {
      const res = await fetch(`${SERVER}/admin/schools-status`, { headers: { Authorization: `Bearer ${publicAnonKey}` } });
      const data = await res.json();
      setStatus(data);
    } catch (e) {
      console.error('[Schools] Status error:', e);
    } finally {
      setStatusLoading(false);
    }
  }, []);

  useEffect(() => { loadStatus(); }, [loadStatus]);

  const handleFile = (file: File) => {
    setSelectedFile(file);
    setUploadResult(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const lines = text.split(/\r?\n/).filter(Boolean).slice(0, 6);
      setPreview(lines);
    };
    reader.readAsText(file, 'UTF-8');
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file && file.name.endsWith('.csv')) handleFile(file);
  };

  const handleUpload = async () => {
    if (!selectedFile) return;
    setUploading(true);
    setUploadResult(null);
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      const res = await fetch(`${SERVER}/admin/upload-schools-csv`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${publicAnonKey}` },
        body: formData,
      });
      const data = await res.json();
      if (data.ok) {
        setUploadResult({ ok: true, count: data.count });
        setSelectedFile(null);
        setPreview([]);
        await loadStatus();
      } else {
        setUploadResult({ ok: false, error: data.error || 'Neznámá chyba.' });
      }
    } catch (e: any) {
      setUploadResult({ ok: false, error: e.message });
    } finally {
      setUploading(false);
    }
  };

  const handleSearch = (q: string) => {
    setSearchQ(q);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (!q || q.length < 2) { setSearchResults([]); return; }
    searchTimer.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`${SERVER}/school-search?q=${encodeURIComponent(q)}`, { headers: { Authorization: `Bearer ${publicAnonKey}` } });
        const data = await res.json();
        setSearchResults(data.results || []);
      } catch { setSearchResults([]); }
      finally { setSearching(false); }
    }, 400);
  };

  const fmtDate = (d: string | null) => {
    if (!d) return null;
    return new Date(d).toLocaleString('cs-CZ', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="max-w-3xl mx-auto py-8 px-6 space-y-8">

      {/* Header */}
      <div>
        <h1 style={FF} className="text-[28px] font-bold text-[#001161] mb-1">{'Rejst\u0159\u00edk \u0161kol'}</h1>
        <p style={FF} className="text-[14px] text-[#001161]/50">{'Nahrej CSV z MSMT \u2014 bude pou\u017e\u00edv\u00e1no jako prim\u00e1rn\u00ed zdroj pro autocomplete IČO/n\u00e1zvu \u0161koly.'}</p>
      </div>

      {/* Status card */}
      <div className={`rounded-2xl border p-5 flex items-center gap-4 ${status?.loaded ? 'bg-green-50 border-green-200' : 'bg-[#f8f9ff] border-[#001161]/10'}`}>
        <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${status?.loaded ? 'bg-green-100' : 'bg-[#001161]/8'}`}>
          <School className={`w-6 h-6 ${status?.loaded ? 'text-green-600' : 'text-[#001161]/40'}`} />
        </div>
        <div className="flex-1 min-w-0">
          {statusLoading ? (
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-[#001161]/20 border-t-[#001161]/60 rounded-full animate-spin" />
              <p style={FF} className="text-[14px] text-[#001161]/50">{'Na\u010d\u00edt\u00e1m stav\u2026'}</p>
            </div>
          ) : status?.loaded ? (
            <>
              <p style={FF} className="text-[16px] font-bold text-green-700">
                {status.count.toLocaleString('cs-CZ')} {'\u0161kol na\u010dteno'}
              </p>
              {status.loadedAt && (
                <p style={FF} className="text-[12px] text-green-600/70 mt-0.5">
                  {'Posledn\u00ed na\u010dten\u00ed: '}{fmtDate(status.loadedAt)}
                </p>
              )}
            </>
          ) : (
            <>
              <p style={FF} className="text-[15px] font-bold text-[#001161]/60">{'CSV zat\u00edm nen\u00ed nahran\u00e9'}</p>
              <p style={FF} className="text-[12px] text-[#001161]/40 mt-0.5">{'Autocomplete pou\u017e\u00edv\u00e1 z\u00e1lo\u017en\u00ed ARES API.'}</p>
            </>
          )}
        </div>
        <button onClick={loadStatus} className="p-2 rounded-lg hover:bg-[#001161]/5 transition-colors" title="Obnovit">
          <RefreshCw className={`w-4 h-4 text-[#001161]/40 ${statusLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Upload zone */}
      <div className="space-y-4">
        <h2 style={FF} className="text-[16px] font-bold text-[#001161]">{'Nahr\u00e1t CSV'}</h2>

        <div
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all ${dragOver ? 'border-[#7C3AED] bg-[#7C3AED]/5' : selectedFile ? 'border-green-400 bg-green-50' : 'border-[#001161]/15 hover:border-[#001161]/30 bg-[#f8f9ff]'}`}
        >
          <input ref={fileInputRef} type="file" accept=".csv" className="hidden"
            onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />
          {selectedFile ? (
            <div className="flex flex-col items-center gap-2">
              <FileText className="w-8 h-8 text-green-500" />
              <p style={FF} className="text-[15px] font-bold text-green-700">{selectedFile.name}</p>
              <p style={FF} className="text-[13px] text-green-600/70">
                {(selectedFile.size / 1024).toFixed(0)} KB — klikni pro zm\u011bnu
              </p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3">
              <Upload className="w-10 h-10 text-[#001161]/25" />
              <p style={FF} className="text-[15px] font-bold text-[#001161]/50">{'P\u0159eta\u017e CSV nebo klikni pro v\u00fdb\u011br'}</p>
              <p style={FF} className="text-[12px] text-[#001161]/35">
                {'Podporovan\u00e9 sloupce: N\u00e1zev, I\u010cO, Adresa, Kraj, Typ, Editel/ka, Email'}
              </p>
            </div>
          )}
        </div>

        {/* Preview */}
        <AnimatePresence>
          {preview.length > 0 && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
              <div className="bg-[#001161]/3 rounded-xl p-4 overflow-x-auto">
                <p style={FF} className="text-[11px] font-bold text-[#001161]/40 uppercase tracking-widest mb-2">{'N\u00e1hled prvn\u00edch \u0159\u00e1dk\u016f'}</p>
                <div className="space-y-1">
                  {preview.map((line, i) => (
                    <div key={i} className={`font-mono text-[11px] px-2 py-1 rounded ${i === 0 ? 'bg-[#7C3AED]/10 text-[#7C3AED] font-bold' : 'text-[#001161]/60'}`}>
                      {line.length > 120 ? line.slice(0, 120) + '…' : line}
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Upload button */}
        <AnimatePresence>
          {selectedFile && (
            <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 4 }}>
              <button
                onClick={handleUpload}
                disabled={uploading}
                className="w-full flex items-center justify-center gap-2 bg-[#001161] hover:bg-[#001161]/90 disabled:opacity-50 text-white font-bold text-[15px] py-4 rounded-xl transition-all"
                style={FF}
              >
                {uploading ? (
                  <><div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />{'Nahr\u00e1v\u00e1m a zpracov\u00e1v\u00e1m\u2026'}</>
                ) : (
                  <><Upload className="w-4 h-4" />{'Nahr\u00e1t do Supabase'}</>
                )}
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Upload result */}
        <AnimatePresence>
          {uploadResult && (
            <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              {uploadResult.ok ? (
                <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-xl px-4 py-3">
                  <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
                  <p style={FF} className="text-[14px] text-green-700 font-bold">
                    {'\u00dasp\u011b\u0161n\u011b nahrano — '}{uploadResult.count?.toLocaleString('cs-CZ')}{' \u0161kol v cache'}
                  </p>
                </div>
              ) : (
                <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                  <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                  <div>
                    <p style={FF} className="text-[14px] text-red-700 font-bold">{'Chyba p\u0159i nahr\u00e1v\u00e1n\u00ed'}</p>
                    <p style={FF} className="text-[13px] text-red-600 mt-0.5">{uploadResult.error}</p>
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Test search */}
      {status?.loaded && (
        <div className="space-y-3">
          <h2 style={FF} className="text-[16px] font-bold text-[#001161]">{'Otestovat vyhled\u00e1v\u00e1n\u00ed'}</h2>
          <div className="relative">
            <input
              type="text"
              value={searchQ}
              onChange={e => handleSearch(e.target.value)}
              placeholder={'Za\u010dni ps\u00e1t n\u00e1zev \u0161koly\u2026'}
              style={FF}
              className="w-full text-[15px] text-[#001161] bg-white border border-[#001161]/12 rounded-xl px-5 py-3.5 pr-10 outline-none focus:border-[#7C3AED] focus:ring-2 focus:ring-[#7C3AED]/20 transition-all placeholder:text-[#001161]/35"
            />
            <div className="absolute right-4 top-1/2 -translate-y-1/2">
              {searching
                ? <div className="w-4 h-4 border-2 border-[#001161]/20 border-t-[#001161]/60 rounded-full animate-spin" />
                : searchQ ? <button onClick={() => { setSearchQ(''); setSearchResults([]); }}><X className="w-4 h-4 text-[#001161]/30" /></button>
                : <Search className="w-4 h-4 text-[#001161]/30" />}
            </div>
          </div>

          <AnimatePresence>
            {searchResults.length > 0 && (
              <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="bg-white border border-[#001161]/10 rounded-2xl overflow-hidden shadow-md">
                {searchResults.map((r, i) => (
                  <div key={`${r.ico}-${i}`} className="flex items-start gap-3 px-4 py-3 border-b border-[#001161]/5 last:border-0 hover:bg-[#f8f9ff] transition-colors">
                    <School className="w-4 h-4 text-[#001161]/25 mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p style={FF} className="text-[14px] font-bold text-[#001161] leading-tight">{r.name}</p>
                      <p style={FF} className="text-[12px] text-[#001161]/45 mt-0.5">
                        {'I\u010cO: '}{r.ico}
                        {r.address && <span className="ml-2">· {r.address}</span>}
                        {r.kraj && <span className="ml-2">· {r.kraj}</span>}
                      </p>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${r.source === 'csv' ? 'bg-green-100 text-green-600' : 'bg-amber-100 text-amber-600'}`} style={FF}>
                      {r.source === 'csv' ? 'CSV' : 'ARES'}
                    </span>
                  </div>
                ))}
              </motion.div>
            )}
            {searchQ.length >= 2 && !searching && searchResults.length === 0 && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <p style={FF} className="text-[13px] text-[#001161]/40 text-center py-3">{'Nic nenalezeno'}</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Info box */}
      <div className="bg-[#FFF7ED] border border-[#E8942A]/20 rounded-2xl p-5 space-y-2">
        <p style={FF} className="text-[13px] font-bold text-[#E8942A]">{'Jak to funguje?'}</p>
        <ul className="space-y-1">
          {[
            'CSV se ulo\u017e\u00ed do Supabase Storage a na\u010dte do pam\u011bti serveru',
            'Vyhled\u00e1v\u00e1n\u00ed v autocomplete prob\u00edh\u00e1 lok\u00e1ln\u011b — bleskovat a bez z\u00e1vislosti na ARES',
            'ARES se pou\u017e\u00edv\u00e1 jen pro I\u010cO nebo n\u00e1zvy kter\u00e9 CSV neobsahuje',
            'Po restartu serveru se CSV automaticky na\u010dte ze Storage',
          ].map((item, i) => (
            <li key={i} className="flex items-start gap-2">
              <span className="text-[#E8942A] mt-0.5 shrink-0">·</span>
              <span style={FF} className="text-[13px] text-[#001161]/70">{item}</span>
            </li>
          ))}
        </ul>
      </div>

    </div>
  );
}
