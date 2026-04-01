import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Search, Play, Loader2, CheckCircle2, XCircle, Clock, 
  Users, Target, ChevronDown, ChevronRight, Trash2, RefreshCw,
  Bot, Globe, Database, Sparkles, ArrowRight, Plus, Eye, Upload,
  FileSpreadsheet, Building2, MapPin, Mail, Phone, User
} from 'lucide-react';
import { toast } from 'sonner';
import { projectId } from '/utils/supabase/info';

interface SchoolRecord {
  id: string;
  name: string;
  address?: string;
  city?: string;
  region?: string;
  type?: string;
  website?: string;
  email?: string;
  phone?: string;
  izo?: string;
  redizo?: string;
  director?: string;
}

interface ScrapingJob {
  id: string;
  query: string;
  status: 'pending' | 'analyzing' | 'discovering' | 'scraping' | 'evaluating' | 'enriching' | 'completed' | 'failed';
  progress: number;
  totalSteps: number;
  currentStep: string;
  createdAt: string;
  updatedAt: string;
  parameters?: {
    subject?: string;
    level?: string;
    role?: string;
    region?: string;
    keywords: string[];
  };
  sources?: { url: string; type: string; priority: number }[];
  rawContacts?: any[];
  evaluatedContacts?: any[];
  enrichedContacts?: any[];
  campaignId?: string;
  error?: string;
  logs: { time: string; agent: string; message: string }[];
}

const STATUS_CONFIG = {
  pending: { color: '#6B7280', icon: Clock, label: 'Čeká' },
  analyzing: { color: '#8B5CF6', icon: Sparkles, label: 'Analyzuji zadání' },
  discovering: { color: '#3B82F6', icon: Globe, label: 'Hledám zdroje' },
  scraping: { color: '#F59E0B', icon: Database, label: 'Scrapuji weby' },
  evaluating: { color: '#EC4899', icon: Target, label: 'Hodnotím relevanci' },
  enriching: { color: '#10B981', icon: Users, label: 'Obohacuji data' },
  completed: { color: '#10B981', icon: CheckCircle2, label: 'Dokončeno' },
  failed: { color: '#EF4444', icon: XCircle, label: 'Chyba' }
};

const AGENT_COLORS: Record<string, string> = {
  'System': '#6B7280',
  'QueryAnalyzer': '#8B5CF6',
  'SourceDiscovery': '#3B82F6',
  'WebScraper': '#F59E0B',
  'RelevanceEvaluator': '#EC4899',
  'DataEnricher': '#10B981',
  'CampaignBuilder': '#06B6D4'
};

export const ScrapingTab: React.FC = () => {
  const [query, setQuery] = useState('');
  const [jobs, setJobs] = useState<ScrapingJob[]>([]);
  const [selectedJob, setSelectedJob] = useState<ScrapingJob | null>(null);
  const [loading, setLoading] = useState(false);
  const [expandedLogs, setExpandedLogs] = useState(false);
  
  // School registry state
  const [schoolRegistry, setSchoolRegistry] = useState<SchoolRecord[]>([]);
  const [showRegistry, setShowRegistry] = useState(false);
  const [uploadingCsv, setUploadingCsv] = useState(false);
  const [registrySearch, setRegistrySearch] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load jobs on mount
  useEffect(() => {
    loadJobs();
  }, []);

  // Poll for updates when a job is in progress
  useEffect(() => {
    const activeJobs = jobs.filter(j => 
      !['completed', 'failed'].includes(j.status)
    );
    
    if (activeJobs.length === 0) return;

    const interval = setInterval(() => {
      loadJobs();
      if (selectedJob && !['completed', 'failed'].includes(selectedJob.status)) {
        refreshSelectedJob();
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [jobs, selectedJob]);

  // Load school registry from localStorage
  useEffect(() => {
    const stored = localStorage.getItem('school_registry');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setSchoolRegistry(parsed);
      } catch (e) {
        console.error('Error parsing school registry:', e);
      }
    }
  }, []);

  // Parse CSV file - handles MŠMT rejstřík škol format
  const parseCSV = (csvText: string): SchoolRecord[] => {
    const lines = csvText.split('\n').filter(line => line.trim());
    if (lines.length < 2) return [];

    // Parse header row (handle both ; and , as delimiters, and tabs)
    let delimiter = ';';
    if (lines[0].includes('\t')) delimiter = '\t';
    else if (lines[0].split(';').length < 3 && lines[0].includes(',')) delimiter = ',';
    
    const headers = lines[0].split(delimiter).map(h => h.trim().toLowerCase().replace(/"/g, ''));
    
    console.log('CSV Headers:', headers);
    console.log('Header count:', headers.length);
    
    // Find specific column indices by name
    const findCol = (names: string[]) => headers.findIndex(h => names.some(n => h.includes(n)));
    
    const plnyNazevIdx = findCol(['plný název', 'plny nazev']);
    const zkracenyNazevIdx = findCol(['zkrácený název', 'zkraceny nazev']);
    const icoIdx = findCol(['ičo', 'ico']);
    const redIzoIdx = findCol(['red_izo']);
    const izoIdx = findCol(['izo']);
    const uliceIdx = findCol(['ulice']);
    const cpIdx = headers.findIndex(h => h === 'č. p.' || h === 'c. p.' || h === 'č.p.' || h === 'c.p.');
    const corIdx = headers.findIndex(h => h === 'č. or.' || h === 'c. or.' || h === 'č.or.' || h === 'c.or.');
    const pscIdx = findCol(['psč', 'psc']);
    const mistoIdx = findCol(['místo', 'misto']);
    const krajIdx = findCol(['kraj']);
    const okresIdx = findCol(['okres']);
    const typIdx = findCol(['druhtyp název', 'druhtyp nazev', 'druh']);
    const wwwIdx = findCol(['www']);
    const email1Idx = findCol(['email 1', 'email1']);
    const telefonIdx = findCol(['telefon']);
    const reditelIdx = findCol(['ředitel', 'reditel']);
    
    console.log('Column indices:', { plnyNazevIdx, icoIdx, mistoIdx, typIdx, wwwIdx });
    
    const records: SchoolRecord[] = [];
    const seenIco = new Set<string>(); // For deduplication by IČO
    
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(delimiter).map(v => v.trim().replace(/"/g, ''));
      
      // Get IČO for deduplication
      const ico = icoIdx >= 0 ? values[icoIdx] : '';
      
      // Skip duplicates based on IČO
      if (ico && seenIco.has(ico)) {
        continue;
      }
      if (ico) {
        seenIco.add(ico);
      }
      
      const record: any = { id: crypto.randomUUID() };
      
      // Get name - prefer "Plný název" (column J), fallback to "Zkrácený název"
      if (plnyNazevIdx >= 0 && values[plnyNazevIdx]) {
        record.name = values[plnyNazevIdx];
      } else if (zkracenyNazevIdx >= 0 && values[zkracenyNazevIdx]) {
        record.name = values[zkracenyNazevIdx];
      }
      
      // IČO and IZO
      if (icoIdx >= 0 && values[icoIdx]) record.izo = values[icoIdx];
      if (redIzoIdx >= 0 && values[redIzoIdx]) record.redizo = values[redIzoIdx];
      
      // Build full address from components
      if (uliceIdx >= 0 && values[uliceIdx]) {
        let street = values[uliceIdx];
        if (cpIdx >= 0 && values[cpIdx]) street += ' ' + values[cpIdx];
        if (corIdx >= 0 && values[corIdx]) street += '/' + values[corIdx];
        record.address = street;
      }
      
      // City from "Místo" with PSČ
      if (mistoIdx >= 0 && values[mistoIdx]) {
        record.city = values[mistoIdx];
        if (pscIdx >= 0 && values[pscIdx]) {
          record.city = values[pscIdx] + ' ' + record.city;
        }
      }
      
      // Region
      if (krajIdx >= 0 && values[krajIdx]) record.region = values[krajIdx];
      else if (okresIdx >= 0 && values[okresIdx]) record.region = values[okresIdx];
      
      // Type
      if (typIdx >= 0 && values[typIdx]) record.type = values[typIdx];
      
      // Contact info
      if (wwwIdx >= 0 && values[wwwIdx]) record.website = values[wwwIdx];
      if (email1Idx >= 0 && values[email1Idx]) record.email = values[email1Idx];
      if (telefonIdx >= 0 && values[telefonIdx]) record.phone = values[telefonIdx];
      if (reditelIdx >= 0 && values[reditelIdx]) record.director = values[reditelIdx];
      
      // Only add if we have at least a name
      if (record.name) {
        records.push(record as SchoolRecord);
      }
    }
    
    console.log('Parsed records (deduplicated by IČO):', records.length, 'First:', records[0]);
    return records;
  };

  // Handle CSV file upload
  const handleCsvUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadingCsv(true);
    
    try {
      const text = await file.text();
      const records = parseCSV(text);
      
      if (records.length === 0) {
        toast.error('CSV soubor neobsahuje žádné platné záznamy');
        return;
      }

      // Replace existing registry with new deduplicated records
      setSchoolRegistry(records);
      localStorage.setItem('school_registry', JSON.stringify(records));
      
      toast.success(`Nahráno ${records.length} škol (deduplikováno podle IČO)`);
      setShowRegistry(true);
      
    } catch (error) {
      console.error('Error parsing CSV:', error);
      toast.error('Nepodařilo se načíst CSV soubor');
    } finally {
      setUploadingCsv(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Clear registry
  const clearRegistry = () => {
    if (confirm('Opravdu chcete smazat celý rejstřík škol?')) {
      setSchoolRegistry([]);
      localStorage.removeItem('school_registry');
      toast.success('Rejstřík škol smazán');
    }
  };

  // Filter schools
  const filteredSchools = registrySearch
    ? schoolRegistry.filter(s => 
        s.name.toLowerCase().includes(registrySearch.toLowerCase()) ||
        s.city?.toLowerCase().includes(registrySearch.toLowerCase()) ||
        s.address?.toLowerCase().includes(registrySearch.toLowerCase())
      )
    : schoolRegistry;

  const loadJobs = useCallback(async () => {
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-954b19ad/scraping/jobs`
      );
      if (response.ok) {
        const data = await response.json();
        setJobs(data.jobs || []);
      }
    } catch (error) {
      console.error('Error loading jobs:', error);
    }
  }, []);

  const refreshSelectedJob = useCallback(async () => {
    if (!selectedJob) return;
    
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-954b19ad/scraping/status/${selectedJob.id}`
      );
      if (response.ok) {
        const job = await response.json();
        setSelectedJob(job);
      }
    } catch (error) {
      console.error('Error refreshing job:', error);
    }
  }, [selectedJob]);

  const startJob = async () => {
    if (!query.trim()) {
      toast.error('Zadejte popis, co hledáte');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-954b19ad/scraping/start`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: query.trim() })
        }
      );

      if (!response.ok) throw new Error('Failed to start job');

      const data = await response.json();
      toast.success('Scraping zahájen!');
      setQuery('');
      
      // Load jobs to get the new one
      setTimeout(loadJobs, 500);
      
    } catch (error) {
      console.error('Error starting job:', error);
      toast.error('Nepodařilo se spustit scraping');
    } finally {
      setLoading(false);
    }
  };

  const cancelJob = async (jobId: string) => {
    try {
      await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-954b19ad/scraping/cancel/${jobId}`,
        { method: 'POST' }
      );
      toast.success('Úloha zrušena');
      loadJobs();
      if (selectedJob?.id === jobId) {
        setSelectedJob(null);
      }
    } catch (error) {
      console.error('Error cancelling job:', error);
      toast.error('Nepodařilo se zrušit úlohu');
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'short' });
  };

  return (
    <div className="h-full flex flex-col lg:flex-row bg-black relative">
      {/* Main Content */}
      <div className={`flex-1 min-w-0 flex flex-col overflow-hidden ${selectedJob ? '' : ''}`}>
        {/* Header */}
        <div className="shrink-0 p-4 lg:p-6 border-b border-white/10">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
            <div>
              <h1 className="text-xl lg:text-2xl font-bold text-white flex items-center gap-2 lg:gap-3">
                <Bot className="text-[#8B5CF6]" size={24} />
                AI Scraping Agents
              </h1>
              <p className="text-[#6B7280] text-xs lg:text-sm mt-1">
                Multi-agent systém pro vyhledávání kontaktů z webu
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowRegistry(!showRegistry)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
                  showRegistry ? 'bg-[#10B981] text-white' : 'bg-[#1C1C1E] text-[#6B7280] hover:text-white'
                }`}
              >
                <FileSpreadsheet size={18} />
                <span className="text-xs lg:text-sm font-medium">
                  Rejstřík ({schoolRegistry.length})
                </span>
              </button>
              <button
                onClick={loadJobs}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              >
                <RefreshCw size={20} className="text-[#6B7280]" />
              </button>
            </div>
          </div>

          {/* Search Input */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative">
              <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#6B7280]" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && startJob()}
                placeholder="Např: Najdi mi učitele matematiky..."
                className="w-full bg-[#1C1C1E] border border-white/10 rounded-xl pl-11 pr-4 py-3 text-white text-sm placeholder-[#6B7280] focus:outline-none focus:border-[#8B5CF6] transition-colors"
              />
            </div>
            <button
              onClick={startJob}
              disabled={loading || !query.trim()}
              className="flex items-center justify-center gap-2 px-5 py-3 bg-gradient-to-r from-[#8B5CF6] to-[#EC4899] text-white rounded-xl font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <Loader2 size={20} className="animate-spin" />
              ) : (
                <Play size={20} />
              )}
              <span>Spustit</span>
            </button>
          </div>
        </div>

        {/* School Registry Panel */}
        {showRegistry && (
          <div className="shrink-0 border-b border-white/10 bg-[#0D0D0D]">
            <div className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-white font-semibold flex items-center gap-2">
                  <Building2 size={18} className="text-[#10B981]" />
                  Rejstřík škol ({schoolRegistry.length} záznamů)
                </h3>
                <div className="flex items-center gap-2">
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept=".csv"
                    onChange={handleCsvUpload}
                    className="hidden"
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingCsv}
                    className="flex items-center gap-2 px-3 py-1.5 bg-[#3B82F6] hover:bg-[#2563EB] text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                  >
                    {uploadingCsv ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <Upload size={14} />
                    )}
                    Nahrát CSV
                  </button>
                  {schoolRegistry.length > 0 && (
                    <button
                      onClick={clearRegistry}
                      className="p-1.5 hover:bg-white/10 rounded-lg transition-colors text-[#EF4444]"
                      title="Smazat rejstřík"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </div>

              {schoolRegistry.length > 0 ? (
                <>
                  <div className="relative mb-3">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6B7280]" />
                    <input
                      type="text"
                      value={registrySearch}
                      onChange={(e) => setRegistrySearch(e.target.value)}
                      placeholder="Hledat školy..."
                      className="w-full bg-[#1C1C1E] border border-white/10 rounded-lg pl-9 pr-3 py-2 text-white text-sm placeholder-[#6B7280] focus:outline-none focus:border-[#10B981]"
                    />
                  </div>
                  <div className="max-h-48 overflow-y-auto space-y-1">
                    {filteredSchools.slice(0, 50).map(school => (
                      <div
                        key={school.id}
                        className="flex items-center justify-between py-2 px-3 bg-[#1C1C1E] rounded-lg hover:bg-white/5"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-white text-sm font-medium truncate">{school.name}</p>
                          <div className="flex items-center gap-3 text-xs text-[#6B7280] mt-0.5 flex-wrap">
                            {school.city && (
                              <span className="flex items-center gap-1">
                                <MapPin size={10} /> {school.city}
                              </span>
                            )}
                            {school.director && (
                              <span className="flex items-center gap-1">
                                <User size={10} /> {school.director}
                              </span>
                            )}
                            {school.type && (
                              <span className="px-1.5 py-0.5 bg-[#8B5CF6]/20 text-[#8B5CF6] rounded truncate max-w-[150px]">
                                {school.type}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0 ml-2">
                          {school.email && (
                            <span className="text-[#3B82F6]" title={school.email}>
                              <Mail size={14} />
                            </span>
                          )}
                          {school.website && (
                            <a
                              href={school.website.startsWith('http') ? school.website : `https://${school.website}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[#10B981] hover:text-[#34D399]"
                              title={school.website}
                            >
                              <Globe size={14} />
                            </a>
                          )}
                        </div>
                      </div>
                    ))}
                    {filteredSchools.length > 50 && (
                      <p className="text-center text-[#6B7280] text-xs py-2">
                        A dalších {filteredSchools.length - 50} škol...
                      </p>
                    )}
                  </div>
                </>
              ) : (
                <div className="text-center py-6">
                  <FileSpreadsheet size={32} className="mx-auto text-[#6B7280] opacity-50 mb-2" />
                  <p className="text-[#6B7280] text-sm">
                    Nahrajte CSV soubor s rejstříkem škol
                  </p>
                  <p className="text-[#6B7280] text-xs mt-1">
                    Očekávané sloupce: název, adresa, město, email, web, typ
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Jobs List */}
        <div className="flex-1 overflow-y-auto p-4 lg:p-6">
          {jobs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <Bot size={64} className="text-[#6B7280] opacity-30 mb-4" />
              <h3 className="text-xl font-medium text-white mb-2">Žádné úlohy</h3>
              <p className="text-[#6B7280] max-w-md">
                Zadejte popis kontaktů, které hledáte, a AI agenti je najdou na webu za vás.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {jobs.map(job => {
                const config = STATUS_CONFIG[job.status];
                const StatusIcon = config.icon;
                const isActive = !['completed', 'failed'].includes(job.status);
                
                return (
                  <div
                    key={job.id}
                    onClick={() => setSelectedJob(job)}
                    className={`bg-[#1C1C1E] rounded-xl p-4 cursor-pointer transition-all border-2 ${
                      selectedJob?.id === job.id 
                        ? 'border-[#8B5CF6]' 
                        : 'border-transparent hover:border-white/10'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <StatusIcon 
                            size={16} 
                            style={{ color: config.color }}
                            className={isActive ? 'animate-pulse' : ''}
                          />
                          <span 
                            className="text-xs font-medium"
                            style={{ color: config.color }}
                          >
                            {config.label}
                          </span>
                        </div>
                        <p className="text-white font-medium truncate">{job.query}</p>
                        <p className="text-[#6B7280] text-xs mt-1">
                          {formatDate(job.createdAt)} {formatTime(job.createdAt)}
                          {job.enrichedContacts && (
                            <span className="ml-2 text-[#10B981]">
                              • {job.enrichedContacts.length} kontaktů
                            </span>
                          )}
                        </p>
                      </div>
                      
                      {isActive && (
                        <div className="flex items-center gap-2">
                          <div className="w-24 h-1.5 bg-[#252528] rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-gradient-to-r from-[#8B5CF6] to-[#EC4899] transition-all duration-500"
                              style={{ width: `${(job.progress / job.totalSteps) * 100}%` }}
                            />
                          </div>
                          <button
                            onClick={(e) => { e.stopPropagation(); cancelJob(job.id); }}
                            className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
                          >
                            <XCircle size={16} className="text-[#EF4444]" />
                          </button>
                        </div>
                      )}
                    </div>

                    {isActive && (
                      <p className="text-[#9CA3AF] text-xs mt-2">
                        {job.currentStep}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Job Detail Side Panel - Full screen on mobile */}
      {selectedJob && (
        <div className="fixed inset-0 z-50 lg:relative lg:inset-auto lg:z-auto w-full lg:w-[300px] h-full bg-[#1C1C1E] lg:border-l border-white/10 flex flex-col shrink-0">
          {/* Header */}
          <div className="shrink-0 p-4 border-b border-white/10">
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  {(() => {
                    const config = STATUS_CONFIG[selectedJob.status];
                    const Icon = config.icon;
                    return (
                      <>
                        <Icon size={18} style={{ color: config.color }} />
                        <span className="text-sm font-medium" style={{ color: config.color }}>
                          {config.label}
                        </span>
                      </>
                    );
                  })()}
                </div>
                <h2 className="text-white font-bold">{selectedJob.query}</h2>
              </div>
              <button
                onClick={() => setSelectedJob(null)}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              >
                <XCircle size={20} className="text-[#6B7280]" />
              </button>
            </div>

            {/* Progress */}
            <div className="mt-3">
              <div className="flex items-center justify-between text-xs text-[#6B7280] mb-1">
                <span>Krok {selectedJob.progress}/{selectedJob.totalSteps}</span>
                <span>{Math.round((selectedJob.progress / selectedJob.totalSteps) * 100)}%</span>
              </div>
              <div className="w-full h-2 bg-[#252528] rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-[#8B5CF6] to-[#EC4899] transition-all duration-500"
                  style={{ width: `${(selectedJob.progress / selectedJob.totalSteps) * 100}%` }}
                />
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* Parameters */}
            {selectedJob.parameters && (
              <div className="bg-[#252528] rounded-lg p-3">
                <h3 className="text-white font-medium text-sm mb-2 flex items-center gap-2">
                  <Target size={14} className="text-[#8B5CF6]" />
                  Parametry hledání
                </h3>
                <div className="flex flex-wrap gap-2">
                  {selectedJob.parameters.subject && (
                    <span className="text-xs px-2 py-1 bg-[#8B5CF6]/20 text-[#8B5CF6] rounded-full">
                      {selectedJob.parameters.subject}
                    </span>
                  )}
                  {selectedJob.parameters.level && (
                    <span className="text-xs px-2 py-1 bg-[#3B82F6]/20 text-[#3B82F6] rounded-full">
                      {selectedJob.parameters.level}
                    </span>
                  )}
                  {selectedJob.parameters.role && (
                    <span className="text-xs px-2 py-1 bg-[#10B981]/20 text-[#10B981] rounded-full">
                      {selectedJob.parameters.role}
                    </span>
                  )}
                  {selectedJob.parameters.region && (
                    <span className="text-xs px-2 py-1 bg-[#F59E0B]/20 text-[#F59E0B] rounded-full">
                      {selectedJob.parameters.region}
                    </span>
                  )}
                </div>
                {selectedJob.parameters.keywords?.length > 0 && (
                  <p className="text-[#6B7280] text-xs mt-2">
                    Klíčová slova: {selectedJob.parameters.keywords.join(', ')}
                  </p>
                )}
              </div>
            )}

            {/* Found Contacts */}
            {selectedJob.enrichedContacts && selectedJob.enrichedContacts.length > 0 && (
              <div className="bg-[#252528] rounded-lg p-3">
                <h3 className="text-white font-medium text-sm mb-2 flex items-center gap-2">
                  <Users size={14} className="text-[#10B981]" />
                  Nalezené kontakty ({selectedJob.enrichedContacts.length})
                </h3>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {selectedJob.enrichedContacts.map((contact: any, idx: number) => (
                    <div key={idx} className="flex items-center justify-between py-1.5 border-b border-white/5 last:border-0">
                      <div className="min-w-0">
                        <p className="text-white text-sm truncate">{contact.name}</p>
                        <p className="text-[#6B7280] text-xs truncate">{contact.organization}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          contact.relevanceScore >= 70 
                            ? 'bg-[#10B981]/20 text-[#10B981]' 
                            : contact.relevanceScore >= 40
                              ? 'bg-[#F59E0B]/20 text-[#F59E0B]'
                              : 'bg-[#6B7280]/20 text-[#6B7280]'
                        }`}>
                          {contact.relevanceScore}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Activity Log */}
            <div className="bg-[#252528] rounded-lg p-3">
              <button
                onClick={() => setExpandedLogs(!expandedLogs)}
                className="w-full flex items-center justify-between text-white font-medium text-sm"
              >
                <span className="flex items-center gap-2">
                  <Clock size={14} className="text-[#6B7280]" />
                  Log aktivit ({selectedJob.logs?.length || 0})
                </span>
                {expandedLogs ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              </button>
              
              {expandedLogs && (
                <div className="mt-2 space-y-1.5 max-h-64 overflow-y-auto">
                  {(selectedJob.logs || []).map((log, idx) => (
                    <div key={idx} className="flex items-start gap-2 text-xs">
                      <span className="text-[#6B7280] shrink-0 w-12">
                        {formatTime(log.time)}
                      </span>
                      <span 
                        className="font-medium shrink-0"
                        style={{ color: AGENT_COLORS[log.agent] || '#6B7280' }}
                      >
                        [{log.agent}]
                      </span>
                      <span className="text-[#9CA3AF]">{log.message}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Error */}
            {selectedJob.error && (
              <div className="bg-[#EF4444]/10 border border-[#EF4444]/30 rounded-lg p-3">
                <p className="text-[#EF4444] text-sm">{selectedJob.error}</p>
              </div>
            )}
          </div>

          {/* Actions */}
          {selectedJob.status === 'completed' && selectedJob.enrichedContacts && selectedJob.enrichedContacts.length > 0 && (
            <div className="shrink-0 p-4 border-t border-white/10">
              <button
                onClick={() => {
                  // TODO: Navigate to outreach with contacts
                  toast.success('Připravuji kampaň s kontakty...');
                }}
                className="w-full flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-[#8B5CF6] to-[#EC4899] text-white rounded-xl font-medium hover:opacity-90 transition-opacity"
              >
                <Plus size={18} />
                Vytvořit kampaň ({selectedJob.enrichedContacts.length} kontaktů)
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
