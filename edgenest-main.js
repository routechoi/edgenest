// Cloudflare Workers 프록시
// 배포: https://workers.cloudflare.com (무료 100,000 req/일)

const TOTO_KEY = 'eadf4c25aa7203f6d1840a2f4306649ab030e91188580b588e93e4b1e230e6bb';
const SR_KEY   = '6a5d1ea245msh63d3ebd0b873de0p1da56bjsn370ddd7e5d58';
const SR_HOST  = 'sportsradar-sportsbook-api.p.rapidapi.com';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Content-Type': 'application/json',
};

export default {
  async fetch(request) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    try {
      // 1) 스포츠토토 API
      if (path === '/toto') {
        const params = new URLSearchParams({
          serviceKey: TOTO_KEY,
          pageNo: '1',
          numOfRows: '100',
          resultType: 'json',
          MATCH_DATE: url.searchParams.get('date') || getTodayKST(),
        });
        const sport = url.searchParams.get('sport');
        if (sport) params.set('SPORT_TYPE', sport);

        const res = await fetch(
          'https://apis.data.go.kr/B551014/SRVC_OD_API_TB_SOSFO_MATCH_MGMT/todz_api_tb_match_mgmt_i?' + params
        );
        const data = await res.json();
        return new Response(JSON.stringify(data), { headers: CORS });
      }

      // 2) Sportsradar inplay
      if (path === '/sr/inplay') {
        const sportId = url.searchParams.get('sportId') || 'sr:sport:1';
        const res = await fetch(
          `https://sportsradar-sportsbook-api.p.rapidapi.com/api/v1/sportsradar/inplay-events?pageNo=1&sportId=${sportId}`,
          { headers: { 'x-rapidapi-host': SR_HOST, 'x-rapidapi-key': SR_KEY } }
        );
        const data = await res.json();
        return new Response(JSON.stringify(data), { headers: CORS });
      }

      // 3) Sportsradar upcoming
      if (path === '/sr/upcoming') {
        const sportId = url.searchParams.get('sportId') || 'sr:sport:1';
        const res = await fetch(
          `https://sportsradar-sportsbook-api.p.rapidapi.com/api/v1/sportsradar/upcoming-events?pageNo=1&sportId=${sportId}`,
          { headers: { 'x-rapidapi-host': SR_HOST, 'x-rapidapi-key': SR_KEY } }
        );
        const data = await res.json();
        return new Response(JSON.stringify(data), { headers: CORS });
      }

      return new Response(JSON.stringify({ error: 'not found' }), { status: 404, headers: CORS });

    } catch(e) {
      return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: CORS });
    }
  }
};

function getTodayKST() {
  const d = new Date(Date.now() + 9 * 3600000);
  return d.toISOString().slice(0,10).replace(/-/g,'');
}
