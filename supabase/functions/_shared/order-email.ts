import type postgres from 'npm:postgres';
import { computeOrderTrackingToken } from './order-tracking-token.ts';
import { EMAIL_FORCE_LIGHT_HEAD } from './email-force-light.ts';
import {
  VB_EMAIL_NAVY,
  buildVividbooksBrandCta,
  buildVividbooksBrandShell,
} from './email-brand-shell.ts';

export type OrderEmailType =
  | 'order_confirmed'
  | 'order_shipped'
  | 'order_cancelled'
  | 'payment_reminder'
  | 'order_transfer_received'
  | 'order_auto_cancelled_unpaid'
  | 'distributor_order_received';

type OrderRow = {
  id: string;
  order_number: string;
  status: string;
  customer_email: string;
  customer_name: string;
  customer_phone: string | null;
  school_name: string | null;
  ico: string | null;
  street: string | null;
  city: string | null;
  zip: string | null;
  note: string | null;
  shipping_method: string;
  shipping_price: number;
  pickup_point_name: string | null;
  tracking_number: string | null;
  payment_method: string;
  total: number;
  cancelled_reason: string | null;
  payment_resume_token: string | null;
  stripe_receipt_url: string | null;
  /** NULL = běžná objednávka; pending|done = objednávka jen z plakátů (tisk na zakázku). */
  poster_fulfillment_status: string | null;
};

type OrderItemRow = {
  product_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
};

function formatPrice(amountInHaler: number) {
  return `${(amountInHaler / 100).toLocaleString('cs-CZ', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} Kč`;
}

function escapeHtml(value: string | null | undefined) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function shippingLabel(method: string) {
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
      return method;
  }
}

function parseFromHeader(value: string | undefined) {
  const fallback = {
    email: 'objednavky@vividbooks.com',
    name: 'VividBooks',
  };

  if (!value) return fallback;

  const match = value.match(/^\s*(.*?)\s*<([^>]+)>\s*$/);
  if (match) {
    return {
      name: match[1] || fallback.name,
      email: match[2] || fallback.email,
    };
  }

  return {
    email: value,
    name: Deno.env.get('EMAIL_FROM_NAME') || fallback.name,
  };
}

function getReplyToAddress() {
  return Deno.env.get('EMAIL_REPLY_TO') || 'hello@vividbooks.com';
}

function getPublicSiteUrl() {
  const raw = (Deno.env.get('PUBLIC_SITE_URL') || Deno.env.get('SITE_URL') || '').trim();
  if (raw) return raw.replace(/\/$/, '');
  return 'https://vividbooks.com';
}

/**
 * Kořen URL, kde je nasazený React e-shop (pokladna, /platit, sledování objednávky).
 * Když hlavní doména (PUBLIC_SITE_URL) vede na Webflow bez SPA, nastavte v Supabase secrets
 * např. PUBLIC_ESHOP_URL = https://<user>.github.io/VIVIDBOOKS_WEB_ESHOP nebo URL, kde běží Vite build.
 */
function getPublicEshopBaseUrl(): string {
  const raw = (Deno.env.get('PUBLIC_ESHOP_URL') || Deno.env.get('PUBLIC_SITE_URL') || Deno.env.get('SITE_URL') || '').trim();
  if (raw) return raw.replace(/\/$/, '');
  return 'https://vividbooks.com';
}

async function buildPublicOrderTrackingUrl(orderId: string, orderNumber: string, params?: {
  paymentMethod?: string;
  status?: string;
}): Promise<string | null> {
  const secret = (Deno.env.get('ORDER_TRACKING_HMAC_SECRET') || '').trim();
  if (!secret) return null;
  try {
    const token = await computeOrderTrackingToken(orderId, secret);
    const site = getPublicEshopBaseUrl().replace(/\/$/, '');
    const u = new URL('objednavka/sledovani', `${site}/`);
    u.searchParams.set('order', orderNumber);
    u.searchParams.set('t', token);
    if (
      params?.paymentMethod === 'transfer'
      && params?.status === 'pending_payment'
    ) {
      u.searchParams.set('transfer', '1');
    }
    return u.toString();
  } catch {
    return null;
  }
}

function buildShell(title: string, content: string, headerSubtitle = 'Objednávka') {
  return buildVividbooksBrandShell({
    title,
    headerSubtitle,
    content,
    headExtra: EMAIL_FORCE_LIGHT_HEAD,
  });
}

const H1 =
  `margin:0 0 12px;font-size:26px;font-weight:800;line-height:1.25;color:${VB_EMAIL_NAVY};`;
const P = 'margin:0 0 16px;font-size:15px;line-height:1.65;color:#4a5568;';
const LINK = `color:${VB_EMAIL_NAVY};font-weight:700;text-decoration:underline;`;

function buildOrderItemsTable(items: OrderItemRow[]) {
  const rows = items.map((item) => `
    <tr>
      <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;font-size:14px;color:#111827;">${escapeHtml(item.product_name)}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;font-size:14px;color:#111827;text-align:center;">${item.quantity}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;font-size:14px;color:#111827;text-align:right;">${formatPrice(item.unit_price)}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;font-size:14px;color:#111827;text-align:right;">${formatPrice(item.total_price)}</td>
    </tr>
  `).join('');

  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:20px 0;border:1px solid #edf2f7;border-radius:14px;overflow:hidden;">
      <tr>
        <td style="padding:10px 12px;background:#EEF2FF;font-size:11px;font-weight:700;color:${VB_EMAIL_NAVY};text-transform:uppercase;letter-spacing:0.04em;">Položka</td>
        <td style="padding:10px 12px;background:#EEF2FF;font-size:11px;font-weight:700;color:${VB_EMAIL_NAVY};text-transform:uppercase;letter-spacing:0.04em;text-align:center;">Ks</td>
        <td style="padding:10px 12px;background:#EEF2FF;font-size:11px;font-weight:700;color:${VB_EMAIL_NAVY};text-transform:uppercase;letter-spacing:0.04em;text-align:right;">Cena za kus</td>
        <td style="padding:10px 12px;background:#EEF2FF;font-size:11px;font-weight:700;color:${VB_EMAIL_NAVY};text-transform:uppercase;letter-spacing:0.04em;text-align:right;">Celkem</td>
      </tr>
      ${rows}
    </table>
  `;
}

/** Distributorské shrnutí — bez cen (ceny a dopravu řeší obchodní zástupce). */
function buildDistributorItemsTable(items: OrderItemRow[]) {
  const rows = items.map((item) => `
    <tr>
      <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;font-size:14px;color:#111827;">${escapeHtml(item.product_name)}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;font-size:14px;color:#111827;text-align:right;">${item.quantity}&nbsp;ks</td>
    </tr>
  `).join('');

  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:20px 0;border:1px solid #edf2f7;border-radius:14px;overflow:hidden;">
      <tr>
        <td style="padding:10px 12px;background:#EEF2FF;font-size:11px;font-weight:700;color:${VB_EMAIL_NAVY};text-transform:uppercase;letter-spacing:0.04em;">Produkt</td>
        <td style="padding:10px 12px;background:#EEF2FF;font-size:11px;font-weight:700;color:${VB_EMAIL_NAVY};text-transform:uppercase;letter-spacing:0.04em;text-align:right;">Počet</td>
      </tr>
      ${rows}
    </table>
  `;
}

function buildDistributorOrderReceivedHtml(order: OrderRow, items: OrderItemRow[]) {
  const company = String(order.school_name || order.customer_name || '').trim();
  const ico = String(order.ico || '').trim();
  const phone = String(order.customer_phone || '').trim();
  const note = String(order.note || '').trim();
  const totalPieces = items.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
  const noteHtml = note
    ? escapeHtml(note).replace(/\r\n/g, '\n').replace(/\n/g, '<br/>')
    : '';

  return buildShell(
    `Shrnutí objednávky ${order.order_number} — Vividbooks`,
    `
      <h1 style="${H1}">Děkujeme za objednávku</h1>
      <p style="${P}">
        Evidujeme vaši distributorskou objednávku
        <strong style="color:${VB_EMAIL_NAVY};">${escapeHtml(order.order_number)}</strong>.
        Ozve se vám obchodní zástupce Vividbooks a dořeší ceny, dopravu i další detaily.
      </p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 8px;">
        ${company ? `<tr><td style="padding:6px 0;font-size:15px;color:#4a5568;width:140px;">Společnost:</td><td style="padding:6px 0;font-size:15px;color:${VB_EMAIL_NAVY};"><strong>${escapeHtml(company)}</strong></td></tr>` : ''}
        ${ico ? `<tr><td style="padding:6px 0;font-size:15px;color:#4a5568;">IČO:</td><td style="padding:6px 0;font-size:15px;color:${VB_EMAIL_NAVY};">${escapeHtml(ico)}</td></tr>` : ''}
        <tr><td style="padding:6px 0;font-size:15px;color:#4a5568;">E-mail:</td><td style="padding:6px 0;font-size:15px;color:${VB_EMAIL_NAVY};">${escapeHtml(order.customer_email)}</td></tr>
        ${phone ? `<tr><td style="padding:6px 0;font-size:15px;color:#4a5568;">Telefon:</td><td style="padding:6px 0;font-size:15px;color:${VB_EMAIL_NAVY};">${escapeHtml(phone)}</td></tr>` : ''}
      </table>
      ${buildDistributorItemsTable(items)}
      <p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:${VB_EMAIL_NAVY};">
        <strong>Celkem ${items.length} ${items.length === 1 ? 'titul' : items.length >= 2 && items.length <= 4 ? 'tituly' : 'titulů'}</strong>
        · ${totalPieces}&nbsp;ks
      </p>
      ${noteHtml ? `
        <p style="margin:0 0 6px;font-size:15px;line-height:1.65;color:#4a5568;"><strong style="color:${VB_EMAIL_NAVY};">Poznámka k objednávce:</strong></p>
        <p style="margin:0;font-size:15px;line-height:1.65;color:#1a1a22;">${noteHtml}</p>
      ` : ''}
    `,
    'Distribuční objednávka',
  );
}

function buildOrderConfirmedHtml(order: OrderRow, items: OrderItemRow[], trackingUrl: string | null) {
  const cardLike = ['card', 'apple_pay', 'google_pay'].includes(order.payment_method);
  const receiptBlock = cardLike
    ? `<p style="margin:16px 0 0;font-size:15px;line-height:1.65;color:#4a5568;">
        Daňový doklad o zaplacení vám zašle e-mailem <strong style="color:${VB_EMAIL_NAVY};">iDoklad</strong> (obvykle během několika minut po zpracování platby).
      </p>`
    : order.stripe_receipt_url
    ? `<p style="margin:16px 0 0;font-size:15px;line-height:1.65;color:#4a5568;">
        Vaše účtenka Stripe:
        <a href="${escapeHtml(order.stripe_receipt_url)}" style="${LINK}">Zobrazit účtenku</a>
      </p>`
    : '';

  const trackingBlock = trackingUrl
    ? `<p style="margin:20px 0 0;">${buildVividbooksBrandCta(trackingUrl, 'Sledovat objednávku')}</p>`
    : '';

  return buildShell(
    `Potvrzení objednávky ${order.order_number} — Vividbooks`,
    `
      <h1 style="${H1}">Děkujeme za objednávku!</h1>
      <p style="${P}">Číslo objednávky: <strong style="color:${VB_EMAIL_NAVY};">${escapeHtml(order.order_number)}</strong></p>
      ${receiptBlock}
      ${trackingBlock}
      ${buildOrderItemsTable(items)}
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0;">
        <tr>
          <td style="padding:8px 0;font-size:15px;color:#4a5568;">Doprava:</td>
          <td style="padding:8px 0;font-size:15px;color:${VB_EMAIL_NAVY};text-align:right;"><strong>${escapeHtml(shippingLabel(order.shipping_method))}</strong> — ${formatPrice(order.shipping_price)}</td>
        </tr>
        ${order.pickup_point_name ? `<tr><td style="padding:8px 0;font-size:15px;color:#4a5568;">Výdejní místo:</td><td style="padding:8px 0;font-size:15px;color:${VB_EMAIL_NAVY};text-align:right;">${escapeHtml(order.pickup_point_name)}</td></tr>` : ''}
        <tr>
          <td style="padding:12px 0 0;font-size:17px;color:${VB_EMAIL_NAVY};"><strong>Celkem</strong></td>
          <td style="padding:12px 0 0;font-size:17px;color:${VB_EMAIL_NAVY};text-align:right;"><strong>${formatPrice(order.total)}</strong></td>
        </tr>
      </table>
      <p style="margin:20px 0 0;font-size:15px;line-height:1.65;color:#4a5568;">
        Vaši objednávku nyní zpracováváme a brzy ji předáme k odeslání.
      </p>
    `,
    'Potvrzení objednávky',
  );
}

function isPosterOrder(order: OrderRow) {
  return order.poster_fulfillment_status != null;
}

function formatDeliveryAddress(order: OrderRow) {
  const line1 = String(order.street || '').trim();
  const line2 = [String(order.zip || '').trim(), String(order.city || '').trim()].filter(Boolean).join(' ');
  return [line1, line2].filter(Boolean).join(', ');
}

/** Blok „kam plakáty pošleme" — u Zásilkovny výdejní místo, jinak doručovací adresa. */
function buildPosterDeliveryBlock(order: OrderRow) {
  const address = formatDeliveryAddress(order);
  const pickup = String(order.pickup_point_name || '').trim();
  const rows: string[] = [];
  rows.push(`<tr><td style="padding:6px 0;font-size:15px;color:#4a5568;width:150px;">Jméno:</td><td style="padding:6px 0;font-size:15px;color:${VB_EMAIL_NAVY};"><strong>${escapeHtml(order.customer_name)}</strong></td></tr>`);
  if (order.shipping_method === 'zasilkovna' && pickup) {
    rows.push(`<tr><td style="padding:6px 0;font-size:15px;color:#4a5568;">Výdejní místo:</td><td style="padding:6px 0;font-size:15px;color:${VB_EMAIL_NAVY};"><strong>${escapeHtml(pickup)}</strong></td></tr>`);
    if (address) {
      rows.push(`<tr><td style="padding:6px 0;font-size:15px;color:#4a5568;">Adresa:</td><td style="padding:6px 0;font-size:15px;color:${VB_EMAIL_NAVY};">${escapeHtml(address)}</td></tr>`);
    }
  } else if (address) {
    rows.push(`<tr><td style="padding:6px 0;font-size:15px;color:#4a5568;">Doručovací adresa:</td><td style="padding:6px 0;font-size:15px;color:${VB_EMAIL_NAVY};"><strong>${escapeHtml(address)}</strong></td></tr>`);
  }
  rows.push(`<tr><td style="padding:6px 0;font-size:15px;color:#4a5568;">Doprava:</td><td style="padding:6px 0;font-size:15px;color:${VB_EMAIL_NAVY};">${escapeHtml(shippingLabel(order.shipping_method))} — ${formatPrice(order.shipping_price)}</td></tr>`);
  if (order.customer_phone) {
    rows.push(`<tr><td style="padding:6px 0;font-size:15px;color:#4a5568;">Telefon:</td><td style="padding:6px 0;font-size:15px;color:${VB_EMAIL_NAVY};">${escapeHtml(order.customer_phone)}</td></tr>`);
  }
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 8px;background:#f5f6fa;border-radius:14px;">
      <tr><td style="padding:16px 18px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows.join('')}</table>
      </td></tr>
    </table>
  `;
}

/**
 * Potvrzení objednávky plakátů — tisk na zakázku, zákazníka prosíme o kontrolu doručovacích údajů.
 * Plakáty nejdou přes Base.com, balí je Vividbooks ručně, proto se liší od běžného potvrzení.
 */
export function buildPosterOrderConfirmedHtml(order: OrderRow, items: OrderItemRow[], trackingUrl: string | null) {
  const cardLike = ['card', 'apple_pay', 'google_pay'].includes(order.payment_method);
  const receiptBlock = cardLike
    ? `<p style="margin:16px 0 0;font-size:15px;line-height:1.65;color:#4a5568;">
        Daňový doklad o zaplacení vám zašle e-mailem <strong style="color:${VB_EMAIL_NAVY};">iDoklad</strong> (obvykle během několika minut po zpracování platby).
      </p>`
    : '';
  const trackingBlock = trackingUrl
    ? `<p style="margin:20px 0 0;">${buildVividbooksBrandCta(trackingUrl, 'Sledovat objednávku')}</p>`
    : '';
  const replyTo = getReplyToAddress();

  return buildShell(
    `Potvrzení objednávky ${order.order_number} — plakáty Vividbooks`,
    `
      <h1 style="${H1}">Děkujeme, plakáty jdou do výroby!</h1>
      <p style="${P}">
        Máme vaši objednávku <strong style="color:${VB_EMAIL_NAVY};">${escapeHtml(order.order_number)}</strong> a platba v pořádku dorazila.
        Plakáty tiskneme na zakázku, takže odeslání trvá o něco déle než u skladových položek.
        Jakmile budou vytištěné a předáme je dopravci, pošleme vám další e-mail s informací o zásilce.
      </p>
      ${receiptBlock}
      ${trackingBlock}
      ${buildOrderItemsTable(items)}
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;">
        <tr>
          <td style="padding:4px 0;font-size:17px;color:${VB_EMAIL_NAVY};"><strong>Celkem</strong></td>
          <td style="padding:4px 0;font-size:17px;color:${VB_EMAIL_NAVY};text-align:right;"><strong>${formatPrice(order.total)}</strong></td>
        </tr>
      </table>
      <h2 style="margin:0 0 10px;font-size:18px;font-weight:800;line-height:1.3;color:${VB_EMAIL_NAVY};">Prosíme o kontrolu, kam plakáty poslat</h2>
      <p style="${P}">
        Plakáty balíme ručně a posíláme jen jednou, proto si chceme být jistí, že dorazí na správné místo.
        Zkontrolujte prosím údaje níže:
      </p>
      ${buildPosterDeliveryBlock(order)}
      <p style="margin:16px 0 0;font-size:15px;line-height:1.65;color:#4a5568;">
        Pokud je vše v pořádku, nemusíte nic dělat. Pokud chcete adresu nebo výdejní místo změnit, stačí odpovědět na tento e-mail
        (nebo napsat na <a href="mailto:${escapeHtml(replyTo)}" style="${LINK}">${escapeHtml(replyTo)}</a>) — ideálně do 2 pracovních dnů, než plakáty zabalíme.
      </p>
    `,
    'Objednávka plakátů',
  );
}

function getPosterOrderNotifyRecipients(): string[] {
  const raw = (Deno.env.get('POSTER_ORDER_NOTIFY_EMAIL') || 'vitek@vividbooks.com').trim();
  return raw.split(/[,;\s]+/).map((e) => e.trim()).filter((e) => e.includes('@'));
}

function getAdminOrderUrl(orderId: string) {
  return `${getPublicSiteUrl()}/admin/objednavky/${orderId}`;
}

/** Interní upozornění pro Vividbooks: přišla nová (zaplacená) objednávka plakátů. */
export function buildPosterOrderAdminNotificationHtml(order: OrderRow, items: OrderItemRow[]) {
  const note = String(order.note || '').trim();
  const adminUrl = getAdminOrderUrl(order.id);
  const totalPieces = items.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
  return buildShell(
    `Nová objednávka plakátů ${order.order_number}`,
    `
      <h1 style="${H1}">Nová objednávka plakátů</h1>
      <p style="${P}">
        Zaplacená objednávka <strong style="color:${VB_EMAIL_NAVY};">${escapeHtml(order.order_number)}</strong>
        — ${totalPieces}&nbsp;ks, celkem <strong style="color:${VB_EMAIL_NAVY};">${formatPrice(order.total)}</strong>.
        Zákazník dostal potvrzení s prosbou o kontrolu adresy.
      </p>
      <p style="margin:0 0 20px;">${buildVividbooksBrandCta(adminUrl, 'Otevřít v adminu')}</p>
      ${buildOrderItemsTable(items)}
      ${buildPosterDeliveryBlock(order)}
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:12px 0 0;">
        <tr><td style="padding:6px 0;font-size:15px;color:#4a5568;width:150px;">E-mail:</td><td style="padding:6px 0;font-size:15px;color:${VB_EMAIL_NAVY};"><a href="mailto:${escapeHtml(order.customer_email)}" style="${LINK}">${escapeHtml(order.customer_email)}</a></td></tr>
        ${order.school_name ? `<tr><td style="padding:6px 0;font-size:15px;color:#4a5568;">Škola:</td><td style="padding:6px 0;font-size:15px;color:${VB_EMAIL_NAVY};">${escapeHtml(order.school_name)}</td></tr>` : ''}
        ${order.ico ? `<tr><td style="padding:6px 0;font-size:15px;color:#4a5568;">IČO:</td><td style="padding:6px 0;font-size:15px;color:${VB_EMAIL_NAVY};">${escapeHtml(order.ico)}</td></tr>` : ''}
        <tr><td style="padding:6px 0;font-size:15px;color:#4a5568;">Platba:</td><td style="padding:6px 0;font-size:15px;color:${VB_EMAIL_NAVY};">${escapeHtml(order.payment_method)}</td></tr>
      </table>
      ${note ? `
        <p style="margin:16px 0 6px;font-size:15px;line-height:1.65;color:#4a5568;"><strong style="color:${VB_EMAIL_NAVY};">Poznámka zákazníka:</strong></p>
        <p style="margin:0;font-size:15px;line-height:1.65;color:#1a1a22;">${escapeHtml(note).replace(/\r\n/g, '\n').replace(/\n/g, '<br/>')}</p>
      ` : ''}
    `,
    'Interní upozornění',
  );
}

async function sendMandrillMessage(params: {
  mandrillKey: string;
  from: { email: string; name: string };
  to: { email: string; name?: string }[];
  subject: string;
  html: string;
  replyTo: string;
}) {
  const response = await fetch('https://mandrillapp.com/api/1.0/messages/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      key: params.mandrillKey,
      message: {
        html: params.html,
        subject: params.subject,
        from_email: params.from.email,
        from_name: params.from.name,
        to: params.to.map((t) => ({ email: t.email, name: t.name, type: 'to' })),
        headers: { 'Reply-To': params.replyTo },
        track_opens: true,
        track_clicks: false,
      },
    }),
  });

  const result = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(`Mandrill HTTP ${response.status}`);
  }

  if (!Array.isArray(result) || !['sent', 'queued', 'scheduled'].includes(result[0]?.status)) {
    throw new Error(`Mandrill send failed: ${JSON.stringify(result).slice(0, 400)}`);
  }
}

/**
 * Interní notifikace o nové objednávce plakátů (POSTER_ORDER_NOTIFY_EMAIL, default vitek@vividbooks.com).
 * Volá se po odeslání potvrzení zákazníkovi; chyba nesmí shodit zákaznický e-mail — volající ji jen zaloguje.
 */
export async function sendPosterOrderAdminNotification(sql: postgres.Sql, orderId: string) {
  const mandrillKey = Deno.env.get('MANDRILL_API_KEY');
  if (!mandrillKey) {
    throw new Error('Missing MANDRILL_API_KEY.');
  }
  const { order, items } = await loadOrderEmailData(sql, orderId);
  if (!isPosterOrder(order)) {
    return { sent: false as const, reason: 'not_poster_order' as const };
  }
  const recipients = getPosterOrderNotifyRecipients();
  if (recipients.length === 0) {
    return { sent: false as const, reason: 'no_recipients' as const };
  }
  const subject = `🖼️ Nová objednávka plakátů ${order.order_number} — ${order.customer_name}`;
  await sendMandrillMessage({
    mandrillKey,
    from: parseFromHeader(Deno.env.get('EMAIL_FROM') || 'VividBooks <objednavky@vividbooks.com>'),
    to: recipients.map((email) => ({ email })),
    subject,
    html: buildPosterOrderAdminNotificationHtml(order, items),
    replyTo: order.customer_email,
  });
  return { sent: true as const, recipients, subject };
}

function buildOrderShippedHtml(order: OrderRow, trackingUrl: string | null) {
  const trackingPageBlock = trackingUrl
    ? `<p style="margin:0 0 20px;">${buildVividbooksBrandCta(trackingUrl, 'Sledovat objednávku')}</p>`
    : '';

  const trackingBlock = order.tracking_number
    ? order.shipping_method === 'zasilkovna'
      ? `<p style="${P}">Sledujte zásilku: <a href="https://tracking.packeta.com/cs/?id=${encodeURIComponent(order.tracking_number)}" style="${LINK}">https://tracking.packeta.com/cs/?id=${escapeHtml(order.tracking_number)}</a></p>`
      : `<p style="${P}">Číslo zásilky: <strong style="color:${VB_EMAIL_NAVY};">${escapeHtml(order.tracking_number)}</strong></p>`
    : '';

  return buildShell(
    `Vaše objednávka ${order.order_number} byla odeslána — Vividbooks`,
    `
      <h1 style="${H1}">Balíček je na cestě</h1>
      <p style="${P}">
        Vaše objednávka <strong style="color:${VB_EMAIL_NAVY};">${escapeHtml(order.order_number)}</strong> byla předána dopravci ${escapeHtml(shippingLabel(order.shipping_method))}.
      </p>
      ${trackingPageBlock}
      ${trackingBlock}
      ${order.shipping_method === 'zasilkovna' && order.pickup_point_name ? `<p style="${P}">Vyzvedněte si ji na: <strong style="color:${VB_EMAIL_NAVY};">${escapeHtml(order.pickup_point_name)}</strong></p>` : ''}
      <p style="margin:0;font-size:15px;line-height:1.65;color:#4a5568;">Děkujeme za nákup — Vividbooks</p>
    `,
    'Zásilka na cestě',
  );
}

function buildPaymentReminderHtml(order: OrderRow, items: OrderItemRow[], resumeToken: string) {
  const site = getPublicEshopBaseUrl().replace(/\/$/, '');
  const ru = new URL('platit', `${site}/`);
  ru.searchParams.set('resume', resumeToken);
  const resumeUrl = ru.toString();

  return buildShell(
    `Dokončete platbu — objednávka ${order.order_number} — Vividbooks`,
    `
      <h1 style="${H1}">Čekáme na platbu</h1>
      <p style="${P}">
        U objednávky <strong style="color:${VB_EMAIL_NAVY};">${escapeHtml(order.order_number)}</strong> čekáme na zaplacení. Klikněte na tlačítko níže a bezpečně dokončíte platbu kartou.
      </p>
      <p style="margin:0 0 20px;" align="center">${buildVividbooksBrandCta(resumeUrl, 'Dokončit platbu')}</p>
      <p style="margin:0 0 20px;font-size:12px;line-height:1.6;color:#94a3b8;word-break:break-all;">
        Nebo zkopírujte odkaz: <a href="${escapeHtml(resumeUrl)}" style="${LINK}">${escapeHtml(resumeUrl)}</a>
      </p>
      ${buildOrderItemsTable(items)}
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0;">
        <tr>
          <td style="padding:8px 0;font-size:15px;color:#4a5568;">Doprava:</td>
          <td style="padding:8px 0;font-size:15px;color:${VB_EMAIL_NAVY};text-align:right;"><strong>${escapeHtml(shippingLabel(order.shipping_method))}</strong> — ${formatPrice(order.shipping_price)}</td>
        </tr>
        <tr>
          <td style="padding:12px 0 0;font-size:17px;color:${VB_EMAIL_NAVY};"><strong>Celkem k úhradě</strong></td>
          <td style="padding:12px 0 0;font-size:17px;color:${VB_EMAIL_NAVY};text-align:right;"><strong>${formatPrice(order.total)}</strong></td>
        </tr>
      </table>
      <p style="margin:20px 0 0;font-size:14px;line-height:1.65;color:#4a5568;">
        Pokud jste platbu už odeslali, tento e-mail můžete ignorovat — potvrzení vám dorazí po připsání platby.
      </p>
    `,
    'Připomínka platby',
  );
}

function buildOrderTransferReceivedHtml(order: OrderRow) {
  return buildShell(
    `Objednávka ${order.order_number} — Vividbooks`,
    `
      <h1 style="${H1}">Máme vaši objednávku</h1>
      <p style="${P}">
        Potvrzujeme přijetí objednávky <strong style="color:${VB_EMAIL_NAVY};">${escapeHtml(order.order_number)}</strong>.
        Ozve se vám náš obchodník, který s vámi objednávku dokončí.
      </p>
      <p style="margin:0;font-size:15px;line-height:1.65;color:#4a5568;">
        Tento e-mail neobsahuje platební údaje — domluvíte je přímo s obchodním zástupcem.
      </p>
    `,
    'Objednávka přijata',
  );
}

function buildOrderAutoCancelledUnpaidHtml(order: OrderRow) {
  const site = getPublicSiteUrl();
  return buildShell(
    `Objednávka ${order.order_number} zrušena — Vividbooks`,
    `
      <h1 style="${H1}">Objednávka byla zrušena</h1>
      <p style="${P}">
        Vaše objednávka <strong style="color:${VB_EMAIL_NAVY};">${escapeHtml(order.order_number)}</strong> byla zrušena — nebyla zaplacena.
      </p>
      <p style="margin:0 0 20px;font-size:15px;line-height:1.65;color:#4a5568;">
        Pokud máte stále zájem, můžete vytvořit novou objednávku na webu.
      </p>
      <p style="margin:0;" align="center">${buildVividbooksBrandCta(site, 'Přejít na Vividbooks')}</p>
    `,
    'Objednávka zrušena',
  );
}

function buildOrderCancelledHtml(order: OrderRow) {
  return buildShell(
    `Objednávka ${order.order_number} byla zrušena — Vividbooks`,
    `
      <h1 style="${H1}">Objednávka byla zrušena</h1>
      <p style="${P}">
        Vaše objednávka <strong style="color:${VB_EMAIL_NAVY};">${escapeHtml(order.order_number)}</strong> byla zrušena.
      </p>
      ${order.cancelled_reason ? `<p style="${P}">Důvod: <strong style="color:${VB_EMAIL_NAVY};">${escapeHtml(order.cancelled_reason)}</strong></p>` : ''}
      <p style="margin:0;font-size:15px;line-height:1.65;color:#4a5568;">
        Pokud jste platili kartou, peníze vám budou vráceny do 5–10 pracovních dní.
      </p>
    `,
    'Objednávka zrušena',
  );
}

export async function loadOrderEmailData(sql: postgres.Sql, orderId: string) {
  const orderRows = await sql<OrderRow[]>`
    select
      id,
      order_number,
      status,
      customer_email,
      customer_name,
      customer_phone,
      school_name,
      ico,
      street,
      city,
      zip,
      note,
      shipping_method,
      shipping_price,
      pickup_point_name,
      tracking_number,
      payment_method,
      total,
      cancelled_reason,
      payment_resume_token,
      stripe_receipt_url,
      poster_fulfillment_status
    from public.orders
    where id = ${orderId}::uuid
    limit 1
  `;

  const order = orderRows[0];
  if (!order) {
    throw new Error(`Order ${orderId} not found.`);
  }

  const items = await sql<OrderItemRow[]>`
    select
      product_name,
      quantity,
      unit_price,
      total_price
    from public.order_items
    where order_id = ${orderId}::uuid
    order by id asc
  `;

  return { order, items };
}

export async function sendOrderEmail(sql: postgres.Sql, params: { orderId: string; emailType: OrderEmailType }) {
  const mandrillKey = Deno.env.get('MANDRILL_API_KEY');
  if (!mandrillKey) {
    throw new Error('Missing MANDRILL_API_KEY.');
  }

  const from = parseFromHeader(Deno.env.get('EMAIL_FROM') || 'VividBooks <objednavky@vividbooks.com>');
  const { order, items } = await loadOrderEmailData(sql, params.orderId);

  let trackingUrl: string | null = null;
  if (params.emailType === 'order_confirmed' || params.emailType === 'order_shipped') {
    trackingUrl = await buildPublicOrderTrackingUrl(order.id, order.order_number, {
      paymentMethod: order.payment_method,
      status: order.status,
    });
  }

  let subject = '';
  let html = '';

  if (params.emailType === 'order_confirmed' && isPosterOrder(order)) {
    subject = `Potvrzení objednávky ${order.order_number} — plakáty jdou do výroby — VividBooks`;
    html = buildPosterOrderConfirmedHtml(order, items, trackingUrl);
  } else if (params.emailType === 'order_confirmed') {
    subject = `Potvrzení objednávky ${order.order_number} — VividBooks`;
    html = buildOrderConfirmedHtml(order, items, trackingUrl);
  } else if (params.emailType === 'order_shipped') {
    subject = `Vaše objednávka ${order.order_number} byla odeslána — VividBooks`;
    html = buildOrderShippedHtml(order, trackingUrl);
  } else if (params.emailType === 'order_cancelled') {
    subject = `Objednávka ${order.order_number} byla zrušena — VividBooks`;
    html = buildOrderCancelledHtml(order);
  } else if (params.emailType === 'payment_reminder') {
    const token = order.payment_resume_token?.trim();
    if (!token) {
      throw new Error(`Order ${order.order_number} has no payment_resume_token for reminder.`);
    }
    subject = `Dokončete platbu — objednávka ${order.order_number} — VividBooks`;
    html = buildPaymentReminderHtml(order, items, token);
  } else if (params.emailType === 'order_transfer_received') {
    subject = `Objednávka ${order.order_number} — potvrzení přijetí — VividBooks`;
    html = buildOrderTransferReceivedHtml(order);
  } else if (params.emailType === 'order_auto_cancelled_unpaid') {
    subject = `Objednávka ${order.order_number} zrušena — VividBooks`;
    html = buildOrderAutoCancelledUnpaidHtml(order);
  } else if (params.emailType === 'distributor_order_received') {
    subject = `Shrnutí objednávky ${order.order_number} — VividBooks`;
    html = buildDistributorOrderReceivedHtml(order, items);
  } else {
    throw new Error(`Unsupported emailType: ${params.emailType}`);
  }

  await sendMandrillMessage({
    mandrillKey,
    from,
    to: [{ email: order.customer_email, name: order.customer_name }],
    subject,
    html,
    replyTo: getReplyToAddress(),
  });

  return { order, subject, html };
}
