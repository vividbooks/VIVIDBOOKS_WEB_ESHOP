import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Search, Building2, User, Phone, Mail, Briefcase, Loader2, Mic, Send, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { projectId, publicAnonKey } from '/utils/supabase/info';
import { RecordButton } from '@/app/components/figma/RecordButton';
import { useApp } from '@/app/contexts/AppContext';

interface CrmResult {
  query: string;
  parsedQuery: {
    type: string;
    searchTerm: string;
    intent: string;
  };
  data: any;
  summary: string;
}

export const CrmTab: React.FC = () => {
  const { transcribeAudio } = useApp();
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<CrmResult | null>(null);
  const [history, setHistory] = useState<CrmResult[]>([]);
  
  // Recording State
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Timer Logic
  useEffect(() => {
    if (isRecording) {
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRecording]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!query.trim() || isLoading) return;

    setIsLoading(true);
    try {
      const response = await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-954b19ad/crm/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: query.trim() })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Nepodařilo se dotázat CRM");
      }

      setResult(data);
      setHistory(prev => [data, ...prev.slice(0, 9)]); // Keep last 10
      setQuery("");
      toast.success("Nalezeno!");

    } catch (error: any) {
      console.error(error);
      toast.error(error.message || "Chyba při dotazu");
    } finally {
      setIsLoading(false);
    }
  };

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
          const transcribed = await transcribeAudio(audioBlob);
          setQuery(transcribed);
          toast.success("Přepis dokončen");
        } catch (err: any) {
          console.error(err);
          toast.error("Chyba přepisu: " + (err.message || "Neznámá chyba"));
        } finally {
          setIsTranscribing(false);
          setRecordingTime(0);
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
      toast("Poslouchám...");
    } catch (err: any) {
      console.error("Error accessing microphone:", err);
      toast.error("Chyba mikrofonu: " + (err.message || "Zkontrolujte oprávnění"));
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

  // Quick action buttons
  const quickActions = [
    { label: "Najdi školu...", query: "Najdi mi školu " },
    { label: "Kontakt na...", query: "Jaké je číslo na " },
    { label: "Dealy školy...", query: "Jaké dealy máme se školou " },
  ];

  return (
    <div className="w-full max-w-2xl mx-auto pb-32">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <div className="w-14 h-14 bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl flex items-center justify-center shadow-lg shadow-purple-500/20">
          <Building2 size={28} className="text-white" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Pipedrive CRM</h1>
          <p className="text-[#8E8E93] text-sm">Ptejte se na cokoli o vašich kontaktech</p>
        </div>
      </div>

      {/* Voice Input Area */}
      <div className="flex flex-col items-center justify-center mb-8">
        <div className="relative group cursor-pointer">
          {isRecording && (
            <div className="absolute inset-0 rounded-full bg-purple-500/30 animate-ping scale-150" />
          )}
          <div className="absolute inset-0 bg-purple-500/20 blur-xl rounded-full scale-110 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          
          <RecordButton 
            isRecording={isRecording}
            isProcessing={isTranscribing}
            onClick={handleRecordToggle}
            className="w-20 h-20 shadow-2xl shadow-purple-900/20 z-10 relative border-4 border-[#121212]"
          />
        </div>
        <p className="text-[#6B7280] text-sm mt-4 font-medium">
          {isRecording ? (
            <span className="text-purple-400 animate-pulse">{formatTime(recordingTime)} • Nahrávám...</span>
          ) : isTranscribing ? (
            <span className="text-purple-400 animate-pulse">Zpracovávám...</span>
          ) : (
            "Klepněte a zeptejte se hlasem"
          )}
        </p>
      </div>

      {/* Text Input */}
      <form onSubmit={handleSubmit} className="mb-6 relative">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[#6B7280]" size={20} />
          <input 
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Např.: Jaké je číslo na pana Nováka ze ZŠ Dobříš?"
            className="w-full bg-[#15151A] border border-white/5 rounded-2xl p-4 pl-12 pr-14 text-white placeholder-[#6B7280] focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-transparent transition-all shadow-lg shadow-black/20"
            disabled={isLoading}
          />
          {query.trim() && (
            <button 
              type="submit" 
              disabled={isLoading}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-2.5 bg-purple-500 hover:bg-purple-600 disabled:opacity-50 rounded-xl text-white transition-colors"
            >
              {isLoading ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />}
            </button>
          )}
        </div>
      </form>

      {/* Quick Actions */}
      <div className="flex flex-wrap gap-2 mb-8">
        {quickActions.map((action, i) => (
          <button
            key={i}
            onClick={() => setQuery(action.query)}
            className="px-4 py-2 bg-[#1F1F24] hover:bg-[#2A2A30] border border-white/5 rounded-xl text-sm text-[#8E8E93] hover:text-white transition-colors"
          >
            {action.label}
          </button>
        ))}
      </div>

      {/* Result */}
      <AnimatePresence mode="wait">
        {result && (
          <motion.div
            key="result"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="bg-gradient-to-br from-[#1A1A20] to-[#15151A] border border-white/5 rounded-2xl p-6 shadow-xl"
          >
            {/* AI Summary */}
            <div className="flex items-start gap-3 mb-6">
              <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center shrink-0">
                <Sparkles size={20} className="text-white" />
              </div>
              <div className="flex-1">
                <h3 className="text-white font-semibold mb-2">AI Odpověď</h3>
                <div className="text-[#A0A0A5] text-sm leading-relaxed whitespace-pre-wrap">
                  {result.summary}
                </div>
              </div>
            </div>

            {/* Raw Data Preview */}
            {result.data && (
              <div className="border-t border-white/5 pt-4 mt-4">
                <details className="group">
                  <summary className="text-xs text-[#6B7280] cursor-pointer hover:text-white transition-colors">
                    Zobrazit surová data
                  </summary>
                  <pre className="mt-3 p-4 bg-black/30 rounded-xl text-xs text-[#8E8E93] overflow-x-auto max-h-[300px] overflow-y-auto">
                    {JSON.stringify(result.data, null, 2)}
                  </pre>
                </details>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* History */}
      {history.length > 1 && (
        <div className="mt-8">
          <h3 className="text-[#6B7280] text-sm font-medium mb-4">Historie dotazů</h3>
          <div className="flex flex-col gap-2">
            {history.slice(1).map((item, i) => (
              <button
                key={i}
                onClick={() => setResult(item)}
                className="text-left p-3 bg-[#15151A] hover:bg-[#1A1A20] border border-white/5 rounded-xl transition-colors"
              >
                <p className="text-white text-sm truncate">{item.query}</p>
                <p className="text-[#6B7280] text-xs truncate mt-1">{item.summary.slice(0, 80)}...</p>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
