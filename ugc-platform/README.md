# ugc-platform

Standalone npm workspace for **`@ggu/ugc-core`** — the shared "유저 제출 →
자동검수 → 공개 → SEO 색인" engine (아이디어 B) — and the services that consume it.

> **This directory is isolated from the tomatoeggcat static site.** The static
> deploy pipeline (`gen-pages.mjs`, `projects.json`, `vercel.json`) never reads
> or writes anything under `ugc-platform/`. It lives here only for repo
> convenience; it is a separate project with its own toolchain and can be
> `git mv`-ed into its own repository at any time without touching the site.

## Layout

```
ugc-platform/
├─ package.json            # npm workspaces root
├─ tsconfig.base.json      # shared strict TS config
├─ DECISIONS.md            # running log of design decisions
└─ packages/
   └─ ugc-core/            # @ggu/ugc-core — the headless engine
      ├─ src/              # config, ports, stages (submit/moderate/publish/…)
      ├─ supabase/migrations/   # ugc_* schema
      └─ README.md         # per-app integration guide
```

`apps/demo` is a runnable Next.js E2E demo of the engine (see its README).

## Develop

```bash
cd ugc-platform
npm install
npm run typecheck   # tsc --noEmit across the workspace
npm test            # vitest
```

Requires Node ≥ 20. No network/services needed for typecheck or tests — the
pipeline runs against an in-memory store adapter.

## Status

**Phases 0–2 complete** — package scaffolding + `ugc_` schema (P0); submit/moderate
implementation, Supabase adapter, batched LLM classifier, embedding dedup, 43-case
test suite (P1); and a runnable Next.js E2E demo (P2). See `DECISIONS.md` for the
full log and `packages/ugc-core/README.md` for the roadmap and integration steps.
