import type postgres from 'npm:postgres';
import { computeOrderTrackingToken } from './order-tracking-token.ts';

export type OrderEmailType =
  | 'order_confirmed'
  | 'order_shipped'
  | 'order_cancelled'
  | 'payment_reminder'
  | 'order_transfer_received'
  | 'order_auto_cancelled_unpaid';

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
  shipping_method: string;
  shipping_price: number;
  pickup_point_name: string | null;
  tracking_number: string | null;
  payment_method: string;
  total: number;
  cancelled_reason: string | null;
  payment_resume_token: string | null;
  stripe_receipt_url: string | null;
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

async function buildPublicOrderTrackingUrl(orderId: string, orderNumber: string): Promise<string | null> {
  const secret = (Deno.env.get('ORDER_TRACKING_HMAC_SECRET') || '').trim();
  if (!secret) return null;
  try {
    const token = await computeOrderTrackingToken(orderId, secret);
    const site = getPublicEshopBaseUrl().replace(/\/$/, '');
    const u = new URL('objednavka/sledovani', `${site}/`);
    u.searchParams.set('order', orderNumber);
    u.searchParams.set('t', token);
    return u.toString();
  } catch {
    return null;
  }
}

function buildShell(title: string, content: string) {
  return `<!DOCTYPE html>
<html lang="cs">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${escapeHtml(title)}</title>
</head>
<body style="margin:0;padding:0;background:#f5f7fb;font-family:Arial,Helvetica,sans-serif;color:#111827;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f7fb;padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:#ffffff;border-radius:16px;overflow:hidden;">
          <tr>
            <td style="padding:28px 32px;background:#2563eb;">
              <div style="font-size:28px;line-height:1.1;font-weight:700;color:#ffffff;">VividBooks</div>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              ${content}
            </td>
          </tr>
          <tr>
            <td style="padding:24px 32px;background:#f8fafc;border-top:1px solid #e5e7eb;">
              <p style="margin:0;font-size:13px;line-height:1.6;color:#6b7280;">
                Máte dotaz? Napište nám na <a href="mailto:hello@vividbooks.com" style="color:#2563eb;text-decoration:none;">hello@vividbooks.com</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

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
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:20px 0;">
      <tr>
        <td style="padding:10px 12px;background:#eff6ff;font-size:12px;font-weight:700;color:#1d4ed8;text-transform:uppercase;">Položka</td>
        <td style="padding:10px 12px;background:#eff6ff;font-size:12px;font-weight:700;color:#1d4ed8;text-transform:uppercase;text-align:center;">Ks</td>
        <td style="padding:10px 12px;background:#eff6ff;font-size:12px;font-weight:700;color:#1d4ed8;text-transform:uppercase;text-align:right;">Cena za kus</td>
        <td style="padding:10px 12px;background:#eff6ff;font-size:12px;font-weight:700;color:#1d4ed8;text-transform:uppercase;text-align:right;">Celkem</td>
      </tr>
      ${rows}
    </table>
  `;
}

function buildOrderConfirmedHtml(order: OrderRow, items: OrderItemRow[], trackingUrl: string | null) {
  const cardLike = ['card', 'apple_pay', 'google_pay'].includes(order.payment_method);
  const receiptBlock = cardLike
    ? `<p style="margin:16px 0 0;font-size:15px;line-height:1.7;color:#374151;">
        Daňový doklad o zaplacení vám zašle e-mailem <strong>iDoklad</strong> (obvykle během několika minut po zpracování platby).
      </p>`
    : order.stripe_receipt_url
    ? `<p style="margin:16px 0 0;font-size:15px;line-height:1.7;color:#374151;">
        Účtenku od Stripe:
        <a href="${escapeHtml(order.stripe_receipt_url)}" style="color:#2563eb;text-decoration:none;">Zobrazit účtenku</a>
      </p>`
    : '';

  const trackingBlock = trackingUrl
    ? `<p style="margin:16px 0 0;font-size:15px;line-height:1.7;color:#374151;">
        Stav objednávky a zásilky:
        <a href="${escapeHtml(trackingUrl)}" style="color:#2563eb;text-decoration:none;">Sledovat objednávku</a>
      </p>`
    : '';

  return buildShell(
    `Potvrzení objednávky ${order.order_number} — VividBooks`,
    `
      <h1 style="margin:0 0 12px;font-size:28px;line-height:1.2;color:#111827;">Děkujeme za objednávku!</h1>
      <p style="margin:0 0 8px;font-size:15px;line-height:1.7;color:#374151;">Číslo objednávky: <strong>${escapeHtml(order.order_number)}</strong></p>
      ${receiptBlock}
      ${trackingBlock}
      ${buildOrderItemsTable(items)}
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0;">
        <tr>
          <td style="padding:8px 0;font-size:15px;color:#374151;">Doprava:</td>
          <td style="padding:8px 0;font-size:15px;color:#111827;text-align:right;"><strong>${escapeHtml(shippingLabel(order.shipping_method))}</strong> — ${formatPrice(order.shipping_price)}</td>
        </tr>
        ${order.pickup_point_name ? `<tr><td style="padding:8px 0;font-size:15px;color:#374151;">Výdejní místo:</td><td style="padding:8px 0;font-size:15px;color:#111827;text-align:right;">${escapeHtml(order.pickup_point_name)}</td></tr>` : ''}
        <tr>
          <td style="padding:12px 0 0;font-size:17px;color:#111827;"><strong>Celkem</strong></td>
          <td style="padding:12px 0 0;font-size:17px;color:#111827;text-align:right;"><strong>${formatPrice(order.total)}</strong></td>
        </tr>
      </table>
      <p style="margin:20px 0 0;font-size:15px;line-height:1.7;color:#374151;">
        Vaši objednávku nyní zpracováváme a brzy ji předáme k odeslání.
      </p>
    `,
  );
}

function buildOrderShippedHtml(order: OrderRow, trackingUrl: string | null) {
  const trackingPageBlock = trackingUrl
    ? `<p style="margin:0 0 16px;font-size:15px;line-height:1.7;color:#374151;">
        <a href="${escapeHtml(trackingUrl)}" style="color:#2563eb;text-decoration:none;">Sledovat objednávku</a>
      </p>`
    : '';

  const trackingBlock = order.tracking_number
    ? order.shipping_method === 'zasilkovna'
      ? `<p style="margin:0 0 16px;font-size:15px;line-height:1.7;color:#374151;">Sledujte zásilku: <a href="https://tracking.packeta.com/cs/?id=${encodeURIComponent(order.tracking_number)}" style="color:#2563eb;text-decoration:none;">https://tracking.packeta.com/cs/?id=${escapeHtml(order.tracking_number)}</a></p>`
      : `<p style="margin:0 0 16px;font-size:15px;line-height:1.7;color:#374151;">Tracking číslo: <strong>${escapeHtml(order.tracking_number)}</strong></p>`
    : '';

  return buildShell(
    `Vaše objednávka ${order.order_number} byla odeslána — VividBooks`,
    `
      <h1 style="margin:0 0 12px;font-size:28px;line-height:1.2;color:#111827;">Vaše objednávka byla odeslána</h1>
      <p style="margin:0 0 16px;font-size:15px;line-height:1.7;color:#374151;">
        Vaše objednávka <strong>${escapeHtml(order.order_number)}</strong> byla předána dopravci ${escapeHtml(shippingLabel(order.shipping_method))}.
      </p>
      ${trackingPageBlock}
      ${trackingBlock}
      ${order.shipping_method === 'zasilkovna' && order.pickup_point_name ? `<p style="margin:0 0 16px;font-size:15px;line-height:1.7;color:#374151;">Vyzvedněte si ji na: <strong>${escapeHtml(order.pickup_point_name)}</strong></p>` : ''}
      <p style="margin:0;font-size:15px;line-height:1.7;color:#374151;">Děkujeme za nákup — VividBooks</p>
    `,
  );
}

function buildPaymentReminderHtml(order: OrderRow, items: OrderItemRow[], resumeToken: string) {
  const site = getPublicEshopBaseUrl().replace(/\/$/, '');
  const ru = new URL('platit', `${site}/`);
  ru.searchParams.set('resume', resumeToken);
  const resumeUrl = ru.toString();

  return buildShell(
    `Dokončete platbu — objednávka ${order.order_number} — VividBooks`,
    `
      <h1 style="margin:0 0 12px;font-size:28px;line-height:1.2;color:#111827;">Platba u objednávky ještě není dokončena</h1>
      <p style="margin:0 0 16px;font-size:15px;line-height:1.7;color:#374151;">
        U objednávky <strong>${escapeHtml(order.order_number)}</strong> čekáme na zaplacení. Klikněte na tlačítko níže a bezpečně dokončíte platbu kartou.
      </p>
      <p style="margin:0 0 20px;">
        <a href="${escapeHtml(resumeUrl)}" style="display:inline-block;padding:14px 28px;background:#2563eb;color:#ffffff;text-decoration:none;border-radius:12px;font-size:15px;font-weight:700;">
          Dokončit platbu
        </a>
      </p>
      <p style="margin:0 0 20px;font-size:13px;line-height:1.6;color:#6b7280;word-break:break-all;">
        Nebo zkopírujte odkaz: <a href="${escapeHtml(resumeUrl)}" style="color:#2563eb;">${escapeHtml(resumeUrl)}</a>
      </p>
      ${buildOrderItemsTable(items)}
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0;">
        <tr>
          <td style="padding:8px 0;font-size:15px;color:#374151;">Doprava:</td>
          <td style="padding:8px 0;font-size:15px;color:#111827;text-align:right;"><strong>${escapeHtml(shippingLabel(order.shipping_method))}</strong> — ${formatPrice(order.shipping_price)}</td>
        </tr>
        <tr>
          <td style="padding:12px 0 0;font-size:17px;color:#111827;"><strong>Celkem k úhradě</strong></td>
          <td style="padding:12px 0 0;font-size:17px;color:#111827;text-align:right;"><strong>${formatPrice(order.total)}</strong></td>
        </tr>
      </table>
      <p style="margin:20px 0 0;font-size:14px;line-height:1.7;color:#374151;">
        Pokud jste platbu už odeslali, tento e-mail můžete ignorovat — potvrzení vám dorazí po připsání platby.
      </p>
    `,
  );
}

function buildOrderTransferReceivedHtml(order: OrderRow) {
  return buildShell(
    `Objednávka ${order.order_number} — VividBooks`,
    `
      <h1 style="margin:0 0 12px;font-size:28px;line-height:1.2;color:#111827;">Máme vaši objednávku</h1>
      <p style="margin:0 0 16px;font-size:15px;line-height:1.7;color:#374151;">
        Potvrzujeme přijetí objednávky <strong>${escapeHtml(order.order_number)}</strong>.
        Ozve se vám náš obchodník, který s vámi objednávku dokončí.
      </p>
      <p style="margin:0;font-size:15px;line-height:1.7;color:#374151;">
        Tento e-mail neobsahuje platební údaje — domluvíte je přímo s obchodním zástupcem.
      </p>
    `,
  );
}

function buildOrderAutoCancelledUnpaidHtml(order: OrderRow) {
  const site = getPublicSiteUrl();
  return buildShell(
    `Objednávka ${order.order_number} zrušena — VividBooks`,
    `
      <h1 style="margin:0 0 12px;font-size:28px;line-height:1.2;color:#111827;">Objednávka byla zrušena</h1>
      <p style="margin:0 0 16px;font-size:15px;line-height:1.7;color:#374151;">
        Vaše objednávka <strong>${escapeHtml(order.order_number)}</strong> byla zrušena — nebyla zaplacena.
      </p>
      <p style="margin:0;font-size:15px;line-height:1.7;color:#374151;">
        Pokud máte stále zájem, můžete vytvořit novou objednávku na
        <a href="${escapeHtml(site)}" style="color:#2563eb;text-decoration:none;">vividbooks.cz</a>.
      </p>
    `,
  );
}

function buildOrderCancelledHtml(order: OrderRow) {
  return buildShell(
    `Objednávka ${order.order_number} byla zrušena — VividBooks`,
    `
      <h1 style="margin:0 0 12px;font-size:28px;line-height:1.2;color:#111827;">Objednávka byla zrušena</h1>
      <p style="margin:0 0 16px;font-size:15px;line-height:1.7;color:#374151;">
        Vaše objednávka <strong>${escapeHtml(order.order_number)}</strong> byla zrušena.
      </p>
      ${order.cancelled_reason ? `<p style="margin:0 0 16px;font-size:15px;line-height:1.7;color:#374151;">Důvod: <strong>${escapeHtml(order.cancelled_reason)}</strong></p>` : ''}
      <p style="margin:0;font-size:15px;line-height:1.7;color:#374151;">
        Pokud jste platili kartou, peníze vám budou vráceny do 5–10 pracovních dní.
      </p>
    `,
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
      shipping_method,
      shipping_price,
      pickup_point_name,
      tracking_number,
      payment_method,
      total,
      cancelled_reason,
      payment_resume_token,
      stripe_receipt_url
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
    trackingUrl = await buildPublicOrderTrackingUrl(order.id, order.order_number);
  }

  let subject = '';
  let html = '';

  if (params.emailType === 'order_confirmed') {
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
  } else {
    throw new Error(`Unsupported emailType: ${params.emailType}`);
  }

  const response = await fetch('https://mandrillapp.com/api/1.0/messages/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      key: mandrillKey,
      message: {
        html,
        subject,
        from_email: from.email,
        from_name: from.name,
        to: [{ email: order.customer_email, name: order.customer_name, type: 'to' }],
        headers: { 'Reply-To': getReplyToAddress() },
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

  return { order, subject, html };
}
