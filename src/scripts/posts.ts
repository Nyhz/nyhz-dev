// src/scripts/posts.ts — the lab's posts: markdown files in src/content/lab,
// newest first. The slug is the file name.
import type { MarkdownInstance } from 'astro';
import { minutesToRead } from './content';

/** cover: the picture on the list and atop the post (webp); image: the same for link previews (jpg, 1200×630) */
export type PostMeta = { title: string; summary: string; date: string; tags?: string[]; cover?: string; image?: string };
export type Post = { slug: string; meta: PostMeta; minutes: number; Content: MarkdownInstance<PostMeta>['Content'] };


export function getPosts(): Post[] {
  const files = import.meta.glob<MarkdownInstance<PostMeta>>('../content/lab/*.md', { eager: true });
  return Object.entries(files)
    .map(([path, md]) => ({
      slug: path.split('/').pop()!.replace(/\.md$/, ''),
      // yaml reads an unquoted date as a Date: back to yyyy-mm-dd
      meta: { ...md.frontmatter, date: new Date(md.frontmatter.date).toISOString().slice(0, 10) },
      minutes: minutesToRead(md.rawContent()),
      Content: md.Content,
    }))
    .sort((a, b) => b.meta.date.localeCompare(a.meta.date));
}
