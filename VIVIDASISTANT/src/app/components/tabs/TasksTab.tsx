import React, { useState, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Plus, Trash2, Calendar, Circle, CheckCircle2, ChevronDown, ChevronRight, 
  ChevronLeft, Inbox, Loader2, MapPin, Navigation, Clock,
  ExternalLink, RefreshCw, FileText, MessageSquare, Flag, Edit3, X, Check, Car,
  Building2, User, Phone, Mail, DollarSign, Tag, Hash, Globe, Briefcase, History,
  PhoneCall, Video, Users, Pencil, Send
} from 'lucide-react';
import { useApp, Task } from '@/app/contexts/AppContext';
import { RecordButton } from '@/app/components/figma/RecordButton';
import { toast } from 'sonner';
import { projectId } from '/utils/supabase/info';

interface CalendarEvent {
  id: string;
  title: string;
  description: string;
  location: string;
  start: string;
  end: string;
  allDay: boolean;
  htmlLink: string;
}

const formatDate = (date: Date): string => date.toISOString().split('T')[0];

const formatDisplayDate = (date: Date): string => {
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  
  if (formatDate(date) === formatDate(today)) return 'Dnes';
  if (formatDate(date) === formatDate(tomorrow)) return 'Zítra';
  if (formatDate(date) === formatDate(yesterday)) return 'Včera';
  
  return date.toLocaleDateString('cs-CZ', { weekday: 'long', day: 'numeric', month: 'long' });
};

// Timeline helpers
const TIMELINE_START_HOUR = 6; // 6:00
const TIMELINE_END_HOUR = 20; // 20:00
const HOUR_HEIGHT = 60; // pixels per hour

const getTimePosition = (timeStr: string): number => {
  const date = new Date(timeStr);
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const totalMinutes = (hours - TIMELINE_START_HOUR) * 60 + minutes;
  return Math.max(0, (totalMinutes / 60) * HOUR_HEIGHT);
};

const getEventDuration = (start: string, end: string): number => {
  const startDate = new Date(start);
  const endDate = new Date(end);
  const durationMinutes = (endDate.getTime() - startDate.getTime()) / (1000 * 60);
  return Math.max(30, (durationMinutes / 60) * HOUR_HEIGHT); // minimum 30px height
};

const getMonthDays = (year: number, month: number): (Date | null)[] => {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const daysInMonth = lastDay.getDate();
  
  // Monday = 0, Sunday = 6 (adjust from JS where Sunday = 0)
  let startDayOfWeek = firstDay.getDay() - 1;
  if (startDayOfWeek < 0) startDayOfWeek = 6;
  
  const days: (Date | null)[] = [];
  
  // Add empty cells for days before the 1st
  for (let i = 0; i < startDayOfWeek; i++) {
    days.push(null);
  }
  
  // Add all days of the month
  for (let day = 1; day <= daysInMonth; day++) {
    days.push(new Date(year, month, day));
  }
  
  return days;
};

const formatEventTime = (dateStr: string): string => {
  const date = new Date(dateStr);
  return date.toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' });
};

const formatRelativeDate = (timestamp: number): string => {
  const now = Date.now();
  const diff = now - timestamp;
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  
  if (days === 0) return 'Dnes';
  if (days === 1) return 'Včera';
  if (days < 7) return `Před ${days} dny`;
  return new Date(timestamp).toLocaleDateString('cs-CZ', { day: 'numeric', month: 'short' });
};

const priorityColors = {
  low: 'text-gray-400 bg-gray-500/10',
  medium: 'text-yellow-400 bg-yellow-500/10',
  high: 'text-red-400 bg-red-500/10'
};

const priorityLabels = {
  low: 'Nízká',
  medium: 'Střední', 
  high: 'Vysoká'
};

export const TasksTab: React.FC = () => {
  const { tasks, addTask, updateTask, toggleTask, deleteTask, deleteCompletedTasks, transcribeAudio, smartEdit, shortcuts } = useApp();
  
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showCompleted, setShowCompleted] = useState(false);
  
  // Calendar events
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(false);
  
  // Event detail modal
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [pipedriveData, setPipedriveData] = useState<any>(null);
  const [loadingPipedrive, setLoadingPipedrive] = useState(false);
  const [savedAssignments, setSavedAssignments] = useState<Record<string, any>>(() => {
    try {
      return JSON.parse(localStorage.getItem('calendar-crm-assignments') || '{}');
    } catch { return {}; }
  });
  const [expandedOrgActivities, setExpandedOrgActivities] = useState<Record<number, any[]>>({});
  const [loadingActivities, setLoadingActivities] = useState<number | null>(null);
  
  // Travel times between events
  interface TravelTime {
    from: string;
    to: string;
    durationMinutes: number;
    durationText: string;
  }
  const [travelTimes, setTravelTimes] = useState<TravelTime[]>([]);
  
  // Task form
  const [newTaskText, setNewTaskText] = useState("");
  const [newTaskNote, setNewTaskNote] = useState("");
  const [newTaskPriority, setNewTaskPriority] = useState<'low' | 'medium' | 'high' | undefined>(undefined);
  const [showAdvancedForm, setShowAdvancedForm] = useState(false);
  
  // Editing task
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editingNote, setEditingNote] = useState("");

  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const selectedDateStr = formatDate(selectedDate);
  const [currentMonth, setCurrentMonth] = useState({ year: new Date().getFullYear(), month: new Date().getMonth() });
  const monthDays = useMemo(() => getMonthDays(currentMonth.year, currentMonth.month), [currentMonth]);

  // Filter calendar events for selected date
  const eventsForSelectedDate = useMemo(() => {
    return calendarEvents.filter(e => {
      const eventDate = e.start.split('T')[0];
      return eventDate === selectedDateStr;
    }).sort((a, b) => a.start.localeCompare(b.start));
  }, [calendarEvents, selectedDateStr]);

  // Events with location (for route planning)
  const eventsWithLocation = eventsForSelectedDate.filter(e => e.location && e.location.trim().length > 0);

  const activeTasks = tasks.filter(t => !t.completed).sort((a, b) => {
    // Sort by priority first, then by date
    const priorityOrder = { high: 0, medium: 1, low: 2, undefined: 3 };
    const aPriority = priorityOrder[a.priority || 'undefined'];
    const bPriority = priorityOrder[b.priority || 'undefined'];
    if (aPriority !== bPriority) return aPriority - bPriority;
    return b.createdAt - a.createdAt;
  });
  
  const completedTasks = tasks.filter(t => t.completed).sort((a, b) => b.createdAt - a.createdAt);

  // Get event count for a specific date
  const getEventCountForDate = (date: Date) => {
    const dateStr = formatDate(date);
    return calendarEvents.filter(e => e.start.split('T')[0] === dateStr).length;
  };

  // Fetch calendar events
  const fetchCalendarEvents = async () => {
    const googleToken = localStorage.getItem('google_provider_token');
    if (!googleToken) {
      toast.error("Připojte Google Kalendář v Nastavení");
      return;
    }

    setLoadingEvents(true);
    try {
      const now = new Date();
      const monthAhead = new Date(now);
      monthAhead.setDate(monthAhead.getDate() + 30);

      const response = await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-954b19ad/calendar/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          googleAccessToken: googleToken,
          timeMin: now.toISOString(),
          timeMax: monthAhead.toISOString()
        })
      });

      const data = await response.json();
      
      if (!response.ok) {
        if (data.error === 'token_expired' || response.status === 401) {
          localStorage.removeItem('google_provider_token');
          toast.error("Platnost připojení vypršela. Připojte Google Kalendář znovu.");
        } else {
          toast.error("Nepodařilo se načíst kalendář");
        }
        return;
      }

      setCalendarEvents(data.events || []);
    } catch (error) {
      console.error("Calendar fetch error:", error);
      toast.error("Chyba při načítání kalendáře");
    } finally {
      setLoadingEvents(false);
    }
  };

  // Fetch Pipedrive data for selected event using AI to match
  const fetchPipedriveData = async (event: CalendarEvent, forceRefresh = false) => {
    setSelectedEvent(event);
    
    // Check if we have saved assignment for this event
    const savedData = savedAssignments[event.id];
    if (savedData && !forceRefresh) {
      setPipedriveData({ ...savedData, isSaved: true });
      setLoadingPipedrive(false);
      return;
    }
    
    setPipedriveData(null);
    setLoadingPipedrive(true);
    
    try {
      // Use AI agent to intelligently match event with CRM
      const response = await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-954b19ad/calendar/match-crm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventTitle: event.title,
          eventLocation: event.location,
          eventDescription: event.description
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        setPipedriveData(data);
        
        // Auto-save if we found organizations
        if (data.organizations?.length > 0) {
          const newAssignments = { ...savedAssignments, [event.id]: data };
          setSavedAssignments(newAssignments);
          localStorage.setItem('calendar-crm-assignments', JSON.stringify(newAssignments));
        }
      }
    } catch (error) {
      console.error("Pipedrive fetch error:", error);
    } finally {
      setLoadingPipedrive(false);
    }
  };
  
  // Save CRM assignment for event
  const saveAssignment = (eventId: string, data: any) => {
    const newAssignments = { ...savedAssignments, [eventId]: data };
    setSavedAssignments(newAssignments);
    localStorage.setItem('calendar-crm-assignments', JSON.stringify(newAssignments));
    setPipedriveData({ ...data, isSaved: true });
    toast.success('Přiřazení uloženo');
  };
  
  // Remove saved assignment
  const removeAssignment = (eventId: string) => {
    const newAssignments = { ...savedAssignments };
    delete newAssignments[eventId];
    setSavedAssignments(newAssignments);
    localStorage.setItem('calendar-crm-assignments', JSON.stringify(newAssignments));
    if (selectedEvent) {
      fetchPipedriveData(selectedEvent, true);
    }
    toast.success('Přiřazení odstraněno');
  };
  
  // Remove a specific organization from the assignment
  const removeOrganization = (eventId: string, orgId: number) => {
    if (!pipedriveData) return;
    
    const updatedOrgs = pipedriveData.organizations.filter((org: any) => org.id !== orgId);
    const updatedData = { ...pipedriveData, organizations: updatedOrgs };
    
    setPipedriveData(updatedData);
    
    // Update saved assignments
    const newAssignments = { ...savedAssignments, [eventId]: updatedData };
    setSavedAssignments(newAssignments);
    localStorage.setItem('calendar-crm-assignments', JSON.stringify(newAssignments));
    
    toast.success('Organizace odebrána');
  };
  
  // Fetch activities for an organization
  const fetchOrgActivities = async (orgId: number) => {
    // Toggle off if already expanded
    if (expandedOrgActivities[orgId]) {
      setExpandedOrgActivities(prev => {
        const newState = { ...prev };
        delete newState[orgId];
        return newState;
      });
      return;
    }
    
    setLoadingActivities(orgId);
    try {
      const response = await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-954b19ad/crm/org-activities`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orgId })
      });
      
      if (response.ok) {
        const data = await response.json();
        setExpandedOrgActivities(prev => ({ ...prev, [orgId]: data.activities || [] }));
      }
    } catch (error) {
      console.error("Activities fetch error:", error);
      toast.error("Chyba při načítání aktivit");
    } finally {
      setLoadingActivities(null);
    }
  };

  useEffect(() => {
    if (isRecording) {
      timerRef.current = setInterval(() => setRecordingTime(prev => prev + 1), 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isRecording]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };


  const handleAddTask = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!newTaskText.trim()) return;
    addTask(newTaskText.trim(), {
      note: newTaskNote.trim() || undefined,
      priority: newTaskPriority,
    });
    setNewTaskText("");
    setNewTaskNote("");
    setNewTaskPriority(undefined);
    setShowAdvancedForm(false);
    toast.success("Úkol přidán");
  };

  const handleToggle = (id: string) => {
    toggleTask(id);
    const task = tasks.find(t => t.id === id);
    if (task && !task.completed) {
      toast.success("Splněno! 🎉");
    }
  };

  const handleSaveNote = (taskId: string) => {
    updateTask(taskId, { note: editingNote.trim() || undefined });
    setEditingTaskId(null);
    setEditingNote("");
    toast.success("Poznámka uložena");
  };

  const startRecording = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      toast.error("Váš prohlížeč nepodporuje nahrávání.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach(track => track.stop());
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        
        setIsTranscribing(true);
        try {
          let newText = await transcribeAudio(audioBlob);
          shortcuts.forEach(s => {
            const regex = new RegExp(`\\b${s.trigger}\\b`, 'gi');
            newText = newText.replace(regex, s.replacement);
          });

          if (newTaskText.trim()) {
            const result = await smartEdit(newTaskText, newText);
            setNewTaskText(result.text || newText);
          } else {
            setNewTaskText(newText);
          }
          toast.success("Přepis dokončen");
        } catch (err: any) {
          toast.error("Chyba: " + (err.message || "Neznámá chyba"));
        } finally {
          setIsTranscribing(false);
          setRecordingTime(0);
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
      toast("Poslouchám...");
    } catch (err: any) {
          toast.error("Chyba mikrofonu: " + (err.message || "Zkontrolujte oprávnění"));
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleRecordToggle = () => isRecording ? stopRecording() : startRecording();

  const openGoogleMapsRoute = () => {
    const locations = eventsWithLocation.map(e => e.location).filter(Boolean);
    
    if (locations.length === 0) {
      toast.error("Události nemají zadané lokace");
             return;
        }

    const origin = "current+location";
    const destination = encodeURIComponent(locations[locations.length - 1] || '');
    const waypoints = locations.slice(0, -1).map(l => encodeURIComponent(l || '')).join('|');
    
    let url = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}`;
    if (waypoints) url += `&waypoints=${waypoints}`;
    url += `&travelmode=driving`;
    
    window.open(url, '_blank');
    toast.success("Otevírám Google Maps s " + locations.length + " zastávkami");
  };

  const renderTaskCard = (task: Task) => (
    <motion.div
      key={task.id}
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className={`group bg-[#1C1C1E] rounded-2xl p-4 transition-all hover:bg-[#252528] ${
        task.completed ? 'opacity-50' : ''
      }`}
    >
      <div className="flex items-start gap-4">
        {/* Checkbox */}
        <button 
          onClick={() => handleToggle(task.id)}
          className={`shrink-0 mt-0.5 transition-colors ${task.completed ? 'text-[#10B981]' : 'text-[#4B5563] hover:text-[#3B82F6]'}`}
        >
          {task.completed ? <CheckCircle2 size={24} /> : <Circle size={24} strokeWidth={1.5} />}
        </button>
        
        {/* Content */}
        <div className="flex-1 min-w-0">
          <p className={`text-[15px] leading-relaxed font-medium ${task.completed ? 'text-[#6B7280] line-through' : 'text-white'}`}>
            {task.text}
          </p>
          
          {/* Note */}
          {editingTaskId === task.id ? (
            <div className="mt-3 flex gap-2">
              <input
                type="text"
                value={editingNote}
                onChange={(e) => setEditingNote(e.target.value)}
                placeholder="Přidat poznámku..."
                className="flex-1 bg-[#0A0E17] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-[#6B7280] focus:outline-none focus:ring-2 focus:ring-[#3B82F6]"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveNote(task.id);
                  if (e.key === 'Escape') setEditingTaskId(null);
                }}
              />
              <button 
                onClick={() => handleSaveNote(task.id)}
                className="p-2 bg-[#3B82F6] rounded-lg text-white hover:bg-[#2563EB]"
              >
                <Check size={16} />
              </button>
              <button 
                onClick={() => setEditingTaskId(null)}
                className="p-2 bg-[#2A2A2C] rounded-lg text-[#6B7280] hover:text-white"
              >
                <X size={16} />
              </button>
                </div>
          ) : task.note ? (
            <div className="text-[#6B7280] text-sm mt-1.5 flex items-start gap-1.5">
              <MessageSquare size={14} className="shrink-0 mt-0.5" />
              <span className="min-w-0 whitespace-pre-wrap">{task.note}</span>
            </div>
          ) : null}
          
          {/* Meta row */}
          <div className="flex items-center gap-3 mt-3">
            <span className="text-[#6B7280] text-xs">
              {formatRelativeDate(task.createdAt)}
            </span>
            
            {task.priority && (
              <span className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-md ${priorityColors[task.priority]}`}>
                <Flag size={10} />
                {priorityLabels[task.priority]}
              </span>
            )}
            </div>
        </div>
        
        {/* Actions */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          {!task.completed && (
                <button 
              onClick={() => {
                setEditingTaskId(task.id);
                setEditingNote(task.note || "");
              }}
              className="p-2 rounded-lg hover:bg-white/5 text-[#6B7280] hover:text-white transition-colors"
              title="Přidat poznámku"
            >
              <Edit3 size={16} />
                </button>
            )}
          <button 
            onClick={() => deleteTask(task.id)}
            className="p-2 rounded-lg hover:bg-red-500/20 text-[#6B7280] hover:text-red-400 transition-colors"
            title="Smazat"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>
    </motion.div>
  );

  return (
    <div className="relative flex h-full min-h-0 min-w-0 w-full flex-col overflow-hidden lg:flex-row">
      <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col gap-4 overflow-hidden p-4 lg:p-6">
        {/* Kalendář v UI zatím skrytý — znovu zapněte přepínač + větev viewMode === 'calendar' níže */}
        <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 md:min-h-0 md:grid-cols-2 md:gap-6">
            {/* VLEVO: zadávání úkolů */}
            <aside className="flex min-h-0 min-w-0 flex-col overflow-y-auto rounded-2xl border border-white/10 bg-[#1C1C1E] p-4 md:p-5">
              <h2 className="mb-1 text-lg font-semibold text-white">Zadání úkolu</h2>
              <p className="mb-4 text-sm text-[#6B7280]">Napište nebo nadiktujte</p>
              <div className="flex items-center gap-3 mb-4">
                <div className="relative">
                  {isRecording && <div className="absolute inset-0 rounded-full bg-red-500/30 animate-ping" />}
                  <RecordButton
                    isRecording={isRecording}
                    isProcessing={isTranscribing}
                    onClick={handleRecordToggle}
                    className="relative z-10 h-12 w-12"
                  />
                </div>
                <div className="min-w-0">
                  <span className="block font-medium text-white">Hlas / přepis</span>
                  <span className="text-sm text-[#6B7280]">
                    {isRecording ? (
                      <span className="text-red-400">{formatTime(recordingTime)}</span>
                    ) : isTranscribing ? (
                      <span className="text-blue-400">Zpracovávám...</span>
                    ) : (
                      'Klikněte na červené kolečko'
                    )}
                  </span>
                </div>
              </div>
              <form onSubmit={handleAddTask} className="space-y-3">
                <input
                  type="text"
                  value={newTaskText}
                  onChange={(e) => setNewTaskText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleAddTask();
                    }
                  }}
                  placeholder="Co potřebujete udělat?"
                  className="w-full rounded-xl border border-white/5 bg-[#0A0E17] px-4 py-3 text-sm text-white placeholder-[#6B7280] transition-all focus:outline-none focus:ring-2 focus:ring-[#3B82F6]"
                />
                {newTaskText.trim() && (
                  <button
                    type="button"
                    onClick={() => setShowAdvancedForm(!showAdvancedForm)}
                    className="flex items-center gap-1.5 text-sm text-[#6B7280] transition-colors hover:text-white"
                  >
                    {showAdvancedForm ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    Přidat detaily
                  </button>
                )}
                <AnimatePresence>
                  {showAdvancedForm && newTaskText.trim() && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="space-y-3 overflow-hidden"
                    >
                      <textarea
                        value={newTaskNote}
                        onChange={(e) => setNewTaskNote(e.target.value)}
                        placeholder="Poznámka (volitelné)..."
                        rows={2}
                        className="w-full resize-none rounded-xl border border-white/5 bg-[#0A0E17] px-4 py-3 text-sm text-white placeholder-[#6B7280] focus:outline-none focus:ring-2 focus:ring-[#3B82F6]"
                      />
                      <div className="flex gap-2">
                        {(['low', 'medium', 'high'] as const).map((p) => (
                          <button
                            key={p}
                            type="button"
                            onClick={() => setNewTaskPriority(newTaskPriority === p ? undefined : p)}
                            className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-medium transition-all ${
                              newTaskPriority === p
                                ? priorityColors[p] + ' ring-1 ring-current'
                                : 'bg-[#0A0E17] text-[#6B7280] hover:text-white'
                            }`}
                          >
                            <Flag size={12} />
                            {priorityLabels[p]}
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
                <button
                  type="submit"
                  disabled={!newTaskText.trim()}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#3B82F6] py-3 text-sm font-medium text-white transition-colors hover:bg-[#2563EB] disabled:pointer-events-none disabled:opacity-40 enabled:active:scale-[0.99]"
                >
                  <Plus size={16} />
                  Přidat úkol
                </button>
              </form>
            </aside>

            {/* VPRAVO: seznam úkolů */}
            <section className="flex min-h-0 min-w-0 flex-1 flex-[1_1_0%] flex-col overflow-y-auto rounded-2xl border border-white/5 bg-[#121212] p-4 md:p-5">
              <div className="mb-4 flex shrink-0 items-center justify-between gap-2">
                <div>
                  <h1 className="text-2xl font-bold text-white">Moje úkoly</h1>
                  <p className="mt-0.5 text-sm text-[#6B7280]">
                    {activeTasks.length} aktivních, {completedTasks.length} hotových
                  </p>
                </div>
                {completedTasks.length > 0 && (
                  <button
                    type="button"
                    onClick={deleteCompletedTasks}
                    className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-[#6B7280] transition-colors hover:text-red-400"
                  >
                    <Trash2 size={14} />
                    Vyčistit
                  </button>
                )}
              </div>
              <div className="space-y-3">
                <AnimatePresence mode="popLayout">
                  {activeTasks.length > 0 ? (
                    activeTasks.map((task) => renderTaskCard(task))
                  ) : (
                    <div className="rounded-2xl bg-[#1C1C1E] py-16 text-center text-[#6B7280]">
                      <Inbox size={48} className="mx-auto mb-3 opacity-30" />
                      <p className="font-medium">Žádné úkoly</p>
                      <p className="mt-1 text-sm opacity-70">Použijte sloupec vlevo pro přidání</p>
                    </div>
                  )}
                </AnimatePresence>
                {completedTasks.length > 0 && (
                  <div className="mt-6">
                    <button
                      type="button"
                      onClick={() => setShowCompleted(!showCompleted)}
                      className="mb-3 flex items-center gap-2 text-sm font-medium text-[#6B7280] transition-colors hover:text-white"
                    >
                      {showCompleted ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                      Hotové ({completedTasks.length})
                    </button>
                    <AnimatePresence>
                      {showCompleted && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="space-y-2 overflow-hidden"
                        >
                          {completedTasks.map((task) => renderTaskCard(task))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}
              </div>
            </section>
          </div>

      </div>

      {/* Side Panel for Event Detail with Pipedrive Data - Full screen modal on mobile */}
      {selectedEvent && (
        <div className="fixed inset-0 z-50 lg:relative lg:inset-auto lg:z-auto w-full lg:w-[300px] h-full bg-[#1C1C1E] lg:border-l border-white/10 flex flex-col shrink-0">
          {/* Header */}
          <div className="bg-[#3B82F6] p-4 flex items-start justify-between shrink-0">
            <div className="flex-1 min-w-0">
              <h2 className="text-white text-lg font-bold truncate">{selectedEvent.title}</h2>
              <div className="flex flex-wrap items-center gap-3 mt-2 text-white/80 text-sm">
                <span className="flex items-center gap-1">
                  <Clock size={14} />
                  {selectedEvent.allDay ? 'Celý den' : formatEventTime(selectedEvent.start)}
                  {!selectedEvent.allDay && selectedEvent.end && ` - ${formatEventTime(selectedEvent.end)}`}
                </span>
                {selectedEvent.location && (
                  <span className="flex items-center gap-1 truncate max-w-[200px]">
                    <MapPin size={14} />
                    {selectedEvent.location}
                  </span>
                )}
              </div>
            </div>
            <button 
              onClick={() => setSelectedEvent(null)}
              className="p-2 hover:bg-white/20 rounded-lg transition-colors shrink-0"
            >
              <X size={20} className="text-white" />
            </button>
          </div>
          
          {/* Content */}
          <div className="p-4 overflow-y-auto flex-1 space-y-4">
                {/* Event description */}
                {selectedEvent.description && (
                  <div className="bg-[#252528] rounded-xl p-4">
                    <h3 className="text-white font-semibold mb-2 flex items-center gap-2">
                      <FileText size={16} className="text-[#3B82F6]" />
                      Popis události
                    </h3>
                    <p className="text-[#9CA3AF] text-sm whitespace-pre-wrap">{selectedEvent.description}</p>
                  </div>
                )}
                
                {/* Actions */}
                <div className="flex gap-2">
                  <a 
                    href={selectedEvent.htmlLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-[#3B82F6] hover:bg-[#2563EB] text-white rounded-xl font-medium transition-colors"
                  >
                    <ExternalLink size={16} />
                    Otevřít v Kalendáři
                  </a>
                  {selectedEvent.location && (
                    <a 
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(selectedEvent.location)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 px-4 py-2.5 bg-[#F97316] hover:bg-[#EA580C] text-white rounded-xl font-medium transition-colors"
                    >
                      <Navigation size={16} />
                      Navigovat
                    </a>
                  )}
                </div>
                
                {/* Pipedrive Data */}
                <div className="border-t border-white/10 pt-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-white font-semibold flex items-center gap-2">
                      <Briefcase size={16} className="text-[#10B981]" />
                      Data z CRM (Pipedrive)
                      {pipedriveData?.isSaved && (
                        <span className="text-xs bg-[#10B981]/20 text-[#10B981] px-2 py-0.5 rounded-full">
                          ✓ Uloženo
                        </span>
                      )}
                    </h3>
                    {pipedriveData && !loadingPipedrive && (
                      <div className="flex gap-2">
                        {pipedriveData.isSaved ? (
                          <>
                                        <button 
                              onClick={() => selectedEvent && fetchPipedriveData(selectedEvent, true)}
                              className="text-xs px-3 py-1.5 bg-[#3B82F6]/20 text-[#3B82F6] rounded-lg hover:bg-[#3B82F6]/30 transition-colors flex items-center gap-1"
                                        >
                              <RefreshCw size={12} />
                              Aktualizovat
                                        </button>
                            <button
                              onClick={() => selectedEvent && removeAssignment(selectedEvent.id)}
                              className="text-xs px-3 py-1.5 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-colors flex items-center gap-1"
                            >
                              <X size={12} />
                              Zrušit
                                        </button>
                          </>
                        ) : null}
                      </div>
                    )}
                  </div>
                  
                  {loadingPipedrive ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 size={24} className="animate-spin text-[#3B82F6]" />
                      <span className="ml-2 text-[#6B7280]">AI hledá v Pipedrive...</span>
                    </div>
                  ) : pipedriveData ? (
                    <div className="space-y-4">
                      {/* Search terms used */}
                      {pipedriveData.searchTermsUsed?.length > 0 && (
                        <div className="flex items-center gap-2 text-xs text-[#6B7280]">
                          <Tag size={12} />
                          Hledáno: {pipedriveData.searchTermsUsed.map((term: string, i: number) => (
                            <span key={i} className="px-2 py-0.5 bg-[#3B82F6]/20 text-[#3B82F6] rounded-full">
                              {term}
                            </span>
                          ))}
                        </div>
                      )}
                      
                      {/* Organizations */}
                      {pipedriveData.organizations?.length > 0 && (
                        <div className="bg-[#252528] rounded-xl p-4">
                          <h4 className="text-[#10B981] font-medium mb-3 flex items-center gap-2">
                            <Building2 size={16} />
                            Školy / Organizace ({pipedriveData.organizations.length})
                          </h4>
                          <div className="space-y-4">
                            {pipedriveData.organizations.slice(0, 3).map((org: any) => (
                              <div key={org.id} className="bg-[#1C1C1E] rounded-lg p-4 space-y-3">
                                {/* Org header */}
                                <div className="border-b border-white/10 pb-3">
                                  <div className="flex items-start justify-between">
                                    <p className="text-white font-bold text-lg">{org.name}</p>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        selectedEvent && removeOrganization(selectedEvent.id, org.id);
                                      }}
                                      className="p-1 hover:bg-red-500/20 rounded-lg transition-colors group"
                                      title="Odebrat organizaci"
                                    >
                                      <X size={16} className="text-[#6B7280] group-hover:text-red-400" />
                                    </button>
                                  </div>
                                  
                                  {/* Labels */}
                                  {org.label && (
                                    <span className="inline-block mt-1 text-[10px] px-2 py-0.5 bg-[#10B981]/20 text-[#10B981] rounded-full font-medium">
                                      {org.label}
                                    </span>
                                  )}
                                  
                                  {org.address && (
                                    <p className="text-[#6B7280] text-sm flex items-center gap-1 mt-1">
                                      <MapPin size={12} /> {org.address}
                                    </p>
                                  )}
                                  {org.owner_name && (
                                    <p className="text-[#6B7280] text-sm flex items-center gap-1 mt-1">
                                      <User size={12} /> Vlastník: {org.owner_name}
                                    </p>
                                  )}
                                </div>
                                
                                {/* Products overview */}
                                {(org.productCategories?.length > 0 || org.purchasedSubjects?.length > 0) && (
                                  <div className="bg-[#3B82F6]/10 rounded-lg p-3">
                                    <p className="text-[#3B82F6] font-medium text-sm mb-2 flex items-center gap-1">
                                      <Briefcase size={12} /> Produkty
                                    </p>
                                    <div className="flex flex-wrap gap-1.5">
                                      {org.productCategories?.map((cat: string, i: number) => (
                                        <span key={`cat-${i}`} className="text-xs px-2 py-1 bg-[#3B82F6] text-white rounded-full font-medium">
                                          {cat}
                                        </span>
                                      ))}
                                    </div>
                                    {org.purchasedSubjects?.length > 0 && (
                                      <div className="mt-2">
                                        <p className="text-[#6B7280] text-xs mb-1">Předměty:</p>
                                        <div className="flex flex-wrap gap-1">
                                          {org.purchasedSubjects.map((subj: string, i: number) => (
                                            <span key={`subj-${i}`} className="text-[10px] px-1.5 py-0.5 bg-[#252528] text-white rounded">
                                              {subj}
                                            </span>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                )}
                                
                                {/* Access codes */}
                                {(org.teacherCode || org.studentCode) && (
                                  <div className="bg-[#10B981]/10 rounded-lg p-3">
                                    <p className="text-[#10B981] font-medium text-sm mb-1 flex items-center gap-1">
                                      <Hash size={12} /> Přístupové kódy
                                    </p>
                                    <div className="grid grid-cols-2 gap-2 text-sm">
                                      {org.teacherCode && (
                                        <div>
                                          <span className="text-[#6B7280]">Učitel:</span>
                                          <code className="ml-2 text-white font-mono">{org.teacherCode}</code>
                                        </div>
                                      )}
                                      {org.studentCode && (
                                        <div>
                                          <span className="text-[#6B7280]">Žák:</span>
                                          <code className="ml-2 text-white font-mono">{org.studentCode}</code>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                )}
                                
                                {/* Persons in this org */}
                                {org.persons?.length > 0 && (
                                  <div>
                                    <p className="text-[#8B5CF6] font-medium text-sm mb-2 flex items-center gap-1">
                                      <User size={12} /> Kontakty ({org.persons.length})
                                    </p>
                                    <div className="grid grid-cols-1 gap-2 max-h-80 overflow-y-auto">
                                      {org.persons.map((person: any) => (
                                        <div key={person.id} className="bg-[#252528] rounded-lg p-2.5 text-sm">
                                          <p className="text-white font-medium">{person.name}</p>
                                          
                                          {/* Position, subjects, stupen tags */}
                                          {(person.position || person.subjects?.length > 0 || person.stupen) && (
                                            <div className="flex flex-wrap gap-1 mt-1.5">
                                              {person.position && (
                                                <span className="text-[10px] px-2 py-0.5 bg-[#8B5CF6]/20 text-[#8B5CF6] rounded-full font-medium">
                                                  {person.position}
                                                </span>
                                              )}
                                              {person.subjects?.map((subj: string, i: number) => (
                                                <span key={i} className="text-[10px] px-2 py-0.5 bg-[#3B82F6]/20 text-[#3B82F6] rounded-full">
                                                  {subj}
                                                </span>
                                              ))}
                                              {person.stupen && (
                                                <span className="text-[10px] px-2 py-0.5 bg-[#10B981]/20 text-[#10B981] rounded-full">
                                                  {person.stupen}
                                                </span>
                                              )}
                                            </div>
                                          )}
                                          
                                          {/* Contact info */}
                                          <div className="mt-1.5 space-y-0.5">
                                            {person.email?.[0]?.value && (
                                              <p className="text-[#6B7280] text-xs flex items-center gap-1 truncate">
                                                <Mail size={10} /> {person.email[0].value}
                                              </p>
                                            )}
                                            {person.phone?.[0]?.value && (
                                              <p className="text-[#6B7280] text-xs flex items-center gap-1">
                                                <Phone size={10} /> {person.phone[0].value}
                                              </p>
                                            )}
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                                
                                {/* Deals for this org */}
                                {org.deals?.length > 0 && (
                                  <div>
                                    <p className="text-[#F59E0B] font-medium text-sm mb-2 flex items-center gap-1">
                                      <DollarSign size={12} /> Dealy ({org.deals.length})
                                    </p>
                                    <div className="space-y-1">
                                      {org.deals.slice(0, 5).map((deal: any) => {
                                        const statusColors: Record<string, string> = {
                                          won: 'text-[#10B981] bg-[#10B981]/10',
                                          open: 'text-[#F59E0B] bg-[#F59E0B]/10',
                                          lost: 'text-[#EF4444] bg-[#EF4444]/10'
                                        };
                                        const valueColors: Record<string, string> = {
                                          won: 'text-[#10B981]',
                                          open: 'text-[#F59E0B]',
                                          lost: 'text-[#EF4444] line-through'
                                        };
                                        return (
                                          <div key={deal.id} className="bg-[#252528] rounded-lg p-2 flex items-center justify-between text-sm">
                                            <div className="flex-1 min-w-0">
                                              <p className="text-white truncate">{deal.title}</p>
                                              <span className={`text-xs px-1.5 py-0.5 rounded ${statusColors[deal.status] || 'text-[#6B7280]'}`}>
                                                {deal.status === 'won' ? '✓ won' : deal.status === 'lost' ? '✗ lost' : '○ open'}
                                              </span>
                                            </div>
                                            {deal.value > 0 && (
                                              <span className={`font-bold ml-2 shrink-0 ${valueColors[deal.status] || 'text-white'}`}>
                                                {deal.value.toLocaleString()} {deal.currency}
                                              </span>
                                            )}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                )}
                                
                                {/* Activities toggle button */}
                                <button
                                  onClick={() => fetchOrgActivities(org.id)}
                                  disabled={loadingActivities === org.id}
                                  className="w-full mt-2 py-2 px-3 bg-[#252528] hover:bg-[#2f2f32] rounded-lg text-sm font-medium text-[#9CA3AF] hover:text-white transition-colors flex items-center justify-center gap-2"
                                >
                                  {loadingActivities === org.id ? (
                                    <Loader2 size={14} className="animate-spin" />
                                  ) : (
                                    <History size={14} />
                                  )}
                                  {expandedOrgActivities[org.id] ? 'Skrýt aktivitu' : 'Zobrazit aktivitu obchodníka'}
                                </button>
                                
                                {/* Activities panel */}
                                <AnimatePresence>
                                  {expandedOrgActivities[org.id] && (
                                    <motion.div
                                      initial={{ height: 0, opacity: 0 }}
                                      animate={{ height: 'auto', opacity: 1 }}
                                      exit={{ height: 0, opacity: 0 }}
                                      className="overflow-hidden"
                                    >
                                      <div className="mt-3 space-y-3">
                                        {/* Upcoming activities */}
                                        {expandedOrgActivities[org.id].filter((a: any) => a.isUpcoming).length > 0 && (
                                          <div>
                                            <p className="text-[#F59E0B] font-medium text-xs mb-2 flex items-center gap-1">
                                              <Clock size={10} /> Naplánované
                                            </p>
                                            <div className="space-y-1">
                                              {expandedOrgActivities[org.id].filter((a: any) => a.isUpcoming).map((activity: any) => (
                                                <div key={activity.id} className="bg-[#F59E0B]/10 border border-[#F59E0B]/30 rounded-lg p-2 text-sm">
                                                  <div className="flex items-center gap-2">
                                                    {activity.type === 'call' && <PhoneCall size={12} className="text-[#F59E0B]" />}
                                                    {activity.type === 'meeting' && <Users size={12} className="text-[#F59E0B]" />}
                                                    {activity.type === 'email' && <Send size={12} className="text-[#F59E0B]" />}
                                                    {!['call', 'meeting', 'email'].includes(activity.type) && <Calendar size={12} className="text-[#F59E0B]" />}
                                                    <span className="text-white font-medium">{activity.subject}</span>
                                                  </div>
                                                  <p className="text-[#6B7280] text-xs mt-1">
                                                    📅 {activity.dueDate} {activity.dueTime && `v ${activity.dueTime}`}
                                                    {activity.personName && ` • 👤 ${activity.personName}`}
                                                  </p>
                                                </div>
                                              ))}
                                            </div>
                                          </div>
                                        )}
                                        
                                        {/* Past activities */}
                                        {expandedOrgActivities[org.id].filter((a: any) => !a.isUpcoming).length > 0 && (
                                          <div>
                                            <p className="text-[#10B981] font-medium text-xs mb-2 flex items-center gap-1">
                                              <CheckCircle2 size={10} /> Historie aktivit
                                            </p>
                                            <div className="space-y-1 max-h-48 overflow-y-auto">
                                              {expandedOrgActivities[org.id].filter((a: any) => !a.isUpcoming).slice(0, 10).map((activity: any) => (
                                                <div key={activity.id} className="bg-[#252528] rounded-lg p-2 text-sm">
                                                  <div className="flex items-center gap-2">
                                                    {activity.type === 'call' && <PhoneCall size={12} className="text-[#3B82F6]" />}
                                                    {activity.type === 'meeting' && <Users size={12} className="text-[#8B5CF6]" />}
                                                    {activity.type === 'email' && <Send size={12} className="text-[#10B981]" />}
                                                    {!['call', 'meeting', 'email'].includes(activity.type) && <Calendar size={12} className="text-[#6B7280]" />}
                                                    <span className="text-white">{activity.subject}</span>
                                                  </div>
                                                  <p className="text-[#6B7280] text-xs mt-1">
                                                    ✓ {activity.markedAsDoneTime?.split(' ')[0] || activity.dueDate}
                                                    {activity.ownerName && ` • ${activity.ownerName}`}
                                                    {activity.personName && ` • 👤 ${activity.personName}`}
                                                  </p>
                                                  {activity.note && (
                                                    <p className="text-[#9CA3AF] text-xs mt-1 line-clamp-2 italic">
                                                      "{activity.note.replace(/<[^>]*>/g, '').slice(0, 100)}..."
                                                    </p>
                                                  )}
                                                </div>
                                              ))}
                                            </div>
                                          </div>
                                        )}
                                        
                                        {expandedOrgActivities[org.id].length === 0 && (
                                          <div className="text-center py-4 text-[#6B7280] text-sm">
                                            Žádná aktivita nenalezena
                                          </div>
                                        )}
                                      </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                              </div>
                            ))}
                          </div>
                </div>
            )}
                      
                      {/* No data found */}
                      {!pipedriveData.organizations?.length && 
                       !pipedriveData.persons?.length && 
                       !pipedriveData.deals?.length && (
                        <div className="text-center py-6 text-[#6B7280]">
                          <Building2 size={32} className="mx-auto mb-2 opacity-30" />
                          <p>Žádná data nenalezena pro "{selectedEvent.title}"</p>
        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-6 text-[#6B7280]">
                      <Building2 size={32} className="mx-auto mb-2 opacity-30" />
                      <p>Klikněte pro načtení dat z Pipedrive</p>
                    </div>
                  )}
                </div>
              </div>
        </div>
      )}
     </div>
  );
};
