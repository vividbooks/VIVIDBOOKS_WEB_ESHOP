import { useEffect, useState } from 'react';
import { AlertTriangle, Loader2, Trash2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../ui/alert-dialog';

const FINAL_STATUSES = new Set(['paid', 'processing', 'exported', 'shipped', 'delivered']);

/**
 * Sdílený modal pro hard-delete objednávky z DB. Používá se z list view i z detailu.
 *
 * Bezpečnostní pojistka: admin musí přesně opsat `orderNumber`, jinak je tlačítko „Smazat" disabled.
 * U finálních stavů (paid / exported / shipped / …) navíc musí zaškrtnout `force` checkbox — backend
 * bez `force=true` vrátí 409 a UI ji v tom případě sám aktivuje (`requiresForce`).
 */
export function DeleteOrderDialog({
  open,
  onOpenChange,
  orderNumber,
  status,
  paymentStatus,
  onConfirm,
  initialRequiresForce,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderNumber: string;
  status: string;
  paymentStatus?: string | null;
  /**
   * Vrací slib (např. fetch). Když se promise resolvuje, dialog se zavře a list/detail
   * provede vlastní následnou akci (refetch / navigate). Při rejection se zobrazí chyba v dialogu.
   * `force` přechází na backend jen pokud uživatel checkbox zatrhl (nebo backend ho vyžádal po 409).
   */
  onConfirm: (params: { force: boolean }) => Promise<void>;
  /** Pokud backend v předchozím pokusu vrátil `requiresForce`, předdsadíme checkbox za uživatele. */
  initialRequiresForce?: boolean;
}) {
  const [typed, setTyped] = useState('');
  const [force, setForce] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) {
      setTyped('');
      setError('');
      setBusy(false);
      setForce(false);
      return;
    }
    /** Force checkbox přednastavíme jen u opravdu finálních stavů, nebo když backend o tom dal vědět. */
    const isFinal = FINAL_STATUSES.has(status) || paymentStatus === 'paid';
    setForce(initialRequiresForce === true || (isFinal ? false : false));
  }, [open, status, paymentStatus, initialRequiresForce]);

  const isFinal = FINAL_STATUSES.has(status) || paymentStatus === 'paid';
  const matches = typed.trim() === orderNumber.trim();
  const canConfirm = matches && !busy && (!isFinal || force);

  const handleConfirm = async () => {
    if (!canConfirm) return;
    setBusy(true);
    setError('');
    try {
      await onConfirm({ force });
      onOpenChange(false);
    } catch (err) {
      const e = err as Error & { requiresForce?: boolean };
      setError(e?.message || 'Smazání selhalo.');
      if (e?.requiresForce === true) setForce(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={(next) => (busy ? undefined : onOpenChange(next))}>
      <AlertDialogContent className="border-red-200">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-red-700">
            <Trash2 className="w-5 h-5" />
            {`Smazat objednávku ${orderNumber}?`}
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3 text-[13px] text-gray-700">
              <p>
                {'Tato akce trvale odstraní objednávku z databáze (řádky '}
                <code className="font-mono text-[12px] bg-gray-100 px-1 py-0.5 rounded">
                  {'orders, order_items, order_events, export_queue, order_workflow_steps, order_alerts'}
                </code>
                {'). Akci nelze vrátit zpět.'}
              </p>
              {isFinal && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-900">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                    <div>
                      <p className="font-bold mb-1">{'Pozor — finální stav objednávky'}</p>
                      <p>
                        {
                          'Objednávka je zaplacená / exportovaná. Smazání NEZRUŠÍ fakturu v iDokladu, export v Base.com ani deal v Pipedrive — ty je třeba zrušit ručně. Pokud chcete pokračovat, zaškrtněte force níže.'
                        }
                      </p>
                    </div>
                  </div>
                </div>
              )}
              <div>
                <label className="block text-[12px] font-bold text-gray-600 mb-1">
                  {`Pro potvrzení opište číslo objednávky (${orderNumber}):`}
                </label>
                <input
                  type="text"
                  value={typed}
                  onChange={(event) => setTyped(event.target.value)}
                  autoFocus
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-[14px] font-mono text-[#001161] outline-none focus:border-red-400"
                  placeholder={orderNumber}
                  disabled={busy}
                />
                {!matches && typed.length > 0 && (
                  <p className="mt-1 text-[12px] text-red-600">
                    {'Číslo objednávky se neshoduje.'}
                  </p>
                )}
              </div>
              {isFinal && (
                <label className="flex items-start gap-2 text-[13px] text-amber-900">
                  <input
                    type="checkbox"
                    checked={force}
                    onChange={(event) => setForce(event.target.checked)}
                    disabled={busy}
                    className="mt-0.5"
                  />
                  <span>
                    {'Force-delete: vím, že objednávka je zaplacená/exportovaná, a beru zodpovědnost za vyrovnání externích systémů (iDoklad, Base.com, Pipedrive).'}
                  </span>
                </label>
              )}
              {error && (
                <p className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-[13px] text-red-700">
                  {error}
                </p>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            disabled={busy}
            className="inline-flex items-center justify-center px-4 py-2 rounded-xl bg-white border border-gray-300 text-gray-700 font-bold text-[13px] hover:bg-gray-50 disabled:opacity-40"
          >
            {'Zrušit'}
          </button>
          <button
            type="button"
            onClick={() => void handleConfirm()}
            disabled={!canConfirm}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-red-600 text-white font-bold text-[13px] hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {busy ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {'Mažu…'}
              </>
            ) : (
              <>
                <Trash2 className="w-4 h-4" />
                {'Smazat trvale'}
              </>
            )}
          </button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
