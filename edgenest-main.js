
// ================================================================
// EdgeNest AI — edgenest-main.js
// 완전 재작성 버전 — 따옴표 혼용 없음, 중복 선언 없음
// ================================================================

// ── 블록1: 공통 ──────────────────────────────────────────────────

const PANES = { home:true, ls:false, odds:false, an:false };

function switchPane(id) {
  document.querySelectorAll('.pane').forEach(function(p) { p.classList.remove('active'); });
  var paneId = id === 'an' ? 'pane-analysis' : 'pane-' + id;
  var pane = document.getElementById(paneId);
  if (pane) pane.classList.add('active');

  ['ls','odds','an'].forEach(function(k) {
    var el = document.getElementById('gnb-' + k);
    if (!el) return;
    el.classList.remove('active-ls','active-odds','active-an');
    if (k === id) el.classList.add('active-' + id);
  });

  if (!PANES[id]) {
    PANES[id] = true;
    if (id === 'ls')   initLiveScore();
    if (id === 'odds') initOdds();
    if (id === 'an')   initAnalysis();
  }
  window.scrollTo(0, 0);
}

(function tick() {
  const n = new Date();
  const t = String(n.getHours()).padStart(2,'0') + ':' + String(n.getMinutes()).padStart(2,'0') + ':' + String(n.getSeconds()).padStart(2,'0');
  const el = document.getElementById('gnb-time');
  const el2 = document.getElementById('s-time');
  if (el) el.textContent = t;
  if (el2) el2.textContent = t;
  setTimeout(tick, 1000);
})();

try {
  const oddsEl = document.getElementById('s-odds');
  if (oddsEl) oddsEl.textContent = new Date().toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'});
} catch(e) {}



// ── 블록2: 라이브스코어 (Sportsradar RapidAPI) ────────────────────

var WORKER = 'https://edgenest.lucius1090.workers.dev';

var LS = {
  sport: 'all',   // all | soccer | bball | base | vball
  type:  'live',  // live | upcoming
  busy:  false,
  timer: null,
};

// Sportsradar sport ID 매핑
var SR_SPORT = {
  soccer: 'sr:sport:1',
  bball:  'sr:sport:2',
  base:   'sr:sport:3',
  vball:  'sr:sport:23',
};

function lsSwitchSport(btn, val) {
  document.querySelectorAll('.odds-sport-tab[id^="ls-tab"]').forEach(function(b) { b.classList.remove('active'); });
  btn.classList.add('active');
  LS.sport = val;
  lsLoad();
}

function lsSwitchType(type) {
  LS.type = type;
  var live = document.getElementById('ls-type-live');
  var up   = document.getElementById('ls-type-upcoming');
  if (!live || !up) return;
  if (type === 'live') {
    live.style.borderBottomColor = 'var(--green)';
    live.style.color = 'var(--green)';
    live.style.background = 'rgba(16,185,129,.06)';
    up.style.borderBottomColor = 'transparent';
    up.style.color = 'var(--t2)';
    up.style.background = 'none';
  } else {
    up.style.borderBottomColor = 'var(--gold)';
    up.style.color = 'var(--gold2)';
    up.style.background = 'var(--gold-a)';
    live.style.borderBottomColor = 'transparent';
    live.style.color = 'var(--t2)';
    live.style.background = 'none';
  }
  lsLoad();
}

function lsKstNow() {
  var d = new Date(Date.now() + 9*3600000);
  return String(d.getUTCHours()).padStart(2,'0') + ':' + String(d.getUTCMinutes()).padStart(2,'0');
}

// Sportsradar 응답 파싱 - 이벤트 구조 정규화
function lsParseEvent(ev) {
  var home = '', away = '', hScore = null, aScore = null, status = '', elapsed = '', league = '';
  // 여러 응답 구조 대응
  if (ev.competitors && ev.competitors.length >= 2) {
    var c0 = ev.competitors[0], c1 = ev.competitors[1];
    if (c0.qualifier === 'home' || !c0.qualifier) { home = c0.name||''; away = c1.name||''; }
    else { home = c1.name||''; away = c0.name||''; }
  }
  if (ev.home_score !== undefined) { hScore = ev.home_score; aScore = ev.away_score; }
  else if (ev.period_scores && ev.period_scores.length) {
    var last = ev.period_scores[ev.period_scores.length - 1];
    hScore = last.home_score; aScore = last.away_score;
  }
  status  = (ev.match_status || ev.status || '').toString().toLowerCase();
  elapsed = ev.clock ? (ev.clock.played || ev.clock.remaining || '') : '';
  league  = (ev.tournament && ev.tournament.name) ? ev.tournament.name : (ev.league || '');
  return { id: ev.id||'', home, away, hScore, aScore, status, elapsed, league };
}

function lsStatusLabel(status, elapsed) {
  if (status === 'live' || status === 'inprogress') {
    return '<span style="background:#ef4444;color:#fff;font-size:.42rem;padding:1px 5px;border-radius:3px;font-weight:600;">LIVE ' + (elapsed||'') + '</span>';
  }
  if (status === 'halftime' || status === 'ht') {
    return '<span style="background:#f59e0b;color:#000;font-size:.42rem;padding:1px 5px;border-radius:3px;">HT</span>';
  }
  if (status === 'ended' || status === 'closed' || status === 'complete') {
    return '<span style="background:rgba(255,255,255,.1);color:var(--t3);font-size:.42rem;padding:1px 5px;border-radius:3px;">종료</span>';
  }
  return '<span style="background:rgba(255,255,255,.06);color:var(--t3);font-size:.42rem;padding:1px 5px;border-radius:3px;">예정</span>';
}

function lsRenderEvents(events) {
  if (!events || !events.length) {
    return '<div style="text-align:center;padding:50px;color:var(--t3);font-size:.8rem;">경기 정보가 없습니다</div>';
  }

  var today = new Date(Date.now() + 9*3600000).toISOString().slice(0,10);
  var html = '';
  var byLeague = {};

  events.forEach(function(ev) {
    var p = lsParseEvent(ev);
    if (!p.home) return;
    var lg = p.league || '기타';
    if (!byLeague[lg]) byLeague[lg] = [];
    byLeague[lg].push(p);
  });

  Object.keys(byLeague).forEach(function(lg) {
    html += '<div style="background:rgba(255,255,255,.02);border-bottom:2px solid var(--ln);padding:5px 12px;display:flex;align-items:center;gap:6px;">'
      + '<span style="font-size:.52rem;color:var(--t2);font-weight:500;">' + lg + '</span>'
      + '</div>';

    byLeague[lg].forEach(function(p) {
      var isLive = p.status === 'live' || p.status === 'inprogress';
      var isEnd  = p.status === 'ended' || p.status === 'closed' || p.status === 'complete';
      var hCol   = isLive && p.hScore > p.aScore ? 'var(--gold2)' : (isEnd ? 'var(--t2)' : 'var(--t1)');
      var aCol   = isLive && p.aScore > p.hScore ? 'var(--gold2)' : (isEnd ? 'var(--t2)' : 'var(--t1)');

      html += '<div style="display:flex;align-items:center;padding:10px 12px;border-bottom:1px solid rgba(255,255,255,.04);">'
        // 상태
        + '<div style="flex:0 0 52px;">' + lsStatusLabel(p.status, p.elapsed) + '</div>'
        // 홈팀
        + '<div style="flex:1;text-align:right;padding-right:10px;">'
        + '<div style="font-size:.78rem;font-weight:500;color:' + hCol + ';">' + p.home + '</div>'
        + '</div>'
        // 스코어
        + '<div style="flex:0 0 64px;text-align:center;">';

      if (p.hScore !== null && p.aScore !== null) {
        html += '<span style="font-size:1.1rem;font-weight:700;color:' + (isLive?'#ef4444':'var(--t1)') + ';">'
          + p.hScore + '</span>'
          + '<span style="font-size:.7rem;color:var(--t3);margin:0 3px;">:</span>'
          + '<span style="font-size:1.1rem;font-weight:700;color:' + (isLive?'#ef4444':'var(--t1)') + ';">'
          + p.aScore + '</span>';
      } else {
        html += '<span style="font-size:.65rem;color:var(--t3);">vs</span>';
      }

      html += '</div>'
        // 원정팀
        + '<div style="flex:1;text-align:left;padding-left:10px;">'
        + '<div style="font-size:.78rem;font-weight:500;color:' + aCol + ';">' + p.away + '</div>'
        + '</div>'
        + '</div>';
    });
  });

  return html;
}

function lsLoad() {
  if (LS.busy) return;
  LS.busy = true;
  var el = document.getElementById('ls-content');
  if (el) el.innerHTML = '<div style="text-align:center;padding:50px;color:var(--t3);font-size:.8rem;"><div class="odds-spinner" style="margin:0 auto 10px;"></div>데이터 로딩 중...</div>';

  // 조회할 sport 목록 결정
  var sports = LS.sport === 'all' ? Object.keys(SR_SPORT) : [LS.sport];
  var type   = LS.type === 'live' ? 'inplay' : 'upcoming';

  var promises = sports.map(function(sp) {
    var sid = SR_SPORT[sp] || 'sr:sport:1';
    return fetch(WORKER + '/livescore?sport=' + encodeURIComponent(sid) + '&type=' + type)
      .then(function(r) { return r.ok ? r.json() : {}; })
      .catch(function() { return {}; });
  });

  Promise.all(promises).then(function(results) {
    var allEvents = [];
    results.forEach(function(data) {
      // Sportsradar 응답 구조 여러 형태 대응
      var evs = data.events || data.results || data.sport_events || [];
      if (!Array.isArray(evs)) evs = [];
      evs.forEach(function(item) {
        var ev = item.sport_event || item.event || item;
        if (ev && (ev.competitors || ev.home_score !== undefined)) allEvents.push(ev);
      });
    });

    var upd = document.getElementById('ls-upd-time');
    if (upd) upd.textContent = '업데이트 ' + lsKstNow();

    if (el) el.innerHTML = lsRenderEvents(allEvents);
    LS.busy = false;
  }).catch(function(e) {
    console.warn('[LS]', e);
    if (el) el.innerHTML = '<div style="text-align:center;padding:50px;color:var(--t3);">⚠ 연결 실패 — 새로고침해주세요</div>';
    LS.busy = false;
  });
}

function initLiveScore() {
  lsLoad();
  // 30초 자동 갱신 (LIVE 모드)
  LS.timer = setInterval(function() {
    if (LS.type === 'live') lsLoad();
  }, 30000);
}

// ── 블록3: 배당률 (스코어센터 스타일) ────────────────────────────

var SPORT_ICON = { '축구':'⚽', '농구':'🏀', '야구':'⚾', '배구':'🏐', '골프':'⛳' };

// 게임유형 배지
function gtBadge(prod, gt, hval) {
  var p = prod || '프로토';
  var gLabel = gt || '일반';
  var colors = {
    '프로토':  'background:var(--gold-a);color:var(--gold2);border:1px solid var(--gold-b);',
    '토토':    'background:rgba(59,130,246,.12);color:#93c5fd;border:1px solid rgba(59,130,246,.28);',
    '승5패':   'background:rgba(16,185,129,.1);color:#6ee7b7;border:1px solid rgba(16,185,129,.25);',
    '스페셜':  'background:rgba(167,139,250,.12);color:#c4b5fd;border:1px solid rgba(167,139,250,.28);',
    '매치':    'background:rgba(251,191,36,.1);color:#fcd34d;border:1px solid rgba(251,191,36,.25);',
    '기록식':  'background:rgba(239,68,68,.1);color:#fca5a5;border:1px solid rgba(239,68,68,.25);',
  };
  var st = colors['프로토'];
  var pkeys = Object.keys(colors);
  for (var i = 0; i < pkeys.length; i++) {
    if (p.indexOf(pkeys[i]) !== -1) { st = colors[pkeys[i]]; break; }
  }
  var gtMap = { '일반':'일반', '핸디캡':'핸디', '언더오버':'U/O', 'SUM':'SUM' };
  var gtShort = gtMap[gLabel] || gLabel;
  var hvStr = hval ? (' ' + hval) : '';
  return '<span style="display:inline-block;font-size:.46rem;padding:1px 6px;border-radius:3px;white-space:nowrap;' + st + '">'
    + gtShort + hvStr + '</span>';
}

// 배당 버튼
function oddBtn(label, val, color) {
  if (val === null || val === undefined || isNaN(+val) || +val <= 0) {
    return '<div style="flex:1;text-align:center;padding:6px 2px;"><span style="font-size:.55rem;color:var(--t3);">-</span></div>';
  }
  var c = { w:'var(--gold2)', d:'var(--t2)', l:'#93c5fd' }[color] || 'var(--t1)';
  return '<div style="flex:1;text-align:center;padding:4px 2px;">'
    + '<div style="display:inline-flex;flex-direction:column;align-items:center;min-width:48px;padding:4px 6px;'
    + 'border-radius:4px;border:1px solid var(--ln);background:rgba(255,255,255,.03);cursor:pointer;"'
    + ' onmouseover="this.style.background=\'var(--gold-a)\';this.style.borderColor=\'var(--gold-b)\'"'
    + ' onmouseout="this.style.background=\'rgba(255,255,255,.03)\';this.style.borderColor=\'var(--ln)\'">'
    + '<span style="font-size:.4rem;color:var(--t3);">' + label + '</span>'
    + '<span style="font-size:.82rem;font-weight:700;color:' + c + ';">' + (+val).toFixed(2) + '</span>'
    + '</div></div>';
}

function fmtDL(ymd, hhmm) {
  if (!ymd || ymd.length < 8) return '-';
  var mm  = parseInt(ymd.slice(4,6)), dd = parseInt(ymd.slice(6,8));
  var day = ['일','월','화','수','목','금','토'][new Date(+ymd.slice(0,4), mm-1, dd).getDay()];
  var t   = (hhmm && hhmm !== '0000') ? hhmm.slice(0,2) + ':' + hhmm.slice(2,4) : '';
  return mm + '.' + String(dd).padStart(2,'0') + '(' + day + ')' + (t ? '<br>' + t : '');
}

function kstNow() {
  var n = new Date(Date.now() + 9*3600000);
  return String(n.getUTCHours()).padStart(2,'0') + ':' + String(n.getUTCMinutes()).padStart(2,'0');
}

function kstDate() {
  return new Date(Date.now() + 9*3600000).toISOString().slice(0,10).replace(/-/g,'');
}

var OD = {
  sport:  'all',
  date:   'all',
  gt:     'all',
  all:    [],
  meta:   {},
  busy:   false,
};

function oddsSwitchSport(btn, val) {
  document.querySelectorAll('.odds-sport-tab[data-sport]').forEach(function(b) { b.classList.remove('active'); });
  btn.classList.add('active');
  OD.sport = val;
  odRender();
}

function oddsFilterDate(btn, val) {
  OD.date = val;
  document.querySelectorAll('.odds-date-btn').forEach(function(b) { b.classList.remove('active','af'); });
  btn.classList.add('active','af');
  odRender();
}

function oddsFilterGT(btn, val) {
  OD.gt = val;
  document.querySelectorAll('.odds-filter-btn').forEach(function(b) { b.classList.remove('active','af'); });
  btn.classList.add('active','af');
  odRender();
}

function odBuildDateTabs() {
  var wrap = document.getElementById('oddsDateTabWrap');
  if (!wrap) return;
  var today = kstDate();
  var days  = ['일','월','화','수','목','금','토'];
  var seen  = {}, dates = [];
  for (var i = 0; i < OD.all.length; i++) {
    var d = OD.all[i].ymd;
    if (d && !seen[d]) { seen[d] = true; dates.push(d); }
  }
  dates.sort();
  wrap.innerHTML = '';

  function mkBtn(label, val, isActive, col) {
    var b = document.createElement('button');
    b.className = 'odds-date-btn' + (isActive ? ' active af' : '');
    b.textContent = label;
    var normalCol = isActive ? 'var(--gold2)' : col;
    b.style.cssText = 'font-size:.58rem;color:' + normalCol
      + ';background:' + (isActive ? 'var(--gold-a)' : 'none')
      + ';border:none;border-bottom:2px solid ' + (isActive ? 'var(--gold)' : 'transparent')
      + ';padding:8px 12px;cursor:pointer;white-space:nowrap;transition:color .12s;';
    b.onmouseover = function() { this.style.color = 'var(--t1)'; };
    b.onmouseout  = (function(c) { return function() { this.style.color = c; }; })(normalCol);
    b.onclick     = (function(v) { return function() { oddsFilterDate(this, v); }; })(val);
    wrap.appendChild(b);
  }

  mkBtn('전체', 'all', true, 'var(--t2)');
  for (var j = 0; j < dates.length; j++) {
    var ymd = dates[j];
    var mm2  = parseInt(ymd.slice(4,6)), dd2 = parseInt(ymd.slice(6,8));
    var day2 = days[new Date(+ymd.slice(0,4), mm2-1, dd2).getDay()];
    var isToday = (ymd === today);
    var lbl = mm2 + '/' + String(dd2).padStart(2,'0') + '(' + day2 + ')' + (isToday ? ' 오늘' : '');
    mkBtn(lbl, ymd, false, isToday ? 'var(--green)' : 'var(--t2)');
  }
}

// 스코어센터 스타일: 같은 경기(팀명+날짜) 단위로 그룹핑 후 렌더
function odRender() {
  var rows = OD.all;
  if (OD.date !== 'all')  rows = rows.filter(function(r) { return r.ymd === OD.date; });
  if (OD.sport !== 'all') rows = rows.filter(function(r) { return r.sport === OD.sport; });
  if (OD.gt !== 'all')    rows = rows.filter(function(r) {
    return OD.gt === '스페셜' ? r.prod.indexOf('스페셜') !== -1 : r.prod.indexOf(OD.gt) !== -1;
  });

  // 메타 업데이트
  var imba = rows.filter(function(r) { return r.imba; }).length;
  var meta = OD.meta;
  function el(id, v)  { var e = document.getElementById(id); if (e) e.textContent = v; }
  function elH(id, v) { var e = document.getElementById(id); if (e) e.innerHTML  = v; }
  elH('oddsRoundBadge', meta.round_no ? '프로토 ' + meta.round_no + '회차' : '— 회차');
  el('oddsPeriodTxt',   (meta.gme_open_ymd||'') + (meta.gme_close_ymd ? ' ~ ' + meta.gme_close_ymd : '')
    + (meta.matched > 0 ? '  |  배당매칭 ' + meta.matched + '건' : ''));
  el('oddsTotalGames', rows.length);
  el('oddsLiveGames',  imba);
  el('oddsUpdTime',    kstNow());

  var wrap = document.getElementById('oddsContent');
  if (!wrap) return;
  if (!rows.length) {
    wrap.innerHTML = '<div style="text-align:center;padding:60px;color:var(--t3);font-size:.8rem;">📭 해당 조건의 경기가 없습니다</div>';
    return;
  }

  // 경기 그룹핑: ymd+home+away 같은 것끼리 묶기 (스코어센터처럼 경기 카드 + 게임유형 행)
  var groups = [], seen2 = {}, groupMap = {};
  rows.forEach(function(r) {
    var key = r.ymd + '|' + r.home + '|' + r.away;
    if (!seen2[key]) {
      seen2[key] = true;
      var g = { key: key, sport: r.sport, league: r.league, ymd: r.ymd, dl: r.dl, home: r.home, away: r.away, imba: r.imba, rows: [] };
      groups.push(g);
      groupMap[key] = g;
    }
    groupMap[key].rows.push(r);
    if (r.imba) groupMap[key].imba = true;
  });

  var html = '';
  var prevDate = '';

  groups.forEach(function(g) {
    // 날짜 구분선
    if (g.ymd !== prevDate) {
      prevDate = g.ymd;
      var mm3 = parseInt(g.ymd.slice(4,6)), dd3 = parseInt(g.ymd.slice(6,8));
      var dn3 = ['일','월','화','수','목','금','토'][new Date(+g.ymd.slice(0,4), mm3-1, dd3).getDay()];
      var isTd = (g.ymd === kstDate());
      html += '<div style="background:rgba(200,168,75,.05);border-top:1px solid var(--gold-b);border-bottom:1px solid var(--gold-b);'
        + 'padding:5px 14px;font-size:.58rem;color:var(--gold2);letter-spacing:.5px;">'
        + mm3 + '월 ' + dd3 + '일 (' + dn3 + ')' + (isTd ? ' — 오늘' : '') + '</div>';
    }

    var icon = SPORT_ICON[g.sport] || '🏅';
    var cardBg = g.imba ? 'border-left:3px solid #f87171;' : 'border-left:3px solid transparent;';

    // 경기 카드 헤더 (종목+대회+팀명)
    html += '<div style="' + cardBg + 'background:rgba(255,255,255,.01);">';

    // 리그 행
    html += '<div style="padding:4px 14px;font-size:.46rem;color:var(--t3);border-bottom:1px solid rgba(255,255,255,.03);">'
      + icon + ' ' + (g.league || '') + '</div>';

    // 각 게임유형 행
    g.rows.forEach(function(r, i) {
      var isUO   = r.gt === '언더오버';
      var isSUM  = r.gt === 'SUM';
      var is3way = (r.oX !== null && r.oX !== undefined);
      var l1 = isUO ? 'U' : (isSUM ? '홀' : '승');
      var lX = (isUO || isSUM) ? null : '무';
      var l2 = isUO ? 'O' : (isSUM ? '짝' : '패');

      var rowBg = i % 2 === 0 ? '' : 'background:rgba(255,255,255,.012);';

      html += '<div style="display:flex;align-items:center;padding:7px 12px;border-bottom:1px solid rgba(255,255,255,.04);' + rowBg + '">'
        // 번호
        + '<div style="flex:0 0 30px;font-size:.62rem;color:var(--t3);text-align:center;">' + (r.row_num||'-') + '</div>'
        // 마감
        + '<div style="flex:0 0 56px;font-size:.54rem;color:var(--t2);line-height:1.5;text-align:center;">' + r.dl + '</div>'
        // 게임유형 배지
        + '<div style="flex:0 0 60px;text-align:center;">' + gtBadge(r.prod, r.gt, r.hval) + '</div>'
        // 팀명 (첫 번째 행만 표시)
        + (i === 0
          ? '<div style="flex:1;padding:0 8px;">'
            + '<div style="font-size:.76rem;color:var(--t1);font-weight:500;">' + r.home + '</div>'
            + '<div style="font-size:.5rem;color:var(--t3);margin:1px 0;">vs</div>'
            + '<div style="font-size:.74rem;color:var(--t2);">' + r.away + '</div>'
            + '</div>'
          : '<div style="flex:1;padding:0 8px;font-size:.6rem;color:var(--t3);">' + r.home + ' : ' + r.away + '</div>'
        )
        // 배당 3열
        + '<div style="display:flex;flex:0 0 180px;gap:2px;">'
        + oddBtn(l1, r.o1, 'w')
        + (is3way && lX ? oddBtn(lX, r.oX, 'd') : '<div style="flex:1;text-align:center;"><span style="font-size:.55rem;color:var(--t3);">-</span></div>')
        + oddBtn(l2, r.o2, isUO ? 'w' : 'l')
        + '</div>'
        + '</div>';
    });

    html += '</div>';
  });

  wrap.innerHTML = html;
}

function oddsLoad() {
  if (OD.busy) return;
  OD.busy = true;
  OD.all  = [];
  var wrap = document.getElementById('oddsContent');
  if (wrap) wrap.innerHTML = '<div style="text-align:center;padding:60px;color:var(--t3);font-size:.8rem;">'
    + '<div class="odds-spinner" style="margin:0 auto 12px;"></div>'
    + '<div id="oddsStepTxt">경기 및 배당 조회 중...</div></div>';

  fetch(WORKER + '/toto-with-odds')
    .then(function(r) { return r.ok ? r.json() : Promise.reject('HTTP ' + r.status); })
    .then(function(data) {
      OD.meta = data.meta || {};
      var today = kstDate();
      OD.all = (data.games || []).map(function(g) {
        var utcMs = 0;
        if (g.match_ymd && g.match_ymd.length >= 8) {
          var h2 = +(g.match_tm||'0000').slice(0,2);
          var m2 = +(g.match_tm||'0000').slice(2,4);
          utcMs = Date.UTC(+g.match_ymd.slice(0,4), +g.match_ymd.slice(4,6)-1, +g.match_ymd.slice(6,8), h2-9, m2);
        }
        var hvalFmt = null;
        if (g.hval) {
          if (g.gt === '핸디캡') hvalFmt = 'H ' + (parseFloat(g.hval) >= 0 ? '+' : '') + g.hval;
          else if (g.gt === '언더오버') hvalFmt = 'U/O ' + g.hval;
          else hvalFmt = g.hval;
        }
        return {
          row_num: g.row_num, ymd: g.match_ymd||'', dl: fmtDL(g.match_ymd, g.match_tm),
          sport: g.sport||'', league: g.league||'', prod: g.prod||'프로토',
          gt: g.gt||'일반', hval: hvalFmt,
          home: g.home||'', away: g.away||'',
          o1: g.o1, oX: g.oX, o2: g.o2, matched: g.matched,
          imba: utcMs > Date.now() && (utcMs - Date.now()) < 2*3600*1000,
        };
      });
      odBuildDateTabs();
      odRender();
    })
    .catch(function(e) {
      console.error('[ODDS]', e);
      var w = document.getElementById('oddsContent');
      if (w) w.innerHTML = '<div style="text-align:center;padding:60px;color:var(--t3);">⚠ 데이터 조회 실패 — 새로고침 해주세요</div>';
    })
    .finally(function() { OD.busy = false; });
}

function initOdds() {
  oddsLoad();
  setInterval(oddsLoad, 5 * 60 * 1000);
}

// 구버전 호환
function setMode(m) {}
function loadData()           { oddsLoad(); }
function onSportChange(b, s)  { oddsSwitchSport(b, s); }
function onLeagueChange()     {}
function oSetStep(m)          { var e = document.getElementById('oddsStepTxt'); if (e) e.textContent = m; }
function oddsSetMode()        {}
function setLsMode()          {}

const AN_RAPID_KEY = '6a5d1ea245msh63d3ebd0b873de0p1da56bjsn370ddd7e5d58';


const AN_CLAUDE_VER = 'claude-sonnet-4-20250514';
let anSP = 'soccer';
let anSUB = 'analysis';
let anCache = {};

const AN_SUBS = {
  soccer:   [{id:'analysis',l:'🤖 AI분석'},{id:'odds',l:'💰 배당률'},{id:'stats',l:'팀통계'},{id:'results',l:'최근결과'},{id:'h2h',l:'H2H'}],
  bball:    [{id:'analysis',l:'🤖 AI분석'},{id:'stats',l:'팀통계'},{id:'results',l:'최근결과'}],
  baseball: [{id:'analysis',l:'🤖 AI분석'},{id:'stats',l:'투타통계'},{id:'results',l:'최근결과'}],
  refs:     [{id:'all',l:'전체'},{id:'soccer',l:'⚽ 축구'},{id:'bball',l:'🏀 농구'},{id:'baseball',l:'⚾ 야구'},{id:'toto',l:'🎯 배당/토토'}],
};

const AN_SAMPLE = {
  soccer: {
    match: 'EPL — 맨체스터 시티 vs 아스날',
    home: '맨체스터 시티', away: '아스날',
    hp: 48, dp: 23, ap: 29,
    pick: '맨시티 승 or 무 (더블찬스)',
    txt: '맨체스터 시티는 최근 5경기 평균 xG 1.92로 리그 최상위 공격력을 유지 중입니다. 아스날은 원정 xGA 1.62로 수비가 불안정한 상태입니다.',
    stats: [{l:'xG/경기',h:1.82,a:1.41,mx:3,inv:false},{l:'점유율(%)',h:58,a:42,mx:100,inv:false}],
    mets: [{k:'xG',v:'1.82',c:'gold'},{k:'xGA',v:'1.14',c:'pos'},{k:'최근폼',v:'3W1D1L',c:''}],
    results: [{h:'맨시티',a:'웨스트햄',hs:3,as:0,r:'W'},{h:'첼시',a:'맨시티',hs:0,as:2,r:'W'},{h:'맨시티',a:'리버풀',hs:1,as:1,r:'D'}],
    form: ['W','W','D','W','W'],
    odds: [{bm:'베트맨',o1:1.95,oX:3.40,o2:4.10}],
    trend: '홈팀 배당 2.10→1.95로 하락. 시장이 맨시티 우세를 반영 중.',
  },
};

const AN_REF_DB = [
  {n:'Understat',url:'https://understat.com',ico:'📊',cat:'soccer',desc:'유럽 6대리그 xG 무료',tags:['xG','무료'],key:true},
  {n:'FBref',url:'https://fbref.com',ico:'📈',cat:'soccer',desc:'StatsBomb 협력 고급통계',tags:['xG','StatsBomb'],key:true},
  {n:'WhoScored',url:'https://whoscored.com',ico:'⭐',cat:'soccer',desc:'선수 평점·히트맵',tags:['선수평점','Opta']},
  {n:'FootyStats',url:'https://footystats.org',ico:'📉',cat:'soccer',desc:'오버언더·코너·BTTS',tags:['오버언더','코너']},
  {n:'NBA Stats',url:'https://www.nba.com/stats',ico:'🏀',cat:'bball',desc:'NBA 공식 통계',tags:['공식','ORTG'],key:true},
  {n:'Baseball-Ref',url:'https://baseball-reference.com',ico:'⚾',cat:'baseball',desc:'WAR·OPS·FIP 세이버메트릭스',tags:['WAR','OPS'],key:true},
  {n:'베트맨',url:'https://www.betman.co.kr',ico:'🎯',cat:'toto',desc:'스포츠토토 공식',tags:['공식','프로토'],key:true},
  {n:'OddsPortal',url:'https://oddsportal.com',ico:'💰',cat:'toto',desc:'전세계 배당 비교',tags:['배당비교'],key:true},
];

function setSport(s, btn) {
  anSP = s;
  anSUB = (s === 'refs') ? 'all' : 'analysis';
  document.querySelectorAll('.s-btn').forEach(b => b.classList.remove('on'));
  btn.classList.add('on');
  buildSubNav();
  anRender();
}

function setSub(s, btn) {
  anSUB = s;
  document.querySelectorAll('.sub-btn').forEach(b => b.classList.remove('on'));
  btn.classList.add('on');
  anRender();
}

function buildSubNav() {
  const nav = document.getElementById('sub-nav');
  if (!nav) return;
  const tabs = AN_SUBS[anSP] || [];
  nav.innerHTML = tabs.map(t =>
    '\u003Cbutton class="sub-btn' + (t.id === anSUB ? ' on' : '') + '" onclick="setSub(\'' + t.id + '\',this)"\u003E' + t.l + '\u003C/button\u003E'
  ).join('');
}

function anRender() {
  const el = document.getElementById('content');
  if (!el) return;
  if (anSP === 'refs') { el.innerHTML = renderRefs(); return; }
  const d = AN_SAMPLE[anSP] || AN_SAMPLE.soccer;
  if (anSUB === 'analysis') el.innerHTML = renderAnalysis(d);
  else if (anSUB === 'odds') el.innerHTML = renderOddsView(d);
  else if (anSUB === 'stats') el.innerHTML = renderStats(d);
  else if (anSUB === 'results') el.innerHTML = renderResults(d);
  else if (anSUB === 'h2h') el.innerHTML = renderH2H(d);
  else el.innerHTML = renderAnalysis(d);
}

function renderAnalysis(d) {
  return '\u003Cdiv class="ai-box"\u003E'
    + '\u003Cdiv class="ai-eyebrow"\u003E\u003Cdiv class="ai-eyebrow-l"\u003E\u003Cspan class="ai-ico"\u003E🤖\u003C/span\u003E\u003Cspan class="ai-label"\u003EAI 경기분석\u003C/span\u003E\u003Cspan class="pill pill-ai"\u003EClaude AI\u003C/span\u003E\u003C/div\u003E\u003C/div\u003E'
    + '\u003Cdiv style="font-size:0.72rem;color:var(--text3);margin-bottom:14px"\u003E' + d.match + '\u003C/div\u003E'
    + '\u003Cdiv class="matchup"\u003E'
    + '\u003Cdiv class="mu-team"\u003E\u003Cspan class="mu-name"\u003E' + d.home + '\u003C/span\u003E\u003Cspan class="mu-pct home"\u003E' + d.hp + '%\u003C/span\u003E\u003Cspan class="mu-lbl"\u003E홈 승\u003C/span\u003E\u003C/div\u003E'
    + '\u003Cdiv class="mu-vs"\u003E' + (d.dp > 0 ? '\u003Cspan class="mu-pct draw"\u003E' + d.dp + '%\u003C/span\u003E\u003Cdiv class="mu-lbl"\u003E무\u003C/div\u003E' : '\u003Cspan style="font-size:1.1rem;color:var(--text3)"\u003Evs\u003C/span\u003E') + '\u003C/div\u003E'
    + '\u003Cdiv class="mu-team"\u003E\u003Cspan class="mu-name"\u003E' + d.away + '\u003C/span\u003E\u003Cspan class="mu-pct away"\u003E' + d.ap + '%\u003C/span\u003E\u003Cspan class="mu-lbl"\u003E원정 승\u003C/span\u003E\u003C/div\u003E'
    + '\u003C/div\u003E'
    + '\u003Cdiv class="prob-bar-track"\u003E'
    + '\u003Cdiv class="pb-h" style="width:' + d.hp + '%"\u003E\u003C/div\u003E'
    + (d.dp > 0 ? '\u003Cdiv class="pb-d" style="width:' + d.dp + '%"\u003E\u003C/div\u003E' : '')
    + '\u003Cdiv class="pb-a" style="width:' + d.ap + '%"\u003E\u003C/div\u003E'
    + '\u003C/div\u003E'
    + '\u003Cdiv class="ai-body"\u003E' + d.txt + '\u003C/div\u003E'
    + '\u003Cdiv class="metrics" style="margin-bottom:12px"\u003E'
    + d.mets.map(m => '\u003Cdiv class="met"\u003E\u003Cspan class="met-val ' + m.c + '"\u003E' + m.v + '\u003C/span\u003E\u003Cspan class="met-key"\u003E' + m.k + '\u003C/span\u003E\u003C/div\u003E').join('')
    + '\u003C/div\u003E'
    + '\u003Cdiv class="ai-pick"\u003E\u003Cspan class="ai-pick-ico"\u003E✅\u003C/span\u003E\u003Cdiv\u003E\u003Cspan class="ai-pick-label"\u003EAI 추천픽\u003C/span\u003E\u003Cspan class="ai-pick-txt"\u003E' + d.pick + '\u003C/span\u003E\u003C/div\u003E\u003C/div\u003E'
    + '\u003C/div\u003E';
}

function renderOddsView(d) {
  return '\u003Cdiv class="card"\u003E\u003Cdiv class="card-hd"\u003E\u003Cspan class="card-title"\u003E💰 배당 비교\u003C/span\u003E\u003C/div\u003E\u003Cdiv class="card-bd"\u003E'
    + d.odds.map(o =>
        '\u003Cdiv class="odds-bm-row"\u003E\u003Cspan class="odds-bm-name"\u003E' + o.bm + '\u003C/span\u003E'
        + '\u003Cdiv class="odds-cells"\u003E'
        + '\u003Cspan class="oc h"\u003E' + (o.o1 ? o.o1.toFixed(2) : '-') + '\u003C/span\u003E'
        + (o.oX !== null && o.oX !== undefined ? '\u003Cspan class="oc d"\u003E' + o.oX.toFixed(2) + '\u003C/span\u003E' : '')
        + '\u003Cspan class="oc a"\u003E' + (o.o2 ? o.o2.toFixed(2) : '-') + '\u003C/span\u003E'
        + '\u003C/div\u003E\u003C/div\u003E'
      ).join('')
    + '\u003Cdiv class="odds-trend" style="margin-top:10px"\u003E📊 ' + d.trend + '\u003C/div\u003E'
    + '\u003C/div\u003E\u003C/div\u003E';
}

function renderStats(d) {
  return '\u003Cdiv class="card"\u003E\u003Cdiv class="card-hd"\u003E\u003Cspan class="card-title"\u003E팀 통계\u003C/span\u003E\u003C/div\u003E\u003Cdiv class="card-bd"\u003E'
    + '\u003Cdiv class="stat-cmp"\u003E'
    + d.stats.map(function(s) {
        const hp = s.inv ? Math.round((1-s.h/s.mx)*100) : Math.round(s.h/s.mx*100);
        const ap = s.inv ? Math.round((1-s.a/s.mx)*100) : Math.round(s.a/s.mx*100);
        return '\u003Cdiv class="stat-row"\u003E'
          + '\u003Cspan class="sv-home"\u003E' + s.h + '\u003C/span\u003E'
          + '\u003Cdiv class="bar-wrap"\u003E\u003Cdiv class="bar-h" style="width:' + hp + '%"\u003E\u003C/div\u003E\u003C/div\u003E'
          + '\u003Cspan class="sv-lbl"\u003E' + s.l + '\u003C/span\u003E'
          + '\u003Cdiv class="bar-wrap"\u003E\u003Cdiv class="bar-a" style="width:' + ap + '%"\u003E\u003C/div\u003E\u003C/div\u003E'
          + '\u003Cspan class="sv-away"\u003E' + s.a + '\u003C/span\u003E'
          + '\u003C/div\u003E';
      }).join('')
    + '\u003C/div\u003E\u003C/div\u003E\u003C/div\u003E';
}

function renderResults(d) {
  return '\u003Cdiv class="card"\u003E\u003Cdiv class="card-hd"\u003E\u003Cspan class="card-title"\u003E' + d.home + ' 최근 결과\u003C/span\u003E'
    + '\u003Cdiv class="form-row"\u003E' + d.form.map(f => '\u003Cdiv class="fd fd-' + f.toLowerCase() + '"\u003E' + f + '\u003C/div\u003E').join('') + '\u003C/div\u003E\u003C/div\u003E'
    + '\u003Cdiv class="card-bd"\u003E'
    + d.results.map(r =>
        '\u003Cdiv class="result-row"\u003E'
        + '\u003Cspan class="r-teams"\u003E' + r.h + ' vs ' + r.a + '\u003C/span\u003E'
        + '\u003Cspan class="r-score"\u003E' + r.hs + ' - ' + r.as + '\u003C/span\u003E'
        + '\u003Cspan class="r-res r-' + r.r.toLowerCase() + '"\u003E' + r.r + '\u003C/span\u003E'
        + '\u003C/div\u003E'
      ).join('')
    + '\u003C/div\u003E\u003C/div\u003E';
}

function renderH2H(d) {
  return '\u003Cdiv class="card"\u003E\u003Cdiv class="card-hd"\u003E\u003Cspan class="card-title"\u003EH2H 상대전적\u003C/span\u003E\u003C/div\u003E'
    + '\u003Cdiv class="card-bd"\u003E'
    + d.results.map(r =>
        '\u003Cdiv class="result-row"\u003E'
        + '\u003Cspan class="r-teams"\u003E' + r.h + ' vs ' + r.a + '\u003C/span\u003E'
        + '\u003Cspan class="r-score"\u003E' + r.hs + ' - ' + r.as + '\u003C/span\u003E'
        + '\u003Cspan class="r-res r-' + r.r.toLowerCase() + '"\u003E' + r.r + '\u003C/span\u003E'
        + '\u003C/div\u003E'
      ).join('')
    + '\u003C/div\u003E\u003C/div\u003E';
}

function renderRefs() {
  const filt = anSUB === 'all' ? null : anSUB;
  const items = AN_REF_DB.filter(r => !filt || r.cat === filt);
  return '\u003Cdiv class="card"\u003E\u003Cdiv class="card-hd"\u003E\u003Cspan class="card-title"\u003E📚 분석 참고사이트\u003C/span\u003E\u003Cspan class="pill pill-ok"\u003E' + items.length + '개\u003C/span\u003E\u003C/div\u003E'
    + '\u003Cdiv class="card-bd"\u003E\u003Cdiv class="ref-grid"\u003E'
    + items.map(r =>
        '\u003Ca href="' + r.url + '" target="_blank" class="ref-card ref-' + r.cat + '"\u003E'
        + '\u003Cspan class="ref-arrow"\u003E↗\u003C/span\u003E'
        + '\u003Cdiv class="ref-ico"\u003E' + r.ico + (r.key ? ' \u003Cspan style="font-size:0.6rem;color:var(--gold)"\u003E★\u003C/span\u003E' : '') + '\u003C/div\u003E'
        + '\u003Cdiv class="ref-name"\u003E' + r.n + '\u003C/div\u003E'
        + '\u003Cdiv class="ref-desc"\u003E' + r.desc + '\u003C/div\u003E'
        + '\u003Cdiv class="ref-tags"\u003E' + r.tags.map(t => '\u003Cspan class="ref-tag"\u003E' + t + '\u003C/span\u003E').join('') + '\u003C/div\u003E'
        + '\u003C/a\u003E'
      ).join('')
    + '\u003C/div\u003E\u003C/div\u003E\u003C/div\u003E';
}

function initAnalysis() {
  buildSubNav();
  anRender();
}

