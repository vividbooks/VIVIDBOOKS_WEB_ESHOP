export interface Tiskovina {
  id: string;
  name: string;
  predmet?: string;
  typTiskoviny?: string;
  cena?: number;
  isbn?: string;
  ean?: string;
  format?: string;
  vazba?: string;
  pocetStranek?: number;
  rokVydani?: string;
  autori?: string;
  popis?: string;
  coverImage?: string;
  eshopLink?: string;
  ukazkaLink?: string;
  obsahPdf?: string;
  dolozka?: string;
  poznamka?: string;
  poradi?: number;
  slug?: string;
}
