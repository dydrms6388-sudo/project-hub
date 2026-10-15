export default {
  slug: "interval",
  emoji: "⏱️",
  name: "인터벌 타이머 (화면 꺼짐 방지)",
  card: "타바타·HIIT 인터벌 타이머. Wake Lock으로 화면이 꺼지지 않고 음성으로 카운트합니다.",
  title: "인터벌 타이머 — 화면 꺼짐 방지(Wake Lock) + 음성 카운트 · 타바타 프리셋",
  desc: "타바타(20초/10초×8) 등 프리셋과 직접 설정을 지원하는 웹 인터벌 타이머입니다. Wake Lock API로 운동 중 화면이 꺼지지 않고, 음성 안내와 비프음으로 세트 전환을 알려 줍니다. 설치 없이 브라우저에서 바로 사용.",
  lead: "타바타·HIIT 인터벌 타이머. <b>화면이 꺼지지 않고</b> 음성으로 세트를 알려 줍니다.",
  body: `
  <section class="tool" id="setupBox">
    <h2>타이머 설정</h2>
    <div class="field">
      <label for="preset">프리셋</label>
      <select id="preset"></select>
    </div>
    <div class="grid3">
      <div class="field">
        <label for="prep">준비 (초)</label>
        <input type="number" id="prep" inputmode="numeric" min="0" max="600" step="1" value="10" />
      </div>
      <div class="field">
        <label for="work">운동 (초)</label>
        <input type="number" id="work" inputmode="numeric" min="1" max="3600" step="1" value="20" />
      </div>
      <div class="field">
        <label for="rest">휴식 (초)</label>
        <input type="number" id="rest" inputmode="numeric" min="0" max="3600" step="1" value="10" />
      </div>
      <div class="field">
        <label for="sets">세트 (회)</label>
        <input type="number" id="sets" inputmode="numeric" min="1" max="99" step="1" value="8" />
      </div>
      <div class="field">
        <label for="rounds">라운드 (회)</label>
        <input type="number" id="rounds" inputmode="numeric" min="1" max="20" step="1" value="1" />
      </div>
      <div class="field">
        <label for="roundRest">라운드 휴식 (초)</label>
        <input type="number" id="roundRest" inputmode="numeric" min="0" max="900" step="1" value="60" />
      </div>
    </div>
    <div class="field">
      <label><input type="checkbox" id="voice" checked /> 음성 안내 사용 (Web Speech)</label>
      <label><input type="checkbox" id="beep" checked /> 비프음 사용</label>
      <label><input type="checkbox" id="lock" checked /> 화면 꺼짐 방지 (Wake Lock)</label>
    </div>
    <p class="hint" id="totalHint"></p>
    <div class="btnrow"><button class="btn" id="startBtn" type="button">타이머 시작</button></div>
  </section>

  <section class="result" id="runBox" hidden aria-live="polite">
    <p class="timer-phase" id="phaseOut">준비</p>
    <p class="timer-count" id="countOut">0</p>
    <div class="timer-bar"><i id="barOut"></i></div>
    <p class="timer-meta" id="metaOut">-</p>
    <p class="timer-meta" id="lockOut">-</p>
    <div class="btnrow">
      <button class="btn" id="pauseBtn" type="button">일시정지</button>
      <button class="btn sub" id="stopBtn" type="button">정지</button>
    </div>
  </section>

  <section class="result" id="doneBox" hidden aria-live="polite">
    <h2>운동 완료</h2>
    <p class="big"><span id="doneOut">-</span></p>
    <div class="kv"><span class="k">총 운동 시간</span><span class="v" id="workOut">-</span></div>
    <div class="kv"><span class="k">총 휴식 시간</span><span class="v" id="restOut">-</span></div>
    <div class="kv"><span class="k">완료 세트</span><span class="v" id="setOut">-</span></div>
    <div class="btnrow"><button class="btn" id="againBtn" type="button">한 번 더</button></div>
    <p class="hint" style="margin-top:10px">소모 칼로리가 궁금하다면 <a href="../calorie-burn/">소모 칼로리 계산기</a>에서 운동 시간을 넣어 보세요.</p>
  </section>`,
  intro: `<p>인터벌 트레이닝은 고강도 운동과 짧은 휴식을 반복하는 방식입니다. 문제는 스마트폰 타이머로는 화면이 꺼져 남은 시간을 볼 수 없고, 매번 화면을 두드려야 한다는 점입니다.</p>
    <p>이 타이머는 <b>Screen Wake Lock API</b>를 사용해 운동 중 화면이 자동으로 꺼지지 않게 잠급니다. 앱을 잠시 벗어났다가 돌아와도(탭 전환·화면 잠금 해제) <code>visibilitychange</code> 이벤트에서 잠금을 자동으로 다시 획득합니다. 여기에 Web Speech 음성 안내와 비프음을 더해, 화면을 보지 않아도 세트 전환을 알 수 있습니다.</p>
    <p>타바타(20초 운동 / 10초 휴식 × 8)를 비롯한 프리셋이 준비되어 있고, 준비·운동·휴식·세트·라운드·라운드 휴식을 자유롭게 조합할 수도 있습니다. 설치할 앱도, 계정도 필요 없습니다.</p>`,
  howto: [
    "프리셋을 고르거나 준비/운동/휴식/세트 값을 직접 입력합니다.",
    "여러 종목을 도는 서킷이라면 <b>라운드</b>와 <b>라운드 휴식</b>을 함께 설정합니다.",
    "음성 안내·비프음·화면 꺼짐 방지 옵션을 확인하고 <b>타이머 시작</b>을 누릅니다. (브라우저 정책상 소리와 화면 잠금은 시작 버튼을 누르는 순간 활성화됩니다.)",
    "운동 중에는 큰 숫자와 진행 바로 남은 시간을 확인합니다. 일시정지·정지 버튼은 언제든 사용할 수 있습니다.",
    "모든 세트가 끝나면 총 운동/휴식 시간 요약이 표시됩니다.",
  ],
  faq: [
    { q: "화면이 꺼지지 않는 원리가 무엇인가요?", a: "브라우저의 Screen Wake Lock API(navigator.wakeLock.request('screen'))를 사용합니다. 타이머가 도는 동안만 잠금을 유지하고, 정지하면 즉시 해제해 배터리 소모를 줄입니다." },
    { q: "다른 앱을 보다가 돌아오면 화면 잠금이 풀리지 않나요?", a: "브라우저가 백그라운드로 가면 Wake Lock 은 자동 해제됩니다. 이 타이머는 visibilitychange 이벤트를 감지해 화면이 다시 보일 때 잠금을 재요청하므로 계속 켜진 상태가 유지됩니다." },
    { q: "제 브라우저가 Wake Lock 을 지원하지 않으면요?", a: "지원 여부를 화면에 표시하며, 미지원 시에도 타이머 자체는 정상 동작합니다. 이 경우 기기의 화면 자동 꺼짐 시간을 길게 설정해 두세요. (iOS Safari 16.4 이상, 최신 Chrome/Edge 지원)" },
    { q: "타바타 프로토콜의 정확한 규격은 무엇인가요?", a: "Tabata 등(1996)의 원 연구는 최대산소섭취량 170% 강도로 20초 운동 / 10초 휴식을 7~8세트 반복하는 프로토콜입니다. 매우 높은 강도를 전제로 한 실험 프로토콜이므로 초보자는 강도를 낮춰 시작하세요." },
    { q: "음성이 나오지 않아요.", a: "브라우저의 Web Speech(SpeechSynthesis) 지원과 기기 볼륨·무음 모드를 확인하세요. iOS 는 무음 스위치가 켜져 있으면 소리가 나지 않을 수 있습니다." },
    { q: "화면을 끄고 백그라운드에서도 타이머가 도나요?", a: "브라우저가 백그라운드에 있으면 타이머 갱신이 느려질 수 있습니다. 이 타이머는 실제 경과 시각(performance.now)을 기준으로 계산하므로 돌아왔을 때 시간이 어긋나지 않지만, 안정적으로 쓰려면 화면을 켠 상태로 두는 것을 권합니다." },
  ],
  sources: [
    { label: "Tabata I et al. 1996 (20초/10초 프로토콜 원 논문)", url: "https://pubmed.ncbi.nlm.nih.gov/8897392/" },
    { label: "MDN — Screen Wake Lock API", url: "https://developer.mozilla.org/en-US/docs/Web/API/Screen_Wake_Lock_API" },
    { label: "MDN — SpeechSynthesis (Web Speech API)", url: "https://developer.mozilla.org/en-US/docs/Web/API/SpeechSynthesis" },
  ],
  related: ["calorie-burn", "hr-zone", "rest-day"],
  external: [
    { name: "TomatoEggCat 홈트 루틴 추천", url: "https://tomatoeggcat.com/home-workout-routine/" },
    { name: "TomatoEggCat 소모 칼로리 계산기", url: "https://tomatoeggcat.com/calorie-burn-calc/" },
  ],
  script: `import { PRESETS } from "../data/interval.mjs";
import { $, showAd } from "../assets/app.mjs";
import { fmtHMS } from "../data/pace.mjs";

const sel = $("#preset");
sel.innerHTML = PRESETS.map((p) => '<option value="' + p.id + '">' + p.name + "</option>").join("") + '<option value="">직접 설정</option>';
sel.addEventListener("change", () => {
  const p = PRESETS.find((x) => x.id === sel.value);
  if (!p) return;
  $("#prep").value = p.value.prep; $("#work").value = p.value.work;
  $("#rest").value = p.value.rest; $("#sets").value = p.value.sets;
  updateHint();
});

const num = (id, dflt) => { const v = parseInt($(id).value, 10); return isFinite(v) && v >= 0 ? v : dflt; };

function buildQueue() {
  const prep = num("#prep", 10), work = num("#work", 20), rest = num("#rest", 10);
  const sets = Math.max(1, num("#sets", 8)), rounds = Math.max(1, num("#rounds", 1)), rr = num("#roundRest", 0);
  const q = [];
  if (prep > 0) q.push({ kind: "prep", label: "준비", sec: prep, set: 0, round: 1 });
  for (let r = 1; r <= rounds; r++) {
    for (let s = 1; s <= sets; s++) {
      q.push({ kind: "work", label: "운동", sec: work, set: s, round: r, sets: sets, rounds: rounds });
      const last = r === rounds && s === sets;
      if (!last && rest > 0 && !(s === sets && rr > 0)) q.push({ kind: "rest", label: "휴식", sec: rest, set: s, round: r });
    }
    if (r < rounds && rr > 0) q.push({ kind: "rest", label: "라운드 휴식", sec: rr, set: sets, round: r });
  }
  return q;
}

function updateHint() {
  const q = buildQueue();
  const total = q.reduce((a, x) => a + x.sec, 0);
  $("#totalHint").textContent = "총 " + q.length + "개 구간 · 예상 소요 " + fmtHMS(total);
}
["#prep", "#work", "#rest", "#sets", "#rounds", "#roundRest"].forEach((id) => $(id).addEventListener("input", updateHint));
updateHint();

/* ── 소리 ── */
let audioCtx = null;
function beep(freq, ms) {
  if (!$("#beep").checked) return;
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const o = audioCtx.createOscillator(), g = audioCtx.createGain();
    o.type = "sine"; o.frequency.value = freq;
    g.gain.setValueAtTime(0.001, audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.25, audioCtx.currentTime + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + ms / 1000);
    o.connect(g); g.connect(audioCtx.destination);
    o.start(); o.stop(audioCtx.currentTime + ms / 1000 + 0.02);
  } catch (e) { /* 오디오 미지원 */ }
}
function say(text) {
  if (!$("#voice").checked || !("speechSynthesis" in window)) return;
  try {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "ko-KR"; u.rate = 1.1;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  } catch (e) { /* 음성 미지원 */ }
}

/* ── Wake Lock: 운동 중 화면 꺼짐 방지 ── */
let wakeLock = null;
const lockSupported = "wakeLock" in navigator;
function lockMsg(t) { $("#lockOut").textContent = t; }
async function acquireLock() {
  if (!$("#lock").checked) { lockMsg("🔓 화면 꺼짐 방지 꺼짐"); return; }
  if (!lockSupported) { lockMsg("⚠ 이 브라우저는 화면 꺼짐 방지(Wake Lock)를 지원하지 않습니다 — 기기 설정에서 화면 자동 꺼짐을 길게 두세요."); return; }
  try {
    wakeLock = await navigator.wakeLock.request("screen");
    lockMsg("🔒 화면 꺼짐 방지 켜짐");
    wakeLock.addEventListener("release", () => { lockMsg("🔓 화면 꺼짐 방지 해제됨"); });
  } catch (e) {
    wakeLock = null;
    lockMsg("⚠ 화면 꺼짐 방지를 켜지 못했습니다: " + e.name);
  }
}
async function releaseLock() {
  try { if (wakeLock) await wakeLock.release(); } catch (e) { /* 이미 해제됨 */ }
  wakeLock = null;
}
// 탭 전환·화면 잠금으로 해제된 Wake Lock 을 다시 획득한다.
document.addEventListener("visibilitychange", async () => {
  if (document.visibilityState === "visible" && running && !paused && wakeLock === null) {
    await acquireLock();
  }
});

/* ── 타이머 ── */
let queue = [], idx = 0, remain = 0, deadline = 0, tick = null;
let running = false, paused = false, lastSpoken = -1;
let sumWork = 0, sumRest = 0, doneSets = 0;

function render() {
  const cur = queue[idx];
  if (!cur) return;
  const shown = Math.max(0, Math.ceil(remain));
  $("#countOut").textContent = String(shown);
  $("#countOut").className = "timer-count " + (cur.kind === "work" ? "work" : "rest");
  $("#phaseOut").textContent = cur.label + (paused ? " (일시정지)" : "");
  $("#barOut").style.width = (100 * (1 - remain / cur.sec)).toFixed(1) + "%";
  const totalSets = cur.sets || Math.max(1, parseInt($("#sets").value, 10) || 1);
  const rounds = Math.max(1, parseInt($("#rounds").value, 10) || 1);
  const left = queue.slice(idx).reduce((a, x) => a + x.sec, 0) - (cur.sec - remain);
  $("#metaOut").textContent = "세트 " + (cur.set || 0) + "/" + totalSets + (rounds > 1 ? " · 라운드 " + cur.round + "/" + rounds : "") + " · 남은 시간 " + fmtHMS(Math.max(0, left));
}

function startPhase() {
  const cur = queue[idx];
  remain = cur.sec;
  deadline = performance.now() + cur.sec * 1000;
  lastSpoken = -1;
  if (cur.kind === "work") { beep(880, 180); say("운동 시작"); }
  else if (cur.kind === "prep") { beep(440, 120); say("준비"); }
  else { beep(520, 150); say(cur.label); }
  render();
}

function finishPhase() {
  const cur = queue[idx];
  if (cur.kind === "work") { sumWork += cur.sec; doneSets++; }
  else if (cur.kind === "rest") sumRest += cur.sec;
  idx++;
  if (idx >= queue.length) { complete(); return; }
  startPhase();
}

function loop() {
  if (!running || paused) return;
  remain = (deadline - performance.now()) / 1000;
  if (remain <= 0) { finishPhase(); return; }
  const s = Math.ceil(remain);
  if (s <= 3 && s !== lastSpoken) { lastSpoken = s; beep(660, 90); say(String(s)); }
  render();
}

function start() {
  queue = buildQueue();
  if (!queue.length) { alert("설정을 확인해 주세요."); return; }
  idx = 0; sumWork = 0; sumRest = 0; doneSets = 0;
  running = true; paused = false;
  $("#setupBox").hidden = true; $("#doneBox").hidden = true; $("#runBox").hidden = false;
  $("#pauseBtn").textContent = "일시정지";
  acquireLock();
  startPhase();
  clearInterval(tick);
  tick = setInterval(loop, 100);
}

async function stop(showSetup) {
  running = false; paused = false;
  clearInterval(tick); tick = null;
  await releaseLock();
  try { window.speechSynthesis && window.speechSynthesis.cancel(); } catch (e) {}
  $("#runBox").hidden = true;
  if (showSetup) $("#setupBox").hidden = false;
}

async function complete() {
  const totalSets = queue.filter((x) => x.kind === "work").length;
  await stop(true);
  $("#doneOut").textContent = "총 " + fmtHMS(sumWork + sumRest) + " 운동 완료";
  $("#workOut").textContent = fmtHMS(sumWork);
  $("#restOut").textContent = fmtHMS(sumRest);
  $("#setOut").textContent = doneSets + " / " + totalSets + " 세트";
  $("#doneBox").hidden = false;
  beep(1046, 400); say("운동 완료");
  showAd(); // 광고는 운동이 끝난 뒤에만 노출
}

$("#startBtn").addEventListener("click", start);
$("#againBtn").addEventListener("click", start);
$("#stopBtn").addEventListener("click", () => stop(true));
$("#pauseBtn").addEventListener("click", async () => {
  if (!running) return;
  paused = !paused;
  $("#pauseBtn").textContent = paused ? "계속하기" : "일시정지";
  if (paused) { await releaseLock(); lockMsg("⏸ 일시정지 — 화면 잠금 해제"); }
  else { deadline = performance.now() + remain * 1000; await acquireLock(); }
  render();
});`,
};
