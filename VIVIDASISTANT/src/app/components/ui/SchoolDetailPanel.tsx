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
}

interface SchoolDetailPanelProps {
  organization: {
    id: number;
    name: string;
    address?: string;
  };
  detail: {
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

// Deal Item Component with Accordion
const DealItem: React.FC<{ deal: any }> = ({ deal }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  
  const statusColor = deal.status === 'won' ? '#22C55E' : 
                     deal.status === 'lost' ? '#EF4444' : '#F59E0B';
  const statusText = deal.status === 'won' ? 'VYHRÁNO' : 
                    deal.status === 'lost' ? 'ZTRACENO' : 'OTEVŘENO';

  return (
    <div className="bg-[#1C1C1E] rounded-lg overflow-hidden border border-white/5">
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
        </div>
        {isExpanded ? <ChevronUp size={18} className="text-[#6B7280]" /> : <ChevronDown size={18} className="text-[#6B7280]" />}
      </button>
      
      {isExpanded && (
        <div className="px-3 pb-3 space-y-2 border-t border-white/5 pt-3 bg-black/20">
          <div className="grid grid-cols-2 gap-2">
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
    <div className="h-full flex flex-col bg-[#1C1C1E]">
      {/* Header */}
      <div className="bg-[#10B981] p-4 flex items-start justify-between shrink-0">
        <div className="flex-1 min-w-0">
          <h2 className="text-white text-lg font-bold truncate">{organization.name}</h2>
          {(detail?.label || organization.address) && (
            <p className="text-white/80 text-sm mt-1 flex items-center gap-1">
              <MapPin size={14} />
              {organization.address}
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

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={32} className="animate-spin text-[#10B981]" />
            <span className="ml-3 text-[#6B7280]">Načítám data z Pipedrive...</span>
          </div>
        ) : detail ? (
          <>
            {/* Contacts */}
            {detail.persons && detail.persons.length > 0 && (
              <div className="bg-[#252528] rounded-xl p-4">
                <h3 className="text-[#8B5CF6] font-semibold mb-3 flex items-center gap-2">
                  <User size={16} />
                  Kontakty ({detail.persons.length})
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {detail.persons.map((person: PersonData) => {
                    // Handle both email formats (string or array)
                    const emailValue = typeof person.email === 'string' 
                      ? person.email 
                      : (person.email as any)?.[0]?.value;
                    const phoneValue = typeof person.phone === 'string'
                      ? person.phone
                      : (person.phone as any)?.[0]?.value;
                    
                    return (
                      <div key={person.id} className="bg-[#1C1C1E] rounded-lg p-3">
                        <p className="text-white font-medium">{person.name}</p>
                        {/* Position, subjects, stupen tags */}
                        {(person.position || person.subjects?.length || person.stupen || person.customFields) && (
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {person.position && (
                              <span className="text-[10px] px-2 py-0.5 bg-[#8B5CF6]/20 text-[#8B5CF6] rounded-full font-medium">
                                {person.position}
                              </span>
                            )}
                            {person.subjects?.map((subj: string, i: number) => (
                              <span key={i} className="text-[10px] px-2 py-0.5 bg-[#3B82F6]/20 text-[#3B82F6] rounded-full">
                                {subj}
                              </span>
                            ))}
                            {person.stupen && (
                              <span className="text-[10px] px-2 py-0.5 bg-[#10B981]/20 text-[#10B981] rounded-full">
                                {person.stupen}
                              </span>
                            )}
                            {person.customFields && Object.entries(person.customFields).map(([key, value]) => {
                              if (!value) return null;
                              // Handle array values (multiple select fields)
                              if (Array.isArray(value)) {
                                return value.map((v: string, idx: number) => (
                                  <span key={`${key}-${idx}`} className="text-[10px] px-2 py-0.5 bg-[#8B5CF6]/20 text-[#8B5CF6] rounded-full">
                                    {v}
                                  </span>
                                ));
                              }
                              // Handle single string/number value
                              return (
                                <span key={key} className="text-[10px] px-2 py-0.5 bg-[#8B5CF6]/20 text-[#8B5CF6] rounded-full">
                                  {String(value)}
                                </span>
                              );
                            })}
                          </div>
                        )}
                        {emailValue && (
                          <a href={`mailto:${emailValue}`} className="text-[#3B82F6] text-sm flex items-center gap-1 mt-2 hover:underline">
                            <Mail size={12} />
                            {emailValue}
                          </a>
                        )}
                        {phoneValue && (
                          <a href={`tel:${phoneValue}`} className="text-[#10B981] text-sm flex items-center gap-1 mt-1 hover:underline">
                            <Phone size={12} />
                            {phoneValue}
                          </a>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Deals */}
            {detail.deals && detail.deals.length > 0 && (
              <div className="bg-[#252528] rounded-xl p-4">
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

            {/* Activities */}
            {detail.activities && detail.activities.length > 0 && (
              <div className="bg-[#252528] rounded-xl p-4">
                <h3 className="text-[#6B7280] font-semibold mb-3 flex items-center gap-2">
                  <Activity size={16} />
                  Poslední aktivity ({detail.activities.length})
                </h3>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {detail.activities.slice(0, 5).map((activity: any) => (
                    <div key={activity.id} className="bg-[#1C1C1E] rounded-lg p-2 text-sm">
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${activity.done ? 'bg-[#10B981]' : 'bg-[#F59E0B]'}`} />
                        <span className="text-white">{activity.subject || activity.type}</span>
                      </div>
                      {activity.due_date && (
                        <span className="text-[#6B7280] text-xs ml-4">{activity.due_date}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Access Codes */}
            {(detail.teacherCode || detail.studentCode) && (
              <div className="bg-[#10B981]/10 rounded-xl p-4">
                <h3 className="text-[#10B981] font-semibold mb-3 flex items-center gap-2">
                  <Hash size={16} />
                  Přístupové kódy
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  {detail.teacherCode && (
                    <div className="bg-[#1C1C1E] rounded-lg p-3">
                      <span className="text-[#6B7280] text-sm">Učitel:</span>
                      <code className="block text-white font-mono text-lg mt-1">{detail.teacherCode}</code>
                    </div>
                  )}
                  {detail.studentCode && (
                    <div className="bg-[#1C1C1E] rounded-lg p-3">
                      <span className="text-[#6B7280] text-sm">Žák:</span>
                      <code className="block text-white font-mono text-lg mt-1">{detail.studentCode}</code>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Owner */}
            {detail.owner_name && (
              <div className="text-[#6B7280] text-sm flex items-center gap-2">
                <User size={14} />
                Vlastník: {detail.owner_name}
              </div>
            )}

            {/* No data */}
            {!detail.persons?.length && !detail.deals?.length && (
              <div className="text-center py-8 text-[#6B7280]">
                <Building2 size={32} className="mx-auto mb-2 opacity-30" />
                <p>Žádné kontakty ani dealy nenalezeny</p>
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
