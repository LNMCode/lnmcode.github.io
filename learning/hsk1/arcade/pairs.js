(() => {
  'use strict';

  const registry = window.HSK_MINIGAMES ||= {};
  const svgNamespace = 'http://www.w3.org/2000/svg';

  function shuffle(items) {
    const shuffled = [...items];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  registry.pairs = function mountPairs(root, ctx) {
    let size = 4;
    let cards = [];
    let open = [];
    let paired = new Set();
    let moves = 0;
    let timer = 0;
    let message = '';
    let status = '';
    let board;
    let scoreboard;
    let live;
    let controls;

    root.innerHTML = `
      <section class="memory-game pair-game" data-arcade-mode="pairs" aria-label="Đèn Đôi">
        <div class="memory-game-head">
          <p class="memory-game-rule">Mở hai đèn để ghép chữ Hán với nghĩa. Ghi nhớ vị trí mỗi đèn bạn đã mở.</p>
          <div class="memory-game-actions" aria-label="Số cặp đèn">
            <button type="button" class="btn button-white" data-pairs-size="4" aria-pressed="true">4 cặp</button>
            <button type="button" class="btn button-white" data-pairs-size="6" aria-pressed="false">6 cặp</button>
          </div>
        </div>
        <div class="memory-game-score"></div>
        <div class="pair-tray">
          <div class="pair-grid" data-cinema-stage role="group" aria-label="Bàn lật đèn"></div>
          <svg class="pair-thread" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"></svg>
        </div>
        <p class="memory-game-status" role="status" aria-live="polite"></p>
        <div class="memory-game-actions pair-controls"></div>
      </section>`;

    board = root.querySelector('.pair-grid');
    const thread = root.querySelector('.pair-thread');
    scoreboard = root.querySelector('.memory-game-score');
    live = root.querySelector('.memory-game-status');
    controls = root.querySelector('.pair-controls');

    function wordsForRound(count) {
      const hanzi = new Set();
      const meanings = new Set();
      return ctx.words(count * 4).filter(word => {
        const meaning = word.vi.toLocaleLowerCase('vi').trim();
        if (hanzi.has(word.hanzi) || meanings.has(meaning)) return false;
        hanzi.add(word.hanzi);
        meanings.add(meaning);
        return true;
      }).slice(0, count);
    }

    function start(nextSize) {
      window.clearTimeout(timer);
      size = nextSize;
      const words = wordsForRound(size);
      cards = shuffle(words.flatMap((word, color) => [
        {word, color, side:'hanzi', value:word.hanzi},
        {word, color, side:'meaning', value:word.vi},
      ]));
      open = [];
      paired = new Set();
      moves = 0;
      message = cards.length ? 'Chọn một đèn để bắt đầu.' : 'Chưa có từ phù hợp. Hãy thử lại sau khi học thêm.';
      status = '';
      thread.replaceChildren();
      for (const button of root.querySelectorAll('[data-pairs-size]')) {
        button.setAttribute('aria-pressed', String(Number(button.dataset.pairsSize) === size));
      }
      drawCards();
      update();
    }

    function drawCards() {
      board.replaceChildren();
      cards.forEach((_card, index) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'pair-card';
        button.dataset.pairsCard = index;
        button.style.setProperty('--card-delay', `${index * 25}ms`);
        button.innerHTML = '<span class="pair-card-shell"><span class="pair-card-cover" aria-hidden="true"><i></i></span><span class="pair-card-value"></span></span>';
        board.append(button);
      });
    }

    function score() {
      const pairs = cards.length / 2;
      return pairs * 150 + Math.max(0, pairs * 70 - (moves - pairs) * 24);
    }

    function update() {
      const pairs = cards.length / 2;
      const finished = pairs > 0 && paired.size === pairs;
      scoreboard.innerHTML = `<span><b>${paired.size}/${pairs}</b> cặp sáng</span><span class="pair-lamp-progress" aria-hidden="true">${Array.from({length:pairs}, (_, index) => `<i${index < paired.size ? ' class="is-lit"' : ''}></i>`).join('')}</span><span><b>${moves}</b> lượt lật</span>`;
      board.classList.toggle('is-complete', finished);
      Array.from(board.children).forEach((button, index) => {
        const card = cards[index];
        const matched = paired.has(card.word.id);
        const visible = matched || open.includes(index);
        const face = button.querySelector('.pair-card-value');
        button.classList.toggle('is-revealed', visible);
        button.classList.toggle('is-paired', matched);
        button.classList.toggle('is-missed', open.includes(index) && status === 'missed');
        button.dataset.side = visible ? card.side : '';
        button.dataset.pairColor = matched ? card.color : '';
        button.setAttribute('aria-disabled', String(matched || open.includes(index) || status === 'missed'));
        button.setAttribute('aria-label', visible
          ? `${card.side === 'hanzi' ? 'Chữ' : 'Nghĩa'} ${card.value}${matched ? ', đã ghép' : ''}`
          : `Đèn úp ${index + 1}`);
        face.textContent = visible ? card.value : '';
        face.lang = card.side === 'hanzi' ? 'zh-Hans' : 'vi';
        face.setAttribute('aria-hidden', 'true');
      });
      live.textContent = finished ? `Bạn đã thắp cả ${pairs} cặp trong ${moves} lượt. ${score()} điểm.` : message;
      controls.innerHTML = finished
        ? '<button type="button" class="btn primary" data-pairs-replay>Thắp ván mới</button>'
        : status === 'missed' ? '<button type="button" class="btn button-soft" data-pairs-continue>Úp hai đèn</button>' : '';
    }

    function connect(from, target, color) {
      const bounds = thread.getBoundingClientRect();
      if (!bounds.width || !bounds.height) return;
      const center = element => {
        const rect = element.getBoundingClientRect();
        return [(rect.left + rect.width / 2 - bounds.left) * 100 / bounds.width,
          (rect.top + rect.height / 2 - bounds.top) * 100 / bounds.height];
      };
      const [x1, y1] = center(from);
      const [x2, y2] = center(target);
      const arc = Math.max(5, (y1 + y2) / 2 - 17);
      const wire = document.createElementNS(svgNamespace, 'path');
      wire.setAttribute('d', `M ${x1} ${y1} Q ${(x1 + x2) / 2} ${arc} ${x2} ${y2}`);
      wire.setAttribute('pathLength', '1');
      wire.setAttribute('vector-effect', 'non-scaling-stroke');
      wire.dataset.pairColor = color;
      thread.replaceChildren(wire);
    }

    function closeMissed() {
      if (status !== 'missed') return;
      window.clearTimeout(timer);
      const restoreFocus = controls.contains(document.activeElement);
      const last = board.children[open.at(-1)];
      open = [];
      status = '';
      message = 'Hai đèn đã úp. Chọn một đèn để thử tiếp.';
      update();
      if (restoreFocus) last?.focus({preventScroll:true});
    }

    function flip(index) {
      const card = cards[index];
      if (!card || open.includes(index) || paired.has(card.word.id) || status === 'missed') return;
      open.push(index);
      const target = board.children[index];
      if (open.length === 1) {
        message = card.side === 'hanzi' ? 'Tìm đèn có nghĩa của chữ này.' : 'Tìm đèn có chữ Hán tương ứng.';
        update();
        ctx.motion?.('flip', target, {index});
        return;
      }
      moves++;
      const first = cards[open[0]];
      const from = board.children[open[0]];
      if (first.word.id === card.word.id) {
        paired.add(card.word.id);
        open = [];
        message = `${card.word.hanzi} · ${card.word.pinyin} · ${card.word.vi}. Cặp đèn đã sáng.`;
        update();
        connect(from, target, card.color);
        ctx.motion?.('match', target, {from, index, progress: paired.size / (cards.length / 2)});
        ctx.grade(card.word.id, 'meaning', 'good');
        if (paired.size === cards.length / 2) {
          controls.querySelector('[data-pairs-replay]').focus({preventScroll:true});
          ctx.motion?.('reward', board);
          ctx.complete(score());
        }
        return;
      }
      status = 'missed';
      message = 'Hai đèn chưa thành cặp. Nhìn kỹ trước khi úp lại.';
      update();
      ctx.motion?.('miss', target, {from});
      timer = window.setTimeout(closeMissed, 2200);
    }

    function onClick(event) {
      const target = event.target.closest('button');
      if (!target) return;
      if (target.hasAttribute('data-pairs-card')) flip(Number(target.dataset.pairsCard));
      if (target.hasAttribute('data-pairs-size') && Number(target.dataset.pairsSize) !== size) {
        start(Number(target.dataset.pairsSize));
      }
      if (target.hasAttribute('data-pairs-replay')) {
        start(size);
        board.querySelector('button')?.focus({preventScroll:true});
      }
      if (target.hasAttribute('data-pairs-continue')) closeMissed();
    }

    function onKeyDown(event) {
      const button = event.target.closest('[data-pairs-card]');
      const columns = 4;
      const offset = {ArrowLeft:-1, ArrowUp:-columns, ArrowRight:1, ArrowDown:columns}[event.key];
      if (!button || !offset) return;
      const next = Number(button.dataset.pairsCard) + offset;
      if (!board.children[next]) return;
      event.preventDefault();
      board.children[next].focus();
    }

    root.addEventListener('click', onClick);
    root.addEventListener('keydown', onKeyDown);
    start(size);
    return () => {
      window.clearTimeout(timer);
      root.removeEventListener('click', onClick);
      root.removeEventListener('keydown', onKeyDown);
    };
  };
})();
