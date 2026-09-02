/* typelab-kr 퀴즈 엔진 (ES module) — 클라이언트 상태로 진행, 완료 시 결과 페이지로 이동 */

export function runQuiz(test, mount) {
  const answers = []; // 각 문항에서 고른 option index
  let idx = 0;

  function el(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function render() {
    mount.textContent = '';
    const total = test.questions.length;
    const q = test.questions[idx];

    const prog = el('div', 'q-progress');
    const bar = el('i');
    bar.style.width = Math.round((idx / total) * 100) + '%';
    prog.appendChild(bar);
    mount.appendChild(prog);

    mount.appendChild(el('div', 'q-count', 'Q' + (idx + 1) + ' / ' + total));
    mount.appendChild(el('h2', 'q-text', q.q));

    q.options.forEach((opt, oi) => {
      const b = el('button', 'q-opt', opt.text);
      b.type = 'button';
      b.addEventListener('click', () => {
        answers[idx] = oi;
        idx += 1;
        if (idx >= total) finish(); else render();
      });
      mount.appendChild(b);
    });

    if (idx > 0) {
      const back = el('button', 'q-back', '← 이전 문항으로');
      back.type = 'button';
      back.addEventListener('click', () => {
        idx -= 1;
        answers.length = idx;
        render();
      });
      mount.appendChild(back);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function computeKey() {
    const sums = {};
    answers.forEach((oi, qi) => {
      const scores = test.questions[qi].options[oi].scores || {};
      for (const k in scores) sums[k] = (sums[k] || 0) + scores[k];
    });
    return test.axes
      .map((ax) => ((sums[ax.left.key] || 0) >= (sums[ax.right.key] || 0) ? ax.left.key : ax.right.key))
      .join('')
      .toLowerCase();
  }

  function finish() {
    const key = computeKey();
    mount.textContent = '';
    const box = el('div', 'q-loading');
    box.appendChild(el('div', 'spin'));
    box.appendChild(el('div', null, '결과를 분석하는 중...'));
    mount.appendChild(box);
    try {
      localStorage.setItem('typelab:last:' + test.id, key);
    } catch (e) { /* 사생활 모드 등 */ }
    setTimeout(() => {
      location.href = '../result/' + key + '/';
    }, 900);
  }

  render();
}
