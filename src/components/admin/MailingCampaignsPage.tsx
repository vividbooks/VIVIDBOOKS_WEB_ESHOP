import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router';
import {
  BarChart3,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Loader2,
  Mail,
  RefreshCw,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import { getSupabaseBrowser } from '@/lib/supabaseBrowser';
import { getEdgeFunctionHeaders } from '../../lib/edgeFunctionHeaders';
import { projectId } from '../../utils/supabase/info';

const SERVER = `https://${projectId}.supabase.co/functions/v1/make-server-93a20b6f`;
const FF = { fontFamily: "'Fenomen Sans', sans-serif" } as const;

type CampaignRow = {
  id: string;
  name: string | null;
  subject_line: string | null;
  status: string | null;
  scheduled_at: string | null;
  send_time: string | null;
  finished_at: string | null;
  created_at: string;
  draft_id: string | null;
};

type CampaignStats = {
  campaign_id: string;
  recipients_total: number;
  sent: number;
  failed: number;
  pending: number;
  skipped: number;
  delivered: number;
  hard_bounces: number;
  soft_bounces: number;
  unique_opens: number;
  unique_clicks: number;
  unsubscribes: number;
  bounces: number;
  complaints: number;
};

type TopLink = { url: string; clicks: number };
type FailedRecipient = { email: string; error: string | null };
type BouncedRecipient = { email: string; type: string; reason: string | null };

type CampaignDetail = {
  topLinks: TopLink[];
  failed: FailedRecipient[];
  bounced: BouncedRecipient[];
};

const BOUNCE_LABELS: Record<string, string> = {
  hard: 'trvalý',
  soft: 'dočasný',
  undetermined: 'neurčeno',
};

const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  draft: { label: 'Draft', cls: 'bg-gray-100 text-[#001161]/60' },
  scheduled: { label: 'Naplánováno', cls: 'bg-[#7C3AED]/10 text-[#7C3AED]' },
  sending: { label: 'Odesílá se', cls: 'bg-amber-100 text-amber-700' },
  sent: { label: 'Odesláno', cls: 'bg-emerald-100 text-emerald-700' },
  cancelled: { label: 'Zrušeno', cls: 'bg-red-100 text-red-600' },
};

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('cs-CZ', { dateStyle: 'short', timeStyle: 'short' });
  } catch {
    return iso;
  }
}

function pct(part: number, total: number): string {
  if (!total) return '—';
  return `${Math.round((part / total) * 1000) / 10} %`;
}

/** Reporting vlastních kampaní (Postgres + Resend) — seznam, statistiky, detail s top odkazy a chybami. */
export default function MailingCampaignsPage() {
  const [loading, setLoading] = useState(true);
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([]);
  const [stats, setStats] = useState<Record<string, CampaignStats>>({});
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [details, setDetails] = useState<Record<string, CampaignDetail>>({});
  const [detailLoading, setDetailLoading] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  /* Odesláno bez jediného potvrzeného doručení = Resend webhook nejspíš není napojený. */
  const deliveryUnknown = campaigns.some((c) => {
    const s = stats[c.id];
    return !!s && s.sent > 0 && s.delivered === 0;
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const supabase = getSupabaseBrowser();
      /* Jen vlastní kampaně (mají html_body) — ne Mailchimp importy do RAG. */
      const { data, error } = await supabase
        .from('campaigns')
        .select('id, name, subject_line, status, scheduled_at, send_time, finished_at, created_at, draft_id')
        .not('html_body', 'is', null)
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw new Error(error.message);
      const rows = (data || []) as CampaignRow[];
      setCampaigns(rows);

      if (rows.length > 0) {
        const { data: st, error: stErr } = await supabase.rpc('mailing_campaign_stats', {
          p_campaign_ids: rows.map((r) => r.id),
        });
        if (stErr) throw new Error(stErr.message);
        const byId: Record<string, CampaignStats> = {};
        for (const s of (st || []) as CampaignStats[]) byId[s.campaign_id] = s;
        setStats(byId);
      } else {
        setStats({});
      }
    } catch (e) {
      console.error('Campaigns load error:', e);
      toast.error(`Načtení kampaní: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const loadDetail = useCallback(async (campaignId: string) => {
    setDetailLoading(campaignId);
    try {
      const supabase = getSupabaseBrowser();
      const [linksRes, clicksRes, failedRes, bouncedRes] = await Promise.all([
        supabase.from('email_links').select('id, url').eq('campaign_id', campaignId).limit(500),
        supabase
          .from('email_events')
          .select('link_id')
          .eq('campaign_id', campaignId)
          .eq('event_type', 'click')
          .not('link_id', 'is', null)
          .limit(5000),
        supabase
          .from('campaign_recipients')
          .select('error, subscriber:subscribers(email)')
          .eq('campaign_id', campaignId)
          .eq('status', 'failed')
          .limit(50),
        supabase
          .from('campaign_recipients')
          .select('bounce_type, bounce_reason, subscriber:subscribers(email)')
          .eq('campaign_id', campaignId)
          .not('bounce_type', 'is', null)
          .limit(50),
      ]);
      if (linksRes.error) throw new Error(linksRes.error.message);
      if (clicksRes.error) throw new Error(clicksRes.error.message);
      if (failedRes.error) throw new Error(failedRes.error.message);
      if (bouncedRes.error) throw new Error(bouncedRes.error.message);

      const urlByLinkId = new Map((linksRes.data || []).map((l) => [l.id as string, l.url as string]));
      const clickCounts = new Map<string, number>();
      for (const ev of clicksRes.data || []) {
        const id = ev.link_id as string;
        clickCounts.set(id, (clickCounts.get(id) || 0) + 1);
      }
      const topLinks: TopLink[] = [...clickCounts.entries()]
        .map(([linkId, clicks]) => ({ url: urlByLinkId.get(linkId) || '(neznámý odkaz)', clicks }))
        .sort((a, b) => b.clicks - a.clicks)
        .slice(0, 10);

      const failed: FailedRecipient[] = (failedRes.data || []).map((r) => ({
        email: ((r.subscriber as { email?: string } | null)?.email as string) || '(neznámý)',
        error: (r.error as string | null) ?? null,
      }));

      const bounced: BouncedRecipient[] = (bouncedRes.data || []).map((r) => ({
        email: ((r.subscriber as { email?: string } | null)?.email as string) || '(neznámý)',
        type: (r.bounce_type as string) || 'undetermined',
        reason: (r.bounce_reason as string | null) ?? null,
      }));

      setDetails((prev) => ({ ...prev, [campaignId]: { topLinks, failed, bounced } }));
    } catch (e) {
      console.error('Campaign detail error:', e);
      toast.error(`Detail kampaně: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setDetailLoading(null);
    }
  }, []);

  const toggleExpand = (campaignId: string) => {
    if (expandedId === campaignId) {
      setExpandedId(null);
      return;
    }
    setExpandedId(campaignId);
    if (!details[campaignId]) void loadDetail(campaignId);
  };

  const cancelCampaign = async (campaignId: string) => {
    setCancellingId(campaignId);
    try {
      const r = await fetch(`${SERVER}/admin/mailing/campaigns/${campaignId}/cancel`, {
        method: 'POST',
        headers: await getEdgeFunctionHeaders(true),
      });
      const data = await r.json();
      if (!data.ok) throw new Error(data.error || `HTTP ${r.status}`);
      toast.success('Kampaň zrušena.');
      await load();
    } catch (e) {
      toast.error(`Zrušení kampaně: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setCancellingId(null);
    }
  };

  return (
    <div className="min-h-0 flex-1 overflow-y-auto bg-[#fcfcfe] p-6" style={FF}>
      <div className="mx-auto max-w-[1100px] space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-[#7C3AED]" aria-hidden />
            <h1 className="text-[18px] font-bold text-[#001161]">Kampaně — vlastní mailing</h1>
          </div>
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-[12px] font-bold text-[#001161]/60 hover:border-[#7C3AED]/35 hover:text-[#7C3AED] disabled:opacity-45 transition-all cursor-pointer"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden /> : <RefreshCw className="w-4 h-4" aria-hidden />}
            Obnovit
          </button>
        </div>

        <p className="text-[12px] text-[#001161]/45 leading-snug">
          Kampaně odeslané vlastním mailingem (Resend). Doručeno hlásí webhook, open/click rate se počítá
          z unikátních kontaktů vůči odeslaným.
        </p>

        {deliveryUnknown && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-[12px] text-amber-800 leading-snug">
            U některých kampaní není potvrzené žádné doručení. Zkontrolujte, že je v Resendu zaregistrovaný
            webhook na <code className="font-mono">/webhooks/resend</code> s událostmi <em>delivered</em>,{' '}
            <em>bounced</em>, <em>complained</em> a že sedí <code className="font-mono">RESEND_WEBHOOK_SECRET</code>.
          </div>
        )}

        {loading && campaigns.length === 0 ? (
          <div className="flex items-center gap-2 rounded-2xl border border-gray-200 bg-white px-4 py-8 justify-center text-[13px] text-[#001161]/50">
            <Loader2 className="w-4 h-4 animate-spin text-[#7C3AED]" aria-hidden />
            Načítám kampaně…
          </div>
        ) : campaigns.length === 0 ? (
          <div className="rounded-2xl border border-gray-200 bg-white px-4 py-10 text-center space-y-2">
            <Mail className="w-6 h-6 text-[#7C3AED]/50 mx-auto" aria-hidden />
            <p className="text-[13px] text-[#001161]/55">
              Zatím žádné kampaně. První odešlete z editoru — tlačítko „Odeslat kampaň“.
            </p>
            <Link to="/mailing/emaily" className="inline-block text-[12px] font-bold text-[#7C3AED] hover:underline">
              Otevřít e-maily
            </Link>
          </div>
        ) : (
          <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-gray-100 bg-[#fafbfd]">
                  {['', 'Kampaň', 'Stav', 'Odesláno', 'Doručeno', 'Open rate', 'Click rate', 'Odhlášení', 'Chyby', ''].map((h, i) => (
                    <th key={i} className="px-3 py-2.5 text-[10px] font-bold uppercase tracking-[0.08em] text-[#001161]/40">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {campaigns.map((cam) => {
                  const s = stats[cam.id];
                  const status = STATUS_LABELS[cam.status || ''] || { label: cam.status || '—', cls: 'bg-gray-100 text-[#001161]/60' };
                  const expanded = expandedId === cam.id;
                  const detail = details[cam.id];
                  return (
                    <React.Fragment key={cam.id}>
                      <tr
                        className="border-b border-gray-50 hover:bg-[#7C3AED]/[0.03] cursor-pointer transition-colors"
                        onClick={() => toggleExpand(cam.id)}
                      >
                        <td className="px-3 py-3 w-8">
                          {expanded ? (
                            <ChevronDown className="w-4 h-4 text-[#001161]/40" aria-hidden />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-[#001161]/40" aria-hidden />
                          )}
                        </td>
                        <td className="px-3 py-3">
                          <p className="text-[13px] font-bold text-[#001161] leading-tight">{cam.subject_line || cam.name || '(bez předmětu)'}</p>
                          <p className="text-[11px] text-[#001161]/40 mt-0.5">
                            {cam.status === 'scheduled' && cam.scheduled_at
                              ? `Naplánováno na ${fmtDate(cam.scheduled_at)}`
                              : `Vytvořeno ${fmtDate(cam.created_at)}${cam.send_time ? ` · odesláno ${fmtDate(cam.send_time)}` : ''}`}
                          </p>
                        </td>
                        <td className="px-3 py-3">
                          <span className={`inline-block px-2 py-0.5 rounded-lg text-[10px] font-bold ${status.cls}`}>{status.label}</span>
                        </td>
                        <td className="px-3 py-3 text-[12px] text-[#001161]/70">
                          {s ? `${s.sent}${s.pending > 0 ? ` / ${s.recipients_total}` : ''}` : '—'}
                        </td>
                        <td className="px-3 py-3 text-[12px] text-[#001161]/70">
                          {!s || s.sent === 0 ? (
                            '—'
                          ) : s.delivered > 0 ? (
                            <>
                              <span>{pct(s.delivered, s.sent)}</span>
                              <span className="block text-[10px] text-[#001161]/40">{s.delivered} z {s.sent}</span>
                            </>
                          ) : (
                            <span className="text-[#001161]/35" title="Resend zatím nepotvrdil doručení — zkontrolujte webhook.">
                              nehlášeno
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-3 text-[12px] text-[#001161]/70">{s ? pct(s.unique_opens, s.sent) : '—'}</td>
                        <td className="px-3 py-3 text-[12px] text-[#001161]/70">{s ? pct(s.unique_clicks, s.sent) : '—'}</td>
                        <td className="px-3 py-3 text-[12px] text-[#001161]/70">{s ? s.unsubscribes : '—'}</td>
                        <td className="px-3 py-3 text-[12px]">
                          {s && (s.failed > 0 || s.bounces > 0) ? (
                            <span className="text-red-600 font-bold">{s.failed + s.bounces}</span>
                          ) : (
                            <span className="text-[#001161]/40">0</span>
                          )}
                        </td>
                        <td className="px-3 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1.5">
                            {cam.draft_id && (
                              <Link
                                to={`/mailing/emaily?draft=${encodeURIComponent(cam.draft_id)}`}
                                className="p-1.5 rounded-lg text-[#001161]/40 hover:text-[#7C3AED] hover:bg-[#7C3AED]/10 transition-colors"
                                title="Otevřít draft v editoru"
                              >
                                <ExternalLink className="w-4 h-4" aria-hidden />
                              </Link>
                            )}
                            {['draft', 'scheduled', 'sending'].includes(cam.status || '') && (
                              <button
                                type="button"
                                onClick={() => void cancelCampaign(cam.id)}
                                disabled={cancellingId === cam.id}
                                className="p-1.5 rounded-lg text-[#001161]/40 hover:text-red-600 hover:bg-red-50 disabled:opacity-45 transition-colors cursor-pointer"
                                title="Zrušit kampaň"
                              >
                                {cancellingId === cam.id ? (
                                  <Loader2 className="w-4 h-4 animate-spin" aria-hidden />
                                ) : (
                                  <XCircle className="w-4 h-4" aria-hidden />
                                )}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                      {expanded && (
                        <tr className="border-b border-gray-50 bg-[#fafbfd]">
                          <td colSpan={10} className="px-6 py-4">
                            {detailLoading === cam.id && !detail ? (
                              <div className="flex items-center gap-2 text-[12px] text-[#001161]/50">
                                <Loader2 className="w-4 h-4 animate-spin text-[#7C3AED]" aria-hidden />
                                Načítám detail…
                              </div>
                            ) : (
                              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                                <div>
                                  <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#001161]/40 mb-2">Čísla</p>
                                  {s ? (
                                    <dl className="space-y-1 text-[12px] text-[#001161]/70">
                                      <div className="flex justify-between gap-3"><dt>Příjemců celkem</dt><dd className="font-bold">{s.recipients_total}</dd></div>
                                      <div className="flex justify-between gap-3"><dt>Odesláno</dt><dd className="font-bold">{s.sent}</dd></div>
                                      <div className="flex justify-between gap-3">
                                        <dt>Doručeno</dt>
                                        <dd className="font-bold">{s.delivered} {s.sent > 0 && s.delivered > 0 ? `(${pct(s.delivered, s.sent)})` : ''}</dd>
                                      </div>
                                      <div className="flex justify-between gap-3"><dt>Ve frontě</dt><dd>{s.pending}</dd></div>
                                      <div className="flex justify-between gap-3"><dt>Přeskočeno</dt><dd>{s.skipped}</dd></div>
                                      <div className="flex justify-between gap-3"><dt>Otevřelo (unikátně)</dt><dd className="font-bold">{s.unique_opens}</dd></div>
                                      <div className="flex justify-between gap-3"><dt>Kliklo (unikátně)</dt><dd className="font-bold">{s.unique_clicks}</dd></div>
                                      <div className="flex justify-between gap-3"><dt>Odhlásilo se</dt><dd>{s.unsubscribes}</dd></div>
                                      <div className="flex justify-between gap-3"><dt>Bounce celkem</dt><dd>{s.bounces}</dd></div>
                                      <div className="flex justify-between gap-3">
                                        <dt className="pl-3 text-[#001161]/50">z toho trvalé</dt>
                                        <dd className={s.hard_bounces > 0 ? 'text-red-600 font-bold' : ''}>{s.hard_bounces}</dd>
                                      </div>
                                      <div className="flex justify-between gap-3">
                                        <dt className="pl-3 text-[#001161]/50">z toho dočasné</dt>
                                        <dd>{s.soft_bounces}</dd>
                                      </div>
                                      <div className="flex justify-between gap-3">
                                        <dt>Stížnosti na spam</dt>
                                        <dd className={s.complaints > 0 ? 'text-red-600 font-bold' : ''}>{s.complaints}</dd>
                                      </div>
                                    </dl>
                                  ) : (
                                    <p className="text-[12px] text-[#001161]/45">Bez statistik.</p>
                                  )}
                                </div>
                                <div>
                                  <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#001161]/40 mb-2">Top odkazy</p>
                                  {detail && detail.topLinks.length > 0 ? (
                                    <ul className="space-y-1.5">
                                      {detail.topLinks.map((l, i) => (
                                        <li key={i} className="text-[12px] text-[#001161]/70 flex items-start gap-2">
                                          <span className="font-bold text-[#7C3AED] shrink-0">{l.clicks}×</span>
                                          <span className="break-all leading-snug">{l.url}</span>
                                        </li>
                                      ))}
                                    </ul>
                                  ) : (
                                    <p className="text-[12px] text-[#001161]/45">Zatím žádné kliky.</p>
                                  )}
                                </div>
                                <div>
                                  <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#001161]/40 mb-2">Nedoručeno (bounce)</p>
                                  {detail && detail.bounced.length > 0 ? (
                                    <ul className="space-y-1.5">
                                      {detail.bounced.map((b, i) => (
                                        <li key={i} className="text-[12px] text-[#001161]/70 leading-snug">
                                          <span className="font-bold">{b.email}</span>
                                          <span className={b.type === 'hard' ? 'text-red-600' : 'text-amber-700'}>
                                            {' '}— {BOUNCE_LABELS[b.type] || b.type}
                                          </span>
                                          {b.reason ? <span className="block text-[11px] text-[#001161]/45">{b.reason}</span> : null}
                                        </li>
                                      ))}
                                    </ul>
                                  ) : (
                                    <p className="text-[12px] text-[#001161]/45">Žádné bounce.</p>
                                  )}
                                </div>
                                <div>
                                  <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#001161]/40 mb-2">Chyby odeslání</p>
                                  {detail && detail.failed.length > 0 ? (
                                    <ul className="space-y-1.5">
                                      {detail.failed.map((f, i) => (
                                        <li key={i} className="text-[12px] text-[#001161]/70 leading-snug">
                                          <span className="font-bold">{f.email}</span>
                                          {f.error ? <span className="text-red-600"> — {f.error}</span> : null}
                                        </li>
                                      ))}
                                    </ul>
                                  ) : (
                                    <p className="text-[12px] text-[#001161]/45">Žádné chyby.</p>
                                  )}
                                </div>
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}