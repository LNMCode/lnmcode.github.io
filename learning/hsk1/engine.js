(function () {
'use strict';

const D = window.HSK_GAME_DATA;
if (!D || D.words.length !== 300 || new Set(D.words.map(word => word.hanzi)).size !== 300) {
  throw Error('Bộ từ HSK 1 không đầy đủ');
}

function indexById(items) {
  return Object.assign(Object.create(null), Object.fromEntries(items.map(item => [item.id, item])));
}

const W = indexById(D.words);
const M = indexById(D.missions);
const R = indexById(D.regions);
const S = indexById(D.sentences);
const ST = indexById(D.stories);
const KEY = 'hanNguPhieuLuu_hsk300_v2';
const OLDKEY = 'hanNguPhieuLuu_v1';
const SKILLS = ['meaning', 'reading', 'hanzi', 'usage'];
const CORE_SKILLS = ['meaning', 'reading', 'usage'];
const MIN = 60000;
const DAY = 1440 * MIN;
const MAX_INTERVAL = 240 * 1440;
const MAX_QUEUE = 120;
const HISTORY_LIMIT = 12;
const ARCADE_GAMES = ['pinyin', 'strokes', 'pairs', 'flow', 'wind', 'echo', 'riddle', 'lights'];
const MIN_TRAIL_SPOTS = 3;
const MAX_TRAIL_SPOTS = 5;
const IMAGE_WORDS = new Set(['书', '车', '电脑', '手机', '米饭', '面条', '鸡蛋', '面包',
  '苹果', '水', '茶', '牛奶', '雪', '狗', '猫']);
const DIALOGUES = Object.assign(Object.create(null), {
  m001: {
    context: 'Cô giáo mở cửa lớp và chào bạn.',
    prompt: '你好！',
    question: 'Bạn muốn chào lại bằng cách nào?',
    sentenceId: 'bs01',
    distractors: ['bs06', 'bs13', 'bs15'],
    explanation: '你好 dùng để chào khi gặp mặt. Bạn có thể đáp lại bằng chính lời chào này.'
  },
  m004: {
    context: 'Bạn giúp cô giáo mở cửa. Cô mỉm cười cảm ơn bạn.',
    prompt: '谢谢！',
    question: 'Bạn đáp lại lời cảm ơn ra sao?',
    sentenceId: 'bs07',
    distractors: ['bs01', 'bs05', 'bs02'],
    explanation: '不客气 là lời đáp lịch sự khi ai đó nói 谢谢.'
  }
});

function shuffle(items) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const number = (value, fallback = 0) => typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : fallback;
const count = value => Math.floor(number(value));
const timestamp = (value, fallback = 0) => Math.min(number(value, fallback), 8640000000000000);
const text = (value, max = 400) => typeof value === 'string' ? value.slice(0, max) : '';

function skill0() {
  return {attempts: 0, correct: 0, streak: 0, due: 0, interval: 0, last: 0, mistakes: 0,
    hints: 0, spacedCorrect: 0, firstSpaced: 0, lastSpaced: 0, lastExercise: '', history: []};
}

function entry0(now = Date.now()) {
  return {firstSeen: now, seenCount: 0, meaning: skill0(), reading: skill0(), hanzi: skill0(), usage: skill0()};
}

function fresh() {
  const now = Date.now();
  return {schema: 3, createdAt: now, savedAt: now, entries: {}, completed: [], active: null,
    preferences: {audio: false, lowMotion: false, viewPinyin: false, sessionSize: 10},
    stats: {sessions: 0, answers: 0}, arcade: {}};
}

function normalizeArcade(raw) {
  const arcade = {};
  for (const id of ARCADE_GAMES) {
    const record = raw?.[id];
    if (!isRecord(record) || !count(record.played)) continue;
    const last = Math.min(999999, count(record.last));
    const best = Math.max(last, Math.min(999999, count(record.best)));
    arcade[id] = {played: Math.min(999999, count(record.played)), last, best};
  }
  return arcade;
}

function recordArcade(state, id, score) {
  if (!ARCADE_GAMES.includes(id) || !Number.isFinite(score) || score < 0) return;
  const previous = state.arcade[id] || {played: 0, best: 0};
  const last = Math.min(999999, Math.floor(score));
  state.arcade[id] = {played: Math.min(999999, previous.played + 1),
    last, best: Math.max(previous.best, last)};
  save(state);
}

function normalizeHistory(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.slice(-HISTORY_LIMIT)
    .filter(item => isRecord(item) && ['good', 'almost', 'again'].includes(item.quality) && timestamp(item.at))
    .map(item => ({at: timestamp(item.at), quality: item.quality, hint: item.hint === true}));
}

function normalizeSkill(raw) {
  const value = isRecord(raw) ? raw : {};
  const attempts = count(value.attempts);
  const correct = Math.min(attempts, count(value.correct));
  return {attempts, correct, streak: Math.min(correct, count(value.streak)), due: timestamp(value.due),
    interval: Math.min(MAX_INTERVAL, number(value.interval)), last: timestamp(value.last),
    mistakes: Math.min(attempts - correct, count(value.mistakes ?? (attempts - correct))),
    hints: Math.min(attempts, count(value.hints)), spacedCorrect: Math.min(correct, count(value.spacedCorrect)),
    firstSpaced: timestamp(value.firstSpaced), lastSpaced: timestamp(value.lastSpaced),
    lastExercise: text(value.lastExercise, 40), history: normalizeHistory(value.history)};
}

function legacyEntries(raw) {
  const aliases = {
    nihao: '你好', dajia: '大家', hao: '好', xuesheng: '学生', men: '们', laoshi: '老师', nin: '您',
    nimen: '你们', xiexie: '谢谢', bukeqi: '不客气', tongxue: '同学', zaijian: '再见',
    qingwen: '请问', ni: '你', jiao: '叫', shenme: '什么', mingzi: '名字', wo: '我', bu: '不', shi: '是',
    duibuqi: '对不起', meiguanxi: '没关系', meishi: '没事', hen: '很', gaoxing: '高兴',
    renshi: '认识', ye: '也'
  };
  const wordsByHanzi = new Map(D.words.map(word => [word.hanzi, word.id]));
  const entries = {};
  let recognized = 0;
  for (const [key, item] of Object.entries(raw.entries)) {
    const id = wordsByHanzi.get(aliases[key]);
    if (!id || !isRecord(item)) continue;
    recognized++;
    if (!item.seen) continue;
    entries[id] = {
      firstSeen: item.firstSeen, seenCount: Number(item.seen) || 1,
      meaning: item.meaning, reading: item.pinyin, usage: item.usage
    };
  }
  if (Object.keys(raw.entries).length && !recognized) throw Error('Không tìm thấy từ có thể khôi phục');
  return entries;
}

function choiceOrder(values, answer, previous = []) {
  const result = shuffle([...new Set([answer, ...values])].slice(0, 4));
  if (result.length > 1 && result.every((value, index) => value === previous[index])) {
    result.push(result.shift());
  }
  return result;
}

function restoreOptions(raw, options, answer) {
  if (Array.isArray(raw) && raw.length === options.length && new Set(raw).size === raw.length &&
      raw.includes(answer) && raw.every(value => typeof value === 'string' && value.length <= 400)) {
    return raw;
  }
  return options;
}

function normalizeTask(task, state, mission) {
  if (!isRecord(task)) return null;
  const {type, wordId, sentenceId, regionId, focusId} = task;
  if (type === 'trail' && mission && task.missionId === mission.id) {
    return restoreTrail(task, state, mission);
  }
  if (type === 'learn' && W[wordId]) return {type, wordId};
  if (type === 'reading' && W[wordId]) return {type, wordId};
  if (type === 'tone' && W[wordId]) {
    const options = toneOptions(W[wordId]);
    return options.length > 1
      ? {type, wordId, options: restoreOptions(task.options, options, W[wordId].pinyin)}
      : {type: 'reading', wordId};
  }
  if (type === 'meaning' && W[wordId]) {
    return {type, wordId, options: restoreOptions(task.options, choicesFor(wordId), W[wordId].vi)};
  }
  if (type === 'hanzi' && W[wordId]) {
    return {type, wordId, cue: task.cue === 'image' && IMAGE_WORDS.has(W[wordId].hanzi) ? 'image'
      : task.cue === 'pinyin' ? 'pinyin' : 'meaning',
      options: restoreOptions(task.options, hanziChoices(wordId), W[wordId].hanzi)};
  }
  const sentence = S[sentenceId];
  if (type === 'cloze' && W[wordId] && sentence?.wordIds.includes(wordId) && sentence.tokens.includes(W[wordId].hanzi)) {
    return {type, wordId, sentenceId, glossary: glossaryFor(state, [sentence], [wordId]),
      options: restoreOptions(task.options, hanziChoices(wordId), W[wordId].hanzi)};
  }
  if (type === 'build' && sentence?.tokens.length) {
    const tiles = Array.isArray(task.tiles) && task.tiles.length === sentence.tokens.length &&
      new Set(task.tiles.map(tile => tile?.index)).size === sentence.tokens.length &&
      task.tiles.every(tile => Number.isInteger(tile?.index) && sentence.tokens[tile.index] === tile.text)
      ? task.tiles.map(({text, index}) => ({text, index})) : sentenceTiles(sentence);
    const result = {type, sentenceId, tiles, focusId: sentence.wordIds.includes(focusId) ? focusId : sentence.wordIds[0],
      glossary: glossaryFor(state, [sentence])};
    if (task.gate === true && mission && canBuild(sentence)) {
      const gateWord = sentence.wordIds.find(id => mission.wordIds.includes(id));
      if (gateWord) {
        result.gate = true;
        if (!mission.wordIds.includes(result.focusId)) result.focusId = gateWord;
      }
    }
    return result;
  }
  if (type === 'story' && R[regionId]) {
    const question = storyQuestion(state, regionId);
    const regionalIds = passageFor(regionId)?.sentences;
    if (Array.isArray(task.sentenceIds) && task.sentenceIds.length > 0 && task.sentenceIds.length <= 3 &&
        task.sentenceIds.every(id => S[id] && regionalIds?.includes(id))) {
      question.sentenceIds = task.sentenceIds;
      question.glossary = glossaryFor(state, task.sentenceIds.map(id => S[id]));
    }
    return question;
  }
  if (type === 'passage' && sentence && sentence.wordIds.includes(focusId)) {
    const result = passageQuestion(state, sentence, focusId, Array.isArray(task.context) ? task.context : []);
    result.options = restoreOptions(task.options, result.options, sentence.vi);
    return result;
  }
  if (type === 'dialogue' && DIALOGUES[task.missionId]) {
    const result = dialogueQuestion(state, task.missionId);
    result.options = restoreOptions(task.options, result.options, S[result.sentenceId].hanzi);
    return result;
  }
  return null;
}

function normalizeActive(active, state) {
  const modes = ['mission', 'review', 'word', 'sentences'];
  if (!isRecord(active) || !modes.includes(active.mode) ||
      (active.mode === 'mission' && !M[active.missionId]) ||
      !Array.isArray(active.queue) || active.queue.length > MAX_QUEUE) return null;
  const mission = active.mode === 'mission' ? M[active.missionId] : null;
  const tasks = active.queue.map(task => normalizeTask(task, state, mission));
  const previousIndex = count(active.index);
  const current = tasks[previousIndex];
  const queue = tasks.filter(Boolean);
  if (!queue.length || previousIndex >= tasks.length) return null;
  const index = Math.min(queue.length - 1, tasks.slice(0, previousIndex).filter(Boolean).length);
  const oldTiles = active.queue[previousIndex]?.tiles;
  const sameTiles = current?.type === 'build' && Array.isArray(oldTiles) &&
    current.tiles.every((tile, index) => tile.index === oldTiles[index]?.index && tile.text === oldTiles[index]?.text);
  const chosen = sameTiles && Array.isArray(active.chosen)
    ? [...new Set(active.chosen.filter(tile => Number.isInteger(tile) && current.tiles[tile]))] : [];
  const feedback = current && isRecord(active.feedback) &&
    ['good', 'almost', 'again'].includes(active.feedback.quality)
    ? Object.fromEntries(['quality', 'heading', 'intro', 'answerHanzi', 'pinyin', 'vi', 'explanation']
      .map(key => [key, text(active.feedback[key])])) : null;
  const repeats = {};
  if (isRecord(active.repeats)) {
    for (const [key, value] of Object.entries(active.repeats)) {
      if (/^(meaning|reading|usage|hanzi):w\d+$/.test(key)) repeats[key] = Math.min(count(value), 1);
    }
  }
  const result = {mode: active.mode, missionId: M[active.missionId] ? active.missionId : null,
    queue, index, intro: active.mode === 'mission' && active.intro === true, chosen, feedback, repeats,
    hint: active.hint === true, readingInput: text(active.readingInput, 100)};
  if (current?.type === 'trail') result.trail = trailState(current, active.trail);
  return result;
}

function normalize(raw, permitUnversionedLegacy = false) {
  if (!isRecord(raw) || !isRecord(raw.entries)) throw Error('Không đúng định dạng sao lưu HSK 1');
  const legacy = raw.schema === 1 || (raw.schema === undefined &&
    (permitUnversionedLegacy || Object.values(raw.entries).some(item => isRecord(item) && item.seen !== undefined)));
  if (!legacy && (![2, 3].includes(raw.schema) || !Array.isArray(raw.completed))) {
    throw Error('Phiên bản sao lưu HSK 1 không được hỗ trợ');
  }

  const state = fresh();
  state.createdAt = timestamp(raw.createdAt, state.createdAt);
  state.savedAt = timestamp(raw.savedAt, state.savedAt);
  const entries = legacy ? legacyEntries(raw) : raw.entries;
  for (const [id, value] of Object.entries(entries)) {
    if (!W[id] || !isRecord(value)) continue;
    const entry = entry0(timestamp(value.firstSeen, state.createdAt));
    entry.seenCount = count(value.seenCount);
    for (const skill of SKILLS) entry[skill] = normalizeSkill(value[skill]);
    state.entries[id] = entry;
  }
  if (Object.keys(entries).length && !Object.keys(state.entries).length) {
    throw Error('Không tìm thấy từ có thể khôi phục');
  }
  state.completed = Array.isArray(raw.completed) ? [...new Set(raw.completed.filter(id => M[id]))] : [];
  const preferences = raw.preferences;
  state.preferences = {audio: preferences?.audio === true, lowMotion: preferences?.lowMotion === true,
    viewPinyin: preferences?.viewPinyin === true,
    sessionSize: [5, 10, 20].includes(preferences?.sessionSize) ? preferences.sessionSize : 10};
  state.stats = {sessions: count(raw.stats?.sessions), answers: count(raw.stats?.answers)};
  state.arcade = normalizeArcade(raw.arcade);
  state.active = legacy ? null : normalizeActive(raw.active, state);
  return state;
}

let storageHealthy = true;
function save(state) {
  try {
    state.savedAt = Date.now();
    localStorage.setItem(KEY, JSON.stringify(state));
    storageHealthy = true;
  } catch (_error) {
    storageHealthy = false;
  }
  return storageHealthy;
}

function load() {
  try {
    const stored = localStorage.getItem(KEY);
    if (stored) return normalize(JSON.parse(stored));
    const older = localStorage.getItem(OLDKEY);
    if (older) {
      const migrated = normalize(JSON.parse(older), true);
      save(migrated);
      return migrated;
    }
  } catch (_error) {
    storageHealthy = false;
  }
  return fresh();
}

function ensure(state, id, now = Date.now()) {
  return state.entries[id] || (state.entries[id] = entry0(now));
}

function see(state, id, persist = true) {
  if (!W[id]) return;
  const entry = ensure(state, id);
  entry.seenCount++;
  if (persist) save(state);
  return entry;
}

function grade(state, id, skill, quality, now = Date.now(), {hint = false, exercise = '', persist = true} = {}) {
  if (!W[id] || !SKILLS.includes(skill)) return;
  const entry = ensure(state, id, now);
  const record = entry[skill];
  const isDue = !record.attempts || record.due <= now;
  entry.seenCount = Math.max(1, entry.seenCount);
  record.attempts++;
  record.last = now;
  if (exercise) record.lastExercise = exercise;
  if (hint) record.hints++;
  const outcome = quality === 'good' && !hint ? 'good' : quality === 'again' ? 'again' : 'almost';
  record.history.push({at: now, quality: outcome, hint});
  if (record.history.length > HISTORY_LIMIT) record.history.shift();

  if (outcome === 'good') {
    record.correct++;
    record.streak++;
    // Extra practice before the review date cannot move the date or count as a spaced success.
    if (isDue) {
      const delay = record.due ? Math.min(record.interval, Math.max(0, (now - record.due) / MIN)) : 0;
      record.spacedCorrect++;
      record.firstSpaced ||= now;
      record.lastSpaced = now;
      const reliability = Math.max(0.55, record.correct / record.attempts);
      const growth = Math.max(record.interval + 1, record.interval * (1.6 + reliability) + delay * 0.25);
      const next = record.spacedCorrect === 1 ? 10 : record.interval < 1440 ? 1440 * reliability : growth;
      record.interval = Math.min(MAX_INTERVAL, Math.round(next));
      record.due = now + record.interval * MIN;
    }
  } else {
    record.streak = 0;
    record.mistakes++;
    record.interval = quality === 'almost' || hint ? 10 : 3;
    record.due = now + record.interval * MIN;
  }
  state.stats.answers++;
  if (persist) save(state);
  return record;
}

function dueFor(state, id, skill, now = Date.now()) {
  const entry = state.entries[id];
  if (!entry?.seenCount) return false;
  const record = entry[skill];
  return !record.attempts || record.due <= now;
}

function mastered(state, id) {
  const entry = state.entries[id];
  return !!entry?.seenCount && CORE_SKILLS.every(skill => {
    const record = entry[skill];
    return record.spacedCorrect >= 3 && record.streak >= 2 && record.lastSpaced - record.firstSpaced >= 7 * DAY;
  });
}

function stateOf(state, id, now = Date.now()) {
  const entry = state.entries[id];
  if (!entry?.seenCount) return 'new';
  if (SKILLS.some(skill => entry[skill].attempts && dueFor(state, id, skill, now))) return 'due';
  if (mastered(state, id)) return CORE_SKILLS.every(skill => entry[skill].interval >= 30 * 1440) ? 'long-term' : 'mastered';
  if (SKILLS.some(skill => entry[skill].attempts)) return 'learning';
  return 'seen';
}

function dueItems(state, limit = 50, skillFilter = 'all', now = Date.now()) {
  const tasks = [];
  for (const word of D.words) {
    for (const skill of SKILLS) {
      if ((skillFilter !== 'all' && skillFilter !== skill) || !dueFor(state, word.id, skill, now)) continue;
      const record = state.entries[word.id][skill];
      const elapsed = Math.max(0, now - record.due);
      const difficulty = record.attempts ? (record.mistakes / record.attempts) * 5 * DAY : 2 * DAY;
      const overdue = record.attempts ? Math.min(21 * DAY, elapsed) / Math.max(1, Math.sqrt(record.interval / 1440)) : 0;
      tasks.push({id: word.id, sk: skill, weight: overdue + difficulty, due: record.due});
    }
  }
  tasks.sort((a, b) => b.weight - a.weight || a.due - b.due);
  return tasks.slice(0, limit);
}

function stats(state) {
  let seen = 0;
  let mature = 0;
  let due = 0;
  let answers = 0;
  let correct = 0;
  for (const word of D.words) {
    const entry = state.entries[word.id];
    if (!entry?.seenCount) continue;
    seen++;
    if (mastered(state, word.id)) mature++;
    for (const skill of SKILLS) {
      answers += entry[skill].attempts;
      correct += entry[skill].correct;
      if (dueFor(state, word.id, skill)) due++;
    }
  }
  return {total: D.words.length, seen, mature, learning: seen - mature, due, answers,
    accuracy: answers ? Math.round(correct / answers * 100) : 0, quests: state.completed.length,
    totalQuests: D.missions.length};
}

const tones = ['', '\u0304', '\u0301', '\u030c', '\u0300'];
const cleanPinyin = value => String(value ?? '').trim().toLowerCase().normalize('NFC')
  .replace(/u:/g, 'ü').replace(/v/g, 'ü');
const joinPinyin = value => value.replace(/['’\-·.,!！？?，。\s]/g, '').normalize('NFC');
const noTone = value => value.normalize('NFD').replace(/[\u0300\u0301\u0304\u030c]/g, '').normalize('NFC');

function accentSyllable(syllable, tone) {
  if (tone === '0' || tone === '5') return syllable;
  let position = syllable.indexOf('a');
  if (position < 0) position = syllable.search(/[eê]/);
  if (position < 0) position = syllable.indexOf('ou');
  if (position < 0) position = syllable.search(/[iouü](?!.*[iouü])/);
  if (position < 0 && /^(m|n|ng)$/.test(syllable)) position = 0;
  if (position < 0) return syllable + tone;
  return syllable.slice(0, position + 1) + tones[Number(tone)] + syllable.slice(position + 1);
}

function matchPinyin(typed, word) {
  const raw = cleanPinyin(typed);
  if (!joinPinyin(raw)) return 'empty';
  const input = joinPinyin(raw.replace(/([a-züê]+)([0-5])/g, (_match, syllable, tone) => accentSyllable(syllable, tone)));
  const expected = [word.pinyin, ...(word.pinyinAlternatives || [])].map(value => joinPinyin(cleanPinyin(value)));
  if (expected.includes(input)) return 'good';
  if (expected.some(value => noTone(value) === noTone(input))) return 'almost';
  return 'wrong';
}

function toneOptions(word) {
  const base = noTone(cleanPinyin(word.pinyin));
  if (!/^[a-züê]+$/.test(base) || !/[aeiouüê]/.test(base) || base === word.pinyin ||
      word.pinyinAlternatives?.length) return [];
  // Avoid mistaking a multi-syllable word written without spaces for one syllable.
  if (word.hanzi.length !== 1) return [];
  return shuffle(['1', '2', '3', '4'].map(tone => accentSyllable(base, tone).normalize('NFC')));
}

function choicesFor(id, count = 4) {
  const word = W[id];
  if (!word) return [];
  const same = shuffle(D.words.filter(other => other.topic === word.topic)).map(other => other.vi);
  const rest = shuffle(D.words).map(other => other.vi);
  return shuffle([...new Set([word.vi, ...same, ...rest])].slice(0, count));
}

function hanziChoices(id, count = 4) {
  const word = W[id];
  if (!word) return [];
  const soundForms = entry => [entry.pinyin, ...(entry.pinyinAlternatives || [])]
    .map(value => joinPinyin(noTone(cleanPinyin(value))));
  const sounds = new Set(soundForms(word));
  const alternatives = D.words.filter(other => other.id !== id && other.vi !== word.vi &&
    !soundForms(other).some(sound => sounds.has(sound)));
  const same = shuffle(alternatives.filter(other => other.topic === word.topic));
  return shuffle([word.hanzi, ...new Set([...same, ...shuffle(alternatives)].map(other => other.hanzi))].slice(0, count));
}

function glossaryFor(state, sentences, knownIds = []) {
  return [...new Set(sentences.flatMap(sentence => sentence.wordIds))]
    .filter(id => W[id] && !knownIds.includes(id) && !state.entries[id]?.seenCount);
}

function canBuild(sentence) {
  return sentence.tokens.length >= 2 && sentence.tokens.length <= 8 && sentence.wordIds.length > 0;
}

function sentenceFor(state, id) {
  const word = W[id];
  if (!word) return null;
  const last = state.entries[id]?.usage.lastExercise;
  const candidates = word.practiceSentences.map(sentenceId => S[sentenceId]).filter(sentence => sentence &&
    canBuild(sentence) && sentence.wordIds.includes(id) && !glossaryFor(state, [sentence]).length);
  return shuffle(candidates.filter(sentence => last !== 'build:' + sentence.id))[0] || shuffle(candidates)[0] || null;
}

function sentenceTiles(sentence) {
  const tiles = shuffle(sentence.tokens.map((value, index) => ({text: value, index})));
  if (tiles.length > 1 && tiles.every((tile, index) => tile.text === sentence.tokens[index])) tiles.push(tiles.shift());
  return tiles;
}

function buildQuestion(state, sentence, focusId, knownIds = []) {
  return {type: 'build', sentenceId: sentence.id, focusId, tiles: sentenceTiles(sentence),
    glossary: glossaryFor(state, [sentence], knownIds)};
}

function sentenceTasks(state, ids, max = 2, firstSentenceId = null) {
  const focus = new Set(ids);
  const candidates = D.sentences.filter(sentence => canBuild(sentence) &&
    sentence.wordIds.some(id => focus.has(id)) && !glossaryFor(state, [sentence], ids).length);
  const preferred = candidates.find(sentence => sentence.id === firstSentenceId);
  const sorted = candidates
    .filter(sentence => sentence !== preferred)
    .sort((a, b) => b.wordIds.filter(id => focus.has(id)).length - a.wordIds.filter(id => focus.has(id)).length);
  const ordered = [...(preferred ? [preferred] : []), ...shuffle(sorted.slice(0, 12))];
  return ordered.slice(0, max).map(sentence => buildQuestion(state, sentence,
    sentence.wordIds.find(id => focus.has(id)), ids));
}

function sampleCloze(state, id, knownIds = [], previous = null) {
  const word = W[id];
  if (!word) return null;
  const last = state.entries[id]?.usage.lastExercise;
  const candidates = [...new Set([word.exampleSentenceId, ...word.practiceSentences])]
    .map(sentenceId => S[sentenceId])
    .filter(sentence => sentence?.wordIds.includes(id) && sentence.tokens.includes(word.hanzi));
  const ranked = shuffle(candidates).sort((a, b) => {
    const penalty = sentence => Number(last === 'cloze:' + sentence.id || previous?.sentenceId === sentence.id) * 2 +
      glossaryFor(state, [sentence], [...knownIds, id]).length;
    return penalty(a) - penalty(b);
  });
  const sentence = ranked[0];
  if (!sentence) return null;
  const options = choiceOrder(hanziChoices(id).filter(choice => choice !== word.hanzi), word.hanzi, previous?.options);
  return {type: 'cloze', wordId: id, sentenceId: sentence.id, options,
    glossary: glossaryFor(state, [sentence], [...knownIds, id])};
}

function blankWord(sentence, hanzi) {
  let index = 0;
  for (const token of sentence.tokens) {
    const start = sentence.hanzi.indexOf(token, index);
    if (start < 0) break;
    index = start + token.length;
    if (token === hanzi) return sentence.hanzi.slice(0, start) + '＿＿' + sentence.hanzi.slice(index);
  }
  return sentence.hanzi;
}

function passageFor(regionId) {
  return D.stories.find(story => story.regionId === regionId) || null;
}

function storyQuestion(state, regionId, knownIds = []) {
  const sentences = (passageFor(regionId)?.sentences || []).map(id => S[id]).filter(Boolean);
  const sorted = [...sentences].sort((a, b) =>
    glossaryFor(state, [a], knownIds).length - glossaryFor(state, [b], knownIds).length);
  const sentenceIds = sorted.slice(0, 3).map(sentence => sentence.id);
  return {type: 'story', regionId, sentenceIds, glossary: glossaryFor(state, sorted.slice(0, 3), knownIds)};
}

function passageQuestion(state, sentence, focusId, context = [], knownIds = []) {
  const lines = context.filter(id => S[id]).slice(0, 4);
  const options = choiceOrder(shuffle(D.sentences.filter(other => other !== sentence &&
    !lines.includes(other.id) && Math.abs(other.hanzi.length - sentence.hanzi.length) <= 6)).map(other => other.vi), sentence.vi);
  return {type: 'passage', sentenceId: sentence.id, context: lines, focusId, options,
    glossary: glossaryFor(state, [sentence, ...lines.map(id => S[id])], knownIds)};
}

function dialogueQuestion(state, missionId, knownIds = []) {
  const scene = DIALOGUES[missionId];
  const sentence = S[scene.sentenceId];
  const responses = scene.distractors.map(id => S[id]);
  return {type: 'dialogue', missionId, sentenceId: sentence.id,
    focusId: sentence.wordIds[0], glossary: glossaryFor(state, [sentence, ...responses], knownIds),
    options: choiceOrder(responses.map(response => response.hanzi), sentence.hanzi)};
}

function reverseQuestion(state, id, previous = null) {
  const old = state.entries[id]?.hanzi.lastExercise;
  const modes = IMAGE_WORDS.has(W[id].hanzi) ? ['image', 'pinyin', 'meaning'] : ['pinyin', 'meaning'];
  const last = previous?.cue || old;
  const cue = modes[(modes.indexOf(last) + 1) % modes.length];
  const options = choiceOrder(hanziChoices(id).filter(choice => choice !== W[id].hanzi), W[id].hanzi, previous?.options);
  return {type: 'hanzi', wordId: id, cue, options};
}

function taskFor(state, id, skill, previous = null) {
  if (skill === 'meaning') return {type: 'meaning', wordId: id,
    options: choiceOrder(choicesFor(id).filter(choice => choice !== W[id].vi), W[id].vi, previous?.options)};
  if (skill === 'reading') return {type: 'reading', wordId: id};
  if (skill === 'hanzi') return reverseQuestion(state, id, previous);
  const sentence = sentenceFor(state, id);
  if (sentence && previous?.type !== 'build' && !state.entries[id]?.usage.lastExercise.startsWith('build:')) {
    return buildQuestion(state, sentence, id);
  }
  return sampleCloze(state, id, [], previous) || (sentence && buildQuestion(state, sentence, id));
}

function earlierWordIds(mission) {
  const index = D.missions.findIndex(item => item.id === mission.id);
  return D.missions.slice(0, index).reverse().flatMap(item => item.wordIds);
}

function createTrail(state, mission) {
  const ids = new Set(mission.wordIds);
  const earlier = earlierWordIds(mission);
  const earlierIds = new Set(earlier);
  const due = dueItems(state, D.words.length * SKILLS.length)
    .map(item => item.id).filter(id => earlierIds.has(id) && !ids.has(id));
  const regionalRecall = mission.step % 3 === 0 && ids.size < MAX_TRAIL_SPOTS
    ? due.find(id => R[mission.regionId].wordIds.includes(id)) : null;
  if (regionalRecall) ids.add(regionalRecall);
  for (const id of [...due, ...earlier]) {
    if (ids.size >= MIN_TRAIL_SPOTS) break;
    ids.add(id);
  }
  const wordIds = shuffle([...ids]);
  const order = shuffle(wordIds);
  if (order.every((id, index) => id === wordIds[index])) order.push(order.shift());
  return {type: 'trail', missionId: mission.id, wordIds, order};
}

function restoreTrail(raw, state, mission) {
  const valid = new Set([...mission.wordIds, ...earlierWordIds(mission)]);
  const wordIds = Array.isArray(raw.wordIds) ? raw.wordIds : [];
  if (wordIds.length < MIN_TRAIL_SPOTS || wordIds.length > MAX_TRAIL_SPOTS ||
      new Set(wordIds).size !== wordIds.length || !wordIds.every(id => valid.has(id)) ||
      !mission.wordIds.every(id => wordIds.includes(id))) {
    return createTrail(state, mission);
  }
  const order = raw.order;
  if (!Array.isArray(order) || order.length !== wordIds.length ||
      new Set(order).size !== order.length || !order.every(id => wordIds.includes(id))) {
    return {type: 'trail', missionId: mission.id, wordIds, order: shuffle(wordIds)};
  }
  return {type: 'trail', missionId: mission.id, wordIds, order};
}

function trailState(task, raw) {
  const visited = Array.isArray(raw?.visited)
    ? [...new Set(raw.visited.filter(id => task.wordIds.includes(id)))] : [];
  const recall = raw?.recall === true && visited.length === task.wordIds.length;
  const solved = [];
  if (recall && Array.isArray(raw.solved)) {
    for (const id of task.order) {
      if (!raw.solved.includes(id)) break;
      solved.push(id);
    }
  }
  const pending = recall && solved.length < task.order.length;
  const missed = pending && task.wordIds.includes(raw.missed) && !solved.includes(raw.missed) &&
    raw.missed !== task.order[solved.length] ? raw.missed : null;
  return {visited, solved, recall, missed, hinted: pending && raw.hinted === true,
    selected: !recall && visited.includes(raw?.selected) ? raw.selected : null};
}

function visitTrail(task, saved, id) {
  const progress = trailState(task, saved);
  const result = {progress, found: false, correct: null};
  if (!task.wordIds.includes(id) || progress.solved.includes(id)) return result;
  if (!progress.recall) {
    progress.selected = id;
    result.found = !progress.visited.includes(id);
    if (result.found) progress.visited.push(id);
    return result;
  }
  result.correct = task.order[progress.solved.length] === id;
  if (result.correct) {
    progress.solved.push(id);
    progress.missed = null;
    progress.hinted = false;
  } else {
    progress.missed = id;
  }
  return result;
}

function adventureQueue(state, mission) {
  const trail = createTrail(state, mission);
  const configured = S[D.adventureMissions?.[mission.id]?.sentenceId];
  const candidates = D.sentences.filter(sentence => canBuild(sentence) &&
    sentence.wordIds.some(id => mission.wordIds.includes(id)));
  const rank = sentence => glossaryFor(state, [sentence], trail.wordIds).length * 6
    - sentence.wordIds.filter(id => mission.wordIds.includes(id)).length * 3 + sentence.tokens.length;
  const preferred = (mission.id === 'm001' && S.bs02) || (mission.id === 'm006' && S.bs09);
  const passage = candidates.includes(configured) ? configured
    : candidates.includes(preferred) ? preferred
    : shuffle(candidates).sort((a, b) => rank(a) - rank(b))[0];
  const focusId = passage.wordIds.find(id => mission.wordIds.includes(id));
  return [trail, {...buildQuestion(state, passage, focusId, trail.wordIds), gate: true}];
}

function missionQueue(state, mission) {
  const ids = mission.wordIds;
  const queue = [];
  for (const id of ids) {
    queue.push({type: 'learn', wordId: id}, taskFor(state, id, 'meaning'));
  }
  if (mission.step === 1) queue.push(storyQuestion(state, mission.regionId, ids));
  for (const id of shuffle(ids)) queue.push(taskFor(state, id, 'reading'));
  const toneId = ids.find(id => toneOptions(W[id]).length > 1);
  if (toneId && [2, 3].includes(mission.step)) queue.push({type: 'tone', wordId: toneId, options: toneOptions(W[toneId])});
  const illustrated = ids.filter(id => IMAGE_WORDS.has(W[id].hanzi));
  queue.push(reverseQuestion(state, shuffle(illustrated.length ? illustrated : ids)[0]));
  for (const id of shuffle(ids).slice(0, 2)) {
    const cloze = sampleCloze(state, id, ids);
    if (cloze) queue.push(cloze);
  }
  queue.push(...sentenceTasks(state, ids, 2, mission.id === 'm006' ? 'bs09' : null));
  if (DIALOGUES[mission.id]) queue.push(dialogueQuestion(state, mission.id, ids));
  const regionalStory = passageFor(mission.regionId);
  if (mission.id === 'm004') {
    queue.push(passageQuestion(state, S.bs05, 'w087', ['bs03', 'bs04'], ids));
  } else if (mission.id === 'm006') {
    // The question about a new friend's name also returns as an independent reading task.
    queue.push(passageQuestion(state, S.bs09, 'w071', [], ids));
  } else if (mission.step === R[mission.regionId].missionIds.length) {
    const candidates = (regionalStory?.sentences || []).map(id => S[id]).filter(sentence => sentence?.wordIds.length);
    const best = candidates.sort((a, b) => glossaryFor(state, [a], ids).length - glossaryFor(state, [b], ids).length)[0];
    if (best) queue.push(passageQuestion(state, best, best.wordIds.find(id => ids.includes(id)) || best.wordIds[0], [], ids));
  }
  const old = dueItems(state, 24).filter(item => !ids.includes(item.id)).slice(0, Math.min(3, Math.ceil(ids.length / 2)));
  for (const item of old) {
    const task = taskFor(state, item.id, item.sk);
    if (task) queue.push(task);
  }
  return queue;
}

function reviewQueue(state, max = 10, skillFilter = 'all') {
  const queue = [];
  const keys = new Set();
  const wordIds = new Set();
  const due = dueItems(state, D.words.length * SKILLS.length, skillFilter);
  // Give each struggling word one turn before assigning several exercises for the same word.
  const unique = due.filter(item => {
    if (wordIds.has(item.id)) return false;
    wordIds.add(item.id);
    return true;
  });
  for (const item of [...unique, ...due]) {
    if (queue.length >= max) break;
    const key = item.id + ':' + item.sk;
    if (keys.has(key)) continue;
    const task = taskFor(state, item.id, item.sk);
    if (!task) continue;
    keys.add(key);
    queue.push(task);
  }
  // A voluntary refresher is possible even when nothing is due. Early successes leave the schedule alone.
  if (!queue.length) {
    const seen = shuffle(D.words.filter(word => state.entries[word.id]?.seenCount));
    for (const word of seen.slice(0, max)) {
      const skill = skillFilter === 'all' ? shuffle(SKILLS)[0] : skillFilter;
      const task = taskFor(state, word.id, skill);
      if (task) queue.push(task);
    }
  }
  return shuffle(queue);
}

function practiceWord(state, id) {
  const queue = SKILLS.map(skill => taskFor(state, id, skill)).filter(Boolean);
  if (!state.entries[id]?.seenCount) queue.unshift({type: 'learn', wordId: id});
  return queue;
}

window.HSK_ENGINE = {D, W, M, R, S, ST, KEY, SKILLS, DIALOGUES, shuffle, load, save, normalize,
  fresh, see, ensure, grade, dueFor, mastered, stateOf, dueItems, stats, matchPinyin, choicesFor,
  hanziChoices, sentenceFor, sentenceTasks, sampleCloze, blankWord, passageFor, missionQueue, reviewQueue,
  adventureQueue, trailState, visitTrail, practiceWord, taskFor, recordArcade, storageHealthy: () => storageHealthy};
})();
