import React, { useState, useEffect, useRef } from 'react';
import type { User } from '@supabase/supabase-js';
import { Copy, Trash2, Loader2, Mail, MessageSquare, Menu, ListTodo, Globe } from 'lucide-react';
import { toast } from 'sonner';
import { useApp } from '@/app/contexts/AppContext';
import clsx from 'clsx';
import { RecordButton } from '@/app/components/figma/RecordButton';
import { isAssistantRagWebDictation } from '@/config/assistantAllowlist';

/** Stejný text jako v chatu s operátorem — obalí nadiktovaný koncept. */
export function buildAssistantEmailPrompt(draftBody: string): string {
  const t = draftBody.trim();
  return `Napiš mi z toho mail pro zákazníka a doplň užitečné informace o subjektu:\n\n${t}`;
}

interface DictationTabProps {
  onSendToAssistant?: (wrappedMessage: string) => void;
  /** Přepne na záložku Obchodník a odešle přesně tento text (bez obalení promptem). */
  onSendToChat?: (plainText: string) => void;
  /** Přepne na Web operátora a odešle zadání do jeho chatu (plný agent / CMS). */
  onSendToWebOperator?: (plainText: string) => void;
  /** Po přidání úkolů z diktování (např. přepnutí na záložku Úkoly). */
  onAfterTodoAdded?: () => void;
}

/** Jednotlivé řádky = samostatné úkoly; prázdné řádky se ignorují. */
function linesToTaskTexts(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
}

/** Křestní jméno / první část z Google profilu nebo e-mailu. */
function userFirstName(user: User | null): string | null {
  if (!user) return null;
  const m = user.user_metadata as { full_name?: string; name?: string; given_name?: string } | undefined;
  const full = m?.full_name?.trim();
  if (full) return full.split(/\s+/)[0] ?? '';
  if (m?.given_name) return m.given_name;
  const n = m?.name?.trim();
  if (n) return n.split(/\s+/)[0] ?? '';
  const local = user.email?.split('@')[0];
  return local || null;
}

/** Delší přepis → server rozloží na název + kroky + přesný přepis v poznámce. */
function shouldUseTaskBreakdown(text: string): boolean {
  const t = text.trim();
  if (t.length < 140) return false;
  const words = t.split(/\s+/).filter(Boolean).length;
  const lines = linesToTaskTexts(t);
  return words >= 25 || lines.length >= 3 || t.length >= 320;
}

export const DictationTab: React.FC<DictationTabProps> = ({
  onSendToAssistant,
  onSendToChat,
  onSendToWebOperator,
  onAfterTodoAdded,
}) => {
  const {
    shortcuts,
    transcribeAudio,
    smartEdit,
    toggleLeftNav,
    addTask,
    breakdownTaskTranscript,
    user,
    authReady,
  } = useApp();

  const showRagWebTab = isAssistantRagWebDictation(user?.email ?? null) && !!onSendToWebOperator;

  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  /** AI rozklad obsáhlého textu na kroky (po přepisu, před přidáním úkolu). */
  const [isTodoAiProcessing, setIsTodoAiProcessing] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [recordingTime, setRecordingTime] = useState(0);
  /** Po kliknutí na Email/Chat/Todo bez textu: po dokončení nahrávání se provede daná akce. */
  const [armedAction, setArmedAction] = useState<'email' | 'chat' | 'todo' | 'web' | null>(null);
  const armedActionRef = useRef<'email' | 'chat' | 'todo' | 'web' | null>(null);
  /**
   * Záměr u tohoto nahrávání (uloží se při startu).
   * armedActionRef se může před dokončením onstop vynulovat (např. druhý klik na Zadat = zrušení režimu),
   * pak by se text neposlal do chatu ani nešel správnou větví bez smart-edit.
   */
  const recordingIntentRef = useRef<'email' | 'chat' | 'todo' | 'web' | null>(null);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const selectionRef = useRef<{ start: number; end: number; text: string } | null>(null);

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
      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
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

  const clearArmed = () => {
    armedActionRef.current = null;
    setArmedAction(null);
  };

  const sendToAssistantNow = (text: string) => {
    if (!onSendToAssistant) return;
    onSendToAssistant(buildAssistantEmailPrompt(text));
    toast.success('Otevírám Obchodníka pomocníka se zprávou');
  };

  const sendToChatNow = (text: string) => {
    if (!onSendToChat) return;
    onSendToChat(text);
    toast.success('Otevírám chat s textem z diktování');
  };

  const sendToTodoNow = async (text: string) => {
    const lines = linesToTaskTexts(text);
    if (lines.length === 0) return;

    const preview = (s: string) => (s.length > 90 ? `${s.slice(0, 90)}…` : s);

    const finishSimpleLineMode = () => {
      lines.forEach((line) => addTask(line));
      if (lines.length === 1) {
        toast.success('Úkol přidán', {
          description: preview(lines[0]),
          duration: 5000,
        });
      } else {
        toast.success(`${lines.length} úkolů přidáno`, {
          description:
            lines
              .slice(0, 4)
              .map(preview)
              .join(' · ') + (lines.length > 4 ? ` (+${lines.length - 4})` : ''),
          duration: 5000,
        });
      }
      setTranscript('');
      onAfterTodoAdded?.();
    };

    if (!shouldUseTaskBreakdown(text)) {
      finishSimpleLineMode();
      return;
    }

    setIsTodoAiProcessing(true);
    try {
      const result = await breakdownTaskTranscript(text.trim());
      const title = (result.title || lines[0] || 'Úkol').trim().slice(0, 200);
      const steps = (result.steps || []).map((s) => String(s).trim()).filter(Boolean);
      const exactTranscript = (result.transcript || text).trim();

      const noteParts: string[] = [];
      if (steps.length > 0) {
        noteParts.push('Kroky:\n' + steps.map((s) => `• ${s}`).join('\n'));
      }
      noteParts.push('Přepis:\n' + exactTranscript);
      addTask(title, { note: noteParts.join('\n\n') });

      toast.success('Úkol přidán', {
        description:
          steps.length > 0
            ? `${preview(title)} — ${steps.length} kroků`
            : preview(title),
        duration: 5000,
      });
      setTranscript('');
      onAfterTodoAdded?.();
    } catch (e: unknown) {
      console.error('task-breakdown', e);
      toast.warning('Rozklad úkolu selhal — přidáno po řádcích.');
      finishSimpleLineMode();
    } finally {
      setIsTodoAiProcessing(false);
    }
  };

  /** Má text → odešli hned. Nemá → zvol režim, zapni nahrávání; znovu klik → zruš a zastav nahrávání. */
  const onEmailButton = () => {
    if (!onSendToAssistant) return;
    const t = transcript.trim();
    if (t) {
      clearArmed();
      if (isRecording) stopRecording();
      sendToAssistantNow(t);
      return;
    }
    const next = armedAction === 'email' ? null : 'email';
    armedActionRef.current = next;
    setArmedAction(next);
    if (next === null) {
      if (isRecording) stopRecording();
    } else if (!isRecording) {
      void startRecording();
    }
  };

  const onChatButton = () => {
    if (!onSendToChat) return;
    const t = transcript.trim();
    if (t) {
      clearArmed();
      if (isRecording) stopRecording();
      sendToChatNow(t);
      return;
    }
    const next = armedAction === 'chat' ? null : 'chat';
    armedActionRef.current = next;
    setArmedAction(next);
    if (next === null) {
      if (isRecording) stopRecording();
    } else if (!isRecording) {
      void startRecording();
    }
  };

  const onTodoButton = () => {
    const t = transcript.trim();
    if (t) {
      clearArmed();
      if (isRecording) stopRecording();
      void sendToTodoNow(t);
      return;
    }
    const next = armedAction === 'todo' ? null : 'todo';
    armedActionRef.current = next;
    setArmedAction(next);
    if (next === null) {
      if (isRecording) stopRecording();
    } else if (!isRecording) {
      void startRecording();
    }
  };

  const onWebButton = () => {
    if (!showRagWebTab || !onSendToWebOperator) return;
    const t = transcript.trim();
    if (t) {
      clearArmed();
      if (isRecording) stopRecording();
      onSendToWebOperator(t);
      return;
    }
    const next = armedAction === 'web' ? null : 'web';
    armedActionRef.current = next;
    setArmedAction(next);
    if (next === null) {
      if (isRecording) stopRecording();
    } else if (!isRecording) {
      void startRecording();
    }
  };

  const startRecording = async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      toast.error('Váš prohlížeč nepodporuje nahrávání zvuku.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      recordingIntentRef.current = armedActionRef.current;
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });

        const intent = recordingIntentRef.current;
        recordingIntentRef.current = null;

        setIsTranscribing(true);
        try {
          let newVoiceText = await transcribeAudio(audioBlob);

          shortcuts.forEach((s) => {
            const regex = new RegExp(`\\b${s.trigger}\\b`, 'gi');
            newVoiceText = newVoiceText.replace(regex, s.replacement);
          });

          const currentSelection = selectionRef.current;
          const baseText = transcript;

          let context: string | undefined;
          let selectionData: { start: number; end: number; text: string } | undefined;

          if (currentSelection?.text) {
            context = 'edit_selection';
            selectionData = currentSelection;
          }

          let finalText: string;

          /** Režim „Zadat chatu“ / „Todo“ / „Web“: bez smart-edit. Jen přepis + zkratky; Web pak předá operátorovi. */
          if (intent === 'chat' || intent === 'todo' || intent === 'web') {
            if (selectionData?.text != null && selectionData.start != null && selectionData.end != null) {
              finalText =
                baseText.slice(0, selectionData.start) + newVoiceText + baseText.slice(selectionData.end);
            } else if (baseText.trim()) {
              finalText = `${baseText.trimEnd()}\n\n${newVoiceText}`;
            } else {
              finalText = newVoiceText;
            }
          } else {
            const response = await smartEdit(baseText, newVoiceText, context, undefined, selectionData);
            if (response && typeof response === 'object') {
              finalText = response.cleanText || response.text || newVoiceText;
            } else {
              finalText = typeof response === 'string' ? response : newVoiceText;
            }
          }

          setTranscript(finalText);

          const trimmed = finalText.trim();
          if (trimmed && intent === 'email' && onSendToAssistant) {
            armedActionRef.current = null;
            setArmedAction(null);
            sendToAssistantNow(trimmed);
          } else if (trimmed && intent === 'chat' && onSendToChat) {
            armedActionRef.current = null;
            setArmedAction(null);
            sendToChatNow(trimmed);
          } else if (trimmed && intent === 'todo') {
            armedActionRef.current = null;
            setArmedAction(null);
            await sendToTodoNow(trimmed);
          } else if (trimmed && intent === 'web' && onSendToWebOperator) {
            armedActionRef.current = null;
            setArmedAction(null);
            onSendToWebOperator(trimmed);
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

  const copyToClipboard = () => {
    navigator.clipboard.writeText(transcript);
    toast.success('Zkopírováno!');
  };

  const hasTranscript = !!transcript.trim();
  const canEmail = !!onSendToAssistant;
  const canChat = !!onSendToChat;
  const greetingName = authReady && user ? userFirstName(user) : null;

  const armBtnClass = (armed: boolean) =>
    clsx(
      'flex items-center gap-2 px-5 py-3 rounded-full font-semibold transition-all',
      armed
        ? 'bg-emerald-600/25 ring-2 ring-emerald-500/70 text-white'
        : 'bg-[#2C2C2E] hover:bg-[#3C3C3E] text-white',
      'disabled:opacity-30 disabled:ring-0',
    );

  const armBtnClassMobile = (armed: boolean) =>
    clsx(
      'flex items-center justify-center gap-1.5 py-3.5 rounded-xl text-white text-sm font-semibold active:scale-[0.99] min-w-0',
      armed ? 'bg-emerald-600/25 ring-2 ring-emerald-500/70' : 'bg-[#2C2C2E]',
      'disabled:opacity-30 disabled:ring-0',
    );

  const menuBtnClass =
    'shrink-0 flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-[#2C2C2E] text-white transition-colors hover:bg-[#3C3C3E] active:scale-[0.98]';

  return (
    <div className="flex flex-col h-full w-full relative bg-black md:bg-transparent">
      {/* Desktop: řádek menu + email + chat, pod tím diktování */}
      <div className="hidden md:flex shrink-0 flex-col gap-5 p-8 pb-4">
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={toggleLeftNav} className={menuBtnClass} title="Zobrazit / skrýt levý panel">
            <Menu size={22} strokeWidth={2} />
          </button>
          <button
            type="button"
            onClick={onEmailButton}
            disabled={!canEmail}
            className={armBtnClass(armedAction === 'email')}
            title={
              hasTranscript
                ? 'Email — Obchodník s asistentem'
                : 'Spustí nahrávání a po dokončení odešle email přes Obchodníka (klik znovu zruší)'
            }
          >
            <Mail size={18} />
            <span>Email</span>
          </button>
          <button
            type="button"
            onClick={onChatButton}
            disabled={!canChat}
            className={armBtnClass(armedAction === 'chat')}
            title={
              hasTranscript
                ? 'Zadat — text do chatu bez úprav'
                : 'Spustí nahrávání a po dokončení odešle text do chatu (klik znovu zruší)'
            }
          >
            <MessageSquare size={18} />
            <span>Zadat</span>
          </button>
          <button
            type="button"
            onClick={onTodoButton}
            disabled={isTodoAiProcessing}
            className={armBtnClass(armedAction === 'todo')}
            title={
              hasTranscript
                ? 'Přidat text jako úkol(y) na seznam'
                : 'Spustí nahrávání a po dokončení přidá přepis do úkolů (klik znovu zruší)'
            }
          >
            <ListTodo size={18} />
            <span>Todo</span>
          </button>
          {showRagWebTab ? (
            <button
              type="button"
              onClick={onWebButton}
              className={armBtnClass(armedAction === 'web')}
              title={
                hasTranscript
                  ? 'Web — odeslat zadání Web operátorovi (CMS, ceny, …)'
                  : 'Nahrát a odeslat přepis Web operátorovi'
              }
            >
              <Globe size={18} />
              <span>Web</span>
            </button>
          ) : null}
          <div className="flex flex-1 min-w-[1rem]" />
          <button
            onClick={() => {
              setTranscript('');
              clearArmed();
            }}
            disabled={!transcript}
            className="p-3 rounded-full text-[#8E8E93] hover:text-red-400 hover:bg-white/5 transition-colors disabled:opacity-30"
            title="Vymazat"
          >
            <Trash2 size={24} />
          </button>
          {hasTranscript && (
            <button
              type="button"
              onClick={copyToClipboard}
              className="flex items-center gap-2 px-6 py-3 bg-[#0A84FF] hover:bg-[#007AFF] text-white rounded-full font-bold text-lg transition-all shadow-lg shadow-blue-900/20"
            >
              <Copy size={20} />
              <span>Kopírovat</span>
            </button>
          )}
        </div>
        <div className="flex items-center gap-8 flex-wrap">
          {greetingName && (
            <p
              className="text-white leading-tight max-w-[min(100%,16rem)] truncate"
              style={{ fontFamily: "'Cooper Light', serif", fontWeight: 300, fontSize: 'clamp(1.35rem, 2.4vw, 2rem)' }}
            >
              Ahoj, {greetingName}
            </p>
          )}
          <RecordButton
            isRecording={isRecording}
            isProcessing={isTranscribing || isTodoAiProcessing}
            onClick={handleRecordToggle}
            className={clsx(
              'shadow-2xl transition-all duration-300 shrink-0 w-28 h-28',
              isTranscribing || isTodoAiProcessing
                ? 'shadow-blue-500/40'
                : isRecording
                  ? 'shadow-red-500/40'
                  : 'shadow-white/5 hover:shadow-white/10',
            )}
          />
          {(isTranscribing || isTodoAiProcessing || isRecording) && (
            <div className="flex flex-col justify-center min-w-[140px]">
              {isTodoAiProcessing ? (
                <div className="flex flex-col">
                  <span className="text-[#0A84FF] font-bold text-sm uppercase mb-1 flex items-center gap-2">
                    <Loader2 size={14} className="animate-spin" />
                    Rozkládám úkol…
                  </span>
                </div>
              ) : isTranscribing ? (
                <div className="flex flex-col">
                  <span className="text-[#0A84FF] font-bold text-sm uppercase mb-1 flex items-center gap-2">
                    <Loader2 size={14} className="animate-spin" />
                    Zpracovávám
                  </span>
                </div>
              ) : (
                <div className="flex flex-col">
                  <span className="text-red-500 font-bold tracking-widest text-sm uppercase mb-1 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                    Nahrávání
                  </span>
                  <span className="font-monospaced text-3xl text-white font-medium">{formatTime(recordingTime)}</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Mobil: menu + email + chat, pod tím mikrofon; horní lišta záložek je u diktování skrytá */}
      <div className="md:hidden flex flex-col gap-3 px-4 pt-[calc(env(safe-area-inset-top)+12px)] pb-4 bg-[#121212] z-30 border-b border-white/5">
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={toggleLeftNav} className={menuBtnClass} title="Menu — navigace">
            <Menu size={22} strokeWidth={2} />
          </button>
          <button
            type="button"
            onClick={onEmailButton}
            disabled={!canEmail}
            className={clsx(armBtnClassMobile(armedAction === 'email'), 'flex-1 min-w-[6rem]')}
          >
            <Mail size={16} className="shrink-0" />
            <span className="truncate text-xs sm:text-sm">Email</span>
          </button>
          <button
            type="button"
            onClick={onChatButton}
            disabled={!canChat}
            className={clsx(armBtnClassMobile(armedAction === 'chat'), 'flex-1 min-w-[6rem]')}
          >
            <MessageSquare size={16} className="shrink-0" />
            <span className="truncate text-xs sm:text-sm">Zadat</span>
          </button>
          <button
            type="button"
            onClick={onTodoButton}
            disabled={isTodoAiProcessing}
            className={clsx(armBtnClassMobile(armedAction === 'todo'), 'flex-1 min-w-[6rem] basis-[calc(50%-0.25rem)]')}
          >
            <ListTodo size={16} className="shrink-0" />
            <span className="truncate text-xs sm:text-sm">Todo</span>
          </button>
          {showRagWebTab ? (
            <button
              type="button"
              onClick={onWebButton}
              className={clsx(armBtnClassMobile(armedAction === 'web'), 'flex-1 min-w-[6rem]')}
            >
              <Globe size={16} className="shrink-0" />
              <span className="truncate text-xs sm:text-sm">Web</span>
            </button>
          ) : null}
        </div>
        <div className="flex flex-col items-center gap-2 py-1">
          {greetingName && (
            <p
              className="text-white text-center max-w-[90vw] truncate px-2"
              style={{ fontFamily: "'Cooper Light', serif", fontWeight: 300, fontSize: 'clamp(1.2rem, 4.5vw, 1.65rem)' }}
            >
              Ahoj, {greetingName}
            </p>
          )}
          <RecordButton
            isRecording={isRecording}
            isProcessing={isTranscribing || isTodoAiProcessing}
            onClick={handleRecordToggle}
            className="w-24 h-24 shadow-2xl"
          />
        </div>
        <div className="flex items-center justify-between gap-3 pl-1">
          <div className="flex flex-col min-w-0">
            {isTodoAiProcessing ? (
              <span className="text-[#0A84FF] font-semibold text-sm flex items-center gap-2">
                <Loader2 size={14} className="animate-spin shrink-0" />
                Rozkládám úkol…
              </span>
            ) : isTranscribing ? (
              <span className="text-[#0A84FF] font-semibold text-sm flex items-center gap-2">
                <Loader2 size={14} className="animate-spin shrink-0" />
                Zpracovávám
              </span>
            ) : isRecording ? (
              <span className="text-[#FF453A] font-mono font-medium text-lg tracking-wide flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#FF453A] animate-pulse shrink-0" />
                {formatTime(recordingTime)}
              </span>
            ) : (
              <span className="text-[#8E8E93] font-medium text-sm">Připraveno k nahrávání</span>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => {
                setTranscript('');
                clearArmed();
              }}
              disabled={!transcript}
              className="w-11 h-11 rounded-full bg-[#2C2C2E] flex items-center justify-center text-[#8E8E93] hover:text-red-400 disabled:opacity-20 active:scale-95 transition-all"
              title="Vymazat"
            >
              <Trash2 size={20} />
            </button>
            {hasTranscript && (
              <button
                type="button"
                onClick={copyToClipboard}
                className="w-11 h-11 rounded-full bg-[#0A84FF] flex items-center justify-center text-white active:scale-95 transition-all shadow-lg shadow-blue-900/20"
                title="Kopírovat"
              >
                <Copy size={20} />
              </button>
            )}
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
    </div>
  );
};
