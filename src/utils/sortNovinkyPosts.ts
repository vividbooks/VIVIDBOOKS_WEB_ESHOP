import type { NovinkaPost } from '../data/novinkaPosts';
import { parseCsDateMs, cmsPostSortTime, sortCmsPosts } from './sortCmsPosts';

export { parseCsDateMs as parseNovinkaDateMs };

export function novinkaSortTime(post: Partial<NovinkaPost> & Record<string, unknown>): number {
  return cmsPostSortTime(post);
}

export function sortNovinkyPosts<T extends Partial<NovinkaPost>>(posts: T[]): T[] {
  return sortCmsPosts(posts as (Partial<NovinkaPost> & Record<string, unknown>)[]);
}
