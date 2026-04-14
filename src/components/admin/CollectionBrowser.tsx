// CollectionBrowser v6 — 3-sloupcový layout pro Předměty
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router';
import {
  Plus, Search, Trash2, Save, X, ChevronRight, Loader2,
  AlertCircle, Settings, LayoutGrid, Unlock, ArrowRight, ArrowLeft,
  ExternalLink, BookOpen, Package, ShoppingCart, MapPin, BarChart3, RefreshCw,
  CircleHelp, GripVertical, Pencil, EyeOff, Eye, Sparkles,
} from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import {
  fetchCollection, createItem, updateItem, deleteItem, reorderHeroSlides,
  fetchProducts, createProduct, updateProduct, deleteProduct,
  seedCollection,
  fetchAdminProductCommerce,
  runAdminProductBaseSync,
} from '../../utils/adminApi';
import type { CollectionName } from '../../utils/adminApi';
import { BLOG_POSTS } from '../../data/blogPosts';
import { NOVINKA_POSTS } from '../../data/novinkaPosts';
import { WEBINARS } from '../../data/webinars';
import {
  HERO_SLIDES,
  HERO_TITLE_FONT_OPTIONS,
  clampHeroBlockGapPx,
  clampHeroBooksFanColumnPercent,
  clampHeroBooksFanBelowLiftPx,
  clampHeroBooksFanBelowShelfPercent,
  clampHeroBooksFanCollageOffsetXPx,
  clampHeroBooksFanCollageOffsetYPx,
  clampHeroBooksFanGapPx,
  clampHeroBooksFanScalePct,
  clampHeroImagePosPct,
  clampHeroImageScalePct,
  clampHeroFullImageCardBlurPx,
  clampHeroFullImageCardOpacityPct,
  clampHeroTitleLineHeightPct,
  clampHeroTitleSizePct,
  normalizeHeroBooksFanArrangement,
  normalizeHeroBooksFanZOrder,
  normalizeHeroFullImageCardBgHex,
} from '../../data/heroSlides';
import { SUBJECT_PAGES } from '../../data/subjectPages';
import {
  FYZIKA_CHEMIE_PRINCIPLES,
  MATEMATIKA_1_STUPEN_PRINCIPLES,
  MATEMATIKA_2_STUPEN_PRINCIPLES,
  PRIRODOPIS_PRINCIPLES,
  PRVOUKA_PRINCIPLES,
} from '../../data/subjectMethodPrinciples';
import { DEFAULT_NOTIFICATIONS } from '../../data/notifications';
import { ImagePicker } from './ImagePicker';
import {
  getMerchCategoryLabel,
  getMerchSubcategoryLabel,
  type MerchBrowseState,
} from '../../utils/merchProducts';

function isHeroBooksFanLayout(d: { layout?: string }) {
  return (
    d.layout === 'books-fan' ||
    d.layout === 'books-fan-below' ||
    d.layout === 'books-fan-above'
  );
}

interface FieldDef {
  key: string;
  label: string;
  type: 'text' | 'textarea' | 'select' | 'number' | 'url' | 'image' | 'imageGallery' | 'color' | 'boolean' | 'json';
  options?: { value: string; label: string }[];
  placeholder?: string;
  fullWidth?: boolean;
  hint?: string;
  showIf?: (data: any) => boolean;
  /** U textarea vždy ukládat řetězec (nepokoušet se JSON.parse — rozbije Hero text a poznámky). */
  plainText?: boolean;
}

// ── Field Definitions ────────────────────────────────────────────────────────

const PRODUCT_FIELDS: FieldDef[] = [
  { key: 'name', label: 'Název', type: 'text', fullWidth: true },
  { key: 'category', label: 'Kategorie', type: 'select', options: [
    { value: 'Matematika 1. stupeň', label: 'Matematika 1. stupeň' },
    { value: 'Matematika 2. stupeň', label: 'Matematika 2. stupeň' },
    { value: 'Fyzika', label: 'Fyzika' },
    { value: 'Chemie', label: 'Chemie' },
    { value: 'Přírodopis', label: 'Přírodopis' },
    { value: 'Český jazyk', label: 'Český jazyk' },
    { value: 'Prvouka', label: 'Prvouka' },
    { value: 'Angličtina', label: 'Angličtina' },
    { value: 'Zeměpis', label: 'Zeměpis' },
    { value: 'Dějepis', label: 'Dějepis' },
    { value: 'Ostatní', label: 'Ostatní' },
  ]},
  { key: 'type', label: 'Typ', type: 'select', options: [
    { value: 'online', label: 'Digitální licence' },
    { value: 'workbook', label: 'Pracovní sešit' },
    { value: 'vividboard', label: 'Vividboard' },
    { value: 'merch', label: 'Další produkt (merch)' },
  ]},
  {
    key: 'merchCategory',
    label: 'Skupina (dlaždice)',
    type: 'text',
    placeholder: 'např. Plakáty, Žákovské knížky',
    fullWidth: true,
    showIf: (d) => d.type === 'merch',
    hint: 'Zobrazí se jako kategorie nahoře na stránce Další produkty a v admin filtru.',
  },
  {
    key: 'merchSubcategory',
    label: 'Podkategorie (volitelné)',
    type: 'text',
    placeholder: 'např. Na stěnu, A5',
    fullWidth: true,
    showIf: (d) => d.type === 'merch',
  },
  { key: 'price', label: 'Cena', type: 'text', placeholder: '390,-' },
  { key: 'image', label: 'Obrázek produktu', type: 'image', fullWidth: true },
  {
    key: 'images',
    label: 'Další náhledy (galerie)',
    type: 'imageGallery',
    fullWidth: true,
    hint: 'Zobrazí se v detailu produktu pod hlavním obrázkem. Import ze Shoptetu je může doplnit automaticky.',
  },
  { key: 'note', label: 'Poznámka (bobánek)', type: 'text', placeholder: 'Dostupné v dubnu 2026' },
  { key: 'previewLink', label: 'Odkaz na ukázku', type: 'url', fullWidth: true },
  {
    key: 'previewVideoLink',
    label: 'Ukázka videa (URL)',
    type: 'url',
    fullWidth: true,
    hint: 'YouTube, Vimeo nebo přímý odkaz na soubor (.mp4, .webm). V detailu se zobrazí tlačítko vedle „Prolistovat ukázku“.',
  },
  { key: 'appLink', label: 'Odkaz otevřít v aplikaci', type: 'url', fullWidth: true, hint: 'Přímý odkaz pro otevření tohoto produktu v aplikaci Vividbooks. Nechte prázdné, pokud nemá být vlastní deep link.' },
  { key: 'dolozka', label: 'Doložka MŠMT', type: 'text', fullWidth: true },
  { key: 'obsah', label: 'Obsah sešitu (RAG)', type: 'textarea', fullWidth: true, placeholder: 'Kapitola 1: Přirozená čísla\nKapitola 2: Zlomky\n...', hint: 'Zobrazuje se pouze v RAG databázi. Pomáhá AI lépe odpovídat na dotazy.' },
  { key: 'isbn', label: 'ISBN', type: 'text' },
  { key: 'basecomProductId', label: 'Base.com Product ID', type: 'text' },
  { key: 'basecomSku', label: 'Base.com SKU', type: 'text', hint: 'Standardně bereme Shoptet ID. Toto pole slouží jen jako výjimka / override.' },
  { key: 'description', label: 'Popis', type: 'textarea', fullWidth: true },
  { key: 'shopifyVariantId', label: 'Shopify Variant ID', type: 'text' },
  { key: 'shopifyProductId', label: 'Shopify Product ID', type: 'text' },
  { key: 'shoptetId', label: 'Shoptet ID', type: 'text' },
  { key: 'priceMonthly', label: 'Cena měsíc', type: 'text', placeholder: '290,-/měsíc', showIf: (d) => d.type === 'online' },
  { key: 'priceYearly', label: 'Cena rok', type: 'text', placeholder: '2\u00a0900,-/rok', showIf: (d) => d.type === 'online' },
  { key: 'stripeMonthlyUrl', label: 'Stripe — měsíční předplatné', type: 'url', fullWidth: true, placeholder: 'https://buy.stripe.com/...', hint: 'Stripe Checkout link na měsíční předplatné', showIf: (d) => d.type === 'online' },
  { key: 'stripeYearlyUrl', label: 'Stripe — roční předplatné', type: 'url', fullWidth: true, placeholder: 'https://buy.stripe.com/...', hint: 'Stripe Checkout link na roční předplatné', showIf: (d) => d.type === 'online' },
];

const BLOG_FIELDS: FieldDef[] = [
  { key: 'title', label: 'Titulek', type: 'text', fullWidth: true },
  { key: 'slug', label: 'Slug (URL)', type: 'text' },
  { key: 'category', label: 'Kategorie', type: 'text' },
  { key: 'author', label: 'Autor', type: 'text' },
  { key: 'date', label: 'Datum', type: 'text', placeholder: '1. března 2026' },
  { key: 'readTime', label: 'Doba čtení (min)', type: 'number' },
  { key: 'coverImage', label: 'Obrázek článku', type: 'image', fullWidth: true },
  { key: 'excerpt', label: 'Výtah', type: 'textarea', fullWidth: true },
];

const NOVINKY_FIELDS: FieldDef[] = [
  { key: 'title', label: 'Titulek', type: 'text', fullWidth: true },
  { key: 'slug', label: 'Slug (URL)', type: 'text' },
  { key: 'category', label: 'Kategorie', type: 'text' },
  { key: 'author', label: 'Autor', type: 'text' },
  { key: 'date', label: 'Datum', type: 'text', placeholder: '1. března 2026' },
  { key: 'readTime', label: 'Doba čtení (min)', type: 'number' },
  { key: 'bgColor', label: 'Barva pozadí', type: 'color' },
  { key: 'tileText', label: 'Text dlaždice', type: 'text' },
  { key: 'coverImage', label: 'Obrázek novinky', type: 'image', fullWidth: true },
  { key: 'excerpt', label: 'Výtah', type: 'textarea', fullWidth: true },
];

const WEBINAR_FIELDS: FieldDef[] = [
  { key: 'title', label: 'Titulek', type: 'text', fullWidth: true },
  { key: 'subtitle', label: 'Podtitulek', type: 'text', fullWidth: true },
  { key: 'day', label: 'Den', type: 'number' },
  { key: 'monthName', label: 'Měsíc (název)', type: 'text', placeholder: 'Březen' },
  { key: 'monthNum', label: 'Měsíc (číslo)', type: 'number' },
  { key: 'year', label: 'Rok', type: 'number' },
  { key: 'time', label: 'Čas', type: 'text', placeholder: '18:00' },
  { key: 'lecturer', label: 'Lektor', type: 'text' },
  { key: 'lecturerAvatar', label: 'Avatar lektora', type: 'image', fullWidth: true },
  { key: 'description', label: 'Popis', type: 'textarea', fullWidth: true },
  { key: 'perks', label: 'Výhody', type: 'textarea', fullWidth: true },
  { key: 'targetAudience', label: 'Cílová skupina', type: 'text' },
  { key: 'isPast', label: 'Proběhl', type: 'boolean' },
];

const HERO_SLIDE_FIELDS: FieldDef[] = [
  {
    key: 'title',
    label: 'Nadpis',
    type: 'text',
    fullWidth: true,
    hint: 'Nadpis se zalamuje; v pevné výšce hero (400px) jde textový blok při přetečení lehce posunout (scroll). Tooltip zobrazí celý text.',
  },
  {
    key: 'subtitle',
    label: 'Podnadpis',
    type: 'textarea',
    fullWidth: true,
    hint: 'Hero má výšku 400px; delší podnadpis je vidět po posunu v textovém bloku (scroll), nebo zkrátěte copy.',
  },
  {
    key: 'titleFont',
    label: 'Font nadpisu',
    type: 'select',
    options: HERO_TITLE_FONT_OPTIONS.map((o) => ({ value: o.value, label: o.label })),
    hint: 'Skript a Visby: viz `globals.css` a Supabase bucket Admin math / `public/fonts/README.md`. Skript (TTF) je na Supabase; Visby nahrajte jako VisbyRoundCF-DemiBold.otf nebo lokálně do public/fonts.',
  },
  {
    key: 'layout',
    label: 'Layout',
    type: 'select',
    options: [
      { value: 'center', label: 'Text na středu' },
      { value: 'left-image', label: 'Text vlevo + obrázek' },
      { value: 'hero-full-image', label: 'Fotka na celý slide + text v kartách' },
      { value: 'books-fan', label: 'Text vlevo + obálky titulů (hover, klik → produkt)' },
      { value: 'books-fan-below', label: 'Text na střed + obálky pod (klik → produkt)' },
      { value: 'books-fan-above', label: 'Obálky nahoře + text pod (klik → produkt)' },
    ],
  },
  {
    key: 'heroTextAlign',
    label: 'Zarovnání textu (layout střed)',
    type: 'select',
    options: [
      { value: '', label: 'Na střed (výchozí)' },
      { value: 'start', label: 'Vlevo bez obrázku (jako „text na bok“)' },
    ],
    hint: 'Jen u layoutu „Text na středu“. Pro vizuální úpravu použijte také /admin/visual-editor.',
    showIf: (d) => d.layout === 'center',
  },
  { key: 'bg', label: 'Barva pozadí', type: 'color' },
  {
    key: 'heroTextColor',
    label: 'Barva textu (HEX)',
    type: 'color',
    hint: 'Volitelně — nadpis, podnadpis, odznaky a CTA v této barvě (kromě světlých slidů).',
  },
  {
    key: 'titleTiltMode',
    label: 'Režim náklonu nadpisu',
    type: 'select',
    options: [
      { value: '', label: 'Žádný / jen úhel níže (zpětná kompatibilita)' },
      { value: 'none', label: 'Žádný náklon' },
      { value: 'uniform', label: 'Nahnutý celý nadpis (° níže)' },
      { value: 'playful', label: 'Hravý — každé slovo jinak' },
      { value: 'fan', label: 'Vějíř — oblouk nahoru' },
    ],
    hint: 'Ve vizuálním editoru je přehlednější výběr. Úhel platí jen u „uniform“.',
  },
  {
    key: 'titleTiltDeg',
    label: 'Úhel náklonu celého nadpisu (°)',
    type: 'number',
    hint: 'Jen při režimu „uniform“ nebo když není vyplněn titleTiltMode a úhel ≠ 0. Doporučeno cca −12 až 12.',
  },
  {
    key: 'titleUnderlines',
    label: 'Zvýraznění v nadpisu — pill (JSON)',
    type: 'textarea',
    fullWidth: true,
    placeholder: '[[0,4],[10,15]]',
    hint: 'Intervaly znaků [začátek, konec] — na webu zakulacené podbarvení (pill). Ve vizuálním editoru přidáte kliknutím.',
  },
  {
    key: 'titlePillHighlightColor',
    label: 'Barva pozadí pill (HEX)',
    type: 'color',
    hint: 'Volitelné. Prázdné = podle barvy textu slidu (směs s bílou). Ve vizuálním editoru je výběr + Auto.',
  },
  {
    key: 'titlePillHighlightTextColor',
    label: 'Barva textu ve zvýraznění (HEX)',
    type: 'color',
    hint: 'Volitelné. Prázdné = stejná jako barva nadpisu / textu slidu.',
  },
  {
    key: 'heroBlockGapPx',
    label: 'Mezery mezi bloky na slidu (px)',
    type: 'number',
    hint: 'Svislý rozestup mezi nadpisem, podnadpisem, odznaky, spodním textem a CTA (0–56 px, výchozí 12). Ve vizuálním editoru je posuvník v sekci Bloky na slidu.',
  },
  {
    key: 'heroTitleLineHeightPct',
    label: 'Proklad řádků v nadpisu (%)',
    type: 'number',
    hint: 'Řádkování víceřádkového nadpisu: 92–155 % (výchozí 108 ≈ 1,08). Ve vizuálním editoru je posuvník vedle mezer mezi bloky.',
  },
  {
    key: 'heroTitleSizePct',
    label: 'Velikost nadpisu (%)',
    type: 'number',
    hint: '65–135 %, výchozí 100. Násobí responzivní velikost nadpisu (clamp); ve vizuálním editoru je posuvník u prokladu.',
  },
  { key: 'order', label: 'Pořadí', type: 'number' },
  {
    key: 'image',
    label: 'Obrázek slidu',
    type: 'image',
    fullWidth: true,
    hint: 'Doporučený poměr cca 16∶9 nebo širší horizontál; u layoutů s fotkou se výplň ořezává (object-cover).',
    showIf: (d) => d.layout === 'left-image' || d.layout === 'hero-full-image',
  },
  {
    key: 'imageEdgeToEdge',
    label: 'Fotka až ke kraji slidu',
    type: 'boolean',
    hint: 'Jen u layoutu „text vlevo + obrázek“: fotka bez odsazení od pravého a svislého okraje slidu.',
    showIf: (d) => d.layout === 'left-image',
  },
  {
    key: 'imageColumnPercent',
    label: 'Podíl fotky (%)',
    type: 'number',
    hint: 'Jen u layoutu vlevo + obrázek: šířka obrázku v % (28–55, výchozí 38). Zbytek připadá na text.',
    showIf: (d) => d.layout === 'left-image',
  },
  {
    key: 'heroImageColumnAlign',
    label: 'Text — zarovnání ve sloupci / textové zóně',
    type: 'select',
    options: [
      { value: '', label: 'Vlevo (výchozí)' },
      { value: 'center', label: 'Na střed' },
    ],
    hint: 'U fotky vlevo / fullscreen: zarovnání textu nebo sloupce s kartami. U slidů s obálkami produktů: stejné pro text vedle nebo nad/pod koláží.',
    showIf: (d) =>
      d.layout === 'left-image' ||
      d.layout === 'hero-full-image' ||
      isHeroBooksFanLayout(d),
  },
  {
    key: 'heroImageScalePct',
    label: 'Přiblížení fotky (%)',
    type: 'number',
    hint: '100–200, výchozí 100. Větší = víc ořezu (zoom).',
    showIf: (d) => d.layout === 'left-image' || d.layout === 'hero-full-image',
  },
  {
    key: 'heroImagePosXPct',
    label: 'Posun ořezu X (%)',
    type: 'number',
    hint: '0–100, výchozí 50 (object-position).',
    showIf: (d) => d.layout === 'left-image' || d.layout === 'hero-full-image',
  },
  {
    key: 'heroImagePosYPct',
    label: 'Posun ořezu Y (%)',
    type: 'number',
    hint: '0–100, výchozí 50.',
    showIf: (d) => d.layout === 'left-image' || d.layout === 'hero-full-image',
  },
  {
    key: 'heroFullImageCardBgHex',
    label: 'Podbarvení karet — barva (HEX)',
    type: 'color',
    hint: 'Jen u „fotka na celý slide“: základní barva pod nadpisem, podnadpisem atd. (neprůhlednost níže).',
    showIf: (d) => d.layout === 'hero-full-image',
  },
  {
    key: 'heroFullImageCardOpacityPct',
    label: 'Podbarvení karet — neprůhlednost (%)',
    type: 'number',
    hint: '0–100. 0 = zcela průhledné (efekt jen při zapnutém rozostření). Výchozí v editoru 88.',
    showIf: (d) => d.layout === 'hero-full-image',
  },
  {
    key: 'heroFullImageCardBlurPx',
    label: 'Podbarvení karet — rozostření fotky (px)',
    type: 'number',
    hint: '0–24. 0 = žádné „sklo“; větší = silnější backdrop blur za kartou.',
    showIf: (d) => d.layout === 'hero-full-image',
  },
  {
    key: 'bookProductIds',
    label: 'ID produktů (obálky)',
    type: 'textarea',
    fullWidth: true,
    placeholder: '["id1","id2"] nebo id1, id2, id3',
    hint: 'Max. 6 obálek. Ve vizuálním editoru vyberete produkty zaškrtnutím; zde lze zadat ID ručně (JSON nebo id1, id2).',
    showIf: (d) => isHeroBooksFanLayout(d),
  },
  {
    key: 'booksFanArrangement',
    label: 'Poskládání obálek',
    type: 'select',
    options: [
      { value: 'grid', label: 'Mřížka' },
      { value: 'row', label: 'Řada' },
      { value: 'fan', label: 'Vějíř' },
    ],
    hint: 'Mřížka 3×2, řada v jedné linii, vějíř s náklonem.',
    showIf: (d) => isHeroBooksFanLayout(d),
  },
  {
    key: 'booksFanZOrder',
    label: 'Vrstvení vějíře (co je nahoře)',
    type: 'select',
    options: [
      { value: 'middle', label: 'Střed' },
      { value: 'right', label: 'Pravá strana' },
      { value: 'left', label: 'Levá strana' },
    ],
    hint: 'Jen u vějíře: která obálka překrývá ostatní.',
    showIf: (d) =>
      isHeroBooksFanLayout(d) && String(d.booksFanArrangement || '').toLowerCase() === 'fan',
  },
  {
    key: 'booksFanScalePct',
    label: 'Velikost obálek (%)',
    type: 'number',
    hint: '55–300 % základního rozměru (vizuální editor má posuvník).',
    showIf: (d) => isHeroBooksFanLayout(d),
  },
  {
    key: 'booksFanGapPx',
    label: 'Mezery mezi obálkami (px)',
    type: 'number',
    hint: 'Záporné = překryv. Rozsah cca −48 až 48.',
    showIf: (d) => isHeroBooksFanLayout(d),
  },
  {
    key: 'booksFanColumnPercent',
    label: 'Šířka prostoru pro sešity (%)',
    type: 'number',
    hint: 'Jen u layoutu „text vlevo + obálky“: 28–55 % šířky hero pro sloupec s obálkami. Výchozí 48.',
    showIf: (d) => d.layout === 'books-fan',
  },
  {
    key: 'booksFanBelowShelfPercent',
    label: 'Výška prostoru pro sešity (%)',
    type: 'number',
    hint: 'Jen u skládaných layoutů (obálky pod nebo nahoře): min. výška pásu s koláží (v % výšky hero). Koláž může překrývat text.',
    showIf: (d) => d.layout === 'books-fan-below' || d.layout === 'books-fan-above',
  },
  {
    key: 'booksFanCollageOffsetXPx',
    label: 'Koláž obálek — posun X (px)',
    type: 'number',
    hint: 'Layouty s obálkami: vodorovný posun celé koláže (−200 až 200).',
    showIf: (d) => isHeroBooksFanLayout(d),
  },
  {
    key: 'booksFanCollageOffsetYPx',
    label: 'Koláž obálek — posun Y (px)',
    type: 'number',
    hint: 'Kladné Y = koláž k textu (překryv): u „obálek pod“ nahoru, u „obálky nahoře“ dolů. Zrcadlí se do booksFanBelowLiftPx.',
    showIf: (d) => isHeroBooksFanLayout(d),
  },
  { key: 'badges', label: 'Odznaky (JSON)', type: 'textarea', placeholder: '["Doložky MŠMT"]', fullWidth: true },
  {
    key: 'bottom',
    label: 'Spodní text',
    type: 'text',
    fullWidth: true,
    hint: 'Zobrazí se pod odznaky; při přetečení výšky hero lze text v bloku posunout (scroll). Pro dlouhé sdělení raději odkaz slidu.',
  },
  {
    key: 'ctaLabel',
    label: 'Text CTA tlačítka',
    type: 'text',
    fullWidth: true,
    hint: 'Volitelné fialové tlačítko pod spodním textem. Cílová adresa je společná s polem „Odkaz při kliknutí“ níže.',
  },
  {
    key: 'link',
    label: 'Odkaz při kliknutí (slide i CTA)',
    type: 'url',
    fullWidth: true,
    placeholder: '/predmet/matematika nebo https://…',
    hint: 'Jedna adresa pro klik na celý slide i pro tlačítko CTA (pokud má text). HTTPS se otevře v novém panelu.',
  },
  { key: 'isActive', label: 'Aktivní', type: 'boolean' },
  { key: 'distributorTitle', label: 'Nadpis (distributoři)', type: 'text', fullWidth: true },
  { key: 'distributorBg', label: 'Barva (distributoři)', type: 'color' },
  { key: 'distributorBottom', label: 'Spodní text (distributoři)', type: 'text', fullWidth: true },
];

const SUBJECT_PAGE_FIELDS: FieldDef[] = [
  { key: 'displayName', label: 'Název předmětu', type: 'text', fullWidth: true },
  { key: 'slug', label: 'Slug (URL)', type: 'text' },
  { key: 'order', label: 'Pořadí', type: 'number' },
  { key: 'tagline', label: 'Tagline', type: 'text', fullWidth: true },
  {
    key: 'heroText',
    label: 'Hero text (stránka předmětu)',
    type: 'textarea',
    plainText: true,
    fullWidth: true,
    placeholder:
      'Sem vložte text úvodu autora, který se zobrazí po rozkliknutí (čistý text, bez HTML).',
    hint:
      'Podtržený řádek nad textem je na webu ve tvaru „Čím je naše/náš [název předmětu] unikátní? Úvodní slovo autora:“ (název a „naše“/„náš“ z kódu). Toto pole = obsah po rozkliknutí. Když je prázdné, použije se záložní „Hero: text“ níže.',
  },
  { key: 'authorIntroHeading', label: 'Hero: nadpis (záloha)', type: 'text', fullWidth: true, placeholder: 'Nepoužívá se na webu u podtrženého řádku', hint: 'Historické pole; podtržený řádek v hero je šablona z kódu. Můžete nechat prázdné.' },
  { key: 'authorIntroBody', label: 'Hero: text po kliknutí (záloha)', type: 'textarea', plainText: true, fullWidth: true, placeholder: 'Použije se jen když je Hero text prázdný', hint: 'Volitelné; bez HTML.' },
  { key: 'heroColor', label: 'Hero barva (světlá)', type: 'color' },
  { key: 'heroColorDark', label: 'Hero barva (tmavá)', type: 'color' },
  { key: 'accentColor', label: 'Akcentová barva', type: 'color' },
  { key: 'isActive', label: 'Aktivní', type: 'boolean' },
  { key: 'grades', label: 'Stupně (JSON)', type: 'textarea', placeholder: '["2. stupeň", "1. stupeň"]' },
  { key: 'stats', label: 'Statistiky (JSON)', type: 'textarea', placeholder: '[{"value":"30+","label":"sešitů"}]', fullWidth: true },
  { key: 'features', label: 'Features (JSON)', type: 'textarea', placeholder: '[{"title":"...","desc":"..."}]', fullWidth: true },
  { key: 'topics', label: 'Témata (JSON)', type: 'textarea', placeholder: '[{"grade":"2. stupeň","items":[...]}]', fullWidth: true },
  { key: 'rvpNote', label: 'RVP poznámka', type: 'textarea', fullWidth: true },
  { key: 'dolozka', label: 'Doložka MŠMT', type: 'text', fullWidth: true },
];

const NOTIFICATION_FIELDS: FieldDef[] = [
  { key: 'title', label: 'Nadpis', type: 'text', fullWidth: true },
  { key: 'subtitle', label: 'Podnadpis', type: 'text', fullWidth: true },
  { key: 'type', label: 'Typ', type: 'select', options: [{ value: 'custom', label: 'Vlastní bobánek' }, { value: 'slider', label: 'Slider' }] },
  { key: 'emoji', label: 'Emoji', type: 'text', placeholder: '🔔' },
  { key: 'link', label: 'Odkaz', type: 'url', fullWidth: true },
  { key: 'order', label: 'Pořadí', type: 'number' },
  { key: 'isActive', label: 'Aktivní', type: 'boolean' },
  { key: 'sliderBg', label: 'Slider: barva pozadí', type: 'color' },
  { key: 'sliderLayout', label: 'Slider: layout', type: 'select', options: [{ value: 'center', label: 'Na středu' }, { value: 'left-image', label: 'Vlevo + obrázek' }] },
  { key: 'sliderImage', label: 'Slider: obrázek', type: 'image', fullWidth: true },
  { key: 'sliderBadges', label: 'Slider: odznaky (JSON)', type: 'textarea', placeholder: '["Nové"]', fullWidth: true },
  { key: 'sliderBottom', label: 'Slider: spodní text', type: 'text', fullWidth: true },
  { key: 'ctaLabel', label: 'Slider: text CTA tlačítka', type: 'text', fullWidth: true },
  { key: 'ctaLink', label: 'Slider: odkaz CTA tlačítka', type: 'url', fullWidth: true, placeholder: 'Nebo použije se pole Odkaz výše' },
];

const TABS_FIELDS: FieldDef[] = [
  { key: 'tabText', label: 'Tab Text', type: 'text', fullWidth: true, placeholder: 'např. Učební text, Animace, Cvičení' },
  { key: 'contentHeadline', label: 'Content Headline', type: 'text', fullWidth: true },
  { key: 'contentRichText', label: 'Content Rich Text', type: 'textarea', fullWidth: true, placeholder: '✅ Obsahují aktivizační otázky...', hint: 'Automaticky indexováno do RAG. Zadej čistý text (bez HTML tagů).' },
  { key: 'contentImage', label: 'Content Image', type: 'image', fullWidth: true },
  { key: 'subject', label: 'Subject (předmět)', type: 'text', placeholder: 'např. Fyzika', hint: 'Musí přesně odpovídat DisplayName předmětu — tab se zobrazí jen tam.' },
  { key: 'subpage', label: 'Subpage', type: 'text', placeholder: 'např. Minihy' },
  { key: 'order', label: 'Pořadí', type: 'number' },
  { key: 'bgColor', label: 'BG Color', type: 'color' },
];

const COLLECTION_CONFIG: Record<string, {
  fields: FieldDef[];
  nameKey: string;
  subtitleKey?: string;
  imageKey?: string;
  apiName: CollectionName | 'produkty';
  staticData?: any[];
  seedKey?: string;
  displayName: string;
}> = {
  produkty: { fields: PRODUCT_FIELDS, nameKey: 'name', subtitleKey: 'category', imageKey: 'image', apiName: 'produkty', displayName: 'Produkty' },
  blog: { fields: BLOG_FIELDS, nameKey: 'title', subtitleKey: 'category', imageKey: 'coverImage', apiName: 'blog', staticData: BLOG_POSTS, seedKey: 'blog', displayName: 'Blog' },
  novinky: { fields: NOVINKY_FIELDS, nameKey: 'title', subtitleKey: 'category', imageKey: 'coverImage', apiName: 'novinky', staticData: NOVINKA_POSTS, seedKey: 'novinky', displayName: 'Novinky' },
  webinare: { fields: WEBINAR_FIELDS, nameKey: 'title', subtitleKey: 'lecturer', apiName: 'webinare', staticData: WEBINARS, seedKey: 'webinare', displayName: 'Webináře' },
  'hero-slidy': { fields: HERO_SLIDE_FIELDS, nameKey: 'title', subtitleKey: 'subtitle', apiName: 'hero-slidy', staticData: HERO_SLIDES, seedKey: 'hero-slidy', displayName: 'Hero slidy' },
  predmety: { fields: SUBJECT_PAGE_FIELDS, nameKey: 'displayName', subtitleKey: 'tagline', apiName: 'predmety', staticData: SUBJECT_PAGES, seedKey: 'predmety', displayName: 'Předměty' },
  notifikace: { fields: NOTIFICATION_FIELDS, nameKey: 'title', subtitleKey: 'type', apiName: 'notifikace', staticData: DEFAULT_NOTIFICATIONS, seedKey: 'notifikace', displayName: 'Notifikace' },
  tabs: { fields: TABS_FIELDS, nameKey: 'tabText', subtitleKey: 'subject', imageKey: 'contentImage', apiName: 'tabs', displayName: 'Taby (prodejní argumenty)' },
};

function normalizeImageGalleryUrls(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw
      .filter((u): u is string => typeof u === 'string' && u.trim().length > 0)
      .map((u) => u.trim());
  }
  if (typeof raw === 'string' && raw.trim()) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return normalizeImageGalleryUrls(parsed);
    } catch {
      /* single string or newline-separated */
    }
    return raw
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
}

function ImageGalleryField({ fieldKey, editData, updateField }: { fieldKey: string; editData: any; updateField: (k: string, v: any) => void }) {
  const [addPickerKey, setAddPickerKey] = useState(0);
  const urls = normalizeImageGalleryUrls(editData[fieldKey]);

  const setUrls = (next: string[]) => {
    updateField(fieldKey, next);
  };

  const removeAt = (idx: number) => {
    const next = urls.filter((_, i) => i !== idx);
    setUrls(next);
  };

  const move = (idx: number, dir: -1 | 1) => {
    const j = idx + dir;
    if (j < 0 || j >= urls.length) return;
    const next = [...urls];
    [next[idx], next[j]] = [next[j], next[idx]];
    setUrls(next);
  };

  return (
    <div className="space-y-3">
      {urls.length === 0 ? (
        <p className="text-[12px] text-gray-400 italic">Žádné další náhledy — přidej z galerie nebo nahraj soubor níže.</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {urls.map((url, idx) => (
            <div
              key={`${idx}-${url.slice(-24)}`}
              className="relative group rounded-xl overflow-hidden border border-gray-100 bg-gray-50"
              style={{ height: 100 }}
            >
              <img
                src={url}
                alt=""
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.opacity = '0.25';
                }}
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/35 transition-all flex items-end justify-center gap-1 pb-1.5 opacity-0 group-hover:opacity-100">
                <button
                  type="button"
                  onClick={() => move(idx, -1)}
                  disabled={idx === 0}
                  className="bg-white text-[#001161] text-[10px] font-bold px-2 py-1 rounded-lg shadow disabled:opacity-40"
                >
                  ←
                </button>
                <button
                  type="button"
                  onClick={() => move(idx, 1)}
                  disabled={idx === urls.length - 1}
                  className="bg-white text-[#001161] text-[10px] font-bold px-2 py-1 rounded-lg shadow disabled:opacity-40"
                >
                  →
                </button>
                <button
                  type="button"
                  onClick={() => removeAt(idx)}
                  className="bg-red-500 text-white text-[10px] font-bold px-2 py-1 rounded-lg shadow hover:bg-red-600"
                >
                  Odstranit
                </button>
              </div>
              <a
                href={url}
                target="_blank"
                rel="noreferrer"
                className="absolute top-1 right-1 text-[9px] font-bold bg-white/90 text-[#001161] px-1.5 py-0.5 rounded-md shadow opacity-0 group-hover:opacity-100"
              >
                Otevřít
              </a>
            </div>
          ))}
        </div>
      )}
      <div className="border border-dashed border-gray-200 rounded-xl p-2 bg-gray-50/50">
        <p className="text-[10px] text-gray-500 mb-2 font-semibold uppercase tracking-wide">Přidat obrázek do galerie</p>
        <ImagePicker
          key={addPickerKey}
          value=""
          onChange={(url) => {
            if (!url) return;
            const cur = normalizeImageGalleryUrls(editData[fieldKey]);
            if (cur.includes(url)) {
              toast.info('Tento obrázek už v galerii je.');
              setAddPickerKey((k) => k + 1);
              return;
            }
            setUrls([...cur, url]);
            setAddPickerKey((k) => k + 1);
          }}
          compact
          previewHeight={72}
        />
      </div>
    </div>
  );
}

// ── Shared: renderField ─────────────────────────────────────────────────────
function FieldRenderer({ field, editData, updateField }: { field: FieldDef; editData: any; updateField: (k: string, v: any) => void }) {
  if (field.key.startsWith('_') && field.key.endsWith('Section')) {
    return (
      <div className="col-span-2 mt-4 mb-1">
        <div className="flex items-center gap-3">
          <div className="h-px flex-1 bg-gradient-to-r from-[#ff8c66]/40 to-transparent" />
          <span className="text-[11px] font-bold text-[#ff8c66] uppercase tracking-widest px-2">{field.label}</span>
          <div className="h-px flex-1 bg-gradient-to-l from-[#ff8c66]/40 to-transparent" />
        </div>
        {field.hint && <p className="text-[10px] text-gray-400 mt-1.5 text-center">{field.hint}</p>}
      </div>
    );
  }

  const hslaToHex = (v: string): string => {
    if (!v) return '#ffffff';
    if (v.startsWith('#') && (v.length === 4 || v.length === 7)) return v;
    const m = v.match(/hsla?\(\s*([\d.]+)\s*,\s*([\d.]+)%?\s*,\s*([\d.]+)%?/i);
    if (m) {
      const h = parseFloat(m[1]) / 360, s = parseFloat(m[2]) / 100, l = parseFloat(m[3]) / 100;
      const h2r = (p: number, q: number, t: number) => { if (t<0) t+=1; if (t>1) t-=1; if (t<1/6) return p+(q-p)*6*t; if (t<1/2) return q; if (t<2/3) return p+(q-p)*(2/3-t)*6; return p; };
      let r, g, b;
      if (s===0) { r=g=b=l; } else { const q2=l<0.5?l*(1+s):l+s-l*s,p2=2*l-q2; r=h2r(p2,q2,h+1/3); g=h2r(p2,q2,h); b=h2r(p2,q2,h-1/3); }
      const toH = (x: number) => Math.round(x*255).toString(16).padStart(2,'0');
      return `#${toH(r)}${toH(g)}${toH(b)}`;
    }
    return '#ffffff';
  };

  const stripHtmlTags = (html: string) => html
    .replace(/<\/p>/gi,'\n').replace(/<br\s*\/?>/gi,'\n').replace(/<[^>]+>/g,'')
    .replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&nbsp;/g,' ')
    .replace(/\n{3,}/g,'\n\n').trim();

  const renderInput = () => {
    if (field.type === 'textarea') {
      const raw = editData[field.key];
      const displayVal = (typeof raw === 'object' && raw !== null) ? JSON.stringify(raw, null, 2) : (raw || '');
      const hasHtml = typeof displayVal === 'string' && /<[a-z][\s\S]*>/i.test(displayVal);
      return (
        <div>
          {hasHtml && (
            <div className="flex items-center gap-2 mb-1.5 px-2.5 py-1.5 bg-amber-50 border border-amber-200 rounded-lg">
              <span className="text-[10px] text-amber-700 flex-1">Obsahuje HTML tagy</span>
              <button onClick={() => updateField(field.key, stripHtmlTags(displayVal))} className="text-[10px] bg-amber-500 text-white px-2 py-0.5 rounded font-bold hover:bg-amber-600">Stripovat HTML</button>
            </div>
          )}
          <textarea
            value={displayVal}
            onChange={(e) => {
              const v = e.target.value;
              if (field.plainText) {
                updateField(field.key, v);
                return;
              }
              try {
                updateField(field.key, JSON.parse(v));
              } catch {
                updateField(field.key, v);
              }
            }}
            rows={field.plainText ? 6 : typeof raw === 'object' && raw !== null ? 6 : 4}
            className={`w-full px-3 py-2 text-[13px] border border-gray-200 rounded-xl bg-white focus:border-[#001161] focus:ring-1 focus:ring-[#001161]/20 outline-none transition-all resize-y ${typeof raw === 'object' && raw !== null ? 'font-mono text-[11px]' : ''}`}
            placeholder={field.placeholder}
          />
        </div>
      );
    }
    if (field.type === 'select') {
      return (
        <select value={editData[field.key] || ''} onChange={(e) => updateField(field.key, e.target.value)} className="w-full px-3 py-2 text-[13px] border border-gray-200 rounded-xl bg-white focus:border-[#001161] focus:ring-1 focus:ring-[#001161]/20 outline-none transition-all">
          <option value="">-- Vyberte --</option>
          {field.options?.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
        </select>
      );
    }
    if (field.type === 'boolean') {
      return (
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={!!editData[field.key]} onChange={(e) => updateField(field.key, e.target.checked)} className="w-4 h-4 rounded border-gray-300" />
          <span className="text-[13px] text-gray-600">Ano</span>
        </label>
      );
    }
    if (field.type === 'color') {
      const rawColor = editData[field.key] || '';
      return (
        <div className="flex items-center gap-2">
          <input type="color" value={hslaToHex(rawColor)} onChange={(e) => updateField(field.key, e.target.value)} className="w-10 h-10 rounded-lg border border-gray-200 cursor-pointer" />
          <input type="text" value={rawColor} onChange={(e) => updateField(field.key, e.target.value)} className="flex-1 px-3 py-2 text-[13px] border border-gray-200 rounded-xl bg-white focus:border-[#001161] outline-none transition-all" placeholder="#FFFFFF" />
          {rawColor && !rawColor.startsWith('#') && (
            <button onClick={() => updateField(field.key, hslaToHex(rawColor))} className="text-[10px] bg-orange-100 text-orange-700 px-2 py-1 rounded-lg font-bold hover:bg-orange-200 shrink-0">→ HEX</button>
          )}
        </div>
      );
    }
    if (field.type === 'image') {
      return <ImagePicker value={editData[field.key] || ''} onChange={(url) => updateField(field.key, url)} previewHeight={140} />;
    }
    if (field.type === 'imageGallery') {
      return <ImageGalleryField fieldKey={field.key} editData={editData} updateField={updateField} />;
    }
    return (
      <input
        type={field.type === 'number' ? 'number' : field.type === 'url' ? 'url' : 'text'}
        value={editData[field.key] ?? ''}
        onChange={(e) => updateField(field.key, field.type === 'number' ? Number(e.target.value) : e.target.value)}
        className="w-full px-3 py-2 text-[13px] border border-gray-200 rounded-xl bg-white focus:border-[#001161] focus:ring-1 focus:ring-[#001161]/20 outline-none transition-all"
        placeholder={field.placeholder}
      />
    );
  };

  return (
    <div className={field.fullWidth ? 'col-span-2' : ''}>
      <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-1">
        {field.label}
        {field.key.startsWith('stripe') && (
          <span className="ml-2 inline-flex items-center gap-1 bg-[#635BFF]/10 text-[#635BFF] text-[9px] px-1.5 py-0.5 rounded-full font-bold normal-case">
            Stripe
          </span>
        )}
      </label>
      {field.hint && <p className="text-[10px] text-gray-400 mb-1.5">{field.hint}</p>}
      {renderInput()}
    </div>
  );
}

// ── Toggle switch ────────────────────────────────────────────────────────────
function ToggleRow({ fieldKey, label, hint, color = 'orange', editData, updateField }: {
  fieldKey: string; label: string; hint?: string; color?: 'orange' | 'purple' | 'blue';
  editData: any; updateField: (k: string, v: any) => void;
}) {
  const checked = !!editData?.[fieldKey];
  const trackOn = color === 'purple' ? 'bg-[#7C3AED]' : color === 'blue' ? 'bg-[#001161]' : 'bg-[#ff8c66]';
  return (
    <button onClick={() => updateField(fieldKey, !checked)} className="w-full flex items-start gap-3 p-3.5 rounded-xl hover:bg-gray-50 transition-colors text-left group border border-transparent hover:border-gray-100">
      <div className={`relative mt-0.5 w-10 h-5.5 rounded-full transition-all shrink-0 ${checked ? trackOn : 'bg-gray-200'}`} style={{ height: '22px', width: '40px' }}>
        <div className={`absolute top-[3px] w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${checked ? 'translate-x-[20px]' : 'translate-x-[3px]'}`} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-semibold text-gray-700 group-hover:text-[#001161] transition-colors leading-snug">{label}</div>
        {hint && <div className="text-[11px] text-gray-400 mt-0.5 leading-snug">{hint}</div>}
      </div>
    </button>
  );
}

function formatMoneyFromHaler(value: number) {
  return `${(value / 100).toLocaleString('cs-CZ', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} Kč`;
}

function formatDateTime(value?: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleString('cs-CZ', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function shippingMethodLabel(method?: string | null) {
  switch (method) {
    case 'dpd':
      return 'DPD';
    case 'zasilkovna':
      return 'Zásilkovna';
    case 'gls':
      return 'GLS';
    case 'ppl':
      return 'PPL';
    default:
      return method || '—';
  }
}

function ProductCommercePanel({
  editData,
  onProductPatched,
}: {
  editData: any;
  onProductPatched: (updates: Record<string, unknown>) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [data, setData] = useState<any>(null);
  const [syncing, setSyncing] = useState(false);

  const loadCommerce = useCallback(async () => {
    if (!editData?.id) return;
    setLoading(true);
    setError('');
    try {
      const commerce = await fetchAdminProductCommerce({
        productId: editData.id,
        productName: editData.name || '',
        shoptetId: editData.shoptetId || editData.shoptetProductId || '',
        isbn: editData.isbn || editData.metadata?.isbn || '',
        ean: editData.metadata?.ean || '',
      });
      setData(commerce);
    } catch (e: any) {
      setError(e.message || 'Nepodařilo se načíst e-shop data.');
    } finally {
      setLoading(false);
    }
  }, [editData?.id, editData?.name, editData?.shoptetId, editData?.shoptetProductId]);

  useEffect(() => {
    void loadCommerce();
  }, [loadCommerce]);

  const stock = data?.stock;
  const summary = data?.sales?.summary;
  const destinations = data?.sales?.destinations || [];
  const history = data?.sales?.history || [];

  const handleBaseSync = async () => {
    if (!editData?.id) return;

    setSyncing(true);
    try {
      const result = await runAdminProductBaseSync(editData);
      const patch: Record<string, unknown> = {};

      if (result.basecomProductId && result.basecomProductId !== editData.basecomProductId) {
        patch.basecomProductId = result.basecomProductId;
      }
      if (result.basecomSku && result.basecomSku !== editData.basecomSku) {
        patch.basecomSku = result.basecomSku;
      }

      if (Object.keys(patch).length > 0) {
        await updateProduct(editData.id, patch);
        onProductPatched(patch);
      }

      toast.success(
        result.mode === 'created'
          ? 'Produkt byl vytvořen v Base.com.'
          : 'Produkt byl aktualizován v Base.com.',
      );
      await loadCommerce();
    } catch (e: any) {
      toast.error(e.message || 'Synchronizace do Base.com selhala.');
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h4 className="text-[15px] font-bold text-[#001161]">Eshop</h4>
          <p className="text-[12px] text-gray-500 mt-0.5">Sklad, Base.com mapování, prodeje a kam se tato položka prodávala.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => void handleBaseSync()}
            disabled={syncing}
            className="px-3 py-1.5 text-[12px] text-white bg-[#001161] hover:bg-[#000d4a] rounded-lg inline-flex items-center gap-2 disabled:opacity-50"
          >
            {syncing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            {syncing ? 'Synchronizuji…' : 'Synchronizovat do Base.com'}
          </button>
          <button
            onClick={() => void loadCommerce()}
            disabled={loading}
            className="px-3 py-1.5 text-[12px] text-[#001161] bg-white border border-gray-200 hover:border-[#001161]/30 rounded-lg"
          >
            {loading ? 'Načítám…' : 'Obnovit data'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-gray-100 bg-white p-4">
          <div className="flex items-center gap-2 text-gray-400 text-[12px] uppercase tracking-wide"><Package className="w-4 h-4" />Sklad</div>
          <div className="mt-2 text-2xl font-bold text-[#001161]">
            {typeof stock?.quantity === 'number' ? `${stock.quantity} ks` : '—'}
          </div>
          <div className="mt-1 text-[12px] text-gray-500">
            {stock?.inventoryName
              ? `${stock.inventoryName}${stock.warehouseId ? ` / ${stock.warehouseId}` : ''}`
              : stock?.error || 'Bez napojení skladu'}
          </div>
        </div>
        <div className="rounded-2xl border border-gray-100 bg-white p-4">
          <div className="flex items-center gap-2 text-gray-400 text-[12px] uppercase tracking-wide"><ShoppingCart className="w-4 h-4" />Prodáno kusů</div>
          <div className="mt-2 text-2xl font-bold text-[#001161]">{summary?.total_units_sold ?? 0}</div>
          <div className="mt-1 text-[12px] text-gray-500">{summary?.last_sold_at ? `Naposledy ${formatDateTime(summary.last_sold_at)}` : 'Zatím bez prodeje'}</div>
        </div>
        <div className="rounded-2xl border border-gray-100 bg-white p-4">
          <div className="flex items-center gap-2 text-gray-400 text-[12px] uppercase tracking-wide"><BarChart3 className="w-4 h-4" />Objednávky</div>
          <div className="mt-2 text-2xl font-bold text-[#001161]">{summary?.total_orders ?? 0}</div>
          <div className="mt-1 text-[12px] text-gray-500">{summary?.first_sold_at ? `Od ${formatDateTime(summary.first_sold_at)}` : 'Žádná objednávka'}</div>
        </div>
        <div className="rounded-2xl border border-gray-100 bg-white p-4">
          <div className="flex items-center gap-2 text-gray-400 text-[12px] uppercase tracking-wide"><MapPin className="w-4 h-4" />Obrat</div>
          <div className="mt-2 text-2xl font-bold text-[#001161]">{formatMoneyFromHaler(summary?.total_revenue ?? 0)}</div>
          <div className="mt-1 text-[12px] text-gray-500">{destinations.length} destinací</div>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white p-4">
        <h5 className="text-[13px] font-bold text-[#001161] mb-3">Identifikátory e-shopu</h5>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[13px]">
          <div><span className="text-gray-400">Vivid ID: </span><span className="font-semibold text-[#001161]">{editData.id || '—'}</span></div>
          <div><span className="text-gray-400">Shoptet ID: </span><span className="font-semibold text-[#001161]">{editData.shoptetId || editData.shoptetProductId || '—'}</span></div>
          <div><span className="text-gray-400">Base.com SKU: </span><span className="font-semibold text-[#001161]">{editData.shoptetId || editData.basecomSku || stock?.matchedProductSku || editData.metadata?.ean || editData.isbn || '—'}</span></div>
          <div><span className="text-gray-400">Base.com Product ID: </span><span className="font-semibold text-[#001161]">{editData.basecomProductId || stock?.matchedProductId || '—'}</span></div>
          <div><span className="text-gray-400">EAN: </span><span className="font-semibold text-[#001161]">{stock?.matchedProductEan || editData.metadata?.ean || '—'}</span></div>
          <div><span className="text-gray-400">Shopify Variant ID: </span><span className="font-semibold text-[#001161] break-all">{editData.shopifyVariantId || '—'}</span></div>
          <div><span className="text-gray-400">Shopify Product ID: </span><span className="font-semibold text-[#001161] break-all">{editData.shopifyProductId || '—'}</span></div>
        </div>
        <div className="mt-3 rounded-xl bg-blue-50 border border-blue-200 px-3 py-2 text-[12px] text-blue-800">
          {'Tlačítko synchronizuje aktuální produkt do Base.com katalogu a jako SKU používá primárně Shoptet ID. Vrácené Base.com Product ID a SKU se uloží zpět do produktu.'}
        </div>
        {stock?.matched && (
          <div className="mt-3 rounded-xl bg-emerald-50 border border-emerald-200 px-3 py-2 text-[12px] text-emerald-800">
            {`Spárováno s Base.com produktem ${stock.matchedProductName || stock.matchedProductId || '—'}${stock.matchType ? ` (${stock.matchType})` : ''}`}
          </div>
        )}
        {stock?.error && (
          <div className="mt-3 rounded-xl bg-amber-50 border border-amber-200 px-3 py-2 text-[12px] text-amber-800">
            {stock.error}
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white p-4">
        <h5 className="text-[13px] font-bold text-[#001161] mb-3">Kam se prodávalo</h5>
        {error ? (
          <div className="text-[13px] text-red-600">{error}</div>
        ) : loading && !data ? (
          <div className="text-[13px] text-gray-500">Načítám…</div>
        ) : destinations.length === 0 ? (
          <div className="text-[13px] text-gray-500">Zatím bez prodejů této položky.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left">
              <thead className="border-b border-gray-100 text-[11px] uppercase tracking-[0.08em] text-gray-500">
                <tr>
                  <th className="py-2 pr-4">Kam</th>
                  <th className="py-2 pr-4">Město</th>
                  <th className="py-2 pr-4">Kusů</th>
                  <th className="py-2 pr-4">Objednávek</th>
                  <th className="py-2">Naposledy</th>
                </tr>
              </thead>
              <tbody>
                {destinations.map((row: any, idx: number) => (
                  <tr key={`${row.customer_name}-${row.city}-${idx}`} className="border-b border-gray-100 last:border-none">
                    <td className="py-2 pr-4">
                      <div className="font-semibold text-[#001161]">{row.school_name || row.customer_name}</div>
                      {row.school_name && <div className="text-[12px] text-gray-400">{row.customer_name}</div>}
                    </td>
                    <td className="py-2 pr-4 text-[13px] text-gray-600">{[row.city, row.zip].filter(Boolean).join(' ') || '—'}</td>
                    <td className="py-2 pr-4 text-[13px] font-semibold text-[#001161]">{row.total_units}</td>
                    <td className="py-2 pr-4 text-[13px] text-gray-600">{row.order_count}</td>
                    <td className="py-2 text-[13px] text-gray-600">{formatDateTime(row.last_sold_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white p-4">
        <h5 className="text-[13px] font-bold text-[#001161] mb-3">Historie prodejů</h5>
        {history.length === 0 ? (
          <div className="text-[13px] text-gray-500">Žádná historie prodejů.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left">
              <thead className="border-b border-gray-100 text-[11px] uppercase tracking-[0.08em] text-gray-500">
                <tr>
                  <th className="py-2 pr-4">Objednávka</th>
                  <th className="py-2 pr-4">Datum</th>
                  <th className="py-2 pr-4">Kam</th>
                  <th className="py-2 pr-4">Doprava</th>
                  <th className="py-2 pr-4">Kusů</th>
                  <th className="py-2">Tržba</th>
                </tr>
              </thead>
              <tbody>
                {history.map((row: any) => (
                  <tr key={row.order_id} className="border-b border-gray-100 last:border-none">
                    <td className="py-2 pr-4">
                      <div className="font-semibold text-[#001161]">{row.order_number}</div>
                      <div className="text-[12px] text-gray-400">{row.status}</div>
                    </td>
                    <td className="py-2 pr-4 text-[13px] text-gray-600">{formatDateTime(row.created_at)}</td>
                    <td className="py-2 pr-4">
                      <div className="text-[13px] font-medium text-[#001161]">{row.school_name || row.customer_name}</div>
                      <div className="text-[12px] text-gray-400">{[row.city, row.zip].filter(Boolean).join(' ') || '—'}</div>
                    </td>
                    <td className="py-2 pr-4 text-[13px] text-gray-600">{shippingMethodLabel(row.shipping_method)}</td>
                    <td className="py-2 pr-4 text-[13px] text-gray-600">{row.quantity}</td>
                    <td className="py-2 text-[13px] font-semibold text-[#001161]">{formatMoneyFromHaler(row.total_price)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Section: Nastavení předmětu ──────────────────────────────────────────────
function SectionNastaveni({ editData, updateField, onSave, onDelete, saving, isNew }: {
  editData: any; updateField: (k: string, v: any) => void;
  onSave: () => void; onDelete: () => void; saving: boolean; isNew: boolean;
}) {
  return (
    <div className="flex-1 overflow-y-auto bg-[#f7f8fc]">
      <div className="p-6 max-w-2xl">
        <div className="mb-5">
          <h3 className="text-[15px] font-bold text-[#001161]">Nastavení předmětu</h3>
          {editData.id && <p className="text-[11px] text-gray-400 font-mono mt-0.5">ID: {editData.id}</p>}
        </div>
        <div className="grid grid-cols-2 gap-4">
          {SUBJECT_PAGE_FIELDS.map(field => (
            <FieldRenderer key={field.key} field={field} editData={editData} updateField={updateField} />
          ))}
        </div>
        <div className="mt-6 pt-4 border-t border-gray-200 flex items-center gap-3">
          <button onClick={onSave} disabled={saving} className="flex items-center gap-2 bg-[#001161] hover:bg-[#000d4a] text-white px-6 py-2.5 rounded-xl text-[13px] font-bold transition-colors disabled:opacity-50">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Uložit
          </button>
          {!isNew && editData.id && (
            <button onClick={onDelete} disabled={saving} className="flex items-center gap-1.5 text-[12px] text-red-500 hover:bg-red-50 px-3 py-2.5 rounded-xl transition-colors">
              <Trash2 className="w-3.5 h-3.5" /> Smazat
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Section: Metodické principy (ručně: nadpis, text, obrázek) ───────────────
function SectionMetodickePrincipy({ editData, updateField, onSave, saving }: {
  editData: any;
  updateField: (k: string, v: any) => void;
  onSave: () => void;
  saving: boolean;
}) {
  const items: any[] = Array.isArray(editData?.methodPrinciplesItems) ? editData.methodPrinciplesItems : [];

  const setItems = (next: any[]) => updateField('methodPrinciplesItems', next);

  const slugNorm = String(editData?.slug || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  const showMat1PrinciplesTemplate =
    slugNorm === 'matematika-1-stupen' ||
    (/matematika-1/.test(slugNorm) && !/matematika-2/.test(slugNorm));
  const showMat2PrinciplesTemplate =
    slugNorm === 'matematika-2-stupen' ||
    (/matematika-2/.test(slugNorm) && !/matematika-1/.test(slugNorm));
  const showPrvoukaPrinciplesTemplate = slugNorm === 'prvouka';
  const showPrirodopisPrinciplesTemplate = slugNorm === 'prirodopis';
  const showFyzikaChemiePrinciplesTemplate = slugNorm === 'fyzika' || slugNorm === 'chemie';

  const patchItem = (index: number, patch: Record<string, unknown>) => {
    const copy = items.map((x, i) => (i === index ? { ...x, ...patch } : x));
    setItems(copy);
  };

  return (
    <div className="flex-1 overflow-y-auto bg-[#f7f8fc]">
      <div className="p-6 max-w-3xl">
        <h3 className="text-[15px] font-bold text-[#001161] mb-1">Metodické principy</h3>
        <p className="text-[12px] text-gray-500 leading-relaxed mb-4">
          Slider na stránce předmětu. Ke každé kartě vyplňte nadpis, text a obrázek (nahrání nebo galerie). Pokud zde nic
          neuložíte, web použije výchozí šablonu podle typu předmětu. Bez obrázku se zobrazí jednoduchá dekorace.
        </p>

        <div className="flex flex-wrap items-center gap-2 mb-5">
          {showMat1PrinciplesTemplate && (
            <button
              type="button"
              onClick={() => {
                if (
                  !confirm(
                    'Vyplnit 8 metodických principů pro Matematiku 1. stupeň? Stávající karty v této sekci se přepíšou.',
                  )
                ) {
                  return;
                }
                setItems(
                  MATEMATIKA_1_STUPEN_PRINCIPLES.map((p) => ({
                    title: p.title,
                    body: p.body,
                    visualId: p.visualId,
                    imageUrl: p.imageUrl ?? '',
                  })),
                );
              }}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-[12px] font-bold border border-[#2563eb]/30 bg-[#eff6ff] text-[#001161] hover:border-[#2563eb]/50 transition-colors"
            >
              <Sparkles className="w-3.5 h-3.5 text-[#2563eb]" /> 8 principů (Mat 1. st.)
            </button>
          )}
          {showMat2PrinciplesTemplate && (
            <button
              type="button"
              onClick={() => {
                if (
                  !confirm(
                    'Vyplnit 9 metodických principů pro Matematiku 2. stupeň? Stávající karty v této sekci se přepíšou.',
                  )
                ) {
                  return;
                }
                setItems(
                  MATEMATIKA_2_STUPEN_PRINCIPLES.map((p) => ({
                    title: p.title,
                    body: p.body,
                    visualId: p.visualId,
                    imageUrl: p.imageUrl ?? '',
                  })),
                );
              }}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-[12px] font-bold border border-[#5533DD]/30 bg-[#f5f3ff] text-[#001161] hover:border-[#5533DD]/50 transition-colors"
            >
              <Sparkles className="w-3.5 h-3.5 text-[#5533DD]" /> 9 principů (Mat 2. st.)
            </button>
          )}
          {showFyzikaChemiePrinciplesTemplate && (
            <button
              type="button"
              onClick={() => {
                if (
                  !confirm(
                    'Vyplnit 9 metodických principů pro Fyziku / Chemii (společná sada)? Stávající karty v této sekci se přepíšou.',
                  )
                ) {
                  return;
                }
                setItems(
                  FYZIKA_CHEMIE_PRINCIPLES.map((p) => ({
                    title: p.title,
                    body: p.body,
                    visualId: p.visualId,
                    imageUrl: p.imageUrl ?? '',
                  })),
                );
              }}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-[12px] font-bold border border-[#0099BB]/30 bg-[#e2f8ff] text-[#001161] hover:border-[#0099BB]/50 transition-colors"
            >
              <Sparkles className="w-3.5 h-3.5 text-[#0099BB]" /> 9 principů (Fyzika / Chemie)
            </button>
          )}
          {showPrirodopisPrinciplesTemplate && (
            <button
              type="button"
              onClick={() => {
                if (
                  !confirm(
                    'Vyplnit 9 metodických principů pro Přírodopis? Stávající karty v této sekci se přepíšou.',
                  )
                ) {
                  return;
                }
                setItems(
                  PRIRODOPIS_PRINCIPLES.map((p) => ({
                    title: p.title,
                    body: p.body,
                    visualId: p.visualId,
                    imageUrl: p.imageUrl ?? '',
                  })),
                );
              }}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-[12px] font-bold border border-[#1A9E40]/30 bg-[#e8f9ee] text-[#001161] hover:border-[#1A9E40]/50 transition-colors"
            >
              <Sparkles className="w-3.5 h-3.5 text-[#1A9E40]" /> 9 principů (Přírodopis)
            </button>
          )}
          {showPrvoukaPrinciplesTemplate && (
            <button
              type="button"
              onClick={() => {
                if (
                  !confirm(
                    'Vyplnit 9 metodických principů pro Prvouku? Stávající karty v této sekci se přepíšou.',
                  )
                ) {
                  return;
                }
                setItems(
                  PRVOUKA_PRINCIPLES.map((p) => ({
                    title: p.title,
                    body: p.body,
                    visualId: p.visualId,
                    imageUrl: p.imageUrl ?? '',
                  })),
                );
              }}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-[12px] font-bold border border-[#9933CC]/30 bg-[#faf5ff] text-[#001161] hover:border-[#9933CC]/50 transition-colors"
            >
              <Sparkles className="w-3.5 h-3.5 text-[#9933CC]" /> 9 principů (Prvouka)
            </button>
          )}
          <button
            type="button"
            onClick={() =>
              setItems([...items, { title: '', body: '', imageUrl: '', visualId: 0 }])
            }
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-[12px] font-bold border border-gray-200 bg-white text-[#001161] hover:border-[#001161]/25 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> Přidat kartu
          </button>
          {items.length > 0 && (
            <button
              type="button"
              onClick={() => {
                if (!confirm('Odstranit vlastní principy a na webu znovu použít výchozí šablonu?')) return;
                setItems([]);
              }}
              className="text-[12px] text-gray-500 hover:text-red-500 px-2 py-2"
            >
              Zrušit vlastní (výchozí ze šablony)
            </button>
          )}
        </div>

        {items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-200 bg-white/80 p-8 text-center text-[13px] text-gray-400">
            Zatím žádné karty — použijte „Přidat kartu“.
          </div>
        ) : (
          <div className="space-y-4">
            {items.map((row, i) => (
              <div key={i} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between gap-2 mb-3">
                  <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wide">Karta {i + 1}</span>
                  <button
                    type="button"
                    onClick={() => setItems(items.filter((_, j) => j !== i))}
                    className="text-[11px] text-red-400 hover:text-red-600 font-semibold"
                  >
                    Odebrat
                  </button>
                </div>
                <label className="block text-[11px] font-bold text-gray-500 mb-1">Nadpis</label>
                <input
                  value={row.title || ''}
                  onChange={(e) => patchItem(i, { title: e.target.value })}
                  className="w-full mb-3 px-3 py-2 rounded-xl border border-gray-200 text-[13px] outline-none focus:border-[#001161]/30"
                />
                <label className="block text-[11px] font-bold text-gray-500 mb-1">Text</label>
                <textarea
                  value={row.body || ''}
                  onChange={(e) => patchItem(i, { body: e.target.value })}
                  rows={4}
                  className="w-full mb-3 px-3 py-2 rounded-xl border border-gray-200 text-[13px] outline-none focus:border-[#001161]/30 resize-y"
                />
                <ImagePicker
                  label="Obrázek"
                  value={typeof row.imageUrl === 'string' ? row.imageUrl : ''}
                  onChange={(url) => patchItem(i, { imageUrl: url || undefined, visualId: 0 })}
                  previewHeight={120}
                />
              </div>
            ))}
          </div>
        )}

        <div className="mt-6 pt-4 border-t border-gray-200">
          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            className="inline-flex items-center gap-2 bg-[#001161] hover:bg-[#000d4a] text-white px-6 py-2.5 rounded-xl text-[13px] font-bold transition-colors disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Uložit předmět
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Section: Taby ────────────────────────────────────────────────────────────
function SectionTaby({ editData, navigate }: { editData: any; navigate: (p: string) => void }) {
  const [tabs, setTabs] = useState<any[]>([]);
  const [loadingTabs, setLoadingTabs] = useState(false);
  const [selectedTab, setSelectedTab] = useState<any>(null);
  const [tabEditData, setTabEditData] = useState<any>(null);
  const [savingTab, setSavingTab] = useState(false);
  const [isNewTab, setIsNewTab] = useState(false);

  const subjectName = editData?.displayName || '';
  const [allTabsCount, setAllTabsCount] = useState<number | null>(null);
  const [debugSubjects, setDebugSubjects] = useState<string[]>([]);

  const loadTabs = useCallback(async () => {
    if (!subjectName) return;
    setLoadingTabs(true);
    try {
      const all = await fetchCollection('tabs' as CollectionName);
      setAllTabsCount(all.length);
      // Debug: unikátní subject hodnoty v DB
      const uniq = Array.from(new Set(all.map((t: any) => String(t.subject || '(prázdný)')).filter(Boolean))).sort() as string[];
      setDebugSubjects(uniq);
      // Case-insensitive + trim porovnání
      const norm = (s: string) => (s || '').trim().toLowerCase();
      setTabs(all.filter((t: any) => norm(t.subject) === norm(subjectName)).sort((a: any, b: any) => (a.order || 0) - (b.order || 0)));
    } catch { setTabs([]); }
    finally { setLoadingTabs(false); }
  }, [subjectName]);

  useEffect(() => { loadTabs(); setSelectedTab(null); setTabEditData(null); setIsNewTab(false); }, [loadTabs]);

  const handleSelectTab = (tab: any) => { setSelectedTab(tab.id); setTabEditData({ ...tab }); setIsNewTab(false); };

  const handleNewTab = () => {
    setTabEditData({ tabText: '', contentHeadline: '', contentRichText: '', contentImage: '', subject: subjectName, subpage: '', order: tabs.length + 1, bgColor: '' });
    setSelectedTab(null);
    setIsNewTab(true);
  };

  const handleSaveTab = async () => {
    if (!tabEditData) return;
    setSavingTab(true);
    try {
      if (isNewTab) { await createItem('tabs' as CollectionName, tabEditData); }
      else { await updateItem('tabs' as CollectionName, tabEditData.id, tabEditData); }
      toast.success('Tab uložen!');
      await loadTabs();
      setIsNewTab(false);
    } catch (e: any) { toast.error(`Chyba: ${e.message}`); }
    finally { setSavingTab(false); }
  };

  const handleDeleteTab = async () => {
    if (!tabEditData?.id || !confirm('Smazat tento tab?')) return;
    setSavingTab(true);
    try {
      await deleteItem('tabs' as CollectionName, tabEditData.id);
      toast.success('Smazáno!');
      setTabEditData(null); setSelectedTab(null);
      await loadTabs();
    } catch (e: any) { toast.error(`Chyba: ${e.message}`); }
    finally { setSavingTab(false); }
  };

  const updateTabField = (key: string, value: any) => setTabEditData((p: any) => ({ ...p, [key]: value }));

  if (!subjectName) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#f7f8fc]">
        <p className="text-[13px] text-gray-400">Nejprve vyplňte Název předmětu v Nastavení.</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex overflow-hidden bg-[#f7f8fc]">
      {/* Tab list */}
      <div className="w-[220px] border-r border-gray-200 bg-white flex flex-col shrink-0">
        <div className="px-3 py-3 border-b border-gray-100 flex items-center justify-between">
          <span className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">Taby</span>
          <button onClick={handleNewTab} className="p-1 bg-[#ff8c66] hover:bg-[#ff7a4d] text-white rounded-lg transition-colors" title="Nový tab">
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {loadingTabs ? (
            <div className="flex justify-center p-6"><Loader2 className="w-4 h-4 animate-spin text-gray-300" /></div>
          ) : tabs.length === 0 ? (
            <div className="p-4 text-center">
              <p className="text-[11px] text-gray-400 mb-1">Žádné taby pro <strong>„{subjectName}"</strong></p>
              {allTabsCount !== null && allTabsCount > 0 && (
                <div className="mb-2 p-2 bg-amber-50 border border-amber-200 rounded-lg text-left">
                  <p className="text-[10px] font-bold text-amber-700 mb-1">🔍 V DB celkem {allTabsCount} tabů, ale subject nesedí.</p>
                  <p className="text-[10px] text-amber-600 mb-1">Unikátní subject hodnoty:</p>
                  <div className="flex flex-wrap gap-1">
                    {debugSubjects.slice(0, 8).map(s => (
                      <span key={s} className="text-[9px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded font-mono">{s}</span>
                    ))}
                  </div>
                  <p className="text-[9px] text-amber-500 mt-1">→ Re-importuj taby s forceSubject nebo uprav subject v tabulce.</p>
                </div>
              )}
              {allTabsCount === 0 && (
                <p className="text-[10px] text-gray-400 mb-2">DB je prázdná — spusť import v Migrace.</p>
              )}
              <button onClick={handleNewTab} className="text-[11px] text-[#ff8c66] hover:underline font-semibold flex items-center gap-1 mx-auto mt-1">
                <Plus className="w-3 h-3" /> Přidat první
              </button>
            </div>
          ) : (
            tabs.map((tab, idx) => (
              <button
                key={tab.id}
                onClick={() => handleSelectTab(tab)}
                className={`w-full text-left px-3 py-2.5 border-b border-gray-50 flex items-center gap-2 transition-all ${selectedTab === tab.id ? 'bg-[#001161] text-white' : 'hover:bg-gray-50'}`}
              >
                <div className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 text-[9px] font-bold ${selectedTab === tab.id ? 'bg-white/20 text-white' : 'bg-[#ff8c66]/15 text-[#ff8c66]'}`}>
                  {tab.order || idx + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className={`text-[12px] font-semibold truncate ${selectedTab === tab.id ? 'text-white' : 'text-[#001161]'}`}>{tab.tabText || 'Bez názvu'}</div>
                  {tab.contentHeadline && <div className={`text-[10px] truncate ${selectedTab === tab.id ? 'text-blue-200' : 'text-gray-400'}`}>{tab.contentHeadline}</div>}
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Tab editor */}
      <div className="flex-1 overflow-y-auto">
        {tabEditData ? (
          <div className="p-5 max-w-xl">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-[14px] font-bold text-[#001161]">{isNewTab ? 'Nový tab' : 'Upravit tab'}</h4>
              <div className="flex gap-2">
                {!isNewTab && tabEditData.id && (
                  <button onClick={handleDeleteTab} disabled={savingTab} className="text-[12px] text-red-500 hover:bg-red-50 px-2.5 py-1.5 rounded-lg flex items-center gap-1 transition-colors">
                    <Trash2 className="w-3.5 h-3.5" /> Smazat
                  </button>
                )}
                <button onClick={() => { setTabEditData(null); setSelectedTab(null); setIsNewTab(false); }} className="text-[12px] text-gray-400 hover:bg-gray-100 px-2.5 py-1.5 rounded-lg flex items-center gap-1">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {TABS_FIELDS.filter(f => f.key !== 'subject').map(field => (
                <FieldRenderer key={field.key} field={field} editData={tabEditData} updateField={updateTabField} />
              ))}
            </div>
            {/* Subject je prefill */}
            <div className="mt-3 px-3 py-2 bg-orange-50 rounded-xl border border-orange-100 text-[11px] text-[#ff8c66] font-medium">
              Subject: <strong>{tabEditData.subject || subjectName}</strong>
            </div>
            <div className="mt-5 pt-4 border-t border-gray-200">
              <button onClick={handleSaveTab} disabled={savingTab} className="flex items-center gap-2 bg-[#001161] hover:bg-[#000d4a] text-white px-5 py-2.5 rounded-xl text-[13px] font-bold transition-colors disabled:opacity-50">
                {savingTab ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Uložit tab
              </button>
            </div>
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-gray-300 p-8">
            <BookOpen className="w-10 h-10 mb-3" />
            <p className="text-[13px]">Vyberte tab nebo přidejte nový</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Section: Digitální přístup ───────────────────────────────────────────────
function SectionPristup({ editData, updateField, onSave, saving }: {
  editData: any; updateField: (k: string, v: any) => void; onSave: () => void; saving: boolean;
}) {
  return (
    <div className="flex-1 overflow-y-auto bg-[#f7f8fc]">
      <div className="p-6 max-w-xl">
        <h3 className="text-[15px] font-bold text-[#001161] mb-1">Digitální přístup</h3>
        <p className="text-[12px] text-gray-400 mb-6">Nastavení přístupů a srovnání pro předmět <strong className="text-gray-600">{editData?.displayName || '—'}</strong></p>

        {/* Rozšířený */}
        <div className="mb-3">
          <div className="flex items-center gap-2 mb-2 px-1">
            <div className="w-2 h-2 rounded-full bg-[#7C3AED]" />
            <span className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">Rozšířený přístup</span>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <ToggleRow
              fieldKey="hasExtendedAccess"
              label="Obsahuje rozšířený digitální přístup"
              hint="Plný přístup k digitálnímu obsahu — předplatné."
              color="purple"
              editData={editData}
              updateField={updateField}
            />
          </div>
        </div>

        {/* Základní */}
        <div className="mb-3">
          <div className="flex items-center gap-2 mb-2 px-1">
            <div className="w-2 h-2 rounded-full bg-[#ff8c66]" />
            <span className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">Základní přístup</span>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <ToggleRow
              fieldKey="hasBasicAccess"
              label="Obsahuje základní digitální přístup"
              hint="Zdarma od 15 ks pracovního sešitu."
              color="orange"
              editData={editData}
              updateField={updateField}
            />
          </div>
        </div>

        {/* Srovnání */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-2 px-1">
            <div className="w-2 h-2 rounded-full bg-[#001161]" />
            <span className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">Srovnání přístupů</span>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <ToggleRow
              fieldKey="showComparison"
              label="Zobrazit srovnání na stránce předmětu"
              hint="Zobrazí tabulku Základní vs. Rozšířený přístup pod sekcí Taby."
              color="blue"
              editData={editData}
              updateField={updateField}
            />
          </div>
        </div>

        {/* Náhled */}
        {(editData?.hasExtendedAccess || editData?.hasBasicAccess) && (
          <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-6">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Náhled na webu</p>
            <div className="grid grid-cols-2 gap-3">
              <div className={`p-3 rounded-xl border transition-all ${editData?.hasBasicAccess ? 'border-[#ff8c66]/30 bg-[#ff8c66]/5' : 'border-gray-100 bg-gray-50 opacity-40'}`}>
                <div className="text-[10px] font-bold text-[#ff8c66] uppercase tracking-wide mb-1">Základní</div>
                <div className="text-[11px] text-gray-500 leading-snug">zdarma od 15 ks sešitu</div>
                {editData?.hasBasicAccess && <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[#ff8c66] mx-auto" />}
              </div>
              <div className={`p-3 rounded-xl border transition-all ${editData?.hasExtendedAccess ? 'border-[#7C3AED]/30 bg-[#7C3AED]/5' : 'border-gray-100 bg-gray-50 opacity-40'}`}>
                <div className="text-[10px] font-bold text-[#7C3AED] uppercase tracking-wide mb-1">Rozšířený</div>
                <div className="text-[11px] text-gray-500 leading-snug">předplatné</div>
                {editData?.hasExtendedAccess && <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[#7C3AED] mx-auto" />}
              </div>
            </div>
            <div className={`mt-2 text-center text-[10px] font-semibold ${editData?.showComparison ? 'text-emerald-600' : 'text-gray-300'}`}>
              {editData?.showComparison ? '✓ Srovnání se zobrazí na webu' : 'Srovnání je skryté'}
            </div>
          </div>
        )}

        <button onClick={onSave} disabled={saving} className="flex items-center gap-2 bg-[#001161] hover:bg-[#000d4a] text-white px-6 py-2.5 rounded-xl text-[13px] font-bold transition-colors disabled:opacity-50">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Uložit nastavení přístupů
        </button>
      </div>
    </div>
  );
}

// ── Předmět: sekce FAQ ───────────────────────────────────────────────────────
function SectionSubjectFaq({
  editData,
  updateField,
  onSave,
  saving,
}: {
  editData: any;
  updateField: (k: string, v: any) => void;
  onSave: () => void;
  saving: boolean;
}) {
  const faqs: { question: string; answer: string }[] = Array.isArray(editData?.faqs)
    ? editData.faqs.map((x: any) => ({
        question: String(x?.question ?? '').trim(),
        answer: String(x?.answer ?? '').trim(),
      }))
    : [];

  const setFaqs = (next: { question: string; answer: string }[]) => updateField('faqs', next);

  return (
    <div className="flex-1 overflow-y-auto p-6 md:p-8 bg-[#f7f8fc]">
      <div className="max-w-[640px]">
        <div className="flex items-start gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-[#001161]/8 flex items-center justify-center shrink-0">
            <CircleHelp className="w-5 h-5 text-[#001161]" />
          </div>
          <div>
            <h3 className="text-[15px] font-bold text-[#001161]">Často kladené dotazy</h3>
            <p className="text-[12px] text-gray-500 mt-1 leading-relaxed">
              Zobrazí se na stránce předmětu na webu. Po uložení se obsah automaticky zaindexuje do RAG pro kontaktní chat a související nástroje.
            </p>
          </div>
        </div>

        <div className="space-y-3 mb-6">
          {faqs.length === 0 && (
            <p className="text-[12px] text-gray-400 italic py-4">Zatím žádné otázky — přidej první návrh níže.</p>
          )}
          {faqs.map((f, i) => (
            <div key={i} className="p-4 rounded-xl bg-white border border-gray-100 shadow-sm space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1">
                  <GripVertical className="w-3 h-3 opacity-50" />
                  Otázka {i + 1}
                </span>
                <button
                  type="button"
                  onClick={() => setFaqs(faqs.filter((_, j) => j !== i))}
                  className="text-[11px] text-red-500 hover:text-red-600 font-semibold"
                >
                  Odstranit
                </button>
              </div>
              <input
                type="text"
                value={f.question}
                onChange={(e) => {
                  const next = [...faqs];
                  next[i] = { ...next[i], question: e.target.value };
                  setFaqs(next);
                }}
                placeholder="např. Je obsah v souladu s RVP?"
                className="w-full px-3 py-2 text-[13px] border border-gray-200 rounded-lg focus:border-[#001161] outline-none"
              />
              <textarea
                value={f.answer}
                onChange={(e) => {
                  const next = [...faqs];
                  next[i] = { ...next[i], answer: e.target.value };
                  setFaqs(next);
                }}
                placeholder="Stručná, faktická odpověď pro učitele nebo ředitele školy…"
                rows={4}
                className="w-full px-3 py-2 text-[13px] border border-gray-200 rounded-lg focus:border-[#001161] outline-none resize-y min-h-[88px]"
              />
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => setFaqs([...faqs, { question: '', answer: '' }])}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] font-bold bg-white border border-gray-200 text-[#001161] hover:border-[#001161]/30 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Přidat otázku
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            className="inline-flex items-center gap-2 px-6 py-2 rounded-xl text-[13px] font-bold bg-[#001161] text-white hover:bg-[#000d4a] disabled:opacity-50 transition-colors"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Uložit FAQ
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Subject Browser (3-column) ───────────────────────────────────────────────
type SubjectSection = 'nastaveni' | 'faq' | 'taby' | 'pristup' | 'metodicke';

const SUBJECT_SECTIONS: { id: SubjectSection; label: string; sublabel: string; icon: React.FC<any>; color: string }[] = [
  { id: 'nastaveni', label: 'Nastavení předmětu', sublabel: 'Základní info, barvy, RVP', icon: Settings, color: '#001161' },
  { id: 'faq', label: 'FAQ', sublabel: 'Časté dotazy + RAG', icon: CircleHelp, color: '#0d9488' },
  { id: 'taby', label: 'Taby', sublabel: 'Prodejní argumenty', icon: LayoutGrid, color: '#ff8c66' },
  { id: 'pristup', label: 'Digitální přístup', sublabel: 'Základní & rozšířený', icon: Unlock, color: '#7C3AED' },
  { id: 'metodicke', label: 'Metodické principy', sublabel: 'Nadpis, text, obrázek', icon: Sparkles, color: '#2563eb' },
];

function SubjectBrowser() {
  const navigate = useNavigate();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editData, setEditData] = useState<any>(null);
  const [isNew, setIsNew] = useState(false);
  const [activeSection, setActiveSection] = useState<SubjectSection>('nastaveni');
  const [searchQuery, setSearchQuery] = useState('');

  const loadItems = useCallback(async () => {
    setLoading(true);
    try { setItems(await fetchCollection('predmety')); }
    catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadItems(); }, [loadItems]);

  const handleSelect = (item: any) => {
    setSelectedId(item.id);
    setEditData({ ...item });
    setIsNew(false);
    setActiveSection('nastaveni');
  };

  const handleNew = () => {
    setEditData({ id: '', displayName: '', slug: '', order: 0, tagline: '', heroText: '', authorIntroHeading: '', authorIntroBody: '', heroColor: '', heroColorDark: '', accentColor: '', isActive: false, faqs: [], methodPrinciplesItems: [] });
    setSelectedId(null);
    setIsNew(true);
    setActiveSection('nastaveni');
  };

  const handleSave = async () => {
    if (!editData) return;
    setSaving(true);
    try {
      if (isNew) { await createItem('predmety', editData); }
      else { await updateItem('predmety', editData.id, editData); }
      toast.success('Uloženo!');
      await loadItems();
      setIsNew(false);
    } catch (e: any) { toast.error(`Chyba: ${e.message}`); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!editData?.id || !confirm('Smazat tento předmět?')) return;
    setSaving(true);
    try {
      await deleteItem('predmety', editData.id);
      toast.success('Smazáno!');
      setEditData(null); setSelectedId(null);
      await loadItems();
    } catch (e: any) { toast.error(`Chyba: ${e.message}`); }
    finally { setSaving(false); }
  };

  const handleSeedFromStatic = async () => {
    if (items.length > 0 && !confirm('Přepsat statickými daty?')) return;
    setSaving(true);
    try {
      await seedCollection('predmety', SUBJECT_PAGES);
      toast.success(`Seed: ${SUBJECT_PAGES.length} předmětů.`);
      await loadItems();
    } catch (e: any) { toast.error(`Seed selhal: ${e.message}`); }
    finally { setSaving(false); }
  };

  const updateField = (key: string, value: any) => setEditData((p: any) => ({ ...p, [key]: value }));

  const filtered = items.filter(i => !searchQuery || (i.displayName || '').toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <div className="h-full flex overflow-hidden">
      {/* Column 1: Subject list */}
      <div className="w-[260px] border-r border-gray-200 bg-white flex flex-col shrink-0">
        <div className="p-3 border-b border-gray-100 space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-[13px] font-bold text-[#001161] uppercase tracking-wide">
              Předměty <span className="text-gray-400 font-normal">({filtered.length})</span>
            </h2>
            <button onClick={handleNew} className="p-1.5 bg-[#ff8c66] hover:bg-[#ff7a4d] text-white rounded-lg transition-colors" title="Přidat předmět">
              <Plus className="w-4 h-4" />
            </button>
          </div>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Hledat..." className="w-full pl-8 pr-3 py-1.5 text-[12px] border border-gray-200 rounded-lg bg-gray-50 focus:bg-white focus:border-[#001161] outline-none transition-all" />
          </div>
          {items.length === 0 && !loading && (
            <button onClick={handleSeedFromStatic} disabled={saving} className="w-full text-[11px] bg-blue-50 hover:bg-blue-100 text-blue-700 px-3 py-1.5 rounded-lg font-medium transition-colors">
              Naimportovat statická data
            </button>
          )}
        </div>
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex justify-center p-8"><Loader2 className="w-5 h-5 text-gray-300 animate-spin" /></div>
          ) : filtered.length === 0 ? (
            <div className="p-6 text-center text-gray-400 text-[12px]">Žádné předměty</div>
          ) : (
            filtered.sort((a, b) => (a.order || 0) - (b.order || 0)).map(item => (
              <button
                key={item.id}
                onClick={() => handleSelect(item)}
                className={`w-full text-left px-3 py-3 border-b border-gray-50 flex items-center gap-3 transition-all ${selectedId === item.id ? 'bg-[#001161]' : 'hover:bg-gray-50'}`}
              >
                {/* accent color strip */}
                <div className="w-2.5 h-10 rounded-full shrink-0" style={{ backgroundColor: item.accentColor || '#e5e7eb' }} />
                <div className="flex-1 min-w-0">
                  <div className={`text-[13px] font-semibold truncate ${selectedId === item.id ? 'text-white' : 'text-[#001161]'}`}>
                    {item.displayName || 'Bez názvu'}
                  </div>
                  {item.tagline && (
                    <div className={`text-[10px] truncate mt-0.5 ${selectedId === item.id ? 'text-blue-200' : 'text-gray-400'}`}>
                      {item.tagline}
                    </div>
                  )}
                  {(item.hasBasicAccess || item.hasExtendedAccess) && (
                    <div className="flex gap-1 mt-1">
                      {item.hasBasicAccess && <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold ${selectedId === item.id ? 'bg-white/20 text-white' : 'bg-[#ff8c66]/15 text-[#ff8c66]'}`}>Základní</span>}
                      {item.hasExtendedAccess && <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold ${selectedId === item.id ? 'bg-white/20 text-white' : 'bg-[#7C3AED]/15 text-[#7C3AED]'}`}>Rozšířený</span>}
                    </div>
                  )}
                </div>
                <ChevronRight className={`w-3.5 h-3.5 shrink-0 ${selectedId === item.id ? 'text-white/40' : 'text-gray-300'}`} />
              </button>
            ))
          )}
        </div>
      </div>

      {/* Column 2: Section navigation — only when subject selected */}
      {editData ? (
        <>
          <div className="w-[210px] border-r border-gray-200 bg-white flex flex-col shrink-0">
            {/* Subject header in col 2 */}
            <div className="px-4 py-4 border-b border-gray-100">
              <div className="flex items-center gap-2 mb-0.5">
                <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: editData.accentColor || '#e5e7eb' }} />
                <span className="text-[13px] font-bold text-[#001161] truncate">{editData.displayName || 'Nový předmět'}</span>
              </div>
              {editData.slug && <p className="text-[10px] text-gray-400 pl-5">/{editData.slug}</p>}
            </div>

            {/* Section nav items */}
            <div className="flex-1 py-2">
              {SUBJECT_SECTIONS.map(section => {
                const Icon = section.icon;
                const isActive = activeSection === section.id;
                return (
                  <button
                    key={section.id}
                    onClick={() => setActiveSection(section.id)}
                    className={`w-full text-left px-4 py-3.5 flex items-start gap-3 transition-all border-l-2 ${
                      isActive
                        ? 'border-[#001161] bg-gray-50'
                        : 'border-transparent hover:bg-gray-50/70 hover:border-gray-200'
                    }`}
                  >
                    <div
                      className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                      style={{ backgroundColor: isActive ? section.color + '18' : '#f3f4f6' }}
                    >
                      <Icon className="w-3.5 h-3.5" style={{ color: isActive ? section.color : '#9ca3af' }} />
                    </div>
                    <div>
                      <div className={`text-[12px] font-bold leading-snug ${isActive ? 'text-[#001161]' : 'text-gray-600'}`}>
                        {section.label}
                      </div>
                      <div className="text-[10px] text-gray-400 mt-0.5 leading-snug">{section.sublabel}</div>
                    </div>
                    {isActive && <ChevronRight className="w-3.5 h-3.5 text-[#001161] ml-auto mt-1.5" />}
                  </button>
                );
              })}
            </div>

            {/* Delete / close at bottom */}
            <div className="p-3 border-t border-gray-100 flex gap-2">
              {!isNew && editData.id && (
                <button onClick={handleDelete} disabled={saving} className="flex-1 flex items-center justify-center gap-1 text-[11px] text-red-400 hover:bg-red-50 py-2 rounded-xl transition-colors">
                  <Trash2 className="w-3 h-3" /> Smazat
                </button>
              )}
              <button onClick={() => { setEditData(null); setSelectedId(null); }} className="flex-1 flex items-center justify-center gap-1 text-[11px] text-gray-400 hover:bg-gray-100 py-2 rounded-xl transition-colors">
                <X className="w-3 h-3" /> Zavřít
              </button>
            </div>
          </div>

          {/* Column 3: Section content */}
          {activeSection === 'nastaveni' && (
            <SectionNastaveni editData={editData} updateField={updateField} onSave={handleSave} onDelete={handleDelete} saving={saving} isNew={isNew} />
          )}
          {activeSection === 'faq' && (
            <SectionSubjectFaq editData={editData} updateField={updateField} onSave={handleSave} saving={saving} />
          )}
          {activeSection === 'taby' && (
            <SectionTaby editData={editData} navigate={navigate} />
          )}
          {activeSection === 'pristup' && (
            <SectionPristup editData={editData} updateField={updateField} onSave={handleSave} saving={saving} />
          )}
          {activeSection === 'metodicke' && (
            <SectionMetodickePrincipy editData={editData} updateField={updateField} onSave={handleSave} saving={saving} />
          )}
        </>
      ) : (
        /* Empty state when nothing selected */
        <div className="flex-1 flex flex-col items-center justify-center text-gray-300 bg-[#f7f8fc]">
          <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mb-4">
            <ChevronRight className="w-8 h-8" />
          </div>
          <p className="text-[13px]">Vyberte předmět ze seznamu nebo vytvořte nový</p>
        </div>
      )}
    </div>
  );
}

/** Sjednotí link + ctaLink pro hero slidy (editor ukládá obě pole stejně). */
function normalizeHeroSlideEditData(item: Record<string, unknown>) {
  const L = typeof item.link === 'string' ? item.link.trim() : '';
  const C = typeof item.ctaLink === 'string' ? item.ctaLink.trim() : '';
  const unified = L || C;
  const base: Record<string, unknown> = {
    ...item,
    link: unified,
    ctaLink: unified,
    heroBlockGapPx: clampHeroBlockGapPx(item.heroBlockGapPx),
    heroTitleLineHeightPct: clampHeroTitleLineHeightPct(item.heroTitleLineHeightPct),
    heroTitleSizePct: clampHeroTitleSizePct(item.heroTitleSizePct),
  };
  if (isHeroBooksFanLayout(item as { layout?: string })) {
    base.booksFanArrangement = normalizeHeroBooksFanArrangement(item.booksFanArrangement);
    base.booksFanGapPx = clampHeroBooksFanGapPx(item.booksFanGapPx);
    base.booksFanScalePct = clampHeroBooksFanScalePct(item.booksFanScalePct);
    base.booksFanColumnPercent = clampHeroBooksFanColumnPercent(item.booksFanColumnPercent);
    base.booksFanZOrder = normalizeHeroBooksFanZOrder((item as { booksFanZOrder?: unknown }).booksFanZOrder);
    const itAny = item as {
      booksFanCollageOffsetXPx?: unknown;
      booksFanCollageOffsetYPx?: unknown;
      booksFanBelowLiftPx?: unknown;
    };
    base.booksFanCollageOffsetXPx = clampHeroBooksFanCollageOffsetXPx(itAny.booksFanCollageOffsetXPx);
    const yRaw =
      itAny.booksFanCollageOffsetYPx != null && itAny.booksFanCollageOffsetYPx !== ''
        ? itAny.booksFanCollageOffsetYPx
        : itAny.booksFanBelowLiftPx;
    const collageY = clampHeroBooksFanCollageOffsetYPx(yRaw);
    base.booksFanCollageOffsetYPx = collageY;
  }
  if (
    (item as { layout?: string }).layout === 'books-fan-below' ||
    (item as { layout?: string }).layout === 'books-fan-above'
  ) {
    base.booksFanBelowShelfPercent = clampHeroBooksFanBelowShelfPercent(
      (item as { booksFanBelowShelfPercent?: unknown }).booksFanBelowShelfPercent,
    );
    base.booksFanBelowLiftPx = clampHeroBooksFanBelowLiftPx(
      (base as { booksFanCollageOffsetYPx?: number }).booksFanCollageOffsetYPx ?? 0,
    );
  }
  if (
    (item as { layout?: string }).layout === 'left-image' ||
    (item as { layout?: string }).layout === 'hero-full-image'
  ) {
    base.heroImageScalePct = clampHeroImageScalePct(
      (item as { heroImageScalePct?: unknown }).heroImageScalePct,
    );
    base.heroImagePosXPct = clampHeroImagePosPct(
      (item as { heroImagePosXPct?: unknown }).heroImagePosXPct,
    );
    base.heroImagePosYPct = clampHeroImagePosPct(
      (item as { heroImagePosYPct?: unknown }).heroImagePosYPct,
    );
  }
  if ((item as { layout?: string }).layout === 'hero-full-image') {
    base.heroFullImageCardBgHex = normalizeHeroFullImageCardBgHex(
      (item as { heroFullImageCardBgHex?: unknown }).heroFullImageCardBgHex,
    );
    base.heroFullImageCardOpacityPct = clampHeroFullImageCardOpacityPct(
      (item as { heroFullImageCardOpacityPct?: unknown }).heroFullImageCardOpacityPct,
    );
    base.heroFullImageCardBlurPx = clampHeroFullImageCardBlurPx(
      (item as { heroFullImageCardBlurPx?: unknown }).heroFullImageCardBlurPx,
    );
  }
  return base;
}

function reorderHeroSlideIds(
  ids: string[],
  fromId: string,
  toId: string,
  edge: 'before' | 'after',
): string[] {
  if (fromId === toId) return ids;
  const o = [...ids];
  const fi = o.indexOf(fromId);
  const ti = o.indexOf(toId);
  if (fi < 0 || ti < 0) return ids;
  o.splice(fi, 1);
  const ti2 = o.indexOf(toId);
  if (ti2 < 0) return ids;
  const insertAt = edge === 'before' ? ti2 : ti2 + 1;
  o.splice(insertAt, 0, fromId);
  return o;
}

/** Kompaktní náhled slidu v seznamu kolekce (barva pozadí + zjednodušené rozložení). */
function HeroSlideRowMiniThumb({ item }: { item: any }) {
  const bg = typeof item.bg === 'string' && item.bg.startsWith('#') ? item.bg : '#e8e5f2';
  const layout = String(item.layout || 'center');
  return (
    <div
      className="relative h-[48px] w-[76px] shrink-0 overflow-hidden rounded-lg border border-gray-200/90 shadow-[0_1px_3px_rgba(0,0,0,0.08)]"
      style={{ backgroundColor: bg }}
    >
      {layout === 'hero-full-image' && item.image ? (
        <>
          <img src={item.image} alt="" className="absolute inset-0 size-full object-cover" />
          <div className="absolute left-1 top-1.5 z-[1] space-y-0.5">
            <div className="h-1 rounded-sm bg-white/85 shadow-sm" style={{ width: '52%' }} />
            <div className="h-0.5 rounded-full bg-white/70" style={{ width: '40%' }} />
          </div>
          <div className="absolute bottom-1 left-1 z-[1] h-1 w-[38%] rounded-sm bg-white/80 shadow-sm" />
        </>
      ) : layout === 'left-image' && item.image ? (
        <>
          <div className="absolute inset-y-0 right-0 w-[46%] border-l border-black/10">
            <img src={item.image} alt="" className="size-full object-cover" />
          </div>
          <div className="absolute left-1 top-1.5 right-[48%] space-y-0.5">
            <div className="h-0.5 rounded-full bg-black/28" style={{ width: '72%' }} />
            <div className="h-0.5 rounded-full bg-black/20" style={{ width: '58%' }} />
          </div>
        </>
      ) : layout === 'books-fan' ? (
        <div className="flex h-full items-end justify-center gap-0.5 px-1 pb-1">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-5 w-3 rounded-[2px] border border-white/75 bg-white/40 shadow-sm"
              style={{ transform: `rotate(${(i - 1) * 8}deg)` }}
            />
          ))}
        </div>
      ) : layout === 'books-fan-below' || layout === 'books-fan-above' ? (
        <div className="flex h-full flex-col justify-between px-1 py-0.5">
          {layout === 'books-fan-above' ? (
            <>
              <div className="flex justify-center gap-0.5 pt-0.5">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="h-3 w-2 rounded-[1px] border border-white/85 bg-white/45" />
                ))}
              </div>
              <div className="space-y-0.5 px-0.5 pb-0.5">
                <div className="mx-auto h-0.5 w-[78%] rounded-full bg-black/24" />
                <div className="mx-auto h-0.5 w-[55%] rounded-full bg-black/18" />
              </div>
            </>
          ) : (
            <>
              <div className="space-y-0.5 px-0.5 pt-1">
                <div className="mx-auto h-0.5 w-[78%] rounded-full bg-black/24" />
                <div className="mx-auto h-0.5 w-[55%] rounded-full bg-black/18" />
              </div>
              <div className="flex justify-center gap-0.5 pb-0.5">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="h-3 w-2 rounded-[1px] border border-white/85 bg-white/45" />
                ))}
              </div>
            </>
          )}
        </div>
      ) : (
        <div className="flex h-full flex-col items-center justify-center gap-1 px-2">
          <div className="h-0.5 w-full max-w-[48px] rounded-full bg-black/24" />
          <div className="h-0.5 w-full max-w-[40px] rounded-full bg-black/18" />
          <div className="h-0.5 w-full max-w-[52px] rounded-full bg-black/14" />
        </div>
      )}
    </div>
  );
}

function heroSlideIsPublished(item: any): boolean {
  return item.isActive !== false && item.active !== false;
}

// ── Generic CollectionBrowser (non-predmety) ─────────────────────────────────
function GenericBrowser({ collection, config }: { collection: string; config: typeof COLLECTION_CONFIG[string] }) {
  const navigate = useNavigate();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [bulkSyncing, setBulkSyncing] = useState(false);
  const [bulkSyncProgress, setBulkSyncProgress] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editData, setEditData] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [subjectFilter, setSubjectFilter] = useState<string | null>(null);
  /** null = předměty; jinak filtr typu „další produkty“ v adminu */
  const [merchBrowse, setMerchBrowse] = useState<MerchBrowseState>(null);
  const [isNew, setIsNew] = useState(false);
  const [productEditorTab, setProductEditorTab] = useState<'settings' | 'eshop'>('settings');
  const draggingHeroSlideIdRef = useRef<string | null>(null);
  const [heroSlideDropHint, setHeroSlideDropHint] = useState<{
    overId: string;
    edge: 'before' | 'after';
  } | null>(null);
  const [heroReordering, setHeroReordering] = useState(false);
  /** ID slidu při PATCH isActive (disable tlačítek na řádku) */
  const [heroBusySlideId, setHeroBusySlideId] = useState<string | null>(null);

  const loadItems = useCallback(async () => {
    setLoading(true);
    try {
      const data = config.apiName === 'produkty' ? await fetchProducts() : await fetchCollection(config.apiName);
      setItems(data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [config]);

  useEffect(() => {
    loadItems();
    setSelectedId(null);
    setEditData(null);
    setIsNew(false);
    setSearchQuery('');
    setSubjectFilter(null);
    setMerchBrowse(null);
    setProductEditorTab('settings');
  }, [collection, loadItems]);

  useEffect(() => {
    if (config.apiName !== 'hero-slidy') return;
    const end = () => {
      draggingHeroSlideIdRef.current = null;
      setHeroSlideDropHint(null);
    };
    window.addEventListener('dragend', end);
    return () => window.removeEventListener('dragend', end);
  }, [config.apiName]);

  const handleSelect = (item: any) => {
    setSelectedId(item.id);
    setEditData(config.apiName === 'hero-slidy' ? normalizeHeroSlideEditData({ ...item }) : { ...item });
    setIsNew(false);
    setProductEditorTab('settings');
  };

  const handleNew = () => {
    const newItem: any = { id: '' };
    config.fields.forEach(f => { if (f.key.startsWith('_')) return; newItem[f.key] = f.type === 'number' ? 0 : f.type === 'boolean' ? false : ''; });
    if (config.apiName === 'hero-slidy') {
      newItem.heroBlockGapPx = 12;
      newItem.heroTitleLineHeightPct = 108;
      newItem.heroTitleSizePct = 100;
      newItem.booksFanColumnPercent = 48;
      newItem.booksFanBelowShelfPercent = 48;
      newItem.booksFanCollageOffsetXPx = 0;
      newItem.booksFanCollageOffsetYPx = 0;
    }
    setEditData(newItem); setSelectedId(null); setIsNew(true); setProductEditorTab('settings');
  };

  const handleSave = async () => {
    if (!editData) return;
    setSaving(true);
    try {
      if (config.apiName === 'produkty') {
        if (isNew) { await createProduct(editData); } else { await updateProduct(editData.id, editData); }
      } else {
        let payload = editData;
        if (config.apiName === 'hero-slidy') {
          const href = String(editData.link || '').trim();
          const { booksRibbonLabel: _omitLabel, booksRibbonStyle: _omitStyle, ...heroRest } = editData;
          payload = {
            ...heroRest,
            link: href,
            ctaLink: href,
            heroBlockGapPx: clampHeroBlockGapPx(editData.heroBlockGapPx),
            heroTitleLineHeightPct: clampHeroTitleLineHeightPct(editData.heroTitleLineHeightPct),
            heroTitleSizePct: clampHeroTitleSizePct(editData.heroTitleSizePct),
          };
          if (isHeroBooksFanLayout(editData)) {
            (payload as any).booksFanArrangement = normalizeHeroBooksFanArrangement(
              editData.booksFanArrangement,
            );
            (payload as any).booksFanGapPx = clampHeroBooksFanGapPx(editData.booksFanGapPx);
            (payload as any).booksFanScalePct = clampHeroBooksFanScalePct(editData.booksFanScalePct);
            (payload as any).booksFanColumnPercent = clampHeroBooksFanColumnPercent(
              editData.booksFanColumnPercent,
            );
            (payload as any).booksFanZOrder = normalizeHeroBooksFanZOrder(editData.booksFanZOrder);
            (payload as any).booksFanCollageOffsetXPx = clampHeroBooksFanCollageOffsetXPx(
              editData.booksFanCollageOffsetXPx,
            );
            (payload as any).booksFanCollageOffsetYPx = clampHeroBooksFanCollageOffsetYPx(
              editData.booksFanCollageOffsetYPx,
            );
          }
          if (editData.layout === 'books-fan-below' || editData.layout === 'books-fan-above') {
            (payload as any).booksFanBelowShelfPercent = clampHeroBooksFanBelowShelfPercent(
              editData.booksFanBelowShelfPercent,
            );
            (payload as any).booksFanBelowLiftPx = clampHeroBooksFanBelowLiftPx(
              editData.booksFanCollageOffsetYPx,
            );
          }
        }
        if (isNew) {
          await createItem(config.apiName, payload);
        } else {
          await updateItem(config.apiName, payload.id, payload);
        }
      }
      toast.success('Uloženo!');
      await loadItems();
      setIsNew(false);
    } catch (e: any) { toast.error(`Chyba: ${e.message}`); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!editData?.id || !confirm('Smazat?')) return;
    setSaving(true);
    try {
      if (config.apiName === 'produkty') { await deleteProduct(editData.id); } else { await deleteItem(config.apiName, editData.id); }
      toast.success('Smazáno!');
      setEditData(null); setSelectedId(null);
      await loadItems();
    } catch (e: any) { toast.error(`Chyba: ${e.message}`); }
    finally { setSaving(false); }
  };

  const handleSeedFromStatic = async () => {
    if (!config.staticData || !config.seedKey) return;
    if (items.length > 0 && !confirm(`Přepsat statickými daty?`)) return;
    setSaving(true);
    try {
      await seedCollection(config.seedKey, config.staticData);
      toast.success(`Seed: ${config.staticData.length} položek.`);
      await loadItems();
    } catch (e: any) { toast.error(`Seed selhal: ${e.message}`); }
    finally { setSaving(false); }
  };

  const updateField = (key: string, value: any) => setEditData((p: any) => ({ ...p, [key]: value }));

  const handleBulkBaseSync = async () => {
    if (config.apiName !== 'produkty') return;

    const physicalProducts = items.filter((item: any) => item?.id && item.type !== 'online' && item.type !== 'license');
    if (physicalProducts.length === 0) {
      toast.error('Nenašel jsem žádné fyzické produkty pro synchronizaci.');
      return;
    }

    if (!window.confirm(`Synchronizovat do Base.com všech ${physicalProducts.length} fyzických produktů?`)) {
      return;
    }

    setBulkSyncing(true);
    setBulkSyncProgress('');

    let successCount = 0;
    let failureCount = 0;

    try {
      for (let index = 0; index < physicalProducts.length; index += 1) {
        const product = physicalProducts[index];
        setBulkSyncProgress(`${index + 1} / ${physicalProducts.length}: ${product.name || product.id}`);

        try {
          const result = await runAdminProductBaseSync(product);
          const patch: Record<string, unknown> = {};

          if (result.basecomProductId && result.basecomProductId !== product.basecomProductId) {
            patch.basecomProductId = result.basecomProductId;
          }
          if (result.basecomSku && result.basecomSku !== product.basecomSku) {
            patch.basecomSku = result.basecomSku;
          }

          if (Object.keys(patch).length > 0) {
            await updateProduct(product.id, patch);
          }

          successCount += 1;
        } catch (error) {
          failureCount += 1;
          console.error('[Base sync] Product sync failed:', product?.id, error);
        }
      }

      const refreshedItems = await fetchProducts();
      setItems(refreshedItems);
      if (selectedId) {
        const refreshedSelected = refreshedItems.find((item: any) => item.id === selectedId);
        if (refreshedSelected) {
          setEditData(refreshedSelected);
        }
      }

      if (failureCount === 0) {
        toast.success(`Hotovo. Synchronizováno ${successCount} produktů do Base.com.`);
      } else {
        toast.success(`Dokončeno: ${successCount} OK, ${failureCount} chyb.`);
      }
    } finally {
      setBulkSyncing(false);
      setBulkSyncProgress('');
    }
  };

  const filtered = items.filter((item) => {
    const s =
      !searchQuery ||
      (item[config.nameKey] || '').toLowerCase().includes(searchQuery.toLowerCase());
    if (!s) return false;

    if (config.apiName === 'tabs') {
      return !subjectFilter || item.subject === subjectFilter;
    }

    if (config.apiName !== 'produkty') {
      return !subjectFilter || item.category === subjectFilter;
    }

    if (merchBrowse !== null) {
      if (item.type !== 'merch') return false;
      if (merchBrowse === 'all') return true;
      if (getMerchCategoryLabel(item) !== merchBrowse.category) return false;
      if (merchBrowse.subcategory && getMerchSubcategoryLabel(item) !== merchBrowse.subcategory) {
        return false;
      }
      return true;
    }

    if (item.type === 'merch') return false;
    return !subjectFilter || item.category === subjectFilter;
  });

  const heroPublishedList = useMemo(() => {
    if (config.apiName !== 'hero-slidy') return [];
    return [...filtered]
      .filter(heroSlideIsPublished)
      .sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0));
  }, [filtered, config.apiName]);

  const heroUnpublishedList = useMemo(() => {
    if (config.apiName !== 'hero-slidy') return [];
    return [...filtered]
      .filter((x) => !heroSlideIsPublished(x))
      .sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0));
  }, [filtered, config.apiName]);

  const persistHeroOrder = async (orderedIds: string[]) => {
    setHeroReordering(true);
    try {
      await reorderHeroSlides(orderedIds);
      toast.success('Pořadí slidů uloženo');
      await loadItems();
    } catch (e: any) {
      toast.error(e?.message || 'Pořadí nelze uložit (zkontrolujte deploy edge funkce)');
      await loadItems();
    } finally {
      setHeroReordering(false);
    }
  };

  const persistHeroSectionOrder = (section: 'published' | 'unpublished', newSectionIds: string[]) => {
    if (section === 'published') {
      const tail = heroUnpublishedList.map((x) => String(x.id));
      void persistHeroOrder([...newSectionIds, ...tail]);
    } else {
      const head = heroPublishedList.map((x) => String(x.id));
      void persistHeroOrder([...head, ...newSectionIds]);
    }
  };

  const toggleHeroSlideActive = async (item: any, publish: boolean) => {
    const id = String(item.id);
    setHeroBusySlideId(id);
    try {
      await updateItem('hero-slidy', id, { isActive: publish });
      toast.success(publish ? 'Slide je znovu na webu' : 'Slide je skrytý (nepublikovaný)');
      await loadItems();
    } catch (e: any) {
      toast.error(e?.message || 'Chyba');
    } finally {
      setHeroBusySlideId(null);
    }
  };

  const isHeroCollection = config.apiName === 'hero-slidy';

  const renderHeroSlideRow = (item: any, section: 'published' | 'unpublished') => {
    const idsInSection =
      section === 'published'
        ? heroPublishedList.map((x) => String(x.id))
        : heroUnpublishedList.map((x) => String(x.id));
    const hint =
      heroSlideDropHint && heroSlideDropHint.overId === item.id ? heroSlideDropHint.edge : null;
    const showLineBefore = hint === 'before';
    const showLineAfter = hint === 'after';
    const busy = heroBusySlideId === String(item.id);
    const unpublishedRow = section === 'unpublished';

    return (
      <div
        key={`${section}-${item.id}`}
        className={`relative border-b border-gray-50 ${unpublishedRow ? 'bg-gray-50/60' : ''}`}
      >
        {showLineBefore && (
          <div
            className="pointer-events-none absolute left-2 right-2 top-0 z-10 h-0.5 -translate-y-px rounded-full bg-[#7C3AED] shadow-[0_0_8px_rgba(124,58,237,0.75)]"
            aria-hidden
          />
        )}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            const dragId = draggingHeroSlideIdRef.current;
            if (!dragId || dragId === item.id || !idsInSection.includes(dragId)) {
              setHeroSlideDropHint(null);
              return;
            }
            const row = e.currentTarget.getBoundingClientRect();
            const mid = row.top + row.height / 2;
            const edge = e.clientY < mid ? 'before' : 'after';
            setHeroSlideDropHint({ overId: item.id, edge });
          }}
          onDrop={(e) => {
            e.preventDefault();
            const fromId = e.dataTransfer.getData('heroSlideId');
            draggingHeroSlideIdRef.current = null;
            setHeroSlideDropHint(null);
            if (!fromId || fromId === item.id || !idsInSection.includes(fromId)) return;
            const row = e.currentTarget.getBoundingClientRect();
            const mid = row.top + row.height / 2;
            const edge = e.clientY < mid ? 'before' : 'after';
            const next = reorderHeroSlideIds(idsInSection, fromId, item.id, edge);
            persistHeroSectionOrder(section, next);
          }}
          className="flex items-stretch gap-1 px-2 py-2 transition-colors hover:bg-gray-50/80"
        >
          <span
            draggable={!heroReordering}
            title="Přetáhnout — pořadí v této sekci"
            onDragStart={(e) => {
              draggingHeroSlideIdRef.current = String(item.id);
              e.dataTransfer.setData('heroSlideId', String(item.id));
              e.dataTransfer.effectAllowed = 'move';
            }}
            className="inline-flex shrink-0 cursor-grab touch-none items-center self-center rounded p-0.5 text-gray-300 hover:text-gray-500 active:cursor-grabbing"
            aria-label="Pořadí — přetáhnout"
            onClick={(e) => e.stopPropagation()}
          >
            <GripVertical className="h-4 w-4 shrink-0" aria-hidden />
          </span>
          <div className="flex min-w-0 flex-1 items-center gap-2.5">
            <HeroSlideRowMiniThumb item={item} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13px] font-medium text-[#001161]">
                {item[config.nameKey] || 'Bez názvu'}
              </div>
              {config.subtitleKey && item[config.subtitleKey] ? (
                <div className="mt-0.5 truncate text-[11px] text-gray-400">{item[config.subtitleKey]}</div>
              ) : null}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-0.5 self-center">
            <Link
              to={`/admin/visual-editor?id=${encodeURIComponent(String(item.id))}`}
              title="Upravit ve vizuálním editoru"
              className="inline-flex rounded-md p-1.5 text-[#001161] hover:bg-[#001161]/10"
              onClick={(e) => e.stopPropagation()}
            >
              <Pencil className="h-3.5 w-3.5" aria-hidden />
              <span className="sr-only">Upravit</span>
            </Link>
            {section === 'published' ? (
              <button
                type="button"
                disabled={heroReordering || busy}
                title="Skrýt z webu"
                onClick={(e) => {
                  e.stopPropagation();
                  void toggleHeroSlideActive(item, false);
                }}
                className="inline-flex rounded-md p-1.5 text-gray-500 hover:bg-gray-200/80 disabled:opacity-40"
              >
                {busy ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                ) : (
                  <EyeOff className="h-3.5 w-3.5" aria-hidden />
                )}
                <span className="sr-only">Skrýt z webu</span>
              </button>
            ) : (
              <button
                type="button"
                disabled={heroReordering || busy}
                title="Znovu zveřejnit na webu"
                onClick={(e) => {
                  e.stopPropagation();
                  void toggleHeroSlideActive(item, true);
                }}
                className="inline-flex rounded-md p-1.5 text-[#001161] hover:bg-[#001161]/10 disabled:opacity-40"
              >
                {busy ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                ) : (
                  <Eye className="h-3.5 w-3.5" aria-hidden />
                )}
                <span className="sr-only">Zveřejnit</span>
              </button>
            )}
          </div>
        </div>
        {showLineAfter && (
          <div
            className="pointer-events-none absolute bottom-0 left-2 right-2 z-10 h-0.5 translate-y-px rounded-full bg-[#7C3AED] shadow-[0_0_8px_rgba(124,58,237,0.75)]"
            aria-hidden
          />
        )}
      </div>
    );
  };

  return (
    <div className={`h-full flex ${isHeroCollection ? 'min-h-0 flex-1 flex-col' : 'overflow-hidden'}`}>
      {/* List */}
      <div
        className={`${
          isHeroCollection
            ? 'mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col border-gray-200 bg-white'
            : 'w-[300px] shrink-0 border-r border-gray-200 bg-white'
        } flex flex-col`}
      >
        <div className="p-3 border-b border-gray-100 space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-[13px] font-bold text-[#001161] uppercase tracking-wide">{config.displayName} <span className="text-gray-400 font-normal">({filtered.length})</span></h2>
            <button
              type="button"
              onClick={() =>
                config.apiName === 'hero-slidy' ? navigate('/admin/visual-editor') : handleNew()
              }
              className="rounded-lg bg-[#ff8c66] p-1.5 text-white transition-colors hover:bg-[#ff7a4d]"
              title={config.apiName === 'hero-slidy' ? 'Nový slide (vizuální editor)' : 'Přidat'}
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Hledat..." className="w-full pl-8 pr-3 py-1.5 text-[12px] border border-gray-200 rounded-lg bg-gray-50 focus:bg-white focus:border-[#001161] outline-none transition-all" />
          </div>
          {config.apiName === 'hero-slidy' && (
            <p className="text-[10px] leading-snug text-gray-500">
              Náhled rozložení u každého řádku. Tužka = úprava ve vizuálním editoru, ikona oka = skrýt / znovu
              zveřejnit. Úchop{' '}
              <GripVertical className="inline size-3 align-text-bottom text-gray-400" aria-hidden /> — přetažením
              změníte pořadí v rámci sekce (uloží se automaticky). Skryté slidy jsou dole.
            </p>
          )}
          {/* Category chips for produkty / tabs */}
          {(config.apiName === 'produkty' || config.apiName === 'tabs') && !loading && (() => {
            if (config.apiName === 'tabs') {
              const vals = Array.from(new Set(items.map((i: any) => i.subject).filter(Boolean))).sort() as string[];
              if (!vals.length) return null;
              return (
                <div className="flex flex-wrap gap-1 pt-0.5">
                  <button type="button" onClick={() => setSubjectFilter(null)} className={`px-2 py-0.5 rounded-full text-[10px] font-bold transition-colors ${!subjectFilter ? 'bg-[#001161] text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>Vše</button>
                  {vals.map((s) => (
                    <button key={s} type="button" onClick={() => setSubjectFilter(subjectFilter === s ? null : s)} className={`px-2 py-0.5 rounded-full text-[10px] font-bold transition-colors truncate max-w-[120px] ${subjectFilter === s ? 'bg-[#ff8c66] text-white' : 'bg-gray-100 text-gray-500 hover:bg-orange-50 hover:text-[#ff8c66]'}`} title={s}>{s}</button>
                  ))}
                </div>
              );
            }

            if (merchBrowse !== null) {
              const merchItems = items.filter((i: any) => i.type === 'merch');
              if (merchBrowse === 'all') {
                const cats = Array.from(new Set(merchItems.map((i: any) => getMerchCategoryLabel(i)))).sort();
                return (
                  <div className="flex flex-col gap-1.5 pt-0.5">
                    <button
                      type="button"
                      onClick={() => setMerchBrowse(null)}
                      className="inline-flex items-center gap-1 self-start px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-100 text-[#001161] hover:bg-gray-200"
                    >
                      <ArrowLeft className="w-3 h-3 shrink-0" aria-hidden />
                      Zpět k předmětům
                    </button>
                    <div className="flex flex-wrap gap-1">
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide w-full">Skupiny</span>
                      {cats.map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setMerchBrowse({ category: c, subcategory: null })}
                          className="px-2 py-0.5 rounded-full text-[10px] font-bold transition-colors truncate max-w-[140px] bg-gray-100 text-gray-500 hover:bg-orange-50 hover:text-[#ff8c66]"
                          title={c}
                        >
                          {c}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              }
              const subcats = Array.from(
                new Set(
                  merchItems
                    .filter((i: any) => getMerchCategoryLabel(i) === merchBrowse.category)
                    .map((i: any) => getMerchSubcategoryLabel(i))
                    .filter(Boolean),
                ),
              ).sort() as string[];
              return (
                <div className="flex flex-col gap-1.5 pt-0.5">
                  <button
                    type="button"
                    onClick={() => {
                      if (merchBrowse.subcategory) {
                        setMerchBrowse({ category: merchBrowse.category, subcategory: null });
                      } else {
                        setMerchBrowse('all');
                      }
                    }}
                    className="inline-flex items-center gap-1 self-start px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-100 text-[#001161] hover:bg-gray-200"
                  >
                    <ArrowLeft className="w-3 h-3 shrink-0" aria-hidden />
                    Zpět
                  </button>
                  <div className="flex flex-wrap gap-1 items-center">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide w-full">
                      {merchBrowse.category}
                      {subcats.length > 0 ? ' — podkategorie' : ''}
                    </span>
                    {subcats.length > 0 ? (
                      <button
                        type="button"
                        onClick={() => setMerchBrowse({ category: merchBrowse.category, subcategory: null })}
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold transition-colors ${!merchBrowse.subcategory ? 'bg-[#ff8c66] text-white' : 'bg-gray-100 text-gray-500 hover:bg-orange-50 hover:text-[#ff8c66]'}`}
                      >
                        Vše v skupině
                      </button>
                    ) : null}
                    {subcats.map((sub) => (
                      <button
                        key={sub}
                        type="button"
                        onClick={() => setMerchBrowse({ category: merchBrowse.category, subcategory: sub })}
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold transition-colors truncate max-w-[120px] ${merchBrowse.subcategory === sub ? 'bg-[#ff8c66] text-white' : 'bg-gray-100 text-gray-500 hover:bg-orange-50 hover:text-[#ff8c66]'}`}
                        title={sub}
                      >
                        {sub}
                      </button>
                    ))}
                  </div>
                </div>
              );
            }

            const nonMerch = items.filter((i: any) => i.type !== 'merch');
            const vals = Array.from(new Set(nonMerch.map((i: any) => i.category).filter(Boolean))).sort() as string[];
            const hasMerch = items.some((i: any) => i.type === 'merch');
            if (!vals.length && !hasMerch) return null;
            return (
              <div className="flex flex-wrap gap-1 pt-0.5">
                <button
                  type="button"
                  onClick={() => { setSubjectFilter(null); setMerchBrowse(null); }}
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold transition-colors ${!subjectFilter ? 'bg-[#001161] text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                >
                  Vše
                </button>
                {vals.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => { setMerchBrowse(null); setSubjectFilter(subjectFilter === s ? null : s); }}
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold transition-colors truncate max-w-[120px] ${subjectFilter === s ? 'bg-[#ff8c66] text-white' : 'bg-gray-100 text-gray-500 hover:bg-orange-50 hover:text-[#ff8c66]'}`}
                    title={s}
                  >
                    {s}
                  </button>
                ))}
                {hasMerch ? (
                  <button
                    type="button"
                    onClick={() => { setSubjectFilter(null); setMerchBrowse('all'); }}
                    className="px-2 py-0.5 rounded-full text-[10px] font-bold transition-colors max-w-[160px] truncate bg-violet-50 text-[#5b21b6] hover:bg-violet-100"
                    title="Merch a doplňkový sortiment"
                  >
                    Další produkty
                  </button>
                ) : null}
              </div>
            );
          })()}
          {config.staticData && items.length === 0 && (
            <button onClick={handleSeedFromStatic} disabled={saving} className="w-full text-[11px] bg-blue-50 hover:bg-blue-100 text-blue-700 px-3 py-1.5 rounded-lg font-medium">Naimportovat statická data</button>
          )}
          {config.apiName === 'produkty' && (
            <button
              onClick={() => void handleBulkBaseSync()}
              disabled={bulkSyncing || loading}
              className="w-full text-[11px] bg-[#001161] hover:bg-[#000d4a] text-white px-3 py-1.5 rounded-lg font-medium disabled:opacity-50"
            >
              {bulkSyncing ? 'Synchronizuji vše do Base.com…' : 'Synchronizovat všechny fyzické produkty do Base.com'}
            </button>
          )}
          {config.apiName === 'produkty' && bulkSyncProgress && (
            <div className="text-[10px] text-gray-500 leading-snug">
              {bulkSyncProgress}
            </div>
          )}
        </div>
        <div
          className="flex-1 overflow-y-auto"
          onDragLeave={
            config.apiName === 'hero-slidy'
              ? (e) => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
                    setHeroSlideDropHint(null);
                  }
                }
              : undefined
          }
        >
          {loading ? (
            <div className="flex justify-center p-8">
              <Loader2 className="w-6 h-6 text-gray-300 animate-spin" />
            </div>
          ) : config.apiName === 'hero-slidy' ? (
            heroPublishedList.length === 0 && heroUnpublishedList.length === 0 ? (
              <div className="p-6 text-center text-[12px] text-gray-400">Žádné položky</div>
            ) : (
              <>
                {heroReordering && (
                  <div className="flex items-center justify-center gap-2 border-b border-gray-100 py-2 text-[11px] text-gray-500">
                    <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" aria-hidden />
                    Ukládám pořadí…
                  </div>
                )}
                {heroPublishedList.map((item) => renderHeroSlideRow(item, 'published'))}
                {heroUnpublishedList.length > 0 ? (
                  <>
                    <div className="border-t border-gray-200 bg-gray-100/80 px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-gray-500">
                      Skryté — na webu se neukazují ({heroUnpublishedList.length})
                    </div>
                    {heroUnpublishedList.map((item) => renderHeroSlideRow(item, 'unpublished'))}
                  </>
                ) : null}
              </>
            )
          ) : filtered.length === 0 ? (
            <div className="p-6 text-center text-gray-400 text-[12px]">Žádné položky</div>
          ) : (
            filtered.map((item) => (
              <button
                key={item.id}
                onClick={() => handleSelect(item)}
                className={`flex w-full items-center gap-3 border-b border-gray-50 px-3 py-2.5 text-left transition-all ${
                  selectedId === item.id ? 'bg-[#001161]' : 'hover:bg-gray-50'
                }`}
              >
                {config.imageKey && item[config.imageKey] && (
                  <img
                    src={item[config.imageKey]}
                    className="h-9 w-9 shrink-0 rounded-lg border border-gray-200 object-cover"
                    alt=""
                  />
                )}
                <div className="min-w-0 flex-1">
                  <div
                    className={`truncate text-[13px] font-medium ${selectedId === item.id ? 'text-white' : 'text-[#001161]'}`}
                  >
                    {item[config.nameKey] || 'Bez názvu'}
                  </div>
                  {config.subtitleKey && item[config.subtitleKey] && (
                    <div
                      className={`truncate text-[11px] ${selectedId === item.id ? 'text-blue-200' : 'text-gray-400'}`}
                    >
                      {item[config.subtitleKey]}
                    </div>
                  )}
                </div>
                <ChevronRight
                  className={`h-3.5 w-3.5 shrink-0 ${selectedId === item.id ? 'text-white/40' : 'text-gray-300'}`}
                />
              </button>
            ))
          )}
        </div>
      </div>

      {/* Editor (hero slidy jen ve vizuálním editoru — bez pravého formuláře) */}
      {!isHeroCollection && (
      <div className="flex-1 overflow-y-auto bg-[#f7f8fc]">
        {editData ? (
          <div className="p-6 max-w-3xl">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg font-bold text-[#001161]">{isNew ? 'Nová položka' : 'Upravit položku'}</h3>
                {editData.id && <p className="text-[11px] text-gray-400 font-mono mt-0.5">ID: {editData.id}</p>}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {!isNew && editData.id && (
                  <button onClick={handleDelete} disabled={saving} className="px-3 py-1.5 text-[12px] text-red-500 hover:bg-red-50 rounded-lg flex items-center gap-1.5">
                    <Trash2 className="w-3.5 h-3.5" /> Smazat
                  </button>
                )}
                <button onClick={() => { setEditData(null); setSelectedId(null); setIsNew(false); setProductEditorTab('settings'); }} className="px-3 py-1.5 text-[12px] text-gray-500 hover:bg-gray-100 rounded-lg flex items-center gap-1.5">
                  <X className="w-3.5 h-3.5" /> Zavřít
                </button>
              </div>
            </div>
            {config.apiName === 'produkty' && !isNew && editData.id && (
              <div className="mb-5 inline-flex rounded-2xl bg-white border border-gray-200 p-1">
                <button
                  onClick={() => setProductEditorTab('settings')}
                  className={`px-4 py-2 rounded-xl text-[13px] font-bold transition-colors ${productEditorTab === 'settings' ? 'bg-[#001161] text-white' : 'text-gray-500 hover:text-[#001161]'}`}
                >
                  Nastavení položky
                </button>
                <button
                  onClick={() => setProductEditorTab('eshop')}
                  className={`px-4 py-2 rounded-xl text-[13px] font-bold transition-colors ${productEditorTab === 'eshop' ? 'bg-[#001161] text-white' : 'text-gray-500 hover:text-[#001161]'}`}
                >
                  Eshop
                </button>
              </div>
            )}

            {config.apiName === 'produkty' && productEditorTab === 'eshop' && !isNew && editData.id ? (
              <ProductCommercePanel
                editData={editData}
                onProductPatched={(updates) => setEditData((prev: any) => ({ ...prev, ...updates }))}
              />
            ) : (
              <>
                <div className="grid grid-cols-2 gap-4">
                  {config.fields.filter(f => !f.showIf || f.showIf(editData)).map(field => (
                    <FieldRenderer key={field.key} field={field} editData={editData} updateField={updateField} />
                  ))}
                </div>
                <div className="mt-6 pt-4 border-t border-gray-200">
                  <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 bg-[#001161] hover:bg-[#000d4a] text-white px-6 py-2.5 rounded-xl text-[13px] font-bold transition-colors disabled:opacity-50">
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Uložit do Supabase
                  </button>
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-gray-300">
            <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mb-4"><ChevronRight className="w-8 h-8" /></div>
            <p className="text-[13px]">Vyberte položku ze seznamu nebo vytvořte novou</p>
          </div>
        )}
      </div>
      )}
    </div>
  );
}

// ── Root export ───────────────────────────────────────────────────────────────
export default function CollectionBrowser() {
  const { collection } = useParams<{ collection: string }>();

  if (!collection) {
    return <div className="h-full flex items-center justify-center text-gray-400"><AlertCircle className="w-6 h-6 mr-2" /> Neznámá kolekce</div>;
  }

  // Předměty: special 3-column layout
  if (collection === 'predmety') {
    return <SubjectBrowser />;
  }

  const config = COLLECTION_CONFIG[collection];
  if (!config) {
    return <div className="h-full flex items-center justify-center text-gray-400"><AlertCircle className="w-6 h-6 mr-2" /> Kolekce „{collection}" neexistuje</div>;
  }

  return <GenericBrowser collection={collection} config={config} />;
}
