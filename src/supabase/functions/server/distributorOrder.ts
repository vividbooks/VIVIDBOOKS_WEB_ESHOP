/**
 * Kroky handleru `POST …/distributor/orders`, které jdou testovat bez celé `index.tsx`:
 *   - povinná doručovací adresa (400 s českou hláškou / sloupce `orders.delivery_*`),
 *   - přepínač Pipedrive (`kv_store_33b2092f` klíč `distributor_pipedrive_sync`).
 *
 * Testy: `deno test --node-modules-dir=none src/supabase/functions/server/distributorOrder_test.ts`
 */
import {
  checkDistributorDelivery,
  distributorDeliveryOrderColumns,
  distributorPipedriveSyncEnabled,
  type DistributorDelivery,
} from '../../../utils/distributorDelivery.ts';

export type DistributorDeliveryResult =
  | { ok: true; delivery: DistributorDelivery; columns: ReturnType<typeof distributorDeliveryOrderColumns> }
  | { ok: false; status: 400; error: string };

/** Doručovací adresa z těla požadavku (`body.delivery`). Bez ní / nevalidní → 400. */
export function distributorDeliveryFromBody(body: { delivery?: unknown } | null | undefined): DistributorDeliveryResult {
  const check = checkDistributorDelivery(body?.delivery);
  if (!check.ok) return { ok: false, status: 400, error: check.error };
  return { ok: true, delivery: check.delivery, columns: distributorDeliveryOrderColumns(check.delivery) };
}

export type DistributorCrmHandoffDeps = {
  orderId: string;
  orderNumber: string;
  /** Hodnota `kv.get('distributor_pipedrive_sync')`; chyba čtení = jako dřív (Pipedrive zapnutý). */
  readSyncFlag: () => Promise<unknown>;
  syncPipedrive: (orderId: string) => Promise<Record<string, unknown> | null>;
  importToKabinet: (dealId: number, orderNumber: string) => void;
  insertEvent: (event: Record<string, unknown>) => Promise<unknown>;
  log?: (message: string) => void;
};

export type DistributorCrmHandoffResult = {
  /** `false` = deal v Pipedrive se nezakládá, objednávku převezme automat v novém CRM. */
  pipedriveSync: boolean;
  pipedrive: Record<string, unknown> | null;
};

/**
 * Předání objednávky obchodu. Zapnuto (výchozí) = deal v Pipedrive + propsání do Kabinetu/CRM
 * přesně jako dřív. Vypnuto = nic z toho; `orders.pipedrive_sync_status` zůstane NULL (CHECK
 * nepovoluje 'skipped') a do `order_events` jde `pipedrive_skipped`.
 */
export async function distributorCrmHandoff(deps: DistributorCrmHandoffDeps): Promise<DistributorCrmHandoffResult> {
  const log = deps.log ?? ((m: string) => console.log(m));

  let enabled = true;
  try {
    enabled = distributorPipedriveSyncEnabled(await deps.readSyncFlag());
  } catch (err) {
    log(`[distributor] přepínač Pipedrive nečitelný, ponechán zapnutý: ${(err as Error)?.message || err}`);
  }

  if (!enabled) {
    try {
      await deps.insertEvent({
        order_id: deps.orderId,
        event_type: 'pipedrive_skipped',
        details: { reason: 'distributor_pipedrive_sync=false', handled_by: 'crm' },
        actor: 'system',
      });
    } catch (err) {
      log(`[distributor] order_events pipedrive_skipped: ${(err as Error)?.message || err}`);
    }
    return { pipedriveSync: false, pipedrive: null };
  }

  let pipedrive: Record<string, unknown> | null = null;
  try {
    pipedrive = await deps.syncPipedrive(deps.orderId);
  } catch (err) {
    /** Selhání CRM nesmí shodit odeslanou objednávku — stav je v `orders.pipedrive_sync_status`. */
    log(`[distributor] pipedrive sync: ${(err as Error)?.message || err}`);
  }
  deps.importToKabinet(Number(pipedrive?.dealId ?? 0), deps.orderNumber);
  return { pipedriveSync: true, pipedrive };
}
