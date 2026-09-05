/**
 * DVPP zdarma — klient k Edge endpointům `/dvpp/*` (docs/dvpp/API.md).
 * Session token z magic linku žije v localStorage a posílá se hlavičkou X-Dvpp-Session.
 */
import { publicAnonKey } from './supabase/info';
import { edgeFunctionBase } from './edgeFunctionBase';

const SESSION_KEY = 'vividbooks_dvpp_session_v1';
const VBID_KEY = 'vb_id';

export function getDvppSession(): string | null {
  try { return window.localStorage.getItem(SESSION_KEY); } catch { return null; }
}
export function setDvppSession(token: string | null): void {
  try {
    if (token) window.localStorage.setItem(SESSION_KEY, token);
    else window.localStorage.removeItem(SESSION_KEY);
  } catch { /* soukromé okno */ }
}

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const m = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return m ? decodeURIComponent(m[1]) : null;
}

/** UTM z URL se pamatují v sessionStorage, aby se dostaly i k pozdějšímu přihlášení. */
export function captureAttribution(): void {
  try {
    const sp = new URLSearchParams(window.location.search);
    const keys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content'];
    if (!keys.some((k) => sp.has(k))) return;
    const obj: Record<string, string> = {};
    for (const k of keys) { const v = sp.get(k); if (v) obj[k.replace('utm_', '')] = v.slice(0, 120); }
    window.sessionStorage.setItem('vividbooks_dvpp_utm', JSON.stringify(obj));
  } catch { /* ignore */ }
}

export function attributionPayload(): Record<string, string> {
  let utm: Record<string, string> = {};
  try { utm = JSON.parse(window.sessionStorage.getItem('vividbooks_dvpp_utm') || '{}'); } catch { /* ignore */ }
  const vb = readCookie(VBID_KEY);
  return { ...utm, ...(vb ? { sessionKey: vb } : {}) };
}

async function call<T>(path: string, init: { method?: string; body?: unknown; auth?: boolean } = {}): Promise<T> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${publicAnonKey}`,
    'Content-Type': 'application/json',
  };
  const session = getDvppSession();
  if (session) headers['X-Dvpp-Session'] = session;
  const res = await fetch(`${edgeFunctionBase()}${path}`, {
    method: init.method || (init.body ? 'POST' : 'GET'),
    headers,
    body: init.body ? JSON.stringify(init.body) : undefined,
  });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string; code?: string };
  if (!res.ok) {
    const err = new Error(data?.error || `HTTP ${res.status}`) as Error & { code?: string; status?: number };
    err.code = data?.code;
    err.status = res.status;
    if (res.status === 401) setDvppSession(null);
    throw err;
  }
  return data;
}

export type DvppAccess = {
  level: 'guest' | 'starter' | 'full';
  starterUsed: number;
  starterLimit: number;
  reason: 'guest' | 'customer' | 'staffroom' | 'referral' | 'personal' | 'starter';
  staffroomStatus: string | null;
};

export type DvppMe = {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  position: string | null;
  isDirector: boolean;
  /** Vedení školy ověřené školní doménou nebo potvrzením z oficiálního e-mailu školy (výkaz, odemknutí). */
  directorVerified: boolean;
  teacherType: string | null;
  profile: Record<string, unknown>;
  profileDone: boolean;
  school: { redIzo: string; name: string; city: string | null; teachersCount: number | null } | null;
  access: DvppAccess;
  status: string;
};

export type DvppCatalogVideo = {
  id: string; name: string; slug: string; thumbnail: string; youtubeUrl: string; topicIds: string[]; description: string;
  durationMinutes?: number; lecturer?: string; subjects?: string[]; trailerUrl?: string;
  chapters?: Array<{ t: number; title: string }>; addedAt?: string;
  /** Podklad karty a datum vysílání z propojeného webináře (karta jako na homepage). */
  coverBg?: string; airedAt?: string;
  locked?: boolean;
  progress?: { position: number; duration: number | null; completed: boolean; updatedAt: string } | null;
  certificate?: { number: string; issuedAt: string } | null;
  plays30d?: number;
  certificateLinkMode?: 'external' | 'survey';
  webinarSlugForSurvey?: string;
};

export type DvppCatalog = {
  rows: Array<{ key: string; title: string; subtitle?: string; videos: DvppCatalogVideo[] }>;
  series: Array<{ id: string; title: string; description: string; subjects: string[]; videoIds: string[]; hours: number; cover?: string }>;
  topics: Array<{ id: string; name: string; slug: string }>;
  access: DvppAccess;
  me: DvppMe | null;
};

export type DvppStaffroom = {
  school: { redIzo: string; name: string; city: string | null; teachersCount: number | null; teachersEstimated: boolean } | null;
  staffroom: { code: string; status: 'building' | 'unlocked' | 'grace' | 'expired'; target: number; confirmed: number; graceUntil: string | null; unlockedBy: string | null; unlockedAt: string | null } | null;
  members: Array<{ firstName: string; lastInitial: string; activated: boolean; via: string; joinedAt: string; isMe: boolean }>;
  confirmed: number;
  target: number;
  missing: number;
  myReferred: number;
  shareUrl: string | null;
  colleaguesInBase: number;
};

export type DvppTopic = { id: string; title: string; description: string | null; subjects: string[]; status: string; votes_count: number; myVote?: boolean };

export type DvppCertificate = {
  id: string; number: string; kind: string; webinar_id: string | null; video_id: string | null; series_id: string | null;
  title: string; hours: number; lecturer: string | null; holder_name: string | null; issued_at: string; pdf_url: string | null;
};

export const dvppApi = {
  requestMagicLink: (input: { email: string; name?: string; next?: string; newsletter?: boolean; staffroomCode?: string | null }) =>
    call<{ ok: true; created: boolean }>('/dvpp/auth/magic-link', { body: { ...input, ...attributionPayload() } }),

  verify: async (token: string) => {
    const r = await call<{ ok: true; sessionToken: string; next: string; firstLogin: boolean; joined: { code: string; schoolName: string } | null; me: DvppMe }>(
      `/dvpp/auth/verify?token=${encodeURIComponent(token)}`,
    );
    setDvppSession(r.sessionToken);
    return r;
  },

  logout: async () => {
    try { await call('/dvpp/auth/logout', { method: 'POST', body: {} }); } finally { setDvppSession(null); }
  },

  me: () => call<{ me: DvppMe | null; access?: DvppAccess }>('/dvpp/me'),

  updateMe: (input: { firstName?: string; lastName?: string; position?: string; redIzo?: string; ico?: string; schoolName?: string; profile?: Record<string, unknown> }) =>
    call<{ ok: true; me: DvppMe }>('/dvpp/me', { method: 'PUT', body: input }),

  searchSchools: (q: string) =>
    call<{ results: Array<{ redIzo: string; ico: string | null; name: string; city: string | null; type: string | null; isPrimary: boolean; teachersCount: number | null }> }>(
      `/dvpp/schools/search?q=${encodeURIComponent(q)}`,
    ),

  catalog: () => call<DvppCatalog>('/dvpp/catalog'),

  progress: (input: { videoId: string; position: number; duration?: number | null; completed?: boolean }) =>
    call<{ ok: true; activated: boolean }>('/dvpp/progress', { body: input }),

  certificates: () => call<{ certificates: DvppCertificate[] }>('/dvpp/certificates'),

  issueCertificate: (input: { kind?: 'dvpp' | 'feedback'; webinarId?: string | null; videoId?: string | null; title: string; hours?: number; lecturer?: string | null; holderName?: string | null }) =>
    call<{ ok: true; certificate: DvppCertificate; created: boolean }>('/dvpp/certificate', { body: input }),

  staffroom: () => call<DvppStaffroom>('/dvpp/staffroom'),
  createStaffroom: () => call<{ ok: true; created: boolean; code: string; shareUrl: string }>('/dvpp/staffroom', { body: {} }),
  shareStaffroom: (channel: string) => call<{ ok: true }>('/dvpp/staffroom/share', { body: { channel } }),
  previewStaffroom: (code: string) =>
    call<{ code: string; status: string; confirmed: number; target: number; school: { name: string; city: string | null } | null; founderFirstName: string | null }>(
      `/dvpp/staffroom/preview?code=${encodeURIComponent(code)}`,
    ),
  joinStaffroom: (code: string) =>
    call<{ ok: true; added: boolean; alreadyMember?: boolean; school: { name: string }; status: string; confirmed: number; target: number }>('/dvpp/staffroom/join', { body: { code } }),
  messageColleague: (input: { email: string; message: string }) => call<{ ok: true }>('/dvpp/staffroom/message', { body: input }),
  directorUnlock: () => call<{ ok: true; pending: false; code: string; status: string } | { ok: true; pending: true; sentTo: string }>('/dvpp/staffroom/director-unlock', { body: {} }),
  staffroomReport: (since?: string) =>
    call<{ teachers: Array<{ name: string; email: string; certificates: number; hours: number }>; totalHours: number; totalCertificates: number }>(
      `/dvpp/staffroom/report${since ? `?since=${encodeURIComponent(since)}` : ''}`,
    ),

  topics: () => call<{ topics: DvppTopic[] }>('/dvpp/topics'),
  vote: (topicId: string) => call<{ ok: true; voted: boolean; votes: number }>('/dvpp/vote', { body: { topicId } }),

  event: (event: string, meta?: Record<string, unknown>) =>
    call<{ ok: true }>('/dvpp/events', { body: { event, meta, ...attributionPayload() } }).catch(() => ({ ok: true as const })),
};
