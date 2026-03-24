export interface Product {
  id: string;
  name: string;
  price: string;
  priceAmount?: number;
  category: string;
  type: 'online' | 'workbook' | 'vividboard';
  image?: string;
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
  appLink?: string;
  backgroundColor?: string;
  buttonType?: 'cart' | 'subscribe';
  metadata?: any;
  [key: string]: any;
}