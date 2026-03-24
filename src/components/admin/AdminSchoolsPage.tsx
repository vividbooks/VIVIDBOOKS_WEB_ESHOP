import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  Building2,
  ChevronRight,
  ChevronDown,
  Loader2,
  Mail,
  Package,
  Phone,
  Search,
  School,
  ShoppingBag,
  User,
  X,
  DollarSign,
} from 'lucide-react';
import {
  fetchAdminSchoolDetail,
  fetchAdminSchools,
  fetchProducts,
  type AdminSchoolDetailResponse,
  type AdminSchoolListItem,
} from '../../utils/adminApi';
import { findContactRepresentative } from '../../data/contactRepresentatives';

const FF = { fontFamily: "'Fenomen Sans', sans-serif" } as const;

function formatCurrency(amount: number) {
  return `${(amount / 100).toLocaleString('cs-CZ', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} Kč`;
}

function formatDate(value?: string | null) {
  if (!value) return '';
  try {
    return new Date(value).toLocaleDateString('cs-CZ');
  } catch {
    return '';
  }
}

function pickPrimaryContactValue(value: unknown) {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) {
    const primary = value.find((item: any) => item?.primary) || value[0];
    return primary?.value ? String(primary.value) : '';
  }
  return '';
}

function statusStyles(status: string) {
  switch (status) {
    case 'active_subscription':
      return 'bg-emerald-100 text-emerald-700';
    case 'in_progress':
      return 'bg-amber-100 text-amber-700';
    case 'past_request':
      return 'bg-blue-100 text-blue-700';
    case 'known':
      return 'bg-slate-100 text-slate-600';
    default:
      return 'bg-gray-100 text-gray-500';
  }
}

function EmptySelection() {
  return (
    <div className="h-full flex flex-col items-center justify-center text-gray-300 px-8">
      <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mb-4">
        <School className="w-8 h-8" />
      </div>
      <p style={FF} className="text-[15px] text-[#001161]/60 font-bold">Vyberte školu ze seznamu</p>
      <p style={FF} className="text-[13px] text-[#001161]/35 mt-1 text-center max-w-md">
        Vlevo můžeš hledat podle názvu školy nebo IČO a filtrovat podle zakoupeného produktu.
      </p>
    </div>
  );
}

function AdminSchoolDetailBody({
  detail,
  loading,
  onClose,
  fallbackName,
}: {
  detail: AdminSchoolDetailResponse | null;
  loading: boolean;
  onClose: () => void;
  fallbackName: string;
}) {
  const [expandedDealId, setExpandedDealId] = useState<number | null>(null);

  if (loading) {
    return (
      <div className="min-h-[420px] flex items-center justify-center bg-white">
        <div className="flex items-center gap-3 text-[#001161]/45">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span style={FF} className="text-[13px]">Načítám detail školy…</span>
        </div>
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="min-h-[320px] flex items-center justify-center bg-white">
        <p style={FF} className="text-[13px] text-[#001161]/40">Detail školy se nepodařilo načíst.</p>
      </div>
    );
  }

  return (
    <div className="bg-white">
      <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-[#001161]/8 bg-white/95 px-5 py-4 backdrop-blur">
        <div className="min-w-0">
          <h3 style={FF} className="text-[22px] font-bold text-[#001161]">
            {detail.school.name || fallbackName}
          </h3>
          <p style={FF} className="mt-1 text-[12px] text-[#001161]/45">
            {detail.organization?.address || detail.school.kraj || 'Bez doplněné adresy'}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-xl p-2 text-[#001161]/35 transition-colors hover:bg-[#001161]/5 hover:text-[#001161]/60"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="space-y-5 p-5">
        {detail.persons.length > 0 && (
          <section className="rounded-2xl border border-[#001161]/8 bg-[#fcfcff] p-4">
            <div className="mb-3 flex items-center gap-2">
              <User className="w-4 h-4 text-[#001161]/45" />
              <h4 style={FF} className="text-[14px] font-bold text-[#001161]">
                Kontakty ({detail.persons.length})
              </h4>
            </div>
            <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
              {detail.persons.map((person) => {
                const email = pickPrimaryContactValue(person.email);
                const phone = pickPrimaryContactValue(person.phone);
                return (
                  <div key={person.id} className="rounded-2xl border border-[#001161]/8 bg-white p-4">
                    <p style={FF} className="text-[18px] font-bold text-[#001161]">
                      {person.name}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {person.position && (
                        <span className="rounded-full bg-[#001161]/6 px-2 py-1 text-[10px] text-[#001161]/70">
                          {person.position}
                        </span>
                      )}
                      {person.subjects?.map((subject) => (
                        <span key={subject} className="rounded-full bg-sky-50 px-2 py-1 text-[10px] text-sky-700">
                          {subject}
                        </span>
                      ))}
                      {person.stupen && (
                        <span className="rounded-full bg-emerald-50 px-2 py-1 text-[10px] text-emerald-700">
                          {person.stupen}
                        </span>
                      )}
                      {person.customFields &&
                        Object.entries(person.customFields)
                          .filter(([, value]) => Boolean(value))
                          .slice(0, 8)
                          .flatMap(([key, value]) =>
                            Array.isArray(value)
                              ? value.map((item) => (
                                  <span key={`${key}-${String(item)}`} className="rounded-full bg-violet-50 px-2 py-1 text-[10px] text-violet-700">
                                    {String(item)}
                                  </span>
                                ))
                              : [
                                  <span key={key} className="rounded-full bg-violet-50 px-2 py-1 text-[10px] text-violet-700">
                                    {String(value)}
                                  </span>,
                                ],
                          )}
                    </div>
                    {email && (
                      <a href={`mailto:${email}`} className="mt-3 flex items-center gap-2 text-[13px] text-[#001161] hover:underline">
                        <Mail className="w-3.5 h-3.5 text-[#001161]/35" />
                        {email}
                      </a>
                    )}
                    {phone && (
                      <a href={`tel:${phone}`} className="mt-2 flex items-center gap-2 text-[13px] text-emerald-700 hover:underline">
                        <Phone className="w-3.5 h-3.5 text-emerald-500" />
                        {phone}
                      </a>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {detail.deals.length > 0 && (
          <section className="rounded-2xl border border-[#001161]/8 bg-[#fcfcff] p-4">
            <div className="mb-3 flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-[#001161]/45" />
              <h4 style={FF} className="text-[14px] font-bold text-[#001161]">
                Dealy ({detail.deals.length})
              </h4>
            </div>
            <div className="space-y-3">
              {detail.deals.map((deal) => {
                const isExpanded = expandedDealId === deal.id;
                const statusClass =
                  deal.status === 'won'
                    ? 'bg-emerald-100 text-emerald-700'
                    : deal.status === 'lost'
                      ? 'bg-rose-100 text-rose-700'
                      : 'bg-amber-100 text-amber-700';
                return (
                  <div key={deal.id} className="rounded-2xl border border-[#001161]/8 bg-white">
                    <button
                      type="button"
                      onClick={() => setExpandedDealId(isExpanded ? null : deal.id)}
                      className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
                    >
                      <div className="min-w-0">
                        <p style={FF} className="truncate text-[16px] font-bold text-[#001161]">
                          {deal.title}
                        </p>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <span className={`rounded-full px-2 py-1 text-[10px] font-bold ${statusClass}`}>
                            {deal.status === 'won' ? 'VYHRÁNO' : deal.status === 'lost' ? 'ZTRACENO' : 'OTEVŘENO'}
                          </span>
                          {deal.value ? (
                            <span className="text-[11px] text-[#001161]/45">
                              {deal.value.toLocaleString('cs-CZ')} {deal.currency || 'CZK'}
                            </span>
                          ) : null}
                          {deal.add_time ? (
                            <span className="text-[11px] text-[#001161]/35">
                              {formatDate(deal.add_time)}
                            </span>
                          ) : null}
                        </div>
                      </div>
                      <ChevronDown className={`w-4 h-4 shrink-0 text-[#001161]/35 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                    </button>
                    {isExpanded && (
                      <div className="border-t border-[#001161]/8 px-4 py-3">
                        {deal.products?.length ? (
                          <div className="mb-3 flex flex-wrap gap-1.5">
                            {deal.products.map((product) => (
                              <span key={`${deal.id}-${product.name}`} className="rounded-full bg-[#001161]/6 px-2 py-1 text-[10px] text-[#001161]/70">
                                {product.name}
                              </span>
                            ))}
                          </div>
                        ) : null}
                        {deal.customFields && Object.entries(deal.customFields).filter(([, value]) => Boolean(value)).length > 0 ? (
                          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                            {Object.entries(deal.customFields)
                              .filter(([, value]) => Boolean(value))
                              .map(([key, value]) => (
                                <div key={key}>
                                  <p style={FF} className="text-[10px] uppercase tracking-wide text-[#001161]/35 font-bold">
                                    {key}
                                  </p>
                                  <div className="mt-1 flex flex-wrap gap-1.5">
                                    {Array.isArray(value)
                                      ? value.map((item) => (
                                          <span key={`${key}-${String(item)}`} className="rounded-full bg-gray-100 px-2 py-1 text-[10px] text-gray-600">
                                            {String(item)}
                                          </span>
                                        ))
                                      : (
                                        <span className="rounded-full bg-gray-100 px-2 py-1 text-[10px] text-gray-600">
                                          {String(value)}
                                        </span>
                                      )}
                                  </div>
                                </div>
                              ))}
                          </div>
                        ) : null}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {detail.activities.length > 0 && (
          <section className="rounded-2xl border border-[#001161]/8 bg-[#fcfcff] p-4">
            <div className="mb-3 flex items-center gap-2">
              <Activity className="w-4 h-4 text-[#001161]/45" />
              <h4 style={FF} className="text-[14px] font-bold text-[#001161]">
                Poslední aktivity ({detail.activities.length})
              </h4>
            </div>
            <div className="space-y-2">
              {detail.activities.slice(0, 12).map((activity) => (
                <div key={activity.id} className="rounded-2xl border border-[#001161]/8 bg-white px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full ${activity.done ? 'bg-emerald-500' : 'bg-amber-400'}`} />
                    <p style={FF} className="text-[13px] font-bold text-[#001161]">
                      {activity.subject || activity.type || 'Aktivita'}
                    </p>
                  </div>
                  <p style={FF} className="mt-1 text-[11px] text-[#001161]/40">
                    {[activity.user_name, formatDate(activity.due_date), formatDate(activity.add_time)].filter(Boolean).join(' · ')}
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

export function AdminSchoolsPage() {
  const [searchInput, setSearchInput] = useState('');
  const [subjectFilter, setSubjectFilter] = useState<string | null>(null);
  const [subjectOptions, setSubjectOptions] = useState<string[]>([]);
  const [schools, setSchools] = useState<AdminSchoolListItem[]>([]);
  const [schoolsLoading, setSchoolsLoading] = useState(true);
  const [selectedSchool, setSelectedSchool] = useState<AdminSchoolListItem | null>(null);
  const [detail, setDetail] = useState<AdminSchoolDetailResponse | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [listError, setListError] = useState('');
  const [detailError, setDetailError] = useState('');
  const ownerContact = detail?.owner
    ? findContactRepresentative({ email: detail.owner.email, name: detail.owner.name })
    : null;
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadSchools = async (q: string, subject: string) => {
    setSchoolsLoading(true);
    setListError('');
    try {
      const data = await fetchAdminSchools({ q, subject, limit: 24 });
      setSchools(data.items || []);
      setSelectedSchool((current) => {
        if (!current) return data.items?.[0] || null;
        return data.items?.find((item) => item.ico === current.ico) || data.items?.[0] || null;
      });
    } catch (error: any) {
      setListError(error.message || 'Nepodařilo se načíst školy.');
      setSchools([]);
      setSelectedSchool(null);
    } finally {
      setSchoolsLoading(false);
    }
  };

  useEffect(() => {
    loadSchools('', '');
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchProducts()
      .then((items) => {
        if (cancelled) return;
        const subjects = Array.from(
          new Set(
            items
              .map((item: any) => String(item?.category || '').trim())
              .filter(Boolean),
          ),
        ).sort((a, b) => a.localeCompare(b, 'cs'));
        setSubjectOptions(subjects);
      })
      .catch(() => {
        if (!cancelled) setSubjectOptions([]);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void loadSchools(searchInput.trim(), subjectFilter || '');
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchInput, subjectFilter]);

  useEffect(() => {
    if (!selectedSchool) {
      setDetail(null);
      setDetailError('');
      return;
    }

    let cancelled = false;
    setDetailLoading(true);
    setDetailError('');

    fetchAdminSchoolDetail({
      orgId: selectedSchool.orgId,
      ico: selectedSchool.ico,
      name: selectedSchool.name,
    })
      .then((data) => {
        if (!cancelled) setDetail(data);
      })
      .catch((error: any) => {
        if (!cancelled) {
          setDetail(null);
          setDetailError(error.message || 'Nepodařilo se načíst detail školy.');
        }
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedSchool]);

  const selectedOrganization = useMemo(() => {
    if (!selectedSchool) return null;
    return detail?.organization
      ? detail.organization
      : {
          id: selectedSchool.orgId || 0,
          name: selectedSchool.orgName || selectedSchool.name,
          address: selectedSchool.address,
        };
  }, [detail, selectedSchool]);

  const summaryProductNames = useMemo(
    () => Array.from(new Set([
      ...(detail?.orderSummary.purchasedProducts?.map((item) => item.name) || []),
      ...(detail?.productsSummary || []),
    ])),
    [detail],
  );

  return (
    <div className="h-full min-h-0 flex overflow-hidden">
      <div className="w-[320px] min-h-0 shrink-0 border-r border-gray-200 bg-white flex flex-col">
        <div className="p-4 border-b border-gray-100 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h1 style={FF} className="text-[13px] font-bold uppercase tracking-wide text-[#001161]">
                Školy <span className="text-gray-400 font-normal">({schools.length})</span>
              </h1>
              <p style={FF} className="text-[11px] text-[#001161]/40 mt-0.5">
                CRM + objednávky + aktivity obchodníka
              </p>
            </div>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Hledat školu nebo IČO..."
              className="w-full pl-9 pr-9 py-2 text-[12px] border border-gray-200 rounded-lg bg-gray-50 focus:bg-white focus:border-[#001161] outline-none transition-all"
            />
            {searchInput && (
              <button
                type="button"
                onClick={() => setSearchInput('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {subjectOptions.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-[#001161]/45">
                <Package className="w-3.5 h-3.5" />
                <p style={FF} className="text-[11px] font-bold uppercase tracking-wide">
                  Předmět
                </p>
              </div>
              <div className="flex flex-wrap gap-1">
                <button
                  type="button"
                  onClick={() => setSubjectFilter(null)}
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold transition-colors ${
                    !subjectFilter ? 'bg-[#001161] text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                  }`}
                >
                  Vše
                </button>
                {subjectOptions.map((subject) => (
                  <button
                    key={subject}
                    type="button"
                    onClick={() => setSubjectFilter(subjectFilter === subject ? null : subject)}
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold transition-colors truncate max-w-[120px] ${
                      subjectFilter === subject
                        ? 'bg-[#ff8c66] text-white'
                        : 'bg-gray-100 text-gray-500 hover:bg-orange-50 hover:text-[#ff8c66]'
                    }`}
                    title={subject}
                  >
                    {subject}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto">
          {schoolsLoading ? (
            <div className="flex justify-center p-8">
              <Loader2 className="w-6 h-6 text-gray-300 animate-spin" />
            </div>
          ) : listError ? (
            <div className="p-6 text-center text-[12px] text-red-500">{listError}</div>
          ) : schools.length === 0 ? (
            <div className="p-6 text-center text-[12px] text-gray-400">Žádné školy</div>
          ) : (
            schools.map((school) => (
              <button
                key={`${school.ico}-${school.orgId ?? 'no-org'}`}
                onClick={() => setSelectedSchool(school)}
                className={`w-full border-b border-gray-50 px-4 py-3 text-left transition-all ${
                  selectedSchool?.ico === school.ico ? 'bg-[#001161]' : 'hover:bg-gray-50'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`mt-0.5 rounded-xl p-2 ${selectedSchool?.ico === school.ico ? 'bg-white/10' : 'bg-[#001161]/5'}`}>
                    <School className={`w-4 h-4 ${selectedSchool?.ico === school.ico ? 'text-white' : 'text-[#001161]/55'}`} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className={`truncate text-[13px] font-semibold ${selectedSchool?.ico === school.ico ? 'text-white' : 'text-[#001161]'}`}>
                        {school.name}
                      </p>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${selectedSchool?.ico === school.ico ? 'bg-white/15 text-white' : statusStyles(school.status)}`}>
                        {school.status === 'active_subscription' ? 'aktivní' : school.status === 'in_progress' ? 'open deal' : school.status === 'past_request' ? 'historie' : school.status === 'known' ? 'známá' : 'nová'}
                      </span>
                    </div>
                    <p className={`text-[11px] mt-1 ${selectedSchool?.ico === school.ico ? 'text-blue-100/80' : 'text-gray-400'}`}>
                      IČO: {school.ico}
                      {school.kraj ? ` · ${school.kraj}` : ''}
                    </p>
                    <div className="flex items-center gap-3 mt-2 flex-wrap">
                      <span className={`text-[10px] ${selectedSchool?.ico === school.ico ? 'text-white/70' : 'text-[#001161]/45'}`}>
                        won {school.wonDeals}
                      </span>
                      <span className={`text-[10px] ${selectedSchool?.ico === school.ico ? 'text-white/70' : 'text-[#001161]/45'}`}>
                        open {school.openDeals}
                      </span>
                      {school.ownerName && (
                        <span className={`text-[10px] truncate max-w-[140px] ${selectedSchool?.ico === school.ico ? 'text-white/70' : 'text-[#001161]/45'}`}>
                          owner: {school.ownerName}
                        </span>
                      )}
                    </div>
                    {school.products.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {school.products.slice(0, 2).map((product) => (
                          <span
                            key={product}
                            className={`text-[10px] px-2 py-0.5 rounded-full ${
                              selectedSchool?.ico === school.ico
                                ? 'bg-white/10 text-white/90'
                                : 'bg-gray-100 text-gray-500'
                            }`}
                          >
                            {product}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <ChevronRight className={`w-4 h-4 shrink-0 ${selectedSchool?.ico === school.ico ? 'text-white/40' : 'text-gray-300'}`} />
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      <div className="flex-1 min-w-0 min-h-0 bg-[#f7f8fc] overflow-y-auto">
        {!selectedSchool ? (
          <EmptySelection />
        ) : (
          <div className="min-h-full flex flex-col">
            <div className="shrink-0 p-6 pb-4 space-y-4 border-b border-[#001161]/6">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <h2 style={FF} className="text-[28px] font-bold text-[#001161] leading-tight">
                    {detail?.school.name || selectedSchool.name}
                  </h2>
                  <p style={FF} className="text-[13px] text-[#001161]/45 mt-1">
                    IČO: {detail?.school.ico || selectedSchool.ico}
                    {(detail?.school.address || selectedSchool.address) ? ` · ${detail?.school.address || selectedSchool.address}` : ''}
                  </p>
                </div>
                {detail?.owner && (
                  <div className="rounded-2xl bg-white border border-[#001161]/8 px-4 py-3 min-w-[220px]">
                    <p style={FF} className="text-[11px] uppercase tracking-wide text-[#001161]/35 font-bold">Deal owner</p>
                    <div className="mt-2 flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-[#001161]/8 overflow-hidden flex items-center justify-center shrink-0">
                        {(ownerContact?.photo || detail.owner.photoUrl) ? (
                          <img
                            src={ownerContact?.photo || detail.owner.photoUrl}
                            alt={detail.owner.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <User className="w-5 h-5 text-[#001161]/45" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p style={FF} className="text-[13px] font-bold text-[#001161] truncate">{detail.owner.name}</p>
                        {detail.owner.email && (
                          <p style={FF} className="text-[11px] text-[#001161]/45 truncate">{detail.owner.email}</p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                <div className="rounded-2xl bg-white border border-[#001161]/8 p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <ShoppingBag className="w-4 h-4 text-[#001161]/45" />
                    <p style={FF} className="text-[12px] font-bold text-[#001161]">Objednávky z e-shopu</p>
                  </div>
                  <div className="flex items-end gap-6">
                    <div>
                      <p style={FF} className="text-[24px] font-bold text-[#001161]">{detail?.orderSummary.orderCount ?? 0}</p>
                      <p style={FF} className="text-[11px] text-[#001161]/40">objednávek</p>
                    </div>
                    <div>
                      <p style={FF} className="text-[24px] font-bold text-[#001161]">
                        {formatCurrency(detail?.orderSummary.totalRevenue ?? 0)}
                      </p>
                      <p style={FF} className="text-[11px] text-[#001161]/40">celkový obrat</p>
                    </div>
                  </div>
                  {detail?.orderSummary.recentOrders?.length ? (
                    <div className="mt-4 space-y-2">
                      {detail.orderSummary.recentOrders.slice(0, 3).map((order) => (
                        <div key={order.id} className="rounded-xl bg-[#f7f8fc] px-3 py-2">
                          <p style={FF} className="text-[12px] font-bold text-[#001161]">
                            {order.orderNumber} · {order.status}
                          </p>
                          <p style={FF} className="text-[11px] text-[#001161]/45 mt-0.5">
                            {new Date(order.createdAt).toLocaleDateString('cs-CZ')} · {formatCurrency(order.total)}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p style={FF} className="text-[12px] text-[#001161]/35 mt-3">Zatím bez e-shop objednávek.</p>
                  )}
                </div>

                <div className="rounded-2xl bg-white border border-[#001161]/8 p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Package className="w-4 h-4 text-[#001161]/45" />
                    <p style={FF} className="text-[12px] font-bold text-[#001161]">Produkty a licence</p>
                  </div>
                  {summaryProductNames.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {summaryProductNames.slice(0, 10).map((product) => (
                          <span key={product} className="text-[10px] px-2 py-1 rounded-full bg-[#001161]/6 text-[#001161]/70">
                            {product}
                          </span>
                      ))}
                    </div>
                  ) : (
                    <p style={FF} className="text-[12px] text-[#001161]/35">Bez dohledaných produktů.</p>
                  )}
                  {detail?.orderSummary.digitalLicenses?.length ? (
                    <div className="mt-4">
                      <p style={FF} className="text-[11px] uppercase tracking-wide text-[#001161]/35 font-bold mb-2">
                        Digitální licence
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {detail.orderSummary.digitalLicenses.map((license) => (
                          <span key={license} className="text-[10px] px-2 py-1 rounded-full bg-[#7C3AED]/8 text-[#7C3AED]">
                            {license}
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>

                <div className="rounded-2xl bg-white border border-[#001161]/8 p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Building2 className="w-4 h-4 text-[#001161]/45" />
                    <p style={FF} className="text-[12px] font-bold text-[#001161]">CRM souhrn</p>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="rounded-xl bg-[#f7f8fc] p-3">
                      <p style={FF} className="text-[18px] font-bold text-[#001161]">{detail?.deals.length ?? 0}</p>
                      <p style={FF} className="text-[11px] text-[#001161]/40">dealů</p>
                    </div>
                    <div className="rounded-xl bg-[#f7f8fc] p-3">
                      <p style={FF} className="text-[18px] font-bold text-[#001161]">{detail?.persons.length ?? 0}</p>
                      <p style={FF} className="text-[11px] text-[#001161]/40">kontaktů</p>
                    </div>
                    <div className="rounded-xl bg-[#f7f8fc] p-3">
                      <p style={FF} className="text-[18px] font-bold text-[#001161]">{detail?.activities.length ?? 0}</p>
                      <p style={FF} className="text-[11px] text-[#001161]/40">aktivit</p>
                    </div>
                  </div>
                  {detailError ? (
                    <p style={FF} className="text-[12px] text-red-500 mt-3">{detailError}</p>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="p-6 pt-4">
              <div className="overflow-hidden rounded-2xl border border-black/5 shadow-sm">
                <AdminSchoolDetailBody
                  detail={detail}
                  loading={detailLoading}
                  onClose={() => setSelectedSchool(null)}
                  fallbackName={selectedOrganization?.name || selectedSchool.name}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default AdminSchoolsPage;
