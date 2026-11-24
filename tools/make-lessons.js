/* 45분 종합 수업 페이지 만들기: node tools/make-lessons.js
   tools/lessons.json(소단원별 내용) → lesson/<소단원>.html, assets/contents.js의 lesson 항목 갱신 */
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const L = JSON.parse(fs.readFileSync(path.join(__dirname, 'lessons.json'), 'utf8'));
const csrc = fs.readFileSync(path.join(ROOT, 'assets/contents.js'), 'utf8');
const ctx = {}; new Function('ctx', csrc.replace(/^const (\w+)/gm, 'ctx.$1') )(ctx);
const ROMAN = ['', 'Ⅰ', 'Ⅱ', 'Ⅲ', 'Ⅳ', 'Ⅴ'];
const esc = s => String(s).replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));
const strip = s => String(s).replace(/<[^>]+>/g, '');
const js = v => JSON.stringify(v).replace(/</g, '\\u003c');
fs.mkdirSync(path.join(ROOT, 'lesson'), {recursive: true});

const pagesOf = acts => {   // 활동 설명의 "(교과서 12, 15~17쪽 ...)"에서 쪽수 범위
  const n = [];
  acts.forEach(c => { const m = c.desc.match(/교과서 ([^쪽)]*)쪽/); if (m) (m[1].match(/\d+/g) || []).forEach(x => n.push(+x)); });
  return n.length ? (Math.min(...n) === Math.max(...n) ? `${Math.min(...n)}쪽` : `${Math.min(...n)}~${Math.max(...n)}쪽`) : '';
};

for (const d of L){
  const unit = +d.sub[0];
  const acts = ctx.contentsList.filter(c => c.sub === d.sub && !c.lesson);
  const pages = pagesOf(acts);
  const subName = ctx.subList[d.sub] || '';
  d._pages = pages;
  const flow = [
    ['도입', '5분', '생각 열기: 질문에 내 생각 고르기'],
    ['개념 정리', '10분', '핵심 개념 카드를 뒤집으며 설명하기'],
    ['적용', '15분', '상황에 맞는 개념 고르기 · 시간이 있으면 아래 활동 중 하나를 함께 해 보기'],
    ['확인', '10분', `확인 미션 ${d.quiz.length}문제`],
    ['정리', '5분', '한 줄 정리 빈칸 열기'],
  ];
  const html = `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(d.title)}</title>
<link rel="stylesheet" href="../assets/common.css">
<style>
.flow45{margin:14px 0 0;border:2px dashed #f7dd8f;background:#fffdf3;border-radius:14px;padding:8px 14px}
.flow45 summary{cursor:pointer;font-weight:700;color:#a06d00}
.flow45 table{width:100%;border-collapse:collapse;margin:8px 0;font-size:.92rem}
.flow45 td{border-top:1px solid #f3e6b8;padding:6px 4px;vertical-align:top}
.flow45 td:first-child{white-space:nowrap;font-weight:700}
.flow45 ul{margin:4px 0 6px;padding-left:1.2em}
.cgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:10px;margin-top:10px}
</style>
</head>
<body data-stage data-unit="${unit}" data-title="${esc(d.title)}" data-sub="중1 ${ROMAN[unit]}단원 · 45분 종합 수업${pages ? ' · 미래엔 ' + pages : ''}">
<main>
  <span class="badge">중1 ${ROMAN[unit]}단원 · 45분 종합 수업</span>
  <h1>${d.icon} ${esc(d.title)}</h1>
  <p class="lead">${d.lead}</p>
  <details class="flow45"><summary>⏱ 45분 수업 흐름 (교사용)</summary>
    <p class="hint" style="margin:6px 0 0">${d.sub} ${esc(subName)}</p>
    <table>${flow.map(r => `<tr><td>${r[0]}</td><td>${r[1]}</td><td>${r[2]}</td></tr>`).join('')}</table>
    <b>이 소단원의 활동</b>
    <ul>${acts.map(c => `<li><a href="../${esc(c.href)}">${esc(c.icon || '')} ${esc(c.title)}</a></li>`).join('')}</ul>
  </details>

  <section class="step think">
    <h2 class="step-h"><span class="no">1</span>생각 열기</h2>
    <div class="card" data-think="${esc(d.think[1])}">
      <p>${d.think[0]}</p>
    </div>
  </section>

  <section class="step">
    <h2 class="step-h"><span class="no">2</span>조작 활동</h2>
    <div class="card" data-bot="카드를 하나씩 눌러서 뒤집어 봐. 모두 설명할 수 있으면 성공이야 🗂️">
      <h3>🗂️ 핵심 개념 카드</h3>
      <p>카드를 누르면 뒤집혀서 설명이 나와요. 먼저 설명을 떠올려 보고 뒤집어 확인해 보세요. 다시 누르면 앞면으로 돌아가요.</p>
      <div class="cgrid" id="cards"></div>
      <div class="row" style="margin-top:10px"><button class="btn line" id="ccAll">🔄 모두 뒤집기</button></div>
      <div class="feedback" id="ccFb"></div>
    </div>
    <div class="card" data-bot="배운 개념을 실제 상황에 적용해 봐 🧩">
      <h3>🧩 상황에 맞는 개념 고르기</h3>
      <p>${esc(d.match.q)}</p>
      <div id="match"></div>
    </div>
  </section>

  <section class="step">
    <h2 class="step-h"><span class="no">3</span>확인 미션</h2>
    <div class="card" id="quiz"></div>
  </section>

  <section class="step sum">
    <h2 class="step-h"><span class="no">4</span>한 줄 정리</h2>
    <div class="card">
      <p>${d.sum}</p>
    </div>
  </section>
  <p class="src">미래엔 중학교 정보${pages ? ' ' + pages : ''} 내용을 바탕으로 소단원 활동을 종합해 재구성</p>
</main>
<script src="../assets/contents.js"></script>
<script src="../assets/common.js"></script>
<script>
const CONCEPTS = ${js(d.concepts)};
$('#cards').innerHTML = CONCEPTS.map(([i, t, s], k) => \`<button class="cc flip" data-k="\${k}" aria-pressed="false" aria-label="\${t} 카드 뒤집기"><span class="fi"><span class="ff"><span class="ci">\${i}</span><b>\${t}</b><span class="tap">눌러서 뒤집기</span></span><span class="fb"><b>\${i} \${t}</b>\${s}</span></span></button>\`).join('');
const seen = new Set();
let ccDone = false;
const ccCheck = () => {
  if (!ccDone && seen.size === CONCEPTS.length){ ccDone = true; feedback($('#ccFb'), true, '🎉 핵심 개념 ' + seen.size + '개를 모두 확인했어요! 친구에게 하나씩 설명해 보세요.'); }
};
const flipTo = (b, on) => { b.classList.toggle('open', on); b.setAttribute('aria-pressed', on); if (on) seen.add(b.dataset.k); };
$$('#cards .cc').forEach(b => b.onclick = () => { flipTo(b, !b.classList.contains('open')); ccCheck(); });
$('#ccAll').onclick = () => { const all = $$('#cards .cc'), on = !all.every(b => b.classList.contains('open')); all.forEach(b => flipTo(b, on)); $('#ccAll').textContent = on ? '↩️ 모두 앞면으로' : '🔄 모두 뒤집기'; ccCheck(); };
renderChoice($('#match'), ${js(d.match.items.map(([icon, t, a, e]) => ({icon, t, a, e})))}, ${js(d.match.opts)});
renderQuiz($('#quiz'), ${js(d.quiz.map(([q, o, a, e]) => ({q, o, a, e})))});
</script>
</body>
</html>
`;
  fs.writeFileSync(path.join(ROOT, 'lesson', d.sub + '.html'), html);
}

/* contents.js: 기존 lesson 항목을 지우고, 각 소단원 마지막 활동 뒤에 새 lesson 항목 넣기 */
let lines = csrc.split('\n').filter(l => !/^\s*\{unit:.*lesson: true/.test(l));   // 활동 항목 줄만 지움 (주석 줄은 남김)
for (const d of L){
  const unit = +d.sub[0];
  let last = -1;
  lines.forEach((l, i) => { if (l.includes(`sub: '${d.sub}'`) && /href:/.test(l)) last = i; });
  if (last < 0) throw new Error('no activity for ' + d.sub);
  const desc = strip(d.lead) + (d._pages ? ` (교과서 ${d._pages.replace('쪽', '')}쪽)` : '');
  const entry = `  {unit: ${unit}, sub: '${d.sub}', icon: '${d.icon}', lesson: true, badge: '45분 종합 수업', title: '${d.title.replace(/'/g, "\\'")}', desc: '${desc.replace(/'/g, "\\'")}', href: 'lesson/${d.sub}.html',},`;
  lines.splice(last + 1, 0, entry);
}
fs.writeFileSync(path.join(ROOT, 'assets/contents.js'), lines.join('\n'));
console.log('lesson pages:', L.length);
