/// <reference types="vite/client" />

interface ImportMetaEnv {
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
