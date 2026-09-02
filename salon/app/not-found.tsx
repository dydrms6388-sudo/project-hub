import Link from "next/link";

export default function NotFound() {
  return (
    <div style={{ paddingTop: 32 }}>
      <h1>찾을 수 없습니다</h1>
      <p className="sub">삭제되었거나 주소가 잘못된 페이지입니다.</p>
      <Link className="btn btn-block" href="/">
        오늘 예약으로
      </Link>
    </div>
  );
}
