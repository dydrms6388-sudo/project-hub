import { ImageResponse } from "next/og";

export const size = { width: 64, height: 64 };
export const contentType = "image/png";

// 텍스트 없이 도형만 사용한다 (ImageResponse 기본 폰트에 한글 글리프가 없음).
export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#b4637a",
        }}
      >
        <div
          style={{
            width: 30,
            height: 30,
            borderRadius: 999,
            border: "7px solid #ffffff",
          }}
        />
      </div>
    ),
    size
  );
}
