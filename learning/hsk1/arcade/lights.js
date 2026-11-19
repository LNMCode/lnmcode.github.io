(() => {
  'use strict';

  const modes = window.HSK_MINIGAMES ||= {};
  const rounds = 8;
  const maxLives = 4;
  const bubbleCount = 6;
  const spots = [[18, 44], [50, 37], [82, 43], [18, 75], [50, 65], [82, 73]];
  const namespace = 'http://www.w3.org/2000/svg';

  function shuffle(items) {
    const shuffled = [...items];
    for (let index = shuffled.length - 1; index > 0; index--) {
      const swap = Math.floor(Math.random() * (index + 1));
      [shuffled[index], shuffled[swap]] = [shuffled[swap], shuffled[index]];
    }
    return shuffled;
  }

  function distinctWords(words) {
    const glyphs = new Set();
    const meanings = new Set();
    return words.filter(word => {
      if (glyphs.has(word.hanzi) || meanings.has(word.vi)) return false;
      glyphs.add(word.hanzi);
      meanings.add(word.vi);
      return true;
    });
  }

  modes.lights = function mountLights(root, ctx) {
    const pool = distinctWords(ctx.words(50));
    if (pool.length < rounds) {
      root.innerHTML = '<p>Chưa có đủ từ để mở Hồ Đom Đóm.</p>';
      return () => {};
    }

    root.innerHTML = `
      <section class="lights-game" aria-label="Hồ Đom Đóm"${ctx.lowMotion ? ' data-still' : ''}>
        <div class="lights-hud">
          <span class="lights-health" data-lights-health></span>
          <span data-lights-crossing></span>
          <strong data-lights-score></strong>
          <button type="button" class="btn button-soft" data-lights-pause hidden>Tạm dừng</button>
        </div>
        <div class="lights-lake" data-lights-lake data-arena-surface>
          <div class="lights-depth" aria-hidden="true"></div>
          <div class="lights-surface" aria-hidden="true"></div>
          <div class="lights-reef" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></div>
          <div class="lights-clues" aria-live="polite" hidden><span>Chạm chữ mang nghĩa</span><strong data-lights-clue></strong></div>
          <div class="lights-pads" role="group" aria-label="Bong bóng chữ Hán"></div>
          <div class="lights-launcher" aria-hidden="true">
            <i class="lights-launcher-body" data-arena-model="launcher"></i>
            <i class="lights-launcher-light"></i>
          </div>
          <svg class="lights-effects" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"></svg>
          <div class="lights-overlay" data-lights-overlay>
            <p>Bong bóng mang chữ Hán. Chạm đúng chữ trước khi bong bóng thoát qua mặt nước.</p>
            <div class="lights-actions">
              <button type="button" class="btn primary" data-lights-start>Xuống hồ</button>
              <button type="button" class="btn button-soft" data-lights-calm>Chơi không giờ</button>
            </div>
          </div>
        </div>
        <div class="lights-footer">
          <progress class="lights-timer" max="1" value="1" aria-label="Thời gian còn lại" hidden></progress>
          <p class="lights-status" data-lights-status role="status">Chọn nhịp chơi để bắt đầu.</p>
          <div class="lights-actions">
            <button type="button" class="btn button-soft" data-lights-hint hidden>Gợi ý chữ</button>
            <button type="button" class="btn primary" data-lights-next hidden>Qua lượt</button>
            <button type="button" class="btn primary" data-lights-replay hidden>Lặn lại</button>
            <button type="button" class="btn button-soft" data-lights-change hidden>Đổi nhịp chơi</button>
          </div>
        </div>
      </section>`;

    const find = selector => root.querySelector(selector);
    const lake = find('[data-lights-lake]');
    const board = find('.lights-pads');
    const launcher = find('.lights-launcher');
    const effects = find('.lights-effects');
    const overlay = find('[data-lights-overlay]');
    const clues = find('.lights-clues');
    const clue = find('[data-lights-clue]');
    const health = find('[data-lights-health]');
    const wave = find('[data-lights-crossing]');
    const scoreText = find('[data-lights-score]');
    const status = find('[data-lights-status]');
    const timer = find('.lights-timer');
    const pause = find('[data-lights-pause]');
    const hint = find('[data-lights-hint]');
    const next = find('[data-lights-next]');
    const replay = find('[data-lights-replay]');
    const change = find('[data-lights-change]');
    const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
    const orbs = new Map();
    let route = [];
    let round = 0;
    let lives = maxLives;
    let points = 0;
    let streak = 0;
    let phase = 'intro';
    let timed = false;
    let paused = false;
    let assisted = false;
    let mistakes = 0;
    let elapsed = 0;
    let lastFrame = null;
    let frame = 0;
    let duration = 1;
    let impactTimer = 0;

    function say(message, tone = '') {
      status.textContent = message;
      status.dataset.tone = tone;
    }

    function renderHud() {
      health.textContent = '♥ '.repeat(lives) + '♡ '.repeat(maxLives - lives);
      health.setAttribute('aria-label', `${lives} trên ${maxLives} mạng`);
      wave.textContent = phase === 'intro' ? `${rounds} lượt` : `Lượt ${round + 1}/${rounds}`;
      scoreText.textContent = `${points} điểm`;
      timer.hidden = !timed || phase === 'intro' || phase === 'finished';
      pause.hidden = !timed || phase === 'intro';
      pause.disabled = phase !== 'playing';
      pause.textContent = paused ? 'Tiếp tục' : 'Tạm dừng';
      pause.setAttribute('aria-pressed', String(paused));
      hint.hidden = phase !== 'playing';
      hint.disabled = paused;
      next.hidden = phase !== 'between';
      replay.hidden = change.hidden = phase !== 'finished';
      overlay.hidden = phase !== 'intro';
      clues.hidden = phase === 'intro';
      lake.dataset.phase = phase;
      lake.toggleAttribute('data-paused', paused);
      lake.toggleAttribute('data-arena-paused', paused);
    }

    function placeOrbs() {
      const progress = Math.min(1, elapsed / duration);
      const moving = timed && !ctx.lowMotion && !reducedMotion.matches;
      const answer = orbs.get(route[round]?.id);
      const rise = answer ? spots[answer.index][1] - 30 : 0;
      for (const orb of orbs.values()) {
        const [x, y] = spots[orb.index];
        const height = y - (moving ? progress * rise : 0);
        const wave = moving ? Math.sin(elapsed * .00155 + orb.index * .8) * 2.3 : 0;
        const escaped = height < 29;
        orb.button.classList.toggle('is-escaped', escaped);
        orb.button.toggleAttribute('data-arena-hidden', escaped || orb.button.classList.contains('is-popped'));
        orb.button.disabled = phase !== 'playing' || escaped || paused || orb.button.classList.contains('is-popped');
        orb.button.style.setProperty('--orb-x', `${x + wave}%`);
        orb.button.style.setProperty('--orb-y', `${height}%`);
      }
      timer.value = 1 - progress;
    }

    function endRound(success) {
      const word = route[round];
      const quality = !success ? 'again' : assisted || mistakes ? 'almost' : 'good';
      ctx.grade(word.id, 'hanzi', quality);
      phase = round === route.length - 1 || lives === 0 ? 'finished' : 'between';
      cancelAnimationFrame(frame);
      frame = 0;
      for (const {button} of orbs.values()) button.disabled = true;
      renderHud();
      if (phase === 'finished') ctx.complete(points);
      const reason = success ? 'Đã bắt đúng' : mistakes && elapsed < duration ? 'Đã hết mạng' : 'Bong bóng đã thoát';
      const total = phase === 'finished' ? ` Tổng ${points} điểm.` : '';
      say(`${reason}. ${word.hanzi} · ${word.pinyin} · ${word.vi}.${total}`, success ? 'good' : 'miss');
      (phase === 'finished' ? replay : next).focus({preventScroll: true});
    }

    function animateFrame(now) {
      if (lastFrame !== null) elapsed += now - lastFrame;
      lastFrame = now;
      placeOrbs();
      if (elapsed >= duration) {
        lives -= 1;
        streak = 0;
        endRound(false);
        return;
      }
      frame = requestAnimationFrame(animateFrame);
    }

    function syncClock() {
      cancelAnimationFrame(frame);
      frame = 0;
      lastFrame = null;
      if (phase === 'playing' && timed && !paused && !document.hidden) {
        frame = requestAnimationFrame(animateFrame);
      }
    }

    function startRound() {
      clearTimeout(impactTimer);
      effects.replaceChildren();
      phase = 'playing';
      paused = assisted = false;
      mistakes = 0;
      elapsed = 0;
      duration = 17000 - round * 900;
      const answer = route[round];
      clue.textContent = answer.vi;
      const candidates = [answer, ...shuffle(pool.filter(word => word !== answer)).slice(0, bubbleCount - 1)];
      orbs.clear();
      board.replaceChildren(...shuffle(candidates).map((word, index) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'lights-orb';
        button.dataset.lightsWord = word.id;
        button.dataset.shell = index % 3;
        const shell = document.createElement('i');
        shell.className = 'lights-orb-shell';
        shell.dataset.arenaModel = 'orb';
        shell.setAttribute('aria-hidden', 'true');
        const label = document.createElement('span');
        label.className = 'lights-orb-label';
        label.lang = 'zh-Hans';
        label.textContent = word.hanzi;
        button.append(shell, label);
        orbs.set(word.id, {button, word, index});
        return button;
      }));
      placeOrbs();
      renderHud();
      say(timed ? 'Đừng để chữ đúng thoát khỏi mặt nước.' : 'Tìm chữ khớp với nghĩa trong hồ.');
      syncClock();
    }

    function startRun(withClock) {
      timed = withClock;
      route = shuffle(pool.slice(0, rounds));
      round = points = streak = 0;
      lives = maxLives;
      startRound();
      board.firstElementChild?.focus({preventScroll: true});
    }

    function pointAt(element, bounds) {
      const rect = element.getBoundingClientRect();
      return [(rect.left + rect.width / 2 - bounds.left) * 100 / bounds.width,
        (rect.top + rect.height / 2 - bounds.top) * 100 / bounds.height];
    }

    function drawShot(button, correct) {
      const bounds = lake.getBoundingClientRect();
      const [x, y] = pointAt(button, bounds);
      const [fromX, fromY] = pointAt(launcher, bounds);
      const beam = document.createElementNS(namespace, 'path');
      beam.setAttribute('d', `M ${fromX} ${fromY} Q ${(fromX + x) / 2} ${y + 10} ${x} ${y}`);
      beam.setAttribute('pathLength', '1');
      beam.setAttribute('vector-effect', 'non-scaling-stroke');
      beam.setAttribute('class', correct ? 'lights-beam' : 'lights-beam lights-beam--miss');
      const ring = document.createElementNS(namespace, 'circle');
      ring.setAttribute('cx', x);
      ring.setAttribute('cy', y);
      ring.setAttribute('r', '5');
      ring.setAttribute('vector-effect', 'non-scaling-stroke');
      ring.setAttribute('class', correct ? 'lights-impact' : 'lights-impact lights-impact--miss');
      effects.replaceChildren(beam, ring);
    }

    function fire(orb) {
      if (phase !== 'playing' || paused || !orb || orb.button.disabled) return;
      const correct = orb.word.id === route[round].id;
      phase = 'firing';
      syncClock();
      renderHud();
      lake.dataset.shot = correct ? 'hit' : 'miss';
      drawShot(orb.button, correct);

      function impact() {
        lake.removeAttribute('data-shot');
        orb.button.classList.add(correct ? 'is-lit' : 'is-popped');
        if (!correct) orb.button.dataset.arenaHidden = '';
        orb.button.disabled = true;
        if (correct) {
          streak = assisted || mistakes ? 0 : streak + 1;
          points += streak ? 100 + Math.min(streak - 1, 4) * 15 : 45;
          endRound(true);
        } else {
          lives -= 1;
          mistakes += 1;
          streak = 0;
          if (lives <= 0) {
            endRound(false);
            return;
          }
          phase = 'playing';
          renderHud();
          say(`${orb.word.hanzi} · ${orb.word.pinyin} nghĩa là “${orb.word.vi}”. Hãy thử bong bóng khác.`, 'miss');
          board.querySelector('button:not(:disabled)')?.focus({preventScroll: true});
          syncClock();
        }
      }

      if (ctx.lowMotion || reducedMotion.matches) impact();
      else impactTimer = setTimeout(impact, 240);
    }

    function returnToIntro() {
      phase = 'intro';
      points = 0;
      lives = maxLives;
      paused = timed = false;
      effects.replaceChildren();
      board.replaceChildren();
      orbs.clear();
      renderHud();
      say('Chọn nhịp chơi để bắt đầu.');
      find('[data-lights-start]').focus({preventScroll: true});
    }

    function click(event) {
      const button = event.target.closest('button');
      if (!button) return;
      if (button.hasAttribute('data-lights-start')) startRun(true);
      else if (button.hasAttribute('data-lights-calm')) startRun(false);
      else if (button === replay) startRun(timed);
      else if (button === change) returnToIntro();
      else if (button === next) {
        round += 1;
        startRound();
        board.firstElementChild?.focus({preventScroll: true});
      } else if (button === pause && phase === 'playing') {
        paused = !paused;
        placeOrbs();
        renderHud();
        syncClock();
      } else if (button === hint && phase === 'playing' && !paused) {
        assisted = true;
        const word = route[round];
        orbs.get(word.id).button.classList.add('is-hinted');
        say(`Tìm ${word.hanzi} · ${word.pinyin}.`);
      } else if (button.dataset.lightsWord) {
        fire(orbs.get(button.dataset.lightsWord));
      }
    }

    root.addEventListener('click', click);
    document.addEventListener('visibilitychange', syncClock);
    reducedMotion.addEventListener('change', placeOrbs);
    renderHud();
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(impactTimer);
      root.removeEventListener('click', click);
      document.removeEventListener('visibilitychange', syncClock);
      reducedMotion.removeEventListener('change', placeOrbs);
    };
  };
})();
