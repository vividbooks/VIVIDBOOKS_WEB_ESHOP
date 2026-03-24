import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Link, useNavigate, useLocation, useSearchParams } from 'react-router';
import { motion, AnimatePresence } from 'motion/react';
import {
  Check,
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  AlertCircle,
  Search,
  Building2,
  Loader2,
  Minus,
  Plus,
  Truck,
  User,
  Home,
  MapPin,
  Phone,
} from 'lucide-react';
import { useProducts } from '../contexts/ProductsContext';
import { useCart } from '../contexts/CartContext';
import { useOrderNav } from '../contexts/OrderNavContext';
import { SEOHead } from './SEOHead';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';
import { ImageWithFallback } from './figma/ImageWithFallback';
import { projectId, publicAnonKey } from '../utils/supabase/info';
import { parseSchoolAddress } from '../utils/parseSchoolAddress';
import { CheckoutSummaryCard } from './checkout/CheckoutSummaryCard';
import { formatPrice } from './checkout/formatPrice';
import { Elements } from '@stripe/react-stripe-js';
import { loadStripeForApp } from '../utils/stripe/loadStripeApp';
import { PaymentMethodSection } from './checkout/PaymentMethodCards';
import { StripePaymentSubmitForm } from './checkout/StripePaymentSubmitForm';
import { getProductUnitPriceInHaler } from './cartUpsellUtils';
import type { ProductBundleRecord } from '../utils/bundlePricing';
import { flashInvalidField } from '../utils/formFieldHighlight';
import { clearSchoolOrderDraft, hasSchoolOrderDraft, readSchoolOrderDraft, writeSchoolOrderDraft } from '../utils/schoolOrderDraft';

const FF = { fontFamily: "'Fenomen Sans', sans-serif" } as const;

const stripePublishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY ?? '';
const stripePromise = stripePublishableKey ? loadStripeForApp(stripePublishableKey) : null;
const CREATE_PAYMENT_INTENT_URL = `https://${projectId}.supabase.co/functions/v1/create-payment-intent`;
const MAKE_SERVER_FN = `https://${projectId}.supabase.co/functions/v1/make-server-93a20b6f`;
const EMAIL_RE_SCHOOL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const SCHOOL_ORDER_STEPS = [
  { id: 1 as const, label: 'Co objedn\u00e1v\u00e1te' },
  { id: 2 as const, label: 'Po\u010dty' },
  { id: 3 as const, label: '\u00dadaje' },
  { id: 4 as const, label: 'Doprava' },
  { id: 5 as const, label: 'Platba' },
  { id: 6 as const, label: 'Potvrzen\u00ed' },
];

/* ── Subject definitions ─────────────────────────────────────── */
const SUBJECTS_2 = [
  { key: 'Matematika 2. stupe\u0148', label: 'Matematika' },
  { key: 'Fyzika',                 label: 'Fyzika' },
  { key: 'P\u0159\u00edrodopis',   label: 'P\u0159\u00edrodopis' },
  { key: 'Chemie',                 label: 'Chemie' },
];
const SUBJECTS_1 = [
  { key: 'Matematika 1. stupe\u0148', label: 'Matematika' },
  { key: 'Prvouka',                   label: 'Prvouka' },
  { key: '\u010cesk\u00fd jazyk',      label: '\u010cesk\u00fd jazyk' },
];

const FORM_TYPES = [
  { key: 'digital',   label: 'Digit\u00e1ln\u00ed u\u010debnici',          color: '#FDE68A', textColor: '#92400E' },
  { key: 'workbook',  label: 'Pracovn\u00ed se\u0161ity a u\u010debnice',   color: '#FDE68A', textColor: '#92400E' },
  { key: 'vividboard',label: 'N\u00e1stroj Vividboard',                    color: '#FECACA', textColor: '#991B1B' },
] as const;

type FormTypeKey = typeof FORM_TYPES[number]['key'];

/* ── Positions ───────────────────────────────────────────────── */
const POSITIONS = [
  'U\u010ditel/ka na Z\u0160',
  'U\u010ditel/ka na S\u0160',
  '\u0158editel/ka \u0161koly',
  'Z\u00e1stupce/kyn\u011b \u0159editele',
  'V\u00fdchovn\u00fd poradce',
  'Metodik/\u010dka',
  'Hospod\u00e1\u0159',
  'Jin\u00e9',
];

/* ── License duration options ────────────────────────────────── */
const LICENSE_YEARS = [1, 2, 3];

/** Stejné dopravce jako v pokladně (ceny v haléřích) */
type SchoolShippingMethod = 'dpd' | 'zasilkovna' | 'gls' | 'ppl';
const SHIPPING_OPTIONS: Array<{ id: SchoolShippingMethod; label: string; price: number }> = [
  { id: 'dpd', label: 'DPD', price: 8900 },
  { id: 'zasilkovna', label: 'Zásilkovna Z-Point', price: 7900 },
  { id: 'gls', label: 'GLS', price: 8900 },
  { id: 'ppl', label: 'PPL', price: 9900 },
];

const PACKETA_WIDGET_URL = 'https://widget.packeta.com/v6/www/js/library.js';
const PACKETA_API_KEY = import.meta.env.VITE_PACKETA_API_KEY ?? '';

/** Info při kombinaci tiskovin + digitální licence (kroky s dopravou zůstávají). */
const DIGITAL_WITH_PRINT_INFO =
  'Na digit\u00e1ln\u00ed licenci v\u00e1m za\u0161leme kalkulaci p\u0159esn\u011b pro va\u0161i \u0161kolu. Digit\u00e1ln\u00ed licence se v tomto formul\u00e1\u0159i neplat\u00ed \u2014 domluv\u00edme ji s v\u00e1mi zvl\u00e1\u0161\u0165.';

/** Stejné položky jako v pokladně — u karty i Stripe Payment Element jako v pokladně. */
type SchoolPaymentPref = 'apple_pay' | 'google_pay' | 'card' | 'transfer';
const SCHOOL_PAYMENT_OPTIONS: Array<{
  id: SchoolPaymentPref;
  label: string;
  description: string;
  priceLabel: string;
}> = [
  {
    id: 'apple_pay',
    label: 'Apple Pay',
    description: 'Dostupné na podporovaných Apple zařízeních.',
    priceLabel: 'Zdarma',
  },
  {
    id: 'google_pay',
    label: 'Google Pay',
    description: 'Dostupné na podporovaných zařízeních a prohlížečích.',
    priceLabel: 'Zdarma',
  },
  {
    id: 'card',
    label: 'Online platba kartou',
    description: 'Okamžitá platba přes Stripe Payment Element (stejně jako v pokladně).',
    priceLabel: 'Zdarma',
  },
  {
    id: 'transfer',
    label: 'Převodem',
    description: 'Fakturace převodem na bankovní účet po domluvě.',
    priceLabel: 'Zdarma',
  },
];

/* ── Input class ─────────────────────────────────────────────── */
const INPUT_CLS = "w-full bg-white border border-[#001161]/10 rounded-[12px] px-4 py-3 text-[15px] text-[#001161] placeholder-[#001161]/40 outline-none focus:border-[#5B4FD8] focus:ring-2 focus:ring-[#5B4FD8]/15 transition-all";

interface Product {
  id: string; name: string; price: string; priceType: string;
  category: string; type: string; image: string | null; note?: string;
  shopifyVariantId?: string | null; shopifyProductId?: string | null;
}

interface DeliveryAddressState {
  recipientName: string;
  deliveryStreet: string;
  deliveryCity: string;
  deliveryZip: string;
}

/* ── Presentational bits musí být mimo OrderPage: jinak je při každém setState
    nová funkce komponenty → React remountuje řádky → sekání a „zpožděné“ kliky ── */
function OrderStepper({ value, onChange, min = 0, max = 9999, step = 1, unit = '' }: {
  value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number; unit?: string;
}) {
  return (
    <div className="flex items-center gap-1">
      <button type="button" onClick={() => onChange(Math.max(min, value - step))}
        className="w-9 h-9 bg-[#26356B] hover:bg-[#001161] rounded-lg flex items-center justify-center text-white cursor-pointer transition-colors shrink-0">
        <Minus className="w-4 h-4" />
      </button>
      <div className="min-w-[80px] text-center font-['Fenomen_Sans',sans-serif] font-bold text-[15px] text-[#001161]">
        {value}{unit ? `\u00a0${unit}` : ''}
      </div>
      <button type="button" onClick={() => onChange(Math.min(max, value + step))}
        className="w-9 h-9 bg-[#26356B] hover:bg-[#001161] rounded-lg flex items-center justify-center text-white cursor-pointer transition-colors shrink-0">
        <Plus className="w-4 h-4" />
      </button>
    </div>
  );
}

function OrderCheckboxRow({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-[14px] transition-all cursor-pointer text-left border-2 ${
        active ? 'bg-[#001161]/6 border-[#001161]/20' : 'bg-white border-transparent hover:border-[#001161]/10 hover:bg-[#001161]/3'
      }`}
    >
      <span
        className={`w-5 h-5 rounded-[6px] flex items-center justify-center shrink-0 border-2 transition-all ${
          active ? 'bg-[#001161] border-[#001161]' : 'bg-transparent border-[#001161]/25'
        }`}
      >
        {active && (
          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        )}
      </span>
      <span style={FF} className="text-[16px] text-[#001161] leading-tight">
        {label}
      </span>
    </button>
  );
}

const SIDEBAR_CHK =
  'h-[15px] w-[15px] shrink-0 rounded-[3px] border border-[#001161]/30 bg-white text-[#001161] accent-[#001161] focus:outline-none focus:ring-2 focus:ring-[#001161]/15 focus:ring-offset-1';

/** Jednoduchý řádek v sidebaru — checkbox + text, volitelně odsazený pod skupinou */
function OrderSidebarCheckboxRow({
  active,
  label,
  onClick,
  nested,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
  nested?: boolean;
}) {
  return (
    <label
      className={`flex items-center gap-2.5 cursor-pointer rounded-lg py-1.5 pr-2 transition-colors hover:bg-[#001161]/[0.05] ${
        nested ? 'pl-1' : 'pl-2'
      }`}
    >
      <input
        type="checkbox"
        checked={active}
        onChange={() => onClick()}
        className={SIDEBAR_CHK}
      />
      <span
        style={FF}
        className="text-[13px] leading-snug text-[#001161] select-none [font-weight:600]"
      >
        {label}
      </span>
    </label>
  );
}

/** Hlavička stupně s checkboxem — vybere / odznačí celý stupeň (s fallbackem alespoň jeden předmět) */
function OrderSidebarGradeHeader({
  title,
  groupKeys,
  selectedKeys,
  onToggleGroup,
}: {
  title: string;
  groupKeys: string[];
  selectedKeys: string[];
  onToggleGroup: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const allSelected = groupKeys.length > 0 && groupKeys.every((k) => selectedKeys.includes(k));
  const someSelected = groupKeys.some((k) => selectedKeys.includes(k));

  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.indeterminate = someSelected && !allSelected;
  }, [someSelected, allSelected]);

  return (
    <label className="flex items-center gap-2.5 cursor-pointer select-none pb-1 border-b border-[#001161]/[0.08]">
      <input
        ref={inputRef}
        type="checkbox"
        checked={allSelected}
        onChange={onToggleGroup}
        className={SIDEBAR_CHK}
      />
      <span style={FF} className="text-[12px] font-bold uppercase tracking-[0.12em] text-[#001161]/70">
        {title}
      </span>
    </label>
  );
}

/** Nadpis sekce bez checkboxu (Forma) — zarovnání s nadpisy stupňů (prázdný sloupec místo checkboxu) */
function OrderSidebarSectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2.5 pb-1 border-b border-[#001161]/[0.08] mb-2">
      <span className="w-[15px] shrink-0" aria-hidden />
      <span style={FF} className="text-[12px] font-bold uppercase tracking-[0.12em] text-[#001161]/70">
        {children}
      </span>
    </div>
  );
}

function OrderInlineCheckboxPill({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-2 px-3 py-2 rounded-[12px] border transition-all cursor-pointer ${
        active ? 'bg-[#001161] text-white border-[#001161]' : 'bg-white/80 text-[#001161] border-[#001161]/10 hover:border-[#001161]/20'
      }`}
    >
      <span
        className={`w-4 h-4 rounded-[5px] flex items-center justify-center shrink-0 border ${
          active ? 'bg-white border-white text-[#001161]' : 'bg-transparent border-[#001161]/25 text-transparent'
        }`}
      >
        <Check className="w-3 h-3" />
      </span>
      <span style={FF} className="text-[13px] font-semibold leading-none whitespace-nowrap">
        {label}
      </span>
    </button>
  );
}

function workbookQuantitiesRecordsEqual(a: Record<string, number>, b: Record<string, number>) {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const k of keys) {
    if ((a[k] ?? 0) !== (b[k] ?? 0)) return false;
  }
  return true;
}

/* ─────────────────────────────────────────────────────────────── */
export function OrderPage() {
  const navigate   = useNavigate();
  const location   = useLocation();
  const [searchParams] = useSearchParams();
  const { products, isLoading } = useProducts();
  const { items, addItem, updateQuantity: updateCartQuantity, removeItem, openCart } = useCart();
  const { step, setStep, submitting, setSubmitting, registerStep1Guard, tryAdvanceFromStep1 } = useOrderNav();
  const [draftHydrated, setDraftHydrated] = useState(false);

  const prevPathRef = useRef<string>('');
  useEffect(() => {
    if (location.pathname === '/objednat' && prevPathRef.current !== '/objednat') {
      const requestedStep = searchParams.get('step') === '2';
      const savedDraft = readSchoolOrderDraft();
      const shouldOpenCounts = requestedStep && (items.length > 0 || hasSchoolOrderDraft(savedDraft));
      setStep(shouldOpenCounts ? 2 : 1);
    }
    prevPathRef.current = location.pathname;
  }, [items.length, location.pathname, searchParams, setStep]);

  const [flowError, setFlowError] = useState('');

  useEffect(() => {
    setFlowError('');
  }, [step]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const media = window.matchMedia('(min-width: 1024px)');
    const apply = () => setIsDesktopPaymentView(media.matches);
    apply();
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, []);

  /* ── pre-select from location state / URL param ── */
  const preselectedCategory =
    (location.state as { category?: string } | null)?.category ??
    searchParams.get('predmet') ?? null;

  /* ── sidebar filter state ── */
  const allSubjectKeys = [...SUBJECTS_2.map(s => s.key), ...SUBJECTS_1.map(s => s.key)];

  const initSubjects = () => {
    if (preselectedCategory) {
      const match = allSubjectKeys.find(k => k.toLowerCase().includes(preselectedCategory.toLowerCase()) || preselectedCategory.toLowerCase().includes(k.toLowerCase().split(' ')[0]));
      return match ? [match] : allSubjectKeys;
    }
    return allSubjectKeys;
  };

  const [selSubjects, setSelSubjects] = useState<string[]>([]);
  const [selTypes, setSelTypes]       = useState<FormTypeKey[]>([]);

  /** Bez tiskovin — jen digitální licence a/nebo Vividboard → po údajích rovnou odeslat, bez dopravy/platby/shrnutí. */
  const isDigitalServicesOnly = useMemo(
    () => !selTypes.includes('workbook') && (selTypes.includes('digital') || selTypes.includes('vividboard')),
    [selTypes],
  );
  /** Tiskoviny + digitál → doprava/platba zůstávají; digitální licence se kalkuluje zvlášť. */
  const showDigitalPlusPrintNotice = useMemo(
    () => selTypes.includes('workbook') && selTypes.includes('digital'),
    [selTypes],
  );
  const visibleOrderSteps = useMemo(
    () => (isDigitalServicesOnly ? SCHOOL_ORDER_STEPS.filter((s) => s.id <= 3) : SCHOOL_ORDER_STEPS),
    [isDigitalServicesOnly],
  );

  useEffect(() => {
    if (isDigitalServicesOnly && step > 3) {
      setStep(3);
    }
  }, [isDigitalServicesOnly, step, setStep]);

  /* ── product quantities ── */
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [schoolBundleQtyById, setSchoolBundleQtyById] = useState<Record<string, number>>({});
  const [publicProductBundles, setPublicProductBundles] = useState<ProductBundleRecord[]>([]);
  const appliedSchoolBundleNavKeysRef = useRef<Set<string>>(new Set());

  /* ── digital / vividboard ── */
  const [students2, setStudents2]   = useState(100);
  const [licYears, setLicYears]     = useState(1);
  const [digitalSubjects, setDigitalSubjects] = useState<string[]>([]);
  const [vividboardCount, setVividboardCount] = useState(1);
  const [shipping, setShipping] = useState<{
    method: SchoolShippingMethod;
    price: number;
    pickupPointId?: string;
    pickupPointName?: string;
    pickupPointStreet?: string;
    pickupPointCity?: string;
    pickupPointZip?: string;
  }>({ method: 'dpd', price: 8900 });
  const [paymentMethod, setPaymentMethod] = useState<SchoolPaymentPref>('card');
  const [packetaLoading, setPacketaLoading] = useState(false);
  const [packetaError, setPacketaError] = useState('');
  const [schoolShippingError, setSchoolShippingError] = useState('');
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [paymentIntentId, setPaymentIntentId] = useState<string | null>(null);
  const [schoolPaymentIntentLoading, setSchoolPaymentIntentLoading] = useState(false);
  const [schoolPaymentIntentError, setSchoolPaymentIntentError] = useState('');
  const [isDesktopPaymentView, setIsDesktopPaymentView] = useState(false);
  const lastSchoolPaymentKeyRef = useRef<string | null>(null);

  /* ── cart state for workbook upsell ── */
  const [upsellDismissed, setUpsellDismissed] = useState(false);

  /* ── contact form ── */
  const [form, setForm] = useState({
    name: '', email: '', phone: '', position: '', gdpr: false, newsletter: false,
    schoolName: '', ico: '', street: '', city: '', zip: '',
  });
  const [hasSeparateDeliveryAddress, setHasSeparateDeliveryAddress] = useState(false);
  const [deliveryAddress, setDeliveryAddress] = useState<DeliveryAddressState>({
    recipientName: '',
    deliveryStreet: '',
    deliveryCity: '',
    deliveryZip: '',
  });
  const [submitted,  setSubmitted]  = useState(false);
  const [formError,  setFormError]  = useState('');

  /* ── school autocomplete ── */
  const [schoolResults, setSchoolResults] = useState<{ ico: string; name: string; address?: string }[]>([]);
  const [schoolOpen,    setSchoolOpen]    = useState(false);
  const [schoolBusy,    setSchoolBusy]    = useState(false);
  const schoolRef  = useRef<HTMLDivElement>(null);
  const schoolTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const schoolAddressFetchSeq = useRef(0);

  useEffect(() => {
    const draft = readSchoolOrderDraft();
    if (draft) {
      if (draft.selSubjects.length > 0) setSelSubjects(draft.selSubjects);
      if (draft.selTypes.length > 0) setSelTypes(draft.selTypes as FormTypeKey[]);
      if (draft.students2 > 0) setStudents2(draft.students2);
      if (draft.licYears > 0) setLicYears(draft.licYears);
      if (draft.digitalSubjects.length > 0) setDigitalSubjects(draft.digitalSubjects);
      if (draft.vividboardCount > 0) setVividboardCount(draft.vividboardCount);
      const bq = draft.bundleQuantities;
      if (bq && typeof bq === 'object') {
        const next: Record<string, number> = {};
        for (const [k, v] of Object.entries(bq)) {
          const n = Math.floor(Number(v));
          if (n > 0) next[k] = n;
        }
        if (Object.keys(next).length > 0) setSchoolBundleQtyById(next);
      }
    }
    setDraftHydrated(true);
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch(`${MAKE_SERVER_FN}/product-bundles`, { headers: { Authorization: `Bearer ${publicAnonKey}` } })
      .then((r) => (r.ok ? r.json() : { bundles: [] }))
      .then((j) => {
        if (!cancelled) setPublicProductBundles(Array.isArray(j.bundles) ? j.bundles : []);
      })
      .catch(() => {
        if (!cancelled) setPublicProductBundles([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const add = (location.state as { addSchoolBundle?: { id: string } } | null)?.addSchoolBundle;
    if (!add?.id) return;
    const k = location.key;
    if (appliedSchoolBundleNavKeysRef.current.has(k)) return;
    appliedSchoolBundleNavKeysRef.current.add(k);
    setSchoolBundleQtyById((prev) => ({ ...prev, [add.id]: (prev[add.id] || 0) + 1 }));
    setSelTypes((prev) => (prev.includes('workbook') ? prev : [...prev, 'workbook']));
    navigate(`${location.pathname}${location.search}`, { replace: true, state: {} });
  }, [location.state, location.key, location.pathname, location.search, navigate]);

  const SCHOOL_SEARCH_FN = `https://${projectId}.supabase.co/functions/v1/make-server-93a20b6f/school-search`;

  const applySchoolAddressFromIco = useCallback(async (icoRaw: string) => {
    const icoDigits = String(icoRaw ?? '').replace(/\D/g, '');
    if (icoDigits.length < 6) return;

    const seq = ++schoolAddressFetchSeq.current;
    try {
      const res = await fetch(
        `${SCHOOL_SEARCH_FN}?ico=${encodeURIComponent(icoDigits)}`,
        { headers: { Authorization: `Bearer ${publicAnonKey}` } },
      );
      const data = await res.json().catch(() => ({}));
      const result = Array.isArray(data.results) ? data.results[0] : undefined;
      if (seq !== schoolAddressFetchSeq.current || !result) return;

      const parsedAddress = parseSchoolAddress(result.address, result.ico);
      setForm((p) => ({
        ...p,
        schoolName: result.name || p.schoolName,
        ico: result.ico ? String(result.ico).replace(/\D/g, '').slice(0, 10) : p.ico,
        street: parsedAddress.street || p.street,
        city: parsedAddress.city || p.city,
        zip: parsedAddress.zip || p.zip,
      }));
    } catch {
      // best-effort
    }
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (schoolRef.current && !schoolRef.current.contains(e.target as Node)) setSchoolOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const fetchSchools = async (q: string) => {
    if (q.trim().length < 2) { setSchoolResults([]); setSchoolOpen(false); return; }
    setSchoolBusy(true);
    try {
      const res = await fetch(
        `${SCHOOL_SEARCH_FN}?q=${encodeURIComponent(q)}`,
        { headers: { Authorization: `Bearer ${publicAnonKey}` } }
      );
      const data = await res.json();
      setSchoolResults(data.results || []);
      setSchoolOpen((data.results || []).length > 0);
    } catch { setSchoolResults([]); }
    finally { setSchoolBusy(false); }
  };

  const handleSchoolInput = (v: string) => {
    setForm(p => ({ ...p, schoolName: v }));
    if (schoolTimer.current) clearTimeout(schoolTimer.current);
    schoolTimer.current = setTimeout(() => fetchSchools(v), 350);
    setFormError('');
  };

  useEffect(() => {
    const icoDigits = form.ico.replace(/\D/g, '');
    if (icoDigits.length < 6) return;

    const timer = window.setTimeout(() => {
      void applySchoolAddressFromIco(form.ico);
    }, 450);

    return () => window.clearTimeout(timer);
  }, [form.ico, applySchoolAddressFromIco]);

  const selectSchool = (s: { ico: string; name: string; address?: string }) => {
    const parsedAddress = parseSchoolAddress(s.address, s.ico);
    const icoStr = String(s.ico ?? '').trim();
    setForm(p => ({
      ...p,
      schoolName: s.name,
      ico: icoStr.replace(/\D/g, '').slice(0, 10),
      street: parsedAddress.street || p.street,
      city: parsedAddress.city || p.city,
      zip: parsedAddress.zip || p.zip,
    }));
    setSchoolOpen(false); setSchoolResults([]);
    void applySchoolAddressFromIco(icoStr);
  };

  /* ── computed products ── */
  const workbooks = useMemo(() => products.filter(p => p.type === 'workbook'), [products]);
  const workbookProductIds = useMemo(() => new Set(workbooks.map((p) => String(p.id))), [workbooks]);
  const productBundlesById = useMemo(() => {
    const m: Record<string, ProductBundleRecord> = {};
    for (const b of publicProductBundles) {
      if (b?.id) m[String(b.id)] = b;
    }
    return m;
  }, [publicProductBundles]);
  const productsByCategory = useMemo(
    () =>
      workbooks.reduce<Record<string, Product[]>>((acc, p) => {
        const cat = p.category || 'Ostatn\u00ed';
        if (!acc[cat]) acc[cat] = [];
        acc[cat].push(p);
        return acc;
      }, {}),
    [workbooks],
  );

  const CAT_ORDER = useMemo(
    () => [
      'Matematika 2. stupe\u0148', 'Matematika 1. stupe\u0148',
      'Fyzika', 'P\u0159\u00edrodopis', 'Chemie', '\u010cesk\u00fd jazyk', 'Prvouka',
    ],
    [],
  );
  const sortedCats = useMemo(
    () =>
      [
        ...CAT_ORDER.filter(c => productsByCategory[c]),
        ...Object.keys(productsByCategory).filter(c => !CAT_ORDER.includes(c)),
      ].filter(c => selSubjects.length === 0 || selSubjects.includes(c)),
    [CAT_ORDER, productsByCategory, selSubjects],
  );

  useEffect(() => {
    const nextQuantities: Record<string, number> = {};
    items.forEach((item) => {
      if (workbookProductIds.has(String(item.productId))) {
        nextQuantities[String(item.productId)] = item.quantity;
      }
    });
    setQuantities((prev) => (workbookQuantitiesRecordsEqual(prev, nextQuantities) ? prev : nextQuantities));
  }, [items, workbookProductIds]);

  useEffect(() => {
    if (!draftHydrated) return;
    const bundleQuantities = Object.fromEntries(
      Object.entries(schoolBundleQtyById).filter(([, q]) => (q || 0) > 0),
    );
    const nextDraft = {
      selSubjects,
      selTypes,
      students2,
      licYears,
      digitalSubjects,
      vividboardCount,
      ...(Object.keys(bundleQuantities).length > 0 ? { bundleQuantities } : {}),
    };
    const noBundles = Object.keys(bundleQuantities).length === 0;
    if (
      selSubjects.length === 0 &&
      selTypes.length === 0 &&
      students2 === 100 &&
      licYears === 1 &&
      digitalSubjects.length === 0 &&
      vividboardCount === 1 &&
      noBundles
    ) {
      clearSchoolOrderDraft();
      return;
    }
    writeSchoolOrderDraft(nextDraft);
  }, [digitalSubjects, draftHydrated, licYears, schoolBundleQtyById, selSubjects, selTypes, students2, vividboardCount]);

  const syncWorkbookQuantity = useCallback((product: Product, quantity: number) => {
    const nextQuantity = Math.max(0, Math.floor(quantity));
    const variantId = product.shopifyVariantId || undefined;
    const existing = items.find((item) => item.productId === String(product.id) && item.variantId === variantId);

    if (existing) {
      if (nextQuantity === 0) {
        removeItem(String(product.id), variantId);
      } else {
        updateCartQuantity(String(product.id), variantId, nextQuantity);
      }
      return;
    }

    if (nextQuantity === 0) return;

    addItem({
      productId: String(product.id),
      productName: product.name,
      variantId,
      quantity: nextQuantity,
      unitPrice: getProductUnitPriceInHaler(product),
      imageUrl: product.image || undefined,
    });
  }, [items, addItem, updateCartQuantity, removeItem]);

  const updateQty = (id: string, delta: number) => {
    const product = products.find((item) => item.id === id);
    if (!product) return;
    syncWorkbookQuantity(product as Product, (quantities[id] || 0) + delta);
  };

  const setQtyInput = (id: string, value: string) => {
    const product = products.find((item) => item.id === id);
    if (!product) return;
    syncWorkbookQuantity(product as Product, parseInt(value.replace(/\D/g, '')) || 0);
  };

  const updateSchoolBundleQty = useCallback((bundleId: string, delta: number) => {
    setSchoolBundleQtyById((prev) => {
      const cur = prev[bundleId] || 0;
      const next = Math.max(0, Math.floor(cur + delta));
      const out = { ...prev };
      if (next <= 0) delete out[bundleId];
      else out[bundleId] = next;
      return out;
    });
  }, []);

  const setSchoolBundleQtyInput = useCallback((bundleId: string, value: string) => {
    const v = Math.max(0, Math.floor(parseInt(value.replace(/\D/g, ''), 10) || 0));
    setSchoolBundleQtyById((prev) => {
      const out = { ...prev };
      if (v <= 0) delete out[bundleId];
      else out[bundleId] = v;
      return out;
    });
  }, []);

  const activeSchoolBundleLines = useMemo(
    () =>
      Object.entries(schoolBundleQtyById)
        .filter(([, q]) => (q || 0) > 0)
        .map(([bundleId, qty]) => ({
          bundleId,
          qty,
          bundle: productBundlesById[bundleId],
        })),
    [schoolBundleQtyById, productBundlesById],
  );

  /* ── product sort: krok za krokem → pro všechny → ostatní, pak ročník desc ── */
  const sortProducts = (prods: Product[]) => {
    const getGrade = (name: string) => {
      const m = name.match(/pro\s+(\d+)\.\s*ro/i);
      return m ? parseInt(m[1]) : 0;
    };
    const getSeries = (name: string) => {
      if (/krok za krokem/i.test(name)) return 0;
      if (/pro v[\u0161s]echny/i.test(name)) return 1;
      return 2;
    };
    return [...prods].sort((a, b) => {
      const sd = getSeries(a.name) - getSeries(b.name);
      if (sd !== 0) return sd;
      return getGrade(b.name) - getGrade(a.name);
    });
  };

  /* ── součty sešitů (původní logika formuláře) — celkem v Kč jako integer (např. 125 × ks) ── */
  const workbookIndividualTotalKc = Object.entries(quantities).reduce((sum, [id, qty]) => {
    if (!qty) return sum;
    const p = products.find((x) => String(x.id) === String(id));
    return p ? sum + parseInt(p.price.replace(/\D/g, ''), 10) * qty : sum;
  }, 0);
  const workbookIndividualPcs = Object.values(quantities).reduce((s, q) => s + (q || 0), 0);
  const workbookBundleSubtotalHalers = Object.entries(schoolBundleQtyById).reduce((sum, [bundleId, qty]) => {
    if (!qty) return sum;
    const b = productBundlesById[bundleId];
    return b ? sum + Math.max(0, Math.round(b.bundlePriceHaler)) * qty : sum;
  }, 0);
  const workbookBundlePcs = Object.entries(schoolBundleQtyById).reduce((s, [bundleId, qty]) => {
    if (!qty) return s;
    const b = productBundlesById[bundleId];
    if (!b) return s + qty;
    const n = (b.productIds || []).filter((pid) => workbookProductIds.has(String(pid))).length;
    const per = n > 0 ? n : Math.max(1, (b.productIds || []).length);
    return s + qty * per;
  }, 0);
  const workbookTotal = workbookIndividualTotalKc + Math.round(workbookBundleSubtotalHalers / 100);
  const workbookItems = workbookIndividualPcs + workbookBundlePcs;
  const hasSchoolWorkbookSelection = workbookIndividualPcs > 0
    || Object.values(schoolBundleQtyById).some((q) => (q || 0) > 0);

  /** Shrnutí vpravo: pouze tato školní objednávka (ne celý B2C košík), v haléřích pro formatPrice. */
  const orderSummaryWorkbookSubtotalHalers = workbookIndividualTotalKc * 100 + workbookBundleSubtotalHalers;
  const showShippingInOrderSummary = step >= 4 && !isDigitalServicesOnly;
  const orderSummaryShippingHalers = showShippingInOrderSummary ? shipping.price : 0;
  const orderSummaryGrandHalers = orderSummaryWorkbookSubtotalHalers + orderSummaryShippingHalers;

  const canPrepareSchoolCardPayment = useMemo(() => {
    if (isDigitalServicesOnly || !hasSchoolWorkbookSelection) return false;
    if (!form.schoolName.trim() || !form.ico.trim()) return false;
    if (!form.name.trim() || !form.phone.trim()) return false;
    if (!form.email.trim() || !EMAIL_RE_SCHOOL.test(form.email.trim())) return false;
    if (!form.street.trim() || !form.city.trim() || !form.zip.trim()) return false;
    if (hasSeparateDeliveryAddress) {
      if (
        !deliveryAddress.deliveryStreet.trim()
        || !deliveryAddress.deliveryCity.trim()
        || !deliveryAddress.deliveryZip.trim()
      ) {
        return false;
      }
    }
    if (shipping.method === 'zasilkovna' && !shipping.pickupPointId) return false;
    return true;
  }, [
    isDigitalServicesOnly,
    hasSchoolWorkbookSelection,
    form.schoolName,
    form.ico,
    form.name,
    form.phone,
    form.email,
    form.street,
    form.city,
    form.zip,
    hasSeparateDeliveryAddress,
    deliveryAddress.deliveryStreet,
    deliveryAddress.deliveryCity,
    deliveryAddress.deliveryZip,
    shipping.method,
    shipping.pickupPointId,
  ]);

  const validateStep2Fields = useCallback(() => {
    setFlowError('');
    if (selTypes.includes('workbook') && !hasSchoolWorkbookSelection) {
      setFlowError('U tiskovin zadejte alespo\u0148 jeden kus, nebo formu zru\u0161te v prvn\u00edm kroku.');
      setTimeout(() => flashInvalidField(document.getElementById('order-field-step2-workbooks')), 0);
      return false;
    }
    if (selTypes.includes('vividboard') && vividboardCount < 1) {
      setFlowError('Zadejte po\u010det licenc\u00ed Vividboard.');
      setTimeout(() => flashInvalidField(document.getElementById('order-field-step2-vividboard')), 0);
      return false;
    }
    return true;
  }, [selTypes, hasSchoolWorkbookSelection, vividboardCount]);

  const validateContactStep = useCallback(() => {
    const fail = (msg: string, fieldId: string) => {
      setFormError(msg);
      setTimeout(() => flashInvalidField(document.getElementById(fieldId)), 0);
      return false;
    };
    if (!form.schoolName.trim()) return fail('Vypl\u0148te n\u00e1zev \u0161koly.', 'order-field-schoolName');
    if (!form.ico.trim()) return fail('Vypl\u0148te I\u010cO \u0161koly.', 'order-field-ico');
    if (!form.name.trim()) return fail('Vypl\u0148te jm\u00e9no.', 'order-field-name');
    if (!form.email.trim()) return fail('Vypl\u0148te e-mail.', 'order-field-email');
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim());
    if (!emailOk) return fail('Zadejte platn\u00fd e-mail (nap\u0159. jmeno@skola.cz).', 'order-field-email');
    if (!form.phone.trim()) return fail('Vypl\u0148te telefon.', 'order-field-phone');
    if (!form.position.trim()) return fail('Vyberte funkci / pozici u \u0161koly.', 'order-field-position');
    if (!form.street.trim()) return fail('Vypl\u0148te faktura\u010dn\u00ed adresu \u0161koly.', 'order-field-street');
    if (!form.city.trim()) return fail('Vypl\u0148te faktura\u010dn\u00ed adresu \u0161koly.', 'order-field-city');
    if (!form.zip.trim()) return fail('Vypl\u0148te faktura\u010dn\u00ed adresu \u0161koly.', 'order-field-zip');
    if (hasSeparateDeliveryAddress) {
      if (!deliveryAddress.deliveryStreet.trim()) return fail('Vypl\u0148te doru\u010dovac\u00ed adresu.', 'order-field-deliveryStreet');
      if (!deliveryAddress.deliveryCity.trim()) return fail('Vypl\u0148te doru\u010dovac\u00ed adresu.', 'order-field-deliveryCity');
      if (!deliveryAddress.deliveryZip.trim()) return fail('Vypl\u0148te doru\u010dovac\u00ed adresu.', 'order-field-deliveryZip');
    }
    if (!form.gdpr) {
      return fail('Souhlas se zpracov\u00e1n\u00edm osobn\u00edch \u00fadaj\u016f je povinn\u00fd.', 'order-field-gdpr');
    }
    setFormError('');
    return true;
  }, [form, hasSeparateDeliveryAddress, deliveryAddress]);

  /** Stejné tělo jako POST /orders (make-server) — pro převod i po zaplacení kartou (stripe-webhook). */
  const buildSchoolOrdersPayload = useCallback((paymentPreference: SchoolPaymentPref) => ({
    customer: { ...form },
    deliveryAddress: hasSeparateDeliveryAddress ? { ...deliveryAddress } : null,
    digital: selTypes.includes('digital')
      ? { students2, students1: 0, licYears, scopeNote: '', subjects: digitalSubjects }
      : null,
    vividboard: selTypes.includes('vividboard') ? { count: vividboardCount } : null,
    workbooks: selTypes.includes('workbook') ? {
      items: [
        ...Object.entries(quantities)
          .filter(([, qty]) => qty > 0)
          .map(([id, qty]) => {
            const p = products.find((x) => String(x.id) === String(id));
            return { id, name: p?.name, price: p?.price, quantity: qty };
          }),
        ...Object.entries(schoolBundleQtyById)
          .filter(([, qty]) => (qty || 0) > 0)
          .map(([bundleId, quantity]) => {
            const b = productBundlesById[bundleId];
            if (!b) return null;
            const unitKc = Math.max(0, Math.round(b.bundlePriceHaler / 100));
            const breakdown = (b.productIds || [])
              .map((pid) => products.find((x) => String(x.id) === String(pid))?.name)
              .filter(Boolean);
            const name = breakdown.length
              ? `${b.title} — ${breakdown.join('; ')}`
              : b.title;
            return {
              id: `bundle:${bundleId}`,
              name,
              price: `${unitKc},-`,
              quantity,
              bundleId,
              bundleTitle: b.title,
            };
          })
          .filter((row): row is NonNullable<typeof row> => row != null),
      ],
      bundles: Object.entries(schoolBundleQtyById)
        .filter(([, qty]) => (qty || 0) > 0)
        .map(([bundleId, quantity]) => {
          const b = productBundlesById[bundleId];
          if (!b) return null;
          const breakdown = (b.productIds || []).map((pid) => {
            const p = products.find((x) => String(x.id) === String(pid));
            return { id: String(pid), name: p?.name };
          });
          return {
            bundleId,
            title: b.title,
            quantity,
            bundlePriceHaler: b.bundlePriceHaler,
            lines: breakdown,
          };
        })
        .filter((row): row is NonNullable<typeof row> => row != null),
      total: workbookTotal,
      totalItems: workbookItems,
    } : null,
    subjects: selSubjects,
    types: selTypes,
    hasSeparateDeliveryAddress,
    shipping: {
      method: shipping.method,
      price: shipping.price,
      pickupPointId: shipping.pickupPointId,
      pickupPointName: shipping.pickupPointName,
      pickupPointStreet: shipping.pickupPointStreet,
      pickupPointCity: shipping.pickupPointCity,
      pickupPointZip: shipping.pickupPointZip,
    },
    paymentPreference,
  }), [
    form,
    hasSeparateDeliveryAddress,
    deliveryAddress,
    selTypes,
    students2,
    licYears,
    digitalSubjects,
    vividboardCount,
    quantities,
    products,
    workbookTotal,
    workbookItems,
    selSubjects,
    shipping,
    schoolBundleQtyById,
    productBundlesById,
  ]);

  useEffect(() => {
    if (step !== 5 || paymentMethod !== 'card') {
      setClientSecret(null);
      setPaymentIntentId(null);
      setSchoolPaymentIntentError('');
      lastSchoolPaymentKeyRef.current = null;
      return;
    }
    if (!canPrepareSchoolCardPayment || !stripePublishableKey) {
      setClientSecret(null);
      setPaymentIntentId(null);
      setSchoolPaymentIntentError('');
      lastSchoolPaymentKeyRef.current = null;
      return;
    }

    const paymentItems = [
      ...Object.entries(quantities)
        .filter(([, qty]) => qty > 0)
        .map(([id, qty]) => {
          const p = products.find((x) => String(x.id) === String(id));
          if (!p) return null;
          const variantId = p.shopifyVariantId || undefined;
          const line = items.find((it) => it.productId === String(id) && it.variantId === variantId);
          const unitPrice = line?.unitPrice ?? getProductUnitPriceInHaler(p);
          const variant = line?.variantName?.trim();
          return {
            productId: String(id),
            productName: p.name,
            quantity: qty,
            unitPrice,
            ...(variant ? { variant } : {}),
          };
        })
        .filter((row): row is NonNullable<typeof row> => row != null),
      ...Object.entries(schoolBundleQtyById)
        .filter(([, qty]) => (qty || 0) > 0)
        .map(([bundleId, quantity]) => {
          const b = productBundlesById[bundleId];
          if (!b) return null;
          const unitPrice = Math.max(1, Math.round(b.bundlePriceHaler));
          return {
            productId: `bundle:${bundleId}`,
            productName: b.title,
            quantity,
            unitPrice,
            bundleId: b.id,
            bundleTitle: b.title,
          };
        })
        .filter((row): row is NonNullable<typeof row> => row != null),
    ];

    if (paymentItems.length === 0) {
      setClientSecret(null);
      setPaymentIntentId(null);
      return;
    }

    const schoolInquiry = buildSchoolOrdersPayload('card');

    const payload = {
      items: paymentItems,
      shipping: {
        method: shipping.method,
        price: shipping.price,
        pickupPointId: shipping.pickupPointId,
        pickupPointName: shipping.pickupPointName,
        differentAddress: hasSeparateDeliveryAddress,
        deliveryAddress: hasSeparateDeliveryAddress
          ? {
            recipientName: deliveryAddress.recipientName.trim() || form.name.trim(),
            street: deliveryAddress.deliveryStreet.trim(),
            city: deliveryAddress.deliveryCity.trim(),
            zip: deliveryAddress.deliveryZip.trim(),
          }
          : undefined,
      },
      customer: {
        email: form.email.trim(),
        name: form.name.trim(),
        phone: form.phone.trim(),
        schoolName: form.schoolName.trim() || undefined,
        ico: form.ico.trim() || undefined,
        street: form.street.trim(),
        city: form.city.trim(),
        zip: form.zip.trim(),
      },
      schoolInquiry,
    };

    const paymentKey = JSON.stringify(payload);
    if (lastSchoolPaymentKeyRef.current === paymentKey && clientSecret) return;

    lastSchoolPaymentKeyRef.current = paymentKey;
    setSchoolPaymentIntentLoading(true);
    setSchoolPaymentIntentError('');

    fetch(CREATE_PAYMENT_INTENT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${publicAnonKey}`,
      },
      body: JSON.stringify(payload),
    })
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(data.error || 'Nepodařilo se připravit platbu.');
        }
        setClientSecret(data.clientSecret ?? null);
        setPaymentIntentId(data.paymentIntentId ?? null);
      })
      .catch((error: unknown) => {
        setClientSecret(null);
        setPaymentIntentId(null);
        setSchoolPaymentIntentError(error instanceof Error ? error.message : 'Nepodařilo se připravit platbu.');
      })
      .finally(() => setSchoolPaymentIntentLoading(false));
  }, [
    step,
    paymentMethod,
    canPrepareSchoolCardPayment,
    quantities,
    products,
    items,
    shipping.method,
    shipping.price,
    shipping.pickupPointId,
    shipping.pickupPointName,
    hasSeparateDeliveryAddress,
    deliveryAddress.recipientName,
    deliveryAddress.deliveryStreet,
    deliveryAddress.deliveryCity,
    deliveryAddress.deliveryZip,
    form.email,
    form.name,
    form.phone,
    form.schoolName,
    form.ico,
    form.street,
    form.city,
    form.zip,
    clientSecret,
    buildSchoolOrdersPayload,
    schoolBundleQtyById,
    productBundlesById,
  ]);

  const maxOrderStep = isDigitalServicesOnly ? 3 : 6;
  const canGoBack = step > 1;
  const canGoForward = step < maxOrderStep;

  const goBack = () => {
    if (!canGoBack) return;
    setStep((Math.max(1, step - 1)) as 1 | 2 | 3 | 4 | 5 | 6);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const goForward = () => {
    if (!canGoForward) return;
    if (step === 1 && !tryAdvanceFromStep1()) return;
    if (step === 2 && !validateStep2Fields()) return;
    if (step === 3 && !validateContactStep()) return;
    if (step === 4) {
      if (shipping.method === 'zasilkovna' && !shipping.pickupPointId) {
        setSchoolShippingError('Vyberte výdejní místo Zásilkovny.');
        setTimeout(() => flashInvalidField(document.getElementById('school-order-packeta')), 0);
        return;
      }
      setSchoolShippingError('');
    }
    if (
      step === 5
      && paymentMethod === 'card'
      && !isDigitalServicesOnly
      && hasSchoolWorkbookSelection
    ) {
      if (!stripePublishableKey) {
        setFormError('Online platba kartou není k dispozici. Zvolte prosím jinou metodu nebo kontaktujte podporu.');
        return;
      }
      setFormError(
        'U platby kartou nejdřív vyplňte údaje v platebním formuláři níže a klikněte na „Zaplatit“. Po úspěchu vás přesměrujeme na poděkování (stejně jako v pokladně).',
      );
      return;
    }
    setStep((Math.min(maxOrderStep, step + 1)) as 1 | 2 | 3 | 4 | 5 | 6);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  /* ── submit ── */
  const doSubmit = async () => {
    if (!validateStep2Fields()) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    if (!validateContactStep()) return;

    setSubmitting(true); setFormError('');
    try {
      const payload = buildSchoolOrdersPayload(paymentMethod);
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-93a20b6f/orders`,
        { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${publicAnonKey}` }, body: JSON.stringify(payload) }
      );
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || 'Chyba'); }
      setSubmitted(true);
      clearSchoolOrderDraft();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err: any) {
      console.error('Order submit error:', err);
      setFormError(err.message || 'Nastala chyba p\u0159i odes\u00edl\u00e1n\u00ed. Zkuste to znovu.');
    } finally { setSubmitting(false); }
  };

  const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); doSubmit(); };

  useEffect(() => {
    registerStep1Guard(() => {
      setFlowError('');
      if (selTypes.length === 0) {
        setFlowError('Vyberte alespo\u0148 jednu formu (digit\u00e1ln\u00ed u\u010debnice, tiskoviny nebo Vividboard).');
        setTimeout(() => flashInvalidField(document.getElementById('order-field-step1-forms')), 0);
        return false;
      }
      if (selSubjects.length === 0) {
        setFlowError('Vyberte alespo\u0148 jeden p\u0159edm\u011bt.');
        setTimeout(() => flashInvalidField(document.getElementById('order-field-step1-subjects')), 0);
        return false;
      }
      return true;
    });
    return () => registerStep1Guard(null);
  }, [selTypes, selSubjects, registerStep1Guard]);

  /* ── toggle subject ── */
  const toggleSubject = useCallback((key: string) => {
    setSelSubjects(prev =>
      prev.includes(key) ? (prev.length > 1 ? prev.filter(k => k !== key) : prev) : [...prev, key]
    );
  }, []);

  const keysStupeň2 = useMemo(() => SUBJECTS_2.map((s) => s.key), []);
  const keysStupeň1 = useMemo(() => SUBJECTS_1.map((s) => s.key), []);

  /** Označí všechny předměty stupně / odznačí skupinu (musí zůstat ≥1 předmět celkově) */
  const toggleSubjectGroup = useCallback((grade: '1' | '2') => {
    const groupKeys = grade === '2' ? keysStupeň2 : keysStupeň1;
    const otherFirst = grade === '2' ? keysStupeň1[0] : keysStupeň2[0];
    setSelSubjects((prev) => {
      const allInGroup = groupKeys.every((k) => prev.includes(k));
      if (allInGroup) {
        let next = prev.filter((k) => !groupKeys.includes(k));
        if (next.length === 0) next = [otherFirst];
        return next;
      }
      return Array.from(new Set([...prev, ...groupKeys]));
    });
  }, [keysStupeň1, keysStupeň2]);

  const toggleType = useCallback((key: FormTypeKey) => {
    setSelTypes(prev =>
      prev.includes(key) ? (prev.length > 1 ? prev.filter(k => k !== key) : prev) : [...prev, key]
    );
  }, []);

  const toggleDigitalSubject = useCallback((key: string) => {
    setDigitalSubjects(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  }, []);

  const handleSchoolShippingMethodChange = useCallback((method: SchoolShippingMethod) => {
    const option = SHIPPING_OPTIONS.find((item) => item.id === method) ?? SHIPPING_OPTIONS[0];
    setShipping((prev) => ({
      ...prev,
      method,
      price: option.price,
      ...(method === 'zasilkovna'
        ? {}
        : {
            pickupPointId: undefined,
            pickupPointName: undefined,
            pickupPointStreet: undefined,
            pickupPointCity: undefined,
            pickupPointZip: undefined,
          }),
    }));
    setSchoolShippingError('');
    setPacketaError('');
  }, []);

  const handleSchoolPacketaPick = useCallback(() => {
    setPacketaError('');
    if (!PACKETA_API_KEY) {
      setPacketaError('Chybí VITE_PACKETA_API_KEY pro widget Zásilkovny.');
      return;
    }
    setPacketaLoading(true);
    if (typeof window === 'undefined' || !window.Packeta?.Widget) {
      setPacketaLoading(false);
      setPacketaError('Widget Zásilkovny se zatím nenačetl. Zkuste to prosím znovu.');
      return;
    }
    window.Packeta.Widget.pick(
      PACKETA_API_KEY,
      (point) => {
        setPacketaLoading(false);
        if (!point) return;
        setShipping((prev) => ({
          ...prev,
          pickupPointId: String(point.id),
          pickupPointName: point.name,
          pickupPointStreet: point.street,
          pickupPointCity: point.city,
          pickupPointZip: point.zip,
        }));
        setSchoolShippingError('');
      },
      { country: 'cz' },
    );
  }, []);

  useEffect(() => {
    if (shipping.method !== 'zasilkovna') return;
    if (typeof window === 'undefined' || window.Packeta) return;
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${PACKETA_WIDGET_URL}"]`);
    if (existing) return;
    const script = document.createElement('script');
    script.src = PACKETA_WIDGET_URL;
    script.async = true;
    document.body.appendChild(script);
  }, [shipping.method]);

  const sidebarSlot = typeof document !== 'undefined' ? document.getElementById('order-sidebar-slot') : null;
  const orderSummaryMobileSlot =
    typeof document !== 'undefined' ? document.getElementById('order-summary-slot-mobile') : null;
  const sidebarContent = useMemo(
    () => (
    <div className="space-y-5">
      <div className="px-1">
        <p className="font-['Cooper_Light',serif] text-[#001161] text-[21px] leading-tight">
          {'Co objednáváte'}
        </p>
        <p style={FF} className="mt-1.5 text-[11px] text-[#001161]/50 leading-relaxed">
          {'Při zadávání počtů můžete výběr rovnou upravovat i vlevo.'}
        </p>
      </div>

      <div className="space-y-3">
        <div className="rounded-[14px] border border-[#001161]/[0.08] bg-white/70 p-3 shadow-[0_1px_0_rgba(0,17,97,0.04)]">
          <OrderSidebarGradeHeader
            title="2. stupeň"
            groupKeys={keysStupeň2}
            selectedKeys={selSubjects}
            onToggleGroup={() => toggleSubjectGroup('2')}
          />
          <div className="mt-2.5 ml-0.5 space-y-0.5 border-l-2 border-[#001161]/10 pl-3">
            {SUBJECTS_2.map((s) => (
              <OrderSidebarCheckboxRow
                key={`sidebar-${s.key}`}
                active={selSubjects.includes(s.key)}
                label={s.label}
                nested
                onClick={() => toggleSubject(s.key)}
              />
            ))}
          </div>
        </div>

        <div className="rounded-[14px] border border-[#001161]/[0.08] bg-white/70 p-3 shadow-[0_1px_0_rgba(0,17,97,0.04)]">
          <OrderSidebarGradeHeader
            title="1. stupeň"
            groupKeys={keysStupeň1}
            selectedKeys={selSubjects}
            onToggleGroup={() => toggleSubjectGroup('1')}
          />
          <div className="mt-2.5 ml-0.5 space-y-0.5 border-l-2 border-[#001161]/10 pl-3">
            {SUBJECTS_1.map((s) => (
              <OrderSidebarCheckboxRow
                key={`sidebar-${s.key}`}
                active={selSubjects.includes(s.key)}
                label={s.label}
                nested
                onClick={() => toggleSubject(s.key)}
              />
            ))}
          </div>
        </div>

        <div className="rounded-[14px] border border-[#001161]/[0.08] bg-white/70 p-3 pt-3.5 shadow-[0_1px_0_rgba(0,17,97,0.04)]">
          <OrderSidebarSectionTitle>{'Forma'}</OrderSidebarSectionTitle>
          <div className="mt-1 ml-0.5 space-y-0.5 border-l-2 border-[#001161]/10 pl-3">
            {FORM_TYPES.map((ft) => (
              <OrderSidebarCheckboxRow
                key={`sidebar-${ft.key}`}
                active={selTypes.includes(ft.key)}
                label={ft.label}
                nested
                onClick={() => toggleType(ft.key)}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
    ),
    [selSubjects, selTypes, toggleSubject, toggleType, keysStupeň1, keysStupeň2, toggleSubjectGroup],
  );

  /* ── success screen ── */
  if (submitted) {
    return (
      <div className="min-h-screen bg-[#f8f9fc] flex items-center justify-center px-6">
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
          className="max-w-[480px] w-full bg-[#F0F2F8] rounded-[28px] px-8 py-12 flex flex-col items-center text-center gap-5">
          <CheckCircle className="w-16 h-16 text-green-500" />
          <h2 className="font-['Cooper_Light',serif] text-[#001161] text-[30px]">{'D\u011bkujeme!'}</h2>
          <p style={FF} className="text-[#001161]/70 text-[15px] leading-relaxed">
            {isDigitalServicesOnly
              ? 'Va\u0161e popt\u00e1vka na digit\u00e1ln\u00ed licence \u010di slu\u017eby byla odesl\u00e1na. N\u00e1\u0161 obchodn\u00edk se v\u00e1m brzy ozve s nab\u00eddkou na m\u00edru.'
              : 'Va\u0161e nez\u00e1vazn\u00e1 popt\u00e1vka byla \u00fasp\u011b\u0161n\u011b odesl\u00e1na. Brzy se v\u00e1m ozveme s cenovou nab\u00eddkou na m\u00edru.'}
          </p>
          <button onClick={() => navigate('/')}
            className="bg-[#001161] hover:bg-[#001161]/85 text-white font-['Fenomen_Sans',sans-serif] font-bold text-[15px] px-8 py-3 rounded-xl cursor-pointer transition-all hover:scale-105">
            {'Zp\u011bt do katalogu'}
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8f9fc]">
      <SEOHead
        title="Objednávka pro školu"
        path="/objednat"
        description="Objednejte pracovní sešity a digitální učebnice Vividbooks pro vaši školu."
      />
      {sidebarSlot && step === 2 && createPortal(sidebarContent, sidebarSlot)}
      {sidebarSlot && step >= 3 &&
        createPortal(
          <CheckoutSummaryCard
            itemCount={workbookItems}
            subtotal={orderSummaryWorkbookSubtotalHalers}
            shippingTotal={orderSummaryShippingHalers}
            total={orderSummaryGrandHalers}
            showShipping={showShippingInOrderSummary}
          />,
          sidebarSlot,
        )}
      {orderSummaryMobileSlot && step >= 3 &&
        createPortal(
          <CheckoutSummaryCard
            itemCount={workbookItems}
            subtotal={orderSummaryWorkbookSubtotalHalers}
            shippingTotal={orderSummaryShippingHalers}
            total={orderSummaryGrandHalers}
            showShipping={showShippingInOrderSummary}
          />,
          orderSummaryMobileSlot,
        )}

      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-8 md:py-12">
        <div className="mb-8 md:mb-10 pt-2 flex flex-col gap-3 md:flex-row md:items-start md:justify-between md:gap-6">
          <h1 className="font-['Cooper_Light',serif] text-[#001161] text-[40px] md:text-[56px] leading-none shrink-0">
            Objednávka pro školu
          </h1>
          <div className="shrink-0 md:max-w-[min(100%,18rem)] md:pt-1 md:text-right flex flex-col gap-1 items-start md:items-end">
            <p style={FF} className="text-[12px] font-semibold text-[#001161]/75 leading-snug">
              {'Pot\u0159ebujete poradit?'}
            </p>
            <Link
              to="/kontakt"
              className="inline-flex items-center gap-2 font-['Fenomen_Sans',sans-serif] text-[13px] font-bold text-[#001161] hover:text-[#ff6a35] transition-colors no-underline"
            >
              <Phone className="w-4 h-4 shrink-0 opacity-85" aria-hidden />
              <span>{'Zavolejte: +420\u00a0602\u00a0227\u00a0674'}</span>
            </Link>
          </div>
        </div>

        <div
          className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-8 ${
            visibleOrderSteps.length > 3 ? 'xl:grid-cols-6' : 'xl:grid-cols-3'
          }`}
        >
          {visibleOrderSteps.map((s) => {
            const isActive = s.id === step;
            const isCompleted = s.id < step;
            const isDisabled = s.id > step;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => {
                  if (!isDisabled) setStep(s.id);
                }}
                disabled={isDisabled}
                className={`rounded-[18px] border px-3 py-3 md:px-4 md:py-3.5 text-left transition-all flex items-center gap-3 ${
                  isActive
                    ? 'border-[#001161] bg-[#001161] text-white'
                    : isCompleted
                      ? 'border-[#16a34a]/20 bg-[#f0fdf4] text-[#166534]'
                      : 'border-[#001161]/10 bg-white text-[#001161]'
                } ${isDisabled ? 'opacity-70 cursor-not-allowed' : 'cursor-pointer'}`}
              >
                <span
                  className={`inline-flex shrink-0 items-center justify-center w-7 h-7 rounded-full text-[12px] font-bold ${
                    isActive
                      ? 'bg-white text-[#001161]'
                      : isCompleted
                        ? 'bg-[#16a34a] text-white'
                        : 'bg-[#f1f3f8] text-[#001161]'
                  }`}
                >
                  {isCompleted ? <Check className="w-4 h-4" /> : s.id}
                </span>
                <span
                  className={`font-['Fenomen_Sans',sans-serif] text-[13px] md:text-[14px] font-bold leading-tight min-w-0 ${
                    isActive ? 'text-white' : isCompleted ? 'text-[#166534]' : 'text-[#001161]'
                  }`}
                >
                  {s.label}
                </span>
              </button>
            );
          })}
        </div>

        <div className="max-w-3xl space-y-6">
          {step === 1 && (
            <div className="rounded-[24px] border border-[#001161]/10 bg-white overflow-hidden">
              <div className="px-6 md:px-8 pt-5 pb-6 md:pt-6 md:pb-8">
                <h2 className="font-['Cooper_Light',serif] text-[#001161] text-[30px] leading-tight mb-1.5">
                  {'Co objedn\u00e1v\u00e1te'}
                </h2>
                <p className="font-['Fenomen_Sans',sans-serif] text-[14px] text-[#001161]/60 leading-relaxed mb-6">
                  {'Vyberte p\u0159edm\u011bty a formu. V dal\u0161\u00edm kroku zad\u00e1te po\u010dty podobn\u011b jako v ko\u0161\u00edku e-shopu.'}
                </p>
                {flowError && (
                  <div className="mb-6 flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-[16px] px-4 py-3">
                    <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                    <p style={FF} className="text-[#92400e] text-[14px] leading-snug">{flowError}</p>
                  </div>
                )}
                <div className="space-y-6">
                  <div id="order-field-step1-subjects" className="rounded-[18px] bg-[#f8f9fc] p-5 md:p-6">
                    <p style={FF} className="text-[#001161]/50 text-[13px] font-bold uppercase tracking-widest mb-4">
                      {'Jak\u00fd p\u0159edm\u011bt?'}
                    </p>
                    <div className="space-y-5">
                      <div>
                        <p style={FF} className="text-[#001161]/40 text-[12px] font-bold uppercase tracking-widest mb-2 px-1">
                          {'2. stupe\u0148'}
                        </p>
                        <div className="grid grid-cols-2 gap-2">
                          {SUBJECTS_2.map((s) => (
                            <OrderCheckboxRow
                              key={s.key}
                              active={selSubjects.includes(s.key)}
                              label={s.label}
                              onClick={() => toggleSubject(s.key)}
                            />
                          ))}
                        </div>
                      </div>
                      <div>
                        <p style={FF} className="text-[#001161]/40 text-[12px] font-bold uppercase tracking-widest mb-2 px-1">
                          {'1. stupe\u0148'}
                        </p>
                        <div className="grid grid-cols-2 gap-2">
                          {SUBJECTS_1.map((s) => (
                            <OrderCheckboxRow
                              key={s.key}
                              active={selSubjects.includes(s.key)}
                              label={s.label}
                              onClick={() => toggleSubject(s.key)}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div id="order-field-step1-forms" className="rounded-[18px] bg-[#f8f9fc] p-5 md:p-6">
                    <p style={FF} className="text-[#001161]/50 text-[13px] font-bold uppercase tracking-widest mb-4">
                      {'V jak\u00e9 form\u011b?'}
                    </p>
                    <div className="flex flex-col gap-2">
                      {FORM_TYPES.map((ft) => (
                        <OrderCheckboxRow
                          key={ft.key}
                          active={selTypes.includes(ft.key)}
                          label={ft.label}
                          onClick={() => toggleType(ft.key)}
                        />
                      ))}
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-3 mt-8 pt-6 border-t border-[#001161]/10">
                  <button
                    type="button"
                    onClick={() => navigate(-1)}
                    className="inline-flex items-center gap-2 px-4 py-3 rounded-[14px] border border-[#001161]/10 bg-white text-[#001161] font-['Fenomen_Sans',sans-serif] text-[14px] font-bold cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    {'Zp\u011bt'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (!tryAdvanceFromStep1()) return;
                      setStep(2);
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className="inline-flex items-center gap-2 px-5 py-3 rounded-[14px] bg-[#001161] text-white font-['Fenomen_Sans',sans-serif] text-[14px] font-bold cursor-pointer"
                  >
                    {'Po\u010dty'}
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <motion.div
              key="step-pocty"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className="space-y-6"
            >
              <div className="rounded-[24px] border border-[#001161]/10 bg-white overflow-hidden">
                <div className="px-6 md:px-8 pt-5 pb-6 md:pt-6 md:pb-8">
                  <h2 className="font-['Cooper_Light',serif] text-[#001161] text-[30px] leading-tight mb-1.5">
                    {'Počty'}
                  </h2>
                  <p className="font-['Fenomen_Sans',sans-serif] text-[14px] text-[#001161]/60 leading-relaxed mb-4">
                    {'Druhý krok už funguje jako školní varianta košíku. Zadejte počty a pak pokračujte do dalších checkout kroků.'}
                  </p>

                  {flowError && (
                    <div className="mb-5 flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-[16px] px-4 py-3">
                      <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                      <p style={FF} className="text-[#92400e] text-[14px] leading-snug">{flowError}</p>
                    </div>
                  )}

                  <div className="flex flex-col gap-5">
                    <AnimatePresence initial={false}>
                      {selTypes.includes('digital') && (
                        <motion.div key="digital" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.22 }} className="overflow-hidden">
                          <div className="bg-[#FEF9C3] rounded-[20px] p-6">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-[#001161] text-[20px]">ℹ️</span>
                              <h2 className="font-['Fenomen_Sans',sans-serif] font-black text-[#001161] text-[22px]">{'Digitální učebnice'}</h2>
                            </div>
                            <p style={FF} className="text-[#001161]/60 text-[13px] mb-4">
                              {'Vyberte předměty licence, orientační počet žáků na 2. stupni a délku licence.'}
                            </p>
                            <div className="mb-4">
                              <p style={FF} className="text-[#001161]/45 text-[11px] font-bold uppercase tracking-widest mb-2">
                                {'Předměty pro licenci'}
                              </p>
                              <div className="flex flex-wrap gap-2">
                                {[...SUBJECTS_2, ...SUBJECTS_1].map((subject) => (
                                  <OrderInlineCheckboxPill
                                    key={`digital-${subject.key}`}
                                    active={digitalSubjects.includes(subject.key)}
                                    label={subject.label}
                                    onClick={() => toggleDigitalSubject(subject.key)}
                                  />
                                ))}
                              </div>
                            </div>
                            <div className="flex flex-col gap-3">
                              <div className="flex items-center justify-between bg-white/70 rounded-[12px] px-5 py-3">
                                <span style={FF} className="text-[#001161] text-[14px] font-semibold">{'Počet žáků na 2. stupni'}</span>
                                <OrderStepper value={students2} onChange={setStudents2} step={10} />
                              </div>
                              <div className="flex items-center justify-between bg-white/70 rounded-[12px] px-5 py-3">
                                <span style={FF} className="text-[#001161] text-[14px] font-semibold">{'Preferovaná délka licence'}</span>
                                <OrderStepper value={licYears} onChange={setLicYears} min={1} max={3} unit={licYears === 1 ? 'rok' : licYears < 5 ? 'roky' : 'let'} />
                              </div>
                            </div>
                            <p style={FF} className="text-[#001161]/65 text-[13px] leading-snug mt-4 pt-1 border-t border-[#001161]/10">
                              {
                                'Podle vyplněných informací se vám ozve obchodní zástupce, který vám zašle nabídku na míru a domluví další kroky.'
                              }
                            </p>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <AnimatePresence initial={false}>
                      {selTypes.includes('workbook') && (
                        <motion.div key="workbook" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.22 }} className="overflow-hidden">
                          <div id="order-field-step2-workbooks" className="bg-[#F0F2F8] rounded-[20px] p-6">
                            <h2 className="font-['Fenomen_Sans',sans-serif] font-black text-[#001161] text-[22px] mb-4">{'Pracovní sešity'}</h2>

                            {isLoading && products.length === 0 ? (
                              <div className="flex justify-center py-8">
                                <Loader2 className="w-8 h-8 text-[#001161]/40 animate-spin" />
                              </div>
                            ) : sortedCats.length === 0 && activeSchoolBundleLines.length === 0 ? (
                              <p style={FF} className="text-[#001161]/50 text-[14px] text-center py-6">{'Vyberte předměty v prvním kroku (Co objednáváte).'}</p>
                            ) : (
                              <TooltipProvider>
                                {activeSchoolBundleLines.length > 0 && (
                                  <div className="mb-6">
                                    <p style={FF} className="text-[#001161]/45 text-[11px] font-bold uppercase tracking-widest mb-3">
                                      {'Zvýhodněné balíčky'}
                                    </p>
                                    <div className="flex flex-col gap-1.5">
                                      {activeSchoolBundleLines.map(({ bundleId, qty, bundle }) => {
                                        const active = qty > 0;
                                        const unitKc = bundle ? Math.max(0, Math.round(bundle.bundlePriceHaler / 100)) : 0;
                                        const breakdown = bundle
                                          ? (bundle.productIds || [])
                                            .map((pid) => products.find((x) => String(x.id) === String(pid)))
                                            .filter((p): p is Product => Boolean(p && p.type === 'workbook'))
                                          : [];
                                        const title = bundle?.title || `Balíček (${bundleId})`;
                                        const nInBundle = breakdown.length > 0
                                          ? breakdown.length
                                          : bundle
                                            ? Math.max(
                                              1,
                                              (bundle.productIds || []).filter((pid) => workbookProductIds.has(String(pid))).length
                                                || (bundle.productIds || []).length,
                                            )
                                            : 1;
                                        const lineTotalKc = unitKc * qty;
                                        const lineKs = qty * nInBundle;
                                        const lineTotalFmt = String(lineTotalKc).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
                                        return (
                                          <div key={bundleId} className="flex flex-col">
                                            <div className="flex gap-2 items-stretch">
                                              <div className={`flex-1 rounded-[8px] px-3 py-3 transition-colors ${active ? 'bg-[#c8d7f7]' : 'bg-white/80'}`}>
                                                <p style={FF} className="text-[#001161] text-[15.5px] font-bold leading-snug">{title}</p>
                                                <p style={FF} className="text-[#001161]/45 text-[11px] font-bold uppercase tracking-widest mt-2 mb-1">
                                                  {'Obsah balíčku'}
                                                </p>
                                                {breakdown.length > 0 ? (
                                                  <ul style={FF} className="text-[#001161]/75 text-[13px] leading-snug list-disc pl-4 space-y-0.5">
                                                    {breakdown.map((p) => (
                                                      <li key={p.id}>{p.name}</li>
                                                    ))}
                                                  </ul>
                                                ) : (
                                                  <p style={FF} className="text-[#001161]/50 text-[12px] leading-snug">
                                                    {bundle ? 'Načítám názvy tiskovin…' : 'Balíček se načítá z katalogu…'}
                                                  </p>
                                                )}
                                              </div>
                                              <div className={`w-[80px] rounded-[8px] px-2 py-3 flex flex-col items-center justify-center shrink-0 ${active ? 'bg-[#c8d7f7]' : 'bg-white/80'}`}>
                                                <p style={FF} className="text-[#001161] text-[15.5px] font-semibold leading-none whitespace-nowrap">
                                                  {unitKc > 0 ? `${String(unitKc).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')},−` : '—'}
                                                </p>
                                                <span style={FF} className="text-[8px] text-[#001161]/45 font-bold uppercase tracking-tighter mt-1 text-center leading-tight">
                                                  {'za bal.'}
                                                </span>
                                              </div>
                                              <div className={`w-[164px] rounded-[10px] px-1.5 py-2 flex items-center justify-between gap-1.5 shrink-0 ${active ? 'bg-[#c8d7f7]' : 'bg-white/80'}`}>
                                                <button type="button" onClick={() => updateSchoolBundleQty(bundleId, -1)} className="w-8 h-9 bg-[#26356B] rounded-[6px] flex items-center justify-center text-white cursor-pointer shrink-0 hover:bg-[#001161] transition-colors text-[16px]">{'−'}</button>
                                                <div className={`flex-1 rounded-[6px] border-2 ${active ? 'border-[#001161]/30 bg-white/60' : 'border-[#001161]/15 bg-white/40'} flex items-center justify-center h-9`}>
                                                  <input
                                                    type="text"
                                                    inputMode="numeric"
                                                    placeholder="0"
                                                    value={qty || ''}
                                                    onChange={(e) => setSchoolBundleQtyInput(bundleId, e.target.value)}
                                                    className="w-full bg-transparent text-center text-[#001161] text-[15px] font-['Fenomen_Sans',sans-serif] font-bold focus:outline-none border-none p-0 placeholder:text-[#001161]/25"
                                                  />
                                                </div>
                                                <button type="button" onClick={() => updateSchoolBundleQty(bundleId, 1)} className="w-8 h-9 bg-[#26356B] rounded-[6px] flex items-center justify-center text-white cursor-pointer shrink-0 hover:bg-[#001161] transition-colors text-[16px]">+</button>
                                              </div>
                                            </div>
                                            {qty > 0 && (
                                              <div className="flex justify-between items-center bg-[#c8d7f7]/40 rounded-[8px] px-4 py-2 mt-2">
                                                <div className="flex items-center gap-3 min-w-0">
                                                  <p style={FF} className="text-[#001161] text-[13px] font-semibold truncate">
                                                    {'Celkem '}{title}{':'}
                                                  </p>
                                                  <button
                                                    type="button"
                                                    onClick={() => {
                                                      setSchoolBundleQtyById((prev) => {
                                                        const n = { ...prev };
                                                        delete n[bundleId];
                                                        return n;
                                                      });
                                                    }}
                                                    className="text-[#001161]/50 text-[11px] underline font-['Fenomen_Sans',sans-serif] cursor-pointer shrink-0"
                                                  >
                                                    {'Smazat'}
                                                  </button>
                                                </div>
                                                <div className="flex gap-4 shrink-0">
                                                  <p style={FF} className="text-[#001161] text-[13px] font-bold">{lineTotalFmt}{',−'}</p>
                                                  <p style={FF} className="text-[#001161] text-[13px]">{lineKs}{' ks'}</p>
                                                </div>
                                              </div>
                                            )}
                                          </div>
                                        );
                                      })}
                                    </div>
                                    <div className="h-px bg-[#001161]/8 mt-5 mb-1" />
                                  </div>
                                )}
                                {sortedCats.map(cat => {
                                  const catProds = sortProducts(productsByCategory[cat] || []);
                                  const catItems = catProds.reduce((s, p) => s + (quantities[p.id] || 0), 0);
                                  const catTotal = catProds.reduce((s, p) => {
                                    const qty = quantities[p.id] || 0;
                                    return qty > 0 ? s + parseInt(p.price.replace(/\D/g, ''), 10) * qty : s;
                                  }, 0);
                                  return (
                                    <div key={cat} className="mb-5">
                                      <p style={FF} className="text-[#001161] text-[15px] font-bold text-center mb-3">{cat}</p>
                                      <div className="flex flex-col gap-1.5">
                                        {catProds.flatMap((p, i) => {
                                          const getSeriesLabel = (n: string) =>
                                            /krok za krokem/i.test(n) ? 'Krok za krokem' :
                                            /pro v[\u0161s]echny/i.test(n) ? 'Pro všechny' : null;
                                          const series = getSeriesLabel(p.name);
                                          const prevSeries = i > 0 ? getSeriesLabel(catProds[i - 1].name) : undefined;
                                          const showHeader = series !== null && series !== prevSeries;
                                          const qty = quantities[p.id] || 0;
                                          const active = qty > 0;
                                          const rowItems: React.ReactNode[] = [];
                                          if (showHeader) rowItems.push(
                                            <div key={`hdr-${p.id}`} className="flex items-center gap-2 mt-2 mb-0.5 px-1">
                                              <span style={FF} className="text-[10px] font-bold text-[#001161]/35 uppercase tracking-widest whitespace-nowrap">{series}</span>
                                              <div className="flex-1 h-px bg-[#001161]/10" />
                                            </div>
                                          );
                                          rowItems.push(
                                            <div key={p.id} className="flex gap-2 items-stretch">
                                              <Tooltip>
                                                <TooltipTrigger asChild>
                                                  <div className={`flex-1 rounded-[8px] px-3 py-3 cursor-default transition-colors ${active ? 'bg-[#c8d7f7]' : 'bg-white/80'}`}>
                                                    <p style={FF} className="text-[#001161] text-[15.5px] leading-snug">{p.name}</p>
                                                  </div>
                                                </TooltipTrigger>
                                                <TooltipContent side="right" className="p-4 bg-white border border-gray-100 rounded-[12px] shadow-2xl hidden md:block">
                                                  {p.image && <ImageWithFallback src={p.image} alt={p.name} className="w-[100px] h-auto object-contain drop-shadow-xl" />}
                                                </TooltipContent>
                                              </Tooltip>
                                              <div
                                                className={`min-w-[104px] max-w-[148px] rounded-[8px] px-2.5 py-2.5 flex flex-col items-center justify-center gap-1.5 shrink-0 self-stretch ${active ? 'bg-[#c8d7f7]' : 'bg-white/80'}`}
                                              >
                                                <p style={FF} className="text-[#001161] text-[15.5px] font-semibold leading-none text-center whitespace-nowrap">
                                                  {p.price.replace(',-', '')}
                                                  {',−'}
                                                </p>
                                                {p.note && (
                                                  <span
                                                    style={FF}
                                                    className="w-full text-center text-[9px] sm:text-[10px] leading-snug bg-[#FF9900] text-white px-2 py-1.5 rounded-lg font-bold shadow-sm"
                                                  >
                                                    {p.note}
                                                  </span>
                                                )}
                                              </div>
                                              <div className={`w-[164px] rounded-[10px] px-1.5 py-2 flex items-center justify-between gap-1.5 shrink-0 ${active ? 'bg-[#c8d7f7]' : 'bg-white/80'}`}>
                                                <button onClick={() => updateQty(p.id, -1)} className="w-8 h-9 bg-[#26356B] rounded-[6px] flex items-center justify-center text-white cursor-pointer shrink-0 hover:bg-[#001161] transition-colors text-[16px]">{'−'}</button>
                                                <div className={`flex-1 rounded-[6px] border-2 ${active ? 'border-[#001161]/30 bg-white/60' : 'border-[#001161]/15 bg-white/40'} flex items-center justify-center h-9`}>
                                                  <input type="text" inputMode="numeric" placeholder="0"
                                                    value={quantities[p.id] || ''}
                                                    onChange={e => setQtyInput(p.id, e.target.value)}
                                                    className="w-full bg-transparent text-center text-[#001161] text-[15px] font-['Fenomen_Sans',sans-serif] font-bold focus:outline-none border-none p-0 placeholder:text-[#001161]/25" />
                                                </div>
                                                <button onClick={() => updateQty(p.id, 1)} className="w-8 h-9 bg-[#26356B] rounded-[6px] flex items-center justify-center text-white cursor-pointer shrink-0 hover:bg-[#001161] transition-colors text-[16px]">+</button>
                                              </div>
                                            </div>
                                          );
                                          return rowItems;
                                        })}
                                      </div>
                                      {catItems > 0 && (
                                        <div className="flex justify-between items-center bg-[#c8d7f7]/40 rounded-[8px] px-4 py-2 mt-2">
                                          <div className="flex items-center gap-3">
                                            <p style={FF} className="text-[#001161] text-[13px] font-semibold">{'Celkem ' + cat.split(' ')[0] + ':'}</p>
                                            <button
                                              type="button"
                                              onClick={() => {
                                                const ids = (productsByCategory[cat] || []).map((p) => p.id);
                                                setQuantities((prev) => {
                                                  const n = { ...prev };
                                                  ids.forEach((id) => {
                                                    n[id] = 0;
                                                  });
                                                  return n;
                                                });
                                              }}
                                              className="text-[#001161]/50 text-[11px] underline font-['Fenomen_Sans',sans-serif] cursor-pointer"
                                            >
                                              {'Smazat'}
                                            </button>
                                          </div>
                                          <div className="flex gap-4">
                                            <p style={FF} className="text-[#001161] text-[13px] font-bold">{catTotal}{',−'}</p>
                                            <p style={FF} className="text-[#001161] text-[13px]">{catItems} ks</p>
                                          </div>
                                        </div>
                                      )}
                                      <div className="h-px bg-[#001161]/8 mt-4" />
                                    </div>
                                  );
                                })}
                                {workbookItems > 0 && (
                                  <div className="flex justify-between items-center border-t-2 border-[#001161] pt-3">
                                    <p style={FF} className="text-[#001161] text-[15px] font-bold">{'Celkem sešity'}</p>
                                    <p style={FF} className="text-[#001161] text-[15px] font-bold">{workbookTotal}{',− Kč'} ({workbookItems} ks)</p>
                                  </div>
                                )}
                              </TooltipProvider>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <AnimatePresence initial={false}>
                      {selTypes.includes('vividboard') && (
                        <motion.div key="vividboard" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.22 }} className="overflow-hidden">
                          <div id="order-field-step2-vividboard" className="bg-[#FEE2E2] rounded-[20px] p-6">
                            <h2 className="font-['Fenomen_Sans',sans-serif] font-black text-[#991B1B] text-[22px] mb-2">{'Nástroj Vividboard'}</h2>
                            <p style={FF} className="text-[#991B1B]/70 text-[13px] mb-5">{'Interaktivní tabule pro učitele — počet tříd nebo učitelského účtu.'}</p>
                            <div className="flex items-center justify-between bg-white/60 rounded-[12px] px-5 py-3">
                              <span style={FF} className="text-[#991B1B] text-[14px] font-semibold">{'Počet licencí'}</span>
                              <OrderStepper value={vividboardCount} onChange={setVividboardCount} min={1} />
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={goBack}
                  disabled={!canGoBack}
                  className="inline-flex items-center gap-2 px-4 py-3 rounded-[14px] border border-[#001161]/10 bg-white text-[#001161] font-['Fenomen_Sans',sans-serif] text-[14px] font-bold disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                  {'Zpět'}
                </button>
                <button
                  type="button"
                  onClick={goForward}
                  className="inline-flex items-center gap-2 px-5 py-3 rounded-[14px] bg-[#001161] text-white font-['Fenomen_Sans',sans-serif] text-[14px] font-bold cursor-pointer"
                >
                  {'Pokračovat'}
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div key="step-udaje" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }} className="space-y-6">
              <div className="rounded-[24px] border border-[#001161]/10 bg-white p-6 md:p-8">
                <h2 className="font-['Cooper_Light',serif] text-[#001161] text-[30px] leading-tight mb-6">
                  {'Údaje'}
                </h2>

                {isDigitalServicesOnly && (
                  <div className="mb-6 flex items-start gap-3 rounded-[16px] border border-[#001161]/10 bg-[#f0f4ff] px-4 py-3">
                    <span className="text-[18px] shrink-0 leading-none mt-0.5" aria-hidden>ℹ️</span>
                    <p style={FF} className="text-[#001161]/80 text-[13px] leading-snug">
                      {'Po odesl\u00e1n\u00ed se v\u00e1m ozve n\u00e1\u0161 obchodn\u00edk s nab\u00eddkou na m\u00edru (digit\u00e1ln\u00ed licence / Vividboard). Dopravu a platbu v tomto kroku nevyb\u00edr\u00e1te.'}
                    </p>
                  </div>
                )}

                {showDigitalPlusPrintNotice && (
                  <div className="mb-6 flex items-start gap-3 rounded-[16px] border border-amber-200/80 bg-amber-50/90 px-4 py-3">
                    <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <p style={FF} className="text-[#92400e] text-[13px] leading-snug">{DIGITAL_WITH_PRINT_INFO}</p>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
                  <div className="relative rounded-[18px] border px-5 pt-4 pb-0 text-left overflow-hidden min-h-[132px] border-[#001161] bg-[#f8f9fc] shadow-[0_12px_30px_rgba(0,17,97,0.08)]">
                    <div className="min-h-[116px] pr-[140px] pb-4">
                      <p className="font-['Fenomen_Sans',sans-serif] text-[14px] font-bold text-[#001161]">
                        {'Nakupuji jako škola'}
                      </p>
                      <p className="font-['Fenomen_Sans',sans-serif] text-[12px] text-[#001161]/50 mt-1">
                        {'IČO, škola a fakturační údaje organizace'}
                      </p>
                    </div>
                    <div className="absolute right-5 bottom-0 shrink-0 transition-all duration-200 origin-bottom scale-110">
                      <img
                        src="/checkout/customer-school.png"
                        alt="Škola"
                        className="block object-contain object-bottom w-[106px] h-[106px]"
                      />
                    </div>
                  </div>
                </div>

                <div className="rounded-[20px] bg-[#f8f9fc] p-5 mb-6">
                  <p className="font-['Fenomen_Sans',sans-serif] text-[12px] uppercase tracking-[0.15em] text-[#001161]/40 mb-4">
                    {'Informace o škole'}
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <label id="order-field-schoolName" className="block md:col-span-2">
                      <span className="block font-['Fenomen_Sans',sans-serif] text-[13px] font-bold text-[#001161] mb-2">
                        {'Název školy *'}
                      </span>
                      <div ref={schoolRef} className="relative">
                        <input
                          type="text"
                          value={form.schoolName}
                          onChange={(event) => handleSchoolInput(event.target.value)}
                          onFocus={() => { if (schoolResults.length > 0) setSchoolOpen(true); }}
                          placeholder="Začněte psát název školy"
                          className="w-full rounded-[14px] border border-[#001161]/10 bg-white px-4 py-3 pr-11 text-[14px] text-[#001161] outline-none focus:border-[#5b4fd8] focus:ring-2 focus:ring-[#5b4fd8]/15"
                          autoComplete="off"
                        />
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 text-[#001161]/30 pointer-events-none">
                          {schoolBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                        </div>

                        {schoolOpen && schoolResults.length > 0 && (
                          <div className="absolute z-20 mt-2 w-full overflow-hidden rounded-[18px] border border-[#001161]/10 bg-white shadow-xl">
                            <div className="max-h-[260px] overflow-y-auto py-1">
                              {schoolResults.map((school, index) => (
                                <button
                                  key={`${school.ico}-${index}`}
                                  type="button"
                                  onClick={() => selectSchool(school)}
                                  className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-[#f8f9fc]"
                                >
                                  <Building2 className="w-4 h-4 text-[#001161]/30 mt-0.5 shrink-0" />
                                  <div className="min-w-0">
                                    <p className="font-['Fenomen_Sans',sans-serif] text-[14px] font-bold text-[#001161] leading-tight">
                                      {school.name}
                                    </p>
                                    <p className="font-['Fenomen_Sans',sans-serif] text-[12px] text-[#001161]/50 mt-1">
                                      {school.address ? `${school.address} · ` : ''}{`IČO: ${school.ico}`}
                                    </p>
                                  </div>
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </label>

                    <label id="order-field-ico" className="block">
                      <span className="block font-['Fenomen_Sans',sans-serif] text-[13px] font-bold text-[#001161] mb-2">
                        {'IČO školy *'}
                      </span>
                      <input
                        type="text"
                        inputMode="numeric"
                        maxLength={10}
                        value={form.ico}
                        onChange={(event) => setForm((prev) => ({ ...prev, ico: event.target.value.replace(/\D/g, '').slice(0, 10) }))}
                        className="w-full rounded-[14px] border border-[#001161]/10 bg-white px-4 py-3 text-[14px] text-[#001161] outline-none focus:border-[#5b4fd8] focus:ring-2 focus:ring-[#5b4fd8]/15"
                      />
                    </label>

                    <div className="rounded-[14px] border border-[#001161]/10 bg-white px-4 py-3 flex items-center">
                      <p className="font-['Fenomen_Sans',sans-serif] text-[13px] text-[#001161]/55">
                        {'Po výběru školy se zkusí předvyplnit adresa. Údaje pak můžete ručně upravit.'}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[
                    { key: 'name', label: 'Jméno *' },
                    { key: 'email', label: 'E-mail *', type: 'email' },
                    { key: 'phone', label: 'Telefon *' },
                    { key: 'street', label: 'Ulice a číslo *' },
                    { key: 'city', label: 'Město *' },
                    { key: 'zip', label: 'PSČ *' },
                  ].map((field) => (
                    <label key={field.key} id={`order-field-${field.key}`} className="block">
                      <span className="block font-['Fenomen_Sans',sans-serif] text-[13px] font-bold text-[#001161] mb-2">
                        {field.label}
                      </span>
                      <input
                        type={field.type ?? 'text'}
                        value={form[field.key as keyof typeof form] as string}
                        onChange={(event) => {
                          setForm((prev) => ({ ...prev, [field.key]: event.target.value }));
                          setFormError('');
                        }}
                        className="w-full rounded-[14px] border border-[#001161]/10 bg-white px-4 py-3 text-[14px] text-[#001161] outline-none focus:border-[#5b4fd8] focus:ring-2 focus:ring-[#5b4fd8]/15"
                      />
                    </label>
                  ))}
                </div>

                <label id="order-field-position" className="block mt-4">
                  <span className="block font-['Fenomen_Sans',sans-serif] text-[13px] font-bold text-[#001161] mb-2">
                    {'Funkce / pozice u \u0161koly *'}
                  </span>
                  <select
                    value={form.position}
                    onChange={(event) => {
                      setForm((prev) => ({ ...prev, position: event.target.value }));
                      setFormError('');
                    }}
                    className="w-full rounded-[14px] border border-[#001161]/10 bg-white px-4 py-3 text-[14px] text-[#001161] outline-none focus:border-[#5b4fd8] focus:ring-2 focus:ring-[#5b4fd8]/15 cursor-pointer"
                  >
                    <option value="">{'Vyberte\u2026'}</option>
                    {POSITIONS.map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </label>

                <div className="mt-6 rounded-[20px] border border-[#001161]/10 bg-[#f8f9fc] p-5">
                  <button
                    type="button"
                    onClick={() => setHasSeparateDeliveryAddress((prev) => !prev)}
                    className="w-full flex items-center justify-between gap-4 text-left cursor-pointer"
                  >
                    <div className="flex items-start gap-3">
                      <span className={`inline-flex items-center justify-center w-11 h-11 rounded-[14px] ${hasSeparateDeliveryAddress ? 'bg-[#001161] text-white' : 'bg-white text-[#001161]'}`}>
                        <Truck className="w-5 h-5" />
                      </span>
                      <div>
                        <p className="font-['Fenomen_Sans',sans-serif] text-[14px] font-bold text-[#001161]">
                          {'Doručovací adresa je jiná než fakturační'}
                        </p>
                        <p className="font-['Fenomen_Sans',sans-serif] text-[12px] text-[#001161]/55 mt-1">
                          {'Použijte, pokud objednávku fakturujete na školu, ale chcete ji doručit jinam.'}
                        </p>
                      </div>
                    </div>
                    <span className={`relative inline-flex h-7 w-12 rounded-full transition-colors ${hasSeparateDeliveryAddress ? 'bg-[#001161]' : 'bg-[#001161]/15'}`}>
                      <span className={`absolute top-1 left-1 h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${hasSeparateDeliveryAddress ? 'translate-x-5' : 'translate-x-0'}`} />
                    </span>
                  </button>

                  {hasSeparateDeliveryAddress && (
                    <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
                      {[
                        { key: 'recipientName', label: 'Jméno příjemce', icon: User, placeholder: 'Např. kabinet fyziky' },
                        { key: 'deliveryStreet', label: 'Doručovací ulice a číslo *', icon: Home },
                        { key: 'deliveryCity', label: 'Doručovací město *', icon: MapPin },
                        { key: 'deliveryZip', label: 'Doručovací PSČ *', icon: MapPin },
                      ].map((field) => {
                        const Icon = field.icon;
                        return (
                          <label key={field.key} id={`order-field-${field.key}`} className="block">
                            <span className="block font-['Fenomen_Sans',sans-serif] text-[13px] font-bold text-[#001161] mb-2">
                              {field.label}
                            </span>
                            <div className="relative">
                              <input
                                type="text"
                                value={deliveryAddress[field.key as keyof DeliveryAddressState]}
                                onChange={(event) => setDeliveryAddress((prev) => ({ ...prev, [field.key]: event.target.value }))}
                                placeholder={field.placeholder}
                                className="w-full rounded-[14px] border border-[#001161]/10 bg-white px-4 py-3 pl-11 text-[14px] text-[#001161] outline-none focus:border-[#5b4fd8] focus:ring-2 focus:ring-[#5b4fd8]/15"
                              />
                              <Icon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#001161]/30" />
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="mt-6 space-y-3">
                  <label id="order-field-gdpr" className="flex items-start gap-3 cursor-pointer rounded-[14px] p-1 -m-1">
                    <div onClick={() => setForm(p => ({ ...p, gdpr: !p.gdpr }))}
                      className={`mt-0.5 w-5 h-5 rounded flex items-center justify-center border-2 shrink-0 transition-all ${form.gdpr ? 'bg-[#5B4FD8] border-[#5B4FD8]' : 'bg-white border-[#001161]/20'}`}>
                      {form.gdpr && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                    </div>
                    <span style={FF} className="text-[13px] text-[#001161]/70 leading-snug" onClick={() => setForm(p => ({ ...p, gdpr: !p.gdpr }))}>
                      {'Souhlasím se zpracováním osobních údajů podle '}
                      <a href="https://www.vividbooks.cz/gdpr" target="_blank" rel="noopener noreferrer" className="underline text-[#5B4FD8] hover:opacity-75" onClick={e => e.stopPropagation()}>{'Zásad ochrany osobních údajů'}</a>{'. *'}
                    </span>
                  </label>

                  <label className="flex items-start gap-3 cursor-pointer">
                    <div onClick={() => setForm(p => ({ ...p, newsletter: !p.newsletter }))}
                      className={`mt-0.5 w-5 h-5 rounded flex items-center justify-center border-2 shrink-0 transition-all ${form.newsletter ? 'bg-[#5B4FD8] border-[#5B4FD8]' : 'bg-white border-[#001161]/20'}`}>
                      {form.newsletter && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                    </div>
                    <span style={FF} className="text-[13px] text-[#001161]/70 leading-snug" onClick={() => setForm(p => ({ ...p, newsletter: !p.newsletter }))}>
                      {'Souhlasím se zasíláním novinek ze světa Vividbooks.'}
                    </span>
                  </label>
                </div>

                {formError && (
                  <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 mt-6">
                    <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                    <p style={FF} className="text-red-600 text-[13px]">{formError}</p>
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <button type="button" onClick={goBack} className="inline-flex items-center gap-2 px-4 py-3 rounded-[14px] border border-[#001161]/10 bg-white text-[#001161] font-['Fenomen_Sans',sans-serif] text-[14px] font-bold cursor-pointer">
                  <ChevronLeft className="w-4 h-4" />
                  {'Zpět'}
                </button>
                {isDigitalServicesOnly ? (
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => void doSubmit()}
                    className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-[14px] bg-[#FF8C00] hover:bg-[#e67d00] disabled:opacity-60 text-white font-['Fenomen_Sans',sans-serif] text-[14px] font-bold cursor-pointer"
                  >
                    {submitting ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                        {'Odesílám...'}
                      </>
                    ) : (
                      'Odeslat poptávku — digitální licence / služby'
                    )}
                  </button>
                ) : (
                  <button type="button" onClick={goForward} className="inline-flex items-center gap-2 px-5 py-3 rounded-[14px] bg-[#001161] text-white font-['Fenomen_Sans',sans-serif] text-[14px] font-bold cursor-pointer">
                    {'Pokračovat'}
                    <ChevronRight className="w-4 h-4" />
                  </button>
                )}
              </div>
            </motion.div>
          )}

          {step === 4 && (
            <motion.div key="step-doprava" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }} className="space-y-6">
              <div className="rounded-[24px] border border-[#001161]/10 bg-white p-6 md:p-8">
                <h2 className="font-['Cooper_Light',serif] text-[#001161] text-[30px] leading-tight mb-6">
                  {'Doprava'}
                </h2>
                {showDigitalPlusPrintNotice && (
                  <div className="mb-5 flex items-start gap-3 rounded-[16px] border border-amber-200/80 bg-amber-50/90 px-4 py-3">
                    <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <p style={FF} className="text-[#92400e] text-[13px] leading-snug">{DIGITAL_WITH_PRINT_INFO}</p>
                  </div>
                )}
                <div className="space-y-3">
                  {SHIPPING_OPTIONS.map((option) => (
                    <label
                      key={option.id}
                      className={`flex items-center justify-between gap-4 rounded-[18px] border px-4 py-4 transition-all cursor-pointer ${
                        shipping.method === option.id
                          ? 'border-[#001161] bg-[#f8f9fc]'
                          : 'border-[#001161]/10 bg-white'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="radio"
                          name="school-shipping-method"
                          checked={shipping.method === option.id}
                          onChange={() => handleSchoolShippingMethodChange(option.id)}
                        />
                        <div>
                          <p className="font-['Fenomen_Sans',sans-serif] text-[14px] font-bold text-[#001161]">{option.label}</p>
                          <p className="font-['Fenomen_Sans',sans-serif] text-[13px] text-[#001161]/55 mt-1">{formatPrice(option.price)}</p>
                        </div>
                      </div>
                      <Truck className="w-5 h-5 text-[#001161]/30" />
                    </label>
                  ))}
                </div>

                {shipping.method === 'zasilkovna' && (
                  <div id="school-order-packeta" className="mt-6 rounded-[20px] bg-[#f8f9fc] p-5">
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <div>
                        <p className="font-['Fenomen_Sans',sans-serif] text-[14px] font-bold text-[#001161]">
                          {'Výdejní místo Zásilkovny'}
                        </p>
                        <p className="font-['Fenomen_Sans',sans-serif] text-[13px] text-[#001161]/55 mt-1">
                          {shipping.pickupPointName
                            ? `${shipping.pickupPointName}${shipping.pickupPointStreet ? `, ${shipping.pickupPointStreet}` : ''}${shipping.pickupPointCity ? `, ${shipping.pickupPointCity}` : ''}${shipping.pickupPointZip ? ` ${shipping.pickupPointZip}` : ''}`
                            : 'Zatím není vybráno'}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={handleSchoolPacketaPick}
                        disabled={packetaLoading}
                        className="inline-flex items-center gap-2 px-4 py-3 rounded-[14px] bg-[#001161] text-white font-['Fenomen_Sans',sans-serif] text-[14px] font-bold disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                      >
                        {packetaLoading ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            {'Načítám widget...'}
                          </>
                        ) : (
                          <>
                            <MapPin className="w-4 h-4" />
                            {'Vybrat výdejní místo'}
                          </>
                        )}
                      </button>
                    </div>
                    {packetaError && (
                      <p className="mt-3 font-['Fenomen_Sans',sans-serif] text-[12px] text-[#dc2626]">{packetaError}</p>
                    )}
                    {schoolShippingError && (
                      <p className="mt-3 font-['Fenomen_Sans',sans-serif] text-[12px] text-[#dc2626]">{schoolShippingError}</p>
                    )}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between gap-3">
                <button type="button" onClick={goBack} className="inline-flex items-center gap-2 px-4 py-3 rounded-[14px] border border-[#001161]/10 bg-white text-[#001161] font-['Fenomen_Sans',sans-serif] text-[14px] font-bold cursor-pointer">
                  <ChevronLeft className="w-4 h-4" />
                  {'Zpět'}
                </button>
                <button type="button" onClick={goForward} className="inline-flex items-center gap-2 px-5 py-3 rounded-[14px] bg-[#001161] text-white font-['Fenomen_Sans',sans-serif] text-[14px] font-bold cursor-pointer">
                  {'Pokračovat'}
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          )}

          {step === 5 && (
            <motion.div key="step-platba" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }} className="space-y-6">
              <PaymentMethodSection
                description={
                  paymentMethod === 'card' && hasSchoolWorkbookSelection && !isDigitalServicesOnly
                    ? 'Platba probíhá přes Stripe Payment Element — stejně jako v pokladně. U ostatních metod platbu domluvíme po odeslání poptávky.'
                    : 'Platbu u školní poptávky domluvíme po odeslání. Níže zvolte preferovanou metodu.'
                }
                options={SCHOOL_PAYMENT_OPTIONS}
                selectedId={paymentMethod}
                onSelect={(id) => setPaymentMethod(id as SchoolPaymentPref)}
                isOptionDisabled={(id) => id === 'transfer' || (id !== 'card' && isDesktopPaymentView)}
                notice={showDigitalPlusPrintNotice ? (
                  <div className="mb-5 flex items-start gap-3 rounded-[16px] border border-amber-200/80 bg-amber-50/90 px-4 py-3">
                    <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <p style={FF} className="text-[#92400e] text-[13px] leading-snug">{DIGITAL_WITH_PRINT_INFO}</p>
                  </div>
                ) : undefined}
              >
                {paymentMethod === 'card' && hasSchoolWorkbookSelection && !isDigitalServicesOnly && (
                  <>
                    {!stripePublishableKey && (
                      <p className="font-['Fenomen_Sans',sans-serif] text-[13px] text-[#dc2626] mb-4">
                        {'Chybí VITE_STRIPE_PUBLISHABLE_KEY — online platba kartou není k dispozici.'}
                      </p>
                    )}
                    {!canPrepareSchoolCardPayment && (
                      <p className="font-['Fenomen_Sans',sans-serif] text-[13px] text-[#001161]/60 mb-4">
                        {'Pro zobrazení platebního formuláře zkontrolujte údaje a dopravu v předchozích krocích (včetně výdejního místa u Zásilkovny).'}
                      </p>
                    )}
                    {schoolPaymentIntentLoading && (
                      <div className="inline-flex items-center gap-2 rounded-full bg-[#f8f9fc] px-4 py-2 font-['Fenomen_Sans',sans-serif] text-[13px] text-[#001161]/65 mb-4">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        {'Připravuji platební formulář...'}
                      </div>
                    )}
                    {schoolPaymentIntentError && (
                      <p className="mb-4 font-['Fenomen_Sans',sans-serif] text-[13px] text-[#dc2626]">
                        {schoolPaymentIntentError}
                      </p>
                    )}
                    {clientSecret && stripePromise && (
                      <Elements
                        stripe={stripePromise}
                        options={{
                          clientSecret,
                          appearance: {
                            theme: 'stripe',
                            variables: {
                              colorPrimary: '#001161',
                              borderRadius: '14px',
                            },
                          },
                        }}
                      >
                        <StripePaymentSubmitForm
                          total={orderSummaryGrandHalers}
                          onError={setSchoolPaymentIntentError}
                        />
                      </Elements>
                    )}
                    {paymentIntentId && (
                      <p className="mt-4 font-['Fenomen_Sans',sans-serif] text-[12px] text-[#001161]/45">
                        {`PaymentIntent: ${paymentIntentId}`}
                      </p>
                    )}
                  </>
                )}
              </PaymentMethodSection>

              <div className="flex items-center justify-between gap-3">
                <button type="button" onClick={goBack} className="inline-flex items-center gap-2 px-4 py-3 rounded-[14px] border border-[#001161]/10 bg-white text-[#001161] font-['Fenomen_Sans',sans-serif] text-[14px] font-bold cursor-pointer">
                  <ChevronLeft className="w-4 h-4" />
                  {'Zpět'}
                </button>
                <button
                  type="button"
                  onClick={goForward}
                  disabled={
                    paymentMethod === 'card'
                    && !isDigitalServicesOnly
                    && hasSchoolWorkbookSelection
                    && Boolean(stripePublishableKey)
                  }
                  className="inline-flex items-center gap-2 px-5 py-3 rounded-[14px] bg-[#001161] text-white font-['Fenomen_Sans',sans-serif] text-[14px] font-bold disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  {'Pokračovat'}
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
              {paymentMethod === 'card' && !isDigitalServicesOnly && hasSchoolWorkbookSelection && stripePublishableKey && (
                <p style={FF} className="text-[12px] text-[#001161]/50 text-center -mt-2">
                  {'U platby kartou použijte tlačítko „Zaplatit“ výše — po úspěchu vás přesměrujeme. Krok „Potvrzení“ je pro platbu převodem / domluvenou platbu.'}
                </p>
              )}
            </motion.div>
          )}

          {step === 6 && (
            <motion.div key="step-potvrzeni" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }} className="space-y-6">
              {selTypes.includes('workbook') && Object.values(quantities).some((q) => q > 0) && !upsellDismissed && (() => {
                const selectedItems = Object.entries(quantities)
                  .filter(([, qty]) => qty > 0)
                  .map(([id, qty]) => ({ p: products.find((x) => String(x.id) === String(id)), qty }))
                  .filter((x): x is { p: Product; qty: number } => Boolean(x.p));
                if (!selectedItems.length) return null;
                return (
                  <div className="bg-[#FFF7ED] border border-[#FF8C00]/25 rounded-[24px] px-6 py-5">
                    <div className="flex items-start justify-between gap-3 mb-4">
                      <div className="flex items-start gap-3">
                        <span className="text-[26px] shrink-0 mt-0.5">🛒</span>
                        <div>
                          <p style={FF} className="text-[#001161] text-[16px] font-bold leading-snug">
                            {'Tiskoviny už máte ve stejném košíku jako běžnou objednávku.'}
                          </p>
                          <p style={FF} className="text-[#001161]/60 text-[13px] mt-1">
                            {'Když z této stránky odejdete do pokladny, zůstanou vám tam stejné kusy i počty.'}
                          </p>
                        </div>
                      </div>
                      <button type="button" onClick={() => setUpsellDismissed(true)} style={FF} className="shrink-0 text-[12px] text-[#001161]/40 hover:text-[#001161]/70 underline transition-colors cursor-pointer whitespace-nowrap mt-1">
                        {'Nemám zájem'}
                      </button>
                    </div>
                    <div className="flex flex-col gap-2 mb-4">
                      {selectedItems.map(({ p, qty }) => (
                        <div key={p.id} className="flex items-center justify-between bg-white rounded-[12px] px-4 py-2.5 border border-[#001161]/8">
                          <div className="flex-1 min-w-0">
                            <p style={FF} className="text-[#001161] text-[13px] font-semibold leading-tight truncate">{p.name}</p>
                            <p style={FF} className="text-[#001161]/50 text-[12px]">{qty}{'\u00a0ks ×\u00a0'}{p.price.replace(',-', '')}{',− Kč'}</p>
                          </div>
                          <span style={FF} className="ml-3 shrink-0 px-3 py-1.5 rounded-[8px] text-[12px] font-bold bg-green-100 text-green-700 border border-green-200">
                            {'V košíku'}
                          </span>
                        </div>
                      ))}
                    </div>
                    <button type="button" onClick={openCart} className="w-full bg-[#001161] hover:bg-[#001161]/85 text-white font-['Fenomen_Sans',sans-serif] font-bold text-[14px] py-3 rounded-[12px] transition-all cursor-pointer flex items-center justify-center gap-2">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                      {'Zobrazit košík'}
                    </button>
                  </div>
                );
              })()}

              <div className="bg-[#EEF1FA] border border-[#001161]/10 rounded-[24px] px-6 py-5">
                <div className="flex items-center justify-between mb-4">
                  <p style={FF} className="text-[#001161] text-[14px] font-black uppercase tracking-widest">{'Potvrzení'}</p>
                  <button type="button" onClick={() => { setStep(1); window.scrollTo({ top: 0, behavior: 'smooth' }); }} style={FF}
                    className="text-[12px] text-[#5B4FD8] hover:text-[#4c2db3] underline cursor-pointer transition-colors flex items-center gap-1">
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" /></svg>
                    {'Upravit výběr'}
                  </button>
                </div>
                <div className="flex flex-col gap-2.5">
                  <div className="bg-white rounded-[14px] px-4 py-3">
                    <p style={FF} className="text-[11px] font-bold text-[#001161]/40 uppercase tracking-widest mb-2">{'Předměty a formy'}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {selSubjects.map(sk => {
                        const s2 = SUBJECTS_2.find(s => s.key === sk);
                        const s1 = SUBJECTS_1.find(s => s.key === sk);
                        const found = s2 || s1;
                        if (!found) return null;
                        return <span key={sk} style={FF} className="inline-flex items-center gap-1 text-[12px] font-semibold px-2.5 py-1 rounded-xl bg-[#001161]/10 text-[#001161]">{found.label}</span>;
                      })}
                      {selTypes.map(type => {
                        const found = FORM_TYPES.find(item => item.key === type);
                        if (!found) return null;
                        return <span key={type} style={FF} className="inline-flex items-center gap-1 text-[12px] font-semibold px-2.5 py-1 rounded-xl bg-white text-[#001161] border border-[#001161]/10">{found.label}</span>;
                      })}
                    </div>
                  </div>
                  {selTypes.includes('digital') && (
                    <div className="bg-[#FEF9C3]/70 rounded-[14px] px-4 py-3">
                      <p style={FF} className="text-[#001161] text-[13px] font-bold">{'Digitální učebnice'}</p>
                      <p style={FF} className="text-[#001161]/55 text-[12px] mt-0.5">{students2}{' žáků (2. st.) · '}{licYears}{licYears === 1 ? '\u00a0rok' : '\u00a0roky'}</p>
                      {digitalSubjects.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {digitalSubjects.map((subjectKey) => {
                            const found = [...SUBJECTS_2, ...SUBJECTS_1].find((subject) => subject.key === subjectKey);
                            if (!found) return null;
                            return (
                              <span key={subjectKey} style={FF} className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-xl bg-white/80 text-[#001161] border border-[#001161]/10">
                                {found.label}
                              </span>
                            );
                          })}
                        </div>
                      )}
                      {showDigitalPlusPrintNotice && (
                        <p style={FF} className="text-[#92400e] text-[12px] mt-3 leading-snug border-t border-[#001161]/10 pt-3">
                          {DIGITAL_WITH_PRINT_INFO}
                        </p>
                      )}
                    </div>
                  )}
                  {selTypes.includes('workbook') && hasSchoolWorkbookSelection && (
                    <div className="bg-[#F0F2F8] rounded-[14px] px-4 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <p style={FF} className="text-[#001161] text-[13px] font-bold">{'Pracovní sešity'}</p>
                        <span style={FF} className="text-[13px] font-bold text-[#001161]">{workbookItems}{' ks · '}{workbookTotal}{',− Kč'}</span>
                      </div>
                    </div>
                  )}
                  <div className="bg-white rounded-[14px] px-4 py-3">
                    <p style={FF} className="text-[11px] font-bold text-[#001161]/40 uppercase tracking-widest mb-2">{'Škola a doručení'}</p>
                    <p style={FF} className="text-[#001161] text-[13px] font-semibold">{form.schoolName || 'Bez názvu školy'}</p>
                    <p style={FF} className="text-[#001161]/55 text-[12px] mt-1">{form.name}{form.position ? ` · ${form.position}` : ''}</p>
                    <p style={FF} className="text-[#001161]/55 text-[12px] mt-1">{form.email}{form.phone ? ` · ${form.phone}` : ''}</p>
                    <p style={FF} className="text-[#001161]/55 text-[12px] mt-2">
                      {(SHIPPING_OPTIONS.find((option) => option.id === shipping.method)?.label ?? shipping.method)}
                      {shipping.method === 'zasilkovna' && shipping.pickupPointName && (
                        <>
                          <br />
                          <span className="text-[#001161]/70">
                            {shipping.pickupPointName}
                            {shipping.pickupPointStreet ? `, ${shipping.pickupPointStreet}` : ''}
                            {shipping.pickupPointCity ? `, ${shipping.pickupPointCity}` : ''}
                            {shipping.pickupPointZip ? ` ${shipping.pickupPointZip}` : ''}
                          </span>
                        </>
                      )}
                    </p>
                    <p style={FF} className="text-[#001161]/55 text-[12px] mt-1">
                      {'Platba: '}
                      {(SCHOOL_PAYMENT_OPTIONS.find((option) => option.id === paymentMethod)?.label ?? paymentMethod)}
                    </p>
                  </div>
                </div>
              </div>

              <form onSubmit={handleSubmit} noValidate>
                {formError && (
                  <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-4">
                    <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                    <p style={FF} className="text-red-600 text-[13px]">{formError}</p>
                  </div>
                )}
                <div className="flex items-center justify-between gap-3">
                  <button type="button" onClick={goBack} className="inline-flex items-center gap-2 px-4 py-3 rounded-[14px] border border-[#001161]/10 bg-white text-[#001161] font-['Fenomen_Sans',sans-serif] text-[14px] font-bold cursor-pointer">
                    <ChevronLeft className="w-4 h-4" />
                    {'Zpět'}
                  </button>
                  <button type="submit" disabled={submitting} className="inline-flex items-center gap-2 px-5 py-3 rounded-[14px] bg-[#FF8C00] hover:bg-[#e67d00] disabled:opacity-60 text-white font-['Fenomen_Sans',sans-serif] text-[14px] font-bold cursor-pointer">
                    {submitting ? <><div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />{'Odesílám...'}</> : 'Odeslat nezávaznou poptávku'}
                  </button>
                </div>
              </form>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}
