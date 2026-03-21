// EdgeNest AI — edgenest-main.js v3
// 공공API(오늘이후) + The Odds API(h2h+spreads+totals) 완전 구현

var WORKER = 'https://edgenest.lucius1090.workers.dev';
var PANES  = {};

// ── 공통 ─────────────────────────────────────────────────────────
function switchPane(id) {
  document.querySelectorAll('.pane').forEach(function(p){p.classList.remove('active');});
  var pid=id==='an'?'pane-analysis':'pane-'+id;
  var pe=document.getElementById(pid); if(pe) pe.classList.add('active');
  ['ls','odds','an'].forEach(function(k){
    var g=document.getElementById('gnb-'+k); if(!g) return;
    g.classList.remove('active-ls','active-odds','active-an');
    if(k===id) g.classList.add('active-'+k);
  });
  if(!PANES[id]){
    PANES[id]=true;
    if(id==='ls')   initLiveScore();
    if(id==='odds') initOdds();
    if(id==='an')   initAnalysis();
  }
  window.scrollTo(0,0);
}

(function tick(){
  var n=new Date(),t=[n.getHours(),n.getMinutes(),n.getSeconds()].map(function(v){return String(v).padStart(2,'0');}).join(':');
  var e1=document.getElementById('gnb-time'),e2=document.getElementById('s-time');
  if(e1)e1.textContent=t; if(e2)e2.textContent=t;
  setTimeout(tick,1000);
})();

// ── 배당률 ───────────────────────────────────────────────────────
var OD={all:[],meta:{},sport:'all',date:'all',prod:'all',gt:'all',busy:false};
var SPORT_ICON={'축구':'⚽','농구':'🏀','야구':'⚾','배구':'🏐','골프':'⛳'};
var SPORT_MAP={'soccer':'축구','basketball':'농구','baseball':'야구','volleyball':'배구'};

function todayKST(){return new Date(Date.now()+9*3600000).toISOString().slice(0,10).replace(/-/g,'');}

function fmtDT(ymd,hhmm){
  if(!ymd||ymd.length<8) return '-';
  var mm=parseInt(ymd.slice(4,6)),dd=parseInt(ymd.slice(6,8));
  var day=['일','월','화','수','목','금','토'][new Date(+ymd.slice(0,4),mm-1,dd).getDay()];
  var t=hhmm&&hhmm!=='0000'?hhmm.slice(0,2)+':'+hhmm.slice(2,4):'';
  return mm+'.'+String(dd).padStart(2,'0')+'('+day+')'+(t?' '+t:'');
}

function prodBadge(prod){
  var p=(prod||'프로토');
  var cfg=[
    ['프로토','#c8a84b','rgba(200,168,75,.15)','rgba(200,168,75,.4)'],
    ['토토','#60a5fa','rgba(59,130,246,.12)','rgba(59,130,246,.3)'],
    ['승5패','#34d399','rgba(16,185,129,.12)','rgba(16,185,129,.3)'],
    ['스페셜','#a78bfa','rgba(139,92,246,.12)','rgba(139,92,246,.3)'],
    ['매치','#fbbf24','rgba(245,158,11,.12)','rgba(245,158,11,.3)'],
    ['기록식','#f87171','rgba(239,68,68,.12)','rgba(239,68,68,.3)'],
  ];
  var c='#c8a84b',bg='rgba(200,168,75,.15)',bd='rgba(200,168,75,.4)';
  for(var i=0;i<cfg.length;i++){if(p.indexOf(cfg[i][0])!==-1){c=cfg[i][1];bg=cfg[i][2];bd=cfg[i][3];break;}}
  return '<span class="prod-badge" style="color:'+c+';background:'+bg+';border-color:'+bd+';">'+prod+'</span>';
}

function gtBadge(gt,hval){
  var map={'일반':'일반','핸디캡':'핸디','언더오버':'U/O','SUM':'SUM'};
  var lbl=map[gt]||gt; if(hval) lbl+=' '+hval;
  var c=gt==='핸디캡'?'#60a5fa':gt==='언더오버'?'#34d399':gt==='SUM'?'#fbbf24':'#94a3b8';
  return '<span style="font-size:.58rem;color:'+c+';white-space:nowrap;">'+lbl+'</span>';
}

function odCell(label,val,hi){
  if(!val||isNaN(+val)||+val<=0) return '<td class="od-cell-empty">-</td>';
  var nc=hi?'#e9ca6e':'#b0bec5';
  return '<td class="od-cell"><div class="od-btn" onmouseover="this.className=\'od-btn hov\'" onmouseout="this.className=\'od-btn\'">'
    +'<span class="od-label">'+label+'</span>'
    +'<span class="od-price" style="color:'+nc+';">'+( +val).toFixed(2)+'</span>'
    +'</div></td>';
}

// ── 탭 빌드 ──────────────────────────────────────────────────────
function buildTabs(wrapId, items, current, onSelect) {
  var wrap=document.getElementById(wrapId); if(!wrap) return;
  wrap.innerHTML='';
  items.forEach(function(item){
    var b=document.createElement('button');
    b.className='od-tab-btn'+(current===item.val?' active':'')+(item.small?' small':'');
    b.textContent=item.label;
    b.onclick=(function(v){return function(){
      onSelect(v);
      wrap.querySelectorAll('.od-tab-btn').forEach(function(x){x.classList.remove('active');});
      this.classList.add('active');
      odRender();
    };})(item.val);
    wrap.appendChild(b);
  });
}

function buildSportTabs(){
  buildTabs('od-sport-tabs',[
    {val:'all',label:'🌐 전체'},{val:'축구',label:'⚽ 축구'},
    {val:'농구',label:'🏀 농구'},{val:'야구',label:'⚾ 야구'},
    {val:'배구',label:'🏐 배구'},
  ],OD.sport,function(v){OD.sport=v;});
}

function buildDateTabs(){
  var today=todayKST(),days=['일','월','화','수','목','금','토'];
  var seen={},dates=[];
  OD.all.forEach(function(r){if(!seen[r.ymd]){seen[r.ymd]=true;dates.push(r.ymd);}});
  dates.sort();
  var items=[{val:'all',label:'전체'}];
  dates.forEach(function(ymd){
    var mm=parseInt(ymd.slice(4,6)),dd=parseInt(ymd.slice(6,8));
    var day=days[new Date(+ymd.slice(0,4),mm-1,dd).getDay()];
    items.push({val:ymd,label:mm+'/'+String(dd).padStart(2,'0')+'('+day+')'+(ymd===today?' 오늘':'')});
  });
  buildTabs('od-date-tabs',items,OD.date,function(v){OD.date=v;});
}

function buildProdTabs(){
  buildTabs('od-prod-tabs',[
    {val:'all',label:'전체',small:true},{val:'프로토',label:'프로토',small:true},
    {val:'토토',label:'토토',small:true},{val:'토토/프로토',label:'토토/프로토',small:true},
  ],OD.prod,function(v){OD.prod=v;});
}

function buildGtTabs(){
  var wrap=document.getElementById('od-gt-tabs'); if(!wrap) return;
  buildTabs('od-gt-tabs',[
    {val:'all',label:'전체',small:true},{val:'일반',label:'일반',small:true},
    {val:'핸디캡',label:'핸디캡',small:true},{val:'언더오버',label:'언더오버',small:true},
  ],OD.gt,function(v){OD.gt=v;});
}

// ── 렌더 ─────────────────────────────────────────────────────────
function odRender(){
  var today=todayKST();
  var rows=OD.all.filter(function(r){
    if(OD.date!=='all'&&r.ymd!==OD.date) return false;
    if(OD.sport!=='all'&&r.sport!==OD.sport) return false;
    if(OD.prod!=='all'&&(r.prod||'').indexOf(OD.prod)===-1) return false;
    if(OD.gt!=='all'&&r.gt!==OD.gt) return false;
    return true;
  });

  // 메타 업데이트
  var setEl=function(id,v){var e=document.getElementById(id);if(e)e.innerHTML=v;};
  setEl('od-total',rows.length+'경기');
  setEl('od-matched',OD.meta.matched>0?'<span style="color:#10b981;">배당 '+OD.meta.matched+'건 매칭</span>':'');
  setEl('od-upd','<span style="font-size:.5rem;color:#37485e;">'+new Date(Date.now()+9*3600000).toISOString().slice(11,16)+' 업데이트</span>');

  var wrap=document.getElementById('od-table-wrap'); if(!wrap) return;
  if(!rows.length){
    wrap.innerHTML='<div class="od-empty">📭 해당 조건의 경기가 없습니다</div>';
    return;
  }

  // 경기 그룹핑 (같은 경기의 게임유형 묶기)
  var groups=[],keyMap={},keyList=[];
  rows.forEach(function(r){
    var key=r.ymd+'|'+r.home+'|'+r.away;
    if(!keyMap[key]){
      keyMap[key]={ymd:r.ymd,hhmm:r.hhmm,sport:r.sport,league:r.league,home:r.home,away:r.away,prod:r.prod,rows:[]};
      keyList.push(key);
    }
    keyMap[key].rows.push(r);
  });
  keyList.forEach(function(k){groups.push(keyMap[k]);});

  var html='<table class="od-table"><thead><tr>'
    +'<th style="width:38px">번호</th>'
    +'<th style="width:88px">마감일시</th>'
    +'<th style="width:30px">종목</th>'
    +'<th style="min-width:80px">대회</th>'
    +'<th style="width:76px">게임종류</th>'
    +'<th style="width:70px">게임유형</th>'
    +'<th>홈팀 vs 원정팀</th>'
    +'<th style="width:78px">승(홈)/U</th>'
    +'<th style="width:78px">무</th>'
    +'<th style="width:78px">패/O</th>'
    +'</tr></thead><tbody>';

  var prevDate='';
  groups.forEach(function(g){
    if(g.ymd!==prevDate){
      prevDate=g.ymd;
      html+='<tr class="od-date-sep"><td colspan="10">'
        +fmtDT(g.ymd,'').trim()
        +(g.ymd===today?' <span class="today-badge">오늘</span>':'')
        +'</td></tr>';
    }
    var icon=SPORT_ICON[g.sport]||'🏅';
    g.rows.forEach(function(r,i){
      var isUO=r.gt==='언더오버';
      var l1=isUO?'U':'승'; var lX='무'; var l2=isUO?'O':'패';
      var has3way=r.oX!==null&&r.oX!==undefined;
      html+='<tr class="od-row'+(i%2?' alt':'')+'">'
        +'<td class="od-num">'+(r.row_num||'-')+'</td>'
        +'<td class="od-dt">'+(i===0?fmtDT(r.ymd,r.hhmm):'')+'</td>'
        +'<td class="od-sport">'+(i===0?icon:'')+'</td>'
        +'<td class="od-league">'+(i===0?(r.league||''):'')+'</td>'
        +'<td style="text-align:center;padding:4px;">'+prodBadge(r.prod)+'</td>'
        +'<td style="text-align:center;padding:4px;">'+gtBadge(r.gt,r.hval)+'</td>'
        +(i===0
          ?'<td class="od-teams"><span class="od-home">'+r.home+'</span>'
            +'<span class="od-vs">vs</span><span class="od-away">'+r.away+'</span></td>'
          :'<td class="od-teams od-sub">'+r.home+' vs '+r.away+'</td>')
        +odCell(l1,r.o1,true)
        +(has3way?odCell(lX,r.oX,false):'<td class="od-cell-empty">-</td>')
        +odCell(l2,r.o2,false)
        +'</tr>';
    });
  });
  html+='</tbody></table>';
  wrap.innerHTML=html;
}

// ── 데이터 로드 ──────────────────────────────────────────────────
function oddsLoad(){
  if(OD.busy) return; OD.busy=true;
  var wrap=document.getElementById('od-table-wrap');
  if(wrap) wrap.innerHTML='<div class="od-loading"><div class="od-spinner"></div><div style="margin-top:10px;font-size:.8rem;">배당 데이터 로딩 중...</div></div>';
  fetch(WORKER+'/toto-with-odds')
    .then(function(r){return r.ok?r.json():Promise.reject('HTTP '+r.status);})
    .then(function(data){
      OD.meta=data.meta||{};
      OD.all=(data.games||[]);
      buildSportTabs(); buildDateTabs(); buildProdTabs(); buildGtTabs();
      odRender();
    })
    .catch(function(e){
      console.error('[ODDS]',e);
      var w=document.getElementById('od-table-wrap');
      if(w) w.innerHTML='<div class="od-empty" style="color:#f87171;">⚠ 데이터 조회 실패 — 새로고침 해주세요</div>';
    })
    .finally(function(){OD.busy=false;});
}

function initOdds(){
  oddsLoad();
  setInterval(oddsLoad, 5*60*1000);
}

// ── 라이브스코어 ─────────────────────────────────────────────────
var LS={sport:'all',type:'live',busy:false,timer:null};

function lsSwitchSport(btn,sport){
  LS.sport=sport;
  document.querySelectorAll('#od-ls-sport-tabs .od-tab-btn').forEach(function(b){b.classList.remove('active');});
  if(btn) btn.classList.add('active');
  lsLoad();
}

function lsSwitchType(type){
  LS.type=type;
  var live=document.getElementById('ls-type-live');
  var upcoming=document.getElementById('ls-type-upcoming');
  if(live)    { live.style.borderBottomColor=type==='live'?'var(--green)':'transparent'; live.style.color=type==='live'?'var(--green)':'var(--t2)'; }
  if(upcoming){ upcoming.style.borderBottomColor=type==='upcoming'?'var(--gold)':'transparent'; upcoming.style.color=type==='upcoming'?'var(--gold)':'var(--t2)'; }
  lsLoad();
}

function lsLoad(){
  if(LS.busy) return; LS.busy=true;
  var sportMap={'all':'sr:sport:1','soccer':'sr:sport:1','bball':'sr:sport:2','base':'sr:sport:3','vball':'sr:sport:23'};
  var sportId=sportMap[LS.sport]||'sr:sport:1';
  fetch(WORKER+'/livescore?sport='+encodeURIComponent(sportId)+'&type='+LS.type)
    .then(function(r){return r.ok?r.json():Promise.reject(r.status);})
    .then(function(data){
      var events=data?.sports||[];
      var el=document.getElementById('ls-content');
      if(!el) return;
      if(!events.length){
        el.innerHTML='<div class="od-empty">현재 '+( LS.type==='live'?'진행중인':'예정된')+' 경기가 없습니다</div>';
        return;
      }
      // 리그별 그룹핑
      var leagueMap={},leagueOrder=[];
      events.forEach(function(ev){
        var lg=ev.competitionName||'기타';
        if(!leagueMap[lg]){leagueMap[lg]=[];leagueOrder.push(lg);}
        leagueMap[lg].push(ev);
      });
      var html='';
      leagueOrder.forEach(function(lg){
        html+='<div class="ls-league-header">'+lg+'</div>';
        leagueMap[lg].forEach(function(ev){
          var parts=(ev.eventName||'').split(' vs. ');
          var home=parts[0]||'?',away=parts[1]||'?';
          var dt=ev.openDate?new Date(ev.openDate):null;
          var timeStr=dt?String(dt.getUTCHours()+9).padStart(2,'0')+':'+String(dt.getUTCMinutes()).padStart(2,'0'):'--:--';
          var live=ev.status==='LIVE'||ev.catId==='LIVE';
          var hs=ev.homeScore||0,as=ev.awayScore||0;
          html+='<div class="ls-row">'
            +'<div class="ls-time">'+(live?'<span class="ls-live-dot"></span>':'')+(live?hs+' : '+as:timeStr)+'</div>'
            +'<div class="ls-teams"><div class="ls-home">'+home+'</div><div class="ls-away">'+away+'</div></div>'
            +(live?'<div class="ls-status live">LIVE</div>':'<div class="ls-status upcoming">예정</div>')
            +'</div>';
        });
      });
      el.innerHTML=html;
      var updEl=document.getElementById('ls-upd-time');
      if(updEl) updEl.textContent=new Date(Date.now()+9*3600000).toISOString().slice(11,16)+' 업데이트';
    })
    .catch(function(e){console.error('[LS]',e);})
    .finally(function(){LS.busy=false;});
}

function initLiveScore(){
  lsLoad();
  LS.timer=setInterval(lsLoad,30000);
}

// ── 경기분석 ─────────────────────────────────────────────────────
function initAnalysis(){
  var box=document.getElementById('an-content');
  if(box) box.innerHTML='<div class="od-empty">AI 분석 기능 준비 중...</div>';
}
