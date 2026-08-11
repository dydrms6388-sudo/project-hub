-- 하루치 — 시스템 기본 카테고리 시드
--
-- packages/categorizer/src/categories.ts 의 SEED_CATEGORIES 와 1:1 로 대응한다.
-- 둘이 어긋나면 분류 결과가 존재하지 않는 카테고리를 가리키게 되므로
-- scripts/check-seed-sync.mjs 가 CI 에서 양쪽을 대조한다.
--
-- 시드 규칙 200여 개는 DB 에 넣지 않는다. 스펙 4-3 의 3단계는 "내장" 휴리스틱이라
-- 코드에 있어야 배포와 함께 갱신되고, 사용자별 규칙(category_rules)과 섞이지 않는다.

-- 시스템 카테고리를 코드의 슬러그로 되찾기 위한 열쇠.
-- 원장별 카테고리(ledger_id 있음)에는 null 이다.
alter table public.categories add column if not exists system_key text;

create unique index if not exists categories_system_key_idx
  on public.categories (system_key)
  where system_key is not null;

-- 부모 연결에 방금 만든 행의 id 가 필요하다. 한 문장 안에서는 볼 수 없으므로
-- 시드를 임시 테이블에 펼쳐 두고 두 번에 나눠 쓴다.
create temporary table haruchi_seed_categories (
  system_key text primary key,
  name text not null,
  kind text not null,
  is_fixed boolean not null,
  sort_order int not null,
  parent_key text
);

insert into haruchi_seed_categories
  (system_key, name, kind, is_fixed, sort_order, parent_key)
values
  ('food', '식비', 'expense', false, 10, null),
  ('food.cafe', '카페·음료', 'expense', false, 11, 'food'),
  ('food.delivery', '배달', 'expense', false, 12, 'food'),
  ('food.convenience', '편의점', 'expense', false, 13, 'food'),
  ('food.dining', '외식', 'expense', false, 14, 'food'),
  ('food.grocery', '장보기', 'expense', false, 15, 'food'),
  ('transport', '교통', 'expense', false, 20, null),
  ('transport.transit', '대중교통', 'expense', false, 21, 'transport'),
  ('transport.taxi', '택시', 'expense', false, 22, 'transport'),
  ('transport.fuel', '주유', 'expense', false, 23, 'transport'),
  ('transport.parking', '주차·통행료', 'expense', false, 24, 'transport'),
  ('home', '주거·통신', 'expense', true, 30, null),
  ('home.rent', '월세·관리비', 'expense', true, 31, 'home'),
  ('home.utility', '공과금', 'expense', true, 32, 'home'),
  ('home.telecom', '통신비', 'expense', true, 33, 'home'),
  ('shopping', '쇼핑', 'expense', false, 40, null),
  ('shopping.online', '온라인쇼핑', 'expense', false, 41, 'shopping'),
  ('shopping.fashion', '의류·패션', 'expense', false, 42, 'shopping'),
  ('shopping.beauty', '뷰티·미용', 'expense', false, 43, 'shopping'),
  ('shopping.electronics', '가전·디지털', 'expense', false, 44, 'shopping'),
  ('shopping.household', '생활용품', 'expense', false, 45, 'shopping'),
  ('leisure', '문화·여가', 'expense', false, 50, null),
  ('leisure.subscription', '구독', 'expense', true, 51, 'leisure'),
  ('leisure.movie', '영화·공연', 'expense', false, 52, 'leisure'),
  ('leisure.game', '게임', 'expense', false, 53, 'leisure'),
  ('leisure.book', '도서', 'expense', false, 54, 'leisure'),
  ('leisure.travel', '여행·숙박', 'expense', false, 55, 'leisure'),
  ('leisure.fitness', '운동', 'expense', false, 56, 'leisure'),
  ('health', '의료·건강', 'expense', false, 60, null),
  ('health.clinic', '병원', 'expense', false, 61, 'health'),
  ('health.pharmacy', '약국', 'expense', false, 62, 'health'),
  ('education', '교육', 'expense', false, 70, null),
  ('finance', '보험·금융', 'expense', true, 80, null),
  ('finance.insurance', '보험료', 'expense', true, 81, 'finance'),
  ('finance.loan', '대출이자', 'expense', true, 82, 'finance'),
  ('finance.fee', '수수료', 'expense', false, 83, 'finance'),
  ('social', '경조사·선물', 'expense', false, 90, null),
  ('pet', '반려동물', 'expense', false, 91, null),
  ('baby', '육아', 'expense', false, 92, null),
  ('etc', '기타', 'expense', false, 99, null),
  ('income', '수입', 'income', false, 100, null),
  ('income.salary', '급여', 'income', false, 101, 'income'),
  ('income.refund', '환급·환불', 'income', false, 102, 'income'),
  ('income.etc', '기타수입', 'income', false, 103, 'income'),
  ('transfer', '이체', 'transfer', false, 110, null)
;

insert into public.categories (ledger_id, parent_id, name, kind, is_fixed, sort_order, system_key)
select null, null, seed.name, seed.kind, seed.is_fixed, seed.sort_order, seed.system_key
  from haruchi_seed_categories seed
    on conflict (system_key) where system_key is not null do nothing;

update public.categories child
   set parent_id = parent.id
  from haruchi_seed_categories seed
  join public.categories parent on parent.system_key = seed.parent_key
 where child.system_key = seed.system_key
   and child.parent_id is distinct from parent.id;

drop table haruchi_seed_categories;
