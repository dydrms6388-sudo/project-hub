import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import * as O from "@/lib/domain/options";
import { isFieldPublic, PRIVATE_BY_DEFAULT } from "@/lib/domain/options";

// TS 선택지와 DB CHECK 제약이 어긋나면 저장이 실패한다 → 정의 동기화를 검사
const core = readFileSync("supabase/migrations/20261020000001_core_schema.sql", "utf8");
const security = readFileSync("supabase/migrations/20261020000002_security.sql", "utf8");

const column = (name: string) => {
  const m = core.match(new RegExp(`\\n  ${name} [^\\n]*(?:\\n    [^\\n]*)?`));
  if (!m) throw new Error(`column ${name} not found`);
  return [...m[0].matchAll(/'([a-z_]+)'/g)].map((x) => x[1]).sort();
};
const vals = (o: readonly { value: string }[]) => o.map((x) => x.value).sort();

describe("options ↔ DB 제약 동기화", () => {
  it.each([
    ["body_type", O.BODY_TYPES],
    ["position", O.POSITIONS],
    ["styles", O.STYLES],
    ["personality", O.PERSONALITIES],
    ["interests", O.INTERESTS],
    ["purposes", O.PURPOSES],
    ["active_times", O.ACTIVE_TIMES],
    ["smoking", O.SMOKING],
    ["drinking", O.DRINKING],
  ])("%s", (col, opts) => {
    expect(column(col as string)).toEqual(vals(opts as readonly { value: string }[]));
  });

  it("enum 타입", () => {
    const en = (t: string) => [...core.match(new RegExp(`create type public.${t} as enum \\(([^)]*)\\)`))![1].matchAll(/'([a-z_]+)'/g)].map((x) => x[1]).sort();
    expect(en("availability")).toEqual(vals(O.AVAILABILITY));
    expect(en("contact_kind")).toEqual(vals(O.CONTACT_KINDS));
    expect(en("report_reason")).toEqual(vals(O.REPORT_REASONS));
  });

  it("기본 비공개 필드가 DB field_public() 과 같다", () => {
    const m = security.match(/when p_field in \(([^)]*)\) then 'private'/)!;
    expect([...m[1].matchAll(/'([a-z_]+)'/g)].map((x) => x[1]).sort()).toEqual([...PRIVATE_BY_DEFAULT].sort());
    expect(isFieldPublic({}, "weight")).toBe(false);
    expect(isFieldPublic({}, "height")).toBe(true);
    expect(isFieldPublic({ weight: "public" }, "weight")).toBe(true);
  });
});
