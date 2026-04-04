import React, { useState, useEffect, useCallback } from 'react';
import { 
  Send, Search, Building2, User, Mail, Phone, ChevronDown, ChevronRight,
  Plus, Loader2, Check, X, Sparkles, Clock, Calendar, ArrowRight, Users,
  Target, Edit3, CheckCircle2, Play, Pause, Trash2, Eye, MailCheck, MailX,
  Globe, MapPin, Bot, Database
} from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import { projectId } from '/utils/supabase/info';
import { getEdgeFunctionHeaders } from '@/lib/edgeFunctionHeaders';

// School registry record from localStorage
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

// Scraped contact from web
interface ScrapedContact {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  position?: string;
  subject?: string;
  school: SchoolRecord;
  source: string;
  relevance: number;
  pipedriveMatch?: {
    orgId: number;
    orgName: string;
    isCustomer: boolean;
  };
}

interface Contact {
  id: number;
  name: string;
  email: string;
  phone?: string;
  position?: string;
  orgId: number;
  orgName: string;
}

interface Organization {
  id: number;
  name: string;
  address?: string;
  label?: string;
  contacts: Contact[];
  isCustomer: boolean;
}

interface EmailDraft {
  id: string;
  subject: string;
  body: string;
  to: Contact;
  type: 'initial' | 'followup1' | 'followup2';
  approved: boolean;
  sent: boolean;
  sentAt?: string;
}

interface Campaign {
  id: string;
  name: string;
  goal: string;
  organizations: Organization[];
  emails: EmailDraft[];
  status: 'draft' | 'active' | 'completed';
  createdAt: string;
  updatedAt: string;
}

type View = 'list' | 'new' | 'detail';

const CAMPAIGNS_KEY = 'vivid-outreach-campaigns';

// Load campaigns from localStorage
const loadCampaigns = (): Campaign[] => {
  try {
    const data = localStorage.getItem(CAMPAIGNS_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
};

// Save campaigns to localStorage
const saveCampaigns = (campaigns: Campaign[]) => {
  localStorage.setItem(CAMPAIGNS_KEY, JSON.stringify(campaigns));
};

export const OutreachTab: React.FC = () => {
  // View state
  const [view, setView] = useState<View>('list');
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  
  // New campaign state
  const [step, setStep] = useState<'source' | 'contacts' | 'campaign'>('source');
  const [contactSource, setContactSource] = useState<'pipedrive' | 'scraping'>('pipedrive');
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [selectedOrgs, setSelectedOrgs] = useState<Organization[]>([]);
  const [loadingOrgs, setLoadingOrgs] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'customers' | 'prospects'>('all');
  const [filterPosition, setFilterPosition] = useState<string>('');
  
  // Scraping state
  const [scrapingQuery, setScrapingQuery] = useState('');
  const [scrapingRegion, setScrapingRegion] = useState('');
  const [scrapingInProgress, setScrapingInProgress] = useState(false);
  const [scrapingProgress, setScrapingProgress] = useState(0);
  const [scrapingStatus, setScrapingStatus] = useState('');
  const [scrapedContacts, setScrapedContacts] = useState<ScrapedContact[]>([]);
  const [selectedScrapedContacts, setSelectedScrapedContacts] = useState<ScrapedContact[]>([]);
  const [schoolRegistry, setSchoolRegistry] = useState<SchoolRecord[]>([]);
  
  // Campaign creation state
  const [campaignGoal, setCampaignGoal] = useState('');
  const [generatingEmails, setGeneratingEmails] = useState(false);
  const [emailDrafts, setEmailDrafts] = useState<EmailDraft[]>([]);
  const [expandedEmail, setExpandedEmail] = useState<string | null>(null);
  const [expandedDetailEmail, setExpandedDetailEmail] = useState<string | null>(null);

  // Organization detail state (side panel)
  const [selectedOrgDetail, setSelectedOrgDetail] = useState<Organization | null>(null);
  const [orgDetailData, setOrgDetailData] = useState<any>(null);
  const [loadingOrgDetail, setLoadingOrgDetail] = useState(false);

  // Load campaigns on mount
  useEffect(() => {
    setCampaigns(loadCampaigns());
  }, []);

  // Load school registry from localStorage
  useEffect(() => {
    const stored = localStorage.getItem('school_registry');
    if (stored) {
      try {
        setSchoolRegistry(JSON.parse(stored));
      } catch (e) {
        console.error('Error loading school registry:', e);
      }
    }
  }, []);

  // Save campaigns when changed
  useEffect(() => {
    if (campaigns.length > 0) {
      saveCampaigns(campaigns);
    }
  }, [campaigns]);

  // Filter schools from registry based on region
  const getSchoolsForRegion = useCallback((region: string): SchoolRecord[] => {
    if (!region.trim()) return schoolRegistry.slice(0, 100);
    
    const regionLower = region.toLowerCase();
    return schoolRegistry.filter(school => {
      const cityMatch = school.city?.toLowerCase().includes(regionLower);
      const regionMatch = school.region?.toLowerCase().includes(regionLower);
      const addressMatch = school.address?.toLowerCase().includes(regionLower);
      const nameMatch = school.name?.toLowerCase().includes(regionLower);
      return cityMatch || regionMatch || addressMatch || nameMatch;
    }).slice(0, 50); // Limit to 50 schools for scraping
  }, [schoolRegistry]);

  // Run scraping on selected schools
  const runScraping = useCallback(async () => {
    if (!scrapingQuery.trim()) {
      toast.error('Zadejte co hledáte (např. "učitel matematiky")');
      return;
    }

    const schools = getSchoolsForRegion(scrapingRegion);
    if (schools.length === 0) {
      toast.error('Nenalezeny žádné školy pro zadaný region');
      return;
    }

    setScrapingInProgress(true);
    setScrapingProgress(0);
    setScrapedContacts([]);
    
    // Step 1: Sync with Pipedrive
    setScrapingStatus(`1/3 Synchronizuji s Pipedrive...`);
    setScrapingProgress(10);
    await new Promise(r => setTimeout(r, 500));
    
    // Step 2: Scraping websites
    setScrapingStatus(`2/3 Procházím weby ${schools.length} škol...`);
    setScrapingProgress(30);

    try {
      const headers = await getEdgeFunctionHeaders(true);
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-954b19ad/outreach/scrape-schools`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify({
            query: scrapingQuery,
            region: scrapingRegion,
            schools: schools.map(s => ({
              name: s.name,
              website: s.website,
              email: s.email,
              city: s.city,
              address: s.address,
              director: s.director
            }))
          })
        }
      );

      if (!response.ok) {
        throw new Error('Scraping failed');
      }

      const data = await response.json();
      
      // Step 3: Processing results
      setScrapingStatus(`3/3 Zpracovávám výsledky...`);
      setScrapingProgress(80);
      
      // Convert to ScrapedContact format
      const contacts: ScrapedContact[] = (data.contacts || []).map((c: any, idx: number) => ({
        id: `scraped-${idx}`,
        name: c.name,
        email: c.email,
        phone: c.phone,
        position: c.position,
        subject: c.subject,
        school: schools.find(s => s.name === c.schoolName) || { id: '', name: c.schoolName },
        source: c.source || 'web',
        relevance: c.relevance || 50,
        pipedriveMatch: c.pipedriveMatch
      }));

      // Count customers from Pipedrive
      const customersCount = contacts.filter(c => c.pipedriveMatch?.isCustomer).length;
      const prospectsCount = contacts.filter(c => c.pipedriveMatch && !c.pipedriveMatch.isCustomer).length;
      const unknownCount = contacts.filter(c => !c.pipedriveMatch).length;

      setScrapedContacts(contacts);
      setScrapingStatus(`✓ Nalezeno ${contacts.length} kontaktů (${customersCount} zákazníků, ${prospectsCount} prospektů, ${unknownCount} nových)`);
      toast.success(`Nalezeno ${contacts.length} kontaktů`);

    } catch (error) {
      console.error('Scraping error:', error);
      toast.error('Chyba při scrapování');
      setScrapingStatus('Chyba');
    } finally {
      setScrapingInProgress(false);
      setScrapingProgress(100);
    }
  }, [scrapingQuery, scrapingRegion, getSchoolsForRegion]);

  // Convert scraped contacts to organizations for campaign
  const convertScrapedToOrgs = useCallback((): Organization[] => {
    const orgMap = new Map<string, Organization>();
    
    selectedScrapedContacts.forEach(contact => {
      const schoolName = contact.school.name;
      
      if (!orgMap.has(schoolName)) {
        orgMap.set(schoolName, {
          id: contact.pipedriveMatch?.orgId || Math.floor(Math.random() * -100000),
          name: schoolName,
          address: contact.school.city || contact.school.address,
          isCustomer: contact.pipedriveMatch?.isCustomer || false,
          contacts: []
        });
      }
      
      const org = orgMap.get(schoolName)!;
      org.contacts.push({
        id: parseInt(contact.id.replace('scraped-', '')) || Math.floor(Math.random() * 100000),
        name: contact.name,
        email: contact.email || '',
        phone: contact.phone,
        position: contact.position,
        orgId: org.id,
        orgName: schoolName
      });
    });
    
    return Array.from(orgMap.values());
  }, [selectedScrapedContacts]);

  // Load organizations from Pipedrive
  const loadOrganizations = useCallback(async () => {
    setLoadingOrgs(true);
    try {
      const headers = await getEdgeFunctionHeaders(true);
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-954b19ad/outreach/organizations`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify({
            search: searchTerm,
            filter: filterType,
            position: filterPosition
          })
        }
      );
      
      if (!response.ok) throw new Error('Failed to load organizations');
      
      const data = await response.json();
      setOrganizations(data.organizations || []);
    } catch (error) {
      console.error('Error loading organizations:', error);
      toast.error('Nepodařilo se načíst organizace');
    } finally {
      setLoadingOrgs(false);
    }
  }, [searchTerm, filterType, filterPosition]);

  useEffect(() => {
    if (view === 'new' && step === 'contacts') {
      loadOrganizations();
    }
  }, [view, step, loadOrganizations]);

  const toggleOrgSelection = (org: Organization) => {
    setSelectedOrgs(prev => 
      prev.some(o => o.id === org.id) 
        ? prev.filter(o => o.id !== org.id)
        : [...prev, org]
    );
  };

  // Load organization detail from Pipedrive
  const loadOrgDetail = async (org: Organization) => {
    setSelectedOrgDetail(org);
    setLoadingOrgDetail(true);
    setOrgDetailData(null);
    
    try {
      const headers = await getEdgeFunctionHeaders(true);
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-954b19ad/crm/org-detail`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify({ orgId: org.id })
        }
      );
      
      if (response.ok) {
        const data = await response.json();
        setOrgDetailData(data);
      }
    } catch (error) {
      console.error('Error loading org detail:', error);
      toast.error('Nepodařilo se načíst detail organizace');
    } finally {
      setLoadingOrgDetail(false);
    }
  };

  const generateEmailSequence = async () => {
    // Get organizations from either source
    let orgsToUse = selectedOrgs;
    
    // If using scraping source, convert scraped contacts to organizations
    if (contactSource === 'scraping' && selectedScrapedContacts.length > 0) {
      orgsToUse = convertScrapedToOrgs();
      setSelectedOrgs(orgsToUse); // Store for campaign display
    }
    
    if (!campaignGoal.trim() || orgsToUse.length === 0) {
      toast.error('Zadejte cíl kampaně a vyberte alespoň jednu školu');
      return;
    }

    setGeneratingEmails(true);
    
    try {
      const headers = await getEdgeFunctionHeaders(true);
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-954b19ad/outreach/generate-emails`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify({
            goal: campaignGoal,
            organizations: orgsToUse.map(org => ({
              id: org.id,
              name: org.name,
              address: org.address,
              contacts: org.contacts
            }))
          })
        }
      );

      if (!response.ok) throw new Error('Failed to generate emails');
      
      const data = await response.json();
      setEmailDrafts(data.emails || []);
      toast.success(`Vygenerováno ${data.emails?.length || 0} emailů`);
    } catch (error) {
      console.error('Error generating emails:', error);
      toast.error('Nepodařilo se vygenerovat emaily');
    } finally {
      setGeneratingEmails(false);
    }
  };

  const approveEmail = (emailId: string) => {
    setEmailDrafts(prev => prev.map(e => 
      e.id === emailId ? { ...e, approved: true } : e
    ));
  };

  const approveAllEmails = () => {
    setEmailDrafts(prev => prev.map(e => ({ ...e, approved: true })));
    toast.success('Všechny emaily schváleny');
  };

  const saveCampaign = () => {
    const newCampaign: Campaign = {
      id: `campaign-${Date.now()}`,
      name: `Kampaň ${campaigns.length + 1}`,
      goal: campaignGoal,
      organizations: selectedOrgs,
      emails: emailDrafts,
      status: 'draft',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    setCampaigns(prev => [newCampaign, ...prev]);
    toast.success('Kampaň uložena');
    
    // Reset and go to list
    resetNewCampaign();
    setView('list');
  };

  const startCampaign = async (campaignId: string) => {
    setCampaigns(prev => prev.map(c => 
      c.id === campaignId 
        ? { ...c, status: 'active', updatedAt: new Date().toISOString() }
        : c
    ));
    toast.success('Kampaň spuštěna');
  };

  const deleteCampaign = (campaignId: string) => {
    setCampaigns(prev => prev.filter(c => c.id !== campaignId));
    if (selectedCampaign?.id === campaignId) {
      setSelectedCampaign(null);
      setView('list');
    }
    toast.success('Kampaň smazána');
  };

  const markEmailAsSent = (campaignId: string, emailId: string) => {
    setCampaigns(prev => prev.map(c => 
      c.id === campaignId 
        ? {
            ...c,
            emails: c.emails.map(e => 
              e.id === emailId 
                ? { ...e, sent: true, sentAt: new Date().toISOString() }
                : e
            ),
            updatedAt: new Date().toISOString()
          }
        : c
    ));
  };

  const resetNewCampaign = () => {
    setStep('source');
    setContactSource('pipedrive');
    setSelectedOrgs([]);
    setSelectedScrapedContacts([]);
    setScrapedContacts([]);
    setScrapingQuery('');
    setScrapingRegion('');
    setCampaignGoal('');
    setEmailDrafts([]);
    setExpandedEmail(null);
  };

  const openCampaignDetail = (campaign: Campaign) => {
    setSelectedCampaign(campaign);
    setView('detail');
  };

  // Render campaign list
  const renderCampaignList = () => (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="shrink-0 p-4 lg:p-6 border-b border-white/10 flex flex-col sm:flex-row gap-4 sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl lg:text-2xl font-bold text-white">Outreach Manager</h1>
          <p className="text-[#6B7280] text-sm mt-1">Správa kampaní a automatizované oslovování</p>
        </div>
        <button
          onClick={() => { resetNewCampaign(); setView('new'); }}
          className="flex items-center justify-center gap-2 px-5 py-3 bg-gradient-to-r from-[#3B82F6] to-[#8B5CF6] hover:from-[#2563EB] hover:to-[#7C3AED] text-white rounded-xl font-medium transition-all shadow-lg shadow-blue-500/30"
        >
          <Plus size={20} />
          <span>Nová kampaň</span>
        </button>
      </div>

      {/* Campaign list */}
      <div className="flex-1 overflow-y-auto p-4 lg:p-6">
        {campaigns.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <Send size={64} className="text-[#6B7280] opacity-30 mb-4" />
            <p className="text-[#6B7280] text-lg">Zatím žádné kampaně</p>
            <p className="text-[#6B7280] text-sm mt-1">Vytvořte novou kampaň pro automatizované oslovování škol</p>
            <button
              onClick={() => { resetNewCampaign(); setView('new'); }}
              className="mt-6 flex items-center gap-2 px-5 py-3 bg-[#3B82F6] hover:bg-[#2563EB] text-white rounded-xl font-medium transition-all"
            >
              <Plus size={20} />
              Vytvořit kampaň
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {campaigns.map(campaign => {
              const sentCount = campaign.emails.filter(e => e.sent).length;
              const approvedCount = campaign.emails.filter(e => e.approved).length;
              const totalCount = campaign.emails.length;
              
              return (
                <div 
                  key={campaign.id}
                  className="bg-[#1C1C1E] rounded-xl p-5 border border-white/10 hover:border-white/20 transition-all cursor-pointer"
                  onClick={() => openCampaignDetail(campaign)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-white font-semibold text-lg">{campaign.name}</h3>
                        <span className={`text-[10px] px-2 py-1 rounded-full font-medium ${
                          campaign.status === 'active' 
                            ? 'bg-[#10B981]/20 text-[#10B981]' 
                            : campaign.status === 'completed'
                              ? 'bg-[#6B7280]/20 text-[#6B7280]'
                              : 'bg-[#F59E0B]/20 text-[#F59E0B]'
                        }`}>
                          {campaign.status === 'active' ? 'Běží' : campaign.status === 'completed' ? 'Dokončena' : 'Rozpracováno'}
                        </span>
                      </div>
                      <p className="text-[#9CA3AF] text-sm line-clamp-2">{campaign.goal}</p>
                      
                      {/* Stats */}
                      <div className="flex flex-wrap items-center gap-3 lg:gap-6 mt-4">
                        <div className="flex items-center gap-2 text-xs lg:text-sm">
                          <Building2 size={14} className="text-[#3B82F6]" />
                          <span className="text-[#9CA3AF]">{campaign.organizations.length} škol</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs lg:text-sm">
                          <Mail size={14} className="text-[#8B5CF6]" />
                          <span className="text-[#9CA3AF]">{totalCount} emailů</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs lg:text-sm">
                          <MailCheck size={14} className="text-[#10B981]" />
                          <span className="text-[#10B981]">{sentCount} odesláno</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs lg:text-sm">
                          <CheckCircle2 size={14} className="text-[#F59E0B]" />
                          <span className="text-[#F59E0B]">{approvedCount} schváleno</span>
                        </div>
                      </div>
                    </div>
                    
                    {/* Actions */}
                    <div className="flex items-center gap-2 ml-4">
                      {campaign.status === 'draft' && approvedCount > 0 && (
                        <button
                          onClick={(e) => { e.stopPropagation(); startCampaign(campaign.id); }}
                          className="p-2 bg-[#10B981] hover:bg-[#059669] text-white rounded-lg transition-colors"
                          title="Spustit kampaň"
                        >
                          <Play size={16} />
                        </button>
                      )}
                      <button
                        onClick={(e) => { e.stopPropagation(); deleteCampaign(campaign.id); }}
                        className="p-2 bg-[#EF4444]/20 hover:bg-[#EF4444]/40 text-[#EF4444] rounded-lg transition-colors"
                        title="Smazat kampaň"
                      >
                        <Trash2 size={16} />
                      </button>
                      <ChevronRight size={20} className="text-[#6B7280]" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );

  // Render new campaign flow
  const renderNewCampaign = () => (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="shrink-0 p-4 border-b border-white/10 flex items-center justify-between bg-[#1C1C1E]">
        <div className="flex items-center gap-4">
          <button
            onClick={() => { resetNewCampaign(); setView('list'); }}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
          >
            <X size={20} className="text-[#6B7280]" />
          </button>
          <h2 className="text-xl font-bold text-white">Nová kampaň</h2>
        </div>
        
        {/* Step indicator */}
        <div className="flex items-center gap-2 bg-[#252528] rounded-xl p-1">
          <button
            onClick={() => setStep('source')}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
              step === 'source' ? 'bg-[#3B82F6] text-white' : 'text-[#6B7280] hover:text-white'
            }`}
          >
            <Database size={14} />
            1. Zdroj
          </button>
          <ArrowRight size={12} className="text-[#6B7280]" />
          <button
            onClick={() => setStep('contacts')}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
              step === 'contacts' ? 'bg-[#3B82F6] text-white' : 'text-[#6B7280] hover:text-white'
            }`}
          >
            <Users size={14} />
            2. Kontakty
            {(selectedOrgs.length > 0 || selectedScrapedContacts.length > 0) && (
              <span className="bg-white/20 text-white text-xs px-1.5 rounded-full">
                {selectedOrgs.length || selectedScrapedContacts.length}
              </span>
            )}
          </button>
          <ArrowRight size={12} className="text-[#6B7280]" />
          <button
            onClick={() => (selectedOrgs.length > 0 || selectedScrapedContacts.length > 0) && setStep('campaign')}
            disabled={selectedOrgs.length === 0 && selectedScrapedContacts.length === 0}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
              step === 'campaign' ? 'bg-[#3B82F6] text-white' : 'text-[#6B7280] hover:text-white'
            } ${selectedOrgs.length === 0 && selectedScrapedContacts.length === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <Target size={14} />
            3. Kampaň
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {step === 'source' ? (
          // STEP 1: Choose source
          <div className="h-full flex items-center justify-center p-8">
            <div className="max-w-2xl w-full space-y-6">
              <div className="text-center mb-8">
                <h3 className="text-2xl font-bold text-white mb-2">Odkud chcete získat kontakty?</h3>
                <p className="text-[#6B7280]">Vyberte zdroj kontaktů pro vaši kampaň</p>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Pipedrive source */}
                <button
                  onClick={() => { setContactSource('pipedrive'); setStep('contacts'); }}
                  className={`p-5 lg:p-6 rounded-2xl border-2 transition-all text-left ${
                    contactSource === 'pipedrive' 
                      ? 'border-[#3B82F6] bg-[#3B82F6]/10' 
                      : 'border-white/10 hover:border-white/30 bg-[#1C1C1E]'
                  }`}
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 lg:w-12 lg:h-12 rounded-xl bg-[#10B981]/20 flex items-center justify-center shrink-0">
                      <Database size={20} className="text-[#10B981] lg:w-6 lg:h-6" />
                    </div>
                    <div>
                      <h4 className="text-white font-semibold text-sm lg:text-base">Pipedrive CRM</h4>
                      <p className="text-[#6B7280] text-xs lg:text-sm">Existující kontakty</p>
                    </div>
                  </div>
                  <p className="text-[#9CA3AF] text-xs lg:text-sm">
                    Vyberte kontakty z vašeho CRM. Ideální pro follow-up kampaně na stávající zákazníky nebo prospekty.
                  </p>
                </button>

                {/* Scraping source */}
                <button
                  onClick={() => { setContactSource('scraping'); setStep('contacts'); }}
                  className={`p-5 lg:p-6 rounded-2xl border-2 transition-all text-left ${
                    contactSource === 'scraping' 
                      ? 'border-[#8B5CF6] bg-[#8B5CF6]/10' 
                      : 'border-white/10 hover:border-white/30 bg-[#1C1C1E]'
                  }`}
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 lg:w-12 lg:h-12 rounded-xl bg-[#8B5CF6]/20 flex items-center justify-center shrink-0">
                      <Bot size={20} className="text-[#8B5CF6] lg:w-6 lg:h-6" />
                    </div>
                    <div>
                      <h4 className="text-white font-semibold text-sm lg:text-base">AI Scraping</h4>
                      <p className="text-[#6B7280] text-xs lg:text-sm">Najít nové kontakty</p>
                    </div>
                  </div>
                  <p className="text-[#9CA3AF] text-xs lg:text-sm">
                    AI agenti prohledají weby škol z rejstříku ({schoolRegistry.length} škol) a najdou relevantní kontakty.
                  </p>
                  {schoolRegistry.length === 0 && (
                    <p className="text-[#F59E0B] text-xs mt-2 flex items-center gap-1">
                      ⚠️ Nahrajte nejprve rejstřík škol v záložce Scraping
                    </p>
                  )}
                </button>
              </div>
            </div>
          </div>
        ) : step === 'contacts' && contactSource === 'scraping' ? (
          // STEP 2a: Scraping contacts
          <div className="h-full flex flex-col lg:flex-row overflow-hidden">
            {/* Left sidebar - Scraping config */}
            <div className="w-full lg:w-[340px] shrink-0 lg:border-r border-b lg:border-b-0 border-white/10 p-4 space-y-4 overflow-y-auto bg-[#0A0E17] max-h-[40vh] lg:max-h-full">
              <div className="bg-gradient-to-r from-[#8B5CF6]/20 to-[#EC4899]/20 rounded-xl p-4 border border-[#8B5CF6]/30">
                <div className="flex items-center gap-2 mb-2">
                  <Bot size={18} className="text-[#8B5CF6]" />
                  <h4 className="text-white font-semibold">AI Scraping</h4>
                </div>
                <p className="text-[#9CA3AF] text-xs">
                  Zadejte koho hledáte a region. AI prohledá weby škol a najde kontakty.
                </p>
              </div>

              <div>
                <label className="text-[#6B7280] text-xs uppercase font-medium mb-2 block">Koho hledáte?</label>
                <input
                  type="text"
                  placeholder="Např: učitel matematiky, ředitel..."
                  value={scrapingQuery}
                  onChange={(e) => setScrapingQuery(e.target.value)}
                  className="w-full bg-[#1C1C1E] border border-white/10 rounded-lg px-4 py-3 text-white text-sm placeholder-[#6B7280] focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]"
                />
              </div>

              <div>
                <label className="text-[#6B7280] text-xs uppercase font-medium mb-2 block">Region / Město</label>
                <input
                  type="text"
                  placeholder="Např: Praha 1, Brno, Plzeňský kraj..."
                  value={scrapingRegion}
                  onChange={(e) => setScrapingRegion(e.target.value)}
                  className="w-full bg-[#1C1C1E] border border-white/10 rounded-lg px-4 py-3 text-white text-sm placeholder-[#6B7280] focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]"
                />
                <p className="text-[#6B7280] text-xs mt-1">
                  Nalezeno: {getSchoolsForRegion(scrapingRegion).length} škol
                </p>
              </div>

              <button
                onClick={runScraping}
                disabled={scrapingInProgress || !scrapingQuery.trim() || schoolRegistry.length === 0}
                className="w-full flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-[#8B5CF6] to-[#EC4899] hover:opacity-90 text-white rounded-lg font-medium transition-all disabled:opacity-50"
              >
                {scrapingInProgress ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    {scrapingStatus}
                  </>
                ) : (
                  <>
                    <Sparkles size={16} />
                    Spustit scraping
                  </>
                )}
              </button>

              {scrapingInProgress && (
                <div className="w-full bg-[#1C1C1E] rounded-full h-2">
                  <div 
                    className="h-2 rounded-full bg-gradient-to-r from-[#8B5CF6] to-[#EC4899] transition-all"
                    style={{ width: `${scrapingProgress}%` }}
                  />
                </div>
              )}

              {selectedScrapedContacts.length > 0 && (
                <div className="pt-4 border-t border-white/10">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-white font-medium">Vybráno: {selectedScrapedContacts.length}</span>
                    <button
                      onClick={() => setStep('campaign')}
                      className="text-[#3B82F6] text-sm hover:underline"
                    >
                      Pokračovat →
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Right - Scraped contacts */}
            <div className="flex-1 p-4 overflow-y-auto">
              {scrapedContacts.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center">
                  <Bot size={48} className="text-[#6B7280] opacity-30 mb-4" />
                  <h3 className="text-lg font-medium text-white mb-2">Žádné kontakty</h3>
                  <p className="text-[#6B7280] max-w-md">
                    Zadejte koho hledáte a region, pak spusťte scraping.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-white font-semibold">
                      Nalezené kontakty ({scrapedContacts.length})
                    </h3>
                    <button
                      onClick={() => setSelectedScrapedContacts(scrapedContacts)}
                      className="text-[#3B82F6] text-sm hover:underline"
                    >
                      Vybrat vše
                    </button>
                  </div>
                  
                  {scrapedContacts.map(contact => {
                    const isSelected = selectedScrapedContacts.some(c => c.id === contact.id);
                    return (
                      <div
                        key={contact.id}
                        onClick={() => {
                          if (isSelected) {
                            setSelectedScrapedContacts(prev => prev.filter(c => c.id !== contact.id));
                          } else {
                            setSelectedScrapedContacts(prev => [...prev, contact]);
                          }
                        }}
                        className={`p-3 rounded-xl cursor-pointer transition-all border-2 ${
                          isSelected 
                            ? 'border-[#8B5CF6] bg-[#8B5CF6]/10' 
                            : 'border-transparent bg-[#1C1C1E] hover:border-white/10'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-white font-medium">{contact.name}</span>
                              {contact.position && (
                                <span className="text-[10px] px-2 py-0.5 bg-[#8B5CF6]/20 text-[#8B5CF6] rounded-full">
                                  {contact.position}
                                </span>
                              )}
                              {contact.pipedriveMatch?.isCustomer && (
                                <span className="text-[10px] px-2 py-0.5 bg-[#10B981]/20 text-[#10B981] rounded-full">
                                  Zákazník
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-3 text-xs text-[#6B7280]">
                              <span className="flex items-center gap-1">
                                <Building2 size={12} /> {contact.school.name}
                              </span>
                              {contact.school.city && (
                                <span className="flex items-center gap-1">
                                  <MapPin size={12} /> {contact.school.city}
                                </span>
                              )}
                            </div>
                            {contact.email && (
                              <p className="text-[#3B82F6] text-xs mt-1 flex items-center gap-1">
                                <Mail size={12} /> {contact.email}
                              </p>
                            )}
                          </div>
                          <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${
                            isSelected ? 'bg-[#8B5CF6]' : 'bg-[#252528]'
                          }`}>
                            {isSelected && <Check size={12} className="text-white" />}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        ) : step === 'contacts' ? (
          // STEP 2b: Pipedrive contact selection
          <div className="h-full flex flex-col lg:flex-row overflow-hidden">
            {/* Left sidebar - Filters */}
            <div className="w-full lg:w-[300px] shrink-0 lg:border-r border-b lg:border-b-0 border-white/10 p-4 space-y-4 overflow-y-auto bg-[#0A0E17] max-h-[35vh] lg:max-h-full">
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6B7280]" />
                <input
                  type="text"
                  placeholder="Hledat školy..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-[#1C1C1E] border border-white/10 rounded-lg pl-10 pr-4 py-2 text-white text-sm placeholder-[#6B7280] focus:outline-none focus:ring-2 focus:ring-[#3B82F6]"
                />
              </div>

              <div>
                <label className="text-[#6B7280] text-xs uppercase font-medium mb-2 block">Typ</label>
                <div className="flex bg-[#1C1C1E] rounded-lg p-1">
                  {['all', 'customers', 'prospects'].map(type => (
                    <button
                      key={type}
                      onClick={() => setFilterType(type as typeof filterType)}
                      className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${
                        filterType === type ? 'bg-[#3B82F6] text-white' : 'text-[#6B7280] hover:text-white'
                      }`}
                    >
                      {type === 'all' ? 'Všechny' : type === 'customers' ? 'Zákazníci' : 'Prospekti'}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[#6B7280] text-xs uppercase font-medium mb-2 block">Pozice kontaktů</label>
                <select
                  value={filterPosition}
                  onChange={(e) => setFilterPosition(e.target.value)}
                  className="w-full bg-[#1C1C1E] border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#3B82F6]"
                >
                  <option value="">Všechny pozice</option>
                  <option value="Ředitel">Ředitel</option>
                  <option value="Zástupce">Zástupce</option>
                  <option value="Učitel fyziky">Učitel fyziky</option>
                  <option value="Učitel chemie">Učitel chemie</option>
                  <option value="Učitel">Učitel</option>
                  <option value="ICT koordinátor">ICT koordinátor</option>
                </select>
              </div>

              <button
                onClick={loadOrganizations}
                disabled={loadingOrgs}
                className="w-full flex items-center justify-center gap-2 py-3 bg-[#3B82F6] hover:bg-[#2563EB] text-white rounded-lg font-medium transition-colors disabled:opacity-50"
              >
                {loadingOrgs ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
                Hledat
              </button>

              {/* Selected count */}
              {selectedOrgs.length > 0 && (
                <div className="bg-[#10B981]/10 border border-[#10B981]/30 rounded-lg p-3">
                  <p className="text-[#10B981] font-medium text-sm flex items-center gap-2">
                    <CheckCircle2 size={14} />
                    Vybráno {selectedOrgs.length} škol
                  </p>
                  <button
                    onClick={() => setStep('campaign')}
                    className="mt-2 w-full flex items-center justify-center gap-2 py-2 bg-[#10B981] hover:bg-[#059669] text-white rounded-lg text-sm font-medium transition-colors"
                  >
                    Pokračovat <ArrowRight size={14} />
                  </button>
                </div>
              )}
            </div>

            {/* Organizations grid */}
            <div className="flex-1 p-4 overflow-y-auto">
              {loadingOrgs ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 size={32} className="animate-spin text-[#3B82F6]" />
                </div>
              ) : organizations.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <Building2 size={48} className="text-[#6B7280] opacity-30 mb-4" />
                  <p className="text-[#6B7280]">Klikněte na "Hledat" pro načtení škol</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                  {organizations.map(org => {
                    const isSelected = selectedOrgs.some(o => o.id === org.id);
                    return (
                      <div
                        key={org.id}
                        className={`bg-[#1C1C1E] rounded-lg p-3 transition-all border-2 ${
                          isSelected ? 'border-[#3B82F6] bg-[#3B82F6]/10' : 'border-transparent hover:border-white/10'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div 
                            className="flex-1 min-w-0 cursor-pointer"
                            onClick={() => toggleOrgSelection(org)}
                          >
                            <p className="text-white font-medium text-sm truncate">{org.name}</p>
                            {org.address && (
                              <p className="text-[#6B7280] text-xs mt-0.5 truncate">{org.address}</p>
                            )}
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              onClick={(e) => { e.stopPropagation(); loadOrgDetail(org); }}
                              className="p-1.5 bg-[#F59E0B]/20 hover:bg-[#F59E0B]/40 text-[#F59E0B] rounded-lg transition-colors"
                              title="Náhled"
                            >
                              <Eye size={14} />
                            </button>
                            <div 
                              onClick={() => toggleOrgSelection(org)}
                              className={`w-5 h-5 rounded-full flex items-center justify-center cursor-pointer ${
                                isSelected ? 'bg-[#3B82F6]' : 'bg-[#252528]'
                              }`}
                            >
                              {isSelected && <Check size={12} className="text-white" />}
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex flex-wrap gap-1 mt-2">
                          {org.isCustomer && (
                            <span className="text-[9px] px-1.5 py-0.5 bg-[#10B981]/20 text-[#10B981] rounded-full">Zákazník</span>
                          )}
                          <span className="text-[9px] px-1.5 py-0.5 bg-[#8B5CF6]/20 text-[#8B5CF6] rounded-full">
                            {org.contacts.length} kontaktů
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        ) : (
          // STEP 2: Campaign configuration & email table
          <div className="h-full flex flex-col lg:flex-row overflow-hidden">
            {/* Left: Campaign setup */}
            <div className="w-full lg:w-[320px] xl:w-[350px] shrink-0 lg:border-r border-b lg:border-b-0 border-white/10 p-4 lg:p-5 space-y-4 lg:space-y-5 overflow-y-auto bg-[#0A0E17] max-h-[40vh] lg:max-h-full">
              <div className="bg-[#1C1C1E] rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-white font-medium flex items-center gap-2 text-sm">
                    {contactSource === 'scraping' ? (
                      <Bot size={14} className="text-[#8B5CF6]" />
                    ) : (
                      <Building2 size={14} className="text-[#3B82F6]" />
                    )}
                    {contactSource === 'scraping' 
                      ? `Vybrané kontakty (${selectedScrapedContacts.length})`
                      : `Vybrané školy (${selectedOrgs.length})`
                    }
                  </h3>
                  <button onClick={() => setStep('contacts')} className="text-[#3B82F6] text-xs hover:underline">
                    Upravit
                  </button>
                </div>
                <div className="space-y-1 max-h-24 overflow-y-auto">
                  {contactSource === 'scraping' ? (
                    selectedScrapedContacts.slice(0, 10).map(contact => (
                      <div key={contact.id} className="flex items-center justify-between text-xs">
                        <span className="text-[#9CA3AF] truncate">{contact.name}</span>
                        <span className="text-[#6B7280] truncate ml-2">{contact.school.name}</span>
                      </div>
                    ))
                  ) : (
                    selectedOrgs.map(org => (
                      <div key={org.id} className="flex items-center justify-between text-xs">
                        <span className="text-[#9CA3AF] truncate">{org.name}</span>
                        <span className="text-[#6B7280]">{org.contacts.length} k.</span>
                      </div>
                    ))
                  )}
                  {contactSource === 'scraping' && selectedScrapedContacts.length > 10 && (
                    <p className="text-[#6B7280] text-xs text-center">+{selectedScrapedContacts.length - 10} dalších</p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-white font-medium flex items-center gap-2 text-sm">
                  <Target size={14} className="text-[#F59E0B]" />
                  Cíl kampaně
                </label>
                <textarea
                  value={campaignGoal}
                  onChange={(e) => setCampaignGoal(e.target.value)}
                  placeholder="Např.: Domluv osobní schůzku, chci přinést nové vzorky matematiky..."
                  rows={3}
                  className="w-full bg-[#1C1C1E] border border-white/10 rounded-lg px-3 py-2 text-white text-sm placeholder-[#6B7280] focus:outline-none focus:ring-2 focus:ring-[#F59E0B] resize-none"
                />
              </div>

              <button
                onClick={generateEmailSequence}
                disabled={generatingEmails || !campaignGoal.trim()}
                className="w-full flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-[#F59E0B] to-[#EF4444] hover:from-[#D97706] hover:to-[#DC2626] text-white rounded-lg font-medium transition-all disabled:opacity-50"
              >
                {generatingEmails ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                {generatingEmails ? 'Generuji...' : 'Vygenerovat emaily'}
              </button>

              {emailDrafts.length > 0 && (
                <>
                  <div className="bg-[#10B981]/10 border border-[#10B981]/30 rounded-lg p-3">
                    <p className="text-[#10B981] font-medium text-sm flex items-center gap-2">
                      <CheckCircle2 size={14} />
                      {emailDrafts.length} emailů
                    </p>
                    <p className="text-[#6B7280] text-xs mt-1">
                      {emailDrafts.filter(e => e.approved).length} schváleno
                    </p>
                  </div>

                  <button
                    onClick={approveAllEmails}
                    className="w-full flex items-center justify-center gap-2 py-2 bg-[#10B981]/20 hover:bg-[#10B981]/30 text-[#10B981] rounded-lg text-sm font-medium transition-colors border border-[#10B981]/30"
                  >
                    <Check size={14} />
                    Schválit vše
                  </button>

                  <button
                    onClick={saveCampaign}
                    className="w-full flex items-center justify-center gap-2 py-3 bg-[#3B82F6] hover:bg-[#2563EB] text-white rounded-lg font-medium transition-colors"
                  >
                    <Send size={16} />
                    Uložit kampaň
                  </button>
                </>
              )}
            </div>

            {/* Right: Email table */}
            <div className="flex-1 flex flex-col overflow-hidden min-h-0">
              {/* Table header - Hidden on mobile, shown on lg+ */}
              <div className="shrink-0 hidden lg:grid grid-cols-[200px_1fr_1fr_1fr] xl:grid-cols-[240px_1fr_1fr_1fr] gap-4 px-4 py-3 bg-[#252528] border-b border-white/10 text-xs font-semibold text-[#9CA3AF] uppercase tracking-wide">
                <div className="flex items-center gap-2"><Building2 size={14} /> Škola / Kontakt</div>
                <div className="flex items-center gap-2"><Mail size={14} /> Úvodní email</div>
                <div className="flex items-center gap-2"><Clock size={14} /> Follow-up 1</div>
                <div className="flex items-center gap-2"><Clock size={14} /> Follow-up 2</div>
              </div>
              {/* Mobile header */}
              <div className="shrink-0 lg:hidden flex items-center justify-between px-4 py-3 bg-[#252528] border-b border-white/10">
                <span className="text-xs font-semibold text-[#9CA3AF] uppercase">Emaily</span>
                <span className="text-xs text-[#6B7280]">{emailDrafts.length} celkem</span>
              </div>

              {/* Table body */}
              <div className="flex-1 overflow-y-auto">
                {emailDrafts.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center">
                    <Mail size={48} className="text-[#6B7280] opacity-30 mb-4" />
                    <p className="text-[#6B7280]">Zadejte cíl a klikněte na "Vygenerovat emaily"</p>
                  </div>
                ) : (
                  (() => {
                    // Deduplicate emails by contact email address
                    const seenEmails = new Set<string>();
                    const uniqueEmailDrafts = emailDrafts.filter(email => {
                      const key = `${email.to.email?.toLowerCase()}-${email.type}`;
                      if (seenEmails.has(key)) return false;
                      seenEmails.add(key);
                      return true;
                    });

                    const emailsByContact = uniqueEmailDrafts.reduce((acc, email) => {
                      // Use email address as key to ensure true deduplication
                      const key = email.to.email?.toLowerCase() || `${email.to.orgId}-${email.to.id}`;
                      if (!acc[key]) acc[key] = { contact: email.to, emails: {} as Record<string, EmailDraft> };
                      // Only keep first email of each type
                      if (!acc[key].emails[email.type]) {
                        acc[key].emails[email.type] = email;
                      }
                      return acc;
                    }, {} as Record<string, { contact: Contact; emails: Record<string, EmailDraft> }>);

                    const byOrg = Object.values(emailsByContact).reduce((acc, item) => {
                      const orgId = item.contact.orgId;
                      if (!acc[orgId]) acc[orgId] = { orgName: item.contact.orgName, contacts: [] };
                      acc[orgId].contacts.push(item);
                      return acc;
                    }, {} as Record<number, { orgName: string; contacts: typeof emailsByContact[string][] }>);

                    return Object.entries(byOrg).map(([orgId, orgData]) => (
                      <div key={orgId} className="border-b border-white/10">
                        {/* Organization header */}
                        <div className="bg-[#1C1C1E]/50 px-4 py-2 flex items-center gap-2">
                          <Building2 size={14} className="text-[#3B82F6]" />
                          <span className="text-white font-semibold text-sm">{orgData.orgName}</span>
                          <span className="text-[#6B7280] text-xs">({orgData.contacts.length} kontaktů)</span>
                        </div>
                        
                        {orgData.contacts.map(({ contact, emails }) => (
                          <div key={contact.email || contact.id} className="flex flex-col lg:grid lg:grid-cols-[200px_1fr_1fr_1fr] xl:grid-cols-[240px_1fr_1fr_1fr] gap-3 lg:gap-4 px-4 py-3 hover:bg-white/5 border-t border-white/5">
                            {/* Contact info */}
                            <div className="flex flex-col gap-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <User size={14} className="text-[#8B5CF6] shrink-0" />
                                <span className="text-white text-sm font-medium truncate">{contact.name}</span>
                              </div>
                              {contact.position && (
                                <span className="text-[#6B7280] text-xs ml-6">{contact.position}</span>
                              )}
                              {contact.email && (
                                <span className="text-[#3B82F6] text-xs ml-6 truncate">{contact.email}</span>
                              )}
                            </div>

                            {/* Email cells - Horizontal scroll on mobile */}
                            <div className="flex lg:contents gap-2 overflow-x-auto pb-2 lg:pb-0 -mx-4 px-4 lg:mx-0 lg:px-0">
                            {(['initial', 'followup1', 'followup2'] as const).map(type => {
                              const email = emails[type];
                              if (!email) return <div key={type} className="hidden lg:flex items-center justify-center text-[#6B7280]">—</div>;
                              
                              return (
                                <div 
                                  key={type}
                                  onClick={() => setExpandedEmail(expandedEmail === email.id ? null : email.id)}
                                  className={`shrink-0 w-[260px] lg:w-auto bg-[#1C1C1E] rounded-lg p-3 cursor-pointer border transition-all ${
                                    email.approved ? 'border-[#10B981]/50 bg-[#10B981]/5' : 'border-white/10 hover:border-white/20'
                                  }`}
                                >
                                  <div className="flex items-center justify-between gap-2 mb-1">
                                    <p className="text-white text-sm font-medium truncate flex-1">{email.subject}</p>
                                    {email.approved && <Check size={14} className="text-[#10B981] shrink-0" />}
                                  </div>
                                  <p className="text-[#9CA3AF] text-xs line-clamp-2">{email.body.substring(0, 80)}...</p>
                                  
                                  {expandedEmail === email.id && (
                                    <div className="mt-3 pt-3 border-t border-white/10">
                                      <p className="text-[#9CA3AF] text-sm whitespace-pre-wrap max-h-32 overflow-y-auto leading-relaxed">{email.body}</p>
                                      {!email.approved && (
                                        <button
                                          onClick={(e) => { e.stopPropagation(); approveEmail(email.id); }}
                                          className="mt-3 w-full flex items-center justify-center gap-2 py-2 bg-[#10B981] hover:bg-[#059669] text-white rounded-lg text-sm font-medium"
                                        >
                                          <Check size={14} /> Schválit
                                        </button>
                                      )}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                            </div>
                          </div>
                        ))}
                      </div>
                    ));
                  })()
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  // Render campaign detail
  const renderCampaignDetail = () => {
    if (!selectedCampaign) return null;
    
    const sentCount = selectedCampaign.emails.filter(e => e.sent).length;
    const approvedCount = selectedCampaign.emails.filter(e => e.approved).length;
    
    return (
      <div className="h-full flex flex-col">
        {/* Header */}
        <div className="shrink-0 p-4 border-b border-white/10 flex items-center justify-between bg-[#1C1C1E]">
          <div className="flex items-center gap-4">
            <button onClick={() => setView('list')} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
              <X size={20} className="text-[#6B7280]" />
            </button>
            <div>
              <h2 className="text-xl font-bold text-white">{selectedCampaign.name}</h2>
              <p className="text-[#6B7280] text-sm">{selectedCampaign.goal}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <span className={`text-xs px-3 py-1.5 rounded-full font-medium ${
              selectedCampaign.status === 'active' 
                ? 'bg-[#10B981]/20 text-[#10B981]' 
                : selectedCampaign.status === 'completed'
                  ? 'bg-[#6B7280]/20 text-[#6B7280]'
                  : 'bg-[#F59E0B]/20 text-[#F59E0B]'
            }`}>
              {selectedCampaign.status === 'active' ? 'Běží' : selectedCampaign.status === 'completed' ? 'Dokončena' : 'Rozpracováno'}
            </span>
            
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-2">
                <MailCheck size={16} className="text-[#10B981]" />
                <span className="text-[#10B981]">{sentCount} odesláno</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 size={16} className="text-[#F59E0B]" />
                <span className="text-[#F59E0B]">{approvedCount} schváleno</span>
              </div>
            </div>
          </div>
        </div>

        {/* Email table - same style as new campaign */}
        <div className="flex-1 flex flex-col overflow-hidden min-h-0">
          {/* Table header - Hidden on mobile */}
          <div className="shrink-0 hidden lg:grid grid-cols-[200px_minmax(150px,1fr)_minmax(150px,1fr)_minmax(150px,1fr)_100px] xl:grid-cols-[280px_minmax(200px,1fr)_minmax(200px,1fr)_minmax(200px,1fr)_100px] gap-3 px-4 py-3 bg-[#252528] border-b border-white/10 text-xs font-semibold text-[#9CA3AF] uppercase tracking-wide">
            <div className="flex items-center gap-2"><Building2 size={14} /> Škola / Kontakt</div>
            <div className="flex items-center gap-2"><Mail size={14} /> Úvodní email</div>
            <div className="flex items-center gap-2"><Clock size={14} /> Follow-up 1</div>
            <div className="flex items-center gap-2"><Clock size={14} /> Follow-up 2</div>
            <div className="text-center">Stav</div>
          </div>
          {/* Mobile header */}
          <div className="shrink-0 lg:hidden flex items-center justify-between px-4 py-3 bg-[#252528] border-b border-white/10">
            <span className="text-xs font-semibold text-[#9CA3AF] uppercase">Emaily kampaně</span>
          </div>

          {/* Table body */}
          <div className="flex-1 overflow-y-auto">
            {(() => {
              const emailsByContact = selectedCampaign.emails.reduce((acc, email) => {
                const key = email.to.email?.toLowerCase() || `${email.to.orgId}-${email.to.id}`;
                if (!acc[key]) acc[key] = { contact: email.to, emails: {} as Record<string, EmailDraft> };
                if (!acc[key].emails[email.type]) {
                  acc[key].emails[email.type] = email;
                }
                return acc;
              }, {} as Record<string, { contact: Contact; emails: Record<string, EmailDraft> }>);

              const byOrg = Object.values(emailsByContact).reduce((acc, item) => {
                const orgId = item.contact.orgId;
                if (!acc[orgId]) acc[orgId] = { orgName: item.contact.orgName, contacts: [] };
                acc[orgId].contacts.push(item);
                return acc;
              }, {} as Record<number, { orgName: string; contacts: typeof emailsByContact[string][] }>);

              return Object.entries(byOrg).map(([orgId, orgData]) => (
                <div key={orgId} className="border-b border-white/10">
                  {/* Organization header */}
                  <div className="bg-[#1C1C1E]/50 px-4 py-2 flex items-center gap-2">
                    <Building2 size={14} className="text-[#3B82F6]" />
                    <span className="text-white font-semibold text-sm">{orgData.orgName}</span>
                    <span className="text-[#6B7280] text-xs">({orgData.contacts.length} kontaktů)</span>
                  </div>
                  
                  {orgData.contacts.map(({ contact, emails }) => (
                    <div key={contact.email || contact.id} className="flex flex-col lg:grid lg:grid-cols-[200px_minmax(150px,1fr)_minmax(150px,1fr)_minmax(150px,1fr)_100px] xl:grid-cols-[280px_minmax(200px,1fr)_minmax(200px,1fr)_minmax(200px,1fr)_100px] gap-3 px-4 py-3 hover:bg-white/5 border-t border-white/5">
                      {/* Contact info */}
                      <div className="flex flex-col gap-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <User size={14} className="text-[#8B5CF6] shrink-0" />
                          <span className="text-white text-sm font-medium truncate">{contact.name}</span>
                        </div>
                        {contact.position && (
                          <span className="text-[#6B7280] text-xs ml-6">{contact.position}</span>
                        )}
                        {contact.email && (
                          <span className="text-[#3B82F6] text-xs ml-6 truncate">{contact.email}</span>
                        )}
                      </div>

                      {/* Email cells - Horizontal scroll on mobile */}
                      <div className="flex lg:contents gap-2 overflow-x-auto pb-2 lg:pb-0 -mx-4 px-4 lg:mx-0 lg:px-0">
                      {(['initial', 'followup1', 'followup2'] as const).map(type => {
                        const email = emails[type];
                        if (!email) return <div key={type} className="hidden lg:flex items-center justify-center text-[#6B7280]">—</div>;
                        
                        return (
                          <div 
                            key={type}
                            onClick={() => setExpandedDetailEmail(expandedDetailEmail === email.id ? null : email.id)}
                            className={`shrink-0 w-[260px] lg:w-auto bg-[#1C1C1E] rounded-lg p-3 cursor-pointer border transition-all ${
                              email.sent 
                                ? 'border-[#10B981]/50 bg-[#10B981]/10' 
                                : email.approved 
                                  ? 'border-[#F59E0B]/50 bg-[#F59E0B]/5' 
                                  : 'border-white/10 hover:border-white/20'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2 mb-1">
                              <p className="text-white text-sm font-medium truncate flex-1">{email.subject}</p>
                              {email.sent ? (
                                <MailCheck size={14} className="text-[#10B981] shrink-0" />
                              ) : email.approved ? (
                                <Check size={14} className="text-[#F59E0B] shrink-0" />
                              ) : null}
                            </div>
                            <p className="text-[#9CA3AF] text-xs line-clamp-2">{email.body.substring(0, 80)}...</p>
                            
                            {expandedDetailEmail === email.id && (
                              <div className="mt-3 pt-3 border-t border-white/10">
                                <p className="text-[#9CA3AF] text-sm whitespace-pre-wrap max-h-32 overflow-y-auto leading-relaxed">{email.body}</p>
                              </div>
                            )}
                          </div>
                        );
                      })}
                      </div>

                      {/* Status column */}
                      <div className="flex items-center justify-center lg:justify-center mt-2 lg:mt-0">
                        {Object.values(emails).every(e => e.sent) ? (
                          <span className="text-[#10B981] text-sm flex items-center gap-2 bg-[#10B981]/10 px-3 py-1.5 rounded-full">
                            <MailCheck size={14} /> Odesláno
                          </span>
                        ) : Object.values(emails).some(e => e.sent) ? (
                          <span className="text-[#F59E0B] text-sm flex items-center gap-2 bg-[#F59E0B]/10 px-3 py-1.5 rounded-full">
                            <Clock size={14} /> Probíhá
                          </span>
                        ) : Object.values(emails).some(e => e.approved) ? (
                          <button
                            onClick={() => {
                              const emailToSend = Object.values(emails).find(e => e.approved && !e.sent);
                              if (emailToSend) markEmailAsSent(selectedCampaign.id, emailToSend.id);
                            }}
                            className="text-sm px-4 py-2 bg-[#3B82F6] hover:bg-[#2563EB] text-white rounded-lg transition-colors font-medium"
                          >
                            Odeslat
                          </button>
                        ) : (
                          <span className="text-[#6B7280] text-sm">Čeká</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ));
            })()}
          </div>
        </div>
      </div>
    );
  };

  // Render organization detail side panel
  const renderOrgDetailPanel = () => {
    if (!selectedOrgDetail) return null;
    
    return (
      <div className="fixed inset-0 z-50 lg:relative lg:inset-auto lg:z-auto w-full lg:w-[300px] h-full bg-[#1C1C1E] lg:border-l border-white/10 flex flex-col shrink-0">
        {/* Header */}
        <div className="bg-[#10B981] p-4 flex items-start justify-between shrink-0">
          <div className="flex-1 min-w-0">
            <h2 className="text-white text-lg font-bold truncate">{selectedOrgDetail.name}</h2>
            {selectedOrgDetail.address && (
              <p className="text-white/80 text-sm truncate">{selectedOrgDetail.address}</p>
            )}
          </div>
          <button 
            onClick={() => setSelectedOrgDetail(null)}
            className="p-2 hover:bg-white/20 rounded-lg transition-colors shrink-0"
          >
            <X size={20} className="text-white" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {loadingOrgDetail ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 size={24} className="animate-spin text-[#3B82F6]" />
            </div>
          ) : orgDetailData ? (
            <>
              {/* Products */}
              {orgDetailData.organization?.products && orgDetailData.organization.products.length > 0 && (
                <div className="bg-[#252528] rounded-lg p-3">
                  <h3 className="text-white font-medium text-sm mb-2 flex items-center gap-2">
                    <CheckCircle2 size={14} className="text-[#10B981]" />
                    Produkty
                  </h3>
                  <div className="flex flex-wrap gap-1">
                    {orgDetailData.organization.products.map((p: string, i: number) => (
                      <span key={i} className="text-xs px-2 py-1 bg-[#10B981]/20 text-[#10B981] rounded-full">
                        {p}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Contacts */}
              {orgDetailData.persons && orgDetailData.persons.length > 0 && (
                <div className="bg-[#252528] rounded-lg p-3">
                  <h3 className="text-white font-medium text-sm mb-2 flex items-center gap-2">
                    <Users size={14} className="text-[#8B5CF6]" />
                    Kontakty ({orgDetailData.persons.length})
                  </h3>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {orgDetailData.persons.map((person: any) => (
                      <div key={person.id} className="flex items-start gap-2 py-1 border-b border-white/5 last:border-0">
                        <User size={14} className="text-[#8B5CF6] shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <p className="text-white text-sm truncate">{person.name}</p>
                          {person.position && (
                            <span className="text-[9px] px-1.5 py-0.5 bg-[#F59E0B]/20 text-[#F59E0B] rounded-full">
                              {person.position}
                            </span>
                          )}
                          {person.email && (
                            <p className="text-[#3B82F6] text-xs truncate">{person.email}</p>
                          )}
                          {person.phone && (
                            <p className="text-[#6B7280] text-xs">{person.phone}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Deals */}
              {orgDetailData.deals && orgDetailData.deals.length > 0 && (
                <div className="bg-[#252528] rounded-lg p-3">
                  <h3 className="text-white font-medium text-sm mb-2 flex items-center gap-2">
                    <Target size={14} className="text-[#3B82F6]" />
                    Obchody ({orgDetailData.deals.length})
                  </h3>
                  <div className="space-y-2">
                    {orgDetailData.deals.map((deal: any) => (
                      <div key={deal.id} className="flex items-center justify-between py-1 border-b border-white/5 last:border-0">
                        <span className={`text-sm ${deal.status === 'lost' ? 'text-[#6B7280] line-through' : 'text-white'}`}>
                          {deal.title}
                        </span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          deal.status === 'won' ? 'bg-[#10B981]/20 text-[#10B981]' :
                          deal.status === 'lost' ? 'bg-[#EF4444]/20 text-[#EF4444]' :
                          'bg-[#F59E0B]/20 text-[#F59E0B]'
                        }`}>
                          {deal.status === 'won' ? 'Vyhráno' : deal.status === 'lost' ? 'Prohráno' : 'Otevřeno'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Activities */}
              {orgDetailData.activities && orgDetailData.activities.length > 0 && (
                <div className="bg-[#252528] rounded-lg p-3">
                  <h3 className="text-white font-medium text-sm mb-2 flex items-center gap-2">
                    <Calendar size={14} className="text-[#F59E0B]" />
                    Aktivity ({orgDetailData.activities.length})
                  </h3>
                  <div className="space-y-2 max-h-32 overflow-y-auto">
                    {orgDetailData.activities.slice(0, 5).map((activity: any) => (
                      <div key={activity.id} className="flex items-center gap-2 py-1 border-b border-white/5 last:border-0">
                        <span className={`w-2 h-2 rounded-full shrink-0 ${activity.done ? 'bg-[#10B981]' : 'bg-[#F59E0B]'}`} />
                        <span className="text-[#9CA3AF] text-xs truncate">{activity.subject || activity.type}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="text-center text-[#6B7280] py-8">
              Žádná data z Pipedrive
            </div>
          )}
        </div>

        {/* Footer - select button */}
        <div className="shrink-0 p-4 border-t border-white/10">
          <button
            onClick={() => {
              toggleOrgSelection(selectedOrgDetail);
              setSelectedOrgDetail(null);
            }}
            className={`w-full flex items-center justify-center gap-2 py-3 rounded-lg font-medium transition-colors ${
              selectedOrgs.some(o => o.id === selectedOrgDetail.id)
                ? 'bg-[#EF4444] hover:bg-[#DC2626] text-white'
                : 'bg-[#3B82F6] hover:bg-[#2563EB] text-white'
            }`}
          >
            {selectedOrgs.some(o => o.id === selectedOrgDetail.id) ? (
              <>
                <X size={16} />
                Odebrat z výběru
              </>
            ) : (
              <>
                <Check size={16} />
                Přidat do výběru
              </>
            )}
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="h-full bg-black flex flex-col lg:flex-row relative">
      <div className={`flex-1 min-w-0 overflow-hidden ${selectedOrgDetail ? '' : ''}`}>
        {view === 'list' && renderCampaignList()}
        {view === 'new' && renderNewCampaign()}
        {view === 'detail' && renderCampaignDetail()}
      </div>
      {renderOrgDetailPanel()}
    </div>
  );
};
