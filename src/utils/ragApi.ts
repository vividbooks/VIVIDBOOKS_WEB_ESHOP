import { projectId, publicAnonKey } from './supabase/info';

const BASE = `https://${projectId}.supabase.co/functions/v1/make-server-93a20b6f`;
const H = { Authorization: `Bearer ${publicAnonKey}`, 'Content-Type': 'application/json' };

// Reads the error body and throws with the real message from the server
async function apiCall<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const body = await res.json() as Record<string, unknown>;
      const err = body.error;
      if (typeof err === 'string') msg = err;
      else if (err && typeof err === 'object' && 'message' in err && typeof (err as { message?: string }).message === 'string') {
        msg = (err as { message: string }).message;
      } else if (typeof body.message === 'string') msg = body.message;
      else if (typeof body.error === 'string') msg = body.error;
      else msg = JSON.stringify(body);
    } catch {
      msg = await res.text().catch(() => `HTTP ${res.status}`);
    }
    throw new Error(msg);
  }
  return res.json() as Promise<T>;
}

export async function ragQuery(question: string, topK = 5) {
  return apiCall<{ answer: string; sources: any[]; chunksUsed: number }>(
    await fetch(`${BASE}/rag/query`, { method: 'POST', headers: H, body: JSON.stringify({ question, topK }) })
  );
}

export async function ragIngestChunk(text: string, metadata: Record<string, any>) {
  return apiCall<{ success: boolean; id: string; tokens: number; dims: number }>(
    await fetch(`${BASE}/rag/chunk`, { method: 'POST', headers: H, body: JSON.stringify({ text, metadata }) })
  );
}

export async function ragListChunks() {
  return apiCall<{ chunks: any[]; total: number }>(
    await fetch(`${BASE}/rag/chunks`, { headers: H })
  );
}

export async function ragDeleteChunk(id: string) {
  return apiCall<any>(
    await fetch(`${BASE}/rag/chunk/${encodeURIComponent(id)}`, { method: 'DELETE', headers: H })
  );
}

export async function ragRunAgent() {
  return apiCall<{ success: boolean; stats: any; actions: any[] }>(
    await fetch(`${BASE}/rag/agent/run`, { method: 'POST', headers: H, body: '{}' })
  );
}

/** Krátkodobý token pro Gemini Live (hlas) — Web operátor / RAG (POST …/admin/live-ephemeral-token) */
export async function liveEphemeralToken() {
  return apiCall<{ token: string; expiresAt?: string }>(
    await fetch(`${BASE}/admin/live-ephemeral-token`, { method: 'POST', headers: H, body: '{}' })
  );
}

/** @deprecated použij liveEphemeralToken — alias na stejný endpoint */
export async function ragLiveEphemeralToken() {
  return liveEphemeralToken();
}

export async function ragIngestSource(source: 'produkty' | 'blog' | 'novinky' | 'webinare' | 'tabs' | 'mailchimp') {
  return apiCall<{ success: boolean; ingested: number; total: number }>(
    await fetch(`${BASE}/rag/ingest-source`, { method: 'POST', headers: H, body: JSON.stringify({ source }) })
  );
}

export async function ragDebug() {
  return apiCall<any>(
    await fetch(`${BASE}/rag/debug`, { headers: H })
  );
}

export async function ragSaveFeedback(text: string, author = 'admin', channel = 'chat', type = 'feedback') {
  return apiCall<{ success: boolean; id: string }>(
    await fetch(`${BASE}/rag/feedback`, { method: 'POST', headers: H, body: JSON.stringify({ text, author, channel, type }) })
  );
}

export async function ragLearnFact(text: string, title: string, author = 'admin') {
  return apiCall<{ success: boolean; id: string; dims: number }>(
    await fetch(`${BASE}/rag/learn`, { method: 'POST', headers: H, body: JSON.stringify({ text, title, author }) })
  );
}

export async function ragListFeedback() {
  return apiCall<{ items: any[]; total: number }>(
    await fetch(`${BASE}/rag/feedback-list`, { headers: H })
  );
}