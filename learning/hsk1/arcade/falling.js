(() => {
  'use strict';

  const games = window.HSK_MINIGAMES ||= {};
  const themes = {
    wind:{model:'meteor', name:'Đường Gió', place:'Cổng thành', intro:'Giữ vững mái thành', floor:'Mái thành',
      goal:'Chọn chữ Hán đúng nghĩa để đánh chặn thiên thạch.', command:'Chọn chữ Hán khớp nghĩa', skill:'hanzi'},
    pinyin:{model:'crystal', name:'Sao Pinyin', place:'Đài quan tinh', intro:'Đón mưa tinh thể', floor:'Lưới bảo vệ',
      goal:'Gõ Pinyin của bất kỳ tinh thể nào đang rơi để đánh chặn.', command:'Gõ Pinyin của tinh thể đang rơi', skill:'reading'},
    echo:{model:'orb', name:'Trạm Vọng Âm', place:'Bến Vọng Âm', intro:'Đón giọt mang chữ', floor:'Mực nước',
      goal:'Nhìn nghĩa trong giọt mưa và gõ lại âm đọc tiếng Trung.', command:'Gõ Pinyin theo nghĩa trong giọt', skill:'reading'},
  };
  const STARTING_HEARTS = 3;
  const TOTAL = 8;
  const WAVE_SIZES = [2, 3, 3];
  const DEADLINE = 75;
  const lanes = {1:[50], 2:[29,71], 3:[19,50,81]};
  const plainSound = word => word.pinyin
    .toLowerCase().normalize('NFD').replace(/[\u0300\u0301\u0304\u030c]/g,'')
    .normalize('NFC').replace(/['’\s]/g,'');
  const shuffle = source => {
    const result = [...source];
    for (let i = result.length - 1; i > 0; i--) {
      const swap = Math.floor(Math.random() * (i + 1));
      [result[i],result[swap]] = [result[swap],result[i]];
    }
    return result;
  };

  function mount(root, ctx, mode) {
    const theme = themes[mode];
    const byChoice = mode === 'wind';
    const byMeaning = mode === 'echo';
    const reduced = Boolean(ctx.lowMotion);
    const signal = new AbortController();

    root.innerHTML = `
      <section class="falling-game" data-falling-game="${mode}" aria-label="${theme.name}">
        <div class="falling-field" data-falling-board data-arena-surface>
          <div class="falling-weather" aria-hidden="true"></div>
          <div class="falling-floor" aria-hidden="true"></div>
          <div class="falling-danger" aria-hidden="true"><span>${theme.floor}</span></div>
          <header class="falling-hud">
            <div class="falling-hearts" data-falling-hearts aria-label="Còn 3 khiên">
              <span aria-hidden="true">♥</span><span aria-hidden="true">♥</span><span aria-hidden="true">♥</span>
            </div>
            <div class="falling-progress" data-falling-progress aria-label="Mục tiêu đã xử lý">0/8</div>
            <div class="falling-hud-ops">
              <div class="falling-score" aria-label="Điểm"><span aria-hidden="true">✦</span><b data-falling-score>0</b></div>
              <button class="falling-tool" data-falling-pause type="button" aria-label="Tạm dừng" aria-pressed="false" hidden>Ⅱ</button>
            </div>
          </header>
          <div class="falling-targets" aria-label="Mục tiêu đang rơi"></div>
          <div class="falling-launchpad" aria-hidden="true">
            <span class="falling-model falling-launcher" data-arena-model="launcher"></span>
          </div>
          <div class="falling-effects" aria-hidden="true"></div>
          <div class="falling-dialog falling-intro">
            <div class="falling-panel">
              <span class="falling-place">${theme.place}</span>
              <h2>${theme.intro}</h2>
              <p>${theme.goal}</p>
              <div class="falling-modes">
                <button type="button" class="btn primary" data-falling-start="timed">Bắt đầu</button>
                <button type="button" class="btn button-soft" data-falling-start="calm">Luyện không tính giờ</button>
              </div>
            </div>
          </div>
          <div class="falling-dialog falling-paused" hidden>
            <div class="falling-panel"><h2>Đang tạm dừng</h2>
              <button type="button" class="btn primary" data-falling-resume>Tiếp tục</button>
            </div>
          </div>
          <div class="falling-dialog falling-review" data-falling-review hidden>
            <div class="falling-panel">
              <h2 data-falling-review-title></h2>
              <p lang="zh-Hans" class="falling-answer-zh" data-falling-review-word></p>
              <p data-falling-review-reading></p>
              <p data-falling-review-meaning></p>
              <div class="falling-modes">
                <button type="button" class="btn button-soft" data-falling-speak>Nghe lại</button>
                <button type="button" class="btn primary" data-falling-continue>Tiếp tục</button>
              </div>
            </div>
          </div>
          <div class="falling-dialog falling-results" hidden>
            <div class="falling-panel">
              <span class="falling-place">${theme.place}</span>
              <h2 data-falling-result-title></h2><p data-falling-result-detail></p>
              <button type="button" class="btn primary" data-falling-replay>Chơi lại</button>
            </div>
          </div>
        </div>
        <div class="falling-console" hidden>
          ${byChoice ? `<p class="falling-command">${theme.command}</p><div class="falling-options"></div>` : `
            <form class="falling-form">
              <label for="falling-entry">${theme.command}</label>
              <div class="falling-entry-row">
                <input id="falling-entry" data-falling-entry type="text" inputmode="text" maxlength="64"
                  spellcheck="false" autocorrect="off" autocapitalize="off" autocomplete="off" placeholder="Gõ Pinyin">
                <button type="submit" class="btn primary">Phóng</button>
              </div>
            </form>
            <div class="falling-extras">
              <button type="button" data-falling-hint class="btn button-soft">Gợi ý chữ đầu</button>
              ${byMeaning ? '<button type="button" data-falling-listen class="btn button-soft">Nghe từ đang chọn</button>' : ''}
            </div>`}
          <p class="falling-status" role="status" aria-live="polite"></p>
        </div>
      </section>`;

    const game = root.firstElementChild;
    const one = selector => game.querySelector(selector);
    const board = one('[data-falling-board]');
    const layer = one('.falling-targets');
    const effects = one('.falling-effects');
    const intro = one('.falling-intro');
    const consolePanel = one('.falling-console');
    const pausedPanel = one('.falling-paused');
    const reviewPanel = one('[data-falling-review]');
    const resultPanel = one('.falling-results');
    const pause = one('[data-falling-pause]');
    const input = one('[data-falling-entry]');
    const options = one('.falling-options');
    const hearts = one('[data-falling-hearts]');
    const status = one('.falling-status');
    const scoreLabel = one('[data-falling-score]');
    const progressLabel = one('[data-falling-progress]');

    let deck = [];
    let roster = [];
    let targets = [];
    let activeTarget = null;
    let reviewTarget = null;
    let flight = null;
    let frame = 0;
    let previous = 0;
    let phase = 'intro';
    let timed = false;
    let score = 0;
    let shields = STARTING_HEARTS;
    let streak = 0;
    let resolved = 0;
    let caught = 0;
    let waveIndex = 0;
    let cursor = 0;
    let nextAge = 0;
    let remaining = 0;
    let misses = 0;
    let lastMode = 'timed';
    let composing = false;
    let reducedMotion = reduced;
    let boardWidth = 1;
    let boardHeight = 1;
    const viewport = window.visualViewport;
    let keyboardBaseline = viewport?.height || 0;
    const reducedMedia = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    const coarsePointer = window.matchMedia?.('(pointer: coarse)');
    const listener = {signal:signal.signal};
    const resize = typeof ResizeObserver === 'function' ? new ResizeObserver(updateSize) : null;
    resize?.observe(board);

    function tell(message, kind = '') {
      status.dataset.kind = kind;
      status.textContent = message;
    }

    function updateHud() {
      scoreLabel.textContent = score;
      progressLabel.textContent = `${resolved}/${deck.length || TOTAL}`;
      hearts.hidden = !timed;
      hearts.setAttribute('aria-label', `Còn ${shields} khiên`);
      [...hearts.children].forEach((heart, index) => heart.classList.toggle('is-lost', index >= shields));
      const paused = phase === 'paused';
      pause.textContent = paused ? '▶' : 'Ⅱ';
      pause.setAttribute('aria-label', paused ? 'Tiếp tục' : 'Tạm dừng');
      pause.setAttribute('aria-pressed', String(paused));
      pause.hidden = !['play','paused'].includes(phase);
      board.toggleAttribute('data-arena-paused', paused || phase === 'review');
      board.dataset.phase = phase;
      if (input) input.readOnly = phase !== 'play' || Boolean(flight);
      pausedPanel.hidden = !paused;
    }

    function updateSize() {
      boardWidth = board.clientWidth || 1;
      boardHeight = board.clientHeight || 1;
    }

    function fitKeyboard() {
      if (!viewport || !input || !coarsePointer?.matches) return;
      const editing = document.activeElement === input && Math.abs(viewport.scale - 1) < .01;
      if (!editing) keyboardBaseline = Math.max(keyboardBaseline, viewport.height);
      const keyboardRaised = editing && keyboardBaseline - viewport.height > 115;
      game.toggleAttribute('data-keyboard-raised', keyboardRaised);
      if (keyboardRaised) game.style.setProperty('--keyboard-board', `${Math.round(viewport.height * .54)}px`);
    }

    function targetMarkup(word) {
      const target = document.createElement(byChoice ? 'div' : 'button');
      target.className = 'falling-target';
      target.setAttribute('data-falling-target','');
      target.dataset.wordId = word.id;
      if (!byChoice) {
        target.type = 'button';
        target.setAttribute('aria-pressed','false');
      }
      target.innerHTML = `<span class="falling-model" data-arena-model="${theme.model}" aria-hidden="true"></span>
        <span class="falling-label"></span>`;
      const label = target.querySelector('.falling-label');
      label.textContent = mode === 'pinyin' ? word.hanzi : word.vi;
      if (mode === 'pinyin') label.lang = 'zh-Hans';
      return target;
    }

    function drawTarget(target) {
      target.x = target.lane + (timed && !reducedMotion ? 1.45 * Math.sin(target.age * .0024 + target.lane) : 0);
      target.y = (target.start + (timed ? target.age * target.speed : 0));
      target.node.style.left = `${target.x}%`;
      target.node.style.top = `${target.y}%`;
      target.node.classList.toggle('is-near-floor', timed && target.y >= DEADLINE - 12);
    }

    function showOptions() {
      if (!options || !activeTarget) return;
      const right = activeTarget.word;
      const pool = shuffle(roster.filter(word => word.hanzi !== right.hanzi && word.vi !== right.vi));
      const decoys = [];
      for (const word of pool) {
        if (!decoys.some(decoy => decoy.hanzi === word.hanzi || decoy.vi === word.vi)) decoys.push(word);
        if (decoys.length === 3) break;
      }
      options.replaceChildren(...shuffle([right, ...decoys]).map((word, index) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.dataset.fallingOption = '';
        button.dataset.wordId = word.id;
        button.className = 'falling-option';
        const key = document.createElement('kbd');
        key.textContent = index + 1;
        const glyph = document.createElement('b');
        glyph.lang = 'zh-Hans';
        glyph.textContent = word.hanzi;
        button.append(key, glyph);
        return button;
      }));
    }

    function choose(target) {
      if (!target || target === activeTarget) return;
      activeTarget = target;
      if (byChoice) {
        showOptions();
      } else {
        targets.forEach(item => item.node.setAttribute('aria-pressed', String(item === activeTarget)));
        const clue = mode === 'pinyin' ? target.word.hanzi : target.word.vi;
        input.placeholder = `Pinyin · ${clue}`;
      }
    }

    function addTarget(word, order) {
      const count = byChoice ? 1 : WAVE_SIZES[waveIndex];
      const node = targetMarkup(word);
      const target = {
        word,node,age:0,x:50,y:20,helped:false,
        lane: byChoice ? [31,59,73,40,63,30,53,69][cursor - 1] : lanes[count][order],
        start: timed ? (byChoice ? 24 : 23 + ((order + waveIndex) % 3) * 8) : 26 + ((order + waveIndex) % 3) * 12,
        speed: (DEADLINE - 23) / (byChoice ? 15000 - waveIndex * 1900 : 20500 - waveIndex * 2400),
      };
      drawTarget(target);
      layer.append(node);
      targets.push(target);
      choose(activeTarget || target);
    }

    function beginWave() {
      if (resolved === deck.length || shields <= 0) {
        finish();
        return;
      }
      waveIndex = byChoice ? Math.min(2, Math.floor(resolved / 3)) : Math.min(2, Math.floor((resolved + 1) / 3));
      const count = byChoice ? 1 : WAVE_SIZES[waveIndex];
      remaining = Math.min(count, deck.length - cursor);
      nextAge = 0;
      if (remaining) {
        remaining--;
        addTarget(deck[cursor++], 0);
        while (remaining && !timed) {
          addTarget(deck[cursor++], count - remaining);
          remaining--;
        }
      }
    }

    function restartLast() {
      if (phase !== 'finished') return;
      resultPanel.hidden = true;
      intro.hidden = false;
      consolePanel.hidden = true;
      phase = 'intro';
      tell('');
      updateHud();
      one(`[data-falling-start="${lastMode}"]`).focus({preventScroll:true});
    }

    function start(kind) {
      roster = ctx.words(68);
      deck = [];
      for (const word of roster) {
        if (deck.some(item => item.hanzi === word.hanzi ||
          (byChoice ? item.vi === word.vi : plainSound(item) === plainSound(word) || byMeaning && item.vi === word.vi))) continue;
        deck.push(word);
        if (deck.length === TOTAL) break;
      }
      if (!deck.length) {
        intro.querySelector('p').textContent = 'Chưa tải được từ vựng cho ván này.';
        return;
      }
      lastMode = kind;
      timed = kind === 'timed';
      phase = 'play';
      score = streak = resolved = caught = waveIndex = cursor = misses = 0;
      shields = STARTING_HEARTS;
      activeTarget = reviewTarget = flight = null;
      targets = [];
      effects.replaceChildren();
      layer.replaceChildren();
      intro.hidden = resultPanel.hidden = reviewPanel.hidden = true;
      consolePanel.hidden = false;
      updateSize();
      if (input) input.value = '';
      tell(timed ? 'Chặn mục tiêu trước khi chạm vạch.' : 'Tập theo nhịp của bạn.');
      updateHud();
      beginWave();
      schedule();
      if (byChoice) options.firstElementChild?.focus({preventScroll:true});
      else input.focus({preventScroll:true});
    }

    function giveHint() {
      if (!activeTarget || phase !== 'play' || flight) return;
      activeTarget.helped = true;
      const start = plainSound(activeTarget.word).slice(0, 1);
      tell(`Âm đọc bắt đầu bằng “${start}”.`, 'hint');
      input?.focus({preventScroll:true});
    }

    function markImpact(x, y, bad) {
      if (reducedMotion) return;
      const impact = document.createElement('i');
      impact.className = `falling-impact${bad?' is-miss':''}`;
      impact.style.left = `${x}%`;
      impact.style.top = `${y}%`;
      const sparks = Array.from({length:8}, (_, index) => {
        const spark = document.createElement('b');
        spark.style.setProperty('--angle', `${index * 45}deg`);
        return spark;
      });
      impact.append(...sparks);
      impact.addEventListener('animationend', () => impact.remove(), {once:true});
      effects.append(impact);
    }

    function emit(target, quality) {
      if (flight) return;
      if (reducedMotion) {
        completeTarget(target, quality);
        return;
      }
      const bolt = document.createElement('i');
      bolt.className = 'falling-bolt';
      bolt.dataset.arenaModel = 'bolt';
      effects.append(bolt);
      flight = {target,quality,bolt,age:0};
      updateHud();
      schedule();
    }

    function drawBolt(delta) {
      const {target, bolt} = flight;
      flight.age += delta;
      const fraction = Math.min(1, flight.age / 370);
      const x = 50 + (target.x - 50) * fraction;
      const y = 88 + (target.y - 88) * fraction;
      const angle = (Math.atan2((target.y - 88) * boardHeight, (target.x - 50) * boardWidth) * 180 / Math.PI) + 90;
      bolt.style.left = `${x}%`;
      bolt.style.top = `${y}%`;
      bolt.style.setProperty('--trajectory', `${angle}deg`);
      bolt.dataset.arenaAngle = angle;
      if (fraction < 1) return;
      const quality = flight.quality;
      bolt.remove();
      flight = null;
      completeTarget(target, quality);
    }

    function removeTarget(target) {
      target.node.remove();
      targets = targets.filter(item => item !== target);
      if (activeTarget === target) {
        activeTarget = null;
        choose(targets[0]);
      }
    }

    function completeTarget(target, quality) {
      markImpact(target.x, target.y, false);
      caught++;
      resolved++;
      if (quality === 'good' && !target.helped) streak++;
      else streak = 0;
      const earned = (quality === 'good' && !target.helped) ? 100 + Math.min(5,streak - 1) * 12 : 55;
      score += earned;
      ctx.grade(target.word.id, theme.skill, quality === 'good' && target.helped ? 'almost' : quality);
      removeTarget(target);
      if (input) input.value = '';
      tell(`${target.word.hanzi} · ${target.word.pinyin} · ${target.word.vi} · +${earned} điểm`, 'hit');
      updateHud();
      if (!targets.length && !remaining) beginWave();
    }

    function missTarget(target, reason) {
      markImpact(target.x, target.y, true);
      streak = 0;
      misses++;
      resolved++;
      if (timed) shields--;
      ctx.grade(target.word.id, theme.skill, 'again');
      reviewTarget = target;
      removeTarget(target);
      phase = 'review';
      reviewPanel.hidden = false;
      one('[data-falling-review-title]').textContent = reason;
      one('[data-falling-review-word]').textContent = target.word.hanzi;
      one('[data-falling-review-reading]').textContent = target.word.pinyin;
      one('[data-falling-review-meaning]').textContent = target.word.vi;
      one('[data-falling-speak]').hidden = !ctx.voiceAvailable();
      if (input) input.value = '';
      updateHud();
      one('[data-falling-continue]').focus({preventScroll:true});
    }

    function continueAfterMiss() {
      if (phase !== 'review') return;
      reviewTarget = null;
      reviewPanel.hidden = true;
      phase = 'play';
      tell('Đón mục tiêu tiếp theo.');
      updateHud();
      if (!targets.length && !remaining || shields <= 0) beginWave();
      schedule();
      if (phase === 'play' && input) input.focus({preventScroll:true});
    }

    function finish() {
      phase = 'finished';
      layer.replaceChildren();
      effects.replaceChildren();
      consolePanel.hidden = true;
      resultPanel.hidden = false;
      one('[data-falling-result-title]').textContent = timed && shields <= 0 ? 'Tường chắn đã tắt' : 'Đã kết thúc đợt rơi';
      one('[data-falling-result-detail]').textContent = `Đón đúng ${caught}/${deck.length} mục tiêu · ${score} điểm${misses ? ` · ${misses} cần ôn lại` : ''}`;
      updateHud();
      ctx.complete(score);
      one('[data-falling-replay]').focus({preventScroll:true});
    }

    function submitChoice(id) {
      if (phase !== 'play' || !activeTarget || flight) return;
      if (activeTarget.word.id === id) emit(activeTarget, 'good');
      else missTarget(activeTarget, 'Thử nhớ chữ này');
    }

    function submitReading() {
      if (phase !== 'play' || !input.value.trim() || flight || composing) return;
      const candidates = [activeTarget, ...targets.filter(target => target !== activeTarget)].filter(Boolean);
      const scored = candidates.map(target => ({target,quality:ctx.matchPinyin(input.value,target.word)}));
      const exact = scored.find(item => item.quality === 'good');
      const partial = scored.find(item => item.quality === 'almost');
      if (exact) emit(exact.target, exact.quality);
      else if (partial) {
        partial.target.helped = true;
        choose(partial.target);
        tell('Đúng âm rồi. Thêm dấu thanh hoặc dùng số từ 1 đến 5.', 'hint');
      } else {
        tell('Chưa trúng mục tiêu. Hãy thử lại hoặc chọn gợi ý.', 'miss');
      }
    }

    function loop(now) {
      frame = 0;
      if (phase !== 'play' || document.hidden) {
        previous = 0;
        return;
      }
      const delta = previous ? Math.min(50, now - previous) : 0;
      previous = now;
      if (timed && remaining) {
        nextAge += delta;
        if (nextAge >= 2250) {
          const count = WAVE_SIZES[waveIndex];
          addTarget(deck[cursor++], count - remaining);
          remaining--;
          nextAge = 0;
        }
      }
      for (const target of targets) {
        target.age += delta;
        drawTarget(target);
      }
      if (flight) drawBolt(delta);
      if (phase === 'play' && timed && !flight) {
        const expired = targets.find(target => target.y >= DEADLINE);
        if (expired) missTarget(expired, 'Mục tiêu đã qua vạch');
      }
      schedule();
    }

    function schedule() {
      if (frame || phase !== 'play' || (!timed && !flight) || document.hidden) return;
      frame = requestAnimationFrame(loop);
    }

    function togglePause() {
      if (!['play','paused'].includes(phase)) return;
      phase = phase === 'paused' ? 'play' : 'paused';
      previous = 0;
      updateHud();
      if (phase === 'play') schedule();
      else one('[data-falling-resume]').focus({preventScroll:true});
    }

    game.addEventListener('click', event => {
      const button = event.target.closest('button');
      if (!button) return;
      if (button.dataset.fallingStart) start(button.dataset.fallingStart);
      else if (button.hasAttribute('data-falling-pause') || button.hasAttribute('data-falling-resume')) togglePause();
      else if (button.hasAttribute('data-falling-replay')) restartLast();
      else if (button.hasAttribute('data-falling-continue')) continueAfterMiss();
      else if (button.hasAttribute('data-falling-speak') && reviewTarget) ctx.speak(reviewTarget.word.hanzi);
      else if (button.hasAttribute('data-falling-option')) submitChoice(button.dataset.wordId);
      else if (button.hasAttribute('data-falling-hint')) giveHint();
      else if (button.hasAttribute('data-falling-listen') && activeTarget && phase === 'play' && !flight) {
        if (ctx.speak(activeTarget.word.hanzi, () => tell('Không phát được giọng Quan thoại lúc này.', 'hint'))) activeTarget.helped = true;
        else tell('Thiết bị chưa có giọng Quan thoại. Bạn vẫn có thể xem gợi ý chữ đầu.', 'hint');
      } else if (button.hasAttribute('data-falling-target') && phase === 'play' && !flight) {
        choose(targets.find(target => target.node === button));
      }
    }, listener);

    document.addEventListener('keydown', event => {
      if (event.defaultPrevented || event.isComposing || event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key === 'Escape' && ['play','paused'].includes(phase)) {
        event.preventDefault();
        togglePause();
      }
      if (byChoice && phase === 'play' && /^[1-4]$/.test(event.key)) {
        event.preventDefault();
        options.children[Number(event.key)-1]?.click();
      }
    }, listener);

    document.addEventListener('visibilitychange', () => {
      if (document.hidden && timed && phase === 'play') togglePause();
      else schedule();
    }, listener);
    window.addEventListener('resize', () => {
      updateSize();
      fitKeyboard();
    }, {...listener,passive:true});
    viewport?.addEventListener('resize', fitKeyboard, {...listener,passive:true});
    reducedMedia?.addEventListener('change', event => {
      reducedMotion = reduced || event.matches;
    }, listener);

    if (input) {
      input.addEventListener('focus', fitKeyboard, listener);
      input.addEventListener('blur', () => game.removeAttribute('data-keyboard-raised'), listener);
      input.addEventListener('compositionstart', () => { composing = true; }, listener);
      input.addEventListener('compositionend', () => { composing = false; }, listener);
      one('.falling-form').addEventListener('submit', event => {
        event.preventDefault();
        submitReading();
      }, listener);
    }

    updateHud();
    return () => {
      signal.abort();
      resize?.disconnect();
      cancelAnimationFrame(frame);
    };
  }

  for (const mode of Object.keys(themes)) games[mode] = (root,ctx) => mount(root,ctx,mode);
})();
