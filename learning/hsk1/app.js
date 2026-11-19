(function(){
'use strict';
const E=window.HSK_ENGINE,D=E.D,W=E.W,M=E.M,R=E.R,S=E.S,ST=E.ST;
const app=document.getElementById('app');
let state=E.load();
let view='home', selectedRegion=null,wordTerm='',wordFilter='all',dictLimit=35,wordId=null,storyRegion=null,storyShowPinyin=false,storyRevealed={},reviewSkill='all',reviewCount=state.preferences.sessionSize,toaster=null;
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

function scene(region,small=false){const r=typeof region==='string'?R[region]:region||D.regions[0];const bg=r.gradient||['#d4efe4','#f8e9bb'];return `<div class="scene ${small?'small':''}" style="--sky:${bg[0]};--ground:${bg[1]}"><svg viewBox="0 0 420 192" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><circle cx="338" cy="37" r="24" fill="#fff4b7" opacity=".95"/><circle cx="353" cy="32" r="30" fill="#fffad9" opacity=".35"/><g fill="#fff" opacity=".75"><ellipse cx="90" cy="42" rx="34" ry="13"/><ellipse cx="68" cy="40" rx="21" ry="15"/><ellipse cx="268" cy="65" rx="28" ry="10"/><ellipse cx="252" cy="61" rx="17" ry="12"/></g><path d="M0 143Q75 90 152 133T298 127T420 120V192H0Z" fill="#96c9ac"/><path d="M0 162Q98 131 180 153T420 142V192H0Z" fill="#6faf9e"/><path d="M172 194Q198 172 214 152Q228 134 213 120" stroke="#f9efcf" stroke-width="22" fill="none" opacity=".95"/><g transform="translate(30 98)"><rect x="2" y="16" width="54" height="49" fill="#fffaf2" rx="6"/><path d="M-2 19 28 -4 59 19" fill="#f4ac8d" stroke="#d7866d" stroke-width="5" stroke-linejoin="round"/><rect x="24" y="36" width="15" height="29" rx="3" fill="#ba8a6e"/><rect x="7" y="29" width="13" height="13" rx="3" fill="#b5dbe2"/></g><g transform="translate(330 111)"><rect x="16" y="32" width="7" height="48" rx="3" fill="#97754f"/><circle cx="17" cy="24" r="29" fill="#72b994"/><circle cx="40" cy="33" r="22" fill="#81c8a5"/><circle cx="1" cy="38" r="19" fill="#9dd5b1"/></g><g stroke="#f0bf69" stroke-width="3" stroke-linecap="round"><path d="M115 154v9m8-10v11m190-5v9"/></g></svg><div class="scene-buddy" aria-hidden="true">${r.emoji||'📚'}</div><span class="scene-caption">${esc(r.name)}</span></div>`;}
function btn(action,text,style='primary',extra=''){return `<button type="button" class="btn ${style}" data-action="${esc(action)}" ${extra}>${text}</button>`;}
function topbar(sub='HSK 1 · 300 từ'){return `<header class="topbar"><button class="brand" data-action="nav" data-view="home" aria-label="Về trang chủ"><span class="brand-mark">汉</span><span><strong>Hán Ngữ Phiêu Lưu</strong><small>${esc(sub)}</small></span></button><button class="round-button" data-action="nav" data-view="settings" aria-label="Cài đặt">${icon('settings')}</button></header>`;}
function nav(active){return `<nav class="bottom-nav" aria-label="Điều hướng chính">${[['home','home','Trang chủ'],['map','map','Khám phá'],['review','repeat','Ôn tập'],['words','book','Từ điển'],['progress','chart','Tiến độ']].map(([name,ico,lab])=>`<button class="nav-item ${active===name?'active':''}" data-action="nav" data-view="${name}" aria-label="${lab}">${icon(ico)}<span>${lab}</span></button>`).join('')}</nav>`;}
function frame(html,tab,sub){return `<main class="app-main">${topbar(sub)}${html}</main>${nav(tab)}`;}
function pill(text,cls=''){return `<span class="pill ${cls}">${esc(text)}</span>`;}
function progressBar(a,b,label='Tiến độ'){return `<div class="meter" role="progressbar" aria-label="${esc(label)}" aria-valuenow="${a}" aria-valuemin="0" aria-valuemax="${b}"><span style="width:${fmtPercent(a,b)}%"></span></div>`;}
function nextMission(){return D.missions.find(m=>!state.completed.includes(m.id))||D.missions[D.missions.length-1];}
function regionCompleted(r){return r.missionIds.filter(mid=>state.completed.includes(mid)).length;}
function home(){const st=E.stats(state),m=nextMission(),r=R[m.regionId],isActive=!!state.active;
 return frame(`<section class="eyebrow">${icon('spark')} ĐI MỖI NGÀY MỘT CHÚT, NHỚ THẬT LÂU</section><div class="hero"><div class="hero-body"><span class="mini-label">🌱 HÀNH TRÌNH CỦA BẠN</span><h1>Học chữ Hán như một cuộc phiêu lưu.</h1><p class="subtle">Mỗi từ sẽ trở lại trong những tình huống khác nhau. Không cần đua điểm, chỉ cần nhớ lâu hơn.</p><div class="hero-stats"><b>${st.seen}<span>/300 từ đã gặp</span></b><b>${st.quests}<span>/${st.totalQuests} chặng</span></b></div>${progressBar(st.seen,300,'Từ vựng đã gặp')}</div>${scene(r)}</div>
 <div class="top-buttons">${btn(isActive?'resume':'begin-next',`${icon('play')} ${isActive?'Tiếp tục đang chơi':'Tiếp tục phiêu lưu'}`)}${btn('nav',`${icon('repeat')} Ôn từ`, 'button-soft','data-view="review"')}</div>
 <div class="home-reminder"><div class="reminder-em">🧠</div><div><strong>${st.due?`${st.due} lượt luyện đang cần ôn`:'Bắt đầu ôn để tạo trí nhớ dài hạn'}</strong><p>Từ hay quên sẽ quay lại sớm hơn. Bạn không bị phạt khi nghỉ học.</p></div><button data-action="nav" data-view="review" aria-label="Mở ôn tập">${icon('arrow')}</button></div>
 <div class="section-title"><h2>Điểm dừng tiếp theo</h2><button class="link-button" data-action="nav" data-view="map">Xem bản đồ ${icon('arrow')}</button></div><button class="next-card" data-action="start-mission" data-id="${m.id}"><span class="next-emoji">${r.emoji}</span><span><small>Khu vực ${r.number} · Chặng ${m.step}</small><strong>${esc(r.name)}</strong><span class="mini-wordchain">${m.wordIds.map(id=>hanzi(W[id].hanzi)).join(' · ')}</span></span>${icon('arrow')}</button>
 <div class="section-title"><h2>Học theo cách của bạn</h2></div><div class="feature-grid"><button class="feature-card" data-action="nav" data-view="words"><span class="feature-icon">🔤</span><b>Chữ gốc → từ ghép</b><small>Tra đủ 300 từ, xem từ cùng họ.</small></button><button class="feature-card" data-action="nav" data-view="reader"><span class="feature-icon">📖</span><b>Đọc hiểu theo chủ đề</b><small>Đọc câu trong ngữ cảnh, hiện Pinyin khi cần.</small></button></div>
 `,'home');}
function mapView(){const st=E.stats(state);if(!selectedRegion)selectedRegion=nextMission().regionId;
 let out=`<div class="eyebrow">${icon('map')} BẢN ĐỒ HỌC TẬP</div><h1>${D.regions.length} vùng đất tiếng Trung</h1><p class="subtle mt8">${st.totalQuests} chặng nhỏ · ${st.total} từ. Các từ cũ vẫn quay lại trong nhiệm vụ mới.</p><div class="map-overview">${progressBar(st.quests,st.totalQuests,'Số chặng đã hoàn thành')}<span>${st.quests}/${st.totalQuests} chặng hoàn thành</span></div><div class="region-list">`;
 D.regions.forEach((r,idx)=>{const count=regionCompleted(r),open=r.id===selectedRegion;const firstUnfinished=nextMission(),unlocked=idx===0||D.regions.slice(0,idx).every(q=>q.missionIds.every(mid=>state.completed.includes(mid)))||r.missionIds.some(mid=>state.completed.includes(mid))||r.id===firstUnfinished.regionId;
  out+=`<div class="region-card ${open?'expanded':''} ${!unlocked?'region-upcoming':''}"><button class="region-head" data-action="region" data-id="${r.id}" aria-expanded="${open}"><span class="region-emoji">${r.emoji}</span><span class="region-desc"><small>VÙNG ${idx+1} · ${r.wordIds.length} TỪ</small><strong>${esc(r.name)}</strong><em>${count}/${r.missionIds.length} chặng · ${unlocked?'Có thể chơi':'Sắp mở khóa'}</em></span><span class="region-chevron">⌄</span></button>`;
  if(open){out+=scene(r,true)+`<p class="region-intro">${esc(r.intro)}</p><div class="quest-list">`;r.missionIds.forEach(mid=>{const m=M[mid],done=state.completed.includes(mid),mx=D.missions.findIndex(x=>x.id===mid);const allowed=mx===0||done||state.completed.includes(D.missions[mx-1].id);out+=`<button class="quest-row" data-action="start-mission" data-id="${mid}" ${allowed?'':'disabled'}><span class="quest-dot ${done?'done':allowed?'available':'locked'}">${done?icon('check'):allowed?'✦':'•'}</span><span><strong>${esc(m.title)}</strong><small>${m.wordIds.map(wid=>W[wid].hanzi).join(' · ')}</small></span>${allowed?icon('arrow'):''}</button>`;});out+=`</div>`;}
  out+='</div>';});out+='</div>';return frame(out,'map');}
function review(){
  const st=E.stats(state);
  const weak=E.dueItems(state,40).filter((item,index,all)=>all.findIndex(other=>other.id===item.id)===index).slice(0,6);
  return frame(`<div class="eyebrow">${icon('repeat')} ÔN TẬP THÔNG MINH</div>
    <h1>Ôn từ đã học</h1><p class="subtle mt8">Tập trung vào kỹ năng bạn dễ quên và chia những lượt đến hạn thành buổi ngắn.</p>
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
function playHeader(){const x=state.active;const mission=x.mode==='mission'?M[x.missionId]:null;return `<div class="play-header"><button class="back-circle" data-action="quit" aria-label="Dừng và về trang trước">${icon('left')}</button><div><b>${mission?esc(R[mission.regionId].name):x.mode==='review'?'Buổi ôn ghi nhớ':x.mode==='word'?'Luyện một từ':'Luyện ghép câu'}</b><small>Thử thách ${x.index+1} / ${x.queue.length}</small>${progressBar(x.index,x.queue.length,'Thử thách')}</div><button class="back-circle" data-action="quit" aria-label="Đóng">${icon('close')}</button></div>`;}
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
function finished(){const f=lastFinish||{title:'Hoàn thành buổi học',description:'Những từ khó sẽ xuất hiện lại vào lúc cần ôn.'};const st=E.stats(state);return frame(`<div class="finish"><div class="finish-icon">🌳</div><span class="mini-label">MỖI LẦN CHƠI LÀ MỘT LẦN NHỚ</span><h1>${esc(f.title)}</h1><p class="subtle mt10">${esc(f.description||'Bạn đã luyện lại chữ Hán, Pinyin và cách dùng. Các từ chưa chắc sẽ tiếp tục quay lại.')}</p><div class="finish-stat"><div><strong>${st.seen}/300</strong><small>Từ đã gặp</small></div><div><strong>${st.due}</strong><small>Lượt cần ôn</small></div></div>${btn('begin-next',`${icon('play')} Khám phá tiếp`,'primary full mt20')}${btn('nav',`${icon('repeat')} Ôn những từ đã gặp`,'button-soft full mt12','data-view="review"')}${btn('nav','Về trang chủ','button-text full mt8','data-view="home"')}</div>`,'home');}
let lastFinish=null;
const taskViews={learn:learnTask,meaning:meaningTask,reading:readingTask,hanzi:hanziTask,tone:toneTask,
  cloze:clozeTask,build:buildTask,story:storyTask,passage:passageTask,dialogue:dialogueTask};
function renderPlay(){
  const active=state.active,task=current();
  if(!active||!task){view='home';return home();}
  const content=active.intro&&active.mode==='mission'
    ? questIntro(active)
    : playHeader()+(active.feedback?feedbackTask(active.feedback):taskViews[task.type](task));
  return `<main class="app-main play-main">${content}</main>`;
}
function render(){document.body.classList.toggle('reduce-motion',state.preferences.lowMotion);try{let html;switch(view){case'home':html=home();break;case'map':html=mapView();break;case'review':html=review();break;case'words':html=words();break;case'detail':html=detail();break;case'progress':html=progress();break;case'reader':html=reader();break;case'settings':html=settings();break;case'play':html=renderPlay();break;case'finished':html=finished();break;default:view='home';html=home();}app.innerHTML=html;if(!E.storageHealthy())toast('Trình duyệt không lưu được tiến độ. Hãy dùng tính năng sao lưu.');}catch(err){console.error('Render error',err);app.innerHTML=`<div class="app-main error-screen"><h2>Gặp lỗi hiển thị</h2><p>Hãy tải lại trang. Dữ liệu đã lưu vẫn được giữ trên thiết bị.</p><button class="btn primary" data-action="reload">Tải lại</button></div>`;}}
function goto(next){view=next;render();scrollUp();if(view==='play')focusPlayHeading();}
function startMission(id){const m=M[id];if(!m)return;const idx=D.missions.findIndex(q=>q.id===id);if(idx>0&&!state.completed.includes(id)&&!state.completed.includes(D.missions[idx-1].id)){toast('Hãy hoàn thành chặng trước để mở lối nhé.');return;}
 if(!confirmSessionChange('mission',id))return;
 startSession('mission',E.missionQueue(state,m),id);}
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
function nextTask(){
  const active=state.active;
  if(!active)return;
  active.feedback=null;
  active.chosen=[];
  active.hint=false;
  active.readingInput='';
  active.index++;
  if(active.index>=active.queue.length){finish();return;}
  E.save(state);
  render();
  scrollUp();
  focusPlayHeading();
  maybeAudio();
}
function finish(){const a=state.active;if(!a)return;const isMission=a.mode==='mission';if(isMission&&!state.completed.includes(a.missionId)){state.completed.push(a.missionId);}state.stats.sessions++;lastFinish={title:isMission?'Bạn đã qua một chặng!':'Buổi luyện tập hoàn thành!',description:'Những chữ chưa chắc sẽ trở lại trong các lần chơi sau. Không cần học lại từ đầu.'};state.active=null;E.save(state);goto('finished');}
function giveFeedback(quality,word,explanation='',skill=null){
  const active=state.active,task=current();
  if(!active||!task||active.feedback)return;
  const success=quality==='good';
  const target=task.wordId||task.focusId;
  if(target&&skill){
    const exercise=task.type==='hanzi'?task.cue:`${task.type}:${task.sentenceId||task.wordId}`;
    E.grade(state,target,skill,quality,Date.now(),{hint:active.hint,exercise,persist:false});
    const key=`${skill}:${target}`;
    if(!success&&!active.repeats[key]&&active.queue.length<120){
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
  E.save(state);
  render();
  scrollUp();
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
function speak(text,notify=true){
  const voice=mandarinVoice();
  if(!voice||!window.SpeechSynthesisUtterance){if(notify)toast(voiceStatus());return;}
  try{
    speechSystem.cancel();
    const utterance=new SpeechSynthesisUtterance(text);
    utterance.voice=voice;
    utterance.lang=voice.lang;
    utterance.rate=.78;
    utterance.onerror=event=>{
      if(notify&&!['canceled','interrupted'].includes(event.error))toast('Chưa phát được giọng Quan thoại. Hãy kiểm tra giọng đọc và kết nối mạng.');
    };
    speechSystem.speak(utterance);
  }catch(_error){if(notify)toast('Chưa phát được âm thanh trên thiết bị này.');}
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
 if(act==='region'){selectedRegion=id;render();return;}
 if(act==='start-mission'){startMission(id);return;}
 if(act==='begin-next'){const next=nextMission();startMission(next.id);return;}
 if(act==='resume'){goto('play');return;}
 if(act==='quit'){state.active&&E.save(state);if(state.active?.mode==='mission'){selectedRegion=M[state.active.missionId].regionId;goto('map');}else goto('home');return;}
 if(act==='begin-quest'){state.active.intro=false;E.save(state);render();scrollUp();focusPlayHeading();maybeAudio();return;}
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
  if(document.visibilityState==='hidden')saveReadingInput();
});
window.visualViewport?.addEventListener('resize',()=>{
  const input=document.activeElement;
  if(input?.id==='reading-answer')input.scrollIntoView({block:'nearest'});
});
app.addEventListener('change',async e=>{
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
