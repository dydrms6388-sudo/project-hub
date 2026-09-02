import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import type { NextConfig } from "next";

/**
 * 두 가지 빌드 모드
 *  - 기본(Vercel 개별 프로젝트): 일반 Next.js. OG 이미지 라우트/SSG 전부 사용.
 *  - STATIC_EXPORT=1 (허브 리포 preview/ 선배포용): output:export + basePath.
 */
const isExport = process.env.STATIC_EXPORT === "1";
const basePath = process.env.STATIC_BASE_PATH ?? "";

/**
 * pdf.js 런타임 자산(worker / cmap / 표준폰트 / wasm)을 node_modules 에서 public/ 으로 복사한다.
 * CDN 을 참조하지 않고 **같은 오리진에서 로컬로** 서빙하기 위한 것이며,
 * 생성 산출물이므로 public/pdfjs 는 .gitignore 에 들어간다.
 * next.config 는 `next build` / `next dev` 시작 시 1회 평가되므로 여기서 복사한다.
 */
function vendorPdfjsAssets() {
  try {
    const require_ = createRequire(import.meta.url);
    const pkg = require_.resolve("pdfjs-dist/package.json");
    const root = path.dirname(pkg);
    const dest = path.join(process.cwd(), "public", "pdfjs");
    const version: string = JSON.parse(fs.readFileSync(pkg, "utf8")).version;
    const stamp = path.join(dest, ".version");
    if (fs.existsSync(stamp) && fs.readFileSync(stamp, "utf8") === version) return;

    fs.rmSync(dest, { recursive: true, force: true });
    fs.mkdirSync(dest, { recursive: true });
    fs.copyFileSync(
      path.join(root, "build", "pdf.worker.min.mjs"),
      path.join(dest, "pdf.worker.min.mjs"),
    );
    for (const dir of ["cmaps", "standard_fonts", "wasm", "iccs"]) {
      const from = path.join(root, dir);
      if (fs.existsSync(from)) fs.cpSync(from, path.join(dest, dir), { recursive: true });
    }
    fs.copyFileSync(path.join(root, "LICENSE"), path.join(dest, "LICENSE"));
    fs.writeFileSync(stamp, version);
  } catch (e) {
    console.warn("[pdfroom] pdf.js 자산 복사 실패:", e);
  }
}

/** qpdf-wasm 의 .wasm 을 public/wasm 으로 복사 (비밀번호 설정/해제 도구용) */
function vendorQpdfWasm() {
  try {
    const require_ = createRequire(import.meta.url);
    const wasm = require_.resolve("@neslinesli93/qpdf-wasm/dist/qpdf.wasm");
    const dest = path.join(process.cwd(), "public", "wasm");
    fs.mkdirSync(dest, { recursive: true });
    fs.copyFileSync(wasm, path.join(dest, "qpdf.wasm"));
  } catch (e) {
    console.warn("[pdfroom] qpdf.wasm 복사 실패:", e);
  }
}

vendorPdfjsAssets();
vendorQpdfWasm();

const nextConfig: NextConfig = {
  reactStrictMode: true,
  trailingSlash: true,
  // 클라이언트 번들에서 basePath 를 알아야 public/ 자산 URL 을 만들 수 있다.
  env: { NEXT_PUBLIC_BASE_PATH: basePath },
  ...(isExport
    ? { output: "export" as const, basePath, images: { unoptimized: true } }
    : {}),
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // qpdf-wasm(emscripten) 안의 Node 전용 분기가 번들에 새어나오지 않도록 차단
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        crypto: false,
        process: false,
      };
    }
    return config;
  },
  // ffmpeg.wasm / SharedArrayBuffer 를 쓰는 사이트만 CROSS_ORIGIN_ISOLATION=1 로 켠다.
  // credentialless 로 두어야 애드센스 등 외부 스크립트가 COEP 에 막히지 않는다.
  async headers() {
    if (process.env.CROSS_ORIGIN_ISOLATION !== "1") return [];
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Cross-Origin-Embedder-Policy", value: "credentialless" },
        ],
      },
    ];
  },
};

export default nextConfig;
