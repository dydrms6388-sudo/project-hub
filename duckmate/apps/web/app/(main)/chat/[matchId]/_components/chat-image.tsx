"use client";

// =============================================================================
// E3 · 채팅 이미지 렌더 — chat-images 버킷은 비공개라 signed URL 로만 보인다.
//   00006 storage_chat_images_select_participant 가 참여자만 열람을 허용하므로
//   브라우저 세션으로 직접 서명 URL 을 만든다(서버 프록시 불필요).
//   실패 시 깨진 이미지 대신 텍스트 폴백 (12_flows §8.2 원칙 준용).
// =============================================================================

import * as React from "react";
import { createClient } from "@/lib/supabase/client";

const SIGNED_TTL_SEC = 60 * 10;

export function ChatImage({ imagePath, alt }: { imagePath: string; alt: string }) {
  const [url, setUrl] = React.useState<string | null>(null);
  const [failed, setFailed] = React.useState(false);

  React.useEffect(() => {
    let alive = true;
    const objectKey = imagePath.replace(/^chat-images\//, "");

    void (async () => {
      try {
        const supabase = createClient();
        const { data, error } = await supabase.storage
          .from("chat-images")
          .createSignedUrl(objectKey, SIGNED_TTL_SEC);
        if (!alive) return;
        if (error || !data?.signedUrl) {
          setFailed(true);
          return;
        }
        setUrl(data.signedUrl);
      } catch {
        if (alive) setFailed(true);
      }
    })();

    return () => {
      alive = false;
    };
  }, [imagePath]);

  if (failed) {
    return <span className="text-body-sm text-ink-muted">사진을 불러오지 못했어요.</span>;
  }
  if (!url) {
    return (
      <span className="block h-40 w-40 animate-pulse rounded-xl bg-primary-tint motion-reduce:animate-none" />
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- signed URL 은 next/image 최적화 대상 아님
    <img
      src={url}
      alt={alt}
      onError={() => setFailed(true)}
      className="max-h-64 w-auto max-w-full rounded-xl object-cover"
    />
  );
}
