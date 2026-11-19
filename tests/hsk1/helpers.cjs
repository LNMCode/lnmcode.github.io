const { readFileSync } = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const siteRoot = path.resolve(__dirname, '../..');
const appRoot = path.join(siteRoot, 'learning', 'hsk1');

function loadGame(records = new Map(), options = {}) {
  const window = {};
  const localStorage = {
    getItem: (key) => records.get(key) ?? null,
    setItem: (key, value) => records.set(key, String(value)),
    removeItem: (key) => records.delete(key),
  };
  const context = vm.createContext({ window, localStorage: options.localStorage ?? localStorage });
  const files = options.dataOnly ? ['data.js'] : ['data.js', 'engine.js'];
  for (const filename of files) {
    vm.runInContext(readFileSync(path.join(appRoot, filename), 'utf8'), context, { filename });
  }
  return { data: window.HSK_GAME_DATA, engine: window.HSK_ENGINE };
}

module.exports = { appRoot, loadGame, siteRoot };
