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
