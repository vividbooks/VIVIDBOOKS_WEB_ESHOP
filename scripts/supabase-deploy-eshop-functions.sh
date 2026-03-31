#!/usr/bin/env bash
# Nasadí Edge funkce související s pokladnou / Stripe / objednávkami.
# Spusť z kořene repa po: supabase login && supabase link --project-ref <REF>
set -euo pipefail
FUNCS=(
  create-payment-intent
  submit-transfer-order
  stripe-webhook
  get-order-by-payment-intent
  resume-checkout
  send-order-email
  process-export-queue
  cancel-stale-orders
  pipedrive-inbound-deal
  make-server-93a20b6f
)
for f in "${FUNCS[@]}"; do
  echo "=== deploying $f ==="
  supabase functions deploy "$f" --no-verify-jwt
done
echo "Done. Zkontroluj v Dashboardu JWT u funkcí volaných z prohlížeče (anon key)."
