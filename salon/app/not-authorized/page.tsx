import Link from "next/link";

export const dynamic = "force-dynamic";

// 로그인은 됐지만 owners 테이블에 없는 계정. RLS가 이미 막지만 안내를 명확히 한다.
export default function NotAuthorizedPage() {
  return (
    <div style={{ paddingTop: 32 }}>
      <h1>접근 권한이 없습니다</h1>
      <p className="sub">
        이 계정은 정화 머리방 운영자로 등록되어 있지 않습니다. 다른 계정으로
        로그인했는지 확인해주세요.
      </p>
      <Link className="btn btn-block" href="/logout" prefetch={false}>
        로그아웃
      </Link>
    </div>
  );
}
