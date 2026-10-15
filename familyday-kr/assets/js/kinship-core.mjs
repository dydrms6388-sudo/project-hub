/**
 * kinship-core.mjs — 촌수 계산 순수 로직 (브라우저/Node 공용, 의존성 0)
 *
 * 모델: 사용자가 "나"에서 출발해 관계 단계를 쌓으면 가상의 가계 그래프를 만들고,
 * 부모-자식 간선 = 1촌, 배우자 간선 = 0촌(인척 전환)으로 최단 경로를 구해 촌수를 계산한다.
 * (민법 제770조~제771조의 촌수 계산 원칙: 직계는 세수(世數), 방계는 공동시조까지
 *  올라간 세수 + 내려온 세수의 합, 인척은 배우자 기준 촌수를 따른다)
 *
 * 해석 규칙(일반 촌수 계산기 관례):
 *  - "아버지의 아들"처럼 왔던 길을 되짚는 단계는 '본인이 아닌 새로운 사람'(=형제)으로 간주.
 *  - "형의 아버지"는 그래프상 같은 아버지 노드로 이어지므로 자동으로 1촌(아버지)이 된다.
 */

export const STEPS = [
  { code: "f",  label: "아버지" },
  { code: "m",  label: "어머니" },
  { code: "h",  label: "남편" },
  { code: "w",  label: "아내" },
  { code: "ob", label: "형·오빠" },
  { code: "yb", label: "남동생" },
  { code: "os", label: "누나·언니" },
  { code: "ys", label: "여동생" },
  { code: "s",  label: "아들" },
  { code: "d",  label: "딸" },
];

export const STEP_LABEL = Object.fromEntries(STEPS.map(s => [s.code, s.label]));

let _nid = 0;
function person(sex) {
  return { id: _nid++, sex, parents: [], children: [], spouse: null, gen: 0 };
}
function linkParentChild(parent, child) {
  if (!child.parents.includes(parent)) child.parents.push(parent);
  if (!parent.children.includes(child)) parent.children.push(child);
}
function linkSpouse(a, b) { a.spouse = b; b.spouse = a; }

function getParent(p, sex) {
  let found = p.parents.find(x => x.sex === sex);
  if (found) return found;
  const np = person(sex);
  np.gen = p.gen + 1;
  linkParentChild(np, p);
  // 부/모가 모두 있으면 서로 배우자로 연결 (어머니의 남편 = 아버지)
  const other = p.parents.find(x => x !== np);
  if (other && !other.spouse && !np.spouse) linkSpouse(other, np);
  return np;
}
function getSpouse(p, sex) {
  if (p.spouse) return p.spouse;
  const sp = person(sex);
  sp.gen = p.gen;
  linkSpouse(p, sp);
  return sp;
}
function newSibling(p, sex) {
  const fa = getParent(p, "M"); // 형제자매는 아버지를 공유한다고 가정
  const sib = person(sex);
  sib.gen = p.gen;
  linkParentChild(fa, sib);
  const mo = p.parents.find(x => x.sex === "F");
  if (mo) linkParentChild(mo, sib);
  return sib;
}
function newChild(p, sex) {
  const c = person(sex);
  c.gen = p.gen - 1;
  linkParentChild(p, c);
  if (p.spouse) linkParentChild(p.spouse, c);
  return c;
}

/** steps 배열(예: ["f","ob","s"])을 그래프로 전개해 목표 인물과 전체 노드 집합을 반환 */
export function buildGraph(steps) {
  _nid = 0;
  const me = person(null);
  let cur = me;
  const trail = [me];
  for (const st of steps) {
    switch (st) {
      case "f": cur = getParent(cur, "M"); break;
      case "m": cur = getParent(cur, "F"); break;
      case "h": cur = getSpouse(cur, "M"); break;
      case "w": cur = getSpouse(cur, "F"); break;
      case "ob": case "yb": cur = newSibling(cur, "M"); break;
      case "os": case "ys": cur = newSibling(cur, "F"); break;
      case "s": cur = newChild(cur, "M"); break;
      case "d": cur = newChild(cur, "F"); break;
      default: throw new Error("unknown step: " + st);
    }
  }
  return { me, target: cur };
}

/**
 * 촌수 계산. 반환: { chon, affinal(인척 여부), spouse(배우자 본인 여부), generation(세대 차), self }
 * chon: 부모-자식 간선 수 기준 최단 촌수. 배우자 간선은 0으로 계산(인척).
 */
export function computeChon(steps) {
  const { me, target } = buildGraph(steps);
  if (me === target) return { chon: 0, affinal: false, spouse: false, generation: 0, self: true };

  // 0-1 가중치 다익스트라: cost = 혈연 간선 수, tie-break = 배우자 간선 사용 수 최소
  const best = new Map(); // id -> [cost, spouseEdges]
  const queue = [[0, 0, me]];
  best.set(me.id, [0, 0]);
  while (queue.length) {
    queue.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const [cost, sp, node] = queue.shift();
    const cur = best.get(node.id);
    if (cur && (cur[0] < cost || (cur[0] === cost && cur[1] < sp))) continue;
    const nexts = [];
    for (const p of node.parents) nexts.push([cost + 1, sp, p]);
    for (const c of node.children) nexts.push([cost + 1, sp, c]);
    if (node.spouse) nexts.push([cost, sp + 1, node.spouse]);
    for (const [nc, ns, nn] of nexts) {
      const b = best.get(nn.id);
      if (!b || nc < b[0] || (nc === b[0] && ns < b[1])) {
        best.set(nn.id, [nc, ns]);
        queue.push([nc, ns, nn]);
      }
    }
  }
  const r = best.get(target.id);
  if (!r) throw new Error("unreachable target");
  const [chon, spouseEdges] = r;
  return {
    chon,
    affinal: spouseEdges > 0,
    spouse: chon === 0 && spouseEdges > 0,
    generation: target.gen,
    self: false,
  };
}

/** 사람이 읽는 촌수 문구 */
export function chonText(r) {
  if (r.self) return "본인";
  if (r.spouse) return "배우자 (무촌)";
  const base = r.chon === 0 ? "무촌" : `${r.chon}촌`;
  return r.affinal ? `${base} (인척)` : `${base} (혈족)`;
}
