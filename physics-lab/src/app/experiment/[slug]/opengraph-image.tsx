import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { getExperiment, getCategory, experiments } from "@/lib/experiments";
import { trajectoryPreview } from "@/lib/ogRecorder";

export const dynamic = "force-static";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "물리 시뮬레이션 미리보기";

export function generateStaticParams() {
  return experiments.map((e) => ({ slug: e.slug }));
}

export default async function OgImage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const exp = getExperiment(slug);
  const cat = exp ? getCategory(exp.category) : undefined;
  const preview = trajectoryPreview(slug, 540, 540);
  const [bold, regular] = await Promise.all([
    readFile(join(process.cwd(), "src/app/fonts/Pretendard-Bold.otf")),
    readFile(join(process.cwd(), "src/app/fonts/Pretendard-Regular.otf")),
  ]);
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: "#0b0f19", padding: 48, alignItems: "center", gap: 44, fontFamily: "Pretendard" }}>
        <div style={{ display: "flex", width: 534, height: 534, borderRadius: 20, border: "2px solid #1e293b", background: "#0b0f19", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} width={530} height={530} alt="" />
          ) : (
            <div style={{ fontSize: 130, color: "#38bdf8" }}>∿</div>
          )}
        </div>
        <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
          <div style={{ fontSize: 26, color: "#38bdf8", fontWeight: 700 }}>물리실험실</div>
          <div style={{ fontSize: 52, fontWeight: 700, color: "#f1f5f9", lineHeight: 1.2, marginTop: 12 }}>{exp?.name ?? "물리 시뮬레이션"}</div>
          <div style={{ fontSize: 25, color: "#94a3b8", marginTop: 16, fontWeight: 400 }}>{`${cat?.label ?? ""} · 적분기 ${exp?.integrator ?? ""}`}</div>
          <div style={{ fontSize: 23, color: "#64748b", marginTop: 8, fontWeight: 400 }}>슬라이더로 조작하고 재생·정지하는 실시간 시뮬레이션</div>
        </div>
      </div>
    ),
    { ...size, fonts: [{ name: "Pretendard", data: bold, weight: 700 }, { name: "Pretendard", data: regular, weight: 400 }] }
  );
}
