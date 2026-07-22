# -*- coding: utf-8 -*-
"""사이(/sai) 어휘 임베딩 인덱스 빌드 스크립트.

입력: fastText 한국어 사전학습 벡터(빈도순 정렬)의 상위 N줄.
  curl -sS https://dl.fbaipublicfiles.com/fasttext/vectors-crawl/cc.ko.300.vec.gz \
    | gunzip | head -100001 > cc.ko.head.vec
출력: sai/data/index.json  (meta + 단어 목록 + base64 int8 벡터)

브라우저에서 slerp 보간 + 최근접 탐색을 하기 위해
300차원 float → PCA 저차원 → int8 양자화로 용량을 줄인다.
"""
import sys, json, base64, re, unicodedata
import numpy as np

SRC = sys.argv[1] if len(sys.argv) > 1 else "cc.ko.head.vec"
OUT_DIR = sys.argv[2] if len(sys.argv) > 2 else "sai/data"
DIM = 128          # PCA 목표 차원
MAX_VOCAB = 30000  # 최종 어휘 상한

HANGUL = re.compile(r"^[가-힣]{1,5}$")

# 1글자는 원칙 제외(조사·어미 노이즈)하되, 의미 있는 명사만 화이트리스트로 허용
ONE_CHAR_OK = {
    "잠", "꿈", "밤", "낮", "물", "불", "봄", "눈", "비", "산", "강", "별", "달", "해",
    "길", "돈", "몸", "밥", "술", "집", "책", "빛", "숲", "섬", "손", "발", "피", "흙",
    "말", "글", "노", "시", "춤", "숨", "삶", "정", "한", "흥", "멋", "맛", "약", "병",
    "꽃", "잎", "풀", "새", "곰", "말", "소", "개", "닭", "쥐", "용", "뱀", "양", "범",
}

# 빈도 컷에 밀려도 있으면 반드시 포함할 감정·시어(제품 핵심 어휘)
PRIORITY = {
    "미움", "그리움", "설렘", "외로움", "쓸쓸함", "슬픔", "기쁨", "분노", "질투", "동경",
    "허무", "권태", "환희", "절망", "희망", "위로", "상처", "치유", "이별", "재회",
    "청춘", "낭만", "향수", "여운", "미련", "후회", "용기", "불안", "평온", "고요",
    "새벽", "노을", "달빛", "별빛", "바람", "파도", "안개", "침묵", "고독", "자유",
    "노년", "유년", "황혼",
}

# 조사·어미가 붙은 형태 제거용 접미 목록 (남은 어간이 어휘에 있으면 파생형으로 보고 제외)
JOSA_SUFFIX = [
    "에서", "에게", "으로", "까지", "부터", "처럼", "한테", "에는", "에도", "와의", "과의",
    "들이", "들을", "들은", "들의", "이라", "이며", "이고", "이나", "인지", "인가", "라고", "다고",
    "은", "는", "이", "가", "을", "를", "에", "의", "도", "와", "과", "로", "만", "들",
    "한", "된", "될", "인", "함", "임", "나", "라도", "마다", "밖에", "조차", "마저",
]
# 활용형·문말 형태 일괄 제외 접미 (어간 확인 없이 제외)
VERBAL_SUFFIX = (
    "습니다", "입니다", "합니다", "됩니다", "니다",
    "하는", "되는", "있는", "없는", "같은", "라는", "다는", "려는",
    "해서", "어서", "아서", "면서", "하면", "되면", "다면", "으면",
    "하고", "하며", "하게", "하지", "했던", "그리고",
    "네요", "세요", "어요", "아요", "해요", "지요", "까요", "군요",
    "니까", "지만", "든지", "려고", "도록", "인데", "은데", "는데",
    "었다", "았다", "였다", "한다", "된다", "이다",
)
# '다'로 끝나지만 명사인 예외
ENDS_DA_OK = {"바다", "판다", "소다", "사이다", "람다", "숯가마다"}

STOPWORDS = {
    "그리고", "그러나", "그런데", "하지만", "그래서", "또한", "또는", "및", "등의", "위해", "대한",
    "대해", "통해", "따라", "관련", "경우", "때문", "부분", "정도", "이런", "그런", "저런", "어떤",
    "여러", "모든", "다른", "매우", "가장", "너무", "정말", "진짜", "다시", "이미",
    "아직", "물론", "만약", "역시", "바로", "그냥", "거의", "특히", "결국",
    "여기", "저기", "거기", "우리", "저희", "자신", "무엇", "누구", "어디", "언제",
    "이것", "그것", "저것", "것은", "것이", "것을", "수가", "수는", "있을", "없을", "많은", "많이",
    "됐다", "있어", "없어", "해야", "하라", "하자", "된다", "이제", "제가", "내가", "네가", "그는",
    "그녀", "이번", "지난", "다음", "관한", "인한", "위한", "의한", "동안", "사이에", "외에",
}

# 혐오·비하·욕설 — 어휘 인덱스에서 원천 제외 (부분 문자열 매칭)
BLOCK_SUBSTR = [
    "씨발", "시발", "씨팔", "병신", "새끼", "지랄", "좆", "썅", "개새", "미친년", "미친놈",
    "걸레", "창녀", "년놈", "느금", "니미", "장애인", "정신병", "김치녀", "한남충", "맘충",
    "급식충", "틀딱", "짱깨", "쪽바리", "흑형", "빨갱이", "종북", "일베", "메갈",
    "자살", "강간", "성폭행", "몰카", "음란", "야동", "포르노", "섹스", "성기", "자위",
]
# 실존 인물(정치인·유명인) — 고유명사 제외 원칙
BLOCK_EXACT = {
    "문재인", "박근혜", "이명박", "노무현", "김대중", "전두환", "윤석열", "이재명", "김정은",
    "김정일", "김일성", "트럼프", "바이든", "오바마", "푸틴", "시진핑", "아베", "기시다",
    "손흥민", "김연아", "박지성", "유재석", "강호동", "아이유", "방탄소년단",
}

def blocked(w):
    if w in BLOCK_EXACT:
        return True
    return any(b in w for b in BLOCK_SUBSTR)

def load(src):
    words, vecs = [], []
    with open(src, encoding="utf-8", errors="ignore") as f:
        header = f.readline()
        for line in f:
            parts = line.rstrip("\n").split(" ")
            w = unicodedata.normalize("NFC", parts[0])
            if not HANGUL.match(w):
                continue
            if len(w) == 1 and w not in ONE_CHAR_OK:
                continue
            v = np.asarray(parts[1:301], dtype=np.float32)
            if v.shape[0] != 300:
                continue
            words.append(w)
            vecs.append(v)
    return words, np.vstack(vecs)

words, X = load(SRC)
print(f"한글 토큰: {len(words)}")

# 1차 필터: 활용형·불용어·차단어
keep = []
seen = set()
for i, w in enumerate(words):
    if w in seen:
        continue
    seen.add(w)
    if len(w) == 1 or w in PRIORITY:
        keep.append(i)
        continue
    if w in STOPWORDS or blocked(w):
        continue
    if w.endswith(VERBAL_SUFFIX):
        continue
    if w.endswith("다") and w not in ENDS_DA_OK:
        continue
    keep.append(i)
vocab_set = {words[i] for i in keep}

# 2차 필터: 어간+조사 파생형 제거.
# 접미를 뗀 어간이 어휘에 있어도, 우연한 포함(고양이/고양, 가을/가)일 수 있으므로
# 벡터 의미 유사도로 판정한다. 진짜 조사·어미 부착형은 어간과 의미가 거의 같다.
# 실측: 잠을·행복한·사랑이·회사나·봄과 = 0.47~0.65 / 고양이·가을·종이·놀이 = 0.15~0.43
DERIVED_COS = 0.45
Xn = X / np.linalg.norm(X, axis=1, keepdims=True)
widx = {}
for i, w in enumerate(words):
    if w not in widx:
        widx[w] = i
keep2 = []
for i in keep:
    w = words[i]
    if len(w) == 1 or w in PRIORITY:
        keep2.append(i)
        continue
    derived = False
    for s in JOSA_SUFFIX:
        stem = w[: len(w) - len(s)]
        if w.endswith(s) and len(stem) >= 1 and stem in vocab_set \
           and float(Xn[i] @ Xn[widx[stem]]) > DERIVED_COS:
            derived = True
            break
    if not derived:
        keep2.append(i)

# 빈도 컷: 우선 어휘는 컷과 무관하게 유지
head = keep2[:MAX_VOCAB]
tail_priority = [i for i in keep2[MAX_VOCAB:] if words[i] in PRIORITY]
keep2 = head + tail_priority
words = [words[i] for i in keep2]
X = X[keep2]
print(f"최종 어휘: {len(words)}")

# 정규화 → PCA(중심화 포함) → 재정규화 → int8 양자화
X = X / np.linalg.norm(X, axis=1, keepdims=True)
mean = X.mean(axis=0)
Xc = X - mean
cov = Xc.T @ Xc / len(Xc)
eigval, eigvec = np.linalg.eigh(cov)
order = np.argsort(eigval)[::-1]
ev = eigval[order]
print(f"설명분산 64d={ev[:64].sum()/ev.sum():.3f} 96d={ev[:96].sum()/ev.sum():.3f} 128d={ev[:128].sum()/ev.sum():.3f}")
P = eigvec[:, order[:DIM]]
Y = Xc @ P
Y = Y / np.linalg.norm(Y, axis=1, keepdims=True)

scale = 127.0 / np.abs(Y).max()
Q = np.clip(np.round(Y * scale), -127, 127).astype(np.int8)

# 품질 점검: 축소 공간 최근접 이웃
Yf = Q.astype(np.float32)
Yf = Yf / np.linalg.norm(Yf, axis=1, keepdims=True)
idx = {w: i for i, w in enumerate(words)}

def nn(vec, k=6, exclude=()):
    sims = Yf @ vec
    out = []
    for j in np.argsort(sims)[::-1]:
        if words[j] in exclude:
            continue
        out.append((words[j], float(sims[j])))
        if len(out) >= k:
            break
    return out

def slerp(a, b, t):
    dot = np.clip(a @ b, -1, 1)
    th = np.arccos(dot)
    if th < 1e-6:
        return a
    v = (np.sin((1 - t) * th) * a + np.sin(t * th) * b) / np.sin(th)
    return v / np.linalg.norm(v)

for probe in ["사랑", "바다", "커피", "겨울", "행복"]:
    if probe in idx:
        print(probe, "→", [w for w, s in nn(Yf[idx[probe]], 6, exclude={probe})])

for a, b in [("사랑", "미움"), ("여름", "겨울"), ("커피", "잠"), ("학교", "회사")]:
    if a in idx and b in idx:
        path = []
        for t in [i / 7 for i in range(1, 7)]:
            v = slerp(Yf[idx[a]], Yf[idx[b]], t)
            cands = nn(v, 3, exclude={a, b, *path})
            path.append(cands[0][0])
        print(f"{a} ⇢ {b}: {' → '.join(path)}")

import os
os.makedirs(OUT_DIR, exist_ok=True)
meta = {"dim": DIM, "n": len(words), "words": words}
with open(os.path.join(OUT_DIR, "words.json"), "w", encoding="utf-8") as f:
    json.dump(meta, f, ensure_ascii=False, separators=(",", ":"))
with open(os.path.join(OUT_DIR, "vecs.bin"), "wb") as f:
    f.write(Q.tobytes())
print(f"저장: words.json {os.path.getsize(os.path.join(OUT_DIR,'words.json'))/1e6:.2f} MB, "
      f"vecs.bin {os.path.getsize(os.path.join(OUT_DIR,'vecs.bin'))/1e6:.2f} MB")
