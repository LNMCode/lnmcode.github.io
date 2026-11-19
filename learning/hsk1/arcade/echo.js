(() => {
  'use strict';

  const games = window.HSK_MINIGAMES ||= {};
  const frequencies = ['87,8', '91,4', '95,2', '99,6', '103,8'];
  const bars = [11, 23, 47, 29, 62, 76, 43, 91, 55, 100, 73, 104, 68, 100, 55, 91, 43, 76, 62, 29, 47, 23, 11];
  const ROUND_COUNT = 5;

  games.echo = function mountEcho(root, ctx) {
    const listeners = new AbortController();
    const options = {signal: listeners.signal};
    root.innerHTML = `
      <section class="echo-game${ctx.lowMotion ? ' echo-game--still' : ''}" aria-label="Trạm Vọng Âm" data-echo-station>
        <div class="echo-route" role="group" aria-label="Tiến độ nhận tin">
          <p data-echo-count></p><div data-echo-chain></div>
        </div>
        <div class="echo-radio" data-signal="0">
          <div class="echo-radio-head">
            <span class="echo-dial-value"><strong data-echo-frequency-value></strong> MHz</span>
            <span class="echo-lamp" data-echo-lock>Đang tìm sóng</span>
          </div>
          <div class="echo-screen">
            <aside class="echo-speaker" aria-hidden="true"></aside>
            <div class="echo-scope" data-cinema-stage aria-hidden="true">
              ${bars.map((height, index) => `<i style="--bar:${height}%;--beat:${(index % 7) * -.11}s"></i>`).join('')}
              <b class="echo-sweep"></b>
            </div>
            <button type="button" class="echo-knob" data-echo-knob aria-label="Xoay sang tần số tiếp theo"><i aria-hidden="true"></i></button>
          </div>
          <div class="echo-bands" role="group" aria-label="Chọn tần số">
            ${frequencies.map((frequency, index) => `<button type="button" data-echo-frequency="${index}" aria-label="${frequency} MHz" aria-pressed="false">${frequency}</button>`).join('')}
          </div>
        </div>
        <p class="echo-instruction" data-echo-status role="status" aria-live="polite"></p>
        <div class="echo-actions" data-echo-actions hidden>
          <button type="button" class="btn primary" data-echo-audio>Nghe tín hiệu</button>
          <button type="button" class="btn button-soft" data-echo-hint>Dùng manh mối</button>
        </div>
        <div class="echo-clue" data-echo-clue hidden>
          <small>Manh mối tiếng Việt</small>
          <strong data-echo-meaning></strong>
          <p data-echo-note>Điểm ở lượt này được tính theo chế độ có manh mối.</p>
        </div>
        <form class="echo-form" data-echo-form hidden>
          <label for="echo-pinyin-input">Giải mã bằng Pinyin</label>
          <div class="echo-input-row">
            <input id="echo-pinyin-input" data-echo-input type="text" inputmode="text" autocapitalize="none"
              autocomplete="off" autocorrect="off" spellcheck="false" maxlength="64" placeholder="Ví dụ hǎo hoặc hao3">
            <button type="submit" class="btn primary" data-echo-submit>Gửi</button>
          </div>
          <button type="button" class="btn button-text" data-echo-skip>Xem lời giải</button>
        </form>
        <div class="echo-answer" data-echo-answer hidden>
          <div><strong lang="zh-Hans" data-echo-hanzi></strong><span data-echo-reading></span><b data-echo-gain aria-hidden="true"></b></div>
          <p data-echo-translation></p>
          <button type="button" class="btn primary full" data-echo-next>Nhận tin tiếp</button>
        </div>
        <div class="echo-result" data-echo-result hidden>
          <h2 tabindex="-1">Trạm đã nối sóng</h2>
          <p data-echo-summary></p>
          <button type="button" class="btn primary full" data-echo-replay>Thu thêm tín hiệu</button>
        </div>
      </section>`;

    const get = name => root.querySelector(`[data-echo-${name}]`);
    const radio = root.querySelector('.echo-radio');
    const spectrum = radio.querySelector('.echo-scope');
    const bandButtons = [...root.querySelectorAll('[data-echo-frequency]')];
    const knob = get('knob');
    const audio = get('audio');
    const input = get('input');
    const status = get('status');
    let words;
    let states;
    let index;
    let frequency;
    let dial;
    let tuned;
    let heard;
    let hinted;
    let missed;
    let finished;
    let score;
    let decoded;
    let byEar;
    let composing = false;
    let pulseTimer;
    let spoken = false;

    function prompt(text) {
      status.textContent = text;
    }

    function stopPulse() {
      clearTimeout(pulseTimer);
      radio.classList.remove('is-speaking');
    }

    function stopSpeech() {
      stopPulse();
      if (spoken) {
        if (ctx.stopSpeech) ctx.stopSpeech();
        else window.speechSynthesis?.cancel();
        spoken = false;
      }
    }

    function drawRoute() {
      get('count').textContent = `Tín hiệu ${index + 1}/${words.length} · ${score} điểm`;
      get('chain').replaceChildren(...states.map((state, step) => {
        const lamp = document.createElement('i');
        lamp.className = 'echo-checkpoint';
        lamp.dataset.state = state || (step === index ? 'current' : 'waiting');
        lamp.setAttribute('aria-hidden', 'true');
        return lamp;
      }));
    }

    function refreshDial() {
      const distance = Math.abs(dial - frequency);
      radio.dataset.signal = distance === 0 ? '3' : distance === 1 ? '2' : '1';
      spectrum.dataset.signal = radio.dataset.signal;
      radio.style.setProperty('--echo-tuning', `${(dial - 2) * 34}deg`);
      get('frequency-value').textContent = frequencies[dial];
      get('lock').textContent = distance === 0 ? 'Đã bắt sóng' : distance === 1 ? 'Sóng gần' : 'Sóng yếu';
      knob.setAttribute('aria-disabled', String(tuned));
      bandButtons.forEach((button, band) => {
        button.setAttribute('aria-pressed', String(band === dial));
        button.setAttribute('aria-disabled', String(tuned));
      });
    }

    function chooseFrequency(band) {
      if (tuned || finished || band < 0 || band >= frequencies.length) return;
      dial = band;
      tuned = dial === frequency;
      refreshDial();
      ctx.motion?.('tune', spectrum, {signal: Number(radio.dataset.signal), band});
      if (!tuned) {
        prompt(Math.abs(dial - frequency) === 1
          ? 'Sóng mạnh hơn. Thử một tần số liền kề.'
          : 'Sóng còn yếu. Hãy thử tần số khác.');
        return;
      }
      get('actions').hidden = false;
      if (ctx.voiceAvailable?.()) {
        prompt('Đã khóa tần số. Nghe từ tiếng Trung rồi ghi lại âm và thanh điệu.');
        audio.focus({preventScroll: true});
      } else {
        showClue(true);
      }
    }

    function nextWord() {
      stopSpeech();
      const lastFrequency = frequency;
      const candidates = frequencies.map((_, band) => band).filter(band => band !== lastFrequency);
      frequency = candidates[Math.floor(Math.random() * candidates.length)];
      dial = frequency === 0 ? frequencies.length - 1 : 0;
      tuned = heard = hinted = missed = false;
      radio.dataset.phase = '';
      input.value = '';
      audio.textContent = 'Nghe tín hiệu';
      audio.disabled = !ctx.voiceAvailable?.();
      get('hint').hidden = false;
      for (const name of ['actions', 'clue', 'form', 'answer']) get(name).hidden = true;
      refreshDial();
      ctx.motion?.('round', spectrum, {signal: Number(radio.dataset.signal), band: dial});
      drawRoute();
      prompt('Thử các tần số cho đến khi đèn chuyển xanh để nhận tín hiệu.');
    }

    function showClue(offline) {
      hinted = true;
      get('form').hidden = false;
      get('clue').hidden = false;
      get('hint').hidden = true;
      get('meaning').textContent = words[index].vi;
      if (!offline) ctx.motion?.('hint', get('clue'));
      get('note').textContent = offline
        ? 'Không có giọng Quan thoại khả dụng. Lượt này luyện nhớ cách đọc từ nghĩa.'
        : 'Lượt có manh mối không tính vào số tín hiệu giải bằng tai.';
      prompt('Nhìn nghĩa rồi thử nhớ âm đọc tiếng Trung.');
    }

    function listen() {
      if (!tuned || audio.disabled || finished) return;
      stopPulse();
      const round = index;
      const played = ctx.speak?.(words[index].hanzi, () => {
        if (listeners.signal.aborted || round !== index || !get('answer').hidden) return;
        stopPulse();
        spoken = heard = false;
        audio.disabled = true;
        showClue(true);
      });
      if (!played) {
        audio.disabled = true;
        showClue(true);
        return;
      }
      spoken = heard = true;
      ctx.motion?.('listen', spectrum);
      audio.textContent = 'Nghe lại';
      get('form').hidden = false;
      radio.classList.add('is-speaking');
      pulseTimer = setTimeout(stopPulse, 1100);
      prompt('Ghi lại Pinyin vừa nghe. Có thể nghe lại tín hiệu.');
    }

    function reveal(correct) {
      const word = words[index];
      const unassisted = heard && !hinted;
      const points = correct ? unassisted && !missed ? 100 : 55 : 0;
      if (unassisted) ctx.grade(word.id, 'reading', correct ? missed ? 'almost' : 'good' : 'again');
      if (correct) {
        decoded++;
        if (unassisted) byEar++;
        score += points;
      }
      radio.dataset.phase = correct ? 'linked' : 'recovered';
      states[index] = correct ? 'linked' : 'recovered';
      drawRoute();
      ctx.motion?.(correct ? 'success' : 'miss', spectrum, {score, signal:3, band:dial});
      get('actions').hidden = true;
      get('clue').hidden = true;
      get('form').hidden = true;
      get('answer').hidden = false;
      get('hanzi').textContent = word.hanzi;
      get('reading').textContent = word.pinyin;
      get('gain').textContent = points ? `+${points}` : '';
      get('translation').textContent = word.vi;
      get('next').textContent = index + 1 === words.length ? 'Xem kết quả' : 'Nhận tin tiếp';
      prompt(correct ? 'Giải mã thành công. Một đèn tiếp sóng vừa sáng.' : 'Đã lưu cách đọc đúng để bạn xem lại.');
      get('next').focus({preventScroll: true});
    }

    function submit(event) {
      event.preventDefault();
      if (composing || finished || get('form').hidden) return;
      const match = ctx.matchPinyin(input.value, words[index]);
      if (match === 'good') reveal(true);
      else if (match === 'empty') prompt('Nhập âm đọc vào ô giải mã.');
      else {
        missed = true;
        ctx.motion?.('miss', input);
        prompt(match === 'almost' ? 'Âm đã khớp. Hãy kiểm tra dấu hoặc số thanh.'
          : hinted ? 'Pinyin chưa khớp. Thử nhớ âm đọc hoặc xem lời giải.'
          : 'Pinyin chưa khớp. Thử lại hoặc nghe thêm một lần.');
        input.focus({preventScroll: true});
      }
    }

    function advance() {
      if (get('answer').hidden || finished) return;
      if (index + 1 < words.length) {
        index++;
        nextWord();
        bandButtons[dial].focus({preventScroll: true});
        return;
      }
      finished = true;
      stopSpeech();
      get('answer').hidden = true;
      status.hidden = true;
      get('result').hidden = false;
      get('summary').textContent = `Đã giải ${decoded}/${words.length} tín hiệu, ${byEar} tín hiệu bằng tai. Tổng ${score} điểm.`;
      if (decoded > 0) ctx.motion?.('reward', spectrum, {score});
      ctx.complete(score);
      get('result').querySelector('h2').focus({preventScroll: true});
    }

    function start() {
      words = [...new Map(ctx.words(ROUND_COUNT).map(word => [word.id, word])).values()].slice(0, ROUND_COUNT);
      if (!words.length) {
        root.textContent = 'Chưa có từ vựng để nhận tín hiệu.';
        return;
      }
      index = score = decoded = byEar = 0;
      finished = false;
      frequency = -1;
      states = Array(words.length).fill('');
      get('result').hidden = true;
      status.hidden = false;
      nextWord();
    }

    get('form').addEventListener('submit', submit, options);
    input.addEventListener('compositionstart', () => { composing = true; }, options);
    input.addEventListener('compositionend', () => { composing = false; }, options);
    audio.addEventListener('click', listen, options);
    get('hint').addEventListener('click', () => showClue(false), options);
    knob.addEventListener('click', () => chooseFrequency((dial + 1) % frequencies.length), options);
    get('skip').addEventListener('click', () => reveal(false), options);
    get('next').addEventListener('click', advance, options);
    get('replay').addEventListener('click', () => {
      start();
      bandButtons[dial].focus({preventScroll: true});
    }, options);
    for (const [band, button] of bandButtons.entries()) {
      button.addEventListener('click', () => chooseFrequency(band), options);
    }
    window.speechSynthesis?.addEventListener('voiceschanged', () => {
      audio.disabled = !ctx.voiceAvailable?.();
    }, options);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) stopSpeech();
    }, options);
    start();

    return () => {
      listeners.abort();
      stopSpeech();
    };
  };
})();
