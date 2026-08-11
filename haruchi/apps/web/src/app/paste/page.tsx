import type { Metadata } from 'next';
import { isSupabaseConfigured } from '@/lib/supabase/server';
import { PasteClient } from './paste-client';

export const metadata: Metadata = {
  title: '문자 붙여넣기',
  description: '카드 승인 문자를 붙여넣으면 거래로 정리해 드립니다. 로그인 없이 먼저 확인해 보세요.',
};

export default function PastePage() {
  return <PasteClient canSave={isSupabaseConfigured()} />;
}
