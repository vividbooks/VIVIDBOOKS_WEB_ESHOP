import type { BlogPost } from '../data/blogPosts';
import { cmsPostSortTime, sortCmsPosts } from './sortCmsPosts';

export function blogPostSortTime(post: Partial<BlogPost> & Record<string, unknown>): number {
  return cmsPostSortTime(post);
}

export function sortBlogPosts<T extends Partial<BlogPost>>(posts: T[]): T[] {
  return sortCmsPosts(posts as (Partial<BlogPost> & Record<string, unknown>)[]);
}
