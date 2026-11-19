const assert = require('node:assert/strict');
const test = require('node:test');
const { loadGame } = require('./helpers.cjs');
const { loadReference, validateContent } = require('./validate-content.cjs');

test('từ vựng HSK-1, câu ví dụ, tuyến học và liên kết có dữ liệu hợp lệ', () => {
  const { data } = loadGame(new Map(), { dataOnly: true });
  const { issues, totals } = validateContent(data, loadReference());
  assert.equal(issues.length, 0, issues.join('\n'));
  assert.equal(totals.regions, 20);
  assert.equal(totals.missions, 72);
  assert.ok(totals.sentences >= 317);
  assert.equal(totals.stories, totals.regions);
});

test('cảnh, điểm tương tác và câu mở lối được cấu hình đúng vùng và chặng', () => {
  const { data } = loadGame(new Map(), { dataOnly: true });
  const regions = new Set(data.regions.map((region) => region.id));
  const missions = new Map(data.missions.map((mission) => [mission.id, mission]));
  const sentences = new Map(data.sentences.map((sentence) => [sentence.id, sentence]));
  const scenes = new Set(['school', 'market', 'river']);
  const isText = (value) => typeof value === 'string' && value.trim().length > 0;

  assert.deepEqual(new Set(Object.keys(data.adventures)), regions);
  for (const [id, adventure] of Object.entries(data.adventures)) {
    assert.ok(scenes.has(adventure.scene), id);
    assert.ok([adventure.objective, adventure.gate, adventure.unlock].every(isText), id);
    assert.equal(adventure.locationNames.length, 5, id);
    assert.ok(adventure.locationNames.every(isText), id);
    assert.equal(new Set(adventure.locationNames).size, adventure.locationNames.length, id);
  }
  for (const [id, adventure] of Object.entries(data.adventureMissions)) {
    const mission = missions.get(id);
    const sentence = sentences.get(adventure.sentenceId);
    assert.ok(mission && sentence && isText(adventure.title), id);
    assert.ok(adventure.sentenceId && sentence.tokens.length >= 2 && sentence.tokens.length <= 8, id);
    assert.ok(sentence.wordIds.some((wordId) => mission.wordIds.includes(wordId)), id);
  }
});
