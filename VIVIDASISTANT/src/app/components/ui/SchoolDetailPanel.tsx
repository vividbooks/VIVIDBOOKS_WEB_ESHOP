import React, { useState } from 'react';
import { 
  Building2, User, DollarSign, Phone, Mail, MapPin, X, 
  Briefcase, Hash, ExternalLink, Loader2, Activity,
  ChevronDown, ChevronUp
} from 'lucide-react';

// ... existing interfaces ...

interface PersonData {
  id: number;
  name: string;
  email?: string | { value: string }[];
  phone?: string | { value: string }[];
  position?: string;
  /** Pipedrive API často vrací job_title místo position */
  job_title?: string;
  subjects?: string[];
  stupen?: string;
  customFields?: Record<string, any>;
}

interface DealData {
  id: number;
  title: string;
  status: 'won' | 'lost' | 'open';
  value?: number;
  currency?: string;
}

interface ActivityData {
  id: number;
  subject?: string;
  type?: string;
  done?: boolean;
  due_date?: string;
  /** Jméno přiřazeného uživatele (obchodník) z Pipedrive */
  user_name?: string | null;
}

interface SchoolDetailPanelProps {
  organization: {
    id: number;
    name: string;
    address?: string;
  };
  detail: {
    organization?: { owner_name?: string | null; address?: string | null; name?: string };
    persons?: PersonData[];
    deals?: DealData[];
    activities?: ActivityData[];
    label?: string;
    productCategories?: string[];
    purchasedSubjects?: string[];
    teacherCode?: string;
    studentCode?: string;
    owner_name?: string;
  } | null;
  loading: boolean;
  onClose: () => void;
  onLoadDetail?: () => void;
  showButtons?: {
    openInCalendar?: () => void;
    navigate?: () => void;
  };
}

/** Pipedrive activity type → český popisek */
const activityTypeCs = (t?: string) => {
  if (!t) return '';
  const m: Record<string, string> = {
    call: 'Hovor',
    meeting: 'Schůzka',
    task: 'Úkol',
    deadline: 'Termín',
    email: 'E-mail',
    lunch: 'Oběd',
    document: 'Dokument',
  };
  return m[t] || t;
};

/** Stejný host jako u dealů v adminu (`AdminOrderDetailPage`). */
const PIPEDRIVE_APP_BASE = 'https://app.pipedrive.com';

function pipedriveOrganizationUrl(orgId: number) {
  return `${PIPEDRIVE_APP_BASE}/organization/${orgId}`;
}

/** Krátké hodnoty jako bobánky; dlouhé texty a poznámky zvlášť pod nimi. */
function isLongNoteField(fieldLabel: string, value: unknown): boolean {
  if (value == null) return false;
  if (Array.isArray(value)) {
    return value.some((v) => String(v).length > 120 || /\n/.test(String(v)));
  }
  const s = String(value);
  if (s.length > 140 || /\n/.test(s)) return true;
  const l = fieldLabel.toLowerCase();
  return /poznámka|pozn|note|popis|shrnutí|summary|goal|cíl|detail|komentář|text/.test(l);
}

const pillBase =
  'inline-flex items-center max-w-full rounded-full px-2.5 py-1 text-[11px] font-medium leading-snug border border-white/12 bg-white/[0.06] text-white/90 break-words';

const labeledPillWrap =
  'inline-flex max-w-full flex-col gap-0.5 rounded-lg border border-white/12 bg-[#252528] px-2 py-1.5 min-w-0';

/** Jedna položka kontaktu — bobánky + případná dlouhá poznámka */
const PersonContactCard: React.FC<{ person: PersonData }> = ({ person }) => {
  const emailValue =
    typeof person.email === 'string' ? person.email : (person.email as { value: string }[] | undefined)?.[0]?.value;
  const phoneValue =
    typeof person.phone === 'string' ? person.phone : (person.phone as { value: string }[] | undefined)?.[0]?.value;

  const jobTitle = person.position || person.job_title;

  const shortCustom: [string, string | string[]][] = [];
  const longCustom: [string, string | string[]][] = [];
  if (person.customFields) {
    for (const [key, value] of Object.entries(person.customFields)) {
      if (value == null || value === '') continue;
      if (isLongNoteField(key, value)) longCustom.push([key, value]);
      else shortCustom.push([key, value]);
    }
  }

  const renderValue = (v: string | string[]) =>
    Array.isArray(v) ? v.filter(Boolean).map((x) => String(x)).join(', ') : String(v);

  return (
    <div className="min-w-0 max-w-full rounded-xl border border-white/15 bg-[#141416] p-3.5 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)]">
      <p className="text-white font-semibold break-words text-[15px] leading-snug">{person.name}</p>

      {/* Standardní pole — barevné bobánky */}
      {(jobTitle || person.subjects?.length || person.stupen) && (
        <div className="flex flex-wrap gap-1.5 mt-2.5">
          {jobTitle && (
            <span className={`${pillBase} border-violet-400/25 bg-violet-500/15 text-violet-200`}>{jobTitle}</span>
          )}
          {person.subjects?.map((subj: string, i: number) => (
            <span key={i} className={`${pillBase} border-sky-400/25 bg-sky-500/15 text-sky-200`}>
              {subj}
            </span>
          ))}
          {person.stupen && (
            <span className={`${pillBase} border-emerald-400/25 bg-emerald-500/15 text-emerald-200`}>{person.stupen}</span>
          )}
        </div>
      )}

      {/* Vlastní pole Pipedrive — popisek + hodnota v „bobánku“ */}
      {shortCustom.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2.5">
          {shortCustom.map(([label, value]) => {
            if (Array.isArray(value)) {
              return value.map((item, idx) => (
                <div key={`${label}-${idx}`} className={labeledPillWrap}>
                  <span className="text-[9px] font-semibold uppercase tracking-wide text-[#94A3B8] truncate">{label}</span>
                  <span className="text-xs text-white/90 break-words">{String(item)}</span>
                </div>
              ));
            }
            return (
              <div key={label} className={labeledPillWrap}>
                <span className="text-[9px] font-semibold uppercase tracking-wide text-[#94A3B8] truncate">{label}</span>
                <span className="text-xs text-white/90 break-words">{renderValue(value)}</span>
              </div>
            );
          })}
        </div>
      )}

      {longCustom.length > 0 && (
        <div className="mt-3 space-y-2 min-w-0">
          {longCustom.map(([label, value]) => (
            <div key={label} className="rounded-lg border-l-2 border-violet-500/50 bg-black/25 pl-3 pr-2 py-2 min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-[#94A3B8] mb-1">{label}</p>
              <p className="text-sm text-white/85 whitespace-pre-wrap break-words leading-relaxed">{renderValue(value)}</p>
            </div>
          ))}
        </div>
      )}

      {emailValue && (
        <a
          href={`mailto:${emailValue}`}
          className="text-[#3B82F6] text-sm flex items-start gap-1.5 mt-3 hover:underline min-w-0 break-all"
        >
          <Mail size={14} className="shrink-0 mt-0.5" />
          <span className="min-w-0">{emailValue}</span>
        </a>
      )}
      {phoneValue && (
        <a
          href={`tel:${phoneValue}`}
          className="text-[#10B981] text-sm flex items-start gap-1.5 mt-1.5 hover:underline min-w-0 break-all"
        >
          <Phone size={14} className="shrink-0 mt-0.5" />
          <span className="min-w-0">{phoneValue}</span>
        </a>
      )}
    </div>
  );
};

// Deal Item Component with Accordion
const DealItem: React.FC<{ deal: any }> = ({ deal }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  
  const statusColor = deal.status === 'won' ? '#22C55E' : 
                     deal.status === 'lost' ? '#EF4444' : '#F59E0B';
  const statusText = deal.status === 'won' ? 'VYHRÁNO' : 
                    deal.status === 'lost' ? 'ZTRACENO' : 'OTEVŘENO';

  return (
    <div className="bg-[#1C1C1E] rounded-lg overflow-hidden border border-white/5 min-w-0 max-w-full">
      <button 
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full p-3 flex items-center justify-between hover:bg-white/5 transition-colors text-left"
      >
        <div className="flex-1 min-w-0">
          <p className="text-white font-medium truncate">{deal.title}</p>
          <div className="flex items-center gap-2 mt-1">
            <span 
              className="inline-block text-[10px] px-2 py-0.5 rounded-full font-medium"
              style={{ 
                backgroundColor: `${statusColor}20`,
                color: statusColor
              }}
            >
              {statusText}
            </span>
            {deal.value > 0 && (
              <span className="text-[#10B981] text-xs font-bold">
                {deal.value.toLocaleString('cs-CZ')} {deal.currency || 'CZK'}
              </span>
            )}
          </div>
          {deal.owner_name && (
            <p className="text-[10px] text-[#94A3B8] mt-1 truncate">
              Vlastník dealu: <span className="text-[#CBD5E1]">{deal.owner_name}</span>
            </p>
          )}
        </div>
        {isExpanded ? <ChevronUp size={18} className="text-[#6B7280]" /> : <ChevronDown size={18} className="text-[#6B7280]" />}
      </button>
      
      {isExpanded && (
        <div className="px-3 pb-3 space-y-2 border-t border-white/5 pt-3 bg-black/20 min-w-0 max-w-full">
          <div className="grid grid-cols-1 gap-2 min-w-0">
            {deal.add_time && (
              <div className="flex flex-col">
                <span className="text-[10px] text-[#6B7280] uppercase font-semibold">Vytvořeno</span>
                <span className="text-xs text-white/80">{new Date(deal.add_time).toLocaleDateString('cs-CZ')}</span>
              </div>
            )}
            {deal.won_time && deal.status === 'won' && (
              <div className="flex flex-col">
                <span className="text-[10px] text-emerald-500 uppercase font-semibold">Vyhráno</span>
                <span className="text-xs text-emerald-500">{new Date(deal.won_time).toLocaleDateString('cs-CZ')}</span>
              </div>
            )}
          </div>
          
          {/* Custom Fields */}
          {deal.customFields && Object.entries(deal.customFields).map(([key, value]) => {
            if (!value) return null;
            return (
              <div key={key} className="flex flex-col gap-1">
                <span className="text-[10px] text-[#6B7280] uppercase font-semibold">{key}</span>
                <div className="flex flex-wrap gap-1">
                  {Array.isArray(value) ? value.map((v: string, idx: number) => (
                    <span key={idx} className="text-[10px] px-2 py-0.5 bg-white/10 text-white/90 rounded">
                      {String(v)}
                    </span>
                  )) : (
                    <span className="text-[10px] px-2 py-0.5 bg-white/10 text-white/90 rounded">
                      {String(value)}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export const SchoolDetailPanel: React.FC<SchoolDetailPanelProps> = ({
  organization,
  detail,
  loading,
  onClose,
  onLoadDetail,
  showButtons
}) => {
  return (
    <div className="h-full min-h-0 w-full min-w-0 max-w-full flex flex-col overflow-hidden bg-[#1C1C1E]">
      {/* Header */}
      <div className="bg-[#10B981] p-4 flex items-start justify-between shrink-0">
        <div className="flex-1 min-w-0">
          <h2 className="text-white text-lg font-bold truncate">{organization.name}</h2>
          {(detail?.label || organization.address) && (
            <p className="text-white/80 text-sm mt-1 flex items-start gap-1 min-w-0 break-words">
              <MapPin size={14} className="shrink-0 mt-0.5" />
              <span className="min-w-0">{organization.address}</span>
            </p>
          )}
        </div>
        <button 
          onClick={onClose}
          className="p-2 hover:bg-white/20 rounded-lg transition-colors"
        >
          <X size={20} className="text-white" />
        </button>
      </div>

      {(detail?.teacherCode || detail?.studentCode) && (
        <div className="shrink-0 px-4 py-3 border-b border-white/10 bg-[#10B981]/12">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-[#6EE7B7] mb-2 flex items-center gap-1.5">
            <Hash size={12} className="shrink-0" />
            Přístupové kódy (Pipedrive)
          </p>
          <div className="flex flex-wrap gap-3 min-w-0">
            {detail.teacherCode && (
              <div className="min-w-0 flex-1 rounded-lg border border-emerald-500/25 bg-[#1C1C1E] px-3 py-2">
                <span className="text-[#94A3B8] text-xs">Učitel</span>
                <code className="block font-mono text-base text-white tracking-wider mt-0.5 break-all">
                  {detail.teacherCode}
                </code>
              </div>
            )}
            {detail.studentCode && (
              <div className="min-w-0 flex-1 rounded-lg border border-emerald-500/25 bg-[#1C1C1E] px-3 py-2">
                <span className="text-[#94A3B8] text-xs">Žák</span>
                <code className="block font-mono text-base text-white tracking-wider mt-0.5 break-all">
                  {detail.studentCode}
                </code>
              </div>
            )}
          </div>
        </div>
      )}

      {detail?.organization?.owner_name && (
        <div className="shrink-0 px-4 py-2.5 bg-[#252528] border-b border-white/10">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[#94A3B8] mb-0.5">Vlastník organizace (Pipedrive)</p>
          <p className="text-sm text-white flex items-center gap-2 min-w-0">
            <User size={14} className="text-emerald-400 shrink-0" />
            <span className="min-w-0 break-words">{detail.organization.owner_name}</span>
          </p>
        </div>
      )}

      {organization.id != null && Number(organization.id) > 0 && (
        <div className="shrink-0 px-4 py-2.5 border-b border-white/10 bg-[#1C1C1E]">
          <a
            href={pipedriveOrganizationUrl(Number(organization.id))}
            target="_blank"
            rel="noopener noreferrer"
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-emerald-500/40 bg-emerald-500/10 py-2.5 text-sm font-medium text-emerald-300 transition-colors hover:bg-emerald-500/20"
          >
            <ExternalLink size={16} />
            Otevřít v Pipedrive
          </a>
        </div>
      )}

      {/* Action buttons */}
      {showButtons && (
        <div className="p-4 flex gap-2 border-b border-white/10">
          {showButtons.openInCalendar && (
            <button
              onClick={showButtons.openInCalendar}
              className="flex-1 flex items-center justify-center gap-2 py-2 bg-[#3B82F6] text-white rounded-lg font-medium hover:bg-[#2563EB] transition-colors"
            >
              <ExternalLink size={16} />
              Otevřít v Kalendáři
            </button>
          )}
          {showButtons.navigate && (
            <button
              onClick={showButtons.navigate}
              className="flex items-center justify-center gap-2 py-2 px-4 bg-[#F97316] text-white rounded-lg font-medium hover:bg-[#EA580C] transition-colors"
            >
              <MapPin size={16} />
              Navigovat
            </button>
          )}
        </div>
      )}

      {/* Content — overflow-x skryté, aby široký obsah neroztáhl panel (flex min-width) */}
      <div className="min-w-0 flex-1 overflow-y-auto overflow-x-hidden p-4 space-y-4 break-words">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={32} className="animate-spin text-[#10B981]" />
            <span className="ml-3 text-[#6B7280]">Načítám data z Pipedrive...</span>
          </div>
        ) : detail ? (
          <>
            {/* Contacts */}
            {detail.persons && detail.persons.length > 0 && (
              <div className="bg-[#252528] rounded-xl p-4 min-w-0 max-w-full">
                <h3 className="text-[#8B5CF6] font-semibold mb-3 flex items-center gap-2">
                  <User size={16} />
                  Kontakty ({detail.persons.length})
                </h3>
                <div className="grid grid-cols-1 gap-4 min-w-0">
                  {detail.persons.map((person: PersonData) => (
                    <PersonContactCard key={person.id} person={person} />
                  ))}
                </div>
              </div>
            )}

            {/* Aktivity obchodníka (Pipedrive) — před dealy */}
            {detail.activities && detail.activities.length > 0 && (
              <div className="bg-[#252528] rounded-xl p-4 min-w-0 max-w-full border border-white/10">
                <h3 className="text-sky-400 font-semibold mb-3 flex items-center gap-2">
                  <Activity size={16} />
                  Aktivity obchodníka ({detail.activities.length})
                </h3>
                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {detail.activities.map((activity: ActivityData & { add_time?: string }) => (
                    <div
                      key={activity.id}
                      className="bg-[#1C1C1E] rounded-lg p-2.5 text-sm min-w-0 border border-white/5"
                    >
                      <div className="flex items-start gap-2 min-w-0">
                        <span className={`w-2 h-2 rounded-full shrink-0 mt-1.5 ${activity.done ? 'bg-[#10B981]' : 'bg-[#F59E0B]'}`} />
                        <div className="min-w-0 flex-1">
                          <span className="text-white break-words font-medium leading-snug">
                            {activity.subject || activityTypeCs(activity.type) || 'Aktivita'}
                          </span>
                          <div className="flex flex-wrap gap-x-2 gap-y-0.5 mt-1 text-[11px] text-[#8E8E93]">
                            {activity.type && (
                              <span className="text-[#64748B]">{activityTypeCs(activity.type)}</span>
                            )}
                            {activity.user_name && (
                              <span className="text-[#A5B4FC]">
                                Obchodník: <span className="text-[#C7D2FE]">{activity.user_name}</span>
                              </span>
                            )}
                          </div>
                          {(activity.due_date || activity.add_time) && (
                            <span className="text-[#6B7280] text-[11px] block mt-1">
                              {activity.due_date ? `Termín: ${activity.due_date}` : ''}
                              {activity.due_date && activity.add_time ? ' · ' : ''}
                              {activity.add_time &&
                                !Number.isNaN(Date.parse(String(activity.add_time))) &&
                                `Vytvořeno: ${new Date(activity.add_time).toLocaleString('cs-CZ')}`}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Deals */}
            {detail.deals && detail.deals.length > 0 && (
              <div className="bg-[#252528] rounded-xl p-4 min-w-0 max-w-full">
                <h3 className="text-[#F59E0B] font-semibold mb-3 flex items-center gap-2">
                  <DollarSign size={16} />
                  Dealy ({detail.deals.length})
                </h3>
                <div className="space-y-2">
                  {detail.deals.map((deal: any) => (
                    <DealItem key={deal.id} deal={deal} />
                  ))}
                </div>
              </div>
            )}

            {/* No data */}
            {!detail.persons?.length && !detail.deals?.length && !detail.activities?.length && (
              <div className="text-center py-8 text-[#6B7280]">
                <Building2 size={32} className="mx-auto mb-2 opacity-30" />
                <p>Žádné kontakty, dealy ani aktivity nenalezeny</p>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-12">
            <Briefcase size={48} className="mx-auto mb-4 text-[#6B7280] opacity-30" />
            <p className="text-[#6B7280] mb-4">Klikněte pro načtení dat z Pipedrive</p>
            {onLoadDetail && (
              <button
                onClick={onLoadDetail}
                className="px-4 py-2 bg-[#10B981] text-white rounded-lg hover:bg-[#059669] transition-colors"
              >
                Načíst data
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default SchoolDetailPanel;
