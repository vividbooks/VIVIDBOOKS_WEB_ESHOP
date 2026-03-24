import { useState } from 'react';
import { Calendar, Users, Clock } from 'lucide-react';
import WebinareEditor from './WebinareEditor';
import WebinarRegistraceAdmin from './WebinarRegistraceAdmin';
import WebinaryPastPanel from './WebinaryPastPanel';

type Tab = 'webinare' | 'registrace' | 'uplynule';

const TABS: Array<{ key: Tab; label: string; icon: typeof Calendar }> = [
  { key: 'webinare',  label: 'Webin\u00e1\u0159e',          icon: Calendar },
  { key: 'registrace', label: 'Registrace',          icon: Users    },
  { key: 'uplynule',  label: 'Uplynul\u00e9 webin\u00e1\u0159e', icon: Clock    },
];

export default function AdminWebinarPanel() {
  const [tab, setTab] = useState<Tab>('webinare');

  return (
    <div className="h-full flex flex-col overflow-hidden" style={{ fontFamily: "'Fenomen Sans', sans-serif" }}>

      {/* ── Tab bar ─────────────────────────────────────────────── */}
      <div className="bg-white border-b border-gray-200 px-6 flex items-center gap-0 shrink-0 z-10">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-2 px-5 py-3.5 text-[13px] font-bold border-b-2 transition-all ${
              tab === key
                ? 'border-[#001161] text-[#001161]'
                : 'border-transparent text-gray-400 hover:text-gray-600'
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
            {/* Small orange dot for "Uplynulé" to highlight it's new */}
            {key === 'uplynule' && (
              <span className="w-1.5 h-1.5 rounded-full bg-orange-400 shrink-0" />
            )}
          </button>
        ))}
      </div>

      {/* ── Content panels ──────────────────────────────────────── */}
      <div className={`flex-1 overflow-hidden ${tab === 'webinare' ? 'flex flex-col' : 'hidden'}`}>
        <WebinareEditor />
      </div>
      <div className={`flex-1 overflow-hidden ${tab === 'registrace' ? 'flex flex-col' : 'hidden'}`}>
        <WebinarRegistraceAdmin />
      </div>
      <div className={`flex-1 overflow-hidden ${tab === 'uplynule' ? 'flex flex-col' : 'hidden'}`}>
        <WebinaryPastPanel />
      </div>
    </div>
  );
}
