(() => {
  'use strict';

  const games = Object.freeze({
    wind: {
      name: 'Đường Gió', glyph: '风', ability: 'Nhận diện từ',
      description: 'Lái diều qua những cổng chữ dọc đường đêm.',
    },
    echo: {
      name: 'Trạm Vọng Âm', glyph: '声', ability: 'Nghe và ghi Pinyin',
      description: 'Bắt sóng Quan thoại và gõ lại để nối các trạm.',
    },
    riddle: {
      name: 'Mật Mã Âm Tiết', glyph: '锁', ability: 'Âm đầu, vần và thanh',
      description: 'Chỉnh ba vòng âm để mở khóa bằng Pinyin.',
    },
    lights: {
      name: 'Hồ Đom Đóm', glyph: '萤', ability: 'Gọi lại từ theo nghĩa',
      description: 'Thắp hai chữ theo thứ tự để bắc một vệt sáng qua hồ.',
    },
    pinyin: {
      name: 'Sao Pinyin', glyph: '音', ability: 'Phát âm và thanh điệu',
      description: 'Ngắm các ngôi sao chữ Hán, gõ Pinyin để phóng luồng sáng.',
    },
    strokes: {
      name: 'Dấu Mực', glyph: '笔', ability: 'Thứ tự nét',
      description: 'Dùng ngón tay đặt từng nét đúng hướng để hoàn thành chữ.',
    },
    pairs: {
      name: 'Đèn Đôi', glyph: '双', ability: 'Nhớ mặt chữ và nghĩa',
      description: 'Lật đèn úp và tìm hai chiếc mang cùng một từ.',
    },
    flow: {
      name: 'Dòng Chữ', glyph: '舟', ability: 'Trật tự từ trong câu',
      description: 'Đón các thuyền chữ và xếp thành câu để đưa thuyền qua bến.',
    },
  });

  function words(engine, state, limit) {
    const seen = engine.D.words.filter(word => state.entries[word.id]?.seenCount);
    const due = [...new Set(engine.dueItems(state, engine.D.words.length * engine.SKILLS.length)
      .map(item => item.id))].map(id => engine.W[id]);
    const priority = engine.shuffle(due.slice(0, Math.max(12, limit)));
    const pool = [...priority, ...engine.shuffle(seen), ...engine.shuffle(engine.D.words.slice(0, 30)), ...engine.D.words];
    return [...new Set(pool)].slice(0, limit);
  }

  function sentences(engine, state, limit) {
    const candidates = engine.D.sentences.filter(sentence => sentence.tokens.length >= 2 &&
      sentence.tokens.length <= 7 && new Set(sentence.tokens).size >= 2);
    const familiar = sentence => [...new Set(sentence.wordIds)]
      .filter(id => state.entries[id]?.seenCount).length;
    const beginner = new Set(['bs02', 'bs04', 'bs09', 'bs11', 'bs16', 'bs20', 'bs23', 'bs24']);
    const ranked = engine.shuffle(candidates).map(sentence => {
      const known = familiar(sentence);
      const extra = sentence.wordIds.length - known;
      return {sentence, rank: known ? known * 3 - extra : beginner.has(sentence.id) ? 0 : -10};
    }).sort((a, b) => b.rank - a.rank);
    return ranked.slice(0, limit).map(item => item.sentence);
  }

  window.HSK_ARCADE = {games, words, sentences};
})();
