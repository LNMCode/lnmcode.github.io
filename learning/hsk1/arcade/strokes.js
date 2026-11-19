(() => {
  'use strict';

  const games = window.HSK_MINIGAMES ||= {};
  const ROUND_SIZE = 3;
  const SAMPLE_COUNT = 18;
  const svgNamespace = 'http://www.w3.org/2000/svg';
  const esc = value => String(value).replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char]);

  const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

  function cumulativeDistances(points) {
    const lengths = [0];
    for (let index = 1; index < points.length; index += 1) {
      lengths.push(lengths[index - 1] + distance(points[index - 1], points[index]));
    }
    return lengths;
  }

  function evenlySpaced(points, distances) {
    const step = distances.at(-1) / (SAMPLE_COUNT - 1);
    const samples = [points[0]];
    let segment = 1;
    for (let index = 1; index < SAMPLE_COUNT - 1; index += 1) {
      const target = index * step;
      while (distances[segment] < target) segment += 1;
      const portion = (target - distances[segment - 1]) / (distances[segment] - distances[segment - 1]);
      const before = points[segment - 1];
      const after = points[segment];
      samples.push(before.map((coordinate, axis) => coordinate + portion * (after[axis] - coordinate)));
    }
    samples.push(points.at(-1));
    return samples;
  }

  function matchStroke(input, expected) {
    if (input.length < 2) return 'short';
    const candidateDistances = cumulativeDistances(input);
    const expectedDistances = cumulativeDistances(expected);
    const expectedLength = expectedDistances.at(-1);
    const drawnLength = candidateDistances.at(-1);
    if (drawnLength < Math.max(24, expectedLength * 0.45)) return 'short';
    if (drawnLength > expectedLength * 2) return 'shape';

    // Comparing normalized arc length preserves bends and the forward order of a stroke.
    const start = input[0];
    const end = input.at(-1);
    const expectedStart = expected[0];
    const expectedEnd = expected.at(-1);
    const tolerance = Math.max(58, Math.min(110, expectedLength * 0.25));
    const forward = distance(start, expectedStart) + distance(end, expectedEnd);
    const reverse = distance(start, expectedEnd) + distance(end, expectedStart);
    if (reverse + 22 < forward) return 'direction';
    if (distance(start, expectedStart) > tolerance) return 'start';
    if (distance(end, expectedEnd) > tolerance * 1.2) return 'shape';

    const drawn = evenlySpaced(input, candidateDistances);
    const guide = evenlySpaced(expected, expectedDistances);
    const errors = drawn.map((point, index) => distance(point, guide[index]));
    const averageError = errors.reduce((sum, error) => sum + error, 0) / SAMPLE_COUNT;
    return averageError <= tolerance * 0.78 && errors.every(error => error < tolerance * 1.6) ? 'good' : 'shape';
  }
  const strokeMessages = {
    short: 'Nét còn ngắn. Hãy kéo từ đầu đến cuối nét.',
    direction: 'Bạn đang đi ngược chiều nét. Hãy thử theo chiều từ điểm bắt đầu.',
    start: 'Hãy thử lại từ điểm bắt đầu của nét này.',
    shape: 'Nét chưa đi hết theo mẫu. Hãy giữ đúng đường khi đổi hướng.'
  };

  function fitPoint(svg, event) {
    const bounds = svg.getBoundingClientRect();
    return [
      Math.max(0, Math.min(1024, (event.clientX - bounds.left) / bounds.width * 1024)),
      Math.max(0, Math.min(1024, (event.clientY - bounds.top) / bounds.height * 1024))
    ];
  }

  function pointList(points) {
    return points.map(([x, y]) => x + ',' + y).join(' ');
  }

  function boardMarkup(glyph, stroke, showModel, drawing, burst) {
    const model = glyph.medians[stroke];
    const start = showModel && drawing && model ? model[0] : null;
    const ended = !drawing;
    const history = glyph.outlines.slice(0, stroke).map(path => `<path d="${esc(path)}"></path>`).join('');
    const outline = showModel && !ended ? glyph.outlines.map(path => `<path d="${esc(path)}"></path>`).join('') : '';
    return `<div class="ink-desk" data-arena-surface>
      <div class="ink-charge" role="meter" aria-label="Mức khắc dấu" aria-valuemin="0" aria-valuemax="${glyph.medians.length}" aria-valuenow="${stroke}" style="--charge:${stroke / glyph.medians.length}">
        <span class="ink-charge-track" aria-hidden="true"><i></i></span>
        <span class="ink-charge-seal" aria-hidden="true"><i data-arena-model="seal"></i><b>印</b></span>
      </div>
      <div class="ink-paper${burst ? ' ink-paper--sealed' : ''}"><svg class="ink-board${burst ? ' ink-board--sealed' : ''}" data-stroke-board data-stroke-count="${stroke}"
      viewBox="0 0 1024 1024" role="img" aria-label="Ô viết chữ Hán, kéo một nét từ đầu tới cuối"
      preserveAspectRatio="none" focusable="false">
      <path class="ink-grid" d="M0 512H1024M512 0V1024M0 0L1024 1024M1024 0L0 1024"></path>
      <g class="ink-outline" transform="translate(0 900) scale(1 -1)">${outline}</g>
      <g class="ink-history" transform="translate(0 900) scale(1 -1)">${history}</g>
      ${start ? `<polyline class="ink-guide" points="${pointList(model)}"></polyline>
        <circle class="ink-start-ring" cx="${start[0]}" cy="${start[1]}" r="35"></circle>
        <circle class="ink-start-dot" cx="${start[0]}" cy="${start[1]}" r="21"></circle>` : ''}
      </svg>${burst ? '<span class="ink-stamped" aria-hidden="true">印</span>' : ''}</div>
      <span class="ink-brush" aria-hidden="true"></span></div>`;
  }

  games.strokes = function mount(root, ctx) {
    const data = window.HSK_STROKE_DATA;
    const chooseWords = () => ctx.words(300).filter(word => data && Object.hasOwn(data, word.hanzi)).slice(0, ROUND_SIZE);
    let selected = chooseWords();
    if (selected.length === 0) {
      root.innerHTML = '<p>Dữ liệu nét chữ chưa sẵn sàng.</p>';
      return () => {};
    }

    let position = 0;
    let phase = 'intro';
    let stroke = 0;
    let mistakes = 0;
    let totalScore = 0;
    let results = [];
    let note = '';
    let pointer = null;
    let showingHint = false;
    let hadHint = false;
    let effect = false;
    let demoFrame = 0;
    let demoActive = false;
    const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
    const still = () => ctx.lowMotion || reduceMotion.matches;

    function focusHeading() {
      root.querySelector('[data-stroke-title]')?.focus({ preventScroll: true });
    }

    function render() {
      const word = selected[position];
      const record = data[word.hanzi];
      const isDrawing = phase === 'guide' || phase === 'recall';
      const revealCharacter = phase !== 'recall';
      const title = phase === 'intro' ? 'Khắc ba dấu chữ'
        : phase === 'guide' ? 'Theo dòng mực'
        : phase === 'recall' ? 'Viết từ trí nhớ'
        : phase === 'finished' ? 'Đã khắc đủ dấu' : 'Ấn chữ đã sáng';
      const status = note || (phase === 'guide' ? 'Đặt tay lên điểm sáng rồi kéo theo vệt mực.'
        : phase === 'recall' ? 'Nhớ hình dạng và thứ tự nét rồi tự viết vào ô.'
        : 'Bạn có thể thử viết lại từ nghĩa và âm của chữ.');
      const seals = selected.map((item, index) => {
        const completed = results[index];
        return `<span class="ink-seal${completed ? ' ink-seal--lit' : ''}${position === index && !completed ? ' ink-seal--active' : ''}" aria-label="${completed ? esc(item.hanzi) : `Ô dấu ${index + 1}`}">${completed ? `<span lang="zh-Hans">${esc(item.hanzi)}</span>` : '◆'}</span>`;
      }).join('');
      const actions = phase === 'ready'
        ? '<button type="button" class="btn primary" data-stroke-action="recall">Viết từ trí nhớ</button><button type="button" class="btn button-soft" data-stroke-action="next" data-stroke-next>Nhận dấu</button>'
        : phase === 'done'
          ? '<button type="button" class="btn primary" data-stroke-action="next" data-stroke-next>Nhận dấu</button>'
          : phase === 'recall'
            ? '<button type="button" class="btn button-soft" data-stroke-action="hint">Xem gợi ý nét</button><button type="button" class="btn button-text" data-stroke-action="next" data-stroke-next>Bỏ qua lượt nhớ</button>'
            : '<button type="button" class="btn button-soft" data-stroke-action="restart">Viết lại từ đầu</button>';
      const demo = isDrawing ? '<button type="button" class="btn button-text" data-stroke-action="demo">Xem nét chạy mẫu</button>' : '';

      root.innerHTML = `<section class="ink-game${ctx.lowMotion ? ' ink-game--still' : ''}" aria-labelledby="ink-game-title">
        <header class="ink-header"><div class="ink-title">
          <p class="ink-type">Viết chữ Hán</p>
          <h2 id="ink-game-title" data-stroke-title tabindex="-1">${title}</h2>
        </div><div class="ink-seals" aria-label="Các dấu đã khắc">${seals}</div></header>
        ${phase === 'intro' ? `<p class="ink-intro">Kéo từng nét đúng thứ tự để khắc ${selected.length} dấu chữ. Sau khi thấy mẫu, thử tự viết lại từ nghĩa và Pinyin.</p>
          <div class="ink-cover" aria-hidden="true"><i></i>${selected.map(item => `<span lang="zh-Hans">${esc(item.hanzi)}</span>`).join('')}</div>
          <button type="button" class="btn primary full" data-stroke-action="start" data-stroke-start>Bắt đầu viết</button>
          <p class="ink-attribution">Bộ 30 chữ HSK 1 dùng dữ liệu từ Make Me a Hanzi và Hanzi Writer Data. <a href="./arcade/ARPHICPL.TXT" target="_blank" rel="noopener">Giấy phép Arphic</a>.</p>`
          : phase === 'finished' ? `<div class="ink-cover ink-cover--reward"><i aria-hidden="true"></i>${selected.map(item => `<span lang="zh-Hans">${esc(item.hanzi)}</span>`).join('')}</div>
          <p class="ink-score"><strong>${totalScore}</strong> điểm</p>
          <div class="ink-controls"><button type="button" class="btn primary" data-stroke-action="replay" data-stroke-replay>Chơi lại</button>
          <button type="button" class="btn button-soft" data-stroke-action="exit">Về sân chơi</button></div>`
          : `<div class="ink-word">${revealCharacter ? `<strong lang="zh-Hans">${esc(word.hanzi)}</strong>` : ''}<div><b>${esc(word.pinyin)}</b><span>${esc(word.vi)}</span></div>${isDrawing ? `<small>Nét ${stroke + 1}/${record.medians.length}</small>` : ''}</div>
          ${boardMarkup(record, stroke, phase === 'guide' || showingHint, isDrawing, effect)}
          <p class="ink-feedback${note && isDrawing ? ' ink-feedback--retry' : ''}" role="status">${esc(status)}</p>
          <div class="ink-controls">${actions}${demo}</div>`}
      </section>`;
    }

    function finishCharacter() {
      effect = true;
      if (phase === 'guide') {
        phase = 'ready';
        return;
      }
      phase = 'done';
      if (!hadHint) ctx.grade(wordId(), 'hanzi', mistakes === 0 ? 'good' : 'almost');
      note = hadHint ? 'Bạn đã viết xong. Thử lại không cần gợi ý ở lượt sau.' : 'Dấu đã khắc từ trí nhớ.';
    }

    function wordId() {
      return selected[position].id;
    }

    function advance() {
      const fromMemory = phase === 'done' && !hadHint;
      results.push(true);
      totalScore += fromMemory && mistakes === 0 ? 140 : 80;
      if (position === selected.length - 1) {
        phase = 'finished';
        render();
        focusHeading();
        ctx.complete(totalScore);
        return;
      }
      position += 1;
      enterDrawing('guide');
    }

    function enterDrawing(next) {
      phase = next;
      stroke = 0;
      mistakes = 0;
      note = '';
      effect = false;
      showingHint = false;
      hadHint = false;
      render();
      focusHeading();
    }

    function click(event) {
      const action = event.target.closest('[data-stroke-action]')?.dataset.strokeAction;
      if (demoActive || pointer) return;
      if (action === 'demo' && ['guide', 'recall'].includes(phase)) {
        demonstrate();
        return;
      }
      if (action === 'start' && phase === 'intro') enterDrawing('guide');
      if (action === 'recall' && phase === 'ready') enterDrawing('recall');
      if (action === 'restart' && phase === 'guide') enterDrawing('guide');
      if (action === 'hint' && phase === 'recall') {
        showingHint = true;
        hadHint = true;
        note = 'Điểm sáng là nơi bắt đầu nét.';
        render();
        root.querySelector('[data-stroke-action="hint"]')?.focus({preventScroll:true});
      }
      if (action === 'next' && ['ready', 'done', 'recall'].includes(phase)) advance();
      if (action === 'replay' && phase === 'finished') {
        selected = chooseWords();
        position = 0;
        totalScore = 0;
        results = [];
        enterDrawing('guide');
      }
      if (action === 'exit' && phase === 'finished') ctx.exit();
    }

    function startStroke(event) {
      if (pointer || demoActive || !['guide', 'recall'].includes(phase) || (event.pointerType === 'mouse' && event.button !== 0)) return;
      const svg = event.target.closest('[data-stroke-board]');
      if (!svg) return;
      event.preventDefault();
      svg.setPointerCapture(event.pointerId);
      const point = fitPoint(svg, event);
      pointer = {...createMark(svg, point, event.pressure), id:event.pointerId};
    }

    function createMark(svg, point, pressure) {
      const ink = document.createElementNS(svgNamespace, 'polyline');
      ink.setAttribute('class', 'ink-paint');
      ink.setAttribute('points', pointList([point]));
      const nib = document.createElementNS(svgNamespace, 'g');
      nib.setAttribute('class', 'ink-live-nib');
      const glow = document.createElementNS(svgNamespace, 'circle');
      glow.setAttribute('class', 'ink-nib-glow');
      glow.setAttribute('r', '36');
      const head = document.createElementNS(svgNamespace, 'circle');
      head.setAttribute('class', 'ink-nib');
      nib.append(glow, head);
      placeNib(nib, point, pressure);
      svg.append(ink, nib);
      const glyph = data[selected[position].hanzi];
      const goal = cumulativeDistances(glyph.medians[stroke]).at(-1);
      return {svg, ink, nib, points:[point], travel:0, goal};
    }

    function placeNib(nib, [x, y], pressure) {
      nib.setAttribute('transform', `translate(${x} ${y})`);
      nib.lastElementChild.setAttribute('r', 11 + 13 * pressure);
    }

    function charge(mark) {
      const count = data[selected[position].hanzi].medians.length;
      const fraction = Math.min(.9, mark.travel / mark.goal);
      mark.svg.closest('.ink-desk').querySelector('.ink-charge').style.setProperty('--charge', (stroke + fraction) / count);
    }

    function extendMark(mark, point, pressure) {
      mark.travel += distance(mark.points.at(-1), point);
      mark.points.push(point);
      mark.ink.setAttribute('points', pointList(mark.points));
      placeNib(mark.nib, point, pressure);
      charge(mark);
    }

    function moveStroke(event) {
      if (event.pointerId !== pointer?.id) return;
      const point = fitPoint(pointer.svg, event);
      if (distance(pointer.points.at(-1), point) < 4 || pointer.points.length >= 512) return;
      extendMark(pointer, point, event.pressure);
    }

    function closePointer(event) {
      if (pointer?.id !== event.pointerId) return;
      const trace = pointer;
      pointer = null;
      if (trace.svg.hasPointerCapture(trace.id)) trace.svg.releasePointerCapture(trace.id);
      if (event.type !== 'pointerup') {
        trace.ink.remove();
        trace.nib.remove();
        trace.travel = 0;
        charge(trace);
        return;
      }

      const last = fitPoint(trace.svg, event);
      if (distance(trace.points.at(-1), last) >= 1) trace.points.push(last);
      resolveTrace(trace.points, last);
    }

    function resolveTrace(points, last, fromDemo = false) {
      const glyph = data[selected[position].hanzi];
      const outcome = matchStroke(points, glyph.medians[stroke]);
      if (outcome !== 'good') {
        mistakes += 1;
        note = strokeMessages[outcome];
      } else {
        stroke += 1;
        showingHint = false;
        note = '';
        if (stroke === glyph.medians.length) finishCharacter();
      }
      render();
      const board = root.querySelector('[data-stroke-board]');
      if (outcome === 'good') {
        board.classList.add('ink-board--wet');
        if (!still()) absorbInk(board, last);
      } else {
        board.classList.add('ink-board--miss');
      }
      if (fromDemo) {
        root.querySelector('[data-stroke-action="demo"], [data-stroke-action="recall"], [data-stroke-next]')?.focus({preventScroll:true});
      }
    }

    function absorbInk(board, last) {
      const paper = board.getBoundingClientRect();
      const desk = board.closest('.ink-desk');
      const bounds = desk.getBoundingClientRect();
      const seal = desk.querySelector('.ink-charge-seal').getBoundingClientRect();
      const spark = document.createElement('i');
      spark.className = 'ink-flying';
      spark.style.left = `${(paper.left - bounds.left) + last[0] / 1024 * paper.width}px`;
      spark.style.top = `${(paper.top - bounds.top) + last[1] / 1024 * paper.height}px`;
      const dx = seal.left + seal.width / 2 - (paper.left + last[0] / 1024 * paper.width);
      const dy = seal.top + seal.height / 2 - (paper.top + last[1] / 1024 * paper.height);
      desk.append(spark);
      if (!spark.animate) { spark.remove(); return; }
      spark.animate([
        {transform:'translate(-50%, -50%) scale(.7)', opacity:1},
        {transform:`translate(${dx * .5}px, ${dy * .65}px) scale(1)`, opacity:1, offset:.45},
        {transform:`translate(${dx}px, ${dy}px) scale(.3)`, opacity:0},
      ], {duration:470, easing:'cubic-bezier(.32,.64,.52,1)'}).onfinish = () => spark.remove();
    }

    function demonstrate() {
      const board = root.querySelector('[data-stroke-board]');
      const model = data[selected[position].hanzi].medians[stroke];
      const last = model.at(-1);
      if (phase === 'recall') hadHint = true;
      if (still()) {
        resolveTrace(model, last, true);
        return;
      }
      const mark = createMark(board, model[0], .5);
      const distances = cumulativeDistances(model);
      const length = distances.at(-1);
      demoActive = true;
      const start = performance.now();
      let sample = 1;
      function trace(now) {
        const progress = Math.min(1, (now - start) / Math.min(950, 440 + length * .55));
        const traveled = progress * length;
        while (sample < model.length - 1 && distances[sample] < traveled) {
          extendMark(mark, model[sample], .5);
          sample += 1;
        }
        const span = distances[sample] - distances[sample - 1];
        const fraction = span ? (traveled - distances[sample - 1]) / span : 1;
        const point = model[sample - 1].map((value, axis) => value + fraction * (model[sample][axis] - value));
        mark.ink.setAttribute('points', pointList([...mark.points, point]));
        placeNib(mark.nib, point, .5);
        if (progress === 1) {
          demoActive = false;
          resolveTrace(model, last, true);
        } else demoFrame = requestAnimationFrame(trace);
      }
      demoFrame = requestAnimationFrame(trace);
    }

    root.addEventListener('click', click);
    root.addEventListener('pointerdown', startStroke);
    root.addEventListener('pointermove', moveStroke);
    root.addEventListener('pointerup', closePointer);
    root.addEventListener('pointercancel', closePointer);
    root.addEventListener('lostpointercapture', closePointer);
    render();

    return () => {
      cancelAnimationFrame(demoFrame);
      root.removeEventListener('click', click);
      root.removeEventListener('pointerdown', startStroke);
      root.removeEventListener('pointermove', moveStroke);
      root.removeEventListener('pointerup', closePointer);
      root.removeEventListener('pointercancel', closePointer);
      root.removeEventListener('lostpointercapture', closePointer);
      if (pointer?.svg.hasPointerCapture(pointer.id)) pointer.svg.releasePointerCapture(pointer.id);
      pointer = null;
    };
  };
})();
