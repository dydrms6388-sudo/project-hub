# @ggu/ugc-core

Headless engine for the full UGC lifecycle — **submit → moderate → publish →
engage → report** — with SEO indexing. Drop into any Next.js service; per-service
differences are absorbed by a single `UgcConfig` object. The core imports no DB
driver and no AI SDK: everything external is an injected **port**.

## Install (within the workspace)

Already wired as a workspace package. From a consumer service, depend on
`@ggu/ugc-core` and inject adapters.

## Integrate into a service (the "설정 객체 + 3줄")

```ts
import { defineUgcConfig, createUgc } from "@ggu/ugc-core";
import { z } from "zod";
import { supabaseStore } from "./adapters"; // your UgcStore impl (Phase 1)

// 1) describe the service
const config = defineUgcConfig({
  appSlug: "pangyeolso",
  contentSchema: z.object({ title: z.string().min(2), body: z.string().min(1) }),
  moderation: { autoPublishThreshold: 60, blockThreshold: 20, requireMinLength: 10,
    forbiddenCategories: ["pii", "hate", "adult"] },
  seo: { urlPattern: "/case/[slug]", titleTemplate: "{title} — 판결소", minContentScore: 30 },
  rateLimit: { perIpPerHour: 5, perUserPerDay: 20 },
});

// 2) wire ports once
const ugc = createUgc(config, { store: supabaseStore /*, classifier, similarity, seo, dashboard */ });

// 3) use it in a route handler
const result = await ugc.intake({ raw: body, authorId, ipHash, signals, text: body.body });
// result.stage ∈ 'rejected' | 'blocked' | 'queued' | 'published'
```

## What each stage does

| Stage | Entry | Responsibility |
|---|---|---|
| **submit** | `ugc.submit` | Zod validation → honeypot/fill-time → dual rate limit → dedup → insert `pending` |
| **moderate** | `ugc.moderate` | Rules (1차) then optional LLM (2차) → `publish`/`queue`/`block`. PII & forbidden categories are hard blocks |
| **publish** | `ugc.publish` | slug (한글→로마자+해시) → contentScore → index if ≥ `minContentScore` |
| **engage** | `ugc.engage` | votes/reactions/comments; a reaction can promote a noindex record into the sitemap |
| **report** | `ugc.report` / `ugc.takedown` | 3 reports → auto-hide; deletion → deindex + serve 410 |
| **dashboard** | `ugc.loadDashboard` | queue/report/daily-stats/spam view-models for the admin UI |

## Ports you implement

- **`UgcStore`** (required) — persistence over the `ugc_*` tables. A
  `MemoryStore` is bundled for tests/demos; the Supabase adapter lands in Phase 1.
- **`ClassifierPort`** (optional) — LLM moderation. Without it, moderation is
  rules-only.
- **`SimilarityPort`** (optional) — embedding dedup at submit.
- **`SeoSink`** (optional) — `index(url)` / `deindex(url)` for sitemap + revalidate.
- **`DashboardPort`** (optional) — read queries for the admin dashboard.

## Database

Apply `supabase/migrations/0000_ugc_core.sql` (`supabase db push` or the SQL
editor). All tables are `ugc_`-prefixed and shared across services via `app_slug`;
RLS is deny-by-default with public read limited to published content.

## Adding a new consumer app

1. Write a `UgcConfig` with the service's `contentSchema` and thresholds.
2. Provide a `UgcStore` (reuse the shared Supabase adapter; only `app_slug` differs).
3. Optionally wire `ClassifierPort` / `SeoSink` / `DashboardPort`.
4. Call `createUgc(config, deps)` and use `intake()` in your submit route.

That's the whole integration — no new tables, no forked pipeline.

## Roadmap

- **Phase 0 (done)** — workspace, package scaffolding, `ugc_` schema, rules-based
  moderation + PII gate, slug/score, in-memory adapter, smoke tests.
- **Phase 1** — Supabase adapter, LLM classifier + batching, embedding dedup,
  20-case PII test set.
- **Phase 2** — publish + SEO wired into a demo Next.js app (E2E).
- **Phase 3** — engage + reports + admin dashboard UI.
- **Phase 4** — integrate 판결소, then document rollout to the other four apps.

## Test / typecheck

```bash
npm run typecheck   # tsc --noEmit
npm test            # vitest
```
