import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { LEGAL_VAR_KEYS, fillPlaceholders, isPlaceholder } from "@/config/company";
import { parseFrontmatter, remainingPlaceholders, renderMarkdown } from "./markdown";

const CONTENT_DIR = join(__dirname, "../../content/legal");
const docFiles = () => readdirSync(CONTENT_DIR).filter((f) => f.endsWith(".md") && f !== "README.md");

const FILLED: Record<string, string> = Object.fromEntries(LEGAL_VAR_KEYS.map((k) => [k, k === "SERVICE_NAME" ? "덕메이트" : `값_${k}`]));

describe("법적 변수 치환", () => {
  it("값이 있는 키는 치환하고 플레이스홀더·알 수 없는 키는 토큰을 남긴다", () => {
    const out = fillPlaceholders("{{COMPANY_NAME}}·{{SERVICE_NAME}}·{{UNKNOWN_KEY}}·{{DOMAIN}}", { ...FILLED, DOMAIN: "{{DOMAIN}}" });
    expect(out).toBe("값_COMPANY_NAME·덕메이트·{{UNKNOWN_KEY}}·{{DOMAIN}}");
  });

  it("isPlaceholder: 빈 값·{{KEY}} 형식만 true", () => {
    expect(isPlaceholder("")).toBe(true);
    expect(isPlaceholder("{{COMPANY_NAME}}")).toBe(true);
    expect(isPlaceholder("주식회사 덕메이트")).toBe(false);
    expect(isPlaceholder(null)).toBe(true);
  });

  it("README 변수 18개 외의 토큰은 문서 6개 어디에도 없다", () => {
    const allowed = new Set<string>(LEGAL_VAR_KEYS);
    for (const f of docFiles()) {
      const src = readFileSync(join(CONTENT_DIR, f), "utf8");
      const unknown = remainingPlaceholders(src).filter((t) => !allowed.has(t.slice(2, -2)));
      expect(unknown, `${f} 에 알 수 없는 토큰`).toEqual([]);
      // 18개를 전부 채우면 토큰이 남지 않는다
      expect(remainingPlaceholders(fillPlaceholders(src, FILLED)), `${f} 치환 잔여`).toEqual([]);
    }
  });
});

describe("frontmatter · 마크다운 렌더", () => {
  it("문서 6개의 frontmatter 는 README 스키마 6키를 갖고 slug 가 파일명과 같다", () => {
    for (const f of docFiles()) {
      const { data } = parseFrontmatter(readFileSync(join(CONTENT_DIR, f), "utf8"));
      expect(data.slug).toBe(f.replace(/\.md$/, ""));
      for (const k of ["title", "slug", "version", "effective_date", "last_updated", "consent_required"]) expect(data[k], `${f}.${k}`).toBeTruthy();
      expect(data.version).toMatch(/^\d+\.\d+\.\d+$/);
    }
  });

  it("heading id·목차(h2/h3)·표 래퍼·h1 sr-only", () => {
    const { html, toc } = renderMarkdown("# 제목\n\n## 제1장 총칙\n\n### 제1조 목적\n\n| a | b |\n|---|---|\n| 1 | 2 |\n\n## 제1장 총칙\n");
    expect(html).toContain('<h1 id="제목" class="sr-only">');
    expect(html).toContain('<h2 id="제1장-총칙">');
    expect(html).toContain('<h2 id="제1장-총칙-2">');
    expect(html).toContain('<div class="table-wrap"><table>');
    expect(html).toContain('<th scope="col">');
    expect(toc.map((t) => [t.depth, t.id])).toEqual([
      [2, "제1장-총칙"],
      [3, "제1조-목적"],
      [2, "제1장-총칙-2"],
    ]);
  });
});
