import { defineCollection } from 'astro:content';
import { z } from 'astro:schema';
import { glob } from 'astro/loaders';

/**
 * Reference pages: markdown, one file per topic.
 *
 * Two bits of frontmatter carry the project's attitude to facts:
 *
 *   `sources`  — where the claims on the page came from. A registry that asks
 *                owners to trust its data should say where its own reference
 *                material comes from.
 *   `status`   — 'needs-sourcing' marks a page we have not been able to stand
 *                behind yet. It renders with a warning rather than quietly
 *                reading as authoritative.
 */
const reference = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/reference' }),
  schema: z.object({
    title: z.string(),
    summary: z.string(),
    /** Sort order on the index. Lower comes first. */
    order: z.number().default(50),
    status: z.enum(['published', 'needs-sourcing']).default('published'),
    updated: z.coerce.date().optional(),
    sources: z
      .array(z.object({ label: z.string(), url: z.string().url() }))
      .default([]),
  }),
});

export const collections = { reference };
