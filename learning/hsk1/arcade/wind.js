(() => {
  'use strict';

  const games = window.HSK_MINIGAMES ||= {};
  const LANE_COUNT = 3;
  const ROUTE_LENGTH = 6;
  const normal = value => value.normalize('NFC').toLowerCase().replace(/[\s'’·-]/gu, '');
  const readingKeys = word => [word.pinyin, ...(word.pinyinAlternatives || [])].map(normal);
  const laneNames = ['Làn trái', 'Làn giữa', 'Làn phải'];

  function shuffle(items) {
    const result = [...items];
    for (let index = result.length - 1; index > 0; index -= 1) {
      const next = Math.floor(Math.random() * (index + 1));
      [result[index], result[next]] = [result[next], result[index]];
    }
    return result;
  }

  function checkpoint(word, pool, fromReading, revisits = null) {
    const answerReadings = readingKeys(word);
    const choices = pool.filter(other => other.id !== word.id && other.hanzi !== word.hanzi &&
      normal(other.vi) !== normal(word.vi) &&
      (!fromReading || !readingKeys(other).some(reading => answerReadings.includes(reading))));
    const sameLength = choices.filter(other => other.hanzi.length === word.hanzi.length);
    const alternatives = [...new Set([...shuffle(sameLength), ...shuffle(choices)])].slice(0, LANE_COUNT - 1);
    return {word, fromReading, revisits, gates: shuffle([word, ...alternatives])};
  }

  games.wind = function mountWind(root, ctx) {
    root.innerHTML = `
      <section class="wind-game" data-wind aria-label="Đường Gió">
        <p class="wind-intro">Lái diều qua cửa mang chữ Hán khớp với gợi ý. Ghé luồng gió để nhận thêm điểm.</p>
        <div class="wind-hud" aria-label="Tiến độ">
          <div><small>Trạm</small><b data-wind-round></b></div>
          <div><small>Điểm</small><b data-wind-score>0</b></div>
          <div><small>Chuỗi đúng</small><b data-wind-streak>0</b></div>
        </div>
        <ol class="wind-route" role="list" aria-label="Tiến độ trạm"></ol>
        <div class="wind-play">
          <div class="wind-prompt">
            <span data-wind-clue-kind></span>
            <strong data-wind-clue></strong>
          </div>
          <div class="wind-stage" data-wind-stage data-cinema-stage aria-label="Đường bay ba làn">
            <i class="wind-ridges" aria-hidden="true"></i>
            <div class="wind-doors" role="group" aria-label="Chọn làn cửa chữ">
              ${laneNames.map((_, lane) => '<button type="button" data-wind-lane="' + lane + '"><span lang="zh-Hans"></span></button>').join('')}
            </div>
            <div class="wind-ribbon" aria-hidden="true" hidden><b>≈</b></div>
            <div class="wind-kite" aria-hidden="true"><i></i><b></b></div>
          </div>
          <div class="wind-controls">
            <button type="button" class="btn button-soft wind-steer" data-wind-move="-1" aria-label="Qua làn trái">←</button>
            <button type="button" class="btn primary" data-wind-cross>Qua cửa</button>
            <button type="button" class="btn button-soft wind-steer" data-wind-move="1" aria-label="Qua làn phải">→</button>
          </div>
        </div>
        <p class="wind-status" data-wind-status role="status"></p>
        <button type="button" class="btn button-soft full" data-wind-next hidden>Bay tiếp</button>
        <button type="button" class="btn primary full" data-wind-replay hidden>Chơi lại</button>
      </section>`;

    const view = root.querySelector('[data-wind]');
    const stage = view.querySelector('[data-wind-stage]');
    const roundLabel = view.querySelector('[data-wind-round]');
    const scoreLabel = view.querySelector('[data-wind-score]');
    const streakLabel = view.querySelector('[data-wind-streak]');
    const progress = view.querySelector('.wind-route');
    const play = view.querySelector('.wind-play');
    const clueKind = view.querySelector('[data-wind-clue-kind]');
    const clue = view.querySelector('[data-wind-clue]');
    const gates = [...view.querySelectorAll('[data-wind-lane]')];
    const ribbon = view.querySelector('.wind-ribbon');
    const cross = view.querySelector('[data-wind-cross]');
    const steers = [...view.querySelectorAll('[data-wind-move]')];
    const status = view.querySelector('[data-wind-status]');
    const next = view.querySelector('[data-wind-next]');
    const replay = view.querySelector('[data-wind-replay]');
    const controls = new AbortController();
    const {signal} = controls;
    let route;
    let visited;
    let pool;
    let originalCount;
    let round;
    let lane;
    let draftLane;
    let charged;
    let score;
    let streak;
    let hits;
    let crossing;
    let finished;
    let pointer;
    let lastSwipe = -Infinity;
    let eventDrivenKeyboard = false;

    if (ctx.lowMotion) view.classList.add('wind-still');

    function updateScore() {
      scoreLabel.textContent = score;
      streakLabel.textContent = streak;
    }

    function updateRoute() {
      progress.replaceChildren(...visited.map((state, index) => {
        const marker = document.createElement('li');
        marker.className = state || (index === round ? 'current' : '');
        const label = {lit:'đã qua', missed:'cần ôn lại', retried:'đã qua khi ôn lại'};
        marker.setAttribute('aria-label', `Trạm ${index + 1} ${label[state] || 'đang chờ'}`);
        return marker;
      }));
    }

    function setStatus(message, tone = '') {
      status.textContent = message;
      status.dataset.tone = tone;
    }

    function lanePosition(index) {
      return `${(index + .5) * 100 / LANE_COUNT}%`;
    }

    function updateSteering() {
      stage.style.setProperty('--kite-x', lanePosition(lane));
      stage.dataset.lane = String(lane);
      stage.classList.toggle('has-draft', charged);
      gates.forEach((gate, index) => gate.setAttribute('aria-pressed', String(index === lane)));
      steers[0].disabled = crossing || lane === 0;
      steers[1].disabled = crossing || lane === route[round].gates.length - 1;
      cross.disabled = crossing;
    }

    function move(index) {
      if (crossing || finished || index < 0 || index >= route[round].gates.length || index === lane) return;
      lane = index;
      ctx.motion?.('steer', stage, {lane});
      if (lane === draftLane && !charged) {
        charged = true;
        ctx.motion?.('gust', ribbon);
        ribbon.hidden = true;
        setStatus('Diều đã đón gió. Bay vào cửa đúng để nhận thêm 30 điểm.');
      }
      updateSteering();
    }

    function showRound() {
      const current = route[round];
      lane = Math.min(lane, current.gates.length - 1);
      const drafts = current.gates.map((_, index) => index).filter(index => index !== lane);
      draftLane = drafts[Math.floor(Math.random() * drafts.length)];
      charged = false;
      crossing = false;
      stage.dataset.flight = '';
      const review = current.revisits !== null;
      roundLabel.textContent = review ? 'Bay bù' : `${round + 1}/${originalCount}`;
      clueKind.textContent = current.fromReading ? 'Tìm chữ theo Pinyin' : 'Tìm chữ theo nghĩa';
      clue.textContent = current.fromReading ? current.word.pinyin : current.word.vi;
      gates.forEach((gate, index) => {
        const word = current.gates[index];
        gate.hidden = !word;
        if (!word) return;
        gate.disabled = false;
        gate.dataset.word = word.id;
        gate.dataset.outcome = '';
        gate.querySelector('span').textContent = word.hanzi;
        gate.setAttribute('aria-label', `${laneNames[index]} · ${word.hanzi}`);
      });
      ribbon.hidden = draftLane === undefined;
      if (!ribbon.hidden) {
        ribbon.style.setProperty('--draft-x', lanePosition(draftLane));
        const draftGate = gates[draftLane];
        draftGate.setAttribute('aria-label', draftGate.getAttribute('aria-label') + ' · có luồng gió');
      }
      next.hidden = true;
      updateRoute();
      updateSteering();
      setStatus(review ? 'Chữ này quay lại để bạn thử nhớ thêm một lần.' : 'Chạm cửa, vuốt diều hoặc dùng phím mũi tên để đổi làn.');
    }

    function setup() {
      const words = ctx.words(24);
      pool = [...new Map(words.map(word => [word.id, word])).values()];
      route = pool.slice(0, ROUTE_LENGTH).map((word, index) => checkpoint(word, pool, index % 2 === 1));
      originalCount = route.length;
      visited = Array.from({length: originalCount}, () => '');
      round = score = streak = hits = 0;
      lane = 1;
      crossing = finished = false;
      replay.hidden = true;
      play.hidden = !originalCount;
      updateScore();
      if (originalCount) showRound();
      else {
        finished = true;
        roundLabel.textContent = '—';
        setStatus('Chưa có từ để bay. Hãy thử lại sau khi học thêm.');
      }
    }

    function crossGate() {
      if (crossing || finished) return;
      const current = route[round];
      const correct = current.gates[lane] === current.word;
      const review = current.revisits !== null;
      crossing = true;
      stage.dataset.flight = correct ? 'pass' : 'miss';
      stage.style.setProperty('--kite-x', lanePosition(lane));
      gates.forEach((gate, index) => {
        gate.disabled = true;
        if (index === lane && !correct) gate.dataset.outcome = 'wrong';
        if (current.gates[index] === current.word) gate.dataset.outcome = 'answer';
      });
      if (correct) {
        streak++;
        hits++;
        const points = (review ? 60 : 100) + (charged ? 30 : 0) + Math.min(streak - 1, 4) * 15;
        score += points;
        setStatus(`Qua cửa! ${current.word.hanzi} · ${current.word.pinyin} · ${current.word.vi}. +${points} điểm.`, 'good');
      } else {
        streak = 0;
        setStatus(`Cửa đúng là ${current.word.hanzi} · ${current.word.pinyin} · ${current.word.vi}.`, 'retry');
        if (!review) route.push(checkpoint(current.word, pool, !current.fromReading, round));
      }
      if (!review) visited[round] = correct ? 'lit' : 'missed';
      if (review && correct) visited[current.revisits] = 'retried';
      ctx.grade(current.word.id, 'hanzi', correct ? review ? 'almost' : 'good' : 'again');
      ctx.motion?.('cross', gates[lane], {lane, correct, charged});
      updateScore();
      updateRoute();
      updateSteering();
      next.textContent = round + 1 < route.length ? 'Bay tiếp' : 'Xem kết quả';
      next.hidden = false;
      if (eventDrivenKeyboard) next.focus({preventScroll:true});
    }

    function advance() {
      if (!crossing || finished) return;
      round++;
      if (round < route.length) {
        showRound();
        if (eventDrivenKeyboard) cross.focus({preventScroll:true});
        return;
      }
      finished = true;
      play.hidden = true;
      next.hidden = true;
      replay.hidden = false;
      roundLabel.textContent = 'Đã về bến';
      setStatus(`Diều đã về bến. Bạn qua đúng ${hits}/${route.length} cửa và ghi ${score} điểm.`, 'good');
      if (hits > 0) ctx.motion?.('reward', status, {score});
      ctx.complete(score);
      if (eventDrivenKeyboard) replay.focus({preventScroll:true});
    }

    view.addEventListener('click', event => {
      const button = event.target.closest('button');
      if (!button) return;
      eventDrivenKeyboard = event.detail === 0;
      if (button.hasAttribute('data-wind-lane') && (eventDrivenKeyboard || performance.now() - lastSwipe > 350)) {
        move(Number(button.dataset.windLane));
      } else if (button.hasAttribute('data-wind-move')) {
        move(lane + Number(button.dataset.windMove));
      } else if (button === cross) {
        crossGate();
      } else if (button === next) {
        advance();
      } else if (button === replay) {
        setup();
        if (eventDrivenKeyboard) cross.focus({preventScroll:true});
      }
    }, {signal});

    view.addEventListener('keydown', event => {
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault();
        eventDrivenKeyboard = true;
        move(lane + (event.key === 'ArrowLeft' ? -1 : 1));
        if (!crossing) cross.focus({preventScroll:true});
      }
    }, {signal});

    stage.addEventListener('pointerdown', event => {
      if (event.isPrimary) pointer = {id:event.pointerId, x:event.clientX, y:event.clientY};
    }, {signal});
    stage.addEventListener('pointerup', event => {
      if (pointer?.id !== event.pointerId) return;
      const delta = event.clientX - pointer.x;
      const vertical = event.clientY - pointer.y;
      pointer = null;
      if (Math.abs(delta) < 28 || Math.abs(delta) < Math.abs(vertical) * 1.2) return;
      lastSwipe = performance.now();
      move(lane + Math.sign(delta));
    }, {signal});
    stage.addEventListener('pointercancel', () => { pointer = null; }, {signal});

    setup();
    return () => controls.abort();
  };
})();
