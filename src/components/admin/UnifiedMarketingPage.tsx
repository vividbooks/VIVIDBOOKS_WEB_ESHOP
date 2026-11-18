import { lazy, Suspense, useState } from 'react';
import { BarChart3, History, ListChecks, Sparkles, Target } from 'lucide-react';

const GoogleAdsGrowthPage = lazy(() => import('./GoogleAdsGrowthPage'));
const MarketingPerformancePage = lazy(() => import('./MarketingPerformancePage'));
const GrowthProposalsPage = lazy(() => import('./GrowthProposalsPage'));
const MarketingConversionsPage = lazy(() => import('./MarketingConversionsPage'));
const MarketingHistoryPage = lazy(() => import('./MarketingHistoryPage'));

const TABS = [
  { id: 'performance', label: 'Výkon', icon: BarChart3 },
  { id: 'proposals', label: 'Návrhy', icon: ListChecks },
  { id: 'conversions', label: 'Konverze', icon: Target },
  { id: 'history', label: 'Historie', icon: History },
  { id: 'google-ads', label: 'Kampaň (příprava)', icon: Sparkles },
] as const;

type TabId = (typeof TABS)[number]['id'];

const FF = "'Fenomen Sans', sans-serif";

export default function UnifiedMarketingPage() {
  const [tab, setTab] = useState<TabId>('performance');

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="shrink-0 border-b border-gray-100 bg-white px-6 pb-0 pt-5">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#001161]/5">
            <Sparkles className="h-5 w-5 text-[#001161]" />
          </div>
          <div>
            <div style={{ fontFamily: FF }} className="text-[15px] font-bold text-[#001161]">
              Marketing — Google Ads
            </div>
            <div style={{ fontFamily: FF }} className="text-[11px] text-[#001161]/40">
              Výkon kampaní, návrhy optimalizace a příprava reklam na jednom místě
            </div>
          </div>
        </div>
        <div className="flex gap-0.5">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{ fontFamily: FF }}
              className={`flex items-center gap-1.5 border-b-2 px-4 py-2.5 text-[13px] font-bold transition-all ${
                tab === t.id
                  ? 'border-[#001161] text-[#001161]'
                  : 'border-transparent text-[#001161]/40 hover:text-[#001161]/70'
              }`}
            >
              <t.icon className="h-3.5 w-3.5" />
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        <Suspense fallback={<div className="p-8 text-[13px] text-[#001161]/60" style={{ fontFamily: FF }}>Načítám…</div>}>
          {tab === 'performance' && <MarketingPerformancePage />}
          {tab === 'proposals' && <GrowthProposalsPage />}
          {tab === 'conversions' && <MarketingConversionsPage />}
          {tab === 'history' && <MarketingHistoryPage />}
          {tab === 'google-ads' && <GoogleAdsGrowthPage />}
        </Suspense>
      </div>
    </div>
  );
}
