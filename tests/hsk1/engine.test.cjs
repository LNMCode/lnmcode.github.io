const assert = require('node:assert/strict');
const test = require('node:test');
const { loadGame } = require('./helpers.cjs');

test('nhận Pinyin có dấu và số thanh, thanh nhẹ và cách đọc bổ sung', () => {
  const { engine } = loadGame();
  const word = (hanzi) => engine.D.words.find((entry) => entry.hanzi === hanzi);
  assert.equal(engine.matchPinyin('  NǏ HǍO! ', word('你好')), 'good');
  assert.equal(engine.matchPinyin('ni3hao3', word('你好')), 'good');
  assert.equal(engine.matchPinyin('nǐ hǎo'.normalize('NFD'), word('你好')), 'good');
  assert.equal(engine.matchPinyin('ming2 zi5', word('名字')), 'good');
  assert.equal(engine.matchPinyin('ming2zi0', word('名字')), 'good');
  assert.equal(engine.matchPinyin('shuí', word('谁')), 'good');
  assert.equal(engine.matchPinyin('nv3', word('女')), 'good');
  assert.equal(engine.matchPinyin('nu3', word('女')), 'wrong');
  assert.equal(engine.matchPinyin('ni hao', word('你好')), 'almost');
  assert.notEqual(engine.matchPinyin('ni4 hao3', word('你好')), 'good');
  assert.equal(engine.matchPinyin('sha', word('你好')), 'wrong');
  assert.equal(engine.matchPinyin('   ', word('你好')), 'empty');
  for (const entry of engine.D.words) {
    assert.equal(engine.matchPinyin(entry.pinyin, entry), 'good', entry.hanzi);
    for (const alternative of entry.pinyinAlternatives ?? []) {
      assert.equal(engine.matchPinyin(alternative, entry), 'good', entry.hanzi);
    }
  }
});

test('lịch ôn riêng từng kỹ năng, ôn đúng hạn giãn lịch và sai rút ngắn lịch', () => {
  const { engine } = loadGame();
  const state = engine.fresh();
  const id = engine.D.words[0].id;
  const now = Date.now();
  engine.see(state, id);
  assert.ok(engine.dueItems(state, 5, 'meaning', now).some((item) => item.id === id));
  const initial = { ...engine.grade(state, id, 'meaning', 'good', now) };
  assert.ok(initial.due > now);
  assert.equal(state.entries[id].reading.attempts, 0);
  assert.equal(state.entries[id].usage.attempts, 0);
  const drill = { ...engine.grade(state, id, 'meaning', 'good', now + 1) };
  assert.ok(drill.due <= initial.due, 'Luyện liên tiếp chưa đến hạn không kéo dài lịch');
  assert.equal(engine.mastered(state, id, now + 60 * 60 * 1000), false);
  const next = { ...engine.grade(state, id, 'meaning', 'good', initial.due) };
  assert.ok(next.interval > initial.interval);
  const wrong = engine.grade(state, id, 'meaning', 'again', next.due);
  assert.ok(wrong.interval < next.interval);
  assert.equal(wrong.mistakes, 1);
  const review = engine.reviewQueue(state, 5, 'reading');
  assert.ok(review.length > 0 && review.length <= 5);
  assert.ok(review.every((task) => task.type === 'reading'));
  const original = engine.taskFor(state, id, 'meaning');
  const retry = engine.taskFor(state, id, 'meaning', original);
  assert.notDeepEqual(Array.from(retry.options), Array.from(original.options));
});

test('thành thạo đòi hỏi nhớ đúng nhiều ngày ở từng kỹ năng', () => {
  const { engine } = loadGame();
  const state = engine.fresh();
  const id = engine.D.words[0].id;
  const day = 1440 * 60 * 1000;
  const start = Date.now();
  for (const skill of ['meaning', 'reading', 'usage']) {
    engine.grade(state, id, skill, 'good', start);
    engine.grade(state, id, skill, 'good', start + day);
  }
  assert.equal(engine.mastered(state, id), false);
  for (const skill of ['meaning', 'reading', 'usage']) {
    engine.grade(state, id, skill, 'good', start + 8 * day);
  }
  assert.equal(engine.mastered(state, id), true);
  engine.grade(state, id, 'usage', 'again', start + 8 * day + 1000);
  assert.equal(engine.mastered(state, id), false);
});

test('lưu và nhập tiến độ gồm chặng, kỹ năng và vị trí đang chơi', () => {
  const records = new Map();
  const { engine } = loadGame(records);
  const state = engine.fresh();
  const first = engine.D.missions[0];
  const id = first.wordIds[0];
  engine.see(state, id);
  engine.grade(state, id, 'reading', 'good');
  state.completed.push(first.id);
  const second = engine.D.missions[1];
  state.active = {
    mode: 'mission', missionId: second.id, queue: engine.missionQueue(state, second),
    index: 1, intro: false, chosen: [], hint: false, feedback: null, repeats: {}, right: 0, total: 0,
  };
  engine.save(state);

  const { engine: afterReload } = loadGame(records);
  const saved = afterReload.load();
  assert.ok(saved.completed.includes(first.id));
  assert.equal(saved.entries[id].reading.correct, 1);
  assert.equal(saved.active.missionId, second.id);
  assert.equal(saved.active.index, 1);
  assert.equal(saved.active.queue[1].type, state.active.queue[1].type);
  const exported = JSON.parse(JSON.stringify(saved));
  assert.equal(afterReload.normalize(exported).entries[id].reading.correct, 1);
  assert.throws(() => afterReload.normalize({ schema: 99, entries: {}, completed: [] }));
});

test('đọc sao lưu schema 2 và tiến độ của bản 27 từ', () => {
  const records = new Map();
  const { engine } = loadGame(records);
  const oldId = engine.D.words.find((word) => word.hanzi === '你好').id;
  const v2 = {
    schema: 2,
    createdAt: Date.now() - 1000,
    entries: {
      [oldId]: {
        firstSeen: Date.now() - 1000,
        seenCount: 1,
        meaning: {},
        reading: {},
        usage: { attempts: 1, correct: 1, interval: 10, streak: 1, due: Date.now() + 600_000, mistakes: 0 },
      },
    },
    completed: ['m001', 'invalid', 'm001'],
    active: {
      mode: 'review',
      queue: [
        { type: 'invalid' },
        { type: 'build', sentenceId: 'bs09', chosen: [0], tiles: [] },
      ],
      index: 1,
      chosen: [0, 0, -1, 99],
    },
  };
  const imported = engine.normalize(v2);
  assert.equal(imported.schema, engine.fresh().schema);
  assert.equal(imported.entries[oldId].seenCount, 1);
  assert.equal(imported.entries[oldId].usage.correct, 1);
  assert.deepEqual(Array.from(imported.completed), ['m001']);
  assert.equal(imported.active.index, 0);
  assert.equal(imported.active.queue[0].tiles.length, engine.S.bs09.tokens.length);

  records.clear();
  records.set('hanNguPhieuLuu_v1', JSON.stringify({
    entries: { nihao: { seen: 2, pinyin: { attempts: 3, correct: 2, streak: 1 } } },
  }));
  const migrated = loadGame(records).engine.load();
  assert.equal(migrated.entries[oldId].seenCount, 2);
  assert.equal(migrated.entries[oldId].reading.correct, 2);
});

test('đi hết 72 nhiệm vụ, bài tập có đáp án và từ chưa học có chú giải', () => {
  const { engine, data } = loadGame();
  const state = engine.fresh();
  const learned = new Set();
  const taskTypes = new Set();
  for (const mission of data.missions) {
    const queue = engine.missionQueue(state, mission);
    assert.ok(queue.length);
    const learnedThisMission = new Set();
    for (const task of queue) {
      const label = `${mission.id} ${task.type} ${task.wordId ?? task.sentenceId ?? ''}`;
      taskTypes.add(task.type);
      if (task.type === 'learn') {
        assert.ok(mission.wordIds.includes(task.wordId), label);
        engine.see(state, task.wordId);
        learned.add(task.wordId);
        learnedThisMission.add(task.wordId);
        continue;
      }
      if (task.wordId) assert.ok(learned.has(task.wordId), label);
      if (task.focusId) assert.ok(learned.has(task.focusId) || task.glossary?.includes(task.focusId), label);
      const references = [task.sentenceId, ...(task.sentenceIds ?? []), ...(task.context ?? [])].filter(Boolean);
      for (const id of references) {
        const sentence = engine.S[id];
        assert.ok(sentence, label);
        for (const wordId of sentence.wordIds) {
          assert.ok(learned.has(wordId) || task.glossary?.includes(wordId), `${label} chưa giới thiệu ${wordId}`);
        }
      }
      if (task.sentenceId) {
        const sentence = engine.S[task.sentenceId];
        if (task.type === 'build') {
          assert.deepEqual(Array.from(task.tiles, (tile) => tile.text).sort(), Array.from(sentence.tokens).sort(), label);
        }
        if (task.type === 'cloze') {
          assert.ok(sentence.wordIds.includes(task.wordId), label);
          assert.ok(task.options.includes(engine.W[task.wordId].hanzi), label);
        }
        if (task.type === 'passage') assert.ok(task.options.includes(sentence.vi), label);
        if (task.type === 'dialogue') assert.ok(task.options.includes(sentence.hanzi), label);
      }
      if (task.type === 'meaning') assert.ok(task.options.includes(engine.W[task.wordId].vi), label);
      if (task.type === 'hanzi') assert.ok(task.options.includes(engine.W[task.wordId].hanzi), label);
      if (task.wordId && task.options) assert.equal(new Set(task.options).size, task.options.length, label);
    }
    assert.equal(learnedThisMission.size, mission.wordIds.length, mission.id);
    state.completed.push(mission.id);
  }
  assert.equal(learned.size, 300);
  assert.equal(engine.stats(state).quests, 72);
  for (const required of ['learn', 'meaning', 'reading', 'hanzi', 'cloze', 'build', 'story', 'passage', 'dialogue']) {
    assert.ok(taskTypes.has(required), required);
  }
});

test('đi hết 72 chặng phiêu lưu, tìm đủ 300 từ và có câu mở lối hợp lệ', () => {
  const { engine, data } = loadGame();
  const state = engine.fresh();
  const introduced = new Set();

  for (const mission of data.missions) {
    const queue = engine.adventureQueue(state, mission);
    assert.deepEqual(Array.from(queue, (task) => task.type), ['trail', 'build'], mission.id);
    const [trail, gate] = queue;
    assert.equal(trail.missionId, mission.id);
    assert.ok(trail.wordIds.length >= 3 && trail.wordIds.length <= 5, mission.id);
    assert.equal(new Set(trail.wordIds).size, trail.wordIds.length, mission.id);
    assert.deepEqual([...trail.order].sort(), [...trail.wordIds].sort(), mission.id);
    assert.notDeepEqual([...trail.order], [...trail.wordIds], mission.id);
    assert.ok(mission.wordIds.every((id) => trail.wordIds.includes(id)), mission.id);
    const available = new Set([...introduced, ...mission.wordIds]);
    assert.ok(trail.wordIds.every((id) => available.has(id)), mission.id);

    let progress = engine.trailState(trail);
    for (const id of trail.wordIds) {
      const visit = engine.visitTrail(trail, progress, id);
      assert.equal(visit.found, true, mission.id);
      assert.equal(visit.correct, null, mission.id);
      progress = visit.progress;
      engine.see(state, id);
      introduced.add(id);
    }
    progress = engine.trailState(trail, { ...progress, recall: true });
    for (const id of trail.order) {
      const visit = engine.visitTrail(trail, progress, id);
      assert.equal(visit.correct, true, mission.id);
      progress = visit.progress;
    }
    assert.deepEqual([...progress.solved], [...trail.order], mission.id);

    const sentence = engine.S[gate.sentenceId];
    assert.ok(sentence && gate.gate, mission.id);
    assert.ok(mission.wordIds.includes(gate.focusId), mission.id);
    assert.ok(sentence.wordIds.includes(gate.focusId), mission.id);
    assert.ok(sentence.wordIds.every((id) => introduced.has(id) || gate.glossary.includes(id)), mission.id);
    assert.deepEqual(Array.from(gate.tiles).sort((a, b) => a.index - b.index).map((tile) => tile.text),
      [...sentence.tokens], mission.id);
    if (data.adventureMissions[mission.id]?.sentenceId) {
      assert.equal(gate.sentenceId, data.adventureMissions[mission.id].sentenceId, mission.id);
    }
    engine.grade(state, gate.focusId, 'usage', 'good');
    state.completed.push(mission.id);
  }

  assert.equal(introduced.size, 300);
  assert.equal(engine.stats(state).quests, 72);
  assert.equal(engine.S[data.adventureMissions.m006.sentenceId].hanzi, '你叫什么名字？');
});

test('giữ đúng đèn đã khám phá, gợi ý, chỗ đang nhớ và thứ tự thẻ sau khi mở lại', () => {
  const records = new Map();
  const { engine, data } = loadGame(records);
  const state = engine.fresh();
  const mission = data.missions[0];
  const queue = engine.adventureQueue(state, mission);
  const [trail, gate] = queue;
  const firstSpot = trail.wordIds[0];
  const firstWord = trail.order[0];
  const secondWord = trail.order[1];

  let progress = engine.visitTrail(trail, null, firstSpot).progress;
  const repeated = engine.visitTrail(trail, progress, firstSpot);
  assert.equal(repeated.found, false);
  assert.equal(repeated.progress.selected, firstSpot);
  const premature = engine.trailState(trail, { ...progress, recall: true });
  assert.equal(premature.recall, false);
  for (const id of trail.wordIds) progress = engine.visitTrail(trail, progress, id).progress;

  progress = engine.trailState(trail, { ...progress, recall: true, hinted: true });
  const wrong = engine.visitTrail(trail, progress, secondWord);
  assert.equal(wrong.correct, false);
  assert.equal(wrong.progress.missed, secondWord);
  assert.equal(wrong.progress.hinted, true);
  assert.equal(wrong.progress.solved.length, 0);
  const right = engine.visitTrail(trail, wrong.progress, firstWord);
  assert.equal(right.correct, true);
  assert.equal(right.progress.missed, null);
  assert.equal(right.progress.hinted, false);

  state.active = { mode: 'mission', missionId: mission.id, queue, index: 0, trail: right.progress };
  engine.save(state);
  const { engine: reloaded } = loadGame(records);
  const saved = reloaded.load();
  assert.equal(saved.active.index, 0);
  assert.deepEqual([...saved.active.queue[0].wordIds], [...trail.wordIds]);
  assert.deepEqual([...saved.active.queue[0].order], [...trail.order]);
  assert.deepEqual([...saved.active.trail.solved], [firstWord]);
  assert.equal(saved.active.trail.visited.length, trail.wordIds.length);
  assert.equal(saved.active.trail.recall, true);
  assert.equal(saved.active.queue[1].gate, true);

  const validGateBackup = JSON.parse(JSON.stringify(state));
  validGateBackup.active.index = 1;
  validGateBackup.active.chosen = [0];
  const restoredGate = reloaded.normalize(validGateBackup).active;
  assert.deepEqual([...restoredGate.chosen], [0]);
  assert.equal(restoredGate.queue[1].sentenceId, gate.sentenceId);

  const damaged = JSON.parse(JSON.stringify(state));
  damaged.active.trail.solved = [secondWord, 'bad'];
  damaged.active.trail.visited.push(firstSpot, 'bad');
  const cleaned = reloaded.normalize(damaged).active.trail;
  assert.equal(cleaned.visited.length, trail.wordIds.length);
  assert.equal(cleaned.solved.length, 0);
});
