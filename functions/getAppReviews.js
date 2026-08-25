/**
 * Ridemate — Play Store 리뷰 조회 프록시
 *
 * 리뷰 분석/개선안 도출 파이프라인의 "수집" 레이어. Google Play Developer API
 * (androidpublisher) reviews.list를 서비스 계정 자격증명으로 호출해서 원본 리뷰를
 * 그대로 반환한다. 감성분석/패턴 요약 같은 "지능"이 필요한 부분은 여기서 하지 않고
 * 호출하는 쪽(Claude 예약 작업)이 직접 판단한다 — 이 함수는 자격증명을 안전하게 다루는
 * 얇은 프록시 역할만 한다.
 *
 * 이 앱의 실제 사용자를 대상으로 한 게 아니라 개발자 본인의 리뷰 모니터링 도구용이라,
 * 아무나 호출 못 하도록 공유 토큰(REVIEW_MONITOR_TOKEN)으로 막아둠 — 다른 프록시
 * 함수들(anthropicProxy 등)과 달리 앱에서 직접 호출하지 않으므로 CORS는 열 필요 없음.
 *
 * 필요 시크릿:
 *   firebase functions:secrets:set PLAY_REVIEWS_SA_KEY   (서비스 계정 JSON 키 전체 내용)
 *   firebase functions:secrets:set REVIEW_MONITOR_TOKEN  (호출자 인증용 임의 토큰)
 */

const { onRequest } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const { JWT } = require('google-auth-library');

const PLAY_REVIEWS_SA_KEY = defineSecret('PLAY_REVIEWS_SA_KEY');
const REVIEW_MONITOR_TOKEN = defineSecret('REVIEW_MONITOR_TOKEN');

const PACKAGE_NAME = 'com.iconbox.motogarage';
const SCOPE = 'https://www.googleapis.com/auth/androidpublisher';

let cachedClient = null;
let cachedKeyRaw = null;

function getAuthClient(keyRaw) {
  // 같은 컨테이너 인스턴스가 재사용될 때(콜드스타트 아닐 때) 매번 새로 만들지 않도록 캐시
  if (cachedClient && cachedKeyRaw === keyRaw) return cachedClient;
  const credentials = JSON.parse(keyRaw);
  cachedClient = new JWT({
    email: credentials.client_email,
    key: credentials.private_key,
    scopes: [SCOPE],
  });
  cachedKeyRaw = keyRaw;
  return cachedClient;
}

exports.getAppReviews = onRequest(
  { secrets: [PLAY_REVIEWS_SA_KEY, REVIEW_MONITOR_TOKEN], timeoutSeconds: 60, invoker: 'public' },
  async (req, res) => {
    const auth = req.get('Authorization') || '';
    if (auth !== `Bearer ${REVIEW_MONITOR_TOKEN.value()}`) {
      res.status(401).json({ error: 'unauthorized' });
      return;
    }
    try {
      const client = getAuthClient(PLAY_REVIEWS_SA_KEY.value());
      const url = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${PACKAGE_NAME}/reviews?maxResults=100`;
      const response = await client.request({ url });
      const reviews = (response.data && response.data.reviews) || [];

      const since = req.query.since ? Number(req.query.since) : null;
      const filtered = since
        ? reviews.filter(function (r) {
            const c = r.comments && r.comments[0] && r.comments[0].userComment;
            const modMs = c && c.lastModified && c.lastModified.seconds ? Number(c.lastModified.seconds) * 1000 : 0;
            return modMs >= since;
          })
        : reviews;

      res.status(200).json({ reviews: filtered, totalFetched: reviews.length });
    } catch (e) {
      console.error('[getAppReviews]', e);
      res.status(500).json({ error: 'fetch failed', detail: e.message });
    }
  }
);
