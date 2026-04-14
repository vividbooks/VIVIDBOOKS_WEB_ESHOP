/**
 * Dvouvrstvé „rozmazaný náhled → ostrý“ funguje jen když má kořenový prvek
 * předvídatelnou výplň. U `w-auto` / jen šířky v % bez výšky by `absolute` děti
 * sbalily výšku na nulu.
 */
export function isProgressiveStackLayout(className: string | undefined): boolean {
  const c = className || '';
  if (c.includes('absolute') && c.includes('inset-0')) return true;
  if (c.includes('w-full') && c.includes('h-full')) return true;
  if (c.includes('w-[95%]') && c.includes('h-[95%]')) return true;
  if (c.includes('min-h-full') && c.includes('min-w-full')) return true;
  return false;
}
