/**
 * Vynucení světlého vzhledu e-mailů v dark mode (iOS Mail, Apple Mail, část Gmail/Android).
 *
 * Problém: klienti s dark mode často ztmaví bílé karty, ale nechají tmavý inline text
 * (#1a1a22 / #333) → nečitelný „tmavé na tmavém“.
 *
 * Webinářové maily mají vlastní WEBINAR_EMAIL_DARK_HEAD (skutečný dark theme s dm-*).
 * Ostatní brandové / transakční maily + newslettery z Email Builderu mají zůstat světlé.
 *
 * Text v těle kampaně nepřepisujeme plošně na tmavý (uvnitř jsou navy/hero bloky s bílým textem).
 * U jednoduchých karet použij třídu `.vb-force-light-text` na buňku s tmavým textem.
 */
export const EMAIL_FORCE_LIGHT_HEAD = `<meta name="color-scheme" content="light only">
<meta name="supported-color-schemes" content="light">
<meta name="x-apple-disable-message-reformatting" content="">
<style type="text/css">
:root { color-scheme: light only !important; }
html, body { color-scheme: light only !important; }
@media (prefers-color-scheme: dark) {
  :root, html, body { color-scheme: light only !important; }
  body, .vb-force-light, .vb-shell {
    background-color: #f3f4f6 !important;
    background-image: none !important;
  }
  /* Transakční karta + vnější karta kampaně */
  .vb-force-light-card,
  .vb-card-outer {
    background-color: #ffffff !important;
    background-image: none !important;
  }
  /* Email Builder — bílé section karty zůstanou bílé */
  .vb-email-root [data-vb-block="section"][data-vb-section-fill="card"] {
    background-color: #ffffff !important;
    background-image: none !important;
  }
  .vb-email-root [data-vb-block="section"][data-vb-section-fill="plain"] {
    background-color: transparent !important;
  }
  /* Jen buňky označené jako „světlý textový obsah“ — ne celé tělo kampaně */
  .vb-force-light-text,
  .vb-force-light-text p,
  .vb-force-light-text li,
  .vb-force-light-text td,
  .vb-force-light-text span,
  .vb-force-light-text ul {
    color: #1a1a22 !important;
  }
  .vb-force-light-text a {
    color: #001161 !important;
  }
  .vb-force-light-text strong {
    color: #001161 !important;
  }
  .vb-force-light-muted,
  .vb-force-light-muted p,
  .vb-foot,
  .vb-foot p {
    color: #4b5563 !important;
    background-color: transparent !important;
  }
  .vb-force-light-muted a,
  .vb-foot a {
    color: #001161 !important;
  }
  .vb-brand span { color: #001161 !important; }
  .vb-hero,
  .vb-force-light-header,
  .dm-header {
    background-color: #001161 !important;
  }
  .vb-hero h1,
  .vb-force-light-header,
  .vb-force-light-header p,
  .vb-force-light-header span,
  .dm-header p {
    color: #ffffff !important;
  }
  /* Logo / obrázky — bez invertu (bez bílého čipu; light-only stačí) */
  img.vb-email-logo,
  a.vb-email-logo-wrap img,
  .vb-email-root img {
    filter: none !important;
    -webkit-filter: none !important;
    mix-blend-mode: normal !important;
    opacity: 1 !important;
  }
  a[style*="background:#E8942A"],
  a[style*="background: #E8942A"],
  a[style*="background-color:#E8942A"],
  a[style*="background-color: #E8942A"],
  a[style*="background-color:#F06632"],
  a[style*="background-color: #F06632"],
  a[style*="background-color:#7C3AED"],
  a[style*="background-color: #7C3AED"],
  a[style*="background-color:#2563eb"],
  a[style*="background-color: #2563eb"] {
    color: #ffffff !important;
  }
}
</style>`;
