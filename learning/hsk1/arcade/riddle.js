(() => {
  'use strict';

  const registry = window.HSK_MINIGAMES ||= {};
  const ROUND_COUNT = 5;
  const PARTS = ['onset', 'rime', 'tone'];
  const EMPTY_ONSET = '∅';
  const TONES = ['', '\u0304', '\u0301', '\u030c', '\u0300'];
  const TONE_LABEL = ['','1 · ngang','2 · lên','3 · xuống lên','4 · xuống','5 · nhẹ'];
  const COMMON_ONSETS = ['b', 'p', 'd', 't', 'n', 'l', 'g', 'k', 'h', 'j', 'q', 'x', 'zh', 'ch', 'sh', 'r', 'z', 'c', 's', 'y', 'w', EMPTY_ONSET];
  const COMMON_RIMES = ['a', 'ai', 'an', 'ang', 'ao', 'e', 'ei', 'en', 'eng', 'i', 'in', 'ing', 'iu', 'o', 'ong', 'ou', 'u', 'un', 'uo', 'ü', 'üe'];
  const SIMILAR = ['z zh', 'c ch', 's sh', 'l n', 'b p', 'j q x', 'an ang', 'en eng', 'in ing', 'u ü', 'ai ei', 'ao ou']
    .map(group => group.split(' '));

  function readParts(word) {
    // Compare spellings, with y and w treated as written first letters.
    if ([...word.hanzi].length !== 1 || word.pinyinAlternatives?.length) return null;
    const marked = word.pinyin.toLowerCase().normalize('NFD');
    const base = marked.replace(/[\u0304\u0301\u030c\u0300]/g, '').normalize('NFC');
    const match = base.match(/^(zh|ch|sh|[bpmfdtnlgkhjqxrzcsyw])?([aeiouüê][a-züê]*)$/);
    if (!match) return null;
    const tone = TONES.findIndex((mark, index) => index > 0 && marked.includes(mark));
    return {word, onset: match[1] || EMPTY_ONSET, rime: match[2], tone: String(tone < 0 ? 5 : tone)};
  }

  function shuffle(values) {
    const copy = [...values];
    for (let index = copy.length - 1; index > 0; index--) {
      const chosen = Math.floor(Math.random() * (index + 1));
      [copy[index], copy[chosen]] = [copy[chosen], copy[index]];
    }
    return copy;
  }

  function optionsFor(correct, inventory) {
    const close = SIMILAR.find(group => group.includes(correct)) || [];
    const candidates = [...new Set([correct, ...close, ...shuffle(inventory)])];
    return shuffle(candidates.slice(0, 4));
  }

  function choiceLabel(part, value) {
    if (value === EMPTY_ONSET) return 'Không có';
    return part === 'tone' ? TONE_LABEL[Number(value)] : value;
  }

  registry.riddle = function mountRiddle(root, ctx) {
    root.innerHTML = `
      <section class="riddle-game${ctx.lowMotion ? ' riddle-still' : ''}" data-riddle-riddle aria-label="Mật Mã Âm Tiết">
        <div class="riddle-hud"><span>Khóa <b data-riddle-round></b></span><span><b data-riddle-score>0</b> điểm</span></div>
        <div class="riddle-vault" data-riddle-lock data-cinema-stage>
          <div class="riddle-plate">
            <div class="riddle-ring riddle-ring-outer" aria-hidden="true"></div>
            <div class="riddle-ring riddle-ring-middle" aria-hidden="true"></div>
            <div class="riddle-ring riddle-ring-inner" aria-hidden="true"></div>
            <div class="riddle-seal" data-riddle-word lang="zh-Hans"></div>
          </div>
          <ol class="riddle-lamps" aria-label="Dấu niêm đã mở"></ol>
        </div>
        <div class="riddle-clue"><small>Nghĩa của chữ</small><strong data-riddle-meaning></strong></div>
        <form class="riddle-form" data-riddle-form>
          <p>Chọn phần đầu, phần vần và thanh điệu theo cách viết Pinyin.</p>
          <div class="riddle-dials">
            <label data-riddle-dial="onset">Phần đầu
              <select data-riddle-part="onset" aria-describedby="riddle-onset-status"></select>
              <span id="riddle-onset-status" class="riddle-dial-status"></span>
            </label>
            <label data-riddle-dial="rime">Phần vần
              <select data-riddle-part="rime" aria-describedby="riddle-rime-status"></select>
              <span id="riddle-rime-status" class="riddle-dial-status"></span>
            </label>
            <label data-riddle-dial="tone">Thanh điệu
              <select data-riddle-part="tone" aria-describedby="riddle-tone-status"></select>
              <span id="riddle-tone-status" class="riddle-dial-status"></span>
            </label>
          </div>
          <div class="riddle-buttons">
            <button type="button" class="btn button-soft" data-riddle-hint>Gợi ý một vòng</button>
            <button type="submit" class="btn primary" data-riddle-try>Thử mở khóa</button>
          </div>
        </form>
        <p class="riddle-message" role="status"></p>
        <div class="riddle-open-actions" hidden>
          <button type="button" class="btn primary full" data-riddle-next>Mở khóa tiếp</button>
          <button type="button" class="btn primary full" data-riddle-replay hidden>Chơi lượt mới</button>
        </div>
      </section>`;

    const game = root.firstElementChild;
    const lock = game.querySelector('[data-riddle-lock]');
    const form = game.querySelector('[data-riddle-form]');
    const message = game.querySelector('[role="status"]');
    const hintButton = game.querySelector('[data-riddle-hint]');
    const nextButton = game.querySelector('[data-riddle-next]');
    const replayButton = game.querySelector('[data-riddle-replay]');
    const reward = game.querySelector('.riddle-open-actions');
    const dials = Object.fromEntries(PARTS.map(part => [part, {
      field: game.querySelector(`[data-riddle-dial="${part}"]`),
      select: game.querySelector(`[data-riddle-part="${part}"]`),
      status: game.querySelector(`#riddle-${part}-status`),
    }]));
    let rounds = [];
    let index = 0;
    let score = 0;
    let mistakes = 0;
    let hints = 0;
    let opened = false;

    function updateScore() {
      game.querySelector('[data-riddle-round]').textContent = `${Math.min(index + 1, rounds.length)}/${rounds.length}`;
      game.querySelector('[data-riddle-score]').textContent = score;
      const lit = index + Number(opened);
      game.querySelector('.riddle-lamps').replaceChildren(...rounds.map((_, slot) => {
        const lamp = document.createElement('li');
        lamp.className = slot < lit ? 'is-lit' : '';
        lamp.setAttribute('aria-label', `Khóa ${slot + 1} ${slot < lit ? 'đã mở' : 'còn đóng'}`);
        return lamp;
      }));
    }

    function setDial(part, state) {
      const {field, select, status} = dials[part];
      field.dataset.state = state;
      select.disabled = state === 'matched' || state === 'hint';
      status.textContent = {matched:'Đã khớp', missed:'Chưa khớp', hint:'Đã gợi ý'}[state] || '';
      lock.style.setProperty(`--riddle-${part}-angle`, `${select.selectedIndex * 33}deg`);
    }

    function showRound(shouldFocus) {
      const round = rounds[index];
      if (!round) {
        form.hidden = true;
        message.textContent = 'Chưa tìm thấy chữ Hán một âm tiết để tạo mật mã.';
        return;
      }
      mistakes = hints = 0;
      opened = false;
      lock.classList.remove('is-open');
      reward.hidden = true;
      form.hidden = false;
      hintButton.disabled = false;
      message.textContent = '';
      game.querySelector('[data-riddle-word]').textContent = round.word.hanzi;
      game.querySelector('[data-riddle-meaning]').textContent = round.word.vi;
      const options = {
        onset: optionsFor(round.onset, COMMON_ONSETS),
        rime: optionsFor(round.rime, COMMON_RIMES),
        tone: ['1', '2', '3', '4', '5']
      };
      for (const part of PARTS) {
        const select = dials[part].select;
        select.replaceChildren(new Option('Chọn', '', true, true), ...options[part].map(value =>
          new Option(choiceLabel(part, value), value)));
        setDial(part, '');
      }
      updateScore();
      if (shouldFocus) dials.onset.select.focus();
    }

    function newRun(shouldFocus = false) {
      const previous = new Set(rounds.map(round => round.word.id));
      const pool = ctx.words(300).map(readParts).filter(Boolean);
      const seen = new Set();
      const unique = pool.filter(round => {
        const code = round.onset + round.rime + round.tone;
        if (seen.has(code)) return false;
        seen.add(code);
        return true;
      });
      const fresh = unique.filter(round => !previous.has(round.word.id));
      rounds = [...fresh, ...unique.filter(round => previous.has(round.word.id))].slice(0, ROUND_COUNT);
      index = score = 0;
      showRound(shouldFocus);
    }

    function hint() {
      if (opened) return;
      const round = rounds[index];
      const part = PARTS.find(name => !dials[name].select.disabled);
      if (!part) return;
      hints++;
      dials[part].select.value = round[part];
      setDial(part, 'hint');
      ctx.motion?.('dial', lock, {part, value: dials[part].select.selectedIndex});
      const next = PARTS.find(name => !dials[name].select.disabled);
      hintButton.disabled = !next;
      message.textContent = 'Đã mở một vòng. Dùng phần được gợi ý để thử mật mã.';
      if (next) dials[next].select.focus();
      else form.querySelector('[data-riddle-try]').focus();
    }

    function submit(event) {
      event.preventDefault();
      if (opened) return;
      const round = rounds[index];
      const values = Object.fromEntries(PARTS.map(part => [part, dials[part].select.value]));
      const missing = PARTS.find(part => !values[part]);
      if (missing) {
        message.textContent = 'Xoay đủ cả ba vòng rồi thử mở khóa.';
        dials[missing].select.focus();
        return;
      }
      const spelling = (values.onset === EMPTY_ONSET ? '' : values.onset) + values.rime + values.tone;
      if (ctx.matchPinyin(spelling, round.word) !== 'good') {
        mistakes++;
        for (const part of PARTS) {
          if (dials[part].select.disabled) continue;
          setDial(part, values[part] === round[part] ? 'matched' : 'missed');
        }
        const missed = PARTS.filter(part => dials[part].field.dataset.state === 'missed');
        message.textContent = missed.length
          ? `Còn ${missed.length} vòng chưa khớp. Các vòng đúng đã được giữ lại.`
          : 'Mật mã chưa hợp lệ. Chọn lại một vòng rồi thử tiếp.';
        ctx.motion?.('miss', lock);
        if (missed.length) dials[missed[0]].select.focus();
        return;
      }
      opened = true;
      const points = Math.max(30, 120 - mistakes * 16 - hints * 25);
      const final = index + 1 === rounds.length;
      score += points;
      lock.classList.add('is-open');
      form.hidden = true;
      reward.hidden = false;
      nextButton.hidden = final;
      replayButton.hidden = !final;
      updateScore();
      message.textContent = `${round.word.hanzi} · ${round.word.pinyin}. ${final ? `Đã mở cả kho. Tổng ${score} điểm.` : `Khóa đã mở. +${points} điểm.`}`;
      ctx.grade(round.word.id, 'reading', mistakes || hints ? 'almost' : 'good');
      ctx.motion?.('unlock', lock, {score, final});
      if (final) ctx.complete(score);
      (final ? replayButton : nextButton).focus({preventScroll: true});
    }

    function change(event) {
      const part = event.target.dataset.riddlePart;
      if (!part) return;
      setDial(part, '');
      ctx.motion?.('dial', lock, {part, value: event.target.selectedIndex});
    }

    function nextRound() {
      if (!opened || index + 1 >= rounds.length) return;
      index++;
      showRound(true);
    }
    function replay() { newRun(true); }

    form.addEventListener('submit', submit);
    form.addEventListener('change', change);
    hintButton.addEventListener('click', hint);
    nextButton.addEventListener('click', nextRound);
    replayButton.addEventListener('click', replay);
    newRun();
    return () => {
      form.removeEventListener('submit', submit);
      form.removeEventListener('change', change);
      hintButton.removeEventListener('click', hint);
      nextButton.removeEventListener('click', nextRound);
      replayButton.removeEventListener('click', replay);
    };
  };
})();
