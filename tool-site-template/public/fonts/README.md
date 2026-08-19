여기에 Pretendard 서브셋 폰트를 넣는다.
- Pretendard-Regular.subset.woff2, Pretendard-Bold.subset.woff2 (웹 폰트용, globals.css @font-face 참조)
- Pretendard-Bold.otf (og 이미지 ImageResponse용, src/app/og/[slug]/route.tsx 참조)
없으면 시스템 폰트로 폴백된다. og 이미지는 폰트 파일이 없으면 한글이 깨지므로 반드시 넣을 것.
