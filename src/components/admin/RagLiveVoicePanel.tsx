import React, { useCallback, useRef, useState } from 'react';
import { Mic, Square, Loader2, Radio } from 'lucide-react';
import * as ragApi from '../../utils/ragApi';

const MODEL = 'gemini-3.1-flash-live-preview';

function formatClientError(e: unknown): string {
  if (!(e instanceof Error)) return String(e);
  const m = e.message.trim();
  if (m.startsWith('{')) {
    try {
      const j = JSON.parse(m) as { error?: { message?: string } | string };
      if (typeof j.error === 'string') return j.error;
      if (j.error && typeof j.error === 'object' && j.error.message) return String(j.error.message);
    } catch {
      /* ignore */
    }
  }
  return m;
}
/** Výstupní audio z Live API — viz dokumentace (PCM, typicky 24 kHz). */
const OUTPUT_AUDIO_HZ = 24000;

function floatToPcm16Base64(input: Float32Array): string {
  const int16 = new Int16Array(input.length);
  for (let i = 0; i < input.length; i++) {
    const s = Math.max(-1, Math.min(1, input[i]!));
    int16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  const bytes = new Uint8Array(int16.buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!);
  return btoa(binary);
}

function pcm16Base64ToFloat32(b64: string): Float32Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const int16 = new Int16Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 2);
  const out = new Float32Array(int16.length);
  for (let i = 0; i < int16.length; i++) out[i] = int16[i]! / 32768;
  return out;
}

/**
 * Realtime hlas s Gemini Live — token z backendu (ephemeral),
 * mikrofon → PCM chunky → sendRealtimeInput, odpověď → přehrání + přepis.
 * @param embedded zmenšený vzhled pro Web operátora (AdminAgentPage)
 */
export function RagLiveVoicePanel({ embedded = false }: { embedded?: boolean }) {
  const [phase, setPhase] = useState<'idle' | 'connecting' | 'live'>('idle');
  const [err, setErr] = useState('');
  const [transcript, setTranscript] = useState('');

  const sessionRef = useRef<{
    sendRealtimeInput?: (p: object) => void;
    close?: () => void;
  } | null>(null);
  const micCtxRef = useRef<AudioContext | null>(null);
  const playCtxRef = useRef<AudioContext | null>(null);
  const playNextRef = useRef(0);
  const streamRef = useRef<MediaStream | null>(null);
  const procRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const gainRef = useRef<GainNode | null>(null);

  const stopAll = useCallback(async () => {
    setPhase('idle');
    try {
      procRef.current?.disconnect();
      sourceRef.current?.disconnect();
      gainRef.current?.disconnect();
      procRef.current = null;
      sourceRef.current = null;
      gainRef.current = null;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      await micCtxRef.current?.close().catch(() => {});
      micCtxRef.current = null;
    } catch {
      /* ignore */
    }
    try {
      sessionRef.current?.sendRealtimeInput?.({ audioStreamEnd: true });
    } catch {
      /* ignore */
    }
    try {
      sessionRef.current?.close?.();
    } catch {
      /* ignore */
    }
    sessionRef.current = null;
    playNextRef.current = 0;
    try {
      await playCtxRef.current?.close().catch(() => {});
    } catch {
      /* ignore */
    }
    playCtxRef.current = null;
  }, []);

  const start = async () => {
    setErr('');
    setTranscript('');
    setPhase('connecting');
    try {
      const { GoogleGenAI, Modality } = await import('@google/genai');
      const { token } = await ragApi.liveEphemeralToken();
      const ai = new GoogleGenAI({
        apiKey: token,
        httpOptions: { apiVersion: 'v1alpha' },
      });

      const playCtx = new AudioContext({ sampleRate: OUTPUT_AUDIO_HZ });
      playCtxRef.current = playCtx;
      playNextRef.current = playCtx.currentTime;

      const scheduleAudio = (b64: string) => {
        const ctx = playCtxRef.current;
        if (!ctx) return;
        let f32: Float32Array;
        try {
          f32 = pcm16Base64ToFloat32(b64);
        } catch {
          return;
        }
        if (f32.length === 0) return;
        const buf = ctx.createBuffer(1, f32.length, OUTPUT_AUDIO_HZ);
        buf.copyToChannel(f32, 0);
        const src = ctx.createBufferSource();
        src.buffer = buf;
        src.connect(ctx.destination);
        const startAt = Math.max(playNextRef.current, ctx.currentTime);
        src.start(startAt);
        playNextRef.current = startAt + buf.duration;
      };

      const session = await ai.live.connect({
        model: MODEL,
        config: {
          responseModalities: [Modality.AUDIO],
        },
        callbacks: {
          onmessage: (msg: any) => {
            const ot = msg.serverContent?.outputTranscription?.text;
            if (ot) setTranscript((p) => (p ? `${p}${ot}` : ot));
            const parts = msg.serverContent?.modelTurn?.parts;
            if (parts?.length) {
              for (const part of parts) {
                const d = part.inlineData?.data ?? part.inline_data?.data;
                if (typeof d === 'string') scheduleAudio(d);
              }
            }
          },
          onerror: (e: unknown) => {
            setErr(formatClientError(e));
            void stopAll();
          },
        },
      });

      sessionRef.current = session;

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          channelCount: 1,
        },
      });
      streamRef.current = stream;

      const micCtx = new AudioContext();
      micCtxRef.current = micCtx;
      const rate = micCtx.sampleRate;
      const source = micCtx.createMediaStreamSource(stream);
      sourceRef.current = source;
      const proc = micCtx.createScriptProcessor(4096, 1, 1);
      procRef.current = proc;
      const mute = micCtx.createGain();
      mute.gain.value = 0;
      gainRef.current = mute;

      proc.onaudioprocess = (ev) => {
        const input = ev.inputBuffer.getChannelData(0);
        const b64 = floatToPcm16Base64(input);
        try {
          sessionRef.current?.sendRealtimeInput?.({
            audio: {
              data: b64,
              mimeType: `audio/pcm;rate=${Math.round(rate)}`,
            },
          });
        } catch {
          /* session closed */
        }
      };

      source.connect(proc);
      proc.connect(mute);
      mute.connect(micCtx.destination);

      setPhase('live');
    } catch (e: unknown) {
      setErr(formatClientError(e));
      await stopAll();
    }
  };

  const wrap = embedded
    ? 'rounded-xl border border-violet-200 bg-gradient-to-br from-violet-50/80 to-white p-4 shadow-sm'
    : 'rounded-2xl border-2 border-violet-300 bg-gradient-to-br from-violet-50/90 to-white p-6 shadow-md';

  return (
    <div className={wrap}>
      <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Radio className="w-6 h-6 text-violet-600 shrink-0" />
            <h3 className={`font-['Cooper_Light',serif] text-[#001161] leading-tight ${embedded ? 'text-[18px]' : 'text-[22px]'}`}>
              {embedded ? 'Hlas — Gemini Live' : 'Realtime hlas (Gemini Live)'}
            </h3>
          </div>
          <p className={`font-['Fenomen_Sans',sans-serif] text-[#001161]/55 max-w-[540px] leading-relaxed ${embedded ? 'text-[12px]' : 'text-[13px]'}`}>
            {embedded
              ? 'Stejný Web operátor jako v chatu — hlasem. Spusť, povol mikrofon, mluv česky.'
              : 'Klikni na fialové tlačítko s mikrofonem. Po načtení tokenu z backendu povol přístup k mikrofonu — mluvíš přímo s modelem (zvuk + přepis).'}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {phase !== 'live' ? (
            <button
              type="button"
              onClick={() => void start()}
              disabled={phase === 'connecting'}
              className={`inline-flex items-center gap-3 rounded-2xl bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white font-['Fenomen_Sans',sans-serif] font-bold transition-colors shadow-lg shadow-violet-600/25 ${embedded ? 'px-4 py-3 text-[14px]' : 'px-6 py-4 text-[16px]'}`}
            >
              {phase === 'connecting' ? (
                <Loader2 className="w-6 h-6 animate-spin" />
              ) : (
                <Mic className="w-6 h-6" />
              )}
              {phase === 'connecting' ? 'Připojuji…' : 'Spustit hlas'}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void stopAll()}
              className="inline-flex items-center gap-2 rounded-xl bg-[#001161] hover:bg-[#001161]/90 text-white px-4 py-2.5 font-['Fenomen_Sans',sans-serif] text-[14px] font-bold transition-colors"
            >
              <Square className="w-4 h-4" />
              {'Ukončit'}
            </button>
          )}
        </div>
      </div>

      {phase === 'live' && (
        <div className="flex items-center gap-2 mb-3 text-emerald-600 font-['Fenomen_Sans',sans-serif] text-[12px] font-bold">
          <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          {'Naslouchám — mluv česky'}
        </div>
      )}

      {err ? (
        <div className="rounded-xl bg-red-50 border border-red-200 px-3 py-2 font-['Fenomen_Sans',sans-serif] text-[13px] text-red-700 mb-3">
          {err}
        </div>
      ) : null}

      {transcript ? (
        <div className="rounded-xl bg-white border border-violet-100 px-4 py-3 max-h-[140px] overflow-y-auto">
          <div className="font-['Fenomen_Sans',sans-serif] text-[10px] font-bold uppercase tracking-wide text-[#001161]/40 mb-1">
            {'Přepis odpovědi modelu'}
          </div>
          <p className="font-['Fenomen_Sans',sans-serif] text-[13px] text-[#001161]/85 whitespace-pre-wrap">{transcript}</p>
        </div>
      ) : null}
    </div>
  );
}
