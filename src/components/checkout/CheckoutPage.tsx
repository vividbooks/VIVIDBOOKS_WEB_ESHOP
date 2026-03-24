import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Building2,
  Check,
  ChevronLeft,
  ChevronRight,
  Home,
  Loader2,
  MapPin,
  Minus,
  Package,
  Plus,
  Search,
  Trash2,
  Truck,
  User,
} from 'lucide-react';
import { Elements } from '@stripe/react-stripe-js';
import { loadStripeForApp } from '../../utils/stripe/loadStripeApp';
import { getCartLineKey, useCart } from '../../contexts/CartContext';
import { useProducts } from '../../contexts/ProductsContext';
import { projectId, publicAnonKey } from '../../utils/supabase/info';
import { InternalCartUpsellSection } from './InternalCartUpsellSection';
import { BookCoverThumb } from './BookCoverThumb';
import { CheckoutSummaryCard } from './CheckoutSummaryCard';
import { formatPrice } from './formatPrice';
import { PaymentMethodSection } from './PaymentMethodCards';
import { StripePaymentSubmitForm } from './StripePaymentSubmitForm';
import { getProductUnitPriceInHaler } from '../cartUpsellUtils';
import { flashInvalidField } from '../../utils/formFieldHighlight';
import { parseSchoolAddress } from '../../utils/parseSchoolAddress';
import { SEOHead } from '../SEOHead';

type CheckoutStep = 1 | 2 | 3 | 4 | 5;
type ShippingMethod = 'dpd' | 'zasilkovna' | 'gls' | 'ppl';
type PaymentMethodOption = 'apple_pay' | 'google_pay' | 'card' | 'transfer';
type CustomerType = 'school' | 'individual';

interface SchoolSearchResult {
  ico: string;
  name: string;
  address?: string;
}

interface CustomerFormState {
  name: string;
  email: string;
  phone: string;
  schoolName: string;
  ico: string;
  street: string;
  city: string;
  zip: string;
}

interface DeliveryAddressState {
  recipientName: string;
  deliveryStreet: string;
  deliveryCity: string;
  deliveryZip: string;
}

interface ShippingState {
  method: ShippingMethod;
  price: number;
  pickupPointId?: string;
  pickupPointName?: string;
  pickupPointStreet?: string;
  pickupPointCity?: string;
  pickupPointZip?: string;
}

const stripePublishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY ?? '';
const stripePromise = stripePublishableKey ? loadStripeForApp(stripePublishableKey) : null;
const CREATE_PAYMENT_INTENT_URL = `https://${projectId}.supabase.co/functions/v1/create-payment-intent`;
const RESUME_CHECKOUT_URL = `https://${projectId}.supabase.co/functions/v1/resume-checkout`;
const CONTACT_SERVER_URL = `https://${projectId}.supabase.co/functions/v1/make-server-93a20b6f`;
const PACKETA_WIDGET_URL = 'https://widget.packeta.com/v6/www/js/library.js';
const PACKETA_API_KEY = import.meta.env.VITE_PACKETA_API_KEY ?? '';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const STEPS: Array<{ id: CheckoutStep; label: string }> = [
  { id: 1, label: 'Košík' },
  { id: 2, label: 'Údaje' },
  { id: 3, label: 'Doprava' },
  { id: 4, label: 'Platba' },
  { id: 5, label: 'Potvrzení' },
];

const SHIPPING_OPTIONS: Array<{ id: ShippingMethod; label: string; price: number }> = [
  { id: 'dpd', label: 'DPD', price: 8900 },
  { id: 'zasilkovna', label: 'Zásilkovna Z-Point', price: 7900 },
  { id: 'gls', label: 'GLS', price: 8900 },
  { id: 'ppl', label: 'PPL', price: 9900 },
];

const INITIAL_CUSTOMER: CustomerFormState = {
  name: '',
  email: '',
  phone: '',
  schoolName: '',
  ico: '',
  street: '',
  city: '',
  zip: '',
};

const INITIAL_SHIPPING: ShippingState = {
  method: 'dpd',
  price: 8900,
};

const INITIAL_DELIVERY_ADDRESS: DeliveryAddressState = {
  recipientName: '',
  deliveryStreet: '',
  deliveryCity: '',
  deliveryZip: '',
};

const PAYMENT_OPTIONS: Array<{
  id: PaymentMethodOption;
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
    description: 'Okamžitá platba přes Stripe Payment Element.',
    priceLabel: 'Zdarma',
  },
  {
    id: 'transfer',
    label: 'Převodem',
    description: 'Připravujeme samostatný převodový flow.',
    priceLabel: 'Zdarma',
  },
];

function PlaceholderSection({ title, text = 'Bude doplněno' }: { title: string; text?: string }) {
  return (
    <div className="rounded-[24px] border border-[#001161]/10 bg-white p-6 md:p-8">
      <h2 className="font-['Cooper_Light',serif] text-[#001161] text-[30px] leading-tight mb-3">
        {title}
      </h2>
      <p className="font-['Fenomen_Sans',sans-serif] text-[15px] text-[#001161]/60 leading-relaxed">
        {text}
      </p>
    </div>
  );
}

export function CheckoutPage() {
  const { products } = useProducts();
  const { items, subtotal, itemCount, updateQuantity, removeItem, replaceUnitPrice } = useCart();
  const [currentStep, setCurrentStep] = useState<CheckoutStep>(1);
  const [customerType, setCustomerType] = useState<CustomerType>('school');
  const [customer, setCustomer] = useState<CustomerFormState>(INITIAL_CUSTOMER);
  const [hasSeparateDeliveryAddress, setHasSeparateDeliveryAddress] = useState(false);
  const [deliveryAddress, setDeliveryAddress] = useState<DeliveryAddressState>(INITIAL_DELIVERY_ADDRESS);
  const [shipping, setShipping] = useState<ShippingState>(INITIAL_SHIPPING);
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof CustomerFormState | keyof DeliveryAddressState | 'shipping', string>>>({});
  const [packetaLoading, setPacketaLoading] = useState(false);
  const [packetaError, setPacketaError] = useState('');
  const [paymentIntentLoading, setPaymentIntentLoading] = useState(false);
  const [paymentIntentError, setPaymentIntentError] = useState('');
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [paymentIntentId, setPaymentIntentId] = useState<string | null>(null);
  const [resumeFlowActive, setResumeFlowActive] = useState(false);
  const [resumeLoading, setResumeLoading] = useState(false);
  const [resumeError, setResumeError] = useState('');
  const [resumedTotals, setResumedTotals] = useState<{
    subtotal: number;
    shipping: number;
    total: number;
  } | null>(null);
  const [resumedOrderNumber, setResumedOrderNumber] = useState<string | null>(null);
  const [isDesktopPaymentView, setIsDesktopPaymentView] = useState(false);
  const [schoolQuery, setSchoolQuery] = useState('');
  const [schoolResults, setSchoolResults] = useState<SchoolSearchResult[]>([]);
  const [schoolSearchLoading, setSchoolSearchLoading] = useState(false);
  const [schoolLookupLoading, setSchoolLookupLoading] = useState(false);
  const [isSchoolResultsOpen, setIsSchoolResultsOpen] = useState(false);
  const lastPaymentKeyRef = useRef<string | null>(null);
  const schoolSearchRef = useRef<HTMLDivElement | null>(null);
  /** Aby starší odpověď ARES/CSV nepřepsala novější požadavek (dvojí fetch při výběru školy). */
  const schoolAddressFetchSeq = useRef(0);

  const applySchoolAddressFromIco = useCallback(async (icoRaw: string) => {
    const icoDigits = String(icoRaw ?? '').replace(/\D/g, '');
    if (icoDigits.length < 6) return;

    const seq = ++schoolAddressFetchSeq.current;
    setSchoolLookupLoading(true);

    try {
      const response = await fetch(
        `${CONTACT_SERVER_URL}/school-search?ico=${encodeURIComponent(icoDigits)}`,
        { headers: { Authorization: `Bearer ${publicAnonKey}` } },
      );
      const data = await response.json().catch(() => ({}));
      const result = Array.isArray(data.results) ? data.results[0] : undefined;

      if (seq !== schoolAddressFetchSeq.current) return;
      if (!result) return;

      const parsedAddress = parseSchoolAddress(result.address, result.ico);

      setCustomer((prev) => ({
        ...prev,
        schoolName: result.name || prev.schoolName,
        ico: result.ico ? String(result.ico) : prev.ico,
        street: parsedAddress.street || prev.street,
        city: parsedAddress.city || prev.city,
        zip: parsedAddress.zip || prev.zip,
      }));
    } catch {
      // Doplnění adresy je best-effort.
    } finally {
      if (seq === schoolAddressFetchSeq.current) {
        setSchoolLookupLoading(false);
      }
    }
  }, []);

  const shippingTotal = shipping.price;
  const total = subtotal + shippingTotal;

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const params = new URLSearchParams(window.location.search);
    const token = params.get('resume')?.trim();
    if (!token) return;

    let cancelled = false;
    setResumeLoading(true);
    setResumeError('');

    fetch(RESUME_CHECKOUT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${publicAnonKey}`,
      },
      body: JSON.stringify({ token }),
    })
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (cancelled) return;
        if (!response.ok) {
          throw new Error(typeof data.error === 'string' ? data.error : 'Odkaz nelze použít.');
        }
        if (data.status === 'already_paid') {
          const num = typeof data.orderNumber === 'string' ? data.orderNumber : '';
          window.location.replace(
            num
              ? `/objednavka/dekujeme?order=${encodeURIComponent(num)}`
              : '/objednavka/dekujeme',
          );
          return;
        }
        if (data.status === 'payment_cancelled') {
          throw new Error(
            typeof data.message === 'string'
              ? data.message
              : 'Platba byla zrušena. Vytvořte prosím novou objednávku.',
          );
        }
        if (data.status !== 'requires_payment' || typeof data.clientSecret !== 'string') {
          throw new Error('Nepodařilo se obnovit platbu.');
        }
        setResumeFlowActive(true);
        setClientSecret(data.clientSecret);
        setPaymentIntentId(typeof data.paymentIntentId === 'string' ? data.paymentIntentId : null);
        setResumedOrderNumber(typeof data.orderNumber === 'string' ? data.orderNumber : null);
        setResumedTotals({
          subtotal: Number(data.subtotal) || 0,
          shipping: Number(data.shippingPrice) || 0,
          total: Number(data.total) || 0,
        });
        setCurrentStep(4);
        window.history.replaceState({}, '', window.location.pathname);
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setResumeError(error instanceof Error ? error.message : 'Chyba při otevření odkazu.');
        }
      })
      .finally(() => {
        if (!cancelled) setResumeLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (products.length === 0) return;
    items.forEach((item) => {
      if (item.unitPrice > 0) return;
      if (item.bundleInstanceId) return;
      const product = products.find((p) => String(p.id) === String(item.productId));
      if (!product) return;
      const nextUnitPrice = getProductUnitPriceInHaler(product);
      if (nextUnitPrice > 0) {
        replaceUnitPrice(item.productId, item.variantId, nextUnitPrice, item.bundleInstanceId);
      }
    });
  }, [items, products, replaceUnitPrice]);

  const currentStepConfig = useMemo(
    () => STEPS.find((step) => step.id === currentStep) ?? STEPS[0],
    [currentStep],
  );

  /** Doprava v shrnutí od kroku Doprava; u Zásilkovny až po výběru výdejního místa. */
  const showShippingInSummary = useMemo(() => {
    if (currentStep < 3) return false;
    if (currentStep > 3) return true;
    return shipping.method !== 'zasilkovna' || Boolean(shipping.pickupPointId);
  }, [currentStep, shipping.method, shipping.pickupPointId]);

  const summarySubtotal = resumeFlowActive && resumedTotals ? resumedTotals.subtotal : subtotal;
  const summaryShippingTotal = resumeFlowActive && resumedTotals ? resumedTotals.shipping : shippingTotal;
  const summaryTotal = resumeFlowActive && resumedTotals ? resumedTotals.total : total;
  const summaryShowShipping = resumeFlowActive
    ? Boolean(resumedTotals)
    : showShippingInSummary;

  const canGoBack = currentStep > 1;

  const isCustomerStepValid = useMemo(() => (
    customer.name.trim().length > 0 &&
    EMAIL_RE.test(customer.email.trim()) &&
    customer.phone.trim().length > 0 &&
    (customerType === 'individual' || (
      customer.schoolName.trim().length > 0 &&
      customer.ico.trim().length > 0
    )) &&
    customer.street.trim().length > 0 &&
    customer.city.trim().length > 0 &&
    customer.zip.trim().length > 0 &&
    (!hasSeparateDeliveryAddress || (
      deliveryAddress.deliveryStreet.trim().length > 0 &&
      deliveryAddress.deliveryCity.trim().length > 0 &&
      deliveryAddress.deliveryZip.trim().length > 0
    ))
  ), [customer, customerType, hasSeparateDeliveryAddress, deliveryAddress]);

  const isShippingStepValid = useMemo(() => (
    shipping.method !== 'zasilkovna' || !!shipping.pickupPointId
  ), [shipping]);

  const canGoForward = (
    (currentStep === 1 && items.length > 0) ||
    (currentStep === 2 && isCustomerStepValid) ||
    (currentStep === 3 && isShippingStepValid)
  );

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

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const media = window.matchMedia('(min-width: 1024px)');
    const apply = () => setIsDesktopPaymentView(media.matches);

    apply();
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, []);

  useEffect(() => {
    setSchoolQuery(customer.schoolName);
  }, [customer.schoolName]);

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (schoolSearchRef.current && !schoolSearchRef.current.contains(event.target as Node)) {
        setIsSchoolResultsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  useEffect(() => {
    if (customerType !== 'school') {
      setSchoolResults([]);
      setIsSchoolResultsOpen(false);
      return;
    }

    const query = schoolQuery.trim();
    if (query.length < 2) {
      setSchoolResults([]);
      setIsSchoolResultsOpen(false);
      return;
    }

    const timer = window.setTimeout(async () => {
      setSchoolSearchLoading(true);

      try {
        const response = await fetch(`${CONTACT_SERVER_URL}/school-search?q=${encodeURIComponent(query)}`, {
          headers: { Authorization: `Bearer ${publicAnonKey}` },
        });
        const data = await response.json().catch(() => ({}));
        const results = Array.isArray(data.results) ? data.results : [];

        setSchoolResults(results);
        setIsSchoolResultsOpen(results.length > 0);
      } catch {
        setSchoolResults([]);
        setIsSchoolResultsOpen(false);
      } finally {
        setSchoolSearchLoading(false);
      }
    }, 350);

    return () => window.clearTimeout(timer);
  }, [customerType, schoolQuery]);

  useEffect(() => {
    if (customerType !== 'school') return;

    const icoDigits = customer.ico.replace(/\D/g, '');
    if (icoDigits.length < 6) return;

    const timer = window.setTimeout(() => {
      void applySchoolAddressFromIco(customer.ico);
    }, 450);

    return () => window.clearTimeout(timer);
  }, [customer.ico, customerType, applySchoolAddressFromIco]);

  useEffect(() => {
    if (currentStep !== 4) return;
    if (resumeFlowActive) return;
    if (!isCustomerStepValid || !isShippingStepValid || items.length === 0) return;

    const payload = {
      items: items.map((item) => ({
        productId: item.productId,
        productName: item.productName,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        ...(item.variantName?.trim() ? { variant: item.variantName.trim() } : {}),
        ...(item.bundleId?.trim() ? { bundleId: item.bundleId.trim() } : {}),
        ...(item.bundleTitle?.trim() ? { bundleTitle: item.bundleTitle.trim() } : {}),
      })),
      shipping: {
        method: shipping.method,
        price: shipping.price,
        pickupPointId: shipping.pickupPointId,
        pickupPointName: shipping.pickupPointName,
        differentAddress: hasSeparateDeliveryAddress,
        deliveryAddress: hasSeparateDeliveryAddress ? {
          recipientName: deliveryAddress.recipientName.trim() || customer.name.trim(),
          street: deliveryAddress.deliveryStreet.trim(),
          city: deliveryAddress.deliveryCity.trim(),
          zip: deliveryAddress.deliveryZip.trim(),
        } : undefined,
      },
      customer: {
        email: customer.email.trim(),
        name: customer.name.trim(),
        phone: customer.phone.trim(),
        schoolName: customer.schoolName.trim() || undefined,
        ico: customer.ico.trim() || undefined,
        street: customer.street.trim(),
        city: customer.city.trim(),
        zip: customer.zip.trim(),
      },
    };

    const paymentKey = JSON.stringify(payload);
    if (lastPaymentKeyRef.current === paymentKey && clientSecret) return;

    lastPaymentKeyRef.current = paymentKey;
    setPaymentIntentLoading(true);
    setPaymentIntentError('');

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
        setPaymentIntentError(error instanceof Error ? error.message : 'Nepodařilo se připravit platbu.');
      })
      .finally(() => setPaymentIntentLoading(false));
  }, [
    currentStep,
    items,
    shipping,
    customer,
    hasSeparateDeliveryAddress,
    deliveryAddress,
    isCustomerStepValid,
    isShippingStepValid,
    clientSecret,
    resumeFlowActive,
  ]);

  const validateCustomerStep = () => {
    const nextErrors: Partial<Record<keyof CustomerFormState | keyof DeliveryAddressState, string>> = {};

    if (!customer.name.trim()) nextErrors.name = 'Vyplňte jméno.';
    if (!EMAIL_RE.test(customer.email.trim())) nextErrors.email = 'Zadejte platný e-mail.';
    if (!customer.phone.trim()) nextErrors.phone = 'Vyplňte telefon.';
    if (customerType === 'school' && !customer.schoolName.trim()) nextErrors.schoolName = 'Vyberte školu.';
    if (customerType === 'school' && !customer.ico.trim()) nextErrors.ico = 'Vyplňte IČO školy.';
    if (!customer.street.trim()) nextErrors.street = 'Vyplňte ulici a číslo.';
    if (!customer.city.trim()) nextErrors.city = 'Vyplňte město.';
    if (!customer.zip.trim()) nextErrors.zip = 'Vyplňte PSČ.';
    if (hasSeparateDeliveryAddress && !deliveryAddress.deliveryStreet.trim()) nextErrors.deliveryStreet = 'Vyplňte doručovací ulici a číslo.';
    if (hasSeparateDeliveryAddress && !deliveryAddress.deliveryCity.trim()) nextErrors.deliveryCity = 'Vyplňte doručovací město.';
    if (hasSeparateDeliveryAddress && !deliveryAddress.deliveryZip.trim()) nextErrors.deliveryZip = 'Vyplňte doručovací PSČ.';

    setFormErrors((prev) => ({ ...prev, ...nextErrors }));

    const ORDER: Array<keyof CustomerFormState | keyof DeliveryAddressState> = [
      'name', 'email', 'phone', 'schoolName', 'ico', 'street', 'city', 'zip',
      'deliveryStreet', 'deliveryCity', 'deliveryZip',
    ];
    const first = ORDER.find((k) => nextErrors[k]);
    if (first) {
      setTimeout(() => flashInvalidField(document.getElementById(`checkout-field-${String(first)}`)), 0);
    }
    return Object.keys(nextErrors).length === 0;
  };

  const validateShippingStep = () => {
    if (shipping.method === 'zasilkovna' && !shipping.pickupPointId) {
      setFormErrors((prev) => ({ ...prev, shipping: 'Vyberte výdejní místo Zásilkovny.' }));
      setTimeout(() => flashInvalidField(document.getElementById('checkout-field-shipping-pickup')), 0);
      return false;
    }

    setFormErrors((prev) => ({ ...prev, shipping: undefined }));
    return true;
  };

  const goBack = () => {
    if (!canGoBack) return;
    setCurrentStep((prev) => Math.max(1, prev - 1) as CheckoutStep);
  };

  const goForward = () => {
    if (!canGoForward) return;

    if (currentStep === 2 && !validateCustomerStep()) return;
    if (currentStep === 3 && !validateShippingStep()) return;

    setCurrentStep((prev) => Math.min(4, prev + 1) as CheckoutStep);
  };

  const handleCustomerChange = (field: keyof CustomerFormState, value: string) => {
    setCustomer((prev) => ({ ...prev, [field]: value }));
    setFormErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const handleDeliveryAddressChange = (field: keyof DeliveryAddressState, value: string) => {
    setDeliveryAddress((prev) => ({ ...prev, [field]: value }));
    setFormErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const handleCustomerTypeChange = (type: CustomerType) => {
    setCustomerType(type);
    setFormErrors((prev) => ({
      ...prev,
      schoolName: undefined,
      ico: undefined,
    }));
  };

  const handleSeparateDeliveryToggle = () => {
    setHasSeparateDeliveryAddress((prev) => {
      const next = !prev;

      if (next) {
        setDeliveryAddress((current) => ({
          recipientName: current.recipientName || customer.name,
          deliveryStreet: current.deliveryStreet || customer.street,
          deliveryCity: current.deliveryCity || customer.city,
          deliveryZip: current.deliveryZip || customer.zip,
        }));
      } else {
        setFormErrors((current) => ({
          ...current,
          recipientName: undefined,
          deliveryStreet: undefined,
          deliveryCity: undefined,
          deliveryZip: undefined,
        }));
      }

      return next;
    });
  };

  const handleSchoolSelect = (school: SchoolSearchResult) => {
    const parsedAddress = parseSchoolAddress(school.address, school.ico);
    const icoStr = String(school.ico ?? '').trim();

    setSchoolQuery(school.name);
    setSchoolResults([]);
    setIsSchoolResultsOpen(false);
    setCustomer((prev) => ({
      ...prev,
      schoolName: school.name,
      ico: icoStr,
      street: parsedAddress.street || prev.street,
      city: parsedAddress.city || prev.city,
      zip: parsedAddress.zip || prev.zip,
    }));
    setFormErrors((prev) => ({
      ...prev,
      schoolName: undefined,
      ico: undefined,
      street: undefined,
      city: undefined,
      zip: undefined,
    }));

    // Vždy znovu dotáhnout adresu z API — při stejném IČO jako už ve formuláři se jinak useEffect nespustí.
    void applySchoolAddressFromIco(icoStr);
  };

  const handleShippingMethodChange = (method: ShippingMethod) => {
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
    setFormErrors((prev) => ({ ...prev, shipping: undefined }));
  };

  const summarySlotDesktop =
    typeof document !== 'undefined' ? document.getElementById('checkout-summary-slot-desktop') : null;
  const summarySlotMobile =
    typeof document !== 'undefined' ? document.getElementById('checkout-summary-slot-mobile') : null;

  const handlePacketaPick = () => {
    setPacketaError('');
    if (!PACKETA_API_KEY) {
      setPacketaError('Chybí VITE_PACKETA_API_KEY pro widget Zásilkovny.');
      return;
    }
    setPacketaLoading(true);

    if (!window.Packeta?.Widget) {
      setPacketaLoading(false);
      setPacketaError('Widget Zásilkovny se zatím nenačetl. Zkuste to prosím znovu.');
      return;
    }

    window.Packeta.Widget.pick(PACKETA_API_KEY, (point) => {
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
      setFormErrors((prev) => ({ ...prev, shipping: undefined }));
    }, {
      country: 'cz',
    });
  };

  return (
    <div className="min-h-screen bg-[#f8f9fc]">
      <SEOHead
        title="Pokladna"
        path="/pokladna"
        description="Dokončení objednávky Vividbooks."
        noIndex
      />
      {summarySlotDesktop &&
        createPortal(
          <CheckoutSummaryCard
            itemCount={itemCount}
            subtotal={summarySubtotal}
            shippingTotal={summaryShippingTotal}
            total={summaryTotal}
            showShipping={summaryShowShipping}
            resumeOrderNumber={resumeFlowActive ? resumedOrderNumber : null}
          />,
          summarySlotDesktop,
        )}
      {summarySlotMobile &&
        createPortal(
          <CheckoutSummaryCard
            itemCount={itemCount}
            subtotal={summarySubtotal}
            shippingTotal={summaryShippingTotal}
            total={summaryTotal}
            showShipping={summaryShowShipping}
            resumeOrderNumber={resumeFlowActive ? resumedOrderNumber : null}
          />,
          summarySlotMobile,
        )}
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-8 md:py-12">
        {resumeError && (
          <div className="mb-6 rounded-[16px] border border-red-200 bg-red-50 px-4 py-3 font-['Fenomen_Sans',sans-serif] text-[13px] text-red-800">
            {resumeError}
          </div>
        )}
        {/* pt-2 jako logo v sidebaru — „Pokladna“ na stejné výšce jako VIVID BOOKS */}
        <div className="mb-8 md:mb-10 pt-2 flex flex-col gap-2 md:flex-row md:items-center md:justify-between md:gap-6">
          <h1 className="font-['Cooper_Light',serif] text-[#001161] text-[40px] md:text-[56px] leading-none shrink-0">
            {'Pokladna'}
          </h1>
          <p className="font-['Fenomen_Sans',sans-serif] text-[12px] uppercase tracking-[0.15em] text-[#001161]/40 md:text-right md:max-w-[12rem] md:pt-1">
            {'Nový checkout'}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 mb-8">
          {STEPS.map((step) => {
            const isActive = step.id === currentStep;
            const isCompleted = step.id < currentStep;
            const isDisabled = step.id > currentStep;

            return (
              <button
                key={step.id}
                onClick={() => {
                  if (!isDisabled) setCurrentStep(step.id);
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
                <span className={`inline-flex shrink-0 items-center justify-center w-7 h-7 rounded-full text-[12px] font-bold ${
                  isActive
                    ? 'bg-white text-[#001161]'
                    : isCompleted
                      ? 'bg-[#16a34a] text-white'
                      : 'bg-[#f1f3f8] text-[#001161]'
                }`}>
                  {isCompleted ? <Check className="w-4 h-4" /> : step.id}
                </span>
                <span className={`font-['Fenomen_Sans',sans-serif] text-[13px] md:text-[14px] font-bold leading-tight min-w-0 ${
                  isActive ? 'text-white' : isCompleted ? 'text-[#166534]' : 'text-[#001161]'
                }`}>
                  {step.label}
                </span>
              </button>
            );
          })}
        </div>

        <div className="max-w-3xl space-y-6">
            {currentStep === 1 && (
              <div className="rounded-[24px] border border-[#001161]/10 bg-white overflow-hidden">
                <div className="px-6 md:px-8 pt-5 pb-6 md:pt-6 md:pb-8">
                  <h2 className="font-['Cooper_Light',serif] text-[#001161] text-[30px] leading-tight mb-1.5">
                    {'Košík'}
                  </h2>
                  {items.length === 0 ? (
                    <div className="flex items-center gap-3 rounded-[18px] bg-[#f8f9fc] px-4 py-4 mt-2">
                      <Package className="w-5 h-5 text-[#001161]/35" />
                      <p className="font-['Fenomen_Sans',sans-serif] text-[15px] text-[#001161]/60">
                        {'Košík je zatím prázdný.'}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3 mt-2">
                      {items.map((item) => (
                        <div
                          key={`${item.productId}:${item.variantId ?? ''}`}
                          className="flex items-start gap-3 sm:gap-4 rounded-[18px] border border-[#001161]/8 p-3 sm:p-4"
                        >
                          <BookCoverThumb imageUrl={item.imageUrl} alt={item.productName} size="md" />
                          <div className="min-w-0 flex-1 flex flex-col gap-2.5 pt-0.5">
                            <div>
                              <p className="font-['Fenomen_Sans',sans-serif] text-[15px] font-bold text-[#001161] leading-snug">
                                {item.productName}
                              </p>
                              {item.variantName && (
                                <p className="font-['Fenomen_Sans',sans-serif] text-[13px] text-[#001161]/50 mt-0.5">
                                  {item.variantName}
                                </p>
                              )}
                              <p className="font-['Fenomen_Sans',sans-serif] text-[12px] text-[#001161]/45 mt-1">
                                {`${formatPrice(item.unitPrice)} za ks`}
                              </p>
                            </div>
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <div className="flex items-center gap-1 bg-[#f1f3f8] rounded-[12px] p-1">
                                <button
                                  type="button"
                                  onClick={() => updateQuantity(item.productId, item.variantId, item.quantity - 1)}
                                  className="w-8 h-8 flex items-center justify-center rounded-[10px] hover:bg-white transition-colors text-[#001161] cursor-pointer"
                                  aria-label="Snížit počet"
                                >
                                  <Minus className="w-4 h-4" />
                                </button>
                                <span className="font-['Fenomen_Sans',sans-serif] text-[14px] font-bold text-[#001161] min-w-[1.75rem] text-center select-none">
                                  {item.quantity}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => updateQuantity(item.productId, item.variantId, item.quantity + 1)}
                                  className="w-8 h-8 flex items-center justify-center rounded-[10px] hover:bg-white transition-colors text-[#001161] cursor-pointer"
                                  aria-label="Zvýšit počet"
                                >
                                  <Plus className="w-4 h-4" />
                                </button>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <span className="font-['Fenomen_Sans',sans-serif] text-[15px] font-bold text-[#001161]">
                                  {formatPrice(item.unitPrice * item.quantity)}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => removeItem(item.productId, item.variantId, item.bundleInstanceId)}
                                  className="w-8 h-8 flex items-center justify-center rounded-[10px] text-[#001161]/35 hover:text-red-600 hover:bg-red-50 transition-all cursor-pointer"
                                  aria-label="Odebrat z košíku"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
            {currentStep === 1 && items.length > 0 && (
              <>
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
                    disabled={!canGoForward || currentStep >= 4}
                    className="inline-flex items-center gap-2 px-5 py-3 rounded-[14px] bg-[#001161] text-white font-['Fenomen_Sans',sans-serif] text-[14px] font-bold disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                  >
                    {'Pokračovat'}
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
                <InternalCartUpsellSection cartItems={items} openCartAfterAdd={false} />
              </>
            )}

            {currentStep === 2 && (
              <div className="rounded-[24px] border border-[#001161]/10 bg-white p-6 md:p-8">
                <h2 className="font-['Cooper_Light',serif] text-[#001161] text-[30px] leading-tight mb-6">
                  {'Údaje'}
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
                  {[
                    {
                      id: 'school',
                      label: 'Nakupuji jako škola',
                      description: 'IČO, škola a fakturační údaje organizace',
                      imageSrc: '/checkout/customer-school.png',
                      imageAlt: 'Škola',
                    },
                    {
                      id: 'individual',
                      label: 'Nakupuji jako jednotlivec',
                      description: 'Osobní nákup bez školních údajů',
                      imageSrc: '/checkout/customer-individual.png',
                      imageAlt: 'Rodič a dítě',
                    },
                  ].map((option) => {
                    const isActive = customerType === option.id;

                    return (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => handleCustomerTypeChange(option.id as CustomerType)}
                        className={`relative rounded-[18px] border px-5 pt-4 pb-0 text-left transition-all overflow-hidden min-h-[132px] ${
                          isActive
                            ? 'border-[#001161] bg-[#f8f9fc] shadow-[0_12px_30px_rgba(0,17,97,0.08)]'
                            : 'border-[#001161]/10 bg-white hover:border-[#001161]/20'
                        }`}
                      >
                        <div className="min-h-[116px] pr-[140px] pb-4">
                          <div className="min-w-0">
                            <p className="font-['Fenomen_Sans',sans-serif] text-[14px] font-bold text-[#001161]">
                              {option.label}
                            </p>
                            <p className="font-['Fenomen_Sans',sans-serif] text-[12px] text-[#001161]/50 mt-1">
                              {option.description}
                            </p>
                          </div>
                        </div>
                        <div
                          className={`absolute right-5 bottom-0 shrink-0 transition-all duration-200 origin-bottom ${isActive ? 'scale-110' : 'scale-90 opacity-85'}`}
                        >
                          <img
                            src={option.imageSrc}
                            alt={option.imageAlt}
                            className={`block object-contain object-bottom ${option.id === 'school' ? 'w-[106px] h-[106px]' : 'w-[110px] h-[110px]'}`}
                          />
                        </div>
                      </button>
                    );
                  })}
                </div>

                {customerType === 'school' && (
                  <div className="rounded-[20px] bg-[#f8f9fc] p-5 mb-6">
                    <p className="font-['Fenomen_Sans',sans-serif] text-[12px] uppercase tracking-[0.15em] text-[#001161]/40 mb-4">
                      {'Informace o škole'}
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <label id="checkout-field-schoolName" className="block md:col-span-2">
                        <span className="block font-['Fenomen_Sans',sans-serif] text-[13px] font-bold text-[#001161] mb-2">
                          {'Název školy *'}
                        </span>
                        <div ref={schoolSearchRef} className="relative">
                          <input
                            type="text"
                            value={schoolQuery}
                            onChange={(event) => {
                              const value = event.target.value;
                              setSchoolQuery(value);
                              handleCustomerChange('schoolName', value);
                            }}
                            onFocus={() => {
                              if (schoolResults.length > 0) setIsSchoolResultsOpen(true);
                            }}
                            placeholder="Začněte psát název školy"
                            className="w-full rounded-[14px] border border-[#001161]/10 bg-white px-4 py-3 pr-11 text-[14px] text-[#001161] outline-none focus:border-[#5b4fd8] focus:ring-2 focus:ring-[#5b4fd8]/15"
                            autoComplete="off"
                          />
                          <div className="absolute right-4 top-1/2 -translate-y-1/2 text-[#001161]/30 pointer-events-none">
                            {schoolSearchLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                          </div>

                          {isSchoolResultsOpen && schoolResults.length > 0 && (
                            <div className="absolute z-20 mt-2 w-full overflow-hidden rounded-[18px] border border-[#001161]/10 bg-white shadow-xl">
                              <div className="max-h-[260px] overflow-y-auto py-1">
                                {schoolResults.map((school, index) => (
                                  <button
                                    key={`${school.ico}-${index}`}
                                    type="button"
                                    onClick={() => handleSchoolSelect(school)}
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
                        {formErrors.schoolName && (
                          <span className="block mt-2 font-['Fenomen_Sans',sans-serif] text-[12px] text-[#dc2626]">
                            {formErrors.schoolName}
                          </span>
                        )}
                      </label>

                      <label id="checkout-field-ico" className="block">
                        <span className="block font-['Fenomen_Sans',sans-serif] text-[13px] font-bold text-[#001161] mb-2">
                          {'IČO školy *'}
                        </span>
                        <div className="relative">
                          <input
                            type="text"
                            inputMode="numeric"
                            maxLength={10}
                            value={customer.ico}
                            onChange={(event) => handleCustomerChange('ico', event.target.value.replace(/\D/g, '').slice(0, 10))}
                            className="w-full rounded-[14px] border border-[#001161]/10 bg-white px-4 py-3 pr-11 text-[14px] text-[#001161] outline-none focus:border-[#5b4fd8] focus:ring-2 focus:ring-[#5b4fd8]/15"
                          />
                          <div className="absolute right-4 top-1/2 -translate-y-1/2 text-[#001161]/30 pointer-events-none">
                            {schoolLookupLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                          </div>
                        </div>
                        {formErrors.ico && (
                          <span className="block mt-2 font-['Fenomen_Sans',sans-serif] text-[12px] text-[#dc2626]">
                            {formErrors.ico}
                          </span>
                        )}
                      </label>

                      <div className="rounded-[14px] border border-[#001161]/10 bg-white px-4 py-3 flex items-center">
                        <p className="font-['Fenomen_Sans',sans-serif] text-[13px] text-[#001161]/55">
                          {'Po výběru školy se zkusí předvyplnit adresa. Údaje pak můžete ručně upravit.'}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[
                    { key: 'name', label: 'Jméno *' },
                    { key: 'email', label: 'E-mail *', type: 'email' },
                    { key: 'phone', label: 'Telefon *' },
                    { key: 'street', label: 'Ulice a číslo *' },
                    { key: 'city', label: 'Město *' },
                    { key: 'zip', label: 'PSČ *' },
                  ].map((field) => (
                    <label key={field.key} id={`checkout-field-${field.key}`} className="block">
                      <span className="block font-['Fenomen_Sans',sans-serif] text-[13px] font-bold text-[#001161] mb-2">
                        {field.label}
                      </span>
                      <input
                        type={field.type ?? 'text'}
                        value={customer[field.key as keyof CustomerFormState]}
                        onChange={(event) => handleCustomerChange(field.key as keyof CustomerFormState, event.target.value)}
                        className="w-full rounded-[14px] border border-[#001161]/10 bg-white px-4 py-3 text-[14px] text-[#001161] outline-none focus:border-[#5b4fd8] focus:ring-2 focus:ring-[#5b4fd8]/15"
                      />
                      {formErrors[field.key as keyof CustomerFormState] && (
                        <span className="block mt-2 font-['Fenomen_Sans',sans-serif] text-[12px] text-[#dc2626]">
                          {formErrors[field.key as keyof CustomerFormState]}
                        </span>
                      )}
                    </label>
                  ))}
                </div>

                <div className="mt-6 rounded-[20px] border border-[#001161]/10 bg-white p-5">
                  <button
                    type="button"
                    onClick={handleSeparateDeliveryToggle}
                    className="w-full flex items-center justify-between gap-4 text-left cursor-pointer rounded-[16px] border border-[#001161]/10 bg-[#f8f9fc] px-4 py-4"
                  >
                    <div className="flex items-start gap-3">
                      <span className={`inline-flex items-center justify-center w-11 h-11 rounded-[14px] ${
                        hasSeparateDeliveryAddress ? 'bg-[#001161] text-white' : 'bg-white text-[#001161]'
                      }`}>
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

                    <span className={`relative inline-flex h-7 w-12 rounded-full transition-colors ${
                      hasSeparateDeliveryAddress ? 'bg-[#001161]' : 'bg-[#001161]/15'
                    }`}>
                      <span className={`absolute top-1 left-1 h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
                        hasSeparateDeliveryAddress ? 'translate-x-5' : 'translate-x-0'
                      }`} />
                    </span>
                  </button>

                  {hasSeparateDeliveryAddress && (
                    <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
                      {[
                        { key: 'recipientName', label: 'Jméno a příjmení příjemce', placeholder: 'Např. Jan Novák' },
                        { key: 'deliveryStreet', label: 'Doručovací ulice a číslo *' },
                        { key: 'deliveryCity', label: 'Doručovací město *' },
                        { key: 'deliveryZip', label: 'Doručovací PSČ *' },
                      ].map((field) => {
                        return (
                          <label key={field.key} id={`checkout-field-${field.key}`} className="block">
                            <span className="block font-['Fenomen_Sans',sans-serif] text-[13px] font-bold text-[#001161] mb-2">
                              {field.label}
                            </span>
                            <input
                              type="text"
                              value={deliveryAddress[field.key as keyof DeliveryAddressState]}
                              onChange={(event) => handleDeliveryAddressChange(field.key as keyof DeliveryAddressState, event.target.value)}
                              placeholder={field.placeholder}
                              className="w-full rounded-[14px] border border-[#001161]/10 bg-white px-4 py-3 text-[14px] text-[#001161] outline-none focus:border-[#5b4fd8] focus:ring-2 focus:ring-[#5b4fd8]/15"
                            />
                            {formErrors[field.key as keyof DeliveryAddressState] && (
                              <span className="block mt-2 font-['Fenomen_Sans',sans-serif] text-[12px] text-[#dc2626]">
                                {formErrors[field.key as keyof DeliveryAddressState]}
                              </span>
                            )}
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}

            {currentStep === 3 && (
              <div className="rounded-[24px] border border-[#001161]/10 bg-white p-6 md:p-8">
                <h2 className="font-['Cooper_Light',serif] text-[#001161] text-[30px] leading-tight mb-6">
                  {'Doprava'}
                </h2>
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
                          name="shipping-method"
                          checked={shipping.method === option.id}
                          onChange={() => handleShippingMethodChange(option.id)}
                        />
                        <div>
                          <p className="font-['Fenomen_Sans',sans-serif] text-[14px] font-bold text-[#001161]">
                            {option.label}
                          </p>
                          <p className="font-['Fenomen_Sans',sans-serif] text-[13px] text-[#001161]/55">
                            {formatPrice(option.price)}
                          </p>
                        </div>
                      </div>
                      <Truck className="w-5 h-5 text-[#001161]/30" />
                    </label>
                  ))}
                </div>

                {shipping.method === 'zasilkovna' && (
                  <div id="checkout-field-shipping-pickup" className="mt-6 rounded-[20px] bg-[#f8f9fc] p-5">
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
                        onClick={handlePacketaPick}
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
                      <p className="mt-3 font-['Fenomen_Sans',sans-serif] text-[12px] text-[#dc2626]">
                        {packetaError}
                      </p>
                    )}
                    {formErrors.shipping && (
                      <p className="mt-3 font-['Fenomen_Sans',sans-serif] text-[12px] text-[#dc2626]">
                        {formErrors.shipping}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            {currentStep === 4 && (
              <PaymentMethodSection
                description="Platba probíhá přes Stripe Payment Element."
                options={PAYMENT_OPTIONS}
                selectedId="card"
                isOptionDisabled={(id) => id === 'transfer' || (id !== 'card' && isDesktopPaymentView)}
              >
                <>
                  {!stripePublishableKey && (
                    <p className="font-['Fenomen_Sans',sans-serif] text-[13px] text-[#dc2626]">
                      {'Chybí VITE_STRIPE_PUBLISHABLE_KEY.'}
                    </p>
                  )}

                  {resumeLoading && (
                    <div className="inline-flex items-center gap-2 rounded-full bg-[#f8f9fc] px-4 py-2 font-['Fenomen_Sans',sans-serif] text-[13px] text-[#001161]/65 mb-4">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      {'Načítám odkaz k platbě...'}
                    </div>
                  )}

                  {resumeFlowActive && resumedOrderNumber && (
                    <p className="mb-4 font-['Fenomen_Sans',sans-serif] text-[14px] text-[#001161]/80">
                      {`Dokončujete platbu objednávky ${resumedOrderNumber}.`}
                    </p>
                  )}

                  {paymentIntentLoading && (
                    <div className="inline-flex items-center gap-2 rounded-full bg-[#f8f9fc] px-4 py-2 font-['Fenomen_Sans',sans-serif] text-[13px] text-[#001161]/65 mb-4">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      {'Připravuji platební formulář...'}
                    </div>
                  )}

                  {paymentIntentError && (
                    <p className="mb-4 font-['Fenomen_Sans',sans-serif] text-[13px] text-[#dc2626]">
                      {paymentIntentError}
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
                        total={summaryTotal}
                        onError={setPaymentIntentError}
                      />
                    </Elements>
                  )}

                  {paymentIntentId && (
                    <p className="mt-4 font-['Fenomen_Sans',sans-serif] text-[12px] text-[#001161]/45">
                      {`PaymentIntent: ${paymentIntentId}`}
                    </p>
                  )}
                </>
              </PaymentMethodSection>
            )}

            {currentStep === 5 && (
              <PlaceholderSection
                title="Potvrzení"
                text="Potvrzení nyní probíhá na samostatné stránce po návratu ze Stripe."
              />
            )}

            {!(currentStep === 1 && items.length > 0) && (
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
                  disabled={!canGoForward || currentStep >= 4}
                  className="inline-flex items-center gap-2 px-5 py-3 rounded-[14px] bg-[#001161] text-white font-['Fenomen_Sans',sans-serif] text-[14px] font-bold disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  {'Pokračovat'}
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
        </div>
      </div>
    </div>
  );
}
