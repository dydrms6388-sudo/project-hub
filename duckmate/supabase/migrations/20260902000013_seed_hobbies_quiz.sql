-- =============================================================================
-- 0013 — 참조 데이터 시드 (프로덕션 포함)
--   regions(수도권 66 + 시도 폴백 14) · hobby_categories 12(초기 노출 8) · hobbies 60
--   quiz_questions 10 · legal_documents 6 (v1.0.0) · skus 4 (비활성)
-- 재실행 안전(on conflict do update).
-- =============================================================================

-- ---------- regions ----------
insert into public.regions (code, sido, sigungu, sort_order) values
  -- 서울특별시 (11)
  ('11110','서울','종로구',1),('11140','서울','중구',2),('11170','서울','용산구',3),('11200','서울','성동구',4),
  ('11215','서울','광진구',5),('11230','서울','동대문구',6),('11260','서울','중랑구',7),('11290','서울','성북구',8),
  ('11305','서울','강북구',9),('11320','서울','도봉구',10),('11350','서울','노원구',11),('11380','서울','은평구',12),
  ('11410','서울','서대문구',13),('11440','서울','마포구',14),('11470','서울','양천구',15),('11500','서울','강서구',16),
  ('11530','서울','구로구',17),('11545','서울','금천구',18),('11560','서울','영등포구',19),('11590','서울','동작구',20),
  ('11620','서울','관악구',21),('11650','서울','서초구',22),('11680','서울','강남구',23),('11710','서울','송파구',24),
  ('11740','서울','강동구',25),
  -- 인천광역시 (28)
  ('28110','인천','중구',1),('28140','인천','동구',2),('28177','인천','미추홀구',3),('28185','인천','연수구',4),
  ('28200','인천','남동구',5),('28237','인천','부평구',6),('28245','인천','계양구',7),('28260','인천','서구',8),
  ('28710','인천','강화군',9),('28720','인천','옹진군',10),
  -- 경기도 (41) — 시 단위(구가 있는 시도 시 단위로만)
  ('41110','경기','수원시',1),('41130','경기','성남시',2),('41150','경기','의정부시',3),('41170','경기','안양시',4),
  ('41190','경기','부천시',5),('41210','경기','광명시',6),('41220','경기','평택시',7),('41250','경기','동두천시',8),
  ('41270','경기','안산시',9),('41280','경기','고양시',10),('41290','경기','과천시',11),('41310','경기','구리시',12),
  ('41360','경기','남양주시',13),('41370','경기','오산시',14),('41390','경기','시흥시',15),('41410','경기','군포시',16),
  ('41430','경기','의왕시',17),('41450','경기','하남시',18),('41460','경기','용인시',19),('41480','경기','파주시',20),
  ('41500','경기','이천시',21),('41550','경기','안성시',22),('41570','경기','김포시',23),('41590','경기','화성시',24),
  ('41610','경기','광주시',25),('41630','경기','양주시',26),('41650','경기','포천시',27),('41670','경기','여주시',28),
  ('41800','경기','연천군',29),('41820','경기','가평군',30),('41830','경기','양평군',31),
  -- 그 외 시/도: 시도 단위 폴백 행(세부 시군구는 수도권 외 확장 시 운영자가 추가)
  ('26000','부산','부산 전체',1),('27000','대구','대구 전체',1),('29000','광주','광주 전체',1),('30000','대전','대전 전체',1),
  ('31000','울산','울산 전체',1),('36000','세종','세종 전체',1),('51000','강원','강원 전체',1),('43000','충북','충북 전체',1),
  ('44000','충남','충남 전체',1),('52000','전북','전북 전체',1),('46000','전남','전남 전체',1),('47000','경북','경북 전체',1),
  ('48000','경남','경남 전체',1),('50000','제주','제주 전체',1)
on conflict (code) do update set sido = excluded.sido, sigungu = excluded.sigungu, sort_order = excluded.sort_order;

-- ---------- hobby_categories (12, A1 Top 8 = is_initial) ----------
insert into public.hobby_categories (id, slug, name, icon, is_initial, sort_order) values
  (1,  'performance', '공연·페스티벌·아이돌', '🎤', true,  1),
  (2,  'boardgame',   '보드게임·TRPG',        '🎲', true,  2),
  (3,  'fitness',     '러닝·클라이밍·헬스',   '🏃', true,  3),
  (4,  'anime',       '애니·웹툰·서브컬처',   '📺', true,  4),
  (5,  'gaming',      '게임',                 '🎮', true,  5),
  (6,  'cafe',        '카페투어·디저트·베이킹','☕', true,  6),
  (7,  'reading',     '독서·북클럽·글쓰기',   '📚', true,  7),
  (8,  'photo',       '사진·전시·영화',       '📷', true,  8),
  (9,  'coding',      '코딩·메이킹·디자인',   '💻', false, 9),
  (10, 'travel',      '여행·산책·캠핑',       '🧳', false, 10),
  (11, 'music',       '음악·악기·댄스',       '🎵', false, 11),
  (12, 'pets',        '반려동물·식물',        '🐾', false, 12)
on conflict (id) do update set slug = excluded.slug, name = excluded.name, icon = excluded.icon,
  is_initial = excluded.is_initial, sort_order = excluded.sort_order;

-- ---------- hobbies (60 = 12 × 5) ----------
insert into public.hobbies (id, slug, name, category_id, icon, sort_order) values
  -- 1 performance
  (1,  'idol',            '아이돌 덕질',        1, '💜', 1),
  (2,  'concert',         '콘서트·페스티벌',    1, '🎪', 2),
  (3,  'musical',         '뮤지컬·연극',        1, '🎭', 3),
  (4,  'fan_goods',       '굿즈·팬아트',        1, '🧸', 4),
  (5,  'indie_live',      '인디 공연·라이브',   1, '🎸', 5),
  -- 2 boardgame
  (6,  'boardgame',       '보드게임',           2, '🎲', 1),
  (7,  'trpg',            'TRPG',               2, '🐉', 2),
  (8,  'escape_room',     '방탈출·퍼즐',        2, '🔐', 3),
  (9,  'tcg',             'TCG·카드게임',       2, '🃏', 4),
  (10, 'chess_go',        '체스·바둑',          2, '♟️', 5),
  -- 3 fitness
  (11, 'running',         '러닝',               3, '🏃', 1),
  (12, 'climbing',        '클라이밍',           3, '🧗', 2),
  (13, 'gym',             '헬스·크로스핏',      3, '🏋️', 3),
  (14, 'hiking',          '등산·트레킹',        3, '⛰️', 4),
  (15, 'cycling',         '자전거',             3, '🚴', 5),
  -- 4 anime
  (16, 'anime',           '애니메이션',         4, '📺', 1),
  (17, 'webtoon',         '웹툰·만화',          4, '📖', 2),
  (18, 'cosplay',         '코스프레',           4, '🪄', 3),
  (19, 'vtuber',          '버튜버·스트리머',    4, '🎙️', 4),
  (20, 'figure',          '피규어·프라모델',    4, '🤖', 5),
  -- 5 gaming
  (21, 'pc_game',         'PC 게임',            5, '🖥️', 1),
  (22, 'console_game',    '콘솔 게임',          5, '🎮', 2),
  (23, 'mobile_game',     '모바일 게임',        5, '📱', 3),
  (24, 'rhythm_game',     '리듬게임',           5, '🎧', 4),
  (25, 'esports',         'e스포츠 관람',       5, '🏆', 5),
  -- 6 cafe
  (26, 'cafe_tour',       '카페투어',           6, '☕', 1),
  (27, 'dessert',         '디저트·베이커리',    6, '🍰', 2),
  (28, 'baking',          '베이킹',             6, '🥐', 3),
  (29, 'coffee',          '커피·홈카페',        6, '🫖', 4),
  (30, 'tea',             '차·티룸',            6, '🍵', 5),
  -- 7 reading
  (31, 'reading',         '독서',               7, '📚', 1),
  (32, 'bookclub',        '북클럽',             7, '🗣️', 2),
  (33, 'writing',         '글쓰기',             7, '✍️', 3),
  (34, 'bookstore',       '독립서점 탐방',      7, '🏬', 4),
  (35, 'essay',           '에세이·인문',        7, '📝', 5),
  -- 8 photo
  (36, 'photography',     '사진·출사',          8, '📷', 1),
  (37, 'film_camera',     '필름카메라',         8, '🎞️', 2),
  (38, 'exhibition',      '전시·미술관',        8, '🖼️', 3),
  (39, 'movie',           '영화',               8, '🎬', 4),
  (40, 'drama',           '드라마·OTT',         8, '📺', 5),
  -- 9 coding
  (41, 'coding',          '코딩·사이드프로젝트',9, '💻', 1),
  (42, 'maker',           '전자공작·3D프린팅',  9, '🔧', 2),
  (43, 'design',          '디자인·일러스트',    9, '🎨', 3),
  (44, 'ai_tools',        'AI 도구',            9, '🤖', 4),
  (45, 'productivity',    '생산성·노션',        9, '🗂️', 5),
  -- 10 travel
  (46, 'domestic_travel', '국내 여행',          10, '🚄', 1),
  (47, 'overseas_travel', '해외 여행',          10, '✈️', 2),
  (48, 'walking',         '산책·동네 탐방',     10, '🚶', 3),
  (49, 'camping',         '캠핑',               10, '🏕️', 4),
  (50, 'roadtrip',        '드라이브',           10, '🚗', 5),
  -- 11 music
  (51, 'instrument',      '악기 연주',          11, '🎹', 1),
  (52, 'singing',         '노래·노래방',        11, '🎤', 2),
  (53, 'band',            '밴드',               11, '🥁', 3),
  (54, 'vinyl',           'LP·음악 감상',       11, '💿', 4),
  (55, 'dance',           '댄스',               11, '💃', 5),
  -- 12 pets
  (56, 'dog',             '강아지',             12, '🐶', 1),
  (57, 'cat',             '고양이',             12, '🐱', 2),
  (58, 'plants',          '식물·가드닝',        12, '🪴', 3),
  (59, 'aquarium',        '물생활',             12, '🐠', 4),
  (60, 'small_pets',      '소동물',             12, '🐹', 5)
on conflict (id) do update set slug = excluded.slug, name = excluded.name, category_id = excluded.category_id,
  icon = excluded.icon, sort_order = excluded.sort_order;

-- ---------- quiz_questions (생활 궁합 10, 4지선다) ----------
insert into public.quiz_questions (id, key, category, text, options, weight, sort_order) values
  (1,  'plan_confirm',   'plan',    '약속 전날, 나는',
    '[{"value":1,"label":"확인 연락을 꼭 한다"},{"value":2,"label":"정해졌으면 안 해도 된다"},{"value":3,"label":"당일 아침에 확인한다"},{"value":4,"label":"상대가 하면 답한다"}]', 1.00, 1),
  (2,  'weekend_morning','rhythm',  '주말 아침, 나는',
    '[{"value":1,"label":"일찍 나가서 활동"},{"value":2,"label":"느긋하게 집에서"},{"value":3,"label":"계획 없이 즉흥"},{"value":4,"label":"밀린 잠 보충"}]', 1.00, 2),
  (3,  'reply_speed',    'contact', '메시지 답장은 보통',
    '[{"value":1,"label":"바로바로"},{"value":2,"label":"한두 시간 안에"},{"value":3,"label":"하루 안에"},{"value":4,"label":"생각날 때"}]', 1.20, 3),
  (4,  'social_battery', 'social',  '모임이 끝나면 나는',
    '[{"value":1,"label":"더 놀고 싶다"},{"value":2,"label":"딱 좋다"},{"value":3,"label":"혼자 충전이 필요하다"},{"value":4,"label":"다음날까지 피곤하다"}]', 1.00, 4),
  (5,  'spending',       'money',   '취미에 돈 쓸 때',
    '[{"value":1,"label":"아끼지 않는다"},{"value":2,"label":"정한 예산 안에서"},{"value":3,"label":"필요한 것만"},{"value":4,"label":"최소한만"}]', 0.80, 5),
  (6,  'conflict',       'talk',    '의견이 다르면',
    '[{"value":1,"label":"바로 말한다"},{"value":2,"label":"조심스럽게 꺼낸다"},{"value":3,"label":"시간을 두고 말한다"},{"value":4,"label":"그냥 넘어간다"}]', 1.20, 6),
  (7,  'first_meet',     'meet',    '처음 만난다면',
    '[{"value":1,"label":"카페에서 대화"},{"value":2,"label":"취미 활동을 같이"},{"value":3,"label":"온라인으로 먼저 충분히"},{"value":4,"label":"여럿이 같이"}]', 1.20, 7),
  (8,  'new_hobby',      'style',   '새 취미를 시작하면',
    '[{"value":1,"label":"장비부터 산다"},{"value":2,"label":"정보를 파고든다"},{"value":3,"label":"일단 해본다"},{"value":4,"label":"아는 사람 따라간다"}]', 0.80, 8),
  (9,  'tidiness',       'life',    '내 방은',
    '[{"value":1,"label":"항상 정리돼 있다"},{"value":2,"label":"대체로 정리"},{"value":3,"label":"필요할 때만 정리"},{"value":4,"label":"창작의 혼돈"}]', 0.80, 9),
  (10, 'day_rhythm',     'rhythm',  '나의 하루 리듬은',
    '[{"value":1,"label":"완전 아침형"},{"value":2,"label":"아침형에 가까움"},{"value":3,"label":"저녁형에 가까움"},{"value":4,"label":"완전 밤형"}]', 1.00, 10)
on conflict (id) do update set key = excluded.key, category = excluded.category, text = excluded.text,
  options = excluded.options, weight = excluded.weight, sort_order = excluded.sort_order;

-- ---------- legal_documents (v1.0.0, content_hash 는 mdx 커밋 시 B2/E5 가 갱신) ----------
insert into public.legal_documents (key, version, effective_at, content_hash, requires_reconsent) values
  ('terms',    '1.0.0', '2026-09-02 00:00:00+09', 'pending:terms@1.0.0',    false),
  ('privacy',  '1.0.0', '2026-09-02 00:00:00+09', 'pending:privacy@1.0.0',  false),
  ('location', '1.0.0', '2026-09-02 00:00:00+09', 'pending:location@1.0.0', false),
  ('youth',    '1.0.0', '2026-09-02 00:00:00+09', 'pending:youth@1.0.0',    false),
  ('business', '1.0.0', '2026-09-02 00:00:00+09', 'pending:business@1.0.0', false),
  ('refund',   '1.0.0', '2026-09-02 00:00:00+09', 'pending:refund@1.0.0',   false)
on conflict (key, version) do nothing;

-- ---------- skus (Phase 3 전까지 is_active=false) ----------
insert into public.skus (sku, kind, tier, item_type, item_qty, price_krw, display_terms, is_active) values
  ('plus_monthly', 'subscription', 'plus', null,        null, 9900,  '월 ₩9,900(부가세 포함) · 매월 자동 갱신 · 언제든 해지', false),
  ('pro_monthly',  'subscription', 'pro',  null,        null, 19900, '월 ₩19,900(부가세 포함) · 매월 자동 갱신 · 언제든 해지', false),
  ('superlike_5',  'item',         null,   'superlike', 5,    4900,  '슈퍼라이크 5개 · 만료 없음 · 사용 시작 후 청약철회 불가(미사용분 7일 내 가능)', false),
  ('boost_1h',     'item',         null,   'boost',     1,    3900,  '부스트 1시간 · 구매 후 90일 내 사용 · 발동 즉시 전량 사용 처리', false)
on conflict (sku) do update set price_krw = excluded.price_krw, display_terms = excluded.display_terms;
