// ================================================================
// EdgeNest AI — edgenest-main.js  (배당률 베트맨/와이즈토토 스타일)
// ================================================================

var WORKER = 'https://edgenest.lucius1090.workers.dev';
var PANES  = {};

// ── 공통 ─────────────────────────────────────────────────────────
function switchPane(id) {
  document.querySelectorAll('.pane').forEach(function(p){ p.classList.remove('active'); });
  var pid = id === 'an' ? 'pane-analysis' : 'pane-' + id;
  var pe  = document.getElementById(pid);
  if (pe) pe.classList.add('active');
  ['ls','odds','an'].forEach(function(k){
    var g = document.getElementById('gnb-'+k);
    if (!g) return;
    g.classList.remove('active-ls','active-odds','active-an');
    if (k === id) g.classList.add('active-'+k);
  });
  if (!PANES[id]) {
    PANES[id] = true;
    if (id==='ls')   initLiveScore();
    if (id==='odds') initOdds();
    if (id==='an')   initAnalysis();
  }
  window.scrollTo(0,0);
}

(function tick(){
  var n = new Date(), t=[n.getHours(),n.getMinutes(),n.getSeconds()].map(function(v){return String(v).padStart(2,'0');}).join(':');
  var e1=document.getElementById('gnb-time'), e2=document.getElementById('s-time');
  if(e1) e1.textContent=t; if(e2) e2.textContent=t;
  setTimeout(tick,1000);
})();

// ── 배당률 ───────────────────────────────────────────────────────
var OD={all:[],meta:{},sport:'all',date:'all',prod:'all',busy:false};
var SPORT_ICON={'축구':'⚽','농구':'🏀','야구':'⚾','배구':'🏐','골프':'⛳'};

function todayKST(){ return new Date(Date.now()+9*3600000).toISOString().slice(0,10).replace(/-/g,''); }
function nowHHMM(){ var d=new Date(Date.now()+9*3600000); return String(d.getUTCHours()).padStart(2,'0')+String(d.getUTCMinutes()).padStart(2,'0'); }

function fmtDT(ymd,hhmm){
  if(!ymd||ymd.length<8) return '-';
  var mm=parseInt(ymd.slice(4,6)),dd=parseInt(ymd.slice(6,8));
  var day=['일','월','화','수','목','금','토'][new Date(+ymd.slice(0,4),mm-1,dd).getDay()];
  var t=hhmm&&hhmm!=='0000'?hhmm.slice(0,2)+':'+hhmm.slice(2,4):'';
  return mm+'.'+String(dd).padStart(2,'0')+'('+day+')'+(t?' '+t:'');
}

function prodBadge(prod){
  var p=(prod||'프로토');
  var cfg=[['프로토','#c8a84b','rgba(200,168,75,.15)','rgba(200,168,75,.4)'],['토토','#60a5fa','rgba(59,130,246,.12)','rgba(59,130,246,.3)'],
    ['승5패','#34d399','rgba(16,185,129,.12)','rgba(16,185,129,.3)'],['스페셜','#a78bfa','rgba(139,92,246,.12)','rgba(139,92,246,.3)'],
    ['매치','#fbbf24','rgba(245,158,11,.12)','rgba(245,158,11,.3)'],['기록식','#f87171','rgba(239,68,68,.12)','rgba(239,68,68,.3)']];
  var c='#c8a84b',bg='rgba(200,168,75,.15)',bd='rgba(200,168,75,.4)';
  for(var i=0;i<cfg.length;i++){ if(p.indexOf(cfg[i][0])!==-1){c=cfg[i][1];bg=cfg[i][2];bd=cfg[i][3];break;} }
  return '<span style="display:inline-block;padding:2px 7px;border-radius:3px;font-size:.62rem;font-weight:600;color:'+c+';background:'+bg+';border:1px solid '+bd+';white-space:nowrap;">'+prod+'</span>';
}

function gtLabel(gt,hval){
  var map={'일반':'일반','핸디캡':'핸디','언더오버':'U/O','SUM':'SUM'};
  var lbl=map[gt]||gt; if(hval) lbl+=' '+hval;
  var c=gt==='핸디캡'?'#60a5fa':gt==='언더오버'?'#34d399':gt==='SUM'?'#fbbf24':'#94a3b8';
  return '<span style="font-size:.58rem;color:'+c+';white-space:nowrap;">'+lbl+'</span>';
}

function odCell(label,val,highlight){
  if(!val||isNaN(+val)||+val<=0) return '<td style="text-align:center;padding:8px 4px;color:#37485e;font-size:.7rem;">-</td>';
  var nc=highlight?'#e9ca6e':'#dde3ef';
  return '<td style="text-align:center;padding:4px;">'
    +'<div style="display:inline-flex;flex-direction:column;align-items:center;gap:1px;padding:5px 10px;'
    +'border-radius:4px;border:1px solid rgba(255,255,255,.07);background:rgba(255,255,255,.03);cursor:pointer;min-width:62px;transition:all .12s;"'
    +' onmouseover="this.style.background=\'rgba(200,168,75,.12)\';this.style.borderColor=\'rgba(200,168,75,.4)\'"'
    +' onmouseout="this.style.background=\'rgba(255,255,255,.03)\';this.style.borderColor=\'rgba(255,255,255,.07)\'">'
    +'<span style="font-size:.5rem;color:#7a8ba8;">'+label+'</span>'
    +'<span style="font-size:.88rem;font-weight:700;color:'+nc+';">'+( +val).toFixed(2)+'</span>'
    +'</div></td>';
}

// 탭 빌드
function buildSportTabs(){
  var wrap=document.getElementById('od-sport-tabs'); if(!wrap) return;
  var sports=['all','축구','농구','야구','배구','골프'];
  var labels={'all':'🌐 전체','축구':'⚽ 축구','농구':'🏀 농구','야구':'⚾ 야구','배구':'🏐 배구','골프':'⛳ 골프'};
  wrap.innerHTML='';
  sports.forEach(function(s){
    var b=document.createElement('button'); b.className='od-tab-btn'+(OD.sport===s?' active':''); b.textContent=labels[s];
    b.onclick=(function(v){ return function(){ OD.sport=v; wrap.querySelectorAll('.od-tab-btn').forEach(function(x){x.classList.remove('active');}); this.classList.add('active'); odRender(); }; })(s);
    wrap.appendChild(b);
  });
}

function buildDateTabs(){
  var wrap=document.getElementById('od-date-tabs'); if(!wrap) return;
  var today=todayKST(); var days=['일','월','화','수','목','금','토'];
  var seen={},dates=[];
  OD.all.forEach(function(r){ if(r.ymd&&!seen[r.ymd]){seen[r.ymd]=true;dates.push(r.ymd);} });
  dates.sort();
  wrap.innerHTML='';
  function mk(label,val,isActive){
    var b=document.createElement('button');
    b.className='od-tab-btn'+(isActive?' active':'');
    b.textContent=label;
    b.onclick=(function(v){ return function(){ OD.date=v; wrap.querySelectorAll('.od-tab-btn').forEach(function(x){x.classList.remove('active');}); this.classList.add('active'); odRender(); }; })(val);
    wrap.appendChild(b);
  }
  mk('전체','all',OD.date==='all');
  dates.forEach(function(ymd){
    var mm=parseInt(ymd.slice(4,6)),dd=parseInt(ymd.slice(6,8));
    var day=days[new Date(+ymd.slice(0,4),mm-1,dd).getDay()];
    var isToday=(ymd===today);
    var label=mm+'/'+String(dd).padStart(2,'0')+'('+day+')'+(isToday?' 오늘':'');
    mk(label,ymd,OD.date===ymd);
  });
}

function buildProdTabs(){
  var wrap=document.getElementById('od-prod-tabs'); if(!wrap) return;
  var prods=['all','프로토','토토','승5패','스페셜','매치','기록식'];
  wrap.innerHTML='';
  prods.forEach(function(p){
    var b=document.createElement('button'); b.className='od-tab-btn small'+(OD.prod===p?' active':''); b.textContent=p==='all'?'전체':p;
    b.onclick=(function(v){ return function(){ OD.prod=v; wrap.querySelectorAll('.od-tab-btn').forEach(function(x){x.classList.remove('active');}); this.classList.add('active'); odRender(); }; })(p);
    wrap.appendChild(b);
  });
}

function odRender(){
  var today=todayKST();

  var rows=OD.all.filter(function(r){
    if(OD.date!=='all'&&r.ymd!==OD.date) return false;
    if(OD.sport!=='all'&&r.sport!==OD.sport) return false;
    if(OD.prod!=='all'){
      if(OD.prod==='스페셜'&&r.prod.indexOf('스페셜')===-1) return false;
      else if(OD.prod!=='스페셜'&&r.prod.indexOf(OD.prod)===-1) return false;
    }
    return true;
  });

  var el=function(id,v){var e=document.getElementById(id);if(e)e.textContent=v;};
  var elH=function(id,v){var e=document.getElementById(id);if(e)e.innerHTML=v;};
  elH('od-round',OD.meta.round_no?'프로토 '+OD.meta.round_no+'회차':'— 회차');
  el('od-total',rows.length+'경기');
  el('od-matched',OD.meta.matched>0?'배당 '+OD.meta.matched+'건 매칭':'');

  var wrap=document.getElementById('od-table-wrap'); if(!wrap) return;

  if(!rows.length){ wrap.innerHTML='<div style="text-align:center;padding:80px;color:#37485e;font-size:.85rem;">📭 해당 조건의 경기가 없습니다</div>'; return; }

  // 그룹핑
  var groups=[],keyList=[],keyMap={};
  rows.forEach(function(r){
    var key=r.ymd+'|'+r.home+'|'+r.away;
    if(!keyMap[key]){keyMap[key]={ymd:r.ymd,hhmm:r.hhmm,sport:r.sport,league:r.league,home:r.home,away:r.away,rows:[]};keyList.push(key);}
    keyMap[key].rows.push(r);
  });
  keyList.forEach(function(k){groups.push(keyMap[k]);});

  var html='<table class="od-table"><thead><tr>'
    +'<th style="width:42px">번호</th><th style="width:100px">마감일시</th>'
    +'<th style="width:34px">종목</th><th style="min-width:80px">대회</th>'
    +'<th style="width:82px">게임종류</th><th style="width:76px">게임유형</th>'
    +'<th>홈팀 vs 원정팀</th>'
    +'<th style="width:80px">승(홈)</th><th style="width:80px">무</th><th style="width:80px">패</th>'
    +'</tr></thead><tbody>';

  var prevDate='';
  groups.forEach(function(g){
    if(g.ymd!==prevDate){
      prevDate=g.ymd; var isToday=g.ymd===today;
      var dtLabel=fmtDT(g.ymd,'').trim();
      html+='<tr class="od-date-row"><td colspan="10">'+dtLabel+(isToday?' <span class="today-badge">오늘</span>':'')+'</td></tr>';
    }
    var icon=SPORT_ICON[g.sport]||'🏅';
    var imba=g.rows[0]&&g.rows[0].imba;
    g.rows.forEach(function(r,i){
      var isUO=r.gt==='언더오버',isSUM=r.gt==='SUM',is3way=r.oX!==null&&r.oX!==undefined;
      var l1=isUO?'U':(isSUM?'홀':'승'),lX=(isUO||isSUM)?null:'무',l2=isUO?'O':(isSUM?'짝':'패');
      var rc='od-row'+(imba?' imba':'')+(i%2===1?' alt':'');
      html+='<tr class="'+rc+'">'
        +'<td class="num">'+(r.row_num||'-')+(imba&&i===0?'<br><span class="imba-tag">!</span>':'')+'</td>'
        +'<td class="dt">'+(i===0?fmtDT(r.ymd,r.hhmm):'')+'</td>'
        +'<td class="sport">'+(i===0?icon:'')+'</td>'
        +'<td class="league">'+(i===0?(r.league||''):'')+'</td>'
        +'<td style="text-align:center;padding:5px 4px;">'+prodBadge(r.prod)+'</td>'
        +'<td style="text-align:center;padding:5px 4px;">'+gtLabel(r.gt,r.hval)+'</td>'
        +(i===0?'<td class="teams"><span class="home">'+r.home+'</span><span class="vs">vs</span><span class="away">'+r.away+'</span></td>'
               :'<td class="teams sub">'+r.home+' vs '+r.away+'</td>')
        +odCell(l1,r.o1,true)
        +(is3way&&lX?odCell(lX,r.oX,false):'<td style="text-align:center;padding:8px 4px;color:#37485e;">-</td>')
        +odCell(l2,r.o2,false)
        +'</tr>';
    });
  });

  html+='</tbody></table>';
  wrap.innerHTML=html;
}

function oddsLoad(){
  if(OD.busy) return; OD.busy=true;
  var wrap=document.getElementById('od-table-wrap');
  if(wrap) wrap.innerHTML='<div style="text-align:center;padding:80px;color:#7a8ba8;"><div class="od-spinner"></div><div style="margin-top:12px;font-size:.8rem;">경기 정보 및 배당률 로딩 중...</div></div>';
  fetch(WORKER+'/toto-with-odds')
    .then(function(r){return r.ok?r.json():Promise.reject('HTTP '+r.status);})
    .then(function(data){
      OD.meta=data.meta||{};
      var today=todayKST();
      OD.all=(data.games||[]).map(function(g){
        var hf=null;
        if(g.hval){ if(g.gt==='핸디캡') hf=(parseFloat(g.hval)>=0?'H +':'H ')+g.hval; else if(g.gt==='언더오버') hf='U/O '+g.hval; else hf=g.hval; }
        var utcMs=0;
        if(g.match_ymd&&g.match_ymd.length>=8){var h=+(g.match_tm||'0000').slice(0,2),m=+(g.match_tm||'0000').slice(2,4); utcMs=Date.UTC(+g.match_ymd.slice(0,4),+g.match_ymd.slice(4,6)-1,+g.match_ymd.slice(6,8),h-9,m);}
        return {row_num:g.row_num,ymd:g.match_ymd||'',hhmm:g.match_tm||'0000',sport:g.sport||'',league:g.league||'',prod:g.prod||'프로토',gt:g.gt||'일반',hval:hf,home:g.home||'',away:g.away||'',o1:g.o1,oX:g.oX,o2:g.o2,imba:utcMs>0&&utcMs>Date.now()&&(utcMs-Date.now())<2*3600*1000};
      });
      buildSportTabs(); buildDateTabs(); buildProdTabs(); odRender();
    })
    .catch(function(e){console.error('[ODDS]',e);var w=document.getElementById('od-table-wrap');if(w)w.innerHTML='<div style="text-align:center;padding:80px;color:#f87171;">⚠ 데이터 조회 실패<br><small>새로고침 해주세요</small></div>';})
    .finally(function(){OD.busy=false;});
}

function initOdds(){ oddsLoad(); setInterval(oddsLoad,5*60*1000); }

// ── 라이브스코어 ─────────────────────────────────────────────────
function initLiveScore(){
  var el=document.getElementById('ls-content');
  if(el) el.innerHTML='<div style="text-align:center;padding:80px;color:#7a8ba8;">라이브스코어 기능은 다음 버전에서 제공됩니다</div>';
}

// ── 경기분석 ─────────────────────────────────────────────────────
var AN_RAPID_KEY='6a5d1ea245msh63d3ebd0b873de0p1da56bjsn370ddd7e5d58';
var AN_CLAUDE_VER='claude-sonnet-4-20250514';
var anSP='soccer',anSUB='analysis',anCache={};
var AN_SUBS={soccer:[{id:'analysis',l:'🤖 AI분석'},{id:'odds',l:'💰 배당률'},{id:'stats',l:'팀통계'}],baseball:[{id:'analysis',l:'🤖 AI분석'}],basketball:[{id:'analysis',l:'🤖 AI분석'}],volleyball:[{id:'analysis',l:'🤖 AI분석'}]};
function setSport(sp,btn){anSP=sp;document.querySelectorAll('.s-btn').forEach(function(b){b.classList.remove('on');});if(btn)btn.classList.add('on');buildSubNav();anRender();}
function buildSubNav(){var nav=document.getElementById('an-sub-nav');if(!nav)return;var subs=AN_SUBS[anSP]||AN_SUBS.soccer;nav.innerHTML=subs.map(function(s){return '<button class="sub-btn'+(anSUB===s.id?' on':'')+'" onclick="setSub(\''+s.id+'\',this)">'+s.l+'</button>';}).join('');}
function setSub(id,btn){anSUB=id;document.querySelectorAll('.sub-btn').forEach(function(b){b.classList.remove('on');});if(btn)btn.classList.add('on');anRender();}
function anRender(){var box=document.getElementById('an-content');if(!box)return;box.innerHTML='<div style="text-align:center;padding:60px;color:#7a8ba8;">AI 분석 기능 준비 중...</div>';}
function initAnalysis(){buildSubNav();anRender();}
