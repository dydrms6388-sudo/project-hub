#!/usr/bin/env node
// 사용: pnpm new-tool <slug> "<제목>" [category]
import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import path from "node:path";

const [slug, title, category = "text"] = process.argv.slice(2);
if (!slug || !title) {
  console.error('사용법: pnpm new-tool <slug> "<제목>" [text|image|file|calc|fun|dev]');
  process.exit(1);
}
const pascal = slug.split("-").map((s) => s[0].toUpperCase() + s.slice(1)).join("");
const dir = path.join("src/tools", slug);
if (existsSync(dir)) { console.error(`이미 존재: ${dir}`); process.exit(1); }
mkdirSync(dir, { recursive: true });

writeFileSync(path.join(dir, `${pascal}.tsx`), `"use client";
import { useState } from "react";

export default function ${pascal}() {
  const [value, setValue] = useState("");
  return (
    <div className="space-y-3">
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="입력"
        aria-label="${title} 입력"
        className="w-full rounded-lg border border-line px-3 py-2 outline-none focus:border-ink"
      />
      <p className="text-sm text-muted">TODO: ${title} 구현</p>
    </div>
  );
}
`);

const regPath = "src/tools/registry.ts";
const reg = readFileSync(regPath, "utf8");
const entry = `  {
    slug: "${slug}",
    title: "${title}",
    h1: "${title}",
    description: "TODO: 80~150자 설명. 무엇을 계산/변환하는지, 서버 전송 없음.",
    keywords: ["${title}"],
    category: "${category}",
    howto: ["TODO 1단계", "TODO 2단계", "TODO 3단계"],
    principle: "TODO: 원리와 근거. 문단은 빈 줄로 구분.",
    faq: [
      { q: "TODO 질문 1", a: "TODO 답 1" },
      { q: "TODO 질문 2", a: "TODO 답 2" },
      { q: "TODO 질문 3", a: "TODO 답 3" },
      { q: "TODO 질문 4", a: "TODO 답 4" },
      { q: "TODO 질문 5", a: "TODO 답 5" },
    ],
    related: [],
    component: () => import("@/tools/${slug}/${pascal}"),
  },
`;
const marker = "export const tools: ToolMeta[] = [\n";
if (!reg.includes(marker)) { console.error("registry.ts 마커를 찾지 못함"); process.exit(1); }
writeFileSync(regPath, reg.replace(marker, marker + entry));
console.log(`생성됨: ${dir}/${pascal}.tsx, registry.ts에 등록됨 → /tools/${slug}`);
