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
  await page.locator(`.feedback-screen.${correct ? 'good' : 'retry'}`).waitFor();
}

async function run() {
  const browser = useWebKit ? await webkit.launch() : await chromium.launch({
    channel: process.env.HSK_CHROMIUM_CHANNEL || 'chrome',
  });
  let context;
  try {
    context = await browser.newContext({ ...devices['iPhone 13'], defaultBrowserType: undefined, acceptDownloads: true });
    let page = await context.newPage();
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
    await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));

    await action(page, 'nav', '[data-view="map"]').first().click();
    await action(page, 'start-mission', '[data-id="m001"]').click();
    await action(page, 'begin-quest').click();
    assert.equal(await page.locator('.visual-hanzi').textContent(), '你好');
    await action(page, 'next-learn').click();
    const firstQuestion = await snapshot(page);
    assert.equal(firstQuestion.state.entries[firstQuestion.task.wordId].seenCount, 1);
    await answerTask(page, firstQuestion, false);
    const afterWrong = await snapshot(page);
    assert.ok(afterWrong.state.active.queue.length > firstQuestion.state.active.queue.length);
    assert.ok(afterWrong.state.entries[firstQuestion.task.wordId].meaning.mistakes >= 1);

    await page.close();
    page = await context.newPage();
    observe(page);
    await page.goto(url.href);
    if (await action(page, 'resume').count()) await action(page, 'resume').click();
    const reopened = await snapshot(page);
    assert.equal(reopened.state.active.index, afterWrong.state.active.index);
    if (await action(page, 'next-task').count()) {
      await action(page, 'next-task').click();
    } else {
      await answerTask(page, reopened, true);
      await action(page, 'next-task').click();
    }

    const visited = new Set();
    let reachedSecondChapter = false;
    for (let step = 0; step < 180; step += 1) {
      const current = await snapshot(page);
      if (!current.task) {
        if (current.state.completed.includes('m006')) {
          reachedSecondChapter = true;
          break;
        }
        await action(page, 'begin-next').first().click();
        await action(page, 'begin-quest').click();
        continue;
      }
      visited.add(current.task.type);
      if (current.task.type === 'learn') await action(page, 'next-learn').click();
      else if (current.task.type === 'story') await action(page, 'next-story').click();
      else {
        await answerTask(page, current, true);
        await action(page, 'next-task').click();
      }
    }
    for (const type of ['reading', 'hanzi', 'tone', 'build', 'cloze', 'passage', 'dialogue']) {
      assert.ok(visited.has(type), type);
    }
    assert.ok(reachedSecondChapter, 'Chưa hoàn thành nhiệm vụ hỏi tên ở chương hai');

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
