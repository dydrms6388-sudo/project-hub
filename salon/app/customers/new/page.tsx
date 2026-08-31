import { createCustomer } from "@/app/actions";
import { todayKST } from "@/lib/dates";

export const dynamic = "force-dynamic";

export default function NewCustomerPage() {
  return (
    <>
      <h1>신규 고객</h1>
      <p className="sub">방문 날짜를 넣으면 예약(방문)까지 함께 등록돼요.</p>

      <form className="plain" action={createCustomer}>
        <div className="field">
          <label htmlFor="name">이름 *</label>
          <input id="name" name="name" type="text" required autoComplete="off" />
        </div>
        <div className="field">
          <label htmlFor="phone">연락처 *</label>
          <input id="phone" name="phone" type="tel" required placeholder="010-0000-0000" autoComplete="off" />
        </div>

        <div className="grid2">
          <div className="field">
            <label htmlFor="service_type">시술 종류</label>
            <select id="service_type" name="service_type" defaultValue="extension">
              <option value="extension">붙임머리</option>
              <option value="wig">가발</option>
              <option value="other">기타</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="price">가격 (원)</label>
            <input id="price" name="price" type="number" inputMode="numeric" min="0" step="1000" />
          </div>
        </div>

        <div className="grid2">
          <div className="field">
            <label htmlFor="visited_at">방문 날짜</label>
            <input id="visited_at" name="visited_at" type="date" defaultValue={todayKST()} />
          </div>
          <div className="field">
            <label htmlFor="reserved_time">시간</label>
            <input id="reserved_time" name="reserved_time" type="time" />
          </div>
        </div>

        <div className="field">
          <label htmlFor="memo">메모</label>
          <textarea id="memo" name="memo" placeholder="모발 상태, 요청사항 등" />
        </div>

        <label className="check">
          <input type="checkbox" name="consent_marketing" />
          마케팅 수신 동의 (리터치 안내 등)
        </label>
        <label className="check">
          <input type="checkbox" name="consent_photo" />
          사진 활용 동의
        </label>

        <button className="btn btn-block" style={{ marginTop: 12 }}>
          등록하기
        </button>
      </form>
    </>
  );
}
