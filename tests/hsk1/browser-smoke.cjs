const assert = require('node:assert/strict');
const { readFile } = require('node:fs/promises');
const { chromium, devices, webkit } = require(process.env.HSK_PLAYWRIGHT_MODULE || 'playwright');

const url = new URL(process.argv[2] || 'http://127.0.0.1:8975/learning/hsk1');
const useWebKit = process.env.HSK_BROWSER === 'webkit';
const action = (page, name, filter = '') => page.locator(`[data-action="${name}"]${filter}`);

async function snapshot(page) {
  return page.evaluate(() => {
    const { KEY, W, S } = window.HSK_ENGINE;
    const state = JSON.parse(localStorage.getItem(KEY));
    const task = state?.active?.queue[state.active.index];
    return { state, task, word: W[task?.wordId], sentence: S[task?.sentenceId] };
  });
}

async function answerTask(page, context, correct) {
  const { task, word, sentence } = context;
  switch (task.type) {
    case 'meaning':
    case 'hanzi':
    case 'tone':
    case 'cloze':
    case 'passage':
    case 'dialogue': {
      const answers = {
        meaning: word?.vi, hanzi: word?.hanzi, tone: word?.pinyin, cloze: word?.hanzi,
        passage: sentence?.vi, dialogue: sentence?.hanzi,
      };
      const expected = answers[task.type];
      const option = task.options.findIndex((entry) => correct ? entry === expected : entry !== expected);
      assert.ok(option >= 0, task.type);
      await action(page, `answer-${task.type}`).nth(option).click();
      break;
    }
    case 'reading':
      await page.locator('#reading-answer').fill(correct ? word.pinyin : 'sha');
      await page.locator('#reading-form button[type="submit"]').click();
      break;
    case 'build': {
      const tiles = task.tiles.map((tile, index) => ({ ...tile, original: index }));
      const sequence = sentence.tokens.map((token) => {
        const index = tiles.findIndex((tile) => tile.text === token);
        assert.ok(index >= 0, token);
        return tiles.splice(index, 1)[0].original;
      });
      if (!correct) sequence.reverse();
      for (const index of sequence) await action(page, 'choose-tile', `[data-index="${index}"]`).click();
      await action(page, 'submit-build').click();
      break;
    }
    default:
      throw Error(`Chưa hỗ trợ kiểm thử ${task.type}`);
  }
  const feedback = task.gate
    ? `.adventure-gate.${correct ? 'is-open' : 'is-missed'}`
    : `.feedback-screen.${correct ? 'good' : 'retry'}`;
  await page.locator(feedback).waitFor();
}

async function checkBoard(page, scene) {
  const board = page.locator(`.adventure-board[data-scene="${scene}"]`);
  await board.waitFor();
  assert.match(await board.evaluate((element) => getComputedStyle(element).backgroundImage), new RegExp(`${scene}\\.webp`));
  assert.ok(await board.evaluate((element) => {
    const map = element.getBoundingClientRect();
    const spots = [...element.querySelectorAll('.adventure-spot')];
    return document.documentElement.scrollWidth <= window.innerWidth &&
      spots.every((spot) => {
        const rect = spot.getBoundingClientRect();
        return rect.width >= 44 && rect.height >= 44 && rect.left >= map.left && rect.right <= map.right;
      });
  }));
}

async function explore(page, wordIds) {
  const spot = (id) => action(page, 'trail-spot', `[data-id="${id}"]`);
  for (const id of wordIds) await spot(id).locator('.adventure-spot-name').click();
  await action(page, 'trail-recall').click();
  assert.equal(await page.locator('.adventure-board[data-phase="recall"] .adventure-spot-icon')
    .evaluateAll((icons) => icons.every((icon) => icon.textContent === '✦')), true);
}

async function relight(page, order) {
  for (const id of order) await action(page, 'trail-spot', `[data-id="${id}"]`).click();
  await page.locator('.adventure-board[data-phase="ready"]').waitFor();
  await action(page, 'trail-gate').click();
}

async function run() {
  const browser = useWebKit ? await webkit.launch() : await chromium.launch({
    channel: process.env.HSK_CHROMIUM_CHANNEL || 'chrome',
  });
  let context;
  try {
    context = await browser.newContext({ ...devices['iPhone 13'], defaultBrowserType: undefined, acceptDownloads: true });
    let page = await context.newPage();
    context.setDefaultTimeout(8000);
    const errors = [];
    const failed = [];
    const observe = (tab) => {
      tab.on('pageerror', (error) => errors.push(error.message));
      tab.on('console', (message) => {
        if (message.type() === 'error') errors.push(message.text());
      });
      tab.on('response', (response) => {
        if (response.status() >= 400 && new URL(response.url()).origin === url.origin) failed.push(response.url());
      });
    };
    observe(page);
    const response = await page.goto(url.href);
    assert.ok(response.ok());
    assert.ok(new URL(page.url()).pathname.endsWith('/learning/hsk1/'));
    await page.locator('.hero h1').waitFor();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
    assert.equal(await page.evaluate(() => getComputedStyle(document.documentElement).colorScheme), 'dark');
    await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));

    await action(page, 'nav', '[data-view="map"]').first().click();
    await action(page, 'start-mission', '[data-id="m001"]').click();
    await action(page, 'begin-quest').click();
    await checkBoard(page, 'school');
    const { task: firstTrail } = await snapshot(page);
    assert.equal(firstTrail.type, 'trail');
    await explore(page, firstTrail.wordIds);
    const wrongId = firstTrail.wordIds.find((id) => id !== firstTrail.order[0]);
    await action(page, 'trail-spot', `[data-id="${wrongId}"]`).click();
    assert.equal(await page.locator('.adventure-spot.is-lit').count(), 0);
    await action(page, 'trail-hint').click();
    assert.equal(await page.locator('.adventure-spot.is-current').getAttribute('data-id'), firstTrail.order[0]);
    const beforeClose = (await snapshot(page)).state.active;

    await page.close();
    page = await context.newPage();
    observe(page);
    await page.goto(url.href);
    await action(page, 'resume').click();
    assert.equal(await page.locator('.adventure-spot.is-current').getAttribute('data-id'), beforeClose.queue[0].order[0]);
    await relight(page, firstTrail.order);
    const firstGate = await snapshot(page);
    assert.equal(firstGate.task.sentenceId, 'bs02');
    await answerTask(page, firstGate, false);
    assert.equal((await snapshot(page)).state.completed.length, 0);
    await action(page, 'next-task').click();
    await page.locator('#gate-hint').waitFor();
    await answerTask(page, await snapshot(page), true);
    await action(page, 'next-task').click();

    for (let stage = 2; stage <= 6; stage += 1) {
      await action(page, 'begin-next').first().click();
      await action(page, 'begin-quest').click();
      await checkBoard(page, stage <= 4 ? 'school' : 'market');
      const { task } = await snapshot(page);
      await explore(page, task.wordIds);
      await relight(page, task.order);
      await answerTask(page, await snapshot(page), true);
      if (stage === 6) await page.getByText('我叫小语。', { exact: true }).waitFor();
      await action(page, 'next-task').click();
    }
    assert.equal((await snapshot(page)).state.completed.length, 6);

    await action(page, 'nav', '[data-view="review"]').first().click();
    await action(page, 'review-skill', '[data-id="reading"]').click();
    await action(page, 'review-count', '[data-count="5"]').click();
    await action(page, 'start-review').click();
    const reviewing = await snapshot(page);
    assert.equal(reviewing.state.active.mode, 'review');
    assert.ok(reviewing.state.active.queue.length <= 5);
    assert.ok(reviewing.state.active.queue.every((entry) => entry.type === 'reading'));
    await answerTask(page, reviewing, true);
    await action(page, 'next-task').click();
    await action(page, 'quit').first().click();

    await action(page, 'nav', '[data-view="words"]').first().click();
    for (const search of ['名字', 'míngzi', 'tên']) {
      await page.locator('#word-search').fill(search);
      await page.locator('.word-row').filter({ hasText: '名字' }).waitFor();
    }
    await action(page, 'nav', '[data-view="settings"]').click();
    const downloadTask = page.waitForEvent('download');
    await action(page, 'export').click();
    const download = await downloadTask;
    const backup = await readFile(await download.path());
    assert.equal(JSON.parse(backup).completed.length, 6);

    page.once('dialog', (dialog) => dialog.accept());
    await action(page, 'reset').click();
    await page.locator('.hero h1').waitFor();
    assert.equal((await snapshot(page)).state.completed.length, 0);
    await action(page, 'nav', '[data-view="settings"]').click();
    page.once('dialog', (dialog) => dialog.accept());
    await page.locator('#import-file').setInputFiles({ name: 'hsk1.json', mimeType: 'application/json', buffer: backup });
    await page.waitForFunction(() => {
      const { KEY } = window.HSK_ENGINE;
      return JSON.parse(localStorage.getItem(KEY)).completed.length === 6;
    });

    await context.setOffline(true);
    await page.reload();
    await page.locator('.hero h1').waitFor();
    for (const scene of ['school', 'market', 'river']) {
      assert.ok(await page.evaluate(async (name) => (await fetch(`./art/${name}.webp`)).ok, scene));
    }
    await action(page, 'nav', '[data-view="words"]').first().click();
    await page.locator('#word-search').fill('名字');
    await page.locator('.word-row').filter({ hasText: '名字' }).waitFor();
    assert.equal((await snapshot(page)).state.completed.length, 6);
    assert.deepEqual(failed, []);
    assert.deepEqual(errors, []);
    console.log(`Đạt kiểm thử trên ${useWebKit ? 'Playwright WebKit' : 'Chromium'} với kích thước iPhone 13.`);
  } finally {
    if (context) await context.close();
    await browser.close();
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
