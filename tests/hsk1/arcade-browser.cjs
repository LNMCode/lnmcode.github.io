const assert = require('node:assert/strict');
const { chromium, devices } = require(process.env.HSK_PLAYWRIGHT_MODULE || 'playwright');
const url = process.argv[2] || 'http://127.0.0.1:8975/learning/hsk1/';

const currentTarget = page => page.locator('[data-falling-target][data-word-id]:visible').first();

async function falling(page, game) {
  await page.locator('[data-falling-start="calm"]').click();
  const input = page.locator('[data-falling-entry]');
  const replay = page.locator('[data-falling-replay]');
  const pause = page.locator('[data-falling-pause]');
  if (await pause.isVisible()) {
    await pause.click();
    await page.locator('[data-falling-resume]').click();
  }
  const solved = new Set();
  while (solved.size < 8) {
    const target = currentTarget(page);
    await target.waitFor();
    const id = await target.getAttribute('data-word-id');
    assert.ok(!solved.has(id), 'A cleared target stayed in the board.');
    if (game === 'wind') {
      await page.locator(`[data-falling-option][data-word-id="${id}"]`).click();
    } else {
      const reading = await page.evaluate(id => window.HSK_ENGINE.W[id].pinyin, id);
      await input.fill(reading);
      await input.press('Enter');
    }
    solved.add(id);
    await page.locator(`[data-falling-target][data-word-id="${id}"]`).waitFor({state:'hidden'});
  }
  await replay.waitFor();
}

async function movingTarget(page, webgl) {
  await page.locator('[data-falling-start="timed"]').click();
  const board = page.locator('[data-falling-board]');
  const marker = board.locator('[data-falling-target] [data-arena-model]').first();
  await marker.waitFor();
  if (webgl) await page.locator('#hsk-cinema[data-arena-visual="3d"]').waitFor({state:'attached'});
  const before = await marker.boundingBox();
  await page.waitForFunction(y => {
    const model = document.querySelector('[data-falling-target] [data-arena-model]');
    return model && model.getBoundingClientRect().y > y + 4;
  }, before.y);
  await page.locator('[data-falling-pause]').click();
  await board.locator('[data-falling-target]').first().waitFor({state:'attached'});
  const resting = await marker.boundingBox();
  await new Promise(resolve => setTimeout(resolve, 210));
  assert.ok(Math.abs((await marker.boundingBox()).y - resting.y) < 2, 'Target moved while paused.');
}

async function writeStroke(page, points) {
  const board = page.locator('[data-stroke-board]');
  await board.scrollIntoViewIfNeeded();
  const bounds = await board.boundingBox();
  const onBoard = ([x, y]) => [bounds.x + bounds.width * x / 1024, bounds.y + bounds.height * y / 1024];
  await page.mouse.move(...onBoard(points[0]));
  await page.mouse.down();
  for (const point of points.slice(1)) await page.mouse.move(...onBoard(point), { steps: 3 });
  await page.mouse.up();
}

async function strokes(page) {
  await page.locator('[data-stroke-start]').click();
  const board = page.locator('[data-stroke-board]');
  const medians = async () => {
    const glyph = await page.locator('.ink-word strong').textContent();
    return page.evaluate(char => window.HSK_STROKE_DATA[char].medians, glyph);
  };
  const first = await medians();
  await writeStroke(page, [...first[0]].reverse());
  assert.equal(await board.getAttribute('data-stroke-count'), '0');
  for (let index = 0; index < 3; index++) {
    const paths = await medians();
    for (const path of paths) await writeStroke(page, path);
    if (index === 0) {
      await page.locator('[data-stroke-action="recall"]').click();
      assert.equal(await page.locator('.ink-word strong').count(), 0);
      for (const path of paths) await writeStroke(page, path);
    }
    await page.locator('[data-stroke-next]').click();
  }
  await page.locator('[data-stroke-replay]').waitFor();
}

async function pairs(page) {
  const cards = page.locator('[data-pairs-card]');
  const count = await cards.count();
  assert.equal(count, 8);
  assert.ok((await cards.first().locator('.pair-card-value').textContent()).trim());
  const matches = await cards.evaluateAll(nodes => nodes
    .filter(node => node.dataset.side === 'hanzi')
    .map(node => {
      const text = node.querySelector('.pair-card-value').textContent.trim();
      const word = window.HSK_ENGINE.D.words.find(word => word.hanzi === text);
      const opposite = nodes.find(other => other.dataset.side !== 'hanzi' &&
        other.querySelector('.pair-card-value').textContent.trim() === word?.vi);
      return [node.dataset.pairsCard, opposite?.dataset.pairsCard];
    }));
  assert.equal(matches.length, 4);
  const byIndex = index => page.locator(`[data-pairs-card="${index}"]`);
  for (const [chinese, vietnamese] of matches) {
    assert.ok(vietnamese !== undefined);
    await byIndex(chinese).click();
    await byIndex(vietnamese).click();
    await page.locator(`[data-pairs-card="${chinese}"].is-paired`).waitFor({state:'attached'});
  }
  await page.locator('[data-pairs-replay]').waitFor();
}

async function flow(page) {
  for (let round = 0; round < 4; round++) {
    const hint = page.locator('[data-flow-hint]');
    const slots = await page.locator('[data-flow-slot]').count();
    assert.ok(slots >= 2);
    if (round === 0) {
      await hint.click();
      const clue = (await page.locator('[data-flow-status]').textContent()).match(/là (.+)\.$/)?.[1];
      assert.ok(clue);
      const tiles = page.locator('[data-flow-tile]:enabled');
      const wrong = tiles.nth((await tiles.allTextContents()).findIndex(label => label.trim() !== clue));
      await wrong.click();
      for (let i = 1; i < slots; i++) await tiles.first().click();
      await page.locator('[data-flow-send]').click();
      await page.locator('[data-flow-slot][data-wrong]').waitFor();
      await page.locator('[data-flow-repair]').click();
      assert.equal(await page.locator('[data-flow-slot][data-filled]').count(), 0);
    }
    for (let i = 0; i < slots; i++) {
      await hint.click();
      const status = await page.locator('[data-flow-status]').textContent();
      const tile = status.match(/là (.+)\.$/)?.[1];
      assert.ok(tile, status);
      await page.getByRole('button', {name:`Lắp mảnh ${tile}`, exact:true}).and(page.locator(':enabled')).first().click();
      assert.equal(await page.locator('[data-flow-slot][data-filled]').count(), i + 1);
    }
    await page.locator('[data-flow-send]').click();
    const finish = round === 3 ? '[data-flow-replay]' : '[data-flow-next]';
    await page.locator(finish).waitFor();
    if (round < 3) await page.locator(finish).click();
  }
}

async function riddle(page) {
  const roundLabel = await page.locator('[data-riddle-round]').textContent();
  const rounds = Number(roundLabel.split('/')[1]);
  assert.ok(rounds >= 3);
  for (let round = 0; round < rounds; round++) {
    const meaning = await page.locator('[data-riddle-meaning]').textContent();
    const input = page.locator('[data-riddle-input]');
    const reading = await page.evaluate(meaning =>
      window.HSK_ENGINE.D.words.find(word => word.vi === meaning)?.pinyin, meaning);
    assert.ok(reading, meaning);
    if (round === 0) {
      const count = Number((await page.locator('[data-riddle-count]').textContent()).split(' ')[0]);
      await input.fill('x'.repeat(count));
      await input.press('Enter');
      assert.equal(await page.locator('[data-riddle-guess]').count(), 1);
    }
    await input.fill(reading);
    await input.press('Enter');
    await page.locator('[data-riddle-result]').waitFor();
    if (round < rounds - 1) await page.locator('[data-riddle-next]').click();
  }
  await page.locator('[data-riddle-replay]').waitFor();
}

async function lights(page) {
  await page.locator('[data-lights-calm]').click();
  const board = page.locator('[data-lights-lake]');
  for (let round = 0; round < 8; round++) {
    const clue = await page.locator('[data-lights-clue]').textContent();
    const ids = await board.locator('[data-lights-word]').evaluateAll(nodes => nodes.map(node => node.dataset.lightsWord));
    const id = await page.evaluate(({ids,clue}) =>
      ids.find(id => window.HSK_ENGINE.W[id].vi === clue), {ids,clue});
    assert.ok(id, clue);
    if (round === 0) {
      await board.locator(`[data-lights-word="${ids.find(value => value !== id)}"]`).click();
      await board.locator('.is-popped').waitFor({state:'attached'});
    }
    await board.locator(`[data-lights-word="${id}"]`).click();
    if (round < 7) await page.locator('[data-lights-next]').click();
  }
  await page.locator('[data-lights-replay]').waitFor();
}

async function checkDoubleTap(page, context) {
  assert.equal(await page.locator('#app').evaluate(el => getComputedStyle(el).touchAction), 'manipulation');
  assert.equal(await page.locator('[data-action="begin-next"]').evaluate(el => getComputedStyle(el).touchAction),
    'manipulation');
  const heading = await page.locator('.hero h1').boundingBox();
  const point = {x:heading.x + heading.width / 2, y:heading.y + heading.height / 2};
  const cdp = await context.newCDPSession(page);
  const initial = await page.evaluate(() => visualViewport.scale);
  try {
    for (let tap = 0; tap < 2; tap++) {
      await cdp.send('Input.dispatchTouchEvent', {type:'touchStart', touchPoints:[point]});
      await cdp.send('Input.dispatchTouchEvent', {type:'touchEnd', touchPoints:[]});
    }
    await new Promise(resolve => setTimeout(resolve, 400));
    const after = await page.evaluate(() => visualViewport.scale);
    assert.ok(Math.abs(after - initial) < 0.01, `Double tap changed zoom from ${initial} to ${after}`);
  } finally {
    await cdp.detach();
  }
}

async function run() {
  const browser = await chromium.launch({
    channel: process.env.HSK_CHROMIUM_CHANNEL || 'chrome',
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  });
  try {
    const context = await browser.newContext(devices['iPhone 13']);
    context.setDefaultTimeout(8000);
    await context.addInitScript(() => {
      if (window.speechSynthesis) Object.defineProperty(window.speechSynthesis, 'getVoices', {value: () => []});
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(url);
    await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
    const canvas = page.locator('#hsk-cinema');
    const webgl = await page.evaluate(() => Boolean(document.createElement('canvas').getContext('webgl2')));
    if (webgl) await page.locator('#hsk-cinema[data-visual="3d"][data-scene="home"]').waitFor({state:'attached'});
    await checkDoubleTap(page, context);
    await page.emulateMedia({reducedMotion:'reduce'});
    await page.locator('#hsk-cinema[data-visual="still"]').waitFor({state:'attached'});
    await page.emulateMedia({reducedMotion:'no-preference'});
    if (webgl) await page.locator('#hsk-cinema[data-visual="3d"]').waitFor({state:'attached'});
    const lobby = () => page.getByRole('button', { name: 'Sân chơi', exact: true }).click();
    const enter = game => page.locator(`[data-action="arcade-start"][data-id="${game}"]`).click();
    await page.getByRole('button', { name: 'Khám phá', exact: true }).click();
    const regions = page.locator('#map-region option');
    await page.locator('#map-region').selectOption(await regions.last().getAttribute('value'));
    assert.equal(await canvas.getAttribute('data-focus'), String(await regions.count() - 1));
    await lobby();
    assert.equal(await page.locator('.arcade-card').count(), 8);
    const station = page.locator('[data-action="arcade-preview"][data-id="flow"]');
    await station.click();
    assert.equal(await station.getAttribute('aria-pressed'), 'true');
    assert.equal(await canvas.getAttribute('data-focus'), '7');
    await page.locator('[data-feature-play]').click();
    await page.locator('[data-flow-send]').waitFor();
    assert.equal(await canvas.getAttribute('data-scene'), 'flow');
    if (webgl) await page.locator('[data-flow-arena][data-world="3d"]').waitFor();
    await lobby();
    if (process.env.HSK_ARCADE_SCREENSHOTS) {
      await page.locator('.arcade-lobby').screenshot({path: process.env.HSK_ARCADE_SCREENSHOTS + '/hsk1-san-choi.png'});
    }
    await enter('pinyin');
    await movingTarget(page, webgl);
    await lobby();
    for (const [name, play] of Object.entries({wind:falling, echo:falling, riddle, lights, pinyin:falling, strokes, pairs, flow})) {
      await enter(name);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
      assert.equal(await canvas.getAttribute('data-scene'), name);
      assert.equal(await page.locator('[data-cinema-cover]').count(), 0);
      await play(page, name);
      if (process.env.HSK_ARCADE_SCREENSHOTS) {
        await page.screenshot({path: process.env.HSK_ARCADE_SCREENSHOTS + '/hsk1-' + name + '.png'});
      }
      await lobby();
      assert.match(await page.locator(`.arcade-card-${name}`).innerText(), /Kỷ lục \d+/);
    }
    await context.setOffline(true);
    await page.reload();
    await lobby();
    for (const [name, selector] of Object.entries({
      wind:'[data-falling-start="calm"]', echo:'[data-falling-start="calm"]',
      pinyin:'[data-falling-start="calm"]', riddle:'[data-riddle-input]',
      lights:'[data-lights-calm]', flow:'[data-flow-tile]', strokes:'[data-stroke-start]', pairs:'[data-pairs-card]'
    })) {
      await enter(name);
      await page.locator(selector).first().waitFor();
      if (webgl && name === 'flow') await page.locator('[data-flow-arena][data-world="3d"]').waitFor();
      await lobby();
    }
    assert.deepEqual(errors, []);
    await context.close();

    const fallback = await browser.newContext({ ...devices['iPhone 13'], serviceWorkers:'block' });
    await fallback.addInitScript(() => {
      const original = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function(type, ...options) {
        if (type === 'webgl2') return null;
        return original.call(this, type, ...options);
      };
    });
    const fallbackPage = await fallback.newPage();
    await fallbackPage.goto(url);
    await fallbackPage.getByRole('button', {name:'Sân chơi', exact:true}).click();
    await fallbackPage.locator('[data-action="arcade-start"][data-id="pinyin"]').click();
    await fallbackPage.locator('#hsk-cinema[data-visual="2d"]').waitFor({state:'attached'});
    await fallbackPage.locator('[data-falling-start="calm"]').click();
    const target = currentTarget(fallbackPage);
    const id = await target.getAttribute('data-word-id');
    const reading = await fallbackPage.evaluate(wordId => window.HSK_ENGINE.W[wordId].pinyin, id);
    await fallbackPage.locator('[data-falling-entry]').fill(reading);
    await fallbackPage.locator('[data-falling-entry]').press('Enter');
    await fallbackPage.waitForFunction(() => Number(document.querySelector('[data-falling-score]').textContent) > 0);
    await fallback.close();
    console.log('Đạt kiểm thử Chromium cho tám trò, hiệu ứng 3D, giảm chuyển động, ngoại tuyến và chạm đôi.');
  } finally {
    await browser.close();
  }
}

run().catch(error => { console.error(error); process.exitCode = 1; });
