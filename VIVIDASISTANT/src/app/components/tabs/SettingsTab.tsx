import React, { useRef, useState } from 'react';
import { useApp, RagDocument } from '@/app/contexts/AppContext';
import { 
  Download, Upload, Trash2, Globe, Key, Calendar, BookOpen, FileText, 
  Plus, X, Loader2, Settings, Database, Link2, ChevronRight, Sparkles,
  Mail, User, Shield
} from 'lucide-react';
import { toast } from 'sonner';
import { signInWithGoogleOAuth } from '@/lib/supabaseBrowser';
import { projectId, publicAnonKey } from '/utils/supabase/info';

const FN_AUTH_JSON: HeadersInit = {
  Authorization: `Bearer ${publicAnonKey}`,
  apikey: publicAnonKey,
  'Content-Type': 'application/json',
};
const FN_AUTH: HeadersInit = { Authorization: `Bearer ${publicAnonKey}`, apikey: publicAnonKey };

type SectionType = 'account' | 'general' | 'library' | 'integrations' | 'data';

export const SettingsTab: React.FC = () => {
  const { 
    settings, updateSettings, tasks, shortcuts, clearAllData,
    ragDocuments, addRagDocument, deleteRagDocument, ragLoading, loadRagDocuments,
    user, authReady, signInWithGoogle, signOut,
  } = useApp();
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const ragFileInputRef = useRef<HTMLInputElement>(null);
  
  const [activeSection, setActiveSection] = useState<SectionType>('account');
  const [showAddDocument, setShowAddDocument] = useState(false);
  const [newDocTitle, setNewDocTitle] = useState('');
  const [newDocContent, setNewDocContent] = useState('');
  const [newDocType, setNewDocType] = useState<'text' | 'notes' | 'news'>('text');
  const [newDocCategory, setNewDocCategory] = useState<string>('produkt');
  const [newDocProduct, setNewDocProduct] = useState<string>('');
  const [isAddingDoc, setIsAddingDoc] = useState(false);
  const [isReindexing, setIsReindexing] = useState(false);
  const [isSeeding, setIsSeeding] = useState(false);
  const [isScraping, setIsScraping] = useState(false);
  const [isSyncingWebflow, setIsSyncingWebflow] = useState(false);
  const [ragStatus, setRagStatus] = useState<any>(null);
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [selectedDoc, setSelectedDoc] = useState<any>(null);
  const [docContent, setDocContent] = useState<string>("");
  const [loadingDoc, setLoadingDoc] = useState(false);

  const openDocDetail = async (doc: any) => {
    setSelectedDoc(doc);
    setLoadingDoc(true);
    try {
      const resp = await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-954b19ad/rag/documents?includeContent=true`, {
        headers: FN_AUTH,
      });
      if (resp.ok) {
        const data = await resp.json();
        const fullDoc = data.documents?.find((d: any) => d.id === doc.id);
        setDocContent(fullDoc?.content || "Obsah nenalezen");
      }
    } catch (e) {
      setDocContent("Chyba při načítání obsahu");
    }
    setLoadingDoc(false);
  };

  const RAG_CATEGORIES = {
    'produkt': { name: 'Produkty', icon: '📚' },
    'firma': { name: 'O firmě', icon: '🏢' },
    'prodej': { name: 'Prodej', icon: '💰' },
    'sablona': { name: 'Šablony', icon: '✉️' },
    'novinka': { name: 'Novinky', icon: '📰' }
  };

  // Fetch RAG status
  React.useEffect(() => {
    if (activeSection === 'library') {
      fetchRagStatus();
    }
  }, [activeSection]);

  const fetchRagStatus = async () => {
    try {
      const resp = await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-954b19ad/rag/status`, {
        headers: FN_AUTH,
      });
      if (resp.ok) {
        const data = await resp.json();
        setRagStatus(data);
      }
    } catch (e) {
      console.error("Failed to fetch RAG status:", e);
    }
  };

  const seedRagData = async () => {
    setIsSeeding(true);
    toast.loading("🌱 Naplňuji knihovnu produkty...");
    try {
      const resp = await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-954b19ad/rag/seed`, {
        method: 'POST',
        headers: FN_AUTH_JSON,
      });
      toast.dismiss();
      if (resp.ok) {
        const data = await resp.json();
        toast.success(`✅ Přidáno ${data.seeded} produktů`);
        await loadRagDocuments();
        fetchRagStatus();
      } else {
        toast.error("Chyba při naplňování");
      }
    } catch (e) {
      toast.dismiss();
      toast.error("Chyba: " + (e as Error).message);
    }
    setIsSeeding(false);
  };

  const scrapeWeb = async () => {
    setIsScraping(true);
    toast.loading("🌐 Stahuji novinky z webu...");
    try {
      const resp = await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-954b19ad/rag/scrape-web`, {
        method: 'POST',
        headers: FN_AUTH_JSON,
      });
      toast.dismiss();
      if (resp.ok) {
        const data = await resp.json();
        toast.success(`✅ Staženo ${data.scrapedCount} položek z webu`);
        await loadRagDocuments();
        fetchRagStatus();
      } else {
        toast.error("Chyba při scrapování");
      }
    } catch (e) {
      toast.dismiss();
      toast.error("Chyba: " + (e as Error).message);
    }
    setIsScraping(false);
  };

  const syncWebflow = async () => {
    setIsSyncingWebflow(true);
    toast.loading("🔄 Synchronizuji s Webflow CMS...");
    try {
      const resp = await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-954b19ad/rag/sync-webflow`, {
        method: 'POST',
        headers: FN_AUTH_JSON,
      });
      toast.dismiss();
      if (resp.ok) {
        const data = await resp.json();
        toast.success(`✅ Synchronizováno ${data.syncedItems} položek`);
        await loadRagDocuments();
        fetchRagStatus();
      } else {
        toast.error("Chyba při synchronizaci Webflow");
      }
    } catch (e) {
      toast.dismiss();
      toast.error("Chyba: " + (e as Error).message);
    }
    setIsSyncingWebflow(false);
  };
  
  // Check Google connection status
  const [isGoogleConnected, setIsGoogleConnected] = useState(false);
  
  React.useEffect(() => {
    const token = localStorage.getItem('google_provider_token');
    setIsGoogleConnected(!!token);
  }, [activeSection]);

  const connectGoogle = async () => {
    const redirectTo = `${window.location.origin}${window.location.pathname}`;
    const { error } = await signInWithGoogleOAuth(redirectTo, {
      scopes:
        'https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.send',
      queryParams: { access_type: 'offline', prompt: 'consent' },
    });
    if (error) toast.error('Chyba při připojování: ' + error.message);
  };

  const reindexRag = async () => {
    setIsReindexing(true);
    toast.loading("🧠 AI analyzuje knihovnu...");
    try {
      const response = await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-954b19ad/rag/reindex`, {
        method: 'POST',
        headers: FN_AUTH_JSON,
      });

      toast.dismiss();
      if (response.ok) {
        const data = await response.json();
        toast.success(`📚 Indexováno ${data.indexed} dokumentů`);
        if (data.summary) {
          toast.info(data.summary, { duration: 5000 });
        }
      } else {
        toast.error("Nepodařilo se indexovat");
      }
    } catch (error) {
      console.error("Reindex error:", error);
      toast.dismiss();
      toast.error("Chyba při indexování");
    } finally {
      setIsReindexing(false);
    }
  };

  const handleExportRag = async () => {
    try {
      toast.loading("📦 Exportuji knihovnu...");
      const resp = await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-954b19ad/rag/documents?includeContent=true`, {
        headers: FN_AUTH,
      });
      toast.dismiss();
      if (resp.ok) {
        const data = await resp.json();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `rag-library-${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast.success(`✅ Exportováno ${data.documents?.length ?? 0} dokumentů`);
      } else {
        toast.error("Chyba při exportu knihovny");
      }
    } catch (e) {
      toast.dismiss();
      toast.error("Chyba: " + (e as Error).message);
    }
  };

  const handleExport = () => {
    const data = { tasks, shortcuts, settings, version: 1, exportedAt: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `voice-dictation-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("Záloha stažena");
  };

  const handleImportClick = () => fileInputRef.current?.click();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (json.tasks && json.shortcuts) {
          localStorage.setItem('dictation_app_tasks', JSON.stringify(json.tasks));
          localStorage.setItem('dictation_app_shortcuts', JSON.stringify(json.shortcuts));
          if(json.settings) localStorage.setItem('dictation_app_settings', JSON.stringify(json.settings));
          window.location.reload();
        } else {
          toast.error("Neplatný formát souboru");
        }
      } catch (err) {
        toast.error("Chyba při čtení souboru");
      }
    };
    reader.readAsText(file);
  };

  const handleClearData = () => {
    if (confirm("Opravdu chcete smazat všechna data? Tato akce je nevratná.")) {
      clearAllData();
      toast.success("Data vymazána");
    }
  };

  const handleAddDocument = async () => {
    if (!newDocTitle.trim() || !newDocContent.trim()) {
      toast.error("Vyplňte název a obsah dokumentu");
      return;
    }
    setIsAddingDoc(true);
    try {
      await addRagDocument(newDocTitle, newDocContent, newDocType);
      toast.success("Dokument přidán do knihovny");
      setNewDocTitle('');
      setNewDocContent('');
      setShowAddDocument(false);
    } catch (error) {
      toast.error("Chyba při ukládání dokumentu");
    } finally {
      setIsAddingDoc(false);
    }
  };

  const handleDeleteDocument = async (id: string, title: string) => {
    if (confirm(`Smazat dokument "${title}"?`)) {
      try {
        await deleteRagDocument(id);
        toast.success("Dokument smazán");
      } catch (error) {
        toast.error("Chyba při mazání dokumentu");
      }
    }
  };

  const handleRagFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setNewDocTitle(file.name.replace(/\.[^/.]+$/, ""));
      setNewDocContent(content);
      setShowAddDocument(true);
    };
    reader.readAsText(file);
    if (ragFileInputRef.current) ragFileInputRef.current.value = '';
  };

  const sections: { id: SectionType; label: string; icon: React.ReactNode; description: string }[] = [
    { id: 'account', label: 'Účet', icon: <User size={20} />, description: 'Přihlášení Google' },
    { id: 'general', label: 'Další nastavení', icon: <Settings size={20} />, description: 'API, jazyk, o aplikaci' },
    { id: 'library', label: 'Knihovna', icon: <BookOpen size={20} />, description: 'RAG dokumenty' },
    { id: 'integrations', label: 'Integrace', icon: <Link2 size={20} />, description: 'Google, Pipedrive' },
    { id: 'data', label: 'Data', icon: <Database size={20} />, description: 'Export a import' },
  ];

  return (
    <div className="flex flex-col md:flex-row gap-6 h-full">
      {/* Sidebar Navigation */}
      <div className="md:w-64 shrink-0">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg shadow-purple-500/20">
            <Settings size={24} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Nastavení</h1>
            <p className="text-sm text-[#6B7280]">Upravte své preference</p>
          </div>
        </div>

        <nav className="flex md:flex-col gap-2 overflow-x-auto md:overflow-visible pb-2 md:pb-0">
          {sections.map((section) => (
            <button
              key={section.id}
              onClick={() => setActiveSection(section.id)}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all whitespace-nowrap ${
                activeSection === section.id 
                  ? 'bg-white/10 text-white' 
                  : 'text-[#9CA3AF] hover:bg-white/5 hover:text-white'
              }`}
            >
              <span className={activeSection === section.id ? 'text-blue-400' : ''}>{section.icon}</span>
              <div className="text-left hidden md:block">
                <span className="font-medium block">{section.label}</span>
                <span className="text-xs text-[#6B7280]">{section.description}</span>
              </div>
              <span className="md:hidden font-medium">{section.label}</span>
            </button>
          ))}
        </nav>
      </div>

      {/* Content Area */}
      <div className="flex-1 min-w-0">
        {/* Účet — pouze přihlášení */}
        {activeSection === 'account' && (
          <div className="space-y-6">
            <div className="bg-[#1A1A1C] rounded-2xl p-6 border border-white/5 overflow-hidden">
              <div className="flex items-center gap-3 mb-4">
                <User size={20} className="text-emerald-400" />
                <h2 className="text-lg font-semibold text-white">Účet</h2>
              </div>
              {!authReady ? (
                <p className="text-[#6B7280] text-sm">Načítání přihlášení…</p>
              ) : user ? (
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="text-white font-medium truncate">{user.email ?? user.id}</p>
                    <p className="text-sm text-[#6B7280] mt-1">
                      Úkoly, zkratky a nastavení jsou uložené pod tímto účtem a synchronizované v cloudu.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void signOut()}
                    className="w-full sm:w-auto shrink-0 rounded-xl border border-white/15 bg-[#2C2C2E] px-5 py-3 text-sm font-semibold text-white hover:bg-[#3C3C3E] transition-colors"
                  >
                    Odhlásit se
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-5">
                  <p className="text-sm text-[#9CA3AF] leading-relaxed">
                    Přihlaste se přes Google — vaše data (úkoly, zkratky, nastavení, historie chatu) budou jen vaše a uložená na serveru pod účtem.
                  </p>
                  <button
                    type="button"
                    onClick={() => void signInWithGoogle()}
                    className="flex w-full max-w-md items-center justify-center gap-3 rounded-xl border border-white/20 bg-white px-5 py-3.5 text-sm font-semibold shadow-md transition-colors hover:bg-gray-100 [color:#111827]"
                  >
                    <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" aria-hidden>
                      <path
                        fill="#4285F4"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                      />
                    </svg>
                    <span className="[color:#111827]">Přihlásit se přes Google</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Další nastavení — API, jazyk, o aplikaci */}
        {activeSection === 'general' && (
          <div className="space-y-6">
            <div className="bg-[#1A1A1C] rounded-2xl p-6 border border-white/5">
              <div className="flex items-center gap-3 mb-4">
                <Key size={20} className="text-blue-400" />
                <h2 className="text-lg font-semibold text-white">API Klíč</h2>
              </div>
              <input
                type="password"
                value={settings.openaiKey}
                onChange={(e) => updateSettings({ openaiKey: e.target.value })}
                placeholder="sk-..."
                className="w-full p-4 bg-[#0D0D0F] border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-white placeholder-[#4B5563]"
              />
              <p className="text-sm text-[#6B7280] mt-3">Klíč je uložen pouze ve vašem zařízení.</p>
            </div>

            <div className="bg-[#1A1A1C] rounded-2xl p-6 border border-white/5">
              <div className="flex items-center gap-3 mb-4">
                <Globe size={20} className="text-green-400" />
                <h2 className="text-lg font-semibold text-white">Jazyk diktování</h2>
              </div>
              <select
                value={settings.language}
                onChange={(e) => updateSettings({ language: e.target.value })}
                className="w-full p-4 bg-[#0D0D0F] border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-white"
              >
                <option value="cs">🇨🇿 Čeština</option>
                <option value="en">🇬🇧 English</option>
                <option value="de">🇩🇪 Deutsch</option>
              </select>
            </div>

            <div className="bg-gradient-to-br from-blue-500/10 to-purple-500/10 rounded-2xl p-6 border border-blue-500/20">
              <div className="flex items-center gap-3 mb-3">
                <Sparkles size={20} className="text-blue-400" />
                <span className="text-white font-semibold">Vividbooks Asistent</span>
              </div>
              <p className="text-[#9CA3AF]">
                Hlasový asistent s RAG knihovnou a CRM integrací. Verze 1.0.0
              </p>
            </div>
          </div>
        )}

        {/* LIBRARY */}
        {activeSection === 'library' && (
          <div className="space-y-6">
            {/* Header with stats */}
            <div className="bg-[#1A1A1C] rounded-2xl p-6 border border-white/5">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-blue-500/20 rounded-xl flex items-center justify-center shrink-0">
                    <BookOpen size={24} className="text-blue-400" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-white mb-1">Znalostní knihovna</h2>
                    <p className="text-[#6B7280] text-sm">
                      AI automaticky použije tyto dokumenty při psaní emailů a odpovědí.
                    </p>
                  </div>
                </div>
                {ragStatus && (
                  <div className="text-right text-sm">
                    <div className="text-white font-medium">{ragStatus.totalDocuments} dokumentů</div>
                    {ragStatus.lastScrape && (
                      <div className="text-[#6B7280] text-xs">
                        Poslední sync: {new Date(ragStatus.lastScrape).toLocaleDateString('cs')}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 lg:gap-3">
              <button
                onClick={seedRagData}
                disabled={isSeeding}
                className="bg-[#1A1A1C] hover:bg-[#252528] border border-white/5 rounded-xl p-4 text-left transition-colors disabled:opacity-50"
              >
                <div className="text-2xl mb-2">🌱</div>
                <div className="text-white font-medium text-sm">Seed produkty</div>
                <div className="text-[#6B7280] text-xs">Naplnit Vividbooks</div>
              </button>
              
              <button
                onClick={scrapeWeb}
                disabled={isScraping}
                className="bg-[#1A1A1C] hover:bg-[#252528] border border-white/5 rounded-xl p-4 text-left transition-colors disabled:opacity-50"
              >
                <div className="text-2xl mb-2">🌐</div>
                <div className="text-white font-medium text-sm">Stáhnout web</div>
                <div className="text-[#6B7280] text-xs">Blog & webináře</div>
              </button>
              
              <button
                onClick={syncWebflow}
                disabled={isSyncingWebflow}
                className="bg-[#1A1A1C] hover:bg-[#252528] border border-white/5 rounded-xl p-4 text-left transition-colors disabled:opacity-50"
              >
                <div className="text-2xl mb-2">🔄</div>
                <div className="text-white font-medium text-sm">Sync Webflow</div>
                <div className="text-[#6B7280] text-xs">CMS produkty</div>
              </button>
              
              <button
                onClick={reindexRag}
                disabled={isReindexing || ragDocuments.length === 0}
                className="bg-[#1A1A1C] hover:bg-[#252528] border border-white/5 rounded-xl p-4 text-left transition-colors disabled:opacity-50"
              >
                <div className="text-2xl mb-2">🧠</div>
                <div className="text-white font-medium text-sm">Reindexovat</div>
                <div className="text-[#6B7280] text-xs">AI analýza</div>
              </button>
            </div>

            {/* Category Filter */}
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => setFilterCategory('all')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  filterCategory === 'all' 
                    ? 'bg-blue-500 text-white' 
                    : 'bg-[#1A1A1C] text-[#6B7280] hover:text-white'
                }`}
              >
                Vše ({ragDocuments.length})
              </button>
              {Object.entries(RAG_CATEGORIES).map(([key, cat]) => {
                const count = ragDocuments.filter(d => (d as any).category === key).length;
                if (count === 0) return null;
                return (
                  <button
                    key={key}
                    onClick={() => setFilterCategory(key)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      filterCategory === key 
                        ? 'bg-blue-500 text-white' 
                        : 'bg-[#1A1A1C] text-[#6B7280] hover:text-white'
                    }`}
                  >
                    {cat.icon} {cat.name} ({count})
                  </button>
                );
              })}
            </div>

            {/* Document List */}
            <div className="bg-[#1A1A1C] rounded-2xl border border-white/5 overflow-hidden">
              {ragLoading ? (
                <div className="flex items-center justify-center py-16 text-[#6B7280]">
                  <Loader2 size={24} className="animate-spin mr-3" />
                  Načítám dokumenty...
                </div>
              ) : ragDocuments.length > 0 ? (
                <div className="divide-y divide-white/5">
                  {ragDocuments
                    .filter(doc => filterCategory === 'all' || (doc as any).category === filterCategory)
                    .map((doc) => {
                      const category = (doc as any).category || 'produkt';
                      const catInfo = RAG_CATEGORIES[category as keyof typeof RAG_CATEGORIES] || { icon: '📄', name: 'Jiné' };
                      const source = (doc as any).source || 'manual';
                      
                      return (
                        <div 
                          key={doc.id} 
                          onClick={() => openDocDetail(doc)}
                          className="flex items-center justify-between p-5 hover:bg-white/5 transition-colors group cursor-pointer"
                        >
                          <div className="flex items-center gap-4 min-w-0">
                            <div className="w-11 h-11 bg-[#0D0D0F] rounded-xl flex items-center justify-center shrink-0 text-xl">
                              {catInfo.icon}
                            </div>
                            <div className="min-w-0">
                              <h4 className="text-white font-medium truncate">{doc.title}</h4>
                              <div className="flex items-center gap-2 text-sm text-[#6B7280]">
                                <span>{doc.wordCount} slov</span>
                                <span>·</span>
                                <span className="text-blue-400">{catInfo.name}</span>
                                {source !== 'manual' && (
                                  <>
                                    <span>·</span>
                                    <span className={source === 'seed' ? 'text-green-400' : source === 'scrape' ? 'text-purple-400' : 'text-orange-400'}>
                                      {source === 'seed' ? '🌱 Seed' : source === 'scrape' ? '🌐 Web' : '🔄 Webflow'}
                                    </span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                          <button 
                            onClick={() => handleDeleteDocument(doc.id, doc.title)}
                            className="p-3 opacity-0 group-hover:opacity-100 hover:bg-red-500/20 rounded-xl transition-all"
                          >
                            <Trash2 size={18} className="text-red-400" />
                          </button>
                        </div>
                      );
                    })}
                </div>
              ) : (
                <div className="text-center py-16">
                  <BookOpen size={48} className="mx-auto mb-4 text-[#3A3A3C]" />
                  <p className="text-white font-medium mb-1">Knihovna je prázdná</p>
                  <p className="text-sm text-[#6B7280] mb-4">Klikněte na "Seed produkty" pro naplnění</p>
                  <button
                    onClick={seedRagData}
                    disabled={isSeeding}
                    className="px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-medium transition-colors disabled:opacity-50"
                  >
                    🌱 Naplnit Vividbooks produkty
                  </button>
                </div>
              )}
            </div>

            {/* Add Document */}
            {showAddDocument ? (
              <div className="bg-[#1A1A1C] rounded-2xl p-6 border border-blue-500/30 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-white font-semibold">Nový dokument</h3>
                  <button onClick={() => { setShowAddDocument(false); setNewDocTitle(''); setNewDocContent(''); }}>
                    <X size={20} className="text-[#6B7280] hover:text-white" />
                  </button>
                </div>
                
                <input
                  type="text"
                  value={newDocTitle}
                  onChange={(e) => setNewDocTitle(e.target.value)}
                  placeholder="Název dokumentu"
                  className="w-full p-4 bg-[#0D0D0F] border border-white/10 rounded-xl text-white placeholder-[#4B5563] focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                />
                
                <select
                  value={newDocType}
                  onChange={(e) => setNewDocType(e.target.value as 'text' | 'notes' | 'news')}
                  className="w-full p-4 bg-[#0D0D0F] border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                >
                  <option value="text">📄 Obecný text</option>
                  <option value="news">📰 Novinky / Aktuality</option>
                  <option value="notes">📝 Poznámky</option>
                </select>
                
                <textarea
                  value={newDocContent}
                  onChange={(e) => setNewDocContent(e.target.value)}
                  placeholder="Obsah dokumentu..."
                  rows={8}
                  className="w-full p-4 bg-[#0D0D0F] border border-white/10 rounded-xl text-white placeholder-[#4B5563] focus:outline-none focus:ring-2 focus:ring-blue-500/50 resize-none"
                />
                
                <button
                  onClick={handleAddDocument}
                  disabled={isAddingDoc || !newDocTitle.trim() || !newDocContent.trim()}
                  className="w-full py-4 bg-blue-500 hover:bg-blue-600 disabled:bg-blue-500/50 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
                >
                  {isAddingDoc ? <Loader2 size={20} className="animate-spin" /> : <Plus size={20} />}
                  Uložit dokument
                </button>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-3 gap-4">
                  <button
                    onClick={() => setShowAddDocument(true)}
                    className="py-5 bg-blue-500 hover:bg-blue-600 text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-3"
                  >
                    <Plus size={20} />
                    Přidat ručně
                  </button>
                  <button
                    onClick={() => ragFileInputRef.current?.click()}
                    className="py-5 bg-[#1A1A1C] hover:bg-[#252528] text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-3 border border-white/10"
                  >
                    <Upload size={20} />
                    Nahrát soubor
                  </button>
                  <button
                    onClick={handleExportRag}
                    disabled={ragDocuments.length === 0}
                    className="py-5 bg-[#1A1A1C] hover:bg-[#252528] text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-3 border border-white/10 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Download size={20} />
                    Exportovat
                  </button>
                  <input
                    type="file"
                    ref={ragFileInputRef}
                    className="hidden"
                    accept=".txt,.md,.text"
                    onChange={handleRagFileUpload}
                  />
                </div>
                
                {/* Reindex button - vždy viditelný pod tlačítky */}
                <button
                  onClick={reindexRag}
                  disabled={isReindexing || ragDocuments.length === 0}
                  className="w-full mt-4 py-4 bg-gradient-to-r from-purple-500/20 to-blue-500/20 hover:from-purple-500/30 hover:to-blue-500/30 text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-3 border border-purple-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isReindexing ? <Loader2 size={20} className="animate-spin" /> : <Sparkles size={20} />}
                  🧠 Reindexovat knihovnu ({ragDocuments.length} dokumentů)
                </button>
              </>
            )}
          </div>
        )}

        {/* INTEGRATIONS */}
        {activeSection === 'integrations' && (
          <div className="space-y-6">
            {/* Google */}
            <div className="bg-[#1A1A1C] rounded-2xl p-6 border border-white/5">
              <div className="flex items-center gap-4 mb-5">
                <div className="w-14 h-14 bg-white rounded-xl flex items-center justify-center shrink-0 shadow-lg">
                  <img src="https://upload.wikimedia.org/wikipedia/commons/5/53/Google_%22G%22_Logo.svg" alt="Google" className="w-8 h-8" />
                </div>
                <div className="flex-1">
                  <h3 className="text-white font-semibold text-lg">Google</h3>
                  <p className="text-sm text-[#6B7280]">Kalendář + Gmail</p>
                </div>
                <div className={`px-4 py-1.5 text-sm font-medium rounded-full ${
                  isGoogleConnected 
                    ? 'bg-green-500/20 text-green-400' 
                    : 'bg-yellow-500/20 text-yellow-400'
                }`}>
                  {isGoogleConnected ? 'Připojeno' : 'Nepřipojeno'}
                </div>
              </div>
              
              <div className="flex gap-3 mb-5">
                <div className={`flex-1 flex items-center gap-3 p-4 rounded-xl ${
                  isGoogleConnected ? 'bg-green-500/10 border border-green-500/20' : 'bg-[#0D0D0F]'
                }`}>
                  <Calendar size={20} className={isGoogleConnected ? 'text-green-400' : 'text-blue-400'} />
                  <span className={isGoogleConnected ? 'text-green-300' : 'text-[#9CA3AF]'}>Kalendář</span>
                  {isGoogleConnected && <span className="ml-auto text-green-400 text-xs">✓</span>}
                </div>
                <div className={`flex-1 flex items-center gap-3 p-4 rounded-xl ${
                  isGoogleConnected ? 'bg-green-500/10 border border-green-500/20' : 'bg-[#0D0D0F]'
                }`}>
                  <Mail size={20} className={isGoogleConnected ? 'text-green-400' : 'text-red-400'} />
                  <span className={isGoogleConnected ? 'text-green-300' : 'text-[#9CA3AF]'}>Gmail</span>
                  {isGoogleConnected && <span className="ml-auto text-green-400 text-xs">✓</span>}
                </div>
              </div>
              
              <button 
                onClick={connectGoogle}
                className={`w-full py-4 font-semibold rounded-xl transition-colors flex items-center justify-center gap-2 ${
                  isGoogleConnected 
                    ? 'bg-[#2A2A2C] hover:bg-[#3A3A3C] text-white' 
                    : 'bg-[#4285F4] hover:bg-[#3367D6] text-white'
                }`}
              >
                {isGoogleConnected ? 'Obnovit přístup' : 'Připojit Google účet'}
                <ChevronRight size={20} />
              </button>
            </div>

            {/* Pipedrive */}
            <div className="bg-[#1A1A1C] rounded-2xl p-6 border border-white/5">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center shrink-0 shadow-lg">
                  <Database size={26} className="text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="text-white font-semibold text-lg">Pipedrive CRM</h3>
                  <p className="text-sm text-[#6B7280]">Vyhledávání kontaktů a škol</p>
                </div>
                <div className="px-4 py-1.5 bg-green-500/20 text-green-400 text-sm font-medium rounded-full">
                  Připojeno
                </div>
              </div>
            </div>

            <div className="bg-blue-500/10 rounded-xl p-5 border border-blue-500/20">
              <p className="text-blue-300">
                💡 CRM vyhledávání funguje přímo v diktování. Stačí říct např. "Najdi mi školu ZŠ Dobříš".
              </p>
            </div>
          </div>
        )}

        {/* DATA */}
        {activeSection === 'data' && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-3 lg:gap-4">
              <button 
                onClick={handleExport}
                className="flex flex-col items-center justify-center p-4 lg:p-8 bg-[#1A1A1C] hover:bg-[#252528] rounded-xl lg:rounded-2xl transition-colors gap-3 lg:gap-4 border border-white/5"
              >
                <div className="w-12 h-12 lg:w-16 lg:h-16 bg-blue-500/20 rounded-xl lg:rounded-2xl flex items-center justify-center">
                  <Download size={24} className="text-blue-400" />
                </div>
                <div className="text-center">
                  <span className="text-white font-semibold block text-sm lg:text-lg">Export</span>
                  <span className="text-xs lg:text-sm text-[#6B7280]">Stáhnout zálohu</span>
                </div>
              </button>
              
              <button 
                onClick={handleImportClick}
                className="flex flex-col items-center justify-center p-4 lg:p-8 bg-[#1A1A1C] hover:bg-[#252528] rounded-xl lg:rounded-2xl transition-colors gap-3 lg:gap-4 border border-white/5"
              >
                <div className="w-12 h-12 lg:w-16 lg:h-16 bg-purple-500/20 rounded-xl lg:rounded-2xl flex items-center justify-center">
                  <Upload size={24} className="text-purple-400" />
                </div>
                <div className="text-center">
                  <span className="text-white font-semibold block text-sm lg:text-lg">Import</span>
                  <span className="text-xs lg:text-sm text-[#6B7280]">Načíst zálohu</span>
                </div>
              </button>
            </div>
            
            <input type="file" ref={fileInputRef} className="hidden" accept=".json" onChange={handleFileChange} />

            {/* Stats */}
            <div className="bg-[#1A1A1C] rounded-xl lg:rounded-2xl p-4 lg:p-6 border border-white/5">
              <h3 className="text-white font-semibold mb-4 lg:mb-5">Statistiky</h3>
              <div className="grid grid-cols-3 gap-2 lg:gap-4">
                <div className="text-center p-3 lg:p-4 bg-[#0D0D0F] rounded-lg lg:rounded-xl">
                  <div className="text-xl lg:text-3xl font-bold text-white">{tasks.length}</div>
                  <div className="text-xs lg:text-sm text-[#6B7280] mt-1">Úkolů</div>
                </div>
                <div className="text-center p-3 lg:p-4 bg-[#0D0D0F] rounded-lg lg:rounded-xl">
                  <div className="text-xl lg:text-3xl font-bold text-white">{shortcuts.length}</div>
                  <div className="text-xs lg:text-sm text-[#6B7280] mt-1">Zkratek</div>
                </div>
                <div className="text-center p-3 lg:p-4 bg-[#0D0D0F] rounded-lg lg:rounded-xl">
                  <div className="text-xl lg:text-3xl font-bold text-white">{ragDocuments.length}</div>
                  <div className="text-xs lg:text-sm text-[#6B7280] mt-1">Dokumentů</div>
                </div>
              </div>
            </div>

            {/* Danger Zone */}
            <div className="bg-red-500/5 rounded-2xl p-6 border border-red-500/20">
              <div className="flex items-center gap-3 mb-4">
                <Shield size={20} className="text-red-400" />
                <h3 className="text-red-400 font-semibold">Nebezpečná zóna</h3>
              </div>
              <p className="text-[#9CA3AF] mb-5">
                Tato akce smaže všechna vaše data a je nevratná.
              </p>
              <button 
                onClick={handleClearData}
                className="w-full py-4 bg-red-500/20 hover:bg-red-500/30 text-red-400 font-semibold rounded-xl transition-colors flex items-center justify-center gap-2 border border-red-500/30"
              >
                <Trash2 size={20} />
                Smazat všechna data
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Document Detail Modal */}
      {selectedDoc && (
        <div 
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-end lg:items-center justify-center lg:p-4"
          onClick={() => setSelectedDoc(null)}
        >
          <div 
            className="bg-[#1A1A1C] rounded-t-2xl lg:rounded-2xl w-full lg:max-w-2xl max-h-[90vh] lg:max-h-[80vh] overflow-hidden border border-white/10"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-white/10">
              <div>
                <h3 className="text-xl font-semibold text-white">{selectedDoc.title}</h3>
                <p className="text-sm text-[#6B7280] mt-1">
                  {selectedDoc.wordCount} slov · {(selectedDoc as any).category || 'Dokument'} · {(selectedDoc as any).source || 'manual'}
                </p>
              </div>
              <button 
                onClick={() => setSelectedDoc(null)}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              >
                <X size={20} className="text-[#6B7280]" />
              </button>
            </div>
            
            {/* Content */}
            <div className="p-6 overflow-y-auto max-h-[60vh]">
              {loadingDoc ? (
                <div className="flex items-center justify-center py-8 text-[#6B7280]">
                  <Loader2 size={24} className="animate-spin mr-3" />
                  Načítám obsah...
                </div>
              ) : (
                <div className="text-white whitespace-pre-wrap leading-relaxed">
                  {docContent}
                </div>
              )}
            </div>
            
            {/* Footer */}
            <div className="flex items-center justify-between gap-3 p-6 border-t border-white/10">
              <button
                onClick={() => {
                  handleDeleteDocument(selectedDoc.id, selectedDoc.title);
                  setSelectedDoc(null);
                }}
                className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg font-medium transition-colors flex items-center gap-2"
              >
                <Trash2 size={16} />
                Smazat
              </button>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    if (!docContent || loadingDoc) return;
                    const blob = new Blob([docContent], { type: 'text/plain' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `${selectedDoc.title.replace(/[^a-z0-9]/gi, '_')}.txt`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                    toast.success("Dokument stažen");
                  }}
                  disabled={loadingDoc || !docContent}
                  className="px-4 py-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded-lg font-medium transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Download size={16} />
                  Stáhnout
                </button>
                <button
                  onClick={() => setSelectedDoc(null)}
                  className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg font-medium transition-colors"
                >
                  Zavřít
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
