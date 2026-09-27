import React, { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { Radio, Loader2 } from 'lucide-react';
import type { Webinar } from '../data/webinars';
import { projectId, publicAnonKey } from '../utils/supabase/info';
import { attendeesCountLabel } from '../utils/webinarLiveDelivery';

/**
 * Režim `liveDeliveryMode === 'youtube_redirect'`.
 *
 * Divák nesleduje stream na našem webu — jen se u něj zapíše, že přišel,
 * a hned putuje na YouTube. Web tak nemůže vysílání položit: i kdyby zápis
 * účasti selhal nebo se zasekl, přesměrování proběhne (limit `MAX_WAIT_MS`).
 */

const SERVER = `https://${projectId}.supabase.co/functions/v1/make-server-93a20b6f`;
const FF = { fontFamily: "'Fenomen Sans', sans-serif" } as const;

/** Zápis účasti nikoho nezdrží — po této době jdeme na stream tak jako tak. */
const MAX_WAIT_MS = 4000;
/** Ať si divák stihne přečíst, kolik lidí je přihlášeno a kam ho posíláme. */
const MIN_SHOW_MS = 3000;

type ArrivalSource = 'lobby' | 'identity' | 'anonymous';

function readStoredEmail(webinarId: string): string {
  try {
    if (typeof localStorage === 'undefined') return '';
    const checkin = localStorage.getItem('vvb_checkin');
    if (checkin) {
      const d = JSON.parse(checkin);
      if (d?.email && (!d.webinarId || d.webinarId === webinarId)) return String(d.email).trim();
    }
    const identity = localStorage.getItem('vvb_identity');
    if (identity) {
      const d = JSON.parse(identity);
      if (d?.email) return String(d.email).trim();
    }
  } catch {
    /* privátní režim — bez e-mailu se prostě zapíše anonymní příchod */
  }
  return '';
}

function rememberIdentity(webinarId: string, email: string, name: string): void {
  try {
    if (typeof localStorage === 'undefined' || !email) return;
    localStorage.setItem('vvb_checkin', JSON.stringify({ email, webinarId }));
    const prevRaw = localStorage.getItem('vvb_identity');
    const prev = prevRaw ? JSON.parse(prevRaw) : {};
    const next = {
      ...(typeof prev === 'object' && prev ? prev : {}),
      ...(name ? { name } : {}),
      email,
      webinarId,
      since: new Date().toISOString(),
    };
    localStorage.setItem('vvb_identity', JSON.stringify(next));
  } catch {
    /* nevadí, jde jen o pohodlí při návratu na stránku */
  }
}

/** Počet přihlášených pro uvítací větu. Bez odpovědi se věta zobrazí bez čísla. */
async function fetchAttendeesCount(webinarId: string): Promise<number | null> {
  try {
    const res = await fetch(`${SERVER}/webinar-registrace-count/${encodeURIComponent(webinarId)}`, {
      headers: { Authorization: `Bearer ${publicAnonKey}` },
    });
    if (!res.ok) return null;
    const data = await res.json();
    const n = Number(data?.count);
    return Number.isFinite(n) && n >= 0 ? n : null;
  } catch {
    return null;
  }
}

async function postJson(path: string, body: unknown): Promise<Response> {
  return fetch(`${SERVER}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${publicAnonKey}` },
    body: JSON.stringify(body),
  });
}

/**
 * Zapíše příchod. Vrací se co nejdřív — volající na výsledek nečeká déle
 * než `MAX_WAIT_MS` a chyby jsou tiché (divák nesmí uvíznout kvůli API).
 */
async function recordArrival(webinar: Webinar, lobbyToken: string | null): Promise<void> {
  let email = readStoredEmail(webinar.id);
  let source: ArrivalSource = email ? 'identity' : 'anonymous';

  // 1. Osobní odkaz z potvrzovacího e-mailu — ověří se na serveru a rovnou zapíše účast.
  if (lobbyToken) {
    try {
      const res = await postJson('/webinar-lobby-verify', { token: lobbyToken });
      const data = await res.json();
      if (res.ok && data?.email) {
        email = String(data.email).trim();
        source = 'lobby';
        rememberIdentity(webinar.id, email, String(data.name || '').trim());
      }
    } catch {
      /* padáme na e-mail z prohlížeče, případně na anonymní zápis */
    }
  }

  // 2. Známý e-mail bez lobby tokenu — účast zapíše standardní check-in.
  if (email && source !== 'lobby') {
    try {
      await postJson('/webinar-checkin', {
        webinarId: webinar.id,
        email,
        webinarSlug: webinar.slug || webinar.id,
      });
    } catch {
      /* účast se nezapíše, na stream ale pustíme */
    }
  }

  // 3. Vždy si poznamenáme samotný příchod na stream (i bez e-mailu).
  try {
    await postJson('/webinar-live-entry', {
      webinarId: webinar.id,
      webinarSlug: webinar.slug || webinar.id,
      email,
      source,
    });
  } catch {
    /* endpoint je jen počítadlo — jeho výpadek nesmí nic zdržet */
  }
}

export function WebinarLiveRedirectPage({
  webinar,
  streamUrl,
}: {
  webinar: Webinar;
  streamUrl: string;
}) {
  const [searchParams] = useSearchParams();
  const isPreview = searchParams.get('preview') === '1';
  const lobbyToken = searchParams.get('lobby');
  const startedRef = useRef(false);
  const [redirecting] = useState(!isPreview);
  const [attendees, setAttendees] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchAttendeesCount(webinar.id).then((n) => {
      if (!cancelled) setAttendees(n);
    });
    return () => { cancelled = true; };
  }, [webinar.id]);

  useEffect(() => {
    if (isPreview || startedRef.current) return;
    startedRef.current = true;

    let done = false;
    const go = () => {
      if (done) return;
      done = true;
      window.location.replace(streamUrl);
    };

    const startedAt = Date.now();
    const hardStop = setTimeout(go, MAX_WAIT_MS);
    let softStop: ReturnType<typeof setTimeout> | null = null;
    recordArrival(webinar, lobbyToken)
      .catch(() => {})
      .finally(() => {
        clearTimeout(hardStop);
        /* Zápis bývá hotový za zlomek sekundy — větu necháme dočíst. */
        const remaining = Math.max(0, MIN_SHOW_MS - (Date.now() - startedAt));
        softStop = setTimeout(go, remaining);
      });

    return () => {
      clearTimeout(hardStop);
      if (softStop) clearTimeout(softStop);
    };
  }, [webinar, lobbyToken, streamUrl, isPreview]);

  const welcome = attendees === null
    ? 'Dnešní webinář probíhá na platformě YouTube, za okamžik budete přesměrováni. Děkujeme za váš zájem.'
    : `Na dnešní webinář je přihlášeno ${attendeesCountLabel(attendees)} a probíhá na platformě YouTube, za okamžik budete přesměrováni. Děkujeme za váš zájem.`;

  return (
    <div className="flex min-h-screen w-full items-center justify-center px-6 py-16" style={{ background: '#F5F6FB' }}>
      <div className="w-full max-w-[460px] rounded-[28px] border border-[#001161]/8 bg-white p-9 text-center shadow-xl">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#001161]/8">
          {redirecting ? (
            <Loader2 className="h-6 w-6 animate-spin text-[#001161]" />
          ) : (
            <Radio className="h-6 w-6 text-[#001161]" />
          )}
        </div>

        <h1 className="mb-2 text-[21px] font-bold text-[#001161]" style={FF}>
          {isPreview ? 'Náhled: přesměrování na YouTube' : 'Přepojujeme vás na vysílání'}
        </h1>
        <p className="mb-7 text-[14px] leading-relaxed text-[#001161]/55" style={FF}>
          {isPreview
            ? `Náhled: účastník uvidí větu „${welcome}“ a po pár sekundách se otevře YouTube. Náhled nikam nepřesměrovává a účast nezapisuje.`
            : welcome}
        </p>
        {!isPreview && (
          <p className="-mt-4 mb-7 text-[12px] text-[#001161]/40" style={FF}>
            {'Pokud se nic nestane, klikněte na tlačítko níž.'}
          </p>
        )}

        <div className="flex flex-col gap-2.5">
          <a
            href={streamUrl}
            className="flex items-center justify-center gap-2 rounded-full bg-[#001161] px-6 py-3 text-[14px] font-bold text-white shadow-md transition hover:bg-[#001a8c]"
            style={FF}
          >
            <Radio className="h-3.5 w-3.5" />
            {'Otevřít vysílání na YouTube'}
          </a>
          <p className="text-[12px] text-[#001161]/35" style={FF}>{webinar.title}</p>
        </div>
      </div>
    </div>
  );
}
