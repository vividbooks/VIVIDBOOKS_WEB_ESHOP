import { useState } from 'react';
import { Checkbox } from './ui/checkbox';

interface ProductCardProps {
  product: {
    id: string;
    name: string;
    price: string;
    priceType: 'single' | 'subscription';
    backgroundColor: string;
    image: string | null;
    buttonType: 'cart' | 'subscribe';
    type: string;
    category: string;
    priceMonthly?: number;
    priceYearly?: number;
    link?: string;
    note?: string;
  };
}

export function ProductCard({ product }: ProductCardProps) {
  const [selectedPriceType, setSelectedPriceType] = useState<'monthly' | 'yearly'>('monthly');

  const handleButtonClick = () => {
    // Pokud je link dostupný, otevřeme ho
    if (product.link) {
      window.open(product.link, '_blank');
    } else {
      console.log(`${product.buttonType} clicked for:`, product.name);
    }
  };

  const isDigitalProduct = product.type === 'online';

  return (
    <div className="relative group w-full min-w-[280px] max-w-[360px]" style={{ aspectRatio: '309/340' }}>
      <div 
        className="rounded-[11px] w-full h-full" 
        style={{ backgroundColor: product.backgroundColor }}
      />
      
      {/* Tab s předmětem */}
      <div className="absolute top-[2.5%] left-[6.5%]">
        <div 
          className={`${product.buttonType === 'subscribe' ? 'bg-[#e1cd6f]' : 'bg-[#abbadb]'} rounded-[6px] px-3 py-1`}
        >
          <p className="font-['Fenomen_Sans',sans-serif] text-[12px] tracking-[-0.18px] text-black">
            {product.category}
          </p>
        </div>
      </div>
      
      <div className="absolute top-[12.5%] left-[8%] right-[8%]">
        <p className="font-['Fenomen_Sans',sans-serif] font-semibold text-[18px] leading-[23px] tracking-[-0.27px] text-black">
          {isDigitalProduct ? `Digitální učebnice – ${product.name}` : product.name}
        </p>
      </div>

      {product.image && (
        <div className={`absolute ${isDigitalProduct ? 'top-[19%] left-[23%] w-[56.5%]' : 'top-[13%] left-[17%] w-[66.5%]'}`} style={{ aspectRatio: isDigitalProduct ? '174.8/251.6' : '205.65/296' }}>
          <img 
            alt={product.name} 
            className="w-full h-full object-contain transition-transform duration-300 group-hover:rotate-[-20deg]" 
            src={product.image} 
          />
        </div>
      )}

      {/* Cena - rozdílné zobrazení pro digitální učebnice */}
      <div className="absolute bottom-[4.5%] left-[8%]">
        {isDigitalProduct && product.priceMonthly && product.priceYearly ? (
          <div className="flex flex-col gap-2">
            {/* Měsíční cena */}
            <div className="flex items-center gap-2">
              <Checkbox
                id={`price-monthly-${product.id}`}
                checked={selectedPriceType === 'monthly'}
                onCheckedChange={() => setSelectedPriceType('monthly')}
              />
              <label 
                htmlFor={`price-monthly-${product.id}`}
                className="font-['Fenomen_Sans',sans-serif] text-[15px] leading-[20px] tracking-[-0.225px] text-black cursor-pointer"
              >
                {product.priceMonthly},-/měsíc
              </label>
            </div>
            {/* Roční cena */}
            <div className="flex items-center gap-2">
              <Checkbox
                id={`price-yearly-${product.id}`}
                checked={selectedPriceType === 'yearly'}
                onCheckedChange={() => setSelectedPriceType('yearly')}
              />
              <label 
                htmlFor={`price-yearly-${product.id}`}
                className="font-['Fenomen_Sans',sans-serif] text-[15px] leading-[20px] tracking-[-0.225px] text-black cursor-pointer"
              >
                {product.priceYearly},-/rok
              </label>
            </div>
          </div>
        ) : (
          <p className="font-['Fenomen_Sans',sans-serif] text-[17px] leading-[25px] tracking-[-0.225px] text-black">
            {product.price}
          </p>
        )}
        
        {/* Poznámka (Bobánek) - Resilient check */}
        {(product.note || (product as any).poznamka || (product as any).metadata?.poznamka || (product as any).metadata?.poznámka) && (
          <div className="mt-1 flex">
            <div className="bg-[#FF9900] text-white text-[11px] font-bold px-3 py-1 rounded-xl uppercase tracking-wider shadow-md">
              {product.note || (product as any).poznamka || (product as any).metadata?.poznamka || (product as any).metadata?.poznámka}
            </div>
          </div>
        )}
      </div>

      <div className="absolute bottom-[4.5%] right-[8%] z-10">
        <button
          onClick={handleButtonClick}
          className={`${product.buttonType === 'subscribe' ? 'bg-[#e1cd6f]' : 'bg-[#abbadb]'} h-[43.445px] w-[97.64px] rounded-[6px] font-['Fenomen_Sans',sans-serif] text-[14.92px] leading-[13.921px] text-black cursor-pointer flex items-center justify-center`}
        >
          {product.buttonType === 'subscribe' ? 'Předplatit' : 'Koupit'}
        </button>
      </div>
    </div>
  );
}