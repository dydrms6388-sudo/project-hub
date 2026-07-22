# DECISIONS — ugc-platform / @ggu/ugc-core

Running log of design decisions. Newest phase last.

## Phase 1 — submit + moderate 실구현, 어댑터, 20종 테스트 (current)

- **D1.1 Provider-agnostic LLM classifier.** `LlmClassifier` takes an injected
  `chat(prompt) => string`; the package imports no AI SDK and holds no key. Batches
  up to 10 texts per call (spec: "LLM 분류기 배치 10건"), parses the JSON array,
  validates each item with Zod, and **falls back to `HeuristicClassifier`** per-item
  on any parse/validation failure or model error. Consumers wire their own model
  (recommend the latest Claude model).
- **D1.2 Offline heuristic classifier.** `HeuristicClassifier` runs with no network
  (lexicons for hate/spam/adult + URL-flood + repetition + PII). Doubles as the
  default `ClassifierPort` and the LLM fallback, so moderation degrades gracefully.
- **D1.3 Supabase adapter is type-only + optional peer dep.** `SupabaseStore`
  implements `UgcStore` + `DashboardPort` via `import type { SupabaseClient }`, so
  core stays runtime-dependency-free (only `zod`). Consumers pass a **service-role**
  client. `bumpCounter` calls the `ugc_bump_counter` RPC for atomicity. Dashboard
  reads group in app code for now — **Phase 3 should move aggregation into SQL
  views/RPCs** (flagged in-file). Adapter is type-checked here but exercised against
  a live DB only by the consumer's integration tests (Phase 2).
- **D1.4 `recordModeration` carries `app_slug`.** The `ugc_moderations.app_slug`
  column is NOT NULL; the port signature now takes `(appSlug, submissionId, result)`
  rather than doing an extra lookup. Callers pass `config.appSlug`.
- **D1.5 Review queue persisted.** `intake()` now writes queued items to
  `ugc_moderation_queue` via `enqueueForReview` (idempotent upsert on
  `submission_id`); `resolveQueueItem` marks admin resolution.
- **D1.6 Embedding dedup via injected embedder.** `InMemorySimilarityIndex`
  implements `SimilarityPort` with cosine similarity over an injected `embed(text)`;
  no embedding SDK in-package. Production vectors live in pgvector (Phase 2).
- **D1.7 PII precision fix.** Dropped ambiguous single-char affiliation tokens
  (과/부/국/처 …) that false-matched ordinary words (국물, 근처) and made a job title
  **mandatory** in the name+affiliation heuristic. Clean-prose false positives → 0.
- **Verification.** `typecheck` clean; **43 vitest cases green**, including all **20
  PII cases blocking**, clean prose not flagged, spam (도배/링크폭탄) never
  auto-publishing, dedup, and the batched classifier (order/fallback/unknown-category).


## Phase 0 — workspace + scaffolding + schema (current)

### Placement
- **D0.1** Built as a separate npm workspace under `ugc-platform/` in the
  existing repo rather than a new GitHub repo. Reason: session is scoped to the
  `project-hub` repo/branch and the GitHub API was intermittently unavailable.
  The directory is fully isolated from the static-site generator, so promoting
  it to its own repo later is a `git mv`. The static deploy is unaffected —
  `gen-pages.mjs` only deletes dirs matching a `projects.json` slug and its junk
  scan is a non-blocking warning keyed on placeholder text we don't emit.

### Architecture
- **D0.2 Headless + ports.** The package imports **no** DB driver or AI SDK.
  Persistence, LLM classification, similarity/dedup, and SEO side-effects are
  **ports** (`UgcStore`, `ClassifierPort`, `SimilarityPort`, `SeoSink`) injected
  by the consumer. This is what makes "설정 객체 + 3줄" integration possible and
  keeps the core unit-testable without infra.
- **D0.3 Config-as-data.** All per-service variation flows through `UgcConfig`
  (`defineUgcConfig` validates it with Zod). `defineUgcConfig` additionally
  rejects incoherent thresholds (`blockThreshold >= autoPublishThreshold`) that
  would collapse the review band.
- **D0.4 One factory.** `createUgc(config, deps)` returns bound stage methods
  plus `intake()` (submit → moderate → publish/queue/block in one call).

### Data model
- **D0.5 Shared tables, `app_slug` discriminator.** All tables are `ugc_`-prefixed
  and shared; services are separated by `app_slug`, never by per-service tables.
  Table names are centralized in `src/db/tables.ts` and must match the migration.
- **D0.6 RLS deny-by-default.** Only `ugc_content` gets a public (anon) read
  policy, scoped to `status = 'published'`. Everything else is service-role only.
- **D0.7 Rate limiting via atomic counter.** `ugc_bump_counter` SQL function +
  rolling window keys (`ip:<hash>:<YYYY-MM-DDTHH>`, `user:<id>:<YYYY-MM-DD>`).
  Dual gate: per-IP-per-hour and per-user-per-day.

### Moderation
- **D0.8 Two-layer, rules first.** Deterministic rules (`1차`) run before any LLM
  call; a hard block (high-confidence PII or forbidden word) short-circuits and
  never spends an LLM request. LLM classifier (`2차`) is an optional port; when
  present, scores blend 0.7 LLM / 0.3 rules.
- **D0.9 PII is a hard block, Korean-first.** `moderate/pii.ts` detects RRN,
  phone, card, email (high confidence → block) and account/address/name+affiliation
  (low confidence → penalty + human queue). Deliberately biased toward
  over-detection: a false positive queues, a false negative leaks personal data.
  The Phase-1 20-case PII test set will tune the thresholds.

### Deferred to later phases (not built in Phase 0)
- Supabase adapter implementing `UgcStore`/`DashboardPort` (Phase 1).
- Real LLM classifier + batching, embedding-based dedup (`SimilarityPort` is
  defined but unimplemented) (Phase 1).
- `publish`/`engage` currently score with `reactions` but the sitemap/revalidate
  side-effects are behind the `SeoSink` port — real Next.js wiring is Phase 2.
- Admin dashboard **UI** — only the data port + view-model types exist (Phase 3).
- Seed/bootstrap scripts for cold-start (Phase 4), with human-approval flow.
- First real integration into 판결소, then the other four apps (Phase 4).

### Verification (this phase)
- `npm run typecheck` clean (strict, `noUncheckedIndexedAccess`, `verbatimModuleSyntax`).
- `npm test` — 8 vitest cases green: PII detection, slug/score determinism, and
  intake pipeline (publish / PII-block / invalid-reject / rate-limit) against the
  in-memory store.
- `npm run build` emits ESM + d.ts without error.
