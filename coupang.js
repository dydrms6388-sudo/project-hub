/*
 * 쿠팡 파트너스 다이나믹 배너 공유 로더.
 * - .coupang-slot[data-subid] 마다 캐러셀 iframe을 주입하고, 필수 고지문구를 1회 표시.
 * - trackingCode 미설정이면 아무것도 렌더하지 않음(안전 no-op).
 * - subId를 페이지별로 달리해 어느 도구에서 전환이 나는지 추적(파트너스 리포트 subId).
 *
 * 활성화: 아래 trackingCode(AF…)와 widgetId(숫자)만 채우면 4개 페이지 전부 켜진다.
 */
(function () {
  var COUPANG = {
    trackingCode: '', // 예: 'AF1234567'  ← 쿠팡 파트너스에서 발급
    widgetId: '',     // 예: '123456'      ← 다이나믹 배너 위젯 id
  };

  if (!COUPANG.trackingCode || !COUPANG.widgetId) return; // 미설정 → 표시 안 함

  var slots = document.querySelectorAll('.coupang-slot');
  if (!slots.length) return;

  var DISCLOSURE =
    '이 사이트는 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.';

  slots.forEach(function (slot) {
    var subId = slot.getAttribute('data-subid') || 'tomatoeggcat';
    // 컨테이너 폭에 맞춰 300~680 사이로(캐러셀 가독 범위).
    var w = Math.max(300, Math.min(680, slot.clientWidth || 680));
    var h = w >= 640 ? 140 : 180;

    var src =
      'https://ads-partners.coupang.com/widgets.html?id=' +
      encodeURIComponent(COUPANG.widgetId) +
      '&template=carousel&trackingCode=' +
      encodeURIComponent(COUPANG.trackingCode) +
      '&subId=' +
      encodeURIComponent(subId) +
      '&width=' + w + '&height=' + h + '&tsource=';

    var iframe = document.createElement('iframe');
    iframe.src = src;
    iframe.width = String(w);
    iframe.height = String(h);
    iframe.setAttribute('frameborder', '0');
    iframe.setAttribute('scrolling', 'no');
    iframe.setAttribute('referrerpolicy', 'unsafe-url');
    iframe.style.maxWidth = '100%';
    iframe.style.border = '0';
    iframe.style.borderRadius = '14px';
    iframe.style.display = 'block';
    iframe.style.margin = '0 auto';

    slot.appendChild(iframe);

    var note = document.createElement('p');
    note.textContent = DISCLOSURE;
    note.style.cssText =
      'color:#6b7280;font-size:11px;margin:8px 0 0;text-align:center;line-height:1.5';
    slot.appendChild(note);
  });
})();
