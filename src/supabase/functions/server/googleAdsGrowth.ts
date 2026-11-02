/**
 * Google Ads – denní automatizace pro tištěné sešity Vividbooks.
 *
 * Co dělá každý den (cron → POST /cron/google-ads-growth):
 *  1. z živého katalogu (stejný zdroj jako feed pro Merchant Center) sestaví návrhy
 *     vyhledávacích reklam: jedna skupina reklam = jedna řada sešitu (bez „1. díl / 2. díl“),
 *     klíčová slova podle předmětu a ročníku, responzivní reklama z ověřených údajů
 *     (název, ročník, cena, doprava) – nic si nevymýšlí;
 *  2. pokud jsou nastavené přístupy ke Google Ads API, zjistí v Plánovači klíčových slov
 *     měsíční hledanost pro Česko a přidá související výrazy s dostatečnou hledaností;
 *  3. uloží denní snímek hledanosti, aby šel vidět trend.
 *
 * Co NEDĚLÁ samo: nic do Google Ads nezapisuje. Zápis spouští jen admin:
 *  schválit návrh → „odeslat schválené“ (kampaň i reklamy vzniknou POZASTAVENÉ)
 *  → samostatné „spustit kampaň“. Denní rozpočet má pevný strop.
 *
 * Stav je v KV (klíče gads:*), stejně jako u Growth Agenta.
 */
import * as kv from './kv_store.tsx';

const KEY_DRAFTS = 'gads:drafts';
const KEY_KEYWORDS = 'gads:keywords';
const KEY_SETTINGS = 'gads:settings';
const KEY_RUNS = 'gads:runs';
const KEY_HISTORY = 'gads:history';

/** Tvrdý strop, který nejde přepsat nastavením: celkový denní rozpočet kampaně v Kč. */
export const GADS_HARD_MAX_DAILY_CZK = 1000;
const CAMPAIGN_NAME = 'Vividbooks – Vyhledávání – Sešity (automat)';
const DEFAULT_API_VERSION = 'v25';
const LANGUAGE_CZECH = 'languageConstants/1021';
const GEO_CZECHIA = 'geoTargetConstants/2203';
const UTM = 'utm_source=google&utm_medium=cpc&utm_campaign=vividbooks-search-sesity';
const SHIPPING_FROM_KC = 79;
const MIN_IDEA_VOLUME = 10;
const MAX_IDEAS_PER_DRAFT = 8;

/** Výrazy, které nejsou nákup sešitu – kampaň je dostane jako vylučující. */
const NEGATIVE_KEYWORDS = [
  'pdf', 'zdarma', 'ke stažení', 'stáhnout', 'řešení', 'odpovědi', 'klíč', 'používaný',
  'bazar', 'použitý', 'sleva', 'torrent', 'online test', 'ppt', 'prezentace',
];

const SUBJECTS = ['Fyzika', 'Chemie', 'Přírodopis', 'Matematika', 'Prvouka', 'Český jazyk', 'Dějepis', 'Zeměpis'];
const SERIES = ['krok za krokem', 'pro všechny', 'početníček'];

type Match = 'PHRASE' | 'EXACT';
type DraftStatus = 'draft' | 'approved' | 'rejected' | 'pushed' | 'failed';

type DraftKeyword = { text: string; match: Match; source: 'seed' | 'idea' };

type Draft = {
  id: string;
  group: string;
  adGroupName: string;
  finalUrl: string;
  priceFromKc: number | null;
  keywords: DraftKeyword[];
  headlines: string[];
  descriptions: string[];
  path1: string;
  path2: string;
  status: DraftStatus;
  /** Co brání schválení (málo textů, chybí cena…). Prázdné = lze schválit. */
  problems: string[];
  google?: { adGroup?: string; ad?: string };
  error?: string;
  createdAt: string;
  updatedAt: string;
};

type KeywordMetric = {
  volume: number | null;
  competition: string | null;
  lowCpcKc: number | null;
  highCpcKc: number | null;
  updatedAt: string;
};

type Settings = {
  dailyBudgetCzk: number;
  maxCpcCzk: number;
  campaign?: { resource: string; budget: string; createdAt: string; enabledAt?: string };
};

type FeedItem = {
  title: string;
  price: string;
  link: string;
  googleProductCategory: string;
};

export type GoogleAdsGrowthDeps = {
  app: any;
  requireAdmin: (req: Request) => Promise<Response | unknown>;
  cronSecretOk: (c: any) => boolean;
  loadFeedItems: () => Promise<FeedItem[]>;
  publicOrigin: () => string;
};

/* ───────────── pomocné ───────────── */

const nowIso = () => new Date().toISOString();

function slug(text: string): string {
  return text
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
}

function priceKc(price: string): number | null {
  const n = Number(String(price).replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
}

function withUtm(url: string): string {
  return url + (url.includes('?') ? '&' : '?') + UTM;
}

function dedupe<T>(items: T[], key: (t: T) => string): T[] {
  const seen = new Set<string>();
  return items.filter((i) => {
    const k = key(i);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/** Řada sešitu = název bez dílu („– 1. díl“, „/ 2. díl“, „(8. ročník)“ u chemie zůstává). */
function normalizeTitle(title: string): string {
  return title
    .replace(/\s*[–-]\s*\d\.\s*díl\b.*$/i, '')
    .replace(/\s*\/\s*\d\.\s*díl\b.*$/i, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function parseTitle(norm: string): { subject: string | null; grade: number | null; series: string | null } {
  const lower = norm.toLowerCase();
  const subject = SUBJECTS.find((s) => lower.includes(s.toLowerCase())) ?? null;
  const g = norm.match(/(\d)\.\s*ročník/i);
  const series = SERIES.find((s) => lower.includes(s)) ?? null;
  return { subject, grade: g ? Number(g[1]) : null, series };
}

/* ───────────── sestavení návrhů ───────────── */

function seedKeywords(norm: string): string[] {
  const { subject, grade, series } = parseTitle(norm);
  const out: string[] = [];
  if (subject && grade) {
    const s = subject.toLowerCase();
    out.push(
      `${s} ${grade}. ročník pracovní sešit`,
      `pracovní sešit ${s} ${grade}. ročník`,
      `pracovní sešit ${s} ${grade}. třída`,
      `${s} ${grade}. třída pracovní sešit`,
    );
    if (series) out.push(`${s} ${series} ${grade}. ročník`, `${s} ${series} pracovní sešit`);
  } else {
    const flat = norm.toLowerCase().replace(/\s*[–-]\s*/g, ' ').replace(/\s{2,}/g, ' ').trim();
    const tail = norm.split(/\s[–-]\s/).pop()!.toLowerCase().trim();
    out.push(flat, tail);
  }
  return dedupe(out.filter((t) => t.split(' ').length >= 2 || t.length >= 8), (t) => t);
}

function buildCopy(norm: string, price: number | null) {
  const { subject, grade } = parseTitle(norm);
  const stupen = grade ? (grade <= 5 ? '1. stupeň ZŠ' : '2. stupeň ZŠ') : null;
  const h: string[] = [];
  const d: string[] = [];
  if (subject && grade) {
    h.push(`${subject} ${grade}. ročník`, `Pracovní sešit ${subject}`, `Pracovní sešit ${subject} ${grade}. třída`);
  } else {
    h.push(norm.slice(0, 30), `Vividbooks – ${norm.split(/\s[–-]\s/)[0]}`.slice(0, 30));
  }
  h.push('Pracovní sešit od Vividbooks', 'Vividbooks – pracovní sešity', 'Tištěný pracovní sešit', 'Objednejte online',
    `Doprava od ${SHIPPING_FROM_KC} Kč`);
  if (price) h.push(`Cena od ${price} Kč`);
  if (stupen) h.push(`Pro ${stupen}`);

  if (subject && grade) {
    d.push(`Pracovní sešit ${subject} pro ${grade}. ročník ZŠ od Vividbooks.${price ? ` Cena od ${price} Kč,` : ''} doprava od ${SHIPPING_FROM_KC} Kč.`);
    d.push(`Tištěný pracovní sešit pro ${stupen}. Objednejte online na vividbooks.com.`);
    d.push(`Sešit ${subject} ${grade}. ročník. Objednávka online, doprava od ${SHIPPING_FROM_KC} Kč.`);
  } else {
    const short = norm.split(/\s[–-]\s/).pop()!.trim();
    d.push(`${short} od Vividbooks. Objednejte online na vividbooks.com.`);
    d.push(`${short}: tištěný sešit Vividbooks.${price ? ` Cena od ${price} Kč,` : ''} doprava od ${SHIPPING_FROM_KC} Kč.`);
    d.push(`Tištěné sešity Vividbooks.${price ? ` Cena od ${price} Kč,` : ''} doprava od ${SHIPPING_FROM_KC} Kč.`);
  }
  const headlines = dedupe(h.filter((x) => x.length > 0 && x.length <= 30), (x) => x.toLowerCase());
  const descriptions = dedupe(d.filter((x) => x.length <= 90), (x) => x.toLowerCase());
  return { headlines: headlines.slice(0, 15), descriptions: descriptions.slice(0, 4) };
}

function problemsOf(d: Pick<Draft, 'headlines' | 'descriptions' | 'keywords' | 'finalUrl'>): string[] {
  const p: string[] = [];
  if (d.headlines.length < 3) p.push('Málo nadpisů (potřeba aspoň 3 do 30 znaků).');
  if (d.descriptions.length < 2) p.push('Málo popisů (potřeba aspoň 2 do 90 znaků).');
  if (d.keywords.length === 0) p.push('Žádná klíčová slova.');
  if (!/^https:\/\//.test(d.finalUrl)) p.push('Chybí cílová adresa.');
  return p;
}

function brandDraft(origin: string, prev?: Draft): Draft {
  const keywords: DraftKeyword[] = [
    { text: 'vividbooks', match: 'EXACT', source: 'seed' },
    { text: 'vividbooks', match: 'PHRASE', source: 'seed' },
    { text: 'vividbooks sešity', match: 'PHRASE', source: 'seed' },
    { text: 'vividbooks pracovní sešity', match: 'PHRASE', source: 'seed' },
  ];
  const headlines = ['Vividbooks – pracovní sešity', 'Oficiální e-shop Vividbooks', 'Sešity pro 1. i 2. stupeň', 'Objednejte online', `Doprava od ${SHIPPING_FROM_KC} Kč`];
  const descriptions = [
    `Tištěné pracovní sešity Vividbooks pro základní školy. Objednejte online, doprava od ${SHIPPING_FROM_KC} Kč.`,
    'Matematika, fyzika, chemie, přírodopis, prvouka a český jazyk. Objednávka na vividbooks.com.',
  ];
  const base = {
    id: 'znacka', group: 'Značka', adGroupName: 'Značka Vividbooks', finalUrl: withUtm(origin + '/'),
    priceFromKc: null, keywords, headlines, descriptions, path1: 'sesity', path2: 'vividbooks',
  };
  return {
    ...base, status: prev?.status ?? 'draft', google: prev?.google, error: prev?.error,
    problems: problemsOf(base), createdAt: prev?.createdAt ?? nowIso(), updatedAt: nowIso(),
  };
}

async function loadJson<T>(key: string, fallback: T): Promise<T> {
  const v = await kv.get(key);
  return (v as T) ?? fallback;
}

async function buildDrafts(deps: GoogleAdsGrowthDeps): Promise<Draft[]> {
  const feed = (await deps.loadFeedItems()).filter((i) => i.googleProductCategory === 'Media > Books');
  const previous = await loadJson<Draft[]>(KEY_DRAFTS, []);
  const prevById = new Map(previous.map((d) => [d.id, d]));

  const groups = new Map<string, FeedItem[]>();
  for (const item of feed) {
    const norm = normalizeTitle(item.title);
    groups.set(norm, [...(groups.get(norm) ?? []), item]);
  }

  const drafts: Draft[] = [brandDraft(deps.publicOrigin().replace(/\/$/, ''), prevById.get('znacka'))];
  for (const [norm, items] of groups) {
    const id = slug(norm);
    const prev = prevById.get(id);
    const prices = items.map((i) => priceKc(i.price)).filter((x): x is number => x !== null);
    const price = prices.length ? Math.min(...prices) : null;
    const frozen = prev && (prev.status === 'pushed' || prev.status === 'approved');
    const seeds = seedKeywords(norm);
    const keywords: DraftKeyword[] = frozen
      ? prev!.keywords
      : [
          ...seeds.map((t, i): DraftKeyword => ({ text: t, match: 'PHRASE', source: 'seed' })),
          ...(seeds[0] ? [{ text: seeds[0], match: 'EXACT' as Match, source: 'seed' as const }] : []),
          // dříve nalezené související výrazy zůstávají, dokud je nesmaže další běh
          ...(prev?.keywords.filter((k) => k.source === 'idea') ?? []),
        ];
    const copy = frozen ? { headlines: prev!.headlines, descriptions: prev!.descriptions } : buildCopy(norm, price);
    const { subject } = parseTitle(norm);
    const base = {
      id, group: norm, adGroupName: norm.slice(0, 120),
      finalUrl: frozen ? prev!.finalUrl : withUtm(items[0].link),
      priceFromKc: price, keywords: dedupe(keywords, (k) => `${k.match}:${k.text}`),
      headlines: copy.headlines, descriptions: copy.descriptions,
      path1: 'sesity', path2: slug(subject ?? norm).slice(0, 15),
    };
    drafts.push({
      ...base,
      status: prev?.status === 'rejected' ? 'rejected' : (prev?.status ?? 'draft'),
      google: prev?.google, error: prev?.error,
      problems: problemsOf(base), createdAt: prev?.createdAt ?? nowIso(), updatedAt: nowIso(),
    });
  }
  return drafts;
}

/* ───────────── Google Ads API ───────────── */

type GadsConfig = {
  developerToken: string; clientId: string; clientSecret: string; refreshToken: string;
  customerId: string; loginCustomerId: string | null; version: string;
};

export function gadsConfig(): GadsConfig | null {
  const env = (n: string) => Deno.env.get(n)?.trim() || '';
  const cfg = {
    developerToken: env('GOOGLE_ADS_DEVELOPER_TOKEN'),
    clientId: env('GOOGLE_ADS_CLIENT_ID'),
    clientSecret: env('GOOGLE_ADS_CLIENT_SECRET'),
    refreshToken: env('GOOGLE_ADS_REFRESH_TOKEN'),
    customerId: env('GOOGLE_ADS_CUSTOMER_ID').replace(/\D/g, ''),
    loginCustomerId: env('GOOGLE_ADS_LOGIN_CUSTOMER_ID').replace(/\D/g, '') || null,
    version: env('GOOGLE_ADS_API_VERSION') || DEFAULT_API_VERSION,
  };
  return cfg.developerToken && cfg.clientId && cfg.clientSecret && cfg.refreshToken && cfg.customerId ? cfg : null;
}

let tokenCache: { token: string; exp: number } | null = null;

async function accessToken(cfg: GadsConfig): Promise<string> {
  if (tokenCache && tokenCache.exp > Date.now() + 60_000) return tokenCache.token;
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: cfg.clientId, client_secret: cfg.clientSecret,
      refresh_token: cfg.refreshToken, grant_type: 'refresh_token',
    }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.access_token) throw new Error(`OAuth Google: ${j.error_description || j.error || r.status}`);
  tokenCache = { token: j.access_token, exp: Date.now() + (Number(j.expires_in) || 3000) * 1000 };
  return tokenCache.token;
}

async function gads(cfg: GadsConfig, path: string, body: unknown): Promise<any> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${await accessToken(cfg)}`,
    'developer-token': cfg.developerToken,
    'Content-Type': 'application/json',
  };
  if (cfg.loginCustomerId) headers['login-customer-id'] = cfg.loginCustomerId;
  const r = await fetch(`https://googleads.googleapis.com/${cfg.version}/customers/${cfg.customerId}${path}`, {
    method: 'POST', headers, body: JSON.stringify(body),
  });
  const text = await r.text();
  let j: any = {};
  try { j = JSON.parse(text); } catch { /* nechá se text */ }
  if (!r.ok) {
    const msg = j?.error?.details?.[0]?.errors?.[0]?.message || j?.error?.message || text.slice(0, 300);
    throw new Error(`Google Ads ${r.status}: ${msg}`);
  }
  return j;
}

function microsToKc(m: unknown): number | null {
  const n = Number(m);
  return Number.isFinite(n) && n > 0 ? Math.round((n / 1_000_000) * 100) / 100 : null;
}

async function fetchIdeas(cfg: GadsConfig, seeds: string[]): Promise<Array<{ text: string; metric: KeywordMetric }>> {
  const j = await gads(cfg, ':generateKeywordIdeas', {
    language: LANGUAGE_CZECH,
    geoTargetConstants: [GEO_CZECHIA],
    keywordPlanNetwork: 'GOOGLE_SEARCH',
    keywordSeed: { keywords: seeds },
    includeAdultKeywords: false,
    pageSize: 1000,
  });
  return (j.results ?? []).map((r: any) => ({
    text: String(r.text || '').toLowerCase(),
    metric: {
      volume: r.keywordIdeaMetrics?.avgMonthlySearches != null ? Number(r.keywordIdeaMetrics.avgMonthlySearches) : null,
      competition: r.keywordIdeaMetrics?.competition ?? null,
      lowCpcKc: microsToKc(r.keywordIdeaMetrics?.lowTopOfPageBidMicros),
      highCpcKc: microsToKc(r.keywordIdeaMetrics?.highTopOfPageBidMicros),
      updatedAt: nowIso(),
    },
  }));
}

function ideaIsRelevant(text: string, norm: string): boolean {
  const { subject, grade } = parseTitle(norm);
  if (!subject || !grade) return false;
  const t = text.toLowerCase();
  if (!t.includes(subject.toLowerCase())) return false;
  if (!new RegExp(`(^|\\D)${grade}(\\D|$)`).test(t)) return false;
  if (!/(sešit|pracovn|učebnic)/.test(t)) return false;
  return !NEGATIVE_KEYWORDS.some((n) => t.includes(n));
}

/* ───────────── denní běh ───────────── */

export async function runDailyResearch(deps: GoogleAdsGrowthDeps): Promise<Record<string, unknown>> {
  const started = Date.now();
  const run: Record<string, unknown> = { at: nowIso(), mode: 'offline' };
  let drafts = await buildDrafts(deps);
  const metrics = await loadJson<Record<string, KeywordMetric>>(KEY_KEYWORDS, {});
  const cfg = gadsConfig();

  if (cfg) {
    run.mode = 'api';
    try {
      const seeds = dedupe(drafts.flatMap((d) => d.keywords.filter((k) => k.source === 'seed').map((k) => k.text)), (t) => t);
      const ideasByDraft = new Map<string, Array<{ text: string; volume: number }>>();
      for (let i = 0; i < seeds.length; i += 20) {
        const ideas = await fetchIdeas(cfg, seeds.slice(i, i + 20));
        for (const idea of ideas) {
          metrics[idea.text] = idea.metric;
          const vol = idea.metric.volume ?? 0;
          if (vol < MIN_IDEA_VOLUME) continue;
          for (const d of drafts) {
            if (ideaIsRelevant(idea.text, d.group)) {
              const list = ideasByDraft.get(d.id) ?? [];
              list.push({ text: idea.text, volume: vol });
              ideasByDraft.set(d.id, list);
            }
          }
        }
        await new Promise((r) => setTimeout(r, 400));
      }
      drafts = drafts.map((d) => {
        if (d.status === 'pushed' || d.status === 'approved') return d;
        const seedsKept = d.keywords.filter((k) => k.source === 'seed');
        const have = new Set(seedsKept.map((k) => k.text));
        const found = dedupe(ideasByDraft.get(d.id) ?? [], (x) => x.text)
          .filter((x) => !have.has(x.text))
          .sort((a, b) => b.volume - a.volume)
          .slice(0, MAX_IDEAS_PER_DRAFT)
          .map((x): DraftKeyword => ({ text: x.text, match: 'PHRASE', source: 'idea' }));
        const keywords = [...seedsKept, ...found];
        return { ...d, keywords, problems: problemsOf({ ...d, keywords }) };
      });
      run.keywordsWithMetrics = Object.keys(metrics).length;
    } catch (e: any) {
      run.error = e?.message || String(e);
    }
  } else {
    run.note = 'Přístupy ke Google Ads API nejsou nastavené – připravily se jen návrhy bez hledanosti.';
  }

  await kv.set(KEY_DRAFTS, drafts);
  await kv.set(KEY_KEYWORDS, metrics);

  // denní snímek: součet hledanosti seed výrazů na skupinu
  const today = nowIso().slice(0, 10);
  const totals: Record<string, number> = {};
  for (const d of drafts) {
    totals[d.id] = d.keywords
      .filter((k) => k.match === 'PHRASE')
      .reduce((s, k) => s + (metrics[k.text]?.volume ?? 0), 0);
  }
  const history = (await loadJson<Array<{ date: string; totals: Record<string, number> }>>(KEY_HISTORY, []))
    .filter((h) => h.date !== today);
  history.push({ date: today, totals });
  await kv.set(KEY_HISTORY, history.slice(-120));

  run.drafts = drafts.length;
  run.ms = Date.now() - started;
  const runs = await loadJson<Array<Record<string, unknown>>>(KEY_RUNS, []);
  await kv.set(KEY_RUNS, [run, ...runs].slice(0, 30));
  return run;
}

/* ───────────── zápis do Google Ads (vždy pozastavený) ───────────── */

async function loadSettings(): Promise<Settings> {
  const s = await loadJson<Partial<Settings>>(KEY_SETTINGS, {});
  return {
    dailyBudgetCzk: Math.min(Number(s.dailyBudgetCzk) || 0, GADS_HARD_MAX_DAILY_CZK),
    maxCpcCzk: Number(s.maxCpcCzk) > 0 ? Number(s.maxCpcCzk) : 12,
    campaign: s.campaign,
  };
}

async function assertCzkAccount(cfg: GadsConfig): Promise<void> {
  const j = await gads(cfg, '/googleAds:search', { query: 'SELECT customer.currency_code FROM customer LIMIT 1' });
  const cur = j.results?.[0]?.customer?.currencyCode;
  if (cur !== 'CZK') throw new Error(`Účet Google Ads nemá měnu CZK (${cur ?? 'neznámá'}) – rozpočet by nesouhlasil, nic jsem nezapsal.`);
}

async function ensureCampaign(cfg: GadsConfig, s: Settings): Promise<Settings> {
  if (s.campaign) return s;
  if (s.dailyBudgetCzk <= 0) throw new Error('Denní rozpočet je 0 Kč. Nastavte ho (nejvýš ' + GADS_HARD_MAX_DAILY_CZK + ' Kč), jinak se kampaň nezaloží.');
  const cid = cfg.customerId;
  const ops: any[] = [
    { campaignBudgetOperation: { create: {
      resourceName: `customers/${cid}/campaignBudgets/-1`,
      name: `${CAMPAIGN_NAME} – rozpočet ${Date.now()}`,
      amountMicros: String(Math.round(s.dailyBudgetCzk * 1_000_000)),
      deliveryMethod: 'STANDARD', explicitlyShared: false,
    } } },
    { campaignOperation: { create: {
      resourceName: `customers/${cid}/campaigns/-2`,
      name: CAMPAIGN_NAME,
      status: 'PAUSED',
      advertisingChannelType: 'SEARCH',
      campaignBudget: `customers/${cid}/campaignBudgets/-1`,
      networkSettings: { targetGoogleSearch: true, targetSearchNetwork: false, targetContentNetwork: false },
      targetSpend: { cpcBidCeilingMicros: String(Math.round(s.maxCpcCzk * 1_000_000)) },
      containsEuPoliticalAdvertising: 'DOES_NOT_CONTAIN_EU_POLITICAL_ADVERTISING',
      geoTargetTypeSetting: { positiveGeoTargetType: 'PRESENCE' },
    } } },
    { campaignCriterionOperation: { create: { campaign: `customers/${cid}/campaigns/-2`, location: { geoTargetConstant: GEO_CZECHIA } } } },
    { campaignCriterionOperation: { create: { campaign: `customers/${cid}/campaigns/-2`, language: { languageConstant: LANGUAGE_CZECH } } } },
    ...NEGATIVE_KEYWORDS.map((text) => ({
      campaignCriterionOperation: { create: { campaign: `customers/${cid}/campaigns/-2`, negative: true, keyword: { text, matchType: 'PHRASE' } } },
    })),
  ];
  const j = await gads(cfg, '/googleAds:mutate', { mutateOperations: ops });
  const budget = j.mutateOperationResponses?.[0]?.campaignBudgetResult?.resourceName;
  const campaign = j.mutateOperationResponses?.[1]?.campaignResult?.resourceName;
  if (!campaign || !budget) throw new Error('Google Ads nevrátil identifikátor nové kampaně.');
  const next = { ...s, campaign: { resource: campaign, budget, createdAt: nowIso() } };
  await kv.set(KEY_SETTINGS, next);
  return next;
}

async function pushDraft(cfg: GadsConfig, campaign: string, d: Draft): Promise<{ adGroup: string; ad: string }> {
  const cid = cfg.customerId;
  const ag = `customers/${cid}/adGroups/-10`;
  const ops: any[] = [
    { adGroupOperation: { create: { resourceName: ag, name: d.adGroupName, campaign, status: 'ENABLED', type: 'SEARCH_STANDARD' } } },
    ...d.keywords.map((k) => ({
      adGroupCriterionOperation: { create: { adGroup: ag, status: 'ENABLED', keyword: { text: k.text, matchType: k.match } } },
    })),
    { adGroupAdOperation: { create: { adGroup: ag, status: 'ENABLED', ad: {
      finalUrls: [d.finalUrl],
      responsiveSearchAd: {
        headlines: d.headlines.map((text) => ({ text })),
        descriptions: d.descriptions.map((text) => ({ text })),
        path1: d.path1, path2: d.path2,
      },
    } } } },
  ];
  const j = await gads(cfg, '/googleAds:mutate', { mutateOperations: ops });
  const res = j.mutateOperationResponses ?? [];
  return {
    adGroup: res[0]?.adGroupResult?.resourceName ?? '',
    ad: res[res.length - 1]?.adGroupAdResult?.resourceName ?? '',
  };
}

/* ───────────── routy ───────────── */

export function registerGoogleAdsGrowthRoutes(deps: GoogleAdsGrowthDeps): void {
  const { app } = deps;
  const P = '/make-server-93a20b6f';
  const both = (method: 'get' | 'post' | 'put', path: string, handler: (c: any) => Promise<Response> | Response) => {
    app[method](`${P}${path}`, handler);
    app[method](path, handler);
  };
  const admin = (fn: (c: any) => Promise<Response>) => async (c: any) => {
    const gate = await deps.requireAdmin(c.req.raw);
    if (gate instanceof Response) return gate;
    try { return await fn(c); } catch (e: any) { return c.json({ error: e?.message || String(e) }, 500); }
  };

  both('post', '/cron/google-ads-growth', async (c) => {
    if (!deps.cronSecretOk(c)) return c.json({ error: 'unauthorized' }, 401);
    try { return c.json({ ok: true, run: await runDailyResearch(deps) }); }
    catch (e: any) { return c.json({ error: e?.message || String(e) }, 500); }
  });

  both('get', '/admin/growth-gads/state', admin(async (c) => {
    const [drafts, metrics, settings, runs, history] = await Promise.all([
      loadJson<Draft[]>(KEY_DRAFTS, []), loadJson<Record<string, KeywordMetric>>(KEY_KEYWORDS, {}),
      loadSettings(), loadJson<Array<Record<string, unknown>>>(KEY_RUNS, []),
      loadJson<Array<{ date: string; totals: Record<string, number> }>>(KEY_HISTORY, []),
    ]);
    return c.json({
      apiConfigured: !!gadsConfig(), hardMaxDailyCzk: GADS_HARD_MAX_DAILY_CZK,
      settings, drafts, metrics, runs: runs.slice(0, 7), history: history.slice(-30),
    });
  }));

  both('post', '/admin/growth-gads/run', admin(async (c) => c.json({ ok: true, run: await runDailyResearch(deps) })));

  both('put', '/admin/growth-gads/settings', admin(async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const cur = await loadSettings();
    const daily = Number(body.dailyBudgetCzk);
    const cpc = Number(body.maxCpcCzk);
    if (cur.campaign && (Number.isFinite(daily) && daily !== cur.dailyBudgetCzk)) {
      return c.json({ error: 'Kampaň už existuje – změnu rozpočtu proveďte ve Google Ads (změna peněz vyžaduje vaše potvrzení tam).' }, 409);
    }
    const next: Settings = {
      ...cur,
      dailyBudgetCzk: Number.isFinite(daily) ? Math.max(0, Math.min(daily, GADS_HARD_MAX_DAILY_CZK)) : cur.dailyBudgetCzk,
      maxCpcCzk: Number.isFinite(cpc) && cpc > 0 ? Math.min(cpc, 100) : cur.maxCpcCzk,
    };
    await kv.set(KEY_SETTINGS, next);
    return c.json({ ok: true, settings: next });
  }));

  for (const action of ['approve', 'reject', 'reset'] as const) {
    both('post', `/admin/growth-gads/drafts/:id/${action}`, admin(async (c) => {
      const id = c.req.param('id');
      const drafts = await loadJson<Draft[]>(KEY_DRAFTS, []);
      const d = drafts.find((x) => x.id === id);
      if (!d) return c.json({ error: 'Návrh nenalezen' }, 404);
      if (d.status === 'pushed') return c.json({ error: 'Návrh už je ve Google Ads – upravte ho tam.' }, 409);
      if (action === 'approve') {
        if (d.problems.length) return c.json({ error: 'Návrh nelze schválit: ' + d.problems.join(' ') }, 422);
        d.status = 'approved';
      } else {
        d.status = action === 'reject' ? 'rejected' : 'draft';
      }
      d.updatedAt = nowIso();
      await kv.set(KEY_DRAFTS, drafts);
      return c.json({ ok: true, draft: d });
    }));
  }

  both('post', '/admin/growth-gads/push', admin(async (c) => {
    const cfg = gadsConfig();
    if (!cfg) return c.json({ error: 'Chybí přístupy ke Google Ads API (GOOGLE_ADS_* v tajemstvích funkce).' }, 412);
    const drafts = await loadJson<Draft[]>(KEY_DRAFTS, []);
    const todo = drafts.filter((d) => d.status === 'approved');
    if (!todo.length) return c.json({ ok: true, pushed: 0, note: 'Není co odeslat – žádný schválený návrh.' });
    await assertCzkAccount(cfg);
    const settings = await ensureCampaign(cfg, await loadSettings());
    const results: Array<{ id: string; ok: boolean; error?: string }> = [];
    for (const d of todo) {
      try {
        d.google = await pushDraft(cfg, settings.campaign!.resource, d);
        d.status = 'pushed'; d.error = undefined;
        results.push({ id: d.id, ok: true });
      } catch (e: any) {
        d.status = 'failed'; d.error = e?.message || String(e);
        results.push({ id: d.id, ok: false, error: d.error });
      }
      d.updatedAt = nowIso();
      await kv.set(KEY_DRAFTS, drafts);
    }
    return c.json({ ok: true, campaign: settings.campaign!.resource, enabled: false, results });
  }));

  both('post', '/admin/growth-gads/campaign/enable', admin(async (c) => {
    const body = await c.req.json().catch(() => ({}));
    if (body.confirm !== true) return c.json({ error: 'Spuštění kampaně vyžaduje confirm: true.' }, 400);
    const cfg = gadsConfig();
    if (!cfg) return c.json({ error: 'Chybí přístupy ke Google Ads API.' }, 412);
    const s = await loadSettings();
    if (!s.campaign) return c.json({ error: 'Kampaň ještě nebyla založena – nejdřív odešlete schválené návrhy.' }, 409);
    if (s.dailyBudgetCzk <= 0 || s.dailyBudgetCzk > GADS_HARD_MAX_DAILY_CZK) {
      return c.json({ error: 'Denní rozpočet je mimo povolený rozsah.' }, 409);
    }
    await gads(cfg, '/campaigns:mutate', {
      operations: [{ updateMask: 'status', update: { resourceName: s.campaign.resource, status: 'ENABLED' } }],
    });
    s.campaign.enabledAt = nowIso();
    await kv.set(KEY_SETTINGS, s);
    return c.json({ ok: true, enabledAt: s.campaign.enabledAt, dailyBudgetCzk: s.dailyBudgetCzk });
  }));
}
