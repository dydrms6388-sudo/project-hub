/* thumbmaker-kr 템플릿 데이터 (자체 디자인 — 실존 브랜드/캐릭터/저작권 문구 없음)
 * 좌표는 캔버스 비율(rx,ry: 0~1), 크기는 min(W,H) 비율(size/strokeW/radius) 또는
 * W·H 비율(rw,rh)로 정의되어 어떤 프리셋 크기에도 맞게 적용됩니다. */
window.TM_TEMPLATES = [
  /* ------------------------------ 유튜브 썸네일 ------------------------------ */
  {
    id: 'yt-impact-yellow', name: '임팩트 옐로', cat: ['youtube', 'og-image', 'blog'],
    bg: { type: 'linear', angle: 135, from: '#111827', to: '#312e81' },
    objects: [
      { type: 'shape', shape: 'rect', rx: 0.5, ry: 0.5, rw: 0.955, rh: 0.92, fill: 'none', stroke: '#facc15', strokeW: 0.012, radius: 0.03 },
      { type: 'text', text: '충격적인 결과', rx: 0.5, ry: 0.4, size: 0.22, font: 'Black Han Sans', color: '#facc15', stroke: '#000000', strokeW: 0.018, shadow: true },
      { type: 'text', text: '3분 만에 정리해 드립니다', rx: 0.5, ry: 0.63, size: 0.085, font: 'Pretendard', weight: 700, color: '#ffffff' },
      { type: 'emoji', char: '🔥', rx: 0.88, ry: 0.18, size: 0.2 }
    ]
  },
  {
    id: 'yt-red-badge', name: '레드 뱃지', cat: ['youtube', 'og-image'],
    bg: { type: 'solid', color: '#f8fafc' },
    objects: [
      { type: 'shape', shape: 'rect', rx: 0.5, ry: 0.5, rw: 1, rh: 1, fill: 'none', stroke: '#e11d48', strokeW: 0.05, radius: 0 },
      { type: 'shape', shape: 'rect', rx: 0.22, ry: 0.15, rw: 0.3, rh: 0.16, fill: '#e11d48', radius: 0.04 },
      { type: 'text', text: '필수 시청', rx: 0.22, ry: 0.15, size: 0.075, font: 'Do Hyeon', color: '#ffffff' },
      { type: 'text', text: '모르면 손해보는\n핵심 정리', rx: 0.5, ry: 0.55, size: 0.16, font: 'Black Han Sans', color: '#0f172a', lineHeight: 1.15 },
      { type: 'emoji', char: '👀', rx: 0.85, ry: 0.8, size: 0.18 }
    ]
  },
  {
    id: 'yt-split', name: '대각 스플릿', cat: ['youtube', 'banner'],
    bg: { type: 'linear', angle: 20, from: '#0ea5e9', to: '#1e3a8a' },
    objects: [
      { type: 'shape', shape: 'rect', rx: 0.78, ry: 0.5, rw: 0.7, rh: 1.6, fill: '#0f172a', rot: 14, opacity: 0.85 },
      { type: 'text', text: 'VS', rx: 0.5, ry: 0.5, size: 0.2, font: 'Black Han Sans', color: '#facc15', stroke: '#000000', strokeW: 0.014 },
      { type: 'text', text: '선택 1', rx: 0.2, ry: 0.5, size: 0.12, font: 'Jua', color: '#ffffff', shadow: true },
      { type: 'text', text: '선택 2', rx: 0.8, ry: 0.5, size: 0.12, font: 'Jua', color: '#ffffff', shadow: true }
    ]
  },
  {
    id: 'yt-minimal', name: '미니멀 화이트', cat: ['youtube', 'blog', 'og-image'],
    bg: { type: 'solid', color: '#ffffff' },
    objects: [
      { type: 'shape', shape: 'line', rx: 0.5, ry: 0.66, rw: 0.32, rh: 0.012, fill: '#e11d48' },
      { type: 'text', text: '오늘의 주제', rx: 0.5, ry: 0.32, size: 0.07, font: 'Pretendard', weight: 700, color: '#64748b' },
      { type: 'text', text: '깔끔하게 한 줄 제목', rx: 0.5, ry: 0.5, size: 0.13, font: 'Noto Sans KR', weight: 900, color: '#0f172a' }
    ]
  },
  {
    id: 'yt-numbering', name: '넘버링 리스트', cat: ['youtube', 'blog'],
    bg: { type: 'linear', angle: 90, from: '#022c22', to: '#065f46' },
    objects: [
      { type: 'shape', shape: 'circle', rx: 0.16, ry: 0.5, rw: 0.28, rh: 0.5, fill: '#facc15' },
      { type: 'text', text: '5', rx: 0.16, ry: 0.5, size: 0.28, font: 'Black Han Sans', color: '#065f46' },
      { type: 'text', text: '가지 꿀팁\n총정리', rx: 0.62, ry: 0.5, size: 0.15, font: 'Black Han Sans', color: '#ffffff', align: 'left', lineHeight: 1.2 }
    ]
  },
  /* ------------------------------ 인스타그램 ------------------------------ */
  {
    id: 'ig-gradient-pop', name: '그라데이션 팝', cat: ['instagram', 'story', 'kakao-cover'],
    bg: { type: 'linear', angle: 135, from: '#f472b6', to: '#7c3aed' },
    objects: [
      { type: 'shape', shape: 'rect', rx: 0.5, ry: 0.5, rw: 0.86, rh: 0.86, fill: 'none', stroke: '#ffffff', strokeW: 0.01, radius: 0.05 },
      { type: 'text', text: '오늘의 기록', rx: 0.5, ry: 0.42, size: 0.13, font: 'Jua', color: '#ffffff', shadow: true },
      { type: 'text', text: '@my_account', rx: 0.5, ry: 0.85, size: 0.045, font: 'Pretendard', weight: 700, color: '#ffffff', opacity: 0.9 },
      { type: 'emoji', char: '✨', rx: 0.78, ry: 0.28, size: 0.12 }
    ]
  },
  {
    id: 'ig-polaroid', name: '폴라로이드 프레임', cat: ['instagram', 'profile'],
    bg: { type: 'solid', color: '#e7e5e4' },
    objects: [
      { type: 'shape', shape: 'rect', rx: 0.5, ry: 0.47, rw: 0.74, rh: 0.74, fill: '#ffffff', radius: 0.008, rot: -3 },
      { type: 'shape', shape: 'rect', rx: 0.5, ry: 0.43, rw: 0.64, rh: 0.55, fill: '#94a3b8', rot: -3 },
      { type: 'text', text: '사진을 여기에 올려보세요', rx: 0.5, ry: 0.43, size: 0.045, font: 'Pretendard', weight: 700, color: '#f1f5f9', rot: -3 },
      { type: 'text', text: '어느 멋진 날', rx: 0.5, ry: 0.78, size: 0.07, font: 'Nanum Pen Script', color: '#334155', rot: -3 }
    ]
  },
  {
    id: 'ig-checklist', name: '체크리스트 카드', cat: ['instagram', 'blog'],
    bg: { type: 'solid', color: '#fef9c3' },
    objects: [
      { type: 'text', text: '저장 필수 체크리스트', rx: 0.5, ry: 0.16, size: 0.085, font: 'Do Hyeon', color: '#713f12' },
      { type: 'shape', shape: 'line', rx: 0.5, ry: 0.24, rw: 0.7, rh: 0.008, fill: '#ca8a04' },
      { type: 'text', text: '✅ 첫 번째 항목\n✅ 두 번째 항목\n✅ 세 번째 항목\n✅ 네 번째 항목', rx: 0.5, ry: 0.55, size: 0.065, font: 'Pretendard', weight: 700, color: '#422006', align: 'left', lineHeight: 1.7 }
    ]
  },
  /* ------------------------------ 스토리/세로형 ------------------------------ */
  {
    id: 'story-neon', name: '네온 나이트', cat: ['story', 'kakao-cover'],
    bg: { type: 'linear', angle: 180, from: '#0f172a', to: '#1e1b4b' },
    objects: [
      { type: 'emoji', char: '🌙', rx: 0.75, ry: 0.14, size: 0.18 },
      { type: 'text', text: 'GOOD\nNIGHT', rx: 0.5, ry: 0.42, size: 0.19, font: 'Black Han Sans', color: '#a5b4fc', lineHeight: 1.1, shadow: true },
      { type: 'text', text: '오늘 하루도 수고했어요', rx: 0.5, ry: 0.62, size: 0.06, font: 'Nanum Pen Script', color: '#e0e7ff' },
      { type: 'shape', shape: 'line', rx: 0.5, ry: 0.72, rw: 0.3, rh: 0.006, fill: '#6366f1' }
    ]
  },
  /* ------------------------------ 짤/밈 ------------------------------ */
  {
    id: 'meme-classic', name: '클래식 밈 (위/아래)', cat: ['meme'],
    bg: { type: 'solid', color: '#111111' },
    objects: [
      { type: 'text', text: '월요일 아침의 나', rx: 0.5, ry: 0.11, size: 0.12, font: 'Black Han Sans', color: '#ffffff', stroke: '#000000', strokeW: 0.016, memeId: 'meme-top' },
      { type: 'emoji', char: '😴', rx: 0.5, ry: 0.5, size: 0.42 },
      { type: 'text', text: '5분만 더...', rx: 0.5, ry: 0.89, size: 0.12, font: 'Black Han Sans', color: '#ffffff', stroke: '#000000', strokeW: 0.016, memeId: 'meme-bottom' }
    ]
  },
  {
    id: 'meme-caption', name: '자막 바 짤', cat: ['meme', 'youtube'],
    bg: { type: 'solid', color: '#e2e8f0' },
    objects: [
      { type: 'text', text: '이미지를 올리면 완성', rx: 0.5, ry: 0.42, size: 0.06, font: 'Pretendard', weight: 700, color: '#94a3b8' },
      { type: 'shape', shape: 'rect', rx: 0.5, ry: 0.9, rw: 1, rh: 0.2, fill: '#000000', opacity: 0.75 },
      { type: 'text', text: '“여기에 자막을 입력”', rx: 0.5, ry: 0.9, size: 0.075, font: 'Jua', color: '#ffff00' }
    ]
  },
  /* ------------------------------ 명언 카드 ------------------------------ */
  {
    id: 'quote-serif', name: '명조 클래식', cat: ['quote-card', 'instagram'],
    bg: { type: 'solid', color: '#faf7f2' },
    objects: [
      { type: 'text', text: '“', rx: 0.5, ry: 0.16, size: 0.22, font: 'Nanum Myeongjo', weight: 800, color: '#b45309' },
      { type: 'text', text: '오늘 걷지 않으면\n내일은 뛰어야 한다', rx: 0.5, ry: 0.47, size: 0.085, font: 'Nanum Myeongjo', weight: 700, color: '#1c1917', lineHeight: 1.6 },
      { type: 'shape', shape: 'line', rx: 0.5, ry: 0.68, rw: 0.16, rh: 0.006, fill: '#b45309' },
      { type: 'text', text: '나에게 하는 말', rx: 0.5, ry: 0.76, size: 0.045, font: 'Nanum Myeongjo', weight: 400, color: '#78716c' }
    ]
  },
  {
    id: 'quote-dark', name: '다크 미니멀', cat: ['quote-card', 'og-image', 'story'],
    bg: { type: 'solid', color: '#0f172a' },
    objects: [
      { type: 'text', text: '멈추지 않는 한\n얼마나 천천히 가는지는\n중요하지 않다', rx: 0.5, ry: 0.46, size: 0.075, font: 'Noto Sans KR', weight: 700, color: '#f8fafc', lineHeight: 1.7 },
      { type: 'shape', shape: 'line', rx: 0.5, ry: 0.72, rw: 0.2, rh: 0.008, fill: '#38bdf8' },
      { type: 'text', text: 'DAILY QUOTE', rx: 0.5, ry: 0.8, size: 0.035, font: 'Pretendard', weight: 700, color: '#64748b' }
    ]
  },
  {
    id: 'quote-pastel', name: '파스텔 손글씨', cat: ['quote-card', 'kakao-cover', 'instagram'],
    bg: { type: 'linear', angle: 160, from: '#fdf2f8', to: '#ede9fe' },
    objects: [
      { type: 'emoji', char: '🌷', rx: 0.5, ry: 0.2, size: 0.14 },
      { type: 'text', text: '괜찮아,\n잘하고 있어', rx: 0.5, ry: 0.5, size: 0.13, font: 'Nanum Pen Script', color: '#7c3aed', lineHeight: 1.4 },
      { type: 'text', text: '· 오늘의 한마디 ·', rx: 0.5, ry: 0.78, size: 0.045, font: 'Pretendard', weight: 700, color: '#a78bfa' }
    ]
  },
  /* ------------------------------ OG / 블로그 ------------------------------ */
  {
    id: 'og-tech', name: '테크 그리드', cat: ['og-image', 'blog', 'youtube'],
    bg: { type: 'linear', angle: 135, from: '#020617', to: '#0f766e' },
    objects: [
      { type: 'shape', shape: 'rect', rx: 0.14, ry: 0.2, rw: 0.14, rh: 0.09, fill: '#14b8a6', radius: 0.06 },
      { type: 'text', text: 'BLOG', rx: 0.14, ry: 0.2, size: 0.045, font: 'Pretendard', weight: 800, color: '#022c22' },
      { type: 'text', text: '글 제목을 입력하세요', rx: 0.5, ry: 0.5, size: 0.11, font: 'Noto Sans KR', weight: 900, color: '#ffffff' },
      { type: 'text', text: 'example-blog.com', rx: 0.5, ry: 0.82, size: 0.04, font: 'Pretendard', weight: 700, color: '#5eead4' }
    ]
  },
  {
    id: 'og-left', name: '레프트 얼라인', cat: ['og-image', 'blog', 'banner'],
    bg: { type: 'solid', color: '#eff6ff' },
    objects: [
      { type: 'shape', shape: 'rect', rx: 0.045, ry: 0.5, rw: 0.05, rh: 1, fill: '#2563eb' },
      { type: 'text', text: '카테고리 · 시리즈 1편', rx: 0.45, ry: 0.3, size: 0.05, font: 'Pretendard', weight: 700, color: '#2563eb', align: 'left' },
      { type: 'text', text: '두 줄까지 들어가는\n블로그 대표 이미지 제목', rx: 0.45, ry: 0.52, size: 0.09, font: 'Noto Sans KR', weight: 900, color: '#1e293b', align: 'left', lineHeight: 1.35 }
    ]
  },
  /* ------------------------------ 프로필/스티커/글씨 ------------------------------ */
  {
    id: 'profile-initial', name: '이니셜 프로필', cat: ['profile', 'sticker'],
    bg: { type: 'linear', angle: 135, from: '#fb923c', to: '#e11d48' },
    objects: [
      { type: 'shape', shape: 'circle', rx: 0.5, ry: 0.5, rw: 0.82, rh: 0.82, fill: 'none', stroke: '#ffffff', strokeW: 0.02 },
      { type: 'text', text: 'JH', rx: 0.5, ry: 0.48, size: 0.4, font: 'Black Han Sans', color: '#ffffff', shadow: true },
      { type: 'text', text: 'since 2026', rx: 0.5, ry: 0.76, size: 0.05, font: 'Pretendard', weight: 700, color: '#ffedd5' }
    ]
  },
  {
    id: 'sticker-badge', name: '뱃지 스티커', cat: ['sticker', 'profile'],
    bg: { type: 'transparent' },
    objects: [
      { type: 'shape', shape: 'circle', rx: 0.5, ry: 0.5, rw: 0.9, rh: 0.9, fill: '#fde047', stroke: '#111827', strokeW: 0.02 },
      { type: 'shape', shape: 'circle', rx: 0.5, ry: 0.5, rw: 0.78, rh: 0.78, fill: 'none', stroke: '#111827', strokeW: 0.008 },
      { type: 'emoji', char: '🏆', rx: 0.5, ry: 0.4, size: 0.28 },
      { type: 'text', text: '오늘의 1등', rx: 0.5, ry: 0.68, size: 0.11, font: 'Jua', color: '#111827' }
    ]
  },
  {
    id: 'text-outline', name: '외곽선 글씨 (투명 PNG)', cat: ['text-image', 'sticker', 'meme'],
    bg: { type: 'transparent' },
    objects: [
      { type: 'text', text: '개이득', rx: 0.5, ry: 0.5, size: 0.42, font: 'Black Han Sans', color: '#ffffff', stroke: '#e11d48', strokeW: 0.035, shadow: true }
    ]
  },
  /* ------------------------------ 배너 ------------------------------ */
  {
    id: 'banner-center', name: '채널 배너 센터', cat: ['banner'],
    bg: { type: 'linear', angle: 115, from: '#1e293b', to: '#334155' },
    objects: [
      { type: 'text', text: '채널 이름', rx: 0.5, ry: 0.46, size: 0.12, font: 'Black Han Sans', color: '#ffffff', shadow: true },
      { type: 'text', text: '매주 수·토 업로드', rx: 0.5, ry: 0.56, size: 0.045, font: 'Pretendard', weight: 700, color: '#cbd5e1' },
      { type: 'shape', shape: 'line', rx: 0.5, ry: 0.51, rw: 0.14, rh: 0.004, fill: '#f43f5e' }
    ]
  },
  {
    id: 'text-gradient-fill', name: '두 줄 강조 글씨 (투명)', cat: ['text-image', 'sticker'],
    bg: { type: 'transparent' },
    objects: [
      { type: 'text', text: '이거\n실화냐', rx: 0.5, ry: 0.5, size: 0.26, font: 'Black Han Sans', color: '#fde047', stroke: '#0f172a', strokeW: 0.028, lineHeight: 1.05, shadow: true }
    ]
  },
  {
    id: 'text-handwrite-sign', name: '손글씨 서명 (투명)', cat: ['text-image', 'profile'],
    bg: { type: 'transparent' },
    objects: [
      { type: 'text', text: '오늘도 감사합니다', rx: 0.5, ry: 0.44, size: 0.16, font: 'Nanum Pen Script', color: '#1e293b', rot: -4 },
      { type: 'shape', shape: 'line', rx: 0.5, ry: 0.62, rw: 0.5, rh: 0.01, fill: '#e11d48', rot: -4 }
    ]
  },
  {
    id: 'meme-reaction-box', name: '리액션 박스 짤', cat: ['meme', 'instagram'],
    bg: { type: 'solid', color: '#fafaf9' },
    objects: [
      { type: 'shape', shape: 'rect', rx: 0.5, ry: 0.3, rw: 0.84, rh: 0.3, fill: '#ffffff', stroke: '#111827', strokeW: 0.01, radius: 0.04 },
      { type: 'text', text: '나: 딱 10분만 볼게', rx: 0.5, ry: 0.3, size: 0.062, font: 'Pretendard', weight: 800, color: '#111827', memeId: 'meme-top' },
      { type: 'emoji', char: '🤯', rx: 0.5, ry: 0.6, size: 0.24 },
      { type: 'text', text: '3시간 후...', rx: 0.5, ry: 0.87, size: 0.085, font: 'Do Hyeon', color: '#e11d48', memeId: 'meme-bottom' }
    ]
  },
  {
    id: 'sticker-speech', name: '말풍선 스티커 (투명)', cat: ['sticker', 'text-image', 'meme'],
    bg: { type: 'transparent' },
    objects: [
      { type: 'shape', shape: 'rect', rx: 0.5, ry: 0.44, rw: 0.9, rh: 0.5, fill: '#ffffff', stroke: '#111827', strokeW: 0.018, radius: 0.12 },
      { type: 'shape', shape: 'rect', rx: 0.36, ry: 0.72, rw: 0.16, rh: 0.16, fill: '#ffffff', stroke: '#111827', strokeW: 0.018, rot: 45 },
      { type: 'text', text: '좋아요!', rx: 0.5, ry: 0.43, size: 0.15, font: 'Jua', color: '#111827' }
    ]
  }
];
