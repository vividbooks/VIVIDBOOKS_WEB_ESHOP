import React, { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';
import { ImageWithFallback } from './figma/ImageWithFallback';
import { projectId, publicAnonKey } from '../utils/supabase/info';
import { ChevronDown, ChevronUp, Plus } from 'lucide-react';

interface Product {
  id: string;
  name: string;
  price: string;
  priceType: 'single' | 'subscription';
  category: string;
  type: string;
  buttonType: 'cart' | 'subscribe';
  backgroundColor: string;
  image: string | null;
  note?: string;
  // Integrační identifikátory
  shopifyVariantId?: string | null;
  shopifyProductId?: string | null;
  shoptetId?: string | null;
  shoptetProductId?: string | null;
}

interface SpecialOffer {
  id: string;
  title: string;
  description: string;
  conditionType: string;
  conditionValue: number;
  conditionCategories: string[];
  rewardType: string;
  rewardProduct: string | null;
  isActive: boolean;
}

interface SchoolOrderViewProps {
  products: Product[];
  selectedCategories: string[];
  selectedTypes: string[];
  isLoading?: boolean;
  step?: 1 | 2;
  onContinue?: () => void;
  onBack?: () => void;
  layout?: 'horizontal' | 'sidebar';
  preselectedCategory?: string | null;
}

export function SchoolOrderView({
  products,
  selectedCategories,
  selectedTypes,
  isLoading,
  onBack,
  layout = 'horizontal',
  preselectedCategory,
}: SchoolOrderViewProps) {
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [specialOffers, setSpecialOffers] = useState<SpecialOffer[]>([]);
  const [showOtherCategories, setShowOtherCategories] = useState(false);

  // Contact form
  const [schoolInfo, setSchoolInfo] = useState({
    schoolName: '',
    region: '',
    fullName: '',
    email: '',
    phone: '',
    position: '',
    vat: '',
  });
  const [aresValidation, setAresValidation] = useState<{
    isValid: boolean | null;
    isLoading: boolean;
    error: string | null;
  }>({ isValid: null, isLoading: false, error: null });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const isValidVatFormat = (vat: string) => /^\d{8}$/.test(vat) || /^\d{10}$/.test(vat);

  const checkAres = async (ico: string) => {
    setAresValidation({ isValid: null, isLoading: true, error: null });
    try {
      const response = await fetch(
        `https://ares.gov.cz/ekonomicke-subjekty-v-be/rest/ekonomicke-subjekty/${ico}`,
        { method: 'GET', headers: { accept: 'application/json' } }
      );
      if (!response.ok) throw new Error('ARES API error');
      const data = await response.json();
      if (data.icoId) {
        setAresValidation({ isValid: true, isLoading: false, error: null });
        setSchoolInfo(prev => ({
          ...prev,
          schoolName: data.obchodniJmeno || '',
          region: data.sidlo?.nazevKraje || '',
        }));
      } else {
        throw new Error('not found');
      }
    } catch {
      setAresValidation({ isValid: false, isLoading: false, error: 'Neplatn\u00e9 I\u010c' });
    }
  };

  const handleVatChange = (value: string) => {
    const ico = value.trim().toUpperCase().replace(/^CZ/, '');
    setSchoolInfo(prev => ({ ...prev, vat: ico }));
    if (isValidVatFormat(ico)) checkAres(ico);
    else setAresValidation({ isValid: null, isLoading: false, error: null });
  };

  useEffect(() => {
    const fetchOffers = async () => {
      try {
        const res = await fetch(
          `https://${projectId}.supabase.co/functions/v1/make-server-93a20b6f/special-offers`,
          { headers: { Authorization: `Bearer ${publicAnonKey}` } }
        );
        if (!res.ok) throw new Error('Failed');
        const data = await res.json();
        setSpecialOffers((data.offers || []).filter((o: SpecialOffer) => o.isActive));
      } catch (e) {
        console.error('Error fetching special offers:', e);
      }
    };
    fetchOffers();
  }, []);

  /* ── quantities ── */
  const handleQuantityChange = (productId: string, value: string) => {
    const num = value.replace(/\D/g, '');
    setQuantities(prev => ({ ...prev, [productId]: num === '' ? 0 : parseInt(num) }));
  };
  const updateQuantity = (productId: string, delta: number) => {
    setQuantities(prev => ({ ...prev, [productId]: Math.max(0, (prev[productId] || 0) + delta) }));
  };
  const resetCategory = (categoryProducts: Product[]) => {
    setQuantities(prev => {
      const next = { ...prev };
      categoryProducts.forEach(p => { next[p.id] = 0; });
      return next;
    });
  };
  const getCategoryTotal = (categoryProducts: Product[]) => {
    let total = 0, totalItems = 0;
    categoryProducts.forEach(p => {
      const qty = quantities[p.id] || 0;
      if (qty > 0) { total += parseInt(p.price.replace(/\D/g, '')) * qty; totalItems += qty; }
    });
    return { total, totalItems };
  };

  /* ── product map – built dynamically from actual data ── */
  const workbookProducts = products.filter(p => p.type === 'workbook');

  // Group dynamically by actual category values from the database
  const productsByCategory = workbookProducts.reduce<Record<string, Product[]>>((acc, p) => {
    const cat = p.category || 'Ostatn\u00ed';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(p);
    return acc;
  }, {});

  // Preferred display order
  const CATEGORY_ORDER = [
    'Matematika 2. stupe\u0148', 'Matematika 1. stupe\u0148',
    'Fyzika', 'P\u0159\u00edrodopis', 'Chemie', '\u010cesk\u00fd jazyk', 'Prvouka',
  ];
  const sortedCategories = [
    ...CATEGORY_ORDER.filter(c => productsByCategory[c]),
    ...Object.keys(productsByCategory).filter(c => !CATEGORY_ORDER.includes(c)),
  ];

  const allEntries = sortedCategories
    .map(cat => [cat, productsByCategory[cat]] as [string, Product[]])
    .filter(([, p]) => p.length > 0);

  // Flexible match: preselectedCategory from slugToSubject (e.g. "Fyzika", "Matematika 1. stupeň")
  const matchesCat = (cat: string, sel: string) => {
    const c = cat.toLowerCase().normalize('NFC');
    const s = sel.toLowerCase().normalize('NFC');
    // Also try decoded URI component in case URL-encoded chars
    const sDecoded = (() => { try { return decodeURIComponent(s); } catch { return s; } })();
    return c === s || c === sDecoded
      || c.startsWith(s) || s.startsWith(c)
      || c.startsWith(sDecoded) || sDecoded.startsWith(c)
      || c.includes(s) || c.includes(sDecoded);
  };

  console.log('[SchoolOrderView] preselectedCategory:', preselectedCategory);
  console.log('[SchoolOrderView] allEntries categories:', allEntries.map(([c]) => c));
  console.log('[SchoolOrderView] workbookProducts count:', workbookProducts.length);

  const preselectedEntries = preselectedCategory
    ? allEntries.filter(([cat]) => matchesCat(cat, preselectedCategory))
    : [];
  const otherEntries = preselectedCategory
    ? allEntries.filter(([cat]) => !matchesCat(cat, preselectedCategory))
    : allEntries;

  console.log('[SchoolOrderView] preselectedEntries:', preselectedEntries.length, '| otherEntries:', otherEntries.length);

  /* ── totals ── */
  const calculateTotal = () => {
    let total = 0, totalItems = 0;
    Object.entries(quantities).forEach(([id, qty]) => {
      if (qty > 0) {
        const p = products.find(x => x.id === id);
        if (p) { total += parseInt(p.price.replace(/\D/g, '')) * qty; totalItems += qty; }
      }
    });
    return { total, totalItems };
  };
  const { total, totalItems } = calculateTotal();

  /* ── submit ── */
  const handleSubmitOrder = async () => {
    if (!schoolInfo.fullName || !schoolInfo.email || !schoolInfo.phone || !schoolInfo.vat) {
      alert('Pros\u00edm vypln\u011bte v\u0161echna povinn\u00e1 pole ozna\u010den\u00e1 hv\u011bzdi\u010dkou.');
      return;
    }
    setIsSubmitting(true);
    try {
      const payload = {
        customer: schoolInfo,
        cart: { quantities, total, totalItems },
        items: Object.entries(quantities)
          .filter(([, qty]) => qty > 0)
          .map(([id, qty]) => {
            const p = products.find(x => x.id === id);
            return {
              id,
              name: p?.name,
              price: p?.price,
              quantity: qty,
              shopifyVariantId: p?.shopifyVariantId ?? null,
              shopifyProductId: p?.shopifyProductId ?? null,
              shoptetId: p?.shoptetId ?? p?.shoptetProductId ?? null,
            };
          }),
      };
      const resp = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-93a20b6f/orders`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${publicAnonKey}` },
          body: JSON.stringify(payload),
        }
      );
      if (!resp.ok) throw new Error('Failed to submit order');
      setIsSuccess(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error) {
      console.error('Error submitting order:', error);
      alert('Chyba p\u0159i odes\u00edl\u00e1n\u00ed objedn\u00e1vky. Zkuste to pros\u00edm znovu.');
    } finally {
      setIsSubmitting(false);
    }
  };

  /* ── category block renderer ── */
  const renderCategoryBlock = (category: string, categoryProducts: Product[]) => {
    const catTotal = getCategoryTotal(categoryProducts);
    return (
      <div key={category} className="mb-6 md:mb-8">
        <p className="text-[#001161] text-[17px] md:text-[20px] font-['Fenomen_Sans',sans-serif] font-semibold tracking-[-0.3px] text-center mb-3 md:mb-4">
          {category}
        </p>
        {categoryProducts.map(product => (
          <div key={product.id} className="flex gap-1.5 md:gap-2 mb-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <div className={`flex-1 rounded-[6px] px-2 md:px-4 py-2.5 md:py-3 cursor-pointer transition-colors ${quantities[product.id] > 0 ? 'bg-[#c8d7f7]' : 'bg-[rgba(255,255,255,0.8)]'}`}>
                  <p className="text-[#001161] text-[13px] md:text-[15px] font-['Fenomen_Sans',sans-serif] tracking-[-0.22px] leading-tight">{product.name}</p>
                </div>
              </TooltipTrigger>
              <TooltipContent side="right" className="p-10 bg-white border border-gray-100 rounded-[30px] shadow-2xl hidden md:block">
                {product.image && <ImageWithFallback src={product.image} alt={product.name} className="w-[240px] h-auto object-contain drop-shadow-[0_20px_40px_rgba(0,0,0,0.15)]" />}
              </TooltipContent>
            </Tooltip>
            <div className={`w-[60px] md:w-[76px] rounded-[6px] px-1 md:px-2 py-2.5 md:py-3 flex flex-col items-center justify-center ${quantities[product.id] > 0 ? 'bg-[#c8d7f7]' : 'bg-[rgba(255,255,255,0.8)]'}`}>
              <p className="text-[#001161] text-[12px] md:text-[15px] font-['Fenomen_Sans',sans-serif] font-medium leading-none">{product.price.replace(',-', '')},-</p>
              {product.note && (
                <span className="text-[8px] bg-[#FF9900] text-white px-1 rounded-[4px] mt-1 font-bold whitespace-nowrap">{product.note}</span>
              )}
            </div>
            <div className={`w-[88px] md:w-[108px] rounded-[10px] px-1.5 md:px-2 py-1 flex items-center justify-between gap-1 ${quantities[product.id] > 0 ? 'bg-[#c8d7f7]' : 'bg-[rgba(255,255,255,0.8)]'}`}>
              <button onClick={() => updateQuantity(product.id, -1)} className="w-[24px] h-[38px] bg-[#26356B] rounded-[8px] flex items-center justify-center text-white text-[20px] cursor-pointer flex-shrink-0">−</button>
              <input
                type="text" inputMode="numeric" placeholder="0"
                value={quantities[product.id] || ''}
                onChange={e => handleQuantityChange(product.id, e.target.value)}
                className="w-full bg-transparent text-center text-[#001161] text-[14px] md:text-[15px] font-['Fenomen_Sans',sans-serif] font-bold focus:outline-none border-none p-0 placeholder:text-[#001161]/30"
              />
              <button onClick={() => updateQuantity(product.id, 1)} className="w-[24px] h-[38px] bg-[#26356B] rounded-[8px] flex items-center justify-center text-white text-[20px] cursor-pointer flex-shrink-0">+</button>
            </div>
          </div>
        ))}
        {catTotal.totalItems > 0 && (
          <div className="flex justify-between items-center bg-[rgba(200,215,247,0.3)] rounded-[6px] px-4 py-2.5 mb-4">
            <div className="flex items-center gap-3">
              <p className="text-[#001161] text-[14px] font-['Fenomen_Sans',sans-serif] font-semibold">Celkem {category.split(' ')[0]}:</p>
              <button onClick={() => resetCategory(categoryProducts)} className="text-[#001161] text-[11px] underline font-['Fenomen_Sans',sans-serif]">Smazat</button>
            </div>
            <div className="flex gap-4 md:gap-6">
              <p className="text-[#001161] text-[14px] font-['Fenomen_Sans',sans-serif] font-bold">{catTotal.total},-</p>
              <p className="text-[#001161] text-[14px] font-['Fenomen_Sans',sans-serif]">{catTotal.totalItems} ks</p>
            </div>
          </div>
        )}
        <div className="h-[1px] bg-[#dee4f1] my-3" />
      </div>
    );
  };

  /* ── success ── */
  if (isSuccess) {
    return (
      <div className="text-center py-16 max-w-[500px] mx-auto">
        <div className="bg-green-100 text-green-800 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4 text-3xl">✓</div>
        <h3 className="text-[#001161] text-[28px] font-['Cooper_Light',serif] mb-3">{'D\u011bkujeme!'}</h3>
        <p className="text-[#001161] text-[16px] font-['Fenomen_Sans',sans-serif] mb-6 opacity-70">
          {'Va\u0161e nez\u00e1vazn\u00e1 objedn\u00e1vka byla \u00fasp\u011b\u0161n\u011b odesl\u00e1na. Brzy se v\u00e1m ozveme s cenovou nab\u00eddkou.'}
        </p>
        <Button onClick={() => window.location.reload()} className="bg-[#001161] text-white font-['Fenomen_Sans',sans-serif]">
          {'Nov\u00e1 objedn\u00e1vka'}
        </Button>
      </div>
    );
  }

  /* ── main layout ── */
  return (
    <div className="pb-16 w-full">
      <div className="max-w-[680px] mx-auto w-full px-4 md:px-0 mt-8 space-y-4">

        {isLoading && workbookProducts.length === 0 ? (
          <div className="flex justify-center py-10">
            <div className="animate-spin h-10 w-10 border-4 border-[#04036b] border-t-transparent rounded-full" />
          </div>
        ) : (
          <TooltipProvider>

            {/* ── 1. Preselected category only ── */}
            {preselectedEntries.length > 0 && (
              <div className="bg-[#f5f7fb] rounded-[20px] p-5 md:p-8">
                {preselectedEntries.map(([cat, prods]) => renderCategoryBlock(cat, prods))}
                {totalItems > 0 && (
                  <div className="pt-3 border-t-2 border-[#001161] mt-2 flex justify-between items-center">
                    <p className="text-[#001161] text-[16px] md:text-[18px] font-['Fenomen_Sans',sans-serif] font-bold">Celkem</p>
                    <p className="text-[#001161] text-[16px] md:text-[18px] font-['Fenomen_Sans',sans-serif] font-bold">{total},- K\u010d ({totalItems} ks)</p>
                  </div>
                )}
              </div>
            )}

            {/* ── 2. "Chcete přidat další předměty?" ── */}
            {otherEntries.length > 0 && (
              <>
                <button
                  onClick={() => setShowOtherCategories(v => !v)}
                  className={`w-full flex items-center justify-between px-6 py-4 rounded-[16px] font-['Fenomen_Sans',sans-serif] text-[15px] font-semibold transition-all cursor-pointer ${
                    showOtherCategories
                      ? 'bg-[#001161]/8 text-[#001161] border border-[#001161]/15'
                      : 'bg-[rgba(222,228,241,0.55)] text-[#001161] hover:bg-[rgba(222,228,241,0.85)]'
                  }`}
                >
                  <span className="flex items-center gap-3">
                    <Plus className={`w-5 h-5 transition-transform duration-200 ${showOtherCategories ? 'rotate-45 opacity-50' : ''}`} />
                    {showOtherCategories
                      ? (preselectedEntries.length > 0 ? 'Dal\u0161\u00ed p\u0159edm\u011bty' : 'Vyberte p\u0159edm\u011bty')
                      : (preselectedEntries.length > 0 ? 'Chcete p\u0159idat dal\u0161\u00ed p\u0159edm\u011bty?' : 'Vyberte p\u0159edm\u011bty')}
                  </span>
                  {showOtherCategories
                    ? <ChevronUp className="w-5 h-5 opacity-40" />
                    : <ChevronDown className="w-5 h-5 opacity-40" />}
                </button>

                {showOtherCategories && (
                  <div className="bg-[#f5f7fb] rounded-[20px] p-5 md:p-8">
                    {otherEntries.map(([cat, prods]) => renderCategoryBlock(cat, prods))}
                    {totalItems > 0 && (
                      <div className="pt-3 border-t-2 border-[#001161] mt-2 flex justify-between items-center">
                        <p className="text-[#001161] text-[16px] md:text-[18px] font-['Fenomen_Sans',sans-serif] font-bold">Celkem v\u0161e</p>
                        <p className="text-[#001161] text-[16px] md:text-[18px] font-['Fenomen_Sans',sans-serif] font-bold">{total},- K\u010d ({totalItems} ks)</p>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}

          </TooltipProvider>
        )}

        {/* ── 3. Contact form ── */}
        <div className="bg-[rgba(222,228,241,0.35)] rounded-[20px] p-6 md:p-8">
          <p className="text-[#001161] text-[20px] font-['Fenomen_Sans',sans-serif] font-semibold tracking-[-0.3px] mb-5 text-center">
            {'Kontaktn\u00ed \u00fadaje'}
          </p>
          <div className="space-y-3 mb-5">
            <Input
              placeholder={'Jm\u00e9no a p\u0159\u00edjmen\u00ed *'}
              value={schoolInfo.fullName}
              onChange={e => setSchoolInfo(p => ({ ...p, fullName: e.target.value }))}
              className="bg-white font-['Fenomen_Sans',sans-serif] text-[16px] h-[50px]"
            />
            <Input
              placeholder="Email *" type="email"
              value={schoolInfo.email}
              onChange={e => setSchoolInfo(p => ({ ...p, email: e.target.value }))}
              className="bg-white font-['Fenomen_Sans',sans-serif] text-[16px] h-[50px]"
            />
            <Input
              placeholder="Telefon *" type="tel"
              value={schoolInfo.phone}
              onChange={e => setSchoolInfo(p => ({ ...p, phone: e.target.value }))}
              className="bg-white font-['Fenomen_Sans',sans-serif] text-[16px] h-[50px]"
            />
            <select
              value={schoolInfo.position}
              onChange={e => setSchoolInfo(p => ({ ...p, position: e.target.value }))}
              className="w-full px-4 py-3 bg-white border border-gray-200 rounded-md text-[#001161] text-[16px] h-[50px] font-['Fenomen_Sans',sans-serif]"
            >
              <option value="">{'Vyberte pozici *'}</option>
              <option value="Teacher">{'U\u010ditel'}</option>
              <option value="Deputy director">{'Z\u00e1stupce \u0159editele'}</option>
              <option value="Director">{'\u0158editel'}</option>
              <option value="Accountant">{'Hospod\u00e1\u0159'}</option>
            </select>
            <div className="relative">
              <Input
                placeholder={'\u00cd\u010c \u0161koly (8 nebo 10 \u010d\u00edslic) *'}
                value={schoolInfo.vat}
                onChange={e => handleVatChange(e.target.value)}
                className="bg-white pr-10 font-['Fenomen_Sans',sans-serif] text-[16px] h-[50px]"
              />
              {aresValidation.isLoading && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <div className="animate-spin h-5 w-5 border-2 border-[#001161] border-t-transparent rounded-full" />
                </div>
              )}
              {aresValidation.isValid === true && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-green-600 font-bold">✓</div>
              )}
              {aresValidation.isValid && schoolInfo.schoolName && (
                <p className="text-green-600 text-[12px] mt-1 font-['Fenomen_Sans',sans-serif]">✓ {schoolInfo.schoolName}</p>
              )}
            </div>
          </div>

          <Button
            onClick={handleSubmitOrder}
            disabled={isSubmitting}
            className="w-full bg-[#ff8c66] hover:bg-[#ff7a4d] text-white text-[17px] py-6 font-['Fenomen_Sans',sans-serif] rounded-[14px] disabled:opacity-50"
          >
            {isSubmitting ? 'Odes\u00edl\u00e1m...' : 'Odeslat nez\u00e1vaznou objedn\u00e1vku'}
          </Button>
          <p className="text-[#001161] text-[13px] font-['Fenomen_Sans',sans-serif] text-center mt-3 opacity-50">
            {'P\u0159esnou cenovou nab\u00eddku v\u00e1m zpracujeme na m\u00edru a obratem se v\u00e1m ozveme'}
          </p>
        </div>

      </div>
    </div>
  );
}