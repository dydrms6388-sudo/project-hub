import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

// iOS "홈 화면에 추가" 아이콘. 모서리는 iOS가 알아서 둥글게 자른다.
export default function AppleIcon() {
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
            width: 86,
            height: 86,
            borderRadius: 999,
            border: "18px solid #ffffff",
          }}
        />
      </div>
    ),
    size
  );
}
