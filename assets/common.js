/* 중학교 정보 개념 체험관 · 활동 페이지 공통 스크립트
   <body data-unit="2" data-title="제목" data-sub="부제"> 를 읽어 상단 막대를 만든다. */
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const bin = (n, w) => n.toString(2).padStart(w, '0');

/* 진도 신호: 아무것도 저장하지 않고 window에 'info:progress' 이벤트만 내보낸다.
   나중에 로그인·진도 기록 기능이 이 이벤트(또는 infoProgress.state)를 받아 저장한다.
   type: start(열림) · step(다음 단계) · done(마지막 단계 도달) · quiz(확인 미션 채점 완료)
         choice(상황 분류 완료) · mission(엔트리 점검 완료) · leave(페이지 나감, 요약 포함)
   주소에 ?pdebug 를 붙이면 콘솔에 신호가 찍힌다. */
const infoProgress = window.infoProgress = (() => {
  const parts = location.pathname.split('/').filter(Boolean);
  let file = parts[parts.length - 1] || '';
  if (!/\.html?$/.test(file) || file === 'index.html') file = (file === 'index.html' ? parts[parts.length - 2] : file) || '';
  const m = file.match(/^(\d-\d{2})/);
  const act = m ? m[1] : file.replace(/\.html?$/, '');
  const state = {act, opened: Date.now(), step: 0, total: 0, maxStep: 0, done: false, expanded: false, quiz: {}, choice: {}, mission: {}};
  const debug = /[?&]pdebug/.test(location.search);
  function emit(type, d){
    const detail = Object.assign({act, type, t: Date.now()}, d || {});
    try { dispatchEvent(new CustomEvent('info:progress', {detail})); } catch (e) {}
    if (debug) console.log('[progress]', JSON.stringify(detail));
  }
  let left = false;
  addEventListener('pagehide', () => {
    if (left) return; left = true;
    emit('leave', {sec: Math.round((Date.now() - state.opened) / 1000), summary: JSON.parse(JSON.stringify(state))});
  });
  addEventListener('pageshow', e => { if (e.persisted){ left = false; state.opened = Date.now(); emit('start', {step: state.step, total: state.total, back: true}); } });
  return {state, emit};
})();

(function header(){
  const d = document.body.dataset;
  const h = document.createElement('header');
  h.className = 'top';
  h.innerHTML = `<div class="in">
      <a class="back" href="../index.html?unit=${d.unit || ''}">◀ 목차</a>
      <div class="ttl"><b></b><small></small></div>
      <div class="tools">
        <button class="tool" id="allBtn" title="모든 활동 펼치기 (교사용 미리 보기)">☰ <span>펼치기</span></button>
        <button class="tool" id="bigBtn" title="글자 크게 (전자칠판용)">가<b>+</b> <span>크게</span></button>
        <button class="tool" id="fsBtn" title="전체 화면">⛶ <span>전체 화면</span></button>
      </div></div><div class="prog"><i></i></div>`;
  h.querySelector('.ttl b').textContent = d.title || document.title;
  let std = '';   // 관련 성취기준 표시 (contents.js의 std)
  try { const p = location.pathname; const e = (typeof contentsList !== 'undefined') && contentsList.find(c => c.href.endsWith('/') ? (p.endsWith(c.href) || p.endsWith(c.href + 'index.html')) : p.endsWith(c.href)); if (e && e.std) std = ' · [9정' + e.std + ']'; } catch (e) {}
  h.querySelector('.ttl small').textContent = (d.sub || '') + std;
  document.body.prepend(h);
  const root = document.documentElement;   // 글자 크기는 html 기준(rem)이므로 html에 적용
  try { if (localStorage.getItem('big')) root.classList.add('big'); } catch (e) {}
  const bigLabel = () => $('#bigBtn').innerHTML = root.classList.contains('big') ? '가<b>−</b> <span>보통</span>' : '가<b>+</b> <span>크게</span>';
  bigLabel();
  $('#bigBtn').onclick = () => {
    root.classList.toggle('big'); bigLabel();
    try { localStorage.setItem('big', root.classList.contains('big') ? '1' : ''); } catch (e) {}
    window.dispatchEvent(new Event('resize'));
  };
  $('#fsBtn').onclick = () => {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen?.();
    else document.exitFullscreen?.();
  };
})();

/* 단계별 펼치기: 활동(카드)을 하나씩 보여 주고, 아래의 [다음] 버튼으로 다음 활동을 연다.
   .step 안의 .card 하나가 활동 1개이며, 카드 앞의 다른 요소(예: 모드 버튼)는 뒤 카드에 붙는다. */
document.addEventListener('DOMContentLoaded', () => {
  const units = [];
  $$('main .step').forEach(step => {
    let pending = [];
    [...step.children].forEach(el => {
      if (el.classList.contains('step-h')) return;
      pending.push(el);
      if (el.id === 'rubric' && units.length && units[units.length - 1].step === step){ units[units.length - 1].els.push(...pending); pending = []; return; }   // 교사용 평가 기준표는 앞 화면(확인 미션)에 붙임
      if (el.classList.contains('card')){ units.push({step, els: pending, card: el}); pending = []; }
    });
    if (pending.length && units.length) units[units.length - 1].els.push(...pending);
  });
  const P = infoProgress.state;
  if (units.length < 2){
    P.total = P.step = P.maxStep = 1;
    infoProgress.emit('start', {step: 1, total: 1});
    return;
  }
  if (document.body.hasAttribute('data-stage')) return stageMode(units);   // 시범: 한 화면에 활동 하나
  const key = 'reveal:' + location.pathname;
  let shown = 1;
  try { shown = Math.max(1, Math.min(units.length, +sessionStorage.getItem(key) || 1)); } catch (e) {}
  P.total = units.length;
  infoProgress.emit('start', {step: shown, total: units.length});
  const track = () => {   // 진도 신호 (저장 없음)
    const prev = P.step;
    P.step = shown; P.maxStep = Math.max(P.maxStep, shown);
    if (prev && shown !== prev) infoProgress.emit('step', {step: shown, total: units.length, expanded: P.expanded});
    if (shown === units.length && !P.done){ P.done = true; infoProgress.emit('done', {total: units.length, expanded: P.expanded}); }
  };
  const bar = document.createElement('div');
  bar.className = 'nextbar';
  const label = u => {
    const h = u.card.querySelector('h3');
    return h ? h.textContent.replace(/심화|더 해 보기/g, '').trim() : u.step.querySelector('.step-h').textContent.replace(/^\d+/, '').trim();
  };
  const next = (() => {
    if (typeof contentsList === 'undefined') return null;
    const me = location.pathname.split('/').pop();
    const list = contentsList.filter(c => String(c.unit) === String(document.body.dataset.unit));   // 같은 단원 안에서만 이어 가기
    const i = list.findIndex(c => c.href.split('/').pop() === me);
    return i >= 0 && list[i + 1] ? list[i + 1] : null;
  })();
  function render(scroll){
    units.forEach((u, i) => u.els.forEach(el => el.classList.toggle('locked', i >= shown)));
    $$('main .step').forEach(s => s.classList.toggle('locked', !units.some((u, i) => u.step === s && i < shown)));
    const last = units[shown - 1];
    last.els[last.els.length - 1].after(bar);
    if (shown < units.length){
      bar.innerHTML = `<button class="btn next-btn">다음 ▶ <span></span></button><span class="hint">${shown} / ${units.length}</span>`;
      bar.querySelector('span').textContent = label(units[shown]);
      bar.querySelector('button').onclick = () => { shown++; save(); render(true); };
    } else {
      const d = document.body.dataset;
      bar.innerHTML = `<div class="done">🎉 이 활동을 모두 마쳤어요!</div>
        <div class="ctrl" style="justify-content:center">
          <a class="btn line" href="../index.html?unit=${d.unit || ''}">◀ 목차로</a>
          ${next ? `<a class="btn" href="../${next.href}">다음 활동: <span></span> ▶</a>` : ''}
          <button class="btn ghost" id="restartBtn">처음부터 다시</button></div>`;
      if (next) bar.querySelector('a.btn:not(.line) span').textContent = next.title;
      bar.querySelector('#restartBtn').onclick = () => { shown = 1; save(); render(); window.scrollTo({top: 0, behavior: 'smooth'}); };
    }
    const p = $('header.top .prog i'); if (p) p.style.width = (shown / units.length * 100) + '%';
    track();
    window.dispatchEvent(new Event('resize'));          // 숨겨져 있던 캔버스 다시 그리기
    if (scroll){
      const u = units[shown - 1], top = u.els[0].getBoundingClientRect().top + scrollY - 80;
      window.scrollTo({top, behavior: 'smooth'});
      u.card.classList.add('pop'); setTimeout(() => u.card.classList.remove('pop'), 700);
    }
  }
  const save = () => { try { sessionStorage.setItem(key, shown); } catch (e) {} };
  let before = 0;   // 펼치기 전 진행 위치 (접기로 되돌아가기)
  const allLabel = () => $('#allBtn').innerHTML = shown === units.length && before ? '☰ <span>접기</span>' : '☰ <span>펼치기</span>';
  $('#allBtn').onclick = () => {
    if (shown === units.length && before){ shown = before; before = 0; }
    else if (shown < units.length){ before = shown; shown = units.length; P.expanded = true; }   // 펼치기로 건너뛴 것은 따로 표시
    save(); render(); allLabel();
  };
  render();
});

/* 확인 미션: 누르면 바로 채점. items = [{q, o:[...], a:정답번호, e:해설}] */
const boxId = (box, kind) => box.dataset.pid || (box.dataset.pid = box.id || kind + (boxId.n = (boxId.n || 0) + 1));   // 진도 신호용 상자 이름
function renderQuiz(box, items){
  const answered = {}, qid = boxId(box, 'quiz');
  box.innerHTML = items.map((x, i) => `<div class="q" data-q="${i}"><p>${i + 1}. ${x.q}</p>
    <div class="opts">${x.o.map((o, k) => `<button class="opt" data-k="${k}">${o}</button>`).join('')}</div>
    <div class="explain">${x.e}</div></div>`).join('') + '<div class="score"></div>';
  box.querySelectorAll('.q').forEach(qe => {
    const i = +qe.dataset.q;
    qe.querySelectorAll('.opt').forEach(btn => btn.onclick = () => {
      if (i in answered) return;
      answered[i] = +btn.dataset.k === items[i].a;
      qe.querySelectorAll('.opt')[items[i].a].classList.add('right');
      if (!answered[i]) btn.classList.add('wrong');
      qe.querySelector('.explain').classList.add('show');
      if (Object.keys(answered).length === items.length){
        const sc = Object.values(answered).filter(Boolean).length, s = box.querySelector('.score');
        s.textContent = sc === items.length ? `🎉 ${sc} / ${items.length} 모두 맞혔어요!` : `${sc} / ${items.length} · 틀린 문제의 해설을 다시 읽어 보세요.`;
        const again = document.createElement('button'); again.className = 'btn line'; again.style.marginLeft = '8px'; again.textContent = '🔄 다시 풀기'; again.onclick = () => renderQuiz(box, items); s.appendChild(again);
        s.classList.add('show');
        const rec = infoProgress.state.quiz[qid] = infoProgress.state.quiz[qid] || {tries: 0};   // 진도 신호 (저장 없음)
        rec.tries++; rec.score = sc; rec.total = items.length; rec.best = Math.max(rec.best || 0, sc);
        rec.wrong = Object.keys(answered).filter(k => !answered[k]).map(Number);
        infoProgress.emit('quiz', Object.assign({id: qid}, rec));
      }
    });
  });
}

/* 게임형 정리 퀴즈(방 탈출·보드게임 등)의 결과를 퀴즈와 같은 진도 신호로 보냄. results = 문제별 첫 시도 정답 여부 */
function reportQuiz(id, results){
  const rec = infoProgress.state.quiz[id] = infoProgress.state.quiz[id] || {tries: 0}, sc = results.filter(Boolean).length;
  rec.tries++; rec.score = sc; rec.total = results.length; rec.best = Math.max(rec.best || 0, sc);
  rec.wrong = results.map((ok, i) => ok ? -1 : i).filter(i => i >= 0);
  infoProgress.emit('quiz', Object.assign({id}, rec));
}

/* 상황 카드 분류: 상황마다 보기 버튼 중 하나를 고르면 바로 채점.
   items = [{t:상황, a:정답 보기 번호, e:해설}], options = ['보기1', ...] */
/* cfg.look === 'card' 이면 카드형 고르기(진행 막대·도장·흔들림). cfg.optIcons: 보기마다 붙일 아이콘, cfg.tag: 카드 머리말, cfg.title: 맨 위 제목 */
const CX_PAL = ['#3b6cf6', '#16b8a6', '#ff7aa2', '#f59e0b', '#8b5cf6', '#ef6c3a', '#0ea5e9', '#65a30d'];
function renderChoice(box, items, options, onDone, cfg = {}){
  const done = {}, cid = boxId(box, 'choice'), miss = {}, card = cfg.look === 'card', oi = cfg.optIcons || [];
  if (card){
    box.classList.add('cx');
    box.innerHTML = `<div class="cx-top"><b>${cfg.title || '🎯 알맞은 것을 골라요'}</b><span class="cx-n">0 / ${items.length}</span><div class="cx-bar">${items.map(() => '<i></i>').join('')}</div></div>` + items.map((x, i) => `<div class="choice" data-i="${i}" style="--cx:${CX_PAL[i % CX_PAL.length]}"><div class="cx-hd"><span class="cx-ic">${x.icon || '❓'}</span><div class="cx-q"><small>${cfg.tag || '문제'} ${i + 1}</small><p>${x.t}</p></div><span class="cx-stamp" aria-hidden="true"></span></div>
    <div class="opts">${options.map((o, k) => `<button class="opt" data-k="${k}">${oi[k] ? `<span class="oi">${oi[k]}</span>` : ''}${o}</button>`).join('')}</div>
    <div class="explain"></div></div>`).join('') + '<div class="score"></div>';
  } else
  box.innerHTML = items.map((x, i) => `<div class="choice" data-i="${i}"><p>${x.icon ? x.icon + ' ' : ''}${x.t}</p>
    <div class="opts">${options.map((o, k) => `<button class="opt" data-k="${k}">${o}</button>`).join('')}</div>
    <div class="explain"></div></div>`).join('') + '<div class="score"></div>';
  box.querySelectorAll('.choice').forEach(ce => {
    const i = +ce.dataset.i, it = items[i];
    ce.querySelectorAll('.opt').forEach(btn => btn.onclick = () => {
      const k = +btn.dataset.k, ok = k === it.a;
      if (card){
        if (i in done) return;
        btn.classList.add(ok ? 'right' : 'wrong'); btn.disabled = true;
        if (ok){ ce.classList.add('solved'); ce.querySelector('.cx-stamp').textContent = options[k]; ce.querySelectorAll('.opt:not(.right)').forEach(b => b.disabled = true);
          box.querySelectorAll('.cx-bar i')[i].className = (i in miss) ? 'ok late' : 'ok'; box.querySelector('.cx-n').textContent = (Object.keys(done).length + 1) + ' / ' + items.length; }
        else { ce.classList.remove('shake'); void ce.offsetWidth; ce.classList.add('shake'); box.querySelectorAll('.cx-bar i')[i].className = 'no'; }
      } else {
      ce.querySelectorAll('.opt').forEach(b => b.classList.remove('right', 'wrong'));
      btn.classList.add(ok ? 'right' : 'wrong');
      }
      const ex = ce.querySelector('.explain');
      ex.textContent = ok ? '⭕ ' + (it.e || '정답!') : '❌ 다시 생각해 보세요.' + (it.hint ? ' 💡 ' + it.hint : '');
      ex.classList.add('show');
      if (!ok && !(i in done)) miss[i] = (miss[i] || 0) + 1;
      if (ok && !(i in done)){
        done[i] = 1;
        if (Object.keys(done).length === items.length){
          const s = box.querySelector('.score'); s.textContent = '🎉 모두 해결했어요!'; s.classList.add('show');
          const rec = infoProgress.state.choice[cid] = {total: items.length, missed: Object.keys(miss).map(Number)};   // 진도 신호 (저장 없음)
          infoProgress.emit('choice', Object.assign({id: cid}, rec));
          onDone && onDone();
        }
      }
    });
  });
}

function feedback(el, ok, msg){ el.textContent = msg; el.className = 'feedback show ' + (ok ? 'ok' : 'bad'); }

/* 엔트리로 만들어 보기 미션 카드: entryMission(box, {title, goal, need:[], steps:[], check:[]}) */
function entryMission(box, m){
  const esc = s => String(s).replace(/[<>&]/g, c => ({'<': '&lt;', '>': '&gt;', '&': '&amp;'}[c]));
  box.innerHTML = `<h3>🧩 엔트리로 만들어 보기 <span class="tag-opt">실습 미션</span></h3>
    <p><b>${esc(m.title)}</b><br>${esc(m.goal)}</p>
    ${m.need ? `<p class="hint">필요한 것: ${m.need.map(esc).join(' · ')}</p>` : ''}
    <ol class="mission-steps">${m.steps.map(s => `<li>${esc(s)}</li>`).join('')}</ol>
    <p><a class="btn" href="https://playentry.org/ws" target="_blank" rel="noopener">엔트리 열기 ↗</a></p>
    <div class="mission-check"><b>✅ 스스로 점검</b>${m.check.map(c => `<label><input type="checkbox"> ${esc(c)}</label>`).join('')}<p class="hint"></p></div>`;
  const ins = box.querySelectorAll('.mission-check input'), msg = box.querySelector('.mission-check .hint');
  const mid = boxId(box, 'mission');
  ins.forEach(i => i.onchange = () => {
    const n = [...ins].filter(x => x.checked).length;
    msg.textContent = n === ins.length ? '🎉 미션 완료! 친구와 프로그램을 바꿔 실행해 보세요.' : `${n} / ${ins.length}`;
    if (n === ins.length && !infoProgress.state.mission[mid]){ infoProgress.state.mission[mid] = {total: n}; infoProgress.emit('mission', {id: mid, total: n}); }   // 진도 신호 (저장 없음)
  });
}

/* 프로젝트 평가 기준표(교사용): rubric(box, {std, rows:[[평가 요소, 상, 중, 하], ...]}) */
function rubric(box, r){
  const esc = s => String(s).replace(/[<>&]/g, c => ({'<': '&lt;', '>': '&gt;', '&': '&amp;'}[c]));
  box.innerHTML = `<details class="rubric"><summary>📏 평가 기준표 (교사용 · 성취기준 [9정${esc(r.std)}])</summary>
    <div class="scroll-x"><table><tr><th>평가 요소</th><th>상</th><th>중</th><th>하</th></tr>${r.rows.map(([k, a, b, c]) => `<tr><th>${esc(k)}</th><td>${esc(a)}</td><td>${esc(b)}</td><td>${esc(c)}</td></tr>`).join('')}</table></div>
    <p class="hint">성취수준(A~E)과 학교 평가 계획에 맞게 조정해 사용하세요.</p></details>`;
}

/* 내 말로 설명하기: explainIt(box, {q, words:[꼭 넣을 낱말], ex:예시 답안}) — 저장하지 않음 */
function explainIt(box, m){
  const esc = s => String(s).replace(/[<>&]/g, c => ({'<': '&lt;', '>': '&gt;', '&': '&amp;'}[c]));
  box.innerHTML = `<h3>✍️ 내 말로 설명하기</h3><p>${esc(m.q)}</p>
    <p class="hint">꼭 넣을 낱말: ${m.words.map(w => `<span class="pill" data-w="${esc(w)}">${esc(w)}</span>`).join(' ')}</p>
    <textarea rows="3" class="explain-in" placeholder="친구에게 설명하듯 2~3문장으로 써 보세요. (저장되지 않아요)"></textarea>
    <div class="ctrl"><button class="btn line" data-ex>💡 예시 답안 보기</button></div><p class="explain-ex hint" hidden>${esc(m.ex)}</p>`;
  const ta = box.querySelector('textarea');
  ta.oninput = () => box.querySelectorAll('[data-w]').forEach(p => { const ok = ta.value.includes(p.dataset.w); p.style.background = ok ? 'var(--mint-soft)' : ''; p.textContent = (ok ? '✓ ' : '') + p.dataset.w; });
  box.querySelector('[data-ex]').onclick = () => { box.querySelector('.explain-ex').hidden = false; };
}


/* 인쇄할 때 접힌 내용(평가 기준표, 안내 등)도 펼쳐서 인쇄 */
addEventListener('beforeprint', () => document.querySelectorAll('details').forEach(d => d.open = true));

/* 로그인·잠금·진도 기록(auth.js)을 함께 불러온다. 로그인 전에는 활동 내용을 가린다. */
(function loadAuth(){
  const me = document.currentScript && document.currentScript.src;
  if (!me || (typeof loginActive === 'function' && !loginActive())) return;   // 학생 로그인이 꺼져 있으면 지금처럼 바로 체험
  document.documentElement.classList.add('ga-wait');
  const s = document.createElement('script');
  s.src = me.replace(/common\.js(\?.*)?$/, 'auth.js');
  s.onerror = () => document.body.insertAdjacentHTML('afterbegin', '<p class="feedback show bad" style="margin:80px 16px">로그인 기능을 불러오지 못했어요. 인터넷 연결을 확인하고 새로고침하세요.</p>');
  document.head.appendChild(s);
})();

/* ===== 한 화면에 활동 하나 (body에 data-stage가 있는 페이지만) =====
   카드 하나 = 화면 하나. 위쪽 단계 칩, 아래쪽 [◀ 이전] [다음 ▶], 화면 전환 애니메이션.
   주소 끝에 #s3 처럼 단계가 기록되어 브라우저 [뒤로 가기]로 이전 단계로 돌아간다.
   키보드 ← → (발표용 리모컨의 PageUp/PageDown)로도 넘길 수 있다.
   도우미 '코딩이'가 화면마다 한마디 하고, 정답·오답에 반응한다.
   카드에 data-bot="말" 을 쓰면 그 화면에서 코딩이가 할 말, 생각 열기 카드에 data-think="보기1|보기2" 를 쓰면 생각 고르기.
   한 줄 정리 카드의 굵은 글씨(<b>)는 눌러서 여는 빈칸이 된다.
   진도 신호는 기존과 같게 '가장 멀리 간 단계'를 step으로 보낸다. */
const BOT_SVG = `<g class="ant"><line x1="50" y1="22" x2="50" y2="10" stroke="#9a8af5" stroke-width="4" stroke-linecap="round"/><circle cx="50" cy="8" r="6.5" fill="#ff9cb8"/></g>
  <rect x="5" y="44" width="9" height="18" rx="4.5" fill="#9a8af5"/>
  <rect class="arm-r" x="86" y="44" width="9" height="18" rx="4.5" fill="#9a8af5"/>
  <rect x="12" y="22" width="76" height="60" rx="26" fill="#fff" stroke="#9a8af5" stroke-width="4"/>
  <rect x="22" y="33" width="56" height="36" rx="16" fill="#2f2a47"/>
  <ellipse class="eye" cx="39" cy="48" rx="5" ry="7" fill="#86f2cf"/>
  <ellipse class="eye" cx="61" cy="48" rx="5" ry="7" fill="#86f2cf"/>
  <path class="mouth" d="M43 58 Q50 63 57 58" stroke="#86f2cf" stroke-width="3.5" fill="none" stroke-linecap="round"/>
  <ellipse class="mouth-o" cx="50" cy="60" rx="5" ry="4" fill="#86f2cf"/>
  <circle cx="20" cy="66" r="5" fill="#ffc8d7"/><circle cx="80" cy="66" r="5" fill="#ffc8d7"/>
  <rect x="34" y="84" width="32" height="10" rx="5" fill="#ffd45c"/>`;
const botSvg = (w = 64) => `<svg class="bot" width="${w}" height="${Math.round(w * .96)}" viewBox="0 0 100 96" role="button" tabindex="0" aria-label="코딩이 (누르면 한마디)">${BOT_SVG}</svg>`;
const BOT = {
  think: ['정답은 없어! 떠오르는 생각을 골라 봐 🤔', '먼저 생각부터! 틀려도 괜찮아 🤔'],
  act: ['직접 눌러 보면서 알아보자! 👆'],
  quiz: ['배운 걸 확인해 볼까? 틀리면 해설을 읽으면 돼 📝'],
  sum: ['빈칸을 눌러서 핵심 낱말을 떠올려 봐! 🧠'],
  good: ['정답! 👍', '좋아, 잘하고 있어 ✨', '바로 그거야! 😆', '삐빅! 정답 신호 감지 📡', '역시! 💯'],
  bad: ['괜찮아, 다시 해 보자 💪', '아깝다! 설명을 읽어 볼까? 🔍', '틀려도 괜찮아. 디버깅하면 돼 🔧'],
  fun: ['삐빅! 반가워 🤖', '나를 눌렀구나? 간지러워 ㅋㅋ', '0과 1로 인사할게. 01101000 01101001 👋',
    '컴퓨터는 시킨 대로만 한대. 그래서 순서가 중요해 😎', '배터리 충전 완료! 100% 🔋',
    '알고 있었어? 최초의 컴퓨터 버그는 진짜 나방이었대 🦋', '1바이트는 8비트! 나는 오늘 기분이 8비트만큼 좋아 😆',
    '어려운 문제는 작게 쪼개 봐! 그게 바로 분해야 🧩', '에러 메시지는 화내는 게 아니라 힌트를 주는 거야 💬',
    '나는 알고리즘대로 움직여. 너는 뭐든 할 수 있고 💪', '쉬는 시간엔 눈도 좀 쉬게 해 줘 👀', '나 너무 많이 누르면… 어지러워 @_@'],
};
const botPick = a => a[Math.floor(Math.random() * a.length)];

function stageMode(units){
  const P = infoProgress.state, N = units.length, root = document.documentElement, main = $('main');
  const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
  root.classList.add('stage-on');
  const esc = s => String(s).replace(/[<>&"]/g, c => ({'<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;'}[c]));
  const stepTitle = u => { const h = u.step.querySelector('.step-h'); return h ? h.textContent.replace(/^\s*\d+/, '').trim() : ''; };
  const kind = u => u.step.classList.contains('think') ? 'think' : u.step.classList.contains('sum') ? 'sum' : /확인|퀴즈|점검/.test(stepTitle(u)) ? 'quiz' : 'act';
  const label = u => { const h = u.card.querySelector('h3'); if (!h) return stepTitle(u); const c = h.cloneNode(true); c.querySelectorAll('.tag-more, .tag-opt').forEach(t => t.remove()); return c.textContent.trim(); };
  units.forEach(u => { u.kind = kind(u); u.step.dataset.kind = u.kind; });
  const steps = $$('main .step');
  const outro = $$('main > .src');
  // 제목·소개를 첫 화면의 머리 상자로 묶기
  const hero = document.createElement('div');
  hero.className = 'st-hero';
  const introEls = [...main.children].filter(el => !el.matches('.step, .src'));
  if (introEls.length){ introEls[0].before(hero); introEls.forEach(el => hero.appendChild(el)); }
  const next = (() => {
    if (typeof contentsList === 'undefined') return null;
    const me = location.pathname.split('/').pop();
    const list = contentsList.filter(c => String(c.unit) === String(document.body.dataset.unit));
    const i = list.findIndex(c => c.href.split('/').pop() === me);
    return i >= 0 && list[i + 1] ? list[i + 1] : null;
  })();

  // 같은 묶음(예: 조작 활동) 안에 화면이 여러 개면 제목 옆에 "2 / 4" 표시
  steps.forEach(s => {
    const mine = units.filter(u => u.step === s), h = s.querySelector('.step-h');
    if (mine.length > 1 && h){ const t = document.createElement('span'); t.className = 'st-sub'; h.appendChild(t); mine.forEach((u, k) => u.sub = [t, `${k + 1} / ${mine.length}`]); }
  });

  /* ---- 코딩이 ---- */
  const guide = document.createElement('div');
  guide.className = 'st-guide';
  guide.innerHTML = botSvg(64) + '<div class="st-bubble" aria-live="polite"></div>';
  const bot = guide.querySelector('.bot'), bubble = guide.querySelector('.st-bubble');
  let sayT = null, lastSay = 0;
  function say(html, opt = {}){
    clearTimeout(sayT); lastSay = Date.now();
    if (opt.jump) jump();
    if (RM){ bubble.innerHTML = html; return; }
    bot.classList.add('talking');
    let i = 0;
    const stepT = () => {
      if (html.charAt(i) === '<') i = html.indexOf('>', i) + 1;
      else if (html.charAt(i) === '&') i = html.indexOf(';', i) + 1;
      else { const cp = html.codePointAt(i); i += cp > 0xffff ? 2 : 1; }
      bubble.innerHTML = html.slice(0, i) + '<span class="caret"></span>';
      if (i < html.length) sayT = setTimeout(stepT, 26);
      else { bubble.innerHTML = html; bot.classList.remove('talking'); }
    };
    stepT();
  }
  function jump(){ if (RM) return; bot.classList.remove('jump'); void bot.getBoundingClientRect(); bot.classList.add('jump'); setTimeout(() => bot.classList.remove('jump'), 700); }
  const poke = () => say(botPick(BOT.fun), {jump: true});
  bot.addEventListener('click', poke);
  bot.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' '){ e.preventDefault(); poke(); } });
  function lineFor(i){
    const u = units[i];
    let t = u.card.dataset.bot ? esc(u.card.dataset.bot) : u.kind === 'sum' && !u.card.querySelector('.blank') ? '오늘 배운 내용을 소리 내어 한 번 읽어 볼까? 📌' : botPick(BOT[u.kind]);
    if (i === 0) t = '안녕! 나는 정보 도우미 <b>코딩이</b>야 🤖 ' + t;
    return t;
  }
  // 정답·오답에 반응 (보기 버튼, 피드백 상자)
  const react = ok => { if (Date.now() - lastSay < 900) return; say(botPick(ok ? BOT.good : BOT.bad), {jump: ok}); };
  document.addEventListener('click', e => {
    const o = e.target.closest && e.target.closest('main .opt');
    if (!o) return;
    setTimeout(() => { if (o.classList.contains('right')) react(true); else if (o.classList.contains('wrong')) react(false); }, 0);
  }, true);
  if (typeof feedback === 'function'){
    const fb0 = feedback;
    window.feedback = feedback = function(el, ok, msg){ fb0(el, ok, msg); if (!all && units[cur].els.some(x => x.contains(el))) setTimeout(() => react(ok), 0); };
  }
  addEventListener('info:progress', e => {
    const d = e.detail;
    if (all) return;
    if (d.type === 'quiz') setTimeout(() => say(d.score === d.total ? `${d.total}문제 모두 맞혔어! 🎉 [다음 ▶]을 눌러 볼까?` : `${d.score} / ${d.total}! 틀린 문제의 해설을 읽어 보자 📖`, {jump: d.score === d.total}), 30);
    if (d.type === 'choice') setTimeout(() => say(cur < N - 1 ? '다 해냈어! 👏 준비되면 [다음 ▶]을 눌러 줘' : '다 해냈어! 👏', {jump: true}), 30);
    if (d.type === 'mission') setTimeout(() => say('미션 완료! 멋져 🚀', {jump: true}), 30);
  });

  /* ---- 생각 열기: 생각 고르기 (저장하지 않음) ---- */
  units.filter(u => u.kind === 'think' && u.card.dataset.think).forEach(u => {
    const box = document.createElement('div');
    box.className = 'think-pick';
    box.innerHTML = '<span class="tp-q">내 생각은?</span>' + u.card.dataset.think.split('|').map(t => `<button class="tp">${esc(t.trim())}</button>`).join('');
    box.querySelectorAll('.tp').forEach(b => b.onclick = () => {
      box.querySelectorAll('.tp').forEach(x => x.classList.toggle('on', x === b));
      say(`「${esc(b.textContent)}」 좋은 생각이야! 활동하면서 확인해 보자 👉`, {jump: true});
    });
    u.card.appendChild(box);
  });

  /* ---- 한 줄 정리: 굵은 낱말을 눌러서 여는 빈칸 ---- */
  units.filter(u => u.kind === 'sum').forEach(u => {
    const bs = [...u.card.querySelectorAll('p b')];
    if (bs.length < 2) return;
    bs.forEach(b => { const s = document.createElement('button'); s.className = 'blank'; s.title = '눌러서 보기'; s.innerHTML = b.innerHTML; b.replaceWith(s); });
    const ctl = document.createElement('div');
    ctl.className = 'blank-ctl';
    ctl.innerHTML = '<span class="hint">빈칸을 눌러 핵심 낱말을 떠올려 봐요.</span> <button class="btn line">👀 모두 보기</button>';
    u.card.appendChild(ctl);
    const blanks = [...u.card.querySelectorAll('.blank')];
    const check = () => { if (blanks.every(x => x.classList.contains('open')) && !u.cleared){ u.cleared = true; ctl.querySelector('.hint').textContent = '✅ 핵심 낱말을 모두 확인했어요.'; say('핵심 낱말을 다 찾았어! 오늘 배운 거 잊지 마 😊', {jump: true}); } };
    blanks.forEach(x => x.onclick = () => { x.classList.add('open'); check(); });
    ctl.querySelector('button').onclick = () => { blanks.forEach(x => x.classList.add('open')); check(); };
  });

  // 저장된 위치(새로 고침해도 유지)와 주소의 #sN
  const key = 'stage:' + location.pathname;
  let cur = 0, max = 0, busy = 0, all = false;
  try { const s = JSON.parse(sessionStorage.getItem(key) || '{}'); max = Math.min(N - 1, Math.max(0, s.max | 0)); cur = Math.min(max, Math.max(0, s.cur | 0)); } catch (e) {}
  const fromHash = () => { const m = location.hash.match(/^#s(\d+)$/); return m ? Math.min(N, Math.max(1, +m[1])) - 1 : null; };
  const h0 = fromHash();
  if (h0 !== null){ cur = h0; max = Math.max(max, h0); }
  const save = () => { try { sessionStorage.setItem(key, JSON.stringify({cur, max})); } catch (e) {} };
  const url = i => location.pathname + location.search + '#s' + (i + 1);

  // 위쪽 단계 칩
  const nav = document.createElement('nav');
  nav.className = 'stagenav'; nav.setAttribute('aria-label', '활동 단계');
  nav.innerHTML = '<div class="in">' + units.map(u => `<button class="chip k-${u.kind}"><b></b><span></span></button>`).join('') + '</div>';
  const chips = [...nav.querySelectorAll('.chip')];
  chips.forEach((c, i) => {
    c.title = (i + 1) + '. ' + label(units[i]);
    c.querySelector('b').textContent = i + 1;
    c.querySelector('span').textContent = label(units[i]);
    c.onclick = () => all ? units[i].els[0].scrollIntoView({behavior: RM ? 'auto' : 'smooth', block: 'start'}) : go(i);
  });
  $('header.top').appendChild(nav);

  // 아래쪽 이동 막대와 마침 화면 (요란한 효과 없이 코딩이가 인사)
  const bar = document.createElement('div');
  bar.className = 'stagebar';
  main.after(bar);
  const done = document.createElement('div');
  done.className = 'stagedone';
  const d = document.body.dataset;
  done.innerHTML = `<div class="sd-talk">${botSvg(72)}<div class="st-bubble">이 활동을 모두 마쳤어! 수고했어 😊${next ? '<br>다음 활동도 함께 해 볼까?' : ''}</div></div>
    <div class="ctrl"><a class="btn line" href="../index.html?unit=${d.unit || ''}">◀ 목차로</a>
    ${next ? `<a class="btn" href="../${next.href}">다음 활동: <span></span> ▶</a>` : ''}
    <button class="btn ghost" data-restart>처음부터 다시</button></div>`;
  if (next) done.querySelector('a.btn:not(.line) span').textContent = next.title;
  done.querySelector('[data-restart]').onclick = () => { max = 0; go(0); };
  done.querySelector('.bot').addEventListener('click', e => { const b = e.currentTarget; b.classList.remove('jump'); void b.getBoundingClientRect(); b.classList.add('jump'); });
  main.appendChild(done);

  function show(){
    units.forEach((u, k) => u.els.forEach(el => el.classList.toggle('st-hide', k !== cur)));
    steps.forEach(s => s.classList.toggle('st-hide', units[cur].step !== s));
    hero.classList.toggle('st-hide', cur !== 0);
    outro.forEach(el => el.classList.toggle('st-hide', cur !== N - 1));
    done.classList.toggle('st-hide', cur !== N - 1);
    if (units[cur].sub) units[cur].sub[0].textContent = units[cur].sub[1];
    units[cur].els[0].before(guide);
    say(lineFor(cur));
    dispatchEvent(new CustomEvent('stage:show', {detail: {index: cur, card: units[cur].card, all: false}}));
  }
  function renderNav(){
    chips.forEach((c, i) => {
      c.classList.toggle('on', i === cur); c.classList.toggle('seen', i <= max);
      c.disabled = !all && i > max;
      if (i === cur) c.setAttribute('aria-current', 'step'); else c.removeAttribute('aria-current');
    });
    const c = chips[cur], box = nav.firstChild;   // 현재 칩이 보이도록 가로 스크롤
    box.scrollTo({left: c.offsetLeft - box.clientWidth / 2 + c.offsetWidth / 2, behavior: RM ? 'auto' : 'smooth'});
  }
  function renderBar(){
    bar.hidden = all;
    const last = cur === N - 1;
    bar.innerHTML = `<div class="in"><button class="btn line prev"${cur === 0 ? ' disabled' : ''}>◀ 이전</button>
      <span class="cnt"><b>${cur + 1}</b> / ${N}</span>
      ${last ? '<span class="fin">🏁 마지막 단계</span>' : '<button class="btn nextgo">다음<span></span> <i class="arr">▶</i></button>'}</div>`;
    bar.querySelector('.prev').onclick = () => go(cur - 1);
    if (!last){ bar.querySelector('.nextgo span').textContent = ': ' + label(units[cur + 1]); bar.querySelector('.nextgo').onclick = () => go(cur + 1); }
  }
  function track(){
    P.total = N;
    const prev = P.step;
    P.step = P.maxStep = Math.max(P.maxStep, max + 1);
    if (prev && P.step !== prev) infoProgress.emit('step', {step: P.step, total: N, view: cur + 1, expanded: P.expanded});
    if (max === N - 1 && !P.done){ P.done = true; infoProgress.emit('done', {total: N, expanded: P.expanded}); }
  }
  const settle = a => Promise.race([a.finished.catch(() => {}), new Promise(r => setTimeout(r, 450))]);
  function enter(dir){
    if (RM) return;
    main.animate([{opacity: 0, transform: `translateX(${dir * 48}px)`}, {opacity: 1, transform: 'none'}], {duration: 320, easing: 'cubic-bezier(.2,.8,.3,1)'});
    const vis = units[cur].els.filter(el => el.classList.contains('card'));
    vis.forEach((el, k) => el.animate([{opacity: 0, transform: 'translateY(18px) scale(.98)'}, {opacity: 1, transform: 'none'}],
      {duration: 420, delay: 110 + k * 70, easing: 'cubic-bezier(.2,.9,.3,1.2)', fill: 'backwards'}));
    const no = units[cur].step.querySelector('.step-h .no');
    if (no) no.animate([{transform: 'scale(.4) rotate(-20deg)'}, {transform: 'scale(1.15) rotate(6deg)', offset: .6}, {transform: 'none'}], {duration: 480, easing: 'ease-out'});
    bot.animate([{transform: 'translateY(10px) scale(.9)', opacity: 0}, {transform: 'none', opacity: 1}], {duration: 360, easing: 'cubic-bezier(.3,1.5,.5,1)'});
  }
  // 단계 이동. push=false는 브라우저 뒤로/앞으로 가기에서 부를 때
  function go(i, push = true){
    i = Math.max(0, Math.min(N - 1, i));
    if (all || i > max + 1 || (i === cur && push)) return;
    const dir = i >= cur ? 1 : -1, my = ++busy;
    const swap = () => {
      if (my !== busy) return;
      cur = i; max = Math.max(max, i); save();
      if (push) history.pushState({st: i}, '', url(i));
      show(); renderNav(); renderBar(); track();
      window.scrollTo({top: 0});
      window.dispatchEvent(new Event('resize'));   // 숨겨져 있던 캔버스 다시 그리기
      enter(dir);
    };
    if (RM || !push) return swap();
    settle(main.animate([{opacity: 1, transform: 'none'}, {opacity: 0, transform: `translateX(${-dir * 36}px)`}], {duration: 160, easing: 'ease-in'})).then(swap);
  }
  addEventListener('popstate', () => {
    if (all) return;
    const h = fromHash(), i = h === null ? 0 : h;
    if (i <= max + 1) go(i, false); else history.replaceState({st: cur}, '', url(cur));
  });
  addEventListener('keydown', e => {
    if (all || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
    if (e.target.closest && e.target.closest('input, textarea, select, [contenteditable]')) return;
    if ((e.key === 'ArrowRight' || e.key === 'PageDown') && cur < N - 1){ e.preventDefault(); go(cur + 1); }
    else if ((e.key === 'ArrowLeft' || e.key === 'PageUp') && cur > 0){ e.preventDefault(); go(cur - 1); }
  });

  // ☰ 펼치기: 모든 화면을 한 페이지에 (교사용 미리 보기). 다시 누르면 한 화면 모드로
  const allBtn = $('#allBtn');
  const allLabel = () => allBtn.innerHTML = all ? '☰ <span>접기</span>' : '☰ <span>펼치기</span>';
  allBtn.onclick = () => {
    all = !all; root.classList.toggle('stage-all', all);
    if (all && max < N - 1) P.expanded = true;
    renderNav(); renderBar(); allLabel();
    if (all) dispatchEvent(new CustomEvent('stage:show', {detail: {index: -1, card: null, all: true}}));
    else show();
    window.scrollTo({top: 0}); window.dispatchEvent(new Event('resize'));
  };

  // 다른 기능(실시간 바로 가기 등)이 특정 카드로 이동할 때
  window.stageShow = el => {
    const i = units.findIndex(u => u.els.some(x => x === el || x.contains(el)));
    if (i < 0 || all) return false;
    max = Math.max(max, i - 1); if (i !== cur) go(i);
    return true;
  };

  history.replaceState({st: cur}, '', url(cur));
  save(); show(); renderNav(); renderBar();
  P.total = N; P.step = P.maxStep = max + 1;
  infoProgress.emit('start', {step: max + 1, total: N, view: cur + 1});
  if (max === N - 1) P.done = true;
  enter(1);
}
