import { projectId, publicAnonKey } from './supabase/info';
import { fetchJsonWithRetry } from './fetchWithRetry';

const BASE = `https://${projectId}.supabase.co/functions/v1/make-server-93a20b6f/admin`;
const HEADERS = {
  Authorization: `Bearer ${publicAnonKey}`,
  'Content-Type': 'application/json',
};

export type GrowthPlatform = 'meta' | 'google';
export type GrowthAudienceHint = 'teacher' | 'parent' | 'school' | 'mixed';
export type GrowthCreativeFormat = 'image_single' | 'carousel' | 'story' | 'pmax_asset';
export type GrowthReviewStatus = 'draft' | 'approved' | 'rejected';
export type GrowthPublishStatus = 'new' | 'queued' | 'active' | 'paused' | 'failed';

export interface GrowthChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  tokens?: { in: number; out: number };
  ragChunks?: number;
  ragDebug?: { indexSize: number; topScore: number; reason: string };
}

export interface GrowthChatIndexEntry {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
}

export interface GrowthCreative {
  id: string;
  productId: string | null;
  angle: string;
  audienceHint: GrowthAudienceHint;
  platformTargets: GrowthPlatform[];
  format: GrowthCreativeFormat;
  headline: string;
  primaryText: string;
  cta: string;
  visualPrompt: string;
  imageUrl?: string;
  sourceChatId?: string | null;
  reviewStatus: GrowthReviewStatus;
  publishStatus: GrowthPublishStatus;
  performance?: {
    ctr?: number;
    cpc?: number;
    roas?: number;
    conversions?: number;
  };
  metaRef?: Record<string, string | undefined>;
  googleRef?: Record<string, string | undefined>;
  createdAt: string;
  updatedAt: string;
}

export interface GrowthCampaign {
  id: string;
  platform: GrowthPlatform;
  name: string;
  status: 'draft' | 'active' | 'paused' | 'failed';
  budget: number;
  externalId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface GrowthInsight {
  id: string;
  type: 'pattern' | 'recommendation';
  content: string;
  confidence: number;
  relatedCreativeIds?: string[];
  createdAt: string;
}

async function getJson<T>(path: string): Promise<T> {
  const result = await fetchJsonWithRetry<T>(
    `${BASE}${path}`,
    { headers: HEADERS },
    { maxAttempts: 4, baseDelayMs: 350 },
  );
  if (!result.ok) throw new Error(result.error);
  return result.data;
}

async function sendJson<T>(path: string, method: 'POST' | 'PUT' | 'DELETE', body?: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: HEADERS,
    body: body == null ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let data: any = {};
  if (text.trim()) {
    try {
      data = JSON.parse(text);
    } catch {
      const shortBody = text.trim().slice(0, 240);
      throw new Error(
        `Server vratil neplatnou JSON odpoved (${res.status}). ${shortBody}`,
      );
    }
  }
  if (!res.ok) {
    throw new Error(typeof data?.error === 'string' ? data.error : `HTTP ${res.status}`);
  }
  return data as T;
}

export async function fetchGrowthChatIndex(): Promise<GrowthChatIndexEntry[]> {
  const data = await getJson<{ chats?: GrowthChatIndexEntry[] }>('/growth-agent-chats');
  return data.chats || [];
}

export async function fetchGrowthChat(id: string): Promise<{ id: string; title: string; messages: GrowthChatMessage[] }> {
  const data = await getJson<{ chat?: { id: string; title: string; messages: Array<Omit<GrowthChatMessage, 'timestamp'> & { timestamp: string }> } }>(`/growth-agent-chats/${id}`);
  if (!data.chat) throw new Error('Chat nenalezen');
  return {
    ...data.chat,
    messages: (data.chat.messages || []).map((msg) => ({ ...msg, timestamp: new Date(msg.timestamp) })),
  };
}

export async function saveGrowthChat(payload: { id: string; title: string; messages: GrowthChatMessage[] }): Promise<void> {
  await sendJson('/growth-agent-chats', 'POST', {
    ...payload,
    messages: payload.messages.map((msg) => ({ ...msg, timestamp: msg.timestamp.toISOString() })),
  });
}

export async function deleteGrowthChat(id: string): Promise<void> {
  await sendJson(`/growth-agent-chats/${id}`, 'DELETE');
}

export async function sendGrowthAgentMessage(payload: {
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  productContext?: any[];
  model?: string;
}): Promise<{
  reply: string;
  tokensIn: number;
  tokensOut: number;
  ragChunks: number;
  ragDebug?: { indexSize: number; topScore: number; reason: string };
}> {
  return sendJson('/growth-agent', 'POST', payload);
}

export async function fetchGrowthCreatives(): Promise<GrowthCreative[]> {
  const data = await getJson<{ creatives?: GrowthCreative[] }>('/growth-creatives');
  return data.creatives || [];
}

export async function fetchGrowthCampaigns(): Promise<GrowthCampaign[]> {
  const data = await getJson<{ campaigns?: GrowthCampaign[] }>('/growth-campaigns');
  return data.campaigns || [];
}

export async function fetchGrowthInsights(): Promise<GrowthInsight[]> {
  const data = await getJson<{ insights?: GrowthInsight[] }>('/growth-insights');
  return data.insights || [];
}

export async function generateGrowthCreatives(payload: {
  productId: string;
  angles: string[];
  countPerAngle: number;
  audienceHint?: GrowthAudienceHint;
  platformTargets?: GrowthPlatform[];
  format?: GrowthCreativeFormat;
  sourceChatId?: string | null;
}): Promise<GrowthCreative[]> {
  const data = await sendJson<{ creatives?: GrowthCreative[] }>('/growth-creatives/generate', 'POST', payload);
  return data.creatives || [];
}

export async function updateGrowthCreative(id: string, updates: Partial<GrowthCreative>): Promise<GrowthCreative> {
  const data = await sendJson<{ creative: GrowthCreative }>(`/growth-creatives/${id}`, 'PUT', updates);
  return data.creative;
}

export async function createGrowthCampaign(payload: Partial<GrowthCampaign>): Promise<GrowthCampaign> {
  const data = await sendJson<{ campaign: GrowthCampaign }>('/growth-campaigns', 'POST', payload);
  return data.campaign;
}

export async function deleteGrowthCreative(id: string): Promise<void> {
  await sendJson(`/growth-creatives/${id}`, 'DELETE');
}

export async function approveGrowthCreative(id: string): Promise<GrowthCreative> {
  const data = await sendJson<{ creative: GrowthCreative }>(`/growth-creatives/${id}/approve`, 'POST');
  return data.creative;
}

export async function rejectGrowthCreative(id: string): Promise<GrowthCreative> {
  const data = await sendJson<{ creative: GrowthCreative }>(`/growth-creatives/${id}/reject`, 'POST');
  return data.creative;
}

export async function generateGrowthInsights(): Promise<GrowthInsight[]> {
  const data = await sendJson<{ insights?: GrowthInsight[] }>('/growth-insights/generate', 'POST');
  return data.insights || [];
}

export async function uploadGrowthCreatives(platform: GrowthPlatform, creativeIds: string[]): Promise<{ success: boolean; message?: string; results?: any[] }> {
  return sendJson(`/growth-upload/${platform}`, 'POST', { creativeIds });
}
