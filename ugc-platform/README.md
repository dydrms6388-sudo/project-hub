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

`apps/*` is reserved for demo/consumer services added in later phases.

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

**Phase 0 complete** — workspace + package scaffolding + `ugc_` schema
migration. See `DECISIONS.md` for what's implemented vs. deferred and
`packages/ugc-core/README.md` for the roadmap and integration steps.
