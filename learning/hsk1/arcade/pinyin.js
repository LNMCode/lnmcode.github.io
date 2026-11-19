(() => {
  'use strict';

  const WAVE_SIZES = [2, 3, 3];
  const SPOTS = {
    1: [[50, 45]],
    2: [[26, 42], [73, 56]],
    3: [[19, 51], [50, 32], [81, 55]],
  };

  function mount(root, ctx) {
    root.innerHTML = `
      <section class="pinyin-game" data-pinyin-game aria-label="Sao Pinyin">
        <header class="pinyin-header">
          <p>Gõ âm đúng để nối sáng các chòm sao.</p>
          <button class="pinyin-pause" data-pinyin-pause type="button" aria-pressed="false">Tạm dừng</button>
        </header>
        <div class="pinyin-hud" aria-label="Tiến độ ván">
          <div><span>Chòm sao</span><strong data-pinyin-wave></strong></div>
          <div><span>Điểm</span><strong data-pinyin-score></strong></div>
          <div><span>Chuỗi đúng</span><strong data-pinyin-combo></strong></div>
        </div>
        <div class="pinyin-sky">
          <canvas data-pinyin-canvas aria-hidden="true"></canvas>
          <div class="pinyin-targets" aria-label="Các sao chữ Hán"></div>
          <span class="pinyin-pulse" aria-hidden="true" hidden></span>
          <span class="pinyin-origin" aria-hidden="true"></span>
          <p class="pinyin-paused" hidden>Chòm sao đang dừng</p>
        </div>
        <div class="pinyin-play">
          <form class="pinyin-form">
            <label for="pinyin-arcade-input" data-pinyin-label></label>
            <div class="pinyin-type">
              <input id="pinyin-arcade-input" data-pinyin-input type="text" inputmode="text"
                autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false"
                placeholder="Gõ Pinyin" aria-describedby="pinyin-arcade-status" maxlength="64">
              <button class="btn primary" data-pinyin-launch type="submit">Nối sao</button>
            </div>
          </form>
          <p class="pinyin-status" id="pinyin-arcade-status" role="status"></p>
          <div class="pinyin-actions">
            <button class="btn button-soft" data-pinyin-hint type="button">Xem gợi ý</button>
            <button class="btn button-white" data-pinyin-pass type="button">Bỏ qua sao</button>
          </div>
        </div>
        <div class="pinyin-result" hidden>
          <h2 tabindex="-1">Chòm sao đã hoàn thành</h2>
          <p data-pinyin-summary></p>
          <button class="btn primary" data-pinyin-replay type="button">Chơi lại</button>
        </div>
      </section>`;

    const game = root.querySelector('[data-pinyin-game]');
    const sky = game.querySelector('.pinyin-sky');
    const canvas = game.querySelector('canvas');
    const layer = game.querySelector('.pinyin-targets');
    const input = game.querySelector('[data-pinyin-input]');
    const launch = game.querySelector('[data-pinyin-launch]');
    const hint = game.querySelector('[data-pinyin-hint]');
    const pass = game.querySelector('[data-pinyin-pass]');
    const pause = game.querySelector('[data-pinyin-pause]');
    const label = game.querySelector('[data-pinyin-label]');
    const status = game.querySelector('.pinyin-status');
    const pulse = game.querySelector('.pinyin-pulse');
    const result = game.querySelector('.pinyin-result');
    const listeners = new AbortController();
    const reducedMotion = Boolean(ctx.lowMotion) || matchMedia('(prefers-reduced-motion: reduce)').matches;
    let releaseVisual;
    let words;
    let waves;
    let wave;
    let targets;
    let selected;
    let score;
    let streak;
    let hits;
    let paused;
    let done;
    let transitioning;
    let composing = false;
    let pendingTimer = 0;

    function startVisual() {
      if (!releaseVisual && !reducedMotion && !paused && !done && !document.hidden) {
        releaseVisual = ctx.gameVisual?.(canvas);
      }
    }

    function stopVisual() {
      releaseVisual?.();
      releaseVisual = undefined;
    }

    function setStatus(message, tone = '') {
      status.textContent = message;
      status.dataset.tone = tone;
    }

    function syncHud() {
      game.querySelector('[data-pinyin-wave]').textContent = `${wave + 1}/${waves.length}`;
      game.querySelector('[data-pinyin-score]').textContent = score;
      game.querySelector('[data-pinyin-combo]').textContent = streak;
    }

    function syncControls() {
      const locked = paused || done || transitioning || !selected;
      input.readOnly = locked;
      launch.disabled = hint.disabled = pass.disabled = locked;
      pause.disabled = done || transitioning;
      canvas.dataset.paused = String(paused);
      game.classList.toggle('is-paused', paused);
      game.querySelector('.pinyin-paused').hidden = !paused;
      pause.setAttribute('aria-pressed', String(paused));
      pause.textContent = paused ? 'Tiếp tục' : 'Tạm dừng';
      for (const target of targets) {
        target.button.disabled = locked || target.cleared;
        target.button.setAttribute('aria-pressed', String(target === selected));
      }
      label.textContent = selected ? `Âm đọc của ${selected.word.hanzi}` : 'Âm đọc';
    }

    function selectTarget(target) {
      if (target !== selected) input.value = '';
      selected = target;
      syncControls();
    }

    function showWave() {
      const current = waves[wave];
      layer.replaceChildren();
      targets = current.map((word, index) => {
        const [x, y] = SPOTS[current.length][index];
        const button = document.createElement('button');
        button.className = 'pinyin-target';
        button.type = 'button';
        button.dataset.pinyinTarget = word.id;
        button.style.setProperty('--pinyin-x', `${x}%`);
        button.style.setProperty('--pinyin-y', `${y}%`);
        button.style.setProperty('--pinyin-delay', `${index * -.9}s`);
        const glyph = document.createElement('span');
        glyph.className = 'pinyin-glyph';
        glyph.lang = 'zh-Hans';
        glyph.textContent = word.hanzi;
        const star = document.createElement('span');
        star.className = 'pinyin-star';
        star.append(glyph);
        button.append(star);
        button.setAttribute('aria-label', word.hanzi);
        layer.append(button);
        return { word, button, x, y, cleared: false, helped: false, messy: false };
      });
      selectTarget(targets[0]);
      syncHud();
    }

    function start() {
      const unique = new Map(ctx.words(8).map(word => [word.id, word]));
      words = [...unique.values()].slice(0, 8);
      waves = [];
      let offset = 0;
      for (const size of WAVE_SIZES) {
        const group = words.slice(offset, offset + size);
        if (group.length) waves.push(group);
        offset += size;
      }
      wave = 0;
      score = streak = hits = 0;
      done = paused = transitioning = false;
      game.querySelector('.pinyin-play').hidden = false;
      result.hidden = true;
      input.value = '';
      setStatus('Chạm một sao để chọn. Dùng dấu hoặc số thanh, ví dụ hǎo hoặc hao3.');
      if (!waves.length) {
        targets = [];
        selected = null;
        done = true;
        setStatus('Chưa có từ để chơi.');
        syncControls();
        return;
      }
      showWave();
      startVisual();
    }

    function finish() {
      done = true;
      stopVisual();
      syncControls();
      game.querySelector('.pinyin-play').hidden = true;
      result.hidden = false;
      result.querySelector('[data-pinyin-summary]').textContent = `Đã nối ${hits}/${words.length} sao · ${score} điểm`;
      ctx.complete(score);
      result.querySelector('h2').focus({ preventScroll: true });
    }

    function finishTarget(target) {
      transitioning = false;
      pulse.hidden = true;
      target.button.classList.remove('is-struck');
      target.button.classList.add('is-cleared');
      const next = targets.find(item => !item.cleared);
      if (next) {
        selectTarget(next);
      } else if (wave + 1 < waves.length) {
        wave += 1;
        showWave();
      } else {
        finish();
      }
    }

    function clearTarget(target, success) {
      const { word } = target;
      target.cleared = true;
      transitioning = true;
      syncControls();
      if (success) {
        const assisted = target.helped || target.messy;
        streak = assisted ? 0 : streak + 1;
        hits += 1;
        const points = assisted ? 60 : 100 + Math.min(streak - 1, 5) * 20;
        score += points;
        ctx.grade(word.id, 'reading', assisted ? 'almost' : 'good', { hint: target.helped });
        setStatus(`${word.hanzi} · ${word.pinyin} · ${word.vi}. +${points} điểm`, 'hit');
      } else {
        streak = 0;
        ctx.grade(word.id, 'reading', 'again', { hint: target.helped });
        setStatus(`${word.hanzi} đọc là ${word.pinyin} · ${word.vi}.`, 'learn');
      }
      syncHud();

      if (!success || reducedMotion) {
        finishTarget(target);
        return;
      }
      const bounds = target.button.firstElementChild.getBoundingClientRect();
      const board = sky.getBoundingClientRect();
      const x = (bounds.left + bounds.width / 2 - board.left) / board.width;
      const y = (bounds.top + bounds.height / 2 - board.top) / board.height;
      const dx = (x - .5) * board.width;
      const dy = (y - .88) * board.height;
      pulse.style.setProperty('--pinyin-flight-x', `${dx}px`);
      pulse.style.setProperty('--pinyin-flight-y', `${dy}px`);
      pulse.hidden = false;
      target.button.classList.add('is-struck');
      pendingTimer = setTimeout(() => {
        canvas.dispatchEvent(new CustomEvent('hsk-arcade-pulse', { detail: { x, y } }));
        finishTarget(target);
      }, 470);
    }

    function fire(event) {
      event.preventDefault();
      if (paused || done || transitioning || composing || !selected) return;
      const match = ctx.matchPinyin(input.value, selected.word);
      if (match === 'empty') {
        setStatus('Gõ âm đọc vào ô trước khi nối sao.');
      } else if (match === 'good') {
        clearTarget(selected, true);
      } else {
        selected.messy = true;
        streak = 0;
        syncHud();
        setStatus(match === 'almost'
          ? 'Đúng âm rồi. Kiểm tra lại thanh điệu.'
          : 'Chưa khớp âm. Thử lại hoặc xem gợi ý.', 'learn');
        selected.button.classList.remove('is-missed');
        void selected.button.offsetWidth;
        selected.button.classList.add('is-missed');
      }
    }

    function click(event) {
      const control = event.target.closest('button');
      if (!control || control.disabled) return;
      if (control === pause) {
        paused = !paused;
        syncControls();
        if (paused) {
          input.blur();
          stopVisual();
        } else {
          startVisual();
        }
        return;
      }
      if (control.hasAttribute('data-pinyin-replay')) {
        start();
        input.focus({ preventScroll: true });
        return;
      }
      if (paused || done || transitioning) return;
      if (control === hint && selected) {
        selected.helped = true;
        setStatus(`${selected.word.hanzi} · ${selected.word.pinyin} · ${selected.word.vi}`, 'learn');
      } else if (control === pass && selected) {
        clearTarget(selected, false);
      } else if (control.hasAttribute('data-pinyin-target')) {
        const target = targets.find(item => item.button === control);
        if (target && selected !== target) {
          selectTarget(target);
          setStatus('Gõ âm đọc của sao bạn vừa chọn.');
        }
      }
    }

    game.classList.toggle('pinyin-reduced', reducedMotion);
    const options = { signal: listeners.signal };
    game.querySelector('form').addEventListener('submit', fire, options);
    game.addEventListener('click', click, options);
    input.addEventListener('compositionstart', () => { composing = true; }, options);
    input.addEventListener('compositionend', () => { composing = false; }, options);
    input.addEventListener('keydown', event => {
      if (event.key === 'Enter' && (event.isComposing || composing || event.keyCode === 229)) {
        event.preventDefault();
      }
    }, options);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) stopVisual();
      else startVisual();
    }, options);
    start();

    return () => {
      listeners.abort();
      clearTimeout(pendingTimer);
      stopVisual();
    };
  }

  (window.HSK_MINIGAMES ||= {}).pinyin = mount;
})();
