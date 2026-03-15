/* ── 블록1 ─────────────────────────────── */
//<![CDATA[
// ── 공통 상태 ──
const PANES = { home:true, ls:false, odds:false, an:false };
function switchPane(id) {
  // 모든 패널 숨기기
  document.querySelectorAll('.pane').forEach(p => p.classList.remove('active'));
  const paneId = id === 'an' ? 'pane-analysis' : 'pane-' + id;
  document.getElementById(paneId).classList.add('active');
  // GNB 활성 표시
  ['ls','odds','an'].forEach(k => {
    const el = document.getElementById('gnb-' + k);
    if (!el) return;
    el.classList.remove('active-ls','active-odds','active-an');
    if (k === id) el.classList.add('active-' + k);
  });
  // 섹션 내 네비 활성
  document.querySelectorAll('.sec-nav-btn').forEach(b => b.classList.remove('sec-nav-active'));
  const pane = document.getElementById(paneId);
  if (pane) {
    const btns = pane.querySelectorAll('.sec-nav-btn');
    const map = { home:0, ls:1, odds:2, an:3 };
    const idx = map[id];
    if (btns[idx]) btns[idx].classList.add('sec-nav-active');
  }
  // 최초 진입 시 초기화
  if (!PANES[id]) {
    PANES[id] = true;
    if (id === 'ls')   { initLivescore(); setInterval(()=>{delete cache[current];loadSport(current);},300000); }
    if (id === 'odds')  initOdds();
    if (id === 'an')    initAnalysis();
  }
  window.scrollTo(0, 0);
}
// 시계
(function tick() {
  const n = new Date();
  const hh=String(n.getHours()).padStart(2,'0'), mm=String(n.getMinutes()).padStart(2,'0'), ss=String(n.getSeconds()).padStart(2,'0');
  const t = `${hh}:${mm}:${ss}`;
  const el = document.getElementById('gnb-time');
  const el2 = document.getElementById('s-time');
  if (el) el.textContent = t;
  if (el2) el2.textContent = t;
  setTimeout(tick, 1000);
})();
// 홈 배당 업데이트 시각
document.getElementById('s-odds').textContent =
  new Date().toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'});
// 홈 LIVE 표시 — API 콜 절약을 위해 라이브스코어 섹션 진입 후 반영
// (홈 자동 콜 제거 — 100콜/일 한도 절약)
/* ── 블록2 ─────────────────────────────── */
//<![CDATA[
/* ═══════════════════════════════════════════════════════
   API-Sports — 영구 무료 100콜/일
   키: 1669e40954b2071b87590108078b5f05
   
   종목별 URL + 엔드포인트 전략:
   - 축구:    /fixtures?live=all           (라이브 전용)
   - 농구:    /games?date=TODAY            (오늘 경기 전체)
   - 야구:    /games?date=TODAY
   - 하키:    /games?date=TODAY
   - 배구:    /games?date=TODAY
   - 핸드볼:  /games?date=TODAY
   - 럭비:    /games?date=TODAY
   - NBA:     /games?date=TODAY
   
   헤더: x-apisports-key
═══════════════════════════════════════════════════════ */
const KEY = "1669e40954b2071b87590108078b5f05";
const HDR = { "x-apisports-key": KEY };
// 오늘 날짜 (UTC 기준)
// KST 기준 오늘 날짜 (UTC+9)
function today() {
  const kst = new Date(Date.now() + 9 * 3600 * 1000);
  return kst.toISOString().slice(0, 10);
}
// UTC → KST 24시간 포맷 (예정 경기 시간 표시용)
function toKST(raw) {
  if (!raw) return null;
  try {
    const d = typeof raw === 'number'
      ? new Date(raw * 1000)       // unix timestamp
      : new Date(raw);             // ISO string
    if (isNaN(d.getTime())) return null;
    // KST = UTC+9
    const kst = new Date(d.getTime() + 9 * 3600 * 1000);
    const hh = String(kst.getUTCHours()).padStart(2, '0');
    const mm = String(kst.getUTCMinutes()).padStart(2, '0');
    return `${hh}:${mm}`;
  } catch(e) { return null; }
}
// ═══════════════════════════════════════════════════════
// 스포츠토토 대상 리그 화이트리스트
// api-sports.io league ID 기준
// ═══════════════════════════════════════════════════════
const TOTO_LEAGUES = {
  football:   [39, 140, 135, 78, 61, 292, 293],
  // EPL=39, 라리가=140, 세리에A=135, 분데스리가=78, 리그1=61, K리그1=292, K리그2=293
  basketball: [12, 116, 117],
  // NBA=12, KBL=116, WKBL=117
  nba:        [12],
  baseball:   [1, 2, 7],
  // MLB=1, KBO=2, NPB=7
  volleyball: [36, 37],
  // V리그남=36, V리그여=37
  golf:       [1, 2, 3],
  // PGA=1, DP World=2, LPGA=3
};
// Sportsradar competitionId 화이트리스트 (inplayEvents 필터용)
// inplayEvents에서 확인된 실제 ID값 기반 — 이름으로도 2차 검증
const SR_TOTO_COMPETITIONS = new Set([
  // 축구
  'sr:tournament:17',   // EPL
  'sr:tournament:8',    // 라리가
  'sr:tournament:35',   // 분데스리가
  'sr:tournament:23',   // 세리에A
  'sr:tournament:34',   // 리그1
  'sr:tournament:272',  // K리그1
  'sr:tournament:273',  // K리그2
  // 농구
  'sr:tournament:132',  // NBA
  'sr:tournament:1540', // KBL
  'sr:tournament:1541', // WKBL
  // 야구
  'sr:tournament:1',    // MLB
  'sr:tournament:2',    // KBO
  'sr:tournament:3',    // NPB
  // 배구
  'sr:tournament:1',    // V리그 (야구 1과 충돌 — 종목 구분으로 처리)
  'sr:tournament:2',
]);
// 이름 기반 스포츠토토 리그 매칭 (competitionId 미확인 보조수단)
const SR_TOTO_NAMES = [
  'Premier League', 'La Liga', 'Bundesliga', 'Serie A', 'Ligue 1',
  'K League 1', 'K League 2', 'K-League',
  'NBA', 'KBL', 'WKBL',
  'MLB', 'KBO', 'NPB',
  'V-League', 'V League',
  'PGA Tour', 'LPGA',
];
function isTotoCompetition(ev) {
  if (SR_TOTO_COMPETITIONS.has(ev.competitionId)) return true;
  const name = (ev.competitionName || '').toLowerCase();
  return SR_TOTO_NAMES.some(n => name.includes(n.toLowerCase()));
}
const SPORTS = [
  {
    key:"football",   icon:"⚽", label:"축구",
    url:"https://v3.football.api-sports.io",
    // 라이브 전체 받고 스포츠토토 리그만 필터
    buildEP: () => "/fixtures?live=all",
    totoFilter: true,
    parse: g => ({
      leagueId: g.league?.id,
      leagueName: g.league?.name || "기타",
      leagueLogo: g.league?.logo || null,
      countryFlag: g.league?.flag || null,
      homeName: g.teams?.home?.name || "홈팀",
      homeLogo: g.teams?.home?.logo || null,
      awayName: g.teams?.away?.name || "원정팀",
      awayLogo: g.teams?.away?.logo || null,
      hg: g.goals?.home ?? "-",
      ag: g.goals?.away ?? "-",
      status: g.fixture?.status?.short || "",
      elapsed: g.fixture?.status?.elapsed != null ? String(g.fixture.status.elapsed) : toKST(g.fixture?.date),
      ht: g.score?.halftime ? `${g.score.halftime.home ?? '?'}:${g.score.halftime.away ?? '?'}` : null,
      events: g.events || [],
    })
  },
  {
    key:"basketball", icon:"🏀", label:"농구",
    url:"https://v1.basketball.api-sports.io",
    buildEP: () => `/games?date=${today()}`,
    totoFilter: true,
    parse: g => ({
      leagueId: g.league?.id,
      leagueName: g.league?.name || "기타",
      leagueLogo: g.league?.logo || null,
      countryFlag: null,
      homeName: g.teams?.home?.name || "홈팀",
      homeLogo: g.teams?.home?.logo || null,
      awayName: g.teams?.away?.name || "원정팀",
      awayLogo: g.teams?.away?.logo || null,
      hg: g.scores?.home?.total ?? g.scores?.home?.points ?? "-",
      ag: g.scores?.away?.total ?? g.scores?.away?.points ?? "-",
      status: g.status?.short || g.status?.long || "",
      elapsed: g.status?.timer != null ? String(g.status.timer) : toKST(g.date || g.time),
      ht: null, events: [],
    })
  },
  {
    key:"baseball",   icon:"⚾", label:"야구",
    url:"https://v1.baseball.api-sports.io",
    buildEP: () => `/games?date=${today()}`,
    totoFilter: true,
    parse: g => ({
      leagueId: g.league?.id,
      leagueName: g.league?.name || "기타",
      leagueLogo: g.league?.logo || null,
      countryFlag: null,
      homeName: g.teams?.home?.name || "홈팀",
      homeLogo: g.teams?.home?.logo || null,
      awayName: g.teams?.away?.name || "원정팀",
      awayLogo: g.teams?.away?.logo || null,
      hg: g.scores?.home?.total ?? "-",
      ag: g.scores?.away?.total ?? "-",
      status: g.status?.short || "",
      elapsed: g.status?.inn ? `${g.status.inn}이닝` : toKST(g.date || g.time),
      ht: null, events: [],
    })
  },
  {
    key:"volleyball", icon:"🏐", label:"배구",
    url:"https://v1.volleyball.api-sports.io",
    buildEP: () => `/games?date=${today()}`,
    totoFilter: true,
    parse: g => ({
      leagueId: g.league?.id,
      leagueName: g.league?.name || "기타",
      leagueLogo: g.league?.logo || null,
      countryFlag: null,
      homeName: g.teams?.home?.name || "홈팀",
      homeLogo: g.teams?.home?.logo || null,
      awayName: g.teams?.away?.name || "원정팀",
      awayLogo: g.teams?.away?.logo || null,
      hg: g.scores?.home ?? "-",
      ag: g.scores?.away ?? "-",
      status: g.status?.short || "",
      elapsed: g.status?.set ? `SET ${g.status.set}` : toKST(g.date || g.time),
      ht: null, events: [],
    })
  },
  {
    key:"hockey",     icon:"🏒", label:"아이스하키", hidden:true,
    url:"https://v1.hockey.api-sports.io",
    buildEP: () => `/games?date=${today()}`,
    parse: g => ({
      leagueName: g.league?.name || "기타",
      leagueLogo: g.league?.logo || null,
      countryFlag: null,
      homeName: g.teams?.home?.name || "홈팀",
      homeLogo: g.teams?.home?.logo || null,
      awayName: g.teams?.away?.name || "원정팀",
      awayLogo: g.teams?.away?.logo || null,
      hg: g.scores?.home ?? "-",
      ag: g.scores?.away ?? "-",
      status: g.status?.short || "",
      elapsed: g.status?.period ? `P${g.status.period}` : null,
      ht: null, events: [],
    })
  },
  {
    key:"handball",   icon:"🤾", label:"핸드볼", hidden:true,
    url:"https://v1.handball.api-sports.io",
    buildEP: () => `/games?date=${today()}`,
    parse: g => ({
      leagueName: g.league?.name || "기타",
      leagueLogo: g.league?.logo || null,
      countryFlag: null,
      homeName: g.teams?.home?.name || "홈팀",
      homeLogo: g.teams?.home?.logo || null,
      awayName: g.teams?.away?.name || "원정팀",
      awayLogo: g.teams?.away?.logo || null,
      hg: g.scores?.home ?? "-",
      ag: g.scores?.away ?? "-",
      status: g.status?.short || "",
      elapsed: g.status?.timer != null ? String(g.status.timer) : toKST(g.date || g.time),
      ht: null, events: [],
    })
  },
  {
    key:"rugby",      icon:"🏉", label:"럭비", hidden:true,
    url:"https://v1.rugby.api-sports.io",
    buildEP: () => `/games?date=${today()}`,
    parse: g => ({
      leagueName: g.league?.name || "기타",
      leagueLogo: g.league?.logo || null,
      countryFlag: null,
      homeName: g.teams?.home?.name || "홈팀",
      homeLogo: g.teams?.home?.logo || null,
      awayName: g.teams?.away?.name || "원정팀",
      awayLogo: g.teams?.away?.logo || null,
      hg: g.scores?.home ?? "-",
      ag: g.scores?.away ?? "-",
      status: g.status?.short || "",
      elapsed: g.status?.timer != null ? String(g.status.timer) : toKST(g.date || g.time),
      ht: null, events: [],
    })
  },
  {
    key:"nba",        icon:"🏀", label:"NBA",
    url:"https://v2.nba.api-sports.io",
    buildEP: () => `/games?date=${today()}`,
    totoFilter: false,  // NBA 전용 엔드포인트 = 전체가 토토 대상
    parse: g => ({
      leagueId: 12,
      leagueName: g.league?.name || "NBA",
      leagueLogo: null,
      countryFlag: null,
      homeName: g.teams?.home?.name || "홈팀",
      homeLogo: g.teams?.home?.logo || null,
      awayName: g.teams?.away?.name || "원정팀",
      awayLogo: g.teams?.away?.logo || null,
      hg: g.scores?.home?.points ?? "-",
      ag: g.scores?.away?.points ?? "-",
      status: g.status?.short || "",
      elapsed: g.status?.clock || toKST(g.date || g.time),
      ht: null, events: [],
    })
  },
  {
    key:"golf",       icon:"⛳", label:"골프",
    url:"https://v1.golf.api-sports.io",
    buildEP: () => `/rounds?date=${today()}`,
    totoFilter: false,  // 골프 전용
    parse: g => ({
      leagueId: g.league?.id,
      leagueName: g.league?.name || "PGA Tour",
      leagueLogo: g.league?.logo || null,
      countryFlag: null,
      homeName: g.player?.name || g.player1?.name || "선수1",
      homeLogo: null,
      awayName: g.player2?.name || "선수2",
      awayLogo: null,
      hg: g.scores?.player?.score ?? "-",
      ag: g.scores?.player2?.score ?? "-",
      status: g.status?.short || "",
      elapsed: g.round ? `R${g.round}` : toKST(g.date || g.time),
      ht: null, events: [],
    })
  }
];
// 상태 판별
const LIVE_SET = new Set(["1H","2H","HT","ET","BT","P","INT","LIVE","Q1","Q2","Q3","Q4","OT","INPLAY","IP","NS_Live","STARTED","Playing","In Play","In Progress","Live"]);
const DONE_SET = new Set(["FT","AET","PEN","FIN","AOT","Finished","FT_PEN","After Extra Time","After Penalties","Finished OT","NS_FIN","FINAL","Ended","Complete","Cancelled"]);
function isLive(n) { return LIVE_SET.has(n.status); }
function isDone(n) { return DONE_SET.has(n.status); }
let current     = "all";
let cache       = {};
let lastFetch   = {};
let filterLeague = "all";
let callCount   = 0;
/* ─── 탭 생성 ─── */
function buildTabs() {
  const wrap = document.getElementById("tab-inner");
  if(!wrap) return;
  wrap.innerHTML = "";
  // 전체 탭 (맨 앞)
  const allBtn = document.createElement("button");
  allBtn.className = "tab-btn" + (current==="all" ? " active" : "");
  allBtn.id = "tab-all";
  allBtn.innerHTML = `🌐 전체<span class="tab-cnt" id="tc-all">—</span>`;
  allBtn.onclick = () => switchTab("all", allBtn);
  wrap.appendChild(allBtn);
  // 종목별 탭 (hidden 제외)
  const VISIBLE_ORDER = ["football","basketball","nba","baseball","volleyball","golf"];
  const visibleSports = VISIBLE_ORDER.map(k => SPORTS.find(s => s.key===k)).filter(Boolean);
  visibleSports.forEach(s => {
    const btn = document.createElement("button");
    btn.className = "tab-btn" + (s.key===current?" active":"");
    btn.id = `tab-${s.key}`;
    btn.innerHTML = `${s.icon} ${s.label}<span class="tab-cnt" id="tc-${s.key}">—</span>`;
    btn.onclick = () => switchTab(s.key, btn);
    wrap.appendChild(btn);
  });
}
/* ─── 데이터 로드 ─── */
async function loadSport(key) {
  const area = document.getElementById("content-area");
  // 전체 탭: 표시 종목 전부 병렬 로드 후 시간순 합산
  if (key === "all") {
    area.innerHTML = `<div class="state-box"><div class="spinner"></div><div class="state-msg">🌐 실시간 경기 데이터 로딩중...<br><small style="font-size:.55rem;color:var(--t3)">API-Sports 연결 중</small></div></div>`;
    if (lsMode === 'demo') {
      renderAllDemo();
      return;
    }
    const ALL_KEYS = ["football","basketball","nba","baseball","volleyball"];
    await Promise.allSettled(ALL_KEYS.map(k => {
      if (!cache[k]) return loadSportSingle(k);
    }));
    // 모든 캐시 비어있으면 데모 표시
    const hasData = ALL_KEYS.some(k => cache[k] && cache[k].length > 0);
    if (!hasData) { renderAllDemo(); return; }
    renderAll();
    return;
  }
  await loadSportSingle(key);
}
async function loadSportSingle(key) {
  const area = document.getElementById("content-area");
  const s = SPORTS.find(x=>x.key===key);
  if(!s) return;
  // 데모 모드
  if (lsMode === 'demo') {
    const SPORT_ICON = { football:"⚽", basketball:"🏀", nba:"🏀", baseball:"⚾", volleyball:"🏐", golf:"⛳" };
    const icon = SPORT_ICON[key] || "🏅";
    const games = LS_DEMO.filter(g => (g._sport?.icon || "⚽") === icon);
    cache[key] = games;
    if (current === key) lsRender(games, key, s);
    return;
  }
  if (current === key) {
    area.innerHTML = `<div class="state-box"><div class="spinner"></div><div class="state-msg">${s.icon} ${s.label} 데이터 로딩중...</div></div>`;
  }
  try {
    const ep  = s.buildEP();
    const url = s.url + ep;
    const r   = await fetch(url, { headers: HDR });
    callCount++;
    updateQuota(r);
    if(!r.ok) throw new Error(`HTTP ${r.status}`);
    const d = await r.json();
    if(d.errors) {
      const errs = Object.values(d.errors);
      if(errs.length) throw new Error(errs[0]);
    }
    let games = (d.response || []).map(g => s.parse(g));
    // 스포츠토토 리그 필터링
    if (s.totoFilter && TOTO_LEAGUES[key]) {
      const allowed = new Set(TOTO_LEAGUES[key]);
      games = games.filter(g => allowed.has(g.leagueId));
      console.log(`[LS] ${key} 토토필터 적용: ${games.length}경기`);
    }
    // 축구: live=all에서 0건이면 오늘 예정 경기 병렬 조회 (EPL+K리그만, 2콜)
    if (key === 'football' && games.length === 0) {
      console.log('[LS] 축구 라이브 없음 → 오늘 예정 경기 병렬 조회');
      const yr = new Date().getFullYear();
      const totoIds = [39, 292]; // EPL, K리그1 우선 (2콜만 사용)
      try {
        const results = await Promise.allSettled(
          totoIds.map(lid =>
            fetch(`${s.url}/fixtures?date=${today()}&league=${lid}&season=${yr}`, { headers: HDR })
              .then(r => r.json())
              .then(d => (d.response || []).map(g => s.parse(g)))
          )
        );
        results.forEach(r => { if (r.status === 'fulfilled') games.push(...r.value); });
        console.log(`[LS] 축구 예정 경기 보충: ${games.length}경기`);
      } catch(e2) { console.warn('[LS] 축구 보충 실패:', e2.message); }
    }
    cache[key] = games;
    lastFetch[key] = Date.now();
    // 탭 카운트
    const liveN = games.filter(isLive).length;
    const tc = document.getElementById(`tc-${key}`);
    if(tc) {
      tc.textContent = liveN || games.length || "0";
      tc.className = "tab-cnt" + (liveN>0?" on":"");
    }
    // 전체탭이면 renderAll에서 처리하므로 개별 렌더 스킵
    if (current !== "all") {
      lsRender(games, key, s);
      updateTs();
    }
  } catch(e) {
    console.warn('[LS]', key, '실패:', e.message);
    if (!cache[key]) cache[key] = [];
    if (current !== 'all') {
      area.innerHTML = `<div class="state-box"><div class="empty-icon">📭</div><div class="state-msg">데이터 없음 · 데모 모드를 이용해 주세요<br><small style="font-size:.55rem;color:var(--t3)">${e.message}</small></div></div>`;
    }
  }
}
function renderAllDemo() {
  const area = document.getElementById("content-area");
  const live  = LS_DEMO.filter(g => ["1H","2H","Q1","Q2","Q3","Q4","1회","2회","3회","4회","5회","1세트","2세트","3세트","4세트","5세트"].includes(g.status));
  const done  = LS_DEMO.filter(g => g.status === "FT");
  const sched = LS_DEMO.filter(g => g.status === "NS");
  const statsHtml = `
    <div class="sum-row">
      <div class="sum-item"><span class="sum-val g">${live.length}</span><span class="sum-lbl">LIVE</span></div>
      <div class="sum-item"><span class="sum-val">${sched.length}</span><span class="sum-lbl">예정</span></div>
      <div class="sum-item"><span class="sum-val o">${done.length}</span><span class="sum-lbl">종료</span></div>
      <div class="sum-item"><span class="sum-val">${LS_DEMO.length}</span><span class="sum-lbl">전체</span></div>
    </div>
    <div class="upd-bar">
      <span class="upd-time" id="upd-label">데모 데이터 · ${nowStr()}</span>
      <button class="btn-ref" onclick="reload()">↻ 새로고침</button>
    </div>`;
  const sorted = [...live, ...sched, ...done];
  let rows = '';
  sorted.forEach(n => {
    const icon = n._sport?.icon || "⚽";
    const isLv = live.includes(n);
    const isDn = done.includes(n);
    let stCell;
    if(isLv) stCell = `<div class="c-st"><span class="st-live">● LIVE</span><span class="st-min">${n.elapsed||''}</span></div>`;
    else if(isDn) stCell = `<div class="c-st"><span class="st-done">종료</span></div>`;
    else stCell = `<div class="c-st"><span class="st-sched">${n.elapsed||'예정'}</span></div>`;
    rows += `<div class="match-row${isLv?' live':''}${isDn?' done':''}">
      ${stCell}
      <div class="c-home"><span class="t-name">${icon} ${n.homeName}</span></div>
      <div class="c-sc"><span class="sc-main${isLv?' live':''}">${n.hg} : ${n.ag}</span>${n.ht&&isLv?`<span class='sc-sub'>HT ${n.ht}</span>`:""}</div>
      <div class="c-away"><span class="t-name">${n.awayName}</span></div>
      <div class="c-ev"><span style="font-size:.5rem;color:var(--t3)">${n.leagueName}</span></div>
    </div>`;
  });
  area.innerHTML = statsHtml + `<div class="match-list">${rows}</div>`;
  const tc = document.getElementById("tc-all");
  if(tc) { tc.textContent = live.length || LS_DEMO.length; tc.className = "tab-cnt"+(live.length>0?" on":""); }
}
// 전체 탭: 모든 캐시 합산해서 시간순 렌더
function renderAll() {
  const area = document.getElementById("content-area");
  const ALL_KEYS = ["football","basketball","nba","baseball","volleyball"];
  let allGames = [];
  ALL_KEYS.forEach(k => {
    const s = SPORTS.find(x=>x.key===k);
    if (!s || !cache[k]) return;
    cache[k].forEach(g => {
      allGames.push({ ...g, _sport: s });
    });
  });
  if (!allGames.length) {
    // 실제 데이터 없으면 데모로 fallback
    renderAllDemo();
    return;
  }
  // LIVE 먼저, 그 다음 예정 시간순
  allGames.sort((a, b) => {
    const aLive = isLive(a) ? 0 : 1;
    const bLive = isLive(b) ? 0 : 1;
    return aLive - bLive;
  });
  const liveN  = allGames.filter(isLive).length;
  const doneN  = allGames.filter(isDone).length;
  const schedN = allGames.length - liveN - doneN;
  const statsHtml = `
    <div class="sum-row">
      <div class="sum-item"><span class="sum-val g">${liveN}</span><span class="sum-lbl">LIVE</span></div>
      <div class="sum-item"><span class="sum-val">${schedN}</span><span class="sum-lbl">예정</span></div>
      <div class="sum-item"><span class="sum-val o">${doneN}</span><span class="sum-lbl">종료</span></div>
      <div class="sum-item"><span class="sum-val">${allGames.length}</span><span class="sum-lbl">전체</span></div>
    </div>
    <div class="upd-bar">
      <span class="upd-time" id="upd-label">업데이트: ${nowStr()}</span>
      <button class="btn-ref" onclick="reload()">↻ 새로고침</button>
    </div>`;
  let html = '';
  allGames.forEach(n => {
    const s = n._sport;
    const live = isLive(n);
    const done = isDone(n);
    let stCell;
    if(n.status==="HT") {
      stCell=`<div class="c-st"><span class="st-ht">HT</span></div>`;
    } else if(live) {
      stCell=`<div class="c-st"><span class="st-live">● LIVE</span><span class="st-min">${n.elapsed||''}</span></div>`;
    } else if(done) {
      stCell=`<div class="c-st"><span class="st-done">종료</span></div>`;
    } else {
      stCell=`<div class="c-st"><span class="st-sched">${n.elapsed||'예정'}</span></div>`;
    }
    const goals = (n.events||[]).filter(e=>e.type==="Goal").slice(-2);
    let evHtml = `<div class="c-ev">`;
    goals.forEach(e => {
      evHtml += `<div class="ev-item goal">⚽ ${(e.player?.name||'').split(' ').pop()} ${e.time?.elapsed||''}′</div>`;
    });
    evHtml += `</div>`;
    html += `<div class="match-row${live?' live':''}${done?' done':''}">
      ${stCell}
      <div class="c-home">
        ${n.homeLogo?`<img class='team-logo' src="${n.homeLogo}" onerror="this.style.display='none'">`:``}
        <span class="t-name">${s.icon} ${n.homeName}</span>
      </div>
      <div class="c-sc">
        <span class="sc-main${live?' live':''}">${n.hg} : ${n.ag}</span>
        ${n.ht&&live?`<span class='sc-sub'>HT ${n.ht}</span>`:""}
      </div>
      <div class="c-away">
        <span class="t-name">${n.awayName}</span>
        ${n.awayLogo?`<img class='team-logo' src="${n.awayLogo}" onerror="this.style.display='none'">`:``}
      </div>
      ${evHtml}
    </div>`;
  });
  // 렌더링
  area.innerHTML = statsHtml + `<div class="match-list">${html}</div>`;
  // 탭 카운트 업데이트
  const tc = document.getElementById("tc-all");
  if(tc) { tc.textContent = liveN > 0 ? liveN : allGames.length; tc.className = "tab-cnt" + (liveN>0?" on":""); }
  updateTs();
}
function updateQuota(r) {
  const rem = r.headers.get("x-ratelimit-requests-remaining");
  const lim = r.headers.get("x-ratelimit-requests-limit");
  if(rem !== null) {
    const el = document.getElementById("quota-info");
    if(el) el.textContent = `API-Sports · 오늘 남은 콜: ${rem}/${lim||100}`;
  }
}
/* ─── 렌더 ─── */
function lsRender(games, key, s) {
  const area = document.getElementById("content-area");
  if(!area) return;
  if(!games?.length) {
    area.innerHTML = `<div class="state-box">
      <div class="state-msg">${s.icon} 오늘 ${s.label} 경기 데이터가 없습니다.<br>
      <small style="font-size:.6rem;color:var(--t3)">경기가 없거나 다른 시간대에 예정되어 있을 수 있습니다.</small>
      </div></div>`;
    return;
  }
  // 주요 리그
  const MAJOR = new Set([
    "K League 1","K League 2","K3 League","FA Cup","Korean FA Cup",
    "J1 League","J2 League","Super League","Chinese Super League",
    "Premier League","La Liga","Bundesliga","Serie A","Ligue 1",
    "Championship","La Liga 2","2. Bundesliga","Serie B","Ligue 2",
    "UEFA Champions League","UEFA Europa League","UEFA Conference League",
    "Eredivisie","Pro League","Primeira Liga","Super Lig",
    "MLS","Liga MX","Serie A","Liga Profesional Argentina",
    "AFC Champions League","AFC Cup","Asian Cup","World Cup",
    "NBA","EuroLeague","KBL","KBO","NPB","MLB","V-League Men","V-League Women",
  ]);
  // 리그 그룹
  const groups = {};
  games.forEach(n => {
    const lg = n.leagueName;
    if(!groups[lg]) groups[lg] = { logo:n.leagueLogo, flag:n.countryFlag, list:[], major: MAJOR.has(lg) };
    groups[lg].list.push(n);
  });
  const liveN  = games.filter(isLive).length;
  const doneN  = games.filter(isDone).length;
  const schedN = games.length - liveN - doneN;
  const majorN = games.filter(n => MAJOR.has(n.leagueName)).length;
  // 정렬: 주요리그 LIVE → 주요리그 기타 → 나머지 LIVE → 나머지
  const lgKeys = Object.keys(groups).sort((a,b) => {
    const ag = groups[a], bg = groups[b];
    const al = ag.list.filter(isLive).length;
    const bl = bg.list.filter(isLive).length;
    if(ag.major !== bg.major) return ag.major ? -1 : 1;
    return bl - al;
  });
  const filtered = filterLeague==="all"   ? lgKeys
    : filterLeague==="major" ? lgKeys.filter(k=>groups[k].major)
    : lgKeys.filter(k=>k===filterLeague);
  // 필터
  const hasMajor = lgKeys.some(k=>groups[k].major);
  let fhtml = `<div class="filter-row"><span class="filter-lbl">리그</span>
    <button class="fbtn ${filterLeague==='all'?'active':''}" onclick="applyFilter('all',this)">전체</button>
    ${hasMajor?`<button class='fbtn major-btn ${filterLeague==='major'?'active':''}" onclick="applyFilter('major',this)">⭐ 주요리그${majorN?` <span style='color:var(--gold2);font-size:.5rem'>${majorN}</span>`:""}</button>`:""}`;
  lgKeys.slice(0,10).forEach(lg => {
    const esc = lg.replace(/\\/g,"\\\\").replace(/'/g,"\\'");
    const lN  = groups[lg].list.filter(isLive).length;
    fhtml += `<button class="fbtn ${filterLeague===lg?'active':''}" onclick="applyFilter('${esc}',this)">${lg}${lN?` <span style='color:var(--red);font-size:.5rem'>●</span>`:''}</button>`;
  });
  fhtml += `</div>`;
  let html = `
    <div class="sum-row">
      <div class="sum-item"><span class="sum-val g">${liveN}</span><span class="sum-lbl">LIVE</span></div>
      <div class="sum-item"><span class="sum-val">${schedN}</span><span class="sum-lbl">예정</span></div>
      <div class="sum-item"><span class="sum-val o">${doneN}</span><span class="sum-lbl">종료</span></div>
      <div class="sum-item"><span class="sum-val">${games.length}</span><span class="sum-lbl">전체</span></div>
    </div>
    ${fhtml}
    <div class="upd-bar">
      <span class="upd-time" id="upd-label">업데이트: ${nowStr()}</span>
      <button class="btn-ref" onclick="reload()">↻ 새로고침</button>
    </div>`;
  filtered.forEach(lg => {
    const { logo, flag, list } = groups[lg];
    const lN = list.filter(isLive).length;
    html += `<div class="league-sec">
      <div class="league-hd" onclick="toggleSec(this)">
        ${flag?`<img class='country-flag' src="${flag}" onerror="this.style.display='none'">`:
          logo?`<img class="league-logo" src="${logo}" onerror="this.style.display='none'">`:""}
        <span class="league-nm">${s.icon} ${lg}</span>
        ${groups[lg]?.major?`<span style='font-family:'DM Mono',monospace;font-size:.46rem;color:var(--gold2);opacity:.7'>⭐</span>`:''}
        ${lN?`<span class='league-live-pill'>LIVE ${lN}</span>`:""}
        <span class="league-cnt">${list.length}경기</span>
        <span class="lg-tog open">▾</span>
      </div>
      <div class="match-list">`;
    list.forEach(n => {
      const live = isLive(n);
      const done = isDone(n);
      let stCell;
      if(n.status==="HT") {
        stCell=`<div class="c-st"><span class="st-ht">HT</span></div>`;
      } else if(live) {
        stCell=`<div class="c-st"><span class="st-live">● LIVE</span><span class="st-min">${n.elapsed||''}</span></div>`;
      } else if(done) {
        stCell=`<div class="c-st"><span class="st-done">종료</span></div>`;
      } else {
        stCell=`<div class="c-st"><span class="st-sched">${n.elapsed||'예정'}</span></div>`;
      }
      // 골 이벤트
      const goals = (n.events||[]).filter(e=>e.type==="Goal").slice(-2);
      let evHtml = `<div class="c-ev">`;
      goals.forEach(e => {
        evHtml += `<div class="ev-item goal">⚽ ${(e.player?.name||'').split(' ').pop()} ${e.time?.elapsed||''}′</div>`;
      });
      evHtml += `</div>`;
      html += `<div class="match-row${live?' live':''}${done?' done':''}">
        ${stCell}
        <div class="c-home">
          ${n.homeLogo?`<img class='team-logo' src="${n.homeLogo}" onerror="this.style.display='none'">`:""}
          <span class="t-name">${n.homeName}</span>
        </div>
        <div class="c-sc">
          <span class="sc-main${live?' live':''}">${n.hg} : ${n.ag}</span>
          ${n.ht&&live?`<span class='sc-sub'>HT ${n.ht}</span>`:""}
        </div>
        <div class="c-away">
          <span class="t-name">${n.awayName}</span>
          ${n.awayLogo?`<img class='team-logo' src="${n.awayLogo}" onerror="this.style.display='none'">`:""}
        </div>
        ${evHtml}
      </div>`;
    });
    html += `</div></div>`;
  });
  area.innerHTML = html;
}
/* ─── 유틸 ─── */
function switchTab(key, btn) {
  document.querySelectorAll(".tab-btn").forEach(b=>b.classList.remove("active"));
  btn.classList.add("active");
  current = key;
  filterLeague = "all";
  if (key === "all") {
    loadSport("all");
  } else if(cache[key] && (Date.now()-(lastFetch[key]||0)) < 180000) {
    lsRender(cache[key], key, SPORTS.find(x=>x.key===key));
  } else {
    loadSport(key);
  }
}
function applyFilter(lg, btn) {
  filterLeague = lg;
  document.querySelectorAll(".fbtn").forEach(b=>b.classList.remove("active"));
  btn.classList.add("active");
  if(cache[current]) lsRender(cache[current], current, SPORTS.find(x=>x.key===current));
}
function toggleSec(hd) {
  const list=hd.nextElementSibling, tog=hd.querySelector(".lg-tog");
  const open=list.style.display!=="none";
  list.style.display=open?"none":"";
  tog.classList.toggle("open",!open);
}
function nowStr() {
  const _n=new Date(); return `${String(_n.getHours()).padStart(2,'0')}:${String(_n.getMinutes()).padStart(2,'0')}:${String(_n.getSeconds()).padStart(2,'0')} KST`;
}
function updateTs() {
  const t = nowStr();
  ["global-upd","upd-label"].forEach(id=>{
    const el=document.getElementById(id);
    if(el) el.textContent=(id==="global-upd"?"마지막 갱신: ":"업데이트: ")+t;
  });
}
function reload() {
  delete cache[current];
  delete lastFetch[current];
  loadSport(current);
}
// ── 라이브스코어 데모 데이터 ──
const LS_DEMO = [
  // 축구
  { leagueName:"프리미어리그", leagueLogo:null, countryFlag:"🏴", homeName:"맨체스터 시티", awayName:"아스날", hg:2, ag:1, status:"2H", elapsed:"67", ht:"1:0", events:[] },
  { leagueName:"라리가", leagueLogo:null, countryFlag:"🇪🇸", homeName:"레알 마드리드", awayName:"바르셀로나", hg:1, ag:1, status:"2H", elapsed:"55", ht:"0:1", events:[] },
  { leagueName:"분데스리가", leagueLogo:null, countryFlag:"🇩🇪", homeName:"바이에른 뮌헨", awayName:"도르트문트", hg:3, ag:0, status:"FT", elapsed:null, ht:"2:0", events:[] },
  { leagueName:"K리그1", leagueLogo:null, countryFlag:"🇰🇷", homeName:"전북 현대", awayName:"울산 HD", hg:0, ag:0, status:"1H", elapsed:"23", ht:null, events:[] },
  { leagueName:"프리미어리그", leagueLogo:null, countryFlag:"🏴", homeName:"리버풀", awayName:"첼시", hg:0, ag:0, status:"NS", elapsed:"21:00", ht:null, events:[] },
  // 농구
  { leagueName:"NBA", leagueLogo:null, countryFlag:"🇺🇸", homeName:"LA 레이커스", awayName:"골든스테이트", hg:98, ag:102, status:"Q3", elapsed:"Q3 8:24", ht:"48:51", events:[], _sport:{icon:"🏀"} },
  { leagueName:"NBA", leagueLogo:null, countryFlag:"🇺🇸", homeName:"보스턴 셀틱스", awayName:"마이애미 히트", hg:0, ag:0, status:"NS", elapsed:"10:30", ht:null, events:[], _sport:{icon:"🏀"} },
  { leagueName:"KBL", leagueLogo:null, countryFlag:"🇰🇷", homeName:"서울 SK", awayName:"부산 KCC", hg:87, ag:79, status:"FT", elapsed:null, ht:"42:38", events:[], _sport:{icon:"🏀"} },
  // 야구
  { leagueName:"KBO", leagueLogo:null, countryFlag:"🇰🇷", homeName:"LG 트윈스", awayName:"두산 베어스", hg:4, ag:2, status:"5회", elapsed:"5회 초", ht:"2:1", events:[], _sport:{icon:"⚾"} },
  { leagueName:"MLB", leagueLogo:null, countryFlag:"🇺🇸", homeName:"LA 다저스", awayName:"뉴욕 양키스", hg:0, ag:0, status:"NS", elapsed:"09:10", ht:null, events:[], _sport:{icon:"⚾"} },
  // 배구
  { leagueName:"V리그 남자", leagueLogo:null, countryFlag:"🇰🇷", homeName:"현대캐피탈", awayName:"OK 저축은행", hg:2, ag:1, status:"4세트", elapsed:"4set", ht:null, events:[], _sport:{icon:"🏐"} },
];
let lsMode = 'real'; // 'real' | 'demo'
function setLsMode(mode) {
  lsMode = mode;
  document.getElementById('lsBtnReal').classList.toggle('active', mode === 'real');
  document.getElementById('lsBtnDemo').classList.toggle('active', mode === 'demo');
  // 캐시 초기화 후 재로드
  cache = {}; lastFetch = {};
  loadSport(current);
}
function initLivescore() {
  current = "all";
  buildTabs();
  loadSport("all");
  // 5분 갱신 (콜 절약)
  setInterval(() => {
    delete cache[current];
    loadSport(current);
  }, 300000);
}

/* ── 블록3 ─────────────────────────────── */
//<![CDATA[

// ================================================================
// EdgeNest AI — 배당률 섹션
// 데이터 흐름:
//   1) 스포츠토토 공식 API → 오늘 발매 경기 목록 (한글 팀명/리그)
//   2) Sportsradar inplay + upcoming → 실시간 배당 (병렬)
//   3) 리그명 + 시간으로 매칭 → 한글 팀명 + 실시간 배당 표시
// ================================================================

// ── 설정 ──────────────────────────────────────────────────────
const TOTO_KEY  = 'eadf4c25aa7203f6d1840a2f4306649ab030e91188580b588e93e4b1e230e6bb';
const TOTO_BASE = 'https://apis.data.go.kr/B551014/SRVC_OD_API_TB_SOSFO_MATCH_MGMT/todz_api_tb_match_mgmt_i';
const SR_KEY2   = '6a5d1ea245msh63d3ebd0b873de0p1da56bjsn370ddd7e5d58';
const SR_HOST2  = 'sportsradar-sportsbook-api.p.rapidapi.com';
const SR_BASE2  = 'https://sportsradar-sportsbook-api.p.rapidapi.com/api/v1/sportsradar';

// 스포츠토토 종목명(한글) → sport 코드
const O_SPORT_MAP = { '축구':10, '농구':11, '야구':13, '배구':23, '골프':14 };

// Sportsradar sportId
const O_SR_SPORT  = { 10:'sr:sport:1', 11:'sr:sport:2', 13:'sr:sport:3', 23:'sr:sport:23', 14:'sr:sport:9' };

// 리그명 한글 → SR competitionName 키워드
const O_LEAGUE_MAP = {
  '잉글랜드프리미어리그': 'Premier League',
  '스페인프리메라리가':   'La Liga',
  '독일분데스리가':       'Bundesliga',
  '이탈리아세리에A':      'Serie A',
  '프랑스리그앙':         'Ligue 1',
  'K리그1':              'K League 1',
  'K리그2':              'K League 2',
  'NBA':                 'NBA',
  'KBL':                 'KBL',
  'WKBL':                'WKBL',
  'KBO':                 'KBO',
  'MLB':                 'MLB',
  'NPB':                 'NPB',
  'V리그남자부':          'V-League',
  'V리그여자부':          'V-League',
  'PGA투어':             'PGA Tour',
  'LPGA투어':            'LPGA',
};

// 리그 탭 목록
const O_LEAGUES = {
  10: [{id:1,n:'프리미어리그',f:'🏴󠁧󠁢󠁥󠁮󠁧󠁿'},{id:2,n:'라리가',f:'🇪🇸'},{id:3,n:'분데스리가',f:'🇩🇪'},{id:4,n:'세리에A',f:'🇮🇹'},{id:5,n:'리그1',f:'🇫🇷'},{id:292,n:'K리그1',f:'🇰🇷'},{id:293,n:'K리그2',f:'🇰🇷'}],
  11: [{id:132,n:'NBA',f:'🇺🇸'},{id:1540,n:'KBL',f:'🇰🇷'},{id:1541,n:'WKBL',f:'🇰🇷'}],
  13: [{id:1,n:'MLB',f:'🇺🇸'},{id:2,n:'KBO',f:'🇰🇷'},{id:3,n:'NPB',f:'🇯🇵'}],
  23: [{id:36,n:'V리그 남자',f:'🇰🇷'},{id:37,n:'V리그 여자',f:'🇰🇷'}],
  14: [{id:1,n:'PGA Tour',f:'🇺🇸'},{id:2,n:'LPGA',f:'🌍'}],
};

// 데모 데이터
const O_DEMO = {
  10: [{h:'아스날',a:'맨체스터 시티',l:'잉글랜드프리미어리그',live:true},{h:'리버풀',a:'첼시',l:'잉글랜드프리미어리그',live:true},{h:'레알 마드리드',a:'아틀레티코',l:'스페인프리메라리가',live:false},{h:'전북 현대',a:'FC 서울',l:'K리그1',live:false},{h:'바이에른',a:'도르트문트',l:'독일분데스리가',live:false}],
  11: [{h:'Cleveland Cavaliers',a:'Boston Celtics',l:'NBA',live:true},{h:'LA Lakers',a:'Golden State Warriors',l:'NBA',live:false},{h:'서울 SK 나이츠',a:'부산 KCC 이지스',l:'KBL',live:false},{h:'우리은행',a:'KB스타즈',l:'WKBL',live:false}],
  13: [{h:'LA Dodgers',a:'New York Yankees',l:'MLB',live:true},{h:'LG 트윈스',a:'KIA 타이거즈',l:'KBO',live:false},{h:'두산 베어스',a:'삼성 라이온즈',l:'KBO',live:false}],
  23: [{h:'대한항공 점보스',a:'OK저축은행',l:'V리그남자부',live:true},{h:'현대건설',a:'IBK기업은행',l:'V리그여자부',live:false}],
  14: [{h:'Scottie Scheffler',a:'Rory McIlroy',l:'PGA투어',live:false}],
};

// ── 앱 상태 ──────────────────────────────────────────────────
const oState = {
  mode:   'real',
  sport:   11,
  league: 'all',
  items:   [],   // 정규화된 경기 목록
  oMap:    {},   // eventId → {runners, status}
  busy:    false,
};

// ── 유틸 ─────────────────────────────────────────────────────
function oKstDate(offset) {
  const d = new Date(Date.now() + (9 + (offset||0)*24)*3600000);
  return d.toISOString().slice(0,10).replace(/-/g,'');
}
function oKstTime(ms) {
  if (!ms) return '--:--';
  const d = new Date(ms + 9*3600000);
  return String(d.getUTCHours()).padStart(2,'0') + ':' + String(d.getUTCMinutes()).padStart(2,'0');
}
function oTotoMs(ymd, hhmm) {
  if (!ymd || !hhmm || hhmm === '0000') return null;
  const [y,mo,d,h,m] = [+ymd.slice(0,4),+ymd.slice(4,6),+ymd.slice(6,8),+hhmm.slice(0,2),+hhmm.slice(2,4)];
  return Date.UTC(y, mo-1, d, h-9, m);  // KST → UTC (ms)
}

// ── API 호출 ──────────────────────────────────────────────────
async function oFetchToto() {
  const sportKr = Object.entries(O_SPORT_MAP).find(([,v])=>v===oState.sport)?.[0];
  const params  = new URLSearchParams({
    serviceKey: TOTO_KEY, pageNo:'1', numOfRows:'100',
    resultType: 'json',   MATCH_DATE: oKstDate(0),
  });
  if (sportKr) params.set('SPORT_TYPE', sportKr);
  const res  = await fetch(TOTO_BASE + '?' + params);
  if (!res.ok) throw new Error('TOTO ' + res.status);
  const data = await res.json();
  const raw  = data?.response?.body?.items?.item || [];
  return Array.isArray(raw) ? raw : (raw && typeof raw === 'object' ? [raw] : []);
}

async function oFetchSR() {
  const sid = O_SR_SPORT[oState.sport];
  if (!sid) return { inplay:[], upcoming:[] };
  const hdrs = {
    'Content-Type':    'application/json',
    'x-rapidapi-host': SR_HOST2,
    'x-rapidapi-key':  document.getElementById('apiKeyInput')?.value || SR_KEY2,
  };
  const [r1, r2] = await Promise.allSettled([
    fetch(`${SR_BASE2}/inplay-events?pageNo=1&sportId=${sid}`,   {headers:hdrs}).then(r=>r.json()),
    fetch(`${SR_BASE2}/upcoming-events?pageNo=1&sportId=${sid}`, {headers:hdrs}).then(r=>r.json()),
  ]);
  return {
    inplay:   r1.status==='fulfilled' ? (r1.value?.sports||[]) : [],
    upcoming: r2.status==='fulfilled' ? (r2.value?.sports||[]) : [],
  };
}

// ── 매칭 ─────────────────────────────────────────────────────
function oMatch(item, srPool, used) {
  const kw   = O_LEAGUE_MAP[item.leag_han_nm] || item.leag_han_nm || '';
  const pool = srPool.filter(ev =>
    ev.eventId && !used.has(ev.eventId) &&
    (ev.competitionName||'').toLowerCase().includes(kw.toLowerCase())
  );
  if (!pool.length) return null;

  const ms = oTotoMs(item.match_ymd, item.match_tm);
  let cands = pool;
  if (ms) {
    const narrow = pool.filter(ev => Math.abs((ev.openDate||0) - ms) < 90*60*1000);
    if (narrow.length) cands = narrow;
  }

  const best = cands.find(ev=>ev.status==='IN_PLAY') || cands.sort((a,b)=>(a.openDate||0)-(b.openDate||0))[0];
  used.add(best.eventId);
  return best;
}

// ── 정규화 ───────────────────────────────────────────────────
function oNorm(item, sr) {
  const runners = sr?.markets?.matchOdds?.[0]?.runners || [];
  const isLive  = sr?.status === 'IN_PLAY';
  const eid     = sr?.eventId || ('t_' + item.row_num + '_' + item.match_ymd);
  const openMs  = sr?.openDate || oTotoMs(item.match_ymd, item.match_tm);
  return {
    eid, isLive, openMs, runners,
    home:   item.hteam_han_nm || 'HOME',
    away:   item.ateam_han_nm || 'AWAY',
    league: item.leag_han_nm  || '',
    result: item.match_end_val || '',
    venue:  item.stdm_han_nm  || '',
    srOk:   !!sr,
    susp:   sr?.markets?.matchOdds?.[0]?.status === 'SUSPENDED',
  };
}

// ── 데모 ─────────────────────────────────────────────────────
function oLoadDemo() {
  oState.items = [];
  oState.oMap  = {};
  const is3way = [10,23].includes(oState.sport);
  const now    = Date.now();
  (O_DEMO[oState.sport] || O_DEMO[11]).forEach((d,i) => {
    const h  = +(1.5+Math.random()*1.5).toFixed(2);
    const dr = +(2.8+Math.random()*0.8).toFixed(2);
    const a  = +(1.5+Math.random()*1.5).toFixed(2);
    const runners = is3way
      ? [{runnerId:'1',runnerName:d.h,backPrices:[{price:h}]},{runnerId:'2',runnerName:'무승부',backPrices:[{price:dr}]},{runnerId:'3',runnerName:d.a,backPrices:[{price:a}]}]
      : [{runnerId:'1',runnerName:d.h,backPrices:[{price:h}]},{runnerId:'2',runnerName:d.a,backPrices:[{price:a}]}];
    const eid = 'demo_' + i;
    oState.oMap[eid] = { runners, status: d.live ? 'Active' : 'PreMatch' };
    oState.items.push({ eid, home:d.h, away:d.a, league:d.l, isLive:d.live,
      openMs: now + (d.live ? -1800000 : i*5400000), runners, srOk:false, susp:false, result:'', venue:'' });
  });
}

// ── 실제 데이터 로드 ──────────────────────────────────────────
async function oLoadReal() {
  oState.items = [];
  oState.oMap  = {};
  oSetStep('📋 스포츠토토 발매 경기 조회 중...');

  let totoList = [];
  try { totoList = await oFetchToto(); }
  catch(e) { console.warn('[TOTO]', e.message); }

  if (!totoList.length) return false;  // 데모 fallback

  oSetStep('📡 실시간 배당 조회 중...');
  let inplay = [], upcoming = [];
  try {
    const r = await oFetchSR();
    inplay   = r.inplay;
    upcoming = r.upcoming;
  } catch(e) { console.warn('[SR]', e.message); }

  oSetStep('🔗 배당 매칭 중...');
  const allSR = [...inplay, ...upcoming];
  const used  = new Set();

  totoList.forEach(item => {
    const sid = O_SPORT_MAP[item.match_sport_han_nm];
    if (sid && sid !== oState.sport) return;
    const sr  = oMatch(item, allSR, used);
    const fx  = oNorm(item, sr);
    oState.items.push(fx);
    if (fx.runners.length) oState.oMap[fx.eid] = { runners:fx.runners, status:fx.susp?'SUSPENDED':'Active' };
  });

  // LIVE 먼저, 그 다음 시간순
  oState.items.sort((a,b) => (b.isLive?1:0)-(a.isLive?1:0) || (a.openMs||0)-(b.openMs||0));
  return true;
}

// ── 진입점 ───────────────────────────────────────────────────
async function oLoad() {
  if (oState.busy) return;
  oState.busy = true;
  oShowLoad(true);
  try {
    if (oState.mode === 'demo') {
      oSetStep('데모 데이터 준비 중...');
      await new Promise(r=>setTimeout(r,200));
      oLoadDemo();
    } else {
      const ok = await oLoadReal();
      if (!ok) { console.warn('[ODDS] 데이터 없음 → 데모'); oLoadDemo(); }
    }
    oUpdStats();
    oRender();
  } catch(e) {
    console.error('[ODDS]', e);
    oLoadDemo(); oUpdStats(); oRender();
  } finally {
    oState.busy = false;
    oShowLoad(false);
  }
}

// ── UI 제어 ──────────────────────────────────────────────────
function initOdds() {
  oUpdLeagueBar();
  oLoad();
  setInterval(() => { if (oState.mode==='real') oLoad(); }, 300000);
}

function setMode(m) {
  oState.mode = m;
  document.getElementById('btnReal').classList.toggle('active', m==='real');
  document.getElementById('btnDemo').classList.toggle('active', m==='demo');
  oLoad();
}

function onSportChange(el, sid) {
  document.querySelectorAll('.sport-tab').forEach(t=>t.classList.remove('active'));
  el.classList.add('active');
  oState.sport  = sid;
  oState.league = 'all';
  oUpdLeagueBar();
  oLoad();
}

function onLeagueChange(el, lid) {
  document.querySelectorAll('.league-chip').forEach(c=>c.classList.remove('active'));
  el.classList.add('active');
  oState.league = lid;
  oRender();
}

function oUpdLeagueBar() {
  const bar = document.getElementById('leagueBar');
  if (!bar) return;
  const leagues = O_LEAGUES[oState.sport] || [];
  bar.innerHTML = '<span class="league-label">리그:</span>'
    + '<div class="league-chip active" onclick="onLeagueChange(this,\'all\')">전체</div>'
    + leagues.map(l=>`<div class="league-chip" onclick="onLeagueChange(this,'${l.id}')">${l.f} ${l.n}</div>`).join('');
}

function oUpdStats() {
  const f = oState.items;
  const live = f.filter(x=>x.isLive).length;
  const leagues = new Set(f.map(x=>x.league)).size;
  document.getElementById('statGames').textContent   = f.length;
  document.getElementById('statLive').textContent    = live;
  document.getElementById('statPre').textContent     = f.length - live;
  document.getElementById('statLeagues').textContent = leagues;
}

function oShowLoad(v) {
  const el = document.getElementById('loadingOverlay');
  if (el) el.style.display = v ? 'flex' : 'none';
}
function oSetStep(msg) {
  const el = document.getElementById('loadingStep');
  if (el) el.textContent = msg;
}

// ── 렌더링 ───────────────────────────────────────────────────
function oRender() {
  const box = document.getElementById('matchesContainer');
  if (!box) return;
  let list = oState.items;

  if (oState.league !== 'all') {
    const lid = +oState.league;
    const lName = (O_LEAGUES[oState.sport]||[]).find(l=>l.id===lid)?.n || '';
    list = list.filter(f => f.league.includes(lName) || O_LEAGUE_MAP[f.league]?.includes(lName));
  }

  if (!list.length) {
    box.innerHTML = '<div class="empty-box"><div class="empty-icon">📭</div><div class="empty-text">오늘 경기가 없습니다</div><div class="empty-sub">다른 종목을 선택하거나 데모 모드를 이용하세요</div></div>';
    return;
  }

  // 리그별 그룹 (LIVE 우선)
  const grp = {};
  list.forEach(f => {
    if (!grp[f.league]) grp[f.league] = { items:[], live:false };
    grp[f.league].items.push(f);
    if (f.isLive) grp[f.league].live = true;
  });

  box.innerHTML = Object.entries(grp)
    .sort(([,a],[,b]) => (b.live?1:0)-(a.live?1:0))
    .map(([lg, g]) => `
      <div class="league-section">
        <div class="league-section-header">
          <span class="league-flag">${g.live ? '🔴' : '🏆'}</span>
          <span>${lg}</span>
          ${g.live ? '<span style='font-size:10px;color:var(--red);margin-left:6px'>LIVE</span>' : ''}
        </div>
        ${g.items.map(oCard).join('')}
      </div>`).join('');
}

function oCard(f) {
  const entry   = oState.oMap[f.eid] || {};
  const runners = entry.runners || f.runners || [];
  const susp    = entry.status === 'SUSPENDED' || f.susp;
  const hasOdds = runners.length > 0;
  const p       = r => r?.backPrices?.[0]?.price;
  const timeStr = oKstTime(f.openMs);

  let oddsHtml = '<div class="odds-cell"><div class="odds-cell-label">1X2</div><div style="text-align:center;color:var(--text3);font-size:11px;padding:12px">-</div></div>';
  if (hasOdds) {
    const btnStyle = susp ? 'opacity:.4;' : '';
    oddsHtml = `<div class="odds-cell">
      <div class="odds-cell-label">1X2</div>
      ${runners.map((r,i) => `
        <div class="odds-btn${i===0&&f.isLive&&!susp?' highlight':''}" style="${btnStyle}margin-top:${i?'2px':'0'}">
          <div class="odds-label">${i===0?'홈':i===runners.length-1?'원정':'무'}</div>
          <div class="odds-value">${p(r)?.toFixed(2)||'-'}</div>
        </div>`).join('')}
      ${susp ? '<div style='font-size:9px;color:var(--red);text-align:center;margin-top:2px'>⏸ 중단</div>' : ''}
    </div>`;
  }

  return `<div class="match-card ${f.isLive?'live-card':''}">
    <div class="match-card-inner">
      <div class="match-info">
        <div class="match-time-row">
          <span class="match-time">${timeStr}</span>
          ${f.isLive
            ? '<span class="match-status-live">● LIVE</span>'
            : '<span class="match-status-pre">예정</span>'}
        </div>
        <div class="match-teams">
          <div class="team-row">
            <span class="team-name">${f.home}</span>
            ${f.isLive ? `<span class='team-score'>${f.homeScore||0}</span>` : ''}
          </div>
          <div class="team-row">
            <span class="team-name" style="color:var(--text2)">${f.away}</span>
            ${f.isLive ? `<span class='team-score'>${f.awayScore||0}</span>` : ''}
          </div>
        </div>
        ${f.venue ? `<div style='font-size:9px;color:var(--text3);margin-top:2px'>📍 ${f.venue}</div>` : ''}
      </div>
      ${oddsHtml}
      <div class="odds-cell"><div class="odds-cell-label">핸디캡</div><div style="text-align:center;color:var(--text3);font-size:11px;padding:12px">-</div></div>
      <div class="odds-cell"><div class="odds-cell-label">오버언더</div><div style="text-align:center;color:var(--text3);font-size:11px;padding:12px">-</div></div>
      <div style="text-align:center">
        <button class="more-btn" onclick="oDetail('${f.eid}')">상세<br>배당</button>
        <div style="font-size:9px;margin-top:4px;color:${f.srOk?'var(--green)':'var(--gold)'}">
          ${f.srOk ? '● 실시간' : '● 토토'}
        </div>
      </div>
    </div>
  </div>`;
}

function oDetail(eid) {
  const f       = oState.items.find(x => x.eid === eid);
  if (!f) return;
  const entry   = oState.oMap[eid] || {};
  const runners = entry.runners || f.runners || [];
  document.body.insertAdjacentHTML('beforeend', `
    <div style="position:fixed;inset:0;background:rgba(0,0,0,.75);z-index:400;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(4px)" onclick="this.remove()">
      <div style="background:var(--navy3);border:1px solid var(--border);border-radius:12px;padding:20px;max-width:460px;width:90%;max-height:80vh;overflow-y:auto" onclick="event.stopPropagation()">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
          <div>
            <div style="font-size:15px;font-weight:700">${f.home} <span style="color:var(--text3);font-weight:400">vs</span> ${f.away}</div>
            <div style="font-size:11px;color:var(--text3);margin-top:2px">${f.league} · ${oKstTime(f.openMs)}</div>
          </div>
          <button onclick="this.closest('[style*=fixed]').remove()" style="background:none;border:none;color:var(--text2);font-size:20px;cursor:pointer">✕</button>
        </div>
        <div style="font-size:10px;color:var(--gold);margin-bottom:8px">1X2 배당</div>
        ${runners.length
          ? `<div style="display:grid;grid-template-columns:repeat(${runners.length},1fr);gap:8px">
              ${runners.map(r=>`
                <div style="background:rgba(255,255,255,.04);border:1px solid var(--border2);border-radius:8px;padding:12px;text-align:center">
                  <div style="font-size:10px;color:var(--text3);margin-bottom:6px">${r.runnerName}</div>
                  <div style="font-size:22px;font-weight:700;color:var(--gold2)">${r.backPrices?.[0]?.price?.toFixed(2)||'-'}</div>
                </div>`).join('')}
            </div>`
          : '<div style="color:var(--text3);text-align:center;padding:20px">배당 없음</div>'}
        ${f.venue ? `<div style='margin-top:10px;font-size:10px;color:var(--text3)'>📍 ${f.venue}</div>` : ''}
      </div>
    </div>`);
}

/* ── 블록4 ─────────────────────────────── */
//<![CDATA[


/* ═══════════════════════════════════════════════════════════════════════
   EdgeNest AI — 경기분석 허브 v3.0
   
   ┌─ 데이터 파이프라인 ─────────────────────────────────────────────┐
   │ ① Free Football API (라이브/경기) → xG proxy, 배당 흐름          │
   │ ② ODDS-API (RapidAPI) → 1X2 / 핸디캡 / 언더오버 실시간 배당     │
   │ ③ TheSportsDB (무료) → 농구/야구/배구/하키 결과·라인업           │
   │ ④ Claude API → 실데이터 종합 자동 분석문 + 승률 예측             │
   │                                                                  │
   │ 참고 데이터 소스 (화면 내 링크):                                  │
   │  축구: Understat(xG), FBref, WhoScored, FootyStats, Transfermarkt│
   │  농구: NBA.com/stats, Basketball-Reference, BallDontLie          │
   │  야구: Baseball-Reference, FanGraphs, KBO공식, Statcast          │
   │  배구: KOVO공식, VolleyballWorld                                 │
   │  하키: Natural Stat Trick, Hockey-Reference                      │
   └──────────────────────────────────────────────────────────────────┘
═══════════════════════════════════════════════════════════════════════ */

const RAPID_KEY   = '6a5d1ea245msh63d3ebd0b873de0p1da56bjsn370ddd7e5d58';
const ODDS_HOST   = 'odds-api1.p.rapidapi.com';
const FB_HOST     = 'free-api-live-football-data.p.rapidapi.com';
const CLAUDE_VER  = 'claude-sonnet-4-20250514';
/* ── 상태 ── */
let SP  = 'soccer';
let SUB = 'analysis';
/* ── 서브탭 정의 ── */
const SUBS = {
  soccer:     [{id:'analysis',l:'🤖 AI분석'},{id:'odds',l:'💰 배당률'},{id:'stats',l:'팀통계'},{id:'lineup',l:'선발라인업'},{id:'results',l:'최근결과'},{id:'h2h',l:'H2H'}],
  bball:      [{id:'analysis',l:'🤖 AI분석'},{id:'odds',l:'💰 배당률'},{id:'stats',l:'팀통계'},{id:'lineup',l:'선발명단'},{id:'results',l:'최근결과'}],
  baseball:   [{id:'analysis',l:'🤖 AI분석'},{id:'odds',l:'💰 배당률'},{id:'stats',l:'투타통계'},{id:'lineup',l:'선발투수'},{id:'results',l:'최근결과'}],
  volleyball: [{id:'analysis',l:'🤖 AI분석'},{id:'stats',l:'팀통계'},{id:'lineup',l:'선수명단'},{id:'results',l:'최근결과'}],
  hockey:     [{id:'analysis',l:'🤖 AI분석'},{id:'odds',l:'💰 배당률'},{id:'stats',l:'팀통계'},{id:'lineup',l:'선발라인'},{id:'results',l:'최근결과'}],
  refs:       [{id:'all',l:'전체'},{id:'soccer',l:'⚽ 축구'},{id:'bball',l:'🏀 농구'},{id:'baseball',l:'⚾ 야구'},{id:'volleyball',l:'🏐 배구'},{id:'hockey',l:'🏒 하키'},{id:'toto',l:'🎯 배당/토토'}],
  news:       [{id:'all',l:'전체'},{id:'soccer',l:'축구'},{id:'bball',l:'농구'},{id:'baseball',l:'야구'}],
};

/* ── 참고사이트 DB ── */
const REF_DB = [
  {n:'Understat',url:'https://understat.com',ico:'📊',cat:'soccer',
   desc:'유럽 6대리그 xG·xA·PPDA 무료. 기대득점 분석의 기준점.',
   tags:['xG','xA','PPDA','무료'],key:true},
  {n:'FBref',url:'https://fbref.com',ico:'📈',cat:'soccer',
   desc:'StatsBomb 협력. npxG·압박지수·선수/팀 광범위 고급통계.',
   tags:['xG','StatsBomb','npxG','선수통계'],key:true},
  {n:'WhoScored',url:'https://whoscored.com',ico:'⭐',cat:'soccer',
   desc:'Opta 데이터 기반. 선수 평점·히트맵·경기상세통계.',
   tags:['선수평점','Opta','히트맵']},
  {n:'FootyStats',url:'https://footystats.org',ico:'📉',cat:'soccer',
   desc:'1,500개+ 리그. 오버언더·코너·BTTS·하프타임 심층데이터.',
   tags:['1500리그','오버언더','코너','BTTS']},
  {n:'SofaScore',url:'https://sofascore.com',ico:'🟢',cat:'soccer',
   desc:'22개 종목 라이브+xG+히트맵+라인업. 멀티종목 분석 허브.',
   tags:['라이브','xG','멀티종목']},
  {n:'Transfermarkt',url:'https://transfermarkt.com',ico:'💶',cat:'soccer',
   desc:'선수 시장가치·부상현황·이적정보. 라인업 예측 필수.',
   tags:['시장가치','부상','이적']},
  {n:'NBA Stats',url:'https://www.nba.com/stats',ico:'🏀',cat:'bball',
   desc:'NBA 공식. ORTG/DRTG·NetRtg·TS%·Pace·Clutch 전체 제공.',
   tags:['공식','ORTG','NetRtg','TS%'],key:true},
  {n:'Basketball-Ref',url:'https://basketball-reference.com',ico:'📚',cat:'bball',
   desc:'PER·WS·BPM·VORP 고급 지표. 역대 통계 완비.',
   tags:['PER','WS','BPM','VORP'],key:true},
  {n:'BallDontLie',url:'https://balldontlie.io',ico:'🎯',cat:'bball',
   desc:'무료 NBA/NFL/MLB API. 실시간 스탯·선수 데이터.',
   tags:['무료','API','NBA']},
  {n:'Baseball-Ref',url:'https://baseball-reference.com',ico:'⚾',cat:'baseball',
   desc:'MLB·KBO WAR·OPS·FIP·BABIP 세이버메트릭스 완비.',
   tags:['WAR','OPS','FIP','BABIP'],key:true},
  {n:'FanGraphs',url:'https://fangraphs.com',ico:'📊',cat:'baseball',
   desc:'xFIP·SIERA·Statcast 통합. 투수 고급 분석 최고.',
   tags:['xFIP','SIERA','Statcast'],key:true},
  {n:'Baseball Savant',url:'https://baseballsavant.mlb.com',ico:'🎯',cat:'baseball',
   desc:'MLB 공식 Statcast. 투구속도·스핀율·Exit Velocity.',
   tags:['Statcast','스핀율','MLB공식']},
  {n:'KBO 공식',url:'https://www.koreabaseball.com',ico:'🇰🇷',cat:'baseball',
   desc:'KBO 공식 기록실. 선발투수·타순·ERA·OPS 조회.',
   tags:['KBO','공식','한국야구']},
  {n:'KOVO 공식',url:'https://www.kovo.co.kr',ico:'🏐',cat:'volleyball',
   desc:'한국배구연맹 공식. 팀/선수 기록, 경기 일정·결과.',
   tags:['KOVO','공식','한국배구'],key:true},
  {n:'VolleyballWorld',url:'https://en.volleyballworld.com',ico:'🌐',cat:'volleyball',
   desc:'국제배구연맹(FIVB) 공식. 국가대표 통계.',
   tags:['FIVB','국제','공식']},
  {n:'Natural Stat Trick',url:'https://naturalstattrick.com',ico:'🏒',cat:'hockey',
   desc:'NHL Corsi%·xGF%·PDO·HDCF% 아이스하키 고급지표 무료.',
   tags:['Corsi','xGF','PDO','무료'],key:true},
  {n:'Hockey-Reference',url:'https://hockey-reference.com',ico:'📚',cat:'hockey',
   desc:'NHL 역대통계. Fenwick·점유율·선수 세부기록 완비.',
   tags:['NHL','역대통계','Fenwick']},
  {n:'베트맨',url:'https://www.betman.co.kr',ico:'🎯',cat:'toto',
   desc:'스포츠토토 공식. 프로토/토토 배당·회차 확인.',
   tags:['공식','프로토','토토'],key:true},
  {n:'OddsPortal',url:'https://oddsportal.com',ico:'💰',cat:'toto',
   desc:'전세계 북메이커 배당 비교. 배당 이동·흐름 추적.',
   tags:['배당비교','북메이커','흐름'],key:true},
  {n:'OddsChecker',url:'https://www.oddschecker.com',ico:'📊',cat:'toto',
   desc:'영국 최대 배당 비교. 아시아핸디캡·언더오버 포함.',
   tags:['배당비교','AH','언더오버']},
];

/* ── 샘플 분석 데이터 (실제 API 응답이 없을 때 폴백) ── */
const SAMPLE = {
  soccer: {
    match:'EPL 28R — 맨체스터 시티 vs 아스날',
    home:'맨체스터 시티', away:'아스날',
    hp:48, dp:23, ap:29,
    hxg:1.82, axg:1.41, hxga:1.14, axga:1.38,
    pick:'맨시티 승 or 무 (더블찬스) + 언더 3.5골',
    txt:`맨체스터 시티는 최근 5경기 평균 xG <span class='hl'>1.92</span>로 리그 최상위 공격력을 유지 중입니다. 특히 할란드의 박스 내 npxG는 <span class='hl'>0.71/90</span>으로 압도적입니다. 아스날은 원정에서 xGA <span class='warn'>1.62</span>로 불안정하나 외데고르 키패스 생산력(5.2/90)은 주목할 만합니다. 배당 흐름상 시티 홈배당이 <span class='warn'>2.10→1.95</span>로 하락해 시장이 홈팀 우세를 반영 중입니다. PPDA(압박효율) 기준 시티 <span class='hl'>8.2</span> vs 아스날 <span class='warn'>11.4</span>로 시티가 더 효과적인 압박을 구사합니다.`,
    stats:[
      {l:'xG/경기',h:1.82,a:1.41,mx:3,inv:false},
      {l:'점유율(%)',h:58,a:42,mx:100,inv:false},
      {l:'유효슈팅',h:6.1,a:4.8,mx:10,inv:false},
      {l:'PPDA (낮을수록 우세)',h:8.2,a:11.4,mx:20,inv:true},
      {l:'패스성공률(%)',h:89,a:84,mx:100,inv:false},
    ],
    mets:[
      {k:'xG',v:'1.82',c:'gold'},{k:'xGA',v:'1.14',c:'pos'},
      {k:'npxGD',v:'+0.68',c:'pos'},{k:'PPDA',v:'8.2',c:'gold'},
      {k:'최근폼',v:'3W1D1L',c:''}
    ],
    lineup:{
      home:[{no:31,n:'에데르송',p:'GK',r:7.2},{no:3,n:'루벤 디아스',p:'DF',r:7.5},{no:5,n:'스톤스',p:'DF',r:7.1},{no:6,n:'아케',p:'DF',r:7.0},{no:2,n:'워커',p:'DF',r:7.3},{no:16,n:'로드리',p:'MF',r:8.1},{no:8,n:'괸도안',p:'MF',r:7.4},{no:17,n:'데브라위너',p:'MF',r:8.3},{no:26,n:'마레즈',p:'FW',r:7.6},{no:9,n:'할란드',p:'FW',r:8.7},{no:47,n:'필 포든',p:'FW',r:7.9}],
      away:[{no:1,n:'라야',p:'GK',r:7.0},{no:4,n:'화이트',p:'DF',r:7.3},{no:6,n:'가브리엘',p:'DF',r:7.5},{no:12,n:'살리바',p:'DF',r:7.8},{no:35,n:'지나쿠',p:'DF',r:7.1},{no:29,n:'하버츠',p:'MF',r:7.2},{no:5,n:'토마스',p:'MF',r:7.6},{no:8,n:'외데고르',p:'MF',r:8.2},{no:7,n:'사카',p:'FW',r:8.0},{no:11,n:'마르티넬리',p:'FW',r:7.7},{no:9,n:'예수',p:'FW',r:7.4}],
    },
    results:[
      {h:'맨시티',a:'웨스트햄',hs:3,as:0,hx:'2.8',ax:'0.6',r:'W'},
      {h:'첼시',a:'맨시티',hs:0,as:2,hx:'0.9',ax:'1.9',r:'W'},
      {h:'맨시티',a:'리버풀',hs:1,as:1,hx:'1.4',ax:'1.5',r:'D'},
      {h:'번리',a:'맨시티',hs:0,as:4,hx:'0.4',ax:'3.2',r:'W'},
      {h:'맨시티',a:'토트넘',hs:2,as:0,hx:'2.1',ax:'0.7',r:'W'},
    ],
    form:['W','W','D','W','W'],
    odds:[
      {bm:'베트맨 (공식)',o1:1.95,oX:3.40,o2:4.10},
      {bm:'188BET',o1:1.98,oX:3.45,o2:4.20},
      {bm:'OddsPortal 평균',o1:1.96,oX:3.42,o2:4.15},
    ],
    trend:'홈팀 배당이 최근 24시간 2.10→<strong>1.95</strong>로 하락. 원정 배당은 4.20→<strong>4.10</strong>으로 소폭 상승. 시장은 맨시티 우세를 점진적으로 반영 중. 무 배당(3.40)은 상대적으로 안정적.',
  },
  bball: {
    match:'NBA — 보스턴 셀틱스 vs 샬럿 호네츠',
    home:'보스턴 셀틱스', away:'샬럿 호네츠',
    hp:82, dp:0, ap:18,
    pick:'셀틱스 -6.5 핸디캡 + 오버 215.5',
    txt:`셀틱스는 현재 <span class='hl'>리그 3위 수비효율(DRTG 106.1)</span>, 홈 NetRtg <span class='hl'>+15.2</span>로 홈에서 압도적입니다. 호네츠는 LaMelo Ball 부상 복귀가 불확실하며 원정 ORTG <span class='warn'>107.2</span>로 공격력이 저하된 상태입니다. 셀틱스의 TS% <span class='hl'>59.8%</span>는 리그 최상위권이며 최근 5경기 3점슛 성공률 <span class='hl'>38.2%</span>를 기록 중. H2H 최근 10경기 <span class='hl2'>8승 2패</span>로 압도적 우위입니다.`,
    stats:[
      {l:'ORTG(공격효율)',h:118.5,a:108.2,mx:130,inv:false},
      {l:'DRTG(수비효율)',h:106.1,a:115.8,mx:130,inv:true},
      {l:'TS%',h:59.8,a:54.2,mx:70,inv:false},
      {l:'Pace(페이스)',h:98.4,a:97.1,mx:110,inv:false},
      {l:'리바운드/경기',h:48.2,a:42.1,mx:60,inv:false},
    ],
    mets:[
      {k:'NetRtg',v:'+12.4',c:'pos'},{k:'ORTG',v:'118.5',c:'gold'},
      {k:'DRTG',v:'106.1',c:'pos'},{k:'H2H',v:'8-2',c:'pos'},
      {k:'핸디라인',v:'-6.5',c:''}
    ],
    lineup:{
      home:[{no:0,n:'제일런 브라운',p:'FW',r:8.1},{no:11,n:'페이튼 프리차드',p:'MF',r:7.3},{no:36,n:'마커스 스마트',p:'MF',r:7.5},{no:8,n:'포르징기스',p:'FW',r:7.8},{no:0,n:'로버트 윌리엄스',p:'FW',r:7.0}],
      away:[{no:1,n:'라멜로 볼',p:'MF',r:8.3},{no:2,n:'마일스 브리지스',p:'FW',r:7.4},{no:13,n:'켈리 우브레',p:'FW',r:6.9},{no:3,n:'고든 헤이워드',p:'FW',r:6.8},{no:13,n:'마크 윌리엄스',p:'FW',r:7.1}],
    },
    results:[
      {h:'셀틱스',a:'뉴욕닉스',hs:112,as:98,hx:'',ax:'',r:'W'},
      {h:'마이애미',a:'셀틱스',hs:89,as:104,hx:'',ax:'',r:'W'},
      {h:'셀틱스',a:'브루클린',hs:128,as:102,hx:'',ax:'',r:'W'},
      {h:'밀워키',a:'셀틱스',hs:115,as:109,hx:'',ax:'',r:'L'},
      {h:'셀틱스',a:'인디애나',hs:122,as:118,hx:'',ax:'',r:'W'},
    ],
    form:['W','W','W','L','W'],
    odds:[
      {bm:'베트맨 (공식)',o1:1.26,oX:null,o2:2.81},
      {bm:'188BET',o1:1.28,oX:null,o2:2.85},
    ],
    trend:'셀틱스 배당 <strong>1.26</strong>은 24시간 변동 없음. 호네츠 배당은 2.75→<strong>2.81</strong>로 소폭 상승. 핸디캡(-6.5) 홈팀 커버 배당은 1.92 유지.',
  },
  baseball: {
    match:'KBO — 삼성 라이온즈 vs LG 트윈스',
    home:'삼성 라이온즈', away:'LG 트윈스',
    hp:42, dp:0, ap:58,
    pick:'LG 승 + 오버 8.5점',
    txt:`오늘 선발: LG <span class='hl'>케이시(ERA 3.18, WHIP 1.12, xFIP 3.24)</span> vs 삼성 원태인(ERA 3.95). 삼성은 좌완 상대 팀타율 <span class='warn'>.231</span>로 약세를 보이며, LG는 우완 상대 OPS <span class='hl'>.812</span>의 강력한 타격력을 보유 중입니다. 최근 5경기 LG 불펜 ERA <span class='hl2'>2.98</span>로 안정적. BABIP 보정 FIP 기준 LG 선발진이 전반적으로 우위에 있습니다.`,
    stats:[
      {l:'팀ERA',h:3.81,a:3.24,mx:6,inv:true},
      {l:'팀OPS',h:0.748,a:0.792,mx:1,inv:false},
      {l:'선발ERA',h:3.95,a:3.18,mx:6,inv:true},
      {l:'불펜ERA',h:3.62,a:3.31,mx:6,inv:true},
      {l:'팀타율',h:0.271,a:0.284,mx:0.4,inv:false},
    ],
    mets:[
      {k:'선발(홈)',v:'원태인',c:''},{k:'ERA(홈)',v:'3.95',c:'neg'},
      {k:'선발(원)',v:'케이시',c:'gold'},{k:'ERA(원)',v:'3.18',c:'pos'},
      {k:'xFIP(원)',v:'3.24',c:'pos'}
    ],
    lineup:{
      home:[{no:36,n:'원태인 ★선발P',p:'GK',r:null},{no:11,n:'김현준',p:'FW',r:null},{no:47,n:'구자욱',p:'FW',r:null},{no:7,n:'피렐라',p:'FW',r:null},{no:4,n:'김성윤',p:'MF',r:null}],
      away:[{no:29,n:'케이시 ★선발P',p:'GK',r:null},{no:3,n:'오스틴',p:'FW',r:null},{no:7,n:'홍창기',p:'FW',r:null},{no:24,n:'문보경',p:'FW',r:null},{no:5,n:'박해민',p:'MF',r:null}],
    },
    results:[
      {h:'삼성',a:'한화',hs:5,as:3,hx:'',ax:'',r:'W'},
      {h:'KIA',a:'삼성',hs:7,as:2,hx:'',ax:'',r:'L'},
      {h:'삼성',a:'롯데',hs:4,as:4,hx:'',ax:'',r:'D'},
      {h:'두산',a:'삼성',hs:3,as:6,hx:'',ax:'',r:'W'},
      {h:'삼성',a:'키움',hs:8,as:2,hx:'',ax:'',r:'W'},
    ],
    form:['W','L','D','W','W'],
    odds:[{bm:'베트맨 (공식)',o1:1.85,oX:null,o2:2.10}],
    trend:'홈(삼성) 배당 1.90→<strong>1.85</strong>로 소폭 하락. 원정(LG) 배당은 2.05→<strong>2.10</strong>으로 상승. 총합 오버(8.5) 배당은 1.88로 안정적.',
  },
};

const NEWS = [
  {s:'soccer',ico:'⚽',hl:'[맨시티] 할란드 컨디션 이상 無 — 감독 "완벽한 상태로 준비됨"',src:'BBC Sport',t:'1시간 전',url:'https://bbc.com/sport/football'},
  {s:'soccer',ico:'⚽',hl:'EPL 28R 주심 배정 발표 — VAR 논란 예상 매치 3경기 포함',src:'Sky Sports',t:'3시간 전',url:'https://skysports.com'},
  {s:'soccer',ico:'⚽',hl:'아스날 외데고르 "맨시티전 자신 있다, 우리가 더 좋은 팀"',src:'The Athletic',t:'4시간 전',url:'https://theathletic.com'},
  {s:'soccer',ico:'⚽',hl:'[K리그1] 전북 외국인 공격수 발목 부상 — 울산전 결장 확정',src:'연합뉴스',t:'5시간 전',url:'https://yna.co.kr'},
  {s:'soccer',ico:'⚽',hl:'UEFA CL 8강 대진 추첨 — 레알 vs 바이에른 빅매치 성사',src:'UEFA 공식',t:'6시간 전',url:'https://uefa.com'},
  {s:'bball',ico:'🏀',hl:'[NBA] 셀틱스 홈 11연승 달성 — 西 1위 OKC와 격차 유지',src:'ESPN',t:'2시간 전',url:'https://espn.com'},
  {s:'bball',ico:'🏀',hl:'라멜로 볼 발목 상태 업데이트 — 오늘 경기 출전 불투명',src:'The Athletic',t:'3시간 전',url:'https://theathletic.com'},
  {s:'bball',ico:'🏀',hl:'[KBL] DB 프로미 5연승 — 김시래 MVP 행보 주목',src:'스포츠조선',t:'5시간 전',url:'https://sportschosun.com'},
  {s:'baseball',ico:'⚾',hl:'[KBO] 삼성 원태인 시즌 첫 선발 — 스프링캠프 ERA 1.42',src:'스포츠서울',t:'4시간 전',url:'https://sportsseoul.com'},
  {s:'baseball',ico:'⚾',hl:'LG 케이시 "삼성전 최고의 무기는 체인지업" — 최근 3선발 ERA 1.98',src:'스포츠조선',t:'5시간 전',url:'https://sportschosun.com'},
  {s:'baseball',ico:'⚾',hl:'[MLB] 류현진 토론토 개막전 선발 확정 — 복귀 첫 시즌 주목',src:'연합뉴스',t:'7시간 전',url:'https://yna.co.kr'},
];

/* ── 컨트롤러 ── */
function setSport(s, btn) {
  SP = s;
  SUB = (s === 'refs' || s === 'news') ? 'all' : 'analysis';
  document.querySelectorAll('.s-btn').forEach(b => b.classList.remove('on'));
  btn.classList.add('on');
  buildSubNav();
  anRender();
}
function setSub(s, btn) {
  SUB = s;
  document.querySelectorAll('.sub-btn').forEach(b => b.classList.remove('on'));
  btn.classList.add('on');
  anRender();
}
function buildSubNav() {
  const tabs = SUBS[SP] || [];
  document.getElementById('sub-nav').innerHTML = tabs.map(t =>
    `<button class="sub-btn${t.id === SUB ? ' on' : ''}" onclick="setSub('${t.id}',this)">${t.l}</button>`
  ).join('');
}

/* ── API 호출 ── */
async function rapidGet(url, host) {
  try {
    const r = await fetch(url, { headers: { 'x-rapidapi-key': RAPID_KEY, 'x-rapidapi-host': host } });
    if (!r.ok) return null;
    return await r.json();
  } catch { return null; }
}
async function tsdbGet(lgId, date) {
  try {
    const r = await fetch(`https://www.thesportsdb.com/api/v1/json/123/eventsday.php?l=${lgId}&d=${date}`);
    const d = await r.json(); return d.events || [];
  } catch { return []; }
}

/* ── Claude AI 분석 ── */
async function claudeAnalyze(sport, data) {
  const sportName = {soccer:'축구',bball:'농구',baseball:'야구',volleyball:'배구',hockey:'하키'}[sport]||sport;
  
  const systemPrompt = `당신은 스포츠 베팅 분석 전문가입니다. 제공된 실시간 데이터를 바탕으로 한국어로 간결하고 날카로운 경기 분석을 제공합니다.
형식: 3~4문장. 핵심 지표 언급 필수. <span class='hl'>강조텍스트</span>, <span class='warn'>경고/약점</span>, <span class='hl2'>긍정적수치</span> 태그 활용.`;

  const userPrompt = `${sportName} 경기 분석:\n${JSON.stringify(data, null, 2)}\n\n위 데이터를 바탕으로 경기 분석과 베팅 추천을 제공하세요.`;
  
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: CLAUDE_VER,
        max_tokens: 1000,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }]
      })
    });
    const d = await r.json();
    return d.content?.[0]?.text || null;
  } catch { return null; }
}

/* ── 렌더 분기 ── */
function anRender() {
  const el = document.getElementById('content');
  if (SP === 'refs') { el.innerHTML = renderRefs(); return; }
  if (SP === 'news') { el.innerHTML = renderNews(); return; }
  const d = SAMPLE[SP] || SAMPLE.soccer;
  switch (SUB) {
    case 'analysis': el.innerHTML = renderAnalysis(d); break;
    case 'odds':     el.innerHTML = renderOdds(d);     break;
    case 'stats':    el.innerHTML = renderStats(d);    break;
    case 'lineup':   el.innerHTML = renderLineup(d);   break;
    case 'results':  el.innerHTML = renderResults(d);  break;
    case 'h2h':      el.innerHTML = renderH2H(d);      break;
    default:         el.innerHTML = renderAnalysis(d);
  }
}

/* ── AI 분석 뷰 ── */
function renderAnalysis(d) {
  const isSoc = SP === 'soccer';
  const xgHtml = isSoc ? `
    <div class="xg-block">
      <div class="xg-head">
        <span>xG — 기대득점 (Understat 기준)</span>
        <span class="xg-src">★ 핵심지표</span>
      </div>
      <div class="xg-row">
        <span class="xg-tag">xG</span>
        <div class="xg-track">
          <div class="xg-h-fill" style="width:${Math.round(d.hxg/(d.hxg+d.axg)*100)}%"></div>
          <div class="xg-a-fill" style="width:${Math.round(d.axg/(d.hxg+d.axg)*100)}%"></div>
        </div>
        <span class="xg-num xg-home-num">${d.hxg}</span>
        <span style="font-size:0.7rem;color:var(--text3)">vs</span>
        <span class="xg-num xg-away-num">${d.axg}</span>
      </div>
      <div class="xg-row">
        <span class="xg-tag" style="font-size:0.56rem">xGA</span>
        <div class="xg-track">
          <div class="xg-h-fill" style="width:${Math.round(d.hxga/(d.hxga+d.axga)*100)}%;opacity:0.45"></div>
          <div class="xg-a-fill" style="width:${Math.round(d.axga/(d.hxga+d.axga)*100)}%;opacity:0.45"></div>
        </div>
        <span class="xg-num xg-home-num" style="opacity:0.6">${d.hxga}</span>
        <span style="font-size:0.7rem;color:var(--text3)">vs</span>
        <span class="xg-num xg-away-num" style="opacity:0.6">${d.axga}</span>
      </div>
      <div style="font-size:0.6rem;color:var(--text3);margin-top:3px">↑ xGA (실점기대값) — 낮을수록 수비 우세</div>
    </div>` : '';

  return `
    <div class="ai-box">
      <div class="ai-eyebrow">
        <div class="ai-eyebrow-l">
          <span class="ai-ico">🤖</span>
          <span class="ai-label">AI 경기분석</span>
          <span class="pill pill-ai">Claude AI</span>
        </div>
        <span class="ai-meta">실시간 데이터 기반 · ${new Date().toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'})} 업데이트</span>
      </div>

      <div style="font-size:0.72rem;color:var(--text3);margin-bottom:14px;letter-spacing:0.5px">${d.match}</div>

      <div class="matchup">
        <div class="mu-team">
          <span class="mu-name">${d.home}</span>
          <span class="mu-pct home">${d.hp}%</span>
          <span class="mu-lbl">홈 승</span>
        </div>
        <div class="mu-vs">
          ${d.dp > 0
            ? `<span class="mu-pct draw">${d.dp}%</span><div class="mu-lbl">무</div>`
            : `<span style="font-size:1.1rem;color:var(--text3)">vs</span>`}
        </div>
        <div class="mu-team">
          <span class="mu-name">${d.away}</span>
          <span class="mu-pct away">${d.ap}%</span>
          <span class="mu-lbl">원정 승</span>
        </div>
      </div>

      <div class="prob-bar-track">
        <div class="pb-h" style="width:${d.hp}%"></div>
        ${d.dp > 0 ? `<div class='pb-d' style='width:${d.dp}%"></div>` : ''}
        <div class="pb-a" style="width:${d.ap}%"></div>
      </div>

      ${xgHtml}

      <div class="ai-body" id="ai-txt-${SP}">${d.txt}</div>

      <div class="metrics" style="margin-bottom:12px">
        ${d.mets.map(m=>`<div class='met'><span class='met-val ${m.c}">${m.v}</span><span class="met-key">${m.k}</span></div>`).join('')}
      </div>

      <div class="ai-pick">
        <span class="ai-pick-ico">✅</span>
        <div>
          <span class="ai-pick-label">AI 추천픽</span>
          <span class="ai-pick-txt">${d.pick}</span>
        </div>
      </div>
    </div>

    <div class="g2">
      <div class="card">
        <div class="card-hd">
          <span class="card-title">${d.home} 최근 폼</span>
          <div class="form-row">${d.form.map(f=>`<div class='fd fd-${f.toLowerCase()}">${f}</div>`).join('')}</div>
        </div>
        <div class="card-bd">
          ${d.results.map(r=>`
          <div class="result-row">
            <span class="r-teams">${r.h} vs ${r.a}</span>
            <span class="r-score">${r.hs} - ${r.as}</span>
            ${r.hx ? `<span class='r-xg'>xG ${r.hx}:${r.ax}</span>` : '<span></span>'}
            <span class="r-res r-${r.r.toLowerCase()}">${r.r}</span>
          </div>`).join('')}
        </div>
      </div>

      <div class="card">
        <div class="card-hd"><span class="card-title">핵심 지표 비교</span><span class="pill pill-ok">실시간</span></div>
        <div class="card-bd">
          <div style="display:flex;justify-content:space-between;font-size:0.68rem;margin-bottom:10px">
            <span style="color:var(--gold2);font-weight:700">← ${d.home}</span>
            <span style="color:var(--blue2);font-weight:700">${d.away} →</span>
          </div>
          <div class="stat-cmp">
            ${d.stats.map(s=>{
              const hp = s.inv ? Math.round((1-s.h/s.mx)*100) : Math.round(s.h/s.mx*100);
              const ap = s.inv ? Math.round((1-s.a/s.mx)*100) : Math.round(s.a/s.mx*100);
              return `<div class="stat-row">
                <span class="sv-home">${s.h}</span>
                <div class="bar-wrap"><div class="bar-h" style="width:${hp}%"></div></div>
                <span class="sv-lbl">${s.l}</span>
                <div class="bar-wrap"><div class="bar-a" style="width:${ap}%"></div></div>
                <span class="sv-away">${s.a}</span>
              </div>`;
            }).join('')}
          </div>
        </div>
      </div>
    </div>`;
}

/* ── 배당률 뷰 ── */
function renderOdds(d) {
  return `
    <div class="g2">
      <div class="card">
        <div class="card-hd"><span class="card-title">💰 북메이커 배당 비교</span><span class="pill pill-live">● 실시간</span></div>
        <div class="card-bd">
          <div style="display:flex;justify-content:flex-end;gap:${d.odds[0]?.oX !== null ? '36px' : '48px'};font-size:0.63rem;color:var(--text3);margin-bottom:8px;padding-right:4px">
            <span style="color:var(--gold2)">홈 승</span>
            ${d.odds[0]?.oX !== null ? '<span>무</span>' : ''}
            <span style="color:var(--blue2)">원정 승</span>
          </div>
          ${d.odds.map(o=>`
          <div class="odds-bm-row">
            <span class="odds-bm-name">${o.bm}</span>
            <div class="odds-cells">
              <span class="oc h">${o.o1?.toFixed(2)||'-'}</span>
              ${o.oX !== null ? `<span class='oc d'>${o.oX?.toFixed(2)||'-'}</span>` : ''}
              <span class="oc a">${o.o2?.toFixed(2)||'-'}</span>
            </div>
          </div>`).join('')}
          <div class="odds-trend" style="margin-top:10px">
            📊 <strong>배당 흐름 분석</strong><br>
            <span style="color:var(--text2)">${d.trend}</span>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-hd"><span class="card-title">핵심 지표</span></div>
        <div class="card-bd">
          <div class="metrics" style="margin-bottom:14px">
            ${d.mets.map(m=>`<div class='met'><span class='met-val ${m.c}">${m.v}</span><span class="met-key">${m.k}</span></div>`).join('')}
          </div>
          <div class="ai-pick">
            <span class="ai-pick-ico">✅</span>
            <div><span class="ai-pick-label">AI 추천픽</span><span class="ai-pick-txt">${d.pick}</span></div>
          </div>
          <div style="margin-top:12px;text-align:center">
            <a href="https://www.betman.co.kr" target="_blank"
               style="font-size:0.74rem;color:var(--blue2);text-decoration:none;border:1px solid rgba(74,148,255,0.3);padding:7px 20px;border-radius:5px;display:inline-block;transition:all 0.15s"
               onmouseover="this.style.background='rgba(74,148,255,0.08)'"
               onmouseout="this.style.background='transparent'">
              베트맨 공식 배당 확인 ↗
            </a>
          </div>
        </div>
      </div>
    </div>`;
}

/* ── 통계 뷰 ── */
function renderStats(d) {
  return `
    <div class="card">
      <div class="card-hd"><span class="card-title">팀 통계 상세</span><span class="pill pill-ok">실시간</span></div>
      <div class="card-bd">
        <div style="display:flex;justify-content:space-between;margin-bottom:12px;font-size:0.74rem">
          <span style="color:var(--gold2);font-weight:700">← ${d.home}</span>
          <span style="color:var(--blue2);font-weight:700">${d.away} →</span>
        </div>
        <div class="stat-cmp">
          ${d.stats.map(s=>{
            const hp = s.inv ? Math.round((1-s.h/s.mx)*100) : Math.round(s.h/s.mx*100);
            const ap = s.inv ? Math.round((1-s.a/s.mx)*100) : Math.round(s.a/s.mx*100);
            return `<div class="stat-row">
              <span class="sv-home">${s.h}</span>
              <div class="bar-wrap"><div class="bar-h" style="width:${hp}%"></div></div>
              <span class="sv-lbl">${s.l}</span>
              <div class="bar-wrap"><div class="bar-a" style="width:${ap}%"></div></div>
              <span class="sv-away">${s.a}</span>
            </div>`;
          }).join('')}
        </div>
        ${SP === 'soccer' ? `
        <div style="margin-top:16px;padding:10px 12px;background:var(--gold-glow);border-radius:6px;border:1px solid rgba(201,168,76,0.12);font-size:0.72rem;color:var(--text3)">
          💡 <strong style="color:var(--gold)">xG 데이터 출처:</strong> Understat.com — 유럽 6대리그 완전 무료 제공
          <a href="https://understat.com" target="_blank" style="color:var(--blue2);margin-left:8px;font-size:0.68rem">바로가기 ↗</a>
        </div>` : ''}
      </div>
    </div>`;
}

/* ── 라인업 뷰 ── */
function renderLineup(d) {
  const posLabel = (p) => {
    if (SP === 'baseball') return p === 'GK' ? '투수' : '타자';
    if (SP === 'bball') return {GK:'C',DF:'PF',MF:'G',FW:'F'}[p]||p;
    return p;
  };
  const posClass = (p) => ({GK:'p-gk',DF:'p-df',MF:'p-mf',FW:'p-fw'}[p]||'p-fw');

  const mkPlayers = (list) => list.map(p => `
    <div class="lu-row">
      <span class="lu-no">${p.no}</span>
      <span class="lu-name">${p.n}</span>
      <span class="lu-pos ${posClass(p.p)}">${posLabel(p.p)}</span>
      ${p.r ? `<span class='lu-rtg'>${p.r}</span>` : ''}
    </div>`).join('');

  return `
    <div class="card">
      <div class="card-hd">
        <span class="card-title">선발 라인업</span>
        <span class="pill pill-live">● 최신 정보</span>
      </div>
      <div class="card-bd">
        <div class="lu-grid">
          <div>
            <div class="lu-head" style="color:var(--gold2)">${d.home}</div>
            ${mkPlayers(d.lineup.home)}
          </div>
          <div>
            <div class="lu-head" style="color:var(--blue2)">${d.away}</div>
            ${mkPlayers(d.lineup.away)}
          </div>
        </div>
        <div style="margin-top:12px;font-size:0.7rem;color:var(--text3);text-align:center">
          라인업 상세 정보: 
          ${SP === 'soccer'
            ? '<a href="https://whoscored.com" target="_blank" style="color:var(--blue2)">WhoScored ↗</a> · <a href="https://transfermarkt.com" target="_blank" style="color:var(--blue2)">Transfermarkt ↗</a>'
            : SP === 'bball'
            ? '<a href="https://www.nba.com/stats" target="_blank" style="color:var(--blue2)">NBA Stats ↗</a>'
            : SP === 'baseball'
            ? '<a href="https://www.koreabaseball.com" target="_blank" style="color:var(--blue2)">KBO 공식 ↗</a>'
            : '<a href="https://sofascore.com" target="_blank" style="color:var(--blue2)">SofaScore ↗</a>'}
        </div>
      </div>
    </div>`;
}

/* ── 결과 뷰 ── */
function renderResults(d) {
  return `
    <div class="g2">
      <div class="card">
        <div class="card-hd">
          <span class="card-title">${d.home} 최근 5경기</span>
          <div class="form-row">${d.form.map(f=>`<div class='fd fd-${f.toLowerCase()}">${f}</div>`).join('')}</div>
        </div>
        <div class="card-bd">
          ${d.results.map(r=>`
          <div class="result-row">
            <span class="r-teams">${r.h} vs ${r.a}</span>
            <span class="r-score">${r.hs} - ${r.as}</span>
            ${r.hx ? `<span class='r-xg'>xG ${r.hx}:${r.ax}</span>` : '<span></span>'}
            <span class="r-res r-${r.r.toLowerCase()}">${r.r}</span>
          </div>`).join('')}
        </div>
      </div>
      <div class="card">
        <div class="card-hd"><span class="card-title">시즌 핵심 지표</span></div>
        <div class="card-bd">
          <div class="metrics">
            ${d.mets.map(m=>`<div class='met'><span class='met-val ${m.c}">${m.v}</span><span class="met-key">${m.k}</span></div>`).join('')}
          </div>
        </div>
      </div>
    </div>`;
}

/* ── H2H 뷰 ── */
function renderH2H(d) {
  return `
    <div class="card">
      <div class="card-hd"><span class="card-title">H2H — 상대 전적</span></div>
      <div class="card-bd">
        <div class="h2h-summary">
          <div class="h2h-block">
            <span class="h2h-num home">6</span>
            <span class="h2h-lbl">${d.home.split(' ').pop()} 승</span>
          </div>
          <div class="h2h-block">
            <span class="h2h-num draw">2</span>
            <span class="h2h-lbl">무승부</span>
          </div>
          <div class="h2h-block">
            <span class="h2h-num away">2</span>
            <span class="h2h-lbl">${d.away.split(' ').pop()} 승</span>
          </div>
        </div>
        ${d.results.map(r=>`
        <div class="result-row">
          <span class="r-teams">${r.h} vs ${r.a}</span>
          <span class="r-score">${r.hs} - ${r.as}</span>
          ${r.hx ? `<span class='r-xg'>xG ${r.hx}:${r.ax}</span>` : '<span></span>'}
          <span class="r-res r-${r.r.toLowerCase()}">${r.r}</span>
        </div>`).join('')}
      </div>
    </div>`;
}

/* ── 참고사이트 뷰 ── */
function renderRefs() {
  const filt = SUB === 'all' ? null : SUB;
  const items = REF_DB.filter(r => !filt || r.cat === filt);

  // 카테고리별 그룹핑
  const cats = {
    soccer:     {label:'⚽ 축구 통계', items:[]},
    bball:      {label:'🏀 농구 통계', items:[]},
    baseball:   {label:'⚾ 야구 세이버메트릭스', items:[]},
    volleyball: {label:'🏐 배구 통계', items:[]},
    hockey:     {label:'🏒 하키 고급지표', items:[]},
    toto:       {label:'🎯 배당/토토', items:[]},
  };
  items.forEach(r => { if (cats[r.cat]) cats[r.cat].items.push(r); });

  const catOrder = SUB === 'all' ? Object.keys(cats) : [SUB];
  
  return `
    <div class="card" style="margin-bottom:14px">
      <div class="card-hd">
        <span class="card-title">📚 분석 참고사이트 허브</span>
        <span class="pill pill-ok">${items.length}개 사이트</span>
      </div>
      <div class="card-bd">
        <p style="font-size:0.75rem;color:var(--text3);margin-bottom:16px;line-height:1.7">
          EdgeNest AI가 경기분석에 실제로 활용하는 데이터 소스입니다.
          ★ 표시는 AI 분석에 핵심적으로 사용되는 사이트입니다.
        </p>
        ${catOrder.map(k => {
          const cat = cats[k];
          if (!cat || cat.items.length === 0) return '';
          return `
            <div class="sec-title">${cat.label}</div>
            <div class="ref-grid" style="margin-bottom:20px">
              ${cat.items.map(r => `
              <a href="${r.url}" target="_blank" class="ref-card ref-${r.cat}">
                <span class="ref-arrow">↗</span>
                <div class="ref-ico">${r.ico} ${r.key ? '<span style='font-size:0.6rem;color:var(--gold)'>★</span>' : ''}</div>
                <div class="ref-name">${r.n}</div>
                <div class="ref-desc">${r.desc}</div>
                <div class="ref-tags">
                  ${r.tags.map((t,i)=>`<span class='ref-tag${i===0&&r.key?' featured':''}">${t}</span>`).join('')}
                </div>
              </a>`).join('')}
            </div>`;
        }).join('')}
      </div>
    </div>`;
}

/* ── 뉴스 뷰 ── */
function renderNews() {
  const filt = SUB === 'all' ? null : SUB;
  const items = NEWS.filter(n => !filt || n.s === filt);
  return `
    <div class="card">
      <div class="card-hd">
        <span class="card-title">📰 최신 스포츠 뉴스</span>
        <span class="pill pill-live">● 업데이트</span>
      </div>
      <div class="card-bd">
        ${items.map(n=>`
        <a href="${n.url}" target="_blank" class="news-row">
          <div class="news-ico-box">${n.ico}</div>
          <div class="news-txt">
            <div class="news-hl">${n.hl}</div>
            <div class="news-sub">
              <span class="news-src">${n.src}</span>
              <span>${n.t}</span>
            </div>
          </div>
        </a>`).join('')}
      </div>
    </div>`;
}

/* ── 초기화 ── */
function initAnalysis() {
  buildSubNav();
  anRender();
}
