(() => {
  'use strict';

  const registry = window.HSK_MINIGAMES ||= {};
  const ROUND_COUNT = 5;
  const ATTEMPTS = 6;
  const keys = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'];
  const TONES = ['\u0304', '\u0301', '\u030c', '\u0300'];
  const labels = {exact:'đúng chỗ', nearby:'khác chỗ', absent:'không có'};
  const rank = {absent:1, nearby:2, exact:3};
  const escape = value => String(value ?? '').replace(/[&<>"']/g,
    mark => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[mark]));
  const display = letter => letter === 'v' ? 'ü' : letter;

  function reading(value) {
    const raw = String(value).toLowerCase().trim().replace(/u:/g, 'ü').normalize('NFD');
    const toneDigit = raw.match(/[1-5]$/)?.[0];
    const markedTone = TONES.findIndex(mark => raw.includes(mark)) + 1;
    const letters = raw.replace(/u\u0308/g, 'v').replace(/[\u0300-\u036f]/g, '').replace(/[1-5]$/, '');
    return {letters, tone: Number(toneDigit) || markedTone || 0};
  }

  function classify(guess, answer) {
    const remaining = [...answer];
    const marks = [...guess].map((letter, index) => {
      if (letter !== answer[index]) return 'absent';
      remaining[index] = null;
      return 'exact';
    });
    for (let index = 0; index < marks.length; index++) {
      if (marks[index] === 'exact') continue;
      const match = remaining.indexOf(guess[index]);
      if (match === -1) continue;
      marks[index] = 'nearby';
      remaining[match] = null;
    }
    return marks;
  }

  function uniquePuzzles(words) {
    const byMeaning = new Map();
    for (const word of words) byMeaning.set(word.vi, (byMeaning.get(word.vi) || 0) + 1);
    return words.flatMap(word => {
      const {letters} = reading(word.pinyin);
      if (byMeaning.get(word.vi) !== 1 || !/^[a-z]{2,6}$/.test(letters) || [...word.hanzi].length !== 1) return [];
      if ((word.pinyinAlternatives || []).some(value => reading(value).letters !== letters)) return [];
      return [{word, answer:letters}];
    });
  }

  registry.riddle = function mountRiddle(root, ctx) {
    root.innerHTML = `
      <section class="riddle-chamber${ctx.lowMotion ? ' riddle-still' : ''}" data-riddle-riddle aria-label="Mật Mã Âm Tiết">
        <div class="riddle-hud">
          <span>Ấn <b data-riddle-round></b></span><span><b data-riddle-score>0</b> điểm</span>
        </div>
        <div class="riddle-board" data-riddle-board data-cinema-stage>
          <div class="riddle-crest" aria-hidden="true"><span>印</span></div>
          <div class="riddle-tablet">
            <small>Đoán Pinyin của từ có nghĩa</small><strong data-riddle-meaning></strong>
            <span class="riddle-letter-count" data-riddle-count></span>
          </div>
          <ol class="riddle-grid" data-riddle-grid aria-label="Mã đã thử"></ol>
          <div class="riddle-legend" aria-label="Chú giải kết quả">
            <span data-mark="exact">Đúng chỗ</span><span data-mark="nearby">Khác chỗ</span><span data-mark="absent">Không có</span>
          </div>
        </div>
        <div class="riddle-desk">
          <form class="riddle-form" data-riddle-form>
            <label class="riddle-entry">
              <span class="riddle-input-label">Pinyin</span>
              <input data-riddle-input type="text" name="guess" maxlength="24" inputmode="text" autocomplete="off"
                autocapitalize="none" spellcheck="false" placeholder="Nhập mã" aria-describedby="riddle-input-help">
            </label>
            <button class="riddle-action riddle-submit" type="submit" data-riddle-try>Thử mã</button>
          </form>
          <p id="riddle-input-help" class="riddle-help">Dùng <b>v</b> cho <b>ü</b>. Dấu thanh hoặc số thanh là tùy chọn.</p>
          <div class="riddle-keyboard" aria-label="Bàn phím Pinyin">
            ${keys.map(row => `<div class="riddle-keyrow">
              ${[...row].map(key => `<button type="button" class="riddle-key" data-riddle-key="${key}" aria-label="${key === 'v' ? 'V hoặc Ü' : key}">${key}</button>`).join('')}
              ${row === keys[2] ? '<button type="button" class="riddle-key riddle-backspace" data-riddle-key="Backspace" aria-label="Xóa ký tự cuối">⌫</button>' : ''}
            </div>`).join('')}
          </div>
          <button type="button" class="riddle-hint" data-riddle-hint>Gợi ý chữ đầu</button>
        </div>
        <p class="riddle-status" data-riddle-status role="status" aria-live="polite"></p>
        <div class="riddle-result" data-riddle-result hidden>
          <div class="riddle-result-title"><b data-riddle-word lang="zh-Hans"></b><div><strong data-riddle-reading></strong><p data-riddle-translation></p></div>
            <button type="button" data-riddle-speak hidden aria-label="Nghe phát âm">♪</button>
          </div>
          <button type="button" class="riddle-action riddle-submit" data-riddle-next hidden>Mở ấn tiếp theo</button>
          <button type="button" class="riddle-action riddle-submit" data-riddle-replay hidden>Chơi lượt mới</button>
        </div>
      </section>`;

    const game = root.firstElementChild;
    const board = root.querySelector('[data-riddle-board]');
    const grid = root.querySelector('[data-riddle-grid]');
    const desk = root.querySelector('.riddle-desk');
    const form = root.querySelector('[data-riddle-form]');
    const input = root.querySelector('[data-riddle-input]');
    const result = root.querySelector('[data-riddle-result]');
    const message = root.querySelector('[data-riddle-status]');
    const next = root.querySelector('[data-riddle-next]');
    const replay = root.querySelector('[data-riddle-replay]');
    const hint = root.querySelector('[data-riddle-hint]');
    const keyButtons = [...root.querySelectorAll('[data-riddle-key]')].filter(button => button.dataset.riddleKey !== 'Backspace');
    let puzzles = [];
    let index = 0;
    let score = 0;
    let history = [];
    let closed = false;
    let assisted = false;
    let composition = false;

    const current = () => puzzles[index];
    const announce = text => { message.textContent = text; };
    const updateScore = () => {
      root.querySelector('[data-riddle-score]').textContent = score;
      root.querySelector('[data-riddle-round]').textContent = `${index + 1}/${puzzles.length}`;
    };

    function paintRows(animate = -1) {
      const {answer} = current();
      const preview = closed ? '' : reading(input.value).letters.replace(/[^a-z]/g, '').slice(0, answer.length);
      grid.style.setProperty('--riddle-length', answer.length);
      grid.innerHTML = Array.from({length:ATTEMPTS}, (_, row) => {
        const guess = history[row];
        const active = !closed && row === history.length;
        const letters = guess?.letters ?? (active ? preview : '');
        const description = guess ? `Lượt ${row + 1}, ${[...letters].map((letter, column) =>
          `${display(letter)} ${labels[guess.marks[column]]}`).join(', ')}` : '';
        return `<li class="riddle-row" ${guess ? `data-riddle-guess aria-label="${escape(description)}"` : 'aria-hidden="true"'}
          ${active ? 'data-active' : ''} ${row === animate ? 'data-stamping' : ''}>${[...answer].map((_, column) =>
            `<span style="--riddle-cell:${column}" ${guess ? `data-mark="${guess.marks[column]}"` : ''}>${display(letters[column] || '')}</span>`).join('')}</li>`;
      }).join('');
    }

    function updateKeys(letters, marks) {
      [...letters].forEach((letter, index) => {
        const button = keyButtons.find(key => key.dataset.riddleKey === letter);
        if (!button) return;
        const mark = marks[index];
        if (rank[button.dataset.mark] >= rank[mark]) return;
        button.dataset.mark = mark;
        button.setAttribute('aria-label', `${display(letter)}, ${labels[mark]}`);
      });
    }

    function showRound() {
      const puzzle = current();
      if (!puzzle) {
        desk.hidden = true;
        grid.hidden = true;
        announce('Chưa tìm được từ phù hợp để tạo mật mã.');
        return;
      }
      history = [];
      closed = false;
      assisted = false;
      composition = false;
      input.value = '';
      board.removeAttribute('data-outcome');
      desk.hidden = false;
      result.hidden = next.hidden = replay.hidden = true;
      hint.disabled = false;
      root.querySelector('[data-riddle-meaning]').textContent = puzzle.word.vi;
      root.querySelector('[data-riddle-count]').textContent = `${puzzle.answer.length} chữ cái · ${ATTEMPTS} lượt`;
      keyButtons.forEach(button => {
        delete button.dataset.mark;
        const key = button.dataset.riddleKey;
        button.setAttribute('aria-label', key === 'v' ? 'V hoặc Ü' : key);
      });
      updateScore();
      announce('');
      paintRows();
    }

    function newRun() {
      const previous = new Set(puzzles.map(puzzle => puzzle.word.id));
      const pool = uniquePuzzles(ctx.words(300));
      puzzles = [
        ...pool.filter(puzzle => !previous.has(puzzle.word.id)),
        ...pool.filter(puzzle => previous.has(puzzle.word.id))
      ].slice(0, ROUND_COUNT);
      index = score = 0;
      showRound();
    }

    function finish(success, suppliedTone) {
      const puzzle = current();
      const final = index === puzzles.length - 1;
      const toneCorrect = ctx.matchPinyin(puzzle.answer + (suppliedTone || ''), puzzle.word) === 'good';
      closed = true;
      board.dataset.outcome = success ? 'open' : 'closed';
      const points = success ? Math.max(25, 120 - (history.length - 1) * 14 - Number(assisted) * 25) : 0;
      score += points;
      ctx.grade(puzzle.word.id, 'reading',
        success ? history.length === 1 && toneCorrect && !assisted ? 'good' : 'almost' : 'again');
      updateScore();
      paintRows(history.length - 1);
      desk.hidden = true;
      result.hidden = false;
      root.querySelector('[data-riddle-word]').textContent = puzzle.word.hanzi;
      root.querySelector('[data-riddle-reading]').textContent = puzzle.word.pinyin;
      root.querySelector('[data-riddle-translation]').textContent = puzzle.word.vi;
      root.querySelector('[data-riddle-speak]').hidden = !ctx.voiceAvailable?.();
      announce(success
        ? `Ấn đã mở. +${points} điểm.${!suppliedTone || toneCorrect ? '' : ` Thanh đúng đọc là ${puzzle.word.pinyin}.`}${final ? ` Tổng ${score} điểm.` : ''}`
        : `Đã hết ${ATTEMPTS} lượt. Mật mã là ${puzzle.word.pinyin}.${final ? ` Tổng ${score} điểm.` : ''}`);
      next.hidden = final;
      replay.hidden = !final;
      if (final) ctx.complete(score);
      (final ? replay : next).focus({preventScroll:true});
    }

    function submit(event) {
      event.preventDefault();
      if (closed || composition || !current()) return;
      const {answer} = current();
      const {letters, tone} = reading(input.value);
      if (!/^[a-z]+$/.test(letters) || letters.length !== answer.length) {
        announce(`Mật mã cần đúng ${answer.length} chữ cái Pinyin.`);
        return;
      }
      if (history.some(guess => guess.letters === letters)) {
        announce('Mã này đã thử. Hãy đổi các chữ chưa khớp.');
        return;
      }
      const marks = classify(letters, answer);
      history.push({letters, marks});
      updateKeys(letters, marks);
      input.value = '';
      if (letters === answer || history.length === ATTEMPTS) {
        finish(letters === answer, tone);
        return;
      }
      const exact = marks.filter(mark => mark === 'exact').length;
      const nearby = marks.filter(mark => mark === 'nearby').length;
      announce(`${exact} chữ đúng chỗ, ${nearby} chữ khác chỗ. Còn ${ATTEMPTS - history.length} lượt.`);
      paintRows(history.length - 1);
    }

    function onClick(event) {
      const button = event.target.closest('button');
      if (!button || button.disabled || !current()) return;
      if (button.hasAttribute('data-riddle-next') && closed && index + 1 < puzzles.length) {
        index++;
        showRound();
        return;
      }
      if (button.hasAttribute('data-riddle-replay') && closed) {
        newRun();
        return;
      }
      if (button.hasAttribute('data-riddle-speak')) {
        ctx.speak?.(current().word.hanzi);
        return;
      }
      if (closed) return;
      if (button.hasAttribute('data-riddle-hint')) {
        assisted = true;
        hint.disabled = true;
        announce(`Mật mã bắt đầu bằng ${display(current().answer[0])}.`);
        return;
      }
      const key = button.dataset.riddleKey;
      if (!key) return;
      const letters = reading(input.value).letters.replace(/[^a-z]/g, '').slice(0, current().answer.length);
      if (key === 'Backspace') input.value = letters.slice(0, -1);
      else if (letters.length < current().answer.length) input.value = letters + key;
      paintRows();
    }

    const controller = new AbortController();
    const options = {signal:controller.signal};
    form.addEventListener('submit', submit, options);
    input.addEventListener('input', () => { if (!composition && !closed) paintRows(); }, options);
    input.addEventListener('compositionstart', () => { composition = true; }, options);
    input.addEventListener('compositionend', () => { composition = false; if (!closed) paintRows(); }, options);
    root.addEventListener('click', onClick, options);
    newRun();
    return () => {
      controller.abort();
      ctx.stopSpeech?.();
    };
  };
})();
