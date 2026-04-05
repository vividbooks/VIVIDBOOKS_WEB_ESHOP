/** Lidské popisky typů alertů z monitor-order-workflows (admin). */
export function orderAlertTypeLabelCs(alertType: string): string {
  switch (alertType) {
    case 'customer_email_missing':
      return 'Chybí potvrzovací email';
    case 'stripe_receipt_missing':
      return 'Chybí Stripe účtenka (receipt URL)';
    case 'transfer_payment_stale':
      return 'Platba převodem dlouho neuzavřena';
    case 'basecom_stuck':
      return 'Base.com — export čeká příliš dlouho';
    case 'basecom_failed':
      return 'Base.com — export selhal';
    case 'idoklad_stuck':
      return 'iDoklad — export čeká příliš dlouho';
    case 'idoklad_failed':
      return 'iDoklad — export selhal';
    case 'export_queue_processing_too_long':
      return 'Fronta exportu visí v processing';
    case 'mandrill_email_failed':
      return 'Webinář — e-mail se neodeslal (Mandrill)';
    case 'mailchimp_sync_failed':
      return 'Webinář — Mailchimp selhal';
    default:
      return alertType;
  }
}
