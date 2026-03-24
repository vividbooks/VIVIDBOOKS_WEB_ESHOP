import React, { useEffect, useRef, useState } from 'react';
import { Copy, Trash2, Loader2, Check, X, Sparkles, BookOpen, Briefcase, Bot } from 'lucide-react';
import { toast } from 'sonner';
import { useApp } from '@/app/contexts/AppContext';
import clsx from 'clsx';
import { RecordButton } from '@/app/components/figma/RecordButton';

type DictationTarget = 'web-operator' | 'agent';

interface DictationTabProps {
  onRouteTranscript?: (target: DictationTarget, text: string) => void;
}

function detectAgentTarget(text: string): DictationTarget | null {
  const lower = text.toLowerCase();

  const webSignals = [
    'web',
    'webu',
    'web operátor',
    'produkt',
    'produkty',
    'mailing',
    'newsletter',
    'hero',
    'slider',
    'seo',
    'blog',
    'novinku',
    'novinka',
    'banner',
    'bannery',
    'cena na webu',
    'stránku',
    'stránce',
    'tab ',
    'canvas',
    'obsah webu',
    'shop',
    'e-shop',
  ];

  const crmSignals = [
    'škol',
    'škola',
    'ředitel',
    'kontakt',
    'kontakty',
    'pipedrive',
    'crm',
    'schůzk',
    'kalendář',
    'tras',
    'cest',
    'po cestě',
    'obchod',
    'zákazník',
    'lead',
    'mapa škol',
    'telefon',
    'email do školy',
  ];

  const hasWebSignal = webSignals.some((signal) => lower.includes(signal));
  const hasCrmSignal = crmSignals.some((signal) => lower.includes(signal));

  if (hasWebSignal && !hasCrmSignal) return 'web-operator';
  if (hasCrmSignal && !hasWebSignal) return 'agent';
  return null;
}

export const DictationTab: React.FC<DictationTabProps> = ({ onRouteTranscript }) => {
  const { shortcuts, transcribeAudio, smartEdit } = useApp();

  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [recordingTime, setRecordingTime] = useState(0);
  const [ragSuggestion, setRagSuggestion] = useState<string | null>(null);
  const [ragDocTitle, setRagDocTitle] = useState<string | null>(null);
  const [isGeneratingRag, setIsGeneratingRag] = useState(false);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const selectionRef = useRef<{ start: number; end: number; text: string } | null>(null);
  const lastAutoRoutedTextRef = useRef<string | null>(null);

  const updateSelection = () => {
    const textarea = textareaRef.current;
    if (textarea && textarea.selectionStart !== textarea.selectionEnd) {
      selectionRef.current = {
        start: textarea.selectionStart,
        end: textarea.selectionEnd,
        text: textarea.value.substring(textarea.selectionStart, textarea.selectionEnd),
      };
    } else {
      selectionRef.current = null;
    }
  };

  useEffect(() => {
    if (isRecording) {
      timerRef.current = setInterval(() => setRecordingTime((prev) => prev + 1), 1000);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
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

  const routeTranscriptIfNeeded = (text: string) => {
    const clean = text.trim();
    if (!clean || clean === lastAutoRoutedTextRef.current) return;
    const target = detectAgentTarget(clean);
    if (!target || !onRouteTranscript) return;
    lastAutoRoutedTextRef.current = clean;
    onRouteTranscript(target, clean);
    toast.success(target === 'web-operator' ? 'Posláno do Web operátora' : 'Posláno do Obchodníka pomocníka');
  };

  const startRecording = async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      toast.error('Váš prohlížeč nepodporuje nahrávání zvuku.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });

        setIsTranscribing(true);
        try {
          let newVoiceText = await transcribeAudio(audioBlob);

          shortcuts.forEach((shortcut) => {
            const regex = new RegExp(`\\b${shortcut.trigger}\\b`, 'gi');
            newVoiceText = newVoiceText.replace(regex, shortcut.replacement);
          });

          const currentSelection = selectionRef.current;
          const currentRagSuggestion = ragSuggestion;
          const baseText = currentRagSuggestion || transcript;

          let context: string | undefined;
          let selectionData: any = undefined;

          if (currentSelection?.text) {
            context = 'edit_selection';
            selectionData = currentSelection;
          } else if (currentRagSuggestion) {
            context = 'edit_rag_suggestion';
          }

          const response = await smartEdit(baseText, newVoiceText, context, undefined, selectionData);

          if (response && typeof response === 'object') {
            const cleanText = response.cleanText || response.text || newVoiceText;

            if (currentRagSuggestion) {
              setRagSuggestion(cleanText);
            } else {
              setTranscript(cleanText);

              if (response.ragSuggestion && response.ragSuggestion !== cleanText) {
                setRagSuggestion(response.ragSuggestion);
                setRagDocTitle(response.ragDocTitle || null);
                toast.info('Nalezen relevantní obsah z knihovny', { duration: 3000 });
              } else {
                routeTranscriptIfNeeded(cleanText);
              }
            }
          } else {
            const fallbackText = typeof response === 'string' ? response : newVoiceText;
            if (currentRagSuggestion) {
              setRagSuggestion(`${currentRagSuggestion}\n\n${fallbackText}`);
            } else {
              setTranscript(fallbackText);
              setRagSuggestion(null);
              setRagDocTitle(null);
              routeTranscriptIfNeeded(fallbackText);
            }
          }
        } catch (err: any) {
          console.error('Smart edit error:', err);
          toast.error('Chyba při zpracování: ' + (err.message || 'Neznámá chyba'));
        } finally {
          setIsTranscribing(false);
          setRecordingTime(0);
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
    } catch (err: any) {
      if (err.name === 'NotAllowedError') {
        toast.error('Přístup k mikrofonu byl zamítnut. Povolte jej v nastavení prohlížeče.', { duration: 5000 });
      } else if (err.name === 'NotFoundError') {
        toast.error('Nebyl nalezen žádný mikrofon.');
      } else {
        toast.error('Chyba mikrofonu: ' + (err.message || 'Zkontrolujte oprávnění'));
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
    if (isRecording) stopRecording();
    else startRecording();
  };

  const copyToClipboard = async () => {
    await navigator.clipboard.writeText(transcript);
    toast.success('Zkopírováno!');
  };

  const acceptRagSuggestion = () => {
    if (!ragSuggestion) return;
    setTranscript(ragSuggestion);
    setRagSuggestion(null);
    setRagDocTitle(null);
    toast.success('RAG obsah použit');
    routeTranscriptIfNeeded(ragSuggestion);
  };

  const rejectRagSuggestion = () => {
    setRagSuggestion(null);
    setRagDocTitle(null);
    toast('Návrh zamítnut');
  };

  const generateRagSuggestion = async () => {
    if (!transcript.trim() || isGeneratingRag) return;

    setIsGeneratingRag(true);
    try {
      const response = await smartEdit(transcript, '', 'manual_rag_trigger');
      if (response && response.ragSuggestion) {
        setRagSuggestion(response.ragSuggestion);
        setRagDocTitle(response.ragDocTitle || null);
        toast.success('Nalezen relevantní obsah z knihovny');
      } else {
        const reason = response?.ragSkipReason || 'Nenalezen žádný relevantní obsah';
        toast.info(reason, { duration: 4000 });
      }
    } catch (err: any) {
      console.error('RAG generation error:', err);
      toast.error('Chyba při hledání v knihovně');
    } finally {
      setIsGeneratingRag(false);
    }
  };

  return (
    <div className="flex flex-col h-full w-full relative bg-black md:bg-transparent">
      <div className="hidden md:flex shrink-0 items-center justify-between p-8 pb-4">
        <div className="flex items-center gap-8">
          <RecordButton
            isRecording={isRecording}
            isProcessing={isTranscribing}
            onClick={handleRecordToggle}
            className={clsx(
              'shadow-2xl transition-all duration-300 shrink-0 w-28 h-28',
              isTranscribing ? 'shadow-blue-500/40' : isRecording ? 'shadow-red-500/40' : 'shadow-white/5 hover:shadow-white/10'
            )}
          />
          <div className="flex flex-col justify-center min-w-[140px]">
            {isTranscribing ? (
              <div className="flex flex-col">
                <span className="text-[#0A84FF] font-bold text-sm uppercase mb-1 flex items-center gap-2">
                  <Loader2 size={14} className="animate-spin" />
                  Zpracovávám
                </span>
              </div>
            ) : isRecording ? (
              <div className="flex flex-col">
                <span className="text-red-500 font-bold tracking-widest text-sm uppercase mb-1 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                  Nahrávání
                </span>
                <span className="font-monospaced text-3xl text-white font-medium">{formatTime(recordingTime)}</span>
              </div>
            ) : (
              <div className="flex flex-col">
                <span className="text-white font-medium text-2xl">Diktování</span>
                <span className="text-[#8E8E93] text-sm">Klikněte pro nahrávání</span>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setTranscript('')}
            disabled={!transcript}
            className="p-3 rounded-full text-[#8E8E93] hover:text-red-400 hover:bg-white/5 transition-colors disabled:opacity-30"
            title="Vymazat"
          >
            <Trash2 size={24} />
          </button>
          <button
            onClick={generateRagSuggestion}
            disabled={!transcript || isGeneratingRag || !!ragSuggestion}
            className="flex items-center gap-2 px-5 py-3 bg-[#2C2C2E] hover:bg-[#3C3C3E] text-white rounded-full font-semibold transition-all disabled:opacity-30"
            title="Doplnit z knihovny"
          >
            {isGeneratingRag ? <Loader2 size={18} className="animate-spin" /> : <BookOpen size={18} />}
            <span className="hidden lg:inline">Doplnit z knihovny</span>
          </button>
          <button
            onClick={copyToClipboard}
            disabled={!transcript}
            className="flex items-center gap-2 px-6 py-3 bg-[#0A84FF] hover:bg-[#007AFF] text-white rounded-full font-bold text-lg transition-all disabled:opacity-50 shadow-lg shadow-blue-900/20"
          >
            <Copy size={20} />
            <span>Kopírovat</span>
          </button>
        </div>
      </div>

      <div className="md:hidden flex flex-col px-5 py-4 bg-[#121212] z-20 border-b border-white/5">
        <div className="flex items-center justify-between pl-1">
          <div className="flex flex-col">
            {isTranscribing ? (
              <span className="text-[#0A84FF] font-semibold text-lg animate-pulse flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-[#0A84FF]" />
                Zpracovávám
              </span>
            ) : isRecording ? (
              <span className="text-[#FF453A] font-monospaced font-medium text-xl tracking-wide flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-[#FF453A] animate-pulse" />
                {formatTime(recordingTime)}
              </span>
            ) : (
              <span className="text-[#8E8E93] font-medium text-lg">Připraveno</span>
            )}
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={() => setTranscript('')}
              disabled={!transcript}
              className="w-12 h-12 rounded-full bg-[#2C2C2E] flex items-center justify-center text-[#8E8E93] hover:text-red-400 disabled:opacity-20 active:scale-95 transition-all"
            >
              <Trash2 size={22} />
            </button>
            <button
              onClick={copyToClipboard}
              disabled={!transcript}
              className="w-12 h-12 rounded-full bg-[#0A84FF] flex items-center justify-center text-white disabled:opacity-50 active:scale-95 transition-all shadow-lg shadow-blue-900/20"
            >
              <Copy size={22} />
            </button>
            <div className="relative ml-2">
              <RecordButton
                isRecording={isRecording}
                isProcessing={isTranscribing}
                onClick={handleRecordToggle}
                className="w-16 h-16 shadow-xl"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 w-full relative min-h-0 bg-black">
        <textarea
          ref={textareaRef}
          value={transcript}
          onChange={(e) => setTranscript(e.target.value)}
          onSelect={updateSelection}
          onMouseUp={updateSelection}
          onKeyUp={updateSelection}
          className="absolute inset-0 w-full h-full bg-transparent text-[16px] md:text-[18px] leading-[1.8] text-white resize-none focus:outline-none placeholder-[#3A3A3C] font-normal p-6 md:p-8 pb-[100px] md:pb-0"
          placeholder="Klikněte na mikrofon a začněte diktovat..."
          spellCheck={false}
        />
      </div>

      {transcript && (
        <div className="absolute bottom-4 left-4 right-4 md:bottom-6 md:left-8 md:right-8 z-20 pointer-events-none">
          <div className="flex flex-wrap gap-2 justify-start">
            {detectAgentTarget(transcript) === 'web-operator' && (
              <div className="pointer-events-auto inline-flex items-center gap-2 rounded-full bg-[#0A84FF] px-4 py-2 text-sm text-white shadow-lg shadow-blue-900/25">
                <Briefcase size={16} />
                Připraveno pro Web operátora
              </div>
            )}
            {detectAgentTarget(transcript) === 'agent' && (
              <div className="pointer-events-auto inline-flex items-center gap-2 rounded-full bg-[#2C2C2E] px-4 py-2 text-sm text-white shadow-lg">
                <Bot size={16} />
                Připraveno pro Obchodníka pomocníka
              </div>
            )}
          </div>
        </div>
      )}

      {ragSuggestion && (
        <div className="absolute bottom-6 left-6 right-6 md:bottom-8 md:left-8 md:right-8 z-30 animate-in slide-in-from-bottom-4 duration-300">
          <div className="bg-[#1C1C1E] rounded-2xl border border-white/10 shadow-2xl shadow-black/50 overflow-hidden max-h-[50vh]">
            <div className="flex items-center justify-between px-5 py-4 bg-gradient-to-r from-[#2C2C2E] to-[#1C1C1E] border-b border-white/5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg">
                  <Sparkles size={18} className="text-white" />
                </div>
                <div>
                  <p className="text-white font-semibold text-sm">Návrh s obsahem z knihovny</p>
                  {ragDocTitle && (
                    <p className="text-[#8E8E93] text-xs flex items-center gap-1 mt-0.5">
                      <BookOpen size={10} /> {ragDocTitle}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={rejectRagSuggestion}
                  className="w-10 h-10 rounded-xl bg-[#3A3A3C] hover:bg-red-500/30 flex items-center justify-center text-[#8E8E93] hover:text-red-400 transition-all active:scale-95"
                  title="Odmítnout"
                >
                  <X size={20} />
                </button>
                <button
                  onClick={acceptRagSuggestion}
                  className="flex items-center gap-2 px-5 py-2.5 bg-[#0A84FF] hover:bg-[#007AFF] text-white rounded-xl font-semibold text-sm transition-all active:scale-95 shadow-lg shadow-blue-900/30"
                >
                  <Check size={18} />
                  Použít tento text
                </button>
              </div>
            </div>

            <div className="p-5 max-h-[35vh] overflow-y-auto">
              <div className="text-[15px] leading-[1.8] text-[#E5E5EA] whitespace-pre-wrap font-normal">{ragSuggestion}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
