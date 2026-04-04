import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { Session, User } from '@supabase/supabase-js';
import { projectId } from '/utils/supabase/info';
import { getEdgeFunctionHeaders } from '@/lib/edgeFunctionHeaders';
import { getSupabaseBrowser, resetSupabaseBrowserClient, signInWithGoogleOAuth } from '@/lib/supabaseBrowser';
import { prepareWebStorageForAuth } from '@/lib/prepareWebStorageForAuth';

// Types
export interface Task {
  id: string;
  text: string;
  completed: boolean;
  createdAt: number; // timestamp
  note?: string; // additional notes/details
  priority?: 'low' | 'medium' | 'high';
  recordingDuration?: string; // "01:23" format
}

export interface Shortcut {
  id: string;
  trigger: string;
  replacement: string;
}

export interface AppSettings {
  openaiKey: string;
  language: string;
}

export interface RagDocument {
  id: string;
  title: string;
  content?: string;
  type: 'text' | 'notes' | 'news';
  createdAt: number;
  wordCount: number;
}

interface AppContextType {
  // Tasks
  tasks: Task[];
  addTask: (text: string, options?: { duration?: string; note?: string; priority?: 'low' | 'medium' | 'high' }) => void;
  updateTask: (id: string, updates: Partial<Task>) => void;
  toggleTask: (id: string) => void;
  deleteTask: (id: string) => void;
  deleteCompletedTasks: () => void;
  
  // Shortcuts
  shortcuts: Shortcut[];
  addShortcut: (trigger: string, replacement: string) => void;
  updateShortcut: (id: string, trigger: string, replacement: string) => void;
  deleteShortcut: (id: string) => void;

  // Settings
  settings: AppSettings;
  updateSettings: (newSettings: Partial<AppSettings>) => void;
  clearAllData: () => void;
  
  // API
  transcribeAudio: (audioBlob: Blob) => Promise<string>;
  smartEdit: (
    currentText: string,
    newVoiceText: string,
    context?: string,
    googleAccessToken?: string,
    selection?: { start: number; end: number; text: string },
    opts?: { signal?: AbortSignal; noFallback?: boolean },
  ) => Promise<any>;
  /** Obsáhlý přepis → název, kroky, přesný přepis (server /task-breakdown). */
  breakdownTaskTranscript: (transcript: string) => Promise<{ title: string; steps: string[]; transcript: string }>;
  
  // RAG Library
  ragDocuments: RagDocument[];
  loadRagDocuments: () => Promise<void>;
  addRagDocument: (title: string, content: string, type?: 'text' | 'notes' | 'news') => Promise<RagDocument>;
  deleteRagDocument: (id: string) => Promise<void>;
  ragLoading: boolean;

  /** Obchodník (AgentTab) zpracovává požadavek nebo přepisuje hlas — pro ikonu v menu. */
  agentProcessing: boolean;
  setAgentProcessing: (v: boolean) => void;

  /** Levý panel: na mobilu výsuvné menu, na desktopu skrytí postranního sloupce. */
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (v: boolean) => void;
  navDrawerOpen: boolean;
  setNavDrawerOpen: (v: boolean) => void;
  toggleLeftNav: () => void;

  /** Přihlášení Google (Supabase Auth). */
  user: User | null;
  session: Session | null;
  authReady: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

// Helper for safe parsing
const safeParse = (key: string, fallback: any) => {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : fallback;
  } catch (e) {
    console.error(`Error parsing key "${key}" from localStorage:`, e);
    return fallback;
  }
};

function lsTasksKey(uid: string | null) {
  return uid ? `dictation_app_tasks:${uid}` : 'dictation_app_tasks';
}
function lsShortcutsKey(uid: string | null) {
  return uid ? `dictation_app_shortcuts:${uid}` : 'dictation_app_shortcuts';
}
function lsSettingsKey(uid: string | null) {
  return uid ? `dictation_app_settings:${uid}` : 'dictation_app_settings';
}

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(false);

  const [tasks, setTasks] = useState<Task[]>(() => safeParse('dictation_app_tasks', []));

  const [shortcuts, setShortcuts] = useState<Shortcut[]>(() => safeParse('dictation_app_shortcuts', [
    { id: '1', trigger: 'podpis', replacement: 'S pozdravem,\nJan Novák\nCEO' },
    { id: '2', trigger: 'ičo', replacement: '12345678' }
  ]));

  const [settings, setSettings] = useState<AppSettings>(() => safeParse('dictation_app_settings', { openaiKey: '', language: 'cs' }));
  
  // RAG Library state
  const [ragDocuments, setRagDocuments] = useState<RagDocument[]>([]);
  const [ragLoading, setRagLoading] = useState(false);
  const [agentProcessing, setAgentProcessing] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const [navDrawerOpen, setNavDrawerOpen] = useState(false);

  const toggleLeftNav = useCallback(() => {
    if (typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches) {
      setSidebarCollapsed((c) => !c);
    } else {
      setNavDrawerOpen((o) => !o);
    }
  }, []);

  const getAuthHeaders = useCallback(
    (includeJson = false) => getEdgeFunctionHeaders(includeJson),
    [],
  );

  const saveToStorage = async (key: string, value: any) => {
    try {
      const headers = await getAuthHeaders(true);
      await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-954b19ad/storage`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ key, value }),
      });
    } catch (error) {
      console.error(`Failed to save ${key} to Supabase:`, error);
    }
  };

  const fetchFromStorage = async (key: string) => {
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-954b19ad/storage/${key}`, {
        headers,
      });
      if (res.ok) {
        const data = await res.json();
        return data.value;
      }
    } catch (error) {
      console.error(`Failed to fetch ${key} from Supabase:`, error);
    }
    return null;
  };

  useEffect(() => {
    let subscription: { unsubscribe: () => void } | undefined;

    const hydrateFromLocal = (uid: string | null) => {
      setTasks(safeParse(lsTasksKey(uid), []));
      setShortcuts(
        safeParse(lsShortcutsKey(uid), [
          { id: '1', trigger: 'podpis', replacement: 'S pozdravem,\nJan Novák\nCEO' },
          { id: '2', trigger: 'ičo', replacement: '12345678' },
        ]),
      );
      setSettings(safeParse(lsSettingsKey(uid), { openaiKey: '', language: 'cs' }));
    };

    const applySession = (s: Session | null) => {
      setSession(s);
      setUser(s?.user ?? null);
      hydrateFromLocal(s?.user?.id ?? null);
    };

    const initAuth = async () => {
      // Návrat z Google: úložiště musí mít volné místo na uložení session (jinak QuotaExceededError).
      if (typeof window !== 'undefined') {
        const url = new URL(window.location.href);
        const hashLooksOAuth =
          !!url.hash && /access_token|refresh_token|provider_token|error|error_description/i.test(url.hash);
        const hasOAuthCode = url.searchParams.has('code');
        if (hashLooksOAuth || hasOAuthCode) {
          await prepareWebStorageForAuth('oauthReturn');
          resetSupabaseBrowserClient();
        }
      }

      const supabase = getSupabaseBrowser();

      const {
        data: { subscription: sub },
      } = supabase.auth.onAuthStateChange((_event, session) => {
        applySession(session);
      });
      subscription = sub;

      await supabase.auth.initialize();

      let {
        data: { session: s },
      } = await supabase.auth.getSession();
      if (!s && typeof window !== 'undefined') {
        await new Promise((r) => setTimeout(r, 200));
        ({
          data: { session: s },
        } = await supabase.auth.getSession());
      }

      if (!s && typeof window !== 'undefined') {
        const url = new URL(window.location.href);
        const code = url.searchParams.get('code');
        if (code) {
          const { data, error } = await supabase.auth.exchangeCodeForSession(code);
          if (!error && data.session) {
            s = data.session;
          } else if (error) {
            console.warn('[auth] exchangeCodeForSession(code):', error.message);
          }
        }
      }

      if (typeof window !== 'undefined') {
        const url = new URL(window.location.href);
        const hashLooksOAuth =
          !!url.hash && /access_token|refresh_token|provider_token|error|error_description/i.test(url.hash);
        const hadOAuthParams =
          url.searchParams.has('code') || url.searchParams.has('error') || hashLooksOAuth;
        if (hadOAuthParams && !s) {
          url.searchParams.delete('code');
          url.searchParams.delete('state');
          url.searchParams.delete('error');
          url.searchParams.delete('error_description');
          if (hashLooksOAuth) {
            window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}`);
          } else {
            window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
          }
          console.warn(
            '[auth] OAuth návrat bez session. Zkontrolujte Redirect URLs v Supabase a Google provider. Při plné kvótě: DevTools → Application → Clear site data (localhost).',
          );
        }
      }

      applySession(s);
      setAuthReady(true);
    };

    void initAuth();

    const onVisible = () => {
      if (typeof document === 'undefined' || document.visibilityState !== 'visible') return;
      void getSupabaseBrowser().auth.getSession().then(({ data: { session: s } }) => applySession(s));
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);

    return () => {
      subscription?.unsubscribe();
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  }, []);

  // Initial Load (merge s cloudem — prázdné [] z API je v JS truthy; nesmí přepsat lokální úkoly při pomalém fetchi)
  useEffect(() => {
    if (!authReady) return;
    let cancelled = false;
    const loadData = async () => {
      const [remoteTasks, remoteShortcuts, remoteSettings] = await Promise.all([
        fetchFromStorage('tasks'),
        fetchFromStorage('shortcuts'),
        fetchFromStorage('settings')
      ]);
      if (cancelled) return;

      if (Array.isArray(remoteTasks)) {
        setTasks((prev) => {
          if (remoteTasks.length === 0 && prev.length > 0) return prev;
          return remoteTasks;
        });
      }
      if (Array.isArray(remoteShortcuts)) {
        setShortcuts((prev) => {
          if (remoteShortcuts.length === 0 && prev.length > 0) return prev;
          return remoteShortcuts;
        });
      }
      if (
        remoteSettings &&
        typeof remoteSettings === 'object' &&
        !Array.isArray(remoteSettings)
      ) {
        setSettings((prev) => ({ ...prev, ...remoteSettings }));
      }
    };
    loadData();
    return () => {
      cancelled = true;
    };
  }, [authReady, user?.id]);

  // Persistence (Supabase + LocalStorage Backup, klíče podle uživatele)
  useEffect(() => {
    if (!authReady) return;
    const uid = user?.id ?? null;
    localStorage.setItem(lsTasksKey(uid), JSON.stringify(tasks));
    saveToStorage('tasks', tasks);
  }, [tasks, user?.id, authReady]);

  useEffect(() => {
    if (!authReady) return;
    const uid = user?.id ?? null;
    localStorage.setItem(lsShortcutsKey(uid), JSON.stringify(shortcuts));
    saveToStorage('shortcuts', shortcuts);
  }, [shortcuts, user?.id, authReady]);

  useEffect(() => {
    if (!authReady) return;
    const uid = user?.id ?? null;
    localStorage.setItem(lsSettingsKey(uid), JSON.stringify(settings));
    saveToStorage('settings', settings);
  }, [settings, user?.id, authReady]);

  // Actions
  const addTask = (text: string, options?: { duration?: string; note?: string; priority?: 'low' | 'medium' | 'high' }) => {
    const newTask: Task = {
      id: uuidv4(),
      text,
      completed: false,
      createdAt: Date.now(),
      recordingDuration: options?.duration,
      note: options?.note,
      priority: options?.priority,
    };
    setTasks(prev => [newTask, ...prev]);
  };

  const updateTask = (id: string, updates: Partial<Task>) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
  };

  const toggleTask = (id: string) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, completed: !t.completed } : t));
  };

  const deleteTask = (id: string) => {
    setTasks(prev => prev.filter(t => t.id !== id));
  };

  const deleteCompletedTasks = () => {
    setTasks(prev => prev.filter(t => !t.completed));
  };

  const addShortcut = (trigger: string, replacement: string) => {
    setShortcuts(prev => [...prev, { id: uuidv4(), trigger, replacement }]);
  };

  const updateShortcut = (id: string, trigger: string, replacement: string) => {
    setShortcuts(prev => prev.map(s => s.id === id ? { ...s, trigger, replacement } : s));
  };

  const deleteShortcut = (id: string) => {
    setShortcuts(prev => prev.filter(s => s.id !== id));
  };

  const updateSettings = (newSettings: Partial<AppSettings>) => {
    setSettings(prev => ({ ...prev, ...newSettings }));
  };

  const clearAllData = () => {
    setTasks([]);
    setShortcuts([]);
    setSettings({ openaiKey: '', language: 'cs' });
    localStorage.clear();
  };

  const signInWithGoogle = async () => {
    if (typeof window === 'undefined') return;
    const redirectTo = `${window.location.origin}${window.location.pathname}${window.location.search}`;
    const { error } = await signInWithGoogleOAuth(redirectTo);
    if (error) {
      console.error('[auth] Google sign-in', error);
      window.alert(
        `${error.message}\n\nZkontrolujte v Supabase → Authentication → URL Configuration, že Redirect URLs obsahují ${redirectTo} nebo http://localhost:3000/**`,
      );
    }
  };

  const signOut = async () => {
    await getSupabaseBrowser().auth.signOut();
  };

  // RAG Library functions
  const loadRagDocuments = async () => {
    setRagLoading(true);
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-954b19ad/rag/documents`, {
        headers,
      });
      
      if (response.ok) {
        const data = await response.json();
        setRagDocuments(data.documents || []);
      }
    } catch (error) {
      console.error("Failed to load RAG documents:", error);
    } finally {
      setRagLoading(false);
    }
  };

  const addRagDocument = async (title: string, content: string, type: 'text' | 'notes' | 'news' = 'text'): Promise<RagDocument> => {
    const id = uuidv4();
    const headers = await getAuthHeaders(true);
    const response = await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-954b19ad/rag/documents`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ id, title, content, type }),
    });

    if (!response.ok) {
      throw new Error('Failed to save document');
    }

    const data = await response.json();
    const newDoc = data.document as RagDocument;
    
    setRagDocuments(prev => [...prev, newDoc]);
    return newDoc;
  };

  const deleteRagDocument = async (id: string): Promise<void> => {
    const headers = await getAuthHeaders();
    const response = await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-954b19ad/rag/documents/${id}`, {
      method: 'DELETE',
      headers,
    });

    if (!response.ok) {
      throw new Error('Failed to delete document');
    }

    setRagDocuments(prev => prev.filter(doc => doc.id !== id));
  };

  useEffect(() => {
    if (!authReady) return;
    loadRagDocuments();
  }, [authReady]);

  const transcribeAudio = async (audioBlob: Blob): Promise<string> => {
    try {
      const formData = new FormData();
      // The file extension matters for OpenAI Whisper
      formData.append('file', audioBlob, 'recording.webm');

      const headers = await getAuthHeaders();
      const response = await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-954b19ad/transcribe`, {
        method: 'POST',
        headers,
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Transcription failed with status ${response.status}`);
      }

      const data = await response.json();
      return data.text;
    } catch (error) {
      console.error("Transcription error:", error);
      throw error;
    }
  };

  const smartEdit = async (
    currentText: string,
    newVoiceText: string,
    context?: string,
    googleAccessToken?: string,
    selection?: { start: number; end: number; text: string },
    opts?: { signal?: AbortSignal; noFallback?: boolean },
  ): Promise<any> => {
    try {
      const headers = await getAuthHeaders(true);
      const response = await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-954b19ad/smart-edit`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ currentText, newVoiceText, context, googleAccessToken, selection }),
        signal: opts?.signal,
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        const msg = (errJson as { error?: string }).error || `Smart Edit failed (${response.status})`;
        throw new Error(msg);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Smart Edit error:', error);
      if (opts?.noFallback) throw error;
      // Fallback: jen doplnění textu (ne pro ruční Web RAG — ten volá s noFallback)
      return { text: currentText ? `${currentText} ${newVoiceText}` : newVoiceText };
    }
  };

  const breakdownTaskTranscript = async (
    transcript: string,
  ): Promise<{ title: string; steps: string[]; transcript: string }> => {
    const headers = await getAuthHeaders(true);
    const response = await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-954b19ad/task-breakdown`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ transcript }),
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error((err as { error?: string }).error || `task-breakdown failed: ${response.status}`);
    }
    const data = await response.json();
    return {
      title: typeof data.title === 'string' ? data.title : '',
      steps: Array.isArray(data.steps) ? data.steps : [],
      transcript: typeof data.transcript === 'string' ? data.transcript : transcript,
    };
  };

  return (
    <AppContext.Provider value={{
      tasks, addTask, updateTask, toggleTask, deleteTask, deleteCompletedTasks,
      shortcuts, addShortcut, updateShortcut, deleteShortcut,
      settings, updateSettings, clearAllData,
      transcribeAudio, smartEdit, breakdownTaskTranscript,
      ragDocuments, loadRagDocuments, addRagDocument, deleteRagDocument, ragLoading,
      agentProcessing, setAgentProcessing,
      sidebarCollapsed, setSidebarCollapsed,
      navDrawerOpen, setNavDrawerOpen,
      toggleLeftNav,
      user, session, authReady, signInWithGoogle, signOut,
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
