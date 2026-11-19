const assert = require('node:assert/strict');
const { readFileSync, statSync } = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const { appRoot } = require('./helpers.cjs');

const pages = [
  'https://lnmcode.github.io/learning/hsk1/',
  'https://example.github.io/project/learning/hsk1/',
];
const artworks = ['./art/school.webp', './art/market.webp', './art/river.webp'];
const arcade = ['catalog.js', 'visual.js', 'strokes.js', 'strokes-data.js', 'pinyin.js',
  'pairs.js', 'flow.js', 'arcade.css', 'memory-games.css', 'vendor/three.module.min.js',
  'vendor/three.core.min.js', 'wind.js', 'echo.js', 'riddle.js', 'lights.js',
  'wind.css', 'echo.css', 'riddle.css', 'lights.css', 'cinema.css',
  'cinema-scenes.js', 'story-world.js', 'game-sets.js'].map(name => './arcade/' + name);

function localResource(base, reference) {
  const url = new URL(reference, base);
  assert.equal(url.origin, base.origin, reference);
  assert.ok(url.pathname.startsWith(base.pathname), reference);
  const relativePath = url.pathname.slice(base.pathname.length);
  const filename = path.join(appRoot, relativePath || 'index.html');
  assert.ok(statSync(filename).isFile(), reference);
  return url;
}

test('service worker cache theo đường dẫn, giữ cache khác và mở bài học khi ngoại tuyến', async () => {
  const scope = 'https://example.github.io/project/learning/hsk1/';
  const oldCache = `han-ngu-hsk1:${scope}:old`;
  const otherGame = 'han-ngu-hsk1:https://example.github.io/learning/hsk1/:old';
  const otherSite = 'portfolio-shell';
  const stores = new Map([[oldCache, new Map()], [otherGame, new Map()], [otherSite, new Map()]]);
  const listeners = {};
  let claimed = false;
  const open = async (name) => {
    if (!stores.has(name)) stores.set(name, new Map());
    const cache = stores.get(name);
    return {
      addAll: async (requests) => {
        for (const request of requests) {
          localResource(new URL(scope), request.url);
          cache.set(request.url, { url: request.url });
        }
      },
      match: async (url) => cache.get(url),
    };
  };
  const caches = {
    open,
    keys: async () => [...stores.keys()],
    delete: async (name) => stores.delete(name),
  };
  const self = {
    registration: { scope },
    clients: { claim: async () => { claimed = true; } },
    addEventListener: (name, callback) => { listeners[name] = callback; },
  };
  vm.runInNewContext(readFileSync(path.join(appRoot, 'sw.js'), 'utf8'), {
    self, caches, URL, Request, fetch: async () => { throw Error('Mạng ngoại tuyến'); },
  }, { filename: 'sw.js' });
  const dispatch = (name, properties = {}) => {
    let promise;
    const wait = (task) => { promise = task; };
    listeners[name]({ waitUntil: wait, respondWith: wait, ...properties });
    return promise;
  };

  await dispatch('install');
  await dispatch('activate');
  assert.equal(claimed, true);
  assert.equal(stores.has(oldCache), false);
  assert.equal(stores.has(otherGame), true);
  assert.equal(stores.has(otherSite), true);
  for (const reference of ['./', './?from=offline', './index.html', './data.js', './engine.js',
    './app.js', './styles.css', ...artworks, ...arcade]) {
    const url = new URL(reference, scope);
    const mode = url.pathname.endsWith('/') ? 'navigate' : 'same-origin';
    const response = await dispatch('fetch', { request: { method: 'GET', url: url.href, mode } });
    const expected = mode === 'navigate' ? new URL('index.html', scope) : url;
    assert.equal(response?.url, expected.href);
  }
  assert.equal(dispatch('fetch', { request: { method: 'GET', url: new URL('/', scope).href, mode: 'navigate' } }), undefined);
  assert.equal(dispatch('fetch', { request: { method: 'POST', url: scope } }), undefined);
});

for (const page of pages) {
  test(`tài nguyên và PWA nằm trong đường dẫn ${new URL(page).pathname}`, () => {
    const base = new URL(page);
    const html = readFileSync(path.join(appRoot, 'index.html'), 'utf8');
    assert.equal([...html.matchAll(/<canvas\b[^>]*id="hsk-cinema"/g)].length, 1);
    assert.doesNotMatch(html, /user-scalable=|maximum-scale=/i);
    const resources = [...html.matchAll(/<(?:link|script)\b[^>]*(?:href|src)="([^"]+)"/gi)]
      .map((match) => match[1]);
    assert.ok(resources.length >= 7);
    for (const resource of resources) localResource(base, resource);

    const manifestEntry = html.match(/<link\b[^>]*rel="manifest"[^>]*href="([^"]+)"/i)?.[1];
    const manifestUrl = localResource(base, manifestEntry);
    const manifest = JSON.parse(readFileSync(path.join(appRoot, path.basename(manifestUrl.pathname)), 'utf8'));
    assert.equal(new URL(manifest.scope, manifestUrl).href, base.href);
    assert.equal(manifest.display, 'standalone');
    assert.ok(html.includes('<meta name="color-scheme" content="dark">'));
    assert.ok(html.includes(`<meta name="theme-color" content="${manifest.theme_color}">`));
    assert.equal(manifest.background_color, manifest.theme_color);
    const styles = readFileSync(path.join(appRoot, 'styles.css'), 'utf8');
    for (const artwork of artworks) {
      localResource(base, artwork);
      assert.ok(styles.includes(`url("${artwork}")`), artwork);
    }
    localResource(base, manifest.start_url);
    for (const size of [192, 512]) {
      const icon = manifest.icons.find((item) => item.sizes.split(/\s+/).includes(`${size}x${size}`));
      assert.ok(icon, `Thiếu biểu tượng ${size}x${size}`);
      const iconUrl = localResource(base, icon.src);
      const iconPath = path.join(appRoot, iconUrl.pathname.slice(base.pathname.length));
      const png = readFileSync(iconPath);
      assert.equal(png.toString('hex', 0, 8), '89504e470d0a1a0a');
      assert.equal(png.readUInt32BE(16), size);
      assert.equal(png.readUInt32BE(20), size);
    }
    localResource(base, './sw.js');
  });
}
