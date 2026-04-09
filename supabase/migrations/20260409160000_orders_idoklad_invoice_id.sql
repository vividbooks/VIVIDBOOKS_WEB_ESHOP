-- ID faktury v iDokladu (číselné Id z API) — pro stažení PDF přes `/v3/Reports/IssuedInvoice/{id}/Pdf`
alter table public.orders
  add column if not exists idoklad_invoice_id text;

comment on column public.orders.idoklad_invoice_id is 'iDoklad IssuedInvoice Id (API) pro report PDF';
