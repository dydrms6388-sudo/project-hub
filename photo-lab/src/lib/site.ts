/**
 * 배포 도메인은 NEXT_PUBLIC_SITE_URL 환경변수로만 공급한다.
 * 하드코딩·폴백 금지 정책 — sitemap/robots처럼 절대 URL이 필수인 곳에서
 * 미설정 상태로 빌드하면 조용히 잘못된 산출물을 만드는 대신 즉시 실패시킨다.
 */
export function requiredSiteUrl(): string {
  const url = process.env.NEXT_PUBLIC_SITE_URL;
  if (!url) {
    throw new Error(
      "NEXT_PUBLIC_SITE_URL 이 설정되지 않았습니다. sitemap/robots 생성에는 배포 도메인이 필요합니다. 예: NEXT_PUBLIC_SITE_URL=https://photo-lab.example.com npm run build"
    );
  }
  return url.replace(/\/$/, "");
}
