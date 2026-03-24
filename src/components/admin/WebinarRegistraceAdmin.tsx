import React, { useState, useEffect, useCallback } from 'react';
import {
  RefreshCw, ChevronDown, ChevronRight, Users, CheckCircle2,
  Rocket, Calendar, Mail, Phone, Briefcase, Clock, Search,
  Download, Tag
} from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import { projectId, publicAnonKey } from '../../utils/supabase/info';

const SERVER = `https://${projectId}.supabase.co/functions/v1/make-server-93a20b6f`;

interface Registration {
  name: string;
  email: string;
  phone: string;
  position: string;
  newsletter: boolean;
  registeredAt: string;
  attended: boolean;
  attendedAt?: string;
  trialToken?: string;
}

interface WebinarStat {
  webinarId: string;
  webinarTitle: string;
  day: number;
  monthName: string;
  year: number;
  time: string;
  isPast: boolean;
  total: number;
  attended: number;
  withTrial: number;
  registrations: Registration[];
}

export default function WebinarRegistraceAdmin() {
  const [data, setData] = useState<WebinarStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'upcoming' | 'past'>('all');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${SERVER}/admin/registrace`, {
        headers: { Authorization: `Bearer ${publicAnonKey}` },
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || res.statusText);
      }
      const d = await res.json();
      setData(d.webinars || []);
    } catch (e: any) {
      toast.error(`Chyba: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = data.filter(w => {
    const matchFilter = filter === 'all' || (filter === 'upcoming' && !w.isPast) || (filter === 'past' && w.isPast);
    const matchSearch = !search || w.webinarTitle.toLowerCase().includes(search.toLowerCase());
    return matchFilter && matchSearch;
  });

  const totalRegs = data.reduce((s, w) => s + w.total, 0);
  const totalAttended = data.reduce((s, w) => s + w.attended, 0);
  const totalTrial = data.reduce((s, w) => s + w.withTrial, 0);

  const exportCsv = (webinar: WebinarStat) => {
    const headers = ['Jméno', 'E-mail', 'Telefon', 'Pozice', 'Newsletter', 'Registrace', 'Byl/a', 'Trial'];
    const rows = webinar.registrations.map(r => [
      r.name, r.email, r.phone, r.position,
      r.newsletter ? 'Ano' : 'Ne',
      new Date(r.registeredAt).toLocaleString('cs-CZ'),
      r.attended ? 'Ano' : 'Ne',
      r.trialToken ? 'Ano' : 'Ne',
    ]);
    const csv = '\uFEFF' + [headers, ...rows].map(row =>
      row.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')
    ).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `registrace-${webinar.webinarId}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('CSV exportováno');
  };

  return (
    <div className="h-full flex flex-col overflow-hidden bg-[#f7f8fc]" style={{ fontFamily: "'Fenomen Sans', sans-serif" }}>

      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 shrink-0">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-[18px] font-bold text-[#001161]">{'Registrace na webin\u00e1\u0159e'}</h1>
          <button
            onClick={load}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-[12px] font-bold text-gray-600 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            {'Obnovit'}
          </button>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-4 mb-4">
          {[
            { label: 'Celkem registrací', value: totalRegs, icon: Users, color: '#001161', bg: '#EEF0F8' },
            { label: 'Check-in (bylo)', value: totalAttended, icon: CheckCircle2, color: '#16a34a', bg: '#f0fdf4' },
            { label: 'Trial aktivace', value: totalTrial, icon: Rocket, color: '#7C3AED', bg: '#f5f3ff' },
          ].map(s => (
            <div key={s.label} className="rounded-2xl px-4 py-3 flex items-center gap-3" style={{ background: s.bg }}>
              <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: s.color + '20' }}>
                <s.icon className="w-4.5 h-4.5" style={{ color: s.color }} />
              </div>
              <div>
                <div className="text-[22px] font-black" style={{ color: s.color }}>{s.value}</div>
                <div className="text-[11px] font-medium text-gray-500">{s.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-[280px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={'Hledat webinář\u2026'}
              className="w-full pl-9 pr-3 py-2 text-[13px] border border-gray-200 rounded-xl bg-white focus:border-[#001161] outline-none"
            />
          </div>
          <div className="flex gap-1">
            {(['all', 'upcoming', 'past'] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-lg text-[12px] font-bold transition-colors ${filter === f ? 'bg-[#001161] text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
              >
                {f === 'all' ? 'Vše' : f === 'upcoming' ? 'Plánované' : 'Minulé'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-6 space-y-3">
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-2 border-gray-200 border-t-[#001161] rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-400 text-[14px]">{'Žádné webináře nenalezeny.'}</div>
        ) : filtered.map(w => {
          const isOpen = expanded === w.webinarId;
          const convRate = w.total > 0 ? Math.round((w.attended / w.total) * 100) : 0;
          const trialRate = w.total > 0 ? Math.round((w.withTrial / w.total) * 100) : 0;

          return (
            <div key={w.webinarId} className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
              {/* Webinar header row — div instead of button to allow nested button (CSV export) */}
              <div
                onClick={() => setExpanded(isOpen ? null : w.webinarId)}
                className="w-full text-left px-5 py-4 flex items-center gap-4 hover:bg-gray-50 transition-colors cursor-pointer"
              >
                <div className="flex flex-col items-center bg-[#f0f2f8] rounded-xl px-3 py-2 shrink-0 min-w-[52px]">
                  <span className="text-[20px] font-black text-[#001161] leading-none">{w.day}</span>
                  <span className="text-[10px] text-[#001161]/60 leading-tight">{w.monthName}</span>
                  <span className="text-[10px] font-bold text-[#FF8C00] leading-none">{w.year}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[14px] font-bold text-[#001161] truncate">{w.webinarTitle}</span>
                    {w.isPast ? (
                      <span className="text-[10px] bg-gray-100 text-gray-400 px-2 py-0.5 rounded-full font-bold shrink-0">{'MIN'}</span>
                    ) : (
                      <span className="text-[10px] bg-purple-100 text-purple-600 px-2 py-0.5 rounded-full font-bold shrink-0">{'PLÁN'}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-4 flex-wrap">
                    <span className="text-[12px] text-gray-400 flex items-center gap-1">
                      <Clock className="w-3 h-3" />{w.time}
                    </span>
                    <span className="text-[12px] text-[#001161]/70 flex items-center gap-1">
                      <Users className="w-3 h-3" />{w.total} <span className="text-gray-400">{'registrací'}</span>
                    </span>
                    <span className="text-[12px] text-green-600 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />{w.attended} <span className="text-gray-400">{'bylo ({convRate}%)'}</span>
                    </span>
                    <span className="text-[12px] text-purple-600 flex items-center gap-1">
                      <Rocket className="w-3 h-3" />{w.withTrial} <span className="text-gray-400">{'trial'}</span>
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {w.total > 0 && (
                    <button
                      onClick={e => { e.stopPropagation(); exportCsv(w); }}
                      className="p-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-500 transition-colors"
                      title={'Exportovat CSV'}
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {isOpen
                    ? <ChevronDown className="w-4 h-4 text-gray-400" />
                    : <ChevronRight className="w-4 h-4 text-gray-400" />
                  }
                </div>
              </div>

              {/* Expanded registrations */}
              {isOpen && (
                <div className="border-t border-gray-100">
                  {w.registrations.length === 0 ? (
                    <p className="px-5 py-6 text-center text-gray-400 text-[13px]">{'Zatím žádné registrace.'}</p>
                  ) : (
                    <>
                      {/* Conversion bar */}
                      <div className="px-5 py-3 bg-gray-50 border-b border-gray-100 flex items-center gap-4">
                        <div className="flex-1">
                          <div className="flex justify-between text-[11px] text-gray-500 mb-1">
                            <span>{'Konverze reg → check-in'}</span>
                            <span className="font-bold">{convRate}{'%'}</span>
                          </div>
                          <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                            <div className="h-full bg-green-500 rounded-full" style={{ width: `${convRate}%` }} />
                          </div>
                        </div>
                        <div className="flex-1">
                          <div className="flex justify-between text-[11px] text-gray-500 mb-1">
                            <span>{'Reg → trial'}</span>
                            <span className="font-bold">{trialRate}{'%'}</span>
                          </div>
                          <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                            <div className="h-full bg-purple-500 rounded-full" style={{ width: `${trialRate}%` }} />
                          </div>
                        </div>
                      </div>

                      {/* Registration rows */}
                      <div className="divide-y divide-gray-50">
                        {w.registrations.map((reg, idx) => (
                          <div key={idx} className="px-5 py-3 flex items-center gap-4 hover:bg-gray-50/50 transition-colors">
                            <div className="w-7 h-7 rounded-full bg-[#001161]/10 flex items-center justify-center shrink-0">
                              <span className="text-[11px] font-bold text-[#001161]">
                                {(reg.name || '?').charAt(0).toUpperCase()}
                              </span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-[13px] font-semibold text-[#001161]">{reg.name}</span>
                                <span className="text-[11px] text-gray-400 flex items-center gap-0.5">
                                  <Mail className="w-3 h-3" />{reg.email}
                                </span>
                                {reg.phone && (
                                  <span className="text-[11px] text-gray-400 flex items-center gap-0.5">
                                    <Phone className="w-3 h-3" />{reg.phone}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                <span className="text-[11px] text-gray-400 flex items-center gap-0.5">
                                  <Briefcase className="w-3 h-3" />{reg.position}
                                </span>
                                <span className="text-[11px] text-gray-400 flex items-center gap-0.5">
                                  <Calendar className="w-3 h-3" />
                                  {new Date(reg.registeredAt).toLocaleDateString('cs-CZ')}
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
                              {reg.newsletter && (
                                <span className="text-[10px] bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full font-bold flex items-center gap-0.5">
                                  <Tag className="w-2.5 h-2.5" />{'NL'}
                                </span>
                              )}
                              {reg.attended ? (
                                <span className="text-[10px] bg-green-100 text-green-600 px-2 py-0.5 rounded-full font-bold flex items-center gap-0.5">
                                  <CheckCircle2 className="w-2.5 h-2.5" />{'Byl/a'}
                                </span>
                              ) : (
                                <span className="text-[10px] bg-gray-100 text-gray-400 px-2 py-0.5 rounded-full font-bold">{'Nebyl/a'}</span>
                              )}
                              {reg.trialToken ? (
                                <span className="text-[10px] bg-purple-100 text-purple-600 px-2 py-0.5 rounded-full font-bold flex items-center gap-0.5">
                                  <Rocket className="w-2.5 h-2.5" />{'Trial'}
                                </span>
                              ) : null}
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}