import { describe, expect, it } from "vitest";
import { safeHref, validateContact, validateHttpsUrl } from "@/lib/validation/contact";

describe("validateContact", () => {
  it("카카오 오픈채팅 URL 만 허용하고 정규화한다", () => {
    expect(validateContact("kakao_openchat", " https://open.kakao.com/o/sAbC123 ")).toMatchObject({
      ok: true,
      url: "https://open.kakao.com/o/sAbC123",
    });
    expect(validateContact("kakao_openchat", "https://open.kakao.com/o/sAbC123?x=1").ok).toBe(false);
    expect(validateContact("kakao_openchat", "https://open.kakao.com.evil.com/o/abcd").ok).toBe(false);
    expect(validateContact("kakao_openchat", "http://open.kakao.com/o/abcd").ok).toBe(false);
  });

  it("아이디를 플랫폼 URL 로 변환한다", () => {
    expect(validateContact("instagram", "@Between_KR")).toMatchObject({ ok: true, url: "https://instagram.com/between_kr" });
    expect(validateContact("telegram", "between_kr")).toMatchObject({ ok: true, url: "https://t.me/between_kr" });
    expect(validateContact("line", "my.line-id")).toMatchObject({ ok: true, url: "https://line.me/ti/p/~my.line-id" });
    expect(validateContact("telegram", "ab").ok).toBe(false);
    expect(validateContact("instagram", "a..b").ok).toBe(false);
  });

  it("플랫폼 URL 의 호스트를 확인한다", () => {
    expect(validateContact("instagram", "https://www.instagram.com/someone/")).toMatchObject({ ok: true });
    expect(validateContact("instagram", "https://instagram.evil.com/someone").ok).toBe(false);
    expect(validateContact("telegram", "https://t.me/joinchat_x?start=1").ok).toBe(false);
  });

  it.each([
    "javascript:alert(1)",
    "data:text/html,<script>alert(1)</script>",
    "http://example.com",
    "https://user:pw@example.com",
    "https://127.0.0.1/x",
    "https://[::1]/",
    "https://localhost/",
    "https://example.com:8443/",
    "https://bit.ly/abc",
    "https://xn--80ak6aa92e.com/",
    "https://example.com/?redirect=https://evil.com",
    "https://example.com/?u=https%3A%2F%2Fevil.com",
    'https://example.com/"onmouseover="x',
    "https://exa mple.com",
    "https://intranet",
  ])("위험한 링크 거부: %s", (url) => {
    expect(validateHttpsUrl(url).ok).toBe(false);
  });

  it("일반 https 링크는 허용하고 fragment 를 제거한다", () => {
    expect(validateHttpsUrl("https://example.com/me#top")).toMatchObject({ ok: true, url: "https://example.com/me" });
  });

  it("safeHref 는 https 가 아닌 값을 렌더링하지 않는다", () => {
    expect(safeHref("https://open.kakao.com/o/abc")).toBe("https://open.kakao.com/o/abc");
    expect(safeHref("javascript:alert(1)")).toBeNull();
    expect(safeHref("not a url")).toBeNull();
  });
});
