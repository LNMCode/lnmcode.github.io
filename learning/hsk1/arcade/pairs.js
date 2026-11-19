(() => {
  'use strict';

  const game = window.HSK_MINIGAMES ||= {};
  const svgNamespace = 'http://www.w3.org/2000/svg';

  function shuffle(items) {
    const order = [...items];
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    return order;
  }

  function wordsForBoard(pool, count) {
    const glyphs = new Set();
    const meanings = new Set();
    const words = [];
    for (const word of pool) {
      const meaning = word.vi.toLocaleLowerCase('vi').trim();
      if (glyphs.has(word.hanzi) || meanings.has(meaning)) continue;
      glyphs.add(word.hanzi);
      meanings.add(meaning);
      words.push(word);
      if (words.length === count) break;
    }
    return words;
  }

  game.pairs = function mountPairs(root, ctx) {
    root.innerHTML = `
      <section class="memory-game pair-game" aria-label="Đèn Đôi"${ctx.lowMotion ? ' data-still' : ''}>
        <header class="memory-game-head">
          <p class="memory-game-rule">Nối mỗi chữ Hán với nghĩa để đưa điện về đèn.</p>
          <div class="memory-game-actions" role="group" aria-label="Số cặp đèn">
            <button type="button" class="btn button-white" data-pairs-size="4" aria-pressed="true">4 cặp</button>
            <button type="button" class="btn button-white" data-pairs-size="6" aria-pressed="false">6 cặp</button>
          </div>
        </header>
        <div class="memory-game-score">
          <span><b data-pairs-count></b> cặp</span>
          <span class="pair-combo">Chuỗi <b data-pairs-combo></b></span>
          <span><b data-pairs-score></b> điểm</span>
        </div>
        <div class="pair-tray" data-arena-surface>
          <div class="pair-grid" role="group" aria-label="Bảng nối chữ và nghĩa"></div>
          <svg class="pair-thread" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"></svg>
          <div class="pair-power" role="meter" aria-label="Đèn đã nối" aria-valuemin="0"></div>
        </div>
        <p class="memory-game-status" role="status"></p>
        <div class="memory-game-actions pair-controls">
          <button type="button" class="btn button-soft" data-pairs-continue hidden>Ghép tiếp</button>
          <button type="button" class="btn primary" data-pairs-replay hidden>Ván mới</button>
        </div>
      </section>`;

    const find = selector => root.querySelector(selector);
    const tray = find('.pair-tray');
    const board = find('.pair-grid');
    const thread = find('.pair-thread');
    const power = find('.pair-power');
    const countText = find('[data-pairs-count]');
    const comboText = find('[data-pairs-combo]');
    const scoreText = find('[data-pairs-score]');
    const status = find('.memory-game-status');
    const next = find('[data-pairs-continue]');
    const replay = find('[data-pairs-replay]');
    const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
    let size = 4;
    let cards = [];
    let numbers = [];
    let first = null;
    let points = 0;
    let combo = 0;
    let pairs = 0;
    let wire = null;
    let retryTimer = 0;
    const matched = new Set();
    const mistakes = new Set();

    function say(message, tone = '') {
      status.textContent = message;
      status.dataset.tone = tone;
    }

    function updateScore() {
      countText.textContent = `${matched.size}/${pairs}`;
      comboText.textContent = combo;
      scoreText.textContent = points;
      power.setAttribute('aria-valuenow', String(matched.size));
      [...power.children].forEach((lamp, index) => lamp.classList.toggle('is-powered', index < matched.size));
    }

    function start(nextSize) {
      clearTimeout(retryTimer);
      wire = null;
      first = null;
      points = combo = 0;
      matched.clear();
      mistakes.clear();
      size = nextSize;
      const words = wordsForBoard(ctx.words(36), size);
      pairs = words.length;
      const side = (entries, type) => shuffle(entries.map((word, index) =>
        ({word, side:type, index, value:type === 'hanzi' ? word.hanzi : word.vi})));
      const left = side(words, 'hanzi');
      const right = side(words, 'meaning');
      cards = left.flatMap((card, index) => [card, right[index]]);
      tray.removeAttribute('data-mismatch');
      tray.removeAttribute('data-complete');
      thread.replaceChildren();
      next.hidden = replay.hidden = true;
      board.replaceChildren(...cards.map((card, index) => {
        const button = document.createElement('button');
        button.className = 'pair-card';
        button.type = 'button';
        button.dataset.pairsCard = index;
        button.dataset.side = card.side;
        button.setAttribute('aria-pressed', 'false');
        button.style.setProperty('--tile-order', index);
        const value = document.createElement('span');
        value.className = 'pair-card-value';
        value.lang = card.side === 'hanzi' ? 'zh-Hans' : 'vi';
        value.textContent = card.value;
        const contact = document.createElement('i');
        contact.setAttribute('aria-hidden', 'true');
        contact.className = 'pair-contact';
        button.append(value, contact);
        return button;
      }));
      numbers = [...board.children];
      power.setAttribute('aria-valuemax', String(pairs));
      power.replaceChildren(...words.map(() => {
        const lamp = document.createElement('i');
        lamp.setAttribute('aria-hidden', 'true');
        return lamp;
      }));
      for (const button of root.querySelectorAll('[data-pairs-size]')) {
        button.setAttribute('aria-pressed', String(Number(button.dataset.pairsSize) === size));
      }
      updateScore();
      say(cards.length ? 'Chọn một đầu nối bất kỳ.' : 'Cần học thêm từ để mở bảng.');
    }

    function contactPoint(card, bounds) {
      const rect = card.querySelector('.pair-contact').getBoundingClientRect();
      return [(rect.left + rect.width / 2 - bounds.left) * 100 / bounds.width,
        (rect.top + rect.height / 2 - bounds.top) * 100 / bounds.height];
    }

    function placeWire() {
      if (!wire) return;
      const bounds = thread.getBoundingClientRect();
      if (!bounds.width || !bounds.height) return;
      const [x1, y1] = contactPoint(numbers[wire.from], bounds);
      const [x2, y2] = contactPoint(numbers[wire.to], bounds);
      const span = x2 - x1;
      wire.path.setAttribute('d', `M ${x1} ${y1} C ${x1 + span * .6} ${y1}, ${x2 - span * .6} ${y2}, ${x2} ${y2}`);
    }

    function connect(from, to, correct) {
      const path = document.createElementNS(svgNamespace, 'path');
      path.classList.add(correct ? 'pair-wire' : 'pair-wire--miss');
      path.setAttribute('pathLength', '1');
      path.setAttribute('vector-effect', 'non-scaling-stroke');
      wire = {from, to, path};
      thread.replaceChildren(path);
      placeWire();
    }

    function clearSelection() {
      if (first !== null) numbers[first].setAttribute('aria-pressed', 'false');
      first = null;
    }

    function resetAfterMiss() {
      clearTimeout(retryTimer);
      retryTimer = 0;
      tray.removeAttribute('data-mismatch');
      for (const button of numbers) button.classList.remove('is-missed');
      clearSelection();
      next.hidden = true;
    }

    function select(index) {
      const button = numbers[index];
      if (button.disabled || tray.hasAttribute('data-mismatch')) return;
      const current = cards[index];
      if (first === index) {
        clearSelection();
        say('Chọn một đầu nối bất kỳ.');
        return;
      }
      if (first === null || cards[first].side === current.side) {
        clearSelection();
        first = index;
        button.setAttribute('aria-pressed', 'true');
        say(current.side === 'hanzi' ? 'Tìm nghĩa của chữ này.' : 'Tìm chữ Hán cho nghĩa này.');
        return;
      }

      const previous = cards[first];
      const correct = previous.word.id === current.word.id;
      connect(first, index, correct);
      if (!correct) {
        tray.dataset.mismatch = '';
        numbers[first].classList.add('is-missed');
        button.classList.add('is-missed');
        combo = 0;
        mistakes.add(previous.word.id);
        const word = previous.word;
        say(`Chưa khớp. ${word.hanzi} · ${word.pinyin} nghĩa là “${word.vi}”.`, 'miss');
        next.hidden = false;
        retryTimer = setTimeout(resetAfterMiss, ctx.lowMotion || reducedMotion.matches ? 160 : 650);
        updateScore();
        return;
      }

      combo += 1;
      const base = pairs === 4 ? 196 : 180;
      points += base + Math.min(combo - 1, 5) * 16;
      matched.add(current.word.id);
      ctx.grade(current.word.id, 'meaning', mistakes.has(current.word.id) ? 'almost' : 'good');
      for (const tile of [numbers[first], button]) {
        tile.classList.add('is-paired');
        tile.disabled = true;
        tile.setAttribute('aria-disabled', 'true');
        tile.setAttribute('aria-label', tile.textContent + ', đã ghép');
      }
      clearSelection();
      updateScore();
      say(`${current.word.hanzi} · ${current.word.pinyin} · ${current.word.vi}.`, 'good');
      if (matched.size === pairs) {
        tray.dataset.complete = '';
        replay.hidden = false;
        ctx.complete(points);
        say(`Đã nối đủ ${pairs} cặp đèn. Tổng ${points} điểm.`, 'good');
        replay.focus({preventScroll:true});
      } else {
        numbers.find(tile => !tile.disabled)?.focus({preventScroll:true});
      }
    }

    function click(event) {
      const button = event.target.closest('button');
      if (!button) return;
      if (button.dataset.pairsSize) start(Number(button.dataset.pairsSize));
      else if (button === replay) {
        start(size);
        numbers[0]?.focus();
      } else if (button === next) {
        resetAfterMiss();
        numbers.find(tile => !tile.disabled)?.focus();
      } else if (button.dataset.pairsCard !== undefined) {
        select(Number(button.dataset.pairsCard));
      }
    }

    function keyboard(event) {
      const button = event.target.closest('[data-pairs-card]');
      if (!button) return;
      const offset = {ArrowLeft:-1, ArrowRight:1, ArrowUp:-2, ArrowDown:2}[event.key];
      if (!offset) return;
      const index = Number(button.dataset.pairsCard);
      if (offset === -1 && index % 2 === 0 || offset === 1 && index % 2 === 1) return;
      for (let next = index + offset; numbers[next]; next += offset) {
        if (numbers[next].disabled) {
          if (Math.abs(offset) === 1) break;
          continue;
        }
        event.preventDefault();
        numbers[next].focus();
        break;
      }
    }

    const resize = new ResizeObserver(placeWire);
    resize.observe(tray);
    root.addEventListener('click', click);
    root.addEventListener('keydown', keyboard);
    start(size);
    return () => {
      clearTimeout(retryTimer);
      resize.disconnect();
      root.removeEventListener('click', click);
      root.removeEventListener('keydown', keyboard);
    };
  };
})();
