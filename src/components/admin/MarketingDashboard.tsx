import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import {
  Radio, Megaphone, Users, School, Sparkles, Brain,
  ArrowRight, BarChart3, Mail, Target, Image, Search,
} from 'lucide-react';
import { fetchCollection } from '../../utils/adminApi';
import { projectId, publicAnonKey } from '../../utils/supabase/info';

interface StatCard {
  label: string;
  icon: any;
  count: number | string;
  path: string;
  color: string;
  bgColor: string;
}

export default function MarketingDashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<StatCard[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadStats() {
      setLoading(true);
      try {
        const webinare = await fetchCollection('webinare');
        // Try to get MC campaign count
        let mcCount = 0;
        try {
          const BASE = `https://${projectId}.supabase.co/functions/v1/make-server-93a20b6f`;
          const r = await fetch(`${BASE}/admin/mailchimp/campaigns`, {
            headers: { 'Authorization': `Bearer ${publicAnonKey}` },
          });
          if (r.ok) {
            const d = await r.json();
            mcCount = d.campaigns?.length || 0;
          }
        } catch {}
        setStats([
          { label: 'Webináře', icon: Radio, count: webinare.length, path: '/marketing/webinare', color: '#10b981', bgColor: '#ecfdf5' },
          { label: 'Kontakty', icon: Users, count: '\u2192', path: '/marketing/kontakty', color: '#6366f1', bgColor: '#eef2ff' },
          { label: 'E-maily', icon: Mail, count: '\u2192', path: '/mailing/emaily', color: '#7C3AED', bgColor: '#f5f3ff' },
          { label: 'Galerie', icon: Image, count: '\u2192', path: '/marketing/galerie', color: '#f97316', bgColor: '#fff7ed' },
          { label: 'Popup Manager', icon: Megaphone, count: '\u2192', path: '/marketing/popupy', color: '#f59e0b', bgColor: '#fffbeb' },
          { label: 'Mailchimp', icon: Mail, count: mcCount || '\u2014', path: '/marketing/marketing-agent', color: '#ec4899', bgColor: '#fdf2f8' },
        ]);
      } catch (e) {
        console.error('Marketing dashboard stats error:', e);
      } finally {
        setLoading(false);
      }
    }
    loadStats();
  }, []);

  return (
    <div className="h-full overflow-y-auto p-8">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#7C3AED] to-[#9F67F5] flex items-center justify-center">
            <BarChart3 className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-[#001161] font-['Fenomen_Sans']">
              {'Marketing Admin'}
            </h1>
            <p className="text-gray-500 text-[14px]">
              {'Webin\u00e1\u0159e, kampan\u011b, registrace a AI n\u00e1stroje'}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-8">
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-white rounded-2xl p-6 border border-gray-100 animate-pulse">
              <div className="h-12 w-12 bg-gray-100 rounded-xl mb-4" />
              <div className="h-8 w-16 bg-gray-100 rounded mb-2" />
              <div className="h-4 w-24 bg-gray-50 rounded" />
            </div>
          ))
        ) : (
          stats.map((stat) => (
            <button
              key={stat.path}
              onClick={() => navigate(stat.path)}
              className="bg-white rounded-2xl p-6 border border-gray-100 text-left hover:shadow-lg hover:border-gray-200 transition-all group"
            >
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center mb-4"
                style={{ backgroundColor: stat.bgColor }}
              >
                <stat.icon className="w-6 h-6" style={{ color: stat.color }} />
              </div>
              <div className="text-3xl font-bold text-[#001161]">{stat.count}</div>
              <div className="text-sm text-gray-500 flex items-center gap-1 mt-1">
                {stat.label}
                <ArrowRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
              </div>
            </button>
          ))
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        <button
          onClick={() => navigate('/marketing/marketing-agent')}
          className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-2xl p-6 border border-purple-200 text-left hover:shadow-md transition-all flex items-start gap-4"
        >
          <div className="w-10 h-10 bg-purple-200 rounded-xl flex items-center justify-center shrink-0">
            <Sparkles className="w-5 h-5 text-purple-700" />
          </div>
          <div>
            <h3 className="font-bold text-purple-800 text-[14px]">{'Marketing Agent'}</h3>
            <p className="text-[12px] text-purple-600 mt-0.5">
              {'Specialista na marketingov\u00e9 texty, kampan\u011b a brand voice'}
            </p>
          </div>
        </button>

        <button
          onClick={() => navigate('/marketing/seo-agent')}
          className="bg-gradient-to-br from-amber-50 to-amber-100 rounded-2xl p-6 border border-amber-200 text-left hover:shadow-md transition-all flex items-start gap-4"
        >
          <div className="w-10 h-10 bg-amber-200 rounded-xl flex items-center justify-center shrink-0">
            <Search className="w-5 h-5 text-amber-700" />
          </div>
          <div>
            <h3 className="font-bold text-amber-800 text-[14px]">{'SEO Agent'}</h3>
            <p className="text-[12px] text-amber-600 mt-0.5">
              {'SEO briefy, metadata, struktura str\u00e1nek a obsahov\u00e1 strategie'}
            </p>
          </div>
        </button>

        <button
          onClick={() => navigate('/marketing/image-agent')}
          className="bg-gradient-to-br from-pink-50 to-fuchsia-100 rounded-2xl p-6 border border-fuchsia-200 text-left hover:shadow-md transition-all flex items-start gap-4"
        >
          <div className="w-10 h-10 bg-fuchsia-200 rounded-xl flex items-center justify-center shrink-0">
            <Image className="w-5 h-5 text-fuchsia-700" />
          </div>
          <div>
            <h3 className="font-bold text-fuchsia-800 text-[14px]">{'Image Agent'}</h3>
            <p className="text-[12px] text-fuchsia-600 mt-0.5">
              {'Specialista na generov\u00e1n\u00ed vizu\u00e1l\u016f, kol\u00e1\u017e\u00ed a obrazov\u00fdch podklad\u016f'}
            </p>
          </div>
        </button>

        <button
          onClick={() => navigate('/marketing/rag')}
          className="bg-gradient-to-br from-amber-50 to-amber-100 rounded-2xl p-6 border border-amber-200 text-left hover:shadow-md transition-all flex items-start gap-4"
        >
          <div className="w-10 h-10 bg-amber-200 rounded-xl flex items-center justify-center shrink-0">
            <Brain className="w-5 h-5 text-amber-700" />
          </div>
          <div>
            <h3 className="font-bold text-amber-800 text-[14px]">{'RAG Znalosti'}</h3>
            <p className="text-[12px] text-amber-600 mt-0.5">
              {'Vektorová databáze firemních znalostí pro AI agenta'}
            </p>
          </div>
        </button>

      </div>

      <div className="bg-gray-50 rounded-2xl p-6 border border-gray-100">
        <div className="flex items-start gap-3">
          <Target className="w-5 h-5 text-gray-400 mt-0.5 shrink-0" />
          <div>
            <h4 className="font-bold text-[#001161] text-[13px] mb-1">{'O Marketing Adminu'}</h4>
            <p className="text-[12px] text-gray-500 leading-relaxed">
              {'Zde spravujete v\u0161e kolem marketingu \u2014 webin\u00e1\u0159e, popup kampan\u011b, registrace u\u010ditel\u016f, rejst\u0159\u00edk \u0161kol a AI n\u00e1stroje. Marketing Agent vyu\u017e\u00edv\u00e1 RAG datab\u00e1zi pro generov\u00e1n\u00ed personalizovan\u00e9ho obsahu na z\u00e1klad\u011b firemn\u00edch dat.'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}