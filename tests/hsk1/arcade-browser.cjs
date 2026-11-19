const assert = require('node:assert/strict');
const { chromium, devices } = require(process.env.HSK_PLAYWRIGHT_MODULE || 'playwright');
const url = process.argv[2] || 'http://127.0.0.1:8975/learning/hsk1/';

async function pinyin(page) {
  const input = page.locator('[data-pinyin-input]');
  const paused = page.locator('[data-pinyin-pause]');
  await paused.click();
  assert.equal(await input.getAttribute('readonly'), '');
  await paused.click();
  await input.fill('xxx');
  await input.press('Enter');
  assert.equal(await page.locator('[data-pinyin-score]').textContent(), '0');
  for (let i = 0; i < 8; i++) {
    const target = page.locator('[data-pinyin-target][aria-pressed="true"]:enabled');
    const id = await target.getAttribute('data-pinyin-target');
    const reading = await page.evaluate(wordId => window.HSK_ENGINE.W[wordId].pinyin, id);
    await input.fill(reading);
    await input.press('Enter');
  }
  await page.locator('[data-pinyin-replay]').waitFor();
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
  const card = index => page.locator(`[data-pairs-card="${index}"]`);
  const count = await page.locator('[data-pairs-card]').count();
  assert.equal(count, 8);
  assert.equal(await card(0).locator('.pair-card-value').textContent(), '');
  for (let first = 0; first < count; first++) {
    if (await card(first).getAttribute('aria-disabled') === 'true') continue;
    for (let second = first + 1; second < count; second++) {
      if (await card(second).getAttribute('aria-disabled') === 'true') continue;
      await card(first).click();
      await card(second).click();
      if (await card(first).evaluate(element => element.classList.contains('is-paired'))) break;
      const dismiss = page.locator('[data-pairs-continue]');
      if (await dismiss.isVisible()) await dismiss.click();
    }
  }
  await page.locator('[data-pairs-replay]').waitFor();
}

async function flow(page) {
  for (let round = 0; round < 4; round++) {
    const hint = page.locator('[data-flow-hint]');
    const slots = await page.locator('[data-flow-slot]').count();
    assert.ok(slots >= 2);
    for (let i = 0; i < slots; i++) {
      await hint.click();
      const status = await page.locator('.flow-game [role="status"]').textContent();
      const tile = status.match(/là (.+)\.$/)?.[1];
      assert.ok(tile);
      const boat = page.getByRole('button', { name: `Vớt mảnh ${tile}`, exact: true }).first();
      for (let turn = 0; turn < slots && !(await boat.count()); turn++) {
        await page.locator('[data-flow-cycle]').click();
      }
      await boat.click();
    }
    await page.locator('[data-flow-send]').click();
    const finish = round === 3 ? '[data-flow-replay]' : '[data-flow-next]';
    await page.locator(finish).waitFor();
    if (round < 3) await page.locator(finish).click();
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
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(url);
    await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
    const lobby = () => page.getByRole('button', { name: 'Sân chơi', exact: true }).click();
    const enter = game => page.locator(`[data-action="arcade-start"][data-id="${game}"]`).click();
    await lobby();
    assert.equal(await page.locator('.arcade-card').count(), 4);
    if (process.env.HSK_ARCADE_SCREENSHOTS) {
      await page.locator('.arcade-lobby').screenshot({path: process.env.HSK_ARCADE_SCREENSHOTS + '/hsk1-san-choi.png'});
    }
    for (const [name, play] of Object.entries({pinyin, strokes, pairs, flow})) {
      await enter(name);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
      if (name === 'pinyin') {
        const webgl = await page.evaluate(() => Boolean(document.createElement('canvas').getContext('webgl2')));
        if (webgl) await page.locator('[data-pinyin-canvas][data-visual="3d"]').waitFor({state:'attached'});
        if (process.env.HSK_ARCADE_SCREENSHOTS) {
          await page.locator('.arcade-main').screenshot({path: process.env.HSK_ARCADE_SCREENSHOTS + '/hsk1-sao-pinyin.png'});
        }
      }
      await play(page);
      await lobby();
      assert.match(await page.locator(`.arcade-card-${name}`).innerText(), /Kỷ lục \d+/);
    }
    await context.setOffline(true);
    await page.reload();
    await lobby();
    await enter('pinyin');
    await page.locator('[data-pinyin-target]').first().waitFor();
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
    await fallbackPage.locator('[data-pinyin-canvas][data-visual="2d"]').waitFor({state:'attached'});
    const target = fallbackPage.locator('[data-pinyin-target][aria-pressed="true"]');
    const id = await target.getAttribute('data-pinyin-target');
    const reading = await fallbackPage.evaluate(wordId => window.HSK_ENGINE.W[wordId].pinyin, id);
    await fallbackPage.locator('[data-pinyin-input]').fill(reading);
    await fallbackPage.locator('[data-pinyin-launch]').click();
    await fallbackPage.waitForFunction(() => Number(document.querySelector('[data-pinyin-score]').textContent) > 0);
    await fallback.close();
    console.log('Đạt kiểm thử Chromium cho bốn mini game, kỷ lục, ngoại tuyến và chế độ 2D khi WebGL không khả dụng.');
  } finally {
    await browser.close();
  }
}

run().catch(error => { console.error(error); process.exitCode = 1; });
