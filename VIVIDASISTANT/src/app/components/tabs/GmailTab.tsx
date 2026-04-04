import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Mail, Search, Send, RefreshCw, Inbox, Star, Clock, Loader2, ArrowLeft, Reply, Mic, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { projectId } from '/utils/supabase/info';
import { getEdgeFunctionHeaders } from '@/lib/edgeFunctionHeaders';
import { RecordButton } from '@/app/components/figma/RecordButton';
import { useApp } from '@/app/contexts/AppContext';

interface Email {
  id: string;
  threadId?: string;
  from: string;
  subject: string;
  snippet: string;
  date: string;
  isUnread: boolean;
  body?: string;
}

export const GmailTab: React.FC = () => {
  const { transcribeAudio } = useApp();
  const [emails, setEmails] = useState<Email[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
  const [isLoadingEmail, setIsLoadingEmail] = useState(false);
  
  // Search
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  
  // Compose
  const [showCompose, setShowCompose] = useState(false);
  const [composeTo, setComposeTo] = useState("");
  const [composeSubject, setComposeSubject] = useState("");
  const [composeBody, setComposeBody] = useState("");
  const [isSending, setIsSending] = useState(false);
  
  // Voice
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const mediaRecorderRef = React.useRef<MediaRecorder | null>(null);
  const audioChunksRef = React.useRef<Blob[]>([]);

  const getGoogleToken = () => localStorage.getItem('google_provider_token');

  const fetchEmails = async (query?: string) => {
    const token = getGoogleToken();
    if (!token) {
      toast.error("Připojte Gmail v Nastavení");
      return;
    }

    setIsLoading(true);
    try {
      const headers = await getEdgeFunctionHeaders(true);
      const response = await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-954b19ad/gmail/messages`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ googleAccessToken: token, maxResults: 20, query })
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.error === 'token_expired' || data.error === 'google_auth_required') {
          toast.error("Platnost připojení vypršela. Připojte Gmail znovu v Nastavení.");
          return;
        }
        throw new Error(data.error || "Nepodařilo se načíst emaily");
      }

      setEmails(data.messages || []);
      toast.success(`Načteno ${data.messages?.length || 0} emailů`);

    } catch (error: any) {
      console.error(error);
      toast.error(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchEmailDetail = async (email: Email) => {
    const token = getGoogleToken();
    if (!token) return;

    setIsLoadingEmail(true);
    setSelectedEmail(email);

    try {
      const headers = await getEdgeFunctionHeaders(true);
      const response = await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-954b19ad/gmail/message/${email.id}`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ googleAccessToken: token })
      });

      const data = await response.json();

      if (response.ok) {
        setSelectedEmail({ ...email, body: data.body, from: data.from, subject: data.subject });
      }
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoadingEmail(false);
    }
  };

  const handleSearch = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!searchQuery.trim()) {
      fetchEmails();
      return;
    }

    const token = getGoogleToken();
    if (!token) {
      toast.error("Připojte Gmail v Nastavení");
      return;
    }

    setIsSearching(true);
    try {
      const headers = await getEdgeFunctionHeaders(true);
      const response = await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-954b19ad/gmail/search`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ googleAccessToken: token, query: searchQuery })
      });

      const data = await response.json();

      if (response.ok) {
        setEmails(data.messages || []);
        toast.success(`Nalezeno ${data.messages?.length || 0} emailů`);
      }
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSendEmail = async () => {
    const token = getGoogleToken();
    if (!token) {
      toast.error("Připojte Gmail v Nastavení");
      return;
    }

    if (!composeTo || !composeSubject || !composeBody) {
      toast.error("Vyplňte všechna pole");
      return;
    }

    setIsSending(true);
    try {
      const headers = await getEdgeFunctionHeaders(true);
      const response = await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-954b19ad/gmail/send`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          googleAccessToken: token,
          to: composeTo,
          subject: composeSubject,
          body: composeBody
        })
      });

      const data = await response.json();

      if (response.ok) {
        toast.success("Email odeslán!");
        setShowCompose(false);
        setComposeTo("");
        setComposeSubject("");
        setComposeBody("");
      } else {
        throw new Error(data.error || "Nepodařilo se odeslat");
      }
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsSending(false);
    }
  };

  const handleReply = () => {
    if (!selectedEmail) return;
    
    // Extract email address from "Name <email@example.com>" format
    const fromMatch = selectedEmail.from.match(/<(.+?)>/) || [null, selectedEmail.from];
    const replyTo = fromMatch[1] || selectedEmail.from;
    
    setComposeTo(replyTo);
    setComposeSubject(`Re: ${selectedEmail.subject}`);
    setComposeBody(`\n\n---\nOd: ${selectedEmail.from}\nPředmět: ${selectedEmail.subject}\n\n${selectedEmail.body || selectedEmail.snippet}`);
    setShowCompose(true);
    setSelectedEmail(null);
  };

  // Voice recording for search
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach(track => track.stop());
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        
        setIsTranscribing(true);
        try {
          const transcribed = await transcribeAudio(audioBlob);
          setSearchQuery(transcribed);
          toast.success("Přepis dokončen");
        } catch (err: any) {
          toast.error("Chyba přepisu");
        } finally {
          setIsTranscribing(false);
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      toast.error("Chyba mikrofonu");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      const now = new Date();
      const diff = now.getTime() - date.getTime();
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      
      if (days === 0) return date.toLocaleTimeString('cs', { hour: '2-digit', minute: '2-digit' });
      if (days === 1) return 'Včera';
      if (days < 7) return date.toLocaleDateString('cs', { weekday: 'short' });
      return date.toLocaleDateString('cs', { day: 'numeric', month: 'short' });
    } catch {
      return dateStr;
    }
  };

  const extractName = (from: string) => {
    const match = from.match(/^([^<]+)/);
    return match ? match[1].trim().replace(/"/g, '') : from;
  };

  // Load emails on mount if token exists
  useEffect(() => {
    if (getGoogleToken()) {
      fetchEmails();
    }
  }, []);

  // If no token, show connect prompt
  if (!getGoogleToken()) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-6">
        <div className="w-20 h-20 bg-gradient-to-br from-red-500 to-orange-500 rounded-3xl flex items-center justify-center mb-6 shadow-lg shadow-red-500/20">
          <Mail size={40} className="text-white" />
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">Připojte Gmail</h2>
        <p className="text-[#8E8E93] mb-6 max-w-sm">
          Pro používání emailu se přihlaste přes Google v Nastavení.
        </p>
        <p className="text-sm text-[#636366]">
          Klikněte na ⚙️ Nastavení → Připojit / Obnovit přístup
        </p>
      </div>
    );
  }

  // Compose view
  if (showCompose) {
    return (
      <div className="w-full max-w-2xl mx-auto pb-32">
        <div className="flex items-center gap-4 mb-6">
          <button 
            onClick={() => setShowCompose(false)}
            className="p-2 hover:bg-white/10 rounded-xl transition-colors"
          >
            <ArrowLeft size={24} className="text-white" />
          </button>
          <h1 className="text-2xl font-bold text-white">Nový email</h1>
        </div>

        <div className="bg-[#1A1A20] border border-white/5 rounded-2xl p-6 space-y-4">
          <input
            type="email"
            value={composeTo}
            onChange={(e) => setComposeTo(e.target.value)}
            placeholder="Komu (email)"
            className="w-full p-3 bg-[#15151A] border border-white/5 rounded-xl text-white placeholder-[#6B7280] focus:outline-none focus:ring-2 focus:ring-red-500/50"
          />
          <input
            type="text"
            value={composeSubject}
            onChange={(e) => setComposeSubject(e.target.value)}
            placeholder="Předmět"
            className="w-full p-3 bg-[#15151A] border border-white/5 rounded-xl text-white placeholder-[#6B7280] focus:outline-none focus:ring-2 focus:ring-red-500/50"
          />
          <textarea
            value={composeBody}
            onChange={(e) => setComposeBody(e.target.value)}
            placeholder="Zpráva..."
            rows={10}
            className="w-full p-3 bg-[#15151A] border border-white/5 rounded-xl text-white placeholder-[#6B7280] focus:outline-none focus:ring-2 focus:ring-red-500/50 resize-none"
          />
          
          <button
            onClick={handleSendEmail}
            disabled={isSending || !composeTo || !composeSubject || !composeBody}
            className="w-full py-3 bg-red-500 hover:bg-red-600 disabled:bg-red-500/50 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            {isSending ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />}
            Odeslat
          </button>
        </div>
      </div>
    );
  }

  // Email detail view
  if (selectedEmail) {
    return (
      <div className="w-full max-w-2xl mx-auto pb-32">
        <div className="flex items-center gap-4 mb-6">
          <button 
            onClick={() => setSelectedEmail(null)}
            className="p-2 hover:bg-white/10 rounded-xl transition-colors"
          >
            <ArrowLeft size={24} className="text-white" />
          </button>
          <h1 className="text-xl font-bold text-white truncate flex-1">{selectedEmail.subject}</h1>
        </div>

        <div className="bg-[#1A1A20] border border-white/5 rounded-2xl p-6">
          <div className="flex items-start gap-4 mb-4 pb-4 border-b border-white/5">
            <div className="w-12 h-12 bg-gradient-to-br from-red-500 to-orange-500 rounded-full flex items-center justify-center text-white font-bold text-lg shrink-0">
              {extractName(selectedEmail.from).charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white font-medium truncate">{extractName(selectedEmail.from)}</p>
              <p className="text-[#8E8E93] text-sm truncate">{selectedEmail.from}</p>
              <p className="text-[#636366] text-xs mt-1">{formatDate(selectedEmail.date)}</p>
            </div>
          </div>

          {isLoadingEmail ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 size={24} className="animate-spin text-[#8E8E93]" />
            </div>
          ) : (
            <div className="text-[#A0A0A5] whitespace-pre-wrap text-sm leading-relaxed">
              {selectedEmail.body || selectedEmail.snippet}
            </div>
          )}

          <div className="mt-6 pt-4 border-t border-white/5">
            <button
              onClick={handleReply}
              className="w-full py-3 bg-[#2A2A30] hover:bg-[#3A3A40] text-white font-medium rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              <Reply size={18} />
              Odpovědět
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Main inbox view
  return (
    <div className="w-full max-w-2xl mx-auto pb-32">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-gradient-to-br from-red-500 to-orange-500 rounded-2xl flex items-center justify-center shadow-lg shadow-red-500/20">
            <Mail size={28} className="text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-white tracking-tight">Gmail</h1>
            <p className="text-[#8E8E93] text-sm">{emails.length} emailů</p>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => fetchEmails()}
            disabled={isLoading}
            className="p-3 bg-[#1F1F24] hover:bg-[#2A2A30] rounded-xl transition-colors"
          >
            <RefreshCw size={20} className={`text-white ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setShowCompose(true)}
            className="p-3 bg-red-500 hover:bg-red-600 rounded-xl transition-colors"
          >
            <Send size={20} className="text-white" />
          </button>
        </div>
      </div>

      {/* Search */}
      <form onSubmit={handleSearch} className="mb-6 relative flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[#6B7280]" size={20} />
          <input 
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Hledat emaily... (např. 'nepřečtené od Petra')"
            className="w-full bg-[#15151A] border border-white/5 rounded-2xl p-4 pl-12 pr-4 text-white placeholder-[#6B7280] focus:outline-none focus:ring-2 focus:ring-red-500/50"
          />
        </div>
        <button
          type="button"
          onClick={isRecording ? stopRecording : startRecording}
          className={`p-4 rounded-2xl transition-colors ${isRecording ? 'bg-red-500 animate-pulse' : 'bg-[#2A2A30] hover:bg-[#3A3A40]'}`}
        >
          <Mic size={20} className="text-white" />
        </button>
        {searchQuery && (
          <button
            type="submit"
            disabled={isSearching}
            className="p-4 bg-red-500 hover:bg-red-600 rounded-2xl transition-colors"
          >
            {isSearching ? <Loader2 size={20} className="animate-spin text-white" /> : <Search size={20} className="text-white" />}
          </button>
        )}
      </form>

      {/* Quick filters */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        <button
          onClick={() => fetchEmails('is:unread')}
          className="px-4 py-2 bg-[#1F1F24] hover:bg-[#2A2A30] border border-white/5 rounded-xl text-sm text-white whitespace-nowrap flex items-center gap-2"
        >
          <Inbox size={16} /> Nepřečtené
        </button>
        <button
          onClick={() => fetchEmails('is:starred')}
          className="px-4 py-2 bg-[#1F1F24] hover:bg-[#2A2A30] border border-white/5 rounded-xl text-sm text-white whitespace-nowrap flex items-center gap-2"
        >
          <Star size={16} /> Důležité
        </button>
        <button
          onClick={() => fetchEmails('newer_than:7d')}
          className="px-4 py-2 bg-[#1F1F24] hover:bg-[#2A2A30] border border-white/5 rounded-xl text-sm text-white whitespace-nowrap flex items-center gap-2"
        >
          <Clock size={16} /> Tento týden
        </button>
      </div>

      {/* Email list */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={32} className="animate-spin text-[#8E8E93]" />
        </div>
      ) : emails.length === 0 ? (
        <div className="text-center py-20 text-[#8E8E93]">
          <Mail size={48} className="mx-auto mb-4 opacity-50" />
          <p>Žádné emaily</p>
          <button 
            onClick={() => fetchEmails()}
            className="mt-4 text-red-500 hover:text-red-400"
          >
            Načíst emaily
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          <AnimatePresence>
            {emails.map((email, i) => (
              <motion.button
                key={email.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                onClick={() => fetchEmailDetail(email)}
                className={`w-full text-left p-4 rounded-2xl border transition-all ${
                  email.isUnread 
                    ? 'bg-[#1A1A20] border-red-500/20 hover:border-red-500/40' 
                    : 'bg-[#15151A] border-white/5 hover:border-white/10'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold shrink-0 ${
                    email.isUnread ? 'bg-gradient-to-br from-red-500 to-orange-500' : 'bg-[#3A3A40]'
                  }`}>
                    {extractName(email.from).charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <p className={`font-medium truncate ${email.isUnread ? 'text-white' : 'text-[#A0A0A5]'}`}>
                        {extractName(email.from)}
                      </p>
                      <span className="text-xs text-[#636366] whitespace-nowrap">{formatDate(email.date)}</span>
                    </div>
                    <p className={`text-sm truncate mb-1 ${email.isUnread ? 'text-white font-medium' : 'text-[#8E8E93]'}`}>
                      {email.subject || '(bez předmětu)'}
                    </p>
                    <p className="text-xs text-[#636366] truncate">{email.snippet}</p>
                  </div>
                  <ChevronRight size={18} className="text-[#636366] shrink-0 self-center" />
                </div>
              </motion.button>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
};
