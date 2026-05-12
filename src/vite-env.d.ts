/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Kanonická veřejná URL webu (canonical, OG); výchozí v kódu: https://www.vividbooks.com */
  readonly VITE_PUBLIC_SITE_URL?: string;
  /** Doména aplikace učebnic (přesměrování např. z /cs/otevrit-ucebnice). Výchozí https://app.vividbooks.com */
  readonly VITE_APP_ORIGIN?: string;
  /** Volitelně čárkou oddělené další origin (staging). */
  readonly VITE_MARKETING_SITE_ORIGINS_EXTRA?: string;
  readonly VITE_STRIPE_PUBLISHABLE_KEY?: string;
  readonly VITE_PACKETA_API_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

interface PacketaPickupPoint {
  id: string;
  name: string;
  zip?: string;
  city?: string;
  street?: string;
  place?: string;
}

interface PacketaWidgetApi {
  pick: (
    apiKey: string,
    callback: (point: PacketaPickupPoint | null) => void,
    options?: Record<string, unknown>,
  ) => void;
}

interface Window {
  Packeta?: {
    Widget: PacketaWidgetApi;
  };
}
