/** Jednotný vzhled textového pole — červený rámeček při `hasError`. */

export function checkoutTextInputClass(hasError: boolean): string {
  const base =
    'w-full rounded-[14px] border bg-white px-4 py-3 text-[14px] text-[#001161] outline-none';
  return hasError
    ? `${base} border-red-500 ring-2 ring-red-500/20 focus:border-red-600 focus:ring-red-500/25`
    : `${base} border-[#001161]/10 focus:border-[#5b4fd8] focus:ring-2 focus:ring-[#5b4fd8]/15`;
}
