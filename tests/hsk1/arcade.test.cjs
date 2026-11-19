const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const { appRoot, loadGame } = require('./helpers.cjs');

function loadArcadeParts() {
  const window = {};
  const context = vm.createContext({ window });
  for (const file of ['catalog.js', 'strokes-data.js', 'pinyin.js', 'strokes.js', 'pairs.js', 'flow.js']) {
    vm.runInContext(readFileSync(path.join(appRoot, 'arcade', file), 'utf8'), context, { filename: file });
  }
  return window;
}

test('bốn mini game đã đăng ký, ưu tiên từ đã gặp và có nội dung cho người mới', () => {
  const { engine } = loadGame();
  const { HSK_ARCADE, HSK_MINIGAMES } = loadArcadeParts();
  assert.deepEqual(Object.keys(HSK_MINIGAMES).sort(), Object.keys(HSK_ARCADE.games).sort());
  for (const mount of Object.values(HSK_MINIGAMES)) assert.equal(typeof mount, 'function');
  const state = engine.fresh();
  for (const word of engine.D.words.slice(220, 228)) engine.see(state, word.id);
  const words = HSK_ARCADE.words(engine, state, 6);
  assert.equal(words.length, 6);
  assert.equal(new Set(words.map(word => word.id)).size, 6);
  assert.ok(words.every(word => state.entries[word.id]));
  const beginner = engine.fresh();
  assert.ok(HSK_ARCADE.words(engine, beginner, 8).every(word => word.order <= 30));
  const sentences = HSK_ARCADE.sentences(engine, beginner, 4);
  assert.equal(sentences.length, 4);
  assert.ok(sentences.every(sentence => sentence.id.startsWith('bs') && new Set(sentence.tokens).size >= 2));
});

test('dữ liệu luyện viết giới hạn ở 30 chữ trong HSK 1 và có đường dẫn cho từng nét', () => {
  const { engine } = loadGame();
  const { HSK_STROKE_DATA } = loadArcadeParts();
  const chars = new Set(engine.D.words.map(word => word.hanzi));
  assert.equal(Object.keys(HSK_STROKE_DATA).length, 30);
  for (const [char, writing] of Object.entries(HSK_STROKE_DATA)) {
    assert.ok(chars.has(char), char);
    assert.equal(writing.outlines.length, writing.medians.length);
    for (const path of writing.medians) {
      assert.ok(path.length >= 2);
      assert.ok(path.every(point => point.length === 2 && point.every(value => Number.isFinite(value))));
    }
  }
});

test('kỷ lục mini game giữ trong bản sao lưu mà không thay chặng phiêu lưu đang dở', () => {
  const { engine } = loadGame();
  const state = engine.fresh();
  const mission = engine.D.missions[0];
  state.active = { mode: 'mission', missionId: mission.id, queue: engine.adventureQueue(state, mission), index: 0, intro: true };
  engine.recordArcade(state, 'flow', 200);
  engine.recordArcade(state, 'flow', 170);
  engine.recordArcade(state, 'unknown', 300);
  engine.recordArcade(state, 'pairs', NaN);
  const saved = engine.load();
  assert.equal(saved.arcade.flow.played, 2);
  assert.equal(saved.arcade.flow.best, 200);
  assert.equal(saved.arcade.flow.last, 170);
  assert.equal(Object.keys(saved.arcade).length, 1);
  assert.equal(saved.active.missionId, mission.id);
  assert.equal(saved.active.queue[0].type, 'trail');
  assert.equal(Object.keys(engine.normalize({ ...state, arcade: undefined }).arcade).length, 0);
});
