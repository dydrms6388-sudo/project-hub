import type { Metadata } from 'next';
import Link from 'next/link';
import { isSupabaseConfigured } from '@/lib/supabase/server';

export const metadata: Metadata = {
  title: '거래',
  description: '등록한 거래를 회계월 기준으로 확인합니다.',
};

/**
 * 거래 목록.
 *
 * 저장소가 연결되기 전에는 빈 목록을 보여주는 대신 다음 행동을 제시한다
 * (스펙 6장: 빈 화면은 사과하지 말고 다음 행동을 제시할 것).
 */
export default function TransactionsPage() {
  const configured = isSupabaseConfigured();

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold tracking-tight">거래</h1>

      <div className="rounded-xl border border-line bg-surface p-6">
        <p className="text-sm leading-relaxed text-muted">
          {configured
            ? '아직 등록한 거래가 없어요. 문자를 붙여넣으면 여기에 쌓입니다.'
            : '저장소가 연결되기 전이라 등록한 거래를 아직 보관하지 않습니다. 붙여넣기 화면에서는 지금도 문자를 읽어볼 수 있어요.'}
        </p>
        <Link
          href="/paste"
          className="mt-5 inline-block rounded-md bg-safe px-4 py-2 text-sm font-medium text-white"
        >
          붙여넣기
        </Link>
      </div>
    </div>
  );
}
