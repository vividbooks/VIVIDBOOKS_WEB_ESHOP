import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import {
  Package, FileText, Newspaper, LayoutGrid,
  ArrowRight, BarChart3, Database, Upload, Monitor, ShieldAlert
} from 'lucide-react';
import { fetchProducts, fetchCollection, fetchAdminAlertSummary } from '../../utils/adminApi';

interface StatCard {
  label: string;
  icon: any;
  count: number;
  path: string;
  color: string;
  bgColor: string;
}

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<StatCard[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadStats() {
      setLoading(true);
      try {
        const [products, blog, novinky, alertSummary] = await Promise.all([
          fetchProducts(),
          fetchCollection('blog'),
          fetchCollection('novinky'),
          fetchAdminAlertSummary().catch(() => ({ summary: { total_open: 0, critical_open: 0, warning_open: 0, acknowledged_open: 0 } })),
        ]);
        setStats([
          { label: 'Produkty', icon: Package, count: products.length, path: '/admin/kolekce/produkty', color: '#ff8c66', bgColor: '#fff4ec' },
          { label: 'Blog', icon: FileText, count: blog.length, path: '/admin/blog', color: '#6366f1', bgColor: '#eef2ff' },
          { label: 'Novinky', icon: Newspaper, count: novinky.length, path: '/admin/novinky', color: '#f59e0b', bgColor: '#fffbeb' },
          { label: 'Alerty', icon: ShieldAlert, count: alertSummary.summary.total_open, path: '/admin/alerty', color: '#dc2626', bgColor: '#fef2f2' },
        ]);
      } catch (e) {
        console.error('Dashboard stats error:', e);
      } finally {
        setLoading(false);
      }
    }
    loadStats();
  }, []);

  return (
    <div className="h-full overflow-y-auto p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-[#001161] font-['Fenomen_Sans']">
          {'Web Admin'}
        </h1>
        <p className="text-gray-500 mt-1 text-[14px]">
          {'Spr\u00e1va obsahu, kolekc\u00ed a str\u00e1nek webu'}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
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

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
        <button
          onClick={() => navigate('/admin/analytika')}
          className="bg-white rounded-2xl p-6 border border-gray-100 text-left hover:shadow-md transition-all flex items-start gap-4"
        >
          <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center shrink-0">
            <BarChart3 className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <h3 className="font-bold text-[#001161] text-[14px]">{'Analytika obchodu'}</h3>
            <p className="text-[12px] text-gray-400 mt-0.5">{'Tržby, školy, produkty a provozní grafy'}</p>
          </div>
        </button>

        <button
          onClick={() => navigate('/admin/migrace')}
          className="bg-white rounded-2xl p-6 border border-gray-100 text-left hover:shadow-md transition-all flex items-start gap-4"
        >
          <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center shrink-0">
            <Upload className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h3 className="font-bold text-[#001161] text-[14px]">{'Migrace obsahu'}</h3>
            <p className="text-[12px] text-gray-400 mt-0.5">{'Import dat z Webflow do Supabase'}</p>
          </div>
        </button>

        <button
          onClick={() => navigate('/')}
          className="bg-white rounded-2xl p-6 border border-gray-100 text-left hover:shadow-md transition-all flex items-start gap-4"
        >
          <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center shrink-0">
            <LayoutGrid className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <h3 className="font-bold text-[#001161] text-[14px]">{'Zobrazit web'}</h3>
            <p className="text-[12px] text-gray-400 mt-0.5">{'Otev\u0159\u00edt frontend webu'}</p>
          </div>
        </button>

        <button
          onClick={() => navigate('/marketing')}
          className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-2xl p-6 border border-purple-200 text-left hover:shadow-md transition-all flex items-start gap-4"
        >
          <div className="w-10 h-10 bg-purple-200 rounded-xl flex items-center justify-center shrink-0">
            <Monitor className="w-5 h-5 text-purple-700" />
          </div>
          <div>
            <h3 className="font-bold text-purple-800 text-[14px]">{'Marketing Admin'}</h3>
            <p className="text-[12px] text-purple-600 mt-0.5">
              {'Webin\u00e1\u0159e, kampan\u011b, AI agent a RAG'}
            </p>
          </div>
        </button>
      </div>

      <div className="bg-gray-50 rounded-2xl p-6 border border-gray-100">
        <div className="flex items-start gap-3">
          <Database className="w-5 h-5 text-gray-400 mt-0.5 shrink-0" />
          <div>
            <h4 className="font-bold text-[#001161] text-[13px] mb-1">{'O tomto admin panelu'}</h4>
            <p className="text-[12px] text-gray-500 leading-relaxed">
              {'Tento admin slou\u017e\u00ed ke spr\u00e1v\u011b ve\u0161ker\u00e9ho obsahu webu Vividbooks. Collections (Produkty, Blog, Novinky, Webin\u00e1\u0159e) jsou dynamick\u00fd obsah ulo\u017een\u00fd v Supabase KV store. Fixn\u00ed str\u00e1nky jsou str\u00e1nky s nem\u011bnn\u00fdm obsahem. V budoucnu zde bude AI agent pro automatickou spr\u00e1vu obsahu a RAG datab\u00e1ze pro centralizaci firemn\u00edch dat.'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}