import React, { useState, useEffect, useRef, useMemo } from 'react';
import { MapPin, School, Loader2, RefreshCw, Building2, Database, Eye, EyeOff } from 'lucide-react';
import { SchoolDetailPanel } from '../ui/SchoolDetailPanel';
import { toast } from 'sonner';
import { projectId } from '/utils/supabase/info';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix Leaflet default marker icon issue
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

// Simple Circle Icons
const activeCircleIcon = new L.DivIcon({
  className: 'custom-div-icon',
  html: `<div style="background-color: #10B981; width: 12px; height: 12px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 4px rgba(0,0,0,0.3);"></div>`,
  iconSize: [12, 12],
  iconAnchor: [6, 6],
  popupAnchor: [0, -6],
});

const openCircleIcon = new L.DivIcon({
  className: 'custom-div-icon',
  html: `<div style="background-color: #3B82F6; width: 12px; height: 12px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 4px rgba(0,0,0,0.3);"></div>`,
  iconSize: [12, 12],
  iconAnchor: [6, 6],
  popupAnchor: [0, -6],
});

const inactiveCircleIcon = new L.DivIcon({
  className: 'custom-div-icon',
  html: `<div style="background-color: #6B7280; width: 8px; height: 8px; border-radius: 50%; border: 1px solid white; opacity: 0.8;"></div>`,
  iconSize: [8, 8],
  iconAnchor: [4, 4],
  popupAnchor: [0, -4],
});

interface CachedSchool {
  id: number;
  name: string;
  address: string | null;
  lat: number;
  lng: number;
  isActive: boolean;
  isOpen?: boolean;
}

// Component to fit map to markers
const FitBounds: React.FC<{ schools: CachedSchool[] }> = ({ schools }) => {
  const map = useMap();
  
  useEffect(() => {
    if (schools.length > 0) {
      const bounds = L.latLngBounds(
        schools.map(s => [s.lat, s.lng] as [number, number])
      );
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [schools, map]);
  
  return null;
};

export const MapTab: React.FC = () => {
  const [schools, setSchools] = useState<CachedSchool[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isBuilding, setIsBuilding] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [selectedSchool, setSelectedSchool] = useState<CachedSchool | null>(null);
  const [schoolDetail, setSchoolDetail] = useState<any | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [showDetailPanel, setShowDetailPanel] = useState(false);
  const [visibleCategories, setVisibleCategories] = useState({
    active: true,
    open: true,
    potential: true
  });
  
  const mapRef = useRef<L.Map | null>(null);

  // Fetch cached school locations (fast)
  const fetchFromCache = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-954b19ad/crm/school-locations`
      );
      
      if (!response.ok) throw new Error('Failed to fetch cache');
      
      const data = await response.json();
      setSchools(data.schools || []);
      setLastUpdated(data.updatedAt || null);
      
      if (data.schools?.length > 0) {
        toast.success(`Načteno ${data.schools.length} škol z cache`);
      } else {
        toast.info('Cache je prázdná. Klikni na "Aktualizovat cache" pro načtení škol.');
      }
    } catch (error: any) {
      console.error(error);
      toast.error('Chyba při načítání cache');
    } finally {
      setIsLoading(false);
    }
  };

  // Build cache with Google Maps geocoding
  const buildCache = async () => {
    setIsBuilding(true);
    toast.info('Spouštím geokódování všech škol... Toto může trvat několik minut.');
    
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-954b19ad/crm/build-school-cache`,
        { method: 'POST' }
      );
      
      if (!response.ok) throw new Error('Failed to build cache');
      
      const data = await response.json();
      setSchools(data.schools || []);
      setLastUpdated(data.updatedAt || null);
      
      toast.success(`Cache aktualizována! ${data.schools?.length || 0} škol s lokací.`);
    } catch (error: any) {
      console.error(error);
      toast.error('Chyba při budování cache: ' + error.message);
    } finally {
      setIsBuilding(false);
    }
  };

  // Fetch school detail from Pipedrive when clicking on marker
  const fetchSchoolDetail = async (school: CachedSchool) => {
    setSelectedSchool(school);
    setSchoolDetail(null);
    setLoadingDetail(true);
    setShowDetailPanel(true);
    
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-954b19ad/crm/org-detail`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orgId: school.id })
        }
      );
      
      if (!response.ok) throw new Error('Failed to fetch detail');
      
      const data = await response.json();
      setSchoolDetail(data);
    } catch (error: any) {
      console.error(error);
      toast.error('Chyba při načítání detailu');
    } finally {
      setLoadingDetail(false);
    }
  };

  useEffect(() => {
    fetchFromCache();
  }, []);

  const activeSchools = useMemo(() => schools.filter(s => s.isActive), [schools]);
  const openDealSchools = useMemo(() => schools.filter(s => !s.isActive && s.isOpen), [schools]);
  const inactiveSchools = useMemo(() => schools.filter(s => !s.isActive && !s.isOpen), [schools]);

  const toggleCategory = (cat: keyof typeof visibleCategories) => {
    setVisibleCategories(prev => ({ ...prev, [cat]: !prev[cat] }));
  };

  // Default center: Czech Republic
  const defaultCenter: [number, number] = [49.8175, 15.4730];
  const defaultZoom = 7;

  return (
    <div className="w-full h-full flex flex-col lg:flex-row bg-black overflow-hidden relative">
      {/* Main Map Area */}
      <div className={`flex flex-col h-full flex-1 ${selectedSchool && showDetailPanel ? 'lg:min-w-0' : 'w-full'}`}>
        {/* Header */}
        <div className="shrink-0 p-4 border-b border-white/10 bg-[#1C1C1E]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/20">
                <School size={24} className="text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">Mapa škol</h1>
                <p className="text-[#8E8E93] text-sm">
                  {isLoading ? 'Načítám...' : `${schools.length} škol celkem`}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={fetchFromCache}
                disabled={isLoading || isBuilding}
                className="p-2.5 bg-[#2C2C2E] hover:bg-[#3C3C3E] rounded-xl transition-colors disabled:opacity-50"
                title="Načíst z cache"
              >
                <RefreshCw size={20} className={`text-white ${isLoading ? 'animate-spin' : ''}`} />
              </button>
              <button
                onClick={buildCache}
                disabled={isLoading || isBuilding}
                className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-colors disabled:opacity-50 flex items-center gap-2"
                title="Aktualizovat cache"
              >
                <Database size={18} className={`text-white ${isBuilding ? 'animate-pulse' : ''}`} />
                <span className="text-white text-sm font-medium">
                  {isBuilding ? 'Synchronizuji...' : 'Synchronizovat vše'}
                </span>
              </button>
            </div>
          </div>
          
          {/* Stats & Filters */}
          {!isLoading && schools.length > 0 && (
            <div className="flex flex-wrap gap-3 mt-4">
              <button 
                onClick={() => toggleCategory('active')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all ${
                  visibleCategories.active 
                    ? 'bg-emerald-500/20 border border-emerald-500/30' 
                    : 'bg-white/5 border border-transparent opacity-50'
                }`}
              >
                <div className="w-3 h-3 bg-emerald-500 rounded-full"></div>
                <span className="text-emerald-400 text-sm font-medium">{activeSchools.length} aktivních</span>
                {visibleCategories.active ? <Eye size={14} className="text-emerald-500" /> : <EyeOff size={14} className="text-gray-500" />}
              </button>
              
              <button 
                onClick={() => toggleCategory('open')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all ${
                  visibleCategories.open 
                    ? 'bg-blue-500/20 border border-blue-500/30' 
                    : 'bg-white/5 border border-transparent opacity-50'
                }`}
              >
                <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                <span className="text-blue-400 text-sm font-medium">{openDealSchools.length} rozdělaných</span>
                {visibleCategories.open ? <Eye size={14} className="text-blue-500" /> : <EyeOff size={14} className="text-gray-500" />}
              </button>
              
              <button 
                onClick={() => toggleCategory('potential')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all ${
                  visibleCategories.potential 
                    ? 'bg-gray-500/20 border border-gray-500/30' 
                    : 'bg-white/5 border border-transparent opacity-50'
                }`}
              >
                <div className="w-2 h-2 bg-gray-500 rounded-full"></div>
                <span className="text-gray-400 text-sm font-medium">{inactiveSchools.length} potenciálních</span>
                {visibleCategories.potential ? <Eye size={14} className="text-gray-400" /> : <EyeOff size={14} className="text-gray-500" />}
              </button>
              
              {lastUpdated && (
                <div className="ml-auto flex items-center gap-2 px-3 py-1.5 bg-white/5 rounded-lg">
                  <span className="text-[#8E8E93] text-xs">
                    Aktualizováno: {new Date(lastUpdated).toLocaleString('cs-CZ')}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Map Container */}
        <div className="flex-1 relative">
          {isLoading ? (
            <div className="absolute inset-0 flex items-center justify-center bg-[#1C1C1E]">
              <div className="flex flex-col items-center gap-4">
                <Loader2 size={48} className="animate-spin text-emerald-500" />
                <p className="text-[#8E8E93]">Načítám školy z cache...</p>
              </div>
            </div>
          ) : isBuilding ? (
            <div className="absolute inset-0 flex items-center justify-center bg-[#1C1C1E]">
              <div className="flex flex-col items-center gap-4">
                <Database size={48} className="animate-pulse text-emerald-500" />
                <p className="text-white font-medium">Synchronizuji školy z Pipedrive...</p>
                <p className="text-[#8E8E93] text-sm">Toto může trvat několik minut</p>
              </div>
            </div>
          ) : schools.length === 0 ? (
            <div className="absolute inset-0 flex items-center justify-center bg-[#1C1C1E]">
              <div className="flex flex-col items-center gap-4 text-center px-8">
                <Building2 size={64} className="text-[#3C3C3E]" />
                <p className="text-white font-medium">Cache je prázdná</p>
                <p className="text-[#8E8E93] text-sm max-w-md">
                  Klikni na "Synchronizovat vše" pro načtení všech škol z Pipedrive.
                </p>
              </div>
            </div>
          ) : (
            <MapContainer
              center={defaultCenter}
              zoom={defaultZoom}
              className="w-full h-full"
              ref={mapRef}
              style={{ background: '#1C1C1E' }}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
              />
              
              <FitBounds schools={schools} />
              
              {/* Render inactive schools first (gray) */}
              {visibleCategories.potential && inactiveSchools.map((school) => (
                <Marker
                  key={school.id}
                  position={[school.lat, school.lng]}
                  icon={inactiveCircleIcon}
                  eventHandlers={{
                    click: () => fetchSchoolDetail(school)
                  }}
                >
                  <Popup className="school-popup">
                    <div className="min-w-[200px] p-1">
                      <h3 className="font-bold text-base text-gray-900 mb-1">{school.name}</h3>
                      <p className="text-gray-500 text-xs mb-3">Potenciální zákazník</p>
                      <button
                        onClick={() => fetchSchoolDetail(school)}
                        className="w-full py-2 bg-gray-500 text-white rounded text-sm font-medium hover:bg-gray-600 transition-colors"
                      >
                        Zobrazit detail
                      </button>
                    </div>
                  </Popup>
                </Marker>
              ))}

              {/* Render open deal schools (blue) */}
              {visibleCategories.open && openDealSchools.map((school) => (
                <Marker
                  key={school.id}
                  position={[school.lat, school.lng]}
                  icon={openCircleIcon}
                  eventHandlers={{
                    click: () => fetchSchoolDetail(school)
                  }}
                >
                  <Popup className="school-popup">
                    <div className="min-w-[200px] p-1">
                      <h3 className="font-bold text-base text-gray-900 mb-1">{school.name}</h3>
                      <p className="text-blue-500 text-xs mb-3 font-medium">Rozdělaný deal</p>
                      <button
                        onClick={() => fetchSchoolDetail(school)}
                        className="w-full py-2 bg-blue-500 text-white rounded text-sm font-medium hover:bg-blue-600 transition-colors"
                      >
                        Zobrazit detail
                      </button>
                    </div>
                  </Popup>
                </Marker>
              ))}
              
              {/* Render active schools on top (green) */}
              {visibleCategories.active && activeSchools.map((school) => (
                <Marker
                  key={school.id}
                  position={[school.lat, school.lng]}
                  icon={activeCircleIcon}
                  eventHandlers={{
                    click: () => fetchSchoolDetail(school)
                  }}
                >
                  <Popup className="school-popup">
                    <div className="min-w-[200px] p-1">
                      <h3 className="font-bold text-base text-gray-900 mb-1">{school.name}</h3>
                      <p className="text-emerald-500 text-xs mb-3 font-medium">Aktivní zákazník</p>
                      <button
                        onClick={() => fetchSchoolDetail(school)}
                        className="w-full py-2 bg-emerald-500 text-white rounded text-sm font-medium hover:bg-emerald-600 transition-colors"
                      >
                        Zobrazit detail
                      </button>
                    </div>
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
          )}
        </div>
      </div>
      
      {/* Organization Detail Side Panel */}
      {selectedSchool && showDetailPanel && (
        <div className="fixed inset-0 z-[1000] lg:relative lg:inset-auto lg:z-auto w-full lg:w-[380px] xl:w-[480px] h-full lg:border-l border-white/10 shrink-0 bg-[#1C1C1E]">
          <SchoolDetailPanel
            organization={{
              id: selectedSchool.id,
              name: selectedSchool.name,
              address: schoolDetail?.organization?.address || selectedSchool.address
            }}
            detail={schoolDetail}
            loading={loadingDetail}
            onClose={() => { setSelectedSchool(null); setSchoolDetail(null); setShowDetailPanel(false); }}
          />
        </div>
      )}
    </div>
  );
};
