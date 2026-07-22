import { z } from "zod";
import type { ModerationCategory } from "./types.js";

/**
 * Per-service configuration. Everything that differs between the 5 apps
 * (판결소·동네백서·정상인가요·이름연구소·티어랩) is expressed here — the
 * pipeline code itself stays identical.
 */
export interface UgcConfig<TSchema extends z.ZodTypeAny = z.ZodTypeAny> {
  /** Discriminates rows across services sharing the ugc_* tables. */
  appSlug: string;

  /** Zod schema for this service's submission fields. */
  contentSchema: TSchema;

  moderation: {
    /** qualityScore ≥ this → auto-publish. 0–100. */
    autoPublishThreshold: number;
    /** qualityScore ≤ this → auto-block. 0–100. */
    blockThreshold: number;
    /** Minimum text length before content is even considered. */
    requireMinLength: number;
    /** Categories that must be blocked outright. */
    forbiddenCategories: ModerationCategory[];
  };

  seo: {
    /** e.g. '/case/[slug]'. `[slug]` is substituted at publish time. */
    urlPattern: string;
    /** e.g. '{title} — 판결소'. `{field}` tokens pull from content. */
    titleTemplate: string;
    /** contentScore below this stays noindex. */
    minContentScore: number;
  };

  rateLimit: {
    perIpPerHour: number;
    perUserPerDay: number;
  };
}

/** Zod validator for a UgcConfig (schema field validated structurally). */
export const ugcConfigSchema = z.object({
  appSlug: z.string().min(1).regex(/^[a-z0-9-]+$/, "appSlug must be kebab-case"),
  contentSchema: z.custom<z.ZodTypeAny>(
    (v) => v instanceof z.ZodType,
    "contentSchema must be a Zod schema",
  ),
  moderation: z.object({
    autoPublishThreshold: z.number().min(0).max(100),
    blockThreshold: z.number().min(0).max(100),
    requireMinLength: z.number().int().min(0),
    forbiddenCategories: z.array(z.string()),
  }),
  seo: z.object({
    urlPattern: z.string().includes("[slug]"),
    titleTemplate: z.string().min(1),
    minContentScore: z.number().min(0).max(100),
  }),
  rateLimit: z.object({
    perIpPerHour: z.number().int().positive(),
    perUserPerDay: z.number().int().positive(),
  }),
});

/**
 * Validate + normalize a config. Throws (with a readable Zod error) if the
 * service passes something incoherent — e.g. blockThreshold above
 * autoPublishThreshold, which would leave no queue band.
 */
export function defineUgcConfig<TSchema extends z.ZodTypeAny>(
  config: UgcConfig<TSchema>,
): UgcConfig<TSchema> {
  ugcConfigSchema.parse(config);
  const { autoPublishThreshold, blockThreshold } = config.moderation;
  if (blockThreshold >= autoPublishThreshold) {
    throw new Error(
      `[ugc-core:${config.appSlug}] blockThreshold (${blockThreshold}) must be below ` +
        `autoPublishThreshold (${autoPublishThreshold}); otherwise no review band exists.`,
    );
  }
  return config;
}
