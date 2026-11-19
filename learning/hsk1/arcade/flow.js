(() => {
  'use strict';

  const registry = window.HSK_MINIGAMES ||= {};
  const ROUND_COUNT = 4;

  function shuffledTiles(tokens) {
    const tiles = tokens.map((text, index) => ({index, text}));
    for (let i = tiles.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [tiles[i], tiles[j]] = [tiles[j], tiles[i]];
    }
    if (tiles.every((tile, index) => tile.text === tokens[index])) {
      const other = tiles.findIndex(tile => tile.text !== tiles[0].text);
      if (other > 0) [tiles[0], tiles[other]] = [tiles[other], tiles[0]];
    }
    return tiles;
  }

  registry.flow = function mountFlow(root, ctx) {
    root.innerHTML = `
      <section class="river-run" aria-label="Dòng Chữ" data-flow-game>
        <header class="river-run-hud">
          <span><i aria-hidden="true">◇</i> Nhịp <b data-flow-round></b></span>
          <span><b data-flow-score>0</b> điểm</span>
        </header>
        <div class="river-run-arena" data-flow-arena>
          <div class="river-run-landscape" aria-hidden="true"></div>
          <canvas class="river-run-world" data-flow-world aria-hidden="true"></canvas>
          <div class="river-run-talk">
            <span>Ghép câu để bắc cầu</span>
            <strong data-flow-clue></strong>
          </div>
          <div class="river-run-channel" aria-hidden="true"><i></i><b></b></div>
          <span class="river-run-fox" aria-hidden="true">🦊</span>
          <div class="river-run-span" role="group" aria-label="Mảnh cầu theo thứ tự từ trái sang phải"></div>
          <div class="river-run-deck" role="group" aria-label="Các mảnh chữ để bắc cầu"></div>
        </div>
        <p class="river-run-status" data-flow-status role="status" aria-live="polite"></p>
        <footer class="river-run-controls">
          <button type="button" class="river-run-button" data-flow-hint>Gợi ý</button>
          <button type="button" class="river-run-button river-run-primary" data-flow-send>Qua cầu</button>
          <button type="button" class="river-run-button river-run-primary" data-flow-repair hidden>Sửa từ nhịp sai</button>
          <button type="button" class="river-run-button river-run-primary" data-flow-next hidden>Đến bờ tiếp theo</button>
          <button type="button" class="river-run-button river-run-primary" data-flow-replay hidden>Chơi lại</button>
        </footer>
      </section>`;

    const game = root.firstElementChild;
    const arena = root.querySelector('[data-flow-arena]');
    const canvas = root.querySelector('[data-flow-world]');
    const spans = root.querySelector('.river-run-span');
    const deck = root.querySelector('.river-run-deck');
    const status = root.querySelector('[data-flow-status]');
    const hintButton = root.querySelector('[data-flow-hint]');
    const sendButton = root.querySelector('[data-flow-send]');
    const repairButton = root.querySelector('[data-flow-repair]');
    const nextButton = root.querySelector('[data-flow-next]');
    const replayButton = root.querySelector('[data-flow-replay]');
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    const still = () => ctx.lowMotion || media.matches;
    const controller = new AbortController();
    const options = {signal:controller.signal};
    let world;
    let crossingTimer;
    let rounds = [];
    let round = 0;
    let score = 0;
    let sequence = [];
    let tiles = [];
    let mistakes = 0;
    let hinted = new Set();
    let highlight = -1;
    let wrong = -1;
    let phase = 'building';

    const sentence = () => rounds[round];
    const announce = text => { status.textContent = text; };
    const focus = element => element?.focus({preventScroll:true});

    function makeButton(text, kind, index, extra = {}) {
      const node = document.createElement('button');
      node.type = 'button';
      node.className = 'river-run-' + kind;
      node.dataset[kind === 'slot' ? 'flowSlot' : 'flowTile'] = index;
      node.lang = 'zh-Hans';
      node.textContent = text;
      node.disabled = Boolean(extra.disabled);
      node.setAttribute('aria-label', extra.label);
      return node;
    }

    function snapshot() {
      return {slots:[...spans.children], tiles:[...deck.children], sequence,
        wrong, phase, highlight, answer:sentence()?.tokens[highlight]};
    }

    function renderControls() {
      game.dataset.phase = phase;
      root.querySelector('[data-flow-round]').textContent = rounds.length ? `${round + 1}/${rounds.length}` : '0/0';
      root.querySelector('[data-flow-score]').textContent = score;
      hintButton.hidden = sendButton.hidden = phase !== 'building';
      hintButton.disabled = !sentence() || sequence.length === tiles.length;
      sendButton.disabled = !sentence() || sequence.length !== tiles.length;
      repairButton.hidden = phase !== 'wrong';
      nextButton.hidden = phase !== 'landed' || round + 1 >= rounds.length;
      replayButton.hidden = phase !== 'landed' || round + 1 < rounds.length;
    }

    function paint() {
      for (const [index, slot] of Array.from(spans.children).entries()) {
        const tile = sequence[index];
        slot.textContent = tile?.text || '·';
        slot.disabled = !tile || phase !== 'building';
        slot.setAttribute('aria-label', tile ? `Gỡ mảnh ${tile.text} ở vị trí ${index + 1}` : `Nhịp trống ${index + 1}`);
        slot.toggleAttribute('data-filled', Boolean(tile));
        slot.toggleAttribute('data-next', !tile && phase === 'building' && index === sequence.length);
        slot.toggleAttribute('data-wrong', wrong === index);
        slot.toggleAttribute('data-lit', phase === 'crossing' || phase === 'landed');
      }
      for (const button of deck.children) {
        const tile = tiles.find(item => item.index === Number(button.dataset.flowTile));
        const selected = sequence.includes(tile);
        button.disabled = selected || phase !== 'building';
        button.classList.toggle('is-used', selected);
        button.classList.toggle('is-hinted', !selected && tile.text === sentence()?.tokens[highlight]);
      }
      renderControls();
      world?.sync(snapshot());
    }

    function showRound() {
      clearTimeout(crossingTimer);
      const current = sentence();
      sequence = [];
      tiles = current ? shuffledTiles(current.tokens) : [];
      mistakes = 0;
      hinted = new Set();
      highlight = wrong = -1;
      phase = 'building';
      arena.style.setProperty('--river-count', tiles.length || 2);
      arena.toggleAttribute('data-crowded', tiles.length > 4);
      root.querySelector('[data-flow-clue]').textContent = current?.vi || 'Chưa có câu phù hợp.';
      spans.replaceChildren(...tiles.map((_, index) => makeButton('·', 'slot', index, {label:`Nhịp trống ${index + 1}`})));
      deck.replaceChildren(...tiles.map(tile => makeButton(tile.text, 'tile', tile.index, {label:`Lắp mảnh ${tile.text}`})));
      Array.from(deck.children).forEach((button, index) => button.setAttribute('aria-keyshortcuts', String(index + 1)));
      world?.reset();
      paint();
      announce(current ? 'Chọn mảnh chữ theo thứ tự của câu. Chạm mảnh đã lắp để gỡ.' : 'Hãy học thêm từ và quay lại.');
    }

    function newRun() {
      rounds = ctx.sentences(ROUND_COUNT * 4).filter(current => current.tokens.length >= 2 &&
        current.tokens.length <= 7 && new Set(current.tokens).size > 1).slice(0, ROUND_COUNT);
      score = round = 0;
      showRound();
    }

    function transfer(text, before, destination) {
      if (still() || !before.width) return;
      const outside = arena.getBoundingClientRect();
      const after = destination.getBoundingClientRect();
      const dx = after.left + (after.width - before.width) / 2 - before.left;
      const dy = after.top + (after.height - before.height) / 2 - before.top;
      if (!Element.prototype.animate) return;
      const label = document.createElement('span');
      label.setAttribute('aria-hidden', 'true');
      label.className = 'river-run-flight';
      label.lang = 'zh-Hans';
      label.textContent = text;
      label.style.cssText = `left:${before.left - outside.left}px;top:${before.top - outside.top}px;width:${before.width}px;height:${before.height}px`;
      arena.append(label);
      label.animate([
        {transform:'translate(0,0) rotate(-3deg)', opacity:1},
        {transform:`translate(${dx * .49}px,${dy * .52 - 24}px) rotate(10deg) scale(1.12)`, offset:.52, opacity:1},
        {transform:`translate(${dx}px,${dy}px) rotate(0) scale(.83)`, opacity:.08},
      ], {duration:425, easing:'cubic-bezier(.21,.65,.32,1)'}).finished.then(() => label.remove(), () => label.remove());
    }

    function choose(button) {
      if (phase !== 'building') return;
      const tile = tiles.find(item => item.index === Number(button.dataset.flowTile));
      if (!tile || sequence.includes(tile)) return;
      const before = button.getBoundingClientRect();
      const slot = sequence.length;
      sequence.push(tile);
      highlight = -1;
      paint();
      if (!world?.place(slot, button, still())) transfer(tile.text, before, spans.children[slot]);
      announce(sequence.length === tiles.length ? 'Cầu đã đủ nhịp. Đưa Cáo Đèn qua.' : `Đã lắp mảnh ${tile.text}.`);
      focus([...deck.children].find(item => !item.disabled) || sendButton);
    }

    function remove(index) {
      if (phase !== 'building' || !sequence[index]) return;
      const [tile] = sequence.splice(index, 1);
      highlight = -1;
      paint();
      announce(`Đã gỡ mảnh ${tile.text}.`);
      focus(deck.querySelector(`[data-flow-tile="${tile.index}"]`));
    }

    function hint() {
      if (phase !== 'building' || !sentence() || sequence.length === tiles.length) return;
      const mismatch = sequence.findIndex((tile, index) => tile.text !== sentence().tokens[index]);
      highlight = mismatch >= 0 ? mismatch : sequence.length;
      hinted.add(highlight);
      paint();
      announce(`Mảnh ở vị trí ${highlight + 1} là ${sentence().tokens[highlight]}.`);
    }

    function finishCrossing() {
      if (phase !== 'crossing') return;
      clearTimeout(crossingTimer);
      phase = 'landed';
      paint();
      const final = round === rounds.length - 1;
      const reading = sentence().pinyin;
      const stop = /[.!?。？！]$/.test(reading) ? '' : '.';
      announce(`${sentence().hanzi} · ${reading}${stop} ${final ? `Đã qua cả ${rounds.length} cầu. Tổng ${score} điểm.` : 'Cáo Đèn đã sang bờ.'}`);
      focus(final ? replayButton : nextButton);
    }

    function cross() {
      if (phase !== 'building' || !sentence() || sequence.length !== tiles.length) return;
      wrong = sequence.findIndex((tile, index) => tile.text !== sentence().tokens[index]);
      if (wrong >= 0) {
        mistakes++;
        phase = 'wrong';
        paint();
        announce(`Cáo Đèn dừng ở nhịp ${wrong + 1}. Đoạn cầu đúng được giữ nguyên.`);
        focus(repairButton);
        return;
      }
      phase = 'crossing';
      score += Math.max(35, 120 + tiles.length * 20 - mistakes * 20 - hinted.size * 15);
      const quality = mistakes || hinted.size ? 'almost' : 'good';
      for (const id of new Set(sentence().wordIds)) ctx.grade(id, 'usage', quality);
      if (round === rounds.length - 1) ctx.complete(score);
      paint();
      if (still()) finishCrossing();
      else {
        announce('Cầu đã sáng. Cáo Đèn đang qua sông.');
        crossingTimer = setTimeout(finishCrossing, 1870);
      }
    }

    function repair() {
      if (phase !== 'wrong') return;
      sequence.splice(wrong);
      phase = 'building';
      wrong = highlight = -1;
      paint();
      announce('Hãy lắp tiếp từ nhịp còn trống.');
      focus([...deck.children].find(item => !item.disabled));
    }

    game.addEventListener('click', event => {
      const button = event.target.closest('button');
      if (!button || button.disabled) return;
      if (button.hasAttribute('data-flow-tile')) choose(button);
      else if (button.hasAttribute('data-flow-slot')) remove(Number(button.dataset.flowSlot));
      else if (button === hintButton) hint();
      else if (button === sendButton) cross();
      else if (button === repairButton) repair();
      else if (button === nextButton && phase === 'landed') {
        round++;
        showRound();
        focus(deck.firstElementChild);
      } else if (button === replayButton && phase === 'landed') {
        newRun();
        focus(deck.firstElementChild);
      }
    }, options);

    game.addEventListener('keydown', event => {
      if (event.altKey || event.ctrlKey || event.metaKey || phase !== 'building') return;
      const index = Number(event.key) - 1;
      const button = deck.children[index];
      if (index < 0 || !button || button.disabled) return;
      event.preventDefault();
      choose(button);
    }, options);

    media.addEventListener?.('change', () => {
      world?.setReduced(still());
      if (still() && phase === 'crossing') finishCrossing();
    }, options);
    newRun();

    const module = new URL('./arcade/bridge-world.js', document.baseURI);
    import(module.href).then(({buildBridgeWorld}) => {
      if (controller.signal.aborted || !canvas.isConnected) return;
      world = buildBridgeWorld(canvas, {reduced:still()});
      world?.sync(snapshot());
    }).catch(() => {
      // The complete puzzle stays playable using the CSS river and planks.
    });
    return () => {
      controller.abort();
      clearTimeout(crossingTimer);
      world?.dispose();
    };
  };
})();
