(() => {
  'use strict';

  const registry = window.HSK_MINIGAMES ||= {};
  const LANES = 3;
  const ROUNDS = 4;

  function shuffledTiles(tokens) {
    const tiles = tokens.map((text, index) => ({index, text}));
    for (let i = tiles.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [tiles[i], tiles[j]] = [tiles[j], tiles[i]];
    }
    if (tiles.every((tile, index) => tile.text === tokens[index])) {
      const different = tiles.findIndex(tile => tile.text !== tiles[0].text);
      [tiles[0], tiles[different]] = [tiles[different], tiles[0]];
    }
    return tiles;
  }

  registry.flow = function mountFlow(root, ctx) {
    let rounds = [];
    let current = 0;
    let sequence = [];
    let tiles = [];
    let start = 0;
    let stagePoints = 0;
    let points = 0;
    let mistakes = 0;
    let hints = 0;
    let hintedPosition = -1;
    let wrongPosition = -1;
    let delivered = false;
    let message = '';
    let header;
    let banks;
    let river;
    let live;
    let actions;

    root.innerHTML = `
      <section class="memory-game flow-game" data-arcade-mode="flow" aria-label="Dòng Chữ">
        <p class="memory-game-rule">Vớt các mảnh chữ theo thứ tự để đưa lời nhắn qua sông.</p>
        <div class="memory-game-score"></div>
        <div class="flow-message">
          <span>Lời nhắn cần chuyển</span>
          <strong></strong>
        </div>
        <div class="flow-banks">
          <div class="flow-bridge" role="group" aria-label="Thứ tự các mảnh trên cầu"></div>
        </div>
        <div class="flow-river" data-cinema-stage role="group" aria-label="Các thuyền chở mảnh chữ">
          <div class="flow-current-water" aria-hidden="true"></div>
          <div class="flow-islet flow-islet--one" aria-hidden="true"><i></i></div>
          <div class="flow-islet flow-islet--two" aria-hidden="true"><i></i></div>
          <div class="flow-skiff" aria-hidden="true"><i></i><b></b></div>
          <div class="flow-tile-grid"></div>
        </div>
        <p class="memory-game-status" role="status" aria-live="polite"></p>
        <div class="memory-game-actions flow-controls"></div>
      </section>`;

    header = root.querySelector('.memory-game-score');
    const game = root.querySelector('.flow-game');
    const reducedMotion = ctx.lowMotion || matchMedia('(prefers-reduced-motion: reduce)').matches;
    banks = root.querySelector('.flow-bridge');
    river = root.querySelector('.flow-river');
    live = root.querySelector('.memory-game-status');
    actions = root.querySelector('.flow-controls');

    function newRun() {
      rounds = ctx.sentences(ROUNDS * 4).filter(sentence =>
        sentence.tokens.length >= 2 && sentence.tokens.length <= 7 && new Set(sentence.tokens).size > 1
      ).slice(0, ROUNDS);
      points = 0;
      newRound(0);
    }

    function newRound(index) {
      current = index;
      const sentence = rounds[current];
      sequence = [];
      start = 0;
      tiles = sentence ? shuffledTiles(sentence.tokens) : [];
      stagePoints = 0;
      mistakes = 0;
      hints = 0;
      hintedPosition = -1;
      wrongPosition = -1;
      delivered = false;
      game.classList.remove('is-delivered');
      river.classList.remove('is-cycling');
      message = sentence ? 'Chạm một thuyền để đưa mảnh chữ vào cầu.' : 'Chưa có lời nhắn phù hợp. Hãy chơi lại sau khi học thêm.';
      update();
    }

    function button(text, attribute, option = {}) {
      const element = document.createElement('button');
      element.type = 'button';
      element.className = option.className || 'btn button-soft';
      element.textContent = text;
      element.setAttribute(attribute, option.value ?? '');
      element.disabled = option.disabled === true;
      return element;
    }

    function update() {
      const sentence = rounds[current];
      root.querySelector('.flow-message strong').textContent = sentence?.vi || '';
      header.innerHTML = `<span><b>${sentence ? current + 1 : 0}/${rounds.length}</b> chuyến</span><span><b>${points}</b> điểm</span>`;
      river.classList.toggle('is-delivered', delivered);
      game.classList.toggle('is-delivered', delivered);
      game.classList.toggle('has-error', wrongPosition >= 0);
      game.classList.toggle('has-cargo', sequence.length > 0);

      banks.replaceChildren();
      if (sentence) {
        for (let i = 0; i < sentence.tokens.length; i++) {
          const tile = sequence[i];
          const slot = button(tile?.text || '·', 'data-flow-slot', {
            className: 'flow-slot', value: i, disabled: !tile || delivered || wrongPosition >= 0,
          });
          slot.classList.toggle('is-filled', Boolean(tile));
          slot.classList.toggle('is-wrong', i === wrongPosition);
          slot.classList.toggle('is-next', !tile && !delivered && i === sequence.length);
          if (tile) slot.lang = 'zh-Hans';
          slot.setAttribute('aria-label', tile ? `Gỡ mảnh ${tile.text} ở vị trí ${i+1}` : `Vị trí trống ${i+1}`);
          banks.append(slot);
        }
      }

      const available = remainingTiles();
      const visible = [...available.slice(start), ...available.slice(0, start)].slice(0, LANES);
      const grid = river.querySelector('.flow-tile-grid');
      grid.replaceChildren();
      for (const tile of visible) {
        const boat = button(tile.text, 'data-flow-tile', {
          className: 'flow-tile', value: tile.index, disabled: delivered || wrongPosition >= 0,
        });
        boat.lang = 'zh-Hans';
        boat.setAttribute('aria-label', `Vớt mảnh ${tile.text}`);
        const cargo = document.createElement('span');
        cargo.className = 'flow-boat-cargo';
        cargo.textContent = tile.text;
        boat.replaceChildren(cargo);
        if (hintedPosition >= 0 && sentence.tokens[hintedPosition] === tile.text) boat.classList.add('is-hinted');
        grid.append(boat);
      }
      const final = delivered && current + 1 === rounds.length;
      const status = delivered
        ? `${sentence.hanzi} · ${sentence.pinyin}. ${final ? `Đã chuyển hết lời nhắn. Tổng ${points} điểm.` : `Đã qua sông. +${stagePoints} điểm.`}`
        : message;
      live.textContent = status;
      actions.replaceChildren();
      if (!sentence) return;
      if (final) {
        actions.append(button('Vượt sông lần nữa', 'data-flow-replay', {className:'btn primary'}));
      } else if (delivered) {
        actions.append(button('Chuyến tiếp theo', 'data-flow-next', {className:'btn primary'}));
      } else if (wrongPosition >= 0) {
        actions.append(button('Sửa từ nhịp này', 'data-flow-repair', {className:'btn primary'}));
      } else {
        actions.append(button('Đổi dòng', 'data-flow-cycle', {disabled:available.length <= LANES}));
        actions.append(button('Gợi ý', 'data-flow-hint', {disabled:sequence.length === sentence.tokens.length}));
        actions.append(button('Đưa thuyền qua', 'data-flow-send', {
          className:'btn primary', disabled:sequence.length !== sentence.tokens.length,
        }));
      }
    }

    function remainingTiles() {
      return tiles.filter(tile => !sequence.includes(tile));
    }

    function selectTile(boat) {
      if (delivered || wrongPosition >= 0) return;
      const id = Number(boat.dataset.flowTile);
      const tile = remainingTiles().find(item => item.index === id);
      if (!tile) return;
      const bounds = boat.querySelector('.flow-boat-cargo').getBoundingClientRect();
      const from = {x: (bounds.left + bounds.width / 2) / window.innerWidth,
        y: (bounds.top + bounds.height / 2) / window.innerHeight};
      sequence.push(tile);
      const left = remainingTiles().length;
      start = left ? start % left : 0;
      message = left ? `Đã vớt ${tile.text}.` : 'Cầu đã đủ mảnh. Đưa thuyền qua để kiểm tra thứ tự.';
      update();
      const slot = banks.children[sequence.length - 1];
      transfer(tile.text, bounds, slot);
      ctx.motion?.('boat', slot, {from, index:sequence.length - 1, progress:sequence.length / rounds[current].tokens.length});
      focus(left ? '.flow-tile-grid button' : '[data-flow-send]');
    }

    function transfer(text, from, slot) {
      if (reducedMotion || typeof game.animate !== 'function') return;
      const stage = game.getBoundingClientRect();
      const to = slot.getBoundingClientRect();
      const dx = to.left + (to.width - from.width) / 2 - from.left;
      const dy = to.top + (to.height - from.height) / 2 - from.top;
      const cargo = document.createElement('span');
      cargo.className = 'flow-boat-cargo flow-cargo-flying';
      cargo.lang = 'zh-Hans';
      cargo.textContent = text;
      cargo.setAttribute('aria-hidden', 'true');
      Object.assign(cargo.style, {left: `${from.left - stage.left}px`, top: `${from.top - stage.top}px`,
        width: `${from.width}px`, height: `${from.height}px`});
      game.append(cargo);
      cargo.animate([
        {transform:'translate(0, 0) rotate(-4deg)', opacity:1},
        {transform:`translate(${dx * .5}px, ${dy * .5 - 26}px) rotate(12deg) scale(1.12)`, opacity:1, offset:.5},
        {transform:`translate(${dx}px, ${dy}px) rotate(0) scale(.82)`, opacity:0},
      ], {duration:490, easing:'cubic-bezier(.23,.71,.25,.98)'}).finished.then(() => cargo.remove(), () => cargo.remove());
      slot.animate([
        {filter:'brightness(.65)'},
        {filter:'brightness(1.32)', offset:.8},
        {filter:'brightness(1)'},
      ], {duration:550, easing:'ease-out'});
    }

    function removeTile(index) {
      if (delivered || wrongPosition >= 0 || !sequence[index]) return;
      sequence.splice(index, 1);
      message = 'Mảnh đã trở lại dòng nước.';
      update();
      ctx.motion?.('select', river);
      focus('[data-flow-tile]');
    }

    function cycle() {
      const available = remainingTiles().length;
      if (available <= LANES || delivered || wrongPosition >= 0) return;
      start = (start + LANES) % available;
      river.classList.remove('is-cycling');
      void river.offsetWidth;
      river.classList.add('is-cycling');
      message = 'Một nhóm thuyền khác đã trôi đến.';
      update();
      ctx.motion?.('drift', river);
      focus('[data-flow-cycle]');
    }

    function hint() {
      const sentence = rounds[current];
      if (delivered || wrongPosition >= 0 || sequence.length >= sentence.tokens.length) return;
      const mismatch = sequence.findIndex((tile, index) => tile.text !== sentence.tokens[index]);
      const index = mismatch >= 0 ? mismatch : sequence.length;
      if (hintedPosition !== index) {
        hintedPosition = index;
        hints++;
      }
      message = `Mảnh ở vị trí ${index + 1} là ${sentence.tokens[index]}.`;
      live.textContent = message;
      [...river.querySelectorAll('.flow-boat-cargo')].forEach(cargo => {
        cargo.parentElement.classList.toggle('is-hinted', cargo.textContent === sentence.tokens[index]);
      });
      ctx.motion?.('hint', banks.children[index]);
    }

    function send() {
      const sentence = rounds[current];
      if (!sentence || delivered || wrongPosition >= 0 || sequence.length !== sentence.tokens.length) return;
      wrongPosition = sequence.findIndex((tile, index) => tile.text !== sentence.tokens[index]);
      if (wrongPosition >= 0) {
        mistakes++;
        message = `Thuyền dừng ở mảnh thứ ${wrongPosition + 1}. Giữ lại đoạn đúng và thử tiếp.`;
        update();
        ctx.motion?.('miss', banks.children[wrongPosition]);
        focus('[data-flow-repair]');
        return;
      }
      delivered = true;
      stagePoints = Math.max(30, 120 - 20 * mistakes - 15 * hints) + 20 * sentence.tokens.length;
      points += stagePoints;
      const quality = hints || mistakes ? 'almost' : 'good';
      for (const id of new Set(sentence.wordIds)) ctx.grade(id, 'usage', quality);
      update();
      ctx.motion?.('sail', river, {fromX:.2, fromY:.86, toX:.79, toY:.19, progress:1, count:sequence.length, index:current});
      const final = current + 1 === rounds.length;
      focus(final ? '[data-flow-replay]' : '[data-flow-next]');
      if (final) {
        ctx.motion?.('reward', banks);
        ctx.complete(points);
      }
    }

    function repair() {
      if (wrongPosition < 0) return;
      sequence.splice(wrongPosition);
      wrongPosition = -1;
      start = 0;
      message = 'Phần đầu đã đúng. Tìm các mảnh để nối nhịp cầu còn lại.';
      update();
      focus('[data-flow-tile]');
    }

    function focus(selector) {
      root.querySelector(selector)?.focus({preventScroll:true});
    }

    function onClick(event) {
      const target = event.target.closest('button');
      if (!target || target.disabled) return;
      if (target.hasAttribute('data-flow-tile')) selectTile(target);
      if (target.hasAttribute('data-flow-slot')) removeTile(Number(target.dataset.flowSlot));
      if (target.hasAttribute('data-flow-cycle')) cycle();
      if (target.hasAttribute('data-flow-hint')) hint();
      if (target.hasAttribute('data-flow-send')) send();
      if (target.hasAttribute('data-flow-repair')) repair();
      if (target.hasAttribute('data-flow-next')) {
        newRound(current + 1);
        focus('[data-flow-tile]');
      }
      if (target.hasAttribute('data-flow-replay')) {
        newRun();
        focus('[data-flow-tile]');
      }
    }

    function onKeyDown(event) {
      const tile = event.target.closest('[data-flow-tile]');
      if (!tile || !['ArrowLeft','ArrowRight'].includes(event.key)) return;
      event.preventDefault();
      const adjacent = event.key === 'ArrowLeft' ? tile.previousElementSibling : tile.nextElementSibling;
      if (adjacent) adjacent.focus();
      else cycle();
    }

    root.addEventListener('click', onClick);
    root.addEventListener('keydown', onKeyDown);
    newRun();
    return () => {
      root.removeEventListener('click', onClick);
      root.removeEventListener('keydown', onKeyDown);
    };
  };
})();
