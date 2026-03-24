import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Loader2, Building2, Mail, Phone, MapPin, Trash2, Mic, Navigation, CheckCircle2, Circle, AlertCircle, Volume2, VolumeX, ExternalLink, X, Hash, DollarSign, ChevronRight, Briefcase, BookOpen, Plus, FileText } from 'lucide-react';
import { SchoolDetailPanel } from '../ui/SchoolDetailPanel';
import { toast } from 'sonner';
import { useApp } from '@/app/contexts/AppContext';
import clsx from 'clsx';
import { motion, AnimatePresence } from 'motion/react';
import { projectId, publicAnonKey } from '/utils/supabase/info';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  crmData?: CrmResult | null;
  routeData?: RouteResult | null;
  isLoading?: boolean;
  loadingSteps?: AgentStep[];
  voiceSummary?: string;
}

interface CrmResult {
  organizations: any[];
  persons: any[];
  deals: any[];
}

interface RouteResult {
  route: { origin: string; destination: string; distance: number; duration: number; googleMapsUrl?: string };
  locations: string[];
  priorityStops?: string[];
  voiceSummary?: string;
  crm: { organizations: any[]; persons: any[]; deals: any[]; priorityOrgs: any[]; locationMatches: any };
  recommendation: string;
  steps: AgentStep[];
}

interface AgentStep {
  agent: string;
  status: 'running' | 'done' | 'error';
  message: string;
  data?: any;
}

interface AgentTabProps {
  initialMessage?: string;
}

export const AgentTab: React.FC<AgentTabProps> = ({ initialMessage }) => {
  const { smartEdit, transcribeAudio, addTask } = useApp();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [autoSpeak, setAutoSpeak] = useState(true); // Auto-speak route summaries
  const [lastRouteData, setLastRouteData] = useState<RouteResult | null>(null); // Remember last route for follow-ups
  const [selectedOrg, setSelectedOrg] = useState<any | null>(null); // Selected org for detail modal
  const [loadingOrgDetail, setLoadingOrgDetail] = useState(false);
  const [orgDetail, setOrgDetail] = useState<any | null>(null);
  const [showRagModal, setShowRagModal] = useState(false);
  const [ragDocuments, setRagDocuments] = useState<any[]>([]);
  const [loadingRag, setLoadingRag] = useState(false);
  const [newRagTitle, setNewRagTitle] = useState('');
  const [newRagContent, setNewRagContent] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const speechSynthRef = useRef<SpeechSynthesisUtterance | null>(null);

  // RAG functions
  const fetchRagDocuments = async () => {
    setLoadingRag(true);
    try {
      const response = await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-954b19ad/rag/documents`);
      if (response.ok) {
        const docs = await response.json();
        setRagDocuments(docs);
      }
    } catch (error) {
      console.error("Error fetching RAG docs:", error);
    } finally {
      setLoadingRag(false);
    }
  };

  const saveRagDocument = async () => {
    if (!newRagTitle.trim() || !newRagContent.trim()) {
      toast.error("Vyplňte název i obsah");
      return;
    }

    try {
      const response = await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-954b19ad/rag/documents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newRagTitle, content: newRagContent })
      });

      if (response.ok) {
        toast.success("📚 Uloženo do znalostní knihovny");
        setNewRagTitle('');
        setNewRagContent('');
        fetchRagDocuments();
      } else {
        toast.error("Nepodařilo se uložit");
      }
    } catch (error) {
      console.error("Error saving RAG doc:", error);
      toast.error("Chyba při ukládání");
    }
  };

  const deleteRagDocument = async (id: string) => {
    try {
      const response = await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-954b19ad/rag/documents/${id}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        toast.success("Dokument smazán");
        fetchRagDocuments();
      }
    } catch (error) {
      console.error("Error deleting RAG doc:", error);
    }
  };

  const reindexRag = async () => {
    setLoadingRag(true);
    toast.loading("AI analyzuje knihovnu...");
    try {
      const response = await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-954b19ad/rag/reindex`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      if (response.ok) {
        const data = await response.json();
        toast.dismiss();
        toast.success(`📚 Indexováno ${data.indexed} dokumentů`);
        if (data.summary) {
          toast.info(data.summary, { duration: 5000 });
        }
        fetchRagDocuments();
      } else {
        toast.dismiss();
        toast.error("Nepodařilo se indexovat");
      }
    } catch (error) {
      console.error("Error reindexing RAG:", error);
      toast.dismiss();
      toast.error("Chyba při indexování");
    } finally {
      setLoadingRag(false);
    }
  };

  // Fetch detailed org info from Pipedrive
  const fetchOrgDetail = async (org: any) => {
    console.log("Fetching org detail for:", org);
    
    if (!org.id) {
      toast.error("Organizace nemá ID");
      return;
    }
    
    setSelectedOrg(org);
    setLoadingOrgDetail(true);
    setOrgDetail(null);

    try {
      const response = await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-954b19ad/crm/org-detail`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orgId: org.id })
      });

      if (response.ok) {
        const data = await response.json();
        console.log("Org detail received:", data);
        setOrgDetail(data);
      } else {
        const errText = await response.text();
        console.error("Org detail error:", errText);
        toast.error("Nepodařilo se načíst detail organizace");
      }
    } catch (error) {
      console.error("Error fetching org detail:", error);
      toast.error("Chyba při načítání detailu");
    } finally {
      setLoadingOrgDetail(false);
    }
  };

  // Text-to-Speech function
  const speak = (text: string) => {
    if (!('speechSynthesis' in window)) {
      toast.error("Váš prohlížeč nepodporuje hlasový výstup");
      return;
    }

    // Stop any current speech
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'cs-CZ';
    utterance.rate = 1.1; // Slightly faster
    utterance.pitch = 1;
    
    // Try to find Czech voice
    const voices = window.speechSynthesis.getVoices();
    const czechVoice = voices.find(v => v.lang.includes('cs')) || voices.find(v => v.lang.includes('sk'));
    if (czechVoice) utterance.voice = czechVoice;

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    speechSynthRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  };

  const stopSpeaking = () => {
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
  };

  useEffect(() => {
    if (initialMessage) {
      sendMessage(initialMessage);
    }
  }, [initialMessage]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Load voices on mount (needed for some browsers)
  useEffect(() => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.getVoices();
    }
  }, []);

  // Detect if message is a route planning request
  const isRouteRequest = (text: string): { isRoute: boolean; origin?: string; destination?: string } => {
    const lower = text.toLowerCase();
    const routeKeywords = ['jedu', 'cesta', 'trasa', 'po cestě', 'na cestě', 'cestou', 'pojedu', 'jet'];
    const hasRouteKeyword = routeKeywords.some(k => lower.includes(k));
    
    if (!hasRouteKeyword) return { isRoute: false };

    // Try to extract origin and destination
    // Pattern: "jedu z X do Y", "cesta X - Y", "Praha - Sedlčany"
    const patterns = [
      /(?:jedu|pojedu|cesta|trasa)\s+(?:z\s+)?(.+?)\s+(?:do|->|–|-)\s+(.+?)(?:\s*[,.]|$)/i,
      /(.+?)\s*(?:->|–|-)\s*(.+?)(?:\s+|,|$)/i,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        return { isRoute: true, origin: match[1].trim(), destination: match[2].trim() };
      }
    }

    // Default: try Praha as origin if just destination mentioned
    const destMatch = lower.match(/(?:jedu|pojedu)\s+do\s+(.+?)(?:\s*[,.]|$)/i);
    if (destMatch) {
      return { isRoute: true, origin: 'Praha', destination: destMatch[1].trim() };
    }

    return { isRoute: hasRouteKeyword };
  };

  // Detect follow-up questions about specific locations or general route context
  // NOTE: Do NOT include 'naplánuj' here - it conflicts with calendar requests!
  const isLocationFollowUp = (text: string): boolean => {
    const lower = text.toLowerCase();
    const followUpKeywords = [
      'stavit', 'zastavit', 'zastávka', 'kontakt', 'číslo', 'telefon', 'email',
      'ředitel', 'učitel', 'naviguj', 'dej mi číslo', 'dej mi kontakt', 'chci se stavit',
      'jsou tam', 'telefonní', 'mobil', 'volat', 'zavolat', 'info o'
    ];
    // Exclude if it's clearly a calendar request
    if (lower.includes('schůzku') || lower.includes('schuzku') || lower.includes('meeting')) {
      return false;
    }
    return followUpKeywords.some(k => lower.includes(k));
  };

  // Check if it's a generic follow-up without specific location (like "jsou tam nějaké čísla?")
  const isGenericFollowUp = (text: string): boolean => {
    const lower = text.toLowerCase();
    const genericPatterns = ['jsou tam', 'jaké', 'nějaké', 'máš', 'dej', 'ukaž'];
    const hasGeneric = genericPatterns.some(p => lower.includes(p));
    
    // Check if NO specific location from route is mentioned
    if (lastRouteData?.locations) {
      for (const loc of lastRouteData.locations) {
        if (lower.includes(loc.toLowerCase())) {
          return false; // Specific location mentioned, not generic
        }
      }
    }
    return hasGeneric;
  };

  // Extract location name from follow-up message
  const extractLocationName = (text: string): string => {
    const lower = text.toLowerCase();
    
    // Check if any location from lastRouteData is mentioned
    if (lastRouteData?.locations) {
      for (const loc of lastRouteData.locations) {
        if (lower.includes(loc.toLowerCase())) {
          return loc;
        }
      }
    }
    
    // Try patterns like "v Jesenici", "do Jesenice" - but exclude generic words
    const genericWords = ['nějaké', 'jaké', 'tam', 'máš', 'dej'];
    const patterns = [
      /(?:v|do|na)\s+([A-ZÁ-Ž][a-záéíóúýčďěňřšťžů]+(?:\s+\d+)?)/i,
      /([A-ZÁ-Ž][a-záéíóúýčďěňřšťžů]+)\s+(?:kontakt|číslo|telefon)/i,
    ];
    
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match && !genericWords.includes(match[1].toLowerCase())) {
        return match[1];
      }
    }
    
    // Fallback: return first priority stop from route
    return lastRouteData?.priorityStops?.[0] || lastRouteData?.locations?.[0] || 'celá trasa';
  };

  // Detect task creation requests
  const isTaskRequest = (text: string): boolean => {
    const lower = text.toLowerCase();
    // Match various forms: "vytvoř úkol", "vytvořme úkol", "vytvoř mi úkol", etc.
    const taskPatterns = [
      /vytvoř(?:me|it|te)?\s+(?:mi\s+)?úkol/,
      /přidej(?:me|te)?\s+(?:mi\s+)?úkol/,
      /udělej(?:me|te)?\s+(?:mi\s+)?úkol/,
      /nový úkol/,
      /zapiš(?:me|te)?\s+(?:mi\s+)?úkol/,
      /připomeň(?:te)?\s+mi/,
      /úkol\s*:/,
      /task\s*:/i
    ];
    return taskPatterns.some(p => p.test(lower));
  };

  // Detect calendar/meeting requests
  const isCalendarRequest = (text: string): boolean => {
    const lower = text.toLowerCase();
    const calendarKeywords = [
      'naplánuj schůzku', 'přidej schůzku', 'naplánuj meeting', 'přidej do kalendáře',
      'schůzka v', 'schůzku na', 'schůzku v', // schůzku v pondělí
      'naplánuj mi schůzku', 'naplanuj schuzku', 'naplanuj mi schuzku', // bez diakritiky
      'meeting na', 'meeting v'
    ];
    // Also check for pattern: "naplánuj" + "schůzku" anywhere in text
    const hasScheduleWord = lower.includes('naplánuj') || lower.includes('naplanuj') || lower.includes('přidej') || lower.includes('pridej');
    const hasMeetingWord = lower.includes('schůzku') || lower.includes('schuzku') || lower.includes('meeting') || lower.includes('schůzka');
    
    return calendarKeywords.some(k => lower.includes(k)) || (hasScheduleWord && hasMeetingWord);
  };

  // Detect CRM search requests (access codes, info, contacts)
  const isCrmSearchRequest = (text: string): boolean => {
    const lower = text.toLowerCase();
    const crmKeywords = [
      'přístupové kódy', 'přístupový kód', 'kódy pro', 
      'pristupove kody', 'pristupovy kod', 'kody pro', // bez diakritiky
      'vypiš', 'vypis', // výpis příkazů
      'info o', 'informace o', 
      'kontakt na', 'číslo na', 'cislo na', 'email na',
      'škola', 'škole', 'školy', 'skola', 'skole', 'skoly', 'zš', 'zs',
      'organizace', 'organizaci', 'firma', 'firmy', 'firmu',
      'zákazník', 'zákazníci', 'zakaznik', 'zakaznici',
      'deal', 'dealy', 'obchod', 'obchody',
      'kolem', 'okolí', 'v okolí', 'blízko', 'poblíž',
      'aktivní', 'aktivni', 'vyhrané', 'vyhrane',
      'jaké', 'jake', 'které', 'ktere', 'kdo', 'kde'
    ];
    return crmKeywords.some(k => lower.includes(k));
  };

  // Extract task text from message
  const extractTaskText = (text: string): string => {
    // Remove the command part and keep the task
    const patterns = [
      /(?:vytvoř(?:me|it|te)?|přidej(?:me|te)?|udělej(?:me|te)?|zapiš(?:me|te)?|nový)\s*(?:mi\s+)?úkol[,:\s]+(.+)/i,
      /úkol[,:\s]+(.+)/i,
      /připomeň(?:te)?\s*mi[,:\s]+(.+)/i,
      /ať\s+(.+)/i, // "vytvoř mi úkol, ať pošlu Dagmar věci" -> "pošlu Dagmar věci"
    ];
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        let taskText = match[1].trim();
        // Clean up leading punctuation and whitespace
        taskText = taskText.replace(/^[,:\s]+/, '');
        if (taskText.length > 0) return taskText;
      }
    }
    // Fallback: return original text without common command words
    return text.replace(/^(vytvoř(?:me|it|te)?|přidej(?:me|te)?|udělej(?:me|te)?|zapiš(?:me|te)?|nový)\s*(?:mi\s+)?úkol[,:\s]*/i, '').trim();
  };

  // Extract calendar event details from message
  const extractCalendarDetails = (text: string): { title: string; when: string; location?: string } => {
    const lower = text.toLowerCase();
    
    // Days of week to exclude from location matching
    const daysOfWeek = ['pondělí', 'úterý', 'středa', 'střed', 'čtvrtek', 'pátek', 'sobota', 'sobotu', 'neděle', 'neděli', 'zítra', 'pozítří', 'dnes'];
    
    // Try to extract day/time
    let when = '';
    const dayMatch = lower.match(/(?:na|v)\s+(pondělí|úterý|střed[ua]|čtvrtek|pátek|sobotu|neděli|zítra|pozítří|dnes)/i);
    if (dayMatch) when = dayMatch[1];
    
    const timeMatch = lower.match(/(?:v|na|od)\s+(\d{1,2}(?::\d{2})?(?:\s*h(?:od)?)?)/i);
    if (timeMatch) when += (when ? ' v ' : '') + timeMatch[1];
    
    // Try to extract location - exclude days of week!
    let location = '';
    // Look for patterns like "v Sedlčanech", "do Sedlčan", "na ZŠ X"
    const locationPatterns = [
      /(?:v|do)\s+([A-ZÁ-Ž][a-záéíóúýčďěňřšťžů]+(?:ech|ích|ách|any?)?)/gi,
      /na\s+(?:základní\s+)?škole?\s+(?:v\s+)?([A-ZÁ-Ž][a-záéíóúýčďěňřšťžů]+)/i,
      /(?:ZŠ|škola)\s+([A-ZÁ-Ž][a-záéíóúýčďěňřšťžů]+)/i
    ];
    
    for (const pattern of locationPatterns) {
      const matches = text.matchAll(pattern);
      for (const match of matches) {
        const loc = match[1];
        // Skip if it's a day of week
        if (!daysOfWeek.some(d => loc.toLowerCase().includes(d))) {
          location = loc;
          break;
        }
      }
      if (location) break;
    }
    
    // Title is the whole thing simplified
    const title = `Schůzka${location ? ' v ' + location : ''}`;
    
    return { title, when: when || 'dnes', location };
  };

  // Extract school/org name from CRM query
  const extractCrmQuery = (text: string): string => {
    const patterns = [
      /(?:kódy|kód|info|informace|kontakt|číslo|email)\s+(?:pro|o|na)\s+(.+)/i,
      /(?:škol[aey]?|zš|mš)\s+(.+)/i,
    ];
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) return match[1].trim();
    }
    return text;
  };

  const sendMessage = async (text?: string) => {
    const messageText = text || input.trim();
    if (!messageText || isProcessing) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: messageText,
      timestamp: new Date()
    };

    const loadingMessage: Message = {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      isLoading: true
    };

    setMessages(prev => [...prev, userMessage, loadingMessage]);
    setInput('');
    setIsProcessing(true);

    try {
      // ========== UNIFIED ORCHESTRATOR ==========
      // Send everything to backend AI orchestrator which decides what to do
      const googleAccessToken = localStorage.getItem('google_provider_token');
      
      const response = await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-954b19ad/agent/orchestrate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          message: messageText,
          conversationHistory: messages.slice(-5).map(m => ({ role: m.role, content: m.content })),
          googleAccessToken,
          lastRouteData: lastRouteData ? {
            origin: lastRouteData.route?.origin,
            destination: lastRouteData.route?.destination,
            locations: lastRouteData.locations
          } : null
        })
      });

      if (!response.ok) {
        throw new Error(`Orchestrator failed: ${response.status}`);
      }

      const data = await response.json();

      // Handle clarification request
      if (data.needsClarification) {
        const assistantMessage: Message = {
          id: (Date.now() + 2).toString(),
          role: 'assistant',
          content: data.clarificationQuestion || 'Můžete mi upřesnit, co přesně potřebujete?',
          timestamp: new Date()
        };
        setMessages(prev => prev.filter(m => !m.isLoading).concat(assistantMessage));
        if (autoSpeak && data.clarificationQuestion) speak(data.clarificationQuestion);
        return;
      }

      // Handle different action results
      const assistantMessage: Message = {
        id: (Date.now() + 2).toString(),
        role: 'assistant',
        content: data.response || data.summary || 'Hotovo!',
        timestamp: new Date(),
        crmData: data.crmData || null,
        routeData: data.routeData || null,
        voiceSummary: data.voiceSummary
      };

      setMessages(prev => prev.filter(m => !m.isLoading).concat(assistantMessage));

      // Save route data for follow-ups
      if (data.routeData) {
        setLastRouteData(data.routeData);
      }

      // Show action-specific toasts
      if (data.action === 'task_created') {
        addTask(data.taskText);
        toast.success("✅ Úkol přidán");
      } else if (data.action === 'calendar_created') {
        toast.success("📅 Schůzka přidána do kalendáře");
      } else if (data.action === 'crm_search') {
        toast.success(`🏢 Nalezeno ${data.crmData?.deals?.length || data.crmData?.organizations?.length || 0} výsledků`);
      } else if (data.action === 'route_planned') {
        toast.success(`🗺️ Trasa naplánována!`);
      } else if (data.action === 'analyze_potential') {
        toast.success(`📊 Analýza potenciálu dokončena`);
      } else if (data.action === 'save_to_rag') {
        toast.success(`📚 Uloženo do znalostní knihovny`);
      } else if (data.action === 'compose_with_rag') {
        toast.success(`📧 Text vygenerován z knihovny`);
      }

      // Voice output
      if (autoSpeak && data.voiceSummary) {
        setTimeout(() => speak(data.voiceSummary), 500);
      }

    } catch (error) {
      console.error("Agent error:", error);
      const errorMessage: Message = {
        id: (Date.now() + 2).toString(),
        role: 'assistant',
        content: 'Omlouvám se, došlo k chybě při zpracování.',
        timestamp: new Date()
      };
      setMessages(prev => prev.filter(m => !m.isLoading).concat(errorMessage));
      toast.error("Chyba při komunikaci s agentem");
    } finally {
      setIsProcessing(false);
    }
  };

  // Voice recording
  const startRecording = async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      toast.error("Váš prohlížeč nepodporuje nahrávání zvuku.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach(track => track.stop());
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        
        setIsTranscribing(true);
        try {
          const transcribedText = await transcribeAudio(audioBlob);
          if (transcribedText.trim()) {
            sendMessage(transcribedText);
          }
        } catch (err: any) {
          console.error("Transcription error:", err);
          toast.error("Chyba při přepisu zvuku");
        } finally {
          setIsTranscribing(false);
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err: any) {
      if (err.name === 'NotAllowedError') {
        toast.error("Přístup k mikrofonu byl zamítnut.");
      } else {
        toast.error("Chyba mikrofonu");
      }
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleRecordToggle = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const clearChat = () => {
    setMessages([]);
    toast.success("Chat vymazán");
  };

  // Render route planner results
  const renderRouteData = (data: RouteResult, voiceSummary?: string) => {
    // Deduplicate deals by organization
    const orgMap = new Map<string, { org: any, wonCount: number, openCount: number, location: string }>();
    
    for (const deal of (data.crm?.deals || [])) {
      const orgId = deal.organization?.id || deal.org_id || 'unknown';
      const orgName = deal.organization?.name || deal.org_name || 'Neznámá organizace';
      
      if (!orgMap.has(orgId)) {
        orgMap.set(orgId, {
          org: { id: orgId, name: orgName, address: deal.organization?.address },
          wonCount: 0,
          openCount: 0,
          location: deal.matchedLocation || ''
        });
      }
      
      const entry = orgMap.get(orgId)!;
      if (deal.status === 'won') entry.wonCount++;
      if (deal.status === 'open') entry.openCount++;
    }
    
    // Convert to arrays and sort
    const allOrgs = Array.from(orgMap.values());
    const wonOrgs = allOrgs.filter(o => o.wonCount > 0).sort((a, b) => b.wonCount - a.wonCount);
    const openOrgs = allOrgs.filter(o => o.wonCount === 0 && o.openCount > 0);

    return (
      <div className="mt-4 space-y-4">
        {/* Route Info + Actions */}
        <div className="bg-gradient-to-r from-blue-500/20 to-purple-500/20 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Navigation size={18} className="text-blue-400" />
              <span className="font-semibold text-white">
                {data.route?.origin} → {data.route?.destination}
              </span>
            </div>
            {/* Voice Button */}
            {(voiceSummary || data.voiceSummary) && (
              <button
                onClick={() => isSpeaking ? stopSpeaking() : speak(voiceSummary || data.voiceSummary || '')}
                className={clsx(
                  "p-2 rounded-lg transition-colors",
                  isSpeaking ? "bg-red-500/20 text-red-400" : "bg-white/10 text-white hover:bg-white/20"
                )}
                title={isSpeaking ? "Zastavit" : "Přečíst nahlas"}
              >
                {isSpeaking ? <VolumeX size={16} /> : <Volume2 size={16} />}
              </button>
            )}
          </div>
          
          <div className="flex flex-wrap gap-4 text-sm text-[#8E8E93] mb-3">
            <span>📏 {data.route?.distance} km</span>
            <span>⏱️ ~{data.route?.duration} min</span>
            <span>📍 {data.locations?.length} měst</span>
          </div>

          {/* Google Maps Link */}
          {data.route?.googleMapsUrl && (
            <a
              href={data.route.googleMapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm font-medium transition-colors"
            >
              <ExternalLink size={14} />
              Otevřít v Google Maps
            </a>
          )}

          {/* Priority Stops */}
          {data.priorityStops && data.priorityStops.length > 0 && (
            <div className="mt-3 pt-3 border-t border-white/10">
              <p className="text-xs text-[#8E8E93] mb-2">Doporučené zastávky:</p>
              <div className="flex flex-wrap gap-2">
                {data.priorityStops.map((stop, i) => (
                  <span key={i} className="px-2 py-1 bg-green-500/20 text-green-400 rounded-full text-xs font-medium">
                    {i + 1}. {stop}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Agent Steps */}
        <div className="bg-black/30 rounded-xl p-4">
          <p className="text-xs font-semibold text-[#8E8E93] uppercase mb-3">Průběh agentů</p>
          <div className="space-y-2">
            {data.steps?.map((step, i) => (
              <div key={i} className="flex items-center gap-2 text-sm">
                {step.status === 'done' ? (
                  <CheckCircle2 size={14} className="text-green-400" />
                ) : step.status === 'error' ? (
                  <AlertCircle size={14} className="text-red-400" />
                ) : (
                  <Circle size={14} className="text-blue-400 animate-pulse" />
                )}
                <span className="text-[#8E8E93]">{step.agent}:</span>
                <span className="text-white">{step.message}</span>
              </div>
            ))}
          </div>
        </div>

        {/* WON Orgs - Deduplicated */}
        {wonOrgs.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-green-400 uppercase mb-2 flex items-center gap-1">
              ✅ Aktivní zákazníci ({wonOrgs.length} unikátních)
            </p>
            <div className="space-y-2">
              {wonOrgs.slice(0, 8).map((entry: any, i: number) => (
                <div 
                  key={entry.org?.id || i} 
                  role="button"
                  tabIndex={0}
                  className="bg-green-500/10 border border-green-500/20 rounded-lg p-3 text-xs cursor-pointer hover:bg-green-500/20 transition-colors active:scale-[0.98]"
                  onClick={(e) => { e.stopPropagation(); fetchOrgDetail(entry.org); }}
                  onKeyDown={(e) => { if (e.key === 'Enter') fetchOrgDetail(entry.org); }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <p className="font-semibold text-white flex items-center gap-1">
                        <Building2 size={12} /> {entry.org.name}
                      </p>
                      {entry.location && (
                        <p className="text-[#8E8E93] flex items-center gap-1 mt-1">
                          <MapPin size={10} /> {entry.location}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="shrink-0 px-2 py-0.5 rounded bg-green-500/30 text-green-400 text-[10px] font-bold">
                        VYHRÁNO
                      </span>
                      <ChevronRight size={14} className="text-green-400/50" />
                    </div>
                  </div>
                  <p className="text-green-400/80 mt-2 text-[10px]">
                    📊 {entry.wonCount} vyhraných dealů {entry.openCount > 0 && `| ${entry.openCount} otevřených`}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Open Orgs - Deduplicated */}
        {openOrgs.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-blue-400 uppercase mb-2 flex items-center gap-1">
              🔵 Otevřené příležitosti ({openOrgs.length} unikátních)
            </p>
            <div className="space-y-2">
              {openOrgs.slice(0, 5).map((entry: any, i: number) => (
                <div 
                  key={entry.org?.id || i} 
                  role="button"
                  tabIndex={0}
                  className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 text-xs cursor-pointer hover:bg-blue-500/20 transition-colors active:scale-[0.98]"
                  onClick={(e) => { e.stopPropagation(); fetchOrgDetail(entry.org); }}
                  onKeyDown={(e) => { if (e.key === 'Enter') fetchOrgDetail(entry.org); }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <p className="font-semibold text-white flex items-center gap-1">
                        <Building2 size={10} /> {entry.org.name}
                      </p>
                      {entry.location && (
                        <p className="text-[#8E8E93] flex items-center gap-1 mt-1">
                          <MapPin size={10} /> {entry.location}
                        </p>
                      )}
                    </div>
                    <ChevronRight size={14} className="text-blue-400/50" />
                  </div>
                  <p className="text-blue-400/80 mt-1 text-[10px]">
                    📊 {entry.openCount} otevřených dealů
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Locations with matches */}
        {data.crm?.locationMatches && Object.keys(data.crm.locationMatches).length > 0 && (
          <div>
            <p className="text-xs font-semibold text-[#8E8E93] uppercase mb-2">
              📍 Města s kontakty
            </p>
            <div className="flex flex-wrap gap-2">
              {Object.keys(data.crm.locationMatches).map((loc, i) => (
                <span key={i} className="px-2 py-1 bg-[#2C2C2E] rounded-full text-xs text-white">
                  {loc}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  // Render CRM data - Organizations first, deduplicated
  const renderCrmData = (data: CrmResult) => {
    // Separate active customers (with won deals) from others
    const activeOrgs = data.organizations?.filter((o: any) => o.wonDeals > 0) || [];
    const otherOrgs = data.organizations?.filter((o: any) => !o.wonDeals || o.wonDeals === 0) || [];

    return (
      <div className="mt-4 space-y-3">
        {/* Active Customers (orgs with won deals) */}
        {activeOrgs.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-green-400 uppercase mb-2 flex items-center gap-1">
              ✅ AKTIVNÍ ZÁKAZNÍCI ({activeOrgs.length})
            </p>
            <div className="space-y-2">
              {activeOrgs.slice(0, 8).map((org: any, i: number) => (
                <div 
                  key={org.id || i} 
                  role="button"
                  tabIndex={0}
                  className="bg-green-900/20 border border-green-500/30 rounded-lg p-3 text-xs cursor-pointer hover:bg-green-900/40 transition-colors active:scale-[0.98]"
                  onClick={(e) => { e.stopPropagation(); fetchOrgDetail(org); }}
                  onKeyDown={(e) => { if (e.key === 'Enter') fetchOrgDetail(org); }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <p className="font-semibold text-white flex items-center gap-1">
                        <Building2 size={12} /> {org.name}
                      </p>
                      {org.address && (
                        <p className="text-[#8E8E93] mt-1 flex items-center gap-1">
                          <MapPin size={10} /> {org.address}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="shrink-0 px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-green-500/30 text-green-400">
                        VYHRÁNO
                      </span>
                      <ChevronRight size={14} className="text-green-400/50" />
                    </div>
                  </div>
                  {(org.dealCount || org.wonDeals) && (
                    <p className="text-green-400/80 mt-2 text-[10px]">
                      📊 {org.wonDeals || 0} vyhraných dealů {org.openDeals > 0 && `| ${org.openDeals} otevřených`}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Other Organizations (open deals) */}
        {otherOrgs.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-[#8E8E93] uppercase mb-2">
              🔵 OTEVŘENÉ PŘÍLEŽITOSTI ({otherOrgs.length})
            </p>
            <div className="space-y-2">
              {otherOrgs.slice(0, 5).map((org: any, i: number) => (
                <div 
                  key={org.id || i} 
                  role="button"
                  tabIndex={0}
                  className="bg-black/30 rounded-lg p-3 text-xs cursor-pointer hover:bg-black/50 transition-colors active:scale-[0.98]"
                  onClick={(e) => { e.stopPropagation(); fetchOrgDetail(org); }}
                  onKeyDown={(e) => { if (e.key === 'Enter') fetchOrgDetail(org); }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <p className="font-semibold text-white flex items-center gap-1">
                        <Building2 size={10} /> {org.name}
                      </p>
                      {org.address && (
                        <p className="text-[#8E8E93] mt-1 flex items-center gap-1">
                          <MapPin size={10} /> {org.address}
                        </p>
                      )}
                    </div>
                    <ChevronRight size={14} className="text-[#8E8E93]/50" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Persons */}
        {data.persons?.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-[#8E8E93] uppercase mb-2">
              👤 Kontakty ({data.persons.length})
            </p>
            <div className="space-y-2">
              {data.persons.slice(0, 5).map((person: any, i: number) => (
                <div key={i} className="bg-black/30 rounded-lg p-3 text-xs">
                  <p className="font-semibold text-white flex items-center gap-1">
                    <User size={10} /> {person.name}
                  </p>
                  {/* Position, subjects, stupen tags */}
                  {(person.position || person.subjects?.length > 0 || person.stupen) && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {person.position && (
                        <span className="text-[9px] px-1.5 py-0.5 bg-[#8B5CF6]/20 text-[#8B5CF6] rounded-full font-medium">
                          {person.position}
                        </span>
                      )}
                      {person.subjects?.map((subj: string, j: number) => (
                        <span key={j} className="text-[9px] px-1.5 py-0.5 bg-[#3B82F6]/20 text-[#3B82F6] rounded-full">
                          {subj}
                        </span>
                      ))}
                      {person.stupen && (
                        <span className="text-[9px] px-1.5 py-0.5 bg-[#10B981]/20 text-[#10B981] rounded-full">
                          {person.stupen}
                        </span>
                      )}
                    </div>
                  )}
                  {person.primary_email && (
                    <a href={`mailto:${person.primary_email}`} className="text-[#0A84FF] flex items-center gap-1 mt-1 hover:underline">
                      <Mail size={10} /> {person.primary_email}
                    </a>
                  )}
                  {person.phones?.[0]?.value && (
                    <a href={`tel:${person.phones[0].value}`} className="text-[#0A84FF] flex items-center gap-1 mt-1 hover:underline">
                      <Phone size={10} /> {person.phones[0].value}
                    </a>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Legacy: Show deals only if no organizations */}
        {data.deals?.length > 0 && (!data.organizations || data.organizations.length === 0) && (
          <div>
            <p className="text-xs font-semibold text-[#8E8E93] uppercase mb-2">
              Dealy ({data.deals.length})
            </p>
            <div className="space-y-2">
              {data.deals.slice(0, 5).map((deal: any, i: number) => (
                <div key={i} className="bg-black/30 rounded-lg p-3 text-xs">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold text-white flex-1">{deal.title}</p>
                    <span className={clsx(
                      "shrink-0 px-2 py-0.5 rounded text-[10px] font-bold uppercase",
                      deal.status === 'won' && "bg-green-500/30 text-green-400",
                      deal.status === 'lost' && "bg-red-500/20 text-red-400",
                      deal.status === 'open' && "bg-blue-500/20 text-blue-400"
                    )}>
                      {deal.status === 'won' ? 'Vyhráno' : deal.status === 'lost' ? 'Prohráno' : 'Otevřeno'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Legacy: Additional organizations without deal stats */}
        {data.organizations?.length > 0 && !activeOrgs.length && !otherOrgs.length && (
          <div>
            <p className="text-xs font-semibold text-[#8E8E93] uppercase mb-2">
              Organizace ({data.organizations.length})
            </p>
            <div className="space-y-2">
              {data.organizations.slice(0, 3).map((org: any, i: number) => (
                <div key={i} className="bg-black/30 rounded-lg p-3 text-xs">
                  <p className="font-semibold text-white flex items-center gap-1">
                    <Building2 size={10} /> {org.name}
                  </p>
                  {org.address && (
                    <p className="text-[#8E8E93] flex items-center gap-1 mt-1">
                      <MapPin size={10} /> {org.address}
                    </p>
                  )}
                  {/* Access Codes */}
                  {org.teacherCode && (
                    <div className="mt-2 bg-green-500/20 rounded-lg p-2">
                      <p className="text-green-400 font-medium flex items-center gap-1">
                        👨‍🏫 Teacher Code: <code className="bg-black/30 px-2 py-0.5 rounded font-mono">{org.teacherCode}</code>
                      </p>
                    </div>
                  )}
                  {org.studentCode && (
                    <div className="mt-1 bg-blue-500/20 rounded-lg p-2">
                      <p className="text-blue-400 font-medium flex items-center gap-1">
                        👨‍🎓 Student Code: <code className="bg-black/30 px-2 py-0.5 rounded font-mono">{org.studentCode}</code>
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col lg:flex-row h-full bg-black overflow-hidden relative">
      {/* Main Chat Area */}
      <div className={`flex flex-col h-full flex-1 ${selectedOrg ? 'lg:min-w-0' : 'w-full lg:max-w-4xl lg:mx-auto'}`}>
      {/* Header */}
      <div className="shrink-0 flex items-center justify-between px-6 py-4 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
            <Bot size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-white font-semibold">Obchodník pomocník</h1>
            <p className="text-[#8E8E93] text-xs">CRM, Gmail, Route Planner</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setShowRagModal(true); fetchRagDocuments(); }}
            className="p-2 rounded-lg text-[#8E8E93] hover:text-purple-400 hover:bg-white/5 transition-colors"
            title="Znalostní knihovna"
          >
            <BookOpen size={20} />
          </button>
          <button
            onClick={clearChat}
            className="p-2 rounded-lg text-[#8E8E93] hover:text-red-400 hover:bg-white/5 transition-colors"
            title="Vymazat chat"
          >
            <Trash2 size={20} />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-500/20 to-blue-500/20 flex items-center justify-center mb-4">
              <Bot size={32} className="text-purple-400" />
            </div>
            <h2 className="text-white font-semibold text-lg mb-2">Ahoj! Jsem váš Obchodník pomocník.</h2>
            <p className="text-[#8E8E93] max-w-md text-sm mb-4">
              Mohu vyhledávat v CRM, plánovat trasy s kontakty, posílat emaily a mnoho dalšího.
            </p>
            <div className="flex flex-wrap gap-2 justify-center">
              {[
                "Jedu do Sedlčan, jaké školy jsou po cestě?",
                "info o škole Dobříš",
                "přístupové kódy pro ZŠ Dobříš",
                "vytvoř úkol napsat do Dobříše ředitelovi",
                "naplánuj schůzku na pondělí v Sedlčanech"
              ].map((suggestion, i) => (
                <button
                  key={i}
                  onClick={() => sendMessage(suggestion)}
                  className="px-3 py-2 bg-[#1C1C1E] text-[#8E8E93] rounded-lg text-sm hover:bg-[#2C2C2E] hover:text-white transition-colors"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((message) => (
          <motion.div
            key={message.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={clsx(
              "flex gap-3",
              message.role === 'user' ? "justify-end" : "justify-start"
            )}
          >
            {message.role === 'assistant' && (
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center shrink-0">
                <Bot size={16} className="text-white" />
              </div>
            )}

            <div className={clsx(
              "max-w-[85%] rounded-2xl px-4 py-3",
              message.role === 'user'
                ? "bg-[#0A84FF] text-white"
                : "bg-[#1C1C1E] text-white"
            )}>
              {message.isLoading ? (
                <div className="flex items-center gap-2">
                  <Loader2 size={16} className="animate-spin" />
                  <span className="text-[#8E8E93]">Pracuji na tom...</span>
                </div>
              ) : (
                <>
                  <p className="whitespace-pre-wrap text-sm">{message.content}</p>
                  {message.routeData && renderRouteData(message.routeData, message.voiceSummary)}
                  {message.crmData && renderCrmData(message.crmData)}
                </>
              )}
            </div>

            {message.role === 'user' && (
              <div className="w-8 h-8 rounded-full bg-[#3C3C3E] flex items-center justify-center shrink-0">
                <User size={16} className="text-white" />
              </div>
            )}
          </motion.div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="shrink-0 p-4 border-t border-white/10">
        <div className="flex items-end gap-3">
          <button
            onClick={handleRecordToggle}
            disabled={isTranscribing || isProcessing}
            className={clsx(
              "w-12 h-12 rounded-full flex items-center justify-center transition-all shrink-0",
              isRecording
                ? "bg-red-500 text-white animate-pulse shadow-lg shadow-red-500/30"
                : isTranscribing
                ? "bg-[#2C2C2E] text-[#8E8E93]"
                : "bg-[#1C1C1E] text-[#0A84FF] hover:bg-[#2C2C2E]"
            )}
          >
            {isTranscribing ? <Loader2 size={20} className="animate-spin" /> : <Mic size={20} />}
          </button>

          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={isRecording ? "Nahrávám..." : "Např: Jedu do Sedlčan, jaké školy jsou po cestě?"}
              rows={1}
              disabled={isRecording}
              className={clsx(
                "w-full bg-[#1C1C1E] text-white rounded-2xl px-4 py-3 resize-none focus:outline-none focus:ring-2 focus:ring-[#0A84FF]/50 placeholder-[#8E8E93] text-sm",
                isRecording && "opacity-50"
              )}
              style={{ minHeight: '48px', maxHeight: '120px' }}
            />
          </div>

          <button
            onClick={() => sendMessage()}
            disabled={!input.trim() || isProcessing || isRecording}
            className={clsx(
              "w-12 h-12 rounded-full flex items-center justify-center transition-all shrink-0",
              input.trim() && !isProcessing && !isRecording
                ? "bg-gradient-to-r from-purple-500 to-blue-500 text-white shadow-lg"
                : "bg-[#2C2C2E] text-[#8E8E93]"
            )}
          >
            {isProcessing ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />}
          </button>
        </div>

        {isRecording && (
          <div className="flex items-center justify-center gap-2 mt-3 text-red-400 text-sm">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            Nahrávám... Klikněte znovu pro ukončení
          </div>
        )}
      </div>

      </div>

      {/* Organization Detail Side Panel - Full screen on mobile */}
      {selectedOrg && (
        <div className="fixed inset-0 z-50 lg:relative lg:inset-auto lg:z-auto w-full lg:w-[380px] xl:w-[480px] h-full lg:border-l border-white/10 shrink-0 bg-[#1C1C1E]">
          <SchoolDetailPanel
            organization={{
              id: selectedOrg.id,
              name: selectedOrg.name,
              address: orgDetail?.address || selectedOrg.address
            }}
            detail={orgDetail}
            loading={loadingOrgDetail}
            onClose={() => { setSelectedOrg(null); setOrgDetail(null); }}
          />
        </div>
      )}

      {/* RAG Knowledge Base Modal */}
      <AnimatePresence>
        {showRagModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 z-50 flex items-end lg:items-center justify-center lg:p-4"
            onClick={() => setShowRagModal(false)}
          >
            <motion.div
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 100, opacity: 0 }}
              className="bg-[#1C1C1E] rounded-t-2xl lg:rounded-2xl w-full lg:max-w-2xl max-h-[90vh] lg:max-h-[85vh] overflow-hidden shadow-2xl flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="bg-gradient-to-r from-purple-500 to-blue-500 p-4 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                  <BookOpen size={24} className="text-white" />
                  <div>
                    <h2 className="text-white text-xl font-bold">Znalostní knihovna</h2>
                    <p className="text-white/70 text-sm">{ragDocuments.length} dokumentů</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowRagModal(false)}
                  className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                >
                  <X size={20} className="text-white" />
                </button>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {/* Add new document form */}
                <div className="bg-[#252528] rounded-xl p-4">
                  <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
                    <Plus size={16} className="text-green-400" />
                    Přidat nový dokument
                  </h3>
                  <div className="space-y-3">
                    <input
                      type="text"
                      placeholder="Název (např. 'ZŠ Sedlčany - poznámky')"
                      value={newRagTitle}
                      onChange={(e) => setNewRagTitle(e.target.value)}
                      className="w-full bg-[#1C1C1E] text-white rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-purple-500/50 placeholder-[#6B7280] text-sm"
                    />
                    <textarea
                      placeholder="Obsah dokumentu..."
                      value={newRagContent}
                      onChange={(e) => setNewRagContent(e.target.value)}
                      rows={4}
                      className="w-full bg-[#1C1C1E] text-white rounded-lg px-4 py-3 resize-none focus:outline-none focus:ring-2 focus:ring-purple-500/50 placeholder-[#6B7280] text-sm"
                    />
                    <button
                      onClick={saveRagDocument}
                      disabled={!newRagTitle.trim() || !newRagContent.trim()}
                      className="w-full py-3 bg-gradient-to-r from-purple-500 to-blue-500 text-white rounded-xl font-medium hover:from-purple-600 hover:to-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      <Plus size={18} />
                      Uložit do knihovny
                    </button>
                  </div>
                </div>

                {/* Documents list */}
                <div>
                  <h3 className="text-[#8E8E93] font-semibold mb-3 flex items-center gap-2 text-sm uppercase">
                    <FileText size={14} />
                    Uložené dokumenty
                  </h3>
                  
                  {loadingRag ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 size={24} className="animate-spin text-purple-400" />
                    </div>
                  ) : ragDocuments.length === 0 ? (
                    <div className="text-center py-8 text-[#6B7280]">
                      <BookOpen size={32} className="mx-auto mb-2 opacity-30" />
                      <p>Knihovna je prázdná</p>
                      <p className="text-xs mt-1">Přidejte první dokument nebo řekněte agentovi "Ulož si..."</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {ragDocuments.map((doc: any) => (
                        <div key={doc.id} className="bg-[#252528] rounded-lg p-4 group">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <p className="text-white font-medium truncate">{doc.title}</p>
                              <p className="text-[#6B7280] text-sm line-clamp-2 mt-1">{doc.content}</p>
                              <p className="text-[#4B5563] text-xs mt-2">
                                {new Date(doc.createdAt).toLocaleDateString('cs-CZ')}
                                {doc.source === 'agent' && ' • přidáno agentem'}
                              </p>
                            </div>
                            <button
                              onClick={() => deleteRagDocument(doc.id)}
                              className="p-2 text-[#6B7280] hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                              title="Smazat"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Settings */}
                <div className="border-t border-white/10 pt-4 mt-4">
                  <h3 className="text-[#8E8E93] font-semibold mb-3 flex items-center gap-2 text-sm uppercase">
                    ⚙️ Nastavení RAG
                  </h3>
                  <div className="space-y-3">
                    <button
                      onClick={reindexRag}
                      disabled={loadingRag || ragDocuments.length === 0}
                      className="w-full py-3 bg-[#252528] hover:bg-[#333] text-white rounded-xl font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      🧠 Reindexovat knihovnu
                      <span className="text-xs text-[#6B7280]">AI zanalyzuje všechny dokumenty</span>
                    </button>
                    <p className="text-[#6B7280] text-xs text-center">
                      Reindexování vytvoří metadata pro chytřejší vyhledávání
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
