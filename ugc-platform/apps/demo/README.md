# @ggu/ugc-demo

Runnable E2E demo that wires **`@ggu/ugc-core`** into a Next.js 15 App Router app:
**submit → moderate → publish → SEO index**, with no external services required.

## Run

```bash
cd ugc-platform
npm install
npm run dev -w @ggu/ugc-demo   # builds ugc-core first, then next dev
# open http://localhost:3000
```

Submit a post and watch it get published, queued, or blocked. Published posts
appear at `/case/[slug]` and are listed in `/sitemap.xml` (only once they clear
`minContentScore` — below that they render `noindex`).

## What it demonstrates

- **Server action** (`app/actions.ts`) → `ugc.intake()` with honeypot + fill-time
  anti-bot signals and an IP-hash rate-limit key.
- **Moderation** via the offline `HeuristicClassifier` (no API key). PII (전화/주민번호
  등) is hard-blocked; spam is queued; clean content auto-publishes.
- **SEO**: `generateMetadata` sets canonical + `robots noindex` for below-bar
  content; `sitemap.ts`/`robots.ts` are generated from live store state; each case
  page emits Article + BreadcrumbList JSON-LD. Publishing calls a `SeoSink` that
  `revalidatePath`s the affected routes.

## Storage

Defaults to the in-memory `MemoryStore` (survives dev HMR via `globalThis`) so the
demo runs standalone. To use a real database, apply
`packages/ugc-core/supabase/migrations/0000_ugc_core.sql` and swap the store in
`app/ugc.ts` for `SupabaseStore` — nothing else changes. That swap is the point of
the port design.

> This is a demo. The in-memory store is per-process and non-persistent; a page
> reload keeps data only while the dev/prod server process is alive.

## Admin (`/admin`)

검수 대기 큐(승인/반려) · 신고 큐 · 일별 통계 · 차단 사유 Top — all rendered from a
single `ugc.loadDashboard()` call. Approving publishes through the same path as
auto-publish; rejecting blocks. **No authentication — this is a demo.** Real
integrations must gate these actions behind admin auth.

Case pages carry a 👍 공감 button (a reaction re-scores the content and can promote
a `noindex` page into the sitemap) and a 🚩 신고 form (3 reports auto-hide → 404).

## Verified

`next build` succeeds (6 routes). Playwright drives the real browser through two
suites: clean-publish → case page (JSON-LD) → PII-block → sitemap pickup (6/6),
and queued → admin approve → reaction persist → 3 reports auto-hide → admin report
queue (7/7).
