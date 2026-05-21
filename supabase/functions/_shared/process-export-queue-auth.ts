/**
 * Hlavička pro autorizaci `process-export-queue` při nastaveném
 * PROCESS_EXPORT_QUEUE_CRON_SECRET (stejná logika jako u pg_cron / externího schedulingu).
 */
export function processExportQueueCronHeaders(): Record<string, string> {
  const secret = Deno.env.get('PROCESS_EXPORT_QUEUE_CRON_SECRET')?.trim();
  return secret ? { 'x-cron-secret': secret } : {};
}
