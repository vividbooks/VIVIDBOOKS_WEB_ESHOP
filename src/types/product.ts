import type { MerchVariantOption } from './merchVariants';

export interface Product {
  id: string;
  /** Externí ID položky pro marketingové feedy (`g:id` / CSV `id`). Bez vyplnění se použije interní `id`. */
  item_id?: string;
  name: string;
  price: string;
  priceAmount?: number;
  category: string;
  type: 'online' | 'workbook' | 'vividboard' | 'merch';
  /** Skupina na stránce Další produkty + v adminu (např. Plakáty, Žákovské knížky). */
  merchCategory?: string;
  /** Volitelná podkategorie uvnitř skupiny. */
  merchSubcategory?: string;
  /** Více velikostí / variant u jednoho merch produktu (např. plakáty ze Shoptetu). */
  merchVariants?: MerchVariantOption[];
  image?: string;
  /** Další fotky produktu (např. galerie ze Shoptetu). Detail: náhledy pod hlavním obrázkem. */
  images?: string[];
  description?: string;
  isbn?: string;
  poradi?: number;
  format?: string;
  pocetStranek?: number;
  rokVydani?: string;
  autori?: string;
  dolozka?: string;
  note?: string;
  obsah?: string;
  previewLink?: string;
  /** YouTube / Vimeo / přímý odkaz na video (.mp4) — tlačítko „Ukázka videa“ v detailu. */
  previewVideoLink?: string;
  appLink?: string;
  backgroundColor?: string;
  buttonType?: 'cart' | 'subscribe';
  /**
   * Dostupnost u ceny: `on_order` = štítek „Na objednávku“, bez stavu skladu.
   * U plakátů / nástěnných obrazů lze doplnit z importu; jinak se odvodí z kategorie.
   */
  availabilityDisplay?: 'stock' | 'on_order';
  metadata?: any;
  [key: string]: any;
}