import { Checkbox } from './ui/checkbox';
import { Label } from './ui/label';
import { image3 as imgImage3, image4 as imgImage4 } from '../imports/Zakoupit_assets/images';

interface SidebarFiltersProps {
  purchaseType: 'individual' | 'school' | null;
  setPurchaseType: (type: 'individual' | 'school' | null) => void;
  selectedCategories: string[];
  toggleCategory: (category: string) => void;
  selectedTypes: string[];
  toggleType: (type: string) => void;
  setSelectedTypes: (types: string[]) => void;
}

export function SidebarFilters({
  purchaseType,
  setPurchaseType,
  selectedCategories,
  toggleCategory,
  selectedTypes,
  toggleType,
  setSelectedTypes
}: SidebarFiltersProps) {
  return (
    <div className="fixed left-0 top-0 h-screen w-[280px] lg:w-[320px] bg-white shadow-lg overflow-y-auto pt-20 pb-8 px-4 space-y-3 z-30">
      {/* Zakoupit pro sebe / Zakoupit pro školu */}
      <div className="space-y-2">
        <button
          onClick={() => setPurchaseType(purchaseType === 'individual' ? null : 'individual')}
          className={`w-full rounded-[19px] p-3 min-h-[80px] transition-all relative flex items-center ${
            purchaseType === 'individual'
              ? 'bg-[#dee4f1]'
              : 'bg-[rgba(222,228,241,0.3)] hover:bg-[rgba(222,228,241,0.5)]'
          }`}
        >
          <div className={`absolute left-0 bottom-0 transition-all duration-300 ${
            purchaseType === 'individual' ? 'w-[85px] h-[85px]' : 'w-[60px] h-[60px]'
          }`}>
            <img 
              alt="Rodiče a domškoláci" 
              className="w-full h-full object-cover" 
              src={imgImage4} 
            />
          </div>
          <div className={`ml-auto mr-3 text-left transition-all ${
            purchaseType === 'individual' ? 'mr-4' : ''
          }`}>
            <p className={`text-[#001161] text-[16px] font-['Fenomen_Sans',sans-serif] font-semibold tracking-[-0.42px] ${
              purchaseType === 'individual' ? 'underline decoration-solid' : ''
            }`}>
              Zakoupit pro sebe
            </p>
            <p className="text-[#001161] text-[11px] font-['Fenomen_Sans',sans-serif] tracking-[-0.22px] mt-0.5">
              Rodiče a domškoláci
            </p>
          </div>
        </button>
        
        <button
          onClick={() => {
            if (purchaseType === 'school') {
              setPurchaseType(null);
            } else {
              setPurchaseType('school');
              setSelectedTypes(['online', 'workbook', 'vividboard']);
            }
          }}
          className={`w-full rounded-[24px] p-3 min-h-[80px] transition-all relative flex items-center ${
            purchaseType === 'school'
              ? 'bg-[#dee4f1]'
              : 'bg-[rgba(222,228,241,0.3)] hover:bg-[rgba(222,228,241,0.5)]'
          }`}
        >
          <div className={`absolute right-0 top-0 transition-all duration-300 ${
            purchaseType === 'school' ? 'w-[75px] h-[75px]' : 'w-[60px] h-[60px]'
          }`}>
            <img 
              alt="Škola" 
              className="w-full h-full object-cover" 
              src={imgImage3} 
            />
          </div>
          <div className={`ml-3 text-left transition-all ${
            purchaseType === 'school' ? 'ml-4' : ''
          }`}>
            <p className={`text-[#001161] text-[16px] font-['Fenomen_Sans',sans-serif] font-semibold tracking-[-0.42px] ${
              purchaseType === 'school' ? 'underline decoration-solid' : ''
            }`}>
              Zakoupit pro školu
            </p>
            <p className="text-[#001161] text-[11px] font-['Fenomen_Sans',sans-serif] tracking-[-0.22px] mt-0.5">
              Učitelé a žáci
            </p>
          </div>
        </button>
      </div>

      {/* Předměty */}
      <div className="bg-[rgba(222,228,241,0.3)] rounded-[24px] p-3">
        <p className="text-[#001161] text-[15px] font-['Fenomen_Sans',sans-serif] font-semibold tracking-[-0.31px] mb-2">
          Předměty
        </p>
        
        {/* 2. stupeň */}
        <div className="mb-2">
          <p className="text-[#001161] text-[13px] font-['Fenomen_Sans',sans-serif] tracking-[-0.24px] mb-1.5">
            2. stupeň
          </p>
          <div className="grid grid-cols-2 gap-1.5">
            <div className="flex items-center gap-1.5 bg-[#dee4f1] px-2 py-1.5 rounded-[8px]">
              <Checkbox
                id="sidebar-subject-2nd-mat"
                checked={selectedCategories.includes('Matematika 2. stupeň')}
                onCheckedChange={() => toggleCategory('Matematika 2. stupeň')}
              />
              <Label
                htmlFor="sidebar-subject-2nd-mat"
                className={`text-[#001161] text-[13px] font-['Fenomen_Sans',sans-serif] tracking-[-0.21px] cursor-pointer leading-tight ${
                  selectedCategories.includes('Matematika 2. stupeň') ? 'underline' : ''
                }`}
              >
                Matematika
              </Label>
            </div>
            
            <div className="flex items-center gap-1.5 bg-[#dee4f1] px-2 py-1.5 rounded-[8px]">
              <Checkbox
                id="sidebar-subject-2nd-fyz"
                checked={selectedCategories.includes('Fyzika')}
                onCheckedChange={() => toggleCategory('Fyzika')}
              />
              <Label
                htmlFor="sidebar-subject-2nd-fyz"
                className={`text-[#001161] text-[13px] font-['Fenomen_Sans',sans-serif] tracking-[-0.21px] cursor-pointer leading-tight ${
                  selectedCategories.includes('Fyzika') ? 'underline' : ''
                }`}
              >
                Fyzika
              </Label>
            </div>
            
            <div className="flex items-center gap-1.5 bg-[#dee4f1] px-2 py-1.5 rounded-[8px]">
              <Checkbox
                id="sidebar-subject-2nd-pri"
                checked={selectedCategories.includes('Přírodopis')}
                onCheckedChange={() => toggleCategory('Přírodopis')}
              />
              <Label
                htmlFor="sidebar-subject-2nd-pri"
                className={`text-[#001161] text-[13px] font-['Fenomen_Sans',sans-serif] tracking-[-0.21px] cursor-pointer leading-tight ${
                  selectedCategories.includes('Přírodopis') ? 'underline' : ''
                }`}
              >
                Přírodopis
              </Label>
            </div>
            
            <div className="flex items-center gap-1.5 bg-[#dee4f1] px-2 py-1.5 rounded-[8px]">
              <Checkbox
                id="sidebar-subject-2nd-che"
                checked={selectedCategories.includes('Chemie')}
                onCheckedChange={() => toggleCategory('Chemie')}
              />
              <Label
                htmlFor="sidebar-subject-2nd-che"
                className={`text-[#001161] text-[13px] font-['Fenomen_Sans',sans-serif] tracking-[-0.21px] cursor-pointer leading-tight ${
                  selectedCategories.includes('Chemie') ? 'underline' : ''
                }`}
              >
                Chemie
              </Label>
            </div>
          </div>
        </div>

        {/* 1. stupeň */}
        <div>
          <p className="text-[#001161] text-[13px] font-['Fenomen_Sans',sans-serif] tracking-[-0.24px] mb-1.5">
            1. stupeň
          </p>
          <div className="grid grid-cols-2 gap-1.5">
            <div className="flex items-center gap-1.5 bg-white px-2 py-1.5 rounded-[8px]">
              <Checkbox
                id="sidebar-subject-1st-mat"
                checked={selectedCategories.includes('Matematika 1. stupeň')}
                onCheckedChange={() => toggleCategory('Matematika 1. stupeň')}
              />
              <Label
                htmlFor="sidebar-subject-1st-mat"
                className={`text-[#001161] text-[13px] font-['Fenomen_Sans',sans-serif] tracking-[-0.21px] cursor-pointer leading-tight ${
                  selectedCategories.includes('Matematika 1. stupeň') ? 'underline' : ''
                }`}
              >
                Matematika
              </Label>
            </div>
            
            <div className="flex items-center gap-1.5 bg-white px-2 py-1.5 rounded-[8px]">
              <Checkbox
                id="sidebar-subject-1st-prv"
                checked={selectedCategories.includes('Prvouka')}
                onCheckedChange={() => toggleCategory('Prvouka')}
              />
              <Label
                htmlFor="sidebar-subject-1st-prv"
                className={`text-[#001161] text-[13px] font-['Fenomen_Sans',sans-serif] tracking-[-0.21px] cursor-pointer leading-tight ${
                  selectedCategories.includes('Prvouka') ? 'underline' : ''
                }`}
              >
                Prvouka
              </Label>
            </div>
            
            <div className="flex items-center gap-1.5 bg-white px-2 py-1.5 rounded-[8px] col-span-2">
              <Checkbox
                id="sidebar-subject-1st-cj"
                checked={selectedCategories.includes('Český jazyk')}
                onCheckedChange={() => toggleCategory('Český jazyk')}
              />
              <Label
                htmlFor="sidebar-subject-1st-cj"
                className={`text-[#001161] text-[13px] font-['Fenomen_Sans',sans-serif] tracking-[-0.21px] cursor-pointer leading-tight ${
                  selectedCategories.includes('Český jazyk') ? 'underline' : ''
                }`}
              >
                Český jazyk
              </Label>
            </div>
          </div>
        </div>
      </div>

      {/* V jaké formě? */}
      <div className="bg-[rgba(222,228,241,0.3)] rounded-[24px] p-3">
        <p className="text-[#001161] text-[15px] font-['Fenomen_Sans',sans-serif] font-semibold tracking-[-0.31px] mb-2">
          V jaké formě?
        </p>
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 bg-[#fff3a4] px-3 py-1.5 rounded-[11px]">
            <Checkbox
              id="sidebar-type-online"
              checked={selectedTypes.includes('online')}
              onCheckedChange={() => toggleType('online')}
            />
            <Label
              htmlFor="sidebar-type-online"
              className="text-[#001161] text-[14px] font-['Fenomen_Sans',sans-serif] tracking-[-0.22px] cursor-pointer"
            >
              Digitální učebnici
            </Label>
          </div>
          
          <div className="flex items-center gap-2 bg-[#dee4f1] px-3 py-1.5 rounded-[11px]">
            <Checkbox
              id="sidebar-type-workbook"
              checked={selectedTypes.includes('workbook')}
              onCheckedChange={() => toggleType('workbook')}
            />
            <Label
              htmlFor="sidebar-type-workbook"
              className="text-[#001161] text-[14px] font-['Fenomen_Sans',sans-serif] tracking-[-0.22px] cursor-pointer"
            >
              Pracovní sešity a učebnice
            </Label>
          </div>
          
          <div className="flex items-center gap-2 bg-[#ffd0c4] px-3 py-1.5 rounded-[11px]">
            <Checkbox
              id="sidebar-type-vividboard"
              checked={selectedTypes.includes('vividboard')}
              onCheckedChange={() => toggleType('vividboard')}
            />
            <Label
              htmlFor="sidebar-type-vividboard"
              className="text-[#001161] text-[14px] font-['Fenomen_Sans',sans-serif] tracking-[-0.22px] cursor-pointer"
            >
              Nástroj Vividboard
            </Label>
          </div>
        </div>
      </div>
    </div>
  );
}