/**
 * Ridemate — 다녀온 곳 장소 후보 조회 (디버그 빌드 전용, 라이딩 정차/종료 지점 좌표로 근처 POI 후보 검색)
 *
 * 필요 시크릿:
 *   firebase functions:secrets:set GOOGLE_PLACES_API_KEY
 */

const { onRequest } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');

const GOOGLE_PLACES_API_KEY = defineSecret('GOOGLE_PLACES_API_KEY');

const POI_TYPES = ['cafe', 'restaurant', 'tourist_attraction', 'gas_station', 'lodging'];
const SEARCH_RADIUS_M = 300;
const MAX_RESULTS = 8;

exports.visitedPlacePoi = onRequest(
  { cors: true, secrets: [GOOGLE_PLACES_API_KEY] },
  async (req, res) => {
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'POST only' });
      return;
    }
    const { lat, lon } = req.body || {};
    if (typeof lat !== 'number' || typeof lon !== 'number') {
      res.status(400).json({ error: 'lat, lon required' });
      return;
    }
    try {
      const response = await fetch('https://places.googleapis.com/v1/places:searchNearby', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': GOOGLE_PLACES_API_KEY.value(),
          'X-Goog-FieldMask': 'places.displayName,places.types,places.location',
        },
        body: JSON.stringify({
          includedTypes: POI_TYPES,
          maxResultCount: MAX_RESULTS,
          locationRestriction: {
            circle: { center: { latitude: lat, longitude: lon }, radius: SEARCH_RADIUS_M },
          },
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        console.error('[visitedPlacePoi] Places API error', data);
        res.status(response.status).json({ error: 'places api error', detail: data });
        return;
      }
      const candidates = (data.places || []).map(function (p) {
        return {
          name: p.displayName && p.displayName.text,
          types: p.types || [],
          lat: p.location && p.location.latitude,
          lon: p.location && p.location.longitude,
        };
      });
      res.status(200).json({ candidates });
    } catch (e) {
      console.error('[visitedPlacePoi]', e);
      res.status(500).json({ error: 'proxy error' });
    }
  }
);
