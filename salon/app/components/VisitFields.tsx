"use client";

// 신규 고객 등록과 예약 추가에서 함께 쓰는 방문 입력 필드.
export function VisitFields({
  today,
  dateRequired = false,
  idPrefix = "",
}: {
  today: string;
  dateRequired?: boolean;
  idPrefix?: string;
}) {
  const id = (name: string) => `${idPrefix}${name}`;
  return (
    <>
      <div className="grid2">
        <div className="field">
          <label htmlFor={id("visited_at")}>
            방문 날짜{dateRequired ? " *" : ""}
          </label>
          <input
            id={id("visited_at")}
            name="visited_at"
            type="date"
            required={dateRequired}
            defaultValue={today}
          />
        </div>
        <div className="field">
          <label htmlFor={id("reserved_time")}>시간</label>
          <input id={id("reserved_time")} name="reserved_time" type="time" />
        </div>
      </div>

      <div className="grid2">
        <div className="field">
          <label htmlFor={id("service_type")}>시술 종류</label>
          <select id={id("service_type")} name="service_type" defaultValue="extension">
            <option value="extension">붙임머리</option>
            <option value="wig">가발</option>
            <option value="other">기타</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor={id("price")}>가격 (원)</label>
          <input
            id={id("price")}
            name="price"
            type="text"
            inputMode="numeric"
            autoComplete="off"
            placeholder="150000"
          />
        </div>
      </div>

      <div className="field">
        <label htmlFor={id("memo")}>메모</label>
        <textarea
          id={id("memo")}
          name="memo"
          maxLength={500}
          placeholder="모발 상태, 요청사항 등"
        />
      </div>
    </>
  );
}
