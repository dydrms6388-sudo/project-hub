import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { trajectoryPreview } from "@/lib/ogRecorder";

export const dynamic = "force-static";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "물리 실험실 — 40가지 인터랙티브 물리 시뮬레이션";

export default async function OgImage() {
  const picks = ["double-pendulum", "three-body", "billiards", "charged-particle-fields"];
  const previews = picks.map((s) => trajectoryPreview(s, 250, 250));
  const [bold, regular] = await Promise.all([
    readFile(join(process.cwd(), "src/app/fonts/Pretendard-Bold.otf")),
    readFile(join(process.cwd(), "src/app/fonts/Pretendard-Regular.otf")),
  ]);
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: "#0b0f19", padding: 56, fontFamily: "Pretendard" }}>
        <div style={{ display: "flex", gap: 22 }}>
          {previews.map((src, i) => (
            <div key={i} style={{ display: "flex", width: 250, height: 250, borderRadius: 16, border: "2px solid #1e293b", overflow: "hidden", alignItems: "center", justifyContent: "center" }}>
              {src ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={src} width={246} height={246} alt="" />
              ) : (
                <div style={{ fontSize: 80, color: "#38bdf8", display: "flex" }}>∿</div>
              )}
            </div>
          ))}
        </div>
        <div style={{ fontSize: 60, fontWeight: 700, color: "#f1f5f9", marginTop: 44 }}>물리 실험실</div>
        <div style={{ fontSize: 30, color: "#94a3b8", marginTop: 12, fontWeight: 400 }}>40가지 물리 현상을 방정식으로 직접 돌리는 인터랙티브 실험실</div>
      </div>
    ),
    { ...size, fonts: [{ name: "Pretendard", data: bold, weight: 700 }, { name: "Pretendard", data: regular, weight: 400 }] }
  );
}
