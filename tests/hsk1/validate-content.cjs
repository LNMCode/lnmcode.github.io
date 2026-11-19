const { readFileSync } = require('node:fs');
const path = require('node:path');
const { loadGame } = require('./helpers.cjs');

const officialFile = path.join(__dirname, 'official-hsk1.txt');
const count = 300;
const isText = (value) => typeof value === 'string' && value.trim().length > 0;
const onlyHanzi = (text) => text.replace(/[\p{P}\p{Z}\s]/gu, '');
const normalizedReading = (reading) => reading.normalize('NFC').toLowerCase().replace(/[\s’']/g, '');
const keyPatterns = {
  words: /^w\d{3}$/,
  regions: /^r\d{2}$/,
  missions: /^m\d{3}$/,
  sentences: /^[a-z]+\d+$/,
  stories: /^tr\d{2}$/,
};

function loadReference() {
  return readFileSync(officialFile, 'utf8')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))
    .map((line) => {
      const [hanzi, ...readings] = line.split('\t');
      return { hanzi, readings };
    });
}

function validateContent(data, official) {
  const issues = [];
  const check = (condition, issue) => {
    if (!condition) issues.push(issue);
    return Boolean(condition);
  };
  const array = (value, label, allowEmpty = false) => {
    if (!check(Array.isArray(value) && (allowEmpty || value.length > 0), `${label}: cần danh sách`)) return [];
    return value;
  };
  const fields = (object, label, keys) => {
    for (const name of keys) check(isText(object[name]), `${label}: thiếu ${name}`);
  };
  const unique = (values, label) => {
    const seen = new Set();
    for (const value of values) {
      check(!seen.has(value), `${label}: mục trùng ${value}`);
      seen.add(value);
    }
    return seen;
  };
  const refs = (value, label, target, allowEmpty = false) => {
    const ids = array(value, label, allowEmpty);
    unique(ids, label);
    for (const id of ids) check(target.has(id), `${label}: mã không tồn tại ${id}`);
    return ids;
  };

  const collections = {};
  for (const [name, pattern] of Object.entries(keyPatterns)) {
    const entries = array(data?.[name], name).filter((item, index) =>
      check(item !== null && typeof item === 'object' && !Array.isArray(item), `${name}[${index}]: mục bị hỏng`),
    );
    unique(entries.map((entry) => entry.id), `${name}.id`);
    for (const entry of entries) check(pattern.test(entry.id), `${name}: mã sai định dạng ${entry.id}`);
    collections[name] = new Map(entries.map((entry) => [entry.id, entry]));
  }
  const { words, regions, missions, sentences, stories } = collections;
  const indexByHanzi = new Map([...words.values()].map((word) => [word.hanzi, word.id]));
  const officialSet = unique(official.map(({ hanzi }) => hanzi), 'Đề cương HSK 1');
  const vocab = unique([...words.values()].map((word) => word.hanzi), 'Chữ Hán');
  check(official.length === count, `Đề cương: cần đúng ${count} mục, có ${official.length}`);
  check(words.size === count, `Dữ liệu: cần đúng ${count} mục, có ${words.size}`);
  check(data?.meta?.count === words.size, 'meta.count: sai số lượng từ');
  for (const hanzi of officialSet) check(vocab.has(hanzi), `Thiếu mục trong đề cương: ${hanzi}`);
  for (const hanzi of vocab) check(officialSet.has(hanzi), `Mục ngoài đề cương: ${hanzi}`);
  unique([...words.values()].map((word) => word.order), 'Thứ tự mục từ');

  unique([...words.values()].map((word) => word.syllabusEntry), 'Số mục trong đề cương');
  for (const [id, word] of words) {
    const label = `Từ ${id} ${word.hanzi}`;
    fields(word, label, ['hanzi', 'pinyin', 'vi', 'partOfSpeech', 'topic', 'memo', 'parts', 'emoji', 'example', 'examplePinyin', 'exampleVi']);
    check(Number.isInteger(word.order) && word.order >= 1 && word.order <= count, `${label}: sai thứ tự mục từ`);
    check(/^\p{Script=Han}+$/u.test(word.hanzi), `${label}: ký tự Hán không hợp lệ`);
    check(/^[\p{Script=Latin}\p{M}\s.'’·-]+$/u.test(word.pinyin), `${label}: Pinyin không hợp lệ`);
    const alternates = word.pinyinAlternatives === undefined ? [] : array(word.pinyinAlternatives, `${label}.pinyinAlternatives`);
    for (const alternate of alternates) {
      check(isText(alternate) && /^[\p{Script=Latin}\p{M}\s.'’·-]+$/u.test(alternate), `${label}: Pinyin bổ sung không hợp lệ`);
    }
    const officialEntry = official[word.syllabusEntry - 1];
    check(officialEntry?.hanzi === word.hanzi, `${label}: sai số mục đề cương ${word.syllabusEntry}`);
    const expectedReadings = (officialEntry?.readings ?? []).filter(isText).map(normalizedReading).sort();
    const actualReadings = [word.pinyin, ...alternates].filter(isText).map(normalizedReading).sort();
    check(expectedReadings.length > 0 && expectedReadings.join('|') === actualReadings.join('|'),
      `${label}: Pinyin lệch đề cương (${expectedReadings.join(', ')} / ${actualReadings.join(', ')})`);
    const example = sentences.get(word.exampleSentenceId);
    check(Array.isArray(example?.wordIds) && example.wordIds.includes(id), `${label}: câu ví dụ ${word.exampleSentenceId} thiếu từ mục tiêu`);
    if (example) {
      check(word.example === example.hanzi && word.examplePinyin === example.pinyin && word.exampleVi === example.vi,
        `${label}: dữ liệu ví dụ khác câu ${example.id}`);
    }
    for (const sentenceId of refs(word.practiceSentences, `${label}.practiceSentences`, sentences, true)) {
      const sentence = sentences.get(sentenceId);
      check(Array.isArray(sentence?.wordIds) && sentence.wordIds.includes(id), `${label}: câu luyện ${sentenceId} thiếu từ mục tiêu`);
    }
    for (const parentId of refs(word.parents, `${label}.parents`, words, true)) {
      const parent = words.get(parentId);
      check(parent && parent.id !== id && isText(word.hanzi) && word.hanzi.includes(parent.hanzi),
        `${label}: sai liên kết từ gốc ${parentId}`);
    }
    for (const familyId of refs(word.family, `${label}.family`, words, true)) {
      const family = words.get(familyId);
      check(family && familyId !== id && isText(word.hanzi) && isText(family.hanzi)
        && [...family.hanzi].some((character) => word.hanzi.includes(character)),
        `${label}: sai liên kết từ liên quan ${familyId}`);
    }
  }

  unique([...sentences.values()].map((sentence) => sentence.hanzi), 'Câu ví dụ');
  for (const [id, sentence] of sentences) {
    const label = `Câu ${id}`;
    fields(sentence, label, ['hanzi', 'pinyin', 'vi', 'source']);
    const tokens = array(sentence.tokens, `${label}.tokens`);
    const ids = array(sentence.wordIds, `${label}.wordIds`);
    check(isText(sentence.hanzi) && tokens.join('') === onlyHanzi(sentence.hanzi), `${label}: sai tách từ`);
    for (const token of tokens) {
      check(isText(token), `${label}: mảnh từ không hợp lệ`);
      check(indexByHanzi.has(token) || isText(sentence.glosses?.[token]), `${label}: từ ngoài cấp chưa chú giải ${token}`);
    }
    for (const [token, gloss] of Object.entries(sentence.glosses ?? {})) {
      check(tokens.includes(token) && isText(gloss), `${label}: chú giải không khớp với từ ${token}`);
    }
    const expected = tokens.map((token) => indexByHanzi.get(token)).filter(Boolean);
    check(ids.length === expected.length && ids.every((id, index) => id === expected[index]), `${label}: sai tham chiếu theo thứ tự từ`);
  }

  const missionRegionIds = [];
  const regionWordIds = [];
  for (const [id, region] of regions) {
    const label = `Vùng ${id}`;
    fields(region, label, ['name', 'category', 'intro', 'emoji']);
    const regionMissions = refs(region.missionIds, `${label}.missionIds`, missions);
    const regionWords = refs(region.wordIds, `${label}.wordIds`, words);
    const containedWords = [];
    regionMissions.forEach((missionId, index) => {
      const mission = missions.get(missionId);
      check(mission?.regionId === id && mission.region === region.number && mission.step === index + 1,
        `${label}: sai liên kết hoặc thứ tự nhiệm vụ ${missionId}`);
      if (Array.isArray(mission?.wordIds)) containedWords.push(...mission.wordIds);
    });
    check(regionWords.length === containedWords.length && regionWords.every((wordId, index) => wordId === containedWords[index]),
      `${label}: danh sách từ lệch với nhiệm vụ`);
    missionRegionIds.push(...regionMissions);
    regionWordIds.push(...regionWords);
  }
  const assignedMissions = unique(missionRegionIds, 'Nhiệm vụ phân vùng');
  const assignedWords = unique(regionWordIds, 'Từ phân vùng');
  for (const [id, mission] of missions) {
    const label = `Nhiệm vụ ${id}`;
    fields(mission, label, ['title', 'intro']);
    check(assignedMissions.has(id), `${label}: chưa phân vùng`);
    refs(mission.wordIds, `${label}.wordIds`, words);
  }
  for (const id of words.keys()) check(assignedWords.has(id), `Từ ${id}: chưa có nhiệm vụ`);

  const storyRegions = unique([...stories.values()].map((story) => story.regionId), 'Vùng đọc hiểu');
  for (const [id, story] of stories) {
    const label = `Đọc hiểu ${id}`;
    fields(story, label, ['title', 'introduction']);
    check(regions.has(story.regionId), `${label}: vùng không tồn tại ${story.regionId}`);
    refs(story.sentences, `${label}.sentences`, sentences);
  }
  for (const id of regions.keys()) check(storyRegions.has(id), `Vùng ${id}: thiếu mục đọc hiểu`);

  return {
    issues,
    totals: {
      words: words.size,
      regions: regions.size,
      missions: missions.size,
      sentences: sentences.size,
      stories: stories.size,
    },
  };
}

if (require.main === module) {
  const { data } = loadGame(new Map(), { dataOnly: true });
  const { issues, totals } = validateContent(data, loadReference());
  console.log(`${totals.words} từ, ${totals.regions} vùng, ${totals.missions} nhiệm vụ, ${totals.sentences} câu, ${totals.stories} mục đọc hiểu.`);
  if (issues.length) {
    console.error(issues.join('\n'));
    process.exitCode = 1;
  }
}

module.exports = { loadReference, validateContent };
