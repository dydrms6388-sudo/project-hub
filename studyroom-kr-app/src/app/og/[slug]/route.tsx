import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { categories, site } from "@/site.config";
import { getTool, tools } from "@/tools/registry";

export const runtime = "nodejs";
export const dynamicParams = false;
export function generateStaticParams() {
  return tools.map((t) => ({ slug: t.slug }));
}

async function loadFont() {
  try {
    return await readFile(path.join(process.cwd(), "public/fonts/Pretendard-Bold.otf"));
  } catch {
    return null; // 폰트 없으면 시스템 폴백(한글 깨질 수 있음 → public/fonts/README 참고)
  }
}

export async function GET(_: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const t = getTool(slug);
  const title = t?.title ?? site.name;
  const desc = t?.description ?? site.description;
  const cat = t ? categories[t.category] : { label: "", color: "#16181d", bg: "#f7f7f5" };
  const font = await loadFont();

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 64, background: "#ffffff", fontFamily: font ? "Pretendard" : "sans-serif" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 16, height: 16, borderRadius: 4, background: cat.color }} />
          <div style={{ fontSize: 28, color: cat.color }}>{cat.label}</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ fontSize: 84, fontWeight: 700, color: "#16181d", lineHeight: 1.1, letterSpacing: -2 }}>{title}</div>
          <div style={{ fontSize: 30, color: "#6b7280", lineHeight: 1.4 }}>{desc.slice(0, 60)}</div>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 26, color: "#6b7280" }}>
          <span>{site.name}</span>
          <span>{site.url.replace(/^https?:\/\//, "")}</span>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      fonts: font ? [{ name: "Pretendard", data: font, weight: 700, style: "normal" }] : undefined,
    }
  );
}
