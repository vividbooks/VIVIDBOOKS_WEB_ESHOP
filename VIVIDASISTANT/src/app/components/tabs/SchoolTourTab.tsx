import React, {
  memo,
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Bus,
  Loader2,
  RefreshCw,
  Database,
  List,
  Map as MapIcon,
  Building2,
  Eye,
  EyeOff,
  ExternalLink,
  Search,
} from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { toast } from 'sonner';
import { useVirtualizer } from '@tanstack/react-virtual';
import { projectId, publicAnonKey } from '/utils/supabase/info';
import { SchoolDetailPanel } from '../ui/SchoolDetailPanel';
import { isSchoolWithinKmOfPrague, SCHOOL_TOUR_RADIUS_KM } from '../../utils/schoolTourRegion';
import {
  TOUR_CATEGORY_COLORS,
  TOUR_CATEGORY_LABELS,
  TOUR_FLAG_LABELS,
  SCHOOL_TOUR_LOCAL_STORAGE_LEGACY,
  emptySchoolTourFlags,
  getPrimaryTourCategory,
  loadAllTourFlags,
  type SchoolTourFlags,
  type TourPrimaryCategory,
} from '../../utils/schoolTourState';
import {
  fetchSchoolTourFlagsRemote,
  mergeSchoolTourFlagsRemote,
  persistSchoolTourOrgRemote,
} from '../../utils/schoolTourRemote';

const FN_AUTH_JSON: HeadersInit = {
  Authorization: `Bearer ${publicAnonKey}`,
  apikey: publicAnonKey,
  'Content-Type': 'application/json',
};
const FN_AUTH: HeadersInit = { Authorization: `Bearer ${publicAnonKey}`, apikey: publicAnonKey };

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

function makeCategoryIcon(color: string): L.DivIcon {
  const size = 14;
  return new L.DivIcon({
    className: 'custom-div-icon',
    html: `<div style="background-color: ${color}; width: ${size}px; height: ${size}px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 4px rgba(0,0,0,0.35);"></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
  });
}

const iconByCategory: Record<TourPrimaryCategory, L.DivIcon> = {
  vitekVisited: makeCategoryIcon(TOUR_CATEGORY_COLORS.vitekVisited),
  ivetaVisited: makeCategoryIcon(TOUR_CATEGORY_COLORS.ivetaVisited),
  danVisited: makeCategoryIcon(TOUR_CATEGORY_COLORS.danVisited),
  vitekPlanned: makeCategoryIcon(TOUR_CATEGORY_COLORS.vitekPlanned),
  ivetaPlanned: makeCategoryIcon(TOUR_CATEGORY_COLORS.ivetaPlanned),
  danPlanned: makeCategoryIcon(TOUR_CATEGORY_COLORS.danPlanned),
  none: makeCategoryIcon(TOUR_CATEGORY_COLORS.none),
};

interface CachedSchool {
  id: number;
  name: string;
  address: string | null;
  lat: number;
  lng: number;
  isActive: boolean;
  isOpen?: boolean;
}

/**
 * Jednorázové přiblížení po prvním vykreslení značek — další změny (checkboxy, filtry) už zoom nemění.
 */
const FitBounds: React.FC<{ schools: CachedSchool[] }> = ({ schools }) => {
  const map = useMap();
  const didFitRef = useRef(false);
  useEffect(() => {
    if (schools.length === 0) return;
    if (didFitRef.current) return;
    didFitRef.current = true;
    const bounds = L.latLngBounds(schools.map((s) => [s.lat, s.lng] as [number, number]));
    map.fitBounds(bounds, { padding: [48, 48] });
  }, [schools, map]);
  return null;
};

const defaultVisibleCategories: Record<TourPrimaryCategory, boolean> = {
  vitekVisited: true,
  ivetaVisited: true,
  danVisited: true,
  vitekPlanned: true,
  ivetaPlanned: true,
  danPlanned: true,
  none: true,
};

/** Porovnání bez ohledu na diakritiku (uživatel může psát „skola“ / „škola“). */
function foldCs(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function schoolNameMatchesSearch(name: string, query: string): boolean {
  const q = query.trim();
  if (!q) return true;
  return foldCs(name).includes(foldCs(q));
}

function flagsEqual(a: SchoolTourFlags, b: SchoolTourFlags): boolean {
  return (
    a.vitekVisited === b.vitekVisited &&
    a.vitekPlanned === b.vitekPlanned &&
    a.ivetaVisited === b.ivetaVisited &&
    a.ivetaPlanned === b.ivetaPlanned &&
    a.danVisited === b.danVisited &&
    a.danPlanned === b.danPlanned
  );
}

type TourRowProps = {
  school: CachedSchool;
  flags: SchoolTourFlags;
  primary: TourPrimaryCategory;
  onToggleFlag: (id: number, patch: Partial<SchoolTourFlags>) => void;
  onOpenDetail: (school: CachedSchool) => void;
};

const SchoolTourListRow = memo(
  function SchoolTourListRow({ school, flags, primary, onToggleFlag, onOpenDetail }: TourRowProps) {
    return (
      <div className="p-4 md:grid md:grid-cols-[minmax(0,1fr)_auto] md:gap-4 md:items-start border-b border-white/10">
        <div className="min-w-0">
          <div className="flex items-start gap-2 flex-wrap">
            <span
              className="inline-block w-2 h-2 rounded-full mt-1.5 shrink-0"
              style={{ backgroundColor: TOUR_CATEGORY_COLORS[primary] }}
              title={TOUR_CATEGORY_LABELS[primary]}
            />
            <div>
              <div className="font-semibold text-white">{school.name}</div>
              {school.address ? (
                <div className="text-xs text-[#8E8E93] mt-0.5">{school.address}</div>
              ) : null}
            </div>
          </div>
          <div className="mt-3 flex flex-nowrap items-center gap-x-3 gap-y-0 overflow-x-auto pb-1 min-w-0 scrollbar-hide [-webkit-overflow-scrolling:touch]">
            {TOUR_FLAG_LABELS.map(({ key, label }) => (
              <label
                key={key}
                className="flex shrink-0 items-center gap-2 text-sm text-white/90 cursor-pointer select-none whitespace-nowrap"
              >
                <input
                  type="checkbox"
                  checked={flags[key]}
                  onChange={(e) => onToggleFlag(school.id, { [key]: e.target.checked })}
                  className="rounded border-white/30 bg-[#2C2C2E] text-[#0A84FF] focus:ring-[#0A84FF]"
                />
                {label}
              </label>
            ))}
          </div>
        </div>
        <div className="mt-3 md:mt-0 flex md:flex-col md:items-end shrink-0">
          <button
            type="button"
            onClick={() => void onOpenDetail(school)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#0A84FF] hover:bg-[#0077ED] text-white text-sm font-medium w-full md:w-auto justify-center"
          >
            <ExternalLink size={16} />
            CRM detail
          </button>
        </div>
      </div>
    );
  },
  (prev, next) =>
    prev.school.id === next.school.id &&
    prev.primary === next.primary &&
    flagsEqual(prev.flags, next.flags) &&
    prev.school.name === next.school.name &&
    prev.school.address === next.school.address,
);

type TourMarkerProps = {
  school: CachedSchool;
  primary: TourPrimaryCategory;
  onOpen: (school: CachedSchool) => void;
};

const SchoolTourMarker = memo(
  function SchoolTourMarker({ school, primary, onOpen }: TourMarkerProps) {
    const handlers = useMemo(
      () => ({
        click: () => {
          void onOpen(school);
        },
      }),
      [school, onOpen],
    );
    return (
      <Marker
        position={[school.lat, school.lng]}
        icon={iconByCategory[primary]}
        eventHandlers={handlers}
      >
        <Popup className="school-popup">
          <div className="min-w-[200px] p-1">
            <h3 className="font-bold text-base text-gray-900 mb-1">{school.name}</h3>
            <p className="text-xs mb-2" style={{ color: TOUR_CATEGORY_COLORS[primary] }}>
              {TOUR_CATEGORY_LABELS[primary]}
            </p>
            <button
              type="button"
              onClick={() => void onOpen(school)}
              className="w-full py-2 bg-[#0A84FF] text-white rounded text-sm font-medium"
            >
              Otevřít CRM detail
            </button>
          </div>
        </Popup>
      </Marker>
    );
  },
  (prev, next) =>
    prev.school.id === next.school.id &&
    prev.primary === next.primary &&
    prev.school.lat === next.school.lat &&
    prev.school.lng === next.school.lng &&
    prev.school.name === next.school.name,
);

export const SchoolTourTab: React.FC = () => {
  const [schools, setSchools] = useState<CachedSchool[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isBuilding, setIsBuilding] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [innerTab, setInnerTab] = useState<'list' | 'map'>('list');
  const [flagsBySchoolId, setFlagsBySchoolId] = useState<Record<number, SchoolTourFlags>>({});
  const [visibleCategories, setVisibleCategories] =
    useState<Record<TourPrimaryCategory, boolean>>(defaultVisibleCategories);
  const [nameSearch, setNameSearch] = useState('');
  /** Odlehčí filtrování při psaní do vyhledávání (velké seznamy). */
  const deferredNameSearch = useDeferredValue(nameSearch);

  const [selectedSchool, setSelectedSchool] = useState<CachedSchool | null>(null);
  const [schoolDetail, setSchoolDetail] = useState<any | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [showDetailPanel, setShowDetailPanel] = useState(false);

  const mapRef = useRef<L.Map | null>(null);
  const listScrollParentRef = useRef<HTMLDivElement | null>(null);

  const regionalSchools = useMemo(
    () => schools.filter((s) => isSchoolWithinKmOfPrague(s.lat, s.lng)),
    [schools],
  );

  const regionalSchoolsByName = useMemo(
    () => regionalSchools.filter((s) => schoolNameMatchesSearch(s.name, deferredNameSearch)),
    [regionalSchools, deferredNameSearch],
  );

  const updateFlags = useCallback((id: number, patch: Partial<SchoolTourFlags>) => {
    setFlagsBySchoolId((prev) => {
      const cur = prev[id] ?? emptySchoolTourFlags();
      const merged = { ...cur, ...patch };
      const next = { ...prev, [id]: merged };
      void persistSchoolTourOrgRemote(id, merged).catch((err) => {
        console.error(err);
        toast.error('Nepodařilo se uložit stav do databáze. Zkus to znovu.');
      });
      return next;
    });
  }, []);

  const fetchFromCache = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-954b19ad/crm/school-locations`,
        { headers: FN_AUTH },
      );
      if (!response.ok) throw new Error('Failed to fetch cache');
      const data = await response.json();
      setSchools(data.schools || []);
      setLastUpdated(data.updatedAt || null);
      if (data.schools?.length > 0) {
        toast.success(`Načteno ${data.schools.length} škol z cache`);
      } else {
        toast.info('Cache je prázdná. Klikni na „Synchronizovat vše“ v Mapě škol nebo zde.');
      }
    } catch (e: any) {
      console.error(e);
      toast.error('Chyba při načítání cache');
    } finally {
      setIsLoading(false);
    }
  };

  const buildCache = async () => {
    setIsBuilding(true);
    toast.info('Spouštím synchronizaci škol…');
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-954b19ad/crm/build-school-cache`,
        { method: 'POST', headers: FN_AUTH_JSON },
      );
      if (!response.ok) throw new Error('Failed to build cache');
      const data = await response.json();
      setSchools(data.schools || []);
      setLastUpdated(data.updatedAt || null);
      toast.success(`Cache aktualizována (${data.schools?.length || 0} škol).`);
    } catch (e: any) {
      console.error(e);
      toast.error('Chyba při synchronizaci: ' + (e?.message || ''));
    } finally {
      setIsBuilding(false);
    }
  };

  const fetchSchoolDetail = useCallback(async (school: CachedSchool) => {
    setSelectedSchool(school);
    setSchoolDetail(null);
    setLoadingDetail(true);
    setShowDetailPanel(true);
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-954b19ad/crm/org-detail`,
        { method: 'POST', headers: FN_AUTH_JSON, body: JSON.stringify({ orgId: school.id }) },
      );
      if (!response.ok) throw new Error('Failed to fetch detail');
      const data = await response.json();
      setSchoolDetail(data);
    } catch (e: any) {
      console.error(e);
      toast.error('Chyba při načítání detailu');
    } finally {
      setLoadingDetail(false);
    }
  }, []);

  useEffect(() => {
    void fetchFromCache();
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        let { flags } = await fetchSchoolTourFlagsRemote();
        if (cancelled) return;
        if (Object.keys(flags).length === 0) {
          const local = loadAllTourFlags();
          if (Object.keys(local).length > 0) {
            await mergeSchoolTourFlagsRemote(local);
            try {
              localStorage.removeItem(SCHOOL_TOUR_LOCAL_STORAGE_LEGACY);
            } catch {
              /* ignore */
            }
            const again = await fetchSchoolTourFlagsRemote();
            flags = again.flags;
          }
        }
        if (!cancelled) setFlagsBySchoolId(flags);
      } catch (e) {
        console.error(e);
        toast.error('Stavy objíždění se nepodařilo načíst z databáze, používám lokální zálohu.');
        if (!cancelled) setFlagsBySchoolId(loadAllTourFlags());
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const schoolsWithMeta = useMemo(() => {
    return regionalSchoolsByName.map((s) => {
      const flags = flagsBySchoolId[s.id] ?? emptySchoolTourFlags();
      const primary = getPrimaryTourCategory(flags);
      return { school: s, flags, primary };
    });
  }, [regionalSchoolsByName, flagsBySchoolId]);

  const filteredForDisplay = useMemo(() => {
    return schoolsWithMeta.filter((row) => visibleCategories[row.primary]);
  }, [schoolsWithMeta, visibleCategories]);

  const listVirtualCount =
    innerTab === 'list' &&
    !isLoading &&
    !isBuilding &&
    regionalSchools.length > 0 &&
    filteredForDisplay.length > 0
      ? filteredForDisplay.length
      : 0;

  const listRowVirtualizer = useVirtualizer({
    count: listVirtualCount,
    getScrollElement: () => listScrollParentRef.current,
    estimateSize: () => 168,
    overscan: 14,
  });

  /** Stabilní reference — aby FitBounds nespouštěl fit při každém překreslení (klik na školu, panel). */
  const schoolsForMapBounds = useMemo(
    () => filteredForDisplay.map((r) => r.school),
    [filteredForDisplay],
  );

  const countsByCategory = useMemo(() => {
    const c: Record<TourPrimaryCategory, number> = {
      vitekVisited: 0,
      ivetaVisited: 0,
      danVisited: 0,
      vitekPlanned: 0,
      ivetaPlanned: 0,
      danPlanned: 0,
      none: 0,
    };
    for (const row of schoolsWithMeta) {
      c[row.primary]++;
    }
    return c;
  }, [schoolsWithMeta]);

  const toggleCategory = useCallback((cat: TourPrimaryCategory) => {
    setVisibleCategories((prev) => ({ ...prev, [cat]: !prev[cat] }));
  }, []);

  const defaultCenter: [number, number] = [49.95, 14.45];
  const defaultZoom = 9;

  const filterRow = useMemo(
    () => (
      <div className="flex flex-wrap gap-2 mt-3">
        {(Object.keys(TOUR_CATEGORY_LABELS) as TourPrimaryCategory[]).map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => toggleCategory(cat)}
            className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all border ${
              visibleCategories[cat]
                ? 'border-white/20 bg-white/10'
                : 'border-transparent bg-white/5 opacity-50'
            }`}
          >
            <span
              className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
              style={{ backgroundColor: TOUR_CATEGORY_COLORS[cat] }}
            />
            <span className="text-white/90">{TOUR_CATEGORY_LABELS[cat]}</span>
            <span className="text-[#8E8E93]">({countsByCategory[cat]})</span>
            {visibleCategories[cat] ? (
              <Eye size={12} className="text-emerald-400" />
            ) : (
              <EyeOff size={12} className="text-gray-500" />
            )}
          </button>
        ))}
      </div>
    ),
    [countsByCategory, toggleCategory, visibleCategories],
  );

  const mapSelectedFlags = selectedSchool
    ? flagsBySchoolId[selectedSchool.id] ?? emptySchoolTourFlags()
    : null;

  const mapMarkToolbar =
    innerTab === 'map' && selectedSchool && mapSelectedFlags ? (
      <div className="mt-3 rounded-xl border border-white/10 bg-[#2C2C2E]/60 p-3">
        <p className="text-sm font-semibold text-white">Označit</p>
        <p className="text-xs text-[#8E8E93] mt-0.5 mb-2 truncate" title={selectedSchool.name}>
          {selectedSchool.name}
        </p>
        <div className="flex flex-nowrap items-center gap-x-3 gap-y-0 overflow-x-auto pb-1 min-w-0 scrollbar-hide [-webkit-overflow-scrolling:touch]">
          {TOUR_FLAG_LABELS.map(({ key, label }) => (
            <label
              key={key}
              className="flex shrink-0 items-center gap-2 text-sm text-white/90 cursor-pointer select-none whitespace-nowrap"
            >
              <input
                type="checkbox"
                checked={mapSelectedFlags[key]}
                onChange={(e) => updateFlags(selectedSchool.id, { [key]: e.target.checked })}
                className="rounded border-white/30 bg-[#2C2C2E] text-[#0A84FF] focus:ring-[#0A84FF]"
              />
              {label}
            </label>
          ))}
        </div>
      </div>
    ) : null;

  return (
    <div className="w-full h-full flex flex-col md:flex-row bg-black overflow-hidden relative min-h-0">
      <div
        className={`flex flex-col h-full min-w-0 overflow-hidden ${
          selectedSchool && showDetailPanel ? 'flex-1' : 'w-full flex-1'
        }`}
      >
        <div className="shrink-0 p-4 border-b border-white/10 bg-[#1C1C1E]">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl flex items-center justify-center shadow-lg shadow-orange-500/20">
                <Bus size={24} className="text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">Objíždění škol</h1>
                <p className="text-[#8E8E93] text-sm">
                  Ivet, Dan, Vítek — školy do {SCHOOL_TOUR_RADIUS_KM} km od centra Prahy
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setInnerTab('list')}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-colors ${
                  innerTab === 'list' ? 'bg-[#0A84FF] text-white' : 'bg-[#2C2C2E] text-[#8E8E93] hover:bg-[#3C3C3E]'
                }`}
              >
                <List size={18} />
                Seznam
              </button>
              <button
                type="button"
                onClick={() => setInnerTab('map')}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-colors ${
                  innerTab === 'map' ? 'bg-[#0A84FF] text-white' : 'bg-[#2C2C2E] text-[#8E8E93] hover:bg-[#3C3C3E]'
                }`}
              >
                <MapIcon size={18} />
                Mapa
              </button>
              <button
                type="button"
                onClick={() => void fetchFromCache()}
                disabled={isLoading || isBuilding}
                className="p-2.5 bg-[#2C2C2E] hover:bg-[#3C3C3E] rounded-xl transition-colors disabled:opacity-50"
                title="Obnovit z cache"
              >
                <RefreshCw size={20} className={`text-white ${isLoading ? 'animate-spin' : ''}`} />
              </button>
              <button
                type="button"
                onClick={() => void buildCache()}
                disabled={isLoading || isBuilding}
                className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-colors disabled:opacity-50 flex items-center gap-2"
                title="Synchronizovat školy z Pipedrive"
              >
                <Database size={18} className={`text-white ${isBuilding ? 'animate-pulse' : ''}`} />
                <span className="text-white text-sm font-medium hidden sm:inline">
                  {isBuilding ? 'Synchronizuji…' : 'Synchronizovat'}
                </span>
              </button>
            </div>
          </div>

          {!isLoading && (
            <p className="text-[#8E8E93] text-sm mt-2">
              {nameSearch.trim()
                ? `${regionalSchoolsByName.length} z ${regionalSchools.length} škol (název)`
                : `${regionalSchools.length} škol do ${SCHOOL_TOUR_RADIUS_KM} km od Prahy (z ${schools.length} v cache)`}
              {lastUpdated ? (
                <span className="ml-2">· Aktualizace cache: {new Date(lastUpdated).toLocaleString('cs-CZ')}</span>
              ) : null}
            </p>
          )}

          {!isLoading && regionalSchools.length > 0 ? (
            <div className="relative mt-3">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8E8E93]"
                aria-hidden
              />
              <input
                type="search"
                value={nameSearch}
                onChange={(e) => setNameSearch(e.target.value)}
                placeholder="Hledat podle názvu školy…"
                autoComplete="off"
                className="w-full rounded-xl border border-white/10 bg-[#2C2C2E] py-2.5 pl-10 pr-3 text-sm text-white placeholder:text-[#8E8E93] outline-none focus:border-[#0A84FF]/60 focus:ring-1 focus:ring-[#0A84FF]/40"
              />
            </div>
          ) : null}

          {!isLoading && regionalSchools.length > 0
            ? innerTab === 'map' && selectedSchool
              ? mapMarkToolbar
              : filterRow
            : null}
        </div>

        <div className="flex-1 relative min-h-0">
          {isLoading ? (
            <div className="absolute inset-0 flex items-center justify-center bg-[#1C1C1E]">
              <div className="flex flex-col items-center gap-4">
                <Loader2 size={48} className="animate-spin text-amber-500" />
                <p className="text-[#8E8E93]">Načítám školy…</p>
              </div>
            </div>
          ) : isBuilding ? (
            <div className="absolute inset-0 flex items-center justify-center bg-[#1C1C1E] z-10">
              <div className="flex flex-col items-center gap-4">
                <Database size={48} className="animate-pulse text-emerald-500" />
                <p className="text-white font-medium">Synchronizuji školy…</p>
              </div>
            </div>
          ) : regionalSchools.length === 0 ? (
            <div className="absolute inset-0 flex items-center justify-center bg-[#1C1C1E]">
              <div className="flex flex-col items-center gap-4 text-center px-8">
                <Building2 size={64} className="text-[#3C3C3E]" />
                <p className="text-white font-medium">Žádné školy v okruhu {SCHOOL_TOUR_RADIUS_KM} km od Prahy</p>
                <p className="text-[#8E8E93] text-sm max-w-md">
                  Zkontroluj souřadnice v cache (geokódování) nebo spusť synchronizaci škol z Pipedrive.
                </p>
              </div>
            </div>
          ) : filteredForDisplay.length === 0 ? (
            <div className="absolute inset-0 flex items-center justify-center bg-[#1C1C1E] px-8">
              <p className="text-center text-[#8E8E93] text-sm max-w-md">
                {regionalSchoolsByName.length === 0 && nameSearch.trim()
                  ? 'Žádná škola neodpovídá vyhledávání podle názvu. Zkus jiný výraz nebo ho smaž.'
                  : 'Žádná škola neodpovídá vybraným filtrům (barevné značky nahoře). Zapni alespoň jednu kategorii.'}
              </p>
            </div>
          ) : innerTab === 'list' ? (
            <div
              ref={listScrollParentRef}
              className="absolute inset-0 overflow-y-auto overflow-x-hidden scrollbar-hide"
            >
              <div
                className="relative w-full"
                style={{ height: listRowVirtualizer.getTotalSize() }}
              >
                {listRowVirtualizer.getVirtualItems().map((virtualRow) => {
                  const { school, flags, primary } = filteredForDisplay[virtualRow.index];
                  return (
                    <div
                      key={virtualRow.key}
                      data-index={virtualRow.index}
                      ref={listRowVirtualizer.measureElement}
                      className="absolute left-0 top-0 w-full"
                      style={{ transform: `translateY(${virtualRow.start}px)` }}
                    >
                      <SchoolTourListRow
                        school={school}
                        flags={flags}
                        primary={primary}
                        onToggleFlag={updateFlags}
                        onOpenDetail={fetchSchoolDetail}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <MapContainer
              center={defaultCenter}
              zoom={defaultZoom}
              className="w-full h-full"
              ref={mapRef}
              style={{ background: '#cfd8dc' }}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> · <a href="https://carto.com/attributions">CARTO</a>'
                url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
              />
              <FitBounds schools={schoolsForMapBounds} />
              {filteredForDisplay.map(({ school, primary }) => (
                <SchoolTourMarker
                  key={school.id}
                  school={school}
                  primary={primary}
                  onOpen={fetchSchoolDetail}
                />
              ))}
            </MapContainer>
          )}
        </div>
      </div>

      {selectedSchool && showDetailPanel && (
        <div
          className={
            'assistant-detail-rail h-full min-h-0 flex flex-col border-white/10 bg-[#1C1C1E] ' +
            'max-md:fixed max-md:inset-0 max-md:z-[1000] max-md:!w-full max-md:!max-w-none max-md:flex-none max-md:border-0 ' +
            'md:relative md:z-auto md:inset-auto md:border-l'
          }
        >
          <SchoolDetailPanel
            organization={{
              id: selectedSchool.id,
              name: selectedSchool.name,
              address: schoolDetail?.organization?.address || selectedSchool.address,
            }}
            detail={schoolDetail}
            loading={loadingDetail}
            onClose={() => {
              setSelectedSchool(null);
              setSchoolDetail(null);
              setShowDetailPanel(false);
            }}
          />
        </div>
      )}
    </div>
  );
};
