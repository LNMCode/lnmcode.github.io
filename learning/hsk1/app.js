(function(){
'use strict';
const E=window.HSK_ENGINE,D=E.D,W=E.W,M=E.M,R=E.R,S=E.S,ST=E.ST;
const app=document.getElementById('app');
const arcade=window.HSK_ARCADE;
const reduceMedia=matchMedia('(prefers-reduced-motion: reduce)');
const cinema=window.HSK_CINEMA?.mount(document.getElementById('hsk-cinema'));
const gameIds=Object.keys(arcade?.games||{});
let state=E.load();
let arcadeId=null, stopArcade=null;
let arcadeFocus=0;
let arcadeTour=null;
let view='home', selectedRegion=null,wordTerm='',wordFilter='all',dictLimit=35,wordId=null,storyRegion=null,storyShowPinyin=false,storyRevealed={},reviewSkill='all',reviewCount=state.preferences.sessionSize,toaster=null;
let renderedScene = '';
const esc=s=>String(s??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const hanzi=s=>`<span lang="zh-Hans" class="zh">${esc(s)}</span>`;
const fmtPercent=(a,b)=>b?Math.round(a/b*100):0;
const onceDate=stamp=>stamp?new Date(stamp).toLocaleString('vi-VN',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'}):'—';
const skillNames={meaning:'Nghĩa',reading:'Pinyin',hanzi:'Mặt chữ',usage:'Vận dụng'};
const wordStates={new:'Chưa học',seen:'Mới học',learning:'Đang ghi nhớ',due:'Cần ôn',mastered:'Đã nắm vững','long-term':'Duy trì dài hạn'};
const sessionTimes={5:'3–5 phút',10:'10–15 phút',20:'20 phút'};
const resultNames={good:'Đúng',almost:'Gần đúng',again:'Cần luyện lại'};
const offlineStatus=()=>window.HSK_OFFLINE?.status()||'Đang kiểm tra khả năng chơi ngoại tuyến…';
const sourceUrl=D.meta.syllabusUrl||'https://www.chinesetest.cn/Development?lang=cn';
function icon(name){
 const paths={home:'<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/>',map:'<circle cx="12" cy="12" r="9"/><path d="m15 8.5-2 5-5 2 2-5z"/>',repeat:'<path d="m20 7-3-3-3 3M4 17l3 3 3-3M17 4H9a5 5 0 0 0-5 5M7 20h8a5 5 0 0 0 5-5"/>',book:'<path d="M3 4h7a3 3 0 0 1 3 3v14a3 3 0 0 0-3-3H3zM21 4h-5a3 3 0 0 0-3 3v14a3 3 0 0 1 3-3h5z"/>',chart:'<path d="M4 20V12M10 20V6M16 20V9M22 20V3"/>',settings:'<path d="M4 8h16M4 16h16M8 5v6M16 13v6"/>',arrow:'<path d="M5 12h14m-6-6 6 6-6 6"/>',left:'<path d="m15 18-6-6 6-6"/>',sound:'<path d="M4 9h4l5-4v14l-5-4H4zM17 9a4 4 0 0 1 0 6M19 6a8 8 0 0 1 0 12"/>',check:'<path d="m4 12 5 5L20 6"/>',spark:'<path d="m12 2 2 7 7 3-7 3-2 7-2-7-7-3 7-3z"/>',download:'<path d="M12 3v12m-4-4 4 4 4-4M4 17v4h16v-4"/>',upload:'<path d="M12 21V9m-4 4 4-4 4 4M4 7V3h16v4"/>',search:'<circle cx="11" cy="11" r="7"/><path d="m16 16 5 5"/>',play:'<path d="m8 5 11 7-11 7z"/>',heart:'<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8z"/>',calendar:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 10h18"/>',help:'<circle cx="12" cy="12" r="9"/><path d="M9.4 9a2.8 2.8 0 1 1 4.2 2.6c-1.2.7-1.6 1.3-1.6 2.4M12 17h.01"/>',close:'<path d="M5 5l14 14M19 5 5 19"/>',cloud:'<path d="M6 19a4 4 0 0 1-1-8A6 6 0 0 1 17 9a5 5 0 0 1 0 10z"/>',star:'<path d="m12 2 3 6 7 .9-5 5 1.3 7L12 17.6 5.7 21 7 14 2 9l7-.9z"/>'};
 return `<svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${paths[name]||paths.spark}</svg>`;
}
function toast(message){let n=document.getElementById('toast');if(!n){n=document.createElement('div');n.id='toast';n.setAttribute('role','status');document.body.appendChild(n);}n.textContent=message;n.classList.add('show');clearTimeout(toaster);toaster=setTimeout(()=>n.classList.remove('show'),2800);}
function scrollUp(){window.scrollTo(0,0);}
function focusPlayHeading(){
  const heading=app.querySelector('.play-main h2, .play-main h1');
  if(heading){heading.tabIndex=-1;heading.focus({preventScroll:true});}
}
function saveUnlessUnavailable(nextState){
  if(E.save(nextState))return true;
  toast('Trình duyệt không lưu được thay đổi. Tiến độ hiện tại vẫn đang mở.');
  return false;
}

function lowMotion() {
  return state.preferences.lowMotion || reduceMedia.matches;
}

function bindCinemaScene() {
  const scene = view === 'arcade-game' ? arcadeId : view;
  const surface = app.querySelector('main.app-main');
  if (!surface) return;
  const stages = scene === 'play'
    ? '.adventure-board, .adventure-gate, .quest-screen .scene, .feedback-answer'
    : '[data-cinema-stage], .scene, .hero-hanzi, .card';
  const anchor = [...surface.querySelectorAll(stages)].find(element => element.getClientRects().length);
  const cover = surface.querySelector('[data-cinema-cover]');
  const region = selectedRegion || nextMission().regionId;
  const regionIndex = D.regions.findIndex(item=>item.id===(scene==='play'?M[state.active?.missionId]?.regionId:region));
  const quietFocus={review:4,words:5,reader:3,settings:0};
  const focus = scene === 'arcade' ? arcadeFocus : quietFocus[scene] ?? Math.max(0,regionIndex);
  if (renderedScene !== scene && !lowMotion()) surface.classList.add('cinema-scene-entry');
  renderedScene = scene;
  cinema?.setScene(scene, {lowMotion:lowMotion(), anchor:anchor||cover, cover, focus});
}

function motion(type, target, detail) {
  if (lowMotion()) return;
  cinema?.cue(type, target, detail);
}

const adventureDefaults = {
  scene: 'school',
  locationNames: ['Lối đá', 'Mái hiên', 'Gốc cây', 'Bậc thềm', 'Đầu lối'],
  gate: 'Đặt các mảnh chữ vào bảng gỗ để hoàn thành lời nhắn mở đường.',
  unlock: 'Lời nhắn đã hoàn chỉnh. Con đường phía trước sáng lên.'
};

function adventureFor(mission) {
  return {...adventureDefaults, ...D.adventures?.[mission.regionId], ...D.adventureMissions?.[mission.id]};
}


function scene(region,small=false) {
  const selected = typeof region === 'string' ? R[region] : region || D.regions[0];
  const setting = D.adventures?.[selected.id]?.scene || adventureDefaults.scene;
  return `<div class="scene ${small?'small':''}" data-scene="${esc(setting)}">
    <span class="scene-caption">${esc(selected.name)}</span>
  </div>`;
}
function btn(action,text,style='primary',extra=''){return `<button type="button" class="btn ${style}" data-action="${esc(action)}" ${extra}>${text}</button>`;}
function topbar(sub='HSK 1 · 300 từ'){return `<header class="topbar"><button class="brand" data-action="nav" data-view="home" aria-label="Về trang chủ"><span class="brand-mark">汉</span><span><strong>Hán Ngữ Phiêu Lưu</strong><small>${esc(sub)}</small></span></button><button class="round-button" data-action="nav" data-view="settings" aria-label="Cài đặt">${icon('settings')}</button></header>`;}
function nav(active){return `<nav class="bottom-nav" aria-label="Điều hướng chính">${[['home','home','Trang chủ'],['map','map','Khám phá'],['arcade','spark','Sân chơi'],['review','repeat','Ôn tập'],['words','book','Từ điển']].map(([name,ico,lab])=>`<button class="nav-item ${active===name?'active':''}" data-action="nav" data-view="${name}" aria-label="${lab}"${active===name?' aria-current="page"':''}>${icon(ico)}<span>${lab}</span></button>`).join('')}</nav>`;}
function cover(kind, glyph='', scenery='') {
  return `<div class="film-stage film-stage-${esc(kind)}" data-cinema-cover data-palette="${esc(kind)}" data-art="${esc(scenery)}" aria-hidden="true">
    <div class="film-fallback">${glyph?hanzi(glyph):''}<i></i><i></i><i></i></div>
  </div>`;
}
function frame(html,tab,sub){
  const quiet={words:['字','market'],reader:['读','river'],progress:['路','river'],settings:['灯','school']};
  return `<main class="app-main page-${esc(view)}">${topbar(sub)}${quiet[view]?cover('quiet',...quiet[view]):''}${html}</main>${nav(tab)}`;
}
function pill(text,cls=''){return `<span class="pill ${cls}">${esc(text)}</span>`;}
function progressBar(a,b,label='Tiến độ'){return `<div class="meter" role="progressbar" aria-label="${esc(label)}" aria-valuenow="${a}" aria-valuemin="0" aria-valuemax="${b}"><span style="width:${fmtPercent(a,b)}%"></span></div>`;}
function nextMission(){return D.missions.find(m=>!state.completed.includes(m.id))||D.missions[D.missions.length-1];}
function regionCompleted(r){return r.missionIds.filter(mid=>state.completed.includes(mid)).length;}
function home(){const st=E.stats(state),m=nextMission(),r=R[m.regionId],isActive=!!state.active;
 const oldMission=state.active?.mode==='mission'&&state.active.queue[0]?.type!=='trail';
 const playAction=oldMission?'switch-to-trail':isActive?'resume':'begin-next';
 const playLabel=oldMission?'Thử đường đèn mới':isActive?'Tiếp tục đang chơi':'Tiếp tục phiêu lưu';
 return frame(`<section class="hero story-hero">
   ${cover('home','灯',D.adventures?.[r.id]?.scene||'school')}
   <div class="hero-body">
     <p class="scene-location">${icon('map')} ${esc(r.name)}</p>
     <h1>Theo dấu <em>đèn lồng</em></h1>
     <p class="subtle">Cùng Cáo Đèn gặp chữ Hán, thắp sáng đường đêm và ghép lời nhắn để mở lối.</p>
     <div class="hero-stats"><b>${st.seen}<span>/300 từ đã gặp</span></b><b>${st.quests}<span>/${st.totalQuests} chặng</span></b></div>
     ${progressBar(st.seen,300,'Từ vựng đã gặp')}
     <div class="top-buttons">${btn(playAction,`${icon('play')} ${playLabel}`)}${btn('nav',`${icon('repeat')} Ôn từ`, 'button-soft','data-view="review"')}</div>
   </div>
 </section>
 ${oldMission?btn('resume','Tiếp tục lượt đang dở','button-text full mt8'):''}
 ${arcade?`<button class="arcade-home-link" data-action="nav" data-view="arcade">
   <span class="arcade-home-icon" aria-hidden="true">${icon('spark')}</span><span><strong>Sân chơi đèn lồng</strong>
   <small>${Object.keys(arcade.games).length} trò luyện tiếng Trung</small></span>${icon('arrow')}</button>`:''}
 <div class="home-reminder"><div class="reminder-em">🧠</div><div><strong>${st.due?`${st.due} lượt luyện đang cần ôn`:'Bắt đầu ôn để tạo trí nhớ dài hạn'}</strong><p>Từ hay quên sẽ quay lại sớm hơn. Bạn không bị phạt khi nghỉ học.</p></div><button data-action="nav" data-view="review" aria-label="Mở ôn tập">${icon('arrow')}</button></div>
 <div class="section-title"><h2>Điểm dừng tiếp theo</h2><button class="link-button" data-action="nav" data-view="map">Xem bản đồ ${icon('arrow')}</button></div><button class="next-card" data-action="start-mission" data-id="${m.id}"><span class="next-emoji">${r.emoji}</span><span><small>${esc(r.name)} · Chặng ${m.step}</small><strong>${esc(D.adventureMissions?.[m.id]?.title||'Theo dấu đèn lồng')}</strong><span class="mini-wordchain">${m.wordIds.map(id=>hanzi(W[id].hanzi)).join(' · ')}</span></span>${icon('arrow')}</button>
 <div class="section-title"><h2>Học theo cách của bạn</h2><button class="link-button" data-action="nav" data-view="progress">Xem tiến độ</button></div><div class="feature-grid"><button class="feature-card" data-action="nav" data-view="words"><span class="feature-icon">🔤</span><b>Chữ gốc → từ ghép</b><small>Tra đủ 300 từ, xem từ cùng họ.</small></button><button class="feature-card" data-action="nav" data-view="reader"><span class="feature-icon">📖</span><b>Đọc hiểu theo chủ đề</b><small>Đọc câu trong ngữ cảnh, hiện Pinyin khi cần.</small></button></div>
 `,'home');}

function arcadeLobby() {
  if(!gameIds.length) return frame('<h1>Sân chơi đèn lồng</h1><p>Sân chơi chưa tải được. Hãy tải lại trang.</p>','arcade');
  const featuredId = gameIds[arcadeFocus];
  const featured = arcade.games[featuredId];
  const cards = Object.entries(arcade?.games || {}).map(([id, game]) => {
    const result = state.arcade[id];
    return `<button type="button" class="arcade-card arcade-card-${id}" data-action="arcade-start" data-id="${id}">
      <span class="arcade-card-art" aria-hidden="true">${hanzi(game.glyph)}</span>
      <span class="arcade-card-copy"><strong>${esc(game.name)}</strong><span>${esc(game.description)}</span>
        <small>${esc(game.ability)}${result?` · Kỷ lục ${result.best}`:''}</small>
      </span><span class="arcade-card-play" aria-hidden="true">${icon('play')}</span>
    </button>`;
  }).join('');
  return frame(`<section class="arcade-lobby">
      <header class="arcade-lobby-title"><div><h1>Sân chơi <em>đèn lồng</em></h1>
        <p>Thử sức với chữ Hán qua tám trạm.</p></div>
        ${btn('arcade-tour',`${icon('play')} <span>Dạo một vòng</span>`,'button-soft',
          'aria-pressed="false"'+(lowMotion()?' hidden':''))}
      </header>
      <section class="arcade-feature" aria-label="Khám phá các trạm">
        ${cover(featuredId, featured.glyph, 'market')}
        <div class="station-picker" role="group" aria-label="Chọn trạm để ngắm">
          ${gameIds.map((id,index)=>`<button type="button" data-action="arcade-preview" data-id="${id}"
            data-palette="${id}" aria-label="Ngắm trạm ${esc(arcade.games[id].name)}" aria-pressed="${index===arcadeFocus}">
            ${hanzi(arcade.games[id].glyph)}
          </button>`).join('')}
        </div>
        <div class="station-caption">
          <div aria-live="polite"><strong data-station-name>${esc(featured.name)}</strong>
            <span data-station-skill>${esc(featured.ability)}</span></div>
          ${btn('arcade-feature-play',`${icon('play')} Chơi`,'primary','data-feature-play')}
        </div>
      </section>
      <div class="section-title"><h2>Tất cả mini game</h2></div>
      <div class="arcade-grid">${cards||'<p>Sân chơi chưa tải được. Hãy tải lại trang.</p>'}</div>
    </section>`, 'arcade');
}

function arcadePreview(id) {
  const index=gameIds.indexOf(id);
  if(index===-1||index===arcadeFocus)return;
  arcadeFocus=index;
  const game=arcade.games[id];
  const stage=app.querySelector('[data-cinema-cover]');
  stage.dataset.palette=id;
  stage.querySelector('.film-fallback .zh').textContent=game.glyph;
  app.querySelector('[data-station-name]').textContent=game.name;
  app.querySelector('[data-station-skill]').textContent=game.ability;
  for(const button of app.querySelectorAll('[data-action="arcade-preview"]')) {
    button.setAttribute('aria-pressed',String(button.dataset.id===id));
  }
  bindCinemaScene();
}

function stopTour() {
  clearTimeout(arcadeTour);
  arcadeTour=null;
  const button=app.querySelector('[data-action="arcade-tour"]');
  if(button) {
    button.setAttribute('aria-pressed','false');
    button.querySelector('span').textContent='Dạo một vòng';
  }
}

function toggleTour(button) {
  if(arcadeTour!==null){stopTour();return;}
  if(lowMotion())return;
  button.setAttribute('aria-pressed','true');
  button.querySelector('span').textContent='Dừng';
  arcadePreview(gameIds[0]);
  let index=1;
  function nextStation(){
    if(view!=='arcade'||index===gameIds.length||document.hidden){stopTour();return;}
    arcadePreview(gameIds[index++]);
    arcadeTour=setTimeout(nextStation,1880);
  }
  arcadeTour=setTimeout(nextStation,1880);
}

function arcadeScreen() {
  const game = arcade.games[arcadeId];
  return `<main class="app-main arcade-main">
    <header class="arcade-game-header" data-palette="${arcadeId}">
      <button class="back-link" data-action="nav" data-view="arcade">${icon('left')} Sân chơi</button>
      <h1 tabindex="-1">${esc(game.name)}</h1>
      <span class="game-skill">${esc(game.ability)}</span>
    </header>
    ${cover(arcadeId,game.glyph,arcadeId==='lights'||arcadeId==='flow'?'river':'')}
    <div id="arcade-game"></div>
  </main>`;
}

function mountArcade() {
  const host = app.querySelector('#arcade-game');
  const id = arcadeId;
  try {
    const mount = window.HSK_MINIGAMES?.[id];
    if (typeof mount !== 'function') throw Error('Mini game không tải được');
    stopArcade = mount(host, {
      words: limit => arcade.words(E, state, limit),
      sentences: limit => arcade.sentences(E, state, limit),
      matchPinyin: E.matchPinyin,
      voiceAvailable: () => Boolean(window.SpeechSynthesisUtterance && mandarinVoice()),
      speak: (text, onError) => speak(text, false, onError),
      stopSpeech: () => window.speechSynthesis?.cancel(),
      grade: (wordId, skill, quality) => E.grade(state, wordId, skill, quality, Date.now(),
        {exercise: `arcade:${id}`}),
      complete: score => E.recordArcade(state, id, score),
      lowMotion: lowMotion(),
      motion: (type, target, detail) => {
        bindCinemaScene();
        motion(type, target, detail);
      },
      exit: () => goto('arcade'),
    });
  } catch {
    host.textContent = 'Trò chơi chưa tải được. Hãy quay về sân chơi rồi thử lại.';
  }
}
function mapView(){const st=E.stats(state);if(!selectedRegion)selectedRegion=nextMission().regionId;
 let out=`<header class="chapter-title"><h1>Bản đồ <em>đèn lồng</em></h1><p class="subtle">${D.regions.length} vùng đất · ${st.totalQuests} chặng · ${st.total} từ</p></header>
   ${cover('map','路',D.adventures?.[selectedRegion]?.scene||'market')}
   <label class="map-picker" for="map-region">${icon('map')} <span>Điểm dừng</span>
     <select class="select" id="map-region">${D.regions.map(r=>`<option value="${esc(r.id)}"
       ${r.id===selectedRegion?'selected':''}>${esc(r.name)}</option>`).join('')}</select>
   </label>
   <div class="map-overview">${progressBar(st.quests,st.totalQuests,'Số chặng đã hoàn thành')}<span>${st.quests}/${st.totalQuests} chặng hoàn thành</span></div><div class="region-list">`;
 D.regions.forEach((r,idx)=>{const count=regionCompleted(r),open=r.id===selectedRegion;const firstUnfinished=nextMission(),unlocked=idx===0||D.regions.slice(0,idx).every(q=>q.missionIds.every(mid=>state.completed.includes(mid)))||r.missionIds.some(mid=>state.completed.includes(mid))||r.id===firstUnfinished.regionId;
  out+=`<div class="region-card ${open?'expanded':''} ${!unlocked?'region-upcoming':''}"><button class="region-head" data-action="region" data-id="${r.id}" aria-expanded="${open}"><span class="region-emoji">${r.emoji}</span><span class="region-desc"><small>VÙNG ${idx+1} · ${r.wordIds.length} TỪ</small><strong>${esc(r.name)}</strong><em>${count}/${r.missionIds.length} chặng · ${unlocked?'Có thể chơi':'Sắp mở khóa'}</em></span><span class="region-chevron">⌄</span></button>`;
  if(open){out+=scene(r,true)+`<p class="region-intro">${esc(D.adventures?.[r.id]?.objective||r.intro)}</p><div class="quest-list">`;r.missionIds.forEach(mid=>{const m=M[mid],done=state.completed.includes(mid),mx=D.missions.findIndex(x=>x.id===mid);const allowed=mx===0||done||state.completed.includes(D.missions[mx-1].id);out+=`<button class="quest-row" data-action="start-mission" data-id="${mid}" ${allowed?'':'disabled'}><span class="quest-dot ${done?'done':allowed?'available':'locked'}">${done?icon('check'):allowed?'✦':'•'}</span><span><strong>${esc(D.adventureMissions?.[mid]?.title||m.title)}</strong><small>${m.wordIds.map(wid=>W[wid].hanzi).join(' · ')}</small></span>${allowed?icon('arrow'):''}</button>`;});out+=`</div>`;}
  out+='</div>';});out+='</div>';return frame(out,'map');}
function review(){
  const st=E.stats(state);
  const weak=E.dueItems(state,40).filter((item,index,all)=>all.findIndex(other=>other.id===item.id)===index).slice(0,6);
  return frame(`<div class="eyebrow">${icon('repeat')} ÔN TẬP THÔNG MINH</div>
    <h1>Ôn từ đã học</h1><p class="subtle mt8">Tập trung vào kỹ năng bạn dễ quên và chia những lượt đến hạn thành buổi ngắn.</p>
    ${cover('quiet','记','school')}
    <div class="review-hero"><span class="review-emoji" aria-hidden="true">🧠</span><div><b>${st.due}</b><strong>lượt luyện đến hạn</strong></div></div>
    <div class="card"><h3>Chọn kỹ năng</h3>
      <div class="chip-wrap">${[['all','Tổng hợp'],...Object.entries(skillNames)].map(([id,label])=>
        `<button class="chip ${reviewSkill===id?'active':''}" data-action="review-skill" data-id="${id}" aria-pressed="${reviewSkill===id}">${label}</button>`).join('')}</div>
      <h3 class="mt18">Thời lượng ước tính</h3>
      <div class="chip-wrap">${[5,10,20].map(n=>
        `<button class="chip ${reviewCount===n?'active':''}" data-action="review-count" data-count="${n}" aria-pressed="${reviewCount===n}">${sessionTimes[n]}</button>`).join('')}</div>
      ${btn('start-review',`${icon('play')} Bắt đầu ôn`,'primary full mt20',st.seen?'':'disabled')}
    </div>
    <div class="card mt16"><h3>Những từ đang cần chú ý</h3>${weak.length?weak.map(item=>{
      const word=W[item.id];
      return `<button class="weak-row" data-action="detail" data-id="${word.id}"><span class="weak-han">${hanzi(word.hanzi)}</span><span><strong>${esc(word.pinyin)}</strong><small>${esc(word.vi)} · ${skillNames[item.sk]}</small></span>${icon('arrow')}</button>`;
    }).join(''):`<p class="subtle mt8">${st.seen?'Bạn đã ôn hết các lượt đến hạn.':'Hãy gặp từ mới trên bản đồ hoặc luyện riêng một từ trong từ điển.'}</p>`}</div>
    <div class="card mt16"><h3>Đọc lại trong ngữ cảnh</h3><p class="subtle mt8">Đọc câu đã học, tự nhớ Pinyin rồi mới lật xem đáp án.</p>${btn('nav',`${icon('book')} Mở khu đọc hiểu`,'button-soft full mt14','data-view="reader"')}</div>`,'review');
}

const searchText=value=>value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'')
  .replace(/đ/g,'d').replace(/['’\-]/g,'');
function wordResults(){
  const term=searchText(wordTerm.trim());
  const list=D.words.filter(word=>{
    const status=E.stateOf(state,word.id);
    if(wordFilter!=='all'&&wordFilter!==status)return false;
    const fields=[word.hanzi,word.vi,word.pinyin,word.parts,...(word.pinyinAlternatives||[])];
    return !term||fields.some(field=>{
      const normalized=searchText(field);
      return normalized.includes(term)||normalized.replace(/\s/g,'').includes(term.replace(/\s/g,''));
    });
  });
  const visible=list.slice(0,dictLimit);
  return `<p class="result-count" role="status">${list.length} từ</p><div class="word-list">${visible.map(word=>{
    const status=wordStates[E.stateOf(state,word.id)];
    return `<button class="word-row" data-action="detail" data-id="${word.id}"><span class="word-icon">${esc(word.emoji)}</span>
      <span class="word-text"><b>${hanzi(word.hanzi)} <span class="word-pinyin">${esc(word.pinyin)}</span></b><small>${esc(word.vi)}</small></span>
      <span class="word-status">${status}</span></button>`;
  }).join('')||'<p class="empty-state">Không tìm thấy từ phù hợp.</p>'}</div>
    ${list.length>dictLimit?btn('more-words','Xem thêm từ','button-soft full mt16'):''}`;
}
function words(){
  return frame(`<div class="eyebrow">${icon('book')} TỪ ĐIỂN</div><h1>Tra ${D.words.length} từ HSK 1</h1>
    <label class="search-box">${icon('search')}<input id="word-search" type="search" autocomplete="off" spellcheck="false"
      aria-label="Tìm từ" placeholder="Chữ Hán, Pinyin, nghĩa…" value="${esc(wordTerm)}"></label>
    <div class="chip-wrap">${[['all','Tất cả'],...Object.entries(wordStates)].map(([id,label])=>
      `<button data-action="word-filter" data-id="${id}" class="chip ${wordFilter===id?'active':''}" aria-pressed="${wordFilter===id}">${label}</button>`).join('')}</div>
    <div id="word-results">${wordResults()}</div>`,'words');
}
function updateWordResults(){
  const results=app.querySelector('#word-results');
  if(results)results.innerHTML=wordResults();
}
function detail(){const w=W[wordId];if(!w){view='words';return words();}const e=state.entries[w.id];const family=w.family.map(id=>W[id]).filter(Boolean),parents=w.parents.map(id=>W[id]).filter(Boolean);return frame(`<button class="back-link" data-action="nav" data-view="words">${icon('left')} Từ điển</button><div class="card detail-card"><div class="detail-header"><span class="mini-label">TỪ ${w.order} / 300 ${w.bookLesson?`· BÀI ${w.bookLesson}`:''}</span><span class="detail-emoji">${esc(w.emoji)}</span></div><div class="hero-hanzi">${hanzi(w.hanzi)}</div><div class="hero-pinyin">${esc(w.pinyin)} <button class="speak" data-action="speak" data-text="${esc(w.hanzi)}" aria-label="Nghe phát âm">${icon('sound')}</button></div><h2 class="center">${esc(w.vi)}</h2><p class="muted-center">${esc([w.partOfSpeech,w.topic].filter(Boolean).join(' · '))}</p></div><div class="card mt14"><h3>🧠 Ghi nhớ nhanh</h3><p class="body-note mt8">${esc(w.memo)}</p><div class="small-divider"></div><h3>🧩 Cấu tạo / gợi ý mặt chữ</h3><p class="body-note mt8">${esc(w.parts)}</p><p class="learning-note mt8">Mẹo nhớ giúp nhận diện chữ, không nhất thiết là từ nguyên.</p></div>
 <div class="card mt14"><h3>💬 Thử dùng trong câu</h3><div class="chinese-sentence mt12">${hanzi(w.example)}</div><div class="sentence-pinyin">${esc(w.examplePinyin)}</div><p class="body-note">${esc(w.exampleVi)}</p>${w.usage?`<p class="body-note mt8">${esc(w.usage)}</p>`:generatePronunciationNote(w)}${btn('speak',`${icon('sound')} Nghe cả câu`,'button-soft mt14','data-text="'+esc(w.example)+'"')}</div>
 ${family.length||parents.length?`<div class="card mt14"><h3>🌱 Từ gốc → từ mở rộng</h3>${parents.length?`<div class="growth-row">${parents.map(p=>`<button data-action="detail" data-id="${p.id}">${hanzi(p.hanzi)}<small>${esc(p.pinyin)}</small></button>`).join('<span>→</span>')}<span class="grow-target">${hanzi(w.hanzi)}</span></div>`:''}<div class="family-grid">${family.map(f=>`<button class="family-word" data-action="detail" data-id="${f.id}"><strong>${hanzi(f.hanzi)}</strong><small>${esc(f.pinyin)}</small><em>${esc(f.vi)}</em></button>`).join('')}</div><p class="learning-note mt10">Các từ được liên kết do có chung chữ Hán, không phải tất cả đều có quan hệ nguồn gốc.</p></div>`:''}
 <div class="card mt14"><h3>Trạng thái ghi nhớ</h3><p class="subtle mt8">${wordStates[E.stateOf(state,w.id)]}</p><div class="skill-grid">${Object.entries(skillNames).map(([key,label])=>{
    const record=e?.[key],last=record?.history[record.history.length-1];
    return `<div><strong>${label}</strong>
      <small>${record?.correct||0}/${record?.attempts||0} đúng · ${record?.hints||0} gợi ý</small>
      ${last?`<small>${resultNames[last.quality]} · ${onceDate(last.at)}</small>`:''}
      <small>${record?.due?`Ôn vào ${onceDate(record.due)}`:'Chưa có lịch ôn'}</small></div>`;
  }).join('')}</div>${btn('practice-word',`${icon('play')} Luyện riêng từ này`,'primary full mt16',`data-id="${w.id}"`)}</div>`,'words');}
function progress(){const st=E.stats(state);const byRegion=D.regions.map(r=>({r,done:regionCompleted(r),seen:r.wordIds.filter(id=>state.entries[id]?.seenCount).length}));return frame(`<div class="eyebrow">${icon('chart')} HÀNH TRÌNH GHI NHỚ</div><h1>Mỗi ngày tiến thêm một chút.</h1><p class="subtle mt8">Không chấm điểm để so sánh. Đây là bản đồ những gì bạn đã học và cần củng cố.</p><div class="stat-grid"><div><strong>${st.seen}<small>/300</small></strong><span>Từ đã gặp</span></div><div><strong>${st.mature}</strong><span>Nhớ qua nhiều lần ôn</span></div><div><strong>${st.quests}<small>/${st.totalQuests}</small></strong><span>Chặng đã khám phá</span></div><div><strong>${st.due}</strong><span>Lượt cần ôn</span></div></div><div class="card mt16"><h3>Tiến độ nhận diện</h3><p class="subtle mt8">Đã gặp: ${st.seen}/300 từ</p>${progressBar(st.seen,300)}<p class="subtle mt12">Ghi nhớ vững: ${st.mature}/300 từ</p>${progressBar(st.mature,300)}<p class="learning-note mt12">Một từ chỉ đạt mức vững khi bạn nhớ nghĩa, Pinyin, cách dùng và ôn đúng sau nhiều ngày.</p></div><div class="card mt16"><h3>20 khu vực phiêu lưu</h3>${byRegion.map(x=>`<div class="region-progress"><span>${x.r.emoji} ${esc(x.r.name)}</span><small>${x.seen}/${x.r.wordIds.length}</small>${progressBar(x.seen,x.r.wordIds.length)}</div>`).join('')}</div><div class="card mt16"><h3>Học để sử dụng</h3><p class="subtle mt8">Khi ghép câu sai, game sẽ đưa câu trở lại sớm hơn. Bạn có thể ôn riêng kỹ năng yếu trong mục Ôn tập.</p>${btn('nav','Đi đến ôn tập','button-soft full mt14','data-view="review"')}</div>`,'progress');}
function reader(){
  if(!storyRegion){storyRegion=D.regions[0].id;storyShowPinyin=state.preferences.viewPinyin;}
  const region=R[storyRegion];
  const story=E.passageFor(storyRegion);
  const sentences=(story?.sentences||[]).map(id=>S[id]).filter(Boolean);
  return frame(`<div class="eyebrow">${icon('book')} ĐỌC HIỂU THEO CHỦ ĐỀ</div>
    <h1>Đọc trước, xem Pinyin sau</h1><p class="subtle mt8">Đọc câu tiếng Trung rồi mở cách đọc và nghĩa để tự kiểm tra.</p>
    <div class="card mt18"><label class="label" for="story-select">Chọn vùng đất</label>
      <select id="story-select" class="select">${D.regions.map(item=>`<option value="${item.id}" ${item.id===storyRegion?'selected':''}>${esc(item.name)}</option>`).join('')}</select></div>
    ${scene(region)}
    <div class="card mt14"><div class="reader-title"><h2>${esc(region.name)}</h2>
      <button class="chip ${storyShowPinyin?'active':''}" data-action="toggle-story-pinyin" aria-pressed="${storyShowPinyin}">${storyShowPinyin?'Ẩn':'Hiện'} Pinyin</button></div>
      <p class="subtle mt8">${esc(region.intro)}</p>
      <div class="reader-lines">${sentences.map((sentence,index)=>{
        const show=storyRevealed[index]??storyShowPinyin;
        return `<div class="reader-entry"><button class="reader-line" data-action="reveal-story" data-index="${index}" aria-expanded="${Boolean(show)}">
          <span class="line-no" aria-hidden="true">${index+1}</span><span><strong>${hanzi(sentence.hanzi)}</strong>
          ${show?`<em>${esc(sentence.pinyin)}</em><small>${esc(sentence.vi)}</small>`:'<small class="reveal-hint">Xem cách đọc và nghĩa</small>'}</span></button>
          <button class="speak" data-action="speak" data-text="${esc(sentence.hanzi)}" aria-label="Nghe câu ${index+1}">${icon('sound')}</button></div>`;
      }).join('')}</div>
    </div>`,'review');
}
function settingsToggle(key,title,description){
  const checked=state.preferences[key];
  return `<div class="setting"><div><strong id="setting-${key}">${title}</strong><p>${description}</p></div>
    <button class="switch ${checked?'on':''}" data-action="toggle-setting" data-key="${key}" role="switch" aria-checked="${checked}" aria-labelledby="setting-${key}"></button></div>`;
}
function settings(){
  return frame(`<div class="eyebrow">${icon('settings')} TÙY CHỌN</div><h1>Cài đặt học tập</h1>
    <div class="card mt18">
      ${settingsToggle('audio','Tự phát âm từ mới','Phát tiếng Trung khi mở thẻ mới. Bạn cũng có thể chạm nút loa để nghe.')}
      <p class="subtle mt8" data-voice-status>${voiceStatus()}</p><div class="small-divider"></div>
      ${settingsToggle('viewPinyin','Hiện chú giải Pinyin','Tự hiện Pinyin trong khu đọc hiểu và các bài đọc.')}
      <div class="small-divider"></div>${settingsToggle('lowMotion','Giảm chuyển động','Giữ giao diện tĩnh hơn khi học.')}
    </div>
    <div class="card mt14"><h3>Chơi ngoại tuyến</h3><p class="subtle mt8" data-offline-status>${esc(offlineStatus())}</p></div>
    <div class="card mt14"><h3>${icon('download')} Sao lưu và khôi phục</h3>
      <p class="subtle mt8">Tiến độ lưu trong trình duyệt này. Hãy xuất tệp JSON từ bản cũ trước khi đổi thiết bị hoặc chuyển sang bản web, rồi nhập tệp tại đây.</p>
      <div class="button-row mt14">${btn('export',`${icon('download')} Sao lưu`,'button-soft')}${btn('import',`${icon('upload')} Khôi phục`,'button-white')}</div>
      <input type="file" id="import-file" accept="application/json,.json" hidden>
    </div>
    <div class="card mt14"><h3>Nguồn từ vựng</h3>
      <p class="subtle mt8">300 mục từ cấp 1 theo đề cương HSK công bố tháng 11/2025. Hai chương đầu tập trung vào chào hỏi và làm quen.</p>
      <a class="source-link" target="_blank" rel="noopener noreferrer" href="${esc(sourceUrl)}">Xem đề cương chính thức</a>
    </div>
    <div class="card mt14"><h3>Bắt đầu lại</h3><p class="subtle mt8">Xóa từ đã học, lịch ôn và các chặng trên trình duyệt này.</p>
      ${btn('reset','Xóa tiến độ trên máy này','button-danger full mt14')}
    </div>`,'settings');
}
function questIntro(active){const m=M[active.missionId],r=R[m.regionId];return `<div class="quest-screen"><button class="back-link" data-action="quit">${icon('left')} Bản đồ</button><div class="eyebrow">🌱 VÙNG ${r.number} · CHẶNG ${m.step}</div>${scene(r)}<div class="card mt14"><span class="mini-label">NHIỆM VỤ MỚI</span><h1 class="mt8">${esc(r.name)}</h1><p class="subtle mt10">${esc(r.intro)}</p><div class="word-pill-row">${m.wordIds.map(id=>`<span class="word-pill">${hanzi(W[id].hanzi)}</span>`).join('')}</div><p class="learning-note mt12">Bạn sẽ gặp từ mới, đọc chữ, ghép câu, rồi ôn lại trong những ngày sau. Có thể dừng giữa chặng và chơi tiếp bất cứ lúc nào.</p>${btn('begin-quest',`${icon('play')} Bắt đầu khám phá`,'primary full mt20')}</div></div>`;}
function playHeader() {
  const active = state.active;
  const mission = active.mode === 'mission' ? M[active.missionId] : null;
  const task = current();
  const isAdventure = task.type === 'trail' || task.gate;
  const label = mission ? R[mission.regionId].name : active.mode === 'review'
    ? 'Buổi ôn ghi nhớ' : active.mode === 'word' ? 'Luyện một từ' : 'Luyện ghép câu';
  const stage = isAdventure ? `Chặng ${mission.step} · ${task.gate?'Lối ra':'Bản đồ đèn'}`
    : `Thử thách ${active.index+1} / ${active.queue.length}`;
  return `<div class="play-header">
    <button class="back-circle" data-action="quit" aria-label="${mission?'Về bản đồ':'Dừng lượt ôn'}">${icon('left')}</button>
    <div><b>${esc(label)}</b><small>${stage}</small>
    ${isAdventure?'':progressBar(active.index,active.queue.length,'Thử thách')}</div>
  </div>`;
}
const trailLayouts = {
  3: [[20, 64], [51, 34], [81, 60]],
  4: [[16, 68], [34, 36], [65, 46], [84, 73]],
  5: [[16, 74], [21, 33], [49, 60], [74, 31], [84, 71]]
};

function focusAdventure(selector) {
  const element = app.querySelector(selector);
  if (!element) return;
  if (element.tagName !== 'BUTTON') element.tabIndex = -1;
  element.focus({preventScroll:true});
}

function adventureIntro(active) {
  const mission = M[active.missionId];
  const region = R[mission.regionId];
  const story = adventureFor(mission);
  return `<section class="quest-screen">
    <button class="back-link" data-action="quit">${icon('left')} Bản đồ</button>
    ${cover('chapter','灯',story.scene)}
    <div class="card mt14">
      <div class="mini-label">${esc(region.name)} · Chặng ${mission.step}</div>
      <h1 class="mt8">${esc(story.title || 'Theo dấu đèn lồng')}</h1>
      <p class="subtle mt10">${esc(story.objective || mission.intro)}</p>
      <p class="body-note mt12">Ghé từng điểm sáng để gặp chữ mới. Khi màn đêm buông xuống, trí nhớ của bạn sẽ thắp sáng đường đi.</p>
      ${btn('begin-quest','Bước vào chặng','primary full mt20')}
    </div>
  </section>`;
}

function trailBoard(task, progress, story, phase) {
  const positions = trailLayouts[task.wordIds.length];
  const path = positions.map(point => point.join(',')).join(' ');
  const pending = task.order[progress.solved.length];
  return `<div class="adventure-board" data-scene="${esc(story.scene)}" data-phase="${phase}" role="group" aria-label="Bản đồ đèn lồng">
    <div class="adventure-board-art" aria-hidden="true">
      <svg class="adventure-trail-line" viewBox="0 0 100 100" preserveAspectRatio="none" focusable="false">
        <polyline points="${path}"></polyline>
        ${positions.slice(1).map(([x,y],index) => {
          const [startX,startY] = positions[index];
          if (!progress.solved.includes(task.wordIds[index]) || !progress.solved.includes(task.wordIds[index+1])) return '';
          return `<line class="is-lit" x1="${startX}" y1="${startY}" x2="${x}" y2="${y}"></line>`;
        }).join('')}
      </svg>
    </div>
    ${task.wordIds.map((id,index) => {
      const [x,y] = positions[index];
      const found = progress.visited.includes(id);
      const lit = progress.solved.includes(id);
      const current = progress.selected === id || (progress.hinted && pending === id);
      const name = story.locationNames[index] || adventureDefaults.locationNames[index];
      const classes = [found && 'is-found', lit && 'is-lit', current && 'is-current',
        progress.missed === id && 'is-missed'].filter(Boolean).join(' ');
      const visible = (phase === 'explore' && found) || lit;
      const status = lit?'đã thắp sáng':phase==='explore'?(found?'đã khám phá':'chưa khám phá'):'đang tắt';
      return `<button type="button" class="adventure-spot ${classes}" style="--spot-x:${x}%;--spot-y:${y}%"
        data-action="trail-spot" data-id="${id}" aria-label="${esc(name)} · ${status}" ${lit?'disabled':''}>
        <span class="adventure-spot-icon" aria-hidden="true">${visible?esc(W[id].emoji||'✦'):'✦'}</span>
        <span class="adventure-spot-name">${esc(name)}</span>
      </button>`;
    }).join('')}
  </div>`;
}

function wordMemory(word, locationName) {
  return `<div class="adventure-memory" aria-label="Chữ ghi nhớ">
    <div class="adventure-memory-title">
      <span class="adventure-word-icon" aria-hidden="true">${esc(word.emoji || '✦')}</span>
      <div class="adventure-glyph">${hanzi(word.hanzi)}</div>
      <button class="speak" data-action="speak" data-text="${esc(word.hanzi)}" aria-label="Nghe phát âm">${icon('sound')}</button>
    </div>
    <div class="adventure-reading">${esc(word.pinyin)} · ${esc(word.vi)}</div>
    <p><strong>${esc(locationName)}</strong>. ${esc(word.memo)}</p>
  </div>`;
}

function trailTask(task) {
  const story = adventureFor(M[task.missionId]);
  const progress = E.trailState(task, state.active.trail);
  const total = task.wordIds.length;
  const count = progress.recall ? progress.solved.length : progress.visited.length;
  const phase = progress.recall ? (count === total ? 'ready' : 'recall') : 'explore';
  const pending = task.order[count];
  const word = W[pending];
  const lastLit = W[progress.solved.at(-1)];
  const memoryLocation = task.wordIds.indexOf(progress.hinted ? pending : progress.selected);
  const activeLocation = story.locationNames[memoryLocation] || adventureDefaults.locationNames[memoryLocation];
  const clue = word && (count % 2 || task.wordIds.some(id => id !== pending && W[id].vi === word.vi)
    ? hanzi(word.hanzi) : esc(word.vi));
  const title = phase === 'explore' ? 'Tìm dấu chữ quanh bạn' : phase === 'recall' ? 'Thắp lại đèn trong trí nhớ' : 'Đường đi đã sáng';
  const locations = phase === 'explore' ? 'điểm đã ghé' : 'đèn đã thắp';
  const feedback = progress.missed ? 'Đèn khẽ rung. Hãy thử nhớ lại nơi bạn đã gặp dấu chữ này.'
    : phase === 'ready' ? 'Ánh đèn dẫn tới lối ra.'
    : lastLit ? `Đèn ${hanzi(lastLit.hanzi)} đã sáng · ${esc(lastLit.pinyin)} · ${esc(lastLit.vi)}` : '';
  let memory = '';
  if (phase === 'explore' && progress.selected) memory = wordMemory(W[progress.selected], activeLocation);
  if (phase === 'recall' && progress.hinted) memory = wordMemory(word, activeLocation);
  return `<section class="adventure-panel">
    <header class="adventure-heading">
      <h2>${title}</h2>
      <p class="adventure-progress">${count}/${total} ${locations}</p>
    </header>
    ${cover('trail','灯',story.scene)}
    ${phase === 'recall' ? `<div class="adventure-memory adventure-clue" id="adventure-clue">
      <p>Thắp đèn nơi bạn gặp từ này</p><strong>${clue}</strong>
    </div>` : ''}
    ${trailBoard(task, progress, story, phase)}
    <p class="adventure-message" role="status">${feedback || (phase==='explore'
      ? 'Chạm vào một điểm sáng và gắn chữ với nơi bạn thấy nó.'
      : 'Hãy thử đọc thầm rồi chạm vào đúng điểm.')}</p>
    ${memory}
    <div class="adventure-actions">
      ${phase==='explore' && count===total ? btn('trail-recall','Tắt đèn và thử nhớ','primary full')
        : phase==='recall' && !progress.hinted ? btn('trail-hint','Gợi ý vị trí','button-soft full')
        : phase==='ready' ? btn('trail-gate','Đi tới lối ra','primary full') : ''}
    </div>
  </section>`;
}

function adventureGate(task) {
  const active = state.active;
  const mission = M[active.missionId];
  const story = adventureFor(mission);
  const sentence = S[task.sentenceId];
  const feedback = active.feedback;
  const opened = feedback?.quality === 'good';
  if (opened || feedback) {
    const reply = task.sentenceId === 'bs09' ? S.bs10 : null;
    return `<section class="adventure-gate ${opened?'is-open':'is-missed'}">
      <div class="adventure-gate-icon" aria-hidden="true">${opened?'✦':'◆'}</div>
      <h2>${opened?'Lối đi đã mở':'Bảng chữ chưa sáng'}</h2>
      <p>${esc(opened ? story.unlock : 'Xem cách đặt các mảnh chữ rồi thử lại.')}</p>
      <div class="adventure-gate-answer">
        <strong>${hanzi(sentence.hanzi)}</strong><span>${esc(sentence.pinyin)}</span>
      </div>
      ${opened && reply ? `<div class="adventure-gate-answer">
        <small>Tiểu Ngữ đáp lời</small><strong>${hanzi(reply.hanzi)}</strong>
        <span>${esc(reply.pinyin)} · ${esc(reply.vi)}</span>
      </div>` : ''}
      ${btn('next-task',opened?'Hoàn thành chặng':'Xếp lại lời nhắn','primary full')}
    </section>`;
  }
  const chosen = active.chosen;
  const tiles = task.tiles;
  return `<section class="adventure-gate">
    <div class="adventure-gate-icon" aria-hidden="true">◆</div>
    <h2>Lời nhắn mở lối</h2>
    <p>${esc(story.gate)}</p>
    <div class="translation-box">${esc(sentence.vi)}</div>
    ${glossary(task,[sentence])}
    ${active.hint ? `<p class="hint-show" id="gate-hint">Mẫu lời nhắn: ${hanzi(sentence.hanzi)} · ${esc(sentence.pinyin)}</p>` : ''}
    <div class="answer-area gate-slots" aria-label="Các ô đặt mảnh chữ">
      ${tiles.map((_tile,index) => {
        const tile = tiles[chosen[index]];
        return tile ? `<button type="button" class="tile chosen" data-action="remove-tile" data-index="${index}" aria-label="Tháo mảnh ${esc(tile.text)}">${hanzi(tile.text)}</button>`
          : '<span class="gate-slot" aria-hidden="true">·</span>';
      }).join('')}
    </div>
    <div class="tiles" aria-label="Túi mảnh chữ">
      ${tiles.map((tile,index) => `<button type="button" class="tile" data-action="choose-tile" data-index="${index}" ${chosen.includes(index)?'disabled':''}>${hanzi(tile.text)}</button>`).join('')}
    </div>
    <div class="button-row">
      ${btn('clear-tiles','Xếp lại','button-soft',chosen.length?'':'disabled')}
      ${btn('submit-build','Gửi lời nhắn','primary',chosen.length===tiles.length?'':'disabled')}
    </div>
    ${active.hint?'':btn('gate-hint','Xem mẫu lời nhắn','button-text full')}
  </section>`;
}

function generatePronunciationNote(word){
  if(word.hanzi==='不')return '<p class="body-note mt8">不 viết là bù khi đứng riêng. Trước âm tiết thanh 4, đọc bú, như 不是 (bú shì).</p>';
  if(word.hanzi==='一')return '<p class="body-note mt8">一 đọc yī khi đếm riêng. Trước thanh 4 thường đọc yí, còn trước thanh 1, 2, 3 thường đọc yì.</p>';
  return '';
}
function learnTask(t){const w=W[t.wordId],related=w.family.map(id=>W[id]).filter(Boolean);return `<div class="task-box"><span class="task-type">🌱 LÀM QUEN MẶT CHỮ</span><div class="visual-word"><div class="visual-emoji">${esc(w.emoji)}</div><div class="visual-hanzi">${hanzi(w.hanzi)}</div><div class="visual-pinyin">${esc(w.pinyin)} <button class="speak" data-action="speak" data-text="${esc(w.hanzi)}" aria-label="Nghe từ">${icon('sound')}</button></div><h2>${esc(w.vi)}</h2>${w.partOfSpeech?`<p class="muted-center">${esc(w.partOfSpeech)}</p>`:''}</div><div class="memo-box"><b>💡 Ghi nhớ nhanh</b><p>${esc(w.memo)}</p></div><div class="memo-box cool"><b>🧩 Cấu tạo / gợi ý</b><p>${esc(w.parts)}</p></div><div class="example-box"><span class="mini-label">THỬ ĐỌC TRONG CÂU</span><strong>${hanzi(w.example)}</strong><span>${esc(w.examplePinyin)}</span><p>${esc(w.exampleVi)}</p>${w.usage?`<p class="body-note mt8">${esc(w.usage)}</p>`:generatePronunciationNote(w)}</div>${related.length?`<div class="family-strip"><strong>🌿 Cùng một chữ Hán:</strong><div>${related.slice(0,4).map(x=>`<span>${hanzi(x.hanzi)} <small>${esc(x.pinyin)}</small></span>`).join('')}</div></div>`:''}<p class="learning-note mt10">Chỉ cần nhớ hình, âm và nghĩa ở lần đầu. Chút nữa game sẽ che đáp án để bạn thử nhớ lại.</p>${btn('next-learn',`${icon('arrow')} Đã xem, thử nhớ nào`,'primary full mt18')}</div>`;}
function meaningTask(t){const w=W[t.wordId];return `<div class="task-box"><span class="task-type">👀 NHÌN CHỮ → NHỚ NGHĨA</span><h2 class="center mt12">Chữ Hán này nghĩa là gì?</h2><div class="quiz-hanzi">${hanzi(w.hanzi)}<button class="speak quiz-sound" data-action="speak" data-text="${esc(w.hanzi)}" aria-label="Nghe từ">${icon('sound')}</button></div><div class="option-list">${t.options.map((o,i)=>`<button class="option" data-action="answer-meaning" data-value="${esc(o)}"><span>${String.fromCharCode(65+i)}</span>${esc(o)}</button>`).join('')}</div><p class="hint-line">Hãy tự nhớ trước khi chọn, không chỉ đoán theo vị trí.</p></div>`;}
function answerOptions(task,action,{chinese=false,columns=false}={}){
  return `<div class="option-list ${columns?'two-cols':''}">${task.options.map((value,index)=>
    `<button class="option ${chinese?'chinese':''}" data-action="${action}" data-value="${esc(value)}">
      <span aria-hidden="true">${String.fromCharCode(65+index)}</span>${chinese?hanzi(value):esc(value)}
    </button>`).join('')}</div>`;
}
function hanziTask(task){
  const word=W[task.wordId];
  const pinyinCue=task.cue==='pinyin',imageCue=task.cue==='image';
  const title=imageCue?'Chữ Hán nào phù hợp với hình?':pinyinCue?'Chữ nào có cách đọc này?':'Chữ nào mang nghĩa này?';
  const cue=imageCue?word.emoji:pinyinCue?word.pinyin:word.vi;
  return `<div class="task-box"><span class="task-type">NHẬN DIỆN CHỮ HÁN</span>
    <h2 class="center mt12">${title}</h2>
    <p class="quiz-cue ${imageCue?'quiz-illustration':''}" ${imageCue?`role="img" aria-label="${esc(word.vi)}"`:''}>${esc(cue)}</p>
    ${answerOptions(task,'answer-hanzi',{chinese:true,columns:true})}</div>`;
}
function toneTask(task){
  const word=W[task.wordId];
  return `<div class="task-box"><span class="task-type">PHÂN BIỆT THANH ĐIỆU</span>
    <h2 class="center mt12">Chữ này đọc với thanh nào?</h2>
    <div class="quiz-hanzi">${hanzi(word.hanzi)}</div>
    ${answerOptions(task,'answer-tone',{columns:true})}</div>`;
}
function readingTask(task){
  const word=W[task.wordId];
  const active=state.active;
  return `<div class="task-box reading-task"><span class="task-type">NHỚ PINYIN</span>
    <h2 class="center mt12">Bạn đọc chữ này thế nào?</h2><div class="quiz-hanzi">${hanzi(word.hanzi)}</div>
    <form id="reading-form"><label for="reading-answer" class="label">Nhập Pinyin, gồm cả thanh điệu</label>
      <input id="reading-answer" class="text-input" aria-describedby="reading-help" enterkeyhint="done" autocomplete="off" autocapitalize="off" spellcheck="false"
        placeholder="Ví dụ: ni3hao3 hoặc nǐ hǎo" maxlength="100" required value="${esc(active.readingInput)}">
      <p class="input-help" id="reading-help">Dùng dấu hoặc số: 1 ngang, 2 lên giọng, 3 xuống rồi lên, 4 hạ giọng; 0 hoặc 5 là thanh nhẹ.</p>
      <div id="reading-hint" class="hint-show" ${active.hint?'':'hidden'}>Gợi ý <b>${esc(word.pinyin)}</b> · ${esc(word.vi)}</div>
      ${active.hint?'':btn('hint','Xem gợi ý','button-text')}
      <button type="submit" class="btn primary full mt14">${icon('check')} Kiểm tra cách đọc</button>
    </form>${btn('skip-reading','Mình chưa nhớ từ này','button-text full mt14')}</div>`;
}
function glossary(task,sentences){
  const words=(task.glossary||[]).map(id=>W[id]).filter(Boolean);
  const extra=Object.assign({},...sentences.map(sentence=>sentence.glosses));
  if(!words.length&&!Object.keys(extra).length)return '';
  return `<details class="task-glossary" ${state.preferences.viewPinyin?'open':''}><summary>Chú giải từ mới</summary><dl>
    ${words.map(word=>`<div><dt>${hanzi(word.hanzi)}</dt><dd>${esc(word.pinyin)} · ${esc(word.vi)}</dd></div>`).join('')}
    ${Object.entries(extra).map(([word,meaning])=>`<div><dt>${hanzi(word)}</dt><dd>${esc(meaning)}</dd></div>`).join('')}
  </dl></details>`;
}
function clozeTask(task){
  const word=W[task.wordId],sentence=S[task.sentenceId];
  const obscured=E.blankWord(sentence,word.hanzi);
  return `<div class="task-box"><span class="task-type">ĐIỀN TỪ TRONG CÂU</span>
    <h2 class="center mt12">Chọn từ đúng cho chỗ trống</h2><div class="sentence-display">${hanzi(obscured)}</div>
    <p class="translation-box">${esc(sentence.vi)}</p>
    ${glossary(task,[sentence])}${answerOptions(task,'answer-cloze',{chinese:true,columns:true})}</div>`;
}
function buildTask(t){const sn=S[t.sentenceId],chosen=state.active.chosen||[],tiles=t.tiles||[];return `<div class="task-box"><span class="task-type">🏗️ GHÉP CÂU HOÀN CHỈNH</span><h2 class="center mt12">Sắp xếp thành câu tiếng Trung</h2><div class="translation-box">${esc(sn.vi)}</div>${glossary(t,[sn])}<div class="section-label">CÂU CỦA BẠN</div><div class="answer-area">${chosen.length?chosen.map((ix,index)=>`<button class="tile chosen" data-action="remove-tile" data-index="${index}">${hanzi(tiles[ix].text)} <small>×</small></button>`).join(''):'<span>Chạm các mảnh chữ bên dưới...</span>'}</div><div class="section-label">CÁC MẢNH TỪ</div><div class="tiles">${tiles.map((tile,i)=>`<button class="tile" data-action="choose-tile" data-index="${i}" ${chosen.includes(i)?'disabled':''}>${hanzi(tile.text)}</button>`).join('')}</div><div class="button-row mt18">${btn('clear-tiles','Xếp lại','button-white')}${btn('submit-build','Kiểm tra câu','primary',chosen.length===tiles.length?'':'disabled')}</div><p class="hint-line">Hãy chú ý vị trí từ hỏi, chủ ngữ và động từ.</p></div>`;}
function storyTask(task){
  const region=R[task.regionId];
  const sentences=task.sentenceIds.map(id=>S[id]).filter(Boolean);
  return `<div class="task-box"><span class="task-type">GẶP LẠI TRONG CÂU CHUYỆN</span>${scene(region,true)}
    <h2 class="mt14">${esc(region.name)}</h2><p class="subtle mt8">${esc(region.intro)}</p>
    <div class="short-story">${sentences.map(sentence=>`<div><strong>${hanzi(sentence.hanzi)}</strong>
      <small>${esc(sentence.pinyin)}</small><p>${esc(sentence.vi)}</p></div>`).join('')}</div>
    ${glossary(task,sentences)}${btn('next-story','Tiếp tục khám phá','primary full mt18')}</div>`;
}
function passageTask(task){
  const sentence=S[task.sentenceId];
  const lines=[...task.context.map(id=>S[id]),sentence];
  return `<div class="task-box"><span class="task-type">ĐỌC HIỂU</span>
    <h2 class="center mt12">${task.context.length?'Trong đoạn hội thoại, câu cuối có nghĩa gì?':'Câu tiếng Trung nói gì?'}</h2>
    <div class="short-story">${lines.map(line=>`<div><strong>${hanzi(line.hanzi)}</strong>
      ${state.preferences.viewPinyin?`<small>${esc(line.pinyin)}</small>`:''}</div>`).join('')}</div>
    ${glossary(task,lines)}${answerOptions(task,'answer-passage')}</div>`;
}
function dialogueTask(task){
  const dialogue=E.DIALOGUES[task.missionId];
  return `<div class="task-box"><span class="task-type">HỘI THOẠI</span><p class="subtle mt8">${esc(dialogue.context)}</p>
    <div class="sentence-display">${hanzi(dialogue.prompt)}</div><h2 class="center">${esc(dialogue.question)}</h2>
    ${glossary(task,[])}${answerOptions(task,'answer-dialogue',{chinese:true})}</div>`;
}
function feedbackTask(feedback){return `<div class="feedback-screen ${feedback.quality==='good'?'good':'retry'}"><span class="feedback-emoji">${feedback.quality==='good'?'🌿':feedback.quality==='almost'?'💡':'💛'}</span><h2>${esc(feedback.heading)}</h2><p>${esc(feedback.intro)}</p><div class="feedback-answer"><strong>${hanzi(feedback.answerHanzi||'')}</strong>${feedback.pinyin?`<em>${esc(feedback.pinyin)}</em>`:''}${feedback.vi?`<span>${esc(feedback.vi)}</span>`:''}</div>${feedback.explanation?`<p class="explanation">${esc(feedback.explanation)}</p>`:''}<div class="button-row mt18">${feedback.answerHanzi?btn('speak',`${icon('sound')} Nghe lại`,'button-white','data-text="'+esc(feedback.answerHanzi)+'"'):''}${btn('next-task',`${icon('arrow')} Tiếp tục`,'primary')}</div></div>`;}
function finished(){const f=lastFinish||{title:'Hoàn thành buổi học',description:'Những từ khó sẽ xuất hiện lại vào lúc cần ôn.'};const st=E.stats(state);return frame(`<div class="finish">${cover('ending','灯','river')}<h1>${esc(f.title)}</h1><p class="subtle mt10">${esc(f.description||'Bạn đã luyện lại chữ Hán, Pinyin và cách dùng. Các từ chưa chắc sẽ tiếp tục quay lại.')}</p><div class="finish-stat"><div><strong>${st.seen}/300</strong><small>Từ đã gặp</small></div><div><strong>${st.due}</strong><small>Lượt cần ôn</small></div></div>${btn('begin-next',`${icon('play')} Khám phá tiếp`,'primary full mt20')}${btn('nav',`${icon('repeat')} Ôn những từ đã gặp`,'button-soft full mt12','data-view="review"')}${btn('nav','Về trang chủ','button-text full mt8','data-view="home"')}</div>`,'home');}
let lastFinish=null;
const taskViews={learn:learnTask,meaning:meaningTask,reading:readingTask,hanzi:hanziTask,tone:toneTask,
  cloze:clozeTask,build:buildTask,story:storyTask,passage:passageTask,dialogue:dialogueTask,trail:trailTask};
function renderPlay(){
  const active=state.active,task=current();
  if(!active||!task){view='home';return home();}
  if(active.intro&&active.mode==='mission'&&task.type==='trail') {
    return `<main class="app-main play-main">${adventureIntro(active)}</main>`;
  }
  const content=active.intro&&active.mode==='mission'
    ? questIntro(active)
    : playHeader()+(task.gate?adventureGate(task):active.feedback?feedbackTask(active.feedback):taskViews[task.type](task));
  return `<main class="app-main play-main">${content}</main>`;
}
function render() {
  document.body.classList.toggle('reduce-motion',lowMotion());
  try {
    if (stopArcade) {
      const stop = stopArcade;
      stopArcade = null;
      stop();
    }
    let html;
    switch (view) {
      case 'home': html=home(); break;
      case 'map': html=mapView(); break;
      case 'review': html=review(); break;
      case 'words': html=words(); break;
      case 'detail': html=detail(); break;
      case 'progress': html=progress(); break;
      case 'reader': html=reader(); break;
      case 'settings': html=settings(); break;
      case 'play': html=renderPlay(); break;
      case 'finished': html=finished(); break;
      case 'arcade': html=arcadeLobby(); break;
      case 'arcade-game': html=arcadeScreen(); break;
      default: view='home'; html=home();
    }
    app.innerHTML=html;
    if (view==='arcade-game') mountArcade();
    bindCinemaScene();
    if (!E.storageHealthy()) toast('Trình duyệt không lưu được tiến độ. Hãy dùng tính năng sao lưu.');
  } catch(err) {
    console.error('Render error',err);
    app.innerHTML=`<div class="app-main error-screen"><h2>Gặp lỗi hiển thị</h2><p>Hãy tải lại trang. Dữ liệu đã lưu vẫn được giữ trên thiết bị.</p><button class="btn primary" data-action="reload">Tải lại</button></div>`;
  }
}

reduceMedia.addEventListener?.('change', () => {
  document.body.classList.toggle('reduce-motion', lowMotion());
  const tour=app.querySelector('[data-action="arcade-tour"]');
  if(tour) {
    if(lowMotion())stopTour();
    tour.hidden=lowMotion();
  }
  bindCinemaScene();
});
function goto(next) {
  if(view==='arcade')stopTour();
  view=next;
  render();
  scrollUp();
  if (view==='play') focusPlayHeading();
  if (view==='arcade-game') app.querySelector('.arcade-game-header h1')?.focus({preventScroll:true});
}
function startMission(id){const m=M[id];if(!m)return;const idx=D.missions.findIndex(q=>q.id===id);if(idx>0&&!state.completed.includes(id)&&!state.completed.includes(D.missions[idx-1].id)){toast('Hãy hoàn thành chặng trước để mở lối nhé.');return;}
 if(!confirmSessionChange('mission',id))return;
 startSession('mission',E.adventureQueue(state,m),id);}
function activeDefaults(mode,queue,missionId){return {mode,missionId,queue,index:0,intro:mode==='mission',chosen:[],hint:false,feedback:null,repeats:{},readingInput:''};}
function startSession(mode,queue,missionId=null){state.active=activeDefaults(mode,queue,missionId);E.save(state);goto('play');}
function confirmSessionChange(mode,missionId=null){
  const active=state.active;
  if(!active)return true;
  if(mode==='mission'&&active.mode===mode&&active.missionId===missionId){
    goto('play');
    return false;
  }
  return confirm('Thay buổi học đang dở bằng buổi mới? Những từ và các chặng đã lưu vẫn được giữ.');
}
function startReview(){
  if(!E.stats(state).seen){toast('Hãy khám phá một chặng trước nhé.');return;}
  const queue=E.reviewQueue(state,reviewCount,reviewSkill);
  if(!queue.length){toast('Chưa có lượt ôn cho kỹ năng này.');return;}
  if(confirmSessionChange('review'))startSession('review',queue);
}
function practiceWord(id){
  if(W[id]&&confirmSessionChange('word'))startSession('word',E.practiceWord(state,id));
}
function current(){return state.active?.queue[state.active.index];}
function maybeAudio(){const t=current();if(state.preferences.audio&&t?.type==='learn')speak(W[t.wordId].hanzi,false);}
function visitSpot(id) {
  const active = state.active;
  const task = current();
  if (task?.type !== 'trail' || !task.wordIds.includes(id)) return;
  const result = E.visitTrail(task, active.trail, id);
  active.trail = result.progress;
  if (result.found) E.see(state,id,false);
  E.save(state);
  render();
  const marker = app.querySelector(`[data-action="trail-spot"][data-id="${id}"]`);
  motion(result.correct === true ? 'lantern' : result.correct === false ? 'miss' : 'discover',
    marker, {index:task.wordIds.indexOf(id)});
  if (result.correct) {
    focusAdventure(result.progress.solved.length === task.wordIds.length
      ? '[data-action="trail-gate"]' : '#adventure-clue');
  } else {
    focusAdventure(`[data-action="trail-spot"][data-id="${id}"]`);
  }
  if (result.found && state.preferences.audio) speak(W[id].hanzi,false);
}
function beginTrailRecall() {
  const active = state.active;
  const task = current();
  if (task?.type !== 'trail') return;
  const progress = E.trailState(task, active.trail);
  if (progress.recall || progress.visited.length !== task.wordIds.length) return;
  active.trail = {...progress, recall:true, selected:null};
  E.save(state);
  render();
  scrollUp();
  motion('tune', app.querySelector('.adventure-board'));
  focusAdventure('#adventure-clue');
}
function showTrailHint() {
  const active = state.active, task = current();
  if (task?.type !== 'trail') return;
  const progress = E.trailState(task,active.trail);
  if (!progress.recall || progress.solved.length === task.wordIds.length) return;
  active.trail = {...progress,hinted:true,missed:null};
  E.save(state);
  render();
  const marker = `[data-action="trail-spot"][data-id="${task.order[progress.solved.length]}"]`;
  motion('hint', app.querySelector(marker));
  focusAdventure(marker);
}
function openTrailGate() {
  const task = current();
  if (task?.type === 'trail' && E.trailState(task,state.active.trail).solved.length === task.wordIds.length) {
    nextTask();
    motion('enter', app.querySelector('.adventure-gate'));
  }
}
function nextTask(){
  const active=state.active;
  if(!active)return;
  if(current()?.gate&&active.feedback?.quality!=='good'){
    if(!active.feedback)return;
    active.feedback=null;
    active.chosen=[];
    active.hint=true;
    E.save(state);
    render();
    focusAdventure('#gate-hint');
    return;
  }
  active.feedback=null;
  active.chosen=[];
  active.hint=false;
  active.readingInput='';
  delete active.trail;
  active.index++;
  if(active.index>=active.queue.length){finish();return;}
  E.save(state);
  render();
  scrollUp();
  focusPlayHeading();
  maybeAudio();
}
function finish() {
  const active = state.active;
  if (!active) return;
  const mission = active.mode === 'mission' ? M[active.missionId] : null;
  if (mission && !state.completed.includes(mission.id)) state.completed.push(mission.id);
  state.stats.sessions++;
  lastFinish = {
    title: mission ? 'Bạn đã mở thêm một lối đi' : 'Buổi luyện tập hoàn thành',
    description: mission ? 'Những dấu chữ đã gặp được giữ lại trong sổ từ và lịch ôn.' :
      'Những từ khó sẽ trở lại trong các lần ôn tiếp theo.',
    symbol: mission ? '🏮' : '🌿'
  };
  state.active = null;
  E.save(state);
  goto('finished');
  motion('complete', app.querySelector('.finish-icon'));
}
function giveFeedback(quality,word,explanation='',skill=null){
  const active=state.active,task=current();
  if(!active||!task||active.feedback)return;
  const success=quality==='good';
  const target=task.wordId||task.focusId;
  if(target&&skill){
    const exercise=task.type==='hanzi'?task.cue:`${task.type}:${task.sentenceId||task.wordId}`;
    E.grade(state,target,skill,quality,Date.now(),{hint:active.hint,exercise,persist:false});
    const key=`${skill}:${target}`;
    if(!success&&!task.gate&&!active.repeats[key]&&active.queue.length<120){
      const retry=E.taskFor(state,target,skill,task);
      if(retry){
        active.repeats[key]=1;
        active.queue.splice(Math.min(active.queue.length,active.index+4),0,retry);
      }
    }
  }
  const sentence=S[task.sentenceId];
  active.feedback={quality,heading:success?'Chính xác':quality==='almost'?'Hãy nhớ lại cả cách đọc và thanh điệu':'Bạn sẽ gặp lại từ này',
    intro:success?'':'Xem đáp án rồi thử lại trong buổi này hoặc lần ôn tiếp theo.',
    answerHanzi:sentence?.hanzi||word?.hanzi||'',pinyin:sentence?.pinyin||word?.pinyin||'',vi:sentence?.vi||word?.vi||'',explanation};
  if(success&&task.gate&&!state.completed.includes(active.missionId))state.completed.push(active.missionId);
  E.save(state);
  render();
  scrollUp();
  motion(success ? (task.gate ? 'unlock' : 'success') : 'miss',
    app.querySelector('.adventure-gate-icon, .feedback-emoji'));
  focusPlayHeading();
}
function answerMeaning(value){
  const task=current();
  if(task?.type!=='meaning')return;
  const word=W[task.wordId],correct=value===word.vi;
  giveFeedback(correct?'good':'again',word,correct?'':word.memo,'meaning');
}
function answerHanzi(value){
  const task=current();
  if(task?.type!=='hanzi')return;
  const word=W[task.wordId],correct=value===word.hanzi;
  giveFeedback(correct?'good':'again',word,correct?'':word.parts,'hanzi');
}
function answerTone(value){
  const task=current();
  if(task?.type!=='tone')return;
  const word=W[task.wordId],correct=value===word.pinyin;
  giveFeedback(correct?'good':'almost',word,`Thanh điệu trong từ này: ${word.pinyin}.`,'reading');
}
function answerReading(value,skip=false){
  const task=current();
  if(task?.type!=='reading')return;
  const word=W[task.wordId];
  const match=skip?'wrong':E.matchPinyin(value,word);
  if(match==='empty'){toast('Hãy nhập Pinyin hoặc chọn “Mình chưa nhớ từ này”.');return;}
  const quality=state.active.hint&&match==='good'?'almost':match==='good'?'good':match==='almost'?'almost':'again';
  const note=word.usage|| (word.hanzi==='不'?'Trước thanh 4, 不 đọc thành bú.':'');
  const expected=[word.pinyin,...(word.pinyinAlternatives||[])].join(' / ');
  const explanation=state.active.hint?`Bạn đã dùng gợi ý. Lần tới, hãy thử tự nhớ ${expected}.`:
    match==='almost'?`Bạn nhớ phần âm. Thanh điệu đúng là ${expected}.`:quality==='good'?'':`Cách đọc đầy đủ là ${expected}.`;
  giveFeedback(quality,word,[explanation,note].filter(Boolean).join(' '),'reading');
}
function answerCloze(value){
  const task=current();
  if(task?.type!=='cloze')return;
  const word=W[task.wordId],correct=value===word.hanzi;
  giveFeedback(correct?'good':'again',word,correct?'':`Câu này dùng ${word.hanzi} (${word.pinyin}) với nghĩa ${word.vi}.`,'usage');
}
function answerBuild(){
  const task=current();
  if(task?.type!=='build'||state.active.chosen.length!==task.tiles.length)return;
  const sentence=S[task.sentenceId];
  const answer=state.active.chosen.map(index=>task.tiles[index].text).join('');
  const correct=answer===sentence.tokens.join('');
  const reply=S.bs10;
  const explanation=correct&&sentence.id==='bs09'
    ? `Bạn mới đáp lại: ${reply.hanzi} (${reply.pinyin}) — ${reply.vi}` : correct?'':'Hãy đọc lại câu theo thứ tự bên trên.';
  giveFeedback(correct?'good':'again',W[task.focusId],explanation,'usage');
}
function answerContext(type,value){
  const task=current();
  if(task?.type!==type)return;
  const sentence=S[task.sentenceId],dialogue=type==='dialogue'?E.DIALOGUES[task.missionId]:null;
  const correct=value===(dialogue?sentence.hanzi:sentence.vi);
  giveFeedback(correct?'good':'again',W[task.focusId],dialogue?.explanation||'Đọc lại câu tiếng Trung cùng bản dịch.','usage');
}
const speechSystem=window.speechSynthesis;
function mandarinVoice(){
  const voices=speechSystem?.getVoices?.()||[];
  const language=voice=>voice.lang.replace('_','-').toLowerCase();
  const preferred=voices.filter(voice=>/^(cmn(?:-|$)|zh(?:-hans)?(?:-cn|-sg)(?:-|$)|zh-hans(?:-|$))/.test(language(voice)));
  return preferred.find(voice=>voice.localService)||preferred[0]||
    voices.find(voice=>/^zh(?:-hant)?-tw(?:-|$)|^zh$/.test(language(voice)));
}
function voiceStatus(){
  if(!speechSystem||!window.SpeechSynthesisUtterance)return 'Trình duyệt này chưa hỗ trợ đọc tiếng Trung.';
  const voice=mandarinVoice();
  if(!voice)return 'Thiết bị chưa cung cấp giọng Quan thoại cho trình duyệt.';
  return voice.localService?'Có giọng Quan thoại trên thiết bị.':'Giọng Quan thoại có thể cần kết nối mạng.';
}
function speak(text,notify=true,onError){
  const voice=mandarinVoice();
  if(!voice||!window.SpeechSynthesisUtterance){if(notify)toast(voiceStatus());return false;}
  try{
    speechSystem.cancel();
    const utterance=new SpeechSynthesisUtterance(text);
    utterance.voice=voice;
    utterance.lang=voice.lang;
    utterance.rate=.78;
    utterance.onerror=event=>{
      if(['canceled','interrupted'].includes(event.error))return;
      if(notify)toast('Chưa phát được giọng Quan thoại. Hãy kiểm tra giọng đọc và kết nối mạng.');
      onError?.();
    };
    speechSystem.speak(utterance);
    return true;
  }catch(_error){if(notify)toast('Chưa phát được âm thanh trên thiết bị này.');return false;}
}
speechSystem?.addEventListener?.('voiceschanged',()=>{
  const status=app.querySelector('[data-voice-status]');
  if(status)status.textContent=voiceStatus();
});
function exportProgress(){const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download='HanNguPhieuLuu-HSK1-tien-do.json';document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),3000);toast('Đã tạo file sao lưu tiến độ.');}
function saveTiles(){
  E.save(state);
  render();
  app.querySelector('[data-action="choose-tile"]:enabled, [data-action="submit-build"]:enabled')?.focus({preventScroll:true});
}
app.addEventListener('click',e=>{
 const b=e.target.closest('[data-action]');if(!b||!app.contains(b)||b.disabled)return;
 const act=b.dataset.action,id=b.dataset.id;
 if(act==='reload'){location.reload();return;}
 if(act==='nav'){goto(b.dataset.view);return;}
 if(act==='arcade-preview'){stopTour();arcadePreview(id);return;}
 if(act==='arcade-tour'){toggleTour(b);return;}
 if(act==='arcade-feature-play'||act==='arcade-start'){
   const picked=act==='arcade-feature-play'?gameIds[arcadeFocus]:id;
   const index=gameIds.indexOf(picked);
   if(index!==-1){arcadeFocus=index;arcadeId=picked;goto('arcade-game');}
   return;
 }
 if(act==='region'){selectedRegion=id;render();motion('discover',app.querySelector('.region-card.expanded .scene'));return;}
 if(act==='start-mission'){startMission(id);return;}
 if(act==='begin-next'){const next=nextMission();startMission(next.id);return;}
 if(act==='switch-to-trail'){
   const mission=state.active?.mode==='mission'&&M[state.active.missionId];
   if(mission&&state.active.queue[0]?.type!=='trail'&&
      confirm('Chơi lại chặng đang dở theo đường đèn mới? Các từ đã học và chặng đã hoàn thành vẫn được lưu.')){
     startSession('mission',E.adventureQueue(state,mission),mission.id);
   }
   return;
 }
 if(act==='resume'){goto('play');return;}
 if(act==='quit'){state.active&&E.save(state);if(state.active?.mode==='mission'){selectedRegion=M[state.active.missionId].regionId;goto('map');}else goto('home');return;}
 if(act==='begin-quest'){state.active.intro=false;E.save(state);render();scrollUp();focusPlayHeading();maybeAudio();return;}
 if(act==='trail-spot'){visitSpot(id);return;}
 if(act==='trail-recall'){beginTrailRecall();return;}
 if(act==='trail-hint'){showTrailHint();return;}
 if(act==='trail-gate'){openTrailGate();return;}
 if(act==='gate-hint'&&current()?.gate&&!state.active.feedback){
   state.active.hint=true;
   E.save(state);
   render();
   focusAdventure('#gate-hint');
   return;
 }
 if(act==='next-learn'){const t=current();E.see(state,t.wordId,false);nextTask();return;}
 if(act==='next-story'||act==='next-task'){nextTask();return;}
 if(act==='answer-meaning'){answerMeaning(b.dataset.value);return;}
 if(act==='answer-hanzi'){answerHanzi(b.dataset.value);return;}
 if(act==='answer-tone'){answerTone(b.dataset.value);return;}
 if(act==='answer-passage'){answerContext('passage',b.dataset.value);return;}
 if(act==='answer-dialogue'){answerContext('dialogue',b.dataset.value);return;}
 if(act==='answer-cloze'){answerCloze(b.dataset.value);return;}
 if(act==='skip-reading'){answerReading('',true);return;}
 if(act==='hint'){
   state.active.hint=true;
   state.active.readingInput=app.querySelector('#reading-answer').value;
   E.save(state);
   app.querySelector('#reading-hint').hidden=false;
   app.querySelector('#reading-hint').tabIndex=-1;
   app.querySelector('#reading-hint').focus({preventScroll:true});
   b.remove();
   return;
 }
 if(act==='choose-tile'){
   const index=Number(b.dataset.index);
   if(!state.active.chosen.includes(index)){
     state.active.chosen.push(index);
     saveTiles();
   }
   return;
 }
 if(act==='remove-tile'){state.active.chosen.splice(Number(b.dataset.index),1);saveTiles();return;}
 if(act==='clear-tiles'){state.active.chosen=[];saveTiles();return;}
 if(act==='submit-build'){answerBuild();return;}
 if(act==='review-skill'){reviewSkill=id;render();return;}
 if(act==='review-count'){
   reviewCount=Number(b.dataset.count);state.preferences.sessionSize=reviewCount;E.save(state);render();return;
 }
 if(act==='start-review'){startReview();return;}
 if(act==='word-filter'){wordFilter=id;dictLimit=35;render();return;}
 if(act==='more-words'){dictLimit+=35;updateWordResults();return;}
 if(act==='detail'){wordId=id;goto('detail');return;}
 if(act==='practice-word'){practiceWord(id);return;}
 if(act==='speak'){speak(b.dataset.text);return;}
 if(act==='toggle-story-pinyin'){storyShowPinyin=!storyShowPinyin;storyRevealed={};render();return;}
 if(act==='reveal-story'){
   const index=Number(b.dataset.index);
   storyRevealed[index]=!(storyRevealed[index]??storyShowPinyin);
   render();
   app.querySelector(`[data-action="reveal-story"][data-index="${index}"]`)?.focus({preventScroll:true});
   return;
 }
 if(act==='toggle-setting'){
   const key=b.dataset.key;
   state.preferences[key]=!state.preferences[key];
   if(key==='viewPinyin'){storyShowPinyin=state.preferences.viewPinyin;storyRevealed={};}
   if(key==='audio'&&!state.preferences.audio)speechSystem?.cancel?.();
   E.save(state);
   render();
   return;
 }
 if(act==='export'){exportProgress();return;}
 if(act==='import'){app.querySelector('#import-file')?.click();return;}
 if(act==='reset'){
   if(confirm('Bạn có muốn xóa TOÀN BỘ tiến độ trên trình duyệt này? Hãy sao lưu trước nếu cần.')){
     const empty=E.fresh();
     if(saveUnlessUnavailable(empty)){state=empty;reviewCount=state.preferences.sessionSize;goto('home');toast('Đã bắt đầu hành trình mới.');}
   }
   return;
 }
});
app.addEventListener('submit',e=>{if(e.target.id==='reading-form'){e.preventDefault();answerReading(e.target.querySelector('#reading-answer')?.value||'');}});
function searchChanged(input){
  wordTerm=input.value;
  dictLimit=35;
  updateWordResults();
}
app.addEventListener('input',event=>{
  if(event.target.id==='word-search'&&!event.isComposing)searchChanged(event.target);
  if(event.target.id==='reading-answer'&&state.active)state.active.readingInput=event.target.value;
});
app.addEventListener('compositionend',event=>{
  if(event.target.id==='word-search')searchChanged(event.target);
});
function saveReadingInput(){
  if(current()?.type==='reading'&&!state.active.feedback)E.save(state);
}
document.addEventListener('visibilitychange',()=>{
  if(document.hidden){saveReadingInput();stopTour();}
});
window.visualViewport?.addEventListener('resize',()=>{
  const input=document.activeElement;
  if(input?.id==='reading-answer')input.scrollIntoView({block:'nearest'});
});
app.addEventListener('change',async e=>{
 if(e.target.id==='map-region'&&Object.hasOwn(R,e.target.value)){
   selectedRegion=e.target.value;
   render();
   app.querySelector('#map-region')?.focus({preventScroll:true});
   motion('discover',app.querySelector('[data-cinema-cover]'));
   return;
 }
 if(e.target.id==='story-select'){storyRegion=e.target.value;storyRevealed={};storyShowPinyin=state.preferences.viewPinyin;render();return;}
 if(e.target.id==='import-file'&&e.target.files?.[0]){
   const file=e.target.files[0];
   e.target.value='';
   try{
     if(file.size>2000000)throw Error('Tệp quá lớn');
     const recovered=E.normalize(JSON.parse(await file.text()));
     const summary=E.stats(recovered);
     if(!confirm(`Thay tiến độ hiện tại bằng bản sao lưu có ${summary.seen} từ đã học và ${summary.quests} chặng? Bạn có thể sao lưu tiến độ hiện tại trước.`))return;
     if(!saveUnlessUnavailable(recovered))return;
     state=recovered;
     reviewCount=state.preferences.sessionSize;
     goto('home');
     toast('Đã khôi phục tiến độ!');
   }catch(err){toast('Không thể khôi phục: '+err.message);}
 }
});

render();
})();
