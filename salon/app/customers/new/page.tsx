import { CustomerForm } from "./CustomerForm";
import { requireOwner } from "@/lib/auth";
import { todayKST } from "@/lib/dates";

export const dynamic = "force-dynamic";

export default async function NewCustomerPage() {
  await requireOwner();

  return (
    <>
      <h1>신규 고객</h1>
      <p className="sub">방문 날짜를 넣으면 예약까지 함께 등록되고, 예약 확인 알림톡이 발송됩니다.</p>
      <CustomerForm today={todayKST()} />
    </>
  );
}
