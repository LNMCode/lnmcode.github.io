(() => {
  'use strict';

  const registry = window.HSK_MINIGAMES ||= {};
  const crossings = 5;
  const beatDuration = 17000;
  const positions = [[19, 27], [50, 15], [80, 33], [23, 70], [54, 66], [80, 76]];

  function shuffle(values) {
    const items = [...values];
    for (let i = items.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [items[i], items[j]] = [items[j], items[i]];
    }
    return items;
  }

  registry.lights = function mountLights(root, ctx) {
    const pool = [];
    const meanings = new Set();
    for (const word of ctx.words(45)) {
      if (meanings.has(word.vi)) continue;
      meanings.add(word.vi);
      pool.push(word);
    }

    root.innerHTML = `
      <section class="lights-game" aria-label="Hồ Đom Đóm">
        <p class="lights-rule">Đọc hai nghĩa, rồi chạm đúng chữ theo thứ tự để nối đường qua hồ.</p>
        <div class="lights-toolbar">
          <button type="button" class="btn button-soft" data-lights-mode aria-pressed="false">Bật đua giờ</button>
          <button type="button" class="btn button-white" data-lights-pause hidden>Tạm dừng</button>
        </div>
        <div class="lights-hud"><strong data-lights-crossing></strong><span data-lights-score></span></div>
        <ol class="lights-clues" aria-label="Thứ tự các nghĩa cần tìm"></ol>
        <div class="lights-lake" data-lights-lake>
          <canvas aria-hidden="true"></canvas>
          <div class="lights-pads" aria-label="Chữ trên hồ"></div>
        </div>
        <progress class="lights-timer" max="${beatDuration}" value="${beatDuration}" aria-label="Thời gian còn lại" hidden></progress>
        <p class="lights-status" data-lights-status role="status"></p>
        <div class="lights-toolbar lights-actions">
          <button type="button" class="btn button-soft" data-lights-hint>Xem gợi ý</button>
          <button type="button" class="btn primary" data-lights-next hidden>Qua đoạn tiếp</button>
          <button type="button" class="btn primary" data-lights-replay hidden>Chơi lại</button>
        </div>
      </section>`;

    const game = root.querySelector('.lights-game');
    const board = game.querySelector('.lights-pads');
    const lake = game.querySelector('.lights-lake');
    const canvas = lake.querySelector('canvas');
    const clues = game.querySelector('.lights-clues');
    const status = game.querySelector('[data-lights-status]');
    const progress = game.querySelector('.lights-timer');
    const mode = game.querySelector('[data-lights-mode]');
    const pause = game.querySelector('[data-lights-pause]');
    const hint = game.querySelector('[data-lights-hint]');
    const next = game.querySelector('[data-lights-next]');
    const replay = game.querySelector('[data-lights-replay]');
    const stopVisual = ctx.lowMotion ? null : ctx.gameVisual?.(canvas);
    const records = new Map();
    let route, round, goal, pads, found, points, streak, assisted, misses;
    let stopped = false;
    let finished = false;
    let betweenRounds = false;
    let timed = false;
    let paused = false;
    let remaining = beatDuration;
    let lastFrame = 0;
    let tickTimer = 0;

    function say(message, tone = '') {
      status.textContent = message;
      status.dataset.tone = tone;
    }

    function hud() {
      game.querySelector('[data-lights-crossing]').textContent = `Đoạn ${round + 1}/${crossings}`;
      game.querySelector('[data-lights-score]').textContent = `${points} điểm · Chuỗi ${streak}`;
    }

    function paintClues() {
      clues.replaceChildren(...goal.map((word, index) => {
        const item = document.createElement('li');
        item.textContent = word.vi;
        item.classList.toggle('is-found', found.includes(word.id));
        if (index === found.length) item.setAttribute('aria-current', 'step');
        return item;
      }));
    }

    function ticking(now) {
      remaining -= now - lastFrame;
      lastFrame = now;
      progress.value = remaining;
      if (remaining <= 0) {
        streak = 0;
        const firstMissing = goal[found.length];
        ctx.grade(firstMissing.id, 'hanzi', 'again');
        showCrossing(false);
      } else {
        tickTimer = requestAnimationFrame(ticking);
      }
    }

    function syncTimer() {
      cancelAnimationFrame(tickTimer);
      tickTimer = 0;
      canvas.dataset.paused = String(paused);
      if (timed && !paused && !document.hidden && !betweenRounds && !finished && !stopped) {
        lastFrame = performance.now();
        tickTimer = requestAnimationFrame(ticking);
      }
    }

    function startRound() {
      goal = route.slice(round * 2, round * 2 + 2);
      const distractors = shuffle(pool.filter(word => !goal.includes(word))).slice(0, 4);
      pads = shuffle([...goal, ...distractors]);
      records.clear();
      found = [];
      misses = new Set();
      assisted = new Set();
      betweenRounds = false;
      remaining = beatDuration;
      progress.value = remaining;
      next.hidden = replay.hidden = true;
      hint.disabled = false;
      pause.disabled = false;
      lake.removeAttribute('data-cleared');
      board.replaceChildren(...pads.map((word, index) => {
        const [x, y] = positions[index];
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'lights-pad';
        button.dataset.lightsWord = word.id;
        button.style.setProperty('--x', `${x}%`);
        button.style.setProperty('--y', `${y}%`);
        button.style.setProperty('--phase', `${index * -.45}s`);
        const label = document.createElement('span');
        label.lang = 'zh-Hans';
        label.textContent = word.hanzi;
        button.append(label);
        records.set(word.id, {button, x, y});
        return button;
      }));
      hud();
      paintClues();
      say('Tìm chữ ứng với nghĩa đầu tiên.');
      syncTimer();
    }

    function startRun() {
      if (pool.length < crossings * 2) {
        say('Cần thêm từ để mở hồ đom đóm.');
        return;
      }
      const practice = pool.slice(0, crossings * 2);
      route = shuffle(practice);
      finished = paused = false;
      points = streak = round = 0;
      mode.setAttribute('aria-pressed', String(timed));
      mode.textContent = timed ? 'Trở về nhịp tự do' : 'Bật đua giờ';
      pause.hidden = progress.hidden = !timed;
      pause.textContent = 'Tạm dừng';
      lake.removeAttribute('data-paused');
      startRound();
    }

    function showCrossing(success) {
      betweenRounds = true;
      finished = round + 1 === crossings;
      if (success) lake.dataset.cleared = 'true';
      for (const {button} of records.values()) button.disabled = true;
      pause.disabled = hint.disabled = true;
      syncTimer();
      const answer = goal.map(word => `${word.hanzi} (${word.pinyin})`).join(' · ');
      const result = success ? 'Đã nối vệt sáng.' : 'Đom đóm đã bay đi.';
      say(`${result} ${answer}${finished ? ` · Tổng ${points} điểm` : ''}`, success ? 'good' : 'miss');
      if (finished) ctx.complete(points);
      next.hidden = finished;
      replay.hidden = !finished;
      (finished ? replay : next).focus({preventScroll:true});
    }

    function catchLight(id) {
      if (betweenRounds || paused) return;
      const spot = records.get(id);
      const word = goal[found.length];
      if (word.id !== id) {
        if (!misses.has(word.id) && !assisted.has(word.id)) ctx.grade(word.id, 'hanzi', 'again');
        misses.add(word.id);
        streak = 0;
        hud();
        say(`Chưa tới chữ này. Hãy tìm chữ mang nghĩa “${word.vi}”.`, 'miss');
        return;
      }
      const clean = !assisted.has(id) && !misses.has(id);
      streak = clean ? streak + 1 : 0;
      points += clean ? 100 + Math.min(streak - 1, 5) * 15 : 35;
      if (clean) ctx.grade(id, 'hanzi', 'good');
      found.push(id);
      canvas.dispatchEvent(new CustomEvent('hsk-arcade-pulse', {detail:{x:spot.x / 100, y:spot.y / 100}}));
      spot.button.classList.remove('is-hinted');
      spot.button.classList.add('is-lit');
      spot.button.disabled = true;
      paintClues();
      hud();
      if (found.length === goal.length) {
        showCrossing(true);
      } else {
        say(`${word.hanzi} · ${word.pinyin}. Tìm nghĩa thứ hai.`, 'good');
        board.querySelector('button:not(:disabled)')?.focus({preventScroll:true});
      }
    }

    function click(event) {
      const target = event.target.closest('button');
      if (!target) return;
      if (target === mode) {
        timed = !timed;
        startRun();
      } else if (target === pause) {
        paused = !paused;
        pause.textContent = paused ? 'Tiếp tục' : 'Tạm dừng';
        lake.toggleAttribute('data-paused', paused);
        hint.disabled = paused;
        for (const [id, {button}] of records) button.disabled = paused || found.includes(id);
        syncTimer();
      } else if (target === next) {
        round++;
        startRound();
        board.firstElementChild?.focus({preventScroll:true});
      } else if (target === replay) {
        startRun();
        board.firstElementChild?.focus({preventScroll:true});
      } else if (target === hint) {
        const word = goal[found.length];
        assisted.add(word.id);
        records.get(word.id).button.classList.add('is-hinted');
        say(`Tìm đốm chữ ${word.hanzi} (${word.pinyin}).`);
      } else if (target.dataset.lightsWord) {
        catchLight(target.dataset.lightsWord);
      }
    }

    root.addEventListener('click', click);
    document.addEventListener('visibilitychange', syncTimer);
    startRun();
    return () => {
      stopped = true;
      cancelAnimationFrame(tickTimer);
      root.removeEventListener('click', click);
      document.removeEventListener('visibilitychange', syncTimer);
      stopVisual?.();
    };
  };
})();
