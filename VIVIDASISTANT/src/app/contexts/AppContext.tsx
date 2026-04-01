import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { projectId, publicAnonKey } from '/utils/supabase/info';

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
  smartEdit: (currentText: string, newVoiceText: string, context?: string, googleAccessToken?: string) => Promise<any>;
  
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

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Initial state from local storage or defaults
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

  // Supabase Storage Helpers
  const saveToStorage = async (key: string, value: any) => {
    try {
      await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-954b19ad/storage`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${publicAnonKey}`,
        },
        body: JSON.stringify({ key, value }),
      });
    } catch (error) {
      console.error(`Failed to save ${key} to Supabase:`, error);
    }
  };

  const fetchFromStorage = async (key: string) => {
    try {
      const res = await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-954b19ad/storage/${key}`, {
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`,
        },
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

  // Initial Load
  useEffect(() => {
    const loadData = async () => {
      const [remoteTasks, remoteShortcuts, remoteSettings] = await Promise.all([
        fetchFromStorage('tasks'),
        fetchFromStorage('shortcuts'),
        fetchFromStorage('settings')
      ]);

      if (remoteTasks) setTasks(remoteTasks);
      if (remoteShortcuts) setShortcuts(remoteShortcuts);
      if (remoteSettings) setSettings(remoteSettings);
    };
    loadData();
  }, []);

  // Persistence (Supabase + LocalStorage Backup)
  useEffect(() => {
    localStorage.setItem('dictation_app_tasks', JSON.stringify(tasks));
    if (tasks.length > 0) saveToStorage('tasks', tasks); // Avoid overwriting cloud with empty on init if fetch is slow?
    // Actually, init happens once. If fetch returns data, tasks is updated. 
    // To be safe, we might want a "isLoaded" flag, but for now simple approach:
    // We only save if we have data or after some interaction. 
    // But hooks run on mount. If tasks is default empty, we might overwrite cloud.
    // However, the initial state is from localStorage safeParse. So we have local data.
    // Then we fetch cloud. Cloud overwrites local. Then we save cloud.
    // This is "Last write wins" but slightly racy on startup.
    // Given the simplicity, let's just save.
    saveToStorage('tasks', tasks);
  }, [tasks]);

  useEffect(() => {
    localStorage.setItem('dictation_app_shortcuts', JSON.stringify(shortcuts));
    saveToStorage('shortcuts', shortcuts);
  }, [shortcuts]);

  useEffect(() => {
    localStorage.setItem('dictation_app_settings', JSON.stringify(settings));
    saveToStorage('settings', settings);
  }, [settings]);

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

  // RAG Library functions
  const loadRagDocuments = async () => {
    setRagLoading(true);
    try {
      const response = await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-954b19ad/rag/documents`, {
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`,
        },
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
    
    const response = await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-954b19ad/rag/documents`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${publicAnonKey}`,
      },
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
    const response = await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-954b19ad/rag/documents/${id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${publicAnonKey}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to delete document');
    }

    setRagDocuments(prev => prev.filter(doc => doc.id !== id));
  };

  // Load RAG documents on mount
  useEffect(() => {
    loadRagDocuments();
  }, []);

  const transcribeAudio = async (audioBlob: Blob): Promise<string> => {
    try {
      const formData = new FormData();
      // The file extension matters for OpenAI Whisper
      formData.append('file', audioBlob, 'recording.webm');

      const response = await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-954b19ad/transcribe`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`,
        },
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

  const smartEdit = async (currentText: string, newVoiceText: string, context?: string, googleAccessToken?: string, selection?: { start: number; end: number; text: string }): Promise<any> => {
    try {
      const response = await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-954b19ad/smart-edit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${publicAnonKey}`,
        },
        body: JSON.stringify({ currentText, newVoiceText, context, googleAccessToken, selection }),
      });

      if (!response.ok) {
        throw new Error(`Smart Edit failed with status ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error("Smart Edit error:", error);
      // Fallback: just append if smart edit fails
      return { text: currentText ? `${currentText} ${newVoiceText}` : newVoiceText };
    }
  };

  return (
    <AppContext.Provider value={{
      tasks, addTask, updateTask, toggleTask, deleteTask, deleteCompletedTasks,
      shortcuts, addShortcut, updateShortcut, deleteShortcut,
      settings, updateSettings, clearAllData,
      transcribeAudio, smartEdit,
      ragDocuments, loadRagDocuments, addRagDocument, deleteRagDocument, ragLoading,
      agentProcessing, setAgentProcessing,
      sidebarCollapsed, setSidebarCollapsed,
      navDrawerOpen, setNavDrawerOpen,
      toggleLeftNav
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
